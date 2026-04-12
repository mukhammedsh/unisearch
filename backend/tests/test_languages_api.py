import unittest

from fastapi.testclient import TestClient

from app.main import app


class LanguagesApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_get_languages_config_contains_languages_and_exams(self):
        response = self.client.get("/languages/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, dict)
        self.assertIsInstance(data.get("languages"), list)
        self.assertGreater(len(data.get("languages", [])), 0)
        self.assertIsInstance(data.get("language_exams"), dict)
        self.assertIn("en", data.get("language_exams", {}))

    def test_validate_language_native(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "native"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(bool(payload.get("ok")))
        self.assertEqual("native", ((payload.get("language") or {}).get("kind")))

    def test_validate_language_cefr_from_label(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "cefr", "label": "B2"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        language = payload.get("language") or {}
        self.assertEqual("cefr", language.get("kind"))
        self.assertEqual(4, int(language.get("level")))

    def test_validate_language_exam_accepts_valid_score(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        language = payload.get("language") or {}
        self.assertEqual("exam", language.get("kind"))
        self.assertEqual("IELTS", language.get("exam"))
        self.assertAlmostEqual(7.5, float(language.get("score")), places=6)

    def test_validate_language_exam_rejects_invalid_step(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "exam", "exam": "DET", "score": 127},
        )
        self.assertEqual(response.status_code, 400)
        detail = str(response.json().get("detail", ""))
        self.assertTrue("step" in detail.lower() or "between" in detail.lower())

    def test_validate_language_exam_accepts_composite_ielts(self):
        response = self.client.post(
            "/languages/validate",
            json={
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "score": 7.5,
                "details": {
                    "components": [
                        {"exam": "IELTS_LISTENING", "score": 8.0},
                        {"exam": "IELTS_READING", "score": 7.5},
                        {"exam": "IELTS_WRITING", "score": 7.0},
                        {"exam": "IELTS_SPEAKING", "score": 7.0},
                    ]
                },
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        language = payload.get("language") or {}
        self.assertEqual("exam", language.get("kind"))
        self.assertEqual("IELTS", language.get("exam"))
        self.assertAlmostEqual(7.5, float(language.get("score")), places=6)
        self.assertIn("Listening", str(language.get("raw_value", "")))
        self.assertIsInstance((language.get("details") or {}).get("components"), list)


if __name__ == "__main__":
    unittest.main()
