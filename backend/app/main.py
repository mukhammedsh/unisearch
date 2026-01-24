from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import Any, Optional, List, Dict

app = FastAPI(title="UniSearch API", version="0.2.0")

# CORS (можно оставить "*", позже ограничите до localhost фронтенда)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_PATH = os.path.join(BASE_DIR, "data", "universities.json")


def load_universities() -> List[Dict[str, Any]]:
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("universities.json должен быть JSON-массивом")
    return data


def _safe_lower(x: Any) -> str:
    return str(x or "").strip().lower()


def _get_nested(u: Dict[str, Any], path: List[str], default=None):
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


def _contains_case_insensitive(haystack: Any, needle: str) -> bool:
    return _safe_lower(needle) in _safe_lower(haystack)


def _apply_sort(items: List[Dict[str, Any]], sort: str) -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    # helpers to read numeric fields safely
    def tuition(u: Dict[str, Any]) -> Optional[float]:
        return _to_float(_get_nested(u, ["finance", "tuition_year_usd"]))

    def acceptance(u: Dict[str, Any]) -> Optional[float]:
        return _to_float(_get_nested(u, ["academics", "acceptance_rate_percent"]))

    def gpa(u: Dict[str, Any]) -> Optional[float]:
        return _to_float(_get_nested(u, ["exams_avg", "GPA"]))

    def ielts(u: Dict[str, Any]) -> Optional[float]:
        return _to_float(_get_nested(u, ["exams_avg", "IELTS"]))

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(items, key=lambda u: (tuition(u) is None, tuition(u) or 0))

    if sort == "tuition_desc":
        return sorted(items, key=lambda u: (tuition(u) is None, -(tuition(u) or 0)))

    if sort == "acceptance_asc":
        return sorted(items, key=lambda u: (acceptance(u) is None, acceptance(u) or 0))

    if sort == "acceptance_desc":
        return sorted(items, key=lambda u: (acceptance(u) is None, -(acceptance(u) or 0)))

    if sort == "gpa_desc":
        return sorted(items, key=lambda u: (gpa(u) is None, -(gpa(u) or 0)))

    if sort == "ielts_desc":
        return sorted(items, key=lambda u: (ielts(u) is None, -(ielts(u) or 0)))

    # default (если не задано) — name_asc, чтобы было предсказуемо
    return sorted(items, key=lambda u: _safe_lower(u.get("name")))


@app.get("/")
def root():
    return {"status": "ok", "service": "uniesearch-backend", "storage": "json"}


@app.get("/universities")
def list_universities(
    # Поиск
    q: Optional[str] = None,

    # Location filters
    country: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,

    # Academics filters
    major: Optional[str] = None,           # matches academics.majors (contains)
    study_level: Optional[str] = None,     # matches academics.study_levels (exact-ish)
    format: Optional[str] = None,          # matches academics.formats (exact-ish)

    # Finance filters
    min_tuition: Optional[float] = Query(None, ge=0),
    max_tuition: Optional[float] = Query(None, ge=0),

    # Acceptance rate
    min_acceptance: Optional[float] = Query(None, ge=0),
    max_acceptance: Optional[float] = Query(None, ge=0),

    # Exams
    min_gpa: Optional[float] = Query(None, ge=0),
    max_gpa: Optional[float] = Query(None, ge=0),
    min_ielts: Optional[float] = Query(None, ge=0),
    max_ielts: Optional[float] = Query(None, ge=0),

    # Student life
    size: Optional[str] = None,            # matches student_life.size

    # Sorting & pagination
    sort: str = "name_asc",
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=500),
):
    items = load_universities()

    # 1) q search by name (contains)
    if q:
        qq = _safe_lower(q)
        items = [u for u in items if qq in _safe_lower(u.get("name"))]

    # 2) location filters
    if country:
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "country"])) == _safe_lower(country)]
    if city:
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "city"])) == _safe_lower(city)]
    if state:
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "state"])) == _safe_lower(state)]

    # 3) academics: majors
    if major:
        m = _safe_lower(major)
        def has_major(u: Dict[str, Any]) -> bool:
            majors = _get_nested(u, ["academics", "majors"], default=[])
            if not isinstance(majors, list):
                return False
            return any(m in _safe_lower(x) for x in majors)
        items = [u for u in items if has_major(u)]

    # 4) academics: study_levels
    if study_level:
        sl = _safe_lower(study_level)
        def has_level(u: Dict[str, Any]) -> bool:
            levels = _get_nested(u, ["academics", "study_levels"], default=[])
            if not isinstance(levels, list):
                return False
            return any(_safe_lower(x) == sl for x in levels)
        items = [u for u in items if has_level(u)]

    # 5) academics: formats
    if format:
        fm = _safe_lower(format)
        def has_format(u: Dict[str, Any]) -> bool:
            formats = _get_nested(u, ["academics", "formats"], default=[])
            if not isinstance(formats, list):
                return False
            return any(_safe_lower(x) == fm for x in formats)
        items = [u for u in items if has_format(u)]

    # 6) finance tuition range
    if min_tuition is not None or max_tuition is not None:
        def tuition_ok(u: Dict[str, Any]) -> bool:
            t = _to_float(_get_nested(u, ["finance", "tuition_year_usd"]))
            if t is None:
                return False
            if min_tuition is not None and t < min_tuition:
                return False
            if max_tuition is not None and t > max_tuition:
                return False
            return True
        items = [u for u in items if tuition_ok(u)]

    # 7) acceptance rate range
    if min_acceptance is not None or max_acceptance is not None:
        def acc_ok(u: Dict[str, Any]) -> bool:
            a = _to_float(_get_nested(u, ["academics", "acceptance_rate_percent"]))
            if a is None:
                return False
            if min_acceptance is not None and a < min_acceptance:
                return False
            if max_acceptance is not None and a > max_acceptance:
                return False
            return True
        items = [u for u in items if acc_ok(u)]

    # 8) GPA range
    if min_gpa is not None or max_gpa is not None:
        def gpa_ok(u: Dict[str, Any]) -> bool:
            g = _to_float(_get_nested(u, ["exams_avg", "GPA"]))
            if g is None:
                return False
            if min_gpa is not None and g < min_gpa:
                return False
            if max_gpa is not None and g > max_gpa:
                return False
            return True
        items = [u for u in items if gpa_ok(u)]

    # 9) IELTS range
    if min_ielts is not None or max_ielts is not None:
        def ielts_ok(u: Dict[str, Any]) -> bool:
            i = _to_float(_get_nested(u, ["exams_avg", "IELTS"]))
            if i is None:
                return False
            if min_ielts is not None and i < min_ielts:
                return False
            if max_ielts is not None and i > max_ielts:
                return False
            return True
        items = [u for u in items if ielts_ok(u)]

    # 10) student_life size
    if size:
        items = [u for u in items if _safe_lower(_get_nested(u, ["student_life", "size"])) == _safe_lower(size)]

    # Sort
    items = _apply_sort(items, sort)

    # Pagination
    total = len(items)
    start = (page - 1) * limit
    end = start + limit
    page_items = items[start:end] if start < total else []

    return {
        "items": page_items,
        "count": len(page_items),   # сколько вернули на этой странице
        "total": total,             # сколько всего после фильтров
        "page": page,
        "limit": limit,
        "sort": sort,
    }


@app.get("/universities/{university_id}")
def get_university(university_id: str):
    items = load_universities()
    uid = str(university_id)
    for u in items:
        if str(u.get("id")) == uid:
            return u
    raise HTTPException(status_code=404, detail="University not found")
