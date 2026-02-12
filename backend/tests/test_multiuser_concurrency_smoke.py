import concurrent.futures
import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests._fixture_utils import build_ai_sort_payload, load_personas


class MultiUserConcurrencySmokeTests(unittest.TestCase):
    def test_ai_sort_endpoint_handles_parallel_persona_requests(self):
        personas = load_personas()
        self.assertTrue(personas)
        tasks = []
        for idx in range(12):
            tasks.append(build_ai_sort_payload(personas[idx % len(personas)], budget_vs_prestige=40 + (idx % 40), limit=10))

        def worker(payload):
            with TestClient(app) as client:
                response = client.post("/universities/ai-sort", json=payload)
                return response.status_code, response.json() if response.status_code == 200 else {}

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(worker, tasks))

        self.assertEqual(len(results), len(tasks))
        for status_code, body in results:
            self.assertEqual(status_code, 200)
            self.assertIn("items", body)
            self.assertIsInstance(body.get("items"), list)
            self.assertIn("total", body)


if __name__ == "__main__":
    unittest.main()
