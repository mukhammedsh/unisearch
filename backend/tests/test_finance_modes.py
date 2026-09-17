"""Unit tests for backend/app/services/finance_modes.py.

Covers:
- mode_breakdown_from_finance: canonical key, missing key, non-dict input
- mode_total_from_finance: canonical key, missing key, negative value, non-dict input
- Removed alternative key names must NOT be resolved
"""
import unittest

from app.services.finance_modes import (
    mode_breakdown_from_finance,
    mode_total_from_finance,
)


class FinanceModeBreakdownTests(unittest.TestCase):
    """Tests for mode_breakdown_from_finance."""

    def test_returns_breakdown_for_canonical_key(self):
        finance = {
            "costs_breakdown_year_usd_by_mode": {
                "online": {"Tuition": 12000},
                "on-campus": {"Tuition": 12000, "Housing_Dorm": 10000},
            }
        }
        result = mode_breakdown_from_finance(finance, "online")
        self.assertEqual(result, {"Tuition": 12000})

    def test_returns_none_when_canonical_key_missing(self):
        finance = {"total_cost_year_usd": 30000}
        self.assertIsNone(mode_breakdown_from_finance(finance, "online"))

    def test_returns_none_for_empty_finance(self):
        self.assertIsNone(mode_breakdown_from_finance({}, "online"))

    def test_returns_none_for_non_dict_finance(self):
        self.assertIsNone(mode_breakdown_from_finance(None, "online"))
        self.assertIsNone(mode_breakdown_from_finance("string", "online"))
        self.assertIsNone(mode_breakdown_from_finance(42, "online"))

    def test_returns_none_when_mode_not_in_map(self):
        finance = {
            "costs_breakdown_year_usd_by_mode": {
                "on-campus": {"Tuition": 12000},
            }
        }
        self.assertIsNone(mode_breakdown_from_finance(finance, "online"))

    def test_returns_none_when_mode_value_is_not_dict(self):
        finance = {
            "costs_breakdown_year_usd_by_mode": {
                "online": 12000,
            }
        }
        self.assertIsNone(mode_breakdown_from_finance(finance, "online"))

    def test_removed_alternative_key_costs_breakdown_by_mode_year_usd(self):
        finance = {
            "costs_breakdown_by_mode_year_usd": {
                "online": {"Tuition": 9000},
            }
        }
        self.assertIsNone(mode_breakdown_from_finance(finance, "online"))

    def test_removed_alternative_key_mode_costs_breakdown_year_usd(self):
        finance = {
            "mode_costs_breakdown_year_usd": {
                "online": {"Tuition": 9000},
            }
        }
        self.assertIsNone(mode_breakdown_from_finance(finance, "online"))


class FinanceModeTotalTests(unittest.TestCase):
    """Tests for mode_total_from_finance."""

    def test_returns_total_for_canonical_key(self):
        finance = {
            "total_cost_year_usd_by_mode": {"online": 17000}
        }
        result = mode_total_from_finance(finance, "online")
        self.assertAlmostEqual(result, 17000.0)

    def test_returns_none_when_canonical_key_missing(self):
        finance = {"total_cost_year_usd": 30000}
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_returns_none_for_empty_finance(self):
        self.assertIsNone(mode_total_from_finance({}, "online"))

    def test_returns_none_for_non_dict_finance(self):
        self.assertIsNone(mode_total_from_finance(None, "online"))
        self.assertIsNone(mode_total_from_finance("string", "online"))

    def test_returns_none_when_mode_not_in_map(self):
        finance = {
            "total_cost_year_usd_by_mode": {"on-campus": 30000}
        }
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_returns_none_for_negative_amount(self):
        finance = {
            "total_cost_year_usd_by_mode": {"online": -5000}
        }
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_returns_zero_for_zero_amount(self):
        finance = {
            "total_cost_year_usd_by_mode": {"online": 0}
        }
        self.assertAlmostEqual(mode_total_from_finance(finance, "online"), 0.0)

    def test_returns_none_for_non_numeric_value(self):
        finance = {
            "total_cost_year_usd_by_mode": {"online": "not-a-number"}
        }
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_removed_alternative_key_total_cost_by_mode_year_usd(self):
        finance = {
            "total_cost_by_mode_year_usd": {"online": 17000}
        }
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_removed_alternative_key_mode_total_cost_year_usd(self):
        finance = {
            "mode_total_cost_year_usd": {"online": 17000}
        }
        self.assertIsNone(mode_total_from_finance(finance, "online"))

    def test_normalizes_study_mode_names(self):
        finance = {
            "total_cost_year_usd_by_mode": {"Online": 17000}
        }
        result = mode_total_from_finance(finance, "distance")
        self.assertAlmostEqual(result, 17000.0)


if __name__ == "__main__":
    unittest.main()
