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
                "admission_tracks": [
                    {
                        "id": "t1",
                        "label": "Grant Track",
                        "funding_type": "grant",
                        "scholarships": [{"name": "Top Talent"}],
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
        self.assertNotIn("admission_tracks", row)

    def test_full_mode_keeps_detailed_payload(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(paginate=False, response_mode="full")

        row = (result.get("items") or [None])[0]
        self.assertIsInstance(row, dict)
        self.assertIn("description", row)
        self.assertIn("admission_tracks", row)


if __name__ == "__main__":
    unittest.main()
