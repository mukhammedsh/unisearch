"""Russian and Kazakh coverage of the Stanford admissions text shown for the CS BS and CS MS journeys."""

import collections
import re
import unittest

from app.services import admissions_assessment, admissions_catalog, admissions_editorial, universities as university_service

STANFORD = "stanford-university-usa-ca"
JOURNEYS = {
    "cs-bs": {"study_option_id": "stanford-option-cs-bs", "application_route_id": "undergraduate-shared-evidence:stanford-first-year"},
    "cs-ms": {"study_option_id": "stanford-option-cs-ms", "application_route_id": "directory-evidence:stanford-graduate-cs-ms"},
}
# Maintainer-only fields and strings that expose raw status codes or dict dumps are cleaned in the source, not translated.
HIDDEN_KEYS = {"id", "provenance", "scope", "attributes", "sources", "fact_groups", "reference_labels", "excluded", "context", "inputs",
               "applicability", "normalized_status", "publication_status", "review_status", "topic", "url", "href", "source_links"}
UNTRANSLATED = re.compile(r"\{'|[a-z]+_[a-z]+_[a-z]+|Doerr|dossier|^https?://", re.I)

MONTHS = [("january", "январ", "қаңтар"), ("february", "феврал", "ақпан"), ("march", "март", "наурыз"), ("april", "апрел", "сәуір"),
          ("may", r"ма[йя]\b", "мамыр"), ("june", "июн", "маусым"), ("july", "июл", "шілде"), ("august", "август", "тамыз"),
          ("september", "сентябр", "қыркүйек"), ("october", "октябр", "қазан"), ("november", "ноябр", "қараша"),
          ("december", "декабр", "желтоқсан")]
THOUSANDS = re.compile(r"(?<=\d)[,   ](?=\d{3}(?!\d))")


def numbers(text):
    return collections.Counter(str(int(number)) for number in re.findall(r"\d+", THOUSANDS.sub("", text)))


def source_numbers(text):
    """Numbers of the English source; a month name beside a number counts as that month's number."""
    counts = numbers(text)
    for index, (name, _, _) in enumerate(MONTHS, 1):
        month = name.capitalize()  # case-sensitive so the verb "may" after a number is not read as May
        counts[str(index)] += len(re.findall(rf"\b{month}\b\s*\d|\d\s*\b{month}\b", text))
    return counts


def translated_numbers(text):
    counts = numbers(text)
    for index, (_, russian, kazakh) in enumerate(MONTHS, 1):
        counts[str(index)] += len(re.findall(f"{russian}|{kazakh}", text.lower()))
    return counts


def text_leaves(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key not in HIDDEN_KEYS and key not in admissions_editorial.OFFICIAL_TEXT_KEYS:
                yield from text_leaves(item)
    elif isinstance(value, list):
        for item in value:
            yield from text_leaves(item)
    elif isinstance(value, str):
        yield value.strip()


def journey_text(context):
    resolved = admissions_catalog.resolve_context(STANFORD, profile={}, context=context)
    resolved["assessment"] = admissions_assessment.assess_resolved_context(resolved, {})
    resolved["selected_costs"] = admissions_catalog.selected_costs(STANFORD, resolved["context"])
    cleaned = admissions_editorial.strip_applicant_payload(resolved)
    return {text for text in text_leaves(cleaned) if len(text) >= 40 and " " in text and not UNTRANSLATED.search(text)}


class StanfordTranslationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.packs = {lang: university_service.get_university_translation_bundle(lang)["data"]["admission_exact"] for lang in ("rus", "kaz")}

    def test_cs_journeys_are_translated_into_russian_and_kazakh(self):
        for name, context in JOURNEYS.items():
            strings = journey_text(context)
            self.assertGreater(len(strings), 100, name)
            for lang, pack in self.packs.items():
                with self.subTest(journey=name, lang=lang):
                    missing = sorted(text for text in strings if text not in pack)
                    self.assertLessEqual(len(missing), len(strings) * 0.03, missing[:5])

    def test_translations_read_as_plain_guidance_in_the_target_language(self):
        english = ("ACT or SAT is required for first-year applicants. Stanford has no minimum score and no score guarantees admission.")
        bechtel = "International newly admitted undergraduates and graduate students receive a Bechtel Connect invitation"
        for lang, pack in self.packs.items():
            for prefix in (english, bechtel):
                key = next(text for text in pack if text.startswith(prefix))
                translated = pack[key]
                with self.subTest(lang=lang, prefix=prefix[:20]):
                    self.assertGreater(len(re.findall(r"[А-Яа-яӘәҒғҚқҢңӨөҰұҮүІіҺһ]", translated)), len(translated) * 0.4)
                    self.assertNotIn("do not", translated.lower())

    def test_every_stanford_translation_keeps_the_numbers_of_its_source(self):
        institution = admissions_catalog.get_institution(STANFORD)
        notes = admissions_editorial.load_clauses()["eng"], admissions_editorial.load_rewrites()["eng"]
        checked = 0
        for row in [*institution["facts"], *institution["unknowns"]]:
            for source in text_leaves({key: value for key, value in row.items() if key not in HIDDEN_KEYS}):
                edited = admissions_editorial.clean_text(source, *notes)
                for lang, pack in self.packs.items():
                    if edited not in pack:
                        continue
                    checked += 1
                    with self.subTest(lang=lang, source=edited[:60]):
                        self.assertFalse(source_numbers(edited) - translated_numbers(pack[edited]), pack[edited][:120])
        self.assertGreater(checked, 800)


if __name__ == "__main__":
    unittest.main()
