import unittest
from app.services.exams import coerce_exam_submission, _coerce_subject_breakdown_submission, EXAMS_CONFIG

class SubjectBreakdownCoercionTests(unittest.TestCase):
    def test_components_must_be_list(self):
        with self.assertRaisesRegex(ValueError, "SAT components must be a list"):
            coerce_exam_submission("SAT", details={"components": "not-a-list"})

    def test_extra_scores_must_be_list(self):
        # Pass fixed components for HKDSE_LEVEL
        fixed = [
            {"exam": "HKDSE_CHINESE_LANGUAGE", "score": 5},
            {"exam": "HKDSE_ENGLISH_LANGUAGE", "score": 5},
            {"exam": "HKDSE_MATHEMATICS", "score": 5},
            {"exam": "HKDSE_CITIZENSHIP_AND_SOCIAL_DEVELOPMENT", "score": 1},
            {"exam": "HKDSE_ELECTIVE_1", "score": 5},
            {"exam": "HKDSE_ELECTIVE_2_OR_M1_M2_OTHER_LANGUAGE", "score": 5},
        ]
        with self.assertRaisesRegex(ValueError, "HKDSE_LEVEL extra scores must be a list"):
            coerce_exam_submission("HKDSE_LEVEL", details={"components": fixed, "extra_scores": "not-a-list"})

    def test_component_must_be_object(self):
        with self.assertRaisesRegex(ValueError, "SAT components must be objects"):
            coerce_exam_submission("SAT", details={"components": ["not-a-dict"]})

    def test_component_exam_required(self):
        with self.assertRaisesRegex(ValueError, "SAT component exam is required"):
            coerce_exam_submission("SAT", details={"components": [{}]})

    def test_cannot_contain_itself_as_component(self):
        with self.assertRaisesRegex(ValueError, "SAT cannot contain itself as a component"):
            coerce_exam_submission("SAT", details={"components": [{"exam": "SAT"}]})

    def test_unsupported_component(self):
        with self.assertRaisesRegex(ValueError, "SAT does not support component ACT"):
            coerce_exam_submission("SAT", details={"components": [{"exam": "ACT"}]})

    def test_duplicate_component_not_allowed(self):
        with self.assertRaisesRegex(ValueError, "SAT does not allow duplicate component SAT_MATH"):
            coerce_exam_submission("SAT", details={"components": [
                {"exam": "SAT_MATH", "score": 700},
                {"exam": "SAT_MATH", "score": 750},
            ]})

    def test_required_fixed_component_missing(self):
        with self.assertRaisesRegex(ValueError, "SAT requires component Math"):
            coerce_exam_submission("SAT", details={"components": [
                {"exam": "SAT_EBRW", "score": 700},
            ]})

    def test_selectable_subjects_min_max_limits(self):
        # UNT requires min 2 selected subjects
        with self.assertRaisesRegex(ValueError, "UNT requires at least 2 selected subjects"):
            coerce_exam_submission("UNT", details={"components": [
                {"exam": "UNT_HISTORY_OF_KAZAKHSTAN", "score": 15},
                {"exam": "UNT_READING_LITERACY", "score": 10},
                {"exam": "UNT_MATHEMATICAL_LITERACY", "score": 10},
                {"exam": "UNT_PROFILE_MATHEMATICS", "score": 35},
            ]})

        # Max is 2 for UNT, providing 3 should raise error
        with self.assertRaisesRegex(ValueError, "UNT supports at most 2 selected subjects"):
            coerce_exam_submission("UNT", details={"components": [
                {"exam": "UNT_HISTORY_OF_KAZAKHSTAN", "score": 15},
                {"exam": "UNT_READING_LITERACY", "score": 10},
                {"exam": "UNT_MATHEMATICAL_LITERACY", "score": 10},
                {"exam": "UNT_PROFILE_MATHEMATICS", "score": 35},
                {"exam": "UNT_PROFILE_PHYSICS", "score": 35},
                {"exam": "UNT_PROFILE_INFORMATICS", "score": 35},
            ]})

    def test_extra_scores_validation_and_parsing(self):
        hkdse_components = [
            {"exam": "HKDSE_CHINESE_LANGUAGE", "score": 5},
            {"exam": "HKDSE_ENGLISH_LANGUAGE", "score": 5},
            {"exam": "HKDSE_MATHEMATICS", "score": 5},
            {"exam": "HKDSE_CITIZENSHIP_AND_SOCIAL_DEVELOPMENT", "score": 1},
            {"exam": "HKDSE_ELECTIVE_1", "score": 5},
            {"exam": "HKDSE_ELECTIVE_2_OR_M1_M2_OTHER_LANGUAGE", "score": 5},
        ]
        with self.assertRaisesRegex(ValueError, "HKDSE_LEVEL extra scores must be objects"):
            coerce_exam_submission("HKDSE_LEVEL", details={
                "components": hkdse_components,
                "extra_scores": ["invalid"]
            })

        with self.assertRaisesRegex(ValueError, "HKDSE_LEVEL extra score exam is required"):
            coerce_exam_submission("HKDSE_LEVEL", details={
                "components": hkdse_components,
                "extra_scores": [{}]
            })

        with self.assertRaisesRegex(ValueError, "HKDSE_LEVEL does not support extra score ACT"):
            coerce_exam_submission("HKDSE_LEVEL", details={
                "components": hkdse_components,
                "extra_scores": [{"exam": "ACT"}]
            })

        with self.assertRaisesRegex(ValueError, "HKDSE_LEVEL does not allow duplicate extra score HKDSE_WEIGHTED_TOTAL"):
            coerce_exam_submission("HKDSE_LEVEL", details={
                "components": hkdse_components,
                "extra_scores": [
                    {"exam": "HKDSE_WEIGHTED_TOTAL", "score": 30},
                    {"exam": "HKDSE_WEIGHTED_TOTAL", "score": 30},
                ]
            })

        res = coerce_exam_submission("HKDSE_LEVEL", details={
            "components": hkdse_components,
            "extra_scores": [
                {"exam": "HKDSE_WEIGHTED_TOTAL", "score": 30}
            ]
        })
        self.assertEqual(res["score"], 26)
        self.assertIn("extra_scores", res["details"])
        self.assertIn("Weighted total 30", res["display_value"])

    def test_total_strategies(self):
        # components_only (ESAT has selectable_components only, total_strategy components_only)
        with self.assertRaisesRegex(ValueError, "ESAT requires at least 1 selected subjects"):
            _coerce_subject_breakdown_submission("ESAT", EXAMS_CONFIG["ESAT"], details={"components": []})

        # use_parent_score (IB_DIPLOMA)
        res_ib = coerce_exam_submission("IB_DIPLOMA", score_raw=38, details={
            "components": [{"exam": "IB_MATHEMATICS_HL", "raw_value": "7"}]
        })
        self.assertEqual(res_ib["score"], 38)
        self.assertIn("Total 38", res_ib["display_value"])

        # best_of_sum (A_LEVEL_CERT)
        with self.assertRaisesRegex(ValueError, "A_LEVEL_CERT requires at least 3 selected subjects"):
            _coerce_subject_breakdown_submission("A_LEVEL_CERT", EXAMS_CONFIG["A_LEVEL_CERT"], details={"components": []})

        res_alevel = coerce_exam_submission("A_LEVEL_CERT", details={
            "components": [
                {"exam": "A_LEVEL_MATHEMATICS", "raw_value": "A*"},
                {"exam": "A_LEVEL_PHYSICS", "raw_value": "A*"},
                {"exam": "A_LEVEL_CHEMISTRY", "raw_value": "A*"},
                {"exam": "A_LEVEL_BIOLOGY", "raw_value": "A"},
            ]
        })
        self.assertEqual(res_alevel["score"], 18)

    def test_flag_child_component_display_value(self):
        # Test flag child mode display value ("Pass" / "Not passed")
        res = coerce_exam_submission("HKDSE_LEVEL", details={
            "components": [
                {"exam": "HKDSE_CHINESE_LANGUAGE", "score": 5},
                {"exam": "HKDSE_ENGLISH_LANGUAGE", "score": 5},
                {"exam": "HKDSE_MATHEMATICS", "score": 5},
                {"exam": "HKDSE_CITIZENSHIP_AND_SOCIAL_DEVELOPMENT", "score": 1},
                {"exam": "HKDSE_ELECTIVE_1", "score": 5},
                {"exam": "HKDSE_ELECTIVE_2_OR_M1_M2_OTHER_LANGUAGE", "score": 5},
            ]
        })
        citizenship_comp = next(c for c in res["details"]["components"] if c["exam"] == "HKDSE_CITIZENSHIP_AND_SOCIAL_DEVELOPMENT")
        self.assertEqual(citizenship_comp["display_value"], "Pass")


if __name__ == "__main__":
    unittest.main()
