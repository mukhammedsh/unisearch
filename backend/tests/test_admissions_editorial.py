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
        short = admissions_editorial.strip_text(original, frozenset(NOTES["clauses"]["eng"]))
        exact = self.client.get("/universities/translations", params={"lang": "rus"}).json()["data"]["admission_exact"]
        self.assertIn(short, exact)
        self.assertNotIn("Не переносите эти суммы на 2027/28 год без нового источника", exact[short])
        self.assertEqual(exact[short], exact[original])

    def test_missing_notes_fail_explicitly(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(admissions_editorial, "EDITORIAL_NOTES_PATH", Path(temporary) / "missing.json"):
                self.assertEqual(self.context().status_code, 503)
                bundle = university_service.get_university_translation_bundle("rus")
                self.assertTrue(bundle["data"]["admission_exact"])


if __name__ == "__main__":
    unittest.main()
