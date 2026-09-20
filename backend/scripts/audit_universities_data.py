#!/usr/bin/env python3
"""Audit universities dataset quality and source-link health.

Usage examples:
  python backend/scripts/audit_universities_data.py
  python backend/scripts/audit_universities_data.py --check-http
"""

from __future__ import annotations

import argparse
from datetime import date
import ipaddress
import json
import math
import re
import socket
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


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
    "admission_categories",
    "description",
    "tags",
    "description_source",
    "major_focus",
    "fact_provenance",
)
PROGRAM_NAME_ALLOWLIST_BY_PHRASE = {
    "bachelor of advanced computing": {"university-of-sydney-au-sydney"},
}
_SUBJECTIVE_OR_UNVERIFIED_TAGS = frozenset({
    "academic_mobility",
    "applied_learning",
    "digital_technology",
    "entrepreneurship",
    "global",
    "industry_links",
    "industry_partnerships",
    "innovation",
    "international_partnerships",
    "natural_resources",
    "prestige",
    "student_life",
    "sustainability",
    "technology",
})


def _is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_valid_positive_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    try:
        val = float(value)
        return not math.isnan(val) and not math.isinf(val) and val > 0
    except (TypeError, ValueError, OverflowError):
        return False


def _is_valid_iso_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    clean = value.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", clean):
        return False
    try:
        date.fromisoformat(clean)
        return True
    except ValueError:
        return False


