import unittest

from app.core.observability import _before_send


class ObservabilitySecurityTests(unittest.TestCase):
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
