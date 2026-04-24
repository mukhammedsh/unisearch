import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

TEXT_FIELD_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("name", 6.0),
    ("city", 4.0),
    ("country", 3.0),
    ("state", 3.0),
    ("description", 2.0),
)
LIST_FIELD_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("search_aliases", 5.5),
    ("tags", 2.5),
    ("major_exact", 4.0),
    ("majors", 3.0),
    ("program_names", 3.0),
    ("study_levels", 2.0),
)
TOKEN_FUZZY_MIN_LEN = 4
FULL_TEXT_MATCH_BONUS = 60.0
NAME_MATCH_BONUS = 80.0
TOKEN_MATCH_MULTIPLIER = 10.0
ALL_TOKENS_MATCH_BONUS = 15.0


def _normalize(value: Any) -> str:
    text = str(value or "").strip().lower()
    # Keep unicode letters/digits so RU/KZ localized search tokens are preserved.
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> List[str]:
    return _normalize(value).split()


def _edit_distance_leq_one(a: str, b: str) -> bool:
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False

    if len(a) > len(b):
        a, b = b, a

    edits = 0
    i = 0
    same_length = len(a) == len(b)
    for char in b:
        if i < len(a) and a[i] == char:
            i += 1
            continue
        if edits:
            return False
        edits = 1
        if same_length:
            i += 1
    return True


def _token_matches(query_token: str, candidate_tokens: Sequence[str]) -> bool:
    allow_fuzzy = len(query_token) >= TOKEN_FUZZY_MIN_LEN
    return any(
        cand
        and (
            query_token == cand
            or query_token in cand
            or (
                allow_fuzzy
                and len(cand) >= TOKEN_FUZZY_MIN_LEN
                and _edit_distance_leq_one(query_token, cand)
            )
        )
        for cand in candidate_tokens
    )


def prepare_query(query: Any) -> Optional[Dict[str, Any]]:
    if not (q_norm := _normalize(query)):
        return None
    if not (q_tokens := q_norm.split()):
        return None
    return {
        "q_norm": q_norm,
        "q_tokens": q_tokens,
    }


def _append_text_bucket(
    weighted_token_sets: List[Tuple[float, List[str]]],
    full_chunks: List[str],
    value: Any,
    weight: float,
) -> None:
    if not (norm := _normalize(value)):
        return
    weighted_token_sets.append((weight, norm.split()))
    full_chunks.append(norm)


def _append_list_bucket(
    weighted_token_sets: List[Tuple[float, List[str]]],
    full_chunks: List[str],
    values: Any,
    weight: float,
) -> None:
    if not isinstance(values, list):
        return

    token_bucket: List[str] = []
    for value in values:
        if not (norm := _normalize(value)):
            continue
        token_bucket.extend(norm.split())
        full_chunks.append(norm)

    if token_bucket:
        weighted_token_sets.append((weight, token_bucket))


def prepare_search_meta(meta_row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    weighted_token_sets: List[Tuple[float, List[str]]] = []
    full_chunks: List[str] = []
    for field, weight in TEXT_FIELD_WEIGHTS:
        _append_text_bucket(weighted_token_sets, full_chunks, meta_row.get(field, ""), weight)
    for field, weight in LIST_FIELD_WEIGHTS:
        _append_list_bucket(weighted_token_sets, full_chunks, meta_row.get(field, []), weight)

    if not full_chunks:
        return None

    return {
        "weighted_token_sets": weighted_token_sets,
        "full_text": " ".join(full_chunks),
        "name_text": _normalize(meta_row.get("name", "")),
    }


def _best_token_weight(
    query_token: str,
    weighted_token_sets: Sequence[Tuple[float, Sequence[str]]],
) -> float:
    return max(
        (weight for weight, bucket in weighted_token_sets if _token_matches(query_token, bucket)),
        default=0.0,
    )


def score_prepared(prepared_meta: Dict[str, Any], prepared_query: Dict[str, Any]) -> Optional[float]:
    q_norm = prepared_query["q_norm"]
    q_tokens = prepared_query["q_tokens"]

    weighted_token_sets = prepared_meta["weighted_token_sets"]
    full_text = prepared_meta["full_text"]
    name_text = prepared_meta["name_text"]

    score = 0.0
    if q_norm in full_text:
        score += FULL_TEXT_MATCH_BONUS
    if name_text and q_norm in name_text:
        score += NAME_MATCH_BONUS

    token_weights = [_best_token_weight(token, weighted_token_sets) for token in q_tokens]
    if any(weight <= 0 for weight in token_weights):
        return None

    score += sum(weight * TOKEN_MATCH_MULTIPLIER for weight in token_weights)
    score += ALL_TOKENS_MATCH_BONUS
    return score


def score_query(meta_row: Dict[str, Any], query: Any) -> Optional[float]:
    pq = prepare_query(query)
    if pq is None:
        return 0.0
    pm = prepare_search_meta(meta_row)
    if pm is None:
        return None
    return score_prepared(pm, pq)
