"""Gera o comando de CMD com a URL pública e o hash do EXE publicado."""
import argparse
import hashlib
from pathlib import Path
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('url', help='URL HTTPS pública do Contig60.exe no site do PIBID')
args = parser.parse_args()
url = urlparse(args.url)
if url.scheme != 'https' or not url.netloc or any(c in args.url for c in "'\"`$\r\n%!") or url.username or url.password:
    parser.error('Use uma URL HTTPS sem credenciais, aspas ou caracteres especiais de shell.')
root = Path(__file__).resolve().parent.parent
checksum = hashlib.sha256((root / 'downloads' / 'Contig60.exe').read_bytes()).hexdigest()
command = '''powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop';[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$d=Join-Path $env:LOCALAPPDATA 'Contig60';New-Item -ItemType Directory -Force -Path $d|Out-Null;$f=Join-Path $d 'Contig60.exe';$tmp=Join-Path $d ([guid]::NewGuid().ToString()+'.download');try{Invoke-WebRequest -UseBasicParsing -Uri 'URL' -OutFile $tmp;if((Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash -ne 'CHECKSUM'){throw 'Download com hash diferente do esperado'};Move-Item -LiteralPath $tmp -Destination $f -Force;Start-Process -FilePath $f}finally{Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue}"'''.replace('URL', args.url).replace('CHECKSUM', checksum)
(root / 'downloads' / 'iniciar-cmd.txt').write_text(command + '\n', encoding='utf-8')
print(command)
