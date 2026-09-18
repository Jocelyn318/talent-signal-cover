"""Serve only the bundled editor on loopback, independent of working directory."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

EDITOR = Path(__file__).resolve().parents[1] / 'editor'


class EditorHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        target = Path(super().translate_path(path)).resolve()
        try:
            target.relative_to(EDITOR)
        except ValueError:
            return str(EDITOR / '__not_served__')
        return str(target)

    def list_directory(self, path):
        self.send_error(403, 'Directory listing is disabled')
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be 1–65535')
    handler = partial(EditorHandler, directory=str(EDITOR))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        parser.exit(1, f'Cannot start editor: {error}. Try --port 8766.\n')
    print(f'Talent Signal editor: http://127.0.0.1:{args.port}/', flush=True)
    print('Keep this terminal running. Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
