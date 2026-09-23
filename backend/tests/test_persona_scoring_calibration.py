import unittest

from app.services import universities as uni_service
from app.services.ai_scoring import estimate_uni_chance


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

    def test_alexey_german_budget_persona(self):
        """
        Alexey: GPA 3.40, no SAT, IELTS 6.5, budget $10,000.
        Should qualify for TUM (Germany) with medium chance,
        but be filtered out at MIT and NU due to missing SAT.
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

        # 1. MIT (requires SAT)
        res_mit = estimate_uni_chance(self.mit, profile)
        # No SAT/ACT means no official MIT score profile applies; any numeric result is a low-confidence fallback.
        self.assertEqual("estimated_fallback", res_mit.get("chanceModel"))
        self.assertEqual("low", res_mit.get("confidence"))
        self.assertFalse(any(row.get("chanceModel") == "official_score_profile" for row in res_mit.get("choices", [])))

        # 2. TUM (meets requirements)
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(50 <= chance_tum <= 75, f"Alexey in TUM should be in 50-75% range, got {chance_tum}%")

        # 3. NU (requires SAT)
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertTrue(chance_nu is None or chance_nu == 0, f"Alexey in NU should have 0% or None chance, got {chance_nu}%")

    def test_maria_top_ivy_persona(self):
        """
        Maria: GPA 3.92, SAT 1560, IELTS 8.0, budget $100,000.
        Should have strong chances across all universities, but MIT chance
        must remain realistic (not 100%) due to low acceptance rate.
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
        self.assertIsNotNone(chance_mit)
        self.assertTrue(40 <= chance_mit <= 65, f"Maria in MIT should be in 40-65% range, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(chance_tum >= 85, f"Maria in TUM should have >=85% chance, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(55 <= chance_nu <= 80, f"Maria in NU should be in 55-80% range, got {chance_nu}%")

    def test_dias_average_kazakh_persona(self):
        """
        Dias: GPA 3.28, SAT 1350, IELTS 6.0, budget $15,000.
        Does not meet strict language or score thresholds for MIT and TUM.
        At NU, fails published minimum requirements.
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
        chance_mit = res_mit.get("overallChance")
        self.assertTrue(chance_mit is None or chance_mit == 0, f"Dias in MIT should have 0% or None chance, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertTrue(chance_tum is None or chance_tum == 0, f"Dias in TUM should have 0% or None chance, got {chance_tum}%")

        # 3. NU: the published IELTS minimum is not met, so UniChance must
        # remain unavailable rather than presenting a fabricated 0% estimate.
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNone(chance_nu)
        self.assertFalse(bool(res_nu.get("chanceAvailable")))
        self.assertEqual("requirements_not_met", str(res_nu.get("reason") or ""))

    def test_adil_zero_budget_genius(self):
        """
        Adil: GPA 3.80, SAT 1550, IELTS 7.5, budget $0.
        Has high scores but zero budget.
        MIT's admission estimate is based on academic evidence and remains independent of budget.
        At TUM and NU, chance is preserved via tuition-free education / grants (45% to 90%).
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

        # 1. MIT ($0 budget penalizes chance from ~53% to ~27%)
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertIsNotNone(chance_mit)
        self.assertTrue(40 <= chance_mit <= 60, f"Adil in MIT should be in 40-60% range, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(75 <= chance_tum <= 90, f"Adil in TUM should be in 75-90% range, got {chance_tum}%")

        # 3. NU (Abay Kunanbayev grant enables studying with $0 budget)
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(45 <= chance_nu <= 70, f"Adil in NU should be in 45-70% range, got {chance_nu}%")

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

        # 1. MIT (low estimate, without a blanket IELTS eligibility gate)
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertIsNotNone(chance_mit)
        self.assertLessEqual(chance_mit, 10)

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(60 <= chance_tum <= 80, f"Lisa in TUM should be in 60-80% range, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(35 <= chance_nu <= 55, f"Lisa in NU should be in 35-55% range, got {chance_nu}%")

    def test_anonymous_empty_profile(self):
        """
        Anonymous empty profile: GPA 0, no exams, no languages, $0 budget.
        Must not cause backend errors. Should yield 0% or None.
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
        # An empty profile can only receive the documented low-confidence estimate, not a verified MIT profile result.
        self.assertEqual("estimated_fallback", res_mit.get("chanceModel"))
        self.assertEqual("low", res_mit.get("confidence"))
        self.assertFalse(any(row.get("chanceModel") == "official_score_profile" for row in res_mit.get("choices", [])))

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertTrue(chance_tum is None or chance_tum == 0, f"Anonymous in TUM should have 0% or None chance, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertTrue(chance_nu is None or chance_nu == 0, f"Anonymous in NU should have 0% or None chance, got {chance_nu}%")


if __name__ == "__main__":
    unittest.main()
