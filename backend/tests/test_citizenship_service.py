import unittest
from app.services.citizenship import resolve_citizenship_status
from app.services.ai_scoring import estimate_uni_chance, _normalize_study_level_str


class CitizenshipServiceTests(unittest.TestCase):
    def test_us_nationality_is_not_treated_as_proof_of_fee_or_aid_eligibility(self):
        res = resolve_citizenship_status("USA", ["KZ", "US"])
        self.assertEqual(res["status"], "unknown")
        self.assertEqual(res["fee_category"], "unknown")
        self.assertTrue(res["citizenship_matches_country"])
        self.assertIsNone(res["federal_aid_eligible"])

    def test_uk_nationality_is_not_treated_as_proof_of_home_fee_status(self):
        res = resolve_citizenship_status("United Kingdom", ["KZ", "GB"])
        self.assertEqual(res["status"], "unknown")
        self.assertEqual(res["fee_category"], "unknown")
        self.assertTrue(res["citizenship_matches_country"])
        self.assertIsNone(res["student_finance_eligible"])

    def test_other_nationality_does_not_prove_us_immigration_status(self):
        res = resolve_citizenship_status("USA", ["KZ"])
        self.assertEqual(res["status"], "unknown")
        self.assertFalse(res["citizenship_matches_country"])
        self.assertIsNone(res["federal_aid_eligible"])

    def test_university_in_another_country_is_unknown(self):
        res = resolve_citizenship_status("Switzerland", ["KZ"])
        self.assertEqual(res["status"], "unknown")
        self.assertIsNone(res["citizenship_matches_country"])

    def test_estimate_reads_country_from_normalized_university_location(self):
        result = estimate_uni_chance(
            {"id": "test-us-country-nested", "location": {"country": "USA"}, "admission_categories": []},
            {"citizenship": "US"},
        )
        self.assertTrue(result["citizenshipStatus"]["citizenship_matches_country"])

    def test_mba_keeps_distinct_admission_level(self):
        self.assertEqual("mba", _normalize_study_level_str("MBA"))


if __name__ == "__main__":
    unittest.main()
