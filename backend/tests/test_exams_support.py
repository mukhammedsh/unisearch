import unittest

from app.services.exam_support import validate_numeric_score
from app.services.exams import coerce_exam_submission


class ValidateNumericScoreTests(unittest.TestCase):
    def setUp(self):
        self.cfg_standard = {"min": 0, "max": 100}
        self.cfg_with_step = {"min": 0, "max": 100, "step": 0.5}

    def test_accepts_valid_numeric_scores(self):
        cases = [
            ("50", 50.0),
            ("75.5", 75.5),
            ("0", 0.0),
            ("100", 100.0),
            (25, 25.0),
            (33.3, 33.3),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(validate_numeric_score("TEST_EXAM", self.cfg_standard, raw), expected)

    def test_rejects_missing_scores(self):
        for raw in (None, "", " "):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, "score is required"):
                    validate_numeric_score("TEST_EXAM", self.cfg_standard, raw)

    def test_rejects_invalid_or_non_finite_scores(self):
        for raw in ("abc", "12..3", "1.2.3", "NaN", "Infinity", "-Infinity", "inf"):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, "Invalid score format"):
                    validate_numeric_score("TEST_EXAM", self.cfg_standard, raw)

    def test_rejects_out_of_bounds_scores(self):
        for raw in ("-1", "101", -0.001, 100.001):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, "Score must be between"):
                    validate_numeric_score("TEST_EXAM", self.cfg_standard, raw)

    def test_rejects_scores_that_do_not_follow_step(self):
        for raw in ("75.25", "33.33"):
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(ValueError, "Score must follow step"):
                    validate_numeric_score("TEST_EXAM", self.cfg_with_step, raw)


class ConfiguredExamInputModeTests(unittest.TestCase):
    def test_flag_submissions_normalize_supported_truthy_and_falsy_values(self):
        cases = [(None, 1), ("", 1), ("yes", 1), ("on", 1), ("false", 0), ("off", 0)]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                result = coerce_exam_submission("SWISS_MATURITY_CERT", score_raw=raw)
                self.assertEqual(expected, result["score"])

        with self.assertRaisesRegex(ValueError, "must be 0 or 1"):
            coerce_exam_submission("SWISS_MATURITY_CERT", score_raw="completed")

    def test_single_subject_a_level_accepts_supported_grade_aliases(self):
        result = coerce_exam_submission("A_LEVEL_MATHEMATICS", raw_value="A STAR")

        self.assertEqual(6, result["score"])
        self.assertEqual("A*", result["raw_value"])
        self.assertEqual(["A*"], result["details"]["grades"])
        with self.assertRaisesRegex(ValueError, "A-Level grades"):
            coerce_exam_submission("A_LEVEL_MATHEMATICS", raw_value="Z")

    def test_band_scores_normalize_labels_details_and_numeric_values(self):
        by_label = coerce_exam_submission("UCAT_SJT", raw_value="band 3")
        by_details = coerce_exam_submission("UCAT_SJT", details={"band": "Band 4"})
        by_number = coerce_exam_submission("UCAT_SJT", score_raw="2")

        self.assertEqual((3, "Band 3"), (by_label["score"], by_label["display_value"]))
        self.assertEqual((4, "Band 4"), (by_details["score"], by_details["display_value"]))
        self.assertEqual((2, "Band 2"), (by_number["score"], by_number["display_value"]))


if __name__ == "__main__":
    unittest.main()
