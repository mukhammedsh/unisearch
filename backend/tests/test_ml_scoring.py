import builtins
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

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

    def test_canonical_inventory_enters_interest_corpus_without_legacy_programs(self):
        docs = self.recommender.prepare_text_features([
            {"id": "mit-usa-cambridge", "name": "MIT"},
            {"id": "imperial-college-london-uk", "name": "Imperial"},
            {"id": "stanford-university-usa-ca", "name": "Stanford"},
        ])
        self.assertIn("computer science", docs[0].lower())
        self.assertIn("digital chemistry", docs[1].lower())
        self.assertIn("computer science", docs[2].lower())

    def test_canonical_revision_refreshes_existing_corpus_without_model_download(self):
        self.recommender._data_mtime = self.data_path.stat().st_mtime
        self.recommender._catalog_revision = "previous"
        with patch.object(ml_scoring.admissions_catalog, "get_revision", return_value="current"), patch.object(
            self.recommender, "_load_and_fit"
        ) as reload_corpus:
            self.recommender._ensure_fresh()
        reload_corpus.assert_called_once()

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

    def test_fit_semantic_keeps_optional_dependency_and_empty_corpus_failures_explicit(self):
        cases = [
            ("disabled", False, object, np, ["robotics"]),
            ("missing sentence-transformers", True, None, np, ["robotics"]),
            ("missing numpy", True, object, None, ["robotics"]),
            ("empty corpus", True, object, np, []),
        ]
        expected_errors = {
            "disabled": "semantic_disabled",
            "missing sentence-transformers": "semantic_dependency_missing",
            "missing numpy": "semantic_dependency_missing",
            "empty corpus": "empty_corpus",
        }

        for name, enabled, model_class, numpy_module, docs in cases:
            with self.subTest(name=name):
                with patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_ENABLED", enabled), patch.object(
                    ml_scoring, "_load_sentence_transformer_class", return_value=model_class
                ), patch.object(ml_scoring, "_load_numpy", return_value=numpy_module):
                    self.recommender._fit_semantic(docs)

                self.assertFalse(self.recommender._semantic_ready)
                self.assertIsNone(self.recommender._semantic_embeddings)
                self.assertEqual(expected_errors[name], self.recommender._semantic_error)

    def test_fit_semantic_encodes_passages_and_returns_semantic_scores(self):
        model_arguments = []
        encode_calls = []

        class FakeModel:
            def encode(self, texts, **kwargs):
                encode_calls.append((texts, kwargs))
                vector = [0.75, 0.25] if texts[0].startswith("passage:") else [1.0, 0.0]
                return np.array([vector], dtype=np.float32)

        class FakeSentenceTransformer:
            def __init__(self, model_name, device):
                model_arguments.append((model_name, device))

            def encode(self, texts, **kwargs):
                return FakeModel().encode(texts, **kwargs)

        with patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_ENABLED", True), patch.object(
            ml_scoring, "ML_SEMANTIC_EMBEDDINGS_E5_PREFIX", "on"
        ), patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE", 8), patch.object(
            ml_scoring, "_load_sentence_transformer_class", return_value=FakeSentenceTransformer
        ):
            self.recommender._fit_semantic(["computer science"])
            self.recommender._university_ids = ["u1"]
            result = self.recommender._predict_semantic("robotics")

        self.assertTrue(self.recommender._semantic_ready)
        self.assertEqual("", self.recommender._semantic_error)
        self.assertEqual([(ml_scoring.ML_SEMANTIC_EMBEDDINGS_MODEL, ml_scoring.ML_SEMANTIC_EMBEDDINGS_DEVICE)], model_arguments)
        self.assertEqual("passage: computer science", encode_calls[0][0][0])
        self.assertEqual(8, encode_calls[0][1]["batch_size"])
        self.assertTrue(encode_calls[0][1]["normalize_embeddings"])
        self.assertAlmostEqual(0.5714, result["u1"], places=3)

    def test_fit_semantic_reports_encoder_failures_without_marking_model_ready(self):
        class BrokenModel:
            def encode(self, texts, **kwargs):
                raise RuntimeError("encoder unavailable")

        class BrokenSentenceTransformer:
            def __init__(self, model_name, device):
                pass

            def encode(self, texts, **kwargs):
                return BrokenModel().encode(texts, **kwargs)

        with patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_ENABLED", True), patch.object(
            ml_scoring, "_load_sentence_transformer_class", return_value=BrokenSentenceTransformer
        ):
            self.recommender._fit_semantic(["robotics"])

        self.assertFalse(self.recommender._semantic_ready)
        self.assertIsNone(self.recommender._semantic_embeddings)
        self.assertEqual("semantic_init_failed:encoder unavailable", self.recommender._semantic_error)

    def test_optional_model_dependencies_can_be_missing_without_import_crashes(self):
        real_import = builtins.__import__

        def import_without_numpy(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "numpy":
                raise ImportError("numpy is not installed")
            return real_import(name, globals, locals, fromlist, level)

        with patch.object(ml_scoring, "np", None), patch.object(ml_scoring, "_NUMPY_AVAILABLE", None), patch(
            "builtins.__import__", side_effect=import_without_numpy
        ):
            self.assertIsNone(ml_scoring._load_numpy())
            self.assertFalse(ml_scoring._NUMPY_AVAILABLE)

        def import_without_sentence_transformers(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "sentence_transformers":
                raise ImportError("sentence-transformers is not installed")
            return real_import(name, globals, locals, fromlist, level)

        with patch.object(ml_scoring, "SentenceTransformer", None), patch.object(
            ml_scoring, "_SENTENCE_TRANSFORMERS_AVAILABLE", None
        ), patch("builtins.__import__", side_effect=import_without_sentence_transformers):
            self.assertIsNone(ml_scoring._load_sentence_transformer_class())
            self.assertFalse(ml_scoring._SENTENCE_TRANSFORMERS_AVAILABLE)

    def test_e5_prefix_formatting_can_be_forced(self):
        with patch.object(ml_scoring, "ML_SEMANTIC_EMBEDDINGS_E5_PREFIX", "on"), patch.object(
            self.recommender, "_ensure_fresh", return_value=None
        ):
            self.assertEqual("query: ai systems", self.recommender._format_semantic_query("ai systems"))
            self.assertEqual("passage: robotics lab", self.recommender._format_semantic_passage("robotics lab"))

    def test_predict_semantic_uses_embedding_similarity_without_language_bonus(self):
        import numpy as np

        self.recommender._university_ids = ["u1"]
        self.recommender._semantic_ready = True
        self.recommender._semantic_embeddings = np.array([[0.75]], dtype=np.float32)

        class MockModel:
            def encode(self, texts, **kwargs):
                return np.array([[1.0]], dtype=np.float32)

        self.recommender._semantic_model = MockModel()

        out_en = self.recommender._predict_semantic("robotics")
        out_ru = self.recommender._predict_semantic("робототехника")

        self.assertIsNotNone(out_en)
        self.assertIsNotNone(out_ru)
        self.assertAlmostEqual(0.5714, out_en["u1"], places=3)
        self.assertEqual(out_en["u1"], out_ru["u1"])


if __name__ == "__main__":
    unittest.main()
