from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import Any, Optional, List, Dict, Union

# --- ВСТРОЕННАЯ КОНФИГУРАЦИЯ ---
EXAM_WHITELIST = {
    "IELTS": (0.0, 9.0),
    "TOEFL": (0.0, 120.0),
    "SAT": (400.0, 1600.0),
    "ACT": (1.0, 36.0),
    "GPA": (0.0, 100.0),
}

app = FastAPI(title="UniSearch AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- РАБОТА С ФАЙЛАМИ ---
# 1. Получаем папку, где лежит main.py (это папка 'app')
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Поднимаемся на уровень выше (в папку 'backend')
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# 3. Строим путь к JSON: backend -> data -> universities.json
DATA_PATH = os.path.join(BACKEND_DIR, "data", "universities.json")

def load_universities() -> List[Dict[str, Any]]:
    # Проверка основного пути
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception:
            return []
    
    # Проверка запасного пути (в корне)
    alt = os.path.join(BASE_DIR, "universities.json")
    if os.path.exists(alt):
        try:
            with open(alt, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
            
    return []

# --- БЕЗОПАСНЫЕ HELPER-ФУНКЦИИ ---

def _safe_lower(x: Any) -> str:
    """Безопасно приводит к строке и нижнему регистру."""
    if x is None:
        return ""
    return str(x).strip().lower()

def _get_nested(u: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    """Безопасно достает значение из вложенного словаря."""
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur

def _get_list(u: Dict[str, Any], path: List[str]) -> List[str]:
    """Гарантированно возвращает список, даже если в базе None."""
    val = _get_nested(u, path, [])
    if isinstance(val, list):
        return val
    return []

def _to_float(x: Any) -> Optional[float]:
    """Преобразует в float или возвращает None."""
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None

def _safe_compare_lte(value: Optional[float], threshold: float) -> bool:
    """
    Возвращает True, если value <= threshold.
    Если value равно None (данных нет), считаем, что условие НЕ выполнено (False),
    либо можно менять логику. Здесь: жесткий фильтр.
    """
    if value is None:
        return False
    return value <= threshold

def _safe_compare_gte(value: Optional[float], threshold: float) -> bool:
    """Возвращает True, если value >= threshold."""
    if value is None:
        return False
    return value >= threshold

# --- ЛОГИКА СОРТИРОВКИ ---
def _apply_sort(items: List[Dict[str, Any]], sort: str) -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    def get_val(u, path):
        return _to_float(_get_nested(u, path)) or 0.0

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))
        
    # Сортировка чисел. (val is None) нужно для того, чтобы None улетали в конец списка
    if sort == "tuition_asc":
        return sorted(items, key=lambda u: get_val(u, ["finance", "total_cost_year_usd"]))
    if sort == "tuition_desc":
        return sorted(items, key=lambda u: get_val(u, ["finance", "total_cost_year_usd"]), reverse=True)
        
    if sort == "acceptance_asc":
        return sorted(items, key=lambda u: get_val(u, ["academics", "acceptance_rate_percent"]))
    if sort == "acceptance_desc":
        return sorted(items, key=lambda u: get_val(u, ["academics", "acceptance_rate_percent"]), reverse=True)
        
    if sort == "gpa_desc":
        return sorted(items, key=lambda u: get_val(u, ["exams_avg", "GPA"]), reverse=True)
    
    return sorted(items, key=lambda u: _safe_lower(u.get("name")))

# --- API ENDPOINTS ---

@app.get("/")
def root():
    return {"status": "ok", "service": "uniesearch-backend-ai", "version": "1.0"}

@app.post("/exams/validate")
def validate_exam(payload: Dict[str, Any]):
    exam_raw = str(payload.get("exam", "")).strip()
    score_raw = payload.get("score", None)

    if not exam_raw:
        raise HTTPException(status_code=400, detail="Exam name is required")
    if score_raw is None or score_raw == "":
        raise HTTPException(status_code=400, detail="Score is required")

    try:
        score = float(score_raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Score must be a number")

    key = exam_raw.upper()
    if key not in EXAM_WHITELIST:
        raise HTTPException(status_code=400, detail=f"Unknown exam. Allowed: {list(EXAM_WHITELIST.keys())}")

    min_s, max_s = EXAM_WHITELIST[key]
    if score < min_s or score > max_s:
        raise HTTPException(status_code=400, detail=f"Score must be between {min_s} and {max_s}")

    return {"ok": True, "exam": key, "score": score}

@app.get("/universities")
def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    major: Optional[str] = None,
    study_level: Optional[str] = None,
    format: Optional[str] = None,

    # --- УМНЫЙ ФИЛЬТР (Оставляем только бюджет) ---
    user_budget: Optional[float] = Query(None, ge=0),
    
    # Старые фильтры по цене (на всякий случай можно оставить)
    min_tuition: Optional[float] = Query(None, ge=0), 
    max_tuition: Optional[float] = Query(None, ge=0),

    # Фильтры по Acceptance Rate (можно оставить или тоже убрать, если не нужны)
    min_acceptance: Optional[float] = Query(None, ge=0),
    max_acceptance: Optional[float] = Query(None, ge=0),

    # --- УДАЛЕНО: min_gpa, min_ielts и т.д. ---

    size: Optional[str] = None,
    sort: str = "name_asc",
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=500),
):
    items = load_universities()

    # 1. Text Search
    if q:
        qq = _safe_lower(q)
        items = [u for u in items if qq in _safe_lower(u.get("name"))]

    # 2. Location
    if country:
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "country"])) == _safe_lower(country)]
    if city:
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "city"])) == _safe_lower(city)]

    # 3. Academics
    if major:
        m = _safe_lower(major)
        items = [u for u in items if any(m in _safe_lower(x) for x in _get_list(u, ["academics", "majors"]))]
    
    if study_level:
        sl = _safe_lower(study_level)
        items = [u for u in items if any(_safe_lower(x) == sl for x in _get_list(u, ["academics", "study_levels"]))]

    if format:
        fm = _safe_lower(format)
        items = [u for u in items if any(_safe_lower(x) == fm for x in _get_list(u, ["academics", "formats"]))]

    # 4. EXAMS (УДАЛЕНО)
    # Здесь был блок Hard Filter, теперь мы пропускаем всех, 
    # чтобы ИИ потом сам решал, кого рекомендовать.

    # 5. FINANCE (Smart Logic)
    if user_budget is not None:
        filtered = []
        for u in items:
            cost = _to_float(_get_nested(u, ["finance", "total_cost_year_usd"])) or 999999.0
            aid = bool(_get_nested(u, ["finance", "financial_aid_available"], False))
            
            # Проходим, если цена ниже бюджета ИЛИ если есть грант
            if cost <= user_budget or aid:
                filtered.append(u)
        items = filtered
    
    # Старые фильтры цены (Range)
    if min_tuition is not None:
        items = [u for u in items if _safe_compare_gte(_to_float(_get_nested(u, ["finance", "total_cost_year_usd"])), min_tuition)]
    if max_tuition is not None:
        items = [u for u in items if _safe_compare_lte(_to_float(_get_nested(u, ["finance", "total_cost_year_usd"])), max_tuition)]

    # 6. Остальные фильтры
    if min_acceptance is not None:
        items = [u for u in items if _safe_compare_gte(_to_float(_get_nested(u, ["academics", "acceptance_rate_percent"])), min_acceptance)]
    if max_acceptance is not None:
        items = [u for u in items if _safe_compare_lte(_to_float(_get_nested(u, ["academics", "acceptance_rate_percent"])), max_acceptance)]
    
    if size:
        items = [u for u in items if _safe_lower(_get_nested(u, ["student_life", "size"])) == _safe_lower(size)]

    # 7. Sort & Paginate
    items = _apply_sort(items, sort)

    total = len(items)
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

@app.get("/universities/{university_id}")
def get_university(university_id: str):
    items = load_universities()
    uid = str(university_id)
    for u in items:
        if str(u.get("id")) == uid:
            return u
    raise HTTPException(status_code=404, detail="University not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)