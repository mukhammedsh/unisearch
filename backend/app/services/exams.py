import json
from decimal import Decimal
from typing import Any, Dict, Optional, Union

from app.core.files import file_mtime
from app.core.paths import EXAMS_PATH


def load_exams_config() -> Dict[str, Dict[str, Any]]:
    if not EXAMS_PATH:
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


EXAMS_CONFIG: Dict[str, Dict[str, Any]] = {}
EXAM_WHITELIST: Dict[str, Any] = {}
_EXAMS_CACHE = {"mtime": None}


def ensure_exams_cache() -> None:
    global EXAMS_CONFIG, EXAM_WHITELIST
    mtime = file_mtime(EXAMS_PATH)
    if mtime is None:
        EXAMS_CONFIG = {}
        EXAM_WHITELIST = {}
        _EXAMS_CACHE["mtime"] = None
        return
    if mtime == _EXAMS_CACHE["mtime"]:
        return
    cfg = load_exams_config()
    EXAMS_CONFIG = cfg
    EXAM_WHITELIST = {
        k: (float(v.get("min", 0.0)), float(v.get("max", 0.0)))
        for k, v in EXAMS_CONFIG.items()
    }
    _EXAMS_CACHE["mtime"] = mtime


ensure_exams_cache()


def _canonical_exam_key(exam_id: Any) -> str:
    import re
    return re.sub(r"[^A-Z0-9]", "", str(exam_id or "").strip().upper())


EXAM_KEY_ALIASES = {
    "NUET": ["NUET_TOTAL"],
    "NUET_TOTAL": ["NUET"],
    "TOEFL": ["TOEFL_IBT", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
    "TOEFL_IBT": ["TOEFL", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
}


def resolve_exam_key(exam_id: Any) -> str:
    """
    Resolve user/data exam id to existing EXAMS_CONFIG key.
    Supports canonical matching and common aliases (e.g. NUET <-> NUET_TOTAL).
    """
    ensure_exams_cache()
    raw = str(exam_id or "").strip().upper()
    if not raw:
        return ""
    if raw in EXAMS_CONFIG:
        return raw

    target = _canonical_exam_key(raw)
    for k in EXAMS_CONFIG.keys():
        if _canonical_exam_key(k) == target:
            return k

    for a in EXAM_KEY_ALIASES.get(raw, []):
        alias = str(a).strip().upper()
        if alias in EXAMS_CONFIG:
            return alias
        alias_canon = _canonical_exam_key(alias)
        for k in EXAMS_CONFIG.keys():
            if _canonical_exam_key(k) == alias_canon:
                return k

    return raw


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
    ensure_exams_cache()
    exam_key = resolve_exam_key(exam_key)
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
        q = (dv - mn) / st
        if q != q.to_integral_value():
            raise ValueError(f"Score must follow step={st}")

    # IELTS decimals_allowed: [0,5] => .0 или .5
    if exam_key == "IELTS" and "decimals_allowed" in cfg:
        allowed = set(int(x) for x in cfg.get("decimals_allowed", []))
        tenth = int((dv * 10) % 10)
        if tenth not in allowed:
            raise ValueError("IELTS decimals must be .0 or .5")

    if t == "int":
        return int(dv)

    return float(dv)
