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
    "ENT": ["UNT"],
    "NUET": ["NUET_TOTAL"],
    "NUET_TOTAL": ["NUET"],
    "TOEFL": ["TOEFL_IBT", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
    "TOEFL_IBT": ["TOEFL", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
    "WEIGHTED_TOTAL": ["HKDSE_WEIGHTED_TOTAL"],
    "HKDSE_WEIGHTED_TOTAL": ["WEIGHTED_TOTAL"],
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


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _normalization_config(exam_key: Any) -> Dict[str, Any]:
    ensure_exams_cache()
    resolved = resolve_exam_key(exam_key)
    cfg = EXAMS_CONFIG.get(resolved) if resolved else None
    if not isinstance(cfg, dict):
        return {}
    normalization = cfg.get("normalization")
    return normalization if isinstance(normalization, dict) else {}


def exam_supports_percentile_normalization(exam_key: Any) -> bool:
    normalization = _normalization_config(exam_key)
    if not normalization:
        return False
    if str(normalization.get("kind") or "").strip().lower() != "anchor_percentile":
        return False
    return bool(normalization.get("supports_user_scoring", True))


def normalize_exam_score(exam_key: Any, score_raw: Any) -> Optional[float]:
    """
    Normalize a raw exam score to a 0-100 percentile-like scale.

    Preferred path uses anchor_percentile metadata from exams.json:
    - min -> 0
    - p50 -> p50_percentile (default 50)
    - top5_min -> top5_percentile (default 95)
    - max -> 100

    Falls back to simple min/max scaling when percentile anchors are not
    available but the exam is still numeric. This keeps legacy numeric exams
    usable until better anchor data is added.
    """
    ensure_exams_cache()
    resolved = resolve_exam_key(exam_key)
    cfg = EXAMS_CONFIG.get(resolved) if resolved else None
    if not isinstance(cfg, dict):
        return None
    if str(cfg.get("type") or "").strip().lower() == "bool":
        return None

    score = _to_float(score_raw)
    mn = _to_float(cfg.get("min"))
    mx = _to_float(cfg.get("max"))
    if score is None or mn is None or mx is None or mx <= mn:
        return None

    normalization = _normalization_config(resolved)
    if str(normalization.get("kind") or "").strip().lower() == "anchor_percentile":
        p50 = _to_float(normalization.get("p50"))
        top5_min = _to_float(normalization.get("top5_min"))
        p50_pct = _to_float(normalization.get("p50_percentile"))
        top5_pct = _to_float(normalization.get("top5_percentile"))
        p50_pct = 50.0 if p50_pct is None else _clamp(p50_pct, 0.0, 100.0)
        top5_pct = 95.0 if top5_pct is None else _clamp(top5_pct, p50_pct, 100.0)

        if p50 is not None and top5_min is not None and mn <= p50 <= top5_min <= mx:
            if score <= p50:
                return _clamp(((score - mn) / max(p50 - mn, 1e-9)) * p50_pct, 0.0, 100.0)
            if score <= top5_min:
                return _clamp(
                    p50_pct + ((score - p50) / max(top5_min - p50, 1e-9)) * (top5_pct - p50_pct),
                    0.0,
                    100.0,
                )
            return _clamp(
                top5_pct + ((score - top5_min) / max(mx - top5_min, 1e-9)) * (100.0 - top5_pct),
                0.0,
                100.0,
            )

    return _clamp(((score - mn) / max(mx - mn, 1e-9)) * 100.0, 0.0, 100.0)


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
