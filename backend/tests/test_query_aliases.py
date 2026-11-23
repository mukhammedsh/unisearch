import unittest

from app.services import admissions_catalog as catalog
from app.services import universities as uni_service
from app.services.query_aliases import MAX_WORD_MATCHES, word_alias_candidates


class WordAliasCandidateTests(unittest.TestCase):
    ALIASES = {
        "вычислительные системы": "computing",
        "вычислительная биология": "computational biology",
        "информатика": "computer science",
    }

    def test_single_word_of_a_translated_name_finds_the_source_name(self):
        self.assertEqual(["computing", "computational biology"], word_alias_candidates("вычислительные", self.ALIASES))

    def test_every_typed_word_must_match_and_endings_are_tolerated(self):
        self.assertEqual(["computing"], word_alias_candidates("вычислительные системы", {**self.ALIASES, "вычислительные системы данных": "computing"}))
        self.assertEqual(["computing"], word_alias_candidates("вычислительн систем", self.ALIASES))
        self.assertEqual(["computational biology"], word_alias_candidates("вычислительные биология", self.ALIASES))
        self.assertEqual([], word_alias_candidates("вычислительные химия", self.ALIASES))

    def test_short_words_and_the_exact_phrase_are_left_to_the_existing_lookup(self):
        self.assertEqual([], word_alias_candidates("для", {"наука для всех": "science"}))
        self.assertEqual([], word_alias_candidates("информатика", self.ALIASES))
        self.assertEqual([], word_alias_candidates("", self.ALIASES))

    def test_matches_are_bounded(self):
        aliases = {f"вычислительные раздел{index}": f"name {index}" for index in range(MAX_WORD_MATCHES + 5)}
        self.assertEqual(MAX_WORD_MATCHES, len(word_alias_candidates("вычислительные", aliases)))


class RussianProgramSearchTests(unittest.TestCase):
    @staticmethod
    def titles(institution_id, query):
        candidates = uni_service._search_query_candidates(query, search_lang="rus", match_name_words=True)
        result = catalog.list_study_options(institution_id, search_candidates=candidates, limit=200)
        return result["total"], {row["id"] for row in result["items"]}

    def test_one_word_of_a_translated_program_name_matches_like_the_full_name(self):
        for institution_id in ("mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca",
                               "nazarbayev-university-kaz-astana"):
            full_total, full_ids = self.titles(institution_id, "Вычислительные системы")
            word_total, word_ids = self.titles(institution_id, "Вычислительные")
            self.assertGreater(full_total, 0, institution_id)
            self.assertTrue(full_ids <= word_ids, institution_id)
            self.assertGreaterEqual(word_total, full_total)

    def test_university_search_does_not_widen_by_name_words(self):
        # Only the program search opts in; the university search keeps its exact phrase and token lookup.
        self.assertEqual(["Вычислительные", "dsxbckbntkmyst"], uni_service._search_query_candidates("Вычислительные", search_lang="rus"))

    def test_unrelated_word_still_finds_nothing(self):
        self.assertEqual(0, self.titles("mit-usa-cambridge", "Кулинарные")[0])


if __name__ == "__main__":
    unittest.main()
