#!/usr/bin/env python3
"""Contig 60: Python 3.10+, sem dependências extras. Execute: python jogar.py"""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
from pathlib import Path, PurePosixPath
import tempfile
import threading
import urllib.request
import webbrowser
import zipfile

REPOSITORY = 'CalopSenior/contig-60'
MAX_DOWNLOAD = 25 * 1024 * 1024


def download_game(destination: Path, ref: str) -> Path:
    """Baixa apenas os arquivos estáticos publicados; não executa código remoto."""
    from urllib.parse import quote
    url = f'https://codeload.github.com/{REPOSITORY}/zip/{quote(ref, safe="")}'
    request = urllib.request.Request(url, headers={'User-Agent': 'Contig60-Launcher/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        archive = response.read(MAX_DOWNLOAD + 1)
    if len(archive) > MAX_DOWNLOAD:
        raise ValueError('Download maior que o limite de 25 MB.')
    total = 0
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        for entry in bundle.infolist():
            parts = PurePosixPath(entry.filename).parts
            if len(parts) < 3 or parts[1] != 'web' or entry.is_dir():
                continue
            relative = PurePosixPath(*parts[2:])
            if '..' in relative.parts or '\\' in str(relative) or ':' in str(relative):
                raise ValueError('Caminho inválido no pacote.')
            target = destination.joinpath(*relative.parts)
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError('Caminho fora do diretório do jogo.')
            total += entry.file_size
            if total > MAX_DOWNLOAD:
                raise ValueError('Conteúdo descompactado maior que 25 MB.')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(bundle.read(entry))
    if not (destination / 'index.html').is_file():
        raise ValueError('O pacote não contém o jogo compilado em web/.')
    return destination


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--github', action='store_true', help='Baixar do GitHub mesmo com web/ local')
    parser.add_argument('--ref', default='main', help='Branch, tag ou SHA do GitHub (padrão: main)')
    parser.add_argument('--port', type=int, default=0, help='Porta local; 0 escolhe uma livre')
    parser.add_argument('--no-browser', action='store_true', help='Não abrir o navegador automaticamente')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('A porta deve estar entre 0 e 65535.')
    with tempfile.TemporaryDirectory(prefix='contig60-') as temporary:
        directory = Path(__file__).resolve().parent / 'web'
        if args.github or not (directory / 'index.html').is_file():
            print(f'Baixando {REPOSITORY} ({args.ref})...', flush=True)
            directory = download_game(Path(temporary), args.ref)
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(directory)))
        url = f'http://localhost:{server.server_port}/'
        print(f'Contig 60: {url}\nPara encerrar, pressione Ctrl+C.', flush=True)
        if not args.no_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nServidor encerrado.')
        finally:
            server.server_close()


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        raise SystemExit(f'Não foi possível iniciar o jogo: {error}')
