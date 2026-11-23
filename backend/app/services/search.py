import re
from functools import lru_cache
from typing import Any

TEXT_FIELD_WEIGHTS: tuple[tuple[str, float], ...] = (
    ("name", 8.0),
    ("city", 4.5),
    ("country", 4.0),
    ("state", 3.5),
    ("description", 1.5),
)
LIST_FIELD_WEIGHTS: tuple[tuple[str, float], ...] = (
    ("search_aliases", 8.0),
    ("major_exact", 4.5),
    ("majors", 4.0),
    ("program_names", 3.5),
    ("tags", 3.0),
    ("study_levels", 2.0),
)
FULL_TEXT_MATCH_BONUS = 40.0
NAME_MATCH_BONUS = 80.0
TOKEN_MATCH_MULTIPLIER = 10.0
ALL_TOKENS_MATCH_BONUS = 25.0

STOP_WORDS: set[str] = {
    "in", "at", "the", "of", "for", "a", "an", "and", "or", "on", "by", "with", "to", "best", "top",
    "в", "во", "на", "и", "или", "с", "со", "из", "по", "для", "о", "об", "топ", "лучший", "лучшие", "топовые",
}

DOMAIN_SYNONYMS: dict[str, str] = {
    "вуз": "университет",
    "вузы": "университет",
    "универ": "университет",
    "универы": "университет",
}

QWERTY_TO_JCUKEN: dict[str, str] = {
    "q": "й", "w": "ц", "e": "у", "r": "к", "t": "е", "y": "н", "u": "г",
    "i": "ш", "o": "щ", "p": "з", "[": "х", "]": "ъ", "a": "ф", "s": "ы",
    "d": "в", "f": "а", "g": "п", "h": "р", "j": "о", "k": "л", "l": "д",
    ";": "ж", "'": "э", "z": "я", "x": "ч", "c": "с", "v": "м", "b": "и",
    "n": "т", "m": "ь", ",": "б", ".": "ю", "`": "ё",
}
JCUKEN_TO_QWERTY: dict[str, str] = {v: k for k, v in QWERTY_TO_JCUKEN.items()}

_RU_VOWEL_RE = re.compile(r"[аеиоуыэюя]")
_RU_R1_RE = re.compile(r"[аеиоуыэюя][^аеиоуыэюя]")
_RU_PG1_RE = re.compile(r"([ая])(в|вши|вшись)$")
_RU_PG2_RE = re.compile(r"(ив|ивши|ившись|ыв|ывши|ывшись)$")
_RU_REFL_RE = re.compile(r"(ся|сь)$")
_RU_ADJ_RE = re.compile(
    r"(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$"
)
_RU_PART_RE = re.compile(r"([ая])(ем|нн|вш|ющ|щ)$")
_RU_VERB1_RE = re.compile(r"([ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)$")
_RU_VERB2_RE = re.compile(
    r"(ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)$"
)
_RU_NOUN_RE = re.compile(
    r"(а|ев|ов|е|ями|ами|еи|ии|ия|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ья|ьям|ьями)$"
)

_NON_WORD_RE = re.compile(r"[^\w]+", flags=re.UNICODE)
_MULTI_SPACE_RE = re.compile(r"\s+")


