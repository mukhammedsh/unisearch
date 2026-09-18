import re
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

TEXT_FIELD_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("name", 8.0),
    ("city", 4.5),
    ("country", 4.0),
    ("state", 3.5),
    ("description", 1.5),
)
LIST_FIELD_WEIGHTS: Tuple[Tuple[str, float], ...] = (
    ("search_aliases", 8.0),
    ("major_exact", 4.5),
    ("majors", 4.0),
    ("program_names", 3.5),
    ("tags", 3.0),
    ("study_levels", 2.0),
)
TOKEN_FUZZY_MIN_LEN = 4
FULL_TEXT_MATCH_BONUS = 40.0
NAME_MATCH_BONUS = 80.0
TOKEN_MATCH_MULTIPLIER = 10.0
ALL_TOKENS_MATCH_BONUS = 25.0

STOP_WORDS: Set[str] = {
    "in", "at", "the", "of", "for", "a", "an", "and", "or", "on", "by", "with", "to", "best", "top",
    "в", "во", "на", "и", "или", "с", "со", "из", "по", "для", "о", "об", "топ", "лучший", "лучшие", "топовые",
}

DOMAIN_SYNONYMS: Dict[str, str] = {
    "вуз": "университет",
    "вузы": "университет",
    "универ": "университет",
    "универы": "университет",
}

QWERTY_TO_JCUKEN: Dict[str, str] = {
    "q": "й", "w": "ц", "e": "у", "r": "к", "t": "е", "y": "н", "u": "г",
    "i": "ш", "o": "щ", "p": "з", "[": "х", "]": "ъ", "a": "ф", "s": "ы",
    "d": "в", "f": "а", "g": "п", "h": "р", "j": "о", "k": "л", "l": "д",
    ";": "ж", "'": "э", "z": "я", "x": "ч", "c": "с", "v": "м", "b": "и",
    "n": "т", "m": "ь", ",": "б", ".": "ю", "`": "ё",
}
JCUKEN_TO_QWERTY: Dict[str, str] = {v: k for k, v in QWERTY_TO_JCUKEN.items()}


def flip_keyboard_layout(text: str) -> str:
    res: List[str] = []
    for ch in str(text or "").lower():
        if ch in QWERTY_TO_JCUKEN:
            res.append(QWERTY_TO_JCUKEN[ch])
        elif ch in JCUKEN_TO_QWERTY:
            res.append(JCUKEN_TO_QWERTY[ch])
        else:
            res.append(ch)
    return "".join(res)


def stem_ru(word: str) -> str:
    word = word.lower().replace("ё", "е")
    rv_match = re.search(r"[аеиоуыэюя]", word)
    if not rv_match:
        return word
    rv_start = rv_match.end()
    r1_match = re.search(r"[аеиоуыэюя][^аеиоуыэюя]", word)
    r1_start = r1_match.end() if r1_match else len(word)
    r2_match = re.search(r"[аеиоуыэюя][^аеиоуыэюя]", word[r1_start:])
    r2_start = (r1_start + r2_match.end()) if r2_match else len(word)

    pre = word[:rv_start]
    rv = word[rv_start:]

    # Step 1: Perfective gerund, reflexive, adjectival, verb, noun
    m = re.search(r"([ая])(в|вши|вшись)$", rv)
    if m:
        rv = rv[: m.start() + 1]
    else:
        m = re.search(r"(ив|ивши|ившись|ыв|ывши|ывшись)$", rv)
        if m:
            rv = rv[: m.start()]
        else:
            m = re.search(r"(ся|сь)$", rv)
            if m:
                rv = rv[: m.start()]
            adj_m = re.search(
                r"(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$",
                rv,
            )
            if adj_m:
                rv = rv[: adj_m.start()]
                part_m = re.search(r"([ая])(ем|нн|вш|ющ|щ)$", rv)
                if part_m:
                    rv = rv[: part_m.start() + 1]
            else:
                verb_m1 = re.search(
                    r"([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$",
                    rv,
                )
                if verb_m1:
                    rv = rv[: verb_m1.start() + 1]
                else:
                    verb_m2 = re.search(
                        r"(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)$",
                        rv,
                    )
                    if verb_m2:
                        rv = rv[: verb_m2.start()]
                    else:
                        noun_m = re.search(
                            r"(а|ев|ов|е|ями|ами|еи|ии|ия|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ья|ьям|ьями)$",
                            rv,
                        )
                        if noun_m:
                            rv = rv[: noun_m.start()]

    if rv.endswith("и"):
        rv = rv[:-1]

    # Derivational
    r2_in_rv_start = max(0, r2_start - rv_start)
    if r2_in_rv_start < len(rv):
        rv_r2 = rv[r2_in_rv_start:]
        if rv_r2.endswith("ость"):
            rv = rv[:-4]
        elif rv_r2.endswith("ост"):
            rv = rv[:-3]

    # Superlative / soft sign / double n
    if rv.endswith("ейше"):
        rv = rv[:-4]
    elif rv.endswith("ейш"):
        rv = rv[:-3]

    if rv.endswith("нн"):
        rv = rv[:-1]
    elif rv.endswith("ь"):
        rv = rv[:-1]

    return pre + rv


