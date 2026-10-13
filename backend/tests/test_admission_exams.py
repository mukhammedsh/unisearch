import unittest

from app.services.exams import coerce_exam_submission, exam_supports_percentile_normalization


class AdmissionExamConfigTests(unittest.TestCase):
    def test_admission_exam_scales_do_not_create_percentile_anchors(self):
        for exam in ("TMUA", "ESAT", "UCAT", "GAMSAT", "LSAT", "MCAT"):
            with self.subTest(exam=exam):
                self.assertFalse(exam_supports_percentile_normalization(exam))

    def test_tmua_uses_one_decimal_overall_score_without_percentile_anchors(self):
        self.assertEqual(6.4, coerce_exam_submission("TMUA", score_raw=6.4)["score"])
        for score in (0.9, 9.1, 6.45):
            with self.subTest(score=score), self.assertRaises(ValueError):
                coerce_exam_submission("TMUA", score_raw=score)

    def test_esat_keeps_selected_module_scores_without_creating_a_total(self):
        result = coerce_exam_submission("ESAT", details={"components": [
            {"exam": "ESAT_MATH_1", "score": 1.0},
            {"exam": "ESAT_PHYSICS", "score": 9.0},
        ]})
        self.assertNotIn("score", result)
        self.assertNotIn("score_total", result["details"])
        for components in ([], [{"exam": "ESAT_MATH_1", "score": 4.0},
                                {"exam": "ESAT_MATH_1", "score": 4.2}],
                            [{"exam": "ESAT_ABSTRACT_REASONING", "score": 5.0}]):
            with self.subTest(components=components), self.assertRaises(ValueError):
                coerce_exam_submission("ESAT", details={"components": components})

    def test_ucat_current_total_has_three_cognitive_scores_and_separate_sjt_band(self):
        result = coerce_exam_submission("UCAT", details={
            "components": [
                {"exam": "UCAT_VERBAL_REASONING", "score": 300},
                {"exam": "UCAT_DECISION_MAKING", "score": 600},
                {"exam": "UCAT_QUANTITATIVE_REASONING", "score": 900},
            ],
            "extra_scores": [{"exam": "UCAT_SJT", "raw_value": "Band 2"}],
        })
        self.assertEqual(1800, result["score"])
        self.assertEqual(2, result["details"]["extra_scores"][0]["score"])
        for components in ([{"exam": "UCAT_VERBAL_REASONING", "score": 299},
                           {"exam": "UCAT_DECISION_MAKING", "score": 600},
                           {"exam": "UCAT_QUANTITATIVE_REASONING", "score": 900}],
                           [{"exam": "UCAT_VERBAL_REASONING", "score": 300},
                            {"exam": "UCAT_DECISION_MAKING", "score": 600},
                            {"exam": "UCAT_ABSTRACT_REASONING", "score": 600}]):
            with self.subTest(components=components), self.assertRaises(ValueError):
                coerce_exam_submission("UCAT", details={"components": components})
        with self.assertRaises(ValueError):
            coerce_exam_submission("UCAT_SJT", raw_value="Band 5")

    def test_ucat_dated_result_rejects_unconfigured_pre_2025_format(self):
        scores = {"components": [
            {"exam": "UCAT_VERBAL_REASONING", "score": 600},
            {"exam": "UCAT_DECISION_MAKING", "score": 600},
            {"exam": "UCAT_QUANTITATIVE_REASONING", "score": 600},
        ]}
        with self.assertRaisesRegex(ValueError, "unsupported test format"):
            coerce_exam_submission("UCAT", details=scores, taken_on="2024-12-31")
        self.assertEqual(
            "2025-01-01",
            coerce_exam_submission("UCAT", details=scores, taken_on="2025-01-01")["taken_on"],
        )
        self.assertNotIn("taken_on", coerce_exam_submission("UCAT", details=scores))
        with self.assertRaisesRegex(ValueError, "ISO date"):
            coerce_exam_submission("UCAT", details=scores, taken_on="2025-2-01")

    def test_gamsat_preserves_reported_total_and_never_recomputes_from_rounded_sections(self):
        result = coerce_exam_submission("GAMSAT", score_raw=61, details={"components": [
            {"exam": "GAMSAT_HUMANITIES_SOCIAL_SCIENCES", "score": 60},
            {"exam": "GAMSAT_WRITTEN_COMMUNICATION", "score": 60},
            {"exam": "GAMSAT_BIOLOGICAL_PHYSICAL_SCIENCES", "score": 61},
        ]})
        self.assertEqual(61, result["score"])
        self.assertEqual(61, result["details"]["score_total"])
        self.assertEqual(60.5, (60 + 60 + 2 * 61) / 4)
        with self.assertRaisesRegex(ValueError, "score is required"):
            coerce_exam_submission("GAMSAT", details={"components": [
                {"exam": "GAMSAT_HUMANITIES_SOCIAL_SCIENCES", "score": 60},
            ]})
        for score in (-0.1, 100.1):
            with self.subTest(score=score), self.assertRaises(ValueError):
                coerce_exam_submission("GAMSAT", score_raw=score)

    def test_lsat_and_mcat_provider_boundaries(self):
        self.assertEqual(120, coerce_exam_submission("LSAT", score_raw=120)["score"])
        self.assertEqual(180, coerce_exam_submission("LSAT", score_raw=180)["score"])
        for score in (119, 181):
            with self.subTest(exam="LSAT", score=score), self.assertRaises(ValueError):
                coerce_exam_submission("LSAT", score_raw=score)

        components = [
            {"exam": "MCAT_BIOLOGICAL_BIOCHEMICAL", "score": 118},
            {"exam": "MCAT_CHEMICAL_PHYSICAL", "score": 132},
            {"exam": "MCAT_PSYCHOLOGICAL_SOCIAL", "score": 118},
            {"exam": "MCAT_CRITICAL_ANALYSIS", "score": 132},
        ]
        self.assertEqual(500, coerce_exam_submission("MCAT", details={"components": components})["score"])
        for invalid in (components[:3], components + [components[0]],
                        [{"exam": "MCAT_BIOLOGICAL_BIOCHEMICAL", "score": 117}, *components[1:]]):
            with self.subTest(components=invalid), self.assertRaises(ValueError):
                coerce_exam_submission("MCAT", details={"components": invalid})


if __name__ == "__main__":
    unittest.main()
