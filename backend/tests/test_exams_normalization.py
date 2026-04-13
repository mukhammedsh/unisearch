import unittest

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


if __name__ == "__main__":
    unittest.main()
