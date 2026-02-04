from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import Any, Optional, List, Dict, Union
from decimal import Decimal
from pathlib import Path

app = FastAPI(title="UniSearch AI API", version="2.0.0")
FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5501"  # локально
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
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
CITIES_PATH = os.path.join(BACKEND_DIR, "data", "cities.json")

EXAMS_PATH = os.path.join(BACKEND_DIR, "data", "exams.json")

def load_exams_config() -> Dict[str, Dict[str, Any]]:
    """
    Загружает exams.json и возвращает конфиг с КЛЮЧАМИ в UPPERCASE:
    {
      "IELTS": {"min":0, "max":9, "type":"float", "step":0.5, ...},
      ...
    }
    """
    if not os.path.exists(EXAMS_PATH):
        return {}

    try:
        with open(EXAMS_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
            if not isinstance(raw, dict):
                return {}
            cfg = {}
            for k, v in raw.items():
                if isinstance(v, dict):
                    cfg[str(k).strip().upper()] = v
            return cfg
    except Exception:
        return {}

EXAMS_CONFIG = load_exams_config()

# Для совместимости с твоими эндпоинтами: min/max как раньше
EXAM_WHITELIST = {
    k: (float(v.get("min", 0.0)), float(v.get("max", 0.0)))
    for k, v in EXAMS_CONFIG.items()
}

def load_universities() -> List[Dict[str, Any]]:
    # Проверка основного пути
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
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
    return {"status": "ok", "service": "uniesearch-backend-ai", "version": "2.0"}

def _to_decimal(x: Any) -> Decimal:
    return Decimal(str(x).strip())

def validate_exam_value(exam_key: str, score_raw: Any) -> Union[int, float]:
    """
    Валидирует score по EXAMS_CONFIG:
    - диапазон min/max
    - step (если указан)
    - type: int/float/bool
    - спец-правило IELTS decimals_allowed (если задано)
    Возвращает нормализованное значение (int/float).
    """
    if exam_key not in EXAMS_CONFIG:
        raise ValueError(f"Unknown exam: {exam_key}")

    cfg = EXAMS_CONFIG[exam_key]
    t = str(cfg.get("type", "float")).lower()

    # bool
    if t == "bool":
        if str(score_raw).strip() in ("1", "true", "True"):
            return 1
        if str(score_raw).strip() in ("0", "false", "False"):
            return 0
        raise ValueError(f"{exam_key} must be 0 or 1")

    # numeric
    dv = _to_decimal(score_raw)
    mn = _to_decimal(cfg.get("min", 0))
    mx = _to_decimal(cfg.get("max", 0))

    if dv < mn or dv > mx:
        raise ValueError(f"Score must be between {mn} and {mx}")

    # step check (Decimal-safe)
    step = cfg.get("step", None)
    if step is not None:
        st = _to_decimal(step)
        # (dv - mn) must be multiple of st
        q = (dv - mn) / st
        if q != q.to_integral_value():
            raise ValueError(f"Score must follow step={st}")

    # IELTS decimals_allowed: [0,5] => .0 или .5
    if exam_key == "IELTS" and "decimals_allowed" in cfg:
        allowed = set(int(x) for x in cfg.get("decimals_allowed", []))
        # одна цифра после запятой: 6.5 -> 5
        tenth = int((dv * 10) % 10)
        if tenth not in allowed:
            raise ValueError("IELTS decimals must be .0 or .5")

    if t == "int":
        return int(dv)

    return float(dv)

def _build_languages_index(cfg: Dict[str, Any]) -> Dict[str, Any]:
    # languages: [{code,name,...}]
    langs_list = cfg.get("languages", [])
    codes = set()
    for l in langs_list:
        c = str(l.get("code", "")).strip().lower()
        if c:
            codes.add(c)

    # cefr: [{id, code, label}]
    cefr_list = cfg.get("cefr", [])
    cefr_map = {}
    for c in cefr_list:
        label = str(c.get("code", "")).strip().upper()  # A1..C2
        cid = c.get("id", None)
        if label and cid is not None:
            try:
                cefr_map[label] = int(cid)
            except Exception:
                pass

    # language_exams: { "en": [ {id,label,min,max,type,step,...}, ... ], ... }
    exams_by_lang = cfg.get("language_exams", {})
    if not isinstance(exams_by_lang, dict):
        exams_by_lang = {}

    return {
        "codes": codes,
        "cefr_map": cefr_map,
        "exams_by_lang": exams_by_lang
    }

def validate_language_exam_from_cfg(lang_cfg: Dict[str, Any], score_raw: Any) -> Union[int, float]:
    """
    Валидирует score по описанию экзамена в languages.json:
    - min/max
    - step
    - type: int/float
    - decimals_allowed (если задано)
    """
    t = str(lang_cfg.get("type", "float")).lower()

    dv = _to_decimal(score_raw)
    mn = _to_decimal(lang_cfg.get("min", 0))
    mx = _to_decimal(lang_cfg.get("max", 0))

    if dv < mn or dv > mx:
        raise ValueError(f"Score must be between {mn} and {mx}")

    step = lang_cfg.get("step", None)
    if step is not None:
        st = _to_decimal(step)
        q = (dv - mn) / st
        if q != q.to_integral_value():
            raise ValueError(f"Score must follow step={st}")

    # decimals_allowed: например IELTS .0/.5
    if "decimals_allowed" in lang_cfg:
        allowed = set(int(x) for x in (lang_cfg.get("decimals_allowed") or []))
        tenth = int((dv * 10) % 10)
        if tenth not in allowed:
            raise ValueError("Decimals not allowed for this exam")

    if t == "int":
        return int(dv)
    return float(dv)

@app.post("/exams/validate")
def validate_exam(payload: Dict[str, Any]):
    exam_raw = str(payload.get("exam", "")).strip()
    score_raw = payload.get("score", None)

    if not exam_raw:
        raise HTTPException(status_code=400, detail="Exam name is required")
    if score_raw is None or score_raw == "":
        raise HTTPException(status_code=400, detail="Score is required")

    key = exam_raw.strip().upper()

    try:
        score = validate_exam_value(key, score_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid score format")

    return {"ok": True, "exam": key, "score": score}

@app.get("/universities")
def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
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
    limit: int = Query(200, ge=1, le=2000),
):
    items = load_universities()

    # 1. Text Search
    if q:
        qq = _safe_lower(q)
        items = [u for u in items if qq in _safe_lower(u.get("name"))]

    # 2. Location
    if region:
        # Сравниваем параметр region с полем state в базе данных
        reg = _safe_lower(region)
        items = [u for u in items if _safe_lower(_get_nested(u, ["location", "state"])) == reg]
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
            fa = _get_nested(u, ["finance", "financial_aid"], {})
            aid = fa.get("merit_based") or fa.get("need_based")
            
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

@app.get("/locations")
def get_locations():
    """Отдает список стран и городов из backend/data/cities.json"""
    if os.path.exists(CITIES_PATH):
        try:
            with open(CITIES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading cities file: {e}")
            return {}
    return {}

@app.get("/exams/config")
def get_exam_config():
    """Отдает полный конфиг экзаменов (min/max/type/step/notes)."""
    return EXAMS_CONFIG

@app.get("/exams/config/full")
def get_exam_config_full():
    return EXAMS_CONFIG

LANGUAGES_PATH = os.path.join(BACKEND_DIR, "data", "languages.json")

def load_languages() -> Dict[str, Any]:
    if os.path.exists(LANGUAGES_PATH):
        try:
            with open(LANGUAGES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}
    return {}

LANGUAGES_CONFIG = load_languages()

@app.get("/languages/config")
def get_languages_config():
    if os.path.exists(LANGUAGES_PATH):
        try:
            with open(LANGUAGES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"version": 0, "cefr": [], "languages": [], "language_exams": {}, "waiver_rules": []}
    return {"version": 0, "cefr": [], "languages": [], "language_exams": {}, "waiver_rules": []}

@app.post("/languages/validate")
def validate_language(payload: Dict[str, Any]):
    # ВСЕГДА читаем актуальный languages.json (а не LANGUAGES_CONFIG, который грузится один раз)
    cfg = load_languages() or {}
    idx = _build_languages_index(cfg)

    code = str(payload.get("code", "")).strip().lower()
    kind = str(payload.get("kind", "")).strip().lower()

    if not code or code not in idx["codes"]:
        raise HTTPException(status_code=400, detail="Unknown language code")

    # поддерживаем только то, что реально используешь
    if kind not in ("native", "cefr", "exam"):
        raise HTTPException(status_code=400, detail="kind must be native/cefr/exam")

    # native — всегда можно
    if kind == "native":
        return {"ok": True, "language": {"code": code, "kind": "native"}}

    # cefr
    if kind == "cefr":
        level = payload.get("level", None)
        label = str(payload.get("label", "")).strip().upper()

        if (level is None or str(level).strip() == "") and label:
            if label not in idx["cefr_map"]:
                raise HTTPException(status_code=400, detail="Invalid CEFR label")
            level = idx["cefr_map"][label]

        # ✅ вот тут фикс для Pylance + защита от None/""
        level_str = str(level).strip()
        if level_str == "":
            raise HTTPException(status_code=400, detail="CEFR level is required (1..6)")

        try:
            level_i = int(level_str)
        except Exception:
            raise HTTPException(status_code=400, detail="CEFR level must be integer 1..6")

        if level_i < 1 or level_i > 6:
            raise HTTPException(status_code=400, detail="CEFR level must be 1..6")

        return {"ok": True, "language": {"code": code, "kind": "cefr", "level": level_i}}
    # exam — разрешаем только если у языка реально есть экзамены в languages.json
    exams = idx["exams_by_lang"].get(code, [])
    if not isinstance(exams, list) or len(exams) == 0:
        raise HTTPException(status_code=400, detail=f"{code} does not support kind=exam")

    exam_id = str(payload.get("exam", "")).strip()
    score_raw = payload.get("score", None)

    if not exam_id:
        raise HTTPException(status_code=400, detail="Exam id is required")
    if score_raw is None or score_raw == "":
        raise HTTPException(status_code=400, detail="Score is required")

    # ищем экзамен по id (как в languages.json)
    ex = None
    for e in exams:
        if str(e.get("id", "")).strip() == exam_id:
            ex = e
            break
    if ex is None:
        raise HTTPException(status_code=400, detail=f"Exam {exam_id} is not allowed for language {code}")

    try:
        score = validate_language_exam_from_cfg(ex, score_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid score format")

    return {"ok": True, "language": {"code": code, "kind": "exam", "exam": exam_id, "score": score}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
