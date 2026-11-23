"""Match a typed query to translated names by their words, not only by the full phrase."""

from __future__ import annotations

from typing import Dict, List

MIN_WORD_LENGTH = 4
MAX_WORD_MATCHES = 8
# Words this long keep their stem when the ending differs ("вычислительные" finds "вычислительная").
STEM_FROM_LENGTH = 7
STEM_ENDING = 2


def _stem(word: str) -> str:
    return word[:-STEM_ENDING] if len(word) >= STEM_FROM_LENGTH else word


def _word_matches(token: str, word: str) -> bool:
    return word.startswith(_stem(token))


def word_alias_candidates(norm_query: str, alias_map: Dict[str, str]) -> List[str]:
    """Return canonical names whose translated name contains every typed word.

    `alias_map` maps a translated phrase to its source-language name. A query
    such as "Вычислительные" then finds the entry translated as "Вычислительные
    системы". Short words are ignored so that a stray particle does not match
    most names, and the result is capped to keep the search bounded.
    """
    tokens = [token for token in norm_query.split(" ") if token]
    if not tokens or any(len(token) < MIN_WORD_LENGTH for token in tokens):
        return []
    matches: List[str] = []
    for phrase, canonical in alias_map.items():
        if phrase == norm_query or canonical in matches:
            continue
        words = phrase.split(" ")
        if all(any(_word_matches(token, word) for word in words) for token in tokens):
            matches.append(canonical)
            if len(matches) >= MAX_WORD_MATCHES:
                break
    return matches
