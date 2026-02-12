import unittest

from fastapi.testclient import TestClient

from app.main import app


class ExamsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_get_exams_config_contains_expected_keys(self):
        response = self.client.get("/exams/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, dict)
        for key in ("SAT", "ACT", "GPA"):
            self.assertIn(key, data)

    def test_validate_exam_accepts_valid_score(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT", "score": 1450},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(bool(data.get("ok")))
        self.assertEqual("SAT", data.get("exam"))
        self.assertEqual(1450, int(data.get("score")))

    def test_validate_exam_rejects_invalid_step(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT", "score": 1451},
        )
        self.assertEqual(response.status_code, 400)
        detail = str(response.json().get("detail", ""))
        self.assertIn("step", detail.lower())

    def test_validate_exam_alias_resolves_to_canonical_key(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "NUET_TOTAL", "score": 210},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("NUET", data.get("exam"))
        self.assertEqual(210, int(data.get("score")))


if __name__ == "__main__":
    unittest.main()
