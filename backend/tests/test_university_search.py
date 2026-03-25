import copy
import unittest
from unittest.mock import patch

from app.services import universities as uni_service


class UniversitySearchTests(unittest.TestCase):
    @staticmethod
    def _mock_data():
        rows = [
            {
                "id": "u-cs",
                "name": "Cambridge Tech",
                "location": {"country": "USA", "city": "Cambridge", "state": "MA"},
                "description": "Strong in AI research and robotics labs.",
                "tags": ["research", "robotics", "ai"],
                "academics": {
                    "programs": [
                        {
                            "name": "Computer Science and Engineering",
                            "study_levels": ["Bachelor"],
                            "study_mode": "On-campus",
                        }
                    ]
                },
                "admission_tracks": [],
            },
            {
                "id": "u-biz",
                "name": "Boston Business School",
                "location": {"country": "USA", "city": "Boston", "state": "MA"},
                "description": "Known for entrepreneurship and startup incubators.",
                "tags": ["business", "startups"],
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

    def test_query_matches_location_city(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(q="Boston", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-biz"], ids)

    def test_query_matches_program_tokens(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(q="engineering", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)

    def test_query_matches_description_tokens(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(q="entrepreneurship", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-biz"], ids)

    def test_query_allows_small_typo_for_city(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(q="Cambrdge", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)

    def test_query_matches_russian_city_when_search_lang_is_rus(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(
                q="Бостон",
                paginate=False,
                search_lang="rus",
            )

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-biz"], ids)

    def test_query_matches_russian_major_when_search_lang_is_rus(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(
                q="инженерия",
                paginate=False,
                search_lang="rus",
            )

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)

    def test_query_matches_russian_tag_when_search_lang_is_rus(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(
                q="исследования",
                paginate=False,
                search_lang="rus",
            )

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["u-cs"], ids)

    def test_query_with_russian_text_does_not_match_in_english_mode(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            result = uni_service.list_universities(
                q="Бостон",
                paginate=False,
                search_lang="eng",
            )

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual([], ids)


if __name__ == "__main__":
    unittest.main()
