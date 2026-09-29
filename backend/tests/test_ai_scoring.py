import unittest
from unittest.mock import Mock, patch

from app.services import universities as uni_service
from app.services.ai_scoring import (
    _build_user_context,
    _effective_track_cost_details,
    estimate_uni_chance as _estimate_uni_chance,
    sort_universities_ai as _sort_universities_ai,
    _choice_matches_study_level,
)
from app.schemas.payloads import ProfilePayload, to_profile_dict


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


def _admission_category(category_id, label, profiles, **overrides):
    row = {
        "id": category_id,
        "label": label,
        "scope": {"level": "bachelor", "type": "general", "program_ids": [], "program_names": []},
        "requirement_profiles": profiles,
    }
    row.update(overrides)
    return row


def _choice_selection(choice_key):
    parts = str(choice_key or "").split("::")
    return {
        "categoryId": parts[0] if len(parts) > 0 else "",
        "requirementProfileId": parts[1] if len(parts) > 1 else "",
        "fundingOptionId": parts[2] if len(parts) > 2 else "",
        "choiceKey": choice_key,
    }


def _categories_from_requirement_profiles(profiles):
    categories = []
    for profile_row in profiles or []:
        profile = {
            "id": profile_row.get("id"),
            "label": profile_row.get("label"),
        }
        for key in ("requirements", "stats_avg", "score_profile", "language_requirements", "language_requirements_mode", "extra_requirements", "scholarships", "finance_override"):
            if key in profile_row:
                profile[key] = profile_row[key]
        if profile_row.get("funding_options"):
            profile["funding_options"] = profile_row.get("funding_options")
        elif profile_row.get("funding_type"):
            profile["funding_options"] = [
                {
                    "id": profile_row.get("id"),
                    "label": profile_row.get("label"),
                    "funding_type": profile_row.get("funding_type"),
                    "track_badge": profile_row.get("track_badge"),
                    "funding_program": profile_row.get("funding_program"),
                    "funding_source": profile_row.get("funding_source"),
                    "finance_override": profile_row.get("finance_override"),
                }
            ]
        categories.append(_admission_category(profile_row.get("id") or "general", profile_row.get("label") or "General admission", [profile]))
    return categories


def estimate_uni_chance(university, profile=None):
    return _estimate_uni_chance(university, profile)


def sort_universities_ai(items, profile=None, **kwargs):
    return _sort_universities_ai(items, profile, **kwargs)


