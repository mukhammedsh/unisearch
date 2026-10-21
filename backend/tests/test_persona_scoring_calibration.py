import unittest

from app.services import universities as uni_service
from app.services.ai_scoring import estimate_uni_chance, sort_universities_ai


class TestPersonaScoringCalibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mit = uni_service.get_university_by_id("mit-usa-cambridge")
        cls.tum = uni_service.get_university_by_id("technical-university-of-munich-de-munich")
        cls.nu = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")

        # Verify that all benchmark university fixtures loaded
        assert cls.mit is not None, "MIT university fixture not found!"
        assert cls.tum is not None, "TUM university fixture not found!"
        assert cls.nu is not None, "Nazarbayev University fixture not found!"

    def _assert_fit_contract(self, result):
        self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))
        score = result.get("overallChance")
        if score is None:
            self.assertFalse(result.get("chanceAvailable"))
            self.assertIn(result.get("reason"), {"missing_evidence", "no_published_requirements", "no_choices"})
        else:
            self.assertTrue(result.get("chanceAvailable"))
            self.assertTrue(0 <= float(score) <= 100)

    def _assert_unselected_reviewed_fit(self, result, profile):
        self.assertEqual(result["scoreMeaning"], "published_requirements_met_percent")
        self.assertEqual(result["reason"], "applicability_unknown")
        self.assertIsNone(result["overallChance"])
        self.assertFalse(result["chanceAvailable"])
        self.assertIsNone(result["context"]["study_option_id"])
        self.assertIsNone(result["context"]["application_route_id"])
        self.assertEqual(result["choices"][0]["details"]["checks"], [])
        self.assertTrue(result["catalogRevision"])
        match = sort_universities_ai([self.mit], profile)[0]["matchData"]
        self.assertIsNone(match["requirementsGap"])
        self.assertIsNone(match["finalPriceUSD"])
        self.assertFalse(match["selectedByUser"])
        self.assertEqual("published_reference", match["costMode"])
        self.assertEqual("dated_reference", match["budgetAssessment"]["evidence"])
        self.assertIn("undergraduate-budget-2026-27", match["costQuote"]["fact_ids"])
        if profile.get("budget", 0) > 0:
            self.assertEqual("unknown_cost", match["budgetStatus"])
            reference_cost = match["costQuote"]["minUSD"]
            expected_gap = max(0.0, 1.0 - profile["budget"] / reference_cost)
            self.assertAlmostEqual(expected_gap, match["affordabilityGap"])
            self.assertEqual("over_budget" if reference_cost > profile["budget"] else "within_budget",
                             match["budgetAssessment"]["status"])
            self.assertAlmostEqual((0.60 * match["preferenceMismatch"] + 0.20 * expected_gap) / 0.80,
                                   match["finalScore"])
        else:
            self.assertIsNone(match["affordabilityGap"])
            self.assertAlmostEqual(match["finalScore"], match["preferenceMismatch"])

    def test_alexey_german_budget_persona(self):
        """
        Alexey: GPA 3.40, no SAT, IELTS 6.5, budget $10,000.
        TUM and NU retain their published-check behavior.
        MIT requires a reviewed selection before assessing the applicant.
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 10000,
            "gpa": 3.40,
            "exams": [],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT has no selected option or route.
        res_mit = estimate_uni_chance(self.mit, profile)
        self._assert_unselected_reviewed_fit(res_mit, profile)
        self.assertIsNone(res_mit.get("overallChance"))

        # 2. TUM (meets requirements)
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU (requires SAT)
        res_nu = estimate_uni_chance(self.nu, profile)
        self._assert_fit_contract(res_nu)

    def test_maria_top_ivy_persona(self):
        """
        Maria: GPA 3.92, SAT 1560, IELTS 8.0, budget $100,000.
        Requirements-fit percentages depend only on published minimum checks.
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 100000,
            "gpa": 3.92,
            "exams": [
                {"id": "SAT", "score": 1560}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self._assert_unselected_reviewed_fit(res_mit, profile)
        self.assertIsNone(chance_mit)

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        self._assert_fit_contract(res_nu)

    def test_dias_average_kazakh_persona(self):
        """
        Dias: GPA 3.28, SAT 1350, IELTS 6.0, budget $15,000.
        MIT remains unresolved without a selected route.
        NU can compare the provided language score against its published minimum.
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 15000,
            "gpa": 3.28,
            "exams": [
                {"id": "SAT", "score": 1350}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.0}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        self._assert_unselected_reviewed_fit(res_mit, profile)

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU: IELTS evidence is present but below its published minimum,
        # so that verified unmet check contributes to the fit percentage.
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self._assert_fit_contract(res_nu)
        self.assertIsNotNone(chance_nu)

    def test_adil_zero_budget_genius(self):
        """
        Adil: GPA 3.80, SAT 1550, IELTS 7.5, budget $0.
        Has high scores but zero budget.
        Published-requirements fit is independent of budget and funding route.
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 0,
            "gpa": 3.80,
            "exams": [
                {"id": "SAT", "score": 1550}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT has admitted-score distributions but no published first-year minimum thresholds.
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self._assert_unselected_reviewed_fit(res_mit, profile)
        self.assertIsNone(chance_mit)

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU does not infer an awarded grant from a zero budget.
        res_nu = estimate_uni_chance(self.nu, profile)
        self._assert_fit_contract(res_nu)

    def test_lisa_borderline_ielts(self):
        """
        Lisa: GPA 3.60, SAT 1480, IELTS 6.5, budget $50,000.
        MIT requires an SAT or ACT score and recommends English proficiency
        evidence for some applicants. Its published IELTS minimum is 7,
        not 7.5, and the recommendation cannot be applied to every applicant.
        Passes at TUM (IELTS 6.5 >= 6.5) and NU (IELTS 6.5 >= 6.5).
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 50000,
            "gpa": 3.60,
            "exams": [
                {"id": "SAT", "score": 1480}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT does not apply first-year policies without the selected context.
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self._assert_unselected_reviewed_fit(res_mit, profile)
        self.assertIsNone(chance_mit)

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        self._assert_fit_contract(res_nu)

    def test_anonymous_empty_profile(self):
        """
        Anonymous empty profile: GPA 0, no exams, no languages, $0 budget.
        Must not cause backend errors or fabricate fit from missing evidence.
        """
        profile = {
            "locale": "eng",
            "studyLevel": "bachelor",
            "budget": 0,
            "gpa": 0,
            "exams": [],
            "languages": [],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        self._assert_unselected_reviewed_fit(res_mit, profile)
        self.assertIsNone(res_mit.get("overallChance"))

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        self._assert_fit_contract(res_tum)

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        self._assert_fit_contract(res_nu)

    def test_mit_internal_bcs_verified_failures_are_zero_and_missing_evidence_is_unknown(self):
        profile = {
            "selectedAdmissionChoices": {self.mit["id"]: {
                "studyOptionId": "mit-course-6-9p-meng",
                "applicationRouteId": "mit_bcs_meng_admissions",
                "studyLevel": "masters",
                "applicantRoute": "graduate",
                "intendedEntryCycle": "2027 entry",
                "feeStatusContext": "unknown",
            }},
            "institutional_evidence": [
                {"kind": "enrollment", "university_id": self.mit["id"], "program_id": "mit-bs-6-9",
                 "status": "enrolled", "major_units": 101, "completed_major_subjects": 8},
                {"kind": "gpa", "university_id": self.mit["id"], "program_id": "mit-bs-6-9",
                 "metric": "technical", "value": 4.24, "scale": 5},
                {"kind": "gpa", "university_id": self.mit["id"], "program_id": "mit-bs-6-9",
                 "metric": "overall", "value": 3.99, "scale": 5},
            ],
        }
        result = estimate_uni_chance(self.mit, profile)
        self.assertEqual(result["overallChance"], 0)
        self.assertTrue(result["chanceAvailable"])
        self.assertEqual(result["reason"], "requirements_not_met")
        measurable = [row for row in result["choices"][0]["details"]["checks"] if row.get("measurable")]
        self.assertEqual({row["checkId"] for row in measurable}, {"technical-gpa", "overall-gpa", "major-subject-units"})
        self.assertTrue(all(row["status"] == "unmet" and row["sourceIds"] for row in measurable))
        self.assertTrue(all(row["sourceRule"]["value"] for row in measurable))
        profile["institutional_evidence"].pop()
        incomplete = estimate_uni_chance(self.mit, profile)
        self.assertIsNone(incomplete["overallChance"])
        self.assertFalse(incomplete["chanceAvailable"])
        self.assertEqual(incomplete["reason"], "missing_evidence")
        self.assertTrue(any(row.get("checkId") == "overall-gpa"
                            for row in incomplete["choices"][0]["missingEvidence"]))


if __name__ == "__main__":
    unittest.main()
