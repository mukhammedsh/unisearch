import copy
import unittest
from unittest.mock import patch

from app.services import admissions_catalog
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

    def test_funding_type_filter_keeps_reviewed_institutions_with_unknown_legacy_funding(self):
        reviewed = set(admissions_catalog.INSTITUTION_IDS)
        legacy_without_funding = {"technical-university-of-munich-de-munich", "epfl-ch-lausanne"}
        items, meta = uni_service.get_universities_with_meta()
        meta_by_id = {u["id"]: m for u, m in zip(items, meta)}
        for uid in reviewed:
            # Funding lives in the admissions catalog, so legacy choices say nothing: unknown, not "no".
            self.assertIsNone(meta_by_id[uid]["has_grant"])
            self.assertIsNone(meta_by_id[uid]["has_paid"])
        for funding_type in ("grant", "paid"):
            with self.subTest(funding_type=funding_type):
                ids = {row["id"] for row in uni_service.list_universities(funding_type=funding_type, paginate=False)["items"]}
                self.assertTrue(reviewed.issubset(ids))
                self.assertTrue(legacy_without_funding.isdisjoint(ids))
        every_id = {row["id"] for row in uni_service.list_universities(paginate=False)["items"]}
        self.assertTrue(legacy_without_funding.issubset(every_id))

    def test_format_filter_keeps_reviewed_institutions_with_unknown_values(self):
        reviewed = set(admissions_catalog.INSTITUTION_IDS)
        items, meta = uni_service.get_universities_with_meta()
        meta_by_id = {u["id"]: m for u, m in zip(items, meta)}
        unknown_format = {uid for uid in reviewed if not meta_by_id[uid]["formats"]}
        self.assertTrue(unknown_format)

        def ids(**filters):
            return {row["id"] for row in uni_service.list_universities(paginate=False, **filters)["items"]}

        online = ids(format="online")
        self.assertTrue(unknown_format.issubset(online))
        # A reviewed institution that states its format is still excluded when the format differs.
        self.assertTrue(reviewed - unknown_format - online)


if __name__ == "__main__":
    unittest.main()
