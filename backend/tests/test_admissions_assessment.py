import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app.services import admissions_catalog
from app.services.admissions_assessment import assess_resolved_context
from app.services import admissions_assessment as assessment_service


class AdmissionsAssessmentTests(unittest.TestCase):
    def resolve(self, institution_id, **context):
        return admissions_catalog.resolve_context(institution_id, context=context)

    def assessment(self, resolved, profile=None):
        return assess_resolved_context(resolved, profile or {})

    @staticmethod
    def checks(result):
        return result["choices"][0]["details"]["checks"]

    def test_real_mit_required_sat_act_presence_is_assessed_without_inventing_cutoff(self):
        resolved = self.resolve(
            "mit-usa-cambridge",
            study_option_id="mit-course-6-3-bachelor",
            application_route_id="mit-first-year",
            study_level="undergraduate",
            applicant_route="first_year",
            intended_entry_cycle="Fall 2027 entry",
        )
        result = self.assessment(resolved, {"exams": [{"id": "ACT", "score": 34}]})

        self.assertIsNotNone(resolved["selected_route"])
        self.assertIn("ug-sat-act-presence", resolved["fact_groups"]["requirements"])
        self.assertEqual("conditional", next(f for f in resolved["facts"] if f["id"] == "ug-sat-act-presence")["applicability"]["status"])
        self.assertEqual("unassessed_minimums", result["reason"])
        self.assertIsNone(result["overallChance"])
        check = next(row for row in self.checks(result) if row["factId"] == "ug-sat-act-presence")
        self.assertEqual("met", check["status"])
        self.assertIn("source-600fe783c80073e0", check["sourceIds"])

    def test_real_imperial_computing_meng_preserves_unassessable_academic_rule(self):
        resolved = self.resolve(
            "imperial-college-london-uk",
            study_option_id="imperial-option-computing-meng",
            application_route_id="procedure-computing-meng",
            study_level="undergraduate",
            applicant_route="first_year",
            intended_entry_cycle="2027 entry",
        )
        result = self.assessment(resolved, {"exams": [{"id": "MAT", "score": 6}]})

        self.assertIsNotNone(resolved["selected_route"])
        self.assertTrue(resolved["fact_groups"]["requirements"])
        requirement_ids = set(resolved["fact_groups"]["requirements"])
        check = next(row for row in self.checks(result) if row["factId"] in requirement_ids)
        self.assertEqual("unassessed", check["status"])
        self.assertTrue(check["sourceIds"])
        self.assertIsNone(result["overallChance"])

    def test_real_stanford_cs_ms_keeps_requirement_fact_visible(self):
        resolved = self.resolve(
            "stanford-university-usa-ca",
            study_option_id="stanford-option-cs-ms",
            application_route_id="directory-evidence:stanford-graduate-cs-ms",
            study_level="masters",
            applicant_route="graduate",
            intended_entry_cycle="2027-28 entry",
        )
        result = self.assessment(resolved, {"exams": [{"id": "GRE", "score": 330}]})

        self.assertIsNotNone(resolved["selected_route"])
        self.assertTrue(resolved["fact_groups"]["requirements"])
        relevant = set(resolved["fact_groups"]["requirements"])
        checks = [row for row in self.checks(result) if row["factId"] in relevant]
        self.assertTrue(checks)
        self.assertTrue(all(row["status"] == "unassessed" for row in checks))
        self.assertTrue(all(row["sourceIds"] for row in checks))
        self.assertIsNone(result["overallChance"])

    def test_real_stanford_cs_first_year_has_no_invented_exam_minimum(self):
        resolved = self.resolve(
            "stanford-university-usa-ca",
            study_option_id="stanford-option-cs-bs",
            application_route_id="undergraduate-shared-evidence:stanford-first-year",
            study_level="undergraduate",
            applicant_route="first_year",
            intended_entry_cycle="Autumn 2027",
        )
        result = self.assessment(resolved, {"exams": [{"id": "SAT", "score": 1500}]})

        self.assertIn("requirements", resolved["fact_groups"])
        check = next(row for row in self.checks(result) if row["factId"].endswith(":stanford-firstyear-standardized-tests"))
        self.assertEqual("unassessed", check["status"])
        self.assertNotIn("minimum", check)
        self.assertIsNone(result["overallChance"])
        self.assertEqual("unassessed_minimums", result["reason"])

    def test_unknown_context_retains_resolver_candidates_and_source_ids_unassessed(self):
        resolved = self.resolve(
            "mit-usa-cambridge",
            study_option_id="mit-course-6-3-bachelor",
            application_route_id=None,
            study_level="undergraduate",
        )
        result = self.assessment(resolved, {"exams": [{"id": "ACT", "score": 34}]})

        self.assertIsNone(resolved["selected_route"])
        self.assertEqual("applicability_unknown", result["reason"])
        self.assertIsNone(result["overallChance"])
        self.assertTrue(self.checks(result))
        self.assertTrue(all(row["status"] == "unassessed" for row in self.checks(result)))
        self.assertTrue(all(row["sourceIds"] for row in self.checks(result)))

    def test_real_bcs_gpas_use_exact_internal_metric_and_preserve_uncovered_conditions(self):
        resolved = self.resolve("mit-usa-cambridge", study_option_id="mit-course-6-9p-meng",
                                application_route_id="mit_bcs_meng_admissions", study_level="masters")
        evidence = [
            {"kind": "enrollment", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "status": "enrolled"},
            {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "technical", "value": 4.24, "scale": 5, "as_of_term": "Spring 2026"},
            {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "overall", "value": 4, "scale": 5, "as_of_term": "Spring 2026"},
        ]
        result = self.assessment(resolved, {"institutional_evidence": evidence})
        checks = {row.get("checkId"): row for row in self.checks(result) if row["factId"] == "bcs-meng-entry-conditions"}
        self.assertEqual(checks["technical-gpa"]["status"], "unmet")
        self.assertEqual(checks["overall-gpa"]["status"], "met")
        self.assertIsNone(result["overallChance"])
        evidence[0]["major_units"] = 102
        evidence[1]["value"] = 4.25
        complete = self.assessment(resolved, {"institutional_evidence": evidence})
        self.assertEqual(complete["overallChance"], 100)
        self.assertEqual(complete["choices"][0]["details"]["measurableRequirements"], 3)
        evidence[1]["value"] = 4.24
        self.assertEqual(self.assessment(resolved, {"institutional_evidence": evidence})["overallChance"], 66.7)
        evidence[0]["status"] = "not_enrolled"
        self.assertIsNone(self.assessment(resolved, {"institutional_evidence": evidence})["overallChance"])
        evidence[0]["status"] = "enrolled"
        evidence[0].pop("major_units")
        evidence[0]["units"] = 200
        self.assertIsNone(self.assessment(resolved, {"institutional_evidence": evidence})["overallChance"])
        evidence[0]["major_units"] = 101
        evidence[0]["completed_major_subjects"] = 9
        self.assertEqual(self.assessment(resolved, {"institutional_evidence": evidence})["overallChance"], 66.7)
        evidence[0]["completed_major_subjects"] = 8
        self.assertEqual(self.assessment(resolved, {"institutional_evidence": evidence})["overallChance"], 33.3)
        generic = self.assessment(resolved, {"gpa": 4, "gpa_scale": 4})
        self.assertEqual(next(row for row in self.checks(generic) if row.get("checkId") == "technical-gpa")["status"], "missing")
        evidence[1]["scale"] = 4
        result = self.assessment(resolved, {"institutional_evidence": evidence})
        self.assertEqual(next(row for row in self.checks(result) if row.get("checkId") == "technical-gpa")["status"], "unassessed")

    def test_conditional_unassessed_numeric_minimum_blocks_a_percentage_and_keeps_reported_evidence(self):
        resolved = self.resolve("mit-usa-cambridge", study_option_id="mit-course-6-9p-meng",
                                application_route_id="mit_bcs_meng_admissions", study_level="masters")
        unknown_floor = {
            "id": "unsupported-floor", "topic": "language_tests", "review_status": "verified", "publication_status": "published",
            "source_ids": [resolved["sources"][0]["id"]], "applicability": {"status": "conditional"},
            "value": {"unassessed_published_minimums": [{"minimum": 5, "label": "Unsupported test scale"}]},
        }
        resolved["facts"].append(unknown_floor)
        resolved["fact_groups"]["requirements"].append(unknown_floor["id"])
        evidence = [
            {"kind": "enrollment", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "status": "enrolled", "major_units": 102},
            {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "technical", "value": 4.25, "scale": 5},
            {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "overall", "value": 4, "scale": 5},
        ]
        language = [{"kind": "education", "language": "en", "country": "Canada", "status": "completed"}]
        result = self.assessment(resolved, {"institutional_evidence": evidence, "language_evidence": language})
        self.assertIsNone(result["overallChance"])
        self.assertEqual(result["reportedEvidence"]["language_evidence"], language)
        self.assertEqual(result["reportedEvidence"]["institutional_evidence"], evidence)
        self.assertTrue(next(row for row in self.checks(result) if row["factId"] == "unsupported-floor")["blocksNumericScore"])

    def test_real_imperial_tmua_is_not_mat_and_esat_requires_named_modules(self):
        context = dict(study_option_id="imperial-option-computing-meng", application_route_id="procedure-computing-meng",
                       study_level="undergraduate", applicant_route="first_year", intended_entry_cycle="2027 entry")
        resolved = self.resolve("imperial-college-london-uk", **context)
        for exam, expected in (("TMUA", "met"), ("MAT", "missing")):
            result = self.assessment(resolved, {"exams": [{"id": exam, "score": 6}]})
            check = next(row for row in self.checks(result) if row.get("checkId") == "required-tmua")
            self.assertEqual(check["status"], expected)
            self.assertIsNone(result["overallChance"])
        check = {"kind": "exam_alternatives", "alternatives": [{"exam_id": "ESAT", "modules": ["ESAT_MATH_1", "ESAT_MATH_2", "ESAT_PHYSICS"]}]}
        incomplete = [{"exam": "ESAT", "details": {"components": [{"exam": "ESAT_MATH_1", "score": 6}]}}]
        self.assertEqual(assessment_service._check_evidence(check, {}, incomplete)[0], "missing")
        incomplete[0]["details"]["components"].extend([{"exam": "ESAT_MATH_2", "score": 6}, {"exam": "ESAT_PHYSICS", "score": 6}])
        self.assertEqual(assessment_service._check_evidence(check, {}, incomplete)[0], "met")

    def test_dedp_credential_and_primary_english_are_self_reported_not_office_waivers(self):
        resolved = self.resolve("mit-usa-cambridge", study_option_id="mit-data-economics-and-design-of-policy-masc-mit-grad-data-economics-and-design-of-policy",
                                application_route_id="mit_grad_dedp_admissions", study_level="masters")
        if resolved["selected_option"] is None:
            institution = admissions_catalog.get_institution("mit-usa-cambridge")
            option = next(row for row in institution["study_options"] if "mit_grad_dedp_admissions" in row["route_ids"])
            resolved = self.resolve("mit-usa-cambridge", study_option_id=option["id"], application_route_id="mit_grad_dedp_admissions", study_level="masters")
        profile = {"institutional_evidence": [{"kind": "credential", "university_id": "mit-usa-cambridge", "credential_id": "mitx-dedp-micromasters", "status": "completed"}],
                   "language_evidence": [{"kind": "primary_language", "language": "en"}]}
        result = self.assessment(resolved, profile)
        checks = self.checks(result)
        self.assertEqual(next(row for row in checks if row.get("checkId") == "micro-masters")["status"], "met")
        english = next(row for row in checks if row.get("checkId") == "english")
        self.assertEqual(english["status"], "met")
        self.assertEqual(english["evidenceOrigin"], "self_reported")
        self.assertFalse(english["measurable"])
        self.assertIsNone(result["overallChance"])

    def test_language_results_use_language_validation_and_possible_education_exemption_stays_unassessed(self):
        institution = admissions_catalog.get_institution("mit-usa-cambridge")
        option = next(row for row in institution["study_options"] if "mit_grad_dedp_admissions" in row["route_ids"])
        resolved = self.resolve("mit-usa-cambridge", study_option_id=option["id"],
                                application_route_id="mit_grad_dedp_admissions", study_level="masters")
        record = {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7, "taken_on": "2026-02-01"}
        result = self.assessment(resolved, {"languages": [record]})
        english = next(row for row in self.checks(result) if row.get("checkId") == "english")
        self.assertEqual(english["provided"]["exam"], "IELTS")
        self.assertEqual(english["provided"]["taken_on"], "2026-02-01")
        self.assertEqual(english["status"], "unassessed")
        claim = {"kind": "education", "language": "en", "country": "Canada", "qualification_level": "bachelor", "status": "completed"}
        result = self.assessment(resolved, {"language_evidence": [claim]})
        english = next(row for row in self.checks(result) if row.get("checkId") == "english")
        self.assertEqual(english["status"], "unassessed")
        self.assertEqual(english["provided"]["possible_exemption_evidence"], [claim])
        self.assertIsNone(result["overallChance"])

    def test_date_bounds_or_alternatives_and_wrong_exam_edition(self):
        check = {"kind": "exam_alternatives", "alternatives": [{"exam_id": "LSAT", "windows": [["2021-06-01", "2027-01-31"]]}, {"exam_id": "GRE"}]}
        for taken_on, expected in (("2021-05-31", "unmet"), ("2021-06-01", "met"), (None, "missing")):
            self.assertEqual(assessment_service._check_evidence(check, {}, [{"exam": "LSAT", "taken_on": taken_on}])[0], expected)
        self.assertEqual(assessment_service._check_evidence(check, {}, [{"exam": "LSAT", "taken_on": "2020-01-01"}, {"exam": "GRE"}])[0], "met")
        language = {"kind": "language_requirement", "alternatives": [{"exam_id": "TOEFL_iBT_1_6", "minimum": 5}]}
        self.assertEqual(assessment_service._check_evidence(language, {}, [{"exam": "TOEFL_iBT_0_120", "score": 110}])[0], "missing")

    def test_numeric_zero_missing_and_stale_annotation_are_distinct(self):
        resolved = self.resolve("mit-usa-cambridge", study_option_id="mit-course-6-9p-meng", application_route_id="mit_bcs_meng_admissions", study_level="masters")
        source = next(row for row in resolved["facts"] if row["id"] == "bcs-meng-entry-conditions")
        resolved["facts"] = [source]
        resolved["fact_groups"] = {"requirements": [source["id"]]}
        annotations, _ = assessment_service._annotations()
        record = copy.deepcopy(annotations[("mit-usa-cambridge", source["id"])])
        record["checks"] = [record["checks"][1]]
        record["remaining_conditions"] = []
        profile = {"institutional_evidence": [{"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "technical", "value": 4.24, "scale": 5, "as_of_term": "Spring 2026"}]}
        with patch.object(assessment_service, "_annotations", return_value=({("mit-usa-cambridge", source["id"]): record}, "fixture")):
            self.assertEqual(self.assessment(resolved, profile)["overallChance"], 0)
            self.assertIsNone(self.assessment(resolved, {})["overallChance"])
            profile["institutional_evidence"][0]["value"] = 4.25
            self.assertEqual(self.assessment(resolved, profile)["overallChance"], 100)
            record["checks"].append({"id": "required-act", "kind": "exam_alternatives", "alternatives": [{"exam_id": "ACT"}]})
            self.assertIsNone(self.assessment(resolved, profile)["overallChance"])
            profile["exams"] = [{"id": "ACT", "score": 34}]
            self.assertEqual(self.assessment(resolved, profile)["overallChance"], 100)
            source["value"]["technical_gpa"]["minimum"] = 4.3
            stale = self.assessment(resolved, profile)
            self.assertIsNone(stale["overallChance"])
            self.assertEqual(self.checks(stale)[0]["kind"], "stale_annotation")

    def test_annotations_missing_or_corrupt_fail_explicitly(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "assessments.json"
            with patch.object(assessment_service, "ASSESSMENTS_PATH", path):
                with self.assertRaises(admissions_catalog.AdmissionsCatalogError):
                    assessment_service.get_assessment_revision()
                path.write_text("{}", encoding="utf-8")
                with self.assertRaises(admissions_catalog.AdmissionsCatalogError):
                    assessment_service.get_assessment_revision()

    def test_conflicting_source_never_becomes_passed_check_and_retains_reported_claim(self):
        resolved = self.resolve("mit-usa-cambridge", study_option_id="mit-course-6-9p-meng", application_route_id="mit_bcs_meng_admissions", study_level="masters")
        source = next(row for row in resolved["facts"] if row["id"] == "bcs-meng-entry-conditions")
        source["publication_status"] = "conflicting"
        annotations, revision = assessment_service._annotations()
        record = copy.deepcopy(annotations[("mit-usa-cambridge", source["id"])])
        record["fact_sha256"] = assessment_service._fact_hash(source)
        with patch.object(assessment_service, "_annotations", return_value=({("mit-usa-cambridge", source["id"]): record}, revision)):
            result = self.assessment(resolved, {"institutional_evidence": [{"kind": "enrollment", "university_id": "mit-usa-cambridge", "status": "enrolled"}]})
        check = next(row for row in self.checks(result) if row["factId"] == source["id"])
        self.assertEqual(check["kind"], "source_state")
        self.assertEqual(check["status"], "unassessed")
        self.assertTrue(check["provided"]["institutional_evidence"])
        self.assertIsNone(result["overallChance"])


if __name__ == "__main__":
    unittest.main()
