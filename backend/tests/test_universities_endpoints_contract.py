import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services import admissions_catalog


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

    def test_list_and_locations_contracts(self):
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
        self.assertIn("p25_normalized", score_profile)
        self.assertIn("median_normalized", score_profile)
        self.assertIn("p75_normalized", score_profile)
        self.assertEqual("HKDSE_WEIGHTED_TOTAL", score_profile.get("exam_id"))
        self.assertEqual(3, int(requirements.get("HKDSE_CHINESE_LANGUAGE", 0)))
        self.assertEqual(3, int(requirements.get("HKDSE_ENGLISH_LANGUAGE", 0)))
        self.assertEqual(2, int(requirements.get("HKDSE_MATHEMATICS", 0)))
        self.assertAlmostEqual(42.88, float(score_profile.get("median_raw") or 0.0), places=2)

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

    def test_reviewed_nu_detail_keeps_canonical_sources_across_languages(self):
        uid = "nazarbayev-university-kaz-astana"
        for lang in ("eng", "rus", "kaz"):
            response = self.client.get(f"/universities/{uid}?lang={lang}")
            self.assertEqual(200, response.status_code)
            data = response.json()
            self.assertEqual("reviewed", data["admissions_catalog"]["availability"])
            self.assertNotIn("admission_categories", data)
            self.assertTrue(data["name"])
            self.assertIn("preparation", data["academics"]["study_levels"])

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
        scoped_prices_unknown = {
            "imperial-college-london-uk",
            "university-of-oxford-uk-oxford",
            "harvard-usa-cambridge",
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
            if university_id in admissions_catalog.INSTITUTION_IDS:
                self.assertNotIn("finance", data)
                self.assertEqual(data["admissions_catalog"]["availability"], "reviewed")
                self.assertNotIn("finance", item)
                continue
            breakdown = finance.get("costs_breakdown_year_usd") or {}
            raw_total = finance.get("total_cost_year_usd")
            if raw_total is None:
                self.assertIn(university_id, scoped_prices_unknown, f"{university_id} unexpectedly has no annual total")
                if not breakdown:
                    self.assertIn(university_id, {"imperial-college-london-uk", "university-of-oxford-uk-oxford"})
                    continue
                total = None
            else:
                total = float(raw_total)
                self.assertGreater(total, 0.0, f"{university_id} missing total_cost_year_usd")

            self.assertTrue(breakdown, f"{university_id} missing visible truthful breakdown")
            if university_id == "harvard-usa-cambridge":
                # Harvard College publishes this scoped undergraduate COA as a
                # range. Personal expenses are an explicit line in that budget;
                # the root scalar stays null so the range is not flattened.
                self.assertEqual("2026-27", finance.get("academic_year"))
                self.assertEqual(
                    "Harvard College undergraduate cost of attendance, one academic year; domestic and international applicants",
                    finance.get("scope"),
                )
                cost_range = finance
                self.assertEqual(95134, cost_range.get("total_cost_year_min"))
                self.assertEqual(100134, cost_range.get("total_cost_year_max"))
                self.assertTrue(str(finance.get("source_url") or "").startswith("https://"))
                self.assertIn("Personal_Expenses", breakdown)
                harvard_forbidden_keys = forbidden_keys - {"Personal_Expenses"}
                self.assertTrue(
                    harvard_forbidden_keys.isdisjoint(set(breakdown.keys())),
                    f"{university_id} includes costs outside its published College budget breakdown",
                )
                self.assertEqual(95134, sum(float(value or 0.0) for value in breakdown.values()))
            else:
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
            if total is not None:
                self.assertLessEqual(
                    summed,
                    total + 0.01,
                    f"{university_id} visible breakdown exceeds total_cost_year_usd",
                )

    def test_imperial_and_oxford_unverified_global_costs_remain_null_in_list_and_detail(self):
        expected = {
            "imperial-college-london-uk": "GBP",
            "university-of-oxford-uk-oxford": "GBP",
        }
        response = self.client.get("/universities?limit=2000&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        cards = {str(row.get("id")): row for row in response.json().get("items") or []}

        for university_id, currency in expected.items():
            with self.subTest(university_id=university_id):
                card = cards.get(university_id)
                self.assertIsNotNone(card)
                if university_id in admissions_catalog.INSTITUTION_IDS:
                    self.assertNotIn("finance", card)
                    detail = self.client.get(f"/universities/{university_id}")
                    self.assertEqual(detail.status_code, 200)
                    self.assertNotIn("finance", detail.json())
                    self.assertEqual(detail.json()["admissions_catalog"]["availability"], "reviewed")
                    continue
                card_finance = card.get("finance") or {}
                self.assertIsNone(card_finance.get("total_cost_year_usd"))
                self.assertEqual(currency, card_finance.get("currency"))

                detail_response = self.client.get(f"/universities/{university_id}")
                self.assertEqual(detail_response.status_code, 200)
                detail_finance = detail_response.json().get("finance") or {}
                self.assertIsNone(detail_finance.get("total_cost_year_usd"))
                self.assertEqual(currency, detail_finance.get("currency"))

    def test_harvard_root_cost_range_is_projected_without_a_scalar_price(self):
        response = self.client.get("/universities?limit=2000&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        cards = {str(row.get("id")): row for row in response.json().get("items") or []}
        card = cards.get("harvard-usa-cambridge")
        self.assertIsNotNone(card)
        finance = card.get("finance") or {}

        self.assertIsNone(finance.get("total_cost_year_usd"))
        self.assertEqual("USD", finance.get("currency"))
        cost_range = finance.get("total_cost_year_range") or {}
        self.assertEqual(95134, cost_range.get("min"))
        self.assertEqual(100134, cost_range.get("max"))
        self.assertEqual("USD", cost_range.get("currency"))
        self.assertEqual(95134, cost_range.get("min_usd"))
        self.assertEqual(100134, cost_range.get("max_usd"))

    def test_student_size_band_uses_student_count_thresholds(self):
        from app.services.universities import student_size_band

        self.assertEqual("small", student_size_band({"student_count": 9999}))
        self.assertEqual("medium", student_size_band({"student_count": 10000}))
        self.assertEqual("medium", student_size_band({"student_count": 30000}))
        self.assertEqual("large", student_size_band({"student_count": 30001}))
        self.assertEqual("", student_size_band({"student_count": None}))

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
        known = {key: 0 for key in expected_keys}
        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            factors = detail.json().get("factors") or {}
            self.assertTrue(expected_keys.issubset(factors.keys()), f"{university_id} missing UniFit factor keys")
            for key in expected_keys:
                value = factors.get(key)
                # Null means the source data is missing; the slider then leaves this university out.
                if value is None:
                    continue
                known[key] += 1
                numeric = float(value)
                self.assertGreaterEqual(numeric, 0.0, f"{university_id}:{key} below 0")
                self.assertLessEqual(numeric, 1.0, f"{university_id}:{key} above 1")
        # Every slider still has data for most of the catalog.
        for key, count in known.items():
            self.assertGreater(count, len(items) // 2, key)

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
            if university_id in admissions_catalog.INSTITUTION_IDS:
                self.assertNotIn("finance", detail.json())
                self.assertEqual(detail.json()["admissions_catalog"]["availability"], "reviewed")
                continue
            status = str(finance.get("costs_breakdown_status") or "")
            if university_id in {"imperial-college-london-uk", "university-of-oxford-uk-oxford"}:
                self.assertIsNone(finance.get("total_cost_year_usd"), university_id)
                self.assertEqual("GBP", finance.get("currency"), university_id)
                self.assertFalse(finance.get("costs_breakdown_year_usd"), university_id)
                continue
            self.assertIn(status, allowed, f"{university_id} missing valid costs_breakdown_status")

    def test_one_time_costs_are_separate_from_annual_costs(self):
        expected = {
            "suleyman-demirel-university-kaz-kaskelen": (1980000, "student_fee", 60000),
            "kyoto-university-jp-kyoto": (535800, "admission_fee", 282000),
            "johns-hopkins-university-usa-baltimore": (94358, "matriculation_fee", 500),
        }

        for university_id, (annual_total, cost_type, one_time_amount) in expected.items():
            response = self.client.get(f"/universities/{university_id}")
            self.assertEqual(response.status_code, 200, university_id)
            finance = response.json().get("finance") or {}
            self.assertEqual(annual_total, finance.get("total_cost_year_usd"), university_id)
            costs = finance.get("one_time_costs") or []
            self.assertTrue(
                any(
                    cost.get("type") == cost_type and cost.get("amount") == one_time_amount
                    for cost in costs
                    if isinstance(cost, dict)
                ),
                university_id,
            )

    def test_university_assets_are_served_from_backend(self):
        university_id = self._first_university_id()
        self.assertTrue(university_id)

        for directory in ("logos", "logos-small"):
            with self.subTest(directory=directory):
                legacy_path = f"/universities/assets/{directory}/{university_id}.png"
                self.assertEqual(self.client.get(legacy_path).status_code, 404)

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
        program = detail.json()["academics"]["programs"][0]
        self.assertEqual(program["name"], "Компьютерные науки")
        self.assertEqual(program["source_name"], "Computer Science")

    def test_ai_sort_contract(self):
        profile = {
            "locale": "eng",
            "budget": 30000,
            "gpa": 3.68,
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

    def test_nu_support_context_keeps_sources_without_an_admission_percentage(self):
        uid = "nazarbayev-university-kaz-astana"
        response = self.client.post(f"/universities/{uid}/admissions-context", json={"context": {
            "study_option_id": "nu-a-study-bachelor-of-science-in-computer-science",
            "application_route_id": "nu-a-route-financial-support", "study_level": "undergraduate",
            "applicant_route": "first_year", "intended_entry_cycle": "2027/28"}})
        self.assertEqual(200, response.status_code)
        data = response.json()
        self.assertIsNone(data["assessment"]["overallChance"])
        self.assertEqual("funding_selection_separate", data["assessment"]["reason"])
        self.assertIn("nu-a-fact-financial-sequence", {row["id"] for row in data["facts"]})
        self.assertTrue(data["sources"])


if __name__ == "__main__":
    unittest.main()
