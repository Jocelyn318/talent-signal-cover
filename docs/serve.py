"""Serve only the static studio on loopback; no upload or write endpoints."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(403)
    def translate_path(self, path):
        target = Path(super().translate_path(path)).resolve()
        if not target.is_relative_to(ROOT):
            return str(ROOT / '__not_served__')
        return str(target)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    with ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT))) as server:
        print(f'Talent Signal Studio: http://127.0.0.1:{args.port}/', flush=True)
        server.serve_forever()
