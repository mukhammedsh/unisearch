import unittest
from app.services import ai_scoring, universities as uni_service


class KazakhstanUntScoringTests(unittest.TestCase):
    KZ_UNIVERSITIES = [
        "kazakhstan-british-technical-university-kaz-almaty",
        "astana-it-university-kaz-astana",
        "international-information-technology-university-kaz-almaty",
        "suleyman-demirel-university-kaz-kaskelen",
        "al-farabi-kazakh-national-university-kaz-almaty",
        "l-n-gumilyov-eurasian-national-university-kaz-astana",
        "satbayev-university-kaz-almaty",
        "asfendiyarov-kazakh-national-medical-university-kaz-almaty",
        "astana-medical-university-kaz-astana",
        "abai-kazakh-national-pedagogical-university-kaz-almaty",
        "kimep-university-kaz-almaty",
        "narxoz-university-kaz-almaty",
    ]

    def test_all_12_kz_universities_have_valid_unt_score_profiles(self):
        for uid in self.KZ_UNIVERSITIES:
            u = uni_service.get_university_by_id(uid)
            self.assertIsNotNone(u, f"University {uid} not found")
            cats = u.get("admission_categories") or []
            self.assertTrue(bool(cats), f"No admission categories for {uid}")
            profiles = cats[0].get("requirement_profiles") or []
            self.assertTrue(bool(profiles), f"No requirement profiles for {uid}")
            sp = profiles[0].get("score_profile")
            self.assertIsInstance(sp, dict, f"Missing score_profile for {uid}")
            self.assertEqual("UNT", sp.get("exam_id"))
            self.assertIn("UNT", sp.get("compatible_exam_ids", []))
            self.assertIn("ENT", sp.get("compatible_exam_ids", []))
            self.assertGreater(sp.get("p75_raw", 0), sp.get("median_raw", 0))
            self.assertGreater(sp.get("median_raw", 0), sp.get("p25_raw", 0))
            self.assertGreater(sp.get("p75_normalized", 0), sp.get("median_normalized", 0))
            self.assertGreater(sp.get("median_normalized", 0), sp.get("p25_normalized", 0))

    def test_requirements_fit_does_not_turn_score_profiles_into_admission_chances(self):
        for exam_key in ("UNT", "ENT"):
            for uid in self.KZ_UNIVERSITIES:
                u = uni_service.get_university_by_id(uid)
                profile = {
                    "exams": [{"id": exam_key, "score": 125}],
                    "languages": [
                        {"code": "ru", "kind": "native"},
                        {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5},
                        {"code": "en", "kind": "cefr", "level": 5},
                    ],
                }
                result = ai_scoring.estimate_uni_chance(u, profile)
                self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))
                self.assertNotEqual("official_score_profile", result.get("chanceModel"))
                fit = result.get("overallChance")
                if fit is None:
                    self.assertEqual("missing_evidence", result.get("reason"))
                else:
                    self.assertGreaterEqual(fit, 0)
                    self.assertLessEqual(fit, 100)

    def test_unt_chances_are_monotonic_with_respect_to_scores(self):
        scores = [65, 85, 105, 115, 125, 135]
        for uid in self.KZ_UNIVERSITIES:
            u = uni_service.get_university_by_id(uid)
            prev_fit = -1
            for s in scores:
                profile = {
                    "exams": [{"id": "UNT", "score": s}],
                    "languages": [{"code": "ru", "kind": "native"}],
                }
                result = ai_scoring.estimate_uni_chance(u, profile)
                fit = result.get("overallChance")
                if fit is not None:
                    self.assertGreaterEqual(
                        fit,
                        prev_fit,
                        f"Non-monotonic requirements fit for {uid}: UNT {s} gave {fit} < {prev_fit}",
                    )
                    prev_fit = fit

    def test_admitted_score_distributions_do_not_create_grant_cutoffs(self):
        kaznmu = uni_service.get_university_by_id("asfendiyarov-kazakh-national-medical-university-kaz-almaty")
        abai = uni_service.get_university_by_id("abai-kazakh-national-pedagogical-university-kaz-almaty")
        
        # Both published UNT minimums are met; historical score distributions are separate facts.
        profile_115 = {
            "exams": [{"id": "UNT", "score": 115}],
            "languages": [{"code": "ru", "kind": "native"}],
        }
        res_med = ai_scoring.estimate_uni_chance(kaznmu, profile_115)
        res_ped = ai_scoring.estimate_uni_chance(abai, profile_115)
        
        self.assertEqual(100, res_med.get("overallChance"))
        self.assertEqual(100, res_ped.get("overallChance"))
        self.assertGreater(
            kaznmu["admission_categories"][0]["requirement_profiles"][0]["score_profile"]["p25_raw"],
            abai["admission_categories"][0]["requirement_profiles"][0]["score_profile"]["p25_raw"],
        )


if __name__ == "__main__":
    unittest.main()
