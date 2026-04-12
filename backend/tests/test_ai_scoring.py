import unittest
from unittest.mock import Mock, patch

from app.services import universities as uni_service
from app.services.ai_scoring import _build_user_context, estimate_uni_chance, sort_universities_ai


def _demo_score_profile(exam_id="GPA", p25=60, median=75, p75=90, acceptance_rate_percent=None):
    profile = {
        "exam_id": exam_id,
        "compatible_exam_ids": [exam_id],
        "p25_normalized": float(p25),
        "median_normalized": float(median),
        "p75_normalized": float(p75),
        "confidence": "high",
    }
    if acceptance_rate_percent is not None:
        profile["acceptance_rate_percent"] = float(acceptance_rate_percent)
    return profile


class AiScoringTests(unittest.TestCase):
    def test_build_user_context_flattens_composite_exam_components(self):
        profile = {
            "exams": [
                {
                    "exam": "SAT",
                    "details": {
                        "components": [
                            {"exam": "SAT_MATH", "score": 780},
                            {"exam": "SAT_EBRW", "score": 760},
                        ]
                    },
                },
                {
                    "exam": "HKDSE_LEVEL",
                    "details": {
                        "components": [
                            {"exam": "HKDSE_CHINESE_LANGUAGE", "raw_value": "3"},
                            {"exam": "HKDSE_ENGLISH_LANGUAGE", "raw_value": "4"},
                            {"exam": "HKDSE_MATHEMATICS", "raw_value": "4"},
                            {"exam": "HKDSE_CITIZENSHIP_AND_SOCIAL_DEVELOPMENT", "score": 1},
                            {"exam": "HKDSE_ELECTIVE_1", "raw_value": "5"},
                            {"exam": "HKDSE_ELECTIVE_2_OR_M1_M2_OTHER_LANGUAGE", "raw_value": "5*"},
                        ],
                        "extra_scores": [
                            {"exam": "HKDSE_WEIGHTED_TOTAL", "score": 42.88}
                        ],
                    },
                },
            ]
        }

        ctx = _build_user_context(profile, {})

        self.assertEqual(1540, int(ctx["userScores"].get("SAT") or 0))
        self.assertEqual(780, int(ctx["userScores"].get("SAT_MATH") or 0))
        self.assertEqual(760, int(ctx["userScores"].get("SAT_EBRW") or 0))
        self.assertEqual(23, int(ctx["userScores"].get("HKDSE_LEVEL") or 0))
        self.assertEqual(3, int(ctx["userScores"].get("HKDSE_CHINESE_LANGUAGE") or 0))
        self.assertAlmostEqual(42.88, float(ctx["userScores"].get("HKDSE_WEIGHTED_TOTAL") or 0.0), places=2)

    def test_build_user_context_flattens_composite_language_exam_components(self):
        profile = {
            "languages": [
                {
                    "code": "en",
                    "kind": "exam",
                    "exam": "IELTS",
                    "score": 7.5,
                    "details": {
                        "components": [
                            {"exam": "IELTS_LISTENING", "score": 8.0},
                            {"exam": "IELTS_READING", "score": 7.5},
                            {"exam": "IELTS_WRITING", "score": 7.0},
                            {"exam": "IELTS_SPEAKING", "score": 7.0},
                        ]
                    },
                }
            ]
        }

        ctx = _build_user_context(profile, {})

        self.assertAlmostEqual(7.5, float(ctx["userScores"].get("IELTS") or 0.0), places=2)
        self.assertAlmostEqual(8.0, float(ctx["userScores"].get("IELTS_LISTENING") or 0.0), places=2)
        self.assertAlmostEqual(7.5, float(ctx["userLanguages"]["en"]["exams"].get("IELTS") or 0.0), places=2)
        self.assertAlmostEqual(7.0, float(ctx["userLanguages"]["en"]["exams"].get("IELTS_WRITING") or 0.0), places=2)

    def test_ai_sort_prefers_distance_match_even_when_ml_scores_disagree(self):
        items = [
            {
                "id": "u1",
                "name": "University One",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "factors": {
                    "practice_vs_science": 0.20,
                    "social_vs_hardcore": 0.60,
                    "budget_vs_prestige": 0.70,
                    "city_vs_campus": 0.20,
                },
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
                "factors": {
                    "practice_vs_science": 0.85,
                    "social_vs_hardcore": 0.15,
                    "budget_vs_prestige": 0.25,
                    "city_vs_campus": 0.85,
                },
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
            result = sort_universities_ai(
                items,
                profile=profile,
                practice_vs_science=20,
                social_vs_hardcore=60,
                budget_vs_prestige=70,
                city_vs_campus=20,
                funding_type="any",
            )

        self.assertEqual("u1", result[0].get("id"))
        self.assertIn("mlScore", result[0].get("matchData", {}))
        self.assertIn("hardScore", result[0].get("matchData", {}))
        self.assertIn("finalScore", result[0].get("matchData", {}))
        self.assertLess(
            float(result[0]["matchData"]["finalScore"]),
            float(result[1]["matchData"]["finalScore"]),
        )
        self.assertEqual("general", str(result[0]["matchData"].get("selectedChanceType", "")))

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
            result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")

        match = result[0].get("matchData", {})
        self.assertGreaterEqual(float(match.get("finalScore", 0.0)), 0.0)
        self.assertLessEqual(float(match.get("finalScore", 0.0)), 1.0)
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
            sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")

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
                    "score_profile": _demo_score_profile("SAT", p25=68, median=82, p75=93, acceptance_rate_percent=45),
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

    def test_estimate_uni_chance_respects_user_selected_track_override(self):
        university = {
            "id": "manual-track-u",
            "name": "Manual Track University",
            "rank": 120,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 50},
            "admission_tracks": [
                {
                    "id": "safe",
                    "label": "Safe Track",
                    "requirements": {"GPA": 75},
                    "stats_avg": {"GPA": 82},
                    "score_profile": _demo_score_profile("GPA", p25=58, median=72, p75=84, acceptance_rate_percent=50),
                },
                {
                    "id": "stretch",
                    "label": "Stretch Track",
                    "requirements": {"GPA": 95},
                    "stats_avg": {"GPA": 98},
                    "score_profile": _demo_score_profile("GPA", p25=78, median=92, p75=97, acceptance_rate_percent=50),
                },
            ],
        }
        profile = {
            "gpa": 92,
            "budget": 25000,
            "selectedAdmissionTracks": {"manual-track-u": "stretch"},
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual("stretch", str(result.get("bestTrackKey", "")))
        self.assertEqual("safe", str(result.get("recommendedTrackKey", "")))
        self.assertTrue(bool(result.get("selectedByUser")))
        self.assertEqual("user", str(result.get("trackSelectionSource", "")))

    def legacy_estimate_uni_chance_returns_no_data_without_score_profile(self):
        university = {
            "id": "no-score-profile-u",
            "name": "No Score Profile University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 80},
                    "stats_avg": {"GPA": 88},
                }
            ],
        }
        profile = {"locale": "rus", "gpa": 92, "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("Нет данных о баллах принятых", str(result.get("label") or ""))
        self.assertEqual("no_score_profile", str(result.get("reason") or ""))

    def test_estimate_uni_chance_falls_back_to_estimated_without_score_profile(self):
        university = {
            "id": "no-score-profile-u",
            "name": "No Score Profile University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 80},
                    "stats_avg": {"GPA": 88},
                }
            ],
        }
        profile = {"locale": "rus", "gpa": 92, "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertIsNotNone(result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("estimated_fallback", str(result.get("chanceModel") or ""))
        self.assertEqual("low", str(result.get("confidence") or ""))
        self.assertEqual("", str(result.get("reason") or ""))

    def test_estimate_uni_chance_fallback_returns_zero_without_any_required_evidence(self):
        university = {
            "id": "missing-evidence-u",
            "name": "Missing Evidence University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 80},
                    "stats_avg": {"GPA": 88},
                }
            ],
        }
        profile = {"locale": "rus", "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertEqual(0, int(result.get("overallChance", -1)))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("estimated_fallback", str(result.get("chanceModel") or ""))
        self.assertEqual("low", str(result.get("confidence") or ""))
        self.assertEqual("", str(result.get("reason") or ""))

    def test_estimate_uni_chance_returns_no_data_without_any_evidence_or_requirements(self):
        university = {
            "id": "no-constraints-u",
            "name": "No Constraints University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {},
                    "stats_avg": {},
                }
            ],
        }
        profile = {"locale": "rus", "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("missing_evidence", str(result.get("reason") or ""))

    def test_estimated_fallback_returns_zero_when_required_exam_is_below_minimum(self):
        university = {
            "id": "below-min-fallback-u",
            "name": "Below Min Fallback University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 80, "SAT": 1300},
                    "stats_avg": {"GPA": 88, "SAT": 1420},
                }
            ],
        }
        profile = {
            "locale": "rus",
            "budget": 25000,
            "gpa": 92,
            "exams": [{"id": "SAT", "score": 1200}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual(0, int(result.get("overallChance", -1)))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("estimated_fallback", str(result.get("chanceModel") or ""))

    def test_estimated_fallback_returns_zero_when_required_language_evidence_is_missing(self):
        university = {
            "id": "missing-lang-fallback-u",
            "name": "Missing Lang Fallback University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_tracks": [
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 80, "SAT": 1300},
                    "stats_avg": {"GPA": 88, "SAT": 1420},
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 7.0}}
                    ],
                }
            ],
        }
        profile = {
            "locale": "rus",
            "budget": 25000,
            "gpa": 92,
            "exams": [{"id": "SAT", "score": 1380}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual(0, int(result.get("overallChance", -1)))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("estimated_fallback", str(result.get("chanceModel") or ""))

    def test_estimate_uni_chance_uses_real_dataset_score_profiles_for_nu(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        sat_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 92,
            "exams": [{"id": "SAT", "score": 1480}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
            "selectedAdmissionTracks": {"nazarbayev-university-kaz-astana": "nu_sat_applicants"},
        }
        act_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 92,
            "exams": [{"id": "ACT", "score": 31}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
            "selectedAdmissionTracks": {"nazarbayev-university-kaz-astana": "nu_act_applicants"},
        }
        nuet_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 92,
            "exams": [{"id": "NUET", "score": 195}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
            "selectedAdmissionTracks": {"nazarbayev-university-kaz-astana": "nu_nuet_undergraduate"},
        }

        sat_result = estimate_uni_chance(university, sat_profile)
        act_result = estimate_uni_chance(university, act_profile)
        nuet_result = estimate_uni_chance(university, nuet_profile)

        self.assertIsNotNone(sat_result.get("overallChance"))
        self.assertTrue(bool(sat_result.get("chanceAvailable")))
        self.assertEqual("nu_sat_applicants", str(sat_result.get("bestTrackKey") or ""))
        self.assertEqual("official_score_profile", str(sat_result.get("chanceModel") or ""))

        self.assertIsNotNone(act_result.get("overallChance"))
        self.assertTrue(bool(act_result.get("chanceAvailable")))
        self.assertEqual("nu_act_applicants", str(act_result.get("bestTrackKey") or ""))
        self.assertEqual("estimated_fallback", str(act_result.get("chanceModel") or ""))

        self.assertIsNotNone(nuet_result.get("overallChance"))
        self.assertTrue(bool(nuet_result.get("chanceAvailable")))
        self.assertEqual("nu_nuet_undergraduate", str(nuet_result.get("bestTrackKey") or ""))

    def test_estimate_uni_chance_uses_cuhk_weighted_total_score_profile(self):
        university = uni_service.get_university_by_id("cuhk-hk-shatin")
        self.assertIsNotNone(university)

        profile = {
            "locale": "eng",
            "budget": 60000,
            "gpa": 90,
            "exams": [{"id": "HKDSE_WEIGHTED_TOTAL", "score": 43.0}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
            "selectedAdmissionTracks": {"cuhk-hk-shatin": "cuhk_hkdse"},
        }

        result = estimate_uni_chance(university, profile)

        self.assertIsNotNone(result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("cuhk_hkdse", str(result.get("bestTrackKey") or ""))
        self.assertEqual("official_score_profile", str(result.get("chanceModel") or ""))

    def test_estimate_uni_chance_accepts_raw_a_level_grades(self):
        university = {
            "id": "u-alevel-profile",
            "name": "A-Level Profile University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 12000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_tracks": [
                {
                    "id": "alevel_track",
                    "label": "A-Level Track",
                    "requirements": {"A_LEVEL_CERT": 1},
                    "stats_avg": {},
                    "score_profile": _demo_score_profile("A_LEVEL_CERT", p25=40, median=60, p75=80, acceptance_rate_percent=40),
                    "language_requirements": [
                        {
                            "code": "en",
                            "accept_native": True,
                            "requirements": {"IELTS": 6.5},
                        }
                    ],
                    "language_requirements_mode": "any",
                }
            ],
        }
        profile = {
            "budget": 25000,
            "exams": [
                {
                    "id": "A_LEVEL_CERT",
                    "raw_value": "A*A*A",
                    "details": {"grades": ["A*", "A*", "A"]},
                }
            ],
            "languages": [{"code": "en", "kind": "native"}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertIsNotNone(result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("official_score_profile", str(result.get("chanceModel") or ""))

    def test_score_profile_chance_has_small_acceptance_rate_influence(self):
        base_track = {
            "id": "profile-track",
            "label": "Profile Track",
            "requirements": {"GPA": 80},
            "stats_avg": {"GPA": 90},
        }
        university_low = {
            "id": "u-low-acc",
            "name": "Low Acceptance University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 1},
            "admission_tracks": [
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=50, median=65, p75=80, acceptance_rate_percent=1),
                }
            ],
        }
        university_high = {
            "id": "u-high-acc",
            "name": "High Acceptance University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 95},
            "admission_tracks": [
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=50, median=65, p75=80, acceptance_rate_percent=95),
                }
            ],
        }
        profile = {"gpa": 100, "budget": 20000}

        low_result = estimate_uni_chance(university_low, profile)
        high_result = estimate_uni_chance(university_high, profile)

        low_chance = int(low_result.get("overallChance", 0))
        high_chance = int(high_result.get("overallChance", 0))

        self.assertLess(low_chance, high_chance)
        self.assertLessEqual(high_chance - low_chance, 10)

    def test_estimated_fallback_chance_has_small_acceptance_rate_influence(self):
        base_track = {
            "id": "fallback-track",
            "label": "Fallback Track",
            "requirements": {"GPA": 80},
            "stats_avg": {"GPA": 90},
        }
        university_low = {
            "id": "u-low-fallback",
            "name": "Low Acceptance Fallback University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 1},
            "admission_tracks": [{**base_track}],
        }
        university_high = {
            "id": "u-high-fallback",
            "name": "High Acceptance Fallback University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 95},
            "admission_tracks": [{**base_track}],
        }
        profile = {"gpa": 100, "budget": 20000}

        low_result = estimate_uni_chance(university_low, profile)
        high_result = estimate_uni_chance(university_high, profile)

        low_chance = int(low_result.get("overallChance", 0))
        high_chance = int(high_result.get("overallChance", 0))

        self.assertLess(low_chance, high_chance)
        self.assertLessEqual(high_chance - low_chance, 10)

    def test_estimated_fallback_stays_close_to_score_profile_baseline(self):
        base_track = {
            "id": "calibrated-track",
            "label": "Calibrated Track",
            "requirements": {"GPA": 80},
            "stats_avg": {"GPA": 90},
        }
        university_fallback = {
            "id": "u-fallback-calibrated",
            "name": "Fallback Calibrated University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_tracks": [{**base_track}],
        }
        university_profile = {
            "id": "u-profile-calibrated",
            "name": "Profile Calibrated University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_tracks": [
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=40),
                }
            ],
        }
        profile = {"gpa": 85, "budget": 20000}

        fallback_result = estimate_uni_chance(university_fallback, profile)
        profile_result = estimate_uni_chance(university_profile, profile)

        fallback_chance = int(fallback_result.get("overallChance", 0))
        profile_chance = int(profile_result.get("overallChance", 0))

        self.assertLessEqual(fallback_chance, profile_chance)
        self.assertLessEqual(profile_chance - fallback_chance, 12)

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
                    "score_profile": _demo_score_profile("GPA", p25=60, median=78, p75=90, acceptance_rate_percent=35),
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

    def test_ai_sort_uses_user_selected_track_override(self):
        items = [
            {
                "id": "u-manual",
                "name": "Manual Choice University",
                "rank": 80,
                "finance": {"total_cost_year_usd": 22000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_tracks": [
                    {
                        "id": "safe",
                        "label": "Safe Track",
                        "requirements": {"GPA": 75},
                        "stats_avg": {"GPA": 82},
                        "score_profile": _demo_score_profile("GPA", p25=58, median=72, p75=84, acceptance_rate_percent=45),
                        "finance_override": {"total_cost_year_usd": 22000},
                    },
                    {
                        "id": "stretch",
                        "label": "Stretch Track",
                        "requirements": {"GPA": 95},
                        "stats_avg": {"GPA": 98},
                        "score_profile": _demo_score_profile("GPA", p25=78, median=92, p75=97, acceptance_rate_percent=45),
                        "finance_override": {"total_cost_year_usd": 12000},
                    },
                ],
            }
        ]
        profile_auto = {"gpa": 92, "budget": 30000}
        profile_manual = {
            "gpa": 92,
            "budget": 30000,
            "selectedAdmissionTracks": {"u-manual": "stretch"},
        }

        auto_result = sort_universities_ai(items, profile=profile_auto, budget_vs_prestige=100, funding_type="any")
        manual_result = sort_universities_ai(items, profile=profile_manual, budget_vs_prestige=100, funding_type="any")

        auto_match = auto_result[0].get("matchData", {})
        manual_match = manual_result[0].get("matchData", {})

        self.assertEqual("safe", str(auto_match.get("trackKey", "")))
        self.assertEqual("stretch", str(manual_match.get("trackKey", "")))
        self.assertEqual("safe", str(manual_match.get("recommendedTrackKey", "")))
        self.assertTrue(bool(manual_match.get("selectedByUser")))
        self.assertEqual("user", str(manual_match.get("trackSelectionSource", "")))
        self.assertLess(int(manual_match.get("selectedChance", 0)), int(auto_match.get("selectedChance", 0)))

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
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=60),
                }
            ],
        }
        profile_worse_only = {
            "gpa": 90,
            "budget": 20000,
            "exams": [{"id": "JLPT_N", "score": 3}],
        }
        profile_with_better_duplicate = {
            "gpa": 90,
            "budget": 20000,
            "exams": [
                {"id": "JLPT_N", "score": 3},
                {"id": "JLPT_N", "score": 1},
            ],
        }

        chance_worse = estimate_uni_chance(university, profile_worse_only)
        chance_better = estimate_uni_chance(university, profile_with_better_duplicate)

        self.assertGreater(int(chance_better.get("overallChance", 0)), int(chance_worse.get("overallChance", 0)))

    def test_unichance_treats_missing_exam_as_conditional_not_fail(self):
        university = {
            "id": "conditional-demo",
            "name": "Conditional Demo University",
            "rank": 120,
            "finance": {"total_cost_year_usd": 16000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 45},
            "admission_tracks": [
                {
                    "id": "track-main",
                    "label": "Main Track",
                    "requirements": {"UNT": 110},
                    "stats_avg": {"UNT": 120},
                    "score_profile": _demo_score_profile("UNT", p25=60, median=75, p75=88, acceptance_rate_percent=45),
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 7.0}}
                    ],
                }
            ],
        }
        profile = {
            "budget": 25000,
            "exams": [{"id": "UNT", "score": 125}],
            "languages": [],
        }

        chance = estimate_uni_chance(university, profile)
        self.assertGreater(int(chance.get("overallChance", 0)), 0)
        track = (chance.get("tracks") or [{}])[0]
        self.assertTrue(bool(track.get("conditional")))
        self.assertGreaterEqual(int((track.get("details") or {}).get("conditionalRequirements", 0)), 1)

    def test_ai_sort_does_not_mark_requirements_met_when_required_exam_is_missing(self):
        university = {
            "id": "conditional-sort-demo",
            "name": "Conditional Sort University",
            "rank": 120,
            "finance": {"total_cost_year_usd": 16000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 45},
            "admission_tracks": [
                {
                    "id": "track-main",
                    "label": "Main Track",
                    "requirements": {"UNT": 110},
                    "stats_avg": {"UNT": 120},
                }
            ],
        }
        profile = {
            "budget": 25000,
            "exams": [],
            "languages": [],
        }

        result = sort_universities_ai([university], profile=profile, funding_type="any")
        match = ((result[0] or {}).get("matchData") or {})

        self.assertTrue(bool(match.get("conditional")))
        self.assertFalse(bool(match.get("meetMinRequirements")))
        self.assertGreaterEqual(int(match.get("conditionalRequirements", 0) or 0), 1)

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

        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")
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
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=40),
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

    def test_ai_sort_online_without_tuition_does_not_fallback_to_oncampus_total(self):
        items = [
            {
                "id": "u-online-missing",
                "name": "Online Missing Tuition University",
                "rank": 100,
                "finance": {
                    "total_cost_year_usd": 30000,
                    "costs_breakdown_year_usd": {
                        "Housing_Dorm": 20000,
                        "Food": 10000,
                    },
                    "financial_aid": {"merit_based": False, "need_based": False},
                },
                "academics": {"acceptance_rate_percent": 50},
                "admission_tracks": [{"id": "t1", "label": "Default", "requirements": {}, "stats_avg": {}}],
            }
        ]
        profile = {"budget": 1000, "studyMode": "Online"}

        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")
        match = result[0].get("matchData", {})

        self.assertAlmostEqual(0.0, float(match.get("costYearUSD", 0.0)), places=6)
        self.assertEqual("online_missing_tuition", str(match.get("costMode")))

    def test_finance_slider_switches_grant_or_general_chance_mode(self):
        items = [
            {
                "id": "u-general-strong",
                "name": "General Strong University",
                "rank": 50,
                "finance": {"total_cost_year_usd": 22000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 40},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_tracks": [
                    {
                        "id": "paid-easy",
                        "label": "Paid Easy",
                        "funding_type": "paid",
                        "requirements": {"GPA": 70},
                        "stats_avg": {"GPA": 78},
                        "score_profile": _demo_score_profile("GPA", p25=45, median=60, p75=75, acceptance_rate_percent=40),
                    }
                ],
            },
            {
                "id": "u-grant-strong",
                "name": "Grant Strong University",
                "rank": 55,
                "finance": {"total_cost_year_usd": 20000, "financial_aid": {"merit_based": True, "need_based": True}},
                "academics": {"acceptance_rate_percent": 35},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_tracks": [
                    {
                        "id": "grant-medium",
                        "label": "Grant Medium",
                        "funding_type": "grant",
                        "requirements": {"GPA": 82},
                        "stats_avg": {"GPA": 88},
                        "score_profile": _demo_score_profile("GPA", p25=55, median=72, p75=84, acceptance_rate_percent=40),
                    }
                ],
            },
        ]
        profile = {"gpa": 90, "budget": 40000, "studyMode": "On-campus"}

        grant_mode = sort_universities_ai(items, profile=profile, budget_vs_prestige=0, funding_type="any")
        general_mode = sort_universities_ai(items, profile=profile, budget_vs_prestige=100, funding_type="any")

        self.assertEqual("u-grant-strong", grant_mode[0].get("id"))
        self.assertEqual("grant", str((grant_mode[0].get("matchData") or {}).get("selectedChanceType", "")))
        self.assertEqual("u-general-strong", general_mode[0].get("id"))
        self.assertEqual("general", str((general_mode[0].get("matchData") or {}).get("selectedChanceType", "")))

    def test_location_slider_prefers_city_or_campus_profiles(self):
        items = [
            {
                "id": "u-city",
                "name": "City University",
                "rank": 30,
                "finance": {"total_cost_year_usd": 35000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 30},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.1,
                },
                "admission_tracks": [{"id": "city", "label": "City", "requirements": {"GPA": 82}, "stats_avg": {"GPA": 88}}],
            },
            {
                "id": "u-campus",
                "name": "Campus University",
                "rank": 30,
                "finance": {"total_cost_year_usd": 35000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 30},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.9,
                },
                "admission_tracks": [{"id": "campus", "label": "Campus", "requirements": {"GPA": 82}, "stats_avg": {"GPA": 88}}],
            },
        ]
        profile = {"gpa": 90, "budget": 40000, "studyMode": "On-campus"}

        city_result = sort_universities_ai(items, profile=profile, city_vs_campus=0, funding_type="any")
        campus_result = sort_universities_ai(items, profile=profile, city_vs_campus=100, funding_type="any")

        self.assertEqual("u-city", city_result[0].get("id"))
        self.assertEqual("u-campus", campus_result[0].get("id"))

    def test_ui_badge_hints_mark_conditional_and_vibe(self):
        items = [
            {
                "id": "u-conditional-vibe",
                "name": "Conditional Vibe University",
                "rank": 80,
                "finance": {"total_cost_year_usd": 18000, "financial_aid": {"merit_based": True, "need_based": True}},
                "academics": {"acceptance_rate_percent": 45},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_tracks": [
                    {
                        "id": "grant-track",
                        "label": "Grant Track",
                        "funding_type": "grant",
                        "requirements": {"GPA": 80},
                        "stats_avg": {"GPA": 90},
                        "language_requirements_mode": "all",
                        "language_requirements": [
                            {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 7.0}}
                        ],
                    }
                ],
            }
        ]
        profile = {"gpa": 95, "budget": 30000}

        result = sort_universities_ai(
            items,
            profile=profile,
            practice_vs_science=50,
            social_vs_hardcore=50,
            budget_vs_prestige=0,
            city_vs_campus=50,
            funding_type="any",
        )
        hints = ((result[0].get("matchData") or {}).get("uiBadgeHints") or {})

        self.assertTrue(bool(hints.get("showConditionalExamNeeded")))
        self.assertEqual("your_vibe", str(hints.get("vibe", "")))
        self.assertEqual("grant", str(((hints.get("metrics") or {}).get("selectedChanceType"))))

    def test_ui_badge_hints_detect_finance_route(self):
        grant_item = {
            "id": "u-likely-grant",
            "name": "Likely Grant University",
            "rank": 60,
            "finance": {"total_cost_year_usd": 15000, "financial_aid": {"merit_based": True, "need_based": True}},
            "academics": {"acceptance_rate_percent": 70},
            "factors": {
                "practice_vs_science": 0.5,
                "social_vs_hardcore": 0.5,
                "budget_vs_prestige": 0.5,
                "city_vs_campus": 0.5,
            },
            "admission_tracks": [
                {
                    "id": "grant-track",
                    "label": "Grant Track",
                    "funding_type": "grant",
                    "requirements": {"GPA": 65},
                    "stats_avg": {"GPA": 75},
                    "score_profile": _demo_score_profile("GPA", p25=40, median=55, p75=72, acceptance_rate_percent=70),
                }
            ],
        }
        paid_item = {
            "id": "u-paid-route",
            "name": "Paid Route University",
            "rank": 65,
            "finance": {"total_cost_year_usd": 24000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 75},
            "factors": {
                "practice_vs_science": 0.5,
                "social_vs_hardcore": 0.5,
                "budget_vs_prestige": 0.5,
                "city_vs_campus": 0.5,
            },
            "admission_tracks": [
                {
                    "id": "paid-track",
                    "label": "Paid Track",
                    "funding_type": "paid",
                    "requirements": {"GPA": 60},
                    "stats_avg": {"GPA": 70},
                    "score_profile": _demo_score_profile("GPA", p25=38, median=52, p75=68, acceptance_rate_percent=75),
                }
            ],
        }
        profile = {"gpa": 95, "budget": 40000}

        grant_result = sort_universities_ai([grant_item], profile=profile, budget_vs_prestige=0, funding_type="any")
        paid_result = sort_universities_ai([paid_item], profile=profile, budget_vs_prestige=100, funding_type="any")

        grant_hints = ((grant_result[0].get("matchData") or {}).get("uiBadgeHints") or {})
        paid_hints = ((paid_result[0].get("matchData") or {}).get("uiBadgeHints") or {})

        self.assertEqual("likely_grant", str(grant_hints.get("finance", "")))
        self.assertEqual("paid_admission", str(paid_hints.get("finance", "")))

    def test_estimate_uni_chance_flattens_compact_track_funding_options(self):
        university = {
            "id": "u-compact-funding",
            "name": "Compact Funding University",
            "rank": 70,
            "finance": {"total_cost_year_usd": 18000, "financial_aid": {"merit_based": True, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_tracks": [
                {
                    "id": "direct",
                    "label": "Direct Admission",
                    "requirements": {"GPA": 80},
                    "stats_avg": {"GPA": 88},
                    "funding_options": [
                        {
                            "id": "direct",
                            "label": "Paid Admission",
                            "funding_type": "paid",
                            "track_badge": "Paid",
                            "requirements": {"SAT": 1200},
                            "score_profile": _demo_score_profile("SAT", p25=1050, median=1180, p75=1300, acceptance_rate_percent=40),
                        },
                        {
                            "id": "direct-grant",
                            "label": "Merit Grant",
                            "funding_type": "grant",
                            "track_badge": "Grant",
                            "requirements": {"SAT": 1400},
                            "score_profile": _demo_score_profile("SAT", p25=1320, median=1410, p75=1510, acceptance_rate_percent=40),
                        },
                    ],
                }
            ],
        }
        profile = {
            "gpa": 92,
            "fundingType": "grant",
            "exams": [{"exam": "SAT", "score": 1450}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual("direct-grant", str(result.get("bestTrackId") or ""))
        self.assertEqual("grant", str(result.get("fundingType") or ""))
        self.assertEqual(["direct-grant"], [str(row.get("trackId") or "") for row in (result.get("tracks") or [])])

if __name__ == "__main__":
    unittest.main()
