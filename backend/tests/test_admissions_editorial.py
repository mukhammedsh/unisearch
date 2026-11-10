import collections
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.paths import DATA_DIR
from app.main import app
from app.services import admissions_editorial, universities as university_service

NU = "nazarbayev-university-kaz-astana"
NOTES = json.loads(admissions_editorial.EDITORIAL_NOTES_PATH.read_text(encoding="utf-8"))
# Maintainer-voice clause openings. A match must be either a listed note or a reviewed kept clause.
DIRECTIVE = re.compile(r"^(?:and |but |so )?(?:do not|don't|never |retain|retains|retained as|preserve|preserves|preserved"
                       r"|keep |record |mark |label |display |present |show |avoid |reconcile |model |map |seek |show both"
                       r"|treat |until resolved|rather than (?:carry|silent|copy))", re.I)
# Unambiguous research-process markers ("reviewed 2026-10-01; no entry year inferred", "packet B", "selector").
RESEARCH_MARKERS = re.compile(r"\b(packet [a-c]|dossier|runtime|selectors?|inferred|provenance|snapshot|researched)\b", re.I)
SKIPPED_KEYS = {"provenance", "id", "source_ids", "url", "sources", "inputs", "supporting_records",
                "historical_provenance", "dossier_metadata"}


def catalog_strings():
    catalog = json.loads((DATA_DIR / "admissions" / "catalog.json").read_text(encoding="utf-8"))

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key not in SKIPPED_KEYS and key not in admissions_editorial.OFFICIAL_TEXT_KEYS:
                    yield from walk(item)
        elif isinstance(value, list):
            for item in value:
                yield from walk(item)
        elif isinstance(value, str):
            yield value

    for institution in catalog["institutions"]:
        for collection in ("facts", "unknowns", "study_options", "application_routes", "organization"):
            yield from walk(institution[collection])


def json_strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from json_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from json_strings(item)
    elif isinstance(value, str):
        yield value


def pack_strings(language):
    pack = json.loads((DATA_DIR / "universities_translations.json").read_text(encoding="utf-8"))["languages"][language]
    return set(pack["admission_exact"].values()) | {text for sections in pack["admission_summaries"].values() for text in sections.values()
                                                    if isinstance(text, str)}


IDENTIFIER = re.compile(r"[A-Za-z]+(?:-[A-Za-z0-9]+){2,}")
NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def numbers(text):
    return sorted(NUMBER.findall(IDENTIFIER.sub("", text)))


def rewrite_blob(strings):
    # One text per sentence start, so patterns anchored on a sentence opener behave as on separate strings.
    return "\n. ".join(sorted(strings))


