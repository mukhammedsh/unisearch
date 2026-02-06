import json
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

from app.core.files import file_mtime
from app.core.paths import LANGUAGES_PATH


def _to_decimal(x: Any) -> Decimal:
    return Decimal(str(x).strip())


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

    if not exam_id:
        raise ValueError("Exam id is required")
    if score_raw is None or score_raw == "":
        raise ValueError("Score is required")

    ex = None
    for e in exams:
        if str(e.get("id", "")).strip() == exam_id:
            ex = e
            break
    if ex is None:
        raise ValueError(f"Exam {exam_id} is not allowed for language {code}")

    score = validate_language_exam_from_cfg(ex, score_raw)
    return {"ok": True, "language": {"code": code, "kind": "exam", "exam": exam_id, "score": score}}
