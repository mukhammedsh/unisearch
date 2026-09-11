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
            # Currency without explicit override: KZT converted from default (rate 500.0)
            # Default is {min: 0, max: 100000, step: 100} in USD -> 50,000,000 / 50,000 in KZT
            kzt_limits = currency_service.get_filter_limits("KZT")
            self.assertEqual(kzt_limits["min"], 0)
            self.assertEqual(kzt_limits["max"], 50000000)
            self.assertEqual(kzt_limits["step"], 50000)

            # USD: converted from default {min: 0, max: 100000, step: 100}
            usd_limits = currency_service.get_filter_limits("USD")
            self.assertEqual(usd_limits["min"], 0)
            self.assertEqual(usd_limits["max"], 100000)
            self.assertEqual(usd_limits["step"], 100)

            # Currency without explicit override: INR (rate 80.0)
            # Default is {min: 0, max: 100000, step: 100} in USD -> 8,000,000 / 10,000 (1-2-5 scale) in INR
            inr_limits = currency_service.get_filter_limits("INR")
            self.assertEqual(inr_limits["min"], 0)
            self.assertEqual(inr_limits["max"], 8000000)
            self.assertEqual(inr_limits["step"], 10000)

            # Completely invalid currency
            with self.assertRaises(ValueError):
                currency_service.get_filter_limits("NON_EXISTENT")

    def test_nice_step_and_nice_max_1_2_5_scale(self):
        # 1-2-5 scale ticks: ..., 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, ...
        self.assertEqual(currency_service._nice_step(0.5), 1)
        self.assertEqual(currency_service._nice_step(1.0), 1)
        self.assertEqual(currency_service._nice_step(1.4), 1)
        self.assertEqual(currency_service._nice_step(1.5), 2)
        self.assertEqual(currency_service._nice_step(3.1), 2)
        self.assertEqual(currency_service._nice_step(3.5), 5)
        self.assertEqual(currency_service._nice_step(7.0), 5)
        self.assertEqual(currency_service._nice_step(7.5), 10)
        self.assertEqual(currency_service._nice_step(31), 20)      # KWD (rate 0.31 -> raw 31 -> 20)
        self.assertEqual(currency_service._nice_step(86), 100)     # EUR (rate 0.86 -> raw 86 -> 100)
        self.assertEqual(currency_service._nice_step(139), 100)    # AUD (rate 1.39 -> raw 139 -> 100)
        self.assertEqual(currency_service._nice_step(15425), 20000) # JPY (rate 154.25 -> raw 15425 -> 20,000)
        self.assertEqual(currency_service._nice_step(45000), 50000) # KZT (rate 450 -> raw 45000 -> 50,000)
        self.assertEqual(currency_service._nice_step(1179297), 1000000) # UZS (rate 11793 -> raw 1179297 -> 1,000,000)

        # nice_max guarantees exact multiple of step
        self.assertEqual(currency_service._nice_max(100000, 100), 100000)
        self.assertEqual(currency_service._nice_max(86000, 100), 86000)
        self.assertEqual(currency_service._nice_max(45000000, 50000), 45000000)
        self.assertEqual(currency_service._nice_max(31000, 20), 31000)
        self.assertEqual(currency_service._nice_max(1179297000, 1000000), 1200000000)
        self.assertEqual(1200000000 % 1000000, 0)

    def test_explicit_currency_filter_override(self):
        mock_config = {
            "default": {"min": 0, "max": 100000, "step": 100},
            "KZT": {"step": 10000},  # partial override: step only
            "EUR": {"min": 500, "max": 90000, "step": 50},  # full override
        }
        with patch.object(currency_service, "load_filter_limits_config", return_value=mock_config), patch.object(
            currency_service, "get_rates", return_value={"rates": {"USD": 1.0, "EUR": 0.86, "KZT": 450.0}, "source": "test"}
        ):
            # KZT: explicit step=10000, max dynamically computed to match step
            kzt_limits = currency_service.get_filter_limits("KZT")
            self.assertEqual(kzt_limits["step"], 10000)
            self.assertEqual(kzt_limits["min"], 0)
            self.assertEqual(kzt_limits["max"], 45000000)

            # EUR: full override
            eur_limits = currency_service.get_filter_limits("EUR")
            self.assertEqual(eur_limits["min"], 500)
            self.assertEqual(eur_limits["max"], 90000)
            self.assertEqual(eur_limits["step"], 50)


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
        self.assertEqual(data["filter_limits"]["default"]["max"], 100000)

    def test_get_currency_status_endpoint(self):
        resp = self.client.get("/currency/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("enabled", data)
        self.assertIn("circuit_state", data)
        self.assertIn("source", data)


class CurrencyNormalizationBackendTests(unittest.TestCase):

    def test_filtering_normalizes_native_currency_costs_to_usd(self):
        from app.services.universities import list_universities

        # Tokyo is 2,484,960 JPY (~$16,110 USD)
        # Should be found when filtering with max_tuition=50000 USD
        tokyo_50k = list_universities(q="Tokyo", max_tuition=50000.0)
        self.assertEqual(len(tokyo_50k.get("items", [])), 1)

        # Should NOT be found when filtering with max_tuition=10000 USD
        tokyo_10k = list_universities(q="Tokyo", max_tuition=10000.0)
        self.assertEqual(len(tokyo_10k.get("items", [])), 0)

        # Kyoto is 817,800 JPY (~$5,302 USD) and SNU is 6,034,163 KRW (~$4,486 USD)
        # Both should be found under max_tuition=10000 USD
        kyoto_10k = list_universities(q="Kyoto", max_tuition=10000.0)
        self.assertEqual(len(kyoto_10k.get("items", [])), 1)

        snu_10k = list_universities(q="Seoul", max_tuition=10000.0)
        self.assertEqual(len(snu_10k.get("items", [])), 1)

    def test_sorting_by_tuition_asc_normalizes_cross_currencies(self):
        from app.services.universities import list_universities

        res = list_universities(sort="tuition_asc", limit=20)
        items = res.get("items", [])
        self.assertGreater(len(items), 10)

        # Ensure SNU (6M KRW ~ $4.5k) and Kyoto (817k JPY ~ $5.3k) appear BEFORE
        # universities with $80k+ USD tuition (e.g., Columbia, Yale)
        positions = {}
        for idx, u in enumerate(items):
            positions[u.get("id")] = idx

        if "seoul-national-university-kr-seoul" in positions and "columbia-university-usa-new-york" in positions:
            self.assertLess(
                positions["seoul-national-university-kr-seoul"],
                positions["columbia-university-usa-new-york"],
            )

    def test_roi_normalizes_annual_cost_usd_for_non_usd_universities(self):
        from app.services.universities import get_university_by_id
        from app.services.ai_scoring import estimate_university_roi

        tokyo = get_university_by_id("university-of-tokyo-jp-tokyo")
        self.assertIsNotNone(tokyo)
        roi = estimate_university_roi(tokyo, {"major": "Computer Science"})

        # annual_cost_usd must be converted to USD (~$16,110), NOT raw JPY (2,484,960)
        self.assertLess(roi["annual_cost_usd"], 30000.0)
        self.assertGreater(roi["annual_cost_usd"], 10000.0)


if __name__ == "__main__":
    unittest.main()
