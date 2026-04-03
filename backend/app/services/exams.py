import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Union

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


def _strip_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


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


def _config_entry(exam_key: Any) -> Dict[str, Any]:
    ensure_exams_cache()
    resolved = resolve_exam_key(exam_key)
    cfg = EXAMS_CONFIG.get(resolved) if resolved else None
    return cfg if isinstance(cfg, dict) else {}


def _input_mode(cfg: Dict[str, Any]) -> str:
    raw = str(cfg.get("input_mode") or "").strip().lower()
    if raw:
        return raw
    if str(cfg.get("type") or "").strip().lower() == "bool":
        return "flag"
    return "number"


def _normalization_config(exam_key: Any) -> Dict[str, Any]:
    cfg = _config_entry(exam_key)
    normalization = cfg.get("normalization")
    return normalization if isinstance(normalization, dict) else {}


def exam_supports_percentile_normalization(exam_key: Any) -> bool:
    normalization = _normalization_config(exam_key)
    if not normalization:
        return False
    if str(normalization.get("kind") or "").strip().lower() != "anchor_percentile":
        return False
    return bool(normalization.get("supports_user_scoring", True))


def _validate_numeric_score(exam_key: str, cfg: Dict[str, Any], score_raw: Any) -> Union[int, float]:
    t = str(cfg.get("type", "float")).lower()
    if score_raw is None or score_raw == "":
        raise ValueError(f"{exam_key} score is required")

    try:
        dv = _to_decimal(score_raw)
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid score format")

    mn = _to_decimal(cfg.get("min", 0))
    mx = _to_decimal(cfg.get("max", 0))

    if dv < mn or dv > mx:
        raise ValueError(f"Score must be between {mn} and {mx}")

    step = cfg.get("step", None)
    if step is not None:
        st = _to_decimal(step)
        q = (dv - mn) / st
        if q != q.to_integral_value():
            raise ValueError(f"Score must follow step={st}")

    if exam_key == "IELTS" and "decimals_allowed" in cfg:
        allowed = set(int(x) for x in cfg.get("decimals_allowed", []))
        tenth = int((dv * 10) % 10)
        if tenth not in allowed:
            raise ValueError("IELTS decimals must be .0 or .5")

    if t == "int":
        return int(dv)
    return float(dv)


def _coerce_flag_score(exam_key: str, score_raw: Any) -> int:
    if score_raw is None or score_raw == "":
        return 1
    text = _strip_text(score_raw).lower()
    if text in ("1", "true", "yes", "on"):
        return 1
    if text in ("0", "false", "no", "off"):
        return 0
    raise ValueError(f"{exam_key} must be 0 or 1")


def _grade_scheme(cfg: Dict[str, Any]) -> Dict[str, Any]:
    raw = cfg.get("grade_scheme")
    return raw if isinstance(raw, dict) else {}


def _normalize_grade_token(value: Any) -> str:
    raw = _strip_text(value).upper()
    if not raw:
        return ""
    raw = raw.replace("★", "*")
    raw = raw.replace("A STAR", "A*")
    raw = raw.replace("A-STAR", "A*")
    raw = raw.replace("ASTAR", "A*")
    raw = raw.replace(" ", "")
    return raw


def _parse_grade_combo_from_details(details: Any) -> List[str]:
    if not isinstance(details, dict):
        return []
    raw_grades = details.get("grades")
    if not isinstance(raw_grades, list):
        return []
    out: List[str] = []
    for item in raw_grades:
        token = _normalize_grade_token(item)
        if token:
            out.append(token)
    return out


def _parse_grade_combo_from_text(raw_value: Any, allowed: Dict[str, int]) -> List[str]:
    text = _strip_text(raw_value)
    if not text:
        return []
    compact = _normalize_grade_token(text)
    compact = re.sub(r"[,;/|+\-]+", "", compact)
    tokens = re.findall(r"A\*|[ABCDEU]", compact)
    if not tokens or "".join(tokens) != compact:
        raise ValueError("A-Level grades must use only A*, A, B, C, D, E, or U")
    for token in tokens:
        if token not in allowed:
            raise ValueError("A-Level grades must use only A*, A, B, C, D, E, or U")
    return tokens


