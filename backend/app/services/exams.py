from datetime import date
from typing import Any, Dict, List, Optional, Union

from app.services import exam_support

load_exams_config = exam_support.load_exams_config
EXAMS_CONFIG = exam_support.EXAMS_CONFIG
EXAM_WHITELIST = exam_support.EXAM_WHITELIST
ensure_exams_cache = exam_support.ensure_exams_cache
resolve_exam_key = exam_support.resolve_exam_key
exam_supports_percentile_normalization = exam_support.exam_supports_percentile_normalization
_strip_text = exam_support.strip_text
_to_float = exam_support.to_float
_clamp = exam_support.clamp
_config_entry = exam_support.config_entry
_input_mode = exam_support.input_mode
_normalization_config = exam_support.normalization_config
_validate_numeric_score = exam_support.validate_numeric_score
_coerce_flag_score = exam_support.coerce_flag_score
_grade_scheme = exam_support.grade_scheme
_normalize_grade_token = exam_support.normalize_grade_token
_parse_grade_combo_from_details = exam_support.parse_grade_combo_from_details
_parse_grade_combo_from_text = exam_support.parse_grade_combo_from_text
_breakdown_scheme = exam_support.breakdown_scheme
_breakdown_item_definitions = exam_support.breakdown_item_definitions
_display_value_from_submission = exam_support.display_value_from_submission
_band_label_for_value = exam_support.band_label_for_value
_band_value_for_label = exam_support.band_value_for_label


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


def _parse_breakdown_item(
    exam_key: str,
    row: Any,
    defs_map: Dict[str, Dict[str, Any]],
    item_type_label: str,
    allow_self: bool = False,
) -> Dict[str, Any]:
    if not isinstance(row, dict):
        raise ValueError(f"{exam_key} {item_type_label} must be objects")
    raw_exam = row.get("exam") or row.get("id")
    resolved = resolve_exam_key(raw_exam)
    if not resolved:
        item_singular = item_type_label[:-1] if item_type_label.endswith("s") else item_type_label
        if item_type_label == "extra scores":
            item_singular = "extra score"
        raise ValueError(f"{exam_key} {item_singular} exam is required")
    if not allow_self and resolved == exam_key:
        raise ValueError(f"{exam_key} cannot contain itself as a component")
    if resolved not in defs_map:
        item_singular = item_type_label[:-1] if item_type_label.endswith("s") else item_type_label
        if item_type_label == "extra scores":
            item_singular = "extra score"
        raise ValueError(f"{exam_key} does not support {item_singular} {resolved}")

    parsed = coerce_exam_submission(
        resolved,
        score_raw=row.get("score"),
        raw_value=row.get("raw_value"),
        details=row.get("details"),
    )
    child_mode = _input_mode(_config_entry(resolved))
    item = {
        "exam": resolved,
        "label": defs_map[resolved].get("label") or resolved,
        "score": parsed.get("score"),
    }
    if parsed.get("raw_value") not in (None, ""):
        item["raw_value"] = parsed.get("raw_value")
    if parsed.get("display_value") not in (None, ""):
        item["display_value"] = parsed.get("display_value")
    elif child_mode == "flag":
        item["display_value"] = "Pass" if int(_to_float(parsed.get("score")) or 0) == 1 else "Not passed"
    return item


