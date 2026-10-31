"""Build-only helper. End users need neither Python nor Go."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
go = os.environ.get('CONTIG_GO', 'go')
subprocess.run(['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'build'], cwd=root, check=True)
shutil.copytree(root / 'web', root / 'desktop' / 'web', dirs_exist_ok=True)
subprocess.run([go, 'test', './...'], cwd=root / 'desktop', check=True)
out = root / 'downloads'
out.mkdir(exist_ok=True)
for arch, name in [('amd64', 'Contig60.exe'), ('arm64', 'Contig60-arm64.exe')]:
    env = dict(os.environ, GOOS='windows', GOARCH=arch, CGO_ENABLED='0')
    subprocess.run([go, 'build', '-trimpath', '-buildvcs=false', '-ldflags=-s -w', '-o', str(out / name), '.'], cwd=root / 'desktop', env=env, check=True)
    digest = hashlib.sha256((out / name).read_bytes()).hexdigest()
    (out / (name + '.sha256')).write_text(digest + '  ' + name + '\n')
    print(name, digest)
