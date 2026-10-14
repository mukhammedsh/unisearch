import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import admissions_catalog, universities as university_service


class AdmissionsEndpointsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @patch("app.routers.admissions.admissions_catalog.list_study_options")
    @patch("app.routers.admissions.admissions_catalog.get_revision", return_value="revision-1")
    @patch("app.routers.admissions.admissions_catalog.get_institution", return_value={"institution": {"id": "stanford-university-usa-ca"}})
    def test_study_options_passes_valid_filters_and_supports_revision_etag(self, _institution, _revision, list_options):
        expected = {
            "institution_id": "stanford-university-usa-ca",
            "revision": "revision-1",
            "items": [{"id": "stanford-option-cs-bs", "title": "Computer Science (BS)"}],
            "total": 1,
            "page": 2,
            "limit": 10,
        }
        list_options.return_value = expected
        response = self.client.get(
            "/universities/stanford-university-usa-ca/study-options",
            params={"search": "  computer science  ", "study_level": "undergraduate", "page": 2, "limit": 10},
        )

        self.assertEqual(200, response.status_code)
        self.assertEqual(expected, response.json())
        self.assertEqual("public, max-age=300, stale-while-revalidate=60", response.headers["Cache-Control"])
        self.assertTrue(response.headers.get("ETag"))
        list_options.assert_called_once_with(
            "stanford-university-usa-ca",
            search_candidates=university_service._search_query_candidates("computer science", search_lang="eng"),
            study_level="undergraduate", page=2, limit=10,
        )

        unchanged = self.client.get(
            "/universities/stanford-university-usa-ca/study-options",
            params={"search": "  computer science  ", "study_level": "undergraduate", "page": 2, "limit": 10},
            headers={"If-None-Match": response.headers["ETag"]},
        )
        self.assertEqual(304, unchanged.status_code)
        self.assertEqual(response.headers["ETag"], unchanged.headers["ETag"])

    def test_study_options_rejects_invalid_query_values(self):
        for params in (
            {"search": "x" * 201},
            {"study_level": "MBA"},
            {"limit": 101},
            {"page": 0},
        ):
            with self.subTest(params=params):
                response = self.client.get("/universities/stanford-university-usa-ca/study-options", params=params)
                self.assertEqual(422, response.status_code)

    def test_study_options_searches_kazakh_aliases_without_changing_source_titles(self):
        endpoint = "/universities/stanford-university-usa-ca/study-options"
        canonical = self.client.get(endpoint, params={"search": "Computer Science", "study_level": "undergraduate"})
        localized = self.client.get(endpoint, params={"search": "Информатика", "study_level": "undergraduate", "lang": "kk-KZ"})

        self.assertEqual(200, localized.status_code)
        self.assertGreater(canonical.json()["total"], 0)
        self.assertEqual(canonical.json()["items"], localized.json()["items"])
        self.assertEqual(canonical.json()["total"], localized.json()["total"])

        normalized = self.client.get(endpoint, params={"search": "Информатика", "study_level": "undergraduate", "lang": "kaz"})
        hinted = self.client.get(endpoint, params={"search": "Информатика", "study_level": "undergraduate"}, headers={"Accept-Language": "kk-KZ, en;q=0.8"})
        english = self.client.get(endpoint, params={"search": "Информатика", "study_level": "undergraduate", "lang": "eng"})
        self.assertEqual(localized.headers["ETag"], normalized.headers["ETag"])
        self.assertEqual(localized.headers["ETag"], hinted.headers["ETag"])
        self.assertEqual(localized.json(), hinted.json())
        self.assertEqual("Accept-Language", hinted.headers["Vary"])
        unchanged = self.client.get(endpoint, params={"search": "Информатика", "study_level": "undergraduate"},
                                    headers={"Accept-Language": "kk-KZ", "If-None-Match": hinted.headers["ETag"]})
        self.assertEqual(304, unchanged.status_code)
        self.assertEqual("Accept-Language", unchanged.headers["Vary"])
        self.assertNotEqual(localized.headers["ETag"], english.headers["ETag"])
        self.assertEqual([], english.json()["items"])

    def test_study_options_rejects_oversized_language_input(self):
        response = self.client.get("/universities/stanford-university-usa-ca/study-options", params={"lang": "k" * 17})
        self.assertEqual(422, response.status_code)

    def test_study_options_treats_punctuation_only_search_as_empty(self):
        endpoint = "/universities/stanford-university-usa-ca/study-options"
        empty = self.client.get(endpoint, params={"lang": "kaz"})
        punctuation = self.client.get(endpoint, params={"lang": "kaz", "search": "!!!"})
        self.assertEqual(200, punctuation.status_code)
        self.assertEqual(empty.json(), punctuation.json())

    @patch("app.routers.admissions.admissions_catalog.list_study_options", side_effect=admissions_catalog.InstitutionNotFoundError("unaccepted"))
    def test_study_options_returns_404_for_unaccepted_institution(self, _get_institution):
        response = self.client.get("/universities/not-accepted/study-options")
        self.assertEqual(404, response.status_code)

    @patch("app.routers.admissions.admissions_catalog.list_study_options", side_effect=admissions_catalog.AdmissionsCatalogError("bad snapshot"))
    def test_study_options_returns_503_for_unavailable_snapshot(self, _get_institution):
        response = self.client.get("/universities/stanford-university-usa-ca/study-options")
        self.assertEqual(503, response.status_code)
        self.assertEqual("Admissions catalog is unavailable", response.json()["detail"])

    @patch("app.routers.admissions.admissions_catalog.resolve_context")
    def test_context_passes_selected_context_and_profile_without_cache_headers(self, resolve_context):
        resolved = {
            "institution_id": "stanford-university-usa-ca",
            "context": {"study_option_id": "stanford-option-cs-ms", "application_route_id": "directory-evidence:stanford-graduate-cs-ms"},
            "context_applicability": {"status": "matched"},
            "selected_option": {"id": "stanford-option-cs-ms"},
            "selected_route": {"id": "directory-evidence:stanford-graduate-cs-ms"},
            "available_routes": [],
            "facts": [],
            "unknowns": [],
            "sources": [],
            "fact_groups": {},
            "history": {"fact_ids": [], "unknown_ids": []},
            "excluded": {"facts": [], "unknowns": []},
        }
        resolve_context.return_value = resolved
        response = self.client.post(
            "/universities/stanford-university-usa-ca/admissions-context",
            json={
                "profile": {"gpa": 3.8, "applicant_route": "graduate", "intended_entry_cycle": "Autumn 2027"},
                "context": {
                    "study_option_id": "stanford-option-cs-ms",
                    "application_route_id": "directory-evidence:stanford-graduate-cs-ms",
                    "study_level": "Master",
                    "applicant_route": "graduate",
                    "intended_entry_cycle": "Autumn 2027",
                    "fee_status_context": "self_reported_international_overseas",
                },
            },
        )

        self.assertEqual(200, response.status_code)
        self.assertEqual(resolved, response.json())
        self.assertEqual("private, no-store", response.headers["Cache-Control"])
        self.assertNotIn("ETag", response.headers)
        args = resolve_context.call_args.kwargs
        self.assertEqual(3.8, args["profile"]["gpa"])
        self.assertEqual("masters", args["context"]["study_level"])
        self.assertEqual("directory-evidence:stanford-graduate-cs-ms", args["context"]["application_route_id"])

    @patch("app.routers.admissions.admissions_catalog.resolve_context")
    def test_context_keeps_valid_incompatible_selection_explicit(self, resolve_context):
        resolve_context.return_value = {
            "context": {"study_option_id": "stanford-option-cs-ms", "application_route_id": "directory-evidence:stanford-coterm-cs-ms"},
            "context_applicability": {"option": "matched", "route": "mismatched", "status": "mismatched"},
            "facts": [],
            "unknowns": [],
            "excluded": {"facts": [], "unknowns": []},
        }
        response = self.client.post(
            "/universities/stanford-university-usa-ca/admissions-context",
            json={"context": {"study_option_id": "stanford-option-cs-ms", "application_route_id": "directory-evidence:stanford-coterm-cs-ms", "applicant_route": "graduate"}},
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual("mismatched", response.json()["context_applicability"]["status"])
        self.assertEqual([], response.json()["facts"])

    def test_context_rejects_extra_or_malformed_context_fields(self):
        bad_payloads = (
            {"context": {"study_option_id": "stanford-option-cs-ms", "surprise": "value"}},
            {"context": {"study_option_id": "x" * 129}},
            {"context": {"application_route_id": "x" * 257}},
            {"context": {"study_level": "unrecognized"}},
            {"context": {"applicant_route": "coterm"}},
            {"context": {"fee_status_context": "confirmed_home"}},
            {"unexpected": True},
        )
        for payload in bad_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/universities/stanford-university-usa-ca/admissions-context", json=payload)
                self.assertEqual(422, response.status_code)

    @patch("app.routers.admissions.admissions_catalog.resolve_context", side_effect=admissions_catalog.InstitutionNotFoundError("not accepted"))
    def test_context_returns_404_for_unaccepted_institution(self, _resolve):
        response = self.client.post("/universities/not-accepted/admissions-context", json={})
        self.assertEqual(404, response.status_code)

    @patch("app.routers.admissions.admissions_catalog.resolve_context", side_effect=admissions_catalog.AdmissionsCatalogError("bad snapshot"))
    def test_context_returns_503_for_unavailable_snapshot(self, _resolve):
        response = self.client.post("/universities/stanford-university-usa-ca/admissions-context", json={})
        self.assertEqual(503, response.status_code)
        self.assertEqual("Admissions catalog is unavailable", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
