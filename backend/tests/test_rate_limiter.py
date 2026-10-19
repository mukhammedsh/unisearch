import unittest
from unittest.mock import patch

from app.core.security import RedisSlidingWindowRateLimiter, SlidingWindowRateLimiter, build_rate_limiter


class SlidingWindowRateLimiterTests(unittest.TestCase):
    def test_redis_rate_limit_keys_use_the_configured_prefix(self):
        redis_client = object()
        with patch("app.core.security.REDIS_PREFIX", "unisearch:staging"), patch(
            "app.core.security.is_redis_configured", return_value=True
        ), patch("app.core.security.get_redis_client", return_value=redis_client):
            limiter = build_rate_limiter(10, 60, redis_key_prefix="api:rate-limit:global")

        self.assertIsInstance(limiter, RedisSlidingWindowRateLimiter)
        self.assertEqual("unisearch:staging:api:rate-limit:global:198.51.100.7", limiter._key("198.51.100.7"))

    def test_blocks_after_limit_within_window(self):
        limiter = SlidingWindowRateLimiter(limit=2, window_seconds=10)

        allowed_1, remaining_1, _ = limiter.check("client", now=0.0)
        allowed_2, remaining_2, _ = limiter.check("client", now=1.0)
        allowed_3, remaining_3, retry_after_3 = limiter.check("client", now=2.0)

        self.assertTrue(allowed_1)
        self.assertTrue(allowed_2)
        self.assertFalse(allowed_3)
        self.assertEqual(remaining_1, 1)
        self.assertEqual(remaining_2, 0)
        self.assertEqual(remaining_3, 0)
        self.assertGreaterEqual(retry_after_3, 8.0)

    def test_allows_again_after_window_expires(self):
        limiter = SlidingWindowRateLimiter(limit=2, window_seconds=10)

        limiter.check("client", now=0.0)
        limiter.check("client", now=1.0)
        allowed, remaining, retry_after = limiter.check("client", now=11.0)

        self.assertTrue(allowed)
        self.assertEqual(remaining, 1)
        self.assertEqual(retry_after, 0.0)


if __name__ == "__main__":
    unittest.main()