def flip_keyboard_layout(text: str) -> str:
    res: list[str] = []
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
    rv_match = _RU_VOWEL_RE.search(word)
    if not rv_match:
        return word
    rv_start = rv_match.end()
    r1_match = _RU_R1_RE.search(word)
    r1_start = r1_match.end() if r1_match else len(word)
    r2_match = _RU_R1_RE.search(word[r1_start:])
    r2_start = (r1_start + r2_match.end()) if r2_match else len(word)

    pre = word[:rv_start]
    rv = word[rv_start:]

    # Step 1: Perfective gerund, reflexive, adjectival, verb, noun
    m = _RU_PG1_RE.search(rv)
    if m:
        rv = rv[: m.start() + 1]
    else:
        m = _RU_PG2_RE.search(rv)
        if m:
            rv = rv[: m.start()]
        else:
            m = _RU_REFL_RE.search(rv)
            if m:
                rv = rv[: m.start()]
            adj_m = _RU_ADJ_RE.search(rv)
            if adj_m:
                rv = rv[: adj_m.start()]
                part_m = _RU_PART_RE.search(rv)
                if part_m:
                    rv = rv[: part_m.start() + 1]
            else:
                verb_m1 = _RU_VERB1_RE.search(rv)
                if verb_m1:
                    rv = rv[: verb_m1.start() + 1]
                else:
                    verb_m2 = _RU_VERB2_RE.search(rv)
                    if verb_m2:
                        rv = rv[: verb_m2.start()]
                    else:
                        noun_m = _RU_NOUN_RE.search(rv)
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

    if rv.endswith("нн") or rv.endswith("ь"):
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


@lru_cache(maxsize=16384)
def stem(token: str) -> str:
    if not token:
        return ""
    if any("\u0400" <= c <= "\u04ff" for c in token):
        return stem_ru(token)
    return stem_en(token)


def damerau_levenshtein_distance(s1: str, s2: str, max_dist: int | None = None) -> int:
    len1 = len(s1)
    len2 = len(s2)
    limit = 2 if max_dist is None else max_dist
    if abs(len1 - len2) > limit:
        return 999 if max_dist is None else max_dist + 1

    if len1 == 0:
        return len2
    if len2 == 0:
        return len1

    prev1 = list(range(len2 + 1))
    prev2 = [len1 + len2 + 2] * (len2 + 1)
    curr = [0] * (len2 + 1)
    prev1_min = 0

    for i in range(len1):
        curr[0] = i + 1
        row_min = i + 1
        ch1 = s1[i]
        prev_ch1 = s1[i - 1] if i > 0 else ""

        for j in range(len2):
            col = j + 1
            ch2 = s2[j]
            cost = 0 if ch1 == ch2 else 1
            val = prev1[col] + 1
            ins = curr[col - 1] + 1
            sub = prev1[col - 1] + cost
            if ins < val:
                val = ins
            if sub < val:
                val = sub
            if i > 0 and j > 0 and ch1 == s2[j - 1] and prev_ch1 == ch2:
                trans = prev2[col - 2] + 1
                if trans < val:
                    val = trans
            curr[col] = val
            if val < row_min:
                row_min = val

        # Early cutoff preserves OSA exactness when bounded: rows i and i+1 cannot produce <= max_dist.
        if max_dist is not None and row_min > max_dist and prev1_min >= max_dist:
            return max_dist + 1

        prev1_min = row_min
        prev2, prev1, curr = prev1, curr, prev2

    return prev1[len2]


def _damerau_leq_one(a: str, b: str) -> bool:
    """Exact Optimal String Alignment distance <= 1 check (including single adjacent transposition)."""
    la = len(a)
    lb = len(b)
    if abs(la - lb) > 1:
        return False
    if a == b:
        return True
    if la > lb:
        a, b = b, a
        la, lb = lb, la

    limit = la
    i = 0
    while i < limit and a[i] == b[i]:
        i += 1

    if la == lb:
        if a[i + 1 :] == b[i + 1 :]:
            return True
        return (
            i + 1 < la
            and a[i] == b[i + 1]
            and a[i + 1] == b[i]
            and a[i + 2 :] == b[i + 2 :]
        )
    return a[i:] == b[i + 1 :]


def _normalize(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = _NON_WORD_RE.sub(" ", text)
    return _MULTI_SPACE_RE.sub(" ", text).strip()


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


def prepare_query(query: Any) -> dict[str, Any] | None:
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
        "core_tokens_set": frozenset(core_tokens),
    }


