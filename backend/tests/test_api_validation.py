import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ai_sort_rejects_invalid_budget_vs_prestige(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "budget_vs_prestige": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_too_long_locale(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "locale": "x" * 40,
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_social_vs_hardcore(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "social_vs_hardcore": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_tradeoff_slider(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "practice_vs_science": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_city_vs_campus(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "city_vs_campus": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
