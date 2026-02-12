import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.files import file_mtime
from app.core.paths import DATA_PATH, CITIES_PATH
from app.services import search as search_service


def _num_or_none(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None


def _uniq_non_empty(items: List[Any]) -> List[str]:
    out: List[str] = []
    seen = set()
    for it in items:
        s = str(it).strip()
        if not s:
            continue
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
    return out


def _safe_lower(x: Any) -> str:
    if x is None:
        return ""
    return str(x).strip().lower()


def _get_nested(u: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _get_list(u: Dict[str, Any], path: List[str]) -> List[str]:
    val = _get_nested(u, path, [])
    if isinstance(val, list):
        return val
    return []


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None


def _to_bool(x: Any) -> bool:
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return x != 0
    if isinstance(x, str):
        return x.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(x)


def _normalize_study_mode(value: Any) -> str:
    raw = _safe_lower(value)
    if not raw or raw == "any":
        return "any"
    if raw in {"on-campus", "on campus", "campus", "offline", "in-person", "hybrid", "blended", "mixed"}:
        return "on-campus"
    if raw in {"online", "distance", "remote", "online / distance"}:
        return "online"
    return "any"


def _normalize_cost_key(key: Any) -> str:
    return re.sub(r"[^a-z]", "", str(key or "").strip().lower())


def _mode_value_from_map(mode_map: Any, mode: str) -> Any:
    if not isinstance(mode_map, dict):
        return None
    target = _normalize_study_mode(mode)
    for key, value in mode_map.items():
        if _normalize_study_mode(key) == target:
            return value
    return None


def _mode_breakdown_from_finance(finance: Dict[str, Any], mode: str) -> Optional[Dict[str, Any]]:
    if not isinstance(finance, dict):
        return None
    for key in ("costs_breakdown_year_usd_by_mode", "costs_breakdown_by_mode_year_usd", "mode_costs_breakdown_year_usd"):
        val = _mode_value_from_map(finance.get(key), mode)
        if isinstance(val, dict):
            return val
    return None


def _mode_total_from_finance(finance: Dict[str, Any], mode: str) -> Optional[float]:
    if not isinstance(finance, dict):
        return None
    for key in ("total_cost_year_usd_by_mode", "total_cost_by_mode_year_usd", "mode_total_cost_year_usd"):
        val = _mode_value_from_map(finance.get(key), mode)
        amount = _to_float(val)
        if amount is not None and amount >= 0:
            return float(amount)
    return None


def _extract_tuition_cost(breakdown: Dict[str, Any]) -> Optional[float]:
    if not isinstance(breakdown, dict):
        return None
    for key, value in breakdown.items():
        if "tuition" in _normalize_cost_key(key):
            amount = _to_float(value)
            if amount is not None and amount >= 0:
                return amount
    return None


def _effective_university_cost(u: Dict[str, Any], format_preference: Any = "any") -> float:
    mode = _normalize_study_mode(format_preference)
    finance = u.get("finance") if isinstance(u.get("finance"), dict) else {}
    total = _to_float(finance.get("total_cost_year_usd")) or 0.0
    breakdown = finance.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    tuition = _extract_tuition_cost(breakdown)

    if mode == "online":
        mode_breakdown = _mode_breakdown_from_finance(finance, "online")
        mode_tuition = _extract_tuition_cost(mode_breakdown if isinstance(mode_breakdown, dict) else {})
        if mode_tuition is not None and mode_tuition >= 0:
            return max(0.0, mode_tuition)
        if tuition is not None and tuition >= 0:
            return max(0.0, tuition)
        mode_total = _mode_total_from_finance(finance, "online")
        if mode_total is not None and mode_total >= 0:
            return max(0.0, mode_total)
        return 0.0

    return max(0.0, total)


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

_MAJOR_PHRASES: Dict[str, List[str]] = {
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
    "natural sciences": ["natural sciences", "natural science", "chemistry", "earth science", "environmental science"],
    "economics": ["economics", "economy", "econometrics"],
    "physics": ["physics", "astrophysics"],
    "mathematics": ["mathematics", "math", "statistics", "actuarial"],
    "law": ["law", "legal", "jurisprudence", "llb", "jd"],
    "social sciences": ["social sciences", "social science", "sociology", "political science", "anthropology"],
    "architecture": ["architecture", "urban planning", "built environment"],
    "psychology": ["psychology", "psychological"],
    "humanities": ["humanities", "history", "philosophy", "linguistics", "literature", "classics"],
    "design": ["design", "graphic design", "industrial design", "interaction design", "ux", "ui", "product design"],
    "life sciences": ["life sciences", "life science", "biology", "biotechnology", "biomedical", "genetics", "neuroscience"],
    "education": ["education", "teaching", "pedagogy", "curriculum", "teacher"],
    "agriculture": ["agriculture", "agricultural", "agronomy", "horticulture"],
}


def _normalize_major_text(value: Any) -> str:
    text = _safe_lower(value).replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    pattern = r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, text) is not None


def _major_tags_from_text(value: Any) -> List[str]:
    text = _normalize_major_text(value)
    if not text:
        return []
    out: List[str] = []
    for canonical in _CANONICAL_MAJORS:
        phrases = _MAJOR_PHRASES.get(canonical, [canonical])
        if any(_contains_phrase(text, _normalize_major_text(p)) for p in phrases):
            out.append(canonical)
    return out


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


def _iter_programs(u: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = _get_nested(u, ["academics", "programs"], [])
    if not isinstance(raw, list):
        return []
    return [p for p in raw if isinstance(p, dict)]


def _normalize_university_schema(u: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adds backward-compatible academics fields for the new DB structure:
    - academics.programs[].name -> academics.majors
    - academics.programs[].study_levels -> academics.study_levels
    - academics.programs[].study_mode -> academics.formats
    - average(programs[].acceptance_rate_percent) -> academics.acceptance_rate_percent
    """
    if not isinstance(u, dict):
        return {}

    academics = u.get("academics")
    if not isinstance(academics, dict):
        academics = {}
        u["academics"] = academics

    programs_raw = academics.get("programs", [])
    programs = [p for p in programs_raw if isinstance(p, dict)] if isinstance(programs_raw, list) else []

    majors = academics.get("majors")
    if not isinstance(majors, list) or len(majors) == 0:
        academics["majors"] = _uniq_non_empty([p.get("name") for p in programs])

    study_levels = academics.get("study_levels")
    if not isinstance(study_levels, list) or len(study_levels) == 0:
        levels: List[Any] = []
        for p in programs:
            lv = p.get("study_levels")
            if isinstance(lv, list):
                levels.extend(lv)
            elif lv is not None:
                levels.append(lv)
        academics["study_levels"] = _uniq_non_empty(levels)

    formats = academics.get("formats")
    if not isinstance(formats, list) or len(formats) == 0:
        fmts: List[Any] = []
        for p in programs:
            mode = p.get("study_mode")
            if isinstance(mode, list):
                fmts.extend(mode)
            elif mode is not None:
                fmts.append(mode)
        academics["formats"] = _uniq_non_empty(fmts)

    acc = _num_or_none(academics.get("acceptance_rate_percent"))
    if acc is None:
        vals = []
        for p in programs:
            v = _num_or_none(p.get("acceptance_rate_percent"))
            if v is not None:
                vals.append(v)
        if vals:
            academics["acceptance_rate_percent"] = round(sum(vals) / len(vals), 2)

    return u


def _build_university_meta(u: Dict[str, Any]) -> Dict[str, Any]:
    programs = _iter_programs(u)
    majors = _get_list(u, ["academics", "majors"])
    explicit_major_tags = _get_list(u, ["academics", "major_tags"])
    study_levels = _get_list(u, ["academics", "study_levels"])
    formats = _get_list(u, ["academics", "formats"])

    program_names = [p.get("name") for p in programs]
    program_major_tags: List[Any] = []
    program_levels: List[Any] = []
    for p in programs:
        p_tags = p.get("major_tags")
        if isinstance(p_tags, list):
            program_major_tags.extend(p_tags)
        elif p_tags is not None:
            program_major_tags.append(p_tags)
        lv = p.get("study_levels")
        if isinstance(lv, list):
            program_levels.extend(lv)
        else:
            program_levels.append(lv)
    program_formats = [p.get("study_mode") for p in programs]
    major_exact = _uniq_non_empty(
        [
            tag
            for value in (majors + program_names + explicit_major_tags + program_major_tags)
            for tag in _major_tags_from_text(value)
        ]
    )

    return {
        "name": _safe_lower(u.get("name")),
        "country": _safe_lower(_get_nested(u, ["location", "country"])),
        "city": _safe_lower(_get_nested(u, ["location", "city"])),
        "state": _safe_lower(_get_nested(u, ["location", "state"])),
        "size": _safe_lower(_get_nested(u, ["student_life", "size"])),
        "majors": [_safe_lower(x) for x in majors if x],
        "program_names": [_safe_lower(x) for x in program_names if x],
        "major_exact": [_safe_lower(x) for x in major_exact if x],
        "study_levels": [_safe_lower(x) for x in study_levels if x] + [_safe_lower(x) for x in program_levels if x],
        "formats": [_safe_lower(x) for x in formats if x] + [_safe_lower(x) for x in program_formats if x],
    }


def _get_university_acceptance_rate(u: Dict[str, Any]) -> Optional[float]:
    direct = _to_float(_get_nested(u, ["academics", "acceptance_rate_percent"]))
    if direct is not None:
        return direct
    vals = []
    for p in _iter_programs(u):
        v = _to_float(p.get("acceptance_rate_percent"))
        if v is not None:
            vals.append(v)
    if vals:
        return sum(vals) / len(vals)
    return None


def _has_any_aid(u: Dict[str, Any]) -> bool:
    finance = u.get("finance")
    if isinstance(finance, dict):
        aid = finance.get("financial_aid")
        if isinstance(aid, dict):
            if _to_bool(aid.get("merit_based")) or _to_bool(aid.get("need_based")):
                return True

    tracks = u.get("admission_tracks")
    if not isinstance(tracks, list):
        return False

    for track in tracks:
        if not isinstance(track, dict):
            continue
        if _safe_lower(track.get("funding_type")) == "grant":
            return True
        scholarships = track.get("scholarships")
        if isinstance(scholarships, list) and len(scholarships) > 0:
            return True
    return False


def to_university_card(u: Dict[str, Any], format_preference: Any = "any") -> Dict[str, Any]:
    if not isinstance(u, dict):
        return {}

    location = u.get("location")
    location_obj = location if isinstance(location, dict) else {}
    finance = u.get("finance")
    finance_obj = finance if isinstance(finance, dict) else {}
    aid = finance_obj.get("financial_aid")
    aid_obj = aid if isinstance(aid, dict) else {}
    coordinates = u.get("coordinates")
    coordinates_obj = coordinates if isinstance(coordinates, dict) else {}

    out: Dict[str, Any] = {
        "id": u.get("id"),
        "name": u.get("name"),
        "rank": u.get("rank"),
        "website": u.get("website"),
        "location": {
            "country": location_obj.get("country"),
            "city": location_obj.get("city"),
            "state": location_obj.get("state"),
        },
        "finance": {
            "total_cost_year_usd": _effective_university_cost(u, format_preference=format_preference),
            "financial_aid": {
                "merit_based": _to_bool(aid_obj.get("merit_based")),
                "need_based": _to_bool(aid_obj.get("need_based")),
            },
        },
        "academics": {
            "acceptance_rate_percent": _get_university_acceptance_rate(u),
        },
        "aid_any": _has_any_aid(u),
    }

    lat = _to_float(coordinates_obj.get("lat"))
    lon = _to_float(coordinates_obj.get("lon"))
    if lat is not None and lon is not None:
        out["coordinates"] = {"lat": lat, "lon": lon}

    match_data = u.get("matchData")
    if isinstance(match_data, dict):
        out["matchData"] = match_data

    return out


def _project_universities(items: List[Dict[str, Any]], response_mode: str, format_preference: Any = "any") -> List[Dict[str, Any]]:
    mode = _safe_lower(response_mode)
    if mode == "card":
        return [to_university_card(u, format_preference=format_preference) for u in items]
    return items


def _safe_compare_lte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value <= threshold


def _safe_compare_gte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value >= threshold


def _apply_sort(items: List[Dict[str, Any]], sort: str, format_preference: Any = "any") -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    def get_val(u, path):
        return _to_float(_get_nested(u, path)) or 0.0

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(items, key=lambda u: _effective_university_cost(u, format_preference=format_preference))
    if sort == "tuition_desc":
        return sorted(items, key=lambda u: _effective_university_cost(u, format_preference=format_preference), reverse=True)

    if sort == "acceptance_asc":
        return sorted(items, key=lambda u: (_get_university_acceptance_rate(u) or 0.0))
    if sort == "acceptance_desc":
        return sorted(items, key=lambda u: (_get_university_acceptance_rate(u) or 0.0), reverse=True)

    if sort == "rank_asc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 999999.0))
    if sort == "rank_desc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 0.0), reverse=True)

    if sort == "gpa_desc":
        return sorted(items, key=lambda u: get_val(u, ["exams_avg", "GPA"]), reverse=True)

    return sorted(items, key=lambda u: _safe_lower(u.get("name")))


_UNI_CACHE = {"mtime": None, "data": [], "by_id": {}, "meta": []}


def _load_universities_cached() -> List[Dict[str, Any]]:
    mtime = file_mtime(DATA_PATH)
    if mtime is None:
        _UNI_CACHE["mtime"] = None
        _UNI_CACHE["data"] = []
        _UNI_CACHE["by_id"] = {}
        _UNI_CACHE["meta"] = []
        return []

    if mtime != _UNI_CACHE["mtime"]:
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = []
        except Exception:
            data = []

        out: List[Dict[str, Any]] = []
        meta_list: List[Dict[str, Any]] = []
        by_id: Dict[str, Dict[str, Any]] = {}
        for row in data:
            if not isinstance(row, dict):
                continue
            norm = _normalize_university_schema(row)
            out.append(norm)
            meta_list.append(_build_university_meta(norm))
            uid = str(norm.get("id", "")).strip()
            if uid:
                by_id[uid] = norm

        _UNI_CACHE["mtime"] = mtime
        _UNI_CACHE["data"] = out
        _UNI_CACHE["by_id"] = by_id
        _UNI_CACHE["meta"] = meta_list

    return _UNI_CACHE["data"]


def load_universities() -> List[Dict[str, Any]]:
    return _load_universities_cached()


def get_universities_with_meta() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    _load_universities_cached()
    return _UNI_CACHE["data"], _UNI_CACHE["meta"]


def get_university_by_id(university_id: str) -> Optional[Dict[str, Any]]:
    _load_universities_cached()
    return _UNI_CACHE["by_id"].get(str(university_id))


def get_university_etag(university_id: str) -> str:
    _load_universities_cached()
    mtime = _UNI_CACHE.get("mtime")
    mtime_key = "none" if mtime is None else str(mtime)
    uid = str(university_id or "").strip()
    digest = hashlib.sha1(f"{mtime_key}:{uid}".encode("utf-8")).hexdigest()
    return f"\"{digest}\""


_LOC_CACHE = {"mtime": None, "data": {}}


def get_locations() -> Dict[str, Any]:
    mtime = file_mtime(CITIES_PATH)
    if mtime is None:
        _LOC_CACHE["mtime"] = None
        _LOC_CACHE["data"] = {}
        return {}
    if mtime != _LOC_CACHE["mtime"]:
        try:
            with open(CITIES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            _LOC_CACHE["data"] = data if isinstance(data, dict) else {}
        except Exception:
            _LOC_CACHE["data"] = {}
        _LOC_CACHE["mtime"] = mtime
    return _LOC_CACHE["data"]


def get_stats() -> Dict[str, Any]:
    universities = load_universities()
    locations = get_locations()
    return {
        "universities_total": len(universities),
        "countries_total": len(locations.keys()) if isinstance(locations, dict) else 0,
    }


def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    major: Optional[str] = None,
    study_level: Optional[str] = None,
    funding_type: Optional[str] = None,
    format: Optional[str] = None,
    user_budget: Optional[float] = None,
    min_tuition: Optional[float] = None,
    max_tuition: Optional[float] = None,
    min_acceptance: Optional[float] = None,
    max_acceptance: Optional[float] = None,
    size: Optional[str] = None,
    sort: str = "name_asc",
    page: int = 1,
    limit: int = 200,
    paginate: bool = True,
    response_mode: str = "full",
) -> Dict[str, Any]:
    mode_pref = _normalize_study_mode(format or "any")
    items, meta = get_universities_with_meta()
    pairs = list(zip(items, meta))
    search_scores: Dict[str, float] = {}

    if q:
        scored_pairs = []
        for u, m in pairs:
            score = search_service.score_query(m, q)
            if score is None:
                continue
            uid = str(u.get("id", "")).strip() or f"@{id(u)}"
            search_scores[uid] = float(score)
            scored_pairs.append((u, m))
        pairs = scored_pairs

    if region:
        reg = _safe_lower(region)
        pairs = [(u, m) for (u, m) in pairs if m.get("state", "") == reg]
    if country:
        cc = _safe_lower(country)
        pairs = [(u, m) for (u, m) in pairs if m.get("country", "") == cc]
    if city:
        cc = _safe_lower(city)
        pairs = [(u, m) for (u, m) in pairs if m.get("city", "") == cc]

    if major:
        m_exact = _canonical_major(major)
        m_raw = _normalize_major_text(major)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if (
                (bool(m_exact) and any(x == m_exact for x in meta_row.get("major_exact", [])))
                or (
                    not m_exact
                    and (
                        any(_normalize_major_text(x) == m_raw for x in meta_row.get("majors", []))
                        or any(_normalize_major_text(x) == m_raw for x in meta_row.get("program_names", []))
                    )
                )
            )
        ]

    if study_level:
        sl = _safe_lower(study_level)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if any(x == sl for x in meta_row.get("study_levels", []))
        ]

    if format:
        fm = _safe_lower(format)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if any(x == fm for x in meta_row.get("formats", []))
        ]

    if funding_type:
        ft = _safe_lower(funding_type)
        if ft in {"grant", "paid"}:
            pairs = [
                (u, m)
                for (u, m) in pairs
                if any(
                    _safe_lower(t.get("funding_type")) == ft
                    for t in (u.get("admission_tracks") or [])
                    if isinstance(t, dict)
                )
            ]

    if user_budget is not None:
        filtered = []
        for u, m in pairs:
            cost = _effective_university_cost(u, format_preference=mode_pref) or 999999.0
            fa = _get_nested(u, ["finance", "financial_aid"], {})
            aid = fa.get("merit_based") or fa.get("need_based")
            if cost <= user_budget or aid:
                filtered.append((u, m))
        pairs = filtered

    if min_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_gte(_effective_university_cost(u, format_preference=mode_pref), min_tuition)
        ]
    if max_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_lte(_effective_university_cost(u, format_preference=mode_pref), max_tuition)
        ]

    if min_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_gte(_get_university_acceptance_rate(u), min_acceptance)]
    if max_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_lte(_get_university_acceptance_rate(u), max_acceptance)]

    if size:
        ss = _safe_lower(size)
        pairs = [(u, m) for (u, m) in pairs if m.get("size", "") == ss]

    items = [u for (u, _) in pairs]
    if q and sort == "name_asc":
        items = sorted(
            items,
            key=lambda u: (
                -(search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0)),
                _safe_lower(u.get("name")),
            ),
        )
    else:
        items = _apply_sort(items, sort, format_preference=mode_pref)

    total = len(items)
    if not paginate:
        view_items = _project_universities(items, response_mode=response_mode, format_preference=mode_pref)
        return {
            "items": view_items,
            "count": len(view_items),
            "total": total,
            "page": 1,
            "limit": total,
            "sort": sort,
        }

    start = (page - 1) * limit
    end = start + limit
    page_items = items[start:end] if start < total else []
    view_items = _project_universities(page_items, response_mode=response_mode, format_preference=mode_pref)

    return {
        "items": view_items,
        "count": len(view_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": sort,
    }