def _append_text_bucket(
    weighted_token_sets: list[tuple[str, float, list[str]]],
    full_chunks: list[str],
    field: str,
    value: Any,
    weight: float,
) -> None:
    if not (norm := _normalize(value)):
        return
    weighted_token_sets.append((field, weight, norm.split()))
    full_chunks.append(norm)


def _append_list_bucket(
    weighted_token_sets: list[tuple[str, float, list[str]]],
    full_chunks: list[str],
    exact_aliases: set[str],
    field: str,
    values: Any,
    weight: float,
) -> None:
    if not isinstance(values, list):
        return

    token_bucket: list[str] = []
    for value in values:
        if not (norm := _normalize(value)):
            continue
        token_bucket.extend(norm.split())
        full_chunks.append(norm)
        if field == "search_aliases":
            exact_aliases.add(norm)

    if token_bucket:
        weighted_token_sets.append((field, weight, token_bucket))


def prepare_search_meta(meta_row: dict[str, Any]) -> dict[str, Any] | None:
    weighted_token_sets: list[tuple[str, float, list[str]]] = []
    full_chunks: list[str] = []
    exact_aliases: set[str] = set()

    for field, weight in TEXT_FIELD_WEIGHTS:
        _append_text_bucket(weighted_token_sets, full_chunks, field, meta_row.get(field, ""), weight)
    for field, weight in LIST_FIELD_WEIGHTS:
        _append_list_bucket(weighted_token_sets, full_chunks, exact_aliases, field, meta_row.get(field, []), weight)

    if not full_chunks:
        return None

    token_weights_exact: dict[str, float] = {}
    token_stems_exact: dict[str, float] = {}
    alias_weights: dict[str, float] = {}
    for field, weight, tokens in weighted_token_sets:
        is_alias = field == "search_aliases"
        for t in tokens:
            if not t:
                continue
            if t not in token_weights_exact or weight > token_weights_exact[t]:
                token_weights_exact[t] = weight
            if is_alias and (t not in alias_weights or weight > alias_weights[t]):
                alias_weights[t] = weight
            st = stem(t)
            if st and (st not in token_stems_exact or weight > token_stems_exact[st]):
                token_stems_exact[st] = weight

    unique_candidates = sorted(
        ((t, weight, stem(t), len(t)) for t, weight in token_weights_exact.items()),
        key=lambda item: item[1],
        reverse=True,
    )
    alias_candidates = sorted(
        ((t, weight, len(t)) for t, weight in alias_weights.items()),
        key=lambda item: item[1],
        reverse=True,
    )

    name_norm = _normalize(meta_row.get("name", ""))
    return {
        "weighted_token_sets": weighted_token_sets,
        "token_weights_exact": token_weights_exact,
        "token_stems_exact": token_stems_exact,
        "unique_candidates": unique_candidates,
        "alias_candidates": alias_candidates,
        "exact_aliases": exact_aliases,
        "full_text": " ".join(full_chunks),
        "name_text": name_norm,
    }


