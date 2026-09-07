"""
University tracks, majors, score profile derivations, and admission choices.
"""
from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.utils import (
    safe_lower as _safe_lower,
    to_float as _num_or_none,
)
from app.services import exams as exams_service


def _uniq_non_empty(items: List[Any]) -> List[str]:
    out: List[str] = []
    seen = set()
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


def _get_nested(u: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur

_CANONICAL_MAJORS = [
    "computer science",
    "engineering",
    "business",
    "medicine",
    "natural sciences",
    "economics",
    "physics",
    "mathematics",
    "law",
    "social sciences",
    "architecture",
    "psychology",
    "humanities",
    "design",
    "life sciences",
    "education",
    "agriculture",
]

_MAJOR_PHRASES: Dict[str, List[str]] = {
    "computer science": [
        "computer science",
        "computing",
        "informatics",
        "software engineering",
        "information systems",
        "computer engineering",
        "computer science and engineering",
        "computer science and technology",
        "cs",
        "eecs",
    ],
    "engineering": [
        "engineering",
        "aerospace",
        "mechanical",
        "electrical",
        "civil",
        "chemical",
        "industrial",
        "mechatronics",
        "robotics",
    ],
    "business": ["business", "management", "finance", "marketing", "accounting", "mba"],
    "medicine": ["medicine", "medical", "clinical", "nursing", "pharmacy", "dentistry"],
    "natural sciences": [
        "natural sciences",
        "natural science",
        "chemistry",
        "earth science",
        "environmental science",
    ],
    "economics": ["economics", "economy", "econometrics"],
    "physics": ["physics", "astrophysics"],
    "mathematics": ["mathematics", "math", "statistics", "actuarial"],
    "law": ["law", "legal", "jurisprudence", "llb", "jd"],
    "social sciences": [
        "social sciences",
        "social science",
        "sociology",
        "political science",
        "anthropology",
    ],
    "architecture": ["architecture", "urban planning", "built environment"],
    "psychology": ["psychology", "psychological"],
    "humanities": [
        "humanities",
        "history",
        "philosophy",
        "linguistics",
        "literature",
        "classics",
    ],
    "design": [
        "design",
        "graphic design",
        "industrial design",
        "interaction design",
        "ux",
        "ui",
        "product design",
    ],
    "life sciences": [
        "life sciences",
        "life science",
        "biology",
        "biotechnology",
        "biomedical",
        "genetics",
        "neuroscience",
    ],
    "education": ["education", "teaching", "pedagogy", "curriculum", "teacher"],
    "agriculture": ["agriculture", "agricultural", "agronomy", "horticulture"],
}


def _normalize_major_text(value: Any) -> str:
    text = _safe_lower(value).replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    pattern = r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, text) is not None


def _major_tags_from_text(value: Any) -> List[str]:
    text = _normalize_major_text(value)
    if not text:
        return []
    out: List[str] = []
    for canonical in _CANONICAL_MAJORS:
        phrases = _MAJOR_PHRASES.get(canonical, [canonical])
        if any(_contains_phrase(text, _normalize_major_text(p)) for p in phrases):
            out.append(canonical)
    return out


def _canonical_major(value: Any) -> str:
    text = _normalize_major_text(value)
    if not text:
        return ""
    if text in _CANONICAL_MAJORS:
        return text
    tags = _major_tags_from_text(text)
    if len(tags) == 1:
        return tags[0]
    return ""


def _iter_programs(u: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = _get_nested(u, ["academics", "programs"], [])
    if not isinstance(raw, list):
        return []
    return [p for p in raw if isinstance(p, dict)]


def _track_program_names(u: Dict[str, Any]) -> List[str]:
    academics = u.get("academics")
    academics_obj = academics if isinstance(academics, dict) else {}
    names = [p.get("name") for p in _iter_programs(u)]
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
    stats_avg: Any, requirements: Any
) -> Any:
    if not isinstance(stats_avg, dict):
        return copy.deepcopy(stats_avg)
    if not isinstance(requirements, dict) or not requirements:
        return copy.deepcopy(stats_avg)

    allowed_keys = {
        exams_service.resolve_exam_key(key)
        for key in requirements.keys()
        if not _is_language_exam_key_for_track_merge(key)
    }
    allowed_keys = {
        str(key or "").strip().upper() for key in allowed_keys if str(key or "").strip()
    }
    if not allowed_keys:
        return copy.deepcopy(stats_avg)

    filtered: Dict[str, Any] = {}
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


