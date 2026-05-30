import asyncio
import concurrent.futures
import logging
import threading
import unittest

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security import RedisSlidingWindowRateLimiter
from app.schemas.payloads import ProfileOnlyRequest, UniversitiesAiSortRequest
from app.services import text_translation
from scripts import audit_universities_data


class SecurityRegressionTests(unittest.TestCase):
    def test_ops_guard_uses_scope_path_not_host_confused_url_path(self):
        client = TestClient(app)

        runtime = client.get("/ops/runtime", headers={"Host": "example.com/health?x="})
        warmup = client.post("/ops/warmup", headers={"Host": "example.com/health?x="})

        self.assertEqual(runtime.status_code, 401)
        self.assertEqual(warmup.status_code, 401)

    def test_profile_payload_rejects_overly_large_nested_choice_maps(self):
        payload = {
            "profile": {
                "selectedAdmissionChoices": {
                    f"u-{idx}": {"choiceKey": "general::paid"}
                    for idx in range(101)
                }
            }
        }

        with self.assertRaises(ValueError):
            ProfileOnlyRequest.model_validate(payload)

    def test_profile_payload_rejects_overly_deep_details(self):
        payload = {
            "profile": {
                "exams": [
                    {
                        "id": "SAT",
                        "details": {"a": {"b": {"c": {"d": {"e": "too deep"}}}}},
                    }
                ]
            },
            "page": 1,
            "limit": 20,
        }

        with self.assertRaises(ValueError):
            UniversitiesAiSortRequest.model_validate(payload)

    def test_translation_debug_logs_do_not_include_raw_interest_text(self):
        old_debug = text_translation.ML_INTEREST_TRANSLATION_DEBUG
        try:
            text_translation.ML_INTEREST_TRANSLATION_DEBUG = True
            logger = logging.getLogger("unisearch.translation")
            with self.assertLogs(logger, level="INFO") as captured:
                text_translation.translate_interest_text_for_ml("private robotics essay", source_hint="en")
        finally:
            text_translation.ML_INTEREST_TRANSLATION_DEBUG = old_debug

        joined = "\n".join(captured.output)
        self.assertNotIn("private robotics essay", joined)
        self.assertIn("text_hash", joined)
        self.assertIn("text_len", joined)

    def test_data_http_audit_blocks_internal_urls_before_fetch(self):
        self.assertIn(
            "non-public",
            audit_universities_data._public_http_url_reason("http://127.0.0.1:8000/admin"),
        )

        status, final_url = audit_universities_data._http_status("http://127.0.0.1:8000/admin", timeout_sec=0.8)

        self.assertIsNone(status)
        self.assertEqual(final_url, "http://127.0.0.1:8000/admin")


class RequestBodyLimitRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_chunked_body_without_content_length_is_rejected_by_actual_size(self):
        async def body_stream():
            yield b'{"profile":{"interests":"'
            yield b"x" * 140_000
            yield b'"},"page":1,"limit":20}'
            await asyncio.sleep(0)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/universities/ai-sort",
                content=body_stream(),
                headers={"Content-Type": "application/json"},
            )

        self.assertEqual(response.status_code, 413)


class _AtomicFakeRedis:
    def __init__(self):
        self._rows = {}
        self._lock = threading.Lock()
        self.eval_calls = 0

    def eval(self, script, numkeys, key, now, cutoff, limit, ttl, member):
        with self._lock:
            self.eval_calls += 1
            rows = [score for score in self._rows.get(key, []) if float(score) > float(cutoff)]
            self._rows[key] = rows
            if len(rows) >= int(limit):
                oldest = min(rows) if rows else float(now)
                return [0, 0, max(0.0, float(ttl) - (float(now) - float(oldest)))]
            rows.append(float(now))
            self._rows[key] = rows
            return [1, max(0, int(limit) - len(rows)), 0]


class RedisRateLimiterRegressionTests(unittest.TestCase):
    def test_redis_rate_limiter_uses_single_atomic_eval_under_concurrency(self):
        fake = _AtomicFakeRedis()
        limiter = RedisSlidingWindowRateLimiter(limit=5, window_seconds=60, redis_client=fake)

        def worker(_):
            allowed, _, _ = limiter.check("client", now=1.0)
            return allowed

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(worker, range(10)))

        self.assertEqual(results.count(True), 5)
        self.assertEqual(results.count(False), 5)
        self.assertEqual(fake.eval_calls, 10)


if __name__ == "__main__":
    unittest.main()