def stem_en(word: str) -> str:
    w = word.lower()
    if len(w) <= 3:
        return w
    if w.endswith("sses"):
        w = w[:-2]
    elif w.endswith("ies") and len(w) > 4:
        w = w[:-3] + "y"
    elif w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        w = w[:-1]

    if w.endswith("eed") and len(w) > 4:
        w = w[:-1]
    elif (w.endswith("ed") or w.endswith("ing")) and len(w) > 4:
        for suffix in ("ed", "ing"):
            if w.endswith(suffix):
                stem_candidate = w[: -len(suffix)]
                if any(c in "aeiou" for c in stem_candidate):
                    w = stem_candidate
                    if w.endswith("at") or w.endswith("bl") or w.endswith("iz"):
                        w += "e"
                    elif len(w) >= 2 and w[-1] == w[-2] and w[-1] not in "lsz":
                        w = w[:-1]
                break

    if w.endswith("y") and len(w) > 3 and not any(w[-2] == c for c in "aeiou"):
        w = w[:-1] + "i"

    for suf, repl in (
        ("ational", "ate"),
        ("tional", "tion"),
        ("enci", "ence"),
        ("anci", "ance"),
        ("izer", "ize"),
        ("bli", "ble"),
        ("alli", "al"),
        ("entli", "ent"),
        ("eli", "e"),
        ("ousli", "ous"),
        ("ization", "ize"),
        ("ation", "ate"),
        ("ator", "ate"),
        ("alism", "al"),
        ("iveness", "ive"),
        ("fulness", "ful"),
        ("ousness", "ous"),
        ("aliti", "al"),
        ("iviti", "ive"),
        ("biliti", "ble"),
    ):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            w = w[: -len(suf)] + repl
            break

    return w


def stem(token: str) -> str:
    if not token:
        return ""
    if any("\u0400" <= c <= "\u04ff" for c in token):
        return stem_ru(token)
    return stem_en(token)


def damerau_levenshtein_distance(s1: str, s2: str) -> int:
    len1 = len(s1)
    len2 = len(s2)
    if abs(len1 - len2) > 2:
        return 999
    d: Dict[Tuple[int, int], int] = {}
    for i in range(-1, len1 + 1):
        d[(i, -1)] = i + 1
    for j in range(-1, len2 + 1):
        d[(-1, j)] = j + 1

    for i in range(len1):
        for j in range(len2):
            cost = 0 if s1[i] == s2[j] else 1
            d[(i, j)] = min(
                d[(i - 1, j)] + 1,
                d[(i, j - 1)] + 1,
                d[(i - 1, j - 1)] + cost,
            )
            if i > 0 and j > 0 and s1[i] == s2[j - 1] and s1[i - 1] == s2[j]:
                d[(i, j)] = min(d[(i, j)], d[(i - 2, j - 2)] + 1)

    return d[(len1 - 1, len2 - 1)]


