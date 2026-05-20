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
        self.assertAlmostEqual(0.0, float(((row.get("finance") or {}).get("total_cost_year_usd")) or 0.0), places=6)


if __name__ == "__main__":
    unittest.main()
