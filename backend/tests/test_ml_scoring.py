import unittest

from app.services.ml_scoring import _normalize_ml_text


class MlScoringNormalizationTests(unittest.TestCase):
    def test_normalize_ml_text_expands_common_short_forms(self):
        query = "I want ICT, gamedev, ui/ux and genai"
        normalized = _normalize_ml_text(query)

        self.assertIn("information communication technology", normalized)
        self.assertIn("game development", normalized)
        self.assertIn("user interface", normalized)
        self.assertIn("generative ai", normalized)


if __name__ == "__main__":
    unittest.main()
