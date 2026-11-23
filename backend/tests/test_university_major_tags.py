import re
import unittest

from app.core.utils import safe_lower as _safe_lower
from app.services import admissions_catalog, universities
from app.services import university_tracks as tracks


def reference_normalize(value):
    """The normalisation as it was before the taxonomy tables were precomputed."""
    text = _safe_lower(value).replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def reference_contains(text, phrase):
    if not text or not phrase:
        return False
    return re.search(r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b", text) is not None


def reference_tags(value):
    text = reference_normalize(value)
    if not text:
        return []
    return [canonical for canonical in tracks._CANONICAL_MAJORS
            if any(reference_contains(text, reference_normalize(phrase)) for phrase in tracks._MAJOR_PHRASES.get(canonical, [canonical]))]


class MajorTagEquivalenceTests(unittest.TestCase):
    def test_tags_match_the_unoptimised_algorithm_for_every_program_and_option_title(self):
        titles = set()
        for row in universities.load_universities():
            academics = row.get("academics") or {}
            titles.update(str(program.get("name") or "") for program in academics.get("programs") or [] if isinstance(program, dict))
            titles.update(str(major) for major in academics.get("majors") or [])
            titles.update(str(tag) for tag in academics.get("major_tags") or [])
            reviewed = admissions_catalog.get_institution(str(row.get("id") or ""))
            titles.update(option["title"] for option in (reviewed or {}).get("study_options", []))
        titles.update({"", "  ", "Computer Science & Engineering", "B.Sc. in   Data-Science", None, 42})
        self.assertGreater(len(titles), 500)
        for title in sorted(titles, key=repr):
            with self.subTest(title=title):
                self.assertEqual(reference_normalize(title), tracks._normalize_major_text(title))
                self.assertEqual(reference_tags(title), tracks._major_tags_from_text(title))

    def test_returned_tag_lists_are_not_shared_between_calls(self):
        first = tracks._major_tags_from_text("Computer Science")
        first.append("mutated")
        self.assertNotIn("mutated", tracks._major_tags_from_text("Computer Science"))


if __name__ == "__main__":
    unittest.main()
