import re
import unittest

from app.services import admissions_assessment, admissions_catalog, admissions_editorial, universities as university_service

IMPERIAL = "imperial-college-london-uk"
CONTEXT = {"study_option_id": "imperial-option-computing-meng", "application_route_id": "procedure-computing-meng",
           "study_level": "undergraduate", "applicant_route": "first_year", "intended_entry_cycle": "2027 entry"}
CYRILLIC = re.compile(r"[Ѐ-ӿ]")


def digits(text):
    return sorted(re.findall(r"\d", text))


def strings(value, skip=admissions_editorial.OFFICIAL_TEXT_KEYS):
    if isinstance(value, dict):
        for key, item in value.items():
            if key not in skip:
                yield from strings(item, skip)
    elif isinstance(value, list):
        for item in value:
            yield from strings(item, skip)
    elif isinstance(value, str):
        yield value


class ImperialTranslationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundles = {lang: university_service.get_university_translation_bundle(lang)["data"]["admission_exact"] for lang in ("rus", "kaz")}
        resolved = admissions_catalog.resolve_context(IMPERIAL, profile={}, context=dict(CONTEXT))
        resolved["assessment"] = admissions_assessment.assess_resolved_context(resolved, {})
        cls.resolved = admissions_editorial.strip_applicant_payload(resolved)

    def test_main_journey_prose_is_translated_in_both_languages(self):
        facts = {row["id"]: row for row in self.resolved["facts"]}
        required = [row["value"] for row in facts.values() if isinstance(row["value"], str) and len(row["value"]) >= 100]
        required += [row["reason"] for row in self.resolved["unknowns"] if len(row.get("reason", "")) >= 100]
        required += [row["official_next_step"] for row in self.resolved["unknowns"] if row.get("official_next_step")]
        required += [row["conditions_and_exceptions"] for row in facts.values() if isinstance(row.get("conditions_and_exceptions"), str)]
        required = [text for text in required if text.strip()]
        self.assertGreaterEqual(len(required), 20)
        for language, exact in self.bundles.items():
            for text in required:
                with self.subTest(language=language, text=text[:60]):
                    self.assertTrue(text.strip() in exact, "not translated")
                    self.assertRegex(exact[text.strip()], CYRILLIC)
        fee = next(text for text in required if text.startswith("Imperial assesses Home/Overseas status"))
        self.assertIn("статус оплаты", self.bundles["rus"][fee].lower())
        self.assertIn("төлем мәртебесі", self.bundles["kaz"][fee].lower())

    def test_source_titles_and_scope_labels_are_translated(self):
        titles = [source["title"] for source in self.resolved["sources"] if source["title"].endswith("| Study | Imperial College London")]
        self.assertTrue(titles)
        for language, exact in self.bundles.items():
            for title in titles:
                with self.subTest(language=language, title=title):
                    self.assertRegex(exact[title], CYRILLIC)

    def test_every_translation_keeps_the_digits_of_its_english_source(self):
        institution = admissions_catalog.get_institution(IMPERIAL)
        notes_clauses = admissions_editorial.load_clauses()["eng"]
        notes_rewrites = admissions_editorial.load_rewrites()["eng"]
        sources = {admissions_editorial.clean_text(text, notes_clauses, notes_rewrites).strip()
                   for section in ("facts", "unknowns", "study_options", "application_routes", "sources")
                   for text in strings(institution.get(section, []))}
        checked = 0
        for language, exact in self.bundles.items():
            for source in sources & exact.keys():
                if re.fullmatch(r"\d+ years", source):
                    continue  # older duration labels deliberately spell the number out ("три года")
                checked += 1
                self.assertEqual(digits(source), digits(exact[source]), f"{language}: {source[:80]}")
        self.assertGreater(checked, 1800)


if __name__ == "__main__":
    unittest.main()
