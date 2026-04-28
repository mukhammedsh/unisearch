import unittest
from unittest.mock import patch

from app.services import exams as exams_service


class ExamNormalizationTests(unittest.TestCase):
    def test_sat_normalization_uses_anchor_percentiles(self):
        self.assertAlmostEqual(50.0, float(exams_service.normalize_exam_score("SAT", 1010) or 0.0), places=4)
        self.assertAlmostEqual(95.0, float(exams_service.normalize_exam_score("SAT", 1450) or 0.0), places=4)

    def test_unt_and_ent_share_same_normalization(self):
        unt = exams_service.normalize_exam_score("UNT", 120)
        ent = exams_service.normalize_exam_score("ENT", 120)
        self.assertAlmostEqual(95.0, float(unt or 0.0), places=4)
        self.assertAlmostEqual(float(unt or 0.0), float(ent or 0.0), places=4)

    def test_ege_normalization_uses_shared_anchor_table(self):
        self.assertAlmostEqual(50.0, float(exams_service.normalize_exam_score("EGE", 55) or 0.0), places=4)
        self.assertAlmostEqual(95.0, float(exams_service.normalize_exam_score("EGE", 88) or 0.0), places=4)

    def test_hkdse_weighted_total_uses_min_max_normalization(self):
        self.assertAlmostEqual(90.7513, float(exams_service.normalize_exam_score("HKDSE_WEIGHTED_TOTAL", 42.88) or 0.0), places=3)

    def test_a_level_grades_normalize_from_internal_points(self):
        self.assertAlmostEqual(50.0, float(exams_service.normalize_exam_score("A_LEVEL_CERT", 12) or 0.0), places=4)
        self.assertAlmostEqual(95.0, float(exams_service.normalize_exam_score("A_LEVEL_CERT", 17) or 0.0), places=4)
        self.assertTrue(exams_service.exam_supports_percentile_normalization("A_LEVEL_CERT"))

    def test_normalize_exam_score_clamps_numeric_bounds(self):
        self.assertEqual(0.0, exams_service.normalize_exam_score("SAT", 300))
        self.assertEqual(100.0, exams_service.normalize_exam_score("SAT", 1700))
        self.assertEqual(0.0, exams_service.normalize_exam_score("HKDSE_WEIGHTED_TOTAL", -5.0))
        self.assertEqual(100.0, exams_service.normalize_exam_score("HKDSE_WEIGHTED_TOTAL", 50.0))

    def test_normalize_exam_score_handles_invalid_inputs(self):
        self.assertIsNone(exams_service.normalize_exam_score("INVALID_EXAM", 100))
        self.assertIsNone(exams_service.normalize_exam_score("SAT", None))
        self.assertIsNone(exams_service.normalize_exam_score("SAT", "not_a_number"))
        self.assertIsNone(exams_service.normalize_exam_score("OSSD_CERT", 1))

    @patch.dict(exams_service.EXAMS_CONFIG, {"TEST_EXAM_NO_MINMAX": {"input_mode": "number", "type": "float"}})
    def test_normalize_exam_score_requires_min_max(self):
        self.assertIsNone(exams_service.normalize_exam_score("TEST_EXAM_NO_MINMAX", 50))

    @patch.dict(
        exams_service.EXAMS_CONFIG,
        {"TEST_EXAM_MIN_EQ_MAX": {"input_mode": "number", "type": "float", "min": 100, "max": 100}},
    )
    def test_normalize_exam_score_rejects_equal_min_max(self):
        self.assertIsNone(exams_service.normalize_exam_score("TEST_EXAM_MIN_EQ_MAX", 100))

    @patch.dict(
        exams_service.EXAMS_CONFIG,
        {
            "TEST_EXAM_CUSTOM_PERCENTILES": {
                "input_mode": "number",
                "type": "float",
                "min": 0,
                "max": 100,
                "normalization": {
                    "kind": "anchor_percentile",
                    "p50": 60,
                    "top5_min": 90,
                    "p50_percentile": 60,
                    "top5_percentile": 98,
                },
            }
        },
    )
    def test_normalize_exam_score_custom_percentile_anchors(self):
        self.assertAlmostEqual(30.0, exams_service.normalize_exam_score("TEST_EXAM_CUSTOM_PERCENTILES", 30), places=1)
        self.assertAlmostEqual(60.0, exams_service.normalize_exam_score("TEST_EXAM_CUSTOM_PERCENTILES", 60), places=1)
        self.assertAlmostEqual(79.0, exams_service.normalize_exam_score("TEST_EXAM_CUSTOM_PERCENTILES", 75), places=1)
        self.assertAlmostEqual(98.0, exams_service.normalize_exam_score("TEST_EXAM_CUSTOM_PERCENTILES", 90), places=1)
        self.assertAlmostEqual(99.0, exams_service.normalize_exam_score("TEST_EXAM_CUSTOM_PERCENTILES", 95), places=1)

    def test_normalize_exam_score_handles_grade_combo_fallbacks(self):
        self.assertIsNone(exams_service.normalize_exam_score("A_LEVEL_CERT", "invalid_combo_string"))
        self.assertAlmostEqual(
            41.6667,
            exams_service.normalize_exam_score("A_LEVEL_CERT", "10") or 0.0,
            places=4,
        )


if __name__ == "__main__":
    unittest.main()