def _parse_breakdown_components(
    exam_key: str,
    raw_components: Any,
    fixed_defs: List[Dict[str, Any]],
    selectable_defs: List[Dict[str, Any]],
    scheme: Dict[str, Any],
) -> List[Dict[str, Any]]:
    if raw_components is None:
        raw_components = []
    if not isinstance(raw_components, list):
        raise ValueError(f"{exam_key} components must be a list")

    component_defs = {row["exam"]: row for row in fixed_defs + selectable_defs}
    selectable_ids = {row["exam"] for row in selectable_defs}
    distinct_components = bool(scheme.get("distinct_components", True))

    parsed_components: List[Dict[str, Any]] = []
    component_counts: Dict[str, int] = {}
    for row in raw_components:
        parsed_item = _parse_breakdown_item(exam_key, row, component_defs, "components", allow_self=False)
        resolved = parsed_item["exam"]
        component_counts[resolved] = component_counts.get(resolved, 0) + 1
        if distinct_components and component_counts[resolved] > 1:
            raise ValueError(f"{exam_key} does not allow duplicate component {resolved}")
        parsed_components.append(parsed_item)

    for row in fixed_defs:
        if row.get("required", True) and component_counts.get(row["exam"], 0) < 1:
            raise ValueError(f"{exam_key} requires component {row['label']}")

    selectable_count = sum(component_counts.get(exam_id, 0) for exam_id in selectable_ids)
    selectable_min = max(0, int(scheme.get("selectable_count_min", 0) or 0))
    selectable_max = int(scheme.get("selectable_count_max", len(selectable_defs) or 0) or 0)
    if selectable_ids:
        if selectable_count < selectable_min:
            raise ValueError(f"{exam_key} requires at least {selectable_min} selected subjects")
        if selectable_max > 0 and selectable_count > selectable_max:
            raise ValueError(f"{exam_key} supports at most {selectable_max} selected subjects")

    return parsed_components


