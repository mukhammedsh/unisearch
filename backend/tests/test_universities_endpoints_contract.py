import unittest

from fastapi.testclient import TestClient

from app.main import app


class UniversitiesEndpointsContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _first_university_id(self) -> str:
        response = self.client.get("/universities?limit=1&fields=card")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        items = data.get("items") or []
        self.assertTrue(items)
        return str((items[0] or {}).get("id") or "")

    def _first_university_ids(self, limit: int = 2):
        response = self.client.get(f"/universities?limit={limit}&fields=card")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        ids = [str((row or {}).get("id") or "") for row in items]
        ids = [uni_id for uni_id in ids if uni_id]
        self.assertGreaterEqual(len(ids), limit)
        return ids[:limit]

    def test_list_locations_and_stats_contracts(self):
        list_response = self.client.get("/universities?limit=5&fields=card&sort=name_asc")
        self.assertEqual(list_response.status_code, 200)
        self.assertIn("Cache-Control", list_response.headers)
        list_data = list_response.json()
        for key in ("items", "count", "total", "page", "limit", "sort"):
            self.assertIn(key, list_data)
        self.assertIsInstance(list_data.get("items"), list)
        self.assertLessEqual(int(list_data.get("count", 0)), 5)

        locations = self.client.get("/locations")
        self.assertEqual(locations.status_code, 200)
        self.assertIsInstance(locations.json(), dict)

        stats = self.client.get("/stats")
        self.assertEqual(stats.status_code, 200)
        stats_data = stats.json()
        self.assertGreater(int(stats_data.get("universities_total", 0)), 0)
        self.assertGreater(int(stats_data.get("countries_total", 0)), 0)

    def test_university_detail_supports_etag(self):
        university_id = self._first_university_id()
        self.assertTrue(university_id)

        first = self.client.get(f"/universities/{university_id}")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(university_id, first.json().get("id"))
        etag = str(first.headers.get("ETag") or "")
        self.assertTrue(etag)

        second = self.client.get(
            f"/universities/{university_id}",
            headers={"If-None-Match": etag},
        )
        self.assertEqual(second.status_code, 304)

    def test_university_detail_includes_category_applicable_majors(self):
        response = self.client.get("/universities/astana-it-university-kaz-astana")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        categories = [row for row in (data.get("admission_categories") or []) if isinstance(row, dict)]
        self.assertTrue(categories)

        category = next((row for row in categories if str(row.get("id") or "") == "aitu_paid"), None)
        self.assertIsNotNone(category)
        self.assertIn("Computer Science", category.get("applicable_majors") or [])
        profile = (category.get("requirement_profiles") or [])[0]
        grant_option = next(
            (
                option
                for option in (profile.get("funding_options") or [])
                if isinstance(option, dict) and str(option.get("id") or "") == "aitu_unt_grant"
            ),
            None,
        )
        self.assertIsNotNone(grant_option)

    def test_university_detail_includes_requirement_profile_score_profile_when_available(self):
        response = self.client.get("/universities/cuhk-hk-shatin")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        profiles = [
            profile
            for category in (data.get("admission_categories") or [])
            if isinstance(category, dict)
            for profile in (category.get("requirement_profiles") or [])
            if isinstance(profile, dict)
        ]
        hkdse_profile = next((profile for profile in profiles if str(profile.get("id") or "") == "cuhk_hkdse"), None)
        self.assertIsNotNone(hkdse_profile)
        score_profile = hkdse_profile.get("score_profile") or {}
        requirements = hkdse_profile.get("requirements") or {}
        stats_avg = hkdse_profile.get("stats_avg") or {}
        self.assertIn("p25_normalized", score_profile)
        self.assertIn("median_normalized", score_profile)
        self.assertIn("p75_normalized", score_profile)
        self.assertEqual("HKDSE_WEIGHTED_TOTAL", score_profile.get("exam_id"))
        self.assertEqual(3, int(requirements.get("HKDSE_CHINESE_LANGUAGE", 0)))
        self.assertEqual(3, int(requirements.get("HKDSE_ENGLISH_LANGUAGE", 0)))
        self.assertEqual(2, int(requirements.get("HKDSE_MATHEMATICS", 0)))
        self.assertAlmostEqual(42.88, float(stats_avg.get("HKDSE_WEIGHTED_TOTAL") or 0.0), places=2)

    def test_all_admission_categories_profiles_and_funding_options_have_descriptions(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            categories = detail.json().get("admission_categories") or []
            for category in categories:
                if not isinstance(category, dict):
                    continue
                category_id = str(category.get("id") or "")
                self.assertTrue(
                    str(category.get("description") or "").strip(),
                    f"{university_id}:{category_id} missing category description",
                )
                for profile in category.get("requirement_profiles") or []:
                    if not isinstance(profile, dict):
                        continue
                    self.assertTrue(
                        str(profile.get("description") or "").strip(),
                        f"{university_id}:{category_id}:{profile.get('id')} missing profile description",
                    )
                    for option in profile.get("funding_options") or []:
                        if not isinstance(option, dict):
                            continue
                        option_id = str(option.get("id") or "")
                        self.assertTrue(
                            str(option.get("description") or "").strip(),
                            f"{university_id}:{category_id}:{option_id} missing funding option description",
                        )

    def test_university_detail_localizes_requirement_profile_descriptions_by_lang(self):
        response = self.client.get("/universities/mit-usa-cambridge?lang=rus")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        category = next((row for row in (data.get("admission_categories") or []) if isinstance(row, dict)), None)
        self.assertIsNotNone(category)
        profile = (category.get("requirement_profiles") or [])[0]
        self.assertTrue(str(profile.get("description") or ""))
        paid_option = next(
            (
                row
                for row in (profile.get("funding_options") or [])
                if isinstance(row, dict) and str(row.get("id") or "") == "mit_regular"
            ),
            None,
        )
        self.assertIsNotNone(paid_option)
        self.assertTrue(str(paid_option.get("description") or ""))

    def test_all_universities_have_campus_size_and_truthful_cost_breakdown(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

        forbidden_keys = {
            "Personal_Expenses",
            "Health_Insurance",
            "Medical_Insurance",
            "Transportation",
            "Internet_and_Phone",
        }
        tuition_and_fee_only_allowed = {
            "Tuition",
            "Student_Life_Fee",
            "Student_Fees",
            "Mandatory_Fees",
            "Student_Services_and_Amenities_Fee",
            "Semester_Fees",
            "Compulsory_Fees",
            "Student_Services_and_Health_Fees",
        }

        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            data = detail.json()

            student_life = data.get("student_life") or {}
            self.assertTrue(
                str(student_life.get("size") or "").strip(),
                f"{university_id} missing student_life.size",
            )

            finance = data.get("finance") or {}
            breakdown = finance.get("costs_breakdown_year_usd") or {}
            total = float(finance.get("total_cost_year_usd") or 0.0)
            self.assertGreater(total, 0.0, f"{university_id} missing total_cost_year_usd")

            self.assertTrue(breakdown, f"{university_id} missing visible truthful breakdown")
            self.assertTrue(
                forbidden_keys.isdisjoint(set(breakdown.keys())),
                f"{university_id} still exposes forbidden discretionary breakdown keys",
            )
            self.assertTrue(
                all(float(value or 0.0) > 0.0 for value in breakdown.values()),
                f"{university_id} contains non-positive breakdown values",
            )

            status = str(finance.get("costs_breakdown_status") or "")
            if status == "official_tuition_and_fees_only":
                self.assertTrue(
                    set(breakdown.keys()).issubset(tuition_and_fee_only_allowed),
                    f"{university_id} exposes non-official living-cost categories under tuition/fees-only policy",
                )

            summed = sum(float(value or 0.0) for value in breakdown.values())
            self.assertLessEqual(
                summed,
                total + 0.01,
                f"{university_id} visible breakdown exceeds total_cost_year_usd",
            )

    def test_university_detail_localizes_campus_size_group_by_lang(self):
        response = self.client.get("/universities/mit-usa-cambridge?lang=rus")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        student_life = data.get("student_life") or {}
        self.assertEqual("Средний", student_life.get("size"))

    def test_all_universities_have_valid_unifit_slider_factors(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

        expected_keys = {
            "practice_vs_science",
            "social_vs_hardcore",
            "budget_vs_prestige",
            "city_vs_campus",
        }
        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            factors = detail.json().get("factors") or {}
            self.assertTrue(expected_keys.issubset(factors.keys()), f"{university_id} missing UniFit factor keys")
            for key in expected_keys:
                value = factors.get(key)
                self.assertIsNotNone(value, f"{university_id}:{key} is null")
                numeric = float(value)
                self.assertGreaterEqual(numeric, 0.0, f"{university_id}:{key} below 0")
                self.assertLessEqual(numeric, 1.0, f"{university_id}:{key} above 1")

    def test_all_universities_expose_cost_breakdown_status(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

        allowed = {"official_mandatory_breakdown", "official_tuition_and_fees_only"}
        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            finance = detail.json().get("finance") or {}
            status = str(finance.get("costs_breakdown_status") or "")
            self.assertIn(status, allowed, f"{university_id} missing valid costs_breakdown_status")

    def test_university_assets_are_served_from_backend(self):
        university_id = self._first_university_id()
        self.assertTrue(university_id)

        logo_small = self.client.get(f"/universities/assets/logos-small/{university_id}.png")
        self.assertEqual(logo_small.status_code, 200)
        self.assertIn("image/", str(logo_small.headers.get("content-type") or ""))

        thumb_full = self.client.get(f"/universities/assets/thumbnails/{university_id}.jpg")
        self.assertEqual(thumb_full.status_code, 200)
        self.assertIn("image/", str(thumb_full.headers.get("content-type") or ""))

        thumb_full_webp = self.client.get(f"/universities/assets/thumbnails/{university_id}.webp")
        self.assertEqual(thumb_full_webp.status_code, 200)
        self.assertIn("image/", str(thumb_full_webp.headers.get("content-type") or ""))

        thumb_medium = self.client.get(f"/universities/assets/thumbnails-medium/{university_id}.jpg")
        self.assertEqual(thumb_medium.status_code, 200)
        self.assertIn("image/", str(thumb_medium.headers.get("content-type") or ""))

        thumb_medium_webp = self.client.get(f"/universities/assets/thumbnails-medium/{university_id}.webp")
        self.assertEqual(thumb_medium_webp.status_code, 200)
        self.assertIn("image/", str(thumb_medium_webp.headers.get("content-type") or ""))

    def test_university_detail_localizes_response_by_lang(self):
        response = self.client.get("/universities/astana-it-university-kaz-astana?lang=rus")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("Астана IT университет", data.get("name"))
        location = data.get("location") or {}
        self.assertEqual("Казахстан", location.get("country"))
        self.assertEqual("Астана", location.get("city"))

    def test_kazakhstan_program_fields_are_localized_by_lang(self):
        response = self.client.get("/universities/astana-medical-university-kaz-astana?lang=rus")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        programs = ((data.get("academics") or {}).get("programs") or [])
        self.assertTrue(programs)

        first_program = programs[0]
        self.assertIn("Казахский", first_program.get("language") or [])
        self.assertIn("Науки о здоровье", first_program.get("major_tags") or [])

    def test_university_translations_endpoint_contract(self):
        response = self.client.get("/universities/translations?lang=rus")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("rus", data.get("lang"))
        self.assertIn("data", data)
        payload = data.get("data") or {}
        self.assertIn("groups", payload)
        self.assertIn("program_names", payload)
        self.assertIn("track_labels", payload)
        self.assertEqual(
            "Бакалавр вычислительных систем",
            (payload.get("program_names") or {}).get("bachelor_of_computing"),
        )

    def test_english_university_names_use_full_forms(self):
        response = self.client.get("/universities/translations?lang=eng")
        self.assertEqual(response.status_code, 200)
        payload = (response.json().get("data") or {}).get("university_names") or {}
        self.assertEqual(
            "Swiss Federal Institute of Technology Zurich",
            payload.get("eth-zurich-ch-zurich"),
        )
        self.assertEqual(
            "Swiss Federal Institute of Technology Lausanne",
            payload.get("epfl-ch-lausanne"),
        )
        self.assertEqual(
            "Korea Advanced Institute of Science and Technology",
            payload.get("kaist-kr-daejeon"),
        )

        detail = self.client.get("/universities/kaist-kr-daejeon?lang=eng")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            "Korea Advanced Institute of Science and Technology",
            detail.json().get("name"),
        )

    def test_russian_university_names_hide_abbreviations_in_visible_label(self):
        response = self.client.get("/universities/translations?lang=rus")
        self.assertEqual(response.status_code, 200)
        payload = (response.json().get("data") or {}).get("university_names") or {}
        self.assertEqual(
            "Швейцарская высшая техническая школа Цюриха",
            payload.get("eth-zurich-ch-zurich"),
        )
        self.assertNotIn("(ETH Zurich)", payload.get("eth-zurich-ch-zurich", ""))

        detail = self.client.get("/universities/eth-zurich-ch-zurich?lang=rus")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(
            "Швейцарская высшая техническая школа Цюриха",
            detail.json().get("name"),
        )

    def test_ai_sort_uni_chance_and_roi_contracts(self):
        university_id = self._first_university_id()
        profile = {
            "locale": "eng",
            "budget": 30000,
            "gpa": 92,
            "major": "Computer Science",
            "interests": "ai and robotics",
            "studyMode": "On-campus",
            "fundingType": "any",
            "exams": [{"exam": "SAT", "score": 1420}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
        }

        ai_sort = self.client.post(
            "/universities/ai-sort",
            json={
                "profile": profile,
                "practice_vs_science": 55,
                "social_vs_hardcore": 50,
                "budget_vs_prestige": 60,
                "city_vs_campus": 45,
                "page": 1,
                "limit": 10,
            },
        )
        self.assertEqual(ai_sort.status_code, 200)
        ai_data = ai_sort.json()
        for key in ("items", "count", "total", "page", "limit", "sort", "warnings"):
            self.assertIn(key, ai_data)
        self.assertIsInstance(ai_data.get("items"), list)
        self.assertLessEqual(int(ai_data.get("count", 0)), 10)

        uni_chance = self.client.post(
            f"/universities/{university_id}/uni-chance",
            json={"profile": profile},
        )
        self.assertEqual(uni_chance.status_code, 200)
        chance_data = uni_chance.json()
        self.assertIn("overallChance", chance_data)
        self.assertIn("choices", chance_data)
        overall_chance = chance_data.get("overallChance")
        if overall_chance is not None:
            self.assertTrue(0 <= float(overall_chance) <= 100)

        roi = self.client.post(
            f"/universities/{university_id}/roi",
            json={"profile": profile},
        )
        self.assertEqual(roi.status_code, 200)
        roi_data = roi.json()
        for key in ("roi_value", "roi_label", "roi_tone", "context_type"):
            self.assertIn(key, roi_data)
        self.assertGreaterEqual(float(roi_data.get("roi_value", 0.0)), 0.0)

    def test_compare_profiles_batch_contract_matches_single_endpoints(self):
        university_ids = self._first_university_ids(2)
        profile = {
            "locale": "eng",
            "budget": 30000,
            "gpa": 92,
            "major": "Computer Science",
            "fundingType": "any",
            "exams": [{"exam": "SAT", "score": 1420}],
            "languages": [{"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.0}],
        }

        batch = self.client.post(
            "/universities/compare-profiles",
            json={"university_ids": university_ids, "profile": profile},
        )
        self.assertEqual(batch.status_code, 200)
        self.assertIn("private, max-age=30", batch.headers.get("Cache-Control", ""))
        data = batch.json()
        self.assertEqual(university_ids, list(data.keys()))

        for university_id in university_ids:
            with self.subTest(university_id=university_id):
                row = data.get(university_id)
                self.assertIsInstance(row, dict)
                self.assertIn("uniChance", row)
                self.assertIn("roi", row)

                single_chance = self.client.post(
                    f"/universities/{university_id}/uni-chance",
                    json={"profile": profile},
                )
                single_roi = self.client.post(
                    f"/universities/{university_id}/roi",
                    json={"profile": profile},
                )
                self.assertEqual(single_chance.status_code, 200)
                self.assertEqual(single_roi.status_code, 200)
                self.assertEqual(single_chance.json().get("overallChance"), row["uniChance"].get("overallChance"))
                self.assertEqual(single_chance.json().get("bestChoiceKey"), row["uniChance"].get("bestChoiceKey"))
                self.assertEqual(single_roi.json().get("roi_value"), row["roi"].get("roi_value"))
                self.assertEqual(single_roi.json().get("roi_tone"), row["roi"].get("roi_tone"))

    def test_compare_profiles_batch_handles_unknown_empty_and_duplicate_ids(self):
        university_id = self._first_university_id()
        response = self.client.post(
            "/universities/compare-profiles",
            json={"university_ids": ["", university_id, university_id, "missing-university-id"], "profile": {}},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([university_id, "missing-university-id"], list(data.keys()))
        self.assertIsInstance(data.get(university_id), dict)
        self.assertIsNone(data.get("missing-university-id"))

    def test_compare_profiles_batch_rejects_too_many_ids(self):
        ids = [f"u-{idx}" for idx in range(51)]
        response = self.client.post(
            "/universities/compare-profiles",
            json={"university_ids": ids, "profile": {}},
        )
        self.assertEqual(response.status_code, 422)

    def test_roi_uses_official_salary_data_for_supported_universities(self):
        supported_ids = [
            "mit-usa-cambridge",
            "national-university-of-singapore-sg-singapore",
            "university-of-toronto-ca-toronto",
            "cuhk-hk-shatin",
        ]

        for university_id in supported_ids:
            with self.subTest(university_id=university_id):
                response = self.client.post(
                    f"/universities/{university_id}/roi",
                    json={"profile": {"locale": "eng", "studyMode": "On-campus"}},
                )
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertNotEqual("no_salary_data", str(data.get("context_type", "")))
                self.assertGreater(float(data.get("salary_used_usd", 0.0)), 0.0)


if __name__ == "__main__":
    unittest.main()
