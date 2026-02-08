import unittest

from app.services.ai_scoring import estimate_uni_chance


class AiScoringTests(unittest.TestCase):
    def test_estimate_uni_chance_returns_valid_shape(self):
        university = {
            "id": "demo-u",
            "name": "Demo University",
            "rank": 100,
            "finance": {
                "total_cost_year_usd": 12000,
                "financial_aid": {"merit_based": True, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 45},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 88, "SAT": 1250},
                    "stats_avg": {"GPA": 93, "SAT": 1420},
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "min_cefr": 4, "accept_native": True}
                    ],
                }
            ],
        }
        profile = {
            "gpa": 92,
            "budget": 20000,
            "exams": [{"id": "SAT", "score": 1360}],
            "languages": [{"code": "en", "kind": "native"}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertIn("overallChance", result)
        self.assertIn("tracks", result)
        self.assertIn("bestTrackLabel", result)
        self.assertFalse(result.get("missingEvidence", True))
        self.assertGreaterEqual(int(result.get("overallChance", 0)), 0)
        self.assertLessEqual(int(result.get("overallChance", 0)), 100)
        self.assertTrue(len(result.get("tracks", [])) >= 1)


if __name__ == "__main__":
    unittest.main()
