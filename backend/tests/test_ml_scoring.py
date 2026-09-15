import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services import ml_scoring
from app.services.ml_scoring import MLRecommender, _normalize_ml_text


class MlScoringNormalizationTests(unittest.TestCase):
    def test_normalize_ml_text_expands_common_short_forms(self):
        query = "I want ICT, gamedev, ui/ux and genai"
        normalized = _normalize_ml_text(query)

        self.assertIn("information communication technology", normalized)
        self.assertIn("game development", normalized)
        self.assertIn("user interface", normalized)
        self.assertIn("generative ai", normalized)

    def test_normalize_ml_text_preserves_unicode_characters(self):
        query = "робототехника, AI & 计算机"
        normalized = _normalize_ml_text(query)

        self.assertIn("робототехника", normalized)
        self.assertIn("artificial intelligence", normalized)
        self.assertIn("计算机", normalized)


class MlRecommenderTests(unittest.TestCase):
    def setUp(self):
        MLRecommender._instance = None
        self._tmp = tempfile.TemporaryDirectory()
        self.data_path = Path(self._tmp.name) / "universities.json"
        self.universities = [
            {
                "id": "u1",
                "name": "Semantic Tech University",
                "description": "Artificial intelligence and robotics focus",
                "location": {"city": "Astana", "country": "Kazakhstan"},
                "academics": {"programs": [{"name": "Computer Science"}]},
                "tags": ["ai", "robotics"],
                "major_focus": ["ai", "computer science"],
                "admission_categories": [
                    {
                        "id": "direct-ai",
                        "label": "Direct AI Category",
                        "description": "Bachelor AI admission",
                        "study_mode": ["On-campus", "Online"],
                        "extra_requirements": ["Portfolio"],
                        "requirement_profiles": [
                            {
                                "id": "direct-ai",
                                "label": "Direct AI Profile",
                                "description": "Deep learning and machine vision",
                            }
                        ],
                    }
                ],
            },
            {
                "id": "u2",
                "name": "Business Academy",
                "description": "Finance and management",
                "location": {"city": "Almaty", "country": "Kazakhstan"},
                "academics": {"programs": [{"name": "Business Administration"}]},
            },
        ]
        self.data_path.write_text(json.dumps(self.universities, ensure_ascii=False), encoding="utf-8")
        # Avoid expensive model/bootstrap in unit tests; behavior is mocked per test.
        with patch.object(MLRecommender, "_load_and_fit", return_value=None):
            self.recommender = MLRecommender(data_path=str(self.data_path))

    def tearDown(self):
        MLRecommender._instance = None
        self._tmp.cleanup()

    def test_prepare_text_features_includes_admission_category_fields(self):
        docs = self.recommender.prepare_text_features(self.universities)
        self.assertEqual(2, len(docs))
        doc = docs[0].lower()

        self.assertIn("direct ai category", doc)
        self.assertIn("direct ai profile", doc)
        self.assertIn("deep learning and machine vision", doc)
        self.assertIn("portfolio", doc)
        self.assertTrue(("on-campus" in doc) or ("on campus" in doc))

    def test_predict_relevance_uses_semantic_when_available(self):
        self.recommender._university_ids = ["u1", "u2"]
        with patch.object(self.recommender, "_ensure_fresh", return_value=None), patch.object(
            self.recommender,
            "_predict_semantic",
            return_value={"u1": 0.91, "u2": 0.11},
        ) as semantic_mock:
            out = self.recommender.predict_relevance("ai robotics")

        self.assertEqual({"u1": 0.91, "u2": 0.11}, out)
        semantic_mock.assert_called_once()

    def test_predict_relevance_returns_zeroes_when_semantic_unavailable(self):
        self.recommender._university_ids = ["u1", "u2"]
        with patch.object(self.recommender, "_ensure_fresh", return_value=None), patch.object(
            self.recommender,
            "_predict_semantic",
            return_value=None,
        ) as semantic_mock:
            out = self.recommender.predict_relevance("business finance")

        self.assertEqual({"u1": 0.0, "u2": 0.0}, out)
        semantic_mock.assert_called_once()

    def test_runtime_status_reports_semantic_mode(self):
        self.recommender._university_ids = ["u1"]
        self.recommender._semantic_ready = True
        self.recommender._runtime_reason = "semantic_ready"

        with patch.object(self.recommender, "_ensure_fresh", return_value=None):
            status = self.recommender.runtime_status()

        self.assertTrue(bool(status.get("available")))
        self.assertEqual("semantic", str(status.get("mode")))
        self.assertEqual("semantic_ready", str(status.get("reason")))
        self.assertEqual("", str(status.get("message")))
        self.assertTrue(bool(status.get("semanticReady")))
        self.assertIn("semanticModelConfigured", status)

    def test_runtime_status_reports_unavailable_reason(self):
        self.recommender._university_ids = ["u1"]
        self.recommender._semantic_ready = False
        self.recommender._runtime_reason = "semantic_dependency_missing"
        self.recommender._semantic_error = "semantic_dependency_missing"

        with patch.object(self.recommender, "_ensure_fresh", return_value=None):
            status = self.recommender.runtime_status()

        self.assertFalse(bool(status.get("available")))
        self.assertEqual("unavailable", str(status.get("mode")))
        self.assertEqual("semantic_dependency_missing", str(status.get("reason")))
        self.assertEqual("Machine Learning unavailable", str(status.get("message")))

    def test_e5_prefix_formatting_can_be_forced(self):
        with patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_E5_PREFIX", "on"), patch.object(
            self.recommender, "_ensure_fresh", return_value=None
        ):
            self.assertEqual("query: ai systems", self.recommender._format_semantic_query("ai systems"))
            self.assertEqual("passage: robotics lab", self.recommender._format_semantic_passage("robotics lab"))

    def test_predict_semantic_applies_cross_lingual_offset(self):
        import numpy as np

        self.recommender._university_ids = ["u1"]
        self.recommender._semantic_ready = True
        self.recommender._semantic_embeddings = np.array([[0.75]], dtype=np.float32)

        class MockModel:
            def encode(self, texts, **kwargs):
                return np.array([[1.0]], dtype=np.float32)

        self.recommender._semantic_model = MockModel()

        # ASCII query: no offset -> (0.75 - 0.55) / 0.35 = 0.5714
        out_en = self.recommender._predict_semantic("robotics")
        # Non-ASCII query: offset 0.038 -> (0.75 + 0.038 - 0.55) / 0.35 = 0.68
        out_ru = self.recommender._predict_semantic("робототехника")

        self.assertIsNotNone(out_en)
        self.assertIsNotNone(out_ru)
        self.assertAlmostEqual(0.5714, out_en["u1"], places=3)
        self.assertAlmostEqual(0.6800, out_ru["u1"], places=3)


if __name__ == "__main__":
    unittest.main()
