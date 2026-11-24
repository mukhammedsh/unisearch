"""Compact catalog index extraction and per-institution split storage for reviewed admissions."""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

_CURRENCY_RE = re.compile(r"[A-Z]{3}")
_GBP_PER_YEAR_RE = re.compile(r"£([\d,]+(?:\.\d+)?) per year")
_GBP_ONE_YEAR_RE = re.compile(r"£([\d,]+(?:\.\d+)?)")
_LIVING_VERIFIED_RE = re.compile(r"verified|reviewed")
_LIVING_EXCLUDED_RE = re.compile(r"superseded|conflict|partial|pending")


def content_sha256(raw: bytes) -> str:
    """Hash UTF-8 JSON bytes after normalizing CRLF so checkouts match across OSes."""
    return hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()


def dump_records(value: object, depth: int = 4, level: int = 0) -> str:
    """Serialize JSON with one line per record and compact content inside each record."""
    if level >= depth or not isinstance(value, (dict, list)) or not value:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    pad = " " * (level + 1)
    if isinstance(value, dict):
        rows = [
            f"{pad}{json.dumps(key, ensure_ascii=False)}:{dump_records(item, depth, level + 1)}"
            for key, item in value.items()
        ]
        return "{\n" + ",\n".join(rows) + "\n" + " " * level + "}"
    return "[\n" + ",\n".join(pad + dump_records(item, depth, level + 1) for item in value) + "\n" + " " * level + "]"