class AiScoringTests(unittest.TestCase):
    def test_route_and_exact_program_context_scope_admission_estimates(self):
        university = {
            "id": "stanford-context-u",
            "name": "Stanford University",
            "finance": {"total_cost_year_usd": 80000},
            "admission_categories": [
                _admission_category(
                    "first_year_cs", "First-year CS", [{"id": "general", "label": "General"}],
                    applicant_route="first_year", study_level="Bachelor",
                    application_scope="course_specific", program_ids=["cs-bs"],
                ),
                _admission_category(
                    "transfer_cs", "Transfer CS", [{"id": "general", "label": "General"}],
                    applicant_route="transfer", study_level="Bachelor",
                    application_scope="course_specific", program_ids=["cs-bs"],
                ),
                _admission_category(
                    "jd", "Juris Doctor", [{"id": "general", "label": "General"}],
                    applicant_route="graduate", study_level="Professional",
                    application_scope="course_specific", program_ids=["jd"],
                ),
            ],
        }
        profile = to_profile_dict(ProfilePayload.model_validate({
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "selectedAdmissionChoices": {"stanford-context-u": {"programId": "cs-bs"}},
        }))

        result = estimate_uni_chance(university, profile)

        self.assertTrue(result["choices"])
        self.assertEqual({"first_year_cs"}, {row["categoryId"] for row in result["choices"]})
        self.assertEqual("cs-bs", profile["selectedAdmissionChoices"]["stanford-context-u"]["programId"])

    def test_explicit_entry_cycle_mismatch_has_no_estimate_but_unknown_cycle_is_kept(self):
        university = {
            "id": "cycle-context-u",
            "name": "Cycle University",
            "admission_categories": [
                _admission_category("old", "Old cycle", [{"id": "general", "label": "General"}],
                                    applicant_route="first_year", study_level="Bachelor", cycle="Fall 2026"),
                _admission_category("current", "Current cycle", [{"id": "general", "label": "General"}],
                                    applicant_route="first_year", study_level="Bachelor", cycle="Fall 2027"),
                _admission_category("unknown", "Unknown cycle", [{"id": "general", "label": "General"}],
                                    applicant_route="first_year", study_level="Bachelor"),
                _admission_category("academic_year", "Academic year", [{"id": "general", "label": "General"}],
                                    applicant_route="first_year", study_level="Bachelor", cycle="2026–27"),
            ],
        }

        result = estimate_uni_chance(university, {
            "study_level": "Bachelor", "applicant_route": "first_year", "intended_entry_cycle": "2027 Fall",
        })

        self.assertEqual({"current", "unknown", "academic_year"}, {row["categoryId"] for row in result["choices"]})

    def test_unknown_route_remains_available_for_profile_route(self):
        university = {
            "id": "unknown-route-u",
            "name": "Unknown Route University",
            "admission_categories": [
                _admission_category("unknown", "Unknown route", [{"id": "general", "label": "General"}],
                                    study_level="Bachelor"),
            ],
        }
        result = estimate_uni_chance(university, {"study_level": "Bachelor", "applicant_route": "transfer"})
        self.assertEqual(["unknown"], [row["categoryId"] for row in result["choices"]])

    def test_old_university_cost_is_not_returned_as_current_for_new_entry_cycle(self):
        university = {
            "id": "cycle-cost-u",
            "finance": {
                "total_cost_year_usd": 50000,
                "costs_breakdown_year_usd": {"Tuition": 40000},
                "academic_year": "2026–27",
            },
        }
        choice = {"study_level": "Bachelor"}

        cost = _effective_track_cost_details(
            university, choice, intended_entry_cycle="2027 entry"
        )

        self.assertEqual((0.0, 0.0, "USD", "unavailable"), cost)

    def test_mit_first_year_profile_does_not_use_transfer_admission_or_stale_cost(self):
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        self.assertIsNotNone(mit)
        profile = {
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "intended_entry_cycle": "Fall 2027",
            "selectedAdmissionChoices": {
                mit["id"]: {"programId": "mit-course-6-3-bachelor"},
            },
        }

        chance = estimate_uni_chance(mit, profile)
        match = sort_universities_ai([mit], profile=profile)[0]["matchData"]

        self.assertTrue(chance["choices"])
        self.assertTrue(all(row["categoryId"] != "mit_undergrad_transfer" for row in chance["choices"]))
        self.assertIn(chance["choices"][0]["categoryId"], {"mit_regular", "mit_undergrad_early_action"})
        self.assertEqual("unavailable", match["costMode"])
        self.assertIsNone(match["finalPrice"])

    def test_stanford_undergraduate_computer_science_context_excludes_jd(self):
        stanford = uni_service.get_university_by_id("stanford-university-usa-ca")
        self.assertIsNotNone(stanford)
        result = estimate_uni_chance(stanford, {
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "selectedAdmissionChoices": {
                stanford["id"]: {"programId": "stanford-bs-computer-science"},
            },
        })

        self.assertTrue(result["choices"])
        self.assertEqual({"stanford_standard"}, {row["categoryId"] for row in result["choices"]})
        self.assertNotIn("stanford_jd_track", {row["categoryId"] for row in result["choices"]})

    def test_imperial_computing_selection_uses_its_exact_course_route(self):
        imperial = uni_service.get_university_by_id("imperial-college-london-uk")
        self.assertIsNotNone(imperial)
        result = estimate_uni_chance(imperial, {
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "intended_entry_cycle": "2027 entry",
            "selectedAdmissionChoices": {
                imperial["id"]: {"programId": "imperial-computing-meng"},
            },
        })

        self.assertTrue(result["choices"])
        self.assertEqual({"imperial_computing_2027"}, {row["categoryId"] for row in result["choices"]})

    def test_roi_uses_selected_route_program_and_entry_cycle_for_cost(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "roi-context-u",
            "academics": {"programs": [
                {"id": "course-a", "name": "Course A", "study_levels": ["Bachelor"]},
                {"id": "course-b", "name": "Course B", "study_levels": ["Bachelor"]},
            ]},
            "finance": {"total_cost_year_usd": 50000, "academic_year": "2027-28"},
            "outcomes": {"early_career_salary_usd": 100000},
            "admission_categories": [
                _admission_category(
                    "course-a-route", "Course A", [{"id": "general", "label": "General"}],
                    applicant_route="first_year", study_level="Bachelor", cycle="Fall 2027",
                    program_ids=["course-a"], finance_override={"total_cost_year_usd": 70000, "academic_year": "2027-28"},
                ),
                _admission_category(
                    "course-b-route", "Course B", [{"id": "general", "label": "General"}],
                    applicant_route="transfer", study_level="Bachelor", cycle="Fall 2027",
                    program_ids=["course-b"], finance_override={"total_cost_year_usd": 20000, "academic_year": "2027-28"},
                ),
            ],
        }

        result = estimate_university_roi(university, {
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "intended_entry_cycle": "Fall 2027",
            "selectedAdmissionChoices": {"roi-context-u": {"programId": "course-a"}},
        })

        self.assertEqual(70000.0, result["annual_cost_usd"])

    def test_roi_does_not_fall_back_to_stale_university_cost_for_new_cycle(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "roi-cycle-context-u",
            "academics": {"programs": [{"id": "course-a", "study_levels": ["Bachelor"]}]},
            "finance": {"total_cost_year_usd": 50000, "academic_year": "2026–27"},
            "outcomes": {"early_career_salary_usd": 100000},
            "admission_categories": [
                _admission_category(
                    "course-a-route", "Course A", [{"id": "general", "label": "General"}],
                    applicant_route="first_year", study_level="Bachelor", cycle="2027 entry",
                    program_ids=["course-a"],
                ),
            ],
        }

        result = estimate_university_roi(university, {
            "study_level": "Bachelor",
            "applicant_route": "first_year",
            "intended_entry_cycle": "2027 entry",
            "selectedAdmissionChoices": {"roi-cycle-context-u": {"programId": "course-a"}},
        })

        self.assertEqual("no_cost_data", result["context_type"])
        self.assertIsNone(result["annual_cost_usd"])

    def test_legacy_general_program_scopes_remain_bachelor_only(self):
        for scope in ("general", "program", "program_group"):
            with self.subTest(scope=scope):
                choice = {"scope": scope}
                self.assertTrue(_choice_matches_study_level(choice, "bachelor"))
                self.assertFalse(_choice_matches_study_level(choice, "master"))
                self.assertFalse(_choice_matches_study_level(choice, "doctorate"))

        self.assertFalse(_choice_matches_study_level({"scope": "graduate_business"}, "bachelor"))
        self.assertFalse(_choice_matches_study_level({"scope": "doctoral_research"}, "bachelor"))

    def test_graduate_roi_requires_level_specific_cost_and_outcomes(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "finance": {"total_cost_year_usd": 85960},
            "outcomes": {"early_career_salary_usd": 120000},
        }
        result = estimate_university_roi(university, {"studyLevel": "MBA", "major": "Business"})

        self.assertIsNone(result["annual_cost_usd"])
        self.assertIsNone(result["roi_value"])
        self.assertEqual("insufficient_level_data", result["context_type"])

    def test_professional_program_roi_does_not_reuse_undergraduate_salary_outcomes(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "professional-roi-u",
            "finance": {"total_cost_year_usd": 85960},
            "outcomes": {"early_career_salary_usd": 120000},
            "admission_categories": [
                _admission_category(
                    "jd", "Juris Doctor", [{"id": "general", "label": "General"}],
                    applicant_route="graduate", study_level="Professional",
                    program_ids=["jd"], finance_override={"total_cost_year_usd": 70000},
                ),
            ],
        }

        for profile in ({"study_level": "Professional"}, {"study_level": "Any"}):
            with self.subTest(profile=profile):
                result = estimate_university_roi(university, profile)
                self.assertEqual("insufficient_level_data", result["context_type"])
                self.assertIsNone(result["annual_cost_usd"])
                self.assertIsNone(result["roi_value"])

    def test_graduate_track_without_own_price_does_not_inherit_undergraduate_cost(self):
        university = {
            "id": "graduate-cost-u",
            "name": "Graduate Cost University",
            "finance": {"currency": "USD", "total_cost_year_usd": 85960},
            "admission_categories": [
                _admission_category(
                    "mba",
                    "Full-Time MBA",
                    [{"id": "general", "label": "MBA"}],
                    study_levels=["Master"],
                    scope="graduate_business",
                )
            ],
        }
        mba = {"study_levels": ["Master"], "scope": "graduate_business"}

        self.assertEqual((0.0, 0.0, "USD", "unavailable"), _effective_track_cost_details(university, mba))
        self.assertEqual(85960, _effective_track_cost_details(university, {"study_levels": ["Bachelor"]})[0])

        match_data = sort_universities_ai([university], profile={"studyLevel": "Master"})[0]["matchData"]
        self.assertEqual("unavailable", match_data["costMode"])
        self.assertIsNone(match_data["finalPrice"])
        self.assertIsNone(match_data["finalPriceUSD"])
        self.assertIsNone(match_data["costYearUSD"])
        self.assertIsNone(match_data["costYearNative"])

    def test_missing_bachelor_cost_stays_unknown_in_sort_and_roi(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "missing-cost-u",
            "name": "Missing Cost University",
            "admission_categories": [
                _admission_category("bachelor", "Bachelor", [{"id": "general", "label": "General", "requirements": {}, "stats_avg": {}}])
            ],
            "outcomes": {"early_career_salary_usd": 100000},
        }

        match = sort_universities_ai([university], profile={"studyLevel": "Bachelor"})[0]["matchData"]
        roi = estimate_university_roi(university, {"studyLevel": "Bachelor"})

        self.assertEqual("unavailable", match["costMode"])
        self.assertIsNone(match["finalPrice"])
        self.assertIsNone(match["finalPriceUSD"])
        self.assertIsNone(match["costYearUSD"])
        self.assertIsNone(match["costYearNative"])
        self.assertEqual("no_cost_data", roi["context_type"])
        self.assertIsNone(roi["annual_cost_usd"])
        self.assertIsNone(roi["roi_value"])

    def test_bachelor_roi_does_not_use_a_graduate_track_price(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "level-specific-roi-u",
            "name": "Level Specific ROI University",
            "finance": {"total_cost_year_usd": 50000},
            "admission_categories": [
                _admission_category(
                    "bachelor",
                    "Bachelor",
                    [{"id": "general", "label": "Bachelor"}],
                    study_levels=["Bachelor"],
                    scope="undergraduate",
                    finance_override={"total_cost_year_usd": 50000, "currency": "USD"},
                ),
                _admission_category(
                    "mba",
                    "MBA",
                    [{"id": "general", "label": "MBA"}],
                    study_levels=["MBA"],
                    scope="graduate_business",
                    finance_override={"total_cost_year_usd": 20000, "currency": "USD"},
                )
            ],
            "outcomes": {"early_career_salary_usd": 100000},
        }

        result = estimate_university_roi(university, {"studyLevel": "Bachelor"})
        any_level_result = estimate_university_roi(university, {"studyLevel": "Any"})

        self.assertEqual(50000.0, result["annual_cost_usd"])
        self.assertEqual(2.0, result["roi_value"])
        self.assertEqual(50000.0, any_level_result["annual_cost_usd"])
        self.assertEqual(2.0, any_level_result["roi_value"])

    def test_any_level_roi_is_unknown_when_only_graduate_costs_exist(self):
        from app.services.ai_scoring import estimate_university_roi

        university = {
            "id": "graduate-only-roi-u",
            "name": "Graduate Only ROI University",
            "admission_categories": [
                _admission_category(
                    "mba",
                    "MBA",
                    [{"id": "general", "label": "MBA"}],
                    study_levels=["MBA"],
                    scope="graduate_business",
                    finance_override={"total_cost_year_usd": 20000, "currency": "USD"},
                )
            ],
            "outcomes": {"early_career_salary_usd": 100000},
        }

        result = estimate_university_roi(university, {"studyLevel": "Any"})

        self.assertEqual("insufficient_level_data", result["context_type"])
        self.assertIsNone(result["annual_cost_usd"])
        self.assertIsNone(result["roi_value"])

    def test_grant_route_does_not_claim_verified_aid_eligibility(self):
        university = {
            "id": "possible-grant-u",
            "name": "Possible Grant University",
            "finance": {"total_cost_year_usd": 30000},
            "admission_categories": [
                _admission_category(
                    "grant",
                    "Grant route",
                    [{"id": "general", "label": "General", "requirements": {}, "stats_avg": {}}],
                    funding_options=[{"id": "grant", "label": "Grant route", "funding_type": "grant"}],
                )
            ],
        }

        match = sort_universities_ai([university], profile={"studyLevel": "Bachelor"})[0]["matchData"]

        self.assertTrue(match["aidAny"])
        self.assertIsNone(match["aidEligible"])
        self.assertIsNone(match["grantEligible"])

    def test_mba_profile_excludes_other_masters_admission_choices(self):
        university = {
            "id": "mba-level-filter-u",
            "name": "MBA Level Filter University",
            "finance": {"total_cost_year_usd": 20000},
            "academics": {},
            "admission_categories": [
                _admission_category("mba", "Full-Time MBA", [{"id": "general", "label": "MBA"}], study_levels=["Master"], scope="graduate_business"),
                _admission_category("msc", "Master of Finance", [{"id": "general", "label": "MSc"}], study_levels=["Master"], scope="postgraduate_taught"),
            ],
        }

        result = estimate_uni_chance(university, {"studyLevel": "MBA"})

        self.assertEqual(1, len(result["choices"]))
        self.assertTrue(result["choices"][0]["choiceKey"].startswith("mba::"))

    def test_any_study_level_keeps_all_levels_and_unknown_level_matches_none(self):
        university = {
            "id": "study-level-semantics-u",
            "name": "Study Level Semantics University",
            "admission_categories": [
                _admission_category("bachelor", "Bachelor", [{"id": "general", "label": "Bachelor"}], study_levels=["Bachelor"]),
                _admission_category("master", "Master", [{"id": "general", "label": "Master"}], study_levels=["Master"]),
            ],
        }

        any_result = estimate_uni_chance(university, {"studyLevel": "Any"})
        unknown_result = estimate_uni_chance(university, {"studyLevel": "Unrecognized level"})

        self.assertEqual({"bachelor::general", "master::general"}, {row["choiceKey"] for row in any_result["choices"]})
        self.assertEqual([], unknown_result["choices"])
        self.assertEqual("no_choices", unknown_result["reason"])

    def test_any_level_does_not_turn_mit_admitted_scores_into_a_fit_score(self):
        # MIT publishes admitted-score distributions here, but no first-year minimums.
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        profile = {
            "budget": 100000,
            "gpa": 3.9,
            "exams": [{"id": "SAT", "score": 1550}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
        }

        result = estimate_uni_chance(mit, profile)
        self.assertEqual("published_requirements_met_percent", result["scoreMeaning"])
        self.assertIsNone(result["overallChance"])
        self.assertTrue(all(row["chancePercent"] is None for row in result["choices"]))
        self.assertTrue(all(row["reason"] in {"no_published_requirements", "unassessed_minimums", "requirements_not_reviewed"} for row in result["choices"]))

    def test_master_level_uses_legacy_scope_and_does_not_reactivate_saved_bachelor_choice(self):
        university = {
            "id": "legacy-level-scope-u",
            "name": "Legacy Level Scope University",
            "admission_categories": [
                _admission_category("bachelor", "Bachelor", [{"id": "general", "label": "Bachelor"}], scope={"level": "bachelor", "type": "general"}),
                _admission_category("master", "Master", [{"id": "general", "label": "Master"}], scope={"level": "graduate", "type": "taught"}),
            ],
        }
        profile = {
            "studyLevel": "Master",
            "selectedAdmissionChoices": {"legacy-level-scope-u": _choice_selection("bachelor::general")},
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual(["master::general"], [row["choiceKey"] for row in result["choices"]])
        self.assertEqual("master::general", result["bestChoiceKey"])
        self.assertFalse(result["selectedByUser"])

    def test_mit_top_five_result_ignores_saved_off_level_choice(self):
        from app.services.university_tracks import expand_admission_choices

        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        self.assertIsNotNone(mit)
        bachelor_choice = next(
            choice
            for choice in expand_admission_choices(mit.get("admission_categories"))
            if choice.get("category_id") == "mit_regular"
        )
        profile = {
            "studyLevel": "Master",
            "selectedAdmissionChoices": {
                "mit-usa-cambridge": _choice_selection(bachelor_choice.get("choice_key")),
            },
        }

        chance = estimate_uni_chance(mit, profile)
        top_five = sort_universities_ai([mit], profile=profile, budget_vs_prestige=100)
        match_data = top_five[0].get("matchData", {})

        self.assertTrue(chance["choices"])
        self.assertTrue(all("bachelor" not in str(row.get("choiceKey")).lower() for row in chance["choices"]))
        self.assertNotEqual(bachelor_choice.get("choice_key"), chance.get("bestChoiceKey"))
        self.assertNotEqual(bachelor_choice.get("choice_key"), match_data.get("selectedChoiceKey"))
        self.assertFalse(match_data.get("selectedByUser"))

    def test_oxford_computer_science_range_keeps_gbp_and_no_fake_scalar_price(self):
        from app.services.university_tracks import expand_admission_choices

        oxford = uni_service.get_university_by_id("university-of-oxford-uk-oxford")
        self.assertIsNotNone(oxford)
        choice = next(
            row
            for row in expand_admission_choices(oxford.get("admission_categories"))
            if row.get("category_id") == "university_of_oxford_uk_oxford_computer_science_undergraduate"
            and row.get("funding_type") == "paid"
        )
        profile = {
            "studyLevel": "Bachelor",
            "selectedAdmissionChoices": {
                oxford["id"]: _choice_selection(choice.get("choice_key")),
            },
        }

        with patch(
            "app.services.currency.convert",
            side_effect=lambda amount, source, target: float(amount) * 2.0,
        ):
            result = sort_universities_ai([oxford], profile=profile)[0]["matchData"]

        self.assertEqual("on-campus_range", result["costMode"])
        self.assertIsNone(result["finalPrice"])
        self.assertIsNone(result["finalPriceUSD"])
        self.assertIsNone(result["costYearNative"])
        self.assertIsNone(result["costYearUSD"])
        self.assertEqual(
            {
                "minNative": 79855.0,
                "maxNative": 86155.0,
                "currency": "GBP",
                "minUSD": 159710.0,
                "maxUSD": 172310.0,
                "academicYear": "2027-28",
                "feeStatus": "overseas",
                "scope": "program",
                "source": "Oxford Computer Science course page",
                "sourceUrl": "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science",
                "sourceUrls": [
                    "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science",
                    "https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/living-costs",
                ],
            },
            result["costRange"],
        )

    def test_unconvertible_range_keeps_native_bounds_and_leaves_usd_unknown(self):
        from app.services.university_tracks import expand_admission_choices

        oxford = uni_service.get_university_by_id("university-of-oxford-uk-oxford")
        self.assertIsNotNone(oxford)
        choice = next(
            row
            for row in expand_admission_choices(oxford.get("admission_categories"))
            if row.get("category_id") == "university_of_oxford_uk_oxford_computer_science_undergraduate"
            and row.get("funding_type") == "paid"
        )
        profile = {
            "studyLevel": "Bachelor",
            "selectedAdmissionChoices": {
                oxford["id"]: _choice_selection(choice.get("choice_key")),
            },
        }

        with patch("app.services.currency.convert", side_effect=ValueError("unsupported currency")):
            result = sort_universities_ai([oxford], profile=profile)[0]["matchData"]

        cost_range = result["costRange"]
        self.assertEqual(79855.0, cost_range["minNative"])
        self.assertEqual(86155.0, cost_range["maxNative"])
        self.assertEqual("GBP", cost_range["currency"])
        self.assertIsNone(cost_range["minUSD"])
        self.assertIsNone(cost_range["maxUSD"])

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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ]),
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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ]),
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
        self.assertEqual("requirements_fit", str(result[0]["matchData"].get("selectedChanceType", "")))

    def test_ai_sort_falls_back_to_hard_score_when_ml_unavailable(self):
        items = [
            {
                "id": "u1",
                "name": "University One",
                "rank": 100,
                "finance": {"total_cost_year_usd": 30000, "financial_aid": {"merit_based": False, "need_based": False}},
                "academics": {"acceptance_rate_percent": 45},
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ]),
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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "default",
                        "label": "Default",
                        "requirements": {},
                        "stats_avg": {},
                        "scholarships": [],
                    }
                ]),
            }
        ]
        profile = {"budget": 40000, "interests": "хочу ai", "locale": "rus"}
        fake_ml = Mock()
        fake_ml.predict_relevance.return_value = {"u1": 0.5}

        with patch(
            "app.services.ai_scoring.get_ml_runtime_status",
            return_value={"available": True, "message": ""},
        ), patch(
            "app.services.ai_scoring.get_ml_recommender",
            return_value=fake_ml,
        ):
            sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")

        fake_ml.predict_relevance.assert_called_once_with("хочу ai")

    def test_uni_chance_scores_published_minimum_checks_only(self):
        university = {
            "id": "u-requirements-fit",
            "admission_categories": [{
                "id": "first-year",
                "requirement_profiles": [{
                    "id": "general",
                    "requirements": {"GPA": 3.0, "SAT": 1200},
                    "score_profile": _demo_score_profile("SAT", p25=50, median=70, p75=90, acceptance_rate_percent=1),
                    "funding_options": [
                        {"id": "paid", "funding_type": "paid"},
                        {"id": "grant", "funding_type": "grant", "requirements": {"GPA": 4.0, "SAT": 1600}},
                    ],
                }],
            }],
        }
        profile = {
            "gpa": 3.5,
            "budget": 1000,
            "exams": [{"id": "SAT", "score": 1100}],
        }

        result = _estimate_uni_chance(university, profile)
        self.assertEqual(50, result["overallChance"])
        self.assertEqual("published_requirements_met_percent", result["scoreMeaning"])
        self.assertNotIn("confidence", result)
        self.assertNotIn("rangeLowPercent", result)
        self.assertNotIn("rangeHighPercent", result)
        self.assertEqual({50}, {choice["chancePercent"] for choice in result["choices"]})
        self.assertTrue(all(choice["scoreMeaning"] == result["scoreMeaning"] for choice in result["choices"]))

        zero = _estimate_uni_chance(university, {
            **profile,
            "gpa": 2.0,
            "exams": [{"id": "SAT", "score": 1000}],
        })
        self.assertEqual(0, zero["overallChance"])

    def test_mit_first_year_has_no_fit_score_without_published_minimums(self):
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        result = _estimate_uni_chance(mit, {
            "studyLevel": "bachelor",
            "exams": [{"id": "SAT", "score": 1560}],
            "selectedAdmissionChoices": {
                mit["id"]: {"programId": "mit-course-6-3-bachelor"},
            },
        })
        first_year = [choice for choice in result["choices"] if choice["categoryId"] == "mit_regular"]
        self.assertTrue(first_year)
        self.assertIsNone(result["overallChance"])
        self.assertTrue(all(choice["chancePercent"] is None for choice in first_year))
        self.assertTrue(all(choice["reason"] == "no_published_requirements" for choice in first_year))
        self.assertEqual("published_requirements_met_percent", result["scoreMeaning"])

    def test_mit_course_6_9p_published_gpa_minimums_are_reported_unassessed(self):
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        result = _estimate_uni_chance(mit, {
            "studyLevel": "master",
            "selectedAdmissionChoices": {
                mit["id"]: {"programId": "mit-course-6-9p-meng"},
            },
        })
        self.assertIsNone(result["overallChance"])
        self.assertEqual("unassessed_minimums", result["reason"])
        self.assertIn("cannot be assessed", result["label"])
        self.assertEqual("mit_bcs_meng_admissions", result["categoryId"])

    def test_new_mit_graduate_route_does_not_claim_absent_minimums(self):
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        result = _estimate_uni_chance(mit, {
            "studyLevel": "master",
            "selectedAdmissionChoices": {
                mit["id"]: {"programId": "mit-aero-sm"},
            },
        })
        self.assertIsNone(result["overallChance"])
        self.assertEqual("requirements_not_reviewed", result["reason"])
        self.assertEqual("mit_grad_aero_admissions", result["categoryId"])

    def test_uni_chance_counts_language_minimum_and_requires_its_evidence(self):
        university = {
            "id": "u-language-fit",
            "admission_categories": [{
                "id": "first-year",
                "language_requirements": [{"code": "en", "requirements": {"IELTS": 7.0}}],
                "requirement_profiles": [{"id": "general", "requirements": {"GPA": 3.0}}],
            }],
        }
        result = _estimate_uni_chance(university, {
            "gpa": 3.5,
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
        })
        self.assertEqual(50, result["overallChance"])

        missing = _estimate_uni_chance(university, {"gpa": 3.5})
        self.assertIsNone(missing["overallChance"])
        self.assertEqual("missing_evidence", missing["reason"])

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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.52, "SAT": 1250},
                    "stats_avg": {"GPA": 3.72, "SAT": 1420},
                    "score_profile": _demo_score_profile("SAT", p25=68, median=82, p75=93, acceptance_rate_percent=45),
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "min_cefr": 4, "accept_native": True}
                    ],
                }
            ]),
        }
        profile = {
            "gpa": 3.68,
            "budget": 20000,
            "exams": [{"id": "SAT", "score": 1360}],
            "languages": [{"code": "en", "kind": "native"}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertIn("overallChance", result)
        self.assertIn("choices", result)
        self.assertIn("bestChoiceLabel", result)
        self.assertFalse(result.get("missingEvidence", True))
        self.assertGreaterEqual(int(result.get("overallChance", 0)), 0)
        self.assertLessEqual(int(result.get("overallChance", 0)), 100)
        self.assertGreaterEqual(len(result.get("choices", [])), 1)

    def test_estimate_uni_chance_returns_machine_readable_factors(self):
        university = {
            "id": "factor-u",
            "name": "Factor University",
            "rank": 100,
            "finance": {
                "total_cost_year_usd": 12000,
                "financial_aid": {"merit_based": True, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 45},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.52, "SAT": 1250},
                    "stats_avg": {"GPA": 3.72, "SAT": 1420},
                    "score_profile": _demo_score_profile("SAT", p25=68, median=82, p75=93, acceptance_rate_percent=45),
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "min_cefr": 4, "accept_native": True}
                    ],
                }
            ]),
        }
        profile = {
            "locale": "rus",
            "gpa": 3.68,
            "budget": 20000,
            "exams": [{"id": "SAT", "score": 1360}],
            "languages": [{"code": "en", "kind": "native"}],
        }

        result = estimate_uni_chance(university, profile)
        choices = result.get("choices") or []
        self.assertTrue(choices)
        factors = choices[0].get("factors") or []
        self.assertTrue(factors)

        allowed_statuses = {"positive", "negative", "neutral"}
        allowed_severities = {"low", "medium", "high"}
        for factor in factors:
            with self.subTest(factor=factor):
                self.assertIsInstance(factor.get("key"), str)
                self.assertTrue(factor.get("key"))
                self.assertIn(factor.get("status"), allowed_statuses)
                self.assertIsInstance(factor.get("label"), str)
                self.assertIsInstance(factor.get("message"), str)
                self.assertIn(factor.get("severity"), allowed_severities)
                self.assertNotIn("impact_pct", factor)
                self.assertNotIn("impact_text", factor)
                self.assertTrue(str(factor.get("label", "")).isascii())
                self.assertTrue(str(factor.get("message", "")).isascii())

    def test_estimate_uni_chance_does_not_apply_country_level_penalty_without_data_flag(self):
        university = {
            "id": "uk-no-explicit-penalty-u",
            "name": "UK No Explicit Penalty University",
            "country": "UK",
            "rank": 100,
            "finance": {
                "total_cost_year_usd": 12000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 45},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.2},
                    "stats_avg": {"GPA": 3.52},
                    "score_profile": _demo_score_profile("GPA", p25=60, median=75, p75=90, acceptance_rate_percent=45),
                }
            ]),
        }
        profile = {"locale": "eng", "gpa": 3.8, "budget": 25000}

        result = estimate_uni_chance(university, profile)
        choice = (result.get("choices") or [{}])[0]

        self.assertGreater(int(choice.get("chancePercent") or 0), 0)
        self.assertNotIn("foundation_required", choice.get("badges") or [])
        self.assertNotIn("need_aware", choice.get("badges") or [])

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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "safe",
                    "label": "Safe Track",
                    "requirements": {"GPA": 3.0},
                    "stats_avg": {"GPA": 3.28},
                    "score_profile": _demo_score_profile("GPA", p25=58, median=72, p75=84, acceptance_rate_percent=50),
                },
                {
                    "id": "stretch",
                    "label": "Stretch Track",
                    "requirements": {"GPA": 3.8},
                    "stats_avg": {"GPA": 3.92},
                    "score_profile": _demo_score_profile("GPA", p25=78, median=92, p75=97, acceptance_rate_percent=50),
                },
            ]),
        }
        profile = {
            "gpa": 3.68,
            "budget": 25000,
            "selectedAdmissionChoices": {"manual-track-u": _choice_selection("stretch::stretch")},
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual("stretch::stretch", str(result.get("bestChoiceKey", "")))
        self.assertEqual("safe::safe", str(result.get("recommendedChoiceKey", "")))
        self.assertTrue(bool(result.get("selectedByUser")))
        self.assertEqual("user", str(result.get("choiceSelectionSource", "")))

    def test_published_minimums_are_scoreable_without_admitted_score_profile(self):
        university = {
            "id": "no-score-profile-u",
            "name": "No Score Profile University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.2},
                    "stats_avg": {"GPA": 3.52},
                }
            ]),
        }
        profile = {"locale": "rus", "gpa": 3.68, "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertEqual(100, result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))
        self.assertNotIn("chanceModel", result)
        self.assertNotIn("confidence", result)
        self.assertEqual("", str(result.get("reason") or ""))

    def test_estimate_uni_chance_returns_unavailable_without_any_required_evidence(self):
        university = {
            "id": "missing-evidence-u",
            "name": "Missing Evidence University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.2},
                    "stats_avg": {"GPA": 3.52},
                }
            ]),
        }
        profile = {"locale": "rus", "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("missing_evidence", str(result.get("reason") or ""))

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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {},
                    "stats_avg": {},
                }
            ]),
        }
        profile = {"locale": "rus", "budget": 25000}

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("no_published_requirements", str(result.get("reason") or ""))

    def test_requirement_fit_counts_met_and_unmet_exam_minimums(self):
        university = {
            "id": "below-min-fallback-u",
            "name": "Below Min Fallback University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.2, "SAT": 1300},
                    "stats_avg": {"GPA": 3.52, "SAT": 1420},
                }
            ]),
        }
        profile = {
            "locale": "rus",
            "budget": 25000,
            "gpa": 3.68,
            "exams": [{"id": "SAT", "score": 1200}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertEqual(50, result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))

    def test_fit_is_unavailable_when_required_language_evidence_is_missing(self):
        university = {
            "id": "missing-lang-fallback-u",
            "name": "Missing Lang Fallback University",
            "rank": 90,
            "finance": {
                "total_cost_year_usd": 18000,
                "financial_aid": {"merit_based": False, "need_based": False},
            },
            "academics": {"acceptance_rate_percent": 42},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "main",
                    "label": "Main Track",
                    "requirements": {"GPA": 3.2, "SAT": 1300},
                    "stats_avg": {"GPA": 3.52, "SAT": 1420},
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 7.0}}
                    ],
                }
            ]),
        }
        profile = {
            "locale": "rus",
            "budget": 25000,
            "gpa": 3.68,
            "exams": [{"id": "SAT", "score": 1380}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("missing_evidence", str(result.get("reason") or ""))

    def test_estimate_uni_chance_uses_real_dataset_score_profiles_for_nu(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        sat_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 3.68,
            "exams": [{"id": "SAT", "score": 1480}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
            "selectedAdmissionChoices": {"nazarbayev-university-kaz-astana": _choice_selection("nu_regular_undergraduate::nu_sat_applicants::nu_sat_applicants")},
        }
        act_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 3.68,
            "exams": [{"id": "ACT", "score": 31}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
            "selectedAdmissionChoices": {"nazarbayev-university-kaz-astana": _choice_selection("nu_regular_undergraduate::nu_act_applicants::nu_act_applicants")},
        }
        nuet_profile = {
            "locale": "rus",
            "budget": 15000,
            "gpa": 3.68,
            "exams": [{"id": "NUET", "score": 195}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
            "selectedAdmissionChoices": {"nazarbayev-university-kaz-astana": _choice_selection("nu_regular_undergraduate::nu_nuet_undergraduate::nu_nuet_undergraduate")},
        }

        sat_result = estimate_uni_chance(university, sat_profile)
        act_result = estimate_uni_chance(university, act_profile)
        nuet_result = estimate_uni_chance(university, nuet_profile)

        self.assertIsNotNone(sat_result.get("overallChance"))
        self.assertTrue(bool(sat_result.get("chanceAvailable")))
        self.assertEqual("nu_regular_undergraduate::nu_sat_applicants::nu_sat_applicants", str(sat_result.get("bestChoiceKey") or ""))
        self.assertEqual("published_requirements_met_percent", sat_result.get("scoreMeaning"))

        self.assertIsNotNone(act_result.get("overallChance"))
        self.assertTrue(bool(act_result.get("chanceAvailable")))
        self.assertEqual("nu_regular_undergraduate::nu_act_applicants::nu_act_applicants", str(act_result.get("bestChoiceKey") or ""))
        self.assertEqual("published_requirements_met_percent", act_result.get("scoreMeaning"))

        self.assertIsNotNone(nuet_result.get("overallChance"))
        self.assertTrue(bool(nuet_result.get("chanceAvailable")))
        self.assertEqual("nu_regular_undergraduate::nu_nuet_undergraduate::nu_nuet_undergraduate", str(nuet_result.get("bestChoiceKey") or ""))

    def test_estimate_uni_chance_uses_cuhk_weighted_total_score_profile(self):
        university = uni_service.get_university_by_id("cuhk-hk-shatin")
        self.assertIsNotNone(university)

        profile = {
            "locale": "eng",
            "budget": 60000,
            "gpa": 3.6,
            "exams": [{"id": "HKDSE_WEIGHTED_TOTAL", "score": 43.0}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
            "selectedAdmissionChoices": {"cuhk-hk-shatin": _choice_selection("cuhk_hkdse::cuhk_hkdse")},
        }

        result = estimate_uni_chance(university, profile)

        self.assertIsNone(result.get("overallChance"))
        self.assertFalse(bool(result.get("chanceAvailable")))
        self.assertEqual("cuhk_hkdse::cuhk_hkdse", str(result.get("bestChoiceKey") or ""))
        self.assertEqual("missing_evidence", result.get("reason"))

    def test_estimate_uni_chance_accepts_raw_a_level_grades(self):
        university = {
            "id": "u-alevel-profile",
            "name": "A-Level Profile University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 12000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_categories": _categories_from_requirement_profiles([
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
            ]),
        }
        profile = {
            "budget": 25000,
            "exams": [
                {
                    "id": "A_LEVEL_CERT",
                    "details": {
                        "components": [
                            {"exam": "A_LEVEL_MATHEMATICS", "raw_value": "A*", "score": 6},
                            {"exam": "A_LEVEL_PHYSICS", "raw_value": "A*", "score": 6},
                            {"exam": "A_LEVEL_CHEMISTRY", "raw_value": "A", "score": 5}
                        ]
                    },
                }
            ],
            "languages": [{"code": "en", "kind": "native"}],
        }

        result = estimate_uni_chance(university, profile)

        self.assertIsNotNone(result.get("overallChance"))
        self.assertTrue(bool(result.get("chanceAvailable")))
        self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))

    def test_published_minimum_fit_ignores_acceptance_and_admitted_score_statistics(self):
        base_track = {
            "id": "profile-track",
            "label": "Profile Track",
            "requirements": {"GPA": 3.2},
            "stats_avg": {"GPA": 3.6},
        }
        university_low = {
            "id": "u-low-acc",
            "name": "Low Acceptance University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 1},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=50, median=65, p75=80, acceptance_rate_percent=1),
                }
            ]),
        }
        university_high = {
            "id": "u-high-acc",
            "name": "High Acceptance University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 95},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=50, median=65, p75=80, acceptance_rate_percent=95),
                }
            ]),
        }
        profile = {"gpa": 4.0, "budget": 20000}

        low_result = estimate_uni_chance(university_low, profile)
        high_result = estimate_uni_chance(university_high, profile)

        self.assertEqual(100, low_result.get("overallChance"))
        self.assertEqual(low_result.get("overallChance"), high_result.get("overallChance"))

    def test_requirements_fit_ignores_acceptance_rate_without_score_profile(self):
        base_track = {
            "id": "fallback-track",
            "label": "Fallback Track",
            "requirements": {"GPA": 3.2},
            "stats_avg": {"GPA": 3.6},
        }
        university_low = {
            "id": "u-low-fallback",
            "name": "Low Acceptance Fallback University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 1},
            "admission_categories": _categories_from_requirement_profiles([{**base_track}]),
        }
        university_high = {
            "id": "u-high-fallback",
            "name": "High Acceptance Fallback University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 95},
            "admission_categories": _categories_from_requirement_profiles([{**base_track}]),
        }
        profile = {"gpa": 4.0, "budget": 20000}

        low_result = estimate_uni_chance(university_low, profile)
        high_result = estimate_uni_chance(university_high, profile)

        self.assertEqual(100, low_result.get("overallChance"))
        self.assertEqual(low_result.get("overallChance"), high_result.get("overallChance"))

    def test_requirements_fit_ignores_acceptance_and_admitted_distribution(self):
        track = {
            "id": "doctoral-track",
            "label": "Doctoral Track",
            "requirements": {"GPA": 3.0},
        }
        low = {
            "id": "doctoral-low-rate",
            "academics": {"acceptance_rate_percent": 4.56},
            "admission_categories": _categories_from_requirement_profiles([
                {**track, "score_profile": _demo_score_profile("GPA", p25=50, median=65, p75=80)}
            ]),
        }
        high = {
            "id": "doctoral-high-rate",
            "academics": {"acceptance_rate_percent": 95},
            "admission_categories": _categories_from_requirement_profiles([
                {**track, "score_profile": _demo_score_profile("GPA", p25=80, median=90, p75=99)}
            ]),
        }
        profile = {"gpa": 3.5}
        self.assertEqual(100, estimate_uni_chance(low, profile).get("overallChance"))
        self.assertEqual(
            estimate_uni_chance(low, profile).get("overallChance"),
            estimate_uni_chance(high, profile).get("overallChance"),
        )

    def test_mit_graduate_chance_and_unifit_do_not_use_generic_undergraduate_fallback(self):
        import copy

        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        self.assertIsNotNone(mit)
        profile = {
            "studyLevel": "Doctorate",
            "budget": 100000,
            "gpa": 3.9,
            "exams": [{"id": "GRE", "score": 330}],
        }

        chance = estimate_uni_chance(mit, profile)
        self.assertTrue(chance["choices"])
        self.assertTrue(all(not choice["chanceAvailable"] for choice in chance["choices"]))
        self.assertTrue(all(choice["chancePercent"] is None for choice in chance["choices"]))
        self.assertTrue(all(choice["reason"] in {"no_published_requirements", "requirements_not_reviewed"} for choice in chance["choices"]))

        without_rate = copy.deepcopy(mit)
        without_rate["academics"].pop("acceptance_rate_percent", None)
        with_rate_match = sort_universities_ai([mit], profile=profile, budget_vs_prestige=100)[0]["matchData"]
        without_rate_match = sort_universities_ai([without_rate], profile=profile, budget_vs_prestige=100)[0]["matchData"]
        self.assertEqual(with_rate_match["preferenceMismatch"], without_rate_match["preferenceMismatch"])
        self.assertEqual(with_rate_match["finalScore"], without_rate_match["finalScore"])

        fallback_with_rate = copy.deepcopy(mit)
        fallback_with_rate["id"] = "mit-graduate-factor-fallback"
        fallback_with_rate["factors"].pop("social_vs_hardcore", None)
        fallback_without_rate = copy.deepcopy(fallback_with_rate)
        fallback_without_rate["id"] = "mit-graduate-factor-fallback-no-rate"
        fallback_without_rate["academics"].pop("acceptance_rate_percent", None)
        with_rate_factors = sort_universities_ai(
            [fallback_with_rate], profile=profile, budget_vs_prestige=100
        )[0]["matchData"]["factors"]
        without_rate_factors = sort_universities_ai(
            [fallback_without_rate], profile=profile, budget_vs_prestige=100
        )[0]["matchData"]["factors"]
        self.assertEqual(with_rate_factors["social_vs_hardcore"], without_rate_factors["social_vs_hardcore"])

    def test_score_profile_admitted_distribution_does_not_change_minimum_fit(self):
        base_track = {
            "id": "calibrated-track",
            "label": "Calibrated Track",
            "requirements": {"GPA": 3.2},
            "stats_avg": {"GPA": 3.6},
        }
        university_fallback = {
            "id": "u-fallback-calibrated",
            "name": "Fallback Calibrated University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_categories": _categories_from_requirement_profiles([{**base_track}]),
        }
        university_profile = {
            "id": "u-profile-calibrated",
            "name": "Profile Calibrated University",
            "rank": 50,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    **base_track,
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=40),
                }
            ]),
        }
        profile = {"gpa": 3.4, "budget": 20000}

        fallback_result = estimate_uni_chance(university_fallback, profile)
        profile_result = estimate_uni_chance(university_profile, profile)

        self.assertEqual(100, fallback_result.get("overallChance"))
        self.assertEqual(fallback_result.get("overallChance"), profile_result.get("overallChance"))

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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "eth_direct",
                    "label": "Direct Entry",
                    "requirements": {"GPA": 3.6},
                    "stats_avg": {"GPA": 3.84},
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
            ]),
        }

        profile_de_b2 = {
            "gpa": 3.72,
            "budget": 30000,
            "languages": [{"code": "de", "kind": "cefr", "level": 4}],
        }
        profile_de_c1 = {
            "gpa": 3.72,
            "budget": 30000,
            "languages": [{"code": "de", "kind": "cefr", "level": 5}],
        }

        chance_b2 = estimate_uni_chance(university, profile_de_b2)
        chance_c1 = estimate_uni_chance(university, profile_de_c1)

        self.assertEqual(50, chance_b2.get("overallChance"))
        self.assertEqual(100, chance_c1.get("overallChance"))

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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "safe",
                        "label": "Safe Track",
                        "requirements": {"GPA": 3.0},
                        "stats_avg": {"GPA": 3.28},
                        "score_profile": _demo_score_profile("GPA", p25=58, median=72, p75=84, acceptance_rate_percent=45),
                        "finance_override": {"total_cost_year_usd": 22000},
                    },
                    {
                        "id": "stretch",
                        "label": "Stretch Track",
                        "requirements": {"GPA": 3.8},
                        "stats_avg": {"GPA": 3.92},
                        "score_profile": _demo_score_profile("GPA", p25=78, median=92, p75=97, acceptance_rate_percent=45),
                        "finance_override": {"total_cost_year_usd": 12000},
                    },
                ]),
            }
        ]
        profile_auto = {"gpa": 3.68, "budget": 30000}
        profile_manual = {
            "gpa": 3.68,
            "budget": 30000,
            "selectedAdmissionChoices": {"u-manual": _choice_selection("stretch::stretch")},
        }

        auto_result = sort_universities_ai(items, profile=profile_auto, budget_vs_prestige=100, funding_type="any")
        manual_result = sort_universities_ai(items, profile=profile_manual, budget_vs_prestige=100, funding_type="any")

        auto_match = auto_result[0].get("matchData", {})
        manual_match = manual_result[0].get("matchData", {})

        self.assertEqual("safe::safe", str(auto_match.get("choiceKey", "")))
        self.assertEqual("stretch::stretch", str(manual_match.get("choiceKey", "")))
        self.assertEqual("safe::safe", str(manual_match.get("recommendedChoiceKey", "")))
        self.assertTrue(bool(manual_match.get("selectedByUser")))
        self.assertEqual("user", str(manual_match.get("choiceSelectionSource", "")))
        self.assertEqual(0, manual_match.get("selectedChance"))
        self.assertIsNotNone(auto_match.get("selectedChance"))

    def test_jlpt_uses_best_lower_score_when_duplicate_exam_entries_exist(self):
        university = {
            "id": "jp-demo",
            "name": "JP Demo",
            "rank": 80,
            "finance": {"total_cost_year_usd": 10000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 60},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "jp-track",
                    "label": "JP Track",
                    "requirements": {"JLPT_N": 2},
                    "stats_avg": {"JLPT_N": 2},
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=60),
                }
            ]),
        }
        profile_worse_only = {
            "gpa": 3.6,
            "budget": 20000,
            "exams": [{"id": "JLPT_N", "score": 3}],
        }
        profile_with_better_duplicate = {
            "gpa": 3.6,
            "budget": 20000,
            "exams": [
                {"id": "JLPT_N", "score": 3},
                {"id": "JLPT_N", "score": 1},
            ],
        }

        chance_worse = estimate_uni_chance(university, profile_worse_only)
        chance_better = estimate_uni_chance(university, profile_with_better_duplicate)

        self.assertEqual(0, chance_worse.get("overallChance"))
        self.assertEqual(0, chance_worse.get("overallChance"))
        self.assertEqual(100, chance_better.get("overallChance"))

    def test_unichance_keeps_missing_required_language_evidence_unavailable(self):
        university = {
            "id": "conditional-demo",
            "name": "Conditional Demo University",
            "rank": 120,
            "finance": {"total_cost_year_usd": 16000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 45},
            "admission_categories": _categories_from_requirement_profiles([
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
            ]),
        }
        profile = {
            "budget": 25000,
            "exams": [{"id": "UNT", "score": 125}],
            "languages": [],
        }

        chance = estimate_uni_chance(university, profile)
        self.assertIsNone(chance.get("overallChance"))
        self.assertFalse(bool(chance.get("chanceAvailable")))
        self.assertEqual("missing_evidence", str(chance.get("reason") or ""))
        track = (chance.get("choices") or [{}])[0]
        self.assertTrue(bool(track.get("conditional")))
        self.assertIsNone(track.get("chancePercent"))
        self.assertGreaterEqual(int((track.get("details") or {}).get("measurableRequirements", 0)), 1)

    def test_ai_sort_does_not_mark_requirements_met_when_required_exam_is_missing(self):
        university = {
            "id": "conditional-sort-demo",
            "name": "Conditional Sort University",
            "rank": 120,
            "finance": {"total_cost_year_usd": 16000, "financial_aid": {"merit_based": False, "need_based": False}},
            "academics": {"acceptance_rate_percent": 45},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "track-main",
                    "label": "Main Track",
                    "requirements": {"UNT": 110},
                    "stats_avg": {"UNT": 120},
                }
            ]),
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
                "admission_categories": _categories_from_requirement_profiles([{"id": "t1", "label": "Default", "requirements": {}, "stats_avg": {}}]),
            }
        ]
        profile = {"budget": 12000, "studyMode": "Online"}

        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")
        match = result[0].get("matchData", {})

        self.assertAlmostEqual(10000.0, float(match.get("costYearUSD", 0.0)), places=6)
        self.assertAlmostEqual(10000.0, float(match.get("finalPrice", 0.0)), places=6)
        self.assertEqual("online_tuition_only", str(match.get("costMode")))

    def test_uni_chance_fit_is_independent_of_study_mode_and_cost(self):
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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "track-1",
                    "label": "Default",
                    "requirements": {"GPA": 3.2},
                    "stats_avg": {"GPA": 3.6},
                    "score_profile": _demo_score_profile("GPA", p25=55, median=70, p75=85, acceptance_rate_percent=40),
                }
            ]),
        }
        profile_oncampus = {"gpa": 3.4, "budget": 12000, "studyMode": "On-campus"}
        profile_online = {"gpa": 3.4, "budget": 12000, "studyMode": "Online"}

        chance_oncampus = estimate_uni_chance(university, profile_oncampus)
        chance_online = estimate_uni_chance(university, profile_online)

        self.assertEqual(chance_oncampus.get("overallChance"), chance_online.get("overallChance"))
        self.assertEqual("published_requirements_met_percent", chance_online.get("scoreMeaning"))
        self.assertNotIn("affordability", (chance_online.get("choices") or [{}])[0].get("details", {}))

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
                "admission_categories": _categories_from_requirement_profiles([{"id": "t1", "label": "Default", "requirements": {}, "stats_avg": {}}]),
            }
        ]
        profile = {"budget": 1000, "studyMode": "Online"}

        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")
        match = result[0].get("matchData", {})

        self.assertIsNone(match.get("costYearUSD"))
        self.assertIsNone(match.get("finalPrice"))
        self.assertEqual("online_missing_tuition", str(match.get("costMode")))

    def test_ai_sort_preserves_sticker_price_for_grant_track_without_verified_net_price(self):
        items = [
            {
                "id": "u-kzt-test",
                "name": "Kazakhstan Test University",
                "rank": 200,
                "finance": {
                    "currency": "KZT",
                    "total_cost_year_usd": 2000000,
                    "costs_breakdown_year_usd": {
                        "Tuition": 1950000,
                        "Student_Fees": 50000,
                    },
                    "financial_aid": {"merit_based": True, "need_based": False},
                },
                "academics": {"acceptance_rate_percent": 50},
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "t-kzt-grant",
                        "label": "Grant Track",
                        "funding_type": "grant",
                        "requirements": {},
                        "stats_avg": {},
                    }
                ]),
            }
        ]
        profile = {"budget": 10000, "studyMode": "On-campus"}
        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="grant")
        match = result[0].get("matchData", {})

        self.assertEqual("KZT", match.get("currency"))
        self.assertAlmostEqual(2000000.0, float(match.get("finalPrice", 0.0)), places=2)
        self.assertAlmostEqual(2000000.0, float(match.get("costYearNative", 0.0)), places=2)
        self.assertGreater(float(match.get("costYearUSD", 0.0)), 4000.0)
        self.assertAlmostEqual(float(match.get("costYearUSD", 0.0)), float(match.get("finalPriceUSD", 0.0)), places=6)

    def test_ai_sort_empty_choices_preserves_native_cost_and_currency(self):
        items = [
            {
                "id": "u-kzt-no-choices",
                "name": "Kazakhstan No Choices University",
                "rank": 200,
                "finance": {
                    "currency": "KZT",
                    "total_cost_year_usd": 2000000,
                    "financial_aid": {"merit_based": False, "need_based": False},
                },
                "academics": {"acceptance_rate_percent": 50},
                "admission_categories": [],
            }
        ]
        profile = {"budget": 10000, "studyMode": "On-campus"}
        result = sort_universities_ai(items, profile=profile, budget_vs_prestige=50, funding_type="any")
        match = result[0].get("matchData", {})

        self.assertEqual("KZT", match.get("currency"))
        self.assertAlmostEqual(2000000.0, float(match.get("finalPrice", 0.0)), places=2)
        self.assertAlmostEqual(2000000.0, float(match.get("costYearNative", 0.0)), places=2)
        self.assertGreater(float(match.get("costYearUSD", 0.0)), 4000.0)
        self.assertGreater(float(match.get("finalPriceUSD", 0.0)), 4000.0)

    def test_budget_preference_slider_does_not_switch_requirement_fit_meaning(self):
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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "paid-easy",
                        "label": "Paid Easy",
                        "funding_type": "paid",
                        "requirements": {"GPA": 2.8},
                        "stats_avg": {"GPA": 3.12},
                        "score_profile": _demo_score_profile("GPA", p25=45, median=60, p75=75, acceptance_rate_percent=40),
                    }
                ]),
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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "grant-medium",
                        "label": "Grant Medium",
                        "funding_type": "grant",
                        "requirements": {"GPA": 3.28},
                        "stats_avg": {"GPA": 3.52},
                        "score_profile": _demo_score_profile("GPA", p25=55, median=72, p75=84, acceptance_rate_percent=40),
                    }
                ]),
            },
        ]
        profile = {"gpa": 3.6, "budget": 40000, "studyMode": "On-campus"}

        grant_mode = sort_universities_ai(items, profile=profile, budget_vs_prestige=0, funding_type="any")
        general_mode = sort_universities_ai(items, profile=profile, budget_vs_prestige=100, funding_type="any")

        self.assertEqual("requirements_fit", str((grant_mode[0].get("matchData") or {}).get("selectedChanceType", "")))
        self.assertEqual("requirements_fit", str((general_mode[0].get("matchData") or {}).get("selectedChanceType", "")))
        fit_by_id_budget = {row["id"]: row["matchData"].get("requirementsFitPercent") for row in grant_mode}
        fit_by_id_prestige = {row["id"]: row["matchData"].get("requirementsFitPercent") for row in general_mode}
        self.assertEqual(fit_by_id_budget, fit_by_id_prestige)

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
                "admission_categories": _categories_from_requirement_profiles([{"id": "city", "label": "City", "requirements": {"GPA": 3.28}, "stats_avg": {"GPA": 3.52}}]),
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
                "admission_categories": _categories_from_requirement_profiles([{"id": "campus", "label": "Campus", "requirements": {"GPA": 3.28}, "stats_avg": {"GPA": 3.52}}]),
            },
        ]
        profile = {"gpa": 3.6, "budget": 40000, "studyMode": "On-campus"}

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
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "grant-track",
                        "label": "Grant Track",
                        "funding_type": "grant",
                        "requirements": {"GPA": 3.2},
                        "stats_avg": {"GPA": 3.6},
                        "language_requirements_mode": "all",
                        "language_requirements": [
                            {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 7.0}}
                        ],
                    }
                ]),
            }
        ]
        profile = {"gpa": 3.8, "budget": 30000}

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
        self.assertFalse((hints.get("metrics") or {}).get("selectedChanceType"))

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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "grant-track",
                    "label": "Grant Track",
                    "funding_type": "grant",
                    "requirements": {"GPA": 2.6},
                    "stats_avg": {"GPA": 3.0},
                    "score_profile": _demo_score_profile("GPA", p25=40, median=55, p75=72, acceptance_rate_percent=70),
                }
            ]),
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
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "paid-track",
                    "label": "Paid Track",
                    "funding_type": "paid",
                    "requirements": {"GPA": 2.4},
                    "stats_avg": {"GPA": 2.8},
                    "score_profile": _demo_score_profile("GPA", p25=38, median=52, p75=68, acceptance_rate_percent=75),
                }
            ]),
        }
        profile = {"gpa": 3.8, "budget": 40000}

        grant_result = sort_universities_ai([grant_item], profile=profile, budget_vs_prestige=0, funding_type="any")
        paid_result = sort_universities_ai([paid_item], profile=profile, budget_vs_prestige=100, funding_type="any")

        grant_hints = ((grant_result[0].get("matchData") or {}).get("uiBadgeHints") or {})
        paid_hints = ((paid_result[0].get("matchData") or {}).get("uiBadgeHints") or {})

        self.assertEqual("", str(grant_hints.get("finance", "")))
        self.assertEqual("", str(paid_hints.get("finance", "")))

    def test_estimate_uni_chance_flattens_compact_track_funding_options(self):
        university = {
            "id": "u-compact-funding",
            "name": "Compact Funding University",
            "rank": 70,
            "finance": {"total_cost_year_usd": 18000, "financial_aid": {"merit_based": True, "need_based": False}},
            "academics": {"acceptance_rate_percent": 40},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "direct",
                    "label": "Direct Admission",
                    "requirements": {"GPA": 3.2},
                    "stats_avg": {"GPA": 3.52},
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
            ]),
        }
        profile = {
            "gpa": 3.68,
            "fundingType": "grant",
            "exams": [{"exam": "SAT", "score": 1450}],
        }

        result = estimate_uni_chance(university, profile)

        choices = {str(row.get("fundingOptionId") or ""): row for row in result.get("choices", [])}
        self.assertEqual({"direct", "direct-grant"}, set(choices))
        self.assertEqual(choices["direct"]["chancePercent"], choices["direct-grant"]["chancePercent"])
        self.assertEqual("published_requirements_met_percent", result.get("scoreMeaning"))

    def test_estimate_uni_chance_reuses_user_context_and_lang_config(self):
        university = {
            "id": "u-ctx-test",
            "name": "Context University",
            "rank": 100,
            "finance": {"total_cost_year_usd": 25000},
            "academics": {"acceptance_rate_percent": 50},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "std",
                    "label": "Standard",
                    "funding_type": "paid",
                    "requirements": {"GPA": 3.0},
                    "stats_avg": {"GPA": 3.4},
                }
            ]),
        }
        profile = {"gpa": 3.5, "budget": 30000}
        ctx = _build_user_context(profile, {})

        result_direct = estimate_uni_chance(university, profile)
        result_with_ctx = _estimate_uni_chance(university, profile, user_context=ctx, lang_cfg={})

        self.assertEqual(result_direct.get("bestChoiceKey"), result_with_ctx.get("bestChoiceKey"))
        self.assertEqual(result_direct.get("overallChance"), result_with_ctx.get("overallChance"))

    def test_sort_universities_ai_synchronizes_recommended_track_with_unichance(self):
        items = [
            {
                "id": "u-sync-track",
                "name": "Sync Track University",
                "rank": 40,
                "finance": {"total_cost_year_usd": 20000},
                "academics": {"acceptance_rate_percent": 45},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_categories": _categories_from_requirement_profiles([
                    {
                        "id": "track-hard",
                        "label": "Hard Track",
                        "funding_type": "paid",
                        "requirements": {"GPA": 3.8},
                        "stats_avg": {"GPA": 3.95},
                        "score_profile": _demo_score_profile("GPA", p25=80, median=90, p75=95, acceptance_rate_percent=20),
                    },
                    {
                        "id": "track-realistic",
                        "label": "Realistic Track",
                        "funding_type": "paid",
                        "requirements": {"GPA": 3.2},
                        "stats_avg": {"GPA": 3.5},
                        "score_profile": _demo_score_profile("GPA", p25=50, median=68, p75=82, acceptance_rate_percent=60),
                    },
                ]),
            }
        ]
        profile = {"gpa": 3.5, "budget": 30000}
        chance_res = estimate_uni_chance(items[0], profile)
        sort_res = sort_universities_ai(items, profile=profile, budget_vs_prestige=100)

        match_data = sort_res[0].get("matchData", {})
        self.assertEqual(chance_res.get("bestChoiceKey"), match_data.get("recommendedChoiceKey"))
        self.assertEqual(chance_res.get("bestChoiceKey"), match_data.get("selectedChoiceKey"))

    def test_sort_universities_ai_match_data_clean_payload(self):
        items = [
            {
                "id": "u-clean",
                "name": "Clean Payload University",
                "rank": 10,
                "finance": {"total_cost_year_usd": 15000},
                "academics": {"acceptance_rate_percent": 60},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.5,
                },
                "admission_categories": [],
            }
        ]
        profile = {"gpa": 3.8, "budget": 20000, "interests": "Computer science"}
        result = sort_universities_ai(items, profile=profile)
        match_data = result[0].get("matchData", {})

        # Assert dead/phantom fields are cleanly absent
        self.assertNotIn("legacySignals", match_data)
        self.assertNotIn("mlQueryTranslated", match_data)
        self.assertNotIn("mlQuerySource", match_data)
        self.assertNotIn("mlQueryTranslationReason", match_data)
        self.assertNotIn("mlQueryProvider", match_data)
        self.assertNotIn("mlQueryCacheHit", match_data)
        self.assertNotIn("mlQueryProviderError", match_data)
        self.assertNotIn("mlQueryInputPreview", match_data)
        self.assertNotIn("mlQueryOutputPreview", match_data)
        self.assertNotIn("mlQueryOutputLength", match_data)
        self.assertNotIn("mlLexicalScore", match_data)
        self.assertNotIn("semanticSignalWeight", match_data)

        # Assert valid modern fields
        self.assertIn("uiBadgeHints", match_data)
        self.assertIn("vibe", match_data["uiBadgeHints"])
        self.assertIn("requirements", match_data["uiBadgeHints"])
        self.assertIn("budgetAid", match_data["uiBadgeHints"])

    def test_ui_badge_hints_conforms_to_all_five_tag_groups(self):
        from app.services.ai_scoring import _build_ui_badge_hints
        hints = _build_ui_badge_hints(
            preference_mismatch=0.10,
            conditional=False,
            conditional_requirements=0,
            meets_min_requirements=True,
            below_requirements=False,
            budget_status="over_budget",
            aid_any=True,
        )

        self.assertEqual("your_vibe", hints.get("vibe"))
        self.assertEqual("", hints.get("finance"))
        self.assertEqual("requirements_met", hints.get("requirements"))
        self.assertEqual("over_budget_aid", hints.get("budgetAid"))
        self.assertFalse(hints.get("showConditionalExamNeeded"))
        self.assertEqual(9, len(hints["priorityOrder"]))
        self.assertIn("missing_program", hints["priorityOrder"])

    def test_missing_program_hint_and_penalty(self):
        from app.services.ai_scoring import _build_ui_badge_hints, _university_matches_major
        uni_cs = {
            "academics": {
                "programs": [
                    {"name": "Computer Science", "major_tags": ["computer science"]}
                ]
            }
        }
        self.assertTrue(_university_matches_major(uni_cs, "Computer Science"))
        self.assertFalse(_university_matches_major(uni_cs, "Medicine"))

        hints = _build_ui_badge_hints(
            preference_mismatch=0.10,
            conditional=False,
            conditional_requirements=0,
            missing_program=True,
        )
        self.assertTrue(hints.get("showMissingProgram"))
        self.assertTrue(hints.get("missingProgram"))

    def test_requirements_fit_is_invariant_to_budget_and_funding_choice(self):
        uni = {
            "id": "u-chance-funding-invariance",
            "rank": 50,
            "finance": {"total_cost_year_usd": 20000},
            "academics": {"acceptance_rate_percent": 50},
            "admission_categories": [
                {
                    "id": "cat",
                    "label": "Cat",
                    "requirement_profiles": [
                        {
                            "id": "same-admission-route",
                            "label": "Same Admission Route",
                            "requirements": {"SAT": 1200},
                            "score_profile": _demo_score_profile("SAT", p25=60, median=75, p75=90),
                            "funding_options": [
                                {"id": "paid", "label": "Paid", "funding_type": "paid"},
                                {"id": "grant", "label": "Grant", "funding_type": "grant"},
                            ],
                        }
                    ],
                }
            ],
        }
        base_profile = {
            "locale": "eng",
            "gpa": 3.9,
            "exams": [{"id": "SAT", "score": 1450}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
        }

        low_budget = _estimate_uni_chance(uni, {**base_profile, "budget": 1000})
        high_budget = _estimate_uni_chance(uni, {**base_profile, "budget": 100000})
        paid = _estimate_uni_chance(uni, {
            **base_profile,
            "budget": 100000,
            "selectedAdmissionChoices": {"u-chance-funding-invariance": _choice_selection("cat::same-admission-route::paid")},
        })
        grant = _estimate_uni_chance(uni, {
            **base_profile,
            "budget": 100000,
            "selectedAdmissionChoices": {"u-chance-funding-invariance": _choice_selection("cat::same-admission-route::grant")},
        })

        low_budget_chance = next(row["chancePercent"] for row in low_budget["choices"] if row["fundingOptionId"] == "paid")
        high_budget_chance = next(row["chancePercent"] for row in high_budget["choices"] if row["fundingOptionId"] == "paid")
        self.assertEqual(low_budget_chance, high_budget_chance)
        self.assertEqual("published_requirements_met_percent", low_budget["scoreMeaning"])
        self.assertEqual(paid["overallChance"], grant["overallChance"])

        fallback_profile = {
            **uni["admission_categories"][0]["requirement_profiles"][0],
        }
        fallback_profile.pop("score_profile")
        fallback_uni = {
            **uni,
            "id": "u-chance-funding-invariance-fallback",
            "admission_categories": [{
                **uni["admission_categories"][0],
                "requirement_profiles": [fallback_profile],
            }],
        }
        fallback_low_budget = _estimate_uni_chance(fallback_uni, {**base_profile, "budget": 1000})
        fallback_high_budget = _estimate_uni_chance(fallback_uni, {**base_profile, "budget": 100000})
        self.assertEqual(fallback_low_budget["overallChance"], fallback_high_budget["overallChance"])

    def test_grant_track_does_not_change_published_requirements_fit(self):
        uni = {
            "id": "u-scholarship-test",
            "rank": 50,
            "finance": {"total_cost_year_usd": 20000},
            "academics": {"acceptance_rate_percent": 50},
            "admission_categories": [
                {
                    "id": "cat",
                    "label": "Cat",
                    "requirement_profiles": [
                        {
                            "id": "prof_paid",
                            "label": "Paid Track",
                            "requirements": {"SAT": 1200},
                            "funding_type": "paid",
                            "score_profile": _demo_score_profile("SAT", p25=60, median=75, p75=90),
                        },
                        {
                            "id": "prof_grant",
                            "label": "Grant Track",
                            "requirements": {"SAT": 1200},
                            "funding_type": "grant",
                            "funding_program": "Merit Scholarship",
                            "score_profile": _demo_score_profile("SAT", p25=60, median=75, p75=90),
                        },
                    ],
                }
            ],
        }
        # Strong academic student
        profile = {
            "locale": "eng",
            "budget": 30000,
            "gpa": 3.9,
            "exams": [{"id": "SAT", "score": 1450}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
            "selectedAdmissionChoices": {},
        }
        res = _estimate_uni_chance(uni, profile)
        choices_by_id = {c["requirementProfileId"]: c for c in res.get("choices", [])}
        paid_chance = choices_by_id["prof_paid"]["chancePercent"]
        grant_chance = choices_by_id["prof_grant"]["chancePercent"]
        self.assertIsNotNone(paid_chance)
        self.assertIsNotNone(grant_chance)
        self.assertEqual(grant_chance, paid_chance)
        self.assertFalse(any(
            factor.get("key") in {"affordability_fit", "affordability_gap", "scholarship_support"}
            for row in res.get("choices", [])
            for factor in row.get("factors", [])
        ))

    def test_language_fit_counts_published_minimum_not_strength_above_minimum(self):
        uni = {
            "id": "u-official-language-strength",
            "rank": 50,
            "finance": {"total_cost_year_usd": 20000},
            "academics": {"acceptance_rate_percent": 50},
            "admission_categories": _categories_from_requirement_profiles([
                {
                    "id": "same-admission-route",
                    "label": "Same Admission Route",
                    "requirements": {"SAT": 1200},
                    "score_profile": _demo_score_profile("SAT", p25=60, median=75, p75=90),
                    "language_requirements_mode": "all",
                    "language_requirements": [
                        {"code": "en", "requirements": {"IELTS": 6.5}, "stats_avg": {"IELTS": 8.0}}
                    ],
                }
            ]),
        }
        base_profile = {
            "budget": 30000,
            "exams": [{"id": "SAT", "score": 1450}],
        }
        borderline = _estimate_uni_chance(uni, {
            **base_profile,
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}],
        })
        strong = _estimate_uni_chance(uni, {
            **base_profile,
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}],
        })
        borderline_choice = borderline["choices"][0]
        strong_choice = strong["choices"][0]

        self.assertEqual(100, borderline_choice["chancePercent"])
        self.assertEqual(borderline_choice["chancePercent"], strong_choice["chancePercent"])
        missing = _estimate_uni_chance(uni, {**base_profile, "languages": []})
        self.assertIsNone(missing.get("overallChance"))
        self.assertEqual("missing_evidence", missing.get("reason"))

    def test_missing_required_evidence_does_not_convert_to_zero_chance(self):
        uni = {
            "id": "u-missing-evidence-test",
            "rank": 50,
            "finance": {"total_cost_year_usd": 20000},
            "academics": {"acceptance_rate_percent": 50},
            "admission_categories": [
                {
                    "id": "cat",
                    "label": "Cat",
                    "requirement_profiles": [
                        {
                            "id": "prof_req",
                            "label": "Required Track",
                            "requirements": {"SAT": 1400},
                            "language_requirements": [{"code": "en", "requirements": {"IELTS": 7.0}}],
                        }
                    ],
                }
            ],
        }
        # Profile has NO exam or language scores
        profile = {
            "locale": "eng",
            "budget": 30000,
            "exams": [],
            "languages": [],
            "selectedAdmissionChoices": {},
        }
        res = _estimate_uni_chance(uni, profile)
        self.assertFalse(res.get("chanceAvailable"))
        self.assertIsNone(res.get("overallChance"))
        self.assertEqual(res.get("reason"), "missing_evidence")
        self.assertEqual(res.get("scoreMeaning"), "published_requirements_met_percent")

    def test_estimate_university_roi_with_valid_salary_data(self):
        from app.services.ai_scoring import estimate_university_roi

        uni_general = {
            "id": "test-uni-salary",
            "finance": {"total_cost_year_usd": 50000},
            "outcomes": {"early_career_salary_usd": 100000},
            "admission_categories": [],
        }
        res = estimate_university_roi(uni_general, {"major": "Physics", "studyMode": "On-campus"})
        self.assertEqual(res["context_type"], "fallback_major")
        self.assertEqual(res["salary_used_usd"], 100000.0)
        self.assertEqual(res["annual_cost_usd"], 50000.0)
        self.assertEqual(res["roi_value"], 2.0)
        self.assertEqual(res["roi_label"], "Positive Return")
        self.assertEqual(res["roi_tone"], "good")

        uni_major = {
            "id": "test-uni-major-salary",
            "finance": {"total_cost_year_usd": 40000},
            "outcomes": {
                "salary_by_major": {
                    "Computer Science": 120000,
                    "Biology": 60000,
                },
                "early_career_salary_usd": 80000,
            },
            "admission_categories": [],
        }
        res_matched = estimate_university_roi(uni_major, {"major": "computer-science"})
        self.assertEqual(res_matched["context_type"], "matched_major")
        self.assertEqual(res_matched["matched_major"], "Computer Science")
        self.assertEqual(res_matched["salary_used_usd"], 120000.0)
        self.assertEqual(res_matched["roi_value"], 3.0)
        self.assertEqual(res_matched["roi_label"], "Excellent Return")
        self.assertEqual(res_matched["roi_tone"], "excellent")

    def test_estimate_university_roi_without_salary_returns_neutral_no_data(self):
        from app.services.ai_scoring import estimate_university_roi

        uni_no_salary = {
            "id": "test-uni-no-salary",
            "finance": {"total_cost_year_usd": 30000},
            "outcomes": {},
            "admission_categories": [],
        }
        res = estimate_university_roi(uni_no_salary, {"major": "Computer Science"})
        self.assertEqual(res["context_type"], "no_salary_data")
        self.assertIsNone(res["salary_used_usd"])
        self.assertIsNone(res["roi_value"])
        self.assertEqual(res["roi_label"], "No Data")
        self.assertEqual(res["roi_tone"], "neutral")
        self.assertEqual(res["annual_cost_usd"], 30000.0)
        self.assertEqual(res["matched_major"], "")
        self.assertEqual(res["salary_data_points"], 0)

    def test_estimate_university_roi_with_median_10yr_earnings_returns_neutral_no_data(self):
        from app.services.ai_scoring import estimate_university_roi

        uni_10yr_earnings = {
            "id": "caltech-usa-pasadena",
            "finance": {"total_cost_year_usd": 85000},
            "outcomes": {"median_earnings_10yr_usd": 128566},
            "admission_categories": [],
        }
        res = estimate_university_roi(uni_10yr_earnings, {"major": "Computer Science"})
        self.assertEqual(res["context_type"], "no_salary_data")
        self.assertIsNone(res["salary_used_usd"])
        self.assertIsNone(res["roi_value"])
        self.assertEqual(res["roi_label"], "No Data")
        self.assertEqual(res["roi_tone"], "neutral")
        self.assertEqual(res["annual_cost_usd"], 85000.0)
        self.assertEqual(res["salary_data_points"], 0)


if __name__ == "__main__":
    unittest.main()
