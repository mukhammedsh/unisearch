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

    def test_university_detail_includes_track_applicable_majors(self):
        response = self.client.get("/universities/astana-it-university-kaz-astana")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        tracks = [
            track
            for track in (data.get("admission_tracks") or [])
            if isinstance(track, dict)
        ]
        self.assertTrue(tracks)

        admission_track = next(
            (
                track
                for track in tracks
                if str(track.get("id") or "") == "aitu_paid"
            ),
            None,
        )
        self.assertIsNotNone(admission_track)
        self.assertIn("Computer Science", admission_track.get("applicable_majors") or [])
        grant_option = next(
            (
                option
                for option in (admission_track.get("funding_options") or [])
                if isinstance(option, dict) and str(option.get("id") or "") == "aitu_unt_grant"
            ),
            None,
        )
        self.assertIsNotNone(grant_option)
        self.assertIn("Computer Science", grant_option.get("applicable_majors") or [])

    def test_university_detail_includes_track_score_profile_when_available(self):
        response = self.client.get("/universities/cuhk-hk-shatin")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        tracks = [
            track
            for track in (data.get("admission_tracks") or [])
            if isinstance(track, dict)
        ]
        self.assertTrue(tracks)

        hkdse_track = next(
            (
                track
                for track in tracks
                if str(track.get("id") or "") == "cuhk_hkdse"
            ),
            None,
        )
        self.assertIsNotNone(hkdse_track)
        score_profile = hkdse_track.get("score_profile") or {}
        self.assertIn("p25_normalized", score_profile)
        self.assertIn("median_normalized", score_profile)
        self.assertIn("p75_normalized", score_profile)
        self.assertEqual("HKDSE_WEIGHTED_TOTAL", score_profile.get("exam_id"))

    def test_all_admission_tracks_and_funding_options_have_descriptions(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

        for item in items:
            university_id = str((item or {}).get("id") or "")
            self.assertTrue(university_id)
            detail = self.client.get(f"/universities/{university_id}")
            self.assertEqual(detail.status_code, 200, university_id)
            tracks = detail.json().get("admission_tracks") or []
            for track in tracks:
                if not isinstance(track, dict):
                    continue
                track_id = str(track.get("id") or "")
                self.assertTrue(
                    str(track.get("description") or "").strip(),
                    f"{university_id}:{track_id} missing track description",
                )
                for option in track.get("funding_options") or []:
                    if not isinstance(option, dict):
                        continue
                    option_id = str(option.get("id") or "")
                    self.assertTrue(
                        str(option.get("description") or "").strip(),
                        f"{university_id}:{track_id}:{option_id} missing funding option description",
                    )

    def test_university_detail_localizes_track_descriptions_by_lang(self):
        response = self.client.get("/universities/mit-usa-cambridge?lang=rus")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        track = next(
            (
                row
                for row in (data.get("admission_tracks") or [])
                if isinstance(row, dict) and str(row.get("id") or "") == "mit_regular"
            ),
            None,
        )
        self.assertIsNotNone(track)
        self.assertTrue(
            str(track.get("description") or "").startswith("Основной вариант поступления в MIT"),
        )
        paid_option = next(
            (
                row
                for row in (track.get("funding_options") or [])
                if isinstance(row, dict) and str(row.get("id") or "") == "mit_regular"
            ),
            None,
        )
        self.assertIsNotNone(paid_option)
        self.assertIn("Платный вариант поступления в MIT", str(paid_option.get("description") or ""))

    def test_all_universities_have_campus_size_and_detailed_cost_breakdown(self):
        response = self.client.get("/universities?limit=100&fields=card&sort=name_asc")
        self.assertEqual(response.status_code, 200)
        items = response.json().get("items") or []
        self.assertTrue(items)

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
            self.assertGreaterEqual(
                len([key for key, value in breakdown.items() if isinstance(key, str) and value is not None]),
                5,
                f"{university_id} breakdown is not detailed enough",
            )
            total = float(finance.get("total_cost_year_usd") or 0.0)
            summed = sum(float(value or 0.0) for value in breakdown.values())
            self.assertAlmostEqual(
                total,
                summed,
                places=2,
                msg=f"{university_id} total_cost_year_usd does not match breakdown sum",
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

        allowed = {"official_breakdown", "mixed_official_guidance"}
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

    def test_university_detail_localizes_response_by_lang(self):
        response = self.client.get("/universities/astana-it-university-kaz-astana?lang=rus")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("Астана IT университет", data.get("name"))
        location = data.get("location") or {}
        self.assertEqual("Казахстан", location.get("country"))
        self.assertEqual("Астана", location.get("city"))

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
        self.assertIn("tracks", chance_data)
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
