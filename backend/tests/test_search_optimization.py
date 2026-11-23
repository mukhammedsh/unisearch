import copy
import unittest
from unittest.mock import patch

from app.services import scoring_requirements, universities, university_localization
from app.services import search as search_service


def _reference_osa_distance(s1: str, s2: str) -> int:
    len1, len2 = len(s1), len(s2)
    dp: dict[tuple[int, int], int] = {}
    for i in range(-1, len1 + 1):
        dp[(i, -1)] = i + 1
    for j in range(-1, len2 + 1):
        dp[(-1, j)] = j + 1
    for i in range(len1):
        for j in range(len2):
            cost = 0 if s1[i] == s2[j] else 1
            dp[(i, j)] = min(
                dp[(i - 1, j)] + 1,
                dp[(i, j - 1)] + 1,
                dp[(i - 1, j - 1)] + cost,
            )
            if i > 0 and j > 0 and s1[i] == s2[j - 1] and s1[i - 1] == s2[j]:
                dp[(i, j)] = min(dp[(i, j)], dp[(i - 2, j - 2)] + 1)
    return dp[(len1 - 1, len2 - 1)]


class SearchOptimizationTests(unittest.TestCase):
    def test_damerau_leq_one_and_bounded_distance_match_reference(self):
        pairs = [
            ("", ""),
            ("", "a"),
            ("a", ""),
            ("ab", "ba"),
            ("abc", "acb"),
            ("abc", "cab"),
            ("abcd", "abdc"),
            ("abcd", "acbd"),
            ("stanford", "standford"),
            ("oxford", "oxfrod"),
            ("cambridge", "cambrdge"),
            ("massachusetts", "massachussets"),
            ("harvard", "havard"),
            ("computer", "cmoputer"),
            ("science", "sceince"),
            ("бостон", "бостн"),
            ("инженерия", "инженеряи"),
            ("ab", "abcd"),
            ("abcdef", "abcxyz"),
            ("abcdef", "azcdef"),
            ("abcdef", "azcyef"),
            ("abcdef", "azcyex"),
        ]
        for a, b in pairs:
            ref = _reference_osa_distance(a, b)
            with self.subTest(a=a, b=b, ref=ref):
                self.assertEqual(ref <= 1, search_service._damerau_leq_one(a, b))
                self.assertEqual(ref <= 1, search_service._damerau_leq_one(b, a))
                for limit in (1, 2):
                    bounded = search_service.damerau_levenshtein_distance(a, b, max_dist=limit)
                    if ref <= limit:
                        self.assertEqual(ref, bounded)
                    else:
                        self.assertGreater(bounded, limit)

    def test_indexed_score_prepared_matches_fallback_across_catalog_and_queries(self):
        _, meta_list = universities.get_universities_with_meta()
        test_queries = [
            ("eng", "MIT"),
            ("eng", "nu"),
            ("eng", "cs"),
            ("eng", "Standford"),
            ("eng", "massachussets"),
            ("eng", "Cambrdge"),
            ("eng", "computer science"),
            ("eng", "university in london"),
            ("rus", "массачусетский"),
            ("rus", "инженерные"),
            ("rus", "в бостоне"),
            ("rus", "НУ"),
            ("kaz", "ҚБТУ"),
            ("kaz", "компьютерлік ғылым"),
        ]

        for lang, raw_q in test_queries:
            candidates = university_localization._search_query_candidates(raw_q, search_lang=lang)
            prepared_queries = [pq for q in candidates if (pq := search_service.prepare_query(q))]
            self.assertTrue(prepared_queries, f"No prepared queries for {lang}:{raw_q}")
            for meta_row in meta_list:
                localized_meta = universities._meta_for_search_lang(meta_row, lang)
                pm_fast = search_service.prepare_search_meta(localized_meta)
                pm_legacy = copy.deepcopy(pm_fast)
                pm_legacy.pop("unique_candidates", None)
                pm_legacy.pop("alias_candidates", None)
                for pq_fast in prepared_queries:
                    pq_legacy = {k: v for k, v in pq_fast.items() if k != "core_tokens_set"}
                    self.assertEqual(
                        search_service.score_prepared(pm_fast, pq_fast),
                        search_service.score_prepared(pm_legacy, pq_legacy),
                        f"Mismatch on {meta_row.get('name')} for {lang}:{pq_fast['q_norm']}",
                    )

    def test_admission_choices_cache_invalidates_when_categories_list_is_replaced(self):
        uni_a = {
            "id": "cache-invalidation-test-uni",
            "admission_categories": [
                {
                    "id": "cat1",
                    "label": "First Track",
                    "requirement_profiles": [{"id": "req1", "label": "Track A", "requirements": {"GPA": 3.0}}],
                }
            ],
        }
        uni_b = copy.deepcopy(uni_a)
        uni_b["admission_categories"][0]["label"] = "Updated Track"
        uni_b["admission_categories"][0]["requirement_profiles"][0]["requirements"] = {"GPA": 3.9}

        choices_a = scoring_requirements._get_cached_admission_choices(uni_a, include_funding=True)
        choices_b = scoring_requirements._get_cached_admission_choices(uni_b, include_funding=True)

        self.assertEqual(choices_a[0]["requirements"].get("GPA"), 3.0)
        self.assertEqual(choices_b[0]["requirements"].get("GPA"), 3.9)

    def test_localization_caches_invalidate_when_translation_pack_changes(self):
        pack1 = {
            "admission_exact": {"Regular Decision": "Обычный поток 1"},
            "track_labels": {"early_action": "Ранний поток 1"},
            "program_names": {"computer_science": "Компьютерные науки 1"},
        }
        pack2 = {
            "admission_exact": {"Regular Decision": "Обычный поток 2"},
            "track_labels": {"early_action": "Ранний поток 2"},
            "program_names": {"computer_science": "Компьютерные науки 2"},
        }
        with patch.object(university_localization, "_translation_lang_pack", return_value=pack1):
            self.assertEqual(
                university_localization._translate_admission_text("Regular Decision", "rus"),
                "Обычный поток 1",
            )
            self.assertEqual(
                university_localization._translate_track_label("Early Action", "rus"),
                "Ранний поток 1",
            )
            self.assertIn(
                "computer science",
                university_localization._search_query_candidates("Компьютерные науки 1", search_lang="rus"),
            )

        with patch.object(university_localization, "_translation_lang_pack", return_value=pack2):
            self.assertEqual(
                university_localization._translate_admission_text("Regular Decision", "rus"),
                "Обычный поток 2",
            )
            self.assertEqual(
                university_localization._translate_track_label("Early Action", "rus"),
                "Ранний поток 2",
            )
            self.assertIn(
                "computer science",
                university_localization._search_query_candidates("Компьютерные науки 2", search_lang="rus"),
            )


if __name__ == "__main__":
    unittest.main()