def _as_dict(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _uniq_non_empty(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        text = str(raw or "").strip()
        if text and text not in seen:
            seen.add(text)
            out.append(text)
    return out


def extract_living_estimates(institution: dict[str, Any]) -> list[dict[str, Any]]:
    """Read published non-tuition estimates and express them for one nine-month academic year."""
    estimates: list[dict[str, Any]] = []
    for row in institution.get("facts") or []:
        if not isinstance(row, dict):
            continue
        review_status = str(row.get("review_status") or "")
        if (
            not str(row.get("publication_status") or "").startswith("published")
            or not _LIVING_VERIFIED_RE.search(review_status)
            or _LIVING_EXCLUDED_RE.search(review_status)
        ):
            continue
        value = row.get("value")
        if not isinstance(value, dict):
            continue
        if isinstance(value.get("average_9months"), dict):
            low = value["average_9months"].get("min")
            high = value["average_9months"].get("max")
            exclusions = ["insurance", "travel"]
        elif "three_quarter_non_tuition_total" in value:
            low = high = value["three_quarter_non_tuition_total"]
            exclusions = ["travel"]
        elif (
            "living" in str(row.get("topic") or "")
            and value.get("period") == "month"
            and isinstance(value.get("amount"), (int, float))
        ):
            low = high = value["amount"] * 9
            exclusions = ["travel"]
        else:
            continue
        if (
            any(
                isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount)
                for amount in (low, high)
            )
            or not 0 <= low <= high
            or not _CURRENCY_RE.fullmatch(str(value.get("currency") or ""))
        ):
            continue
        reference = value.get("cycle") or value.get("year") or value.get("academic_year")
        if not reference:
            period = row.get("period")
            reference = period.get("label") if isinstance(period, dict) else period
        scope = _as_dict(row.get("scope"))
        estimates.append({
            "min": low,
            "max": high,
            "currency": value["currency"],
            "exclusions": exclusions,
            "levels": list(scope.get("levels") or []),
            "option_ids": list(scope.get("option_ids") or []),
            "fact_id": row.get("id", ""),
            "source_ids": list(row.get("source_ids") or []),
            "reference": str(reference or ""),
        })
    return estimates


def extract_cost_quotes(institution: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract normalized candidate cost quotes from verified facts for index-backed catalog pricing."""
    options = {
        option["id"]: option
        for option in (institution.get("study_options") or [])
        if isinstance(option, dict) and isinstance(option.get("id"), str)
    }
    quotes: list[dict[str, Any]] = []

    def add(
        row: dict[str, Any],
        basis: str,
        amount: object,
        currency: object,
        period: object,
        fee_status: str = "",
        exclusions: list[str] | tuple[str, ...] = (),
        *,
        billing_period: str = "academic_year",
        study_modes: list[str] | tuple[str, ...] = (),
        campus: str | None = None,
        source_year: object = None,
        option_ids: list[str] | None = None,
    ) -> None:
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
            return
        if not isinstance(currency, str) or not _CURRENCY_RE.fullmatch(currency) or not period:
            return
        scope = _as_dict(row.get("scope"))
        scoped_options = sorted(set(option_ids if option_ids is not None else (scope.get("option_ids") or [])))
        option_levels = sorted({
            value
            for option_id in scoped_options
            for value in (options.get(option_id, {}).get("levels") or [])
        })
        levels = option_levels if option_ids is not None else list(scope.get("levels") or [])
        levels = sorted(set(levels or option_levels))
        quotes.append({
            "basis": basis,
            "amount": amount,
            "currency": currency,
            "period": period,
            "billing_period": billing_period,
            "fee_status": fee_status,
            "exclusions": list(exclusions),
            "study_modes": list(study_modes),
            "campus": campus,
            "source_year": source_year,
            "option_ids": scoped_options,
            "route_ids": list(scope.get("route_ids") or []),
            "levels": levels,
            "fact_id": row.get("id", ""),
            "source_ids": list(row.get("source_ids") or []),
        })

    for row in institution.get("facts") or []:
        if not isinstance(row, dict):
            continue
        status = _as_dict(row.get("normalized_status"))
        attributes = _as_dict(row.get("attributes"))
        if (
            status.get("publication") != "published" and not attributes.get("catalog_costs")
        ) or status.get("review") not in {"verified", "verified_with_limits", "carried_forward"}:
            continue
        value = attributes.get("catalog_costs") or row.get("value")
        if not isinstance(value, dict):
            continue
        for quote in value.get("quotes", []):
            if not isinstance(quote, dict) or quote.get("reference_only"):
                continue
            basis = quote.get("basis")
            billing_period = quote.get("billing_period")
            if basis not in {"tuition", "annual_total"} or billing_period not in {
                "academic_year",
                "whole_program",
                "per_credit",
            }:
                continue
            add(
                row,
                basis,
                quote.get("amount"),
                quote.get("currency"),
                quote.get("period_label"),
                str(quote.get("fee_status", "")),
                quote.get("exclusions", []),
                billing_period=billing_period,
                study_modes=quote.get("study_modes", []),
                campus=quote.get("campus"),
                source_year=quote.get("source_year"),
                option_ids=quote.get("option_ids"),
            )
        period = value.get("academic_year") or (
            row.get("period", {}).get("label") if isinstance(row.get("period"), dict) else None
        )
        if value.get("period") == "Academic year":
            add(row, "tuition", value.get("tuition"), value.get("currency"), period)
            add(
                row,
                "annual_total",
                value.get("total_before_aid"),
                value.get("currency"),
                period,
                exclusions=value.get("exclusions", ["insurance", "travel"] if value.get("health_insurance") else []),
            )
        for budget in value.get("budgets") or []:
            if isinstance(budget, dict) and budget.get("months") == 9 and "tuition" in budget and "total" in budget:
                add(row, "tuition", budget["tuition"], value.get("currency"), period)
                add(row, "annual_total", budget["total"], value.get("currency"), period)
        quarterly = (value.get("graduate_engineering_quarterly_tuition") or {}).get("11-18_units")
        if isinstance(quarterly, (int, float)) and not isinstance(quarterly, bool):
            add(row, "tuition", quarterly * 3, value.get("currency"), value.get("academic_year"))
        panels = value.get("course_page_tuition_fees")
        if not isinstance(panels, dict):
            continue
        for fee_label in ("Home fee", "Overseas fee"):
            for panel in panels.get(fee_label, []):
                if not isinstance(panel, dict) or panel.get("panel_status") != "published":
                    continue
                for text in panel.get("amounts_and_periods", []):
                    if not isinstance(text, str):
                        continue
                    annual = _GBP_PER_YEAR_RE.fullmatch(text)
                    one_year = (
                        _GBP_ONE_YEAR_RE.fullmatch(text)
                        if value.get("duration") == "1 year" and value.get("mode") == "Full-time"
                        else None
                    )
                    matched = annual or one_year
                    if matched:
                        add(
                            row,
                            "tuition",
                            float(matched[1].replace(",", "")),
                            panel.get("currency"),
                            panel.get("panel_cycle_label"),
                            fee_label,
                        )
    return quotes


def build_institution_summary(
    institution: dict[str, Any],
    *,
    file_relpath: str,
    file_sha256: str,
) -> dict[str, Any]:
    """Build the lightweight index entry read for catalog browsing, pricing, and search."""
    inst_meta = _as_dict(institution.get("institution"))
    raw_options = [row for row in (institution.get("study_options") or []) if isinstance(row, dict)]
    raw_routes = [row for row in (institution.get("application_routes") or []) if isinstance(row, dict)]
    formats: list[str] = []
    compact_options: list[dict[str, Any]] = []
    levels_set: set[str] = set()
    for option in raw_options:
        option_levels = [str(level) for level in (option.get("levels") or []) if isinstance(level, str)]
        levels_set.update(option_levels)
        compact_options.append({
            "id": option.get("id", ""),
            "title": option.get("title", ""),
            "levels": option_levels,
            "awards": [str(award) for award in (option.get("awards") or []) if isinstance(award, str)],
        })
        attributes = _as_dict(option.get("attributes"))
        declared = attributes.get("format")
        if isinstance(declared, dict):
            declared = declared.get("mode")
        if isinstance(declared, str):
            formats.append(declared)
        elif isinstance(declared, list):
            formats.extend(value for value in declared if isinstance(value, str))
    cost_quotes = extract_cost_quotes(institution)
    living_estimates = extract_living_estimates(institution)
    referenced_sources = {
        source_id for quote in cost_quotes for source_id in quote["source_ids"]
    } | {
        source_id for estimate in living_estimates for source_id in estimate["source_ids"]
    }
    source_urls = {
        source["id"]: source.get("url", "")
        for source in (institution.get("sources") or [])
        if isinstance(source, dict) and isinstance(source.get("id"), str) and source["id"] in referenced_sources
    }
    return {
        "id": inst_meta.get("id", ""),
        "official_name": inst_meta.get("official_name", ""),
        "file": file_relpath,
        "sha256": file_sha256,
        "study_option_count": len(compact_options),
        "study_levels": sorted(levels_set),
        "formats": _uniq_non_empty(formats),
        "study_options": compact_options,
        "routes": [
            {"id": route.get("id", ""), "option_ids": list(route.get("option_ids") or [])}
            for route in raw_routes
            if route.get("option_ids")
        ],
        "cost_quotes": cost_quotes,
        "living_estimates": living_estimates,
        "source_urls": source_urls,
    }


def write_split_catalog(
    directory: Path,
    institutions: list[dict[str, Any]],
    *,
    schema_version: str = "admissions-storage-1.0",
    runtime_active: bool = False,
    overwrite: bool = False,
) -> Path:
    """Write per-institution JSON files under institutions/ and the compact index.json manifest."""
    target_dir = Path(directory)
    institutions_dir = target_dir / "institutions"
    institutions_dir.mkdir(parents=True, exist_ok=True)
    mode = "w" if overwrite else "x"

    index_entries: list[dict[str, Any]] = []
    for institution in institutions:
        institution_id = str(institution["institution"]["id"])
        relpath = f"institutions/{institution_id}.json"
        file_path = target_dir / relpath
        serialized = dump_records(institution, depth=3) + "\n"
        encoded = serialized.encode("utf-8")
        with file_path.open(mode, encoding="utf-8", newline="\n") as stream:
            stream.write(serialized)
        index_entries.append(
            build_institution_summary(
                institution,
                file_relpath=relpath,
                file_sha256=content_sha256(encoded),
            )
        )

    index_payload = {
        "schema_version": schema_version,
        "runtime_active": runtime_active,
        "institutions": index_entries,
    }
    index_path = target_dir / "index.json"
    with index_path.open(mode, encoding="utf-8", newline="\n") as stream:
        stream.write(dump_records(index_payload, depth=3) + "\n")
    return index_path
