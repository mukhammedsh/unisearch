import unittest

from fastapi.testclient import TestClient

from app.main import app
from tests._fixture_utils import build_ai_sort_payload, load_natural_inputs, load_personas


class PersonaAiSortRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.personas = load_personas()
        cls.natural_inputs = load_natural_inputs()

    def test_persona_ai_sort_invariants(self):
        self.assertTrue(self.personas)
        for idx, persona in enumerate(self.personas):
            payload = build_ai_sort_payload(persona, budget_vs_prestige=62, limit=20)
            if self.natural_inputs:
                natural_text = str(self.natural_inputs[idx % len(self.natural_inputs)].get("text") or "").strip()
                if natural_text:
                    payload["profile"]["interests"] = natural_text

            with self.subTest(persona=persona.get("id")):
                response = self.client.post("/universities/ai-sort", json=payload)
                self.assertEqual(response.status_code, 200)
                data = response.json()

                self.assertIn("items", data)
                self.assertIn("warnings", data)
                items = data.get("items") or []
                min_items = int(((persona.get("expectations") or {}).get("min_items")) or 1)
                self.assertGreaterEqual(len(items), min_items)

                scores = []
                for row in items:
                    match_data = row.get("matchData") or {}
                    final_score = float(match_data.get("finalScore", 0.0) or 0.0)
                    self.assertGreaterEqual(final_score, 0.0)
                    self.assertLessEqual(final_score, 1.0)
                    scores.append(final_score)

                is_sorted = all(scores[i] <= (scores[i + 1] + 1e-9) for i in range(len(scores) - 1))
                self.assertTrue(is_sorted)


if __name__ == "__main__":
    unittest.main()
