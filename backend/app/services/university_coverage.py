"""Build truthful, program-scoped and level-scoped summaries of catalogued university data."""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from app.services.university_level_coverage import (
    _CONFLICTING_DEADLINE_TEXT,
    _MBA_RE,
    _UNPUBLISHED_DEADLINE_TEXT,
    AVAILABLE,
    NOT_CATALOGUED,
    _course_deadline_rows,
    _deadline_strings,
    _deadline_values_for_record,
    _has_exact_dated_deadline,
    _has_requirements,
    _levels_for_record,
    _non_empty_requirement,
    _non_empty_text,
    _program_name,
    build_coverage_by_level,
)

__all__ = [
    "AVAILABLE",
    "NOT_CATALOGUED",
    "_MBA_RE",
    "build_coverage_by_level",
    "build_coverage_by_program",
]

_PROGRAM_REQUIREMENT_FIELDS = (
    "requirements",
    "admissions_requirements",
    "entry_requirements",
    "academic_entry_requirement",
    "admissions_tests",
    "admissions_test",
    "admissions_test_notes",
    "standard_offer_a_level",
    "standard_offer_ib",
    "language_requirements",
    "required_documents",
    "minimum_gpa",
)


def _fact_status(status: str, scope: str = "not_catalogued", **metadata: Any) -> dict[str, Any]:
    return {
        "status": status,
        "scope": scope if status != NOT_CATALOGUED else "not_catalogued",
        "source_url": metadata.get("source_url"),
        "cycle": metadata.get("cycle"),
        "verified_at": metadata.get("verified_at"),
    }


def _metadata_value(records: Iterable[Any], keys: Iterable[str]) -> str | None:
    for record in records:
        if not isinstance(record, dict):
            continue
        for key in keys:
            value = record.get(key)
            if _non_empty_text(value):
                return value.strip()
    return None


def _source_url(records: Iterable[Any]) -> str | None:
    return _metadata_value(records, ("source_url", "url"))


def _cycle(records: Iterable[Any]) -> str | None:
    return _metadata_value(records, ("cycle", "academic_year"))


def _verified_at(records: Iterable[Any]) -> str | None:
    return _metadata_value(records, ("verified_at",))


def _program_refs(category: dict[str, Any]) -> set[str]:
    refs: set[str] = set()
    for key in ("program_ids", "applicable_program_ids", "program_names", "applicable_programs"):
        value = category.get(key)
        if isinstance(value, str):
            value = [value]
        if isinstance(value, list):
            refs.update(str(item or "").strip().lower() for item in value if str(item or "").strip())
    return refs


def _single_program_route(category: dict[str, Any]) -> bool:
    ids = category.get("program_ids") or category.get("applicable_program_ids") or []
    names = category.get("program_names") or category.get("applicable_programs") or []
    if isinstance(ids, str):
        ids = [ids]
    if isinstance(names, str):
        names = [names]
    return (len(ids) == 1 and len(names) <= 1) or (not ids and len(names) == 1)


def _matches_program(category: dict[str, Any], program: dict[str, Any]) -> bool:
    refs = _program_refs(category)
    if refs:
        names = {str(program.get("id") or "").strip().lower(), _program_name(program).lower()}
        return bool(refs.intersection(names))
    scope = re.sub(r"[^a-z0-9]+", "_", str(category.get("scope") or "").lower()).strip("_")
    levels = _levels_for_record(category)
    program_levels = _levels_for_record(program, program=True)
    if scope == "graduate_business":
        # A business route without course references can safely cover only an
        # MBA program explicitly classified as MBA, not all master's degrees.
        return "mba" in levels and "mba" in program_levels
    # Only explicit all-institution undergraduate route labels justify attaching
    # a route with no program list to each undergraduate degree.
    return (
        scope in {"undergraduate_general", "institution_wide_undergraduate"}
        and "bachelor" in levels
        and "bachelor" in program_levels
    )


def _has_program_requirements(program: dict[str, Any]) -> bool:
    return any(_non_empty_requirement(program.get(key)) for key in _PROGRAM_REQUIREMENT_FIELDS)


