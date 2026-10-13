import copy
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.admissions_assessment import _check_evidence
from app.services.exams import coerce_exam_submission


STANFORD = "stanford-university-usa-ca"


class AdmissionsFinalContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.profile = {
            "study_level": "Master", "applicant_route": "graduate",
            "intended_entry_cycle": "Fall 2028",
            "selectedAdmissionChoices": {STANFORD: {
                "studyOptionId": "stanford-option-cs-bs",
                "applicationRouteId": "undergraduate-shared-evidence:stanford-first-year",
                "studyLevel": "undergraduate", "applicantRoute": "first_year",
                "intendedEntryCycle": "Fall 2027",
                "feeStatusContext": "self_reported_international_overseas",
            }},
        }

    def resolve(self, context):
        response = self.client.post(f"/universities/{STANFORD}/admissions-context", json={
            "profile": self.profile, "context": context,
        })
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_omitted_context_keeps_saved_per_institution_defaults(self):
        before = copy.deepcopy(self.profile)
        result = self.resolve({})
        self.assertEqual(result["context"]["study_level"], "undergraduate")
        self.assertEqual(result["context"]["applicant_route"], "first_year")
        self.assertEqual(result["context"]["intended_entry_cycle"], "Fall 2027")
        self.assertEqual(self.profile, before)

    def test_explicit_null_or_empty_context_clears_saved_defaults(self):
        nullable = (
            "study_option_id", "application_route_id", "study_level",
            "applicant_route", "intended_entry_cycle", "fee_status_context",
        )
        empty_text = ("study_option_id", "application_route_id", "study_level", "intended_entry_cycle")
        for key, value in [(key, None) for key in nullable] + [(key, "") for key in empty_text]:
            with self.subTest(key=key, value=value):
                result = self.resolve({key: value})
                self.assertIsNone(result["context"][key])
                self.assertIsNone(result["assessment"]["overallChance"])
                if key in {"study_option_id", "application_route_id"}:
                    self.assertIsNone(result["selected_option" if key == "study_option_id" else "selected_route"])

    def test_saved_sat_total_meets_presence_without_inventing_sections_or_percentage(self):
        profile = {"exams": [{"id": "SAT", "score": 1500, "taken_on": "2026-09-01"}]}
        response = self.client.post("/universities/mit-usa-cambridge/admissions-context", json={
            "profile": profile, "context": {
                "study_option_id": "mit-course-6-3-bachelor", "application_route_id": "mit-first-year",
                "study_level": "undergraduate", "applicant_route": "first_year",
                "intended_entry_cycle": "Fall 2027 entry",
            },
        })
        self.assertEqual(response.status_code, 200)
        result = response.json()["assessment"]
        check = next(row for row in result["activeChoice"]["details"]["checks"] if row.get("factId") == "ug-sat-act-presence")
        self.assertEqual(check["status"], "met")
        self.assertEqual(check["provided"]["score"], 1500)
        self.assertEqual(check["provided"]["taken_on"], "2026-09-01")
        self.assertNotIn("details", check["provided"])
        self.assertEqual(check["evidenceOrigin"], "self_reported")
        self.assertIsNone(result["chancePercent"])
        with self.assertRaises(ValueError):
            coerce_exam_submission("SAT", score_raw=1500)

    def test_total_only_sat_validates_scale_date_and_keeps_other_breakdowns_required(self):
        for score in (400, 1500, 1600):
            with self.subTest(score=score):
                self.assertEqual(coerce_exam_submission("SAT", score_raw=score, allow_total_only_sat=True)["score"], score)
        for score in (399, 1601, 1505, 1500.5, float("nan"), float("inf")):
            with self.subTest(score=score), self.assertRaises(ValueError):
                coerce_exam_submission("SAT", score_raw=score, allow_total_only_sat=True)
        for details in ({"components": []}, {"components": [{"exam": "SAT_MATH", "score": 750}]},
                        {"components": [{"exam": "SAT_MATH", "score": 199}, {"exam": "SAT_EBRW", "score": 750}]}):
            with self.subTest(details=details), self.assertRaises(ValueError):
                coerce_exam_submission("SAT", score_raw=1500, details=details, allow_total_only_sat=True)
        with self.assertRaises(ValueError):
            coerce_exam_submission("SAT", score_raw=1500, taken_on="2026-2-01", allow_total_only_sat=True)
        for exam, score in (("GRE", 320), ("UCAT", 2500), ("ESAT", 6), ("MCAT", 500)):
            with self.subTest(exam=exam), self.assertRaises(ValueError):
                coerce_exam_submission(exam, score_raw=score, allow_total_only_sat=True)
        submissions = [{"exam": "SAT", "score": 1500}]
        rule = {"kind": "exam_alternatives", "alternatives": [{"exam_id": "SAT", "modules": ["SAT_MATH"]}]}
        self.assertEqual(_check_evidence(rule, {}, submissions)[0], "missing")


if __name__ == "__main__":
    unittest.main()
