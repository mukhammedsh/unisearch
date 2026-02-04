from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import re
from typing import Any, Optional, List, Dict, Union
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

def _load_local_env() -> None:
    """
    Minimal .env loader (no extra dependency).
    Looks for backend/.env and sets missing os.environ keys.
    """
    try:
        current_dir = Path(__file__).resolve().parent
        backend_dir = current_dir.parent
        env_path = backend_dir / ".env"
        if not env_path.exists():
            return
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            k = key.strip()
            v = value.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception:
        return

_load_local_env()

app = FastAPI(title="UniSearch AI API", version="2.0.0")
FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5501"  # локально
)
UNIMENTOR_NAME = os.getenv("UNIMENTOR_NAME", "UniMentor").strip() or "UniMentor"
UNIMENTOR_PROVIDER = os.getenv("UNIMENTOR_PROVIDER", "local").strip().lower() or "local"
UNIMENTOR_ENABLE_ONLINE = os.getenv("UNIMENTOR_ENABLE_ONLINE", "1").strip().lower() not in ("0", "false", "no")
UNIMENTOR_GEMINI_MODEL = os.getenv("UNIMENTOR_GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
UNIMENTOR_GEMINI_ENABLE_WEB = os.getenv("UNIMENTOR_GEMINI_ENABLE_WEB", "1").strip().lower() not in ("0", "false", "no")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
try:
    UNIMENTOR_TIMEOUT = float(os.getenv("UNIMENTOR_TIMEOUT", "6"))
except Exception:
    UNIMENTOR_TIMEOUT = 6.0

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

def _mentor_http_json(url: str) -> Optional[Dict[str, Any]]:
    try:
        req = Request(url, headers={"User-Agent": "UniSearch-UniMentor/1.0"})
        with urlopen(req, timeout=UNIMENTOR_TIMEOUT) as r:
            body = r.read().decode("utf-8", errors="ignore")
            data = json.loads(body)
            return data if isinstance(data, dict) else None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
    except Exception:
        return None

def _mentor_find_university(question: str, university_id: str = "") -> Optional[Dict[str, Any]]:
    items = load_universities()
    uid = str(university_id or "").strip().lower()
    if uid:
        for u in items:
            if str(u.get("id", "")).strip().lower() == uid:
                return u

    q = str(question or "").strip().lower()
    if not q:
        return None

    # Try direct name/id containment.
    for u in items:
        name = str(u.get("name", "")).lower()
        uid2 = str(u.get("id", "")).lower()
        if name and name in q:
            return u
        if uid2 and uid2 in q:
            return u

    # Fuzzy token overlap fallback.
    words = set(re.findall(r"[a-z0-9]+", q))
    best = None
    best_score = 0
    for u in items:
        tokens = set(re.findall(r"[a-z0-9]+", str(u.get("name", "")).lower()))
        if not tokens:
            continue
        score = len(words.intersection(tokens))
        if score > best_score:
            best = u
            best_score = score
    return best if best_score >= 2 else None

def _mentor_university_answer(university: Dict[str, Any], question: str) -> str:
    q = str(question or "").lower()
    name = university.get("name", "This university")
    loc = university.get("location", {}) or {}
    country = loc.get("country", "Unknown")
    city = loc.get("city", "Unknown city")
    rank = university.get("rank", None)
    finance = university.get("finance", {}) or {}
    tuition = finance.get("total_cost_year_usd", None)
    tracks = university.get("admission_tracks", []) or []

    if any(k in q for k in ("cost", "tuition", "price", "budget", "fee")):
        cost_line = f"Estimated annual cost is around ${tuition:,} USD." if isinstance(tuition, (int, float)) else "Annual cost is not fully specified."
        return f"{name}: {cost_line} I can also break down track-specific costs and scholarships if needed."

    if any(k in q for k in ("scholarship", "grant", "aid", "financial aid")):
        grants = []
        for t in tracks:
            for s in (t.get("scholarships", []) or []):
                title = s.get("name")
                if title:
                    grants.append(title)
        if grants:
            first = ", ".join(grants[:6])
            return f"{name} has these scholarship/aid options in our data: {first}."
        return f"I do not see explicit scholarship entries for {name} in the current dataset."

    if any(k in q for k in ("language", "ielts", "toefl", "cefr", "jlpt", "testdaf")):
        lines = []
        for t in tracks:
            lrs = t.get("language_requirements", []) or []
            if not lrs:
                continue
            mode = str(t.get("language_requirements_mode", "all")).upper()
            lines.append(f"{t.get('label', 'Track')} ({mode}) has {len(lrs)} language rule(s).")
        if lines:
            return f"{name} language requirements summary: " + " ".join(lines[:4]) + " Check Admission tab for full per-track details."
        return f"No structured language requirements are listed for {name} in our dataset."

    if any(k in q for k in ("admission", "requirement", "exam", "sat", "gpa", "unt")):
        if not tracks:
            return f"{name} has no detailed admission track data in our dataset."
        first = tracks[0]
        req = first.get("requirements", {}) or {}
        req_text = ", ".join([f"{k} >= {v}" for k, v in req.items()][:6]) or "No explicit minimum exam rules"
        return f"{name} admission overview: first track '{first.get('label', 'Track')}' requires {req_text}. There are {len(tracks)} track(s) in total."

    base = f"{name} is located in {city}, {country}."
    if isinstance(rank, int):
        base += f" Global rank in our dataset is #{rank}."
    if isinstance(tuition, (int, float)):
        base += f" Estimated annual cost is ${tuition:,} USD."
    if tracks:
        base += f" We track {len(tracks)} admission pathway(s)."
    return base

def _mentor_online_context(university: Optional[Dict[str, Any]], question: str, enabled: bool) -> List[Dict[str, str]]:
    if not enabled or not UNIMENTOR_ENABLE_ONLINE:
        return []

    q = str(question or "").strip()
    if not q:
        return []

    uni_name = str((university or {}).get("name", "")).strip()
    seed = f"{uni_name} {q}".strip()
    sources: List[Dict[str, str]] = []

    # Wikipedia summary (free, no key)
    if uni_name:
        wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(uni_name)}"
        wiki = _mentor_http_json(wiki_url)
        if wiki:
            extract = str(wiki.get("extract", "")).strip()
            page_url = ((wiki.get("content_urls") or {}).get("desktop") or {}).get("page", "")
            if extract:
                sources.append({
                    "title": f"Wikipedia: {uni_name}",
                    "url": str(page_url or f"https://en.wikipedia.org/wiki/{quote(uni_name)}"),
                    "snippet": extract[:500],
                })

    # DuckDuckGo Instant Answer (free, no key)
    ddg_params = urlencode({"q": seed, "format": "json", "no_html": "1", "skip_disambig": "1"})
    ddg_url = f"https://api.duckduckgo.com/?{ddg_params}"
    ddg = _mentor_http_json(ddg_url)
    if ddg:
        abstract = str(ddg.get("AbstractText", "")).strip()
        abstract_url = str(ddg.get("AbstractURL", "")).strip()
        heading = str(ddg.get("Heading", "")).strip() or "DuckDuckGo Instant Answer"
        if abstract:
            sources.append({
                "title": heading,
                "url": abstract_url or "https://duckduckgo.com/",
                "snippet": abstract[:500],
            })

    return sources[:4]

