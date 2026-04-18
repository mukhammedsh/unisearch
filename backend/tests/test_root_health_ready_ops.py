import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.core.settings import FRONTEND_ORIGINS


class RootAndOpsApiTests(unittest.TestCase):
    OPS_HEADERS = {"X-UniSearch-Ops-Token": "test-ops-token"}

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_root_health_and_ready_endpoints(self):
        root = self.client.get("/")
        self.assertEqual(root.status_code, 200)
        root_data = root.json()
        self.assertEqual("ok", root_data.get("status"))
        self.assertIn("version", root_data)

        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual("ok", health.json().get("status"))

        ready = self.client.get("/ready")
        self.assertEqual(ready.status_code, 200)
        ready_data = ready.json()
        self.assertEqual("ready", ready_data.get("status"))
        self.assertGreater(int(ready_data.get("universities_total", 0)), 0)
        self.assertGreater(int(ready_data.get("languages_total", 0)), 0)
        self.assertGreater(int(ready_data.get("exams_total", 0)), 0)
        self.assertIsInstance(ready_data.get("redis"), dict)

    def test_ops_runtime_and_warmup(self):
        unauthorized = self.client.get("/ops/runtime")
        self.assertEqual(unauthorized.status_code, 401)

        runtime = self.client.get("/ops/runtime", headers=self.OPS_HEADERS)
        self.assertEqual(runtime.status_code, 200)
        runtime_data = runtime.json()
        self.assertEqual("ok", runtime_data.get("status"))
        self.assertIsInstance(runtime_data.get("redis"), dict)

        warmup = self.client.post("/ops/warmup", headers=self.OPS_HEADERS)
        self.assertEqual(warmup.status_code, 200)
        warmup_data = warmup.json()
        self.assertEqual("sync", warmup_data.get("status"))
        result = warmup_data.get("result") or {}
        self.assertIn("ok", result)
        self.assertIn("duration_ms", result)

    def test_health_warmup_flag_runs_runtime_warmup(self):
        unauthorized = self.client.get("/health?warmup=1")
        self.assertEqual(unauthorized.status_code, 401)

        health = self.client.get("/health?warmup=1", headers=self.OPS_HEADERS)
        self.assertEqual(health.status_code, 200)
        data = health.json()
        self.assertEqual("ok", data.get("status"))
        warmup = data.get("warmup") or {}
        self.assertIn("ok", warmup)
        self.assertIn("duration_ms", warmup)

    def test_public_translation_status_is_sanitized(self):
        response = self.client.get("/translation-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("enabled", data)
        self.assertIn("available", data)
        self.assertNotIn("error", data)
        self.assertNotIn("urlConfigured", data)

    def test_security_headers_are_present(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual("nosniff", response.headers.get("x-content-type-options"))
        self.assertEqual("DENY", response.headers.get("x-frame-options"))
        self.assertIn("frame-ancestors", response.headers.get("content-security-policy-report-only", ""))

    def test_cors_allows_local_frontend_ports(self):
        configured = tuple(FRONTEND_ORIGINS)
        self.assertGreater(len(configured), 0)

        if ("http://127.0.0.1:5501" in configured) or ("http://localhost:5501" in configured):
            self.assertTrue(
                ("http://127.0.0.1:5510" in configured) or ("http://localhost:5510" in configured),
                "5510 should be allowed when default local 5501 origin is enabled",
            )

        for origin in configured:
            resp = self.client.get("/health", headers={"Origin": origin})
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(origin, resp.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
