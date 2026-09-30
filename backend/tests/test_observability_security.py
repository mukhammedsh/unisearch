import unittest
from unittest.mock import patch

from fastapi import FastAPI

from app.core.observability import _before_send, setup_observability


class ObservabilitySecurityTests(unittest.TestCase):
    def test_configured_error_and_transaction_callbacks_scrub_ops_credentials(self):
        with patch("app.core.observability.SENTRY_DSN", "https://public@example.invalid/1"), \
             patch("app.core.observability.METRICS_ENABLED", False), \
             patch("app.core.observability.OPS_ADMIN_HEADER", "X-Custom-Ops"), \
             patch("app.core.observability.sentry_sdk") as sdk:
            setup_observability(FastAPI())
            options = sdk.init.call_args.kwargs
            self.assertFalse(options["include_local_variables"])
            for hook in ("before_send", "before_send_transaction"):
                with self.subTest(hook=hook):
                    event = {"request": {"headers": {"x-custom-ops": "private", "user-agent": "browser"}},
                             "spans": [{"data": {"X-Api-Key": "private", "author": "kept"}}]}
                    scrubbed = options[hook](event, {})
                    self.assertEqual(scrubbed["request"]["headers"]["x-custom-ops"], "[Filtered]")
                    self.assertEqual(scrubbed["request"]["headers"]["user-agent"], "browser")
                    self.assertEqual(scrubbed["spans"][0]["data"]["X-Api-Key"], "[Filtered]")
                    self.assertEqual(scrubbed["spans"][0]["data"]["author"], "kept")
                    self.assertEqual(event["request"]["headers"]["x-custom-ops"], "private")

    def test_sentry_before_send_scrubs_profile_payloads(self):
        event = {
            "request": {
                "headers": {
                    "authorization": "Bearer secret",
                    "x-request-id": "req-1",
                },
                "data": {
                    "profile": {
                        "interests": "ai and finance",
                        "exams": [{"exam": "SAT", "score": 1500}],
                    },
                    "q": "mit",
                },
            },
            "extra": {
                "languages": [{"code": "en", "score": 120}],
                "safe": "kept",
            },
        }

        scrubbed = _before_send(event, hint={})

        self.assertEqual("[Filtered]", scrubbed["request"]["headers"]["authorization"])
        self.assertEqual("[Filtered]", scrubbed["request"]["data"]["profile"])
        self.assertEqual("[Filtered]", scrubbed["extra"]["languages"])
        self.assertEqual("kept", scrubbed["extra"]["safe"])
        self.assertEqual("mit", scrubbed["request"]["data"]["q"])

    def test_sentry_before_send_scrubs_sensitive_headers_and_credentials(self):
        event = {
            "request": {
                "headers": {
                    "Set-Cookie": "session_token=secret_123",
                    "X-Api-Key": "key_456",
                    "Authentication": "Basic secret_hash",
                    "User-Agent": "Mozilla/5.0",
                },
                "data": {
                    "session_id": "sess_789",
                    "user_credentials": {"user": "admin", "pass": "secret"},
                    "q": "stanford",
                },
            },
        }

        scrubbed = _before_send(event, hint={})

        headers = scrubbed["request"]["headers"]
        data = scrubbed["request"]["data"]

        self.assertEqual("[Filtered]", headers["Set-Cookie"])
        self.assertEqual("[Filtered]", headers["X-Api-Key"])
        self.assertEqual("[Filtered]", headers["Authentication"])
        self.assertEqual("Mozilla/5.0", headers["User-Agent"])

        self.assertEqual("[Filtered]", data["session_id"])
        self.assertEqual("[Filtered]", data["user_credentials"])
        self.assertEqual("stanford", data["q"])


if __name__ == "__main__":
    unittest.main()
