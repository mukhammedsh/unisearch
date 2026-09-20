import json
import unittest
from unittest.mock import MagicMock, patch

from app.core import redis_store


class RedisStoreTests(unittest.TestCase):
    def setUp(self):
        # Reset internal redis client and ping state between tests
        redis_store._REDIS_CLIENT = None
        redis_store._REDIS_PING_STATE["ts"] = 0.0
        redis_store._REDIS_PING_STATE["ok"] = False
        redis_store._REDIS_PING_STATE["reason"] = "unknown"

    def tearDown(self):
        redis_store._REDIS_CLIENT = None

    def test_redis_key_normalization(self):
        self.assertEqual(redis_store._redis_key(""), f"{redis_store.REDIS_PREFIX}:empty")
        self.assertEqual(redis_store._redis_key("   "), f"{redis_store.REDIS_PREFIX}:empty")
        self.assertEqual(redis_store._redis_key("my_key"), f"{redis_store.REDIS_PREFIX}:my_key")
        self.assertEqual(redis_store._redis_key("  trimmed  "), f"{redis_store.REDIS_PREFIX}:trimmed")

    def test_is_redis_configured(self):
        with patch.object(redis_store, "REDIS_URL", ""):
            self.assertFalse(redis_store.is_redis_configured())
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            self.assertTrue(redis_store.is_redis_configured())

    def test_build_redis_client_none_when_unconfigured_or_error(self):
        with patch.object(redis_store, "REDIS_URL", ""):
            self.assertIsNone(redis_store._build_redis_client())

        with patch.object(redis_store, "redis", None):
            self.assertIsNone(redis_store._build_redis_client())

        with patch.object(redis_store, "REDIS_URL", "redis://invalid-url:99999"):
            with patch.object(redis_store.redis.Redis, "from_url", side_effect=ValueError("invalid config")):
                self.assertIsNone(redis_store._build_redis_client())

    def test_get_redis_client_caching(self):
        mock_client = MagicMock()
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            with patch.object(redis_store, "_build_redis_client", return_value=mock_client) as mock_builder:
                client1 = redis_store.get_redis_client()
                client2 = redis_store.get_redis_client()
                self.assertEqual(client1, mock_client)
                self.assertEqual(client2, mock_client)
                self.assertEqual(mock_builder.call_count, 1)

    def test_redis_runtime_status_variations(self):
        # 1. Not configured
        with patch.object(redis_store, "REDIS_URL", ""):
            status = redis_store.redis_runtime_status(force_check=True)
            self.assertFalse(status["configured"])
            self.assertFalse(status["available"])
            self.assertEqual(status["reason"], "not_configured")

        # 2. Dependency missing
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            with patch.object(redis_store, "redis", None):
                status = redis_store.redis_runtime_status(force_check=True)
                self.assertTrue(status["configured"])
                self.assertFalse(status["available"])
                self.assertEqual(status["reason"], "dependency_missing")

        # 3. Client unavailable
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            with patch.object(redis_store, "get_redis_client", return_value=None):
                status = redis_store.redis_runtime_status(force_check=True)
                self.assertTrue(status["configured"])
                self.assertFalse(status["available"])
                self.assertEqual(status["reason"], "client_unavailable")

        # 4. Successful ping and TTL caching
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            with patch.object(redis_store, "get_redis_client", return_value=mock_client):
                status = redis_store.redis_runtime_status(force_check=True)
                self.assertTrue(status["available"])
                self.assertEqual(status["reason"], "ok")

                # Cached call (should not call ping again if within TTL)
                mock_client.ping.reset_mock()
                cached_status = redis_store.redis_runtime_status(force_check=False)
                self.assertTrue(cached_status["available"])
                self.assertEqual(cached_status["reason"], "ok")
                mock_client.ping.assert_not_called()

        # 5. Failed ping (exception)
        mock_fail_client = MagicMock()
        mock_fail_client.ping.side_effect = ConnectionError("redis down")
        with patch.object(redis_store, "REDIS_URL", "redis://localhost:6379/0"):
            with patch.object(redis_store, "get_redis_client", return_value=mock_fail_client):
                status = redis_store.redis_runtime_status(force_check=True)
                self.assertFalse(status["available"])
                self.assertEqual(status["reason"], "ping_failed")

    def test_cache_get_json(self):
        # Client None
        with patch.object(redis_store, "get_redis_client", return_value=None):
            self.assertIsNone(redis_store.cache_get_json("key1"))

        mock_client = MagicMock()
        with patch.object(redis_store, "get_redis_client", return_value=mock_client):
            # Key not found
            mock_client.get.return_value = None
            self.assertIsNone(redis_store.cache_get_json("missing"))

            # Key contains non-json
            mock_client.get.return_value = "invalid json {"
            self.assertIsNone(redis_store.cache_get_json("bad_json"))

            # Key contains json list (not dict)
            mock_client.get.return_value = "[1, 2, 3]"
            self.assertIsNone(redis_store.cache_get_json("list_data"))

            # Key contains valid dict
            mock_client.get.return_value = json.dumps({"foo": "bar", "num": 42})
            data = redis_store.cache_get_json("valid")
            self.assertEqual(data, {"foo": "bar", "num": 42})

            # Exception raised by client
            mock_client.get.side_effect = TimeoutError("timeout")
            self.assertIsNone(redis_store.cache_get_json("err"))

    def test_cache_set_json(self):
        # Client None
        with patch.object(redis_store, "get_redis_client", return_value=None):
            self.assertFalse(redis_store.cache_set_json("k", {"a": 1}, 60))

        mock_client = MagicMock()
        with patch.object(redis_store, "get_redis_client", return_value=mock_client):
            # Non-dict value
            self.assertFalse(redis_store.cache_set_json("k", "not a dict", 60))
            self.assertFalse(redis_store.cache_set_json("k", [1, 2], 60))

            # Valid dict value
            result = redis_store.cache_set_json("k", {"status": "ok"}, 120)
            self.assertTrue(result)
            mock_client.setex.assert_called_once_with(
                redis_store._redis_key("k"),
                120,
                '{"status":"ok"}'
            )

            # Exception during setex
            mock_client.setex.side_effect = RuntimeError("write failed")
            self.assertFalse(redis_store.cache_set_json("k", {"status": "ok"}, 120))

    def test_cache_del(self):
        # Client None
        with patch.object(redis_store, "get_redis_client", return_value=None):
            self.assertFalse(redis_store.cache_del("k"))

        mock_client = MagicMock()
        with patch.object(redis_store, "get_redis_client", return_value=mock_client):
            # Success
            self.assertTrue(redis_store.cache_del("k"))
            mock_client.delete.assert_called_once_with(redis_store._redis_key("k"))

            # Exception
            mock_client.delete.side_effect = ConnectionResetError("connection lost")
            self.assertFalse(redis_store.cache_del("k"))


if __name__ == "__main__":
    unittest.main()