def _coerce_grade_combo_submission(
    exam_key: str,
    cfg: Dict[str, Any],
    score_raw: Any = None,
    raw_value: Any = None,
    details: Any = None,
) -> Dict[str, Any]:
    scheme = _grade_scheme(cfg)
    allowed = {
        _normalize_grade_token(k): int(v)
        for k, v in (scheme.get("grade_points") or {}).items()
        if _normalize_grade_token(k)
    }
    if not allowed:
        raise ValueError(f"{exam_key} grade scheme is not configured")

    grades = _parse_grade_combo_from_details(details)
    if not grades:
        try:
            grades = _parse_grade_combo_from_text(raw_value, allowed)
        except ValueError:
            if raw_value not in (None, ""):
                raise
            grades = []

    if not grades and isinstance(score_raw, str):
        raw_text = _strip_text(score_raw)
        if raw_text and _to_float(raw_text) is None:
            grades = _parse_grade_combo_from_text(raw_text, allowed)

    if not grades:
        score = _validate_numeric_score(exam_key, cfg, score_raw)
        return {"exam": exam_key, "score": score}

    min_subjects = max(1, int(scheme.get("subject_count_min", 3) or 3))
    max_subjects = max(min_subjects, int(scheme.get("subject_count_max", min_subjects) or min_subjects))
    if len(grades) < min_subjects:
        raise ValueError(f"{exam_key} requires at least {min_subjects} grades")
    if len(grades) > max_subjects:
        raise ValueError(f"{exam_key} supports at most {max_subjects} grades")

    best_of = max(1, int(scheme.get("best_of", min_subjects) or min_subjects))
    points = [int(allowed[token]) for token in grades]
    best_points = sorted(points, reverse=True)[:best_of]
    score = int(sum(best_points))
    display_value = "".join(grades)

    return {
        "exam": exam_key,
        "score": score,
        "raw_value": display_value,
        "display_value": display_value,
        "details": {
            "grades": grades,
            "subjects_count": len(grades),
            "points_total": int(sum(points)),
            "points_best_of": int(sum(best_points)),
            "best_of": best_of,
        },
    }


def _level_scheme(cfg: Dict[str, Any]) -> Dict[str, Any]:
    raw = cfg.get("level_scheme")
    return raw if isinstance(raw, dict) else {}


