import importlib.util
import re
import threading
import unittest
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]


class PackageTest(unittest.TestCase):
    def test_relative_markdown_links_resolve(self):
        for file in ROOT.rglob('*.md'):
            for link in re.findall(r'\]\(([^)]+)\)', file.read_text()):
                if '://' in link or link.startswith('#'):
                    continue
                self.assertTrue((file.parent / link.split('#')[0]).exists(), (file, link))

    def test_reference_assets(self):
        self.assertEqual(len(list((ROOT / 'references/images').glob('*'))), 15)
        for filename in ('ts001-map.png', 'loop-blue.png'):
            self.assertTrue((ROOT / 'assets/examples' / filename).read_bytes().startswith(b'\x89PNG'))

    def test_no_personal_paths(self):
        for file in ROOT.rglob('*'):
            if file.suffix in ('.md', '.js', '.mjs', '.yaml', '.json', '.html'):
                self.assertNotIn('/Users/', file.read_text(), str(file))

    def test_local_server_routes(self):
        spec = importlib.util.spec_from_file_location('serve', ROOT / 'scripts/serve.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(module.EditorHandler, directory=str(module.EDITOR)))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            for route in ('/', '/editor.js', '/fonts.js', '/fonts/Inter-Variable.ttf'):
                with urllib.request.urlopen(base + route) as response:
                    self.assertEqual(response.status, 200)
                    response.read()
            for route in ('/../SKILL.md', '/references/images/14.png', '/fonts/'):
                with self.assertRaises(urllib.error.HTTPError):
                    urllib.request.urlopen(base + route)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == '__main__':
    unittest.main()
