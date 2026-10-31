"""Build signed APK with Android SDK 35, JDK and the already built web/ assets.
Required: ANDROID_JAR, ANDROID_BUILD_TOOLS, CONTIG_KEYSTORE, CONTIG_STOREPASS_FILE.
Never commit the signing key or its password. Use the same key for updates.
"""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
tools = Path(os.environ['ANDROID_BUILD_TOOLS'])
jar = Path(os.environ['ANDROID_JAR'])
keystore = Path(os.environ['CONTIG_KEYSTORE'])
password_file = Path(os.environ['CONTIG_STOREPASS_FILE'])
output = root / 'downloads' / 'Contig60.apk'

def run(*command):
    subprocess.run([str(x) for x in command], check=True)

with tempfile.TemporaryDirectory(prefix='contig-apk-') as temp:
    work = Path(temp)
    classes = work / 'classes'; classes.mkdir()
    assets = work / 'assets'; assets.mkdir()
    shutil.copytree(root / 'web', assets / 'web')
    run(tools / 'aapt2', 'link', '-I', jar, '--manifest', root / 'android/AndroidManifest.xml', '-A', assets, '-o', work / 'unsigned.apk')
    sources = list((root / 'android/src').rglob('*.java'))
    if os.environ.get('CONTIG_ECJ'):
        run('java', '-jar', os.environ['CONTIG_ECJ'], '-source', '8', '-target', '8', '-bootclasspath', jar, '-d', classes, *sources)
    else:
        run('javac', '--release', '8', '-classpath', jar, '-d', classes, *sources)
    run(tools / 'd8', '--lib', jar, '--min-api', '26', '--output', work, *classes.rglob('*.class'))
    with zipfile.ZipFile(work / 'unsigned.apk', 'a') as apk:
        for dex in work.glob('*.dex'):
            apk.write(dex, dex.name)
    run(tools / 'zipalign', '-f', '-p', '4', work / 'unsigned.apk', work / 'aligned.apk')
    run(tools / 'apksigner', 'sign', '--ks', keystore, '--ks-key-alias', 'contig60', '--ks-pass', 'file:' + str(password_file), '--out', output, work / 'aligned.apk')
    run(tools / 'apksigner', 'verify', '--verbose', '--print-certs', output)
    run(tools / 'zipalign', '-c', '4', output)
    with zipfile.ZipFile(output) as apk:
        assert apk.read('assets/web/index.html') == (root / 'web/index.html').read_bytes()
        assert 'classes.dex' in apk.namelist()
        for file in (root / 'web').rglob('*'):
            if file.is_file():
                assert apk.read('assets/web/' + file.relative_to(root / 'web').as_posix()) == file.read_bytes()
    output.with_suffix('.apk.sha256').write_text(hashlib.sha256(output.read_bytes()).hexdigest() + '  ' + output.name + '\n')
    print('Verified signed APK and all embedded game assets:', output)