def _best_token_score_from_indexed_candidates(
    token: str,
    st: str,
    q_len: int,
    unique_candidates: list[tuple[str, float, str, int]],
    alias_candidates: list[tuple[str, float, int]],
) -> tuple[float, float]:
    best_weight = 0.0
    best_mult = 0.0
    best_score = 0.0

    if q_len == 2:
        for cand, weight, c_len in alias_candidates:
            if weight * 0.85 <= best_score:
                break
            if c_len > 2 and cand.startswith(token):
                return weight, 0.85
        return 0.0, 0.0

    stem_enabled = q_len >= 4 and len(st) >= 4
    typo_enabled = q_len >= 4
    substr_enabled = q_len >= 5

    for cand, weight, cand_st, c_len in unique_candidates:
        if weight * 0.85 <= best_score:
            break

        if c_len > q_len and weight * 0.85 > best_score and cand.startswith(token):
            best_weight, best_mult = weight, 0.85
            best_score = weight * 0.85
            continue

        if (
            stem_enabled
            and c_len >= 4
            and weight * 0.75 > best_score
            and len(cand_st) >= 4
            and (cand_st.startswith(st) or st.startswith(cand_st))
        ):
            best_weight, best_mult = weight, 0.75
            best_score = weight * 0.75
            continue

        if typo_enabled and c_len >= 4 and weight * 0.60 > best_score:
            max_d = 2 if (q_len >= 7 and c_len >= 7) else 1
            if abs(q_len - c_len) <= max_d:
                if max_d == 1 or weight * 0.45 <= best_score:
                    if _damerau_leq_one(token, cand):
                        best_weight, best_mult = weight, 0.60
                        best_score = weight * 0.60
                        continue
                else:
                    dist = damerau_levenshtein_distance(token, cand, max_dist=2)
                    if dist <= 2:
                        mult = 0.60 if dist == 1 else 0.45
                        if weight * mult > best_score:
                            best_weight, best_mult = weight, mult
                            best_score = weight * mult
                        continue

        if substr_enabled and weight * 0.35 > best_score and token in cand and not cand.startswith(token):
            best_weight, best_mult = weight, 0.35
            best_score = weight * 0.35

    return best_weight, best_mult


def _best_token_score(
    token: str,
    prepared_meta: dict[str, Any],
) -> tuple[float, float]:
    """Returns (best_weight, match_multiplier)"""
    exact_map = prepared_meta.get("token_weights_exact") or {}
    if token in exact_map:
        return exact_map[token], 1.0

    st = stem(token)
    stem_map = prepared_meta.get("token_stems_exact") or {}
    if st and st in stem_map and len(st) >= 3:
        return stem_map[st], 0.80

    q_len = len(token)
    if q_len < 2:
        return 0.0, 0.0

    unique_candidates = prepared_meta.get("unique_candidates")
    if unique_candidates is not None:
        alias_candidates = prepared_meta.get("alias_candidates") or []
        return _best_token_score_from_indexed_candidates(
            token, st, q_len, unique_candidates, alias_candidates
        )

    best_weight = 0.0
    best_mult = 0.0

    for field, weight, bucket in prepared_meta.get("weighted_token_sets", []):
        is_alias = (field == "search_aliases")
        for cand in bucket:
            if not cand:
                continue
            c_len = len(cand)

            # Prefix match:
            # - For short 2-char tokens, ONLY allow prefix if cand is in search_aliases
            # - For 3+ char tokens, standard prefix match
            if c_len > q_len and cand.startswith(token) and (q_len >= 3 or is_alias):
                mult = 0.85
                if weight * mult > best_weight * best_mult:
                    best_weight, best_mult = weight, mult

            # Stem prefix match for inflected Russian/English forms
            if q_len >= 4 and c_len >= 4:
                cand_st = stem(cand)
                if len(st) >= 4 and len(cand_st) >= 4 and (cand_st.startswith(st) or st.startswith(cand_st)):
                    mult = 0.75
                    if weight * mult > best_weight * best_mult:
                        best_weight, best_mult = weight, mult

            # Typo match (Damerau-Levenshtein)
            if q_len >= 4 and c_len >= 4:
                max_d = 2 if (q_len >= 7 and c_len >= 7) else 1
                dist = damerau_levenshtein_distance(token, cand, max_dist=max_d)
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


def score_prepared(prepared_meta: dict[str, Any], prepared_query: dict[str, Any], *, require_all_terms: bool = False) -> float | None:
    q_norm = prepared_query["q_norm"]
    q_tokens = prepared_query["q_tokens"]
    core_tokens = prepared_query.get("core_tokens", q_tokens)
    core_tokens_set = prepared_query.get("core_tokens_set")
    if core_tokens_set is None:
        core_tokens_set = frozenset(core_tokens)

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
            if t in core_tokens_set:
                matched_core += 1

    # Disqualification criteria:
    if matched_core == 0:
        return None
    if require_all_terms and matched_core < len(core_tokens):
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
