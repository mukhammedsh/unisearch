import asyncio
import concurrent.futures
import unittest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security import SlidingWindowRateLimiter


class ApiConcurrencyStressTests(unittest.IsolatedAsyncioTestCase):
    async def test_universities_endpoint_handles_concurrent_stress_load(self):
        """Проверяет стабильность эндпоинта /universities под нагрузкой из множества параллельных запросов."""
        tasks = [f"/universities?limit=5&q=IT&page={idx % 3 + 1}" for idx in range(25)]

        async def worker(client, path):
            response = await client.get(path)
            return response.status_code, response.json() if response.status_code == 200 else {}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            coroutines = [worker(client, path) for path in tasks]
            results = await asyncio.gather(*coroutines)

        self.assertEqual(len(results), len(tasks))
        for status_code, body in results:
            # Поскольку лимиты рейт-лимитера могут отличаться или быть отключены локально,
            # мы убеждаемся, что запросы либо проходят успешно (200), либо блокируются лимитером (429).
            self.assertIn(status_code, [200, 429])
            if status_code == 200:
                self.assertIn("items", body)
                self.assertIsInstance(body.get("items"), list)

    def test_sliding_window_rate_limiter_concurrency(self):
        """Проверяет потокобезопасность и корректность рейт-лимитера при параллельных запросах."""
        # Устанавливаем лимит 5 запросов в окно
        limiter = SlidingWindowRateLimiter(limit=5, window_seconds=5)
        client_ip = "192.168.1.100"

        def worker(now_time):
            # Проверяем лимиты
            allowed, remaining, retry_after = limiter.check(client_ip, now=now_time)
            return allowed

        # Запускаем 10 одновременных запросов в один момент времени
        times = [1.0] * 10
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(worker, times))

        # Ровно 5 запросов должны быть одобрены, а остальные 5 - отклонены
        allowed_count = results.count(True)
        blocked_count = results.count(False)
        self.assertEqual(allowed_count, 5)
        self.assertEqual(blocked_count, 5)


if __name__ == "__main__":
    unittest.main()