def _mentor_profile_summary(profile: Dict[str, Any]) -> Dict[str, Any]:
    p = profile if isinstance(profile, dict) else {}
    exams = []
    for e in (p.get("exams", []) or []):
        if not isinstance(e, dict):
            continue
        exam_id = str(e.get("id") or e.get("exam") or "").strip()
        score = e.get("score", None)
        if exam_id and score not in (None, ""):
            exams.append({"exam": exam_id, "score": score})

    langs = []
    for l in (p.get("languages", []) or []):
        if not isinstance(l, dict):
            continue
        code = str(l.get("code") or l.get("lang") or "").strip().lower()
        kind = str(l.get("kind") or "").strip().lower()
        if not code or not kind:
            continue
        row = {"code": code, "kind": kind}
        if kind == "cefr":
            row["level"] = l.get("level")
        if kind == "exam":
            row["exam"] = l.get("exam")
            row["score"] = l.get("score")
        langs.append(row)

    return {
        "name": str(p.get("name", "")).strip(),
        "major": str(p.get("major", "")).strip(),
        "study_mode": str(p.get("studyMode", "")).strip(),
        "budget_usd": p.get("budget", None),
        "exams": exams[:20],
        "languages": langs[:20],
    }

def _mentor_university_summary(university: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(university, dict):
        return {}
    tracks_raw = university.get("admission_tracks", []) or []
    tracks = []
    for t in tracks_raw[:6]:
        if not isinstance(t, dict):
            continue
        tracks.append({
            "id": t.get("id"),
            "label": t.get("label"),
            "requirements": t.get("requirements", {}) or {},
            "stats_avg": t.get("stats_avg", {}) or {},
            "language_requirements_mode": t.get("language_requirements_mode", "all"),
            "language_requirements": t.get("language_requirements", []) or [],
            "finance_override": (t.get("finance_override", {}) or {}).get("total_cost_year_usd"),
        })
    return {
        "id": university.get("id"),
        "name": university.get("name"),
        "website": university.get("website"),
        "location": university.get("location", {}) or {},
        "rank": university.get("rank"),
        "finance_total_cost_year_usd": (university.get("finance", {}) or {}).get("total_cost_year_usd"),
        "admission_tracks": tracks,
    }

def _mentor_parse_gemini_text(resp: Dict[str, Any]) -> str:
    if not isinstance(resp, dict):
        return ""
    out: List[str] = []
    for cand in (resp.get("candidates", []) or []):
        if not isinstance(cand, dict):
            continue
        content = cand.get("content", {}) or {}
        for part in (content.get("parts", []) or []):
            if isinstance(part, dict):
                txt = str(part.get("text", "")).strip()
                if txt:
                    out.append(txt)
    return "\n\n".join(out).strip()

def _mentor_parse_gemini_sources(resp: Dict[str, Any]) -> List[Dict[str, str]]:
    if not isinstance(resp, dict):
        return []
    seen: set = set()
    out: List[Dict[str, str]] = []

    def add(title: str, url: str):
        u = str(url or "").strip()
        if not u or u in seen:
            return
        seen.add(u)
        out.append({"title": str(title or "Web source").strip() or "Web source", "url": u})

    for cand in (resp.get("candidates", []) or []):
        if not isinstance(cand, dict):
            continue
        gm = cand.get("groundingMetadata") or cand.get("grounding_metadata") or {}
        chunks = gm.get("groundingChunks") or gm.get("grounding_chunks") or []
        for ch in (chunks or []):
            if not isinstance(ch, dict):
                continue
            web = ch.get("web", {}) or {}
            add(web.get("title", "Web source"), web.get("uri", ""))
        cm = cand.get("citationMetadata") or cand.get("citation_metadata") or {}
        for c in (cm.get("citations", []) or []):
            if isinstance(c, dict):
                add(c.get("title", "Citation"), c.get("uri", ""))
    return out[:5]

def _mentor_call_gemini(question: str, university: Optional[Dict[str, Any]], profile: Dict[str, Any], online: bool) -> Dict[str, Any]:
    model = UNIMENTOR_GEMINI_MODEL
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent?key={quote(GEMINI_API_KEY)}"
    profile_ctx = _mentor_profile_summary(profile)
    uni_ctx = _mentor_university_summary(university)
    system_text = (
        f"You are {UNIMENTOR_NAME}, an admissions consultant for UniSearch. "
        "Use provided profile and university context first. "
        "Be concise, practical, and explicit about uncertainty. "
        "Do not invent scholarships, deadlines, or hard requirements. "
        "If information is missing, say it clearly and suggest what to check on official university websites."
    )
    user_payload = {
        "question": question,
        "user_profile": profile_ctx,
        "university_context": uni_ctx,
        "task": "Answer the question and include concrete next steps for this applicant.",
    }
    body: Dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(user_payload, ensure_ascii=False)}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 700},
    }
    if online and UNIMENTOR_GEMINI_ENABLE_WEB:
        body["tools"] = [{"google_search": {}}]

    req = Request(
        endpoint,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "UniSearch-UniMentor/1.0"},
        method="POST",
    )
    with urlopen(req, timeout=max(UNIMENTOR_TIMEOUT, 8.0)) as r:
        raw = r.read().decode("utf-8", errors="ignore")
    data = json.loads(raw)
    text = _mentor_parse_gemini_text(data)
    if not text:
        raise ValueError("Empty response from Gemini")
    return {
        "answer": text,
        "sources": _mentor_parse_gemini_sources(data),
        "model": model,
        "online_used": bool(online and UNIMENTOR_GEMINI_ENABLE_WEB),
    }

