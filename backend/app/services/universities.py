import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

from app.core.files import file_mtime
from app.core.paths import DATA_PATH, CITIES_PATH


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
    study_levels = _get_list(u, ["academics", "study_levels"])
    formats = _get_list(u, ["academics", "formats"])

    program_names = [p.get("name") for p in programs]
    program_levels: List[Any] = []
    for p in programs:
        lv = p.get("study_levels")
        if isinstance(lv, list):
            program_levels.extend(lv)
        else:
            program_levels.append(lv)
    program_formats = [p.get("study_mode") for p in programs]

    return {
        "name": _safe_lower(u.get("name")),
        "country": _safe_lower(_get_nested(u, ["location", "country"])),
        "city": _safe_lower(_get_nested(u, ["location", "city"])),
        "state": _safe_lower(_get_nested(u, ["location", "state"])),
        "size": _safe_lower(_get_nested(u, ["student_life", "size"])),
        "majors": [_safe_lower(x) for x in majors if x],
        "program_names": [_safe_lower(x) for x in program_names if x],
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


def _safe_compare_lte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value <= threshold


def _safe_compare_gte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value >= threshold


def _apply_sort(items: List[Dict[str, Any]], sort: str) -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    def get_val(u, path):
        return _to_float(_get_nested(u, path)) or 0.0

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(items, key=lambda u: get_val(u, ["finance", "total_cost_year_usd"]))
    if sort == "tuition_desc":
        return sorted(items, key=lambda u: get_val(u, ["finance", "total_cost_year_usd"]), reverse=True)

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
) -> Dict[str, Any]:
    items, meta = get_universities_with_meta()
    pairs = list(zip(items, meta))

    if q:
        qq = _safe_lower(q)
        pairs = [(u, m) for (u, m) in pairs if qq in m.get("name", "")]

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
        m = _safe_lower(major)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if (
                any(m in x for x in meta_row.get("majors", [])) or
                any(m in x for x in meta_row.get("program_names", []))
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
            cost = _to_float(_get_nested(u, ["finance", "total_cost_year_usd"])) or 999999.0
            fa = _get_nested(u, ["finance", "financial_aid"], {})
            aid = fa.get("merit_based") or fa.get("need_based")
            if cost <= user_budget or aid:
                filtered.append((u, m))
        pairs = filtered

    if min_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_gte(_to_float(_get_nested(u, ["finance", "total_cost_year_usd"])), min_tuition)
        ]
    if max_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_lte(_to_float(_get_nested(u, ["finance", "total_cost_year_usd"])), max_tuition)
        ]

    if min_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_gte(_get_university_acceptance_rate(u), min_acceptance)]
    if max_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_lte(_get_university_acceptance_rate(u), max_acceptance)]

    if size:
        ss = _safe_lower(size)
        pairs = [(u, m) for (u, m) in pairs if m.get("size", "") == ss]

    items = [u for (u, _) in pairs]
    items = _apply_sort(items, sort)

    total = len(items)
    if not paginate:
        return {
            "items": items,
            "count": total,
            "total": total,
            "page": 1,
            "limit": total,
            "sort": sort,
        }

    start = (page - 1) * limit
    end = start + limit
    page_items = items[start:end] if start < total else []

    return {
        "items": page_items,
        "count": len(page_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": sort,
    }