def _parse_breakdown_extra_scores(
    exam_key: str,
    raw_extra_scores: Any,
    extra_defs: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if raw_extra_scores is None:
        raw_extra_scores = []
    if not isinstance(raw_extra_scores, list):
        raise ValueError(f"{exam_key} extra scores must be a list")

    extra_defs_map = {row["exam"]: row for row in extra_defs}
    parsed_extra_scores: List[Dict[str, Any]] = []
    extra_counts: Dict[str, int] = {}
    for row in raw_extra_scores:
        parsed_item = _parse_breakdown_item(exam_key, row, extra_defs_map, "extra scores", allow_self=True)
        resolved = parsed_item["exam"]
        extra_counts[resolved] = extra_counts.get(resolved, 0) + 1
        if extra_counts[resolved] > 1:
            raise ValueError(f"{exam_key} does not allow duplicate extra score {resolved}")
        parsed_extra_scores.append(parsed_item)

    return parsed_extra_scores


def _calculate_breakdown_total_score(
    exam_key: str,
    cfg: Dict[str, Any],
    scheme: Dict[str, Any],
    parsed_components: List[Dict[str, Any]],
    score_raw: Any,
    raw_value: Any,
) -> Optional[Union[int, float]]:
    total_strategy = str(scheme.get("total_strategy") or "sum").strip().lower()
    component_scores = [_to_float(row.get("score")) for row in parsed_components]
    numeric_component_scores = [float(row) for row in component_scores if row is not None]

    if total_strategy == "components_only":
        if not numeric_component_scores:
            raise ValueError(f"{exam_key} requires at least one component score")
        return None
    if total_strategy == "use_parent_score":
        return _validate_numeric_score(exam_key, cfg, score_raw if score_raw not in (None, "") else raw_value)
    if total_strategy == "best_of_sum":
        if not numeric_component_scores:
            raise ValueError(f"{exam_key} requires at least one subject score")
        best_of = max(1, int(scheme.get("best_of", len(numeric_component_scores)) or len(numeric_component_scores)))
        best_scores = sorted(numeric_component_scores, reverse=True)[:best_of]
        return _validate_numeric_score(exam_key, cfg, sum(best_scores))

    if not numeric_component_scores:
        raise ValueError(f"{exam_key} requires at least one subject score")
    return _validate_numeric_score(exam_key, cfg, sum(numeric_component_scores))


def _build_breakdown_display_value(
    scheme: Dict[str, Any],
    parsed_components: List[Dict[str, Any]],
    parsed_extra_scores: List[Dict[str, Any]],
    total_score: Any,
) -> str:
    display_parts: List[str] = []
    total_strategy = str(scheme.get("total_strategy") or "sum").strip().lower()
    if total_strategy == "use_parent_score":
        parent_label = _strip_text(scheme.get("parent_score_label")) or "Total"
        display_parts.append(f"{parent_label} {_strip_text(total_score)}")

    for row in parsed_components:
        label = _strip_text(row.get("label")) or row["exam"]
        value = _display_value_from_submission(row)
        if value:
            display_parts.append(f"{label} {value}")

    for row in parsed_extra_scores:
        label = _strip_text(row.get("label")) or row["exam"]
        value = _display_value_from_submission(row)
        if value:
            display_parts.append(f"{label} {value}")

    return ", ".join(part for part in display_parts if part)


def _coerce_subject_breakdown_submission(
    exam_key: str,
    cfg: Dict[str, Any],
    score_raw: Any = None,
    raw_value: Any = None,
    details: Any = None,
) -> Dict[str, Any]:
    scheme = _breakdown_scheme(cfg)
    fixed_defs = _breakdown_item_definitions(scheme.get("fixed_components"), default_required=True)
    selectable_defs = _breakdown_item_definitions(scheme.get("selectable_components"), default_required=False)
    extra_defs = _breakdown_item_definitions(scheme.get("extra_scores"), default_required=False)

    raw_components = details.get("components") if isinstance(details, dict) else None
    raw_extra_scores = details.get("extra_scores") if isinstance(details, dict) else None

    parsed_components = _parse_breakdown_components(exam_key, raw_components, fixed_defs, selectable_defs, scheme)
    parsed_extra_scores = _parse_breakdown_extra_scores(exam_key, raw_extra_scores, extra_defs)

    total_strategy = str(scheme.get("total_strategy") or "sum").strip().lower()
    total_score = _calculate_breakdown_total_score(exam_key, cfg, scheme, parsed_components, score_raw, raw_value)
    display_value = _build_breakdown_display_value(scheme, parsed_components, parsed_extra_scores, total_score)

    result: Dict[str, Any] = {
        "exam": exam_key,
        "details": {
            "components": parsed_components,
            "score_strategy": total_strategy,
            "component_count": len(parsed_components),
        },
    }
    if total_score is not None:
        result["score"] = total_score
        result["details"]["score_total"] = total_score
    if parsed_extra_scores:
        result["details"]["extra_scores"] = parsed_extra_scores
    if display_value:
        result["raw_value"] = display_value
        result["display_value"] = display_value
    return result
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
    taken_on: Any = None,
    allow_total_only_sat: bool = False,
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
    normalized_taken_on = None
    if taken_on is not None:
        taken_text = taken_on.isoformat() if isinstance(taken_on, date) else str(taken_on)
        if len(taken_text) != 10 or taken_text[4:5] != "-" or taken_text[7:8] != "-":
            raise ValueError("taken_on must be an ISO date (YYYY-MM-DD)")
        try:
            taken_date = date.fromisoformat(taken_text)
        except ValueError as error:
            raise ValueError("taken_on must be an ISO date (YYYY-MM-DD)") from error
        normalized_taken_on = taken_date.isoformat()
        valid_from = cfg.get("valid_from")
        if valid_from and taken_date < date.fromisoformat(valid_from):
            raise ValueError(f"{key} results before {valid_from} use an unsupported test format")

    mode = _input_mode(cfg)

    if mode == "grade_combo":
        result = _coerce_grade_combo_submission(key, cfg, score_raw=score_raw, raw_value=raw_value, details=details)
    elif mode == "band_select":
        result = _coerce_band_select_submission(key, cfg, score_raw=score_raw, raw_value=raw_value, details=details)
    elif mode == "subject_breakdown":
        # Saved SAT totals can prove reported presence without reconstructing section scores.
        if key == "SAT" and allow_total_only_sat and (details is None or details == {}):
            result = {"exam": key, "score": _validate_numeric_score(key, cfg, score_raw if score_raw not in (None, "") else raw_value)}
        else:
            result = _coerce_subject_breakdown_submission(key, cfg, score_raw=score_raw, raw_value=raw_value, details=details)
    elif mode == "flag" or str(cfg.get("type", "")).strip().lower() == "bool":
        result = {"exam": key, "score": _coerce_flag_score(key, score_raw if score_raw not in (None, "") else raw_value)}
    else:
        result = {"exam": key, "score": _validate_numeric_score(key, cfg, score_raw if score_raw not in (None, "") else raw_value)}
    if normalized_taken_on:
        result["taken_on"] = normalized_taken_on
    return result


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

    if mode in ("grade_combo", "band_select", "subject_breakdown"):
        try:
            coerced = coerce_exam_submission(resolved, score_raw=score_raw)
            score = _to_float(coerced.get("score"))
        except ValueError:
            score = _to_float(score_raw)
            if score is None:
                return None
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
