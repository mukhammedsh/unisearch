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

    def test_stanford_uses_official_score_profile(self):
        """Verify Stanford with SAT 1550 and GPA 3.9/4.0 uses official_score_profile and yields ~50% chance."""
        profile = {
            "locale": "eng",
            "budget": 100000,
            "gpa": 3.9,
            "exams": [{"id": "SAT", "score": 1550}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
            "selectedAdmissionChoices": {},
        }
        res = estimate_uni_chance(self.stanford, profile)
        self.assertEqual(res.get("chanceModel"), "official_score_profile")
        chance = res.get("overallChance")
        self.assertIsNotNone(chance)
        self.assertTrue(45 <= chance <= 58, f"Stanford chance expected between 45-58%, got {chance}%")

    def test_imperial_college_a_level_route(self):
        """Verify Imperial College London evaluates top A-Level applicants with high realistic chance."""
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
        self.assertTrue(70 <= chance <= 90, f"Imperial A-Level chance expected between 70-90%, got {chance}%")
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")

    def test_melbourne_ib_diploma_route(self):
        """Verify University of Melbourne evaluates competitive IB applicants with high realistic chance."""
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
        self.assertTrue(70 <= chance <= 90, f"Melbourne IB chance expected between 70-90%, got {chance}%")
        self.assertEqual(res.get("bestChoiceLabel"), "IB Diploma")

    def test_tokyo_peak_a_level_route(self):
        """Verify UTokyo PEAK evaluates competitive A-Level applicants with high realistic chance."""
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
        self.assertTrue(65 <= chance <= 85, f"Tokyo A-Level chance expected between 65-85%, got {chance}%")
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")

    def test_toronto_a_level_route(self):
        """Verify University of Toronto evaluates competitive A-Level applicants with high realistic chance."""
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
        self.assertTrue(75 <= chance <= 95, f"Toronto A-Level chance expected between 75-95%, got {chance}%")
        self.assertEqual(res.get("bestChoiceLabel"), "A-Level")


if __name__ == "__main__":
    unittest.main()