@app.post("/mentor/ask")
def mentor_ask(payload: Dict[str, Any]):
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    university_id = str(payload.get("university_id", "")).strip()
    online = bool(payload.get("online", True))
    profile = payload.get("profile", {}) if isinstance(payload.get("profile"), dict) else {}

    university = _mentor_find_university(question, university_id)
    db_answer = _mentor_university_answer(university, question) if university else "I could not match a specific university from your request, but I can still answer general questions."
    answer = db_answer
    web_sources: List[Dict[str, str]] = []
    online_used = False

    use_gemini = UNIMENTOR_PROVIDER in ("gemini", "auto")
    if use_gemini and GEMINI_API_KEY:
        try:
            g = _mentor_call_gemini(question, university, profile, online=online)
            answer = g["answer"]
            web_sources = g.get("sources", []) or []
            online_used = bool(g.get("online_used", False))
        except Exception:
            web_sources = _mentor_online_context(university, question, online)
            answer = db_answer
            if web_sources:
                answer += " I also found extra context online; please verify official details directly on university websites."
    else:
        web_sources = _mentor_online_context(university, question, online)
        if web_sources:
            answer += " I also found extra context online; please verify official details directly on university websites."

    out_sources: List[Dict[str, str]] = []
    if university and str(university.get("website", "")).strip():
        out_sources.append({
            "title": f"{university.get('name', 'University')} official website",
            "url": str(university.get("website")),
        })
    for s in web_sources:
        out_sources.append({"title": s.get("title", "Source"), "url": s.get("url", "")})

    return {
        "assistant": UNIMENTOR_NAME,
        "answer": answer,
        "university_id": (university or {}).get("id", None),
        "sources": [s for s in out_sources if s.get("url")][:5],
        "online_used": bool(online_used or web_sources),
        "provider": "gemini" if (use_gemini and GEMINI_API_KEY) else "local",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
