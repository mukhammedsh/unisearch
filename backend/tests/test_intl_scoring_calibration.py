import copy
import unittest

from app.services import universities as uni_service, admissions_catalog
from app.services.ai_scoring import estimate_uni_chance, _normalize_gpa_score


class TestIntlScoringCalibration(unittest.TestCase):
    def _ielts_report(self):
        return {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5,
                "details": {"components": [{"exam": "IELTS_" + part, "score": 7.5}
                                            for part in ("WRITING", "READING", "LISTENING", "SPEAKING")]}}

    def _alevel_report(self):
        return {"id": "A_LEVEL_CERT", "score": 16, "details": {"components": [
            {"exam": "A_LEVEL_MATHEMATICS", "score": 6}, {"exam": "A_LEVEL_PHYSICS", "score": 5}, {"exam": "A_LEVEL_CHEMISTRY", "score": 5}]}}

    @classmethod
    def setUpClass(cls):
        cls.stanford = uni_service.get_university_by_id("stanford-university-usa-ca")
        cls.imperial = uni_service.get_university_by_id("imperial-college-london-uk")
        cls.melbourne = uni_service.get_university_by_id("university-of-melbourne-au-melbourne")
        cls.tokyo = uni_service.get_university_by_id("university-of-tokyo-jp-tokyo")
        cls.toronto = uni_service.get_university_by_id("university-of-toronto-ca-toronto")

        assert cls.stanford is not None, "Stanford university fixture not found!"
        assert cls.imperial is not None, "Imperial College fixture not found!"
        assert cls.melbourne is not None, "Melbourne fixture not found!"
        assert cls.tokyo is not None, "Tokyo fixture not found!"
        assert cls.toronto is not None, "Toronto fixture not found!"

    def test_gpa_auto_normalization_scales(self):
        """Verify GPA normalization across 4.0 and 5.0 scales and rejection of percentage values (> 5.0)."""
        self.assertEqual(_normalize_gpa_score(4.0), 4.0)
        self.assertEqual(_normalize_gpa_score(3.8), 3.8)
        self.assertEqual(_normalize_gpa_score(3.0), 3.0)
        self.assertEqual(_normalize_gpa_score(5.0), 4.0)
        self.assertEqual(_normalize_gpa_score(4.8, scale=5), 3.84)
        self.assertEqual(_normalize_gpa_score(4.01), 3.21)
        self.assertEqual(_normalize_gpa_score(0), 0.0)
        # Percentages (> 5.0) and out-of-range values are rejected
        self.assertIsNone(_normalize_gpa_score(88.0))
        self.assertIsNone(_normalize_gpa_score(100.0))
        self.assertIsNone(_normalize_gpa_score(5.01))
        self.assertIsNone(_normalize_gpa_score(-0.5))

    def test_stanford_score_quartiles_do_not_change_requirements_fit(self):
        """Changing admitted-score distributions cannot change published-minimum fit."""
        profile = {
            "locale": "eng",
            "budget": 100000,
            "gpa": 3.9,
            "exams": [{"id": "SAT", "score": 1550}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
            "study_level": "undergraduate", "applicant_route": "first_year", "intended_entry_cycle": "Fall 2027",
            "selectedAdmissionChoices": {self.stanford["id"]: {
                "studyOptionId": "stanford-option-cs-bs", "applicationRouteId": "undergraduate-shared-evidence:stanford-first-year"}},
        }
        res = estimate_uni_chance(self.stanford, profile)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertIsNone(res.get("overallChance"))
        self.assertFalse(res.get("chanceAvailable"))
        self.assertEqual(res["context"]["application_route_id"], "undergraduate-shared-evidence:stanford-first-year")
        published = next(row for row in res["choices"][0]["details"]["checks"]
                         if row["factId"] == "undergraduate-shared-evidence:stanford-firstyear-standardized-tests")
        self.assertIn("no minimum score", published["sourceRule"]["value"])
        self.assertTrue(published["sourceIds"])
        no_distribution = copy.deepcopy(self.stanford)
        no_distribution["academics"]["score_profile"] = {"p25_normalized": 0, "median_normalized": 0, "p75_normalized": 100}
        changed_distribution = estimate_uni_chance(no_distribution, profile)
        self.assertEqual(res.get("overallChance"), changed_distribution.get("overallChance"))
        self.assertEqual(res["choices"][0]["details"]["checks"], changed_distribution["choices"][0]["details"]["checks"])

    def test_imperial_college_a_level_route_reports_published_requirements_fit(self):
        """Computing's subject-specific A-Level conditions cannot be reduced to an aggregate score."""
        profile = {
            "locale": "eng",
            "budget": 100000,
            "gpa": 3.9,
            "exams": [
                {"id": "A_LEVEL_CERT", "score": 18},
                {"id": "A_LEVEL_MATHEMATICS", "score": 6},
            ],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
            "study_level": "undergraduate", "applicant_route": "first_year", "intended_entry_cycle": "2027 entry",
            "selectedAdmissionChoices": {self.imperial["id"]: {
                "studyOptionId": "imperial-option-computing-meng", "applicationRouteId": "procedure-computing-meng"}},
        }
        res = estimate_uni_chance(self.imperial, profile)
        chance = res.get("overallChance")
        self.assertIsNone(chance)
        self.assertFalse(res["chanceAvailable"])
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertEqual(res["context"]["application_route_id"], "procedure-computing-meng")
        checks = [row for row in res["choices"][0]["details"]["checks"]
                  if row["factId"] == "imperial-computing-meng-admission"]
        academic = next(row for row in checks if row["kind"] == "remaining_conditions")
        original = next(row for row in admissions_catalog.get_institution(self.imperial["id"])["facts"] if row["id"] == academic["factId"])
        self.assertEqual(academic["sourceRule"]["value"], original["value"])
        self.assertEqual(academic["status"], "unassessed")
        self.assertTrue(academic["sourceIds"])
        tmua = next(row for row in checks if row.get("checkId") == "required-tmua")
        self.assertEqual(tmua["status"], "missing")
        self.assertTrue(any(row.get("checkId") == "required-tmua"
                            for row in res["choices"][0]["missingEvidence"]))
        panels = " ".join(academic["sourceRule"]["value"]["A_level_rules_by_option_panel"])
        self.assertIn("A* in Mathematics", panels)
        self.assertIn("Further Mathematics preferred", panels)
        profile["exams"].append({"id": "TMUA", "score": 6})
        with_tmua = estimate_uni_chance(self.imperial, profile)
        provided = next(row for row in with_tmua["choices"][0]["details"]["checks"]
                        if row.get("checkId") == "required-tmua")
        self.assertEqual(provided["status"], "met")
        self.assertIsNone(provided["minimum"])
        self.assertIsNone(with_tmua["overallChance"])

    def test_melbourne_ib_diploma_route_reports_published_requirements_fit(self):
        profile = {
            "locale": "eng",
            "budget": 60000,
            "gpa": 3.8,
            "exams": [{"id": "IB_Diploma", "score": 38, "details": {"components": []}}],
            "languages": [self._ielts_report()],
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.melbourne, profile)
        chance = res.get("overallChance")
        self.assertIsNotNone(chance)
        self.assertEqual(100, chance)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertEqual(res.get("bestChoiceLabel"), "IB Diploma")

    def test_tokyo_peak_a_level_route_reports_published_requirements_fit(self):
        profile = {
            "locale": "eng",
            "budget": 40000,
            "gpa": 3.8,
            "exams": [self._alevel_report()],
            "languages": [self._ielts_report()],
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.tokyo, profile)
        chance = res.get("overallChance")
        self.assertIsNotNone(chance)
        self.assertEqual(100, chance)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")

    def test_toronto_a_level_route_reports_published_requirements_fit(self):
        profile = {
            "locale": "eng",
            "budget": 60000,
            "gpa": 3.8,
            "exams": [self._alevel_report()],
            "languages": [self._ielts_report()],
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.toronto, profile)
        chance = res.get("overallChance")
        self.assertIsNotNone(chance)
        self.assertEqual(100, chance)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")


if __name__ == "__main__":
    unittest.main()
