import unittest

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.payloads import (
    ExamValidateRequest,
    LanguageValidateRequest,
    ProfileExamInput,
    ProfileLanguageInput,
    ProfilePayload,
    to_profile_dict,
)
from app.services.ai_scoring import (
    _build_user_context,
    _chance_locale,
    _normalize_selected_admission_choices,
)
from app.services import exam_support
from app.services import exams as exams_service
from app.services import languages as languages_service


class SchemaStandardizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # 1. ProfilePayload & GPA Scale
    def test_gpa_scale_model_fields_cleaned(self):
        self.assertIn("gpa_scale", ProfilePayload.model_fields)
        self.assertNotIn("gpaScale", ProfilePayload.model_fields)

    def test_frontend_dual_gpa_payload_preserves_gpa_and_scale(self):
        # Frontend loadProfileForApi() sends both gpa_scale and gpaScale
        payload = {
            "gpa": 3.85,
            "gpa_scale": 4.0,
            "gpaScale": 4.0,
        }
        profile = ProfilePayload.model_validate(payload)
        self.assertEqual(profile.gpa, 3.85)
        self.assertEqual(profile.gpa_scale, 4.0)

        dumped = to_profile_dict(profile)
        self.assertEqual(dumped.get("gpa"), 3.85)
        self.assertEqual(dumped.get("gpa_scale"), 4.0)
        self.assertNotIn("gpaScale", dumped)

        # Verify ai_scoring _build_user_context parses GPA properly
        ctx = _build_user_context(dumped, {})
        self.assertEqual(ctx["userScores"].get("GPA"), 3.85)

    def test_gpa_scale_5_normalization_in_context(self):
        payload = {
            "gpa": 4.5,
            "gpa_scale": 5.0,
        }
        profile = ProfilePayload.model_validate(payload)
        dumped = to_profile_dict(profile)
        ctx = _build_user_context(dumped, {})
        # 4.5 / 5.0 * 4.0 = 3.6
        self.assertEqual(ctx["userScores"].get("GPA"), 3.6)

    def test_removed_gpa_scale_alias_does_not_populate_from_gpa_scale_camel_case_alone(self):
        # When gpaScale is sent alone without gpa_scale, gpaScale is ignored
        payload = {
            "gpa": 3.5,
            "gpaScale": 5.0,
        }
        profile = ProfilePayload.model_validate(payload)
        self.assertEqual(profile.gpa, 3.5)
        self.assertIsNone(profile.gpa_scale)

    # 2. selectedAdmissionChoices (camelCase preserved, snake_case removed)
    def test_selected_admission_choices_camel_case_contract(self):
        payload = {
            "selectedAdmissionChoices": {
                "harvard": {
                    "choiceKey": "cs-grant-choice",
                    "programId": "prog-1",
                    "programName": "Computer Science",
                    "categoryId": "cat-1",
                    "requirementProfileId": "req-1",
                    "fundingOptionId": "fund-1",
                }
            }
        }
        profile = ProfilePayload.model_validate(payload)
        dumped = to_profile_dict(profile)
        choice = dumped["selectedAdmissionChoices"]["harvard"]
        self.assertEqual(choice["choiceKey"], "cs-grant-choice")
        self.assertEqual(choice["programId"], "prog-1")
        self.assertEqual(choice["programName"], "Computer Science")
        self.assertEqual(choice["categoryId"], "cat-1")
        self.assertEqual(choice["requirementProfileId"], "req-1")
        self.assertEqual(choice["fundingOptionId"], "fund-1")

    def test_selected_admission_choices_snake_case_alias_removed(self):
        # Top-level snake_case selected_admission_choices is ignored
        payload = {
            "selected_admission_choices": {
                "harvard": {
                    "choiceKey": "cs-grant-choice",
                }
            }
        }
        profile = ProfilePayload.model_validate(payload)
        self.assertEqual(profile.selectedAdmissionChoices, {})

    def test_selected_admission_choices_subfield_snake_case_removed(self):
        # Subfields in snake_case (e.g. choice_key, program_id) are ignored
        payload = {
            "selectedAdmissionChoices": {
                "harvard": {
                    "choice_key": "cs-grant-choice",
                    "program_id": "prog-1",
                }
            }
        }
        profile = ProfilePayload.model_validate(payload)
        # Because choiceKey is missing, the entry has no choiceKey and is skipped
        self.assertEqual(profile.selectedAdmissionChoices, {})

    # 3. ProfileExamInput
    def test_profile_exam_fields_cleaned(self):
        self.assertIn("raw_value", ProfileExamInput.model_fields)
        self.assertIn("display_value", ProfileExamInput.model_fields)
        self.assertNotIn("rawValue", ProfileExamInput.model_fields)
        self.assertNotIn("displayValue", ProfileExamInput.model_fields)

    def test_profile_exam_accepts_raw_value(self):
        exam = ProfileExamInput.model_validate({"exam": "SAT", "raw_value": "1500"})
        self.assertEqual(exam.raw_value, "1500")

    def test_profile_exam_rejects_entry_with_only_legacy_raw_value(self):
        with self.assertRaises(ValidationError):
            ProfileExamInput.model_validate({"exam": "SAT", "rawValue": "1500"})

    def test_profile_exam_missing_score_and_raw_value_raises_expected_validation_error(self):
        with self.assertRaises(ValidationError) as ctx:
            ProfileExamInput.model_validate({"exam": "SAT"})
        self.assertIn("Each exam entry must include 'score', 'raw_value', or 'details'", str(ctx.exception))

    # 4. ProfileLanguageInput
    def test_profile_language_fields_cleaned(self):
        self.assertIn("code", ProfileLanguageInput.model_fields)
        self.assertIn("exam", ProfileLanguageInput.model_fields)
        self.assertIn("raw_value", ProfileLanguageInput.model_fields)
        self.assertIn("display_value", ProfileLanguageInput.model_fields)
        self.assertNotIn("lang", ProfileLanguageInput.model_fields)
        self.assertNotIn("examId", ProfileLanguageInput.model_fields)
        self.assertNotIn("rawValue", ProfileLanguageInput.model_fields)
        self.assertNotIn("displayValue", ProfileLanguageInput.model_fields)

    def test_profile_language_accepts_canonical_fields(self):
        lang = ProfileLanguageInput.model_validate({
            "code": "en",
            "kind": "exam",
            "exam": "IELTS",
            "score": 7.5,
            "raw_value": "7.5",
            "display_value": "IELTS 7.5",
        })
        self.assertEqual(lang.code, "en")
        self.assertEqual(lang.exam, "IELTS")
        self.assertEqual(lang.score, 7.5)
        self.assertEqual(lang.raw_value, "7.5")
        self.assertEqual(lang.display_value, "IELTS 7.5")

    def test_profile_language_rejects_entry_with_only_legacy_lang(self):
        with self.assertRaises(ValidationError):
            ProfileLanguageInput.model_validate({"lang": "en", "kind": "native"})

    def test_profile_language_rejects_exam_with_only_legacy_exam_id(self):
        with self.assertRaises(ValidationError):
            ProfileLanguageInput.model_validate({
                "code": "en",
                "kind": "exam",
                "examId": "IELTS",
                "score": 7.5,
            })

    def test_profile_language_rejects_exam_with_only_legacy_raw_value(self):
        with self.assertRaises(ValidationError):
            ProfileLanguageInput.model_validate({
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "rawValue": "7.5",
            })

    def test_profile_language_exam_missing_score_and_raw_value_raises_expected_validation_error(self):
        with self.assertRaises(ValidationError) as ctx:
            ProfileLanguageInput.model_validate({"code": "en", "kind": "exam", "exam": "IELTS"})
        self.assertIn("Language kind='exam' requires 'score', 'raw_value', or 'details'", str(ctx.exception))

    # 5. ExamValidateRequest
    def test_exam_validate_request_fields_cleaned(self):
        self.assertIn("raw_value", ExamValidateRequest.model_fields)
        self.assertNotIn("rawValue", ExamValidateRequest.model_fields)

    def test_exam_validate_request_missing_score_and_raw_value_raises_expected_validation_error(self):
        with self.assertRaises(ValidationError) as ctx:
            ExamValidateRequest.model_validate({"exam": "SAT_MATH"})
        self.assertIn("score, raw_value, or details is required", str(ctx.exception))

    def test_exam_validate_endpoint_with_canonical_raw_value(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT_MATH", "score": 750, "raw_value": "750"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("exam"), "SAT_MATH")
        self.assertEqual(data.get("score"), 750)

    def test_exam_validate_request_rejects_only_legacy_raw_value(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT_MATH", "rawValue": "750"},
        )
        self.assertEqual(response.status_code, 422)

    # 6. LanguageValidateRequest
    def test_language_validate_request_fields_cleaned(self):
        self.assertIn("raw_value", LanguageValidateRequest.model_fields)
        self.assertNotIn("rawValue", LanguageValidateRequest.model_fields)

    def test_language_validate_request_missing_score_and_raw_value_raises_expected_validation_error(self):
        with self.assertRaises(ValidationError) as ctx:
            LanguageValidateRequest.model_validate({"code": "en", "kind": "exam", "exam": "IELTS"})
        self.assertIn("kind='exam' requires score, raw_value, or details", str(ctx.exception))

    def test_language_validate_endpoint_with_canonical_raw_value(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5, "raw_value": "7.5"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(bool(data.get("ok")))
        language = data.get("language") or {}
        self.assertEqual(language.get("exam"), "IELTS")
        self.assertAlmostEqual(float(language.get("score")), 7.5)

    def test_language_validate_request_rejects_only_legacy_raw_value(self):
        response = self.client.post(
            "/languages/validate",
            json={"code": "en", "kind": "exam", "exam": "IELTS", "rawValue": "7.5"},
        )
        self.assertEqual(response.status_code, 422)

    # 7. End-to-end AI-Sort with realistic full profile
    def test_ai_sort_with_full_standardized_profile(self):
        profile_data = {
            "budget": 45000,
            "gpa": 3.9,
            "gpa_scale": 4.0,
            "gpaScale": 4.0,  # Frontend sends both
            "major": "Computer Science",
            "studyMode": "on-campus",
            "fundingType": "any",
            "exams": [
                {"exam": "SAT", "score": 1520, "raw_value": "1520"},
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "TOEFL_IBT", "score": 110, "raw_value": "110"},
                {"code": "kz", "kind": "native"},
            ],
            "selectedAdmissionChoices": {
                "mit-usa-cambridge": {
                    "choiceKey": "mit_regular::mit_regular::mit_regular",
                    "programId": "mit_regular",
                    "programName": "Regular Decision",
                    "categoryId": "mit_regular",
                    "requirementProfileId": "mit_regular",
                    "fundingOptionId": "mit_regular",
                }
            },
        }
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": profile_data,
                "practice_vs_science": 60,
                "social_vs_hardcore": 40,
                "budget_vs_prestige": 70,
                "city_vs_campus": 50,
                "page": 1,
                "limit": 50,
            },
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("items", body)
        self.assertGreater(len(body["items"]), 0)

        # Verify mit item has matchData and user selection was respected
        mit_item = next((u for u in body["items"] if u.get("id") == "mit-usa-cambridge"), None)
        self.assertIsNotNone(mit_item)
        match_data = mit_item.get("matchData") or {}
        self.assertIn("finalPrice", match_data)
        self.assertIn("currency", match_data)
        self.assertIn("admitChance", match_data)
        self.assertIn("hardScore", match_data)
        self.assertEqual(match_data.get("selectedChoiceKey"), "mit_regular::mit_regular::mit_regular")


