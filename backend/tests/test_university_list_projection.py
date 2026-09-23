import copy
import unittest
from unittest.mock import patch

from app.services import universities as uni_service


class UniversityListProjectionTests(unittest.TestCase):
    @staticmethod
    def _mock_data():
        rows = [
            {
                "id": "u-proj",
                "name": "Projection University",
                "rank": 42,
                "website": "https://example.edu",
                "location": {"country": "USA", "city": "Boston", "state": "MA"},
                "coordinates": {"lat": 42.3601, "lon": -71.0589},
                "description": "Long description should not be returned in card mode.",
                "finance": {
                    "total_cost_year_usd": 28000,
                    "total_cost_year_usd_by_mode": {
                        "online": 17000,
                    },
                    "costs_breakdown_year_usd": {
                        "Tuition": 12000,
                        "Housing_Dorm": 11000,
                        "Food": 5000,
                    },
                    "financial_aid": {"merit_based": True, "need_based": False},
                },
                "academics": {
                    "programs": [
                        {
                            "name": "Computer Science",
                            "acceptance_rate_percent": 33,
                            "study_levels": ["Bachelor"],
                            "study_mode": "On-campus",
                        }
                    ]
                },
                "admission_categories": [
                    {
                        "id": "t1",
                        "label": "Grant Track",
                        "requirement_profiles": [
                            {
                                "id": "grant",
                                "label": "Grant",
                                "funding_options": [{"id": "grant", "label": "Grant", "funding_type": "grant"}],
                                "scholarships": [{"name": "Top Talent"}],
                            }
                        ],
                    }
                ],
                "matchData": {"finalScore": 91.2},
            }
        ]

        normalized = [uni_service._normalize_university_schema(copy.deepcopy(x)) for x in rows]
        meta = [uni_service._build_university_meta(x) for x in normalized]
        return normalized, meta

    def test_card_mode_returns_compact_payload(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(paginate=False, response_mode="card")

        row = (result.get("items") or [None])[0]
        self.assertIsInstance(row, dict)
        self.assertEqual("u-proj", row.get("id"))
        self.assertTrue(bool(row.get("aid_any")))
        self.assertIn("matchData", row)
        self.assertIn("location", row)
        self.assertIn("finance", row)
        self.assertIn("academics", row)
        self.assertNotIn("description", row)
        self.assertNotIn("admission_categories", row)

    def test_full_mode_keeps_detailed_payload(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(paginate=False, response_mode="full")

        row = (result.get("items") or [None])[0]
        self.assertIsInstance(row, dict)
        self.assertIn("description", row)
        self.assertIn("admission_categories", row)

    def test_card_mode_uses_tuition_only_cost_for_online_format(self):
        items, meta = self._mock_data()
        row = uni_service.to_university_card(items[0], format_preference="Online")
        self.assertIsInstance(row, dict)
        self.assertAlmostEqual(12000.0, float(((row.get("finance") or {}).get("total_cost_year_usd")) or 0.0), places=6)

    def test_card_mode_online_uses_mode_total_when_tuition_missing(self):
        items, _ = self._mock_data()
        item = copy.deepcopy(items[0])
        item["finance"]["costs_breakdown_year_usd"] = {"Housing_Dorm": 11000, "Food": 5000}
        row = uni_service.to_university_card(item, format_preference="Online")
        self.assertIsInstance(row, dict)
        self.assertAlmostEqual(17000.0, float(((row.get("finance") or {}).get("total_cost_year_usd")) or 0.0), places=6)

    def test_card_mode_online_returns_zero_when_online_price_unknown(self):
        items, _ = self._mock_data()
        item = copy.deepcopy(items[0])
        item["finance"]["costs_breakdown_year_usd"] = {"Housing_Dorm": 11000, "Food": 5000}
        item["finance"]["total_cost_year_usd_by_mode"] = {}
        row = uni_service.to_university_card(item, format_preference="Online")
        self.assertIsInstance(row, dict)
        self.assertIsNone((row.get("finance") or {}).get("total_cost_year_usd"))

    def test_missing_root_cost_stays_null_without_inventing_a_currency(self):
        university = {
            "id": "unpriced-uk-u",
            "name": "Unpriced UK University",
            "location": {"country": "UK"},
            "finance": {"currency": "GBP"},
        }

        card = uni_service.to_university_card(university)
        finance = card.get("finance") or {}

        self.assertIsNone(finance.get("total_cost_year_usd"))
        self.assertEqual("GBP", finance.get("currency"))
        self.assertIsNone(uni_service._effective_university_cost_usd(university))

        no_currency_card = uni_service.to_university_card({"id": "unpriced-u", "finance": {}})
        self.assertIsNone((no_currency_card.get("finance") or {}).get("currency"))

    def test_known_gbp_root_price_keeps_native_value_and_currency(self):
        university = {
            "id": "priced-uk-u",
            "name": "Priced UK University",
            "finance": {"total_cost_year_usd": 38440, "currency": "GBP"},
        }

        card_finance = uni_service.to_university_card(university)["finance"]

        self.assertEqual(38440, card_finance["total_cost_year_usd"])
        self.assertEqual("GBP", card_finance["currency"])
        with patch("app.services.currency.convert", return_value=48050) as convert:
            self.assertEqual(48050, uni_service._effective_university_cost_usd(university))
        convert.assert_called_once_with(38440.0, "GBP", "USD")

    def test_unconvertible_root_price_is_not_projected_as_usd(self):
        university = {
            "id": "unconvertible-uk-u",
            "name": "Unconvertible UK University",
            "finance": {"total_cost_year_usd": 38440, "currency": "ZZZ"},
        }

        with patch("app.services.currency.convert", side_effect=ValueError("unsupported currency")):
            self.assertIsNone(uni_service._effective_university_cost_usd(university))

    def test_unconvertible_range_keeps_native_bounds_and_leaves_usd_unknown(self):
        university = {
            "id": "unconvertible-range-u",
            "finance": {
                "currency": "ZZZ",
                "total_cost_year_min": 1000,
                "total_cost_year_max": 2000,
                "academic_year": "2026-27",
            },
        }

        with patch("app.services.currency.convert", side_effect=ValueError("unsupported currency")):
            cost_range = uni_service.to_university_card(university)["finance"]["total_cost_year_range"]

        self.assertEqual(1000.0, cost_range["min"])
        self.assertEqual(2000.0, cost_range["max"])
        self.assertEqual("ZZZ", cost_range["currency"])
        self.assertIsNone(cost_range["min_usd"])
        self.assertIsNone(cost_range["max_usd"])

    def test_gbp_root_cost_range_stays_a_range_in_card_projection(self):
        university = {
            "id": "range-uk-u",
            "finance": {
                "currency": "GBP",
                "total_cost_year_min": 79855,
                "total_cost_year_max": 86155,
                "academic_year": "2027-28",
                "source_urls": ["https://example.edu/fees"],
            },
        }

        with patch("app.services.currency.convert", side_effect=[107000, 115000]):
            finance = uni_service.to_university_card(university)["finance"]

        self.assertIsNone(finance["total_cost_year_usd"])
        self.assertEqual("GBP", finance["currency"])
        self.assertEqual(
            {
                "min": 79855.0,
                "max": 86155.0,
                "currency": "GBP",
                "min_usd": 107000,
                "max_usd": 115000,
                "academic_year": "2027-28",
                "source_url": None,
                "source_urls": ["https://example.edu/fees"],
            },
            finance["total_cost_year_range"],
        )

    def test_missing_price_sorts_after_known_prices_in_both_directions(self):
        priced = {"id": "priced", "finance": {"total_cost_year_usd": 1000}}
        unpriced = {"id": "unpriced", "finance": {}}

        asc = uni_service._apply_sort([unpriced, priced], "tuition_asc")
        desc = uni_service._apply_sort([unpriced, priced], "tuition_desc")

        self.assertEqual(["priced", "unpriced"], [row["id"] for row in asc])
        self.assertEqual(["priced", "unpriced"], [row["id"] for row in desc])


if __name__ == "__main__":
    unittest.main()
