import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ai_sort_rejects_invalid_ai_balance(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "ai_balance": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_mentor_rejects_blank_question(self):
        response = self.client.post(
            "/mentor/ask",
            json={"question": "   ", "profile": {}},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
