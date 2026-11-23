"""University tracks, product-scope filtering, and admission choice expansion."""

from __future__ import annotations

import copy
from typing import Any

from app.core.utils import safe_lower as _safe_lower
from app.services import exams as exams_service
from app.services.university_majors import (
    _CANONICAL_MAJORS,
    _MAJOR_PHRASES,
    _canonical_major,
    _contains_phrase,
    _major_tags_from_text,
    _normalize_major_text,
)
from app.services.university_track_scores import (
    _derive_track_score_profile,
    _has_explicit_empty_program_mapping,
    _uniq_non_empty,
)

__all__ = [
    "_CANONICAL_MAJORS",
    "_MAJOR_PHRASES",
    "_canonical_major",
    "_derive_track_applicable_majors",
    "_derive_track_score_profile",
    "_filter_academics_for_product_scope",
    "_has_explicit_empty_program_mapping",
    "_iter_programs",
    "_major_tags_from_text",
    "_normalize_major_text",
    "_safe_lower",
    "_should_keep_track_for_product_scope",
    "expand_admission_choices",
]


def _get_nested(u: dict[str, Any], path: list[str], default: Any = None) -> Any:
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _iter_programs(u: dict[str, Any]) -> list[dict[str, Any]]:
    raw = _get_nested(u, ["academics", "programs"], [])
    if not isinstance(raw, list):
        return []
    return [p for p in raw if isinstance(p, dict)]


def _track_program_names(u: dict[str, Any]) -> list[str]:
    academics = u.get("academics")
    academics_obj = academics if isinstance(academics, dict) else {}
    names: list[Any] = [p.get("name") for p in _iter_programs(u)]
    majors = academics_obj.get("majors")
    if isinstance(majors, list):
        names.extend(majors)
    return _uniq_non_empty(names)


def _is_foundation_program_name(value: Any) -> bool:
    text = _normalize_major_text(value)
    return bool(text) and (
        _contains_phrase(text, "foundation")
        or _contains_phrase(text, "nufyp")
        or _contains_phrase(text, "preparatory")
    )


def _track_targets_foundation(blob: str) -> bool:
    return bool(blob) and any(
        token in blob for token in ("foundation", "nufyp", "preparatory")
    )


def _track_targets_undergraduate(blob: str) -> bool:
    return bool(blob) and any(
        token in blob
        for token in (
            "undergraduate",
            "direct admission",
            "sat",
            "act",
            "olympiad",
            "transfer",
            "mid year",
            "mid-year",
            "bachelor",
        )
    )


def _merge_track_variant_dict(base_value: Any, variant_value: Any) -> Any:
    if isinstance(base_value, dict) and isinstance(variant_value, dict):
        out = copy.deepcopy(base_value)
        out.update(copy.deepcopy(variant_value))
        return out
    if variant_value is not None:
        return copy.deepcopy(variant_value)
    return copy.deepcopy(base_value)


def _is_language_exam_key_for_track_merge(exam_id: Any) -> bool:
    key = str(exam_id or "").strip().upper()
    if not key:
        return False
    return any(
        token in key
        for token in (
            "IELTS",
            "TOEFL",
            "DET",
            "DUOLINGO",
            "PTE",
            "CAMBRIDGE",
            "TESTDAF",
            "DSH",
            "DELF",
            "DALF",
            "TCF",
            "TEF",
            "NT2",
            "HSK",
            "JLPT",
            "TOPIK",
        )
    )


def _filter_variant_stats_avg_for_requirements(
    stats_avg: Any,
    requirements: Any,
) -> Any:
    if not isinstance(stats_avg, dict):
        return copy.deepcopy(stats_avg)
    if not isinstance(requirements, dict) or not requirements:
        return copy.deepcopy(stats_avg)

    raw_allowed = {
        exams_service.resolve_exam_key(key)
        for key in requirements
        if not _is_language_exam_key_for_track_merge(key)
    }
    allowed_keys = {
        str(key or "").strip().upper() for key in raw_allowed if str(key or "").strip()
    }
    if not allowed_keys:
        return copy.deepcopy(stats_avg)

    filtered: dict[str, Any] = {}
    for raw_key, value in stats_avg.items():
        resolved = str(exams_service.resolve_exam_key(raw_key) or "").strip().upper()
        if resolved and resolved in allowed_keys:
            filtered[str(raw_key)] = copy.deepcopy(value)
    return filtered


def _choice_key(category_id: Any, profile_id: Any, funding_id: Any = "") -> str:
    parts = [
        str(category_id or "").strip(),
        str(profile_id or "").strip(),
        str(funding_id or "").strip(),
    ]
    return "::".join(part for part in parts if part)


def _funding_options_from_profile_or_category(
    category: dict[str, Any],
    profile: dict[str, Any],
) -> list[dict[str, Any]]:
    profile_options = profile.get("funding_options")
    if isinstance(profile_options, list) and profile_options:
        return [copy.deepcopy(row) for row in profile_options if isinstance(row, dict)]
    category_options = category.get("funding_options")
    if isinstance(category_options, list) and category_options:
        return [copy.deepcopy(row) for row in category_options if isinstance(row, dict)]
    return []


