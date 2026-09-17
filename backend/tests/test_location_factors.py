"""Regression tests for location factor consolidation (TASK-07 / BC-008).

Verifies:
1. Dataset contains only canonical `city_vs_campus` and no `city_vs_outside_city`.
2. Backend _extract_university_factors reads `city_vs_campus`.
3. Legacy `city_vs_outside_city` is not read as fallback.
4. Missing value falls back to population metadata per contract.
5. Numeric factor normalization clamping [0, 1] preserved.
6. Other factors remain unchanged and correct.
7. AI sort correctly utilizes `city_vs_campus` slider.
8. Data generator script does not generate `city_vs_outside_city`.
"""
import json
from pathlib import Path
import unittest

from app.services.ai_scoring import (
    _extract_university_factors,
    _fallback_city_vs_outside_city,
    sort_universities_ai,
)


class LocationFactorsConsolidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data_path = Path(__file__).resolve().parents[1] / "data" / "universities.json"
        with open(data_path, "r", encoding="utf-8") as f:
            cls.universities = json.load(f)

    def test_dataset_contains_only_canonical_location_key(self):
        """1 & 8: Data migration check — all records have city_vs_campus and none have city_vs_outside_city."""
        self.assertGreater(len(self.universities), 0)
        for u in self.universities:
            factors = u.get("factors")
            self.assertIsInstance(factors, dict, f"University {u.get('id')} has invalid factors")
            self.assertIn("city_vs_campus", factors, f"University {u.get('id')} missing canonical city_vs_campus")
            self.assertNotIn(
                "city_vs_outside_city",
                factors,
                f"University {u.get('id')} still contains legacy city_vs_outside_city",
            )
            self.assertEqual(
                set(factors.keys()),
                {"practice_vs_science", "social_vs_hardcore", "budget_vs_prestige", "city_vs_campus"},
            )

    def test_backend_reads_canonical_city_vs_campus(self):
        """2: Backend directly reads canonical city_vs_campus value."""
        uni = {
            "id": "u-test-loc-1",
            "factors": {
                "practice_vs_science": 0.7,
                "social_vs_hardcore": 0.6,
                "budget_vs_prestige": 0.5,
                "city_vs_campus": 0.85,
            },
        }
        res = _extract_university_factors(uni)
        self.assertAlmostEqual(res["city_vs_campus"], 0.85)

    def test_legacy_key_not_used_as_fallback(self):
        """3: If city_vs_campus is missing, city_vs_outside_city is NOT read as fallback."""
        uni = {
            "id": "u-test-legacy-no-fallback",
            "factors": {
                "practice_vs_science": 0.5,
                "social_vs_hardcore": 0.5,
                "budget_vs_prestige": 0.5,
                "city_vs_outside_city": 0.85,  # legacy key only
            },
        }
        res = _extract_university_factors(uni)
        # Without metadata, fallback defaults to 0.5, NOT the legacy value 0.85
        self.assertAlmostEqual(res["city_vs_campus"], 0.5)
        self.assertNotEqual(res["city_vs_campus"], 0.85)

    def test_missing_location_factor_falls_back_to_population_metadata(self):
        """4: Missing location factor falls back to population metadata calculation."""
        uni = {
            "id": "u-test-pop-fallback",
            "factors": {},
            "factors_meta": {
                "raw_metrics": {
                    "city": {
                        "population": 5_000_000,
                    }
                }
            },
        }
        res = _extract_university_factors(uni)
        expected = _fallback_city_vs_outside_city(uni)
        self.assertAlmostEqual(res["city_vs_campus"], expected)

    def test_numeric_factor_normalization_preserved(self):
        """5: Factor clamping to [0, 1] and percentage conversion remain intact."""
        uni_pct = {"id": "u-test-pct", "factors": {"city_vs_campus": 85}}  # 85 -> 0.85
        uni_low = {"id": "u-test-low", "factors": {"city_vs_campus": -0.5}}
        uni_str = {"id": "u-test-str", "factors": {"city_vs_campus": "0.33"}}

        self.assertAlmostEqual(_extract_university_factors(uni_pct)["city_vs_campus"], 0.85)
        self.assertAlmostEqual(_extract_university_factors(uni_low)["city_vs_campus"], 0.0)
        self.assertAlmostEqual(_extract_university_factors(uni_str)["city_vs_campus"], 0.33)

    def test_other_factors_remain_unchanged(self):
        """7: Other factors (practice_vs_science, social_vs_hardcore, budget_vs_prestige) preserved."""
        uni = {
            "id": "u-test-all-factors",
            "factors": {
                "practice_vs_science": 0.25,
                "social_vs_hardcore": 0.65,
                "budget_vs_prestige": 0.80,
                "city_vs_campus": 0.40,
            },
        }
        res = _extract_university_factors(uni)
        self.assertAlmostEqual(res["practice_vs_science"], 0.25)
        self.assertAlmostEqual(res["social_vs_hardcore"], 0.65)
        self.assertAlmostEqual(res["budget_vs_prestige"], 0.80)
        self.assertAlmostEqual(res["city_vs_campus"], 0.40)

    def test_ai_sort_uses_canonical_city_vs_campus_slider(self):
        """6: AI sort scoring honors city_vs_campus preferences."""
        items = [
            {
                "id": "u-city-life",
                "name": "City Life University",
                "rank": 50,
                "finance": {"total_cost_year_usd": 20000},
                "academics": {"acceptance_rate_percent": 50},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.1,  # Strong city preference
                },
            },
            {
                "id": "u-campus-life",
                "name": "Campus Life University",
                "rank": 50,
                "finance": {"total_cost_year_usd": 20000},
                "academics": {"acceptance_rate_percent": 50},
                "factors": {
                    "practice_vs_science": 0.5,
                    "social_vs_hardcore": 0.5,
                    "budget_vs_prestige": 0.5,
                    "city_vs_campus": 0.9,  # Strong campus / outside-city preference
                },
            },
        ]
        # Slider at 0 (city): city-life uni should rank higher
        city_pref = sort_universities_ai(items, city_vs_campus=0)
        self.assertEqual(city_pref[0]["id"], "u-city-life")

        # Slider at 100 (campus): campus-life uni should rank higher
        campus_pref = sort_universities_ai(items, city_vs_campus=100)
        self.assertEqual(campus_pref[0]["id"], "u-campus-life")

    def test_refresh_factors_script_source_has_no_legacy_key(self):
        """8: Generator script source code does not reference city_vs_outside_city."""
        script_path = Path(__file__).resolve().parents[1] / "scripts" / "refresh_university_factors.py"
        source = script_path.read_text(encoding="utf-8")
        self.assertNotIn("city_vs_outside_city", source)
        self.assertIn('"city_vs_campus": location_factor', source)


if __name__ == "__main__":
    unittest.main()