class AdmissionsEditorialRewriteTests(unittest.TestCase):
    def rule(self, **entry):
        return admissions_editorial.Rewrite(entry)

    def test_literal_rewrite_is_not_read_as_a_regex_template(self):
        rewrite = self.rule(phrase="Do not infer (see note)", replace=r"Check the \1 note \u1")
        self.assertEqual(admissions_editorial.rewrite_text("Do not infer (see note) now", (rewrite,)), r"Check the \1 note \u1 now")

    def test_pattern_rewrite_uses_groups_and_capitalises_a_removed_opener(self):
        rules = (self.rule(pattern=r"(^|[.] )Reviewed (\S)", replace=r"\1\u2"), self.rule(pattern=r"\bthe reviewed (\w+)", replace=r"the \1"))
        self.assertEqual(admissions_editorial.rewrite_text("Reviewed pages are silent. Reviewed forms differ in the reviewed page.", rules),
                         "Pages are silent. Forms differ in the page.")
        unchanged = "Nothing to edit here."
        self.assertIs(admissions_editorial.rewrite_text(unchanged, rules), unchanged)

    def test_invalid_rewrites_are_rejected(self):
        for entry in ({"replace": "x"}, {"phrase": "a", "pattern": "b", "replace": "x"}, {"phrase": "a"},
                      {"pattern": r"(a)", "replace": r"\2"}, {"pattern": "(", "replace": "x"}):
            with self.assertRaises((ValueError, KeyError, re.error), msg=entry):
                self.rule(**entry)

    def test_payload_rewrites_text_but_not_official_wording_or_ids(self):
        rewrite = self.rule(phrase="the reviewed pages do not establish", replace="the pages do not say")
        payload = {"value": {"note": "Here the reviewed pages do not establish a fee.",
                                                                       "source_content": "Official: the reviewed pages do not establish a fee."},
                   "conditions": ["the reviewed pages do not establish"], "amount": 12}
        edited = admissions_editorial.strip_payload(payload, frozenset(), (rewrite,))
        self.assertEqual(edited["value"], {"note": "Here the pages do not say a fee.", "source_content": "Official: the reviewed pages do not establish a fee."})
        self.assertEqual((edited["conditions"], edited["amount"]), (["the pages do not say"], 12))
        # Listed clauses are dropped before rewrites run.
        self.assertEqual(admissions_editorial.strip_payload("keep. drop me", frozenset({"drop me"}), (rewrite,)), "keep.")

    def test_every_rewrite_still_changes_applicant_text(self):
        notes = json.loads(admissions_editorial.EDITORIAL_NOTES_PATH.read_text(encoding="utf-8"))
        assessments = json.loads((DATA_DIR / "admissions" / "assessments.json").read_text(encoding="utf-8"))
        sources = {
            "eng": {admissions_editorial.strip_text(text, frozenset(notes["clauses"]["eng"]))
                    for text in {*catalog_strings(), *json_strings(assessments)}},
            "rus": {admissions_editorial.strip_text(text, frozenset(notes["clauses"]["rus"])) for text in pack_strings("rus")},
            "kaz": {admissions_editorial.strip_text(text, frozenset(notes["clauses"]["kaz"])) for text in pack_strings("kaz")},
        }
        for language, rewrites in admissions_editorial.load_rewrites().items():
            blob = rewrite_blob(sources[language])
            stale = []
            for rewrite in rewrites:
                updated = rewrite.apply(blob)
                if updated == blob:
                    stale.append(rewrite.source)
                blob = updated
            # A rewrite is stale when earlier rewrites already consumed its source or the source text left the data.
            self.assertEqual(stale, [], f"Remove or update stale {language} rewrites")

    def test_rewrites_keep_numbers_dates_and_amounts(self):
        notes = json.loads(admissions_editorial.EDITORIAL_NOTES_PATH.read_text(encoding="utf-8"))
        sources = {"eng": {*catalog_strings()}, "rus": pack_strings("rus"), "kaz": pack_strings("kaz")}
        for language, rewrites in admissions_editorial.load_rewrites().items():
            blob = rewrite_blob(admissions_editorial.strip_text(text, frozenset(notes["clauses"][language])) for text in sources[language])
            for rewrite in rewrites:
                for match in rewrite.matcher.finditer(blob):
                    self.assertEqual(numbers(match.group(0)), numbers(rewrite.substitute(match)),
                                     f"{language} rewrite changes a number: {match.group(0)[:80]}")
                blob = rewrite.apply(blob)

    def test_researcher_phrases_are_gone_from_edited_catalog_text(self):
        notes = admissions_editorial.load_clauses()["eng"], admissions_editorial.load_rewrites()["eng"]
        leftovers = collections.Counter()
        for text in catalog_strings():
            edited = admissions_editorial.clean_text(text, *notes)
            for piece in admissions_editorial.CLAUSE_SPLIT.split(edited):
                match = RESEARCHER_VOICE.search(piece)
                if match:
                    leftovers[match.group(0)] += 1
        self.assertEqual(dict(leftovers), {}, "Add a rewrite for new researcher-voice wording")

    def test_russian_and_kazakh_rewrites_read_like_guidance(self):
        rewrites = admissions_editorial.load_rewrites()
        self.assertEqual(admissions_editorial.rewrite_text(
            "На проверенной странице не указаны пороги. Проверенные страницы не называют срок.", rewrites["rus"]),
            "На странице не указаны пороги. Страницы не называют срок.")
        self.assertEqual(admissions_editorial.rewrite_text(
            "Тексерілген бетте көрсетілмеген; тексерілген NU бетінде нақты мән жоқ.", rewrites["kaz"]),
            "Бетте көрсетілмеген; NU бетінде нақты мән жоқ.")
        # A verified item that is not a page of research notes keeps its wording.
        kept = "Құжат әлі тексерілген жоқ."
        self.assertIs(admissions_editorial.rewrite_text(kept, rewrites["kaz"]), kept)


# Wording a reviewer reads as research commentary rather than guidance to the applicant. The four-university catalog must not contain it
# after editing; official verbatim fields are excluded by catalog_strings().
RESEARCHER_VOICE = re.compile(r"\b(?:[Tt]he|[Tt]his|[Cc]urrent|[Ss]hared) reviewed [A-Za-z0-9]|\bnot establish(?:ed)?\b|\bcannot establish\b|"
                              r"\bparent-owned\b|\bexecutable (?:eligibility|immigration)? ?(?:rule|decision)\b|\(see [a-z][a-z0-9]*(?:-[a-z0-9]+){2,}\)")