class ConsumerStandardizationTests(unittest.TestCase):
    # 1. GPA Scale in ai_scoring _build_user_context
    def test_build_user_context_gpa_scale_canonical(self):
        profile = {"gpa": 3.5, "gpa_scale": 5.0}
        ctx = _build_user_context(profile, {})
        # 3.5 / 5.0 * 4.0 = 2.8
        self.assertEqual(ctx["userScores"].get("GPA"), 2.8)

    def test_build_user_context_gpa_scale_alias_ignored(self):
        # Raw dict with deprecated gpaScale is not used as scale fallback
        profile = {"gpa": 3.5, "gpaScale": 5.0}
        ctx = _build_user_context(profile, {})
        # Without scale, 3.5 <= 4.0 returns 3.5
        self.assertEqual(ctx["userScores"].get("GPA"), 3.5)

    # 2. Exam inputs in ai_scoring _build_user_context
    def test_build_user_context_exam_canonical_raw_value(self):
        profile = {"exams": [{"exam": "SAT_MATH", "raw_value": "750"}]}
        ctx = _build_user_context(profile, {})
        self.assertEqual(ctx["userScores"].get("SAT_MATH"), 750)

    def test_build_user_context_exam_legacy_raw_value_ignored(self):
        profile = {"exams": [{"exam": "SAT_MATH", "rawValue": "750"}]}
        ctx = _build_user_context(profile, {})
        self.assertNotIn("SAT_MATH", ctx["userScores"])

    def test_build_user_context_exam_accepts_id_or_exam(self):
        ctx_by_exam = _build_user_context({"exams": [{"exam": "SAT", "score": 1520}]}, {})
        ctx_by_id = _build_user_context({"exams": [{"id": "SAT", "score": 1520}]}, {})
        self.assertEqual(ctx_by_exam["userScores"].get("SAT"), 1520)
        self.assertEqual(ctx_by_id["userScores"].get("SAT"), 1520)

    # 3. Language inputs in ai_scoring _build_user_context
    def test_build_user_context_language_canonical_code(self):
        ctx = _build_user_context({"languages": [{"code": "en", "kind": "native"}]}, {})
        self.assertTrue(ctx["userLanguages"].get("en", {}).get("native"))

    def test_build_user_context_language_legacy_lang_ignored(self):
        ctx = _build_user_context({"languages": [{"lang": "en", "kind": "native"}]}, {})
        self.assertNotIn("en", ctx["userLanguages"])

    def test_build_user_context_language_exam_canonical(self):
        profile = {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}]}
        ctx = _build_user_context(profile, {})
        self.assertEqual(ctx["userLanguages"].get("en", {}).get("exams", {}).get("IELTS"), 7.5)
        self.assertEqual(ctx["userScores"].get("IELTS"), 7.5)

    def test_build_user_context_language_exam_legacy_exam_id_ignored(self):
        profile = {"languages": [{"code": "en", "kind": "exam", "examId": "IELTS", "score": 7.5}]}
        ctx = _build_user_context(profile, {})
        self.assertNotIn("IELTS", ctx["userLanguages"].get("en", {}).get("exams", {}))
        self.assertNotIn("IELTS", ctx["userScores"])

    def test_build_user_context_language_exam_canonical_raw_value(self):
        profile = {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "raw_value": "7.5"}]}
        ctx = _build_user_context(profile, {})
        self.assertEqual(ctx["userLanguages"].get("en", {}).get("exams", {}).get("IELTS"), 7.5)

    def test_build_user_context_language_exam_legacy_raw_value_ignored(self):
        profile = {"languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "rawValue": "7.5"}]}
        ctx = _build_user_context(profile, {})
        self.assertNotIn("IELTS", ctx["userLanguages"].get("en", {}).get("exams", {}))

    # 4. Admission choices in ai_scoring _normalize_selected_admission_choices
    def test_normalize_selected_admission_choices_canonical(self):
        profile = {
            "selectedAdmissionChoices": {
                "mit-usa-cambridge": {
                    "choiceKey": "mit_regular::mit_regular::mit_regular",
                }
            }
        }
        selections = _normalize_selected_admission_choices(profile)
        self.assertEqual(selections, {"mit-usa-cambridge": "mit_regular::mit_regular::mit_regular"})

    def test_normalize_selected_admission_choices_legacy_snake_top_level_ignored(self):
        profile = {
            "selected_admission_choices": {
                "mit-usa-cambridge": {
                    "choiceKey": "mit_regular::mit_regular::mit_regular",
                }
            }
        }
        self.assertEqual(_normalize_selected_admission_choices(profile), {})

    def test_normalize_selected_admission_choices_legacy_snake_subfield_ignored(self):
        profile = {
            "selectedAdmissionChoices": {
                "mit-usa-cambridge": {
                    "choice_key": "mit_regular::mit_regular::mit_regular",
                }
            }
        }
        self.assertEqual(_normalize_selected_admission_choices(profile), {})

    # 5. Locale in ai_scoring _chance_locale
    def test_chance_locale_canonical(self):
        self.assertEqual(_chance_locale({"locale": "rus"}), "rus")
        self.assertEqual(_chance_locale({"locale": "ru"}), "rus")
        self.assertEqual(_chance_locale({"locale": "eng"}), "eng")
        self.assertEqual(_chance_locale({"locale": "en"}), "eng")
        self.assertEqual(_chance_locale({}), "eng")

    def test_chance_locale_legacy_lang_not_used_as_fallback(self):
        # Deprecated 'lang' in profile is not read as locale fallback
        self.assertEqual(_chance_locale({"lang": "rus"}), "eng")

    # 6. Exams service coerce_exam_submission
    def test_exams_coerce_submission_components_with_exam_and_id(self):
        with_exam = exams_service.coerce_exam_submission(
            "SAT",
            details={
                "components": [
                    {"exam": "SAT_MATH", "score": 750},
                    {"exam": "SAT_EBRW", "score": 700},
                ]
            },
        )
        self.assertEqual(with_exam.get("score"), 1450)

        with_id = exams_service.coerce_exam_submission(
            "SAT",
            details={
                "components": [
                    {"id": "SAT_MATH", "score": 750},
                    {"id": "SAT_EBRW", "score": 700},
                ]
            },
        )
        self.assertEqual(with_id.get("score"), 1450)

    def test_exams_coerce_submission_components_with_legacy_exam_id_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            exams_service.coerce_exam_submission(
                "SAT",
                details={
                    "components": [
                        {"exam_id": "SAT_MATH", "score": 750},
                        {"exam_id": "SAT_EBRW", "score": 700},
                    ]
                },
            )
        self.assertIn("component exam is required", str(ctx.exception))

    def test_exams_coerce_submission_components_raw_value_canonical(self):
        res = exams_service.coerce_exam_submission(
            "SAT",
            details={
                "components": [
                    {"exam": "SAT_MATH", "raw_value": "750"},
                    {"exam": "SAT_EBRW", "raw_value": "700"},
                ]
            },
        )
        self.assertEqual(res.get("score"), 1450)

    # 7. Languages service validate_language
    def test_languages_validate_components_with_exam_and_id(self):
        res_exam = languages_service.validate_language(
            {
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "details": {
                    "components": [
                        {"exam": "IELTS_LISTENING", "score": 7.0},
                        {"exam": "IELTS_READING", "score": 7.0},
                        {"exam": "IELTS_WRITING", "score": 7.0},
                        {"exam": "IELTS_SPEAKING", "score": 7.0},
                    ]
                },
            }
        )
        self.assertEqual(res_exam.get("language", {}).get("score"), 7.0)

        res_id = languages_service.validate_language(
            {
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "details": {
                    "components": [
                        {"id": "IELTS_LISTENING", "score": 7.0},
                        {"id": "IELTS_READING", "score": 7.0},
                        {"id": "IELTS_WRITING", "score": 7.0},
                        {"id": "IELTS_SPEAKING", "score": 7.0},
                    ]
                },
            }
        )
        self.assertEqual(res_id.get("language", {}).get("score"), 7.0)

    def test_languages_validate_components_with_legacy_exam_id_rejected(self):
        with self.assertRaises(ValueError) as ctx:
            languages_service.validate_language(
                {
                    "code": "en",
                    "kind": "exam",
                    "exam": "IELTS",
                    "details": {
                        "components": [
                            {"exam_id": "IELTS_LISTENING", "score": 7.0},
                        ]
                    },
                }
            )
        self.assertIn("component exam is required", str(ctx.exception))

    def test_languages_validate_raw_value_canonical(self):
        res = languages_service.validate_language(
            {
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "raw_value": "7.5",
            }
        )
        self.assertEqual(res.get("language", {}).get("score"), 7.5)

    # 8. Exam support breakdown_item_definitions
    def test_exam_support_breakdown_item_definitions_accepts_exam_and_id(self):
        defs_exam = exam_support.breakdown_item_definitions([{"exam": "SAT_MATH", "label": "Math"}], default_required=True)
        defs_id = exam_support.breakdown_item_definitions([{"id": "SAT_MATH", "label": "Math"}], default_required=True)
        self.assertEqual(len(defs_exam), 1)
        self.assertEqual(defs_exam[0]["exam"], "SAT_MATH")
        self.assertEqual(len(defs_id), 1)
        self.assertEqual(defs_id[0]["exam"], "SAT_MATH")

    def test_exam_support_breakdown_item_definitions_ignores_legacy_exam_id(self):
        defs = exam_support.breakdown_item_definitions([{"exam_id": "SAT_MATH", "label": "Math"}], default_required=True)
        self.assertEqual(len(defs), 0)


if __name__ == "__main__":
    unittest.main()
