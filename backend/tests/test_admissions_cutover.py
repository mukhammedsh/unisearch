import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers import universities as router
from app.schemas.payloads import ProfilePayload, UniversitiesAiSortRequest, to_profile_dict
from app.services import admissions_catalog, admissions_assessment, ai_scoring, universities


MIT = "mit-usa-cambridge"
IMPERIAL = "imperial-college-london-uk"
STANFORD = "stanford-university-usa-ca"
OXFORD = "university-of-oxford-uk-oxford"


class AdmissionsCutoverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_accepted_public_payloads_retire_legacy_rules_but_keep_identity(self):
        for uid in admissions_catalog.INSTITUTION_IDS:
            with self.subTest(uid=uid):
                full = universities.get_university_by_id(uid, localized=True)
                self.assertTrue(full["name"])
                self.assertTrue(full["location"])
                self.assertTrue(full["rank"])
                for key in ("finance", "admission_categories", "qualification_guidance", "admission_portals", "fellowships_and_grants"):
                    self.assertNotIn(key, full)
                self.assertNotIn("programs", full["academics"])
                self.assertNotIn("coverage_by_program", full)
                self.assertFalse({"acceptance_rate_percent", "tuition_total_cost_year_usd"}.intersection(full.get("fact_provenance", {}).get("facts", {})))
                normalized = admissions_catalog.get_institution(uid)
                self.assertEqual(full["academics"]["majors"], list(dict.fromkeys(option["title"] for option in normalized["study_options"])))
                for payload in (full, universities.to_university_card(full), universities.to_university_map_point(full)):
                    contract = payload["admissions_catalog"]
                    self.assertEqual(contract["availability"], "reviewed")
                    self.assertEqual(contract["schema_version"], "admissions-storage-1.0")
                    self.assertEqual(contract["revision"], admissions_catalog.get_revision())
                    self.assertEqual(contract["study_option_count"], len(normalized["study_options"]))
                    self.assertNotIn("finance", payload)

    def test_other_47_keep_native_data_and_explicit_unreviewed_status(self):
        rows = universities.load_universities()
        self.assertEqual(len(rows), 50)
        legacy = [row for row in rows if row["id"] not in admissions_catalog.INSTITUTION_IDS]
        self.assertEqual(len(legacy), 47)
        for row in legacy:
            self.assertEqual(row["admissions_catalog"]["availability"], "legacy_unreviewed")
            self.assertIsNone(row["admissions_catalog"]["revision"])
        oxford = universities.get_university_by_id(OXFORD)
        self.assertIn("programs", oxford["academics"])
        self.assertIn("finance", oxford)
        self.assertEqual(self.client.get(f"/universities/{OXFORD}/study-options").status_code, 404)

    def test_guest_and_retained_legacy_selections_cannot_restore_accepted_score_or_price(self):
        for uid in admissions_catalog.INSTITUTION_IDS:
            row = universities.get_university_by_id(uid)
            for profile in ({}, {"budget": 10000, "selectedAdmissionChoices": {uid: {"programId": "retired", "choiceKey": "retired"}}}):
                with self.subTest(uid=uid, profile=profile):
                    result = ai_scoring.estimate_uni_chance(row, profile)
                    self.assertIsNone(result["overallChance"])
                    self.assertEqual(result["reason"], "applicability_unknown")
                    self.assertFalse(result["selectedByUser"])
                    self.assertEqual(result["choices"][0]["details"]["checks"], [])
                    match = ai_scoring.sort_universities_ai([row], profile)[0]["matchData"]
                    self.assertIsNone(match["requirementsGap"])
                    self.assertIsNone(match["affordabilityGap"])
                    self.assertIsNone(match["finalPriceUSD"])
                    self.assertIsNone(match["aidAny"])
                    self.assertEqual(match["assessmentRevision"], result["assessmentRevision"])
                    self.assertFalse(match["selectedByUser"])
                    self.assertAlmostEqual(match["finalScore"], match["preferenceMismatch"])
                    self.assertIsNone(ai_scoring.estimate_university_roi(row, profile)["roi_value"])

    def test_canonical_discovery_level_aliases_and_unknown_cost_filters(self):
        for level in ("Bachelor", "undergraduate"):
            result = universities.list_universities(study_level=level, paginate=False)
            self.assertTrue(admissions_catalog.INSTITUTION_IDS.issubset({row["id"] for row in result["items"]}))
        for filters in ({"max_tuition": 1000000}, {"user_budget": 1000000}):
            rows = universities.list_universities(paginate=False, **filters)["items"]
            self.assertEqual({MIT, STANFORD}, admissions_catalog.INSTITUTION_IDS.intersection(row["id"] for row in rows))
        for filters in ({"funding_type": "grant"}, {"funding_type": "paid"}):
            rows = universities.list_universities(paginate=False, **filters)["items"]
            self.assertFalse(admissions_catalog.INSTITUTION_IDS.intersection(row["id"] for row in rows))

    def test_saved_per_institution_context_overrides_global_without_mutation(self):
        original = {"study_level": "Master", "applicant_route": "graduate", "intended_entry_cycle": "2028", "fee_status_context": "other",
                    "selectedAdmissionChoices": {IMPERIAL: {
                        "studyOptionId": "imperial-option-computing-meng", "applicationRouteId": "procedure-computing-meng",
                        "studyLevel": "undergraduate", "applicantRoute": "first_year", "intendedEntryCycle": "2027 entry",
                        "feeStatusContext": "self_reported_international_overseas"}}}
        profile = to_profile_dict(ProfilePayload(**original))
        before = copy.deepcopy(profile)
        resolved = admissions_catalog.resolve_context(IMPERIAL, profile)
        self.assertEqual(resolved["context"]["study_level"], "undergraduate")
        self.assertEqual(resolved["context"]["applicant_route"], "first_year")
        self.assertEqual(resolved["context"]["intended_entry_cycle"], "2027 entry")
        self.assertEqual(resolved["context"]["fee_status_context"], "self_reported_international_overseas")
        self.assertEqual(profile, before)
        explicit = admissions_catalog.resolve_context(IMPERIAL, profile, {"intended_entry_cycle": "2029"})
        self.assertEqual(explicit["context"]["intended_entry_cycle"], "2029")

    def test_explicit_empty_saved_context_suppresses_global_defaults(self):
        profile = to_profile_dict(ProfilePayload(study_level="Bachelor", applicant_route="first_year", intended_entry_cycle="2027",
            selectedAdmissionChoices={MIT: {"studyOptionId": "mit-course-6-3-bachelor", "applicationRouteId": "mit-first-year",
                "studyLevel": "", "applicantRoute": "", "intendedEntryCycle": ""}}))
        resolved = admissions_catalog.resolve_context(MIT, profile)
        self.assertIsNone(resolved["context"]["study_level"])
        self.assertEqual(resolved["context"]["applicant_route"], "")
        self.assertEqual(resolved["context"]["intended_entry_cycle"], "")
        self.assertIsNone(ai_scoring.estimate_uni_chance(universities.get_university_by_id(MIT), profile)["overallChance"])

    def test_compare_keeps_each_saved_university_context_separate(self):
        profile = {"study_level": "Master", "applicant_route": "graduate", "intended_entry_cycle": "2028",
                   "selectedAdmissionChoices": {
                       IMPERIAL: {"studyOptionId": "imperial-option-computing-meng", "applicationRouteId": "procedure-computing-meng",
                                  "studyLevel": "undergraduate", "applicantRoute": "first_year", "intendedEntryCycle": "2027 entry"},
                       STANFORD: {"studyOptionId": "stanford-option-cs-bs", "applicationRouteId": "undergraduate-shared-evidence:stanford-transfer",
                                  "studyLevel": "undergraduate", "applicantRoute": "transfer", "intendedEntryCycle": "Fall 2026"}}}
        response = self.client.post("/universities/compare-profiles", json={"university_ids": [IMPERIAL, STANFORD], "profile": profile})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        for uid, category, cycle in ((IMPERIAL, "first_year", "2027 entry"), (STANFORD, "transfer", "Fall 2026")):
            self.assertEqual(result[uid]["uniChance"]["context"]["study_level"], "undergraduate")
            self.assertEqual(result[uid]["uniChance"]["context"]["applicant_route"], category)
            self.assertEqual(result[uid]["uniChance"]["context"]["intended_entry_cycle"], cycle)
            self.assertEqual(result[uid]["roi"]["context"], result[uid]["uniChance"]["context"])

    def test_invalid_saved_context_values_return_422(self):
        for key, value in (("studyLevel", "MBA"), ("applicantRoute", "other"), ("feeStatusContext", "home"),
                           ("intendedEntryCycle", "2" * 41), ("applicantRoute", 1)):
            response = self.client.post(f"/universities/{MIT}/uni-chance", json={"profile": {"selectedAdmissionChoices": {
                MIT: {"studyOptionId": "mit-course-6-3-bachelor", key: value}}}})
            self.assertEqual(response.status_code, 422, key)

    def test_guest_ai_and_compare_cache_keys_include_assessment_revision(self):
        payload = UniversitiesAiSortRequest()
        with patch.object(admissions_assessment, "get_assessment_revision", return_value="first"):
            first = router._ai_sort_cache_key(payload)
        with patch.object(admissions_assessment, "get_assessment_revision", return_value="second"):
            second = router._ai_sort_cache_key(payload)
        self.assertNotEqual(first, second)
        captured = []
        with patch.object(router, "cache_get_json", side_effect=lambda key: captured.append(key)), \
             patch.object(router, "cache_set_json"), patch.object(router, "_compare_profiles_cache_get", return_value=None), \
             patch.object(router, "_compare_profiles_cache_set"):
            for revision in ("first", "second"):
                with patch.object(admissions_assessment, "get_assessment_revision", return_value=revision):
                    response = self.client.post("/universities/compare-profiles", json={"university_ids": [MIT], "profile": {}})
                    self.assertEqual(response.status_code, 200)
                    self.assertIsNone(response.json()[MIT]["uniChance"]["overallChance"])
            self.assertNotEqual(captured[0], captured[1])

    def test_snapshot_revision_invalidates_detail_etag_and_cached_list_lookup(self):
        original_path = admissions_catalog.CATALOG_PATH
        data = json.loads(original_path.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with patch.object(admissions_catalog, "CATALOG_PATH", path), \
                 patch.object(router, "cache_get_json", return_value=None) as cached, patch.object(router, "cache_set_json"):
                first = self.client.get(f"/universities/{MIT}")
                self.assertEqual(first.status_code, 200)
                self.client.get("/universities", params={"fields": "card"})
                first_key = cached.call_args.args[0]
                data["institutions"][0]["study_options"][0]["title"] += " reviewed"
                path.write_text(json.dumps(data), encoding="utf-8")
                second = self.client.get(f"/universities/{MIT}", headers={"If-None-Match": first.headers["ETag"]})
                self.assertEqual(second.status_code, 200)
                self.assertNotEqual(first.headers["ETag"], second.headers["ETag"])
                self.client.get("/universities", params={"fields": "card"})
                self.assertNotEqual(first_key, cached.call_args.args[0])
        admissions_catalog.clear_cache()

    def test_detail_etag_keeps_the_captured_body_revision_during_snapshot_refresh(self):
        data = json.loads(admissions_catalog.CATALOG_PATH.read_text(encoding="utf-8"))
        produce = universities.get_university_by_id
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with patch.object(admissions_catalog, "CATALOG_PATH", path):
                original = self.client.get(f"/universities/{MIT}")
                self.assertEqual(original.status_code, 200)

                def refresh_after_producing_body(*args, **kwargs):
                    body = produce(*args, **kwargs)
                    institution = next(row for row in data["institutions"] if row["institution"]["id"] == MIT)
                    institution["study_options"][0]["title"] += " reviewed"
                    path.write_text(json.dumps(data), encoding="utf-8")
                    return body

                with patch.object(universities, "get_university_by_id", side_effect=refresh_after_producing_body):
                    raced = self.client.get(f"/universities/{MIT}")
                self.assertEqual(raced.status_code, 200)
                self.assertEqual(raced.json(), original.json())
                self.assertEqual(raced.headers["ETag"], original.headers["ETag"])
                changed = self.client.get(f"/universities/{MIT}", headers={"If-None-Match": raced.headers["ETag"]})
                self.assertEqual(changed.status_code, 200)
                self.assertNotEqual(changed.json()["admissions_catalog"]["revision"], raced.json()["admissions_catalog"]["revision"])
                self.assertNotEqual(changed.headers["ETag"], raced.headers["ETag"])
                unchanged = self.client.get(f"/universities/{MIT}", headers={"If-None-Match": changed.headers["ETag"]})
                self.assertEqual(unchanged.status_code, 304)
        admissions_catalog.clear_cache()

    def test_inactive_or_corrupt_catalog_is_unavailable_before_cached_response(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "catalog.json"
            for raw in ('{"schema_version":"admissions-storage-1.0","runtime_active":false}', 'broken'):
                path.write_text(raw, encoding="utf-8")
                with patch.object(admissions_catalog, "CATALOG_PATH", path), patch.object(router, "cache_get_json", return_value={"items": []}) as cached:
                    response = self.client.get("/universities")
                    self.assertEqual(response.status_code, 503)
                    cached.assert_not_called()
        admissions_catalog.clear_cache()


if __name__ == "__main__":
    unittest.main()
