import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app, _is_expensive_request
from app.core.security import SlidingWindowRateLimiter, request_client_ip
from app.services.text_translation import (
    _provider_record_failure,
    _provider_record_success,
    _provider_in_backoff,
)


class ApiDdosHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_compare_profiles_is_in_expensive_request_guard(self):
        req = MagicMock()
        req.method = "POST"
        req.scope = {"path": "/universities/compare-profiles"}
        self.assertTrue(_is_expensive_request(req))

    def test_ai_sort_is_in_expensive_request_guard(self):
        req = MagicMock()
        req.method = "POST"
        req.scope = {"path": "/universities/ai-sort"}
        self.assertTrue(_is_expensive_request(req))

    def test_compare_profiles_caches_results(self):
        payload = {
            "university_ids": ["mit-usa-cambridge"],
            "profile": {"budget": 50000, "gpa": 3.8},
        }
        res1 = self.client.post("/universities/compare-profiles", json=payload)
        self.assertEqual(res1.status_code, 200)
        self.assertIn("X-Compare-Cache", res1.headers)

        res2 = self.client.post("/universities/compare-profiles", json=payload)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.headers.get("X-Compare-Cache"), "HIT")

    def test_client_ip_resolution_private_proxy_render_xff(self):
        req = MagicMock()
        req.client.host = "10.0.12.34"  # Render / private network proxy
        req.headers = {"x-forwarded-for": "198.51.100.42, 10.0.12.34"}
        resolved = request_client_ip(req)
        self.assertEqual(resolved, "198.51.100.42")

    def test_client_ip_resolution_cf_connecting_ip(self):
        req = MagicMock()
        req.client.host = "172.18.0.5"  # Docker / Render private network
        req.headers = {
            "cf-connecting-ip": "203.0.113.88",
            "x-forwarded-for": "203.0.113.88, 172.18.0.5",
        }
        resolved = request_client_ip(req)
        self.assertEqual(resolved, "203.0.113.88")

    def test_client_ip_rejects_spoofed_headers_from_public_host(self):
        req = MagicMock()
        req.client.host = "8.8.8.8"  # Untrusted public IP directly connecting
        req.headers = {
            "cf-connecting-ip": "1.1.1.1",
            "x-forwarded-for": "1.2.3.4",
        }
        resolved = request_client_ip(req)
        self.assertEqual(resolved, "8.8.8.8")

    def test_sliding_window_rate_limiter_lru_eviction(self):
        limiter = SlidingWindowRateLimiter(limit=10, window_seconds=60, max_keys=16)
        for i in range(100):
            allowed, remaining, _ = limiter.check(f"client-{i}", now=100.0)
            self.assertTrue(allowed)
        self.assertLessEqual(len(limiter._events), 16)

    def test_query_string_length_guard(self):
        huge_query = "q=" + ("x" * 5000)
        res = self.client.get(f"/universities?{huge_query}")
        self.assertEqual(res.status_code, 414)

    def test_circuit_breaker_trips_on_failures(self):
        _provider_record_success()
        self.assertFalse(_provider_in_backoff())

        _provider_record_failure()
        _provider_record_failure()
        self.assertTrue(_provider_in_backoff())

        _provider_record_success()
        self.assertFalse(_provider_in_backoff())

    def test_ai_sort_cache_hit_on_normalized_input(self):
        body1 = {
            "profile": {
                "interests": "Computer Science  Machine Learning",
            },
            "practice_vs_science": 50,
            "page": 1,
            "limit": 5,
        }
        res1 = self.client.post("/universities/ai-sort", json=body1)
        self.assertEqual(res1.status_code, 200)

        body2 = {
            "profile": {
                "interests": "computer science machine learning ",
            },
            "practice_vs_science": 50,
            "page": 1,
            "limit": 5,
        }
        res2 = self.client.post("/universities/ai-sort", json=body2)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.headers.get("X-AI-Sort-Cache"), "HIT")


if __name__ == "__main__":
    unittest.main()
