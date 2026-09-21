import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers import universities as universities_router
from app.services import universities as universities_service


class UniversityMapPointsTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_map_points_return_compact_items_inside_requested_bounds(self):
        map_items = [
            {
                "id": "inside-university",
                "name": "Inside University",
                "rank": 10,
                "location": {"country": "USA", "city": "Boston"},
                "coordinates": {"lat": 42.36, "lon": -71.06},
            },
            {
                "id": "outside-university",
                "name": "Outside University",
                "rank": 20,
                "location": {"country": "USA", "city": "Seattle"},
                "coordinates": {"lat": 47.61, "lon": -122.33},
            },
        ]

        with patch.object(
            universities_router.uni_service,
            "list_universities",
            return_value={"items": map_items},
        ) as list_universities, patch.object(
            universities_router, "cache_get_json", return_value=None
        ), patch.object(universities_router, "cache_set_json"):
            response = self.client.get(
                "/universities/map-points",
                params={"west": -72, "south": 41, "east": -70, "north": 43},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.json()["items"]], ["inside-university"])
        self.assertEqual(response.json()["total"], 1)
        self.assertFalse(response.json()["truncated"])
        self.assertFalse(list_universities.call_args.kwargs["paginate"])
        self.assertEqual(list_universities.call_args.kwargs["response_mode"], "map")

    def test_map_projection_excludes_card_and_detail_fields(self):
        projected = universities_service.to_university_map_point({
            "id": "compact-university",
            "name": "Compact University",
            "rank": 12,
            "location": {"country": "USA", "city": "Boston", "state": "Massachusetts"},
            "coordinates": {"lat": "42.36", "lon": "-71.06"},
            "finance": {"total_cost_year_usd": 99_999},
            "programs": [{"name": "Computer Science"}],
            "description": "A field that must not be sent for every map marker.",
        })

        self.assertEqual(
            projected,
            {
                "id": "compact-university",
                "name": "Compact University",
                "rank": 12,
                "location": {"country": "USA", "city": "Boston"},
                "coordinates": {"lat": 42.36, "lon": -71.06},
            },
        )


if __name__ == "__main__":
    unittest.main()
