import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Union

from app.core.files import file_mtime
from app.core.paths import EXAMS_PATH

EXAMS_CONFIG: Dict[str, Dict[str, Any]] = {}
EXAM_WHITELIST: Dict[str, Any] = {}
_EXAMS_CACHE = {"mtime": None}
EXAM_KEY_ALIASES = {
    "ENT": ["UNT"],
    "NUET": ["NUET_TOTAL"],
    "NUET_TOTAL": ["NUET"],
    "TOEFL": ["TOEFL_IBT", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
    "TOEFL_IBT": ["TOEFL", "TOEFL_IBT_0_120", "TOEFL_IBT_1_6"],
    "WEIGHTED_TOTAL": ["HKDSE_WEIGHTED_TOTAL"],
    "HKDSE_WEIGHTED_TOTAL": ["WEIGHTED_TOTAL"],
}


def load_exams_config() -> Dict[str, Dict[str, Any]]:
    if not EXAMS_PATH:
        return {}
    try:
        with open(EXAMS_PATH, "r", encoding="utf-8") as file:
            raw = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(raw, dict):
        return {}

    config: Dict[str, Dict[str, Any]] = {}
    for key, value in raw.items():
        if isinstance(value, dict):
            config[str(key).strip().upper()] = value
    return config


def ensure_exams_cache() -> None:
    mtime = file_mtime(EXAMS_PATH)
    if mtime is None:
        EXAMS_CONFIG.clear()
        EXAM_WHITELIST.clear()
        _EXAMS_CACHE["mtime"] = None
        return
    if mtime == _EXAMS_CACHE["mtime"]:
        return

    config = load_exams_config()
    EXAMS_CONFIG.clear()
    EXAMS_CONFIG.update(config)
    EXAM_WHITELIST.clear()
    EXAM_WHITELIST.update({
        key: (float(value.get("min", 0.0)), float(value.get("max", 0.0)))
        for key, value in EXAMS_CONFIG.items()
    })
    _EXAMS_CACHE["mtime"] = mtime


def canonical_exam_key(exam_id: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(exam_id or "").strip().upper())


def resolve_exam_key(exam_id: Any) -> str:
    ensure_exams_cache()
    raw = str(exam_id or "").strip().upper()
    if not raw:
        return ""
    if raw in EXAMS_CONFIG:
        return raw

    target = canonical_exam_key(raw)
    for key in EXAMS_CONFIG.keys():
        if canonical_exam_key(key) == target:
            return key

    for alias_value in EXAM_KEY_ALIASES.get(raw, []):
        alias = str(alias_value).strip().upper()
        if alias in EXAMS_CONFIG:
            return alias
        alias_target = canonical_exam_key(alias)
        for key in EXAMS_CONFIG.keys():
            if canonical_exam_key(key) == alias_target:
                return key

    return raw


def strip_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def to_decimal(value: Any) -> Decimal:
    return Decimal(str(value).strip())


def to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def config_entry(exam_key: Any) -> Dict[str, Any]:
    ensure_exams_cache()
    resolved = resolve_exam_key(exam_key)
    cfg = EXAMS_CONFIG.get(resolved) if resolved else None
    return cfg if isinstance(cfg, dict) else {}


def input_mode(cfg: Dict[str, Any]) -> str:
    raw = str(cfg.get("input_mode") or "").strip().lower()
    if raw:
        return raw
    if str(cfg.get("type") or "").strip().lower() == "bool":
        return "flag"
    return "number"


def normalization_config(exam_key: Any) -> Dict[str, Any]:
    normalization = config_entry(exam_key).get("normalization")
    return normalization if isinstance(normalization, dict) else {}


def exam_supports_percentile_normalization(exam_key: Any) -> bool:
    normalization = normalization_config(exam_key)
    if not normalization:
        return False
    if str(normalization.get("kind") or "").strip().lower() != "anchor_percentile":
        return False
    return bool(normalization.get("supports_user_scoring", True))


def validate_numeric_score(exam_key: str, cfg: Dict[str, Any], score_raw: Any) -> Union[int, float]:
    score_type = str(cfg.get("type", "float")).lower()
    if score_raw is None or score_raw == "":
        raise ValueError(f"{exam_key} score is required")
    try:
        value = to_decimal(score_raw)
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid score format")

    min_value = to_decimal(cfg.get("min", 0))
    max_value = to_decimal(cfg.get("max", 0))
    if value < min_value or value > max_value:
        raise ValueError(f"Score must be between {min_value} and {max_value}")

    step = cfg.get("step")
    if step is not None:
        step_value = to_decimal(step)
        quotient = (value - min_value) / step_value
        if quotient != quotient.to_integral_value():
            raise ValueError(f"Score must follow step={step_value}")

    if exam_key == "IELTS" and "decimals_allowed" in cfg:
        allowed = {int(item) for item in cfg.get("decimals_allowed", [])}
        tenth = int((value * 10) % 10)
        if tenth not in allowed:
            raise ValueError("IELTS decimals must be .0 or .5")

    return int(value) if score_type == "int" else float(value)


def coerce_flag_score(exam_key: str, score_raw: Any) -> int:
    if score_raw is None or score_raw == "":
        return 1
    text = strip_text(score_raw).lower()
    if text in ("1", "true", "yes", "on"):
        return 1
    if text in ("0", "false", "no", "off"):
        return 0
    raise ValueError(f"{exam_key} must be 0 or 1")


def grade_scheme(cfg: Dict[str, Any]) -> Dict[str, Any]:
    raw = cfg.get("grade_scheme")
    return raw if isinstance(raw, dict) else {}


def normalize_grade_token(value: Any) -> str:
    raw = strip_text(value).upper()
    if not raw:
        return ""
    return raw.replace("★", "*").replace("A STAR", "A*").replace("A-STAR", "A*").replace("ASTAR", "A*").replace(" ", "")


def parse_grade_combo_from_details(details: Any) -> List[str]:
    if not isinstance(details, dict):
        return []
    grades = details.get("grades")
    if not isinstance(grades, list):
        return []
    return [token for item in grades if (token := normalize_grade_token(item))]


def parse_grade_combo_from_text(raw_value: Any, allowed: Dict[str, int]) -> List[str]:
    text = strip_text(raw_value)
    if not text:
        return []
    compact = re.sub(r"[,;/|+\-]+", "", normalize_grade_token(text))
    tokens = re.findall(r"A\*|[ABCDEU]", compact)
    if not tokens or "".join(tokens) != compact:
        raise ValueError("A-Level grades must use only A*, A, B, C, D, E, or U")
    for token in tokens:
        if token not in allowed:
            raise ValueError("A-Level grades must use only A*, A, B, C, D, E, or U")
    return tokens


def level_scheme(cfg: Dict[str, Any]) -> Dict[str, Any]:
    raw = cfg.get("level_scheme")
    return raw if isinstance(raw, dict) else {}


def breakdown_scheme(cfg: Dict[str, Any]) -> Dict[str, Any]:
    raw = cfg.get("breakdown_scheme")
    return raw if isinstance(raw, dict) else {}


def breakdown_item_definitions(items: Any, *, default_required: bool) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in items:
        if isinstance(item, str):
            resolved = resolve_exam_key(item)
            if not resolved:
                continue
            label = strip_text(config_entry(resolved).get("label")) or resolved
            out.append({"exam": resolved, "label": label, "required": default_required})
            continue
        if not isinstance(item, dict):
            continue
        resolved = resolve_exam_key(item.get("exam") or item.get("id") or item.get("exam_id"))
        if not resolved:
            continue
        label = strip_text(item.get("label")) or strip_text(config_entry(resolved).get("label")) or resolved
        required_raw = item.get("required")
        out.append({"exam": resolved, "label": label, "required": default_required if required_raw is None else bool(required_raw)})
    return out


def display_value_from_submission(parsed: Dict[str, Any]) -> str:
    for item in (parsed.get("display_value"), parsed.get("raw_value"), parsed.get("score")):
        text = strip_text(item)
        if text:
            return text
    return ""


def level_bands(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    bands = level_scheme(cfg).get("bands")
    return [row for row in bands if isinstance(row, dict)] if isinstance(bands, list) else []


def normalize_level_label(value: Any) -> str:
    text = strip_text(value).upper()
    return text.replace("LEVEL", "").replace(" ", "") if text else ""


def to_num_int(value: Any) -> Optional[int]:
    numeric = to_float(value)
    if numeric is None or abs(numeric - round(numeric)) > 1e-9:
        return None
    return int(round(numeric))


def band_label_for_value(cfg: Dict[str, Any], score: Any) -> str:
    numeric = to_num_int(score)
    if numeric is None:
        return ""
    for row in level_bands(cfg):
        if to_num_int(row.get("value")) == numeric:
            return strip_text(row.get("short_label"))
    return ""


def band_value_for_label(cfg: Dict[str, Any], raw_value: Any) -> Optional[int]:
    label = normalize_level_label(raw_value)
    if not label:
        return None
    for row in level_bands(cfg):
        short_label = normalize_level_label(row.get("short_label"))
        numeric_value = to_num_int(row.get("value"))
        if numeric_value is None:
            continue
        if label == short_label or label == str(numeric_value):
            return numeric_value
    return None


ensure_exams_cache()
