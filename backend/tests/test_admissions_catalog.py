import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app.services import admissions_catalog as service


PRODUCTION_PATH = service.CATALOG_PATH
MIT = "mit-usa-cambridge"


def fact(record_id="minimum", **changes):
    row = {"id": record_id, "topic": "academic_tests", "topics": [], "value": {"requirements": {"SAT": 1200}},
           "scope": {"option_ids": ["computing"], "route_ids": ["first-year"], "levels": ["undergraduate"],
                     "applicant_categories": ["first_year"], "cycle": "2027 entry", "fee_status": ["self_reported_home_domestic"],
                     "additional_dimensions": {}},
           "conditions": [], "conditions_and_exceptions": None, "exceptions": [], "source_ids": ["official"],
           "publication_status": "published", "review_status": "verified", "checked_at": "2026-10-01",
           "content_reviewed_at": None, "period": None, "related_fact_ids": [], "attributes": {}, "index_attributes": {},
           "provenance": {"evidence_file": "synthetic.json", "original_id": record_id, "original_scope": None, "original_source_ids": ["official"]}}
    row.update(changes)
    return row


def snapshot():
    institutions = []
    for institution_id in sorted(service.INSTITUTION_IDS):
        institutions.append({"institution": {"id": institution_id, "official_name": institution_id},
                             "study_options": [], "application_routes": [], "facts": [], "unknowns": [], "sources": []})
    mit = next(row for row in institutions if row["institution"]["id"] == MIT)
    mit["sources"] = [{"id": "official", "url": "https://mit.edu/", "title": "Official evidence", "checked_at": "2026-10-01", "attributes": {}}]
    mit["study_options"] = [
        {"id": "computing", "title": "Computing", "levels": ["undergraduate"], "awards": ["SB"], "parent_option_id": None,
         "route_ids": ["first-year", "transfer"], "fact_ids": ["minimum"], "source_ids": ["official"], "attributes": {}, "evidence_profiles": []},
        {"id": "physics", "title": "Physics", "levels": ["masters"], "awards": ["SM"], "parent_option_id": None,
         "route_ids": [], "fact_ids": [], "source_ids": ["official"], "attributes": {}, "evidence_profiles": []},
    ]
    for route_id in ("first-year", "transfer", "shared"):
        mit["application_routes"].append({"id": route_id, "title": route_id, "classification": "institution_wide",
            "target": "University undergraduate admission", "destination": "Official application", "shared_form_family": None,
            "option_ids": ["computing"] if route_id != "shared" else [], "fact_ids": [], "source_ids": ["official"],
            "shared_policy_context_ids": ["shared"] if route_id == "first-year" else [], "attributes": {}, "index_attributes": {}})
    mit["facts"] = [fact()]
    return {"schema_version": "admissions-storage-1.0", "runtime_active": True, "institutions": institutions}


CONTEXT = {"study_option_id": "computing", "application_route_id": "first-year", "study_level": "undergraduate",
           "applicant_route": "first_year", "intended_entry_cycle": "2027", "fee_status_context": "self_reported_home_domestic"}


class AdmissionsCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary.name) / "catalog.json"
        self.data = snapshot()
        self.write()
        self.path_patch = patch.object(service, "CATALOG_PATH", self.path)
        self.path_patch.start()
        service.clear_cache()

    def tearDown(self):
        self.path_patch.stop()
        service.clear_cache()
        self.temporary.cleanup()

    def write(self):
        self.path.write_text(json.dumps(self.data), encoding="utf-8")
        service.clear_cache()

    def mit(self):
        return next(row for row in self.data["institutions"] if row["institution"]["id"] == MIT)

    def resolve(self, **context):
        return service.resolve_context(MIT, context={**CONTEXT, **context})

    def test_explicit_scope_is_matched_and_projection_retains_exact_fact(self):
        result = self.resolve()
        prepared = result["facts"][0]
        self.assertEqual(prepared["applicability"]["status"], "matched")
        self.assertEqual({key: value for key, value in prepared.items() if key != "applicability"}, self.mit()["facts"][0])
        self.assertEqual(result["selected_route"]["id"], "first-year")
        self.assertEqual(result["fact_groups"]["requirements"], ["minimum"])
        self.assertEqual(result["sources"], self.mit()["sources"])

    def test_explicit_context_overrides_profile_without_mutation(self):
        profile = {"study_level": "master", "applicant_route": "graduate", "intended_entry_cycle": "2028",
                   "selectedAdmissionChoices": {MIT: {"studyOptionId": "physics", "applicationRouteId": "transfer"}}}
        original = copy.deepcopy(profile)
        result = service.resolve_context(MIT, profile, CONTEXT)
        self.assertEqual(result["context"], CONTEXT)
        self.assertEqual(profile, original)
        result["facts"][0]["value"]["requirements"]["SAT"] = 0
        self.assertEqual(self.resolve()["facts"][0]["value"]["requirements"]["SAT"], 1200)

    def test_reviewed_application_url_keeps_the_original_destination(self):
        route = self.mit()["application_routes"][0]
        route["attributes"]["application_url"] = "https://example.edu/apply"
        self.write()
        result = self.resolve()
        self.assertEqual(result["selected_route"]["application_url"], "https://example.edu/apply")
        self.assertEqual(result["selected_route"]["destination"], "Official application")
        self.assertEqual(result["available_routes"][0]["application_url"], "https://example.edu/apply")

    def test_selected_program_preserves_source_bound_profile_overviews_without_expanding_the_list(self):
        self.mit()["study_options"][0]["evidence_profiles"] = [
            {"attributes": {"description": {"text": "Collected study description."}}, "source_ids": ["official"]},
            {"attributes": {"description": "A separate accepted overview."}, "source_ids": ["official"]},
            {"attributes": {"description": None}, "source_ids": ["official"]},
        ]
        self.write()
        result = self.resolve()
        self.assertEqual(result["selected_option"]["overviews"], [
            {"text": "Collected study description.", "source_ids": ["official"]},
            {"text": "A separate accepted overview.", "source_ids": ["official"]},
        ])
        result["selected_option"]["overviews"][0]["source_ids"].clear()
        self.assertEqual(self.resolve()["selected_option"]["overviews"][0]["source_ids"], ["official"])
        self.assertNotIn("overviews", service.list_study_options(MIT)["items"][0])

    def test_profile_canonical_selection_and_manual_unknowns_do_not_select_default_route(self):
        profile = {"study_level": "bachelor", "selectedAdmissionChoices": {MIT: {"studyOptionId": "computing", "applicationRouteId": "transfer"}}}
        result = service.resolve_context(MIT, profile)
        self.assertEqual(result["selected_route"]["id"], "transfer")
        self.assertEqual(result["context"]["study_level"], "undergraduate")
        manual = self.resolve(application_route_id=None)
        self.assertIsNone(manual["selected_route"])
        self.assertEqual(manual["context_applicability"]["route"], "unknown")
        self.assertEqual(manual["facts"][0]["applicability"]["route"], "unknown")
        unknown = self.resolve(study_option_id="removed-option", application_route_id="removed-route")
        self.assertIsNone(unknown["selected_option"])
        self.assertIsNone(unknown["selected_route"])
        self.assertEqual(unknown["context"]["study_option_id"], "removed-option")
        self.assertEqual(unknown["available_routes"], [])
        for result in (unknown, self.resolve(study_option_id="removed-option"),
                       self.resolve(application_route_id="removed-route"), service.resolve_context(MIT)):
            self.assertEqual(result["facts"], [])
            self.assertEqual(result["unknowns"], [])
            self.assertEqual(result["fact_groups"], {})
        mismatch = self.resolve(study_option_id="physics")
        self.assertEqual(mismatch["facts"], [])

    def test_known_wrong_option_route_level_cycle_and_fee_are_excluded(self):
        cases = ({"study_option_id": "physics"}, {"application_route_id": "transfer"}, {"study_level": "masters"},
                 {"intended_entry_cycle": "2028"}, {"fee_status_context": "self_reported_international_overseas"})
        for context in cases:
            with self.subTest(context=context):
                result = self.resolve(**context)
                self.assertEqual(result["facts"], [])
                self.assertEqual(result["excluded"]["facts"][0]["applicability"]["status"], "mismatched")
        result = self.resolve(study_option_id="physics")
        self.assertEqual(result["context_applicability"]["route"], "mismatched")

    def test_anchored_cycles_preserve_unknown_periods_and_terms(self):
        cases = (("Fall 2027 entry", "Autumn 2027", "matched"), ("2027 Fall", "Spring 2027", "mismatched"),
                 ("2027", "Fall 2027", "unknown"), ("2027 entry", "2028", "mismatched"),
                 ("2027-28 entry", "2027", "matched"), ("2027-28", "2027", "unknown"),
                 ("2026-27 tuition; Fall 2027 entry", "2028", "unknown"),
                 ("Reviewed 2026-10-01; no cycle inferred", "2027", "unknown"))
        for published, selected, expected in cases:
            with self.subTest(published=published, selected=selected):
                self.assertEqual(service._cycle_axis(published, selected), expected)

    def test_localized_entry_examples_match_the_same_term_without_borrowing_an_academic_year(self):
        for selected in ("осенний набор 2027 года", "2027 жылғы күзгі қабылдау"):
            with self.subTest(selected=selected):
                self.assertEqual(service._cycle_axis("Fall 2027 entry", selected), "matched")
                self.assertEqual(service._cycle_axis("Fall 2028 entry", selected), "mismatched")
                self.assertEqual(service._cycle_axis("Spring 2027 entry", selected), "mismatched")
                self.assertEqual(service._cycle_axis("2026-27", selected), "unknown")
        self.assertEqual(service._cycle_axis("Spring 2027", "весенний набор 2027 года"), "matched")
        self.assertEqual(service._cycle_axis("Spring 2027", "2027 жылғы көктемгі қабылдау"), "matched")
        self.assertIsNone(service._cycle("Reviewed 2027 жылғы күзгі қабылдау"))

    def test_named_intake_period_matches_without_borrowing_an_academic_year(self):
        row = self.mit()["facts"][0]
        row["scope"]["cycle"] = None
        row["period"] = {"kind": "named", "label": "Fall 2027 entry"}
        self.write()
        self.assertEqual(self.resolve(intended_entry_cycle="Fall 2027")["facts"][0]["applicability"]["cycle"], "matched")
        self.assertEqual(self.resolve(intended_entry_cycle="2028")["facts"], [])
        row["period"] = {"kind": "academic_year", "label": "2027 entry"}
        self.write()
        self.assertEqual(self.resolve()["facts"][0]["applicability"]["cycle"], "unknown")

    def test_conditions_scope_extras_and_unparsed_applicant_categories_stay_conditional(self):
        row = self.mit()["facts"][0]
        row["conditions"] = [{"when": "Applicant is an internal student", "effect": "Additional prerequisite"}]
        row["scope"]["additional_dimensions"] = {"programme_phase": "registered PhD research"}
        row["scope"]["applicant_categories"] = ["Current students whose departmental eligibility is established"]
        self.write()
        prepared = self.resolve()["facts"][0]
        self.assertEqual(prepared["applicability"]["status"], "conditional")
        self.assertEqual(prepared["applicability"]["conditions"], "unknown")
        self.assertEqual(prepared["applicability"]["applicant"], "unknown")
        self.assertEqual(prepared["conditions"], row["conditions"])

    def test_shared_policy_link_does_not_become_a_matched_route(self):
        shared = fact("shared-rule")
        shared["scope"]["route_ids"] = ["shared"]
        self.mit()["facts"].append(shared)
        self.write()
        result = self.resolve()
        rule = next(row for row in result["facts"] if row["id"] == "shared-rule")
        self.assertEqual(rule["applicability"]["route"], "unknown")
        self.assertEqual(rule["applicability"]["status"], "conditional")
        self.assertNotIn("shared-rule", result["selected_route"]["fact_ids"])

    def test_history_separate_unknowns_preserved_and_groups_cover_every_current_fact(self):
        self.mit()["facts"].append(fact("old", review_status="superseded"))
        self.mit()["facts"].append(fact("compound", topic="cost_and_funding", value={"amount": None}))
        unknown = fact("gap")
        unknown.update(reason="Future cost not published", official_next_step="Ask the official admissions office", publication_status=None, review_status=None)
        self.mit()["unknowns"].append(unknown)
        self.write()
        result = self.resolve()
        self.assertEqual(result["history"]["fact_ids"], ["old"])
        self.assertEqual(result["unknowns"][0]["reason"], unknown["reason"])
        self.assertIsNone(result["unknowns"][0]["publication_status"])
        self.assertIn("compound", result["fact_groups"]["costs"])
        self.assertIn("compound", result["fact_groups"]["funding"])
        self.assertEqual({row["id"] for row in result["facts"]}, {record_id for group in result["fact_groups"].values() for record_id in group})

    def test_controlled_topics_group_requirements_without_scoring_completion_rules(self):
        for topic in ("standardized_tests", "academic_prerequisites_and_placement", "english_proficiency_waiver",
                      "academic_application", "language_exemptions", "tests_and_waivers"):
            self.assertIn("requirements", service._topic_domains(topic), topic)
        for topic in ("degree_completion_gpa", "degree_completion_policy", "post_admission_major_declaration",
                      "study_structure_and_degree_completion"):
            self.assertNotIn("requirements", service._topic_domains(topic), topic)
        self.assertEqual(set(service._topic_domains("eligibility_documents_deadline")), {"requirements", "application", "deadlines"})
        self.assertEqual(service._topic_domains("unclassified_metadata"), ("other",))

    def test_search_and_level_filter_are_compact_paginated_and_keep_source_language(self):
        result = service.list_study_options(MIT, search_candidates=["Computing"], page=1, limit=1)
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["title"], "Computing")
        self.assertNotIn("attributes", result["items"][0])
        self.assertEqual(service.list_study_options(MIT, study_level="masters")["items"][0]["id"], "physics")
        self.assertEqual(service.list_study_options(MIT, page=3, limit=1)["items"], [])
        self.assertEqual(service.list_study_options(MIT, search_candidates=["unrelated nonexistent course"])["items"], [])

    def test_multiword_program_search_requires_the_whole_subject(self):
        self.mit()["study_options"][0]["title"] = "Computer Science and Engineering"
        self.mit()["study_options"][1]["title"] = "Political Science"
        self.write()
        result = service.list_study_options(MIT, search_candidates=["Computer Science"])
        self.assertEqual([row["id"] for row in result["items"]], ["computing"])

    def test_compact_options_expose_only_declared_application_metadata(self):
        option = self.mit()["study_options"][0]
        option["attributes"] = {"application": {"classification": "post_admission_major", "reason": "Major follows admission"},
                                "course_url": "https://mit.edu/program", "format": {"mode": "On-campus"},
                                "original_inventory_record": {"unrelated": "large source dossier"}}
        self.write()
        summary = service.list_study_options(MIT)["items"][0]
        self.assertEqual(summary["application"], option["attributes"]["application"])
        self.assertEqual(summary["format"], option["attributes"]["format"])
        self.assertNotIn("original_inventory_record", summary)
        self.assertNotIn("application", service.list_study_options(MIT)["items"][1])

    def test_legacy_mba_level_uses_selected_option_scope_without_award_inference(self):
        profile = {"study_level": "MBA", "selectedAdmissionChoices": {MIT: {"studyOptionId": "physics"}}}
        self.assertEqual(service.resolve_context(MIT, profile)["context"]["study_level"], "masters")
        self.mit()["study_options"][1]["levels"] = ["professional"]
        self.write()
        self.assertEqual(service.resolve_context(MIT, profile)["context"]["study_level"], "professional")
        self.assertEqual(service.resolve_context(MIT, {"study_level": "MBA"})["context_applicability"]["level"], "unknown")

    def test_revision_reload_and_explicit_missing_corrupt_invalid_reference_errors(self):
        previous = service.get_revision()
        self.mit()["facts"][0]["value"]["requirements"]["SAT"] = 1300
        self.write()
        self.assertNotEqual(service.get_revision(), previous)
        self.assertEqual(self.resolve()["facts"][0]["value"]["requirements"]["SAT"], 1300)
        self.path.write_text("not JSON", encoding="utf-8")
        with self.assertRaises(service.AdmissionsCatalogError):
            service.get_revision()
        self.write()
        self.mit()["facts"][0]["source_ids"] = ["broken"]
        self.write()
        with self.assertRaisesRegex(service.AdmissionsCatalogError, "reference"):
            service.get_revision()
        self.path.unlink()
        with self.assertRaises(service.AdmissionsCatalogError):
            service.get_revision()

    def test_inflight_projection_retains_its_original_revision_during_reload(self):
        revision = service.get_revision()
        applicability = service._fact_applicability

        def reload_during_projection(*args):
            self.mit()["facts"][0]["value"]["requirements"]["SAT"] = 1350
            self.write()
            self.assertNotEqual(service.get_revision(), revision)
            return applicability(*args)

        with patch.object(service, "_fact_applicability", side_effect=reload_during_projection):
            result = self.resolve()
        self.assertEqual(result["revision"], revision)
        self.assertEqual(result["facts"][0]["value"]["requirements"]["SAT"], 1200)

    def test_unreviewed_institution_not_found_and_wrong_contract_rejected(self):
        self.assertIsNone(service.get_institution("university-of-oxford-uk-oxford"))
        with self.assertRaises(service.InstitutionNotFoundError):
            service.resolve_context("university-of-oxford-uk-oxford")
        self.data["runtime_active"] = False
        self.write()
        with self.assertRaisesRegex(service.AdmissionsCatalogError, "contract"):
            service.get_revision()

    def test_mit_completed_overviews_resolve_before_route_selection(self):
        with patch.object(service, "CATALOG_PATH", PRODUCTION_PATH):
            service.clear_cache()
            institution = service.get_institution("mit-usa-cambridge")
            for option_id in ("mit-bs-3-c", "mit-bs-21", "mit-bs-sts", "mit-chemical-engineering-sm", "mit-eecs-en-route-sm", "mit-hst-terminal-sm"):
                resolved = service.resolve_context("mit-usa-cambridge", context={"study_option_id": option_id})
                records = [row for row in resolved["facts"] if row["id"] in resolved["fact_groups"].get("study", []) and isinstance(row.get("value"), dict) and row["value"].get("description")]
                self.assertTrue(records, option_id)
                overview = next(row for row in records if row["id"].endswith("study-overview-2026-10-20"))
                self.assertEqual([option_id], overview["scope"]["option_ids"])
                self.assertEqual([], overview["scope"]["route_ids"])
                self.assertEqual("2026-10-20", overview["checked_at"])
                self.assertTrue(overview["source_ids"])
                self.assertIsNone(resolved["selected_route"])
            self.assertEqual(191, len(institution["study_options"]))

    def test_real_normalized_snapshot_contrasts_and_fidelity(self):
        with patch.object(service, "CATALOG_PATH", PRODUCTION_PATH):
            service.clear_cache()
            mit = service.get_institution(MIT)
            self.assertEqual(len(mit["study_options"]), 191)
            result = service.resolve_context(MIT, context={"study_option_id": "mit-course-6-3-bachelor", "application_route_id": "mit-first-year", "study_level": "undergraduate"})
            self.assertEqual(result["selected_route"]["id"], "mit-first-year")
            self.assertFalse(any(row["scope"]["route_ids"] == ["mit-transfer"] for row in result["facts"]))
            self.assertTrue(result["history"]["fact_ids"])
            self.assertTrue(result["history"]["facts"])
            self.assertTrue(all(row["applicability"]["status"] != "mismatched" for row in result["history"]["facts"]))
            active_ids = {row["id"] for row in result["facts"]}
            source_ids = {row["id"] for row in result["sources"]}
            for row in result["history"]["facts"]:
                self.assertNotIn(row["id"], active_ids)
                self.assertTrue(set(row["source_ids"]).issubset(source_ids))
                self.assertNotEqual(row["scope"]["route_ids"], ["mit-transfer"])
            for prepared in result["facts"]:
                original = next(row for row in mit["facts"] if row["id"] == prepared["id"])
                self.assertEqual({key: value for key, value in prepared.items() if key != "applicability"}, original)
            imperial = service.resolve_context("imperial-college-london-uk", context={"study_option_id": "imperial-option-computing-meng", "study_level": "undergraduate"})
            self.assertEqual(imperial["selected_option"]["levels"], ["undergraduate"])
            self.assertEqual(imperial["selected_option"]["awards"], ["MEng"])
            self.assertIsNone(imperial["selected_route"])
            self.assertTrue(imperial["facts"])
            stanford = service.resolve_context("stanford-university-usa-ca", context={"study_option_id": "stanford-option-cs-bs", "application_route_id": "undergraduate-shared-evidence:stanford-transfer", "study_level": "undergraduate"})
            self.assertEqual(stanford["selected_route"]["id"], "undergraduate-shared-evidence:stanford-transfer")
            self.assertFalse(any(row["scope"]["route_ids"] == ["undergraduate-shared-evidence:stanford-first-year"] for row in stanford["facts"]))
            self.assertTrue(stanford["selected_option"]["source_ids"])
            self.assertEqual(stanford["reference_labels"]["stanford-aa-ms"], "Aeronautics and Astronautics (MS)")
            self.assertEqual(stanford["reference_labels"]["stanford-option-cs-bs"], stanford["selected_option"]["title"])
            requirement_ids = set(stanford["fact_groups"].get("requirements", []))
            for row in stanford["facts"]:
                if row["topic"] in {"standardized_tests", "academic_credential", "academic_eligibility", "english_proficiency", "english_proficiency_test_scores"}:
                    self.assertIn(row["id"], requirement_ids)
            requirement_ids = set(imperial["fact_groups"].get("requirements", []))
            for row in imperial["facts"]:
                if row["topic"] in {"academic_application", "language_exemptions", "language_preparation"}:
                    self.assertIn(row["id"], requirement_ids)
            business = service.resolve_context("imperial-college-london-uk", context={"study_option_id": "imperial-option-business-mres", "study_level": "masters"})
            for row in business["facts"]:
                if "programme_phase" in row["scope"]["additional_dimensions"]:
                    self.assertEqual(row["applicability"]["conditions"], "unknown")

    def test_stanford_current_fee_aid_and_cs_policy_replace_resolved_gaps(self):
        with patch.object(service, "CATALOG_PATH", PRODUCTION_PATH):
            service.clear_cache()
            for route, aid_id, other_aid_id in [
                ("stanford-first-year", "firstyear", "transfer"),
                ("stanford-transfer", "transfer", "firstyear"),
            ]:
                result = service.resolve_context("stanford-university-usa-ca", context={
                    "study_option_id": "stanford-option-cs-bs",
                    "application_route_id": "undergraduate-shared-evidence:" + route,
                    "study_level": "undergraduate",
                    "intended_entry_cycle": "2027-2028",
                })
                facts = {row["id"].split(":")[-1]: row for row in result["facts"]}
                self.assertIn(f"stanford-ug-{aid_id}-domestic-aid-2027-28", list(facts))
                self.assertNotIn(f"stanford-ug-{other_aid_id}-domestic-aid-2027-28", list(facts))
                aid = facts[f"stanford-ug-{aid_id}-domestic-aid-2027-28"]
                self.assertIn("2025", aid["value"])
                self.assertIn("do not file FAFSA", aid["value"])
                unknowns = {row["id"] for row in result["unknowns"]}
                self.assertNotIn("undergraduate-shared-evidence:stanford-firstyear-aid-2027-28-publication", unknowns)
                self.assertNotIn("undergraduate-shared-evidence:stanford-transfer-application-fee-conflict", unknowns)
                if route == "stanford-transfer":
                    fee = facts["stanford-transfer-fee"]
                    self.assertEqual(fee["publication_status"], "published")
                    self.assertEqual(fee["review_status"], "reviewed")
                    self.assertIn("USD 100", fee["value"])
                    self.assertIn("undergraduate-shared-evidence:stanford-transfer-application-fee-conflict", result["history"]["unknown_ids"])
            cs = service.resolve_context("stanford-university-usa-ca", context={
                "study_option_id": "stanford-option-cs-ms",
                "application_route_id": "engineering-doerr-evidence:external-graduate",
            })
            facts = {row["id"].split(":")[-1]: row for row in cs["facts"]}
            self.assertIn("cannot apply", facts["cs-ms-entry-and-hcp"]["value"])
            english = facts["cs-ms-tests-and-english-policy"]
            self.assertEqual(english["review_status"], "reviewed")
            self.assertIn("full-time professional or educational experience", english["value"])
            self.assertIn("cs-checklist", [sid.split(":")[-1] for sid in english["source_ids"]])

    def test_every_stanford_program_and_linked_route_resolves_with_scoped_sources(self):
        with patch.object(service, "CATALOG_PATH", PRODUCTION_PATH):
            service.clear_cache()
            institution = service.get_institution("stanford-university-usa-ca")
            self.assertEqual(len(institution["study_options"]), 254)
            for option in institution["study_options"]:
                for route_id in [None, *option["route_ids"]]:
                    with self.subTest(option=option["id"], route=route_id):
                        result = service.resolve_context("stanford-university-usa-ca", context={
                            "study_option_id": option["id"], "application_route_id": route_id,
                            "study_level": option["levels"][0],
                        })
                        self.assertEqual(result["selected_option"]["id"], option["id"])
                        self.assertNotEqual(result["context_applicability"]["route"], "mismatched")
                        self.assertEqual(result["selected_route"]["id"] if route_id else result["selected_route"], route_id)
                        self.assertTrue(result["facts"] or result["unknowns"])
                        source_ids = {source["id"] for source in result["sources"]}
                        facts = {row["id"]: row for row in result["facts"]}
                        for group in result["fact_groups"].values():
                            self.assertTrue(set(group).issubset(facts))
                        for row in [*result["facts"], *result["unknowns"]]:
                            self.assertTrue(row["source_ids"])
                            self.assertTrue(set(row["source_ids"]).issubset(source_ids))
                            self.assertFalse((row["review_status"] or "").startswith("superseded"))
                            self.assertNotEqual(row["applicability"]["status"], "mismatched")
                            if row["scope"]["option_ids"]:
                                self.assertIn(option["id"], row["scope"]["option_ids"])

    def test_all_completed_stanford_medical_overviews_resolve_with_their_specific_sources(self):
        with patch.object(service, "CATALOG_PATH", PRODUCTION_PATH):
            service.clear_cache()
            institution = service.get_institution("stanford-university-usa-ca")
            completed = [option for option in institution["study_options"]
                         if any(profile["attributes"].get("catalog_access_description") for profile in option["evidence_profiles"])]
            self.assertEqual(len(completed), 16)
            for option in completed:
                result = service.resolve_context("stanford-university-usa-ca", context={"study_option_id": option["id"]})
                self.assertIsNone(result["selected_route"])
                self.assertEqual(result["selected_option"]["id"], option["id"])
                sources = {source["id"]: source for source in result["sources"]}
                overviews = result["selected_option"]["overviews"]
                self.assertTrue(overviews, option["id"])
                for overview in overviews:
                    self.assertNotIn("Bulletin flags:", overview["text"])
                    self.assertTrue(set(overview["source_ids"]).issubset(sources))
                self.assertTrue(any(source["checked_at"] == "2026-10-19"
                                    and source["url"].startswith("https://bulletin.stanford.edu/programs/")
                                    for source in sources.values()), option["id"])
                record_id = "medicine-graduate-evidence:study-overview-" + option["id"].removeprefix("stanford-option-")
                self.assertIn(record_id, result["fact_groups"]["study"])
                self.assertNotIn(record_id, result["fact_groups"].get("requirements", []))


if __name__ == "__main__":
    unittest.main()