def _admission_choice_from_parts(
    category: dict[str, Any],
    profile: dict[str, Any],
    funding: dict[str, Any] | None = None,
    funding_idx: int = 0,
) -> dict[str, Any]:
    funding = funding if isinstance(funding, dict) else {}
    category_id = str(category.get("id") or "").strip()
    profile_id = str(profile.get("id") or "").strip()
    funding_id = str(funding.get("id") or "").strip()
    choice_key = _choice_key(category_id, profile_id, funding_id)

    merged_requirements = _merge_track_variant_dict(
        _merge_track_variant_dict(category.get("requirements"), profile.get("requirements")),
        funding.get("requirements"),
    )
    merged_stats_avg = _merge_track_variant_dict(
        _merge_track_variant_dict(category.get("stats_avg"), profile.get("stats_avg")),
        funding.get("stats_avg"),
    )
    merged_stats_avg = _filter_variant_stats_avg_for_requirements(merged_stats_avg, merged_requirements)
    merged_finance_override = _merge_track_variant_dict(
        _merge_track_variant_dict(category.get("finance_override"), profile.get("finance_override")),
        funding.get("finance_override"),
    )
    merged_published_admission = _merge_track_variant_dict(
        category.get("published_admission"),
        profile.get("published_admission"),
    )

    choice: dict[str, Any] = {
        "id": choice_key or profile_id or category_id or f"choice:{funding_idx}",
        "choice_key": choice_key,
        "category_id": category_id,
        "category_label": category.get("label"),
        "requirement_profile_id": profile_id,
        "requirement_profile_label": profile.get("label"),
        "funding_option_id": funding_id,
        "label": profile.get("label") or category.get("label"),
        "description": profile.get("description") or category.get("description"),
        "study_mode": profile.get("study_mode", category.get("study_mode")),
        "language_requirements": copy.deepcopy(
            profile.get("language_requirements", category.get("language_requirements"))
        ),
        "language_requirements_mode": profile.get(
            "language_requirements_mode",
            category.get("language_requirements_mode"),
        ),
        "required_exam_alternatives": copy.deepcopy(
            profile.get("required_exam_alternatives", category.get("required_exam_alternatives", []))
        ),
        "extra_requirements": copy.deepcopy(
            profile.get("extra_requirements", category.get("extra_requirements"))
        ),
        "scholarships": copy.deepcopy(profile.get("scholarships", category.get("scholarships", []))),
        "scope": copy.deepcopy(profile.get("scope", category.get("scope"))),
        "study_levels": copy.deepcopy(profile.get("study_levels", category.get("study_levels", []))),
        "study_level": copy.deepcopy(profile.get("study_level", category.get("study_level"))),
        "applicant_route": copy.deepcopy(profile.get("applicant_route", category.get("applicant_route"))),
        "application_scope": copy.deepcopy(profile.get("application_scope", category.get("application_scope"))),
        "target": copy.deepcopy(profile.get("target", category.get("target"))),
        "major_selection": copy.deepcopy(profile.get("major_selection", category.get("major_selection"))),
        "cycle": copy.deepcopy(profile.get("cycle", category.get("cycle"))),
    }
    for mapping_key in ("applicable_majors", "program_ids", "program_names"):
        if mapping_key in profile or mapping_key in category:
            choice[mapping_key] = copy.deepcopy(profile.get(mapping_key, category.get(mapping_key)))
    if isinstance(merged_requirements, dict) and merged_requirements:
        choice["requirements"] = merged_requirements
    if isinstance(merged_stats_avg, dict) and merged_stats_avg:
        choice["stats_avg"] = merged_stats_avg
    if isinstance(merged_finance_override, dict) and merged_finance_override:
        choice["finance_override"] = merged_finance_override
    if isinstance(merged_published_admission, dict) and merged_published_admission:
        choice["published_admission"] = merged_published_admission
    score_profile = funding.get("score_profile") or profile.get("score_profile")
    if isinstance(score_profile, dict) and score_profile:
        choice["score_profile"] = copy.deepcopy(score_profile)
    if funding_id:
        choice["funding_type"] = funding.get("funding_type")
        choice["track_badge"] = funding.get("track_badge")
        choice["funding_program"] = funding.get("funding_program")
        choice["funding_source"] = funding.get("funding_source")
        choice["funding_label"] = funding.get("label")
        choice["funding_description"] = funding.get("description")
        choice["label"] = funding.get("label") or choice.get("label")
        if funding.get("extra_requirements"):
            choice["extra_requirements"] = copy.deepcopy(funding.get("extra_requirements"))
        if funding.get("applicable_majors"):
            choice["applicable_majors"] = copy.deepcopy(funding.get("applicable_majors"))
    return choice


