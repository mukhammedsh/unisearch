import unittest

from app.services.exam_support import validate_numeric_score


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


if __name__ == "__main__":
    unittest.main()