def _is_http_url(value: Any) -> bool:
    if not _is_non_empty_text(value):
        return False
    parsed = urlparse(str(value).strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _public_http_url_reason(value: Any) -> str:
    if not _is_http_url(value):
        return "URL must use http/https and include a host"
    parsed = urlparse(str(value).strip())
    host = str(parsed.hostname or "").strip()
    if not host:
        return "URL host is empty"
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except OSError:
        return "URL host cannot be resolved"
    addresses = {str(row[4][0]) for row in infos if row and row[4]}
    if not addresses:
        return "URL host has no resolved addresses"
    blocked = sorted(address for address in addresses if not _is_public_ip(address))
    if blocked:
        return f"URL resolves to non-public address: {blocked[0]}"
    return ""


def _is_public_http_url(value: Any) -> bool:
    return _public_http_url_reason(value) == ""


def _clamp_http_timeout(value: float) -> float:
    try:
        out = float(value)
    except Exception:
        out = 8.0
    return max(0.8, min(out, 40.0))


class _SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        reason = _public_http_url_reason(newurl)
        if reason:
            raise URLError(f"blocked redirect: {reason}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _http_status(url: str, timeout_sec: float) -> Tuple[Optional[int], str]:
    reason = _public_http_url_reason(url)
    if reason:
        return None, url
    req = Request(
        url,
        headers={
            "User-Agent": "UniSearch-DataAudit/1.0",
            "Accept": "text/html,application/json,*/*;q=0.1",
        },
    )
    opener = build_opener(_SafeRedirectHandler)
    try:
        with opener.open(req, timeout=timeout_sec) as resp:
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
        structure = academics.get("undergraduate_structure")
        if isinstance(structure, dict) and _is_non_empty_text(structure.get("source_url")):
            yield "academics.undergraduate_structure.source_url", str(structure.get("source_url")).strip()
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

    finance = university.get("finance")
    if isinstance(finance, dict):
        if _is_non_empty_text(finance.get("source_url")):
            yield "finance.source_url", str(finance.get("source_url")).strip()
        one_time_costs = finance.get("one_time_costs")
        if isinstance(one_time_costs, list):
            for cost_idx, cost in enumerate(one_time_costs):
                if not isinstance(cost, dict):
                    continue
                source_urls = cost.get("source_urls")
                if not isinstance(source_urls, list):
                    continue
                for source_idx, source_url in enumerate(source_urls):
                    if _is_non_empty_text(source_url):
                        yield (
                            f"finance.one_time_costs[{cost_idx}].source_urls[{source_idx}]",
                            str(source_url).strip(),
                        )
        financial_aid = finance.get("financial_aid")
        if isinstance(financial_aid, dict) and _is_non_empty_text(financial_aid.get("source_url")):
            yield "finance.financial_aid.source_url", str(financial_aid.get("source_url")).strip()

    categories = university.get("admission_categories")
    if isinstance(categories, list):
        for c_idx, category in enumerate(categories):
            if not isinstance(category, dict):
                continue
            category_id = str(category.get("id") or f"category_{c_idx}").strip()
            for field_name in ("published_admission", "finance_override"):
                structured = category.get(field_name)
                if isinstance(structured, dict) and _is_non_empty_text(structured.get("source_url")):
                    yield (
                        f"admission_categories[{c_idx}]/{category_id}/{field_name}.source_url",
                        str(structured.get("source_url")).strip(),
                    )
            profiles = category.get("requirement_profiles")
            if not isinstance(profiles, list):
                continue
            for p_idx, profile in enumerate(profiles):
                if not isinstance(profile, dict):
                    continue
                profile_id = str(profile.get("id") or f"profile_{p_idx}").strip()
                for field_name in ("published_admission", "finance_override"):
                    structured = profile.get(field_name)
                    if isinstance(structured, dict) and _is_non_empty_text(structured.get("source_url")):
                        yield (
                            f"admission_categories[{c_idx}]/{category_id}/requirement_profiles[{p_idx}]/{profile_id}/{field_name}.source_url",
                            str(structured.get("source_url")).strip(),
                        )
                profile_source_url = profile.get("stats_avg_source_url")
                if _is_non_empty_text(profile_source_url):
                    yield (
                        f"admission_categories[{c_idx}]/{category_id}/requirement_profiles[{p_idx}]/{profile_id}/stats_avg_source_url",
                        str(profile_source_url).strip(),
                    )

                lang_reqs = profile.get("language_requirements")
                if isinstance(lang_reqs, list):
                    for lr_idx, row in enumerate(lang_reqs):
                        if not isinstance(row, dict):
                            continue
                        code = str(row.get("code") or f"lang_{lr_idx}").strip()
                        source_url = row.get("stats_avg_source_url")
                        if _is_non_empty_text(source_url):
                            yield (
                                f"admission_categories[{c_idx}]/{category_id}/requirement_profiles[{p_idx}]/{profile_id}/language_requirements[{lr_idx}]/{code}/stats_avg_source_url",
                                str(source_url).strip(),
                            )

                funding_options = profile.get("funding_options")
                if not isinstance(funding_options, list):
                    funding_options = category.get("funding_options")
                if not isinstance(funding_options, list):
                    continue
                for f_idx, funding in enumerate(funding_options):
                    if not isinstance(funding, dict):
                        continue
                    funding_id = str(funding.get("id") or f"funding_{f_idx}").strip()
                    funding_source_url = funding.get("stats_avg_source_url")
                    if _is_non_empty_text(funding_source_url):
                        yield (
                            f"admission_categories[{c_idx}]/{category_id}/requirement_profiles[{p_idx}]/{profile_id}/funding_options[{f_idx}]/{funding_id}/stats_avg_source_url",
                            str(funding_source_url).strip(),
                        )

    fact_provenance = university.get("fact_provenance")
    if isinstance(fact_provenance, dict):
        facts = fact_provenance.get("facts")
        if isinstance(facts, dict):
            for fact_name, fact_obj in facts.items():
                if isinstance(fact_obj, dict):
                    source = fact_obj.get("source")
                    if _is_non_empty_text(source) and _is_http_url(source):
                        yield f"fact_provenance.facts.{fact_name}.source", str(source).strip()
                    source_url = fact_obj.get("source_url")
                    if _is_non_empty_text(source_url) and _is_http_url(source_url):
                        yield f"fact_provenance.facts.{fact_name}.source_url", str(source_url).strip()


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


def _audit_comparable_finance(
    errors: List[str],
    uid: str,
    label: str,
    finance: Any,
) -> None:
    if not isinstance(finance, dict):
        return
    has_structured_range = any(
        finance.get(key) is not None
        for key in ("total_cost_year_min", "total_cost_year_max")
    )
    if not has_structured_range:
        return
    minimum = finance.get("total_cost_year_min")
    maximum = finance.get("total_cost_year_max")
    if not isinstance(minimum, (int, float)) or not isinstance(maximum, (int, float)):
        errors.append(f"{uid}: {label} cost range must contain numeric min and max")
    elif float(minimum) < 0 or float(maximum) < float(minimum):
        errors.append(f"{uid}: {label} cost range must satisfy 0 <= min <= max")
    for key in ("currency", "academic_year", "fee_status", "scope", "source_url", "verified_at"):
        if not _is_non_empty_text(finance.get(key)):
            errors.append(f"{uid}: {label}.{key} is required for comparable cost data")


def _audit_one_time_costs(errors: List[str], uid: str, finance: Dict[str, Any]) -> None:
    costs = finance.get("one_time_costs")
    if costs is None:
        return
    if not isinstance(costs, list):
        errors.append(f"{uid}: finance.one_time_costs must be a list when present")
        return

    for cost_idx, cost in enumerate(costs):
        label = f"finance.one_time_costs[{cost_idx}]"
        if not isinstance(cost, dict):
            errors.append(f"{uid}: {label} must be an object")
            continue
        if not _is_non_empty_text(cost.get("type")):
            errors.append(f"{uid}: {label}.type is required")
        amount = cost.get("amount")
        if not isinstance(amount, (int, float)) or float(amount) <= 0:
            errors.append(f"{uid}: {label}.amount must be a positive number")
        if not _is_non_empty_text(cost.get("timing")):
            errors.append(f"{uid}: {label}.timing is required")
        source_urls = cost.get("source_urls")
        if not isinstance(source_urls, list) or not source_urls or not all(_is_non_empty_text(url) for url in source_urls):
            errors.append(f"{uid}: {label}.source_urls must contain official source URLs")


def _audit_published_admission(
    errors: List[str],
    uid: str,
    label: str,
    published: Any,
) -> None:
    if published is None:
        return
    if not isinstance(published, dict):
        errors.append(f"{uid}: {label} must be object when present")
        return
    rate = published.get("rate_percent")
    if not isinstance(rate, (int, float)) or not (0.0 <= float(rate) <= 100.0):
        errors.append(f"{uid}: {label}.rate_percent must be within [0, 100]")
    for key in ("scope", "audience", "cycle", "source_url", "verified_at"):
        if not _is_non_empty_text(published.get(key)):
            errors.append(f"{uid}: {label}.{key} is required for comparable admission data")


VALID_FACT_STATUSES = {
    "official",
    "official_direct",
    "official_derived",
    "official_aggregated",
    "official_external",
    "reviewed",
    "curated",
}


def _audit_derived_salary_basis(
    fact_name: str,
    fact: Dict[str, Any],
    uid: str,
    errors: List[str],
) -> None:
    prov_type = str(fact.get("provenance_type") or fact.get("status") or "").strip().lower()
    if prov_type != "official_derived":
        return
    basis = fact.get("basis")
    if not isinstance(basis, dict):
        errors.append(f"{uid}: fact_provenance.facts.{fact_name} is official_derived but missing basis dict")
        return
    if not _is_non_empty_text(basis.get("fx_source")):
        errors.append(f"{uid}: fact_provenance.facts.{fact_name}.basis.fx_source is empty")
    if not _is_non_empty_text(basis.get("fx_date")):
        errors.append(f"{uid}: fact_provenance.facts.{fact_name}.basis.fx_date is empty")

    has_fx_rate = any(
        _is_valid_positive_number(v)
        for k, v in basis.items()
        if k.startswith("usd_per_") or k.endswith("_to_usd") or k in ("fx_rate", "rate", "fx_rate_to_usd")
    )
    if not has_fx_rate:
        errors.append(f"{uid}: fact_provenance.facts.{fact_name}.basis missing valid positive fx_rate")

    has_source_salary = any(
        _is_valid_positive_number(v) or (isinstance(v, dict) and bool(v))
        for k, v in basis.items()
        if "salary" in k or "source_values" in k or k == "amount"
    )
    if not has_source_salary:
        errors.append(f"{uid}: fact_provenance.facts.{fact_name}.basis missing source salary values")


def _audit_outcomes_and_salary_provenance(
    errors: List[str],
    warnings: List[str],
    uid: str,
    outcomes: Any,
    facts: Dict[str, Any],
) -> None:
    if outcomes is not None and not isinstance(outcomes, dict):
        errors.append(f"{uid}: outcomes must be object when present")
        return

    outcomes_dict = outcomes if isinstance(outcomes, dict) else {}
    allowed_outcome_keys = {
        "early_career_salary_usd",
        "median_earnings_10yr_usd",
        "salary_by_major",
    }
    if any(key not in allowed_outcome_keys for key in outcomes_dict):
        errors.append(f"{uid}: outcomes contains an unrecognized or deprecated key")

    if "average_early_career_salary" in facts or "average_early_career_salary_usd" in facts:
        errors.append(f"{uid}: fact_provenance.facts contains deprecated 'average_early_career_salary'")

    early_val = outcomes_dict.get("early_career_salary_usd")
    if early_val is not None:
        if not _is_valid_positive_number(early_val):
            errors.append(f"{uid}: outcomes.early_career_salary_usd must be positive number")

        fact_early = facts.get("early_career_salary")
        if not isinstance(fact_early, dict):
            errors.append(f"{uid}: outcomes has early career salary but missing fact_provenance.facts.early_career_salary")
        else:
            if not _is_non_empty_text(fact_early.get("source")):
                errors.append(f"{uid}: fact_provenance.facts.early_career_salary.source is empty")
            if not _is_non_empty_text(fact_early.get("verified_at")):
                errors.append(f"{uid}: fact_provenance.facts.early_career_salary.verified_at is empty")
            prov_type = str(fact_early.get("provenance_type") or fact_early.get("status") or "").strip().lower()
            if prov_type and prov_type not in VALID_FACT_STATUSES:
                errors.append(f"{uid}: fact_provenance.facts.early_career_salary has invalid provenance_type")
            _audit_derived_salary_basis("early_career_salary", fact_early, uid, errors)
            f_val = fact_early.get("value")
            if f_val is not None:
                if not _is_valid_positive_number(f_val):
                    errors.append(f"{uid}: fact_provenance.facts.early_career_salary.value must be positive number")
                elif _is_valid_positive_number(early_val) and abs(float(f_val) - float(early_val)) > 0.01:
                    errors.append(f"{uid}: fact_provenance.facts.early_career_salary value does not match outcomes")

    median_10yr = outcomes_dict.get("median_earnings_10yr_usd")
    if median_10yr is not None:
        if not _is_valid_positive_number(median_10yr):
            errors.append(f"{uid}: outcomes.median_earnings_10yr_usd must be positive number")

        fact_10yr = facts.get("median_earnings_10yr")
        if not isinstance(fact_10yr, dict):
            errors.append(f"{uid}: outcomes has median_earnings_10yr_usd but missing fact_provenance.facts.median_earnings_10yr")
        else:
            if not _is_non_empty_text(fact_10yr.get("source")):
                errors.append(f"{uid}: fact_provenance.facts.median_earnings_10yr.source is empty")
            if not _is_non_empty_text(fact_10yr.get("verified_at")):
                errors.append(f"{uid}: fact_provenance.facts.median_earnings_10yr.verified_at is empty")
            prov_type = str(fact_10yr.get("provenance_type") or fact_10yr.get("status") or "").strip().lower()
            if prov_type and prov_type not in VALID_FACT_STATUSES:
                errors.append(f"{uid}: fact_provenance.facts.median_earnings_10yr has invalid provenance_type")
            _audit_derived_salary_basis("median_earnings_10yr", fact_10yr, uid, errors)
            f_val = fact_10yr.get("value")
            if f_val is not None:
                if not _is_valid_positive_number(f_val):
                    errors.append(f"{uid}: fact_provenance.facts.median_earnings_10yr.value must be positive number")
                elif _is_valid_positive_number(median_10yr) and abs(float(f_val) - float(median_10yr)) > 0.01:
                    errors.append(f"{uid}: fact_provenance.facts.median_earnings_10yr value does not match outcomes")

    salary_major = outcomes_dict.get("salary_by_major")
    if salary_major is not None:
        if not isinstance(salary_major, dict) or not salary_major:
            errors.append(f"{uid}: outcomes.salary_by_major must be non-empty object")
        else:
            for major_idx, (_, salary_num) in enumerate(salary_major.items()):
                if not _is_valid_positive_number(salary_num):
                    errors.append(f"{uid}: outcomes.salary_by_major entry {major_idx} must be positive number")
        fact_major = facts.get("salary_by_major")
        if not isinstance(fact_major, dict):
            errors.append(f"{uid}: outcomes has salary_by_major but missing fact_provenance.facts.salary_by_major")
        else:
            if not _is_non_empty_text(fact_major.get("source")):
                errors.append(f"{uid}: fact_provenance.facts.salary_by_major.source is empty")
            if not _is_non_empty_text(fact_major.get("verified_at")):
                errors.append(f"{uid}: fact_provenance.facts.salary_by_major.verified_at is empty")
            prov_type = str(fact_major.get("provenance_type") or fact_major.get("status") or "").strip().lower()
            if prov_type and prov_type not in VALID_FACT_STATUSES:
                errors.append(f"{uid}: fact_provenance.facts.salary_by_major has invalid provenance_type")
            _audit_derived_salary_basis("salary_by_major", fact_major, uid, errors)
            f_val = fact_major.get("value")
            if not isinstance(f_val, dict):
                errors.append(f"{uid}: fact_provenance.facts.salary_by_major.value must be object")
            else:
                for major_idx, (_, salary_num) in enumerate(f_val.items()):
                    if not _is_valid_positive_number(salary_num):
                        errors.append(f"{uid}: fact_provenance.facts.salary_by_major.value entry {major_idx} must be positive number")
                if f_val != salary_major:
                    errors.append(f"{uid}: fact_provenance.facts.salary_by_major value != outcomes.salary_by_major")

    if "early_career_salary" in facts and early_val is None:
        errors.append(f"{uid}: fact_provenance.facts has early_career_salary but outcomes is missing early_career_salary_usd")
    if "median_earnings_10yr" in facts and median_10yr is None:
        errors.append(f"{uid}: fact_provenance.facts has median_earnings_10yr but outcomes is missing median_earnings_10yr_usd")
    if "salary_by_major" in facts and salary_major is None:
        errors.append(f"{uid}: fact_provenance.facts has salary_by_major but outcomes is missing salary_by_major")


def _audit_tags_provenance(
    errors: List[str],
    warnings: List[str],
    uid: str,
    tags: Any,
    facts: Dict[str, Any],
) -> None:
    if isinstance(tags, list) and tags:
        tag_fact = facts.get("tags")
        if not isinstance(tag_fact, dict):
            errors.append(f"{uid}: tags is present but missing fact_provenance.facts.tags")
            return

        fact_tags_val = tag_fact.get("value")
        if not isinstance(fact_tags_val, list):
            errors.append(f"{uid}: fact_provenance.facts.tags.value must be a list")
        elif fact_tags_val != tags:
            errors.append(f"{uid}: fact_provenance.facts.tags value != tags")

        if not _is_non_empty_text(tag_fact.get("source")):
            errors.append(f"{uid}: fact_provenance.facts.tags.source is empty")

        tag_source_url = tag_fact.get("source_url")
        if not _is_http_url(tag_source_url):
            errors.append(f"{uid}: fact_provenance.facts.tags.source_url must be valid http/https URL")

        tag_verified_at = str(tag_fact.get("verified_at") or "").strip()
        if not _is_valid_iso_date(tag_verified_at):
            errors.append(f"{uid}: fact_provenance.facts.tags.verified_at must be valid YYYY-MM-DD date")

        tag_status = str(tag_fact.get("status") or "").strip().lower()
        if not tag_status or tag_status not in VALID_FACT_STATUSES:
            errors.append(f"{uid}: fact_provenance.facts.tags.status '{tag_status}' is invalid")

        if not _is_non_empty_text(tag_fact.get("method")):
            errors.append(f"{uid}: fact_provenance.facts.tags.method is empty")

    if "tags" in facts and not (isinstance(tags, list) and tags):
        errors.append(f"{uid}: fact_provenance.facts has tags but university has no tags")


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
        rank_meta = row.get("rank_meta") if isinstance(row.get("rank_meta"), dict) else {}
        rank_status = str(rank_meta.get("status") or "").strip().lower()
        rank_missing_statuses = {"not_published", "excluded", "not_listed"}
        if rank is None:
            if rank_status not in rank_missing_statuses:
                errors.append(f"{uid}: rank is null without a non-published rank_meta.status")
        elif not isinstance(rank, (int, float)) or float(rank) <= 0:
            errors.append(f"{uid}: rank must be positive number or null with non-published rank metadata")

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
        if isinstance(tags, list):
            if not tags:
                warnings.append(f"{uid}: tags is empty")
            else:
                seen_tags = set()
                for tag in tags:
                    if not isinstance(tag, str) or not tag.strip():
                        errors.append(f"{uid}: tags contains non-string or empty tag")
                        continue
                    clean_tag = tag.strip()
                    if not re.match(r"^[a-z0-9_]+$", clean_tag):
                        errors.append(f"{uid}: tag '{clean_tag}' must be lowercase snake_case")
                    if clean_tag in seen_tags:
                        warnings.append(f"{uid}: duplicate tag '{clean_tag}'")
                    seen_tags.add(clean_tag)
                    if clean_tag in _SUBJECTIVE_OR_UNVERIFIED_TAGS:
                        warnings.append(f"{uid}: tag '{clean_tag}' contains subjective or unverified metadata")
        elif tags is not None:
            errors.append(f"{uid}: tags must be a list when present")

        student_count = row.get("student_count")
        if student_count is not None and not isinstance(student_count, (int, float)):
            errors.append(f"{uid}: student_count must be numeric when present")

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
                    else:
                        program_name = str(program.get("name") or "").strip().lower()
                        for phrase, allowed_ids in PROGRAM_NAME_ALLOWLIST_BY_PHRASE.items():
                            if phrase in program_name and uid not in allowed_ids:
                                errors.append(
                                    f"{uid}: academics.programs[{p_idx}].name looks copied from another institution: {program.get('name')}"
                                )

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
            _audit_comparable_finance(errors, uid, "finance", finance)
            _audit_one_time_costs(errors, uid, finance)

        categories = row.get("admission_categories")
        if not isinstance(categories, list) or not categories:
            errors.append(f"{uid}: admission_categories is missing or empty")
        else:
            for c_idx, category in enumerate(categories):
                if not isinstance(category, dict):
                    errors.append(f"{uid}: admission_categories[{c_idx}] must be object")
                    continue
                if not _is_non_empty_text(category.get("id")):
                    errors.append(f"{uid}: admission_categories[{c_idx}].id is empty")
                if not _is_non_empty_text(category.get("label")):
                    errors.append(f"{uid}: admission_categories[{c_idx}].label is empty")
                scope = str(category.get("scope") or "").strip().lower()
                if scope not in ("general", "program", "program_group"):
                    warnings.append(f"{uid}: admission_categories[{c_idx}].scope is '{scope or 'empty'}'")
                category_label = f"admission_categories[{c_idx}]"
                _audit_published_admission(
                    errors,
                    uid,
                    f"{category_label}.published_admission",
                    category.get("published_admission"),
                )
                _audit_comparable_finance(
                    errors,
                    uid,
                    f"{category_label}.finance_override",
                    category.get("finance_override"),
                )

                profiles = category.get("requirement_profiles")
                if not isinstance(profiles, list) or not profiles:
                    errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles is missing or empty")
                    continue
                for p_idx, profile in enumerate(profiles):
                    if not isinstance(profile, dict):
                        errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}] must be object")
                        continue
                    if not _is_non_empty_text(profile.get("id")):
                        errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].id is empty")
                    if not _is_non_empty_text(profile.get("label")):
                        errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].label is empty")
                    profile_label = f"admission_categories[{c_idx}].requirement_profiles[{p_idx}]"
                    _audit_published_admission(
                        errors,
                        uid,
                        f"{profile_label}.published_admission",
                        profile.get("published_admission"),
                    )
                    _audit_comparable_finance(
                        errors,
                        uid,
                        f"{profile_label}.finance_override",
                        profile.get("finance_override"),
                    )
                    profile_avg = profile.get("stats_avg")
                    if isinstance(profile_avg, dict) and profile_avg and not _is_non_empty_text(profile.get("stats_avg_source_url")):
                        warnings.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].stats_avg has no stats_avg_source_url")

                    lang_reqs = profile.get("language_requirements")
                    if isinstance(lang_reqs, list):
                        for lr_idx, lang_rule in enumerate(lang_reqs):
                            if not isinstance(lang_rule, dict):
                                errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].language_requirements[{lr_idx}] must be object")
                                continue
                            lang_avg = lang_rule.get("stats_avg")
                            if isinstance(lang_avg, dict) and lang_avg and not _is_non_empty_text(lang_rule.get("stats_avg_source_url")):
                                warnings.append(
                                    f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].language_requirements[{lr_idx}].stats_avg has no stats_avg_source_url"
                                )

                    funding_options = profile.get("funding_options")
                    if not isinstance(funding_options, list):
                        funding_options = category.get("funding_options")
                    if not isinstance(funding_options, list):
                        continue
                    for f_idx, funding in enumerate(funding_options):
                        if not isinstance(funding, dict):
                            errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].funding_options[{f_idx}] must be object")
                            continue
                        if not _is_non_empty_text(funding.get("id")):
                            errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].funding_options[{f_idx}].id is empty")
                        if not _is_non_empty_text(funding.get("label")):
                            errors.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].funding_options[{f_idx}].label is empty")
                        f_type = str(funding.get("funding_type") or "").strip().lower()
                        if f_type not in ("grant", "paid"):
                            warnings.append(f"{uid}: admission_categories[{c_idx}].requirement_profiles[{p_idx}].funding_options[{f_idx}].funding_type is '{f_type or 'empty'}'")

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

                _audit_tags_provenance(
                    errors,
                    warnings,
                    uid,
                    row.get("tags"),
                    facts,
                )

                _audit_outcomes_and_salary_provenance(
                    errors,
                    warnings,
                    uid,
                    row.get("outcomes"),
                    facts,
                )

        if check_http:
            url_count = 0
            for source_key, source_url in _iter_source_urls(row):
                if url_count >= max_urls_per_university:
                    break
                url_count += 1
                if not _is_http_url(source_url):
                    errors.append(f"{uid}: invalid URL in {source_key}: {source_url}")
                    continue
                unsafe_reason = _public_http_url_reason(source_url)
                if unsafe_reason:
                    errors.append(f"{uid}: unsafe URL in {source_key}: {source_url} ({unsafe_reason})")
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
                if final_url and final_url != source_url:
                    redirect_reason = _public_http_url_reason(final_url)
                    if redirect_reason:
                        errors.append(f"{uid}: unsafe redirect in {source_key}: {source_url} -> {final_url} ({redirect_reason})")
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