def _funding_options_from_profile_or_category(category: Dict[str, Any], profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    profile_options = profile.get("funding_options")
    if isinstance(profile_options, list) and profile_options:
        return [copy.deepcopy(row) for row in profile_options if isinstance(row, dict)]
    category_options = category.get("funding_options")
    if isinstance(category_options, list) and category_options:
        return [copy.deepcopy(row) for row in category_options if isinstance(row, dict)]
    return []


def _admission_choice_from_parts(
    category: Dict[str, Any],
    profile: Dict[str, Any],
    funding: Optional[Dict[str, Any]] = None,
    funding_idx: int = 0,
) -> Dict[str, Any]:
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

    choice: Dict[str, Any] = {
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
        "language_requirements": copy.deepcopy(profile.get("language_requirements", category.get("language_requirements"))),
        "language_requirements_mode": profile.get("language_requirements_mode", category.get("language_requirements_mode")),
        "extra_requirements": copy.deepcopy(profile.get("extra_requirements", category.get("extra_requirements"))),
        "scholarships": copy.deepcopy(profile.get("scholarships", category.get("scholarships", []))),
        "applicable_majors": copy.deepcopy(profile.get("applicable_majors", category.get("applicable_majors", []))),
        "scope": copy.deepcopy(profile.get("scope", category.get("scope"))),
        "program_ids": copy.deepcopy(profile.get("program_ids", category.get("program_ids", []))),
        "program_names": copy.deepcopy(profile.get("program_names", category.get("program_names", []))),
    }
    if isinstance(merged_requirements, dict) and merged_requirements:
        choice["requirements"] = merged_requirements
    if isinstance(merged_stats_avg, dict) and merged_stats_avg:
        choice["stats_avg"] = merged_stats_avg
    if isinstance(merged_finance_override, dict) and merged_finance_override:
        choice["finance_override"] = merged_finance_override
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


def expand_admission_choices(categories: Any) -> List[Dict[str, Any]]:
    if not isinstance(categories, list):
        return []

    expanded: List[Dict[str, Any]] = []
    for category in categories:
        if not isinstance(category, dict):
            continue
        profiles = category.get("requirement_profiles")
        profile_rows = [row for row in profiles if isinstance(row, dict)] if isinstance(profiles, list) else []
        if not profile_rows:
            profile_rows = [{"id": "general", "label": category.get("label") or "General requirements"}]
        for profile in profile_rows:
            options = _funding_options_from_profile_or_category(category, profile)
            if not options:
                expanded.append(_admission_choice_from_parts(category, profile))
                continue
            for option_idx, option in enumerate(options):
                expanded.append(_admission_choice_from_parts(category, profile, option, option_idx))
    return expanded


def _derive_track_applicable_majors(
    u: Dict[str, Any], track: Dict[str, Any]
) -> List[str]:
    explicit = track.get("applicable_majors")
    if isinstance(explicit, list) and explicit:
        return _uniq_non_empty(explicit)

    program_names = _track_program_names(u)
    if not program_names:
        return []

    blob_parts: List[Any] = [
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
    u: Dict[str, Any], track: Dict[str, Any]
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


def _track_requirement_exam_candidates(track: Dict[str, Any]) -> List[str]:
    ordered: List[str] = []
    seen = set()

    def collect(source: Any) -> None:
        if not isinstance(source, dict):
            return
        primary = []
        fallback = []
        for raw_key in source.keys():
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


def _track_primary_exam_id(track: Dict[str, Any]) -> str:
    candidates = _track_requirement_exam_candidates(track)
    return candidates[0] if candidates else ""


def _score_profile_program_matches_track(
    track: Dict[str, Any], program: Dict[str, Any]
) -> bool:
    if not isinstance(track, dict) or not isinstance(program, dict):
        return False
    program_name = str(program.get("program_name") or program.get("name") or "").strip()
    if not program_name:
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
    track: Dict[str, Any], program: Dict[str, Any]
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


def _parse_numeric_multiplier(value: Any) -> Optional[float]:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", str(value or ""))
    if not match:
        return None
    return _num_or_none(match.group(1))


def _weighted_total_scale_max(counts: Dict[str, Any]) -> Optional[float]:
    if not isinstance(counts, dict):
        return None
    best_of = 5
    selection_principle = str(counts.get("selection_principle") or "").strip().lower()
    match = re.search(r"best\s*(\d+)", selection_principle)
    if match:
        best_of = max(1, int(match.group(1)))

    subject_weighting = counts.get("subject_weighting")
    weights: List[float] = []
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
    metric_id: str, counts: Dict[str, Any]
) -> Optional[Tuple[float, float, str]]:
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


def _normalize_score_value(raw_value: float, scale: Tuple[float, float, str]) -> float:
    _, _, metric_exam_id = scale
    if metric_exam_id:
        normalized = exams_service.normalize_exam_score(metric_exam_id, raw_value)
        if normalized is not None:
            return float(normalized)
    mn, mx, _ = scale
    return max(0.0, min(100.0, ((float(raw_value) - mn) / max(mx - mn, 1e-9)) * 100.0))


def _extract_track_score_percentiles(
    counts: Dict[str, Any],
) -> Optional[Dict[str, float]]:
    if not isinstance(counts, dict):
        return None

    for raw_key in counts.keys():
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

    for raw_key in counts.keys():
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
    u: Dict[str, Any], track: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    explicit = track.get("score_profile")
    if isinstance(explicit, dict) and explicit:
        return explicit

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
        compatible_exam_ids = []
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
        uses_exam_anchor = bool(
            metric_exam_id
        ) and exams_service.exam_supports_percentile_normalization(metric_exam_id)
        profile = {
            "metric_id": str(extracted.get("metric_id") or ""),
            "metric_unit": str(program.get("metric_unit") or ""),
            "p25_raw": round(float(extracted["p25_raw"]), 2),
            "median_raw": round(float(extracted["median_raw"]), 2),
            "p75_raw": round(float(extracted["p75_raw"]), 2),
            "p25_normalized": round(
                _normalize_score_value(float(extracted["p25_raw"]), scale), 2
            ),
            "median_normalized": round(
                _normalize_score_value(float(extracted["median_raw"]), scale), 2
            ),
            "p75_normalized": round(
                _normalize_score_value(float(extracted["p75_raw"]), scale), 2
            ),
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


def _is_foundation_study_level(value: Any) -> bool:
    return _contains_phrase(_normalize_major_text(value), "foundation")


def _is_foundation_program_row(program: Dict[str, Any]) -> bool:
    if not isinstance(program, dict):
        return False

    if _is_foundation_program_name(program.get("name")):
        return True

    levels = program.get("study_levels")
    if isinstance(levels, list) and any(
        _is_foundation_study_level(level) for level in levels
    ):
        return True
    if levels is not None and _is_foundation_study_level(levels):
        return True

    return False


def _filter_academics_for_product_scope(academics: Dict[str, Any]) -> None:
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


