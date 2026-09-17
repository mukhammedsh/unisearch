import asyncio
import concurrent.futures
import threading
import unittest

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security import RedisSlidingWindowRateLimiter
from app.core.settings import REQUEST_BODY_MAX_BYTES
from app.schemas.payloads import ProfileOnlyRequest, UniversitiesAiSortRequest
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
                        "details": {"a": {"b": {"c": {"d": {"e": {"f": "too deep"}}}}}},
                    }
                ]
            },
            "page": 1,
            "limit": 20,
        }

        with self.assertRaises(ValueError):
            UniversitiesAiSortRequest.model_validate(payload)

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

    async def test_declared_content_length_exceeding_limit_is_rejected_immediately(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/exams/validate",
                content=b"x" * 200_000,
                headers={"Content-Type": "application/json", "Content-Length": "200000"},
            )

        self.assertEqual(response.status_code, 413)

    async def test_declared_content_length_smaller_than_actual_oversized_body_is_rejected(self):
        async def body_stream():
            yield b'{"exam":"SAT_MATH","score":750,"pad":"'
            yield b"x" * 140_000
            yield b'"}'

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/exams/validate",
                content=body_stream(),
                headers={"Content-Type": "application/json", "Content-Length": "10"},
            )

        self.assertEqual(response.status_code, 413)

    async def test_streaming_body_exceeding_limit_midway_aborts_and_stops_reading(self):
        chunks_read = 0

        async def body_stream():
            nonlocal chunks_read
            for _ in range(10):
                chunks_read += 1
                yield b"x" * 30_000

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/exams/validate",
                content=body_stream(),
                headers={"Content-Type": "application/json"},
            )

        self.assertEqual(response.status_code, 413)
        self.assertLessEqual(chunks_read, 6)

    async def test_invalid_and_negative_content_length_with_oversized_body_is_rejected(self):
        async def body_stream():
            yield b"x" * 140_000

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res_invalid = await client.post(
                "/exams/validate",
                content=body_stream(),
                headers={"Content-Type": "application/json", "Content-Length": "invalid"},
            )
            self.assertEqual(res_invalid.status_code, 413)

            res_negative = await client.post(
                "/exams/validate",
                content=body_stream(),
                headers={"Content-Type": "application/json", "Content-Length": "-1"},
            )
            self.assertEqual(res_negative.status_code, 413)

    async def test_request_body_exact_limit_boundary(self):
        pad_len = REQUEST_BODY_MAX_BYTES - len('{"exam":"SAT_MATH","score":750,"pad":""}')
        exact_valid = ('{"exam":"SAT_MATH","score":750,"pad":"' + 'a' * pad_len + '"}').encode("utf-8")
        self.assertEqual(len(exact_valid), REQUEST_BODY_MAX_BYTES)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res_exact = await client.post(
                "/exams/validate",
                content=exact_valid,
                headers={"Content-Type": "application/json", "Content-Length": str(len(exact_valid))},
            )
            self.assertEqual(res_exact.status_code, 200)

            exact_plus_one = exact_valid + b" "
            self.assertEqual(len(exact_plus_one), REQUEST_BODY_MAX_BYTES + 1)
            res_plus_one = await client.post(
                "/exams/validate",
                content=exact_plus_one,
                headers={"Content-Type": "application/json", "Content-Length": str(len(exact_plus_one))},
            )
            self.assertEqual(res_plus_one.status_code, 413)


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
