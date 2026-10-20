import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch


REPO = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("prepare_admissions_catalog", REPO / "backend/scripts/prepare_admissions_catalog.py")
preparation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preparation)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


class AdmissionsCatalogPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.batch = preparation.prepare_batch()
        cls.by_id = {row["institution"]["id"]: row for row in cls.batch["institutions"]}

    def test_real_accepted_batch_has_one_inactive_format(self):
        self.assertEqual(self.batch["schema_version"], "admissions-storage-1.0")
        self.assertIs(self.batch["runtime_active"], False)
        self.assertEqual([(len(row["study_options"]), len(row["application_routes"]), len(row["facts"]), len(row["unknowns"]))
                          for row in self.batch["institutions"]], [(191, 73, 919, 0), (360, 311, 1340, 73), (254, 465, 1414, 95)])
        self.assertEqual({frozenset(row) for row in self.batch["institutions"]}, {frozenset(self.batch["institutions"][0])})

    def test_imperial_reassembly_preserves_history_without_retired_runtime_programs(self):
        original = preparation.DRAFTS / "imperial-college-london-uk"
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary) / "imperial"
            shutil.copytree(original, folder)
            history = (folder / "runtime-provenance.json").read_bytes()
            result = subprocess.run([sys.executable, str(folder / "assemble.py"), "--reviewed"],
                                    capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((folder / "runtime-provenance.json").read_bytes(), history)
            self.assertEqual(read(folder / "catalog.json"), read(original / "catalog.json"))

    def test_imperial_project_examples_are_not_compulsory_modules(self):
        imperial = self.by_id["imperial-college-london-uk"]
        for subject in ("data_science", "epidemiology_evolution_control_infectious_diseases", "biomedical_research",
                        "microbiome_health_disease", "molecular_basis_of_human_disease", "respiratory_cardiovascular_science"):
            fact = next(row for row in imperial["facts"] if row["id"] == f"fact_{subject}_study_structure")
            required, examples = fact["value"]["study_periods_pathways_and_components"]
            self.assertEqual(required["component_type"], "required_coursework")
            self.assertEqual(required["published_component_names"], ["Grant Writing Exercise", "Research Project 1 and Research Project 2"])
            self.assertEqual(examples["component_type"], "illustrative_research_projects")
            self.assertGreater(len(examples["published_component_names"]), 5)
            self.assertTrue(set(required["published_component_names"]).isdisjoint(examples["published_component_names"]))
            self.assertTrue(any("priority" in note for note in examples["published_requirement_or_structure_notes"]))

    def test_backend_snapshot_preserves_all_prepared_entities(self):
        snapshot = read(REPO / "backend/data/admissions/catalog.json")
        self.assertEqual(snapshot["schema_version"], self.batch["schema_version"])
        self.assertIs(snapshot["runtime_active"], True)
        for original, stored in zip(self.batch["institutions"], snapshot["institutions"]):
            for key in ("institution", "snapshot", "study_options", "application_routes", "facts", "unknowns", "sources", "collection_tasks", "organization", "dossier_metadata"):
                self.assertEqual(stored[key], original[key], key)
            self.assertEqual([row["path"] for row in stored["inputs"]], [row["path"] for row in original["inputs"]])

    def test_every_resolved_fact_preserves_significant_evidence(self):
        cache = {}
        for name, institution in zip(preparation.BATCH, self.batch["institutions"]):
            folder = preparation.DRAFTS / name
            for fact in institution["facts"]:
                origin = fact["provenance"]
                path = folder / origin["evidence_file"]
                if path not in cache:
                    cache[path] = {row["id"]: row for row in read(path)["facts"]}
                raw = cache[path][origin["original_id"]]
                self.assertEqual(fact["value"], raw["value"], fact["id"])
                self.assertEqual(origin["original_scope"], raw["scope"], fact["id"])
                self.assertEqual(origin["original_source_ids"], raw["source_ids"], fact["id"])
                for key in ("conditions", "conditions_and_exceptions", "exceptions", "publication_status", "review_status", "checked_at", "period"):
                    self.assertEqual(fact[key], raw.get(key), (fact["id"], key))
                for key, value in raw.items():
                    if key in fact["attributes"]:
                        self.assertEqual(fact["attributes"][key], value)
                    elif key not in ("id", "scope", "source_ids", "content_reviewed_at"):
                        self.assertEqual(fact[key], value, (fact["id"], key))
                known_scope = {"option_ids", "study_option_ids", "study_option_id", "route_ids", "procedure_ids", "levels",
                               "study_levels", "study_level", "level", "applicant_categories", "applicant_category", "cycle", "admission_cycle", "fee_status"}
                for key, value in raw["scope"].items():
                    if key not in known_scope:
                        self.assertEqual(fact["scope"]["additional_dimensions"][key], value)

    def test_every_source_retains_exact_record_and_merged_evidence(self):
        for name, institution in zip(preparation.BATCH, self.batch["institutions"]):
            folder = preparation.DRAFTS / name
            raw_sources = read(folder / "catalog.json")["sources"] if name == "mit" else read(folder / "sources.json")["sources"]
            sources = {row["id"]: row for row in institution["sources"]}
            for raw in raw_sources:
                prepared = sources[raw["id"]]
                self.assertEqual({**prepared["attributes"], **{key: prepared[key] for key in ("id", "url", "title", "checked_at")}}, raw)
        imperial = self.by_id["imperial-college-london-uk"]
        self.assertEqual(sum(len(row["attributes"]["evidence_records"]) > 1 for row in imperial["sources"]), 35)

    def test_mit_conditions_superseded_facts_and_periods_remain_distinct(self):
        mit = self.by_id["mit-usa-cambridge"]
        self.assertEqual(sum(row["review_status"] == "superseded" for row in mit["facts"]), 93)
        self.assertTrue(any(any("required_applicant_evidence" in condition for condition in row["conditions"])
                            for row in mit["facts"] if isinstance(row["conditions"], list)))
        fact = next(row for row in mit["facts"] if row["id"] == "mit-first-year-description")
        self.assertEqual(fact["scope"]["option_ids"], [])
        self.assertEqual(fact["scope"]["route_ids"], ["mit-first-year"])
        self.assertEqual(fact["checked_at"], "2026-09-24")
        self.assertEqual(fact["period"], {"label": "Fall 2027 entry", "kind": "named"})

    def test_imperial_integrated_award_and_separate_selectors(self):
        imperial = self.by_id["imperial-college-london-uk"]
        meng = next(row for row in imperial["study_options"] if row["id"] == "imperial-option-computing-meng")
        self.assertEqual(meng["levels"], ["undergraduate"])
        self.assertEqual(meng["awards"], ["MEng"])
        chemistry = {row["id"]: row for row in imperial["study_options"] if "digital-chemistry" in row["id"]}
        self.assertEqual(chemistry["imperial-option-digital-chemistry-variant-1"]["parent_option_id"], "imperial-option-digital-chemistry")
        self.assertEqual(chemistry["imperial-option-digital-chemistry-variant-1"]["awards"], ["PG Cert"])
        self.assertTrue(any(row["conditions_and_exceptions"] for row in imperial["facts"]))
        self.assertTrue(any(row["publication_status"] == "historical" for row in imperial["facts"]))
        self.assertTrue(any("programme_phase" in row["scope"]["additional_dimensions"] for row in imperial["facts"]))
        undated = next(row for row in imperial["facts"] if row["checked_at"] is None)
        self.assertIsNotNone(undated["content_reviewed_at"])

    def test_stanford_namespaces_profiles_and_shared_policy_boundaries(self):
        stanford = self.by_id["stanford-university-usa-ca"]
        option = next(row for row in stanford["study_options"] if row["id"] == "stanford-option-aa-bs")
        source_id = "undergraduate-study-evidence:stanford-bulletin-aa-bs"
        self.assertIn(source_id, option["source_ids"])
        profile = next(row for row in option["evidence_profiles"] if row["evidence_file"] == "undergraduate-study-evidence.json")
        self.assertIn(source_id, profile["source_ids"])
        self.assertIn("stanford-bulletin-aa-bs", profile["attributes"]["source_ids"])
        shared = [row for row in stanford["application_routes"] if row["shared_policy_context_ids"]]
        self.assertTrue(shared)
        self.assertTrue(any(row["id"].startswith("directory-evidence:") for row in shared))
        raw_routes = {row["id"]: row for row in read(preparation.DRAFTS / "stanford-university-usa-ca/catalog.json")["application_procedures"]}
        self.assertTrue(all(row["shared_policy_context_ids"] == raw_routes[row["id"]]["shared_policy_context_ids"] for row in shared))
        original_ids = [row["provenance"]["original_id"] for row in stanford["application_routes"]]
        self.assertLess(len(set(original_ids)), len(original_ids))
        self.assertEqual(sum(row["review_status"] == "superseded_by_completed_research" for row in stanford["unknowns"]), 7)

    def test_route_core_semantics_are_directly_usable(self):
        for name, institution in zip(preparation.BATCH, self.batch["institutions"]):
            catalog = read(preparation.DRAFTS / name / "catalog.json")
            raw_routes = catalog.get("application_routes", catalog.get("application_procedures"))
            for raw, route in zip(raw_routes, institution["application_routes"]):
                self.assertEqual(route["classification"], raw.get("classification", raw.get("application_classification")))
                self.assertEqual(route["target"], raw.get("official_target", raw.get("application_target", raw.get("target"))))
                self.assertEqual(route["destination"], raw.get("destination"))
                self.assertEqual(route["shared_form_family"], raw.get("shared_form_family"))

    def test_fact_links_add_only_explicit_scope_without_policy_inheritance(self):
        for name, institution in zip(preparation.BATCH, self.batch["institutions"]):
            catalog = read(preparation.DRAFTS / name / "catalog.json")
            for key, scope_key, catalog_key in (("study_options", "option_ids", "study_options"),
                                                 ("application_routes", "route_ids", "application_routes" if name == "mit" else "application_procedures")):
                originals = {row["id"]: row for row in catalog[catalog_key]}
                for row in institution[key]:
                    expected = list(dict.fromkeys([*originals[row["id"]].get("fact_ids", []),
                               *[fact["id"] for fact in institution["facts"] if row["id"] in fact["scope"][scope_key]]]))
                    self.assertEqual(row["fact_ids"], expected, row["id"])
        stanford = self.by_id["stanford-university-usa-ca"]
        aa = next(row for row in stanford["study_options"] if row["id"] == "stanford-option-aa-bs")
        shared = next(row for row in stanford["facts"] if row["scope"]["route_ids"] and not row["scope"]["option_ids"])
        self.assertTrue(aa["fact_ids"])
        self.assertNotIn(shared["id"], aa["fact_ids"])

    def test_unknowns_preserve_missing_status_and_official_next_step(self):
        for institution in self.batch["institutions"]:
            for row in institution["unknowns"]:
                self.assertTrue(row["reason"])
                self.assertTrue(row["official_next_step"])
        stanford = self.by_id["stanford-university-usa-ca"]
        unknown = next(row for row in stanford["unknowns"] if row["id"].endswith(":stanford-undergrad-housing-aid-offer-detail"))
        self.assertIsNone(unknown["publication_status"])
        self.assertIsNone(unknown["checked_at"])

    def test_mutated_references_fail_instead_of_dropping_evidence(self):
        mutations = (("study_options", "source_ids", ["missing-source"]),
                     ("application_routes", "option_ids", ["missing-option"]),
                     ("application_routes", "shared_policy_context_ids", ["missing-route"]),
                     ("application_routes", "fact_ids", ["missing-fact"]),
                     ("facts", "related_fact_ids", ["missing-fact"]))
        for key, field, value in mutations:
            institution = copy.deepcopy(self.batch["institutions"][0])
            institution[key][0][field] = value
            with self.assertRaises(preparation.PreparationError):
                preparation.validate_institution(institution)
        institution = copy.deepcopy(self.batch["institutions"][0])
        institution["facts"].append(institution["facts"][0])
        with self.assertRaisesRegex(preparation.PreparationError, "duplicate ID"):
            preparation.validate_institution(institution)
        institution = copy.deepcopy(self.batch["institutions"][0])
        institution["sources"][0]["id"] = ""
        with self.assertRaisesRegex(preparation.PreparationError, "missing record ID"):
            preparation.validate_institution(institution)

    def test_stale_and_broken_dossiers_and_open_collection_fail(self):
        source = preparation.DRAFTS / "stanford-university-usa-ca"
        original_catalog = read(source / "catalog.json")
        cases = ("fingerprint", "broken_fact", "missing_fact", "changed_unknown_status", "changed_unknown_sources",
                 "open_collection", "unaccepted", "path_escape", "wrong_institution", "missing_inventory", "unsupported_version")
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary) / source.name
            folder.mkdir()
            for path in source.glob("*.json"):
                shutil.copyfile(path, folder / path.name)
            for case in cases:
                catalog = copy.deepcopy(original_catalog)
                if case == "fingerprint":
                    filename = next(iter(catalog["evidence_fingerprints"]))
                    catalog["evidence_fingerprints"][filename] = "0" * 64
                elif case == "broken_fact":
                    catalog["facts"][0]["original_id"] = "missing"
                elif case == "missing_fact":
                    catalog["facts"].pop()
                elif case == "changed_unknown_status":
                    catalog["unresolved"][0]["review_status"] = "verified"
                elif case == "changed_unknown_sources":
                    catalog["unresolved"][0]["source_ids"] = [catalog["facts"][0]["source_ids"][0]]
                elif case == "open_collection":
                    catalog["collection_tasks"][0]["status"] = "collection_pending"
                elif case == "unaccepted":
                    catalog["snapshot"]["completion_status"] = "draft"
                elif case == "path_escape":
                    catalog["source_file"] = "../sources.json"
                elif case == "wrong_institution":
                    catalog["institution"]["id"] = "mit-usa-cambridge"
                elif case == "missing_inventory":
                    catalog["inventory_file"] = "missing-inventory.json"
                else:
                    catalog["schema_version"] = "99.0"
                (folder / "catalog.json").write_text(json.dumps(catalog), encoding="utf-8")
                with self.subTest(case=case), self.assertRaises(preparation.PreparationError):
                    preparation.prepare_institution(folder)

    def test_output_is_explicit_confined_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            destination = repo / ".tmp_test" / "prepared"
            prepared = {"schema_version": preparation.VERSION, "runtime_active": False, "institutions": []}
            path = preparation.write_output(prepared, destination, repo)
            self.assertEqual(read(path), prepared)
            with self.assertRaisesRegex(preparation.PreparationError, "already exists"):
                preparation.write_output(prepared, destination, repo)
            for invalid in (repo / "backend/data", repo / ".tmp_test", repo / "outside"):
                with self.assertRaisesRegex(preparation.PreparationError, "below repository"):
                    preparation.write_output(prepared, invalid, repo)
            self.assertFalse((repo / "backend").exists())

    def test_cli_defaults_to_check_only_and_failure_is_explicit(self):
        with patch.object(preparation, "prepare_batch", return_value=self.batch), patch.object(preparation, "write_output") as writer, patch("builtins.print"):
            self.assertEqual(preparation.main([]), 0)
            writer.assert_not_called()
        with patch.object(preparation, "prepare_batch", side_effect=preparation.PreparationError("broken input")), patch("builtins.print") as output:
            self.assertEqual(preparation.main([]), 1)
            self.assertIn("broken input", output.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
