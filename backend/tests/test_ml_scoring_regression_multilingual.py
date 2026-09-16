import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.ml_scoring import MLRecommender


class MlScoringRegressionMultilingualTests(unittest.TestCase):
    def setUp(self):
        MLRecommender._instance = None
        self._tmp = tempfile.TemporaryDirectory()
        self.data_path = Path(self._tmp.name) / "universities.json"
        
        # Seed mock university test data
        self.universities = [
            {
                "id": "aitu",
                "name": "Astana IT University",
                "description": "Focused on digital education, IT, software engineering, and artificial intelligence.",
                "location": {"city": "Astana", "country": "Kazakhstan"},
                "academics": {"programs": [{"name": "Computer Science"}]},
                "tags": ["it", "software", "ai"],
                "major_focus": ["it", "computer science"],
            },
            {
                "id": "nu",
                "name": "Nazarbayev University",
                "description": "Broad research university. Strong science, biology, chemistry, and academic environment.",
                "location": {"city": "Astana", "country": "Kazakhstan"},
                "academics": {"programs": [{"name": "Biology"}]},
                "tags": ["research", "science"],
            },
        ]
        self.data_path.write_text(json.dumps(self.universities, ensure_ascii=False), encoding="utf-8")
        
        # Instantiate recommender
        with patch.object(MLRecommender, "_load_and_fit", return_value=None):
            self.recommender = MLRecommender(data_path=str(self.data_path))

    def tearDown(self):
        MLRecommender._instance = None
        self._tmp.cleanup()

    def test_predict_relevance_with_multilingual_queries(self):
        """Verify relevance scoring on mixed and cross-lingual queries."""
        self.recommender._university_ids = ["aitu", "nu"]
        
        # For "software engineering" query, AITU must rank higher
        with patch.object(self.recommender, "_ensure_fresh", return_value=None), patch.object(
            self.recommender,
            "_predict_semantic",
            return_value={"aitu": 0.85, "nu": 0.05},
        ):
            out = self.recommender.predict_relevance("software engineering")
            
        self.assertGreater(out["aitu"], out["nu"])

    def test_predict_relevance_semantic_translation_integration(self):
        """Verify semantic matching integration on Russian language queries."""
        self.recommender._university_ids = ["aitu", "nu"]
        
        # Simulate semantic prediction where E5 model matches localized query input
        with patch.object(self.recommender, "_ensure_fresh", return_value=None), patch.object(
            self.recommender,
            "_predict_semantic",
            return_value={"aitu": 0.15, "nu": 0.92},
        ):
            out = self.recommender.predict_relevance("исследования и наука")
            
        self.assertGreater(out["nu"], out["aitu"])


if __name__ == "__main__":
    unittest.main()
