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

    def _assert_ml_matchdata_contract(self, match_data):
        self.assertIn("mlMode", match_data)
        self.assertIn("mlScore", match_data)
        self.assertIn("mlSemanticScore", match_data)
        self.assertIn("mlLexicalScore", match_data)
        self.assertIn("semanticSignalWeight", match_data)
        self.assertIn("mlEnabled", match_data)
        self.assertIn("mlApplied", match_data)
        self.assertIn("mlUnavailable", match_data)

        mode = str(match_data.get("mlMode") or "")
        self.assertIn(mode, {"semantic", "tfidf", "unavailable", "disabled"})

        ml_score = float(match_data.get("mlScore", 0.0) or 0.0)
        ml_semantic = float(match_data.get("mlSemanticScore", 0.0) or 0.0)
        ml_lexical = float(match_data.get("mlLexicalScore", 0.0) or 0.0)
        for val in (ml_score, ml_semantic, ml_lexical):
            self.assertGreaterEqual(val, 0.0)
            self.assertLessEqual(val, 1.0)

        ml_enabled = bool(match_data.get("mlEnabled"))
        ml_applied = bool(match_data.get("mlApplied"))
        ml_unavailable = bool(match_data.get("mlUnavailable"))

        if ml_applied:
            self.assertTrue(ml_enabled)
            self.assertFalse(ml_unavailable)
            self.assertIn(mode, {"semantic", "tfidf"})
            self.assertAlmostEqual(0.15, float(match_data.get("semanticSignalWeight", 0.0) or 0.0), places=6)
        else:
            self.assertEqual(0.0, float(match_data.get("semanticSignalWeight", 0.0) or 0.0))
            if ml_enabled:
                self.assertTrue(ml_unavailable)

        if mode == "semantic":
            self.assertAlmostEqual(ml_score, ml_semantic, places=6)
            self.assertAlmostEqual(0.0, ml_lexical, places=6)
        if mode == "tfidf":
            self.assertAlmostEqual(ml_score, ml_lexical, places=6)
            self.assertAlmostEqual(0.0, ml_semantic, places=6)

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
                    self._assert_ml_matchdata_contract(match_data)
                    scores.append(final_score)

                is_sorted = all(scores[i] <= (scores[i + 1] + 1e-9) for i in range(len(scores) - 1))
                self.assertTrue(is_sorted)


if __name__ == "__main__":
    unittest.main()
