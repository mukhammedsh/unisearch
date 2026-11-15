import importlib.util
import threading
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("frontend_dev_server", ROOT / "scripts" / "frontend_dev_server.py")
frontend_dev_server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(frontend_dev_server)


class FrontendDevServerApiPortTests(unittest.TestCase):
    def serve(self, api_port):
        directory = ROOT / "frontend"
        handler = lambda *args, **kwargs: frontend_dev_server.FrontendDevHandler(*args, directory=str(directory), **kwargs)
        server = frontend_dev_server.FrontendThreadingHTTPServer(("127.0.0.1", 0), handler)
        server.file_index = frontend_dev_server.build_file_index(directory)
        server.api_port = api_port
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_address[1]}"

    def fetch(self, url):
        with urllib.request.urlopen(url) as response:
            return response.read().decode("utf-8")

    def test_env_js_points_at_the_requested_api_port(self):
        base = self.serve(8010)
        body = self.fetch(f"{base}/env.js")
        self.assertIn('"API_PORT": "8010"', body.splitlines()[-1])
        self.assertIn('"API_BASE_URL": ""', body.splitlines()[-1])

    def test_env_js_is_served_unchanged_without_an_api_port(self):
        base = self.serve(None)
        self.assertEqual(self.fetch(f"{base}/env.js"), (ROOT / "frontend" / "env.js").read_text(encoding="utf-8"))

    def test_other_files_are_not_modified(self):
        base = self.serve(8010)
        self.assertNotIn("API_PORT", self.fetch(f"{base}/config.js").split("initRuntimeConfig")[0])


if __name__ == "__main__":
    unittest.main()
