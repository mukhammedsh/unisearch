import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.settings import DOCS_ENABLED
from app.main import app
from app.services.admissions_catalog import AdmissionsCatalogError, InstitutionNotFoundError


class ApiHardeningTests(unittest.TestCase):
    def test_docs_enabled_setting_exists(self):
        self.assertIsInstance(DOCS_ENABLED, bool)

    def test_app_unhandled_exception_returns_json_500(self):
        client = TestClient(app, raise_server_exceptions=False)

        # Inject a temporary route that deliberately raises an unexpected exception
        @app.get("/test-unhandled-crash-endpoint-for-500")
        async def crash_endpoint():
            raise RuntimeError("Database connection suddenly dropped")

        response = client.get("/test-unhandled-crash-endpoint-for-500")
        self.assertEqual(500, response.status_code)
        self.assertTrue(response.headers.get("content-type", "").startswith("application/json"))
        data = response.json()
        self.assertEqual("Internal server error", data.get("detail"))
        # Verify no raw exception text leaks to client
        self.assertNotIn("Database connection suddenly dropped", response.text)
        # Verify security headers and request id are preserved
        self.assertIn("X-Request-Id", response.headers)
        self.assertEqual("nosniff", response.headers.get("X-Content-Type-Options"))
        self.assertEqual("DENY", response.headers.get("X-Frame-Options"))
        self.assertEqual("same-origin", response.headers.get("Cross-Origin-Opener-Policy"))
        self.assertEqual("none", response.headers.get("X-Permitted-Cross-Domain-Policies"))
        self.assertEqual("0", response.headers.get("X-XSS-Protection"))

    def test_admissions_catalog_error_handler_applies_security_headers(self):
        client = TestClient(app)

        with patch("app.routers.admissions.admissions_catalog.list_study_options", side_effect=InstitutionNotFoundError("Institution missing")):
            res_404 = client.get("/universities/non-existent-university-xyz/study-options")
            self.assertEqual(404, res_404.status_code)
            self.assertEqual("nosniff", res_404.headers.get("X-Content-Type-Options"))
            self.assertEqual("DENY", res_404.headers.get("X-Frame-Options"))
            self.assertEqual("same-origin", res_404.headers.get("Cross-Origin-Opener-Policy"))
            self.assertEqual("none", res_404.headers.get("X-Permitted-Cross-Domain-Policies"))
            self.assertEqual("0", res_404.headers.get("X-XSS-Protection"))
            self.assertIn("Content-Security-Policy", res_404.headers)

        with patch("app.routers.admissions.admissions_catalog.list_study_options", side_effect=AdmissionsCatalogError("Snapshot corruption")):
            res_503 = client.get("/universities/stanford-university-usa-ca/study-options")
            self.assertEqual(503, res_503.status_code)
            self.assertEqual("nosniff", res_503.headers.get("X-Content-Type-Options"))
            self.assertEqual("DENY", res_503.headers.get("X-Frame-Options"))
            self.assertEqual("same-origin", res_503.headers.get("Cross-Origin-Opener-Policy"))
            self.assertEqual("none", res_503.headers.get("X-Permitted-Cross-Domain-Policies"))
            self.assertEqual("0", res_503.headers.get("X-XSS-Protection"))
            self.assertIn("Content-Security-Policy", res_503.headers)

    def test_security_headers_included_on_normal_responses(self):
        client = TestClient(app)
        response = client.get("/")
        self.assertEqual(200, response.status_code)
        self.assertEqual("nosniff", response.headers.get("X-Content-Type-Options"))
        self.assertEqual("DENY", response.headers.get("X-Frame-Options"))
        self.assertEqual("same-origin", response.headers.get("Cross-Origin-Opener-Policy"))
        self.assertEqual("none", response.headers.get("X-Permitted-Cross-Domain-Policies"))
        self.assertEqual("0", response.headers.get("X-XSS-Protection"))

    def test_docs_disabled_when_docs_enabled_is_false(self):
        with patch("app.core.settings.DOCS_ENABLED", False):
            # Test standalone FastAPI instance with docs disabled
            test_app = FastAPI(
                title="Test API",
                docs_url=None,
                redoc_url=None,
                openapi_url=None,
            )
            client = TestClient(test_app)
            res_docs = client.get("/docs")
            res_redoc = client.get("/redoc")
            res_openapi = client.get("/openapi.json")

            self.assertEqual(404, res_docs.status_code)
            self.assertEqual(404, res_redoc.status_code)
            self.assertEqual(404, res_openapi.status_code)


if __name__ == "__main__":
    unittest.main()
