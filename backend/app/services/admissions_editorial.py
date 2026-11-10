"""Turn reviewed research notes into plain applicant-facing admissions text.

Reviewed admissions records keep maintainer notes such as "do not carry these amounts
forward" and are written in a researcher's voice ("the reviewed pages do not establish...").
The research files stay unchanged. Applicant responses are edited in two steps, both listed
in ``editorial_notes.json``:

1. ``clauses`` are dropped exactly: they only instruct or inform the maintainer.
2. ``rewrites`` restate the remaining text as guidance to the applicant. A rewrite is either
   a literal ``phrase`` or a regex ``pattern`` with a ``replace`` text, kept per language.

The translation bundle applies the same two steps to every translated string and keys each
translation by the rewritten English source, so the page lookup still finds it.
"""

import hashlib
import json
import re
import threading
from pathlib import Path

from app.core.paths import DATA_DIR
from app.services.admissions_catalog import AdmissionsCatalogError

EDITORIAL_NOTES_PATH = DATA_DIR / "admissions" / "editorial_notes.json"
LANGUAGES = ("eng", "rus", "kaz")
CLAUSE_SPLIT = re.compile(r"(?<=[;.])\s+")
# Official university wording is shown verbatim even when it contains an instruction.
OFFICIAL_TEXT_KEYS = frozenset({"source_content", "published_text", "original_source_text", "source_text",
                                "verbatim", "quote", "official_text", "original_text"})
_LOCK = threading.Lock()
_CACHE = {"signature": None, "notes": None}


_CAPITALIZED_GROUP = re.compile(r"\\u(\d)")


def _capitalize(text):
    return text[:1].upper() + text[1:]


class Rewrite:
    """One reviewed edit: a compiled matcher and its replacement.

    A ``pattern`` replacement is a normal regex template; ``\\uN`` inserts group N with its first
    letter capitalised, so a removed sentence opener leaves a correctly capitalised sentence.
    """

    __slots__ = ("source", "matcher", "replacement", "literal", "capitalizes")

    def __init__(self, entry):
        phrase, pattern, replace = entry.get("phrase"), entry.get("pattern"), entry["replace"]
        if (phrase is None) == (pattern is None) or not isinstance(replace, str):
            raise ValueError("A rewrite needs exactly one of phrase or pattern, and a replace text")
        self.literal = phrase is not None
        self.source = phrase if self.literal else pattern
        self.matcher = re.compile(re.escape(phrase) if self.literal else pattern)
        self.replacement = replace
        self.capitalizes = not self.literal and _CAPITALIZED_GROUP.search(replace) is not None
        if not self.literal and any(int(number) > self.matcher.groups for number in re.findall(r"\\u?(\d)", replace)):
            raise ValueError(f"Rewrite refers to a missing group: {replace}")

    def substitute(self, match):
        """Return the text that replaces one match of this rewrite."""
        if self.literal:
            return self.replacement  # a literal replacement must not be read as a regex template
        if not self.capitalizes:
            return match.expand(self.replacement)
        template = _CAPITALIZED_GROUP.sub(
            lambda token: _capitalize(match.group(int(token.group(1))) or "").replace("\\", "\\\\"), self.replacement)
        return match.expand(template)

    def apply(self, text):
        return self.matcher.sub(self.substitute, text)

    def matches(self, text):
        return self.matcher.search(text) is not None


def clause_core(text):
    return text.strip().rstrip(".;: ").strip()


def _load(path=None):
    """Return the cached notes; a missing or invalid file is an explicit catalog error."""
    path = Path(path or EDITORIAL_NOTES_PATH)
    try:
        stat = path.stat()
        signature = (str(path.resolve()), stat.st_mtime_ns, stat.st_size)
        with _LOCK:
            if _CACHE["signature"] == signature:
                return _CACHE["notes"]
        raw = path.read_bytes()
        data = json.loads(raw.decode("utf-8"))
        notes = {
            "revision": hashlib.sha256(raw).hexdigest(),
            "clauses": {language: frozenset(data["clauses"][language]) for language in LANGUAGES},
            "rewrites": {language: tuple(Rewrite(entry) for entry in data["rewrites"][language]) for language in LANGUAGES},
        }
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError, ValueError, re.error) as error:
        raise AdmissionsCatalogError("Admissions editorial notes are unavailable") from error
    with _LOCK:
        _CACHE.update(signature=signature, notes=notes)
    return notes