def expand_admission_choices(categories: Any, *, include_funding: bool = True) -> list[dict[str, Any]]:
    if not isinstance(categories, list):
        return []

    expanded: list[dict[str, Any]] = []
    for category in categories:
        if not isinstance(category, dict):
            continue
        profiles = category.get("requirement_profiles")
        profile_rows = [row for row in profiles if isinstance(row, dict)] if isinstance(profiles, list) else []
        if not profile_rows:
            profile_rows = [{"id": "general", "label": category.get("label") or "General requirements"}]
        for profile in profile_rows:
            if not include_funding:
                expanded.append(_admission_choice_from_parts(category, profile))
                continue
            options = _funding_options_from_profile_or_category(category, profile)
            if not options:
                expanded.append(_admission_choice_from_parts(category, profile))
                continue
            for option_idx, option in enumerate(options):
                expanded.append(_admission_choice_from_parts(category, profile, option, option_idx))
    return expanded


def _derive_track_applicable_majors(
    u: dict[str, Any],
    track: dict[str, Any],
) -> list[str]:
    explicit = track.get("applicable_majors")
    if isinstance(explicit, list) and explicit:
        return _uniq_non_empty(explicit)

    raw_linked_names = track.get("program_names")
    if isinstance(raw_linked_names, str):
        raw_linked_names = [raw_linked_names]
    linked_names = _uniq_non_empty(raw_linked_names if isinstance(raw_linked_names, list) else [])

    raw_linked_ids = track.get("program_ids")
    if isinstance(raw_linked_ids, str):
        raw_linked_ids = [raw_linked_ids]
    linked_id_set = (
        {
            str(program_id or "").strip().lower()
            for program_id in raw_linked_ids
        }
        if isinstance(raw_linked_ids, list)
        else set()
    )
    linked_id_set.discard("")

    if linked_names or linked_id_set:
        linked_program_names: list[Any] = [*linked_names]
        if linked_id_set:
            for program in _iter_programs(u):
                program_id = str(program.get("id") or "").strip().lower()
                if program_id in linked_id_set:
                    linked_program_names.append(program.get("name") or program.get("program_name"))
        return _uniq_non_empty(linked_program_names)

    if _has_explicit_empty_program_mapping(track):
        return []

    program_names = _track_program_names(u)
    if not program_names:
        return []

    blob_parts: list[Any] = [
        track.get("id"),
        track.get("label"),
        track.get("description"),
    ]
    extra_requirements = track.get("extra_requirements")
    if isinstance(extra_requirements, list):
        blob_parts.extend(extra_requirements)
    blob = _normalize_major_text(" ".join(str(part or "") for part in blob_parts))

    matched_programs = [
        name
        for name in program_names
        if _contains_phrase(blob, _normalize_major_text(name))
    ]
    matched_programs = _uniq_non_empty(matched_programs)
    if matched_programs:
        return matched_programs

    foundation_programs = [
        name for name in program_names if _is_foundation_program_name(name)
    ]
    non_foundation_programs = [
        name for name in program_names if not _is_foundation_program_name(name)
    ]

    if foundation_programs and non_foundation_programs:
        if _track_targets_undergraduate(blob):
            return non_foundation_programs
        if _track_targets_foundation(blob):
            return foundation_programs
        return non_foundation_programs
    if foundation_programs and _track_targets_foundation(blob):
        return foundation_programs

    return program_names


def _should_keep_track_for_product_scope(
    u: dict[str, Any],
    track: dict[str, Any],
) -> bool:
    majors = track.get("applicable_majors")
    if not isinstance(majors, list) or not majors:
        return True

    major_names = _uniq_non_empty(majors)
    if not major_names:
        return True

    has_non_foundation_program = any(
        not _is_foundation_program_name(name) for name in _track_program_names(u)
    )
    if not has_non_foundation_program:
        return True

    return not all(_is_foundation_program_name(name) for name in major_names)


def _is_foundation_study_level(value: Any) -> bool:
    return _contains_phrase(_normalize_major_text(value), "foundation")


def _is_foundation_program_row(program: dict[str, Any]) -> bool:
    if not isinstance(program, dict):
        return False

    if _is_foundation_program_name(program.get("name")):
        return True

    levels = program.get("study_levels")
    if isinstance(levels, list) and any(
        _is_foundation_study_level(level) for level in levels
    ):
        return True
    return bool(levels is not None and _is_foundation_study_level(levels))


def _filter_academics_for_product_scope(academics: dict[str, Any]) -> None:
    if not isinstance(academics, dict):
        return

    programs = academics.get("programs")
    if isinstance(programs, list):
        academics["programs"] = [
            program
            for program in programs
            if isinstance(program, dict) and not _is_foundation_program_row(program)
        ]

    majors = academics.get("majors")
    if isinstance(majors, list):
        academics["majors"] = [
            major for major in majors if not _is_foundation_program_name(major)
        ]

    study_levels = academics.get("study_levels")
    if isinstance(study_levels, list):
        academics["study_levels"] = [
            level for level in study_levels if not _is_foundation_study_level(level)
        ]

    admissions = academics.get("admissions")
    if isinstance(admissions, dict):
        admissions_programs = admissions.get("programs")
        if isinstance(admissions_programs, list):
            admissions["programs"] = [
                row
                for row in admissions_programs
                if isinstance(row, dict)
                and not _is_foundation_program_name(
                    row.get("program_name") or row.get("name")
                )
            ]
