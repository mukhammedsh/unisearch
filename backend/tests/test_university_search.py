import copy
import unittest
from unittest.mock import patch

from app.services import search as search_service
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
                "admission_categories": [],
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
                "admission_categories": [],
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

    def test_query_matches_hidden_university_alias(self):
        rows = [
            {
                "id": "nazarbayev-university-kaz-astana",
                "name": "Nazarbayev University",
                "location": {"country": "Kazakhstan", "city": "Astana", "state": ""},
                "description": "Public research university in Astana.",
                "tags": ["research", "engineering"],
                "academics": {"programs": []},
                "admission_categories": [],
            }
        ]

        normalized = [uni_service._normalize_university_schema(copy.deepcopy(x)) for x in rows]
        meta = [uni_service._build_university_meta(x) for x in normalized]
        with patch("app.services.universities.get_universities_with_meta", return_value=(normalized, meta)):
            result = uni_service.list_universities(q="NU", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["nazarbayev-university-kaz-astana"], ids)

    def test_query_matches_aitu_hidden_alias(self):
        rows = [
            {
                "id": "astana-it-university-kaz-astana",
                "name": "Astana IT University",
                "location": {"country": "Kazakhstan", "city": "Astana", "state": ""},
                "description": "University focused on digital education.",
                "tags": ["ict", "computer science"],
                "academics": {"programs": []},
                "admission_categories": [],
            }
        ]

        normalized = [uni_service._normalize_university_schema(copy.deepcopy(x)) for x in rows]
        meta = [uni_service._build_university_meta(x) for x in normalized]
        with patch("app.services.universities.get_universities_with_meta", return_value=(normalized, meta)):
            result = uni_service.list_universities(q="AITU", paginate=False)

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["astana-it-university-kaz-astana"], ids)

    def test_card_projection_keeps_aitu_hidden_alias(self):
        row = uni_service._normalize_university_schema(
            {
                "id": "astana-it-university-kaz-astana",
                "name": "Astana IT University",
                "location": {"country": "Kazakhstan", "city": "Astana", "state": ""},
                "academics": {"programs": []},
                "admission_categories": [],
            }
        )

        card = uni_service.to_university_card(row)

        self.assertIn("aitu", card.get("search_aliases", []))

    def test_query_matches_hidden_university_alias_in_russian(self):
        rows = [
            {
                "id": "nazarbayev-university-kaz-astana",
                "name": "Nazarbayev University",
                "location": {"country": "Kazakhstan", "city": "Astana", "state": ""},
                "description": "Public research university in Astana.",
                "tags": ["research", "engineering"],
                "academics": {"programs": []},
                "admission_categories": [],
            }
        ]

        normalized = [uni_service._normalize_university_schema(copy.deepcopy(x)) for x in rows]
        meta = [uni_service._build_university_meta(x) for x in normalized]
        with patch("app.services.universities.get_universities_with_meta", return_value=(normalized, meta)):
            result = uni_service.list_universities(q="НУ", paginate=False, search_lang="rus")

        ids = [x.get("id") for x in result.get("items", [])]
        self.assertEqual(["nazarbayev-university-kaz-astana"], ids)

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

    def test_edit_distance_allows_single_missing_character(self):
        self.assertTrue(search_service._edit_distance_leq_one("cambridge", "cambrdge"))

    def test_edit_distance_rejects_transposition(self):
        self.assertFalse(search_service._edit_distance_leq_one("ab", "ba"))

    def test_get_university_gpa_extracts_minimum_requirement_not_stats_avg(self):
        # University with only requirements.GPA
        u_req = {
            "id": "u-req",
            "name": "Req University",
            "admission_categories": [
                {
                    "id": "regular",
                    "requirement_profiles": [
                        {"id": "sat_track", "requirements": {"GPA": 3.4, "SAT": 1300}},
                        {"id": "act_track", "requirements": {"GPA": 3.4, "ACT": 29}},
                    ],
                }
            ],
        }
        self.assertEqual(uni_service._get_university_gpa(u_req), 3.4)

        # University with only stats_avg.GPA (admitted average stats, not minimum requirements)
        u_avg_only = {
            "id": "u-avg",
            "name": "Avg Only University",
            "admission_categories": [
                {
                    "id": "regular",
                    "requirement_profiles": [
                        {"id": "holistic", "requirements": {"SAT": 1400}, "stats_avg": {"GPA": 3.9}},
                    ],
                }
            ],
        }
        self.assertIsNone(uni_service._get_university_gpa(u_avg_only))

        # University with both: ensure requirements.GPA is extracted, not stats_avg.GPA
        u_both = {
            "id": "u-both",
            "name": "Both University",
            "admission_categories": [
                {
                    "id": "regular",
                    "requirement_profiles": [
                        {"id": "profile1", "requirements": {"GPA": 3.52}, "stats_avg": {"GPA": 3.8}},
                    ],
                }
            ],
        }
        self.assertEqual(uni_service._get_university_gpa(u_both), 3.52)

        # University without GPA
        u_none = {"id": "u-none", "name": "No GPA Uni", "admission_categories": []}
        self.assertIsNone(uni_service._get_university_gpa(u_none))

    def test_get_university_gpa_direct_and_category_level_fallbacks(self):
        self.assertEqual(uni_service._get_university_gpa({"requirements": {"GPA": 3.65}}), 3.65)
        self.assertEqual(
            uni_service._get_university_gpa(
                {"admission_categories": [{"id": "cat1", "requirements": {"GPA": 3.3}}]}
            ),
            3.3,
        )

    def test_get_university_gpa_multiple_tracks_returns_maximum_track_requirement(self):
        # University with multiple admission tracks having different minimum GPA requirements
        u_multitrack = {
            "id": "u-multi",
            "name": "Multi Track University",
            "admission_categories": [
                {
                    "id": "regular",
                    "requirement_profiles": [
                        {"id": "foundation_track", "requirements": {"GPA": 3.0, "IELTS": 6.0}},
                        {"id": "standard_track", "requirements": {"GPA": 3.4, "SAT": 1250}},
                        {"id": "honors_track", "requirements": {"GPA": 3.8, "SAT": 1450}},
                    ],
                }
            ],
        }
        # Pins behavior: returns max(vals) as the highest minimum required GPA among tracks
        self.assertEqual(uni_service._get_university_gpa(u_multitrack), 3.8)

    def test_sort_gpa_desc_orders_descending_and_puts_missing_last(self):
        items = [
            {"id": "u-none-b", "name": "Beta No GPA", "admission_categories": []},
            {
                "id": "u-med",
                "name": "Medium GPA Uni",
                "admission_categories": [
                    {"requirement_profiles": [{"requirements": {"GPA": 3.5}}]}
                ],
            },
            {
                "id": "u-high-b",
                "name": "Bravo High GPA Uni",
                "admission_categories": [
                    {"requirement_profiles": [{"requirements": {"GPA": 3.9}}]}
                ],
            },
            {"id": "u-none-a", "name": "Alpha No GPA", "admission_categories": []},
            {
                "id": "u-high-a",
                "name": "Alpha High GPA Uni",
                "admission_categories": [
                    {"requirement_profiles": [{"requirements": {"GPA": 3.9}}]}
                ],
            },
            {
                "id": "u-low",
                "name": "Low GPA Uni",
                "admission_categories": [
                    {"requirement_profiles": [{"requirements": {"GPA": 3.2}}]}
                ],
            },
        ]
        sorted_items = uni_service._apply_sort(items, sort="gpa_desc")
        sorted_ids = [x["id"] for x in sorted_items]
        # High GPA (3.9) tie-broken by name: Alpha (3.9) before Bravo (3.9)
        # Then Medium (3.5), then Low (3.2)
        # Then missing GPA tie-broken by name: Alpha No GPA before Beta No GPA
        expected_ids = [
            "u-high-a",
            "u-high-b",
            "u-med",
            "u-low",
            "u-none-a",
            "u-none-b",
        ]
        self.assertEqual(sorted_ids, expected_ids)

    def test_sort_gpa_desc_with_real_dataset(self):
        result = uni_service.list_universities(sort="gpa_desc", limit=50, paginate=False)
        items = result.get("items", [])
        self.assertGreater(len(items), 0)

        # Extract GPAs for items that have them
        all_raw = uni_service.load_universities()
        raw_by_id = {u["id"]: u for u in all_raw}

        gpas = [uni_service._get_university_gpa(raw_by_id.get(item["id"], {})) for item in items]

        # Check non-None GPAs come first and are strictly non-increasing
        present_gpas = [g for g in gpas if g is not None]
        none_gpas = [g for g in gpas if g is None]

        self.assertGreater(len(present_gpas), 0)
        self.assertGreater(len(none_gpas), 0)

        # Verify non-None appear before all None
        first_none_idx = gpas.index(None)
        last_present_idx = len(present_gpas) - 1
        self.assertEqual(first_none_idx, last_present_idx + 1)

        # Verify descending order
        for i in range(len(present_gpas) - 1):
            self.assertGreaterEqual(present_gpas[i], present_gpas[i + 1])

    def test_query_mit_exact_alias_ranks_top_without_substring_pollution(self):
        result = uni_service.list_universities(q="MIT", paginate=False)
        items = result.get("items", [])
        self.assertGreater(len(items), 0)
        self.assertEqual("mit-usa-cambridge", items[0].get("id"))
        ids = [x.get("id") for x in items]
        self.assertNotIn("kyoto-university-jp-kyoto", ids)
        self.assertNotIn("stanford-university-usa-ca", ids)

    def test_query_nu_exact_alias_ranks_nazarbayev_first(self):
        result = uni_service.list_universities(q="НУ", search_lang="rus", paginate=False)
        items = result.get("items", [])
        self.assertGreater(len(items), 0)
        self.assertEqual("nazarbayev-university-kaz-astana", items[0].get("id"))

    def test_query_russian_morphology_inflected_location_and_major(self):
        items, meta = self._mock_data()
        with patch("app.services.universities.get_universities_with_meta", return_value=(items, meta)):
            res_city = uni_service.list_universities(q="в Бостоне", search_lang="rus", paginate=False)
            self.assertEqual(["u-biz"], [x.get("id") for x in res_city.get("items", [])])

            res_major = uni_service.list_universities(q="инженерные", search_lang="rus", paginate=False)
            self.assertEqual(["u-cs"], [x.get("id") for x in res_major.get("items", [])])

    def test_query_keyboard_layout_flipping(self):
        result_stanford = uni_service.list_universities(q="cnfyajhl", paginate=False)
        self.assertEqual("stanford-university-usa-ca", result_stanford.get("items", [])[0].get("id"))

        result_mit = uni_service.list_universities(q="vbn", search_lang="rus", paginate=False)
        self.assertEqual("mit-usa-cambridge", result_mit.get("items", [])[0].get("id"))

    def test_query_multi_token_with_domain_synonyms_and_stop_words(self):
        result = uni_service.list_universities(q="вузы в лондоне", search_lang="rus", paginate=False)
        items = result.get("items", [])
        self.assertGreater(len(items), 0)
        self.assertEqual("imperial-college-london-uk", items[0].get("id"))

    def test_query_typo_tolerance_damerau_levenshtein(self):
        res_standford = uni_service.list_universities(q="standford", paginate=False)
        self.assertEqual("stanford-university-usa-ca", res_standford.get("items", [])[0].get("id"))

        res_havard = uni_service.list_universities(q="havard", paginate=False)
        self.assertEqual("harvard-usa-cambridge", res_havard.get("items", [])[0].get("id"))

        res_massachussets = uni_service.list_universities(q="massachussets", paginate=False)
        self.assertEqual("mit-usa-cambridge", res_massachussets.get("items", [])[0].get("id"))

    def test_explicit_sort_relevance_endpoint_validation(self):
        result = uni_service.list_universities(q="Oxford", sort="relevance", paginate=False)
        items = result.get("items", [])
        self.assertEqual(["university-of-oxford-uk-oxford"], [x.get("id") for x in items])


if __name__ == "__main__":
    unittest.main()
