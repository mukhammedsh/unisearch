"""Remove reviewed research instructions from applicant-facing admissions text.

Reviewed admissions records keep maintainer notes such as "do not carry these amounts
forward" next to the facts they qualify. The research files stay unchanged; applicant
responses drop exactly the clauses listed in ``editorial_notes.json`` and the
translation bundle gains matching entries for the shortened source strings.
"""

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
_CACHE = {"signature": None, "clauses": None}


def clause_core(text):
    return text.strip().rstrip(".;: ").strip()


def load_clauses(path=None):
    """Return {language: frozenset(clauses)}; a missing or invalid file is an explicit catalog error."""
    path = Path(path or EDITORIAL_NOTES_PATH)
    try:
        stat = path.stat()
        signature = (str(path.resolve()), stat.st_mtime_ns, stat.st_size)
        with _LOCK:
            if _CACHE["signature"] == signature:
                return _CACHE["clauses"]
        data = json.loads(path.read_text(encoding="utf-8"))
        clauses = {language: frozenset(data["clauses"][language]) for language in LANGUAGES}
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise AdmissionsCatalogError("Admissions editorial notes are unavailable") from error
    with _LOCK:
        _CACHE.update(signature=signature, clauses=clauses)
    return clauses


def strip_text(text, clauses):
    """Drop listed clauses; keep every other clause and its original wording."""
    pieces = CLAUSE_SPLIT.split(text)
    kept = [piece for piece in pieces if clause_core(piece) not in clauses]
    if len(kept) == len(pieces):
        return text
    result = " ".join(kept).strip()
    # A removed final clause can leave the previous clause ending with a separator.
    return result[:-1].rstrip() + "." if result.endswith((";", ":")) else result


def strip_payload(value, clauses):
    """Return a copy of an API payload without listed clauses; emptied list items disappear."""
    if isinstance(value, dict):
        return {key: item if key in OFFICIAL_TEXT_KEYS else strip_payload(item, clauses) for key, item in value.items()}
    if isinstance(value, list):
        items = [strip_payload(item, clauses) for item in value]
        return [item for item, original in zip(items, value) if not (isinstance(original, str) and original and item == "")]
    if isinstance(value, str):
        return strip_text(value, clauses)
    return value


def strip_applicant_payload(payload):
    """Applicant responses use the English source; translations are cleaned in the bundle."""
    return strip_payload(payload, load_clauses()["eng"])


def clean_translation_pack(pack, language):
    """Remove listed clauses from translated admissions text and key it by the shortened English source."""
    clauses = load_clauses()
    source, target = clauses["eng"], clauses.get(language, frozenset())

    def clean(text):
        return strip_text(text, target) if isinstance(text, str) else text

    def shorten(key):
        # Summaries of structured values are keyed by the page's JSON.stringify(value); rebuild that key too.
        if key.startswith(("{", "[")):
            try:
                value = json.loads(key)
            except json.JSONDecodeError:
                return strip_text(key, source)
            stripped = strip_payload(value, source)
            return key if stripped == value else json.dumps(stripped, ensure_ascii=False, separators=(",", ":"))
        return strip_text(key, source)

    def rekey(entries, clean_value):
        result = {}
        for key, value in entries.items():
            cleaned = clean_value(value)
            result[key] = cleaned
            short = shorten(key)
            # The API now sends the shortened source string, so its translation must be reachable by that key.
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