def revision(path=None):
    """Hash of the notes file; cached HTTP responses that embed edited text must change with it."""
    return _load(path)["revision"]


def load_clauses(path=None):
    """Return {language: frozenset(clauses)}."""
    return _load(path)["clauses"]


def load_rewrites(path=None):
    """Return {language: tuple(Rewrite)} in the order they are applied."""
    return _load(path)["rewrites"]


def strip_text(text, clauses):
    """Drop listed clauses; keep every other clause and its original wording."""
    pieces = CLAUSE_SPLIT.split(text)
    kept = [piece for piece in pieces if clause_core(piece) not in clauses]
    if len(kept) == len(pieces):
        return text
    result = " ".join(kept).strip()
    # A removed final clause can leave the previous clause ending with a separator.
    return result[:-1].rstrip() + "." if result.endswith((";", ":")) else result


def rewrite_text(text, rewrites):
    """Apply the rewrites in order; return the same object when nothing matches."""
    for rewrite in rewrites:
        text = rewrite.apply(text)
    return text


def clean_text(text, clauses, rewrites=()):
    return rewrite_text(strip_text(text, clauses), rewrites)


def strip_payload(value, clauses, rewrites=()):
    """Return a copy of an API payload without listed clauses and with rewrites applied; emptied list items disappear."""
    if isinstance(value, dict):
        return {key: item if key in OFFICIAL_TEXT_KEYS else strip_payload(item, clauses, rewrites) for key, item in value.items()}
    if isinstance(value, list):
        items = [strip_payload(item, clauses, rewrites) for item in value]
        return [item for item, original in zip(items, value) if not (isinstance(original, str) and original and item == "")]
    if isinstance(value, str):
        return clean_text(value, clauses, rewrites)
    return value


def strip_applicant_payload(payload):
    """Applicant responses use the English source; translations are cleaned in the bundle."""
    notes = _load()
    return strip_payload(payload, notes["clauses"]["eng"], notes["rewrites"]["eng"])


def clean_translation_pack(pack, language):
    """Edit translated admissions text like the English source and key it by the edited English source."""
    notes = _load()
    source_clauses, source_rewrites = notes["clauses"]["eng"], notes["rewrites"]["eng"]
    target_clauses = notes["clauses"].get(language, frozenset())
    target_rewrites = notes["rewrites"].get(language, ())

    def clean(text):
        return clean_text(text, target_clauses, target_rewrites) if isinstance(text, str) else text

    def shorten(key):
        # Summaries of structured values are keyed by the page's JSON.stringify(value); rebuild that key too.
        if key.startswith(("{", "[")):
            try:
                value = json.loads(key)
            except json.JSONDecodeError:
                return clean_text(key, source_clauses, source_rewrites)
            edited = strip_payload(value, source_clauses, source_rewrites)
            return key if edited == value else json.dumps(edited, ensure_ascii=False, separators=(",", ":"))
        return clean_text(key, source_clauses, source_rewrites)

    def rekey(entries, clean_value):
        result = {}
        for key, value in entries.items():
            cleaned = clean_value(value)
            result[key] = cleaned
            short = shorten(key)
            # The API now sends the edited source string, so its translation must be reachable by that key.
            if short and short != key and short not in entries:
                result[short] = cleaned
        return result

    result = dict(pack)
    if isinstance(pack.get("admission_exact"), dict):
        result["admission_exact"] = rekey(pack["admission_exact"], clean)
    if isinstance(pack.get("admission_summaries"), dict):
        result["admission_summaries"] = rekey(pack["admission_summaries"], lambda sections: (
            {section: clean(text) for section, text in sections.items()} if isinstance(sections, dict) else sections))
    return result
