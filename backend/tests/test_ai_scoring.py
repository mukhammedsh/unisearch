import unittest
from unittest.mock import Mock, patch

from app.services.ai_scoring import estimate_uni_chance, sort_universities_ai


class AiScoringTests(unittest.TestCase):
    def test_ai_sort_blends_hard_and_ml_scores_when_interests_present(self):
        items = [
            {
                "id": "u1",
                "name": "University One",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "admission_tracks": [
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ],
            },
            {
                "id": "u2",
                "name": "University Two",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "admission_tracks": [
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ],
            },
        ]
        profile = {"budget": 40000, "interests": "ai robotics"}
        fake_ml = Mock()
        fake_ml.predict_relevance.return_value = {"u1": 1.0, "u2": 0.0}

        with patch("app.services.ai_scoring.get_ml_runtime_status", return_value={"available": True, "message": ""}), patch(
            "app.services.ai_scoring.get_ml_recommender", return_value=fake_ml
        ):
            result = sort_universities_ai(items, profile=profile, ai_balance=50, funding_type="any")

        self.assertEqual("u1", result[0].get("id"))
        self.assertIn("mlScore", result[0].get("matchData", {}))
        self.assertIn("hardScore", result[0].get("matchData", {}))
        self.assertIn("finalScore", result[0].get("matchData", {}))
        self.assertGreater(float(result[0]["matchData"]["finalScore"]), float(result[1]["matchData"]["finalScore"]))

    def test_ai_sort_falls_back_to_hard_score_when_ml_unavailable(self):
        items = [
            {
                "id": "u1",
                "name": "University One",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "admission_tracks": [
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ],
            }
        ]
        profile = {"budget": 40000, "interests": "ai robotics"}

        with patch(
            "app.services.ai_scoring.get_ml_runtime_status",
            return_value={"available": False, "message": "Machine Learning unavailable"},
        ):
            result = sort_universities_ai(items, profile=profile, ai_balance=50, funding_type="any")

        match = result[0].get("matchData", {})
        self.assertAlmostEqual(float(match.get("finalScore", 0.0)), float(match.get("hardScore", 0.0)), places=6)
        self.assertFalse(bool(match.get("mlApplied")))
        self.assertTrue(bool(match.get("mlUnavailable")))
        self.assertEqual("Machine Learning unavailable", str(match.get("mlWarning", "")))

    def test_ai_sort_uses_translated_interest_text_for_ml_query(self):
        items = [
            {
                "id": "u1",
                "name": "University One",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "admission_tracks": [
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ],
            }
        ]
        profile = {"budget": 40000, "interests": "хочу ai", "locale": "rus"}
        fake_ml = Mock()
        fake_ml.predict_relevance.return_value = {"u1": 0.5}

        with patch(
            "app.services.ai_scoring.translate_interest_text_for_ml",
            return_value={"text": "i want artificial intelligence", "translated": True, "source": "ru", "reason": "translated"},
        ), patch(
            "app.services.ai_scoring.get_ml_runtime_status",
            return_value={"available": True, "message": ""},
        ), patch(
            "app.services.ai_scoring.get_ml_recommender",
            return_value=fake_ml,
        ):
            sort_universities_ai(items, profile=profile, ai_balance=50, funding_type="any")

        fake_ml.predict_relevance.assert_called_once_with("i want artificial intelligence")

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

    def test_language_exam_requirements_are_not_inferred_from_cefr(self):
        university = {
            "id": "eth-demo",
            "name": "ETH Demo",
            "rank": 5,
            "finance": {
                "total_cost_year_usd": 28000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 35},
            "admission_tracks": [
                {
                    "id": "eth_direct",
                    "label": "Direct Entry",
                    "requirements": {"GPA": 90},
                    "stats_avg": {"GPA": 96},
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {
                            "code": "de",
                            "accept_native": True,
                            "min_cefr": 5,
                            "requirements": {"TestDaF_TDN": 4, "DSH_Level": 3},
                            "stats_avg": {"TestDaF_TDN": 4, "DSH_Level": 3},
                        }
                    ],
                }
            ],
        }

        profile_de_b2 = {
            "gpa": 93,
            "budget": 30000,
            "languages": [{"code": "de", "kind": "cefr", "level": 4}],
        }
        profile_de_c1 = {
            "gpa": 93,
            "budget": 30000,
            "languages": [{"code": "de", "kind": "cefr", "level": 5}],
        }

        chance_b2 = estimate_uni_chance(university, profile_de_b2)
        chance_c1 = estimate_uni_chance(university, profile_de_c1)

        self.assertLess(int(chance_b2.get("overallChance", 0)), int(chance_c1.get("overallChance", 0)))

    def test_jlpt_uses_best_lower_score_when_duplicate_exam_entries_exist(self):
        university = {
            "id": "jp-demo",
            "name": "JP Demo",
            "rank": 80,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 60},
            "admission_tracks": [
                {
                    "id": "jp-track",
                    "label": "JP Track",
                    "requirements": {"JLPT_N": 2},
                    "stats_avg": {"JLPT_N": 2},
                }
            ],
        }
        profile_worse_only = {
            "budget": 20000,
            "exams": [{"id": "JLPT_N", "score": 3}],
        }
        profile_with_better_duplicate = {
            "budget": 20000,
            "exams": [
                {"id": "JLPT_N", "score": 3},
                {"id": "JLPT_N", "score": 1},
            ],
        }

        chance_worse = estimate_uni_chance(university, profile_worse_only)
        chance_better = estimate_uni_chance(university, profile_with_better_duplicate)

        self.assertGreater(int(chance_better.get("overallChance", 0)), int(chance_worse.get("overallChance", 0)))

    def test_ai_sort_online_mode_uses_tuition_only_cost(self):
        items = [
            {
                "id": "u-online",
                "name": "Online Cost University",
                "rank": 100,
                "finance": {
                    "total_cost_year_usd": 30000,
                    "total_cost_year_usd_by_mode": {"online": 17000},
                    "costs_breakdown_year_usd": {
                        "Tuition": 10000,
                        "Housing_Dorm": 15000,
                        "Food": 5000,
                    },
                    "financial_aid": {"merit_based": False, "need_based": False},
                },
                "academics": {"acceptance_rate_percent": 50},
                "admission_tracks": [{"id": "t1", "label": "Default", "requirements": {}, "stats_avg": {}}],
            }
        ]
        profile = {"budget": 12000, "studyMode": "Online"}

        result = sort_universities_ai(items, profile=profile, ai_balance=50, funding_type="any")
        match = result[0].get("matchData", {})

        self.assertAlmostEqual(10000.0, float(match.get("costYearUSD", 0.0)), places=6)
        self.assertAlmostEqual(10000.0, float(match.get("finalPrice", 0.0)), places=6)
        self.assertEqual("online_tuition_only", str(match.get("costMode")))

    def test_estimate_uni_chance_online_mode_increases_affordability(self):
        university = {
            "id": "u-chance-online",
            "name": "Chance Online University",
            "rank": 150,
            "finance": {
                "total_cost_year_usd": 30000,
                "costs_breakdown_year_usd": {
                    "Tuition": 10000,
                    "Housing_Dorm": 15000,
                    "Food": 5000,
                },
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 40},
            "admission_tracks": [
                {
                    "id": "track-1",
                    "label": "Default",
                    "requirements": {"GPA": 80},
                    "stats_avg": {"GPA": 90},
                }
            ],
        }
        profile_oncampus = {"gpa": 85, "budget": 12000, "studyMode": "On-campus"}
        profile_online = {"gpa": 85, "budget": 12000, "studyMode": "Online"}

        chance_oncampus = estimate_uni_chance(university, profile_oncampus)
        chance_online = estimate_uni_chance(university, profile_online)

        oncampus_aff = int(((chance_oncampus.get("tracks") or [{}])[0].get("details") or {}).get("affordability", 0))
        online_aff = int(((chance_online.get("tracks") or [{}])[0].get("details") or {}).get("affordability", 0))
        self.assertGreater(online_aff, oncampus_aff)
        self.assertGreaterEqual(int(chance_online.get("overallChance", 0)), int(chance_oncampus.get("overallChance", 0)))

if __name__ == "__main__":
    unittest.main()
