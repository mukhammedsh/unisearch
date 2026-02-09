import copy
import unittest
from unittest.mock import patch

from app.services import universities as uni_service


class UniversityMajorFilterTests(unittest.TestCase):
    @staticmethod
    def _mock_data():
        rows = [
            {
                "id": "u-cs",
                "name": "CS University",
                "location": {"country": "USA", "city": "Cambridge", "state": "MA"},
                "academics": {
                    "programs": [
                        {
                            "name": "Computer Science and Engineering (6-3)",
                            "study_levels": ["Bachelor"],
                            "study_mode": "On-campus",
                        }
                    ]
                },
                "admission_tracks": [],
            },
            {
                "id": "u-biz",
                "name": "Business University",
                "location": {"country": "USA", "city": "Boston", "state": "MA"},
                "academics": {
                    "programs": [
                        {
                            "name": "Business Administration",
                            "study_levels": ["Bachelor"],
                            "study_mode": "On-campus",
                        }
                    ]
                },
                "admission_tracks": [],
            },
        ]

        normalized = [uni_service._normalize_university_schema(copy.deepcopy(x)) for x in rows]
        meta = [uni_service._build_university_meta(x) for x in normalized]
        return normalized, meta

    def test_major_filter_matches_canonical_major_exactly(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(major="Computer Science", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)

    def test_major_filter_does_not_use_substring_only_match(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(major="Science", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual([], ids)

    def test_major_filter_allows_exact_program_name_when_canonical_is_ambiguous(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(
                major="Computer Science and Engineering (6-3)",
                paginate=False,
            )

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)


if __name__ == "__main__":
    unittest.main()
