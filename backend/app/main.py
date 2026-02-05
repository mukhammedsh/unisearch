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
UNIMENTOR_GEMINI_FALLBACK_MODEL = os.getenv("UNIMENTOR_GEMINI_FALLBACK_MODEL", "gemini-2.0-flash-lite").strip() or "gemini-2.0-flash-lite"
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

def _mentor_fmt_num(v: Any) -> str:
    n = _to_float(v)
    if n is None:
        return "—"
    if abs(n - round(n)) < 1e-9:
        return str(int(round(n)))
    s = f"{n:.2f}"
    return s.rstrip("0").rstrip(".")

def _mentor_cefr_label(v: Any) -> str:
    n = int(_to_float(v) or 0)
    mp = {1: "A1", 2: "A2", 3: "B1", 4: "B2", 5: "C1", 6: "C2"}
    return mp.get(n, str(v))

def _mentor_profile_state(profile: Dict[str, Any]) -> Dict[str, Any]:
    p = profile if isinstance(profile, dict) else {}
    scores: Dict[str, float] = {}
    for e in (p.get("exams", []) or []):
        if not isinstance(e, dict):
            continue
        exam_id = str(e.get("id") or e.get("exam") or "").strip()
        score = _to_float(e.get("score"))
        if not exam_id or score is None:
            continue
        k = exam_id.upper()
        prev = scores.get(k)
        scores[k] = score if prev is None else max(prev, score)

    langs: Dict[str, Dict[str, Any]] = {}
    for l in (p.get("languages", []) or []):
        if not isinstance(l, dict):
            continue
        code = str(l.get("code") or l.get("lang") or "").strip().lower()
        kind = str(l.get("kind") or "").strip().lower()
        if not code or not kind:
            continue
        st = langs.setdefault(code, {"native": False, "cefr": None, "exams": {}})
        if kind == "native":
            st["native"] = True
        elif kind == "cefr":
            lv = _to_float(l.get("level"))
            if lv is not None:
                cur = _to_float(st.get("cefr"))
                st["cefr"] = lv if cur is None else max(cur, lv)
        elif kind == "exam":
            exam_id = str(l.get("exam") or "").strip().upper()
            score = _to_float(l.get("score"))
            if exam_id and score is not None:
                prev = st["exams"].get(exam_id)
                st["exams"][exam_id] = score if prev is None else max(prev, score)
                # Language exam is still an exam score in global exam space.
                prev2 = scores.get(exam_id)
                scores[exam_id] = score if prev2 is None else max(prev2, score)

    has_lang = any(v.get("native") or v.get("cefr") is not None or (v.get("exams") or {}) for v in langs.values())
    return {
        "scores": scores,
        "languages": langs,
        "budget": _to_float(p.get("budget")),
        "major": str(p.get("major", "")).strip(),
        "has_evidence": bool(scores) or bool(has_lang),
    }

def _mentor_pick_score(scores: Dict[str, float], exam_id: str) -> Optional[float]:
    key = str(exam_id or "").strip().upper()
    if not key:
        return None
    return _to_float(scores.get(key))

