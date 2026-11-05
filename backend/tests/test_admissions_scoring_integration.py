import copy
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.routers import universities as router
from app.schemas.payloads import ProfilePayload, UniversitiesAiSortRequest, to_profile_dict
from app.services import admissions_catalog, ai_scoring, universities


MIT = "mit-usa-cambridge"
STANFORD = "stanford-university-usa-ca"


def profile(option="stanford-option-cs-bs", route="undergraduate-shared-evidence:stanford-first-year"):
    return {
        "study_level": "Bachelor", "applicant_route": "first_year", "intended_entry_cycle": "Fall 2027",
        "selectedAdmissionChoices": {STANFORD: {"studyOptionId": option, "applicationRouteId": route}},
    }


class AdmissionsScoringIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_validated_profile_keeps_canonical_and_legacy_selections_distinct(self):
        value = profile()
        value["selectedAdmissionChoices"][STANFORD]["programId"] = "stanford-bs-computer-science"
        normalized = to_profile_dict(ProfilePayload(**value))
        self.assertEqual(value["selectedAdmissionChoices"], normalized["selectedAdmissionChoices"])
        route_only = ProfilePayload(selectedAdmissionChoices={STANFORD: {"applicationRouteId": "route"}})
        self.assertEqual(route_only.selectedAdmissionChoices[STANFORD]["applicationRouteId"], "route")
        with self.assertRaises(ValidationError):
            ProfilePayload(selectedAdmissionChoices={STANFORD: {"applicationRouteId": "x" * 257}})

    def test_uni_chance_uses_canonical_route_instead_of_retained_legacy_choice(self):
        value = profile(route="undergraduate-shared-evidence:stanford-transfer")
        value["applicant_route"] = "transfer"
        value["selectedAdmissionChoices"][STANFORD].update(programId="stanford-bs-computer-science", choiceKey="stanford_standard")
        response = self.client.post(f"/universities/{STANFORD}/uni-chance", json={"profile": value})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["context"]["application_route_id"], "undergraduate-shared-evidence:stanford-transfer")
        self.assertIsNone(result["overallChance"])
        self.assertTrue(result["catalogRevision"])
        self.assertTrue(result["choices"][0]["details"]["checks"])
        self.assertNotIn("stanford_standard", result["bestChoiceKey"])

    def test_invalid_canonical_ids_never_borrow_legacy_requirements(self):
        result = ai_scoring.estimate_uni_chance(universities.get_university_by_id(STANFORD), profile(option="retired-option"))
        self.assertEqual(result["reason"], "applicability_unknown")
        self.assertIsNone(result["overallChance"])
        self.assertEqual(result["choices"][0]["details"]["checks"], [])
        self.assertEqual(result["context"]["study_option_id"], "retired-option")

    def test_unifit_omits_unknown_academic_and_cost_components_without_legacy_fallback(self):
        university = copy.deepcopy(universities.get_university_by_id(STANFORD))
        university["finance"] = {"total_cost_year_usd": 1}
        value = profile()
        value.update(budget=50, major="computer science")
        ranked = ai_scoring.sort_universities_ai([university], value)
        match = ranked[0]["matchData"]
        self.assertIsNone(match["requirementsFitPercent"])
        self.assertIsNone(match["requirementsGap"])
        self.assertIsNone(match["finalPriceUSD"])
        self.assertIsNone(match["aidAny"])
        self.assertEqual(match["budgetStatus"], "unknown_cost")
        self.assertFalse(match["missingProgram"])
        self.assertEqual(match["admissionsContext"]["study_option_id"], "stanford-option-cs-bs")
        self.assertEqual(match["admissionsSelection"]["option"], {"id": "stanford-option-cs-bs", "title": "Computer Science (BS)"})
        self.assertEqual(match["admissionsSelection"]["route"]["id"], "undergraduate-shared-evidence:stanford-first-year")
        self.assertTrue(match["requirementChecks"])
        self.assertTrue(all("sourceRule" in check for check in match["requirementChecks"]))
        self.assertTrue(match["selectedByUser"])
        self.assertEqual(match["choiceSelectionSource"], "user")
        self.assertNotIn("facts", universities.to_university_card(ranked[0]))

    def test_context_api_exposes_rules_sources_and_assessment_together(self):
        response = self.client.post(f"/universities/{MIT}/admissions-context", json={"context": {
            "study_option_id": "mit-course-6-3-bachelor", "application_route_id": "mit-first-year",
            "study_level": "undergraduate", "applicant_route": "first_year", "intended_entry_cycle": "Fall 2027",
        }})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(response.headers["Cache-Control"], "private, no-store")
        self.assertIsNone(result["assessment"]["overallChance"])
        self.assertTrue(result["fact_groups"]["requirements"])
        self.assertTrue(result["facts"])
        self.assertTrue(result["sources"])
        checks = result["assessment"]["choices"][0]["details"]["checks"]
        self.assertTrue(checks)
        self.assertTrue(all(check["factId"] in {fact["id"] for fact in result["facts"]} for check in checks))
        self.assertEqual(result["assessment"]["choices"][0]["cycle"], "Fall 2027")

    def test_discovery_budget_uses_dated_reference_without_claiming_future_price(self):
        for institution_id in (MIT, STANFORD):
            university = universities.get_university_by_id(institution_id)
            value = {"study_level": "Bachelor", "major": "computer science", "intended_entry_cycle": "Fall 2027"}
            low = ai_scoring.sort_universities_ai([university], {**value, "budget": 20000})[0]["matchData"]
            high = ai_scoring.sort_universities_ai([university], {**value, "budget": 150000})[0]["matchData"]
            self.assertGreater(low["finalScore"], high["finalScore"])
            self.assertEqual("over_budget", low["budgetAssessment"]["status"])
            self.assertEqual("within_budget", high["budgetAssessment"]["status"])
            self.assertEqual("dated_reference", high["budgetAssessment"]["evidence"])
            self.assertEqual("unknown_cost", high["budgetStatus"])
            self.assertIsNone(high["finalPriceUSD"])
            self.assertIsNone(high["requirementsFitPercent"])
            self.assertEqual("matched", high["subjectMatch"]["status"])

    def test_major_without_saved_choice_matches_catalog_at_the_requested_level(self):
        imperial = universities.get_university_by_id("imperial-college-london-uk")
        matched = ai_scoring.sort_universities_ai([imperial], {"major": "computer science", "study_level": "undergraduate"})[0]["matchData"]
        missing = ai_scoring.sort_universities_ai([imperial], {"major": "law", "study_level": "undergraduate"})[0]["matchData"]
        self.assertFalse(matched["missingProgram"])
        self.assertTrue(missing["missingProgram"])
        self.assertGreater(missing["finalScore"], matched["finalScore"])
        self.assertEqual("missing", missing["subjectMatch"]["status"])
        catalog = universities.list_universities(major="law", study_level="undergraduate")
        self.assertNotIn(imperial["id"], [row["id"] for row in catalog["items"]])

    def test_unifit_uses_each_saved_level_for_subject_and_cost(self):
        university = universities.get_university_by_id(STANFORD)
        cases = (
            ("Master", "undergraduate", "stanford-option-cs-bs", "undergraduate-shared-evidence:stanford-first-year", "bachelor"),
            ("Bachelor", "masters", "stanford-option-cs-ms", "engineering-doerr-evidence:external-graduate", "master"),
            ("Master", "", "stanford-option-cs-bs", "undergraduate-shared-evidence:stanford-first-year", "any"),
        )
        for general, selected, option, route, expected in cases:
            with self.subTest(selected=selected):
                value = {"study_level": general, "major": "computer science", "budget": 100000,
                         "selectedAdmissionChoices": {STANFORD: {"studyOptionId": option,
                             "applicationRouteId": route, "studyLevel": selected}}}
                match = ai_scoring.sort_universities_ai([university], value)[0]["matchData"]
                self.assertEqual(selected or None, match["admissionsContext"]["study_level"])
                self.assertEqual(expected, match["subjectMatch"]["study_level"])
                if selected:
                    self.assertIn(option, match["subjectMatch"]["option_ids"])
                if selected == "undergraduate":
                    self.assertIsNotNone(match["costQuote"])
                    self.assertEqual("undergraduate", match["costQuote"]["study_level"])
                if not selected:
                    self.assertIsNone(match["affordabilityGap"])
                    self.assertEqual("scope_unknown", match["budgetAssessment"]["evidence"])

    def test_unifit_subject_respects_selected_option_and_invalid_ids(self):
        university = universities.get_university_by_id(STANFORD)
        value = profile(option="stanford-option-chem-bs")
        value["major"] = "computer science"
        match = ai_scoring.sort_universities_ai([university], value)[0]["matchData"]
        self.assertEqual("missing", match["subjectMatch"]["status"])
        self.assertTrue(match["missingProgram"])
        self.assertEqual([], match["subjectMatch"]["option_ids"])

        value["selectedAdmissionChoices"][STANFORD]["studyOptionId"] = "retired-option"
        match = ai_scoring.sort_universities_ai([university], value)[0]["matchData"]
        self.assertEqual("unknown", match["subjectMatch"]["status"])
        self.assertFalse(match["missingProgram"])
        self.assertIsNone(match["requirementsFitPercent"])
        self.assertIsNone(match["costQuote"])

        value["selectedAdmissionChoices"][STANFORD]["studyOptionId"] = "stanford-option-chem-bs"
        value["selectedAdmissionChoices"][STANFORD]["studyLevel"] = "masters"
        match = ai_scoring.sort_universities_ai([university], value)[0]["matchData"]
        self.assertEqual("unknown", match["subjectMatch"]["status"])
        self.assertFalse(match["missingProgram"])
        self.assertEqual([], match["subjectMatch"]["option_ids"])

    def test_tuition_and_unknown_fee_status_do_not_claim_a_full_budget(self):
        imperial = universities.get_university_by_id("imperial-college-london-uk")
        value = {"major": "computer science", "study_level": "undergraduate", "budget": 150000, "intended_entry_cycle": "Fall 2027"}
        unknown = ai_scoring.sort_universities_ai([imperial], value)[0]["matchData"]
        self.assertEqual("fee_status_unknown", unknown["budgetAssessment"]["evidence"])
        self.assertIsNone(unknown["affordabilityGap"])
        known = ai_scoring.sort_universities_ai([imperial], {**value, "fee_status_context": "self_reported_international_overseas"})[0]["matchData"]
        self.assertEqual("within_budget", known["budgetAssessment"]["status"])
        self.assertEqual("tuition", known["budgetAssessment"]["basis"])
        self.assertFalse(known["budgetAssessment"]["full_budget"])
        self.assertEqual("unknown_cost", known["budgetStatus"])
        self.assertIsNone(known["costYearUSD"])

    def test_compare_uses_each_universitys_selection_and_keeps_roi_unknown(self):
        value = profile()
        value["selectedAdmissionChoices"][MIT] = {"studyOptionId": "mit-course-6-3-bachelor", "applicationRouteId": "mit-transfer"}
        response = self.client.post("/universities/compare-profiles", json={"university_ids": [MIT, STANFORD], "profile": value})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result[MIT]["uniChance"]["context"]["application_route_id"], "mit-transfer")
        self.assertEqual(result[STANFORD]["uniChance"]["context"]["application_route_id"], "undergraduate-shared-evidence:stanford-first-year")
        for entry in result.values():
            self.assertIsNone(entry["roi"]["roi_value"])
            self.assertIsNone(entry["roi"]["annual_cost_usd"])
            self.assertEqual(entry["roi"]["context_type"], "scoped_cost_and_outcomes_unassessed")

    def test_catalog_revision_invalidates_rank_cache_and_corruption_is_unavailable(self):
        payload = UniversitiesAiSortRequest(profile=ProfilePayload(**profile()))
        with patch.object(admissions_catalog, "get_revision", return_value="revision-one"):
            first = router._ai_sort_cache_key(payload)
        with patch.object(admissions_catalog, "get_revision", return_value="revision-two"):
            second = router._ai_sort_cache_key(payload)
        self.assertNotEqual(first, second)
        with patch.object(admissions_catalog, "resolve_context", side_effect=admissions_catalog.AdmissionsCatalogError("private internal path")):
            result = self.client.post(f"/universities/{STANFORD}/uni-chance", json={"profile": profile()})
        self.assertEqual(result.status_code, 503)
        self.assertEqual(result.json(), {"detail": "Admissions catalog is unavailable"})

    def test_new_program_search_uses_active_detail_and_preserves_paused_institutions(self):
        result = universities.list_universities(q="Digital Chemistry", paginate=False, localize_output=False)
        self.assertIn("imperial-college-london-uk", {item["id"] for item in result["items"]})
        original = universities.get_university_by_id(STANFORD)
        self.assertNotIn("programs", original["academics"])
        self.assertEqual(original["admissions_catalog"]["availability"], "reviewed")
        self.assertEqual(original["admissions_catalog"]["study_option_count"], 254)
        result = self.client.get("/universities/university-of-oxford-uk-oxford/study-options")
        self.assertEqual(result.status_code, 404)


if __name__ == "__main__":
    unittest.main()
