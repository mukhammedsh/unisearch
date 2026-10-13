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
        university_id = "national-university-of-singapore-sg-singapore"
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
        no_salary_ids = [
            "eth-zurich-ch-zurich",
            "technical-university-of-munich-de-munich",
        ]

        for university_id in no_salary_ids:
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

    def test_reviewed_batch_personas_cannot_borrow_unscoped_salary_or_cost(self):
        choices = (
            ("mit-usa-cambridge", "mit-course-6-3-bachelor", "mit-first-year"),
            ("imperial-college-london-uk", "imperial-option-computing-meng", "procedure-computing-meng"),
            ("stanford-university-usa-ca", "stanford-option-cs-bs", "undergraduate-shared-evidence:stanford-first-year"),
        )
        for persona in self.personas:
            for uid, option, route in choices:
                for selected in (False, True):
                    profile = dict(persona["profile"])
                    profile["selectedAdmissionChoices"] = {uid: {
                        "studyOptionId": option, "applicationRouteId": route, "studyLevel": "undergraduate",
                        "applicantRoute": "first_year", "intendedEntryCycle": "2027 entry"}} if selected else {}
                    with self.subTest(persona=persona["id"], university=uid, selected=selected):
                        response = self.client.post(f"/universities/{uid}/roi", json={"profile": profile})
                        self.assertEqual(response.status_code, 200)
                        data = response.json()
                        self.assertEqual(data["context_type"], "scoped_cost_and_outcomes_unassessed")
                        self.assertIsNone(data["roi_value"])
                        self.assertIsNone(data["salary_used_usd"])
                        self.assertIsNone(data["annual_cost_usd"])
                        self.assertEqual(data["roi_label"], "No Data")
                        self.assertEqual(data["roi_tone"], "neutral")
                        self.assertTrue(data["catalogRevision"])
                        self.assertEqual(data["context"]["study_option_id"], option if selected else None)
                        self.assertEqual(data["context"]["application_route_id"], route if selected else None)


if __name__ == "__main__":
    unittest.main()