def _mentor_language_rules(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = track.get("language_requirements")
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        if isinstance(raw.get("items"), list):
            return [x for x in raw.get("items", []) if isinstance(x, dict)]
        out = []
        for code, cfg in raw.items():
            if isinstance(cfg, dict):
                row = {"code": code}
                row.update(cfg)
                out.append(row)
        return out
    return []

def _mentor_eval_lang_rule(rule: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    code = str(rule.get("code", "")).strip().lower()
    lang = (state.get("languages", {}) or {}).get(code, {"native": False, "cefr": None, "exams": {}})
    global_scores = state.get("scores", {}) or {}

    if bool(rule.get("accept_native")) and bool(lang.get("native")):
        return {"pass": True, "summary": f"{code.upper()}: native accepted.", "missing": []}

    min_cefr = _to_float(rule.get("min_cefr"))
    user_cefr = _to_float(lang.get("cefr"))
    if min_cefr is not None and user_cefr is not None and user_cefr + 1e-9 >= min_cefr:
        return {
            "pass": True,
            "summary": f"{code.upper()}: CEFR {_mentor_cefr_label(user_cefr)} meets minimum {_mentor_cefr_label(min_cefr)}.",
            "missing": [],
        }

    reqs = rule.get("requirements", {}) or {}
    if isinstance(reqs, dict) and reqs:
        best_ok = None
        missing = []
        for ex, mn in reqs.items():
            ex_id = str(ex).strip().upper()
            min_v = _to_float(mn)
            if not ex_id or min_v is None:
                continue
            user = _to_float((lang.get("exams", {}) or {}).get(ex_id))
            if user is None:
                user = _mentor_pick_score(global_scores, ex_id)
            if user is not None and user + 1e-9 >= min_v:
                best_ok = f"{ex_id} {_mentor_fmt_num(user)} >= {_mentor_fmt_num(min_v)}"
                break
            if user is None:
                missing.append(f"{ex_id} >= {_mentor_fmt_num(min_v)}")
            else:
                missing.append(f"{ex_id} {_mentor_fmt_num(user)}/{_mentor_fmt_num(min_v)}")
        if best_ok:
            return {"pass": True, "summary": f"{code.upper()}: exam condition met ({best_ok}).", "missing": []}
        return {"pass": False, "summary": f"{code.upper()}: language exam condition is not met.", "missing": missing[:3]}

    missing = []
    if bool(rule.get("accept_native")) and not bool(lang.get("native")):
        missing.append(f"{code.upper()}: native proof")
    if min_cefr is not None and (user_cefr is None or user_cefr + 1e-9 < min_cefr):
        missing.append(f"{code.upper()}: CEFR >= {_mentor_cefr_label(min_cefr)}")
    if missing:
        return {"pass": False, "summary": f"{code.upper()}: language rule is not met.", "missing": missing}

    # No strict thresholds in rule. Treat as neutral pass.
    return {"pass": True, "summary": f"{code.upper()}: no strict language threshold listed.", "missing": []}

def _mentor_eval_language(track: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    rules = _mentor_language_rules(track)
    if not rules:
        return {"pass": True, "mode": "all", "summary": "No explicit language rules listed.", "missing": []}

    mode = str(track.get("language_requirements_mode", "all")).strip().lower()
    mode = "any" if mode == "any" else "all"
    results = [_mentor_eval_lang_rule(r, state) for r in rules]

    if mode == "any":
        ok = next((r for r in results if r.get("pass")), None)
        if ok:
            return {"pass": True, "mode": mode, "summary": f"Language mode is ANY. {ok.get('summary')}", "missing": []}
        miss = []
        for r in results:
            miss.extend(r.get("missing", []))
        return {"pass": False, "mode": mode, "summary": "Language mode is ANY, but none of the options is satisfied.", "missing": miss[:4]}

    all_pass = all(bool(r.get("pass")) for r in results)
    miss = []
    for r in results:
        miss.extend(r.get("missing", []))
    if all_pass:
        return {"pass": True, "mode": mode, "summary": "Language mode is ALL and all language rules are satisfied.", "missing": []}
    return {"pass": False, "mode": mode, "summary": "Language mode is ALL and at least one language rule is not met.", "missing": miss[:5]}

def _mentor_track_cost(track: Dict[str, Any], university_tuition: Any) -> Optional[float]:
    ov = (track.get("finance_override", {}) or {}).get("total_cost_year_usd")
    c = _to_float(ov)
    if c is not None:
        return c
    return _to_float(university_tuition)

def _mentor_eval_track(track: Dict[str, Any], university_tuition: Any, state: Dict[str, Any], idx: int) -> Dict[str, Any]:
    req = track.get("requirements", {}) or {}
    scores = state.get("scores", {}) or {}
    valid_req_items = [(str(k).strip().upper(), _to_float(v)) for k, v in req.items()]
    valid_req_items = [(k, v) for (k, v) in valid_req_items if k and v is not None]
    total = len(valid_req_items)

    passed = 0
    missing: List[str] = []
    below: List[str] = []
    for ex, mn in valid_req_items:
        user = _mentor_pick_score(scores, ex)
        if user is None:
            missing.append(f"{ex} >= {_mentor_fmt_num(mn)}")
            continue
        if user + 1e-9 < mn:
            below.append(f"{ex} {_mentor_fmt_num(user)}/{_mentor_fmt_num(mn)}")
            continue
        passed += 1

    academic_pass = (not missing) and (not below)
    academic_ratio = (passed / total) if total > 0 else 1.0
    lang = _mentor_eval_language(track, state)

    budget = _to_float(state.get("budget"))
    cost = _mentor_track_cost(track, university_tuition)
    affordable = True
    gap = 0.0
    affordability_score = 1.0
    if budget is not None and cost is not None:
        affordable = budget + 1e-9 >= cost
        gap = max(0.0, cost - budget)
        affordability_score = 1.0 if affordable else max(0.15, 1.0 - (gap / max(cost, 1.0)))

    lang_score = 1.0 if bool(lang.get("pass")) else 0.2
    score = 0.55 * academic_ratio + 0.30 * lang_score + 0.15 * affordability_score
    if academic_pass and bool(lang.get("pass")):
        score += 0.10
    score = max(0.0, min(1.0, score))

    label = str(track.get("label") or f"Track {idx + 1}")
    return {
        "label": label,
        "score": score,
        "academic_pass": academic_pass,
        "academic_ratio": academic_ratio,
        "missing": missing[:6],
        "below": below[:6],
        "language_pass": bool(lang.get("pass")),
        "language_summary": str(lang.get("summary", "")),
        "language_missing": (lang.get("missing", []) or [])[:6],
        "cost": cost,
        "affordable": affordable,
        "budget_gap": gap,
    }

def _mentor_best_track(university: Dict[str, Any], state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tracks = university.get("admission_tracks", []) or []
    if not tracks:
        return None
    tuition = (university.get("finance", {}) or {}).get("total_cost_year_usd")
    scored = [_mentor_eval_track(t, tuition, state, i) for i, t in enumerate(tracks)]
    scored.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {"best": scored[0], "tracks": scored}

def _mentor_detect_intent(question: str) -> str:
    q = str(question or "").lower()
    if any(k in q for k in ("help", "options", "what can i ask", "menu")):
        return "help"
    if any(k in q for k in ("improve", "increase chance", "roadmap", "strategy", "how to pass", "what should i do", "next step")):
        return "improve"
    if any(k in q for k in ("compare tracks", "compare", "all tracks", "track comparison", "best track")):
        return "compare"
    if any(k in q for k in ("cost", "tuition", "price", "budget", "fee")):
        return "cost"
    if any(k in q for k in ("scholarship", "grant", "aid", "financial aid")):
        return "scholarship"
    if any(k in q for k in ("language", "ielts", "toefl", "cefr", "jlpt", "testdaf", "native", "english")):
        return "language"
    if any(k in q for k in ("chance", "fit", "eligible", "can i", "pass", "my profile")):
        return "fit"
    if any(k in q for k in ("admission", "requirement", "exam", "sat", "gpa", "unt")):
        return "admission"
    if any(k in q for k in ("deadline", "apply", "application", "documents", "checklist")):
        return "checklist"
    return "general"

def _mentor_build_action_plan(best: Dict[str, Any], state: Dict[str, Any]) -> List[str]:
    items: List[str] = []

    # Missing exams.
    for m in (best.get("missing", []) or [])[:3]:
        mt = str(m)
        m1 = re.match(r"^([A-Z0-9_]+)\s*>=\s*([0-9.]+)$", mt)
        if m1:
            items.append(f"Add {m1.group(1)} score with target >= {m1.group(2)}.")
        else:
            items.append(f"Add requirement evidence: {mt}.")

    # Below minimum exams.
    for b in (best.get("below", []) or [])[:3]:
        bt = str(b)
        m2 = re.match(r"^([A-Z0-9_]+)\s*([0-9.]+)/([0-9.]+)$", bt)
        if m2:
            ex = m2.group(1)
            cur = _to_float(m2.group(2)) or 0.0
            need = _to_float(m2.group(3)) or cur
            gap = max(0.0, need - cur)
            items.append(f"Increase {ex} from {_mentor_fmt_num(cur)} to at least {_mentor_fmt_num(need)} (+{_mentor_fmt_num(gap)}).")
        else:
            items.append(f"Raise score to meet minimum: {bt}.")

    # Language blockers.
    if not bool(best.get("language_pass")):
        lm = (best.get("language_missing", []) or [])[:3]
        if lm:
            items.append("Satisfy language proof: " + "; ".join([str(x) for x in lm]) + ".")
        else:
            items.append("Add language evidence (native/CEFR/exam) for track requirements.")

    # Budget blocker.
    gap = _to_float(best.get("budget_gap")) or 0.0
    if gap > 0:
        items.append(f"Close annual budget gap of about ${int(round(gap)):,} (scholarship, aid, or lower-cost track).")

    # Profile completeness hints.
    if _to_float(state.get("budget")) is None:
        items.append("Set your yearly budget in Profile for affordability checks.")
    if not bool(state.get("has_evidence")):
        items.append("Add at least one academic exam and one language proof to unlock full analysis.")

    # Deduplicate, keep concise.
    seen = set()
    out = []
    for x in items:
        k = x.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(x.strip())
    return out[:6]

def _mentor_track_comparison_text(name: str, analysis: Optional[Dict[str, Any]]) -> str:
    if not analysis or not analysis.get("tracks"):
        return f"{name}: no track comparison available."
    rows = []
    for t in (analysis.get("tracks") or [])[:4]:
        fit = int(round((t.get("score", 0) or 0) * 100))
        status_parts = []
        status_parts.append("academic OK" if t.get("academic_pass") else "academic missing")
        status_parts.append("language OK" if t.get("language_pass") else "language missing")
        if t.get("affordable"):
            status_parts.append("budget OK")
        else:
            g = _to_float(t.get("budget_gap")) or 0
            status_parts.append(f"budget gap ${int(round(g)):,}")
        blocker = ""
        misses = (t.get("missing", []) or []) + (t.get("below", []) or []) + (t.get("language_missing", []) or [])
        if misses:
            blocker = f" | main blocker: {str(misses[0])}"
        rows.append(f"- {t.get('label', 'Track')}: fit {fit}% ({', '.join(status_parts)}){blocker}")
    return f"{name} track comparison:\n" + "\n".join(rows)

def _mentor_build_quick_options(university: Optional[Dict[str, Any]], profile: Dict[str, Any], intent: str = "general") -> List[str]:
    opts: List[str] = []
    has_uni = isinstance(university, dict)
    st = _mentor_profile_state(profile)
    has_evidence = bool(st.get("has_evidence"))

    if has_uni:
        opts.extend([
            "Show best track for my profile",
            "What requirements am I missing?",
            "Can my budget cover this university?",
            "Which language proof is enough?",
            "List scholarships and how to qualify",
            "How can I improve my chance fastest?",
            "Compare all tracks for my profile",
        ])
    else:
        opts.extend([
            "How should I build my profile first?",
            "How to compare universities by budget and prestige?",
            "What exams should I add for international admission?",
            "How do language requirements work (native/CEFR/exams)?",
        ])

    if not has_evidence:
        opts.insert(0, "What profile data should I add to get accurate advice?")
    if intent == "checklist":
        opts.insert(0, "Give me a step-by-step application checklist")
    if intent == "improve":
        opts.insert(0, "Build a priority improvement roadmap")
    if intent == "compare":
        opts.insert(0, "Which track is best for me now?")

    # Deduplicate while preserving order.
    seen = set()
    out = []
    for x in opts:
        k = x.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(x.strip())
    return out[:6]

def _mentor_university_answer(university: Dict[str, Any], question: str, profile: Optional[Dict[str, Any]] = None) -> str:
    name = university.get("name", "This university")
    loc = university.get("location", {}) or {}
    country = loc.get("country", "Unknown")
    city = loc.get("city", "Unknown city")
    rank = university.get("rank", None)
    finance = university.get("finance", {}) or {}
    tuition = _to_float(finance.get("total_cost_year_usd", None))
    tracks = university.get("admission_tracks", []) or []
    intent = _mentor_detect_intent(question)
    state = _mentor_profile_state(profile or {})
    analysis = _mentor_best_track(university, state) if tracks else None
    best = (analysis or {}).get("best")

    if intent == "help":
        lines = [
            f"{name}: I can do profile-aware checks from local data.",
            "You can ask me about:",
            "1) best track for your profile",
            "2) missing admission requirements",
            "3) language proof status (native / CEFR / exam)",
            "4) budget affordability and gap",
            "5) scholarships and readiness",
            "6) improvement roadmap to increase your chance",
        ]
        if not state.get("has_evidence"):
            lines.append("Tip: add exams + language proof in Profile for personalized analysis.")
        return "\n".join(lines)

    if intent == "cost":
        cheapest = min((_mentor_track_cost(t, tuition) for t in tracks), default=tuition)
        budget = _to_float(state.get("budget"))
        if cheapest is not None and budget is not None:
            if budget + 1e-9 >= cheapest:
                return f"{name} cost check: estimated from ${int(round(cheapest)):,}/year, and your budget (${int(round(budget)):,}) can cover it. Ask me to compare costs by each track."
            gap = max(0.0, cheapest - budget)
            return f"{name} cost check: estimated from ${int(round(cheapest)):,}/year. Your budget is ${int(round(budget)):,}, so current gap is about ${int(round(gap)):,}. Ask me for scholarships and lower-cost track options."
        if cheapest is not None:
            return f"{name} cost check: estimated from ${int(round(cheapest)):,}/year. Add your budget in Profile to get a personalized affordability check."
        return f"{name} cost check: annual cost is not fully specified in the current dataset."

    if intent == "scholarship":
        grants = []
        for t in tracks:
            t_label = str(t.get("label", "Track"))
            for s in (t.get("scholarships", []) or []):
                if not isinstance(s, dict):
                    continue
                s_name = str(s.get("name", "")).strip()
                if not s_name:
                    continue
                req = s.get("requirements", {}) or {}
                miss = []
                for ex, mn in req.items():
                    u = _mentor_pick_score(state.get("scores", {}) or {}, str(ex))
                    m = _to_float(mn)
                    if m is None:
                        continue
                    if u is None or u + 1e-9 < m:
                        miss.append(f"{str(ex).upper()} >= {_mentor_fmt_num(m)}")
                if req and miss:
                    status = f"Not ready yet ({'; '.join(miss[:3])})"
                elif req:
                    status = "Likely eligible by listed score conditions"
                else:
                    status = "No strict score minimum listed"
                grants.append(f"{s_name} ({t_label}) - {status}")
        if grants:
            return f"{name} scholarship options:\n" + "\n".join([f"{i+1}. {g}" for i, g in enumerate(grants[:6])]) + "\nI can also rank these by how close you are to each requirement."
        return f"I do not see explicit scholarship entries for {name} in the current dataset."

    if intent == "language":
        if not tracks:
            return f"{name} has no detailed track language data in our dataset."
        rows = []
        for t in tracks[:5]:
            lr = _mentor_eval_language(t, state)
            mode = str(t.get("language_requirements_mode", "all")).upper()
            status = "OK" if lr.get("pass") else "NOT MET"
            row = f"{t.get('label', 'Track')} ({mode}) - {status}: {lr.get('summary', '')}"
            if not lr.get("pass") and lr.get("missing"):
                row += f" Missing: {', '.join((lr.get('missing') or [])[:3])}"
            rows.append(row)
        return f"{name} language requirement check:\n" + "\n".join([f"- {r}" for r in rows])

    if intent == "compare":
        return _mentor_track_comparison_text(name, analysis)

    if intent == "improve":
        if not tracks:
            return f"{name} has no detailed admission track data in our dataset."
        if not best:
            return f"Add exam/language data in Profile first, then I can build a personalized improvement roadmap for {name}."
        plan = _mentor_build_action_plan(best, state)
        if not plan:
            return f"Great baseline for {name}. Your current best track is '{best.get('label', 'Track')}' with local fit {int(round((best.get('score', 0) or 0) * 100))}%. Focus on confirming deadlines/documents and scholarship applications."
        lines = [
            f"{name} priority roadmap for '{best.get('label', 'Track')}' (current local fit {int(round((best.get('score', 0) or 0) * 100))}%):"
        ]
        lines.extend([f"{i+1}) {step}" for i, step in enumerate(plan[:6])])
        lines.append("After each update in Profile, ask again and I will re-rank priorities.")
        return "\n".join(lines)

    if intent in ("admission", "fit", "checklist"):
        if not tracks:
            return f"{name} has no detailed admission track data in our dataset."
        if not best:
            return f"{name} admission data exists, but I could not evaluate your profile. Add exams/languages in Profile and ask again."

        lines = [
            f"{name} profile-based admission check:",
            f"1) Best track now: {best.get('label', 'Track')} (local fit {int(round((best.get('score', 0) or 0) * 100))}%).",
        ]
        if best.get("academic_pass"):
            lines.append("2) Academic minimums: passed.")
        else:
            missing_parts = []
            if best.get("missing"):
                missing_parts.append("missing " + ", ".join(best.get("missing", [])[:3]))
            if best.get("below"):
                missing_parts.append("below minimum " + ", ".join(best.get("below", [])[:3]))
            lines.append("2) Academic minimums: not fully met (" + "; ".join(missing_parts) + ").")
        if best.get("language_pass"):
            lines.append("3) Language: requirement satisfied.")
        else:
            lm = ", ".join(best.get("language_missing", [])[:3]) or "language evidence is insufficient"
            lines.append(f"3) Language: not satisfied ({lm}).")

        budget = _to_float(state.get("budget"))
        cost = _to_float(best.get("cost"))
        if budget is not None and cost is not None:
            if budget + 1e-9 >= cost:
                lines.append(f"4) Budget: affordable for this track (${int(round(cost)):,}/year vs budget ${int(round(budget)):,}).")
            else:
                gap = max(0.0, cost - budget)
                lines.append(f"4) Budget: gap about ${int(round(gap)):,}/year (${int(round(cost)):,} vs ${int(round(budget)):,}).")
        else:
            lines.append("4) Budget: add your budget in Profile to get affordability advice.")

        if intent == "checklist":
            lines.extend([
                "5) Checklist: verify official track page, prepare required exam proofs, gather transcript/documents, and check deadlines.",
                "6) After each profile update, ask again to re-check missing requirements.",
            ])
        else:
            lines.append("5) Ask me for a priority improvement roadmap or track comparison.")
        return "\n".join(lines)

    # Help / general answer
    base = f"{name} is located in {city}, {country}."
    if isinstance(rank, int):
        base += f" Global rank in our dataset is #{rank}."
    if isinstance(tuition, (int, float)):
        base += f" Estimated annual cost starts around ${int(round(tuition)):,} USD."
    if tracks:
        base += f" We track {len(tracks)} admission pathway(s)."
    if best:
        base += f" Based on your current profile, best path is '{best.get('label', 'Track')}' ({int(round((best.get('score', 0) or 0)*100))}% local fit)."
    elif not state.get("has_evidence"):
        base += " Add exam/language profile data to get personalized admission analysis."
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

def _mentor_trim_error(text: str, limit: int = 240) -> str:
    msg = " ".join(str(text or "").split())
    if len(msg) <= limit:
        return msg
    return msg[: limit - 3] + "..."

def _mentor_allow_next_steps(intent: str) -> bool:
    return str(intent or "").strip().lower() in ("improve", "checklist")

def _mentor_strip_unsolicited_next_steps(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        return raw
    # Remove common "Next Steps" tails if model adds them without being asked.
    cleaned = re.sub(r"(?is)\n?\s*(next\s*steps?|recommended\s*next\s*steps?|action\s*plan)\s*:\s*.*$", "", raw).strip()
    return cleaned or raw

def _mentor_http_post_json(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    req = Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "UniSearch-UniMentor/1.0",
            "x-goog-api-key": GEMINI_API_KEY,
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=max(UNIMENTOR_TIMEOUT, 8.0)) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise RuntimeError("Gemini returned non-JSON response")
        return data
    except HTTPError as e:
        detail = ""
        try:
            raw = e.read().decode("utf-8", errors="ignore")
            parsed = json.loads(raw) if raw else {}
            if isinstance(parsed, dict):
                err = parsed.get("error", {}) or {}
                detail = str(err.get("message") or raw)
            else:
                detail = raw
        except Exception:
            detail = str(e)
        raise RuntimeError(f"Gemini HTTP {e.code}: {_mentor_trim_error(detail)}") from e
    except URLError as e:
        raise RuntimeError(f"Gemini network error: {_mentor_trim_error(str(getattr(e, 'reason', e)))}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini invalid JSON: {_mentor_trim_error(str(e))}") from e

def _mentor_call_gemini_for_model(model: str, question: str, university: Optional[Dict[str, Any]], profile: Dict[str, Any], online: bool, allow_next_steps: bool = False) -> Dict[str, Any]:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent"
    profile_ctx = _mentor_profile_summary(profile)
    uni_ctx = _mentor_university_summary(university)
    system_text = (
        f"You are {UNIMENTOR_NAME}, an admissions consultant for UniSearch. "
        "Use provided profile and university context first. "
        "Be concise, practical, and explicit about uncertainty. "
        "Output plain text only (no markdown symbols like **, *, #, or code blocks). "
        "Use short paragraphs and numbered steps when useful. "
        "Do not invent scholarships, deadlines, or hard requirements. "
        "If information is missing, say it clearly and suggest what to check on official university websites."
        "Do not provide unsolicited advice or plans."
        "Only answer the user’s explicit question."
        "Do not suggest admission plans, roadmaps, or next steps unless the user explicitly asks for them."
        "Do not add a 'Next Steps' section when the user did not request it."
    )
    user_payload = {
        "question": question,
        "user_profile": profile_ctx,
        "university_context": uni_ctx,
        "task": (
            "Answer only the user question directly."
            if not allow_next_steps
            else "Answer the question and include concise, concrete next steps."
        ),
    }
    body: Dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(user_payload, ensure_ascii=False)}]}],
        "generationConfig": {"temperature": 0.15, "maxOutputTokens": 700},
    }
    warning = ""
    data: Dict[str, Any]
    used_web_grounding = False
    if online and UNIMENTOR_GEMINI_ENABLE_WEB:
        body_with_tools = dict(body)
        body_with_tools["tools"] = [{"google_search": {}}]
        try:
            data = _mentor_http_post_json(endpoint, body_with_tools)
            used_web_grounding = True
        except RuntimeError as e:
            # Some projects/accounts/models reject google_search tool; retry without tool.
            warning = f"Gemini web grounding unavailable: {_mentor_trim_error(str(e))}"
            data = _mentor_http_post_json(endpoint, body)
    else:
        data = _mentor_http_post_json(endpoint, body)

    text = _mentor_parse_gemini_text(data)
    if not text:
        raise ValueError("Empty response from Gemini")
    return {
        "answer": text,
        "sources": _mentor_parse_gemini_sources(data),
        "model": model,
        "online_used": bool(used_web_grounding),
        "warning": warning,
    }

def _mentor_call_gemini(question: str, university: Optional[Dict[str, Any]], profile: Dict[str, Any], online: bool, mode: str = "auto", allow_next_steps: bool = False) -> Dict[str, Any]:
    primary = UNIMENTOR_GEMINI_MODEL
    fallback = UNIMENTOR_GEMINI_FALLBACK_MODEL
    mode_norm = str(mode or "auto").strip().lower()

    if mode_norm == "gemini":
        return _mentor_call_gemini_for_model(primary, question, university, profile, online, allow_next_steps=allow_next_steps)

    if mode_norm == "fallback":
        if not fallback:
            raise RuntimeError("Fallback model is not configured")
        return _mentor_call_gemini_for_model(fallback, question, university, profile, online, allow_next_steps=allow_next_steps)

    try:
        return _mentor_call_gemini_for_model(primary, question, university, profile, online, allow_next_steps=allow_next_steps)
    except RuntimeError as e:
        msg = str(e).lower()
        can_retry = ("http 429" in msg or "quota" in msg) and fallback and fallback != primary
        if not can_retry:
            raise
        res = _mentor_call_gemini_for_model(fallback, question, university, profile, online, allow_next_steps=allow_next_steps)
        prev = str(res.get("warning", "")).strip()
        note = f"Primary model quota reached; switched to fallback model: {fallback}."
        res["warning"] = (prev + " " + note).strip() if prev else note
        return res