def _row_program_ids(row: dict[str, Any]) -> set[str]:
    value = row.get("program_ids") or row.get("applicable_program_ids")
    if isinstance(value, str):
        value = [value]
    return (
        {str(item or "").strip().lower() for item in value if str(item or "").strip()}
        if isinstance(value, list)
        else set()
    )


def _scoped_fact_matches_program(row: Any, program: dict[str, Any]) -> bool:
    """Filter additive fact rows without changing legacy row interpretation."""
    if not isinstance(row, dict) or "publication_status" not in row:
        return True
    refs = _row_program_ids(row)
    if refs:
        identifiers = {
            str(program.get("id") or "").strip().lower(),
            str(program.get("course_number") or "").strip().lower(),
            _program_name(program).lower(),
        }
        if not refs.intersection(identifiers):
            return False
    row_levels = row.get("study_levels")
    if isinstance(row_levels, str):
        row_levels = [row_levels]
    if isinstance(row_levels, list):
        scoped_levels = _levels_for_record({"study_levels": row_levels})
        program_levels = _levels_for_record(program, program=True)
        if "mba" in program_levels:
            program_levels.add("master")
        if scoped_levels and program_levels and not scoped_levels.intersection(program_levels):
            return False
    return True


def _deadline_rows_for_program(record: dict[str, Any], program: dict[str, Any]) -> list[Any]:
    return [row for row in _deadline_values_for_record(record) if _scoped_fact_matches_program(row, program)]


def _published_deadline_rows(rows: list[Any]) -> list[Any]:
    return [
        row
        for row in rows
        if (
            str(row.get("publication_status") or "").strip().lower() == "published"
            if isinstance(row, dict) and "publication_status" in row
            else _legacy_deadline_publication_status(row) is None
        )
    ]


def _legacy_deadline_publication_status(row: Any) -> str | None:
    if isinstance(row, dict) and "publication_status" in row:
        return None
    text = (
        row
        if isinstance(row, str)
        else " ".join(str(row.get(key) or "") for key in ("date", "deadline", "application_deadline", "notes"))
        if isinstance(row, dict)
        else ""
    )
    if _UNPUBLISHED_DEADLINE_TEXT.search(text):
        return "not_yet_published"
    if _CONFLICTING_DEADLINE_TEXT.search(text):
        return "conflicting"
    return None


