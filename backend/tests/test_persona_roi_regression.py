import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests._fixture_utils import load_personas


class PersonaRoiRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.personas = load_personas()

    def test_persona_roi_invariants_for_university_with_salary(self):
        university_id = "mit-usa-cambridge"
        allowed_context = {
            "matched_major",
            "missing_major",
            "fallback_major",
            "no_salary_data",
            "no_data",
        }

        for persona in self.personas:
            profile = persona.get("profile") if isinstance(persona.get("profile"), dict) else {}
            with self.subTest(persona=persona.get("id"), university_id=university_id):
                response = self.client.post(
                    f"/universities/{university_id}/roi",
                    json={"profile": profile},
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn("roi_value", data)
                self.assertIn("roi_label", data)
                self.assertIn("roi_tone", data)
                self.assertIn("context_type", data)
                self.assertIsNotNone(data.get("roi_value"))
                self.assertGreaterEqual(float(data.get("roi_value", 0.0)), 0.0)
                self.assertIn(str(data.get("context_type", "")), allowed_context)

    def test_persona_roi_invariants_for_university_without_salary(self):
        university_id = "eth-zurich-ch-zurich"

        for persona in self.personas:
            profile = persona.get("profile") if isinstance(persona.get("profile"), dict) else {}
            with self.subTest(persona=persona.get("id"), university_id=university_id):
                response = self.client.post(
                    f"/universities/{university_id}/roi",
                    json={"profile": profile},
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn("roi_value", data)
                self.assertIn("roi_label", data)
                self.assertIn("roi_tone", data)
                self.assertIn("context_type", data)
                self.assertIsNone(data.get("roi_value"))
                self.assertIsNone(data.get("salary_used_usd"))
                self.assertEqual("No Data", data.get("roi_label"))
                self.assertEqual("neutral", data.get("roi_tone"))
                self.assertEqual("no_salary_data", data.get("context_type"))
                self.assertGreater(float(data.get("annual_cost_usd", 0.0)), 0.0)


if __name__ == "__main__":
    unittest.main()
