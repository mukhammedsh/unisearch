import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.settings import DOCS_ENABLED
from app.main import app


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
