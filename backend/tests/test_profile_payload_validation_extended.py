import unittest

from fastapi.testclient import TestClient

from app.main import app


class ProfilePayloadValidationExtendedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _post_ai_sort(self, profile):
        return self.client.post(
            "/universities/ai-sort",
            json={
                "profile": profile,
                "practice_vs_science": 50,
                "social_vs_hardcore": 50,
                "budget_vs_prestige": 50,
                "city_vs_campus": 50,
                "page": 1,
                "limit": 10,
            },
        )

    def test_rejects_exam_entry_without_id_or_exam(self):
        response = self._post_ai_sort(
            {
                "exams": [{"score": 1200}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_cefr_language_without_level(self):
        response = self._post_ai_sort(
            {
                "languages": [{"code": "en", "kind": "cefr"}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_exam_language_without_score(self):
        response = self._post_ai_sort(
            {
                "languages": [{"code": "en", "kind": "exam", "exam": "IELTS"}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_exams_list_over_max_limit(self):
        response = self._post_ai_sort(
            {
                "exams": [{"exam": "SAT", "score": 1200} for _ in range(51)],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_too_long_interests(self):
        response = self._post_ai_sort(
            {
                "interests": "x" * 1201,
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_accepts_valid_rich_profile_payload(self):
        response = self._post_ai_sort(
            {
                "name": "Valid User",
                "locale": "eng",
                "budget": 35000,
                "gpa": 95,
                "major": "Computer Science",
                "interests": "ai robotics research",
                "studyMode": "On-campus",
                "fundingType": "any",
                "exams": [
                    {"exam": "SAT", "score": 1470},
                    {"exam": "ACT", "score": 33},
                ],
                "languages": [
                    {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5},
                    {"code": "en", "kind": "cefr", "level": 5},
                ],
            }
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("items", payload)
        self.assertIsInstance(payload.get("items"), list)


if __name__ == "__main__":
    unittest.main()