def _normalize(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _tokens(value: Any) -> List[str]:
    return _normalize(value).split()


def _edit_distance_leq_one(a: str, b: str) -> bool:
    """Exact 1-edit distance check without transposition for compatibility."""
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
    q_len = len(query_token)
    q_st = stem(query_token)
    for cand in candidate_tokens:
        if not cand:
            continue
        if query_token == cand:
            return True
        c_len = len(cand)
        # Prefix match (min 3 chars)
        if q_len >= 3 and c_len > q_len and cand.startswith(query_token):
            return True
        # Stem match
        if q_len >= 3 and c_len >= 3:
            c_st = stem(cand)
            if q_st == c_st or (len(q_st) >= 4 and len(c_st) >= 4 and (q_st.startswith(c_st) or c_st.startswith(q_st))):
                return True
        # Typo match
        if q_len >= TOKEN_FUZZY_MIN_LEN and c_len >= TOKEN_FUZZY_MIN_LEN:
            if damerau_levenshtein_distance(query_token, cand) <= 1:
                return True
        # Substring ONLY for long tokens
        if q_len >= 5 and query_token in cand:
            return True
    return False


def prepare_query(query: Any) -> Optional[Dict[str, Any]]:
    if not (q_norm := _normalize(query)):
        return None
    raw_tokens = q_norm.split()
    if not raw_tokens:
        return None

    mapped_tokens = [DOMAIN_SYNONYMS.get(t, t) for t in raw_tokens]
    core_tokens = [t for t in mapped_tokens if t not in STOP_WORDS]
    if not core_tokens:
        core_tokens = mapped_tokens

    return {
        "q_norm": q_norm,
        "q_tokens": mapped_tokens,
        "core_tokens": core_tokens,
    }


def _append_text_bucket(
    weighted_token_sets: List[Tuple[str, float, List[str]]],
    full_chunks: List[str],
    field: str,
    value: Any,
    weight: float,
) -> None:
    if not (norm := _normalize(value)):
        return
    weighted_token_sets.append((field, weight, norm.split()))
    full_chunks.append(norm)


def _append_list_bucket(
    weighted_token_sets: List[Tuple[str, float, List[str]]],
    full_chunks: List[str],
    exact_aliases: Set[str],
    field: str,
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
        if field == "search_aliases":
            exact_aliases.add(norm)

    if token_bucket:
        weighted_token_sets.append((field, weight, token_bucket))


def prepare_search_meta(meta_row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    weighted_token_sets: List[Tuple[str, float, List[str]]] = []
    full_chunks: List[str] = []
    exact_aliases: Set[str] = set()

    for field, weight in TEXT_FIELD_WEIGHTS:
        _append_text_bucket(weighted_token_sets, full_chunks, field, meta_row.get(field, ""), weight)
    for field, weight in LIST_FIELD_WEIGHTS:
        _append_list_bucket(weighted_token_sets, full_chunks, exact_aliases, field, meta_row.get(field, []), weight)

    if not full_chunks:
        return None

    token_weights_exact: Dict[str, float] = {}
    token_stems_exact: Dict[str, float] = {}
    for _, weight, tokens in weighted_token_sets:
        for t in tokens:
            if t not in token_weights_exact or weight > token_weights_exact[t]:
                token_weights_exact[t] = weight
            st = stem(t)
            if st and (st not in token_stems_exact or weight > token_stems_exact[st]):
                token_stems_exact[st] = weight

    name_norm = _normalize(meta_row.get("name", ""))
    return {
        "weighted_token_sets": weighted_token_sets,
        "token_weights_exact": token_weights_exact,
        "token_stems_exact": token_stems_exact,
        "exact_aliases": exact_aliases,
        "full_text": " ".join(full_chunks),
        "name_text": name_norm,
    }


def _best_token_score(
    token: str,
    prepared_meta: Dict[str, Any],
) -> Tuple[float, float]:
    """Returns (best_weight, match_multiplier)"""
    exact_map = prepared_meta.get("token_weights_exact") or {}
    if token in exact_map:
        return exact_map[token], 1.0

    st = stem(token)
    stem_map = prepared_meta.get("token_stems_exact") or {}
    if st and st in stem_map and len(st) >= 3:
        return stem_map[st], 0.80

    best_weight = 0.0
    best_mult = 0.0
    q_len = len(token)

    for field, weight, bucket in prepared_meta.get("weighted_token_sets", []):
        is_alias = (field == "search_aliases")
        for cand in bucket:
            if not cand:
                continue
            c_len = len(cand)

            # Prefix match:
            # - For short 2-char tokens, ONLY allow prefix if cand is in search_aliases
            # - For 3+ char tokens, standard prefix match
            if c_len > q_len and cand.startswith(token):
                if q_len >= 3 or (q_len >= 2 and is_alias):
                    mult = 0.85
                    if weight * mult > best_weight * best_mult:
                        best_weight, best_mult = weight, mult

            # Stem prefix match for inflected Russian/English forms
            if q_len >= 4 and c_len >= 4:
                cand_st = stem(cand)
                if len(st) >= 4 and len(cand_st) >= 4:
                    if cand_st.startswith(st) or st.startswith(cand_st):
                        mult = 0.75
                        if weight * mult > best_weight * best_mult:
                            best_weight, best_mult = weight, mult

            # Typo match (Damerau-Levenshtein)
            if q_len >= 4 and c_len >= 4:
                max_d = 2 if (q_len >= 7 and c_len >= 7) else 1
                dist = damerau_levenshtein_distance(token, cand)
                if dist <= max_d:
                    mult = 0.60 if dist == 1 else 0.45
                    if weight * mult > best_weight * best_mult:
                        best_weight, best_mult = weight, mult

            # Substring match: strictly permitted only for tokens with len >= 5
            if q_len >= 5 and token in cand and not cand.startswith(token):
                mult = 0.35
                if weight * mult > best_weight * best_mult:
                    best_weight, best_mult = weight, mult

    return best_weight, best_mult


def score_prepared(prepared_meta: Dict[str, Any], prepared_query: Dict[str, Any]) -> Optional[float]:
    q_norm = prepared_query["q_norm"]
    q_tokens = prepared_query["q_tokens"]
    core_tokens = prepared_query.get("core_tokens", q_tokens)

    full_text = prepared_meta.get("full_text", "")
    name_text = prepared_meta.get("name_text", "")
    exact_aliases = prepared_meta.get("exact_aliases", set())

    score = 0.0

    # 1. Exact full query matches an alias -> massive boost
    if q_norm in exact_aliases:
        score += 220.0

    # 2. Exact full query matches university name -> massive boost
    if name_text and q_norm == name_text:
        score += 200.0
    elif name_text and q_norm in name_text:
        score += NAME_MATCH_BONUS

    if q_norm in full_text:
        score += FULL_TEXT_MATCH_BONUS

    # 3. Score tokens
    matched_core = 0
    token_score = 0.0
    for t in q_tokens:
        w, mult = _best_token_score(t, prepared_meta)
        if mult > 0:
            token_score += w * TOKEN_MATCH_MULTIPLIER * mult
            if t in core_tokens:
                matched_core += 1

    # Disqualification criteria:
    if matched_core == 0:
        return None
    if len(core_tokens) >= 3 and matched_core < 2:
        return None

    score += token_score

    # Coordinate bonus / soft match scaling
    if matched_core == len(core_tokens):
        score += ALL_TOKENS_MATCH_BONUS
    else:
        score *= (matched_core / len(core_tokens))

    return score