def _level_bands(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    bands = _level_scheme(cfg).get("bands")
    return [row for row in bands if isinstance(row, dict)] if isinstance(bands, list) else []


def _normalize_level_label(value: Any) -> str:
    text = _strip_text(value).upper()
    if not text:
        return ""
    text = text.replace("LEVEL", "")
    text = text.replace(" ", "")
    return text


def _band_label_for_value(cfg: Dict[str, Any], score: Any) -> str:
    numeric = _to_num_int(score)
    if numeric is None:
        return ""
    for row in _level_bands(cfg):
        if _to_num_int(row.get("value")) == numeric:
            return _strip_text(row.get("short_label"))
    return ""


def _band_value_for_label(cfg: Dict[str, Any], raw_value: Any) -> Optional[int]:
    label = _normalize_level_label(raw_value)
    if not label:
        return None
    for row in _level_bands(cfg):
        short_label = _normalize_level_label(row.get("short_label"))
        numeric_value = _to_num_int(row.get("value"))
        if numeric_value is None:
            continue
        if label == short_label or label == str(numeric_value):
            return numeric_value
    return None


def _to_num_int(value: Any) -> Optional[int]:
    num = _to_float(value)
    if num is None:
        return None
    if abs(num - round(num)) > 1e-9:
        return None
    return int(round(num))


def _coerce_band_select_submission(
    exam_key: str,
    cfg: Dict[str, Any],
    score_raw: Any = None,
    raw_value: Any = None,
    details: Any = None,
) -> Dict[str, Any]:
    band_raw = raw_value
    if band_raw in (None, "") and isinstance(details, dict):
        band_raw = details.get("band") or details.get("label") or details.get("raw_value")
    if band_raw in (None, "") and isinstance(score_raw, str):
        numeric_score = _to_float(score_raw)
        if numeric_score is None:
            band_raw = score_raw

    band_value = _band_value_for_label(cfg, band_raw)
    if band_value is None:
        score = _validate_numeric_score(exam_key, cfg, score_raw)
        band_value = int(score)
    else:
        score = band_value

    short_label = _band_label_for_value(cfg, score)
    result = {"exam": exam_key, "score": int(score)}
    if short_label:
        result["raw_value"] = short_label
        result["display_value"] = short_label
        result["details"] = {"band": short_label}
    return result


def coerce_exam_submission(
    exam_key: Any,
    score_raw: Any = None,
    raw_value: Any = None,
    details: Any = None,
) -> Dict[str, Any]:
    """
    Coerce a raw exam submission into a canonical payload that scoring can use.

    Returns a dict with at least:
    - exam: canonical exam key
    - score: numeric score used by scoring

    Optional fields:
    - raw_value: user-facing raw value (e.g. A*A*A, 5**)
    - display_value: human-friendly value for UI
    - details: structured value metadata
    """
    ensure_exams_cache()
    key = resolve_exam_key(exam_key)
    if key not in EXAMS_CONFIG:
        raise ValueError(f"Unknown exam: {key}")

    cfg = EXAMS_CONFIG[key]
    mode = _input_mode(cfg)

    if mode == "grade_combo":
        return _coerce_grade_combo_submission(key, cfg, score_raw=score_raw, raw_value=raw_value, details=details)
    if mode == "band_select":
        return _coerce_band_select_submission(key, cfg, score_raw=score_raw, raw_value=raw_value, details=details)
    if mode == "flag" or str(cfg.get("type", "")).strip().lower() == "bool":
        return {"exam": key, "score": _coerce_flag_score(key, score_raw if score_raw not in (None, "") else raw_value)}

    return {"exam": key, "score": _validate_numeric_score(key, cfg, score_raw if score_raw not in (None, "") else raw_value)}


def normalize_exam_score(exam_key: Any, score_raw: Any) -> Optional[float]:
    """
    Normalize a raw exam score to a 0-100 percentile-like scale.

    Preferred path uses anchor_percentile metadata from exams.json:
    - min -> 0
    - p50 -> p50_percentile (default 50)
    - top5_min -> top5_percentile (default 95)
    - max -> 100

    Falls back to simple min/max scaling when percentile anchors are not
    available but the exam is still numeric.
    """
    ensure_exams_cache()
    resolved = resolve_exam_key(exam_key)
    cfg = EXAMS_CONFIG.get(resolved) if resolved else None
    if not isinstance(cfg, dict):
        return None

    exam_type = str(cfg.get("type") or "").strip().lower()
    mode = _input_mode(cfg)
    if exam_type == "bool" or mode == "flag":
        return None

    if mode in ("grade_combo", "band_select"):
        try:
            coerced = coerce_exam_submission(resolved, score_raw=score_raw)
        except ValueError:
            return None
        score = _to_float(coerced.get("score"))
    else:
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
    Validate and normalize a single exam input into the numeric score used
    by scoring. This compatibility wrapper keeps older callers working.
    """
    result = coerce_exam_submission(exam_key, score_raw=score_raw)
    score = result.get("score")
    numeric = _to_float(score)
    if numeric is None:
        raise ValueError("Invalid score format")
    cfg = _config_entry(exam_key)
    if str(cfg.get("type", "float")).lower() == "int":
        return int(round(numeric))
    return float(numeric)
