import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.prepare_nu_admissions import NU_ID, convert_research_catalog, prepare_nu_institution, build_nu_assessments
from app.services import admissions_catalog, admissions_assessment, universities


ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "backend/data/drafts" / NU_ID


class NuAdmissionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = json.loads((FOLDER / "research-catalog.json").read_text(encoding="utf-8"))
        cls.nu = convert_research_catalog(cls.raw)
        cls.index = {key: {row["id"]: row for row in cls.nu[key]} for key in ("study_options", "application_routes", "facts", "sources", "unknowns")}
        cls.records = build_nu_assessments(cls.nu)

    def resolve(self, option, route, level, profile=None, cycle=None):
        with patch.object(admissions_catalog, "_institution", return_value=({"revision": "nu-test"}, self.nu, self.index)):
            resolved = admissions_catalog.resolve_context(NU_ID, profile, {"study_option_id": option, "application_route_id": route,
                "study_level": level, "applicant_route": "graduate" if level in {"masters", "doctoral", "professional", "residency"} else "first_year",
                "intended_entry_cycle": cycle})
        return resolved

    def assess(self, resolved, profile):
        annotations = {(NU_ID, row["fact_id"]): row for row in self.records}
        with patch.object(admissions_assessment, "_annotations", return_value=(annotations, "nu-test")):
            return admissions_assessment.assess_resolved_context(resolved, profile)

    def test_program_summary_exposes_its_reviewed_official_page(self):
        resolved = self.resolve("nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", "undergraduate")
        self.assertEqual("https://nusom.nu.edu.kz/bn", resolved["selected_option"].get("course_url"))
        foundation = self.resolve("nu-a-study-nu-foundation-year-program", "nu-a-route-regular-foundation-undergraduate", "preparation")
        self.assertTrue(any("preparation" in row["text"] for row in foundation["selected_option"]["overviews"]))

    def test_all_research_values_and_provenance_survive_conversion(self):
        for original in self.raw["facts"]:
            fact = self.index["facts"][original["id"]]
            for key in ("value", "conditions", "exceptions", "publication_status", "review_status", "checked_at", "source_ids"):
                self.assertEqual(original[key], fact[key], (original["id"], key))
            self.assertEqual(original["provenance"]["original_scope"], fact["provenance"]["original_scope"])
        self.assertEqual(96, len(self.nu["study_options"]))
        self.assertEqual({"preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"},
                         {level for row in self.nu["study_options"] for level in row["levels"]})
        self.assertEqual([], self.index["study_options"]["nu-a-study-nuzyp"]["route_ids"])
        self.assertEqual(["professional"], self.index["study_options"]["nu-b-study-doctor-of-medicine"]["levels"])

    def test_converter_rejects_unreviewed_publication_gap(self):
        raw = copy.deepcopy(self.raw)
        raw["unknowns"][0]["source_ids"] = None
        with self.assertRaisesRegex(ValueError, "gap lacks reviewed source"):
            convert_research_catalog(raw)

    def test_acceptance_is_exact_and_cannot_survive_catalog_tampering(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary) / "backend/data/drafts" / NU_ID
            (folder / "packet-b").mkdir(parents=True)
            path = folder / "research-catalog.json"
            path.write_text(json.dumps(self.raw), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "independent data acceptance"):
                prepare_nu_institution(folder)
            acceptance = {"status": "accepted", "catalog_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            (folder / "packet-b/data-acceptance.json").write_text(json.dumps(acceptance), encoding="utf-8")
            path.write_text(path.read_text(encoding="utf-8") + "\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "stale"):
                prepare_nu_institution(folder)

    def test_reviewed_inputs_survive_git_line_endings_but_not_content_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            folder = repo / "backend/data/drafts" / NU_ID
            folder.mkdir(parents=True)
            for item in self.raw["inputs"]:
                for name in (item["path"], item.get("handoff_path")):
                    if name:
                        target = repo / name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes((ROOT / name).read_bytes().replace(b"\r\n", b"\n"))
            original = (FOLDER / "research-catalog.json").read_bytes()
            (folder / "research-catalog.json").write_bytes(original.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
            acceptance = {"status": "accepted", "catalog_sha256": hashlib.sha256(original).hexdigest()}
            (folder / "packet-b/data-acceptance.json").write_text(json.dumps(acceptance), encoding="utf-8")
            converted = prepare_nu_institution(folder)
            self.assertEqual(self.nu["facts"], converted["facts"])
            handoff = folder / "packet-c/handoff.md"
            handoff.write_bytes(handoff.read_bytes() + b"Changed reviewed content\n")
            with self.assertRaisesRegex(ValueError, "handoff changed"):
                prepare_nu_institution(folder)

    def test_residency_branches_keep_one_form_without_early_conditional_report(self):
        option = "nu-c-study-residency-in-family-medicine"
        unconditional = self.resolve(option, "nu-residency-unconditional", "residency")
        conditional = self.resolve(option, "nu-residency-conditional-umc", "residency")
        self.assertEqual(unconditional["selected_route"]["shared_form_family"], conditional["selected_route"]["shared_form_family"])
        for context in (unconditional, conditional):
            self.assertEqual("matched", context["context_applicability"]["route"])
            self.assertTrue(context["selected_option"]["overviews"])
            self.assertEqual([], context["selected_option"]["awards"])
            self.assertEqual("Full time, on-campus", context["selected_option"]["format"]["mode"])
            self.assertTrue(context["selected_option"]["format"]["duration"])
            self.assertTrue(context["selected_option"]["format"]["language"])
            self.assertNotIn("nu-b-aleks-scale-reference", {row["id"] for row in context["facts"]})
        self.assertIn("nu-c-residency-unconditional", {row["id"] for row in unconditional["facts"]})
        self.assertNotIn("nu-c-residency-unconditional", {row["id"] for row in conditional["facts"]})
        missing = self.assess(unconditional, {})
        self.assertTrue(any(row.get("checkId") == "medical-report" and row["status"] == "missing" for row in missing["activeChoice"]["details"]["checks"]))
        deferred = self.assess(conditional, {})
        self.assertFalse(any(row.get("checkId") == "medical-report" for row in deferred["activeChoice"]["details"]["checks"]))
        supplied = self.assess(unconditional, {"exams": [{"id": "IFOM_BSE", "score": 1}]})
        self.assertIsNone(supplied["overallChance"])
        self.assertTrue(any(row.get("checkId") == "medical-report" and row["status"] == "met" for row in supplied["activeChoice"]["details"]["checks"]))

    def test_foundation_and_undergraduate_thresholds_do_not_leak(self):
        route = "nu-a-route-regular-foundation-undergraduate"
        foundation = self.resolve("nu-a-study-nu-foundation-year-program", route, "preparation", cycle="2027/28")
        ug = self.resolve("nu-a-study-bachelor-of-science-in-computer-science", route, "undergraduate", cycle="2027/28")
        self.assertIn("nu-a-fact-fyp-english", {row["id"] for row in foundation["facts"]})
        self.assertNotIn("nu-a-fact-fyp-english", {row["id"] for row in ug["facts"]})
        self.assertNotIn("nu-b-aleks-scale-reference", {row["id"] for row in ug["facts"]})
        self.assertNotIn("nu-c-graduate-guarantee-fee", {row["id"] for row in ug["facts"]})
        profile = {"exams": [{"id": "NUET", "score": 150, "details": {"components": [{"exam": "NUET_MATH", "score": 49}, {"exam": "NUET_CRITICAL_THINKING", "score": 101}]}}]}
        result = self.assess(foundation, profile)
        academic = next(row for row in result["activeChoice"]["details"]["checks"] if row["factId"] == "nu-a-fact-fyp-academic" and row.get("checkId"))
        self.assertEqual("unmet", academic["status"])
        self.assertEqual("unmet", academic["provided"]["minimum_checks"][1]["status"])
        self.assertFalse(any(row.get("rule", {}).get("alternatives", [{}])[0].get("exam_id") == "NUET" for row in self.assess(ug, profile)["activeChoice"]["details"]["checks"]))

    def test_funding_checks_do_not_produce_an_admission_probability(self):
        context = self.resolve("nu-a-study-nu-foundation-year-program", "nu-a-route-financial-support", "preparation", cycle="2027/28")
        result = self.assess(context, {})
        self.assertIsNone(result["overallChance"])
        self.assertEqual("funding_selection_separate", result["reason"])

    def test_prices_remain_scoped_and_finance_is_not_annual(self):
        with patch.object(admissions_catalog, "get_institution", return_value=self.nu):
            finance = admissions_catalog.catalog_costs(NU_ID, "masters", study_option_id="nu-b-study-master-of-science-in-finance")
            msn = admissions_catalog.catalog_costs(NU_ID, "masters", study_option_id="nu-b-study-master-of-science-in-nursing")
            foundation = admissions_catalog.catalog_costs(NU_ID, "preparation", study_option_id="nu-a-study-nu-foundation-year-program")
        self.assertEqual([14000, 35000], finance["tuition"]["amounts"])
        self.assertFalse(finance["tuition"]["annual_comparable"])
        self.assertIsNone(universities._catalog_cost_range_usd({"catalog_costs": finance}, "tuition"))
        self.assertEqual([6000], msn["tuition"]["amounts"])
        self.assertEqual([12000], foundation["tuition"]["amounts"])
        self.assertIsNone(finance["annual_total"])

    def test_deadlines_keep_test_support_category_and_no_invented_day(self):
        events = self.index["facts"]["nu-a-fact-financial-support-eligibility-2027-28"]["attributes"]["deadline_events"]
        self.assertEqual({"2026-12-05", "2026-11-28"}, {row["date"] for row in events})
        self.assertTrue(all(row["deadline_type"] == "test_date" and row["application_category"] == "financial_support" for row in events))
        for ident in ("nu-a-fact-regular-window", "nu-a-fact-midyear-window", "nu-b-mba-windows", "nu-b-joint-soas-dates-cost-support"):
            self.assertNotIn("deadline_events", self.index["facts"][ident]["attributes"])

    def test_joint_campus_prices_keep_study_years_and_do_not_assume_a_stage(self):
        quotes = self.index["facts"]["nu-a-fact-joint-bba-costs"]["attributes"]["catalog_costs"]["quotes"]
        self.assertEqual([15000, 31900, 93800, 11250], [row["amount"] for row in quotes])
        self.assertEqual([1, 2], quotes[0]["study_years"])
        self.assertEqual([3, 4], quotes[1]["study_years"])
        self.assertEqual("whole_program", quotes[2]["billing_period"])
        self.assertEqual("2026 intake", quotes[3]["source_year"])
        self.assertTrue(all(row["reference_only"] for row in quotes))
        option = next(row for row in self.nu["study_options"] if "nu-a-route-joint-bba" in row["route_ids"])
        with patch.object(admissions_catalog, "get_institution", return_value=self.nu):
            costs = admissions_catalog.catalog_costs(NU_ID, study_option_id=option["id"])
        self.assertIsNone(costs["tuition"])

    def test_midyear_is_a_shared_context_with_its_own_dated_history(self):
        route = "nu-a-route-midyear-2026-27"
        current = self.resolve(None, route, "undergraduate", cycle="2026/27_midyear")
        self.assertEqual("institution_route", current["reading_scope"])
        self.assertIsNone(current["selected_option"])
        self.assertEqual("not_required", current["context_applicability"]["option"])
        self.assertIn("nu-a-fact-midyear-nuet", {row["id"] for row in current["facts"]})
        future = self.resolve(None, route, "undergraduate", cycle="2027/28")
        self.assertNotIn("nu-a-fact-midyear-nuet", {row["id"] for row in future["facts"]})
        self.assertIn("nu-a-fact-midyear-nuet", {row["id"] for row in future["history"]["facts"]})
        self.assertIsNone(self.assess(current, {})["overallChance"])

    def test_transfer_and_all_source_bound_annotations_reach_requirements(self):
        transfer = self.resolve("nu-a-study-bachelor-of-science-in-computer-science", "nu-a-route-transfer", "undergraduate")
        self.assertIn("nu-a-fact-transfer-route-details", transfer["fact_groups"]["requirements"])
        self.assertTrue(any(row["kind"] == "manual_minimum" for row in self.assess(transfer, {})["activeChoice"]["details"]["checks"]))
        for record in self.records:
            fact = self.index["facts"][record["fact_id"]]
            routes = [row for row in self.nu["application_routes"] if not fact["scope"]["route_ids"] or row["id"] in fact["scope"]["route_ids"]]
            candidates = [(option, route) for route in routes for option in self.nu["study_options"]
                          if route["id"] in option["route_ids"] and (not fact["scope"]["option_ids"] or option["id"] in fact["scope"]["option_ids"])
                          and (not fact["scope"]["levels"] or set(option["levels"]).intersection(fact["scope"]["levels"]))]
            if fact["scope"]["route_ids"] == ["nu-a-route-midyear-2026-27"]:
                context = self.resolve(None, "nu-a-route-midyear-2026-27", "undergraduate", cycle="2026/27_midyear")
            else:
                self.assertTrue(candidates, record["fact_id"])
                option, route = candidates[0]
                context = self.resolve(option["id"], route["id"], option["levels"][0], cycle=(record["scope"]["cycles"] or [None])[0])
            self.assertIn(record["fact_id"], context["fact_groups"].get("requirements", []), record["fact_id"])
            self.assertTrue(any(row["factId"] == record["fact_id"] for row in self.assess(context, {})["activeChoice"]["details"]["checks"]), record["fact_id"])

    def test_programme_unknowns_do_not_leak_into_transfer(self):
        transfer = self.resolve("nu-a-study-bachelor-of-science-in-computer-science", "nu-a-route-transfer", "undergraduate")
        unknown_ids = {row["id"] for row in transfer["unknowns"]}
        self.assertTrue({"nu-a-gap-nuzyp-activity", "nu-a-gap-engineering-masters", "nu-a-gap-joint-bba", "nu-a-gap-nursing",
                         "nu-b-gap-emba-price", "nu-b-gap-som-phd-regular-gpa", "nu-b-gap-joint-future-and-funding",
                         "nu-b-gap-curriculum-anomalies"}.isdisjoint(unknown_ids))
        for unknown in self.nu["unknowns"]:
            if unknown["index_attributes"]["owner_packet"] in {"a", "b"}:
                self.assertTrue(unknown["scope"]["option_ids"] or unknown["scope"]["route_ids"], unknown["id"])
                self.assertTrue(unknown["provenance"]["original_scope"], unknown["id"])

    def test_mba_filter_recognizes_native_awards_without_a_research_doctorate(self):
        rows = universities.list_universities(study_level="MBA", paginate=False)["items"]
        self.assertIn(NU_ID, {row["id"] for row in rows})
        for award, expected in (("Master of Business Administration", True), ("Executive Master of Business Administration", True),
                                ("MBA", True), ("PhD in Business Administration", False), ("Doctor of Business Administration", False)):
            institution = {"study_options": [{"title": award, "awards": [award], "levels": ["masters"] if expected else ["doctoral"]}]}
            with patch.object(admissions_catalog, "get_institution", return_value=institution):
                metadata = universities._build_university_meta({"id": "qualification-test"})
            self.assertEqual(expected, "mba" in metadata["study_levels"], award)


if __name__ == "__main__":
    unittest.main()
