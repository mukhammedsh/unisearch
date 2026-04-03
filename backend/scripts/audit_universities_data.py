#!/usr/bin/env python3
"""Audit universities dataset quality and source-link health.

Usage examples:
  python backend/scripts/audit_universities_data.py
  python backend/scripts/audit_universities_data.py --check-http
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = ROOT / "backend" / "data" / "universities.json"
REQUIRED_TOP_LEVEL_KEYS = (
    "id",
    "name",
    "rank",
    "location",
    "coordinates",
    "website",
    "academics",
    "finance",
    "admission_tracks",
    "description",
    "tags",
    "description_source",
    "major_focus",
    "fact_provenance",
)


def _is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_http_url(value: Any) -> bool:
    if not _is_non_empty_text(value):
        return False
    parsed = urlparse(str(value).strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _clamp_http_timeout(value: float) -> float:
    try:
        out = float(value)
    except Exception:
        out = 8.0
    return max(0.8, min(out, 40.0))


def _http_status(url: str, timeout_sec: float) -> Tuple[Optional[int], str]:
    req = Request(
        url,
        headers={
            "User-Agent": "UniSearch-DataAudit/1.0",
            "Accept": "text/html,application/json,*/*;q=0.1",
        },
    )
    try:
        with urlopen(req, timeout=timeout_sec) as resp:  # noqa: S310
            status = int(getattr(resp, "status", 200))
            final_url = str(resp.geturl() or url)
            return status, final_url
    except HTTPError as e:
        return int(e.code), url
    except URLError:
        return None, url
    except Exception:
        return None, url


def _has_suspicious_url_chars(value: str) -> bool:
    return any(ord(ch) > 127 for ch in str(value or ""))


def _iter_source_urls(university: Dict[str, Any]) -> Iterable[Tuple[str, str]]:
    website = university.get("website")
    if _is_non_empty_text(website):
        yield "website", str(website).strip()

    description_source = university.get("description_source")
    if _is_non_empty_text(description_source):
        yield "description_source", str(description_source).strip()

    verified = university.get("verified_sources")
    if isinstance(verified, list):
        for idx, row in enumerate(verified):
            if not isinstance(row, dict):
                continue
            url = row.get("url")
            if not _is_non_empty_text(url):
                continue
            topic = str(row.get("topic") or f"topic_{idx}").strip()
            yield f"verified_sources[{idx}]/{topic}", str(url).strip()

    academics = university.get("academics")
    if isinstance(academics, dict):
        admissions = academics.get("admissions")
        if isinstance(admissions, dict):
            for section_key in ("university_wide", "program_level"):
                section = admissions.get(section_key)
                if not isinstance(section, dict):
                    continue
                provenance = section.get("provenance")
                if isinstance(provenance, dict):
                    url = provenance.get("source_url")
                    if _is_non_empty_text(url):
                        yield f"academics.admissions.{section_key}.provenance.source_url", str(url).strip()
                sources = section.get("sources")
                if isinstance(sources, list):
                    for s_idx, source_row in enumerate(sources):
                        if not isinstance(source_row, dict):
                            continue
                        url = source_row.get("url")
                        if _is_non_empty_text(url):
                            yield f"academics.admissions.{section_key}.sources[{s_idx}]", str(url).strip()
            programs = admissions.get("programs")
            if isinstance(programs, list):
                for p_idx, program in enumerate(programs):
                    if not isinstance(program, dict):
                        continue
                    name = str(program.get("program_name") or program.get("name") or f"program_{p_idx}").strip()
                    provenance = program.get("provenance")
                    if isinstance(provenance, dict):
                        url = provenance.get("source_url")
                        if _is_non_empty_text(url):
                            yield f"academics.admissions.programs[{p_idx}]/{name}/provenance.source_url", str(url).strip()
                    sources = program.get("sources")
                    if not isinstance(sources, list):
                        continue
                    for s_idx, source_row in enumerate(sources):
                        if not isinstance(source_row, dict):
                            continue
                        url = source_row.get("url")
                        if _is_non_empty_text(url):
                            yield f"academics.admissions.programs[{p_idx}]/{name}/sources[{s_idx}]", str(url).strip()

    tracks = university.get("admission_tracks")
    if not isinstance(tracks, list):
        return
    for t_idx, track in enumerate(tracks):
        if not isinstance(track, dict):
            continue
        track_id = str(track.get("id") or f"track_{t_idx}").strip()
        track_source_url = track.get("stats_avg_source_url")
        if _is_non_empty_text(track_source_url):
            yield (
                f"admission_tracks[{t_idx}]/{track_id}/stats_avg_source_url",
                str(track_source_url).strip(),
            )

        lang_reqs = track.get("language_requirements")
        if not isinstance(lang_reqs, list):
            continue
        for lr_idx, row in enumerate(lang_reqs):
            if not isinstance(row, dict):
                continue
            code = str(row.get("code") or f"lang_{lr_idx}").strip()
            source_url = row.get("stats_avg_source_url")
            if _is_non_empty_text(source_url):
                yield (
                    f"admission_tracks[{t_idx}]/{track_id}/language_requirements[{lr_idx}]/{code}/stats_avg_source_url",
                    str(source_url).strip(),
                )


def _program_acceptance_values(academics: Dict[str, Any]) -> List[float]:
    programs = academics.get("programs")
    if not isinstance(programs, list):
        return []
    vals: List[float] = []
    for row in programs:
        if not isinstance(row, dict):
            continue
        value = row.get("acceptance_rate_percent")
        if isinstance(value, (int, float)):
            vals.append(float(value))
    return vals


def _bool_or_default(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return bool(default)
    return bool(value)


def audit_dataset(
    data_path: Path,
    check_http: bool = False,
    http_timeout_sec: float = 8.0,
    max_urls_per_university: int = 24,
) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    try:
        payload = json.loads(data_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"Failed to read dataset: {exc}"], warnings

    if not isinstance(payload, list):
        return ["Dataset root must be a JSON list"], warnings
    if not payload:
        return ["Dataset is empty"], warnings

    ids = Counter(str(row.get("id") or "").strip() for row in payload if isinstance(row, dict))
    duplicate_ids = [uid for uid, count in ids.items() if uid and count > 1]
    if duplicate_ids:
        errors.append(f"Duplicate university ids: {duplicate_ids}")

    for idx, row in enumerate(payload):
        if not isinstance(row, dict):
            errors.append(f"Row {idx} is not an object")
            continue

        uid = str(row.get("id") or f"row_{idx}").strip() or f"row_{idx}"

        for key in REQUIRED_TOP_LEVEL_KEYS:
            if key not in row:
                errors.append(f"{uid}: missing top-level key '{key}'")

        if not _is_non_empty_text(row.get("id")):
            errors.append(f"{uid}: empty id")
        if not _is_non_empty_text(row.get("name")):
            errors.append(f"{uid}: empty name")

        rank = row.get("rank")
        if not isinstance(rank, (int, float)) or float(rank) <= 0:
            errors.append(f"{uid}: rank must be positive number")

        location = row.get("location")
        if not isinstance(location, dict):
            errors.append(f"{uid}: location must be object")
        else:
            if not _is_non_empty_text(location.get("country")):
                errors.append(f"{uid}: location.country is empty")
            if not _is_non_empty_text(location.get("city")):
                errors.append(f"{uid}: location.city is empty")

        coordinates = row.get("coordinates")
        if not isinstance(coordinates, dict):
            errors.append(f"{uid}: coordinates must be object")
        else:
            lat = coordinates.get("lat")
            lon = coordinates.get("lon")
            if not isinstance(lat, (int, float)) or not (-90.0 <= float(lat) <= 90.0):
                errors.append(f"{uid}: coordinates.lat out of range")
            if not isinstance(lon, (int, float)) or not (-180.0 <= float(lon) <= 180.0):
                errors.append(f"{uid}: coordinates.lon out of range")

        if not _is_http_url(row.get("website")):
            errors.append(f"{uid}: website must be valid http/https URL")
        if not _is_http_url(row.get("description_source")):
            errors.append(f"{uid}: description_source must be valid http/https URL")

        description = row.get("description")
        if _is_non_empty_text(description) and len(str(description).strip()) < 30:
            warnings.append(f"{uid}: description is very short")

        tags = row.get("tags")
        if isinstance(tags, list) and tags:
            warnings.append(f"{uid}: tags contain subjective metadata and should be reviewed")

        student_count = row.get("student_count")
        if student_count is not None and not isinstance(student_count, (int, float)):
            errors.append(f"{uid}: student_count must be numeric when present")

        outcomes = row.get("outcomes")
        if isinstance(outcomes, dict) and outcomes.get("average_early_career_salary_usd") is not None:
            warnings.append(f"{uid}: outcomes.average_early_career_salary_usd has no verified source field")

        major_focus = row.get("major_focus")
        if major_focus is not None and not isinstance(major_focus, list):
            errors.append(f"{uid}: major_focus must be a list when present")

        factors_meta = row.get("factors_meta")
        if isinstance(factors_meta, dict):
            raw_metrics = factors_meta.get("raw_metrics")
            if isinstance(raw_metrics, dict) and "admissions_acceptance_percent_avg" in raw_metrics:
                warnings.append(
                    f"{uid}: factors_meta.raw_metrics.admissions_acceptance_percent_avg should be removed"
                )

        academics = row.get("academics")
        if not isinstance(academics, dict):
            errors.append(f"{uid}: academics must be object")
        else:
            programs = academics.get("programs")
            if not isinstance(programs, list) or not programs:
                errors.append(f"{uid}: academics.programs is missing or empty")
            else:
                for p_idx, program in enumerate(programs):
                    if not isinstance(program, dict):
                        errors.append(f"{uid}: academics.programs[{p_idx}] must be object")
                        continue
                    if not _is_non_empty_text(program.get("name")):
                        errors.append(f"{uid}: academics.programs[{p_idx}].name is empty")

            acceptance = academics.get("acceptance_rate_percent")
            if acceptance is not None:
                if not isinstance(acceptance, (int, float)) or not (0.0 <= float(acceptance) <= 100.0):
                    errors.append(f"{uid}: academics.acceptance_rate_percent must be within [0, 100]")

            admissions = academics.get("admissions")
            if admissions is not None and not isinstance(admissions, dict):
                errors.append(f"{uid}: academics.admissions must be object when present")
            elif isinstance(admissions, dict):
                schema_version = admissions.get("schema_version")
                if not isinstance(schema_version, int) or schema_version <= 0:
                    errors.append(f"{uid}: academics.admissions.schema_version must be positive integer")
                if not _is_non_empty_text(admissions.get("status_date")):
                    errors.append(f"{uid}: academics.admissions.status_date is empty")

                university_wide = admissions.get("university_wide")
                if not isinstance(university_wide, dict):
                    errors.append(f"{uid}: academics.admissions.university_wide must be object")
                else:
                    if not _is_non_empty_text(university_wide.get("status")):
                        errors.append(f"{uid}: academics.admissions.university_wide.status is empty")
                    uw_rate = university_wide.get("acceptance_rate_percent")
                    if uw_rate is not None:
                        if not isinstance(uw_rate, (int, float)) or not (0.0 <= float(uw_rate) <= 100.0):
                            errors.append(f"{uid}: academics.admissions.university_wide.acceptance_rate_percent must be within [0, 100]")
                        elif isinstance(acceptance, (int, float)) and round(float(uw_rate), 2) != round(float(acceptance), 2):
                            errors.append(f"{uid}: academics.admissions.university_wide.acceptance_rate_percent does not match academics.acceptance_rate_percent")
                    provenance = university_wide.get("provenance")
                    if provenance is not None and not isinstance(provenance, dict):
                        errors.append(f"{uid}: academics.admissions.university_wide.provenance must be object when present")
                    elif isinstance(provenance, dict):
                        if not _is_non_empty_text(provenance.get("source")):
                            errors.append(f"{uid}: academics.admissions.university_wide.provenance.source is empty")
                        if not _is_non_empty_text(provenance.get("verified_at")):
                            errors.append(f"{uid}: academics.admissions.university_wide.provenance.verified_at is empty")

                program_level = admissions.get("program_level")
                if not isinstance(program_level, dict):
                    errors.append(f"{uid}: academics.admissions.program_level must be object")
                else:
                    if not _is_non_empty_text(program_level.get("status")):
                        errors.append(f"{uid}: academics.admissions.program_level.status is empty")
                    pl_rate = program_level.get("acceptance_rate_percent")
                    if pl_rate is not None and (not isinstance(pl_rate, (int, float)) or not (0.0 <= float(pl_rate) <= 100.0)):
                        errors.append(f"{uid}: academics.admissions.program_level.acceptance_rate_percent must be within [0, 100]")

                admissions_programs = admissions.get("programs")
                if admissions_programs is not None and not isinstance(admissions_programs, list):
                    errors.append(f"{uid}: academics.admissions.programs must be list when present")
                elif isinstance(admissions_programs, list):
                    for p_idx, program in enumerate(admissions_programs):
                        if not isinstance(program, dict):
                            errors.append(f"{uid}: academics.admissions.programs[{p_idx}] must be object")
                            continue
                        p_rate = program.get("acceptance_rate_percent")
                        if p_rate is not None and (not isinstance(p_rate, (int, float)) or not (0.0 <= float(p_rate) <= 100.0)):
                            errors.append(f"{uid}: academics.admissions.programs[{p_idx}].acceptance_rate_percent must be within [0, 100]")

            a_tags = academics.get("major_tags")
            if a_tags is not None and not isinstance(a_tags, list):
                errors.append(f"{uid}: academics.major_tags must be a list when present")

        finance = row.get("finance")
        if not isinstance(finance, dict):
            errors.append(f"{uid}: finance must be object")
        else:
            total_cost = finance.get("total_cost_year_usd")
            if not isinstance(total_cost, (int, float)) or float(total_cost) < 0:
                errors.append(f"{uid}: finance.total_cost_year_usd must be non-negative number")
            aid = finance.get("financial_aid")
            if not isinstance(aid, dict):
                errors.append(f"{uid}: finance.financial_aid must be object")
            else:
                aid_m = _bool_or_default(aid.get("merit_based"))
                aid_n = _bool_or_default(aid.get("need_based"))
                if aid_m != aid.get("merit_based") or aid_n != aid.get("need_based"):
                    warnings.append(f"{uid}: finance.financial_aid values are not strict booleans")

        tracks = row.get("admission_tracks")
        if not isinstance(tracks, list) or not tracks:
            errors.append(f"{uid}: admission_tracks is missing or empty")
        else:
            for t_idx, track in enumerate(tracks):
                if not isinstance(track, dict):
                    errors.append(f"{uid}: admission_tracks[{t_idx}] must be object")
                    continue
                if not _is_non_empty_text(track.get("id")):
                    errors.append(f"{uid}: admission_tracks[{t_idx}].id is empty")
                if not _is_non_empty_text(track.get("label")):
                    errors.append(f"{uid}: admission_tracks[{t_idx}].label is empty")
                f_type = str(track.get("funding_type") or "").strip().lower()
                if f_type not in ("grant", "paid"):
                    warnings.append(f"{uid}: admission_tracks[{t_idx}].funding_type is '{f_type or 'empty'}'")
                track_avg = track.get("stats_avg")
                if isinstance(track_avg, dict) and track_avg and not _is_non_empty_text(track.get("stats_avg_source_url")):
                    warnings.append(f"{uid}: admission_tracks[{t_idx}].stats_avg has no stats_avg_source_url")

                lang_reqs = track.get("language_requirements")
                if not isinstance(lang_reqs, list):
                    continue
                for lr_idx, lang_rule in enumerate(lang_reqs):
                    if not isinstance(lang_rule, dict):
                        errors.append(f"{uid}: admission_tracks[{t_idx}].language_requirements[{lr_idx}] must be object")
                        continue
                    lang_avg = lang_rule.get("stats_avg")
                    if isinstance(lang_avg, dict) and lang_avg and not _is_non_empty_text(lang_rule.get("stats_avg_source_url")):
                        warnings.append(
                            f"{uid}: admission_tracks[{t_idx}].language_requirements[{lr_idx}].stats_avg has no stats_avg_source_url"
                        )

        fact_provenance = row.get("fact_provenance")
        if not isinstance(fact_provenance, dict):
            errors.append(f"{uid}: fact_provenance must be object")
        else:
            facts = fact_provenance.get("facts")
            if not isinstance(facts, dict):
                errors.append(f"{uid}: fact_provenance.facts must be object")
            else:
                for fact_key in ("rank", "tuition_total_cost_year_usd"):
                    fact_row = facts.get(fact_key)
                    if not isinstance(fact_row, dict):
                        errors.append(f"{uid}: missing fact_provenance.facts.{fact_key}")
                        continue
                    source = fact_row.get("source")
                    verified_at = fact_row.get("verified_at")
                    if not _is_non_empty_text(source):
                        errors.append(f"{uid}: fact_provenance.facts.{fact_key}.source is empty")
                    if not _is_non_empty_text(verified_at):
                        errors.append(f"{uid}: fact_provenance.facts.{fact_key}.verified_at is empty")
                student_count = row.get("student_count")
                if student_count is not None:
                    fact_row = facts.get("student_count")
                    if not isinstance(fact_row, dict):
                        warnings.append(f"{uid}: student_count is present without fact_provenance.facts.student_count")
                    else:
                        source = fact_row.get("source")
                        verified_at = fact_row.get("verified_at")
                        if not _is_non_empty_text(source):
                            errors.append(f"{uid}: fact_provenance.facts.student_count.source is empty")
                        if not _is_non_empty_text(verified_at):
                            errors.append(f"{uid}: fact_provenance.facts.student_count.verified_at is empty")

                academics = row.get("academics") if isinstance(row.get("academics"), dict) else {}
                acceptance = academics.get("acceptance_rate_percent")
                if isinstance(acceptance, (int, float)):
                    meta = academics.get("acceptance_rate_percent_meta")
                    if not isinstance(meta, dict):
                        warnings.append(f"{uid}: academics.acceptance_rate_percent is present without acceptance_rate_percent_meta")
                    else:
                        if not _is_non_empty_text(meta.get("source")):
                            errors.append(f"{uid}: academics.acceptance_rate_percent_meta.source is empty")
                        if not _is_non_empty_text(meta.get("verified_at")):
                            errors.append(f"{uid}: academics.acceptance_rate_percent_meta.verified_at is empty")
                    fact_row = facts.get("acceptance_rate_percent")
                    if not isinstance(fact_row, dict):
                        warnings.append(f"{uid}: academics.acceptance_rate_percent is present without fact_provenance.facts.acceptance_rate_percent")
                    else:
                        source = fact_row.get("source")
                        verified_at = fact_row.get("verified_at")
                        if not _is_non_empty_text(source):
                            errors.append(f"{uid}: fact_provenance.facts.acceptance_rate_percent.source is empty")
                        if not _is_non_empty_text(verified_at):
                            errors.append(f"{uid}: fact_provenance.facts.acceptance_rate_percent.verified_at is empty")

        if check_http:
            url_count = 0
            for source_key, source_url in _iter_source_urls(row):
                if url_count >= max_urls_per_university:
                    break
                url_count += 1
                if not _is_http_url(source_url):
                    errors.append(f"{uid}: invalid URL in {source_key}: {source_url}")
                    continue
                if _has_suspicious_url_chars(source_url):
                    errors.append(f"{uid}: non-ascii URL in {source_key}: {source_url}")
                    continue
                status, final_url = _http_status(source_url, timeout_sec=http_timeout_sec)
                if status == 404:
                    errors.append(f"{uid}: 404 in {source_key}: {source_url}")
                elif status is None:
                    warnings.append(f"{uid}: URL unreachable in {source_key}: {source_url}")
                elif status >= 500:
                    warnings.append(f"{uid}: {status} in {source_key}: {source_url}")
                elif status >= 400:
                    # 401/403 are often anti-bot responses for valid pages.
                    warnings.append(f"{uid}: {status} in {source_key}: {source_url}")
                if final_url and final_url != source_url and not _is_http_url(final_url):
                    warnings.append(f"{uid}: non-http redirect in {source_key}: {source_url} -> {final_url}")
                time.sleep(0.01)

    return errors, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit universities dataset quality.")
    parser.add_argument(
        "--data",
        default=str(DEFAULT_DATA_PATH),
        help="Path to universities.json",
    )
    parser.add_argument(
        "--check-http",
        action="store_true",
        help="Perform HTTP checks for website/description_source/verified_sources URLs.",
    )
    parser.add_argument(
        "--http-timeout",
        type=float,
        default=8.0,
        help="HTTP timeout in seconds (used with --check-http).",
    )
    parser.add_argument(
        "--max-urls-per-university",
        type=int,
        default=24,
        help="Safety cap for URL checks per university (used with --check-http).",
    )
    args = parser.parse_args()

    data_path = Path(args.data).resolve()
    if not data_path.exists():
        print(f"ERROR: data file does not exist: {data_path}")
        sys.exit(1)

    timeout_sec = _clamp_http_timeout(args.http_timeout)
    max_urls_per_uni = max(1, int(args.max_urls_per_university))

    # Avoid TLS handshake failures on some sites with strict cert chains.
    ssl._create_default_https_context = ssl._create_unverified_context

    errors, warnings = audit_dataset(
        data_path=data_path,
        check_http=bool(args.check_http),
        http_timeout_sec=timeout_sec,
        max_urls_per_university=max_urls_per_uni,
    )

    print(f"Dataset: {data_path}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    if errors:
        print("\nERROR LIST")
        for line in errors:
            print(f"- {line}")
    if warnings:
        print("\nWARNING LIST")
        for line in warnings:
            print(f"- {line}")

    if errors:
        sys.exit(1)
    print("\nAudit passed.")


if __name__ == "__main__":
    main()