class AdmissionsEditorialTests(unittest.TestCase):
    def test_strip_text_removes_only_listed_clauses(self):
        clauses = frozenset({"Do not carry these amounts into 2027/28 without a new source", "preserve both"})
        self.assertEqual(admissions_editorial.strip_text(
            "Tuition is USD 15,000. Do not carry these amounts into 2027/28 without a new source.", clauses), "Tuition is USD 15,000.")
        self.assertEqual(admissions_editorial.strip_text("Two pages differ on the date; preserve both; ask admissions.", clauses),
                         "Two pages differ on the date; ask admissions.")
        self.assertEqual(admissions_editorial.strip_text("Two pages differ on the date; preserve both.", clauses), "Two pages differ on the date.")
        self.assertEqual(admissions_editorial.strip_text("preserve both", clauses), "")
        unchanged = "Do not submit other supplemental materials."
        self.assertIs(admissions_editorial.strip_text(unchanged, clauses), unchanged)

    def test_strip_payload_keeps_official_text_ids_and_numbers(self):
        clauses = frozenset({"preserve both"})
        payload = {"id": "fact-1", "value": {"amount": 0, "note": "Dates differ; preserve both.",
                                              "source_content": "Official page text; preserve both."},
                   "conditions": ["preserve both", "Applies to transfer applicants."], "flags": [None, 0]}
        self.assertEqual(admissions_editorial.strip_payload(payload, clauses), {
            "id": "fact-1", "value": {"amount": 0, "note": "Dates differ.", "source_content": "Official page text; preserve both."},
            "conditions": ["Applies to transfer applicants."], "flags": [None, 0]})

    def test_every_maintainer_directive_in_the_catalog_is_reviewed(self):
        listed = set(NOTES["clauses"]["eng"]) | set(NOTES["kept_clauses"]["eng"])
        found = set()
        for text in catalog_strings():
            for piece in admissions_editorial.CLAUSE_SPLIT.split(text):
                clause = admissions_editorial.clause_core(piece)
                if " " in clause and (DIRECTIVE.match(clause) or RESEARCH_MARKERS.search(clause)):
                    found.add(clause)
        self.assertEqual(sorted(found - listed), [], "Review new maintainer notes in editorial_notes.json")
        # Assessment mappings carry remaining source conditions into applicant responses too.
        assessments = (DATA_DIR / "admissions" / "assessments.json").read_text(encoding="utf-8")
        catalog_text = "\n".join([*catalog_strings(), assessments])
        listed_in_catalog = {clause for clause in NOTES["clauses"]["eng"] if clause in catalog_text}
        self.assertEqual(sorted(set(NOTES["clauses"]["eng"]) - listed_in_catalog), [], "Remove stale notes")

    def test_translated_notes_exist_in_their_language_pack(self):
        translations = json.loads((DATA_DIR / "universities_translations.json").read_text(encoding="utf-8"))["languages"]
        for language in ("rus", "kaz"):
            pack = translations[language]
            texts = list(pack["admission_exact"].values()) + [text for sections in pack["admission_summaries"].values()
                                                              for text in sections.values()]
            clauses = {admissions_editorial.clause_core(piece) for text in texts if isinstance(text, str)
                       for piece in admissions_editorial.CLAUSE_SPLIT.split(text)}
            self.assertEqual(sorted(set(NOTES["clauses"][language]) - clauses), [], language)


class AdmissionsEditorialEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def context(self):
        return self.client.post(f"/universities/{NU}/admissions-context", json={"profile": {}, "context": {
            "study_option_id": "nu-a-study-bachelor-of-science-in-computer-science", "study_level": "undergraduate"}})

    def test_applicant_context_omits_maintainer_notes_but_keeps_facts(self):
        response = self.context()
        self.assertEqual(response.status_code, 200)
        strings = []

        def walk(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key not in admissions_editorial.OFFICIAL_TEXT_KEYS:
                        walk(item)
            elif isinstance(value, list):
                for item in value:
                    walk(item)
            elif isinstance(value, str):
                strings.append(value)

        walk(response.json())
        notes = set(NOTES["clauses"]["eng"])
        leaked = {admissions_editorial.clause_core(piece) for text in strings
                  for piece in admissions_editorial.CLAUSE_SPLIT.split(text)} & notes
        self.assertEqual(leaked, set())
        self.assertNotIn("Keep NUET scoped separately", response.text)
        self.assertEqual("USD", response.json()["selected_costs"]["tuition"]["currency"])
        # The threshold itself remains in the facts that publish it.
        self.assertIn("120/50/50", response.text)

    def test_translation_bundle_follows_the_shortened_source_text(self):
        original = next(key for key in json.loads((DATA_DIR / "universities_translations.json").read_text(encoding="utf-8"))
                        ["languages"]["rus"]["admission_exact"] if "Do not carry these amounts into 2027/28 without a new source" in key)
        short = admissions_editorial.clean_text(original, frozenset(NOTES["clauses"]["eng"]), admissions_editorial.load_rewrites()["eng"])
        exact = self.client.get("/universities/translations", params={"lang": "rus"}).json()["data"]["admission_exact"]
        self.assertIn(short, exact)
        self.assertNotIn("Не переносите эти суммы на 2027/28 год без нового источника", exact[short])
        self.assertEqual(exact[short], exact[original])

    def test_structured_value_summaries_follow_the_cleaned_value(self):
        clauses, rewrites = frozenset(NOTES["clauses"]["eng"]), admissions_editorial.load_rewrites()["eng"]
        summaries = json.loads((DATA_DIR / "universities_translations.json").read_text(encoding="utf-8"))["languages"]["rus"]["admission_summaries"]
        affected = [key for key in summaries if key.startswith(("{", "["))
                    and admissions_editorial.strip_payload(json.loads(key), clauses, rewrites) != json.loads(key)]
        self.assertTrue(affected)
        bundle = self.client.get("/universities/translations", params={"lang": "rus"}).json()["data"]["admission_summaries"]
        for key in affected:
            # The page looks summaries up by JSON.stringify of the value it received from the API.
            cleaned = json.dumps(admissions_editorial.strip_payload(json.loads(key), clauses, rewrites), ensure_ascii=False, separators=(",", ":"))
            self.assertIn(cleaned, bundle, key[:80])

    def test_applicant_context_states_research_findings_as_guidance(self):
        response = self.client.post("/universities/imperial-college-london-uk/admissions-context", json={"profile": {}, "context": {
            "study_option_id": "imperial-option-computing-meng", "study_level": "undergraduate",
            "application_route_id": "procedure-computing-meng"}})
        self.assertEqual(response.status_code, 200)
        text = response.text
        for research_voice in ("parent-owned", "course-page fee labels do not establish an applicant fee status", "executable"):
            self.assertNotIn(research_voice, text)
        self.assertIn("University-wide English-language thresholds and application procedures are set out in Imperial's general admissions rules", text)
        self.assertIn("a fee label on the course page does not decide your own fee status", text)
        # The facts the guidance qualifies stay in the response.
        self.assertIn("minimum entry standard", text)

    def test_translation_bundle_rewrites_the_english_key_and_the_translation_together(self):
        rewrites = admissions_editorial.load_rewrites()
        original_en = "ETS-equivalent TOEFL, exact current conversion not specified in reviewed NU page"
        expected = {
            "rus": "Эквивалент TOEFL по таблице ETS; точный действующий перевод баллов на странице NU не указан",
            "kaz": "ETS бойынша баламалы TOEFL; NU бетінде ағымдағы нақты сәйкестендіру көрсетілмеген.",
        }
        self.assertEqual(admissions_editorial.rewrite_text(original_en, rewrites["eng"]), "ETS-equivalent TOEFL, exact current conversion not specified in the NU page")
        for language, translation in expected.items():
            exact = self.client.get("/universities/translations", params={"lang": language}).json()["data"]["admission_exact"]
            self.assertEqual(exact["ETS-equivalent TOEFL, exact current conversion not specified in the NU page"], translation, language)
        # A fully rewritten sentence is reachable by its new English text with a natural translation, not a word-by-word one.
        key = "MD-equivalence, English waiver and clinical suitability remain committee decisions. The language shown on the page is not proof that teaching is trilingual."
        exact = self.client.get("/universities/translations", params={"lang": "rus"}).json()["data"]["admission_exact"]
        self.assertTrue(exact[key].endswith("Язык, указанный на странице, не доказывает, что обучение ведётся на трёх языках."))

    def test_study_option_etag_changes_with_the_editorial_notes(self):
        url = f"/universities/{NU}/study-options"
        first = self.client.get(url)
        self.assertEqual(first.status_code, 200)
        with tempfile.TemporaryDirectory() as temporary:
            changed = Path(temporary) / "editorial_notes.json"
            notes = json.loads(admissions_editorial.EDITORIAL_NOTES_PATH.read_text(encoding="utf-8"))
            notes["rewrites"]["eng"].append({"phrase": "text no catalog string contains", "replace": "x"})
            changed.write_text(json.dumps(notes), encoding="utf-8")
            with patch.object(admissions_editorial, "EDITORIAL_NOTES_PATH", changed):
                second = self.client.get(url, headers={"If-None-Match": first.headers["ETag"]})
        self.assertEqual(second.status_code, 200)
        self.assertNotEqual(first.headers["ETag"], second.headers["ETag"])
        self.assertEqual(self.client.get(url, headers={"If-None-Match": first.headers["ETag"]}).status_code, 304)

    def test_missing_notes_fail_explicitly(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(admissions_editorial, "EDITORIAL_NOTES_PATH", Path(temporary) / "missing.json"):
                self.assertEqual(self.context().status_code, 503)
                bundle = university_service.get_university_translation_bundle("rus")
                self.assertTrue(bundle["data"]["admission_exact"])


if __name__ == "__main__":
    unittest.main()
