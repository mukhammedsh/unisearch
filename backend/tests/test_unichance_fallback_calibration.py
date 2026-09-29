import unittest

from app.services.ai_scoring import estimate_uni_chance


class UniChanceFallbackCalibrationTests(unittest.TestCase):
    def test_published_requirements_score_requires_evidence_and_ignores_score_distribution(self):
        university = {
            "id": "fit-calibration-demo",
            "admission_categories": [{
                "id": "bachelor",
                "label": "Bachelor",
                "requirement_profiles": [{
                    "id": "minimums",
                    "label": "Published Minimums",
                    "requirements": {"SAT": 1200},
                    "score_profile": {
                        "exam_id": "SAT",
                        "p25_normalized": 50,
                        "median_normalized": 65,
                        "p75_normalized": 80,
                    },
                }],
            }],
        }
        fit = estimate_uni_chance(university, {"exams": [{"id": "SAT", "score": 1400}]})
        missing = estimate_uni_chance(university, {"exams": []})
        self.assertEqual(100, fit.get("overallChance"))
        self.assertEqual("published_requirements_met_percent", fit.get("scoreMeaning"))
        self.assertIsNone(missing.get("overallChance"))
        self.assertEqual("missing_evidence", missing.get("reason"))

        no_minimums = {
            **university,
            "admission_categories": [{
                "id": "bachelor",
                "label": "Bachelor",
                "requirement_profiles": [{
                    "id": "distribution-only",
                    "label": "Admitted Distribution Only",
                    "requirements": {},
                    "score_profile": university["admission_categories"][0]["requirement_profiles"][0]["score_profile"],
                }],
            }],
        }
        no_score = estimate_uni_chance(no_minimums, {"exams": [{"id": "SAT", "score": 1600}]})
        self.assertIsNone(no_score.get("overallChance"))
        self.assertEqual("no_published_requirements", no_score.get("reason"))


if __name__ == "__main__":
    unittest.main()
