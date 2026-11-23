import re
import unittest

from app.services import admissions_assessment, admissions_catalog, admissions_editorial, universities as university_service

IMPERIAL = "imperial-college-london-uk"
CONTEXT = {"study_option_id": "imperial-option-computing-meng", "application_route_id": "procedure-computing-meng",
           "study_level": "undergraduate", "applicant_route": "first_year", "intended_entry_cycle": "2027 entry"}
MSC_CONTEXT = {"study_option_id": "imperial-option-computing", "application_route_id": "procedure-computing",
               "study_level": "masters", "applicant_route": None, "intended_entry_cycle": None}
MENG_CONTEXT = {**CONTEXT, "applicant_route": None, "intended_entry_cycle": None}
CYRILLIC = re.compile(r"[Ѐ-ӿ]")
# Fields the admissions page does not show as text, and leaf names that hold module titles (kept in English by design).
INTERNAL_KEYS = {"id", "topic", "topics", "provenance", "attributes", "index_attributes", "source_locator", "review_attempts", "scope",
                 "measurable", "blocksNumericScore", "addressed_conditions", "covered_check_ids", "subjects_field", "field",
                 "mapping_reviewed_at", "score_strategy", "component_count", "origin", "university_id", "program_id", "option_ids",
                 "route_ids", "applicant_routes", "cycles", "legacy_field"}
INTERNAL_KEY = re.compile(r"(?:^|_)(?:ids?|hash|sha256|refs?)$|(?:Id|Ids|Revision|Hash)$|selector", re.I)
MODULE_KEY = re.compile(r"modules?|components|heading|^Year \d|Research Project|year one|stage", re.I)
KEPT_IN_ENGLISH = {"MSc", "MRes", "PhD", "My Imperial"}


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


def rendered_strings(resolved):
    """(leaf name, cleaned text) for every applicant-visible string of a resolved admissions context."""
    clauses, rewrites = admissions_editorial.load_clauses()["eng"], admissions_editorial.load_rewrites()["eng"]
    found = []

    def walk(value, key):
        if isinstance(value, dict):
            for name, item in value.items():
                if name not in admissions_editorial.OFFICIAL_TEXT_KEYS and name not in INTERNAL_KEYS and not INTERNAL_KEY.search(name):
                    walk(item, name)
        elif isinstance(value, list):
            for item in value:
                walk(item, key)
        elif isinstance(value, str) and value.strip():
            text = admissions_editorial.clean_text(value, clauses, rewrites).strip()
            if text:
                found.append((key, text))

    option = resolved["selected_option"] or {}
    for name in ("title", "application_relationship", "awards"):
        walk(option.get(name), "option." + name)
    for overview in option.get("overviews", []):
        walk(overview.get("text"), "option.overview")
    for route in [resolved["selected_route"] or {}, *resolved["available_routes"]]:
        for name in ("title", "destination", "target", "classification"):
            walk(route.get(name), "route." + name)
    for bucket in (resolved["facts"], resolved["unknowns"], resolved["history"]["facts"], resolved["history"]["unknowns"]):
        for row in bucket:
            for name in ("value", "conditions", "conditions_and_exceptions", "exceptions", "title", "label", "reason", "official_next_step", "period"):
                walk(row.get(name), name)
    for source in resolved["sources"]:
        walk(source.get("title"), "source.title")
    return found


def is_prose(text):
    return bool(re.search(r"[A-Za-z]", text)) and not re.match(r"https?://", text) and not re.fullmatch(r"[a-z0-9_\-:/.#]+", text)


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

    def test_computing_msc_journey_is_translated_in_both_languages(self):
        def journey(context):
            return rendered_strings(admissions_catalog.resolve_context(IMPERIAL, profile={}, context=dict(context)))

        undergraduate = {text for _, text in journey(MENG_CONTEXT)}
        required = {text for key, text in journey(MSC_CONTEXT)
                    if is_prose(text) and text not in undergraduate and text not in KEPT_IN_ENGLISH
                    and not MODULE_KEY.search(key) and not re.fullmatch(r"\d[A-Z]", text)}
        self.assertGreater(len(required), 150)
        for language, exact in self.bundles.items():
            missing = sorted(text for text in required if not CYRILLIC.search(exact.get(text, "")))
            self.assertEqual([], missing[:5], f"{language}: {len(missing)} of {len(required)} Computing MSc strings are not translated")

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
