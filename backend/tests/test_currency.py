import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from app.main import app
from app.services import currency as currency_service


class CurrencyServiceTests(unittest.TestCase):
    def setUp(self):
        currency_service._clear_cache_for_testing()

    def tearDown(self):
        currency_service._clear_cache_for_testing()

    def test_mock_api_rates_parsed_and_cached(self):
        mock_api_response = {
            "result": "success",
            "provider": "https://www.exchangerate-api.com",
            "base_code": "USD",
            "time_last_update_utc": "Fri, 11 Sep 2026 00:00:01 +0000",
            "rates": {
                "USD": 1.0,
                "EUR": 0.95,
                "KZT": 480.0,
                "GBP": 0.82,
                "CHF": 0.91,
            },
        }

        with patch("app.services.currency.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(mock_api_response).encode("utf-8")
            mock_urlopen.return_value.__enter__.return_value = mock_resp

            rates_data = currency_service.get_rates(force_refresh=True)

            self.assertEqual(rates_data["source"], "api")
            self.assertEqual(rates_data["rates"]["KZT"], 480.0)
            self.assertEqual(rates_data["rates"]["USD"], 1.0)
            self.assertEqual(rates_data["rates"]["EUR"], 0.95)

            # Second call should hit in-memory cache without calling urlopen again
            cached_data = currency_service.get_rates()
            self.assertEqual(cached_data["source"], "cache")
            self.assertEqual(cached_data["rates"]["KZT"], 480.0)
            self.assertEqual(mock_urlopen.call_count, 1)

    def test_api_failure_falls_back_to_static(self):
        with patch("app.services.currency.fetch_rates", side_effect=RuntimeError("API down")):
            rates_data = currency_service.get_rates(force_refresh=True)
            self.assertEqual(rates_data["source"], "fallback")
            self.assertIn("USD", rates_data["rates"])
            self.assertIn("KZT", rates_data["rates"])
            self.assertEqual(rates_data["rates"]["USD"], 1.0)
            self.assertEqual(rates_data["rates"]["KZT"], 450.0)

    def test_conversion_usd_kzt_chf_cross_rates(self):
        mock_rates = {
            "USD": 1.0,
            "KZT": 500.0,
            "CHF": 0.80,
            "EUR": 0.90,
        }
        with patch.object(
            currency_service,
            "get_rates",
            return_value={"rates": mock_rates, "source": "test", "date": "2026-09-11"},
        ):
            # USD -> KZT
            self.assertAlmostEqual(currency_service.convert(100, "USD", "KZT"), 50000.0)
            # KZT -> USD
            self.assertAlmostEqual(currency_service.convert(50000, "KZT", "USD"), 100.0)
            # CHF -> USD (80 CHF / 0.80 = 100 USD)
            self.assertAlmostEqual(currency_service.convert(80, "CHF", "USD"), 100.0)
            # USD -> CHF
            self.assertAlmostEqual(currency_service.convert(100, "USD", "CHF"), 80.0)
            # Cross-rates: CHF -> EUR (80 CHF = 100 USD = 90 EUR)
            self.assertAlmostEqual(currency_service.convert(80, "CHF", "EUR"), 90.0)
            # Identity conversion
            self.assertEqual(currency_service.convert(1234.5, "USD", "USD"), 1234.5)
            self.assertEqual(currency_service.convert(500, "KZT", "KZT"), 500.0)

    def test_conversion_invalid_code_graceful_error(self):
        with patch.object(
            currency_service,
            "get_rates",
            return_value={"rates": {"USD": 1.0, "EUR": 0.9}, "source": "test"},
        ):
            with self.assertRaises(ValueError) as ctx:
                currency_service.convert(100, "USD", "UNKNOWN_CURRENCY")
            self.assertIn("Unsupported or unknown currency", str(ctx.exception))

            with self.assertRaises(ValueError) as ctx2:
                currency_service.convert(100, "INVALID_SRC", "USD")
            self.assertIn("Unsupported or unknown currency", str(ctx2.exception))

            with self.assertRaises(ValueError):
                currency_service.convert("not-a-number", "USD", "EUR")

            with self.assertRaises(ValueError):
                currency_service.convert(None, "USD", "EUR")

    def test_filter_limits_known_and_unknown_currencies(self):
        mock_rates = {
            "USD": 1.0,
            "EUR": 0.90,
            "KZT": 500.0,
            "INR": 80.0,
        }
        with patch.object(
            currency_service,
            "get_rates",
            return_value={"rates": mock_rates, "source": "test"},
        ):
            # Known currency: KZT has explicit bounds in JSON
            kzt_limits = currency_service.get_filter_limits("KZT")
            self.assertEqual(kzt_limits["min"], 0)
            self.assertEqual(kzt_limits["max"], 25000000)
            self.assertEqual(kzt_limits["step"], 50000)

            # Known currency: USD
            usd_limits = currency_service.get_filter_limits("USD")
            self.assertEqual(usd_limits["min"], 0)
            self.assertEqual(usd_limits["max"], 50000)
            self.assertEqual(usd_limits["step"], 100)

            # Unknown currency: INR is in rates but not in config JSON
            # Default is {min: 0, max: 50000, step: 100} in USD
            # Converted to INR (rate 80.0): max = 4,000,000, step = 8,000
            inr_limits = currency_service.get_filter_limits("INR")
            self.assertEqual(inr_limits["min"], 0)
            self.assertEqual(inr_limits["max"], 4000000)
            self.assertEqual(inr_limits["step"], 8000)

            # Completely invalid currency
            with self.assertRaises(ValueError):
                currency_service.get_filter_limits("NON_EXISTENT")

    def test_circuit_breaker_and_backoff(self):
        with patch("app.services.currency.urlopen", side_effect=RuntimeError("connection error")), patch.object(
            currency_service, "CURRENCY_RATES_BACKOFF_SEC", 10
        ):
            # 1st failure puts service in backoff
            currency_service.get_rates(force_refresh=True)
            self.assertEqual(currency_service._CONSECUTIVE_FAILURES, 1)
            self.assertTrue(currency_service._in_backoff())

            # Advance past backoff window to test HALF_OPEN and second attempt
            currency_service._BACKOFF_UNTIL = 0.0
            self.assertFalse(currency_service._in_backoff())

            # 2nd failure triggers OPEN circuit state
            currency_service.get_rates(force_refresh=True)
            self.assertEqual(currency_service._CONSECUTIVE_FAILURES, 2)
            self.assertEqual(currency_service._CIRCUIT_STATE, "OPEN")
            self.assertTrue(currency_service._in_backoff())

            status = currency_service.get_rates_status()
            self.assertEqual(status["circuit_state"], "OPEN")
            self.assertEqual(status["consecutive_failures"], 2)

    def test_security_input_validation_and_malicious_inputs(self):
        # 1. Non-finite amounts (NaN, Infinity, overflow)
        with self.assertRaises(ValueError):
            currency_service.convert(float("nan"), "USD", "EUR")

        with self.assertRaises(ValueError):
            currency_service.convert(float("inf"), "USD", "EUR")

        with self.assertRaises(ValueError):
            currency_service.convert(1e25, "USD", "EUR")

        # 2. XSS / SQL Injection in currency codes
        with self.assertRaises(ValueError):
            currency_service.convert(100, "<script>alert(1)</script>", "USD")

        with self.assertRaises(ValueError):
            currency_service.convert(100, "USD", "'; DROP TABLE users;--")

        # 3. Path traversal in filter limits
        with self.assertRaises(ValueError):
            currency_service.get_filter_limits("../../../etc/passwd")

        # 4. Invalid base code in fetch_rates (prevents SSRF/URL injection)
        with self.assertRaises(ValueError):
            currency_service.fetch_rates("INVALID_LONG_BASE_CODE")

        # 5. Invalid URL scheme in fetch_rates
        with patch.object(currency_service, "CURRENCY_RATES_API_URL", "file:///etc/passwd"):
            with self.assertRaises(RuntimeError):
                currency_service.fetch_rates("USD")

        # 6. Malformed / corrupted API payload (negative, NaN, inf rates filtered out)
        corrupted_payload = {
            "result": "success",
            "rates": {
                "USD": 1.0,
                "EUR": -5.0,  # negative
                "GBP": "not-a-number",
                "KZT": 500.0,
                "<SCRIPT>": 10.0,  # invalid currency code
            },
        }
        with patch("app.services.currency.urlopen") as mock_urlopen:
            mock_resp = MagicMock()
            mock_resp.read.return_value = json.dumps(corrupted_payload).encode("utf-8")
            mock_urlopen.return_value.__enter__.return_value = mock_resp

            data = currency_service.fetch_rates("USD")
            self.assertIn("USD", data["rates"])
            self.assertIn("KZT", data["rates"])
            self.assertNotIn("EUR", data["rates"])
            self.assertNotIn("GBP", data["rates"])
            self.assertNotIn("<SCRIPT>", data["rates"])


class CurrencyApiEndpointsTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        currency_service._clear_cache_for_testing()

    def test_get_currency_rates_endpoint(self):
        resp = self.client.get("/currency/rates")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("public, max-age=3600", resp.headers.get("Cache-Control", ""))

        data = resp.json()
        self.assertIn("rates", data)
        self.assertIn("date", data)
        self.assertIn("source", data)
        self.assertIn("filter_limits", data)

        self.assertIsInstance(data["rates"], dict)
        self.assertIn("USD", data["rates"])
        self.assertEqual(data["rates"]["USD"], 1.0)
        self.assertIn("KZT", data["rates"])
        self.assertIn("EUR", data["rates"])

        self.assertIsInstance(data["filter_limits"], dict)
        self.assertIn("default", data["filter_limits"])
        self.assertIn("USD", data["filter_limits"])
        self.assertIn("KZT", data["filter_limits"])

    def test_get_currency_status_endpoint(self):
        resp = self.client.get("/currency/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("enabled", data)
        self.assertIn("circuit_state", data)
        self.assertIn("source", data)


if __name__ == "__main__":
    unittest.main()
