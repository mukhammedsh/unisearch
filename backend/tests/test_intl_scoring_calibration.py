import copy
import unittest

from app.services import universities as uni_service
from app.services.ai_scoring import estimate_uni_chance, _normalize_gpa_score


class TestIntlScoringCalibration(unittest.TestCase):
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
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.stanford, profile)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertIsNotNone(res.get("overallChance"))
        self.assertTrue(res.get("chanceAvailable"))
        no_distribution = copy.deepcopy(self.stanford)
        for category in no_distribution.get("admission_categories", []):
            for track in category.get("requirement_profiles", []):
                if isinstance(track.get("score_profile"), dict):
                    track["score_profile"].update({"p25_normalized": 0, "median_normalized": 0, "p75_normalized": 100})
        changed_distribution = estimate_uni_chance(no_distribution, profile)
        self.assertEqual(res.get("overallChance"), changed_distribution.get("overallChance"))

    def test_imperial_college_a_level_route_reports_published_requirements_fit(self):
        """A-Level minimum checks are reported as met requirements, not admission odds."""
        profile = {
            "locale": "eng",
            "budget": 100000,
            "gpa": 3.9,
            "exams": [
                {"id": "A_LEVEL_CERT", "score": 18},
                {"id": "A_LEVEL_MATHEMATICS", "score": 6},
            ],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.imperial, profile)
        chance = res.get("overallChance")
        self.assertIsNotNone(chance)
        self.assertEqual(100, chance)
        self.assertEqual("published_requirements_met_percent", res.get("scoreMeaning"))
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")

    def test_melbourne_ib_diploma_route_reports_published_requirements_fit(self):
        profile = {
            "locale": "eng",
            "budget": 60000,
            "gpa": 3.8,
            "exams": [{"id": "IB_Diploma", "score": 38}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}],
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
            "exams": [{"id": "A_LEVEL_CERT", "score": 16}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}],
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
            "exams": [{"id": "A_LEVEL_CERT", "score": 16}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}],
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
