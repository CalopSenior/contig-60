"""Build-only helper. End users need neither Python nor Go."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

root = Path(__file__).resolve().parent.parent
go = os.environ.get('CONTIG_GO', 'go')
subprocess.run(['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'build'], cwd=root, check=True)
if (root / 'desktop' / 'web').exists():
    shutil.rmtree(root / 'desktop' / 'web')
shutil.copytree(root / 'web', root / 'desktop' / 'web')
subprocess.run([go, 'test', './...'], cwd=root / 'desktop', check=True)
out = root / 'downloads'
out.mkdir(exist_ok=True)
def build(goos, arch, output):
    env = dict(os.environ, GOOS=goos, GOARCH=arch, CGO_ENABLED='0')
    subprocess.run([go, 'build', '-trimpath', '-buildvcs=false', '-ldflags=-s -w', '-o', str(output), '.'], cwd=root / 'desktop', env=env, check=True)

def checksum(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    (out / (path.name + '.sha256')).write_text(digest + '  ' + path.name + chr(10))
    print(path.name, digest)

for arch, name in [('amd64', 'Contig60.exe'), ('arm64', 'Contig60-arm64.exe')]:
    build('windows', arch, out / name)
    checksum(out / name)

# Linux: o executavel vai dentro de um .tar.gz para preservar a permissao de execucao.
for arch in ['amd64', 'arm64']:
    binary = Path(tempfile.mkdtemp(prefix='contig-linux-')) / 'contig60'
    build('linux', arch, binary)
    archive = out / f'Contig60-linux-{arch}.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        info = tar.gettarinfo(str(binary), arcname='contig60')
        info.mode, info.uid, info.gid, info.uname, info.gname, info.mtime = 0o755, 0, 0, '', '', 0
        with open(binary, 'rb') as f:
            tar.addfile(info, f)
    shutil.rmtree(binary.parent)
    checksum(archive)
