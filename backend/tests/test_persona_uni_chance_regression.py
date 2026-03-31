import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests._fixture_utils import load_personas


class PersonaUniChanceRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.personas = load_personas()

        response = cls.client.get("/universities?limit=2&fields=card")
        data = response.json() if response.status_code == 200 else {}
        cls.university_ids = [
            str((row or {}).get("id") or "")
            for row in (data.get("items") or [])
            if str((row or {}).get("id") or "").strip()
        ]

    def test_persona_uni_chance_invariants(self):
        self.assertTrue(self.personas)
        self.assertTrue(self.university_ids)

        for persona in self.personas:
            profile = persona.get("profile") if isinstance(persona.get("profile"), dict) else {}
            expected_missing = bool(((persona.get("expectations") or {}).get("expect_missing_evidence")))
            for university_id in self.university_ids:
                with self.subTest(persona=persona.get("id"), university_id=university_id):
                    response = self.client.post(
                        f"/universities/{university_id}/uni-chance",
                        json={"profile": profile},
                    )
                    self.assertEqual(response.status_code, 200)
                    data = response.json()
                    self.assertIn("overallChance", data)
                    self.assertIn("tracks", data)
                    self.assertIn("missingEvidence", data)
                    overall_chance = data.get("overallChance")
                    if overall_chance is not None:
                        self.assertTrue(0 <= float(overall_chance) <= 100)
                    self.assertIsInstance(data.get("tracks"), list)
                    self.assertEqual(expected_missing, bool(data.get("missingEvidence")))

                    for track in data.get("tracks", []):
                        chance_percent = track.get("chancePercent")
                        if chance_percent is not None:
                            self.assertTrue(0 <= float(chance_percent) <= 100)
                        self.assertIn("trackLabel", track)
                        self.assertIn("details", track)


if __name__ == "__main__":
    unittest.main()
