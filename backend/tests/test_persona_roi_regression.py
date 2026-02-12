import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests._fixture_utils import load_personas


class PersonaRoiRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.personas = load_personas()

        response = cls.client.get("/universities?limit=1&fields=card")
        data = response.json() if response.status_code == 200 else {}
        items = data.get("items") or []
        cls.university_id = str((items[0] or {}).get("id") or "") if items else ""

    def test_persona_roi_invariants(self):
        self.assertTrue(self.university_id)
        allowed_context = {
            "matched_major",
            "missing_major",
            "fallback_major",
            "no_salary_data",
            "no_data",
        }

        for persona in self.personas:
            profile = persona.get("profile") if isinstance(persona.get("profile"), dict) else {}
            with self.subTest(persona=persona.get("id")):
                response = self.client.post(
                    f"/universities/{self.university_id}/roi",
                    json={"profile": profile},
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn("roi_value", data)
                self.assertIn("roi_label", data)
                self.assertIn("roi_tone", data)
                self.assertIn("context_type", data)
                self.assertGreaterEqual(float(data.get("roi_value", 0.0)), 0.0)
                self.assertIn(str(data.get("context_type", "")), allowed_context)


if __name__ == "__main__":
    unittest.main()
