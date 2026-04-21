import re
from typing import Any, Dict, List, Optional, Sequence, Tuple


def _normalize(value: Any) -> str:
    text = str(value or "").strip().lower()
    # Keep unicode letters/digits so RU/KZ localized search tokens are preserved.
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> List[str]:
    text = _normalize(value)
    if not text:
        return []
    return [part for part in text.split(" ") if part]


def _edit_distance_leq_one(a: str, b: str) -> bool:
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False

    i = 0
    j = 0
    edits = 0
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1
            j += 1
            continue
        edits += 1
        if edits > 1:
            return False
        if la > lb:
            i += 1
        elif lb > la:
            j += 1
        else:
            i += 1
            j += 1

    if i < la or j < lb:
        edits += 1
    return edits <= 1


def _token_matches(query_token: str, candidate_tokens: Sequence[str]) -> bool:
    for cand in candidate_tokens:
        if not cand:
            continue
        if query_token == cand:
            return True
        if query_token in cand:
            return True
        if len(query_token) >= 4 and len(cand) >= 4 and _edit_distance_leq_one(query_token, cand):
            return True
    return False


def prepare_query(query: Any) -> Optional[Dict[str, Any]]:
    q_norm = _normalize(query)
    if not q_norm:
        return None
    q_tokens = _tokens(q_norm)
    if not q_tokens:
        return None
    return {
        "q_norm": q_norm,
        "q_tokens": q_tokens,
    }


def prepare_search_meta(meta_row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    fields: List[Tuple[str, float]] = [
        ("name", 6.0),
        ("city", 4.0),
        ("country", 3.0),
        ("state", 3.0),
        ("description", 2.0),
    ]

    weighted_token_sets: List[Tuple[float, List[str]]] = []
    full_chunks: List[str] = []
    for field, weight in fields:
        raw = meta_row.get(field, "")
        norm = _normalize(raw)
        if not norm:
            continue
        weighted_token_sets.append((weight, _tokens(norm)))
        full_chunks.append(norm)

    list_fields: List[Tuple[str, float]] = [
        ("search_aliases", 5.5),
        ("tags", 2.5),
        ("major_exact", 4.0),
        ("majors", 3.0),
        ("program_names", 3.0),
        ("study_levels", 2.0),
    ]
    for field, weight in list_fields:
        raw = meta_row.get(field, [])
        vals = raw if isinstance(raw, list) else []
        norm_items = [_normalize(x) for x in vals]
        token_bucket: List[str] = []
        for norm in norm_items:
            if not norm:
                continue
            token_bucket.extend(_tokens(norm))
            full_chunks.append(norm)
        if token_bucket:
            weighted_token_sets.append((weight, token_bucket))

    if not full_chunks:
        return None

    return {
        "weighted_token_sets": weighted_token_sets,
        "full_text": " ".join(full_chunks),
        "name_text": _normalize(meta_row.get("name", "")),
    }


def score_prepared(prepared_meta: Dict[str, Any], prepared_query: Dict[str, Any]) -> Optional[float]:
    q_norm = prepared_query["q_norm"]
    q_tokens = prepared_query["q_tokens"]

    weighted_token_sets = prepared_meta["weighted_token_sets"]
    full_text = prepared_meta["full_text"]
    name_text = prepared_meta["name_text"]

    score = 0.0
    if q_norm in full_text:
        score += 60.0
    if name_text and q_norm in name_text:
        score += 80.0

    matched_tokens = 0
    for token in q_tokens:
        best = 0.0
        for weight, bucket in weighted_token_sets:
            if _token_matches(token, bucket):
                best = max(best, weight)
        if best <= 0:
            return None
        matched_tokens += 1
        score += best * 10.0

    if matched_tokens == len(q_tokens):
        score += 15.0
    return score


def score_query(meta_row: Dict[str, Any], query: Any) -> Optional[float]:
    pq = prepare_query(query)
    if pq is None:
        return 0.0
    pm = prepare_search_meta(meta_row)
    if pm is None:
        return None
    return score_prepared(pm, pq)