def _deadline_fact(
    program: dict[str, Any],
    routes: list[dict[str, Any]],
    university: dict[str, Any],
) -> dict[str, Any]:
    program_rows = _deadline_rows_for_program(program, program)
    rows = _published_deadline_rows(program_rows)
    sources: list[Any] = [program]
    scope = "program_specific"
    if not rows:
        route_rows: list[Any] = []
        matching = [route for route in routes if _matches_program(route, program)]
        for route in matching:
            route_rows.extend(_deadline_rows_for_program(route, program))
        program_refs = {
            str(program.get("id") or "").strip().lower(),
            str(program.get("course_number") or "").strip().lower(),
            _program_name(program).lower(),
        }
        exact_route_rows = [
            row
            for row in route_rows
            if isinstance(row, dict)
            and row.get("applicability") == "program_specific"
            and _row_program_ids(row).intersection(program_refs)
        ]
        explicit_program_unknown = any(
            (isinstance(row, dict) and row.get("publication_status") not in (None, "published"))
            or _legacy_deadline_publication_status(row) is not None
            for row in program_rows
        )
        if exact_route_rows:
            route_rows = exact_route_rows
        elif explicit_program_unknown:
            route_rows = []
        if route_rows:
            program_specific_rows = [
                row
                for row in route_rows
                if isinstance(row, dict)
                and "publication_status" in row
                and row.get("applicability") == "program_specific"
            ]
            if program_specific_rows:
                route_rows = program_specific_rows
            rows = route_rows
            sources = list(matching)
            scope = (
                "program_specific"
                if any(
                    isinstance(row, dict) and row.get("applicability") == "program_specific"
                    for row in route_rows
                )
                or any(_single_program_route(route) for route in matching)
                else (
                    "shared_admission_route"
                    if any(_program_refs(route) for route in matching)
                    else "institution_wide_route"
                )
            )
        else:
            structured_unknowns = [
                row
                for row in program_rows
                if isinstance(row, dict) and row.get("publication_status") not in (None, "published")
            ]
            if structured_unknowns:
                rows = structured_unknowns
            else:
                program_publication_status = next(
                    (
                        _legacy_deadline_publication_status(row)
                        for row in program_rows
                        if _legacy_deadline_publication_status(row)
                    ),
                    None,
                )
                if program_publication_status:
                    rows = [{"publication_status": program_publication_status, "deadline_type": "course_application"}]
        if not rows and "bachelor" in _levels_for_record(program, program=True):
            # Root undergraduate timelines commonly define a single university deadline.
            # Never project generic graduate deadlines onto named graduate programs.
            root_deadlines = university.get("deadlines")
            undergraduate_roots = (
                [
                    value
                    for key, value in root_deadlines.items()
                    if "undergraduate" in str(key).lower() or "bachelor" in str(key).lower()
                ]
                if isinstance(root_deadlines, dict)
                else []
            )
            for value in undergraduate_roots:
                rows.extend(_course_deadline_rows(value))
            if rows:
                sources = list(undergraduate_roots)
                scope = "university_guidance"
    scoped_rows = rows
    rows = _published_deadline_rows(scoped_rows)
    strings = _deadline_strings(rows)
    status = NOT_CATALOGUED
    if strings:
        status = (
            "exact_dated"
            if any(_has_exact_dated_deadline(value) for value in strings)
            else "approximate_or_yearless"
        )
    metadata = {
        "source_url": next(
            (str(row.get("source_url")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("source_url"))),
            None,
        )
        or _metadata_value(sources, ("deadline_source_url", "source_url", "url")),
        "cycle": next(
            (str(row.get("cycle")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("cycle"))),
            None,
        )
        or _metadata_value(sources, ("deadline_cycle", "cycle", "academic_year")),
        "verified_at": next(
            (str(row.get("verified_at")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("verified_at"))),
            None,
        )
        or _verified_at(sources),
    }
    result: dict[str, Any] = {**_fact_status(status, scope, **metadata), "values": rows}
    publication_facts = [
        {
            key: value
            for key, value in row.items()
            if key not in {"date", "deadline", "application_deadline", "time", "timezone"}
        }
        for row in scoped_rows
        if isinstance(row, dict) and row.get("publication_status") not in (None, "published")
    ]
    if publication_facts:
        result["publication_facts"] = publication_facts
        if not rows:
            result["publication_status"] = publication_facts[0].get("publication_status")
    return result


