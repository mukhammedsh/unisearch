import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

import refresh_university_factors as refresh_factors  # noqa: E402


class RefreshUniversityFactorsTests(unittest.TestCase):
    def test_refresh_converts_native_tuition_and_keeps_population_provenance(self):
        university = {
            "id": "sdu",
            "name": "Suleyman Demirel University",
            "location": {"country": "Kazakhstan", "city": "Kaskelen", "state": ""},
            "coordinates": {"lat": 43.208, "lon": 76.67},
            "finance": {"total_cost_year_usd": 1980000, "currency": "KZT"},
        }
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "universities.json"
            data_path.write_text(json.dumps([university]), encoding="utf-8")
            with patch.object(refresh_factors, "UNIVERSITIES_PATH", data_path), patch.object(
                refresh_factors, "_fetch_openalex_institution", return_value=(None, "")
            ), patch.object(refresh_factors, "_fetch_city_population", return_value=(None, "geocode-url")), patch.object(
                refresh_factors, "_fetch_city_population_wikidata", side_effect=AssertionError("official fallback should be used")
            ), patch.object(refresh_factors, "_sleep_between_requests"), patch.object(
                refresh_factors, "convert_currency", return_value=3960.0
            ) as convert_currency:
                refresh_factors.main()

            result = json.loads(data_path.read_text(encoding="utf-8"))[0]

        convert_currency.assert_called_once_with(1980000.0, "KZT", "USD")
        raw = result["factors_meta"]["raw_metrics"]
        self.assertEqual(3960.0, raw["total_cost_year_usd"])
        self.assertIsNone(raw["city"]["population_wikidata_fallback"])
        self.assertEqual(79482.0, raw["city"]["population_official_fallback"])
        self.assertEqual(2021, raw["city"]["population_official_fallback_year"])
        self.assertTrue(result["factors_meta"]["source_urls"]["official_population_fallback"].startswith("https://stat.gov.kz/"))

    def test_unknown_currency_is_not_scored_as_usd(self):
        with patch.object(refresh_factors, "convert_currency", side_effect=ValueError("unknown currency")):
            self.assertIsNone(refresh_factors._tuition_usd({"total_cost_year_usd": 1000, "currency": "XYZ"}))


if __name__ == "__main__":
    unittest.main()
