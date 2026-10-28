import unittest

from app.services.ai_scoring import _build_user_context, estimate_uni_chance
from app.schemas.payloads import ProfilePayload
from app.schemas.admissions import AdmissionContextInput
from app.services.exams import coerce_exam_submission
from app.services.admissions_assessment import _check_evidence, _submitted_exams


class NuEvidenceRegressionTests(unittest.TestCase):
    def _university(self):
        return {
            "id": "nu-validation-u",
            "admission_categories": [{
                "id": "entry",
                "requirement_profiles": [{
                    "id": "general",
                    "requirements": {"NUET": 120},
                    "language_requirements": [{
                        "code": "en",
                        "requirements": {
                            "IELTS": 6.0, "IELTS_WRITING": 6.0,
                            "IELTS_LISTENING": 5.5, "IELTS_READING": 5.5,
                            "IELTS_SPEAKING": 5.5, "TOEFL_iBT_0_120": 79,
                        },
                    }],
                }],
            }],
        }

    def _profile(self, *, overall=6.5, writing=6.0):
        return {
            "exams": [{"id": "NUET", "score": 120}],
            "languages": [{
                "code": "en", "kind": "exam", "exam": "IELTS", "score": overall,
                "details": {"components": [
                    {"exam": "IELTS_WRITING", "score": writing},
                    {"exam": "IELTS_READING", "score": 5.5},
                    {"exam": "IELTS_LISTENING", "score": 5.5},
                    {"exam": "IELTS_SPEAKING", "score": 5.5},
                ]},
            }],
        }

    def test_language_overall_and_sections_are_conjunctive(self):
        for overall, writing in ((5.5, 6.0), (6.5, 5.5)):
            with self.subTest(overall=overall, writing=writing):
                result = estimate_uni_chance(self._university(), self._profile(overall=overall, writing=writing))
                self.assertEqual(50, result["overallChance"])

    def test_missing_required_language_section_stays_missing(self):
        profile = self._profile()
        profile["languages"][0].pop("details")
        result = estimate_uni_chance(self._university(), profile)
        self.assertIsNone(result["overallChance"])
        self.assertTrue(result["missingEvidence"])

    def test_another_complete_language_exam_is_an_alternative(self):
        profile = self._profile(writing=5.0)
        profile["languages"].append({"code": "en", "kind": "exam", "exam": "TOEFL_iBT_0_120", "score": 90})
        self.assertEqual(100, estimate_uni_chance(self._university(), profile)["overallChance"])

    def test_rejected_academic_or_language_scores_do_not_reenter_context(self):
        profile = {
            "exams": [{"id": "NUET", "score": 999}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 99}],
        }
        context = _build_user_context(profile, {})
        self.assertNotIn("NUET", context["userScores"])
        self.assertNotIn("IELTS", context["userScores"])

    def test_valid_saved_sat_total_is_preserved_without_invented_sections(self):
        context = _build_user_context({"exams": [{"id": "SAT", "score": 1400}]}, {})
        self.assertEqual(1400, context["userScores"]["SAT"])
        self.assertNotIn("SAT_MATH", context["userScores"])

    def test_profile_trust_boundary_uses_exam_and_language_validators(self):
        for payload in (
            {"exams": [{"id": "NUET", "score": 999}]},
            {"exams": [{"id": "UNKNOWN_EXAM", "score": 100}]},
            {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 10}]},
            {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7,
                            "details": {"components": [{"exam": "IELTS_WRITING", "score": 10}]}}]},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                ProfilePayload.model_validate(payload)
        valid = ProfilePayload.model_validate({"exams": [{"id": "SAT", "score": 1400}],
                                               "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7}]})
        self.assertEqual(1400, valid.exams[0].score)

    def test_profile_rejects_conflicting_exam_identifiers(self):
        with self.assertRaises(ValueError):
            ProfilePayload.model_validate({"exams": [{"id": "NUET", "exam": "SAT", "score": 120}]})
        with self.assertRaises(ValueError):
            ProfilePayload(gpa=4.5, gpa_scale=4)

    def test_real_preparation_residency_and_nondegree_levels_are_distinct(self):
        for level in ("preparation", "residency", "non_degree", "professional"):
            self.assertEqual(level, AdmissionContextInput(study_level=level).study_level)
        self.assertEqual("preparation", AdmissionContextInput(study_level="foundation").study_level)
        for level in ("masters", "doctoral", "professional", "residency"):
            with self.subTest(level=level), self.assertRaises(ValueError):
                ProfilePayload(study_level=level, applicant_route="first_year")

    def test_nuet_preserves_known_sections_and_old_total_only(self):
        old = coerce_exam_submission("NUET", score_raw=120)
        self.assertEqual(120, old["score"])
        self.assertEqual([], old["details"]["components"])
        partial = coerce_exam_submission("NUET", score_raw=120, details={"components": [
            {"exam": "NUET_MATH", "score": 70},
        ]})
        self.assertEqual(1, partial["details"]["component_count"])
        complete = coerce_exam_submission("NUET", details={"components": [
            {"exam": "NUET_MATH", "score": 70},
            {"exam": "NUET_CRITICAL_THINKING", "score": 50},
        ]})
        self.assertEqual(120, complete["score"])

    def test_nuet_rejects_invalid_or_inconsistent_reports(self):
        for total, components in (
            (999, []),
            (120, [{"exam": "NUET_MATH", "score": 121}]),
            (120, [{"exam": "NUET_MATH", "score": 80}, {"exam": "NUET_CRITICAL_THINKING", "score": 60}]),
            (240, [{"exam": "NUET_MATH", "score": 50}]),
        ):
            with self.subTest(total=total, components=components), self.assertRaises(ValueError):
                coerce_exam_submission("NUET", score_raw=total, details={"components": components})

    def test_nat_keeps_independent_section_results_without_inventing_total(self):
        result = coerce_exam_submission("NURSING_NAT", details={"components": [
            {"exam": "NAT_KNOWLEDGE", "score": 90},
            {"exam": "NAT_CLINICAL_SKILLS", "score": 69},
        ]})
        self.assertNotIn("score", result)
        self.assertEqual([90, 69], [row["score"] for row in result["details"]["components"]])

    def test_residency_reports_record_presence_and_false_is_missing(self):
        result = _submitted_exams({"exams": [{"id": "IFOM_BSE", "score": 0}, {"id": "USMLE_STEP_1", "score": 1}]})
        self.assertEqual(["USMLE_STEP_1"], [row["exam"] for row in result])
        context = _build_user_context({"exams": [{"id": "IFOM_BSE", "score": 0}]}, {})
        self.assertNotIn("IFOM_BSE", context["validExamIds"])

    def test_profile_flag_values_survive_numeric_round_trip(self):
        for ident in ("IFOM_BSE", "USMLE_STEP_1"):
            for value in (0, 0.0, 1, 1.0):
                with self.subTest(exam=ident, value=value):
                    payload = ProfilePayload(gpa=4.85, gpa_scale=5, exams=[{"id": ident, "exam": ident, "score": value, "taken_on": "2026-03-01"}])
                    restored = ProfilePayload.model_validate_json(payload.model_dump_json()).model_dump()
                    self.assertEqual(int(value), coerce_exam_submission(ident, score_raw=restored["exams"][0]["score"])["score"])
                    self.assertEqual(bool(value), bool(_submitted_exams(restored)))
            for invalid in (-1, 0.5, 2, float("nan"), float("inf")):
                with self.subTest(exam=ident, invalid=invalid), self.assertRaises(ValueError):
                    ProfilePayload(exams=[{"id": ident, "score": invalid}])

    def test_aleks_score_scale_is_not_an_admission_cutoff(self):
        self.assertEqual(1, coerce_exam_submission("ALEKS", score_raw=1)["score"])
        self.assertEqual(100, coerce_exam_submission("ALEKS", score_raw=100)["score"])
        with self.assertRaises(ValueError):
            coerce_exam_submission("ALEKS", score_raw=101)

    def test_reviewed_nuet_checks_total_and_sections_with_academic_alternatives(self):
        rule = {"kind": "academic_requirement", "alternatives": [
            {"exam_id": "NUET", "minimum": 120, "component_minimums": {"NUET_MATH": 50, "NUET_CRITICAL_THINKING": 50}},
            {"exam_id": "SAT", "minimum": 1240},
        ]}
        for total, math_score, thinking, expected in ((120, 70, 50, "met"), (140, 100, 40, "unmet")):
            submissions = _submitted_exams({"exams": [{"id": "NUET", "score": total, "details": {"components": [
                {"exam": "NUET_MATH", "score": math_score}, {"exam": "NUET_CRITICAL_THINKING", "score": thinking},
            ]}}]})
            status, provided, measurable = _check_evidence(rule, {}, submissions)
            self.assertEqual(expected, status)
            self.assertTrue(measurable)
            self.assertEqual(3, len(provided["minimum_checks"]))
        partial = _submitted_exams({"exams": [{"id": "NUET", "score": 120}]})
        self.assertEqual("missing", _check_evidence(rule, {}, partial)[0])
        partial.extend(_submitted_exams({"exams": [{"id": "SAT", "score": 1300}]}))
        self.assertEqual("met", _check_evidence(rule, {}, partial)[0])

    def test_reviewed_language_checks_do_not_superscore_or_swap_total_and_bands(self):
        rule = {"kind": "language_requirement", "alternatives": [
            {"exam_id": "IELTS", "minimum": 6, "component_minimums": {"IELTS_WRITING": 6}},
            {"exam_id": "TOEFL_iBT_0_120", "minimum": 79},
        ]}
        profile = {"languages": [
            {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5,
             "details": {"components": [{"exam": "IELTS_WRITING", "score": 5.5}]}},
            {"code": "en", "kind": "exam", "exam": "IELTS", "score": 5.5,
             "details": {"components": [{"exam": "IELTS_WRITING", "score": 6.5}]}},
        ]}
        self.assertEqual("unmet", _check_evidence(rule, profile, _submitted_exams(profile))[0])
        profile["languages"].append({"code": "en", "kind": "exam", "exam": "TOEFL_iBT_0_120", "score": 90})
        self.assertEqual("met", _check_evidence(rule, profile, _submitted_exams(profile))[0])
        profile = {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7}]}
        self.assertEqual("missing", _check_evidence(rule, profile, _submitted_exams(profile))[0])

    def test_reviewed_gpa_requires_matching_scale_and_does_not_become_mandatory_with_sat(self):
        rule = {"kind": "academic_requirement", "alternatives": [
            {"profile_field": "gpa", "minimum": 4.0, "scale": 5.0}, {"exam_id": "SAT", "minimum": 1240},
        ]}
        self.assertEqual("missing", _check_evidence(rule, {}, [])[0])
        self.assertEqual("unassessed", _check_evidence(rule, {"gpa": 3.8, "gpa_scale": 4}, [])[0])
        self.assertEqual("met", _check_evidence(rule, {"gpa": 4.2, "gpa_scale": 5}, [])[0])
        self.assertEqual("unmet", _check_evidence(rule, {"gpa": 3.9, "gpa_scale": 5}, [])[0])
        submissions = _submitted_exams({"exams": [{"id": "SAT", "score": 1300}]})
        self.assertEqual("met", _check_evidence(rule, {}, submissions)[0])

    def test_reviewed_grade_groups_require_each_of_three_qualifying_grades(self):
        rule = {"kind": "academic_requirement", "alternatives": [
            {"exam_id": "A_LEVEL_CERT", "components_at_least": {"count": 3, "minimum": 4}},
        ]}
        ids = ("A_LEVEL_MATHEMATICS", "A_LEVEL_PHYSICS", "A_LEVEL_CHEMISTRY")
        for grades, expected in ((("B", "B", "B"), "met"), (("A*", "C", "C"), "unmet")):
            submissions = _submitted_exams({"exams": [{"id": "A_LEVEL_CERT", "details": {"components": [
                {"exam": exam, "raw_value": grade} for exam, grade in zip(ids, grades)
            ]}}]})
            self.assertEqual(expected, _check_evidence(rule, {}, submissions)[0])

    def test_reviewed_ib_and_nat_do_not_replace_component_minima_with_total(self):
        rule = {"kind": "academic_requirement", "alternatives": [
            {"exam_id": "IB_Diploma", "minimum": 27, "components_at_least": {"count": 3, "minimum": 4}},
        ]}
        for scores, expected in (((4, 4), "missing"), ((4, 4, 3), "unmet"), ((4, 4, 4), "met")):
            ids = ("IB_MATHEMATICS_HL", "IB_PHYSICS_HL", "IB_CHEMISTRY_HL")
            evidence = _submitted_exams({"exams": [{"id": "IB_Diploma", "score": 30, "details": {"components": [
                {"exam": exam, "score": score} for exam, score in zip(ids, scores)
            ]}}]})
            self.assertEqual(expected, _check_evidence(rule, {}, evidence)[0])
        rule = {"kind": "academic_requirement", "alternatives": [
            {"exam_id": "NURSING_NAT", "component_minimums": {"NAT_KNOWLEDGE": 70, "NAT_CLINICAL_SKILLS": 70}},
        ]}
        evidence = _submitted_exams({"exams": [{"id": "NURSING_NAT", "details": {"components": [
            {"exam": "NAT_KNOWLEDGE", "score": 90}, {"exam": "NAT_CLINICAL_SKILLS", "score": 69},
        ]}}]})
        self.assertEqual("unmet", _check_evidence(rule, {}, evidence)[0])


if __name__ == "__main__":
    unittest.main()