def _mentor_resolve_mode(raw: Any) -> str:
    mode = str(raw or "auto").strip().lower()
    allowed = {"auto", "gemini", "fallback", "local"}
    return mode if mode in allowed else "auto"

@app.post("/mentor/ask")
def mentor_ask(payload: Dict[str, Any]):
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    university_id = str(payload.get("university_id", "")).strip()
    online = bool(payload.get("online", True))
    profile = payload.get("profile", {}) if isinstance(payload.get("profile"), dict) else {}
    mode = _mentor_resolve_mode(payload.get("mode"))

    university = _mentor_find_university(question, university_id)
    intent = _mentor_detect_intent(question)
    db_answer = _mentor_university_answer(university, question, profile) if university else "I could not match a specific university from your request. Ask me to help with profile setup, exam strategy, language requirements, or budget planning."
    quick_options = _mentor_build_quick_options(university, profile, intent)
    answer = db_answer
    web_sources: List[Dict[str, str]] = []
    online_used = False
    provider_used = "local"
    provider_requested = "local"
    model_used = "local-smart"
    warning = ""

    if mode == "local":
        use_gemini = False
        provider_requested = "local"
    elif mode == "gemini":
        use_gemini = True
        provider_requested = "gemini-primary"
    elif mode == "fallback":
        use_gemini = True
        provider_requested = "gemini-fallback"
    else:
        use_gemini = UNIMENTOR_PROVIDER in ("gemini", "auto")
        provider_requested = "gemini-auto" if use_gemini else "local"

    if use_gemini and GEMINI_API_KEY:
        try:
            gemini_mode = "auto"
            allow_next_steps = _mentor_allow_next_steps(intent)
            if mode == "gemini":
                gemini_mode = "gemini"
            elif mode == "fallback":
                gemini_mode = "fallback"
            g = _mentor_call_gemini(question, university, profile, online=online, mode=gemini_mode, allow_next_steps=allow_next_steps)
            answer = g["answer"]
            if not allow_next_steps:
                answer = _mentor_strip_unsolicited_next_steps(answer)
            web_sources = g.get("sources", []) or []
            online_used = bool(g.get("online_used", False))
            provider_used = "gemini"
            model_used = str(g.get("model") or "gemini")
            warning = str(g.get("warning", "")).strip()
        except Exception as e:
            web_sources = _mentor_online_context(university, question, online)
            answer = db_answer
            if web_sources:
                answer += " I also found extra context online; please verify official details directly on university websites."
            warning = f"Gemini fallback to local mode: {_mentor_trim_error(str(e) or type(e).__name__)}"
    else:
        web_sources = _mentor_online_context(university, question, online)
        if web_sources:
            answer += " I also found extra context online; please verify official details directly on university websites."
        if use_gemini and not GEMINI_API_KEY:
            warning = "Gemini fallback to local mode: missing GEMINI_API_KEY"

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
        "provider": provider_used,
        "provider_requested": provider_requested,
        "mode_selected": mode,
        "model_used": model_used,
        "warning": warning,
        "quick_options": quick_options,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
