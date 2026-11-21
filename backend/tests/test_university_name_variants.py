import json
import unittest
from collections import defaultdict

from app.core.paths import UNIVERSITY_NAME_VARIANTS_PATH
from app.services import universities as universities_service

LANGS = ("eng", "rus", "kaz")


def _all_names(entry):
    """Every name of an entry: official names, abbreviations and alternatives in all languages."""
    return [
        name
        for lang in LANGS
        for name in (entry[lang]["official"], *entry[lang]["abbreviations"], *entry[lang]["alternatives"])
    ]


def _entries():
    with open(UNIVERSITY_NAME_VARIANTS_PATH, encoding="utf-8") as handle:
        return json.load(handle)["universities"]


class UniversityNameVariantsDataTests(unittest.TestCase):
    def test_every_catalog_university_has_names_in_all_three_languages(self):
        entries = _entries()
        missing = []
        for university in universities_service.load_universities():
            entry = entries.get(university["id"]) or {}
            if not entry.get("map_label", {}).get("eng") or not all((entry.get(lang) or {}).get("official") for lang in LANGS):
                missing.append(university["id"])
        self.assertEqual(missing, [])

    def test_official_name_is_the_stored_full_name(self):
        entries = _entries()
        rus_names = universities_service._load_localized_university_names("rus")
        kaz_names = universities_service._load_localized_university_names("kaz")
        stored = {
            "eng": {u["id"]: u["name"] for u in universities_service.load_universities()},
            "rus": rus_names,
            "kaz": kaz_names,
        }
        different = []
        for uid, entry in entries.items():
            for lang in LANGS:
                expected = stored[lang].get(uid)
                if expected and " ".join(entry[lang]["official"].split()) != " ".join(expected.split()):
                    different.append((uid, lang, entry[lang]["official"], expected))
        self.assertEqual(different, [])

    def test_fields_are_well_formed(self):
        problems = []
        for uid, entry in _entries().items():
            for lang in LANGS:
                names = entry[lang]
                if set(names) != {"official", "abbreviations", "alternatives"}:
                    problems.append((uid, lang, "keys"))
                    continue
                if not isinstance(names["official"], str) or not names["official"].strip():
                    problems.append((uid, lang, "official"))
                others = [*names["abbreviations"], *names["alternatives"]]
                if any(not isinstance(name, str) or not name.strip() for name in others):
                    problems.append((uid, lang, "blank name"))
                if names["official"] in others:
                    problems.append((uid, lang, "official repeated"))
                if len({name.casefold() for name in others}) != len(others):
                    problems.append((uid, lang, "duplicate"))
        self.assertEqual(problems, [])

    def test_map_labels_are_abbreviations_or_alternatives(self):
        for uid, entry in _entries().items():
            known = {name for lang in LANGS for name in (*entry[lang]["abbreviations"], *entry[lang]["alternatives"])}
            for lang, label in entry["map_label"].items():
                self.assertIn(label, known, f"{uid}: {lang} map label {label!r} is not an abbreviation or alternative")

    def test_no_name_is_shared_between_universities(self):
        owners = defaultdict(set)
        for uid, entry in _entries().items():
            for name in _all_names(entry):
                owners[name.casefold()].add(uid)
        shared = {name: sorted(ids) for name, ids in owners.items() if len(ids) > 1}
        self.assertEqual(shared, {})

    def test_kazakh_map_labels_keep_their_official_source(self):
        for uid, entry in _entries().items():
            if entry["map_label"].get("kaz"):
                source = entry.get("source") or {}
                self.assertTrue(str(source.get("url", "")).startswith("https://"), uid)
                self.assertTrue(source.get("checked"), uid)

    def test_hidden_aliases_hold_every_name_in_every_language(self):
        aliases = universities_service._hidden_search_aliases_for_university(
            {"id": "kazakhstan-british-technical-university-kaz-almaty"}
        )
        self.assertEqual(
            aliases,
            [
                "Kazakhstan-British Technical University",
                "KBTU",
                "Kazakh-British Technical University",
                "Казахстанско-Британский технический университет",
                "КБТУ",
                "Казахско-Британский технический университет",
                "Қазақ-Британ техникалық университеті",
                "ҚБТУ",
            ],
        )

    def test_abbreviations_are_listed_apart_from_other_names(self):
        university = {"id": "kazakhstan-british-technical-university-kaz-almaty"}
        self.assertEqual(universities_service._abbreviations_for_university(university), ["KBTU", "КБТУ", "ҚБТУ"])
        card = universities_service.to_university_card(
            universities_service._normalize_university_schema(
                {
                    "id": "astana-it-university-kaz-astana",
                    "name": "Astana IT University",
                    "location": {"country": "Kazakhstan", "city": "Astana", "state": ""},
                    "academics": {"programs": []},
                    "admission_categories": [],
                }
            )
        )
        self.assertEqual(card["abbreviations"], ["aitu", "аиту"])
        self.assertIn("astana it university", card["search_aliases"])

    def test_unlisted_university_falls_back_to_its_stored_name(self):
        self.assertEqual(universities_service._hidden_search_aliases_for_university({"id": "not-listed"}), [])
        self.assertEqual(universities_service._full_name_from_variants("not-listed", "eng", "Stored Name"), "Stored Name")


class UniversityNameVariantsSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        items, metas = universities_service.get_universities_with_meta()
        cls.items = items
        cls.pairs = list(zip(items, metas))

    def _top(self, query, lang):
        _, scores = universities_service._filter_by_search_query(self.pairs, query, lang)
        return max(scores, key=scores.get) if scores else None

    def test_every_map_label_finds_its_university_first(self):
        entries = _entries()
        wrong = []
        for university in self.items:
            for lang, label in entries[university["id"]]["map_label"].items():
                _, scores = universities_service._filter_by_search_query(self.pairs, label, lang)
                own = scores.get(university["id"])
                if own is None or any(score >= own for uid, score in scores.items() if uid != university["id"]):
                    wrong.append((label, lang, university["id"]))
        self.assertEqual(wrong, [])

    def test_names_in_other_languages_match_whatever_the_interface_language(self):
        kbtu = "kazakhstan-british-technical-university-kaz-almaty"
        self.assertEqual(self._top("КБТУ", "eng"), kbtu)
        self.assertEqual(self._top("ҚБТУ", "rus"), kbtu)
        self.assertEqual(self._top("Kazakh-British Technical University", "kaz"), kbtu)

    def test_alternate_full_names_find_the_university(self):
        self.assertEqual(
            self._top("École Polytechnique Fédérale de Lausanne", "eng"), "epfl-ch-lausanne"
        )
        self.assertEqual(
            self._top("Массачусетский институт технологий", "rus"), "mit-usa-cambridge"
        )
        self.assertEqual(
            self._top("Төрегелді Шарманов атындағы Ұлттық медицина университеті", "kaz"),
            "astana-medical-university-kaz-astana",
        )

    def test_search_uses_the_name_lists_not_the_stored_name(self):
        entries = _entries()
        changed = json.loads(json.dumps(entries))
        changed["mit-usa-cambridge"]["eng"]["alternatives"].append("Zzyzx Polytechnic")
        universities_service._NAME_VARIANTS_CACHE["data"] = changed
        try:
            meta = universities_service._build_university_meta({"id": "mit-usa-cambridge", "name": "Massachusetts Institute of Technology"})
        finally:
            universities_service._NAME_VARIANTS_CACHE["mtime"] = None
        self.assertIn("zzyzx polytechnic", meta["search_aliases"])


if __name__ == "__main__":
    unittest.main()
