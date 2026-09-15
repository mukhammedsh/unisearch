import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_ai_sort_rejects_invalid_budget_vs_prestige(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "budget_vs_prestige": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_too_long_locale(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "locale": "x" * 40,
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_social_vs_hardcore(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "social_vs_hardcore": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_tradeoff_slider(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "practice_vs_science": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_invalid_city_vs_campus(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "city_vs_campus": 101,
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_oversized_body(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "interests": "x" * 140_000,
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 413)

    def test_list_universities_rejects_invalid_sort(self):
        response = self.client.get("/universities?sort=invalid_sort_inject")
        self.assertEqual(response.status_code, 422)

    def test_list_universities_rejects_oversized_query_param(self):
        response = self.client.get(f"/universities?q={'x' * 201}")
        self.assertEqual(response.status_code, 422)

    def test_list_universities_rejects_out_of_bounds_budget(self):
        response = self.client.get("/universities?user_budget=1000001")
        self.assertEqual(response.status_code, 422)

    def test_list_universities_rejects_out_of_bounds_acceptance(self):
        response = self.client.get("/universities?min_acceptance=101")
        self.assertEqual(response.status_code, 422)

    def test_list_universities_rejects_page_over_max(self):
        response = self.client.get("/universities?page=10001")
        self.assertEqual(response.status_code, 422)

    def test_ai_sort_rejects_page_over_max(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {},
                "page": 10001,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_get_university_rejects_malformed_slug(self):
        response = self.client.get("/universities/%3Cscript%3E")
        self.assertEqual(response.status_code, 422)

    def test_get_university_rejects_slug_with_special_characters(self):
        response = self.client.get("/universities/slug!with*invalid?chars")
        self.assertEqual(response.status_code, 422)

    def test_get_university_uni_chance_rejects_malformed_slug(self):
        response = self.client.post(
            "/universities/invalid%20slug/uni-chance",
            json={"profile": {}},
        )
        self.assertEqual(response.status_code, 422)

    def test_compare_profiles_rejects_malformed_university_ids(self):
        response = self.client.post(
            "/universities/compare-profiles",
            json={
                "university_ids": ["<script>bad</script>", "mit-usa-cambridge"],
                "profile": {},
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_compare_profiles_rejects_oversized_university_id(self):
        response = self.client.post(
            "/universities/compare-profiles",
            json={
                "university_ids": ["a" * 65],
                "profile": {},
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_request_guard_rejects_null_byte_in_query(self):
        response = self.client.get("/universities?q=mit%00exploit")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Null bytes", response.json().get("detail", ""))

    def test_request_guard_rejects_overly_long_uri_path(self):
        response = self.client.get(f"/universities/{'a' * 2100}")
        self.assertEqual(response.status_code, 414)
        self.assertIn("path too long", response.json().get("detail", ""))

    def test_profile_payload_rejects_overly_long_strings_in_details(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "exams": [
                        {
                            "id": "SAT",
                            "score": 1400,
                            "details": {"essay": "x" * 2049},
                        }
                    ]
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_profile_payload_rejects_overly_long_key_in_details(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "exams": [
                        {
                            "id": "SAT",
                            "score": 1400,
                            "details": {"k" * 129: "value"},
                        }
                    ]
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_profile_payload_rejects_malformed_university_id_in_choices(self):
        response = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": {
                    "selectedAdmissionChoices": {
                        "bad <id>": {"choiceKey": "general::paid"}
                    }
                },
                "page": 1,
                "limit": 20,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_exam_validate_rejects_oversized_score_string(self):
        response = self.client.post(
            "/exams/validate",
            json={
                "exam": "SAT",
                "score": "x" * 129,
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_language_validate_rejects_oversized_score_string(self):
        response = self.client.post(
            "/languages/validate",
            json={
                "code": "en",
                "kind": "exam",
                "exam": "IELTS",
                "score": "x" * 129,
            },
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
