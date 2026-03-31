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

        grant_track = next(
            (
                track
                for track in tracks
                if str(track.get("id") or "") == "aitu_unt_grant"
            ),
            None,
        )
        self.assertIsNotNone(grant_track)
        self.assertIn("Computer Science", grant_track.get("applicable_majors") or [])

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
        self.assertTrue(0 <= int(chance_data.get("overallChance", 0)) <= 100)

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
