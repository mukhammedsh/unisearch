import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app, _is_expensive_request
from app.core.security import SlidingWindowRateLimiter, request_client_ip


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

    def test_client_ip_xff_ignored_when_trust_xff_disabled(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"  # Trusted proxy IP
        req.headers = {"x-forwarded-for": "198.51.100.42"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", False):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "127.0.0.1")

    def test_client_ip_xff_honored_when_trust_xff_enabled(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"  # Trusted proxy IP
        req.headers = {"x-forwarded-for": "198.51.100.42"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "198.51.100.42")

    def test_client_ip_resolution_private_proxy_when_enabled(self):
        req = MagicMock()
        req.client.host = "10.0.12.34"  # Render / private network proxy
        req.headers = {"x-forwarded-for": "198.51.100.42, 10.0.12.34"}
        with patch("app.core.security.TRUST_PRIVATE_NETWORK_PROXIES", True), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "198.51.100.42")

    def test_client_ip_rejects_documentation_range_proxy_when_private_trust_enabled(self):
        req = MagicMock()
        req.client.host = "203.0.113.19"
        req.headers = {"x-forwarded-for": "198.51.100.42"}
        with patch("app.core.security.TRUST_PRIVATE_NETWORK_PROXIES", True), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True), \
             patch("app.core.security.TRUSTED_PROXY_IPS", []):
            self.assertEqual(request_client_ip(req), "203.0.113.19")

    def test_client_ip_resolution_private_proxy_when_disabled_by_default(self):
        req = MagicMock()
        req.client.host = "10.0.12.34"  # Untrusted private network connection
        req.headers = {"x-forwarded-for": "198.51.100.42, 10.0.12.34"}
        with patch("app.core.security.TRUST_PRIVATE_NETWORK_PROXIES", False), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True), \
             patch("app.core.security.TRUSTED_PROXY_IPS", []):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "10.0.12.34")

    def test_client_ip_resolution_cf_connecting_ip(self):
        req = MagicMock()
        req.client.host = "172.18.0.5"
        req.headers = {
            "cf-connecting-ip": "203.0.113.88",
            "x-forwarded-for": "203.0.113.88, 172.18.0.5",
        }
        with patch("app.core.security.TRUST_PRIVATE_NETWORK_PROXIES", True), \
             patch("app.core.security.TRUST_CF_CONNECTING_IP", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "203.0.113.88")

    def test_client_ip_cf_connecting_ip_ignored_when_disabled(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"
        req.headers = {
            "cf-connecting-ip": "198.51.100.99",
            "x-forwarded-for": "203.0.113.88",
        }
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True), \
             patch("app.core.security.TRUST_CF_CONNECTING_IP", False):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "203.0.113.88")

    def test_client_ip_rejects_spoofed_headers_from_public_host(self):
        req = MagicMock()
        req.client.host = "8.8.8.8"  # Untrusted public IP directly connecting
        req.headers = {
            "cf-connecting-ip": "1.1.1.1",
            "x-forwarded-for": "1.2.3.4",
        }
        with patch("app.core.security.TRUST_X_FORWARDED_FOR", True), \
             patch("app.core.security.TRUST_CF_CONNECTING_IP", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "8.8.8.8")

    def test_client_ip_single_trusted_proxy_strips_spoofed_headers(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"  # Trusted local proxy (e.g. Nginx/Caddy)
        # Attacker injected "1.1.1.1, 2.2.2.2", proxy appended real client "203.0.113.19"
        req.headers = {"x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.19"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "203.0.113.19")

    def test_client_ip_multi_proxy_chain_traversal(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"  # Local ingress proxy (trusted)
        # Cloudflare proxy 173.245.48.5 is trusted; real client is 198.51.100.42; attacker injected 1.1.1.1
        req.headers = {
            "x-forwarded-for": "1.1.1.1, 198.51.100.42, 173.245.48.5",
        }
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1", "173.245.48.0/20"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "198.51.100.42")

    def test_client_ip_trusted_cidr_subnet_matching(self):
        req = MagicMock()
        req.client.host = "172.18.0.42"  # Docker container within 172.18.0.0/16
        req.headers = {"x-forwarded-for": "203.0.113.77"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["172.18.0.0/16"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "203.0.113.77")

    def test_client_ip_untrusted_cidr_subnet_outside_range(self):
        req = MagicMock()
        req.client.host = "172.19.0.42"  # Outside 172.18.0.0/16
        req.headers = {"x-forwarded-for": "203.0.113.77"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["172.18.0.0/16"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "172.19.0.42")

    def test_client_ip_handles_malformed_and_injection_headers(self):
        req = MagicMock()
        req.client.host = "127.0.0.1"
        # Malformed leftmost IP, but valid client IP appended by proxy
        req.headers = {"x-forwarded-for": "bad<script>ip, 203.0.113.99"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "203.0.113.99")

        # Entirely malformed header falls back safely to normalized direct host
        req.headers = {"x-forwarded-for": "invalid-ip-format-only"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "127.0.0.1")

    def test_client_ip_ipv6_normalization(self):
        req = MagicMock()
        req.client.host = "::1"
        req.headers = {"x-forwarded-for": "2001:db8::1"}
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["::1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved = request_client_ip(req)
            self.assertEqual(resolved, "2001:db8::1")

    def test_client_ip_none_and_missing_client(self):
        self.assertEqual(request_client_ip(None), "unknown")
        req = MagicMock()
        req.client = None
        self.assertEqual(request_client_ip(req), "unknown")

    def test_rate_limiter_uses_exact_resolved_ip_keys(self):
        # 1. Untrusted client sends spoofed header
        req1 = MagicMock()
        req1.client.host = "198.51.100.5"
        req1.headers = {"x-forwarded-for": "1.1.1.1, 2.2.2.2"}
        req1.scope = {"path": "/health", "type": "http"}
        req1.method = "GET"
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved_ip = request_client_ip(req1)
            self.assertEqual(resolved_ip, "198.51.100.5")

        # 2. Trusted proxy sends header with real client
        req2 = MagicMock()
        req2.client.host = "127.0.0.1"
        req2.headers = {"x-forwarded-for": "1.1.1.1, 203.0.113.42"}
        req2.scope = {"path": "/health", "type": "http"}
        req2.method = "GET"
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", True):
            resolved_ip = request_client_ip(req2)
            self.assertEqual(resolved_ip, "203.0.113.42")

        # 3. Disabled TRUST_X_FORWARDED_FOR
        req3 = MagicMock()
        req3.client.host = "127.0.0.1"
        req3.headers = {"x-forwarded-for": "203.0.113.42"}
        req3.scope = {"path": "/health", "type": "http"}
        req3.method = "GET"
        with patch("app.core.security.TRUSTED_PROXY_IPS", ["127.0.0.1"]), \
             patch("app.core.security.TRUST_X_FORWARDED_FOR", False):
            resolved_ip = request_client_ip(req3)
            self.assertEqual(resolved_ip, "127.0.0.1")

        # 4. End-to-end sliding window rate limiter key isolation
        limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60)
        allowed1, _, _ = limiter.check("198.51.100.5")
        allowed2, _, _ = limiter.check("198.51.100.5")
        allowed3, _, _ = limiter.check("198.51.100.5")
        self.assertTrue(allowed1)
        self.assertTrue(allowed2)
        self.assertFalse(allowed3)  # Exhausted for 198.51.100.5

        # Distinct client 203.0.113.42 is unaffected
        allowed_other, _, _ = limiter.check("203.0.113.42")
        self.assertTrue(allowed_other)

    def test_https_forwarded_proto_requests_do_not_produce_redirects(self):
        c = TestClient(app, client=("127.0.0.1", 54321))
        res = c.get("/universities", headers={
            "X-Forwarded-Proto": "https",
            "X-Forwarded-For": "203.0.113.10",
        })
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("location", res.headers)

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
