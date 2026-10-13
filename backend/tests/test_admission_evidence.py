import unittest
from datetime import date, timedelta

from pydantic import ValidationError

from app.schemas.admission_evidence import validate_admission_date
from app.schemas.payloads import (
    ExamValidateRequest,
    LanguageValidateRequest,
    ProfilePayload,
    to_profile_dict,
)
from app.routers.exams import validate_exam
from app.routers.languages import validate_language


class AdmissionEvidenceTests(unittest.TestCase):
    def test_date_helper_requires_iso_calendar_date_and_blocks_future_test_dates(self):
        self.assertEqual("2026-10-12", validate_admission_date("2026-10-12"))
        self.assertIsNone(validate_admission_date(None))
        self.assertEqual(
            (date.today() + timedelta(days=1)).isoformat(),
            validate_admission_date((date.today() + timedelta(days=1)).isoformat(), allow_future=True),
        )
        for invalid in ("2026-2-03", "2026-02-30", "12/10/2026", date.today()):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                validate_admission_date(invalid)
        with self.assertRaisesRegex(ValueError, "future"):
            validate_admission_date((date.today() + timedelta(days=1)).isoformat())

    def test_test_dates_are_optional_strict_and_preserved_in_validate_models(self):
        exam = ExamValidateRequest(exam="ACT", score=34, taken_on="2026-09-01")
        language = LanguageValidateRequest(code="en", kind="exam", exam="IELTS", score=7, taken_on="2026-09-01")
        self.assertEqual("2026-09-01", exam.taken_on)
        self.assertEqual("2026-09-01", language.taken_on)
        self.assertIsNone(ExamValidateRequest(exam="ACT", score=34).taken_on)
        with self.assertRaises(ValidationError):
            ExamValidateRequest(exam="ACT", score=34, taken_on=(date.today() + timedelta(days=1)).isoformat())
        with self.assertRaises(ValidationError):
            LanguageValidateRequest(code="en", kind="exam", exam="IELTS", score=7, taken_on="2026-02-30")
        with self.assertRaises(ValidationError):
            LanguageValidateRequest(code="en", kind="native", taken_on="2026-09-01")
        with self.assertRaises(ValidationError):
            ProfilePayload(languages=[{"code": "en", "kind": "cefr", "level": 6, "taken_on": "2026-09-01"}])

    def test_exam_and_language_validate_routes_echo_taken_on(self):
        exam_result = validate_exam(ExamValidateRequest(exam="ACT", score=34, taken_on="2026-09-01"))
        language_result = validate_language(
            LanguageValidateRequest(code="en", kind="exam", exam="IELTS", score=7, taken_on="2026-09-01")
        )

        self.assertEqual("2026-09-01", exam_result["taken_on"])
        self.assertEqual("2026-09-01", language_result["language"]["taken_on"])

    def test_profile_evidence_is_typed_bounded_and_kept_by_profile_projection(self):
        payload = ProfilePayload.model_validate({
            "exams": [{"id": "ACT", "score": 34, "taken_on": "2026-09-01"}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7, "taken_on": "2026-08-01"}],
            "language_evidence": [{
                "kind": "education", "language": "en", "country": "GB",
                "qualification_level": "bachelor", "started_on": "2022-09-01",
                "completed_on": "2026-06-30", "status": "completed", "entirely_in_language": True,
            }],
            "institutional_evidence": [
                {"kind": "enrollment", "university_id": "stanford-university-usa-ca", "program_id": "stanford-option-cs-bs",
                 "status": "enrolled", "units": 120, "expected_completion_on": "2027-06-15"},
                {"kind": "enrollment", "university_id": "mit-usa-cambridge", "program_id": "mit-course-6-9p-meng",
                 "status": "enrolled", "units": 120, "major_units": 102, "completed_major_subjects": 9},
                {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-course-6-9p-meng",
                 "metric": "technical", "value": 4.25, "scale": 5, "as_of_term": "Fall 2026"},
                {"kind": "credential", "university_id": "mit-usa-cambridge", "credential_id": "mitx-dedp-micromasters",
                 "status": "completed", "completed_on": "2026-05-01"},
            ],
        })

        projected = to_profile_dict(payload)
        self.assertEqual("2026-09-01", projected["exams"][0]["taken_on"])
        self.assertEqual("2026-08-01", projected["languages"][0]["taken_on"])
        self.assertEqual("completed", projected["language_evidence"][0]["status"])
        self.assertEqual(120, projected["institutional_evidence"][0]["units"])
        mit_enrollment = projected["institutional_evidence"][1]
        self.assertEqual(120, mit_enrollment["units"])
        self.assertEqual(102, mit_enrollment["major_units"])
        self.assertEqual(9, mit_enrollment["completed_major_subjects"])
        self.assertEqual(4.25, projected["institutional_evidence"][2]["value"])
        self.assertEqual("mitx-dedp-micromasters", projected["institutional_evidence"][3]["credential_id"])

        old_credential = ProfilePayload(institutional_evidence=[{
            "kind": "credential", "university_id": "mit-usa-cambridge",
            "credential_id": "mitx-dedp-micromasters", "status": "completed",
        }])
        self.assertNotIn("score_percent", to_profile_dict(old_credential)["institutional_evidence"][0])
        scored_credential = ProfilePayload(institutional_evidence=[{
            "kind": "credential", "university_id": "mit-usa-cambridge",
            "credential_id": "sc0x", "status": "completed", "score_percent": 85,
        }])
        self.assertEqual(85, to_profile_dict(scored_credential)["institutional_evidence"][0]["score_percent"])

    def test_evidence_rejects_invalid_ranges_intervals_and_unknown_attributes(self):
        base = {"kind": "gpa", "university_id": "mit-usa-cambridge", "metric": "technical", "value": 4.25, "scale": 4}
        with self.assertRaises(ValidationError):
            ProfilePayload(institutional_evidence=[base])
        with self.assertRaises(ValidationError):
            ProfilePayload(institutional_evidence=[{**base, "scale": float("nan")}])
        with self.assertRaises(ValidationError):
            ProfilePayload(language_evidence=[{
                "kind": "education", "language": "en", "started_on": "2026-01-01", "completed_on": "2025-01-01"
            }])
        with self.assertRaises(ValidationError):
            ProfilePayload(institutional_evidence=[{
                "kind": "enrollment", "university_id": "stanford-university-usa-ca", "future_rule": True
            }])
        with self.assertRaises(ValidationError):
            ProfilePayload(language_evidence=[{"kind": "primary_language", "language": "english"}])
        with self.assertRaises(ValidationError):
            ProfilePayload(institutional_evidence=[{
                "kind": "credential", "university_id": "mit-usa-cambridge", "credential_id": "sc0x",
                "score_percent": float("nan"),
            }])
        with self.assertRaises(ValidationError):
            ProfilePayload(institutional_evidence=[{
                "kind": "credential", "university_id": "mit-usa-cambridge", "credential_id": "sc0x",
                "score_percent": 100.1,
            }])
        for field, value in (("units", -1), ("major_units", -1), ("completed_major_subjects", -1),
                             ("major_units", 10001), ("completed_major_subjects", 1001)):
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                ProfilePayload(institutional_evidence=[{
                    "kind": "enrollment", "university_id": "mit-usa-cambridge", field: value,
                }])


if __name__ == "__main__":
    unittest.main()
