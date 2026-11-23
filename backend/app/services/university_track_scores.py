"""Track program-mapping guards and normalized percentile score profile derivation."""

from __future__ import annotations

import re
from typing import Any

from app.core.utils import safe_lower as _safe_lower
from app.core.utils import to_float as _num_or_none
from app.services import exams as exams_service
from app.services.university_majors import (
    _canonical_major,
    _contains_phrase,
    _normalize_major_text,
)


def _uniq_non_empty(items: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for it in items:
        s = str(it).strip()
        if not s:
            continue
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
    return out


def _has_explicit_empty_program_mapping(track: dict[str, Any]) -> bool:
    """Whether route scope is specifically program-bound but has no mapped programs."""
    mapping_keys = ("program_ids", "program_names")
    has_empty_mapping = False
    for key in mapping_keys:
        raw_val = track.get(key)
        if isinstance(raw_val, list):
            has_empty_mapping = True
            if _uniq_non_empty(raw_val):
                return False
        elif isinstance(raw_val, str):
            has_empty_mapping = True
            if _uniq_non_empty([raw_val]):
                return False
    scope = str(track.get("application_scope") or "").strip().lower().replace("-", "_")
    return has_empty_mapping and scope in {
        "program_specific",
        "course_specific",
        "department_or_program_specific",
    }


def _track_requirement_exam_candidates(track: dict[str, Any]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    def collect(source: Any) -> None:
        if not isinstance(source, dict):
            return
        primary: list[str] = []
        fallback: list[str] = []
        for raw_key in source:
            exam_id = str(raw_key or "").strip().upper()
            if not exam_id or exam_id in seen:
                continue
            if exam_id == "GPA":
                fallback.append(exam_id)
            else:
                primary.append(exam_id)
        for exam_id in primary + fallback:
            if exam_id in seen:
                continue
            seen.add(exam_id)
            ordered.append(exam_id)

    collect(track.get("requirements"))
    collect(track.get("stats_avg"))
    return ordered


def _track_primary_exam_id(track: dict[str, Any]) -> str:
    candidates = _track_requirement_exam_candidates(track)
    return candidates[0] if candidates else ""


def _score_profile_program_matches_track(
    track: dict[str, Any],
    program: dict[str, Any],
) -> bool:
    if not isinstance(track, dict) or not isinstance(program, dict):
        return False
    program_name = str(program.get("program_name") or program.get("name") or "").strip()
    if not program_name:
        return False

    if _has_explicit_empty_program_mapping(track):
        return False

    applicable = track.get("applicable_majors")
    if isinstance(applicable, list):
        for major in applicable:
            major_text = str(major or "").strip()
            if not major_text:
                continue
            major_norm = _normalize_major_text(major_text)
            program_norm = _normalize_major_text(program_name)
            if (
                major_norm == program_norm
                or _contains_phrase(program_norm, major_norm)
                or _contains_phrase(major_norm, program_norm)
            ):
                return True
            major_canonical = _canonical_major(major_text)
            program_canonical = _canonical_major(program_name)
            if (
                major_canonical
                and program_canonical
                and major_canonical == program_canonical
            ):
                return True

    label_norm = _normalize_major_text(track.get("label"))
    return bool(
        label_norm and _contains_phrase(label_norm, _normalize_major_text(program_name))
    )


def _score_profile_route_matches_track(
    track: dict[str, Any],
    program: dict[str, Any],
) -> bool:
    track_blob = _normalize_major_text(
        " ".join(
            str(part or "")
            for part in (
                track.get("id"),
                track.get("label"),
                track.get("description"),
                " ".join(_track_requirement_exam_candidates(track)),
            )
        )
    )
    program_blob = _normalize_major_text(
        " ".join(
            str(part or "")
            for part in (
                program.get("source_scope"),
                program.get("data_type"),
                program.get("metric_unit"),
                program.get("semantics"),
                program.get("notes"),
            )
        )
    )
    route_tokens = [
        "jupas",
        "hkdse",
        "a level",
        "polytechnic",
        "ossd",
        "sat",
        "act",
        "ib",
        "unt",
        "nuet",
    ]
    program_tokens = [token for token in route_tokens if token in program_blob]
    if not program_tokens:
        return True
    return any(token in track_blob for token in program_tokens)


def _parse_numeric_multiplier(value: Any) -> float | None:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", str(value or ""))
    if not match:
        return None
    return _num_or_none(match.group(1))


def _weighted_total_scale_max(counts: dict[str, Any]) -> float | None:
    if not isinstance(counts, dict):
        return None
    best_of = 5
    selection_principle = str(counts.get("selection_principle") or "").strip().lower()
    match = re.search(r"best\s*(\d+)", selection_principle)
    if match:
        best_of = max(1, int(match.group(1)))

    subject_weighting = counts.get("subject_weighting")
    weights: list[float] = []
    if isinstance(subject_weighting, dict):
        for raw_value in subject_weighting.values():
            multiplier = _parse_numeric_multiplier(raw_value)
            if multiplier is not None and multiplier > 0:
                weights.append(float(multiplier))

    best_of = max(best_of, len(weights))
    total_weight = sum(weights) + max(0, best_of - len(weights))
    if total_weight <= 0:
        return None
    return round(total_weight * 7.0, 4)


def _score_scale(
    metric_id: str,
    counts: dict[str, Any],
) -> tuple[float, float, str] | None:
    resolved = exams_service.resolve_exam_key(metric_id)
    cfg = exams_service.EXAMS_CONFIG.get(resolved) if resolved else None
    if isinstance(cfg, dict) and str(cfg.get("type") or "").strip().lower() != "bool":
        mn = _num_or_none(cfg.get("min"))
        mx = _num_or_none(cfg.get("max"))
        if mn is not None and mx is not None and mx > mn:
            return float(mn), float(mx), resolved

    metric_key = _safe_lower(metric_id)
    if metric_key == "weighted_total":
        upper = _weighted_total_scale_max(counts)
        if upper is not None and upper > 0:
            return 0.0, float(upper), ""
    return None


def _normalize_score_value(raw_value: float, scale: tuple[float, float, str]) -> float:
    _, _, metric_exam_id = scale
    if metric_exam_id:
        normalized = exams_service.normalize_exam_score(metric_exam_id, raw_value)
        if normalized is not None:
            return float(normalized)
    mn, mx, _ = scale
    return max(0.0, min(100.0, ((float(raw_value) - mn) / max(mx - mn, 1e-9)) * 100.0))


def _extract_track_score_percentiles(
    counts: dict[str, Any],
) -> dict[str, str | float] | None:
    if not isinstance(counts, dict):
        return None

    for raw_key in counts:
        key = str(raw_key or "")
        if not key.startswith("lower_quartile_"):
            continue
        metric_id = key[len("lower_quartile_") :]
        p25 = _num_or_none(counts.get(key))
        median = _num_or_none(counts.get(f"median_{metric_id}"))
        p75 = _num_or_none(counts.get(f"upper_quartile_{metric_id}"))
        if p25 is None or median is None or p75 is None:
            continue
        return {
            "metric_id": metric_id,
            "p25_raw": float(p25),
            "median_raw": float(median),
            "p75_raw": float(p75),
        }

    for raw_key in counts:
        key = str(raw_key or "")
        match = re.match(r"(.+)_25th_percentile$", key)
        if not match:
            continue
        metric_id = str(match.group(1) or "")
        p25 = _num_or_none(counts.get(key))
        median = _num_or_none(counts.get(f"{metric_id}_50th_percentile"))
        p75 = _num_or_none(counts.get(f"{metric_id}_75th_percentile"))
        if p25 is None or median is None or p75 is None:
            continue
        return {
            "metric_id": metric_id,
            "p25_raw": float(p25),
            "median_raw": float(median),
            "p75_raw": float(p75),
        }

    return None


def _derive_track_score_profile(
    u: dict[str, Any],
    track: dict[str, Any],
) -> dict[str, Any] | None:
    explicit = track.get("score_profile")
    if isinstance(explicit, dict) and explicit:
        return explicit
    if _has_explicit_empty_program_mapping(track):
        return None

    academics = u.get("academics")
    academics = academics if isinstance(academics, dict) else {}
    admissions = academics.get("admissions")
    admissions = admissions if isinstance(admissions, dict) else {}
    programs = admissions.get("programs")
    if not isinstance(programs, list) or not programs:
        return None

    primary_exam_id = _track_primary_exam_id(track)
    matched_programs = [
        row
        for row in programs
        if isinstance(row, dict)
        and _score_profile_program_matches_track(track, row)
        and _score_profile_route_matches_track(track, row)
    ]
    candidates = matched_programs or [
        row
        for row in programs
        if isinstance(row, dict) and _score_profile_route_matches_track(track, row)
    ]
    university_acceptance = _num_or_none(academics.get("acceptance_rate_percent"))

    for program in candidates:
        counts = program.get("counts")
        if not isinstance(counts, dict):
            continue
        extracted = _extract_track_score_percentiles(counts)
        if not isinstance(extracted, dict):
            continue
        scale = _score_scale(str(extracted.get("metric_id") or ""), counts)
        if scale is None:
            continue

        metric_exam_id = str(scale[2] or "").strip().upper()
        resolved_primary_exam_id = (
            str(exams_service.resolve_exam_key(primary_exam_id) or "").strip().upper()
        )
        compatible_exam_ids: list[str] = []
        if metric_exam_id:
            compatible_exam_ids.append(metric_exam_id)
            if (
                resolved_primary_exam_id
                and resolved_primary_exam_id == metric_exam_id
                and resolved_primary_exam_id not in compatible_exam_ids
            ):
                compatible_exam_ids.append(resolved_primary_exam_id)

        provenance = program.get("provenance")
        provenance = provenance if isinstance(provenance, dict) else {}
        uses_exam_anchor = bool(metric_exam_id) and exams_service.exam_supports_percentile_normalization(metric_exam_id)
        p25_raw = float(extracted["p25_raw"])
        median_raw = float(extracted["median_raw"])
        p75_raw = float(extracted["p75_raw"])
        profile: dict[str, Any] = {
            "metric_id": str(extracted.get("metric_id") or ""),
            "metric_unit": str(program.get("metric_unit") or ""),
            "p25_raw": round(p25_raw, 2),
            "median_raw": round(median_raw, 2),
            "p75_raw": round(p75_raw, 2),
            "p25_normalized": round(_normalize_score_value(p25_raw, scale), 2),
            "median_normalized": round(_normalize_score_value(median_raw, scale), 2),
            "p75_normalized": round(_normalize_score_value(p75_raw, scale), 2),
            "confidence": str(provenance.get("confidence") or "estimated"),
            "source_program_name": str(
                program.get("program_name") or program.get("name") or ""
            ),
            "source_scope": str(
                program.get("source_scope") or program.get("scope") or ""
            ),
            "source_url": str(provenance.get("source_url") or ""),
            "normalization_method": (
                "exam_anchor_percentile"
                if uses_exam_anchor
                else ("exam_min_max_scale" if metric_exam_id else "scale_fallback")
            ),
        }
        if compatible_exam_ids:
            profile["exam_id"] = compatible_exam_ids[0]
            profile["compatible_exam_ids"] = compatible_exam_ids
        if university_acceptance is not None:
            profile["acceptance_rate_percent"] = round(float(university_acceptance), 2)
        return profile

    return None
