import unittest

from fastapi.testclient import TestClient

from app.main import app


class ProfilePayloadValidationExtendedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _post_ai_sort(self, profile):
        return self.client.post(
            "/universities/ai-sort",
            json={
                "profile": profile,
                "practice_vs_science": 50,
                "social_vs_hardcore": 50,
                "budget_vs_prestige": 50,
                "city_vs_campus": 50,
                "page": 1,
                "limit": 10,
            },
        )

    def test_rejects_exam_entry_without_id_or_exam(self):
        response = self._post_ai_sort(
            {
                "exams": [{"score": 1200}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_cefr_language_without_level(self):
        response = self._post_ai_sort(
            {
                "languages": [{"code": "en", "kind": "cefr"}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_exam_language_without_score(self):
        response = self._post_ai_sort(
            {
                "languages": [{"code": "en", "kind": "exam", "exam": "IELTS"}],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_exams_list_over_max_limit(self):
        response = self._post_ai_sort(
            {
                "exams": [{"exam": "SAT", "score": 1200} for _ in range(51)],
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_too_long_interests(self):
        response = self._post_ai_sort(
            {
                "interests": "x" * 1201,
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_gpa_over_5_0(self):
        response = self._post_ai_sort(
            {
                "gpa": 95,
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_rejects_fractional_budget(self):
        response = self._post_ai_sort(
            {
                "budget": 35_000.5,
            }
        )
        self.assertEqual(response.status_code, 422)

    def test_accepts_valid_rich_profile_payload(self):
        response = self._post_ai_sort(
            {
                "name": "Valid User",
                "locale": "eng",
                "budget": 35000,
                "gpa": 3.8,
                "major": "Computer Science",
                "interests": "ai robotics research",
                "studyMode": "On-campus",
                "fundingType": "any",
                "exams": [
                    {"exam": "SAT", "score": 1470},
                    {"exam": "ACT", "score": 33},
                ],
                "languages": [
                    {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5},
                    {"code": "en", "kind": "cefr", "level": 5},
                ],
            }
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("items", payload)
        self.assertIsInstance(payload.get("items"), list)

    def test_accepts_composite_language_exam_payload(self):
        response = self._post_ai_sort(
            {
                "languages": [
                    {
                        "code": "en",
                        "kind": "exam",
                        "exam": "IELTS",
                        "score": 7.5,
                        "raw_value": "Overall 7.5, Listening 8.0",
                        "details": {
                            "components": [
                                {"exam": "IELTS_LISTENING", "score": 8.0},
                                {"exam": "IELTS_READING", "score": 7.5},
                            ]
                        },
                    }
                ],
            }
        )
        self.assertEqual(response.status_code, 200)

    def test_accepts_a_level_exam_payload_with_nested_component_details(self):
        response = self._post_ai_sort(
            {
                "exams": [
                    {
                        "exam": "A_LEVEL_CERT",
                        "score": 18,
                        "raw_value": "Mathematics A*, Computer Science A*, Further Mathematics A*, Physics A*",
                        "details": {
                            "components": [
                                {
                                    "exam": "A_LEVEL_MATHEMATICS",
                                    "raw_value": "A*",
                                    "details": {"grades": ["A*"]},
                                },
                                {
                                    "exam": "A_LEVEL_COMPUTER_SCIENCE",
                                    "raw_value": "A*",
                                    "details": {"grades": ["A*"]},
                                },
                                {
                                    "exam": "A_LEVEL_FURTHER_MATHEMATICS",
                                    "raw_value": "A*",
                                    "details": {"grades": ["A*"]},
                                },
                                {
                                    "exam": "A_LEVEL_PHYSICS",
                                    "raw_value": "A*",
                                    "details": {"grades": ["A*"]},
                                },
                            ]
                        },
                    }
                ],
            }
        )
        self.assertEqual(response.status_code, 200)

    def test_accepts_multiple_citizenships_and_syncs_primary(self):
        from app.schemas.payloads import ProfilePayload
        payload = ProfilePayload(citizenships=["KZ", "US"])
        self.assertEqual(payload.citizenship, "KZ")
        self.assertEqual(payload.citizenships, ["KZ", "US"])

        response = self._post_ai_sort({"profile": {"citizenships": ["KZ", "US"]}})
        self.assertEqual(response.status_code, 200)

    def test_accepts_comma_separated_citizenships_string(self):
        from app.schemas.payloads import ProfilePayload
        payload = ProfilePayload(citizenships="KZ, GB, US")
        self.assertEqual(payload.citizenships, ["KZ", "GB", "US"])
        self.assertEqual(payload.citizenship, "KZ")

    def test_syncs_single_citizenship_to_list(self):
        from app.schemas.payloads import ProfilePayload
        payload = ProfilePayload(citizenship="KZ")
        self.assertEqual(payload.citizenships, ["KZ"])
        self.assertEqual(payload.citizenship, "KZ")

    def test_citizenships_list_is_canonical_when_primary_disagrees(self):
        from app.schemas.payloads import ProfilePayload
        payload = ProfilePayload(citizenship="US", citizenships=["KZ", "GB"])
        self.assertEqual(payload.citizenship, "KZ")

    def test_accepts_optional_world_applicant_context_without_inferring_fee_status(self):
        from app.schemas.payloads import ProfilePayload
        payload = ProfilePayload(
            country_of_education="KZ",
            education_credential="other",
            education_credential_other="NIS Grade 12 certificate",
            applicant_route="first_year",
            study_level="Bachelor",
            intended_entry_cycle="2027 Fall",
            current_residence_country="US",
        )
        self.assertEqual(payload.country_of_education, "KZ")
        self.assertEqual(payload.education_credential_other, "NIS Grade 12 certificate")
        self.assertEqual(payload.applicant_route, "first_year")
        self.assertEqual(payload.fee_status_context, "unknown")

    def test_rejects_applicant_route_that_conflicts_with_explicit_target_level(self):
        from pydantic import ValidationError
        from app.schemas.payloads import ProfilePayload
        with self.assertRaises(ValidationError):
            ProfilePayload(applicant_route="transfer", study_level="Master")
        with self.assertRaises(ValidationError):
            ProfilePayload(applicant_route="graduate", study_level="Bachelor")

    def test_fee_status_context_is_only_an_explicit_self_report(self):
        from pydantic import ValidationError
        from app.schemas.payloads import ProfilePayload
        self.assertEqual(
            ProfilePayload(fee_status_context="self_reported_home_domestic").fee_status_context,
            "self_reported_home_domestic",
        )
        with self.assertRaises(ValidationError):
            ProfilePayload(fee_status_context="home")

    def test_empty_citizenships_do_not_claim_country_mismatch(self):
        from app.services.citizenship import resolve_citizenship_status
        result = resolve_citizenship_status("USA", [])
        self.assertIsNone(result["citizenship_matches_country"])


if __name__ == "__main__":
    unittest.main()
