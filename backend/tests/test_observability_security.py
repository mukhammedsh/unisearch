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


if __name__ == "__main__":
    unittest.main()
