"""Canonical major taxonomy, text normalization, and phrase matching."""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from app.core.utils import safe_lower as _safe_lower

_CANONICAL_MAJORS = [
    "computer science",
    "engineering",
    "business",
    "medicine",
    "natural sciences",
    "economics",
    "physics",
    "mathematics",
    "law",
    "social sciences",
    "architecture",
    "psychology",
    "humanities",
    "design",
    "life sciences",
    "education",
    "agriculture",
]

_MAJOR_PHRASES: dict[str, list[str]] = {
    "computer science": [
        "computer science",
        "computing",
        "informatics",
        "software engineering",
        "information systems",
        "computer engineering",
        "computer science and engineering",
        "computer science and technology",
        "cs",
        "eecs",
    ],
    "engineering": [
        "engineering",
        "aerospace",
        "mechanical",
        "electrical",
        "civil",
        "chemical",
        "industrial",
        "mechatronics",
        "robotics",
    ],
    "business": ["business", "management", "finance", "marketing", "accounting", "mba"],
    "medicine": ["medicine", "medical", "clinical", "nursing", "pharmacy", "dentistry"],
    "natural sciences": [
        "natural sciences",
        "natural science",
        "chemistry",
        "earth science",
        "environmental science",
    ],
    "economics": ["economics", "economy", "econometrics"],
    "physics": ["physics", "astrophysics"],
    "mathematics": ["mathematics", "math", "statistics", "actuarial"],
    "law": ["law", "legal", "jurisprudence", "llb", "jd"],
    "social sciences": [
        "social sciences",
        "social science",
        "sociology",
        "political science",
        "anthropology",
    ],
    "architecture": ["architecture", "urban planning", "built environment"],
    "psychology": ["psychology", "psychological"],
    "humanities": [
        "humanities",
        "history",
        "philosophy",
        "linguistics",
        "literature",
        "classics",
    ],
    "design": [
        "design",
        "graphic design",
        "industrial design",
        "interaction design",
        "ux",
        "ui",
        "product design",
    ],
    "life sciences": [
        "life sciences",
        "life science",
        "biology",
        "biotechnology",
        "biomedical",
        "genetics",
        "neuroscience",
    ],
    "education": ["education", "teaching", "pedagogy", "curriculum", "teacher"],
    "agriculture": ["agriculture", "agricultural", "agronomy", "horticulture"],
}

_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_WHITESPACE_RE = re.compile(r"\s+")


@lru_cache(maxsize=16384)
def _normalize_lowered_major_text(lowered: str) -> str:
    text = _NON_ALNUM_RE.sub(" ", lowered.replace("&", " and "))
    return _WHITESPACE_RE.sub(" ", text).strip()


def _normalize_major_text(value: Any) -> str:
    return _normalize_lowered_major_text(_safe_lower(value))


@lru_cache(maxsize=4096)
def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    return re.compile(r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b")


def _contains_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    return _phrase_pattern(phrase).search(text) is not None


# Normalised taxonomy phrases, computed once: loading the catalogue tags every program title against all of them.
_MAJOR_PHRASE_TABLE: tuple[tuple[str, tuple[str, ...]], ...] = tuple(
    (canonical, tuple(_normalize_major_text(p) for p in _MAJOR_PHRASES.get(canonical, [canonical])))
    for canonical in _CANONICAL_MAJORS
)


@lru_cache(maxsize=16384)
def _normalized_major_tags(text: str) -> tuple[str, ...]:
    return tuple(
        canonical
        for canonical, phrases in _MAJOR_PHRASE_TABLE
        if any(_contains_phrase(text, phrase) for phrase in phrases)
    )


def _major_tags_from_text(value: Any) -> list[str]:
    text = _normalize_major_text(value)
    return list(_normalized_major_tags(text)) if text else []


def _canonical_major(value: Any) -> str:
    text = _normalize_major_text(value)
    if not text:
        return ""
    if text in _CANONICAL_MAJORS:
        return text
    tags = _major_tags_from_text(text)
    if len(tags) == 1:
        return tags[0]
    return ""
