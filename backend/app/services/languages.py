import json
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.core.files import file_mtime
from app.core.paths import LANGUAGES_PATH


def _to_decimal(x: Any) -> Decimal:
    return Decimal(str(x).strip())


def _strip_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


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
        "exams_by_lang": exams_by_lang,
    }


def _get_language_exam_cfg(idx: Dict[str, Any], code: str, exam_id: Any) -> Optional[Dict[str, Any]]:
    target = _strip_text(exam_id)
    if not target:
        return None
    exams = idx.get("exams_by_lang", {}).get(code, [])
    if not isinstance(exams, list):
        return None
    for ex in exams:
        if _strip_text(ex.get("id")) == target:
            return ex
    return None


def _language_exam_input_mode(exam_cfg: Dict[str, Any]) -> str:
    raw = _strip_text(exam_cfg.get("input_mode")).lower()
    return raw or "number"


def _normalize_breakdown_defs(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    out: List[Dict[str, Any]] = []
    for row in items:
        if isinstance(row, str):
            exam_id = _strip_text(row)
            if not exam_id:
                continue
            out.append({"exam": exam_id, "label": exam_id, "required": False})
            continue
        if not isinstance(row, dict):
            continue
        exam_id = _strip_text(row.get("exam") or row.get("id") or row.get("exam_id"))
        if not exam_id:
            continue
        out.append(
            {
                "exam": exam_id,
                "label": _strip_text(row.get("label")) or exam_id,
                "required": bool(row.get("required", False)),
            }
        )
    return out


def _display_value_from_language_submission(parsed: Dict[str, Any]) -> str:
    for value in (parsed.get("display_value"), parsed.get("raw_value"), parsed.get("score")):
        text = _strip_text(value)
        if text:
            return text
    return ""


def _coerce_language_exam_submission(
    *,
    code: str,
    exam_id: Any,
    score_raw: Any = None,
    raw_value: Any = None,
    details: Any = None,
    idx: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    index = idx or get_languages_index()
    exam_key = _strip_text(exam_id)
    exam_cfg = _get_language_exam_cfg(index, code, exam_key)
    if not isinstance(exam_cfg, dict):
        raise ValueError(f"Exam {exam_key} is not allowed for language {code}")

    mode = _language_exam_input_mode(exam_cfg)
    if mode != "subject_breakdown":
        score = validate_language_exam_from_cfg(exam_cfg, score_raw if score_raw not in (None, "") else raw_value)
        return {"exam": exam_key, "score": score}

    scheme = exam_cfg.get("breakdown_scheme")
    scheme = scheme if isinstance(scheme, dict) else {}
    component_defs = _normalize_breakdown_defs(scheme.get("fixed_components"))
    raw_components = details.get("components") if isinstance(details, dict) else None
    if raw_components is None:
        raw_components = []
    if not isinstance(raw_components, list):
        raise ValueError(f"{exam_key} components must be a list")

    allowed_ids = {row["exam"] for row in component_defs}
    parsed_components: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}
    for row in raw_components:
        if not isinstance(row, dict):
            raise ValueError(f"{exam_key} components must be objects")
        child_exam = _strip_text(row.get("exam") or row.get("id") or row.get("exam_id"))
        if not child_exam:
            raise ValueError(f"{exam_key} component exam is required")
        if child_exam not in allowed_ids:
            raise ValueError(f"{exam_key} does not support component {child_exam}")
        seen[child_exam] = seen.get(child_exam, 0) + 1
        if seen[child_exam] > 1:
            raise ValueError(f"{exam_key} does not allow duplicate component {child_exam}")
        parsed = _coerce_language_exam_submission(
            code=code,
            exam_id=child_exam,
            score_raw=row.get("score"),
            raw_value=row.get("raw_value", row.get("rawValue")),
            details=row.get("details"),
            idx=index,
        )
        item = {
            "exam": child_exam,
            "label": next((cfg_row.get("label") for cfg_row in component_defs if cfg_row["exam"] == child_exam), child_exam),
            "score": parsed.get("score"),
        }
        if parsed.get("raw_value") not in (None, ""):
            item["raw_value"] = parsed.get("raw_value")
        if parsed.get("display_value") not in (None, ""):
            item["display_value"] = parsed.get("display_value")
        parsed_components.append(item)

    for row in component_defs:
        if row.get("required") and seen.get(row["exam"], 0) < 1:
            raise ValueError(f"{exam_key} requires component {row['label']}")

    total_strategy = _strip_text(scheme.get("total_strategy")).lower() or "use_parent_score"
    if total_strategy != "use_parent_score":
        raise ValueError(f"{exam_key} uses unsupported language score strategy")

    total_score = validate_language_exam_from_cfg(exam_cfg, score_raw if score_raw not in (None, "") else raw_value)
    total_label = _strip_text(scheme.get("parent_score_label")) or "Total"
    parts = [f"{total_label} {_strip_text(total_score)}"]
    for row in parsed_components:
        value = _display_value_from_language_submission(row)
        if value:
            parts.append(f"{_strip_text(row.get('label'))} {value}")

    return {
        "exam": exam_key,
        "score": total_score,
        "raw_value": ", ".join(parts),
        "display_value": ", ".join(parts),
        "details": {
            "components": parsed_components,
            "score_strategy": total_strategy,
        },
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

    if "decimals_allowed" in lang_cfg:
        allowed = set(int(x) for x in (lang_cfg.get("decimals_allowed") or []))
        tenth = int((dv * 10) % 10)
        if tenth not in allowed:
            raise ValueError("Decimals not allowed for this exam")

    if t == "int":
        return int(dv)
    return float(dv)


_LANG_CACHE = {"mtime": None, "data": {}, "index": None}


def load_languages() -> Dict[str, Any]:
    mtime = file_mtime(LANGUAGES_PATH)
    if mtime is None:
        _LANG_CACHE["mtime"] = None
        _LANG_CACHE["data"] = {}
        _LANG_CACHE["index"] = None
        return {}
    if mtime != _LANG_CACHE["mtime"]:
        try:
            with open(LANGUAGES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            data = data if isinstance(data, dict) else {}
        except Exception:
            data = {}
        _LANG_CACHE["data"] = data
        _LANG_CACHE["index"] = _build_languages_index(data)
        _LANG_CACHE["mtime"] = mtime
    return _LANG_CACHE["data"]


def get_languages_index() -> Dict[str, Any]:
    load_languages()
    if not _LANG_CACHE["index"]:
        _LANG_CACHE["index"] = _build_languages_index(_LANG_CACHE["data"] or {})
    return _LANG_CACHE["index"]


def get_languages_config() -> Dict[str, Any]:
    data = load_languages()
    if data:
        return data
    return {"version": 0, "cefr": [], "languages": [], "language_exams": {}, "waiver_rules": []}


def validate_language(payload: Dict[str, Any]) -> Dict[str, Any]:
    # ВСЕГДА читаем актуальный languages.json (а не LANGUAGES_CONFIG, который грузится один раз)
    cfg = load_languages() or {}
    idx = get_languages_index()

    code = str(payload.get("code", "")).strip().lower()
    kind = str(payload.get("kind", "")).strip().lower()

    if not code or code not in idx["codes"]:
        raise ValueError("Unknown language code")

    if kind not in ("native", "cefr", "exam"):
        raise ValueError("kind must be native/cefr/exam")

    if kind == "native":
        return {"ok": True, "language": {"code": code, "kind": "native"}}

    if kind == "cefr":
        level = payload.get("level", None)
        label = str(payload.get("label", "")).strip().upper()

        if (level is None or str(level).strip() == "") and label:
            if label not in idx["cefr_map"]:
                raise ValueError("Invalid CEFR label")
            level = idx["cefr_map"][label]

        level_str = str(level).strip()
        if level_str == "":
            raise ValueError("CEFR level is required (1..6)")

        try:
            level_i = int(level_str)
        except Exception:
            raise ValueError("CEFR level must be integer 1..6")

        if level_i < 1 or level_i > 6:
            raise ValueError("CEFR level must be 1..6")

        return {"ok": True, "language": {"code": code, "kind": "cefr", "level": level_i}}

    # exam
    exams = idx["exams_by_lang"].get(code, [])
    if not isinstance(exams, list) or len(exams) == 0:
        raise ValueError(f"{code} does not support kind=exam")

    exam_id = str(payload.get("exam", "")).strip()
    score_raw = payload.get("score", None)
    raw_value = payload.get("raw_value", payload.get("rawValue"))
    details = payload.get("details")

    if not exam_id:
        raise ValueError("Exam id is required")
    if score_raw is None and raw_value in (None, "") and not isinstance(details, dict):
        raise ValueError("Score is required")

    parsed = _coerce_language_exam_submission(
        code=code,
        exam_id=exam_id,
        score_raw=score_raw,
        raw_value=raw_value,
        details=details,
        idx=idx,
    )
    language = {
        "code": code,
        "kind": "exam",
        "exam": parsed.get("exam", exam_id),
        "score": parsed.get("score"),
    }
    if parsed.get("raw_value") not in (None, ""):
        language["raw_value"] = parsed.get("raw_value")
    if parsed.get("display_value") not in (None, ""):
        language["display_value"] = parsed.get("display_value")
    if isinstance(parsed.get("details"), dict):
        language["details"] = parsed.get("details")
    return {"ok": True, "language": language}