def _program_cost_values(record: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    def visit(value: Any, prefix: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                name = str(key)
                if (
                    re.search(r"tuition|annual.?fees?|mandatory.?fees?", name, re.I)
                    and not re.search(r"threshold|income|aid|waiver", name, re.I)
                    and isinstance(child, (int, float))
                    and not isinstance(child, bool)
                    and child > 0
                ):
                    result[name] = child
                elif isinstance(child, (dict, list)):
                    visit(child, name)
        elif isinstance(value, list):
            for child in value:
                visit(child, prefix)

    visit(record)
    return result


def _all_structured_price_facts(record: Any, program: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(record, dict):
        return []
    facts = record.get("price_facts")
    if not isinstance(facts, list):
        return []
    return [fact for fact in facts if isinstance(fact, dict) and _scoped_fact_matches_program(fact, program)]


def _structured_price_facts(record: Any, program: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        fact
        for fact in _all_structured_price_facts(record, program)
        if str(fact.get("publication_status") or "").strip().lower() == "published"
    ]


def _price_fact_values(facts: list[dict[str, Any]]) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for fact in facts:
        amount = fact.get("amount")
        if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount <= 0:
            continue
        parts = [
            fact.get("kind"),
            fact.get("fee_status"),
            fact.get("applicant_category"),
            fact.get("period"),
            fact.get("quantity_basis"),
            fact.get("currency"),
        ]
        key = "_".join(re.sub(r"[^a-z0-9]+", "_", str(part or "").lower()).strip("_") for part in parts if part)
        values[key] = amount
    return values


def _legacy_historical_values(record: dict[str, Any], excluded_cycles: set[str]) -> dict[str, Any] | None:
    cycle = str(record.get("tuition_cycle") or record.get("cycle") or record.get("academic_year") or "").strip()
    if not cycle or cycle in excluded_cycles:
        return None
    values = _program_cost_values(record)
    if not values:
        return None
    source = record.get("tuition_source_url") or record.get("source_url")
    return {
        "values": values,
        "currency": record.get("currency"),
        "cycle": cycle,
        "source_url": source,
        "verified_at": record.get("verified_at") or record.get("tuition_verified_at"),
    }


def _root_costs(finance: Any) -> dict[str, Any]:
    if not isinstance(finance, dict):
        return {}
    result = _program_cost_values(finance)
    # Annual cost-of-attendance is useful context, but is not a named program price.
    for key in ("total_cost_year_usd", "total_cost_year_min", "total_cost_year_max", "costs_breakdown_year_usd"):
        value = finance.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
            result[key] = value
        elif key == "costs_breakdown_year_usd" and isinstance(value, dict):
            amounts = {
                name: amount
                for name, amount in value.items()
                if isinstance(amount, (int, float)) and not isinstance(amount, bool) and amount > 0
            }
            if amounts:
                result[key] = amounts
    if result and _non_empty_text(finance.get("currency")):
        result["currency"] = finance["currency"]
    return result


def _cost_fact(
    program: dict[str, Any],
    routes: list[dict[str, Any]],
    university: dict[str, Any],
) -> dict[str, Any]:
    entries = [(fact, program) for fact in _all_structured_price_facts(program, program)]
    if not entries:
        for route in routes:
            if not _matches_program(route, program):
                continue
            override = route.get("finance_override") or {}
            entries.extend((fact, override) for fact in _all_structured_price_facts(override, program))
            if entries:
                break

    if entries:
        published_entries = [
            (fact, record)
            for fact, record in entries
            if str(fact.get("publication_status") or "").strip().lower() == "published"
        ]
        publication_entries = [
            (fact, record)
            for fact, record in entries
            if str(fact.get("publication_status") or "").strip().lower() != "published"
        ]
        unknown_cycles = {str(fact.get("cycle") or "").strip() for fact, _record in publication_entries}
        unknown_cycles.discard("")

        # An unknown/conflicting fact suppresses only a published value in the same
        # fee-status bucket and cycle. Home and Overseas prices remain independent.
        unknown_scopes = {
            (
                str(fact.get("cycle") or "").strip(),
                str(fact.get("kind") or "").strip().lower(),
                str(fact.get("period") or "").strip().lower(),
                str(fact.get("currency") or "").strip().upper(),
                str(fact.get("fee_status") or "").strip().lower(),
                str(fact.get("applicant_category") or "").strip().lower(),
            )
            for fact, _record in publication_entries
        }
        visible_entries = [
            (fact, record)
            for fact, record in published_entries
            if (not unknown_cycles or str(fact.get("cycle") or "").strip() in unknown_cycles)
            and (
                str(fact.get("cycle") or "").strip(),
                str(fact.get("kind") or "").strip().lower(),
                str(fact.get("period") or "").strip().lower(),
                str(fact.get("currency") or "").strip().upper(),
                str(fact.get("fee_status") or "").strip().lower(),
                str(fact.get("applicant_category") or "").strip().lower(),
            )
            not in unknown_scopes
        ]
        publication_facts = [
            {key: value for key, value in fact.items() if key not in {"amount", "legacy_field"}}
            for fact, _record in publication_entries
        ]
        statuses = {str(fact.get("publication_status") or "unknown") for fact, _record in publication_entries}
        publication_status = next(iter(statuses)) if len(statuses) == 1 else "conflicting" if statuses else None
        historical_facts = [
            fact
            for fact, _record in published_entries
            if unknown_cycles and str(fact.get("cycle") or "").strip() not in unknown_cycles
        ]
        historical_legacy_values = _legacy_historical_values(program, unknown_cycles) if not historical_facts else None
        if not historical_legacy_values and not historical_facts:
            for _fact, record in publication_entries:
                historical_legacy_values = _legacy_historical_values(record, unknown_cycles)
                if historical_legacy_values:
                    break

        visible_facts = [fact for fact, _record in visible_entries]
        values = _price_fact_values(visible_facts)
        # When current-cycle publication is unknown, keep top-level provenance on
        # that unknown even if older published values are retained for context.
        meta_fact = (
            [fact for fact, _record in publication_entries]
            if publication_entries and not visible_facts
            else visible_facts or [fact for fact, _record in publication_entries]
        )[0]
        metadata_record = next((record for fact, record in entries if fact is meta_fact), program)
        result: dict[str, Any] = {
            **_fact_status(
                AVAILABLE if visible_facts else NOT_CATALOGUED,
                str(meta_fact.get("applicability") or "program_specific"),
                source_url=meta_fact.get("source_url") or _source_url([metadata_record]),
                cycle=meta_fact.get("cycle") or _cycle([metadata_record]),
                verified_at=meta_fact.get("verified_at") or _verified_at([metadata_record]),
            ),
            "values": values,
        }
        if visible_facts:
            result["price_facts"] = visible_facts
        if publication_facts:
            result["publication_facts"] = publication_facts
            result["publication_status"] = publication_status
        if historical_facts:
            result["historical_price_facts"] = historical_facts
        if historical_legacy_values:
            result["historical_legacy_values"] = historical_legacy_values
        return result

    values = _program_cost_values(program)
    if values:
        values["currency"] = program.get("currency")
        return {
            **_fact_status(
                AVAILABLE,
                "program_specific",
                source_url=program.get("tuition_source_url") or _source_url([program]),
                cycle=program.get("tuition_cycle") or _cycle([program]),
                verified_at=_verified_at([program]),
            ),
            "values": values,
        }
    matching: list[tuple[dict[str, Any], list[dict[str, Any]]]] = []
    for route in routes:
        if not _matches_program(route, program):
            continue
        override = route.get("finance_override") or {}
        facts = _structured_price_facts(override, program)
        if facts or (isinstance(override, dict) and _program_cost_values(override)):
            matching.append((route, facts))
    if matching:
        route, facts = matching[0]
        override = route.get("finance_override") or {}
        if facts:
            values = _price_fact_values(facts)
        else:
            values = _program_cost_values(override) if isinstance(override, dict) else {}
            values["currency"] = override.get("currency") if isinstance(override, dict) else None
        refs = _program_refs(route)
        scope = (
            str(facts[0].get("applicability"))
            if facts and facts[0].get("applicability")
            else "program_specific"
            if _single_program_route(route)
            else "shared_admission_route"
            if refs
            else "institution_wide_route"
        )
        fact: dict[str, Any] = {
            **_fact_status(
                AVAILABLE,
                scope,
                source_url=(facts[0].get("source_url") if facts else None) or _source_url([override, route]),
                cycle=(facts[0].get("cycle") if facts else None) or _cycle([override, route]),
                verified_at=(facts[0].get("verified_at") if facts else None) or _verified_at([override, route]),
            ),
            "values": values,
        }
        if facts:
            fact["price_facts"] = facts
        return fact
    program_levels = _levels_for_record(program, program=True)
    finance = university.get("finance")
    values = _root_costs(finance) if "bachelor" in program_levels else {}
    if isinstance(finance, dict) and values:
        return {
            **_fact_status(
                AVAILABLE,
                "university_guidance",
                source_url=_source_url([finance]),
                cycle=_cycle([finance]),
                verified_at=_verified_at([finance]),
            ),
            "values": values,
        }
    return {**_fact_status(NOT_CATALOGUED), "values": {}}


def _award_level_set(award: dict[str, Any]) -> set[str]:
    levels: set[str] = set()
    raw = award.get("study_levels")
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        raw = []
    raw = [*raw, award.get("study_level")]
    for item in raw:
        text = str(item or "").lower()
        for part in re.split(r"[/,&]+", text):
            normalized = re.sub(r"[^a-z]+", " ", part).strip()
            levels.update(_levels_for_record({"study_levels": [normalized]}))
    if "master" in levels:
        levels.add("mba")
    return levels


def _award_matches_program(award: dict[str, Any], program: dict[str, Any]) -> bool:
    award_levels = _award_level_set(award)
    program_levels = _levels_for_record(program, program=True)
    if not award_levels or not program_levels or not award_levels.intersection(program_levels):
        return False
    explicit_program_ids = award.get("program_ids")
    if isinstance(explicit_program_ids, list) and explicit_program_ids:
        program_ids = {str(program.get(key) or "").strip().lower() for key in ("id", "course_number")}
        return any(str(item or "").strip().lower() in program_ids for item in explicit_program_ids)
    scope = str(award.get("program_scope") or "").lower()
    program_text = " ".join(
        str(program.get(key) or "") for key in ("id", "name", "degree_type", "school", "faculty")
    ).lower()
    if "centre for doctoral training" in scope and not re.search(
        r"\bcdt\b|centre for doctoral training", program_text
    ):
        return False
    if "selected postgraduate taught" in scope and "bachelor" not in program_levels:
        return False
    if re.search(r"except\s+medicine", scope) and "medicine" in program_text:
        return False
    focus_terms = re.findall(r"\b(?:mba|hbs|gsb|mfin|mban|mpp|mpa|jd|bcl)\b", scope)
    return not focus_terms or any(re.search(rf"\b{re.escape(term)}\b", program_text) for term in focus_terms)


def _awards_for_program(finance: Any, program: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(finance, dict):
        return []
    awards = finance.get("scholarships_and_funding")
    if not isinstance(awards, list):
        return []
    output: list[dict[str, Any]] = []
    for award in awards:
        if not isinstance(award, dict) or not _award_matches_program(award, program):
            continue
        output.append({
            "id": award.get("id"),
            "name": award.get("name") or award.get("label"),
            "program_scope": award.get("program_scope"),
            "applicant_scope": award.get("applicant_scope") or award.get("target_audience"),
            "eligibility": award.get("eligibility"),
            "basis": award.get("basis"),
            "application_process": award.get("application_process"),
            "coverage": award.get("coverage"),
            "renewal": award.get("renewal"),
            "competition": award.get("competition"),
            "steps": award.get("steps"),
            "documents": award.get("documents"),
            "course_application_deadline": award.get("course_application_deadline"),
            "award_application_deadline": award.get("award_application_deadline") or award.get("deadlines"),
            "deadline_timezone": award.get("deadline_timezone"),
            "source_url": award.get("source_url"),
            "cycle": award.get("academic_year") or award.get("cycle"),
            "verified_at": award.get("verified_at"),
        })
    return output


def _requirements_fact(program: dict[str, Any], routes: list[dict[str, Any]]) -> dict[str, Any]:
    if _has_program_requirements(program):
        return _fact_status(
            AVAILABLE,
            "program_specific",
            source_url=_source_url([program]),
            cycle=_cycle([program]),
            verified_at=_verified_at([program]),
        )
    matching = [route for route in routes if _matches_program(route, program) and _has_requirements(route)]
    if matching:
        refs = _program_refs(matching[0])
        scope = (
            "program_specific"
            if _single_program_route(matching[0])
            else "shared_admission_route"
            if refs
            else "institution_wide_route"
        )
        return _fact_status(
            AVAILABLE,
            scope,
            source_url=_source_url(matching),
            cycle=_cycle(matching),
            verified_at=_verified_at(matching),
        )
    return _fact_status(NOT_CATALOGUED)


def build_coverage_by_program(university: dict[str, Any]) -> list[dict[str, Any]]:
    """Report catalogued coverage per named program without inheriting broad graduate facts."""
    if not isinstance(university, dict):
        return []
    academics = university.get("academics")
    raw_programs = academics.get("programs") if isinstance(academics, dict) else []
    if not isinstance(raw_programs, list):
        return []
    programs = [program for program in raw_programs if isinstance(program, dict) and _program_name(program)]
    raw_routes = university.get("admission_categories")
    routes = [route for route in raw_routes if isinstance(route, dict)] if isinstance(raw_routes, list) else []
    finance = university.get("finance")
    result: list[dict[str, Any]] = []
    for program in programs:
        program_id = str(program.get("id") or program.get("course_number") or "").strip() or None
        program_levels = sorted(_levels_for_record(program, program=True))
        awards = _awards_for_program(finance, program)
        award_status = AVAILABLE if awards else NOT_CATALOGUED
        result.append({
            "program_id": program_id,
            "program_name": _program_name(program),
            "study_levels": program_levels,
            "requirements": _requirements_fact(program, routes),
            "deadline": _deadline_fact(program, routes, university),
            "tuition_mandatory_fees": _cost_fact(program, routes, university),
            "awards": {
                "status": award_status,
                "scope": "award_program_scope" if awards else "not_catalogued",
                "items": awards,
            },
        })
    return result
