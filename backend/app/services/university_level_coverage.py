"""Level-scoped university catalog coverage helpers."""

from __future__ import annotations

import re
from collections.abc import Iterable
from datetime import date
from typing import Any, TypeGuard

AVAILABLE = "available"
NOT_CATALOGUED = "not_catalogued"
_LEVEL_KEYS = ("bachelor", "master", "doctorate", "professional")
_MBA_RE = re.compile(r"\bm\.?b\.?a\.?\b|master(?:'s)?\s+of\s+business\s+administration", re.I)
_MONTH_DATE_RE = re.compile(
    r"\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}\b",
    re.I,
)
_DAY_MONTH_DATE_RE = re.compile(
    r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|"
    r"apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
    r"nov(?:ember)?|dec(?:ember)?)[,]?\s+20\d{2}\b",
    re.I,
)
_ISO_DATE_RE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
_AID_TERMS = re.compile(r"\b(?:aid|grant|scholarship|fellowship|assistantship|stipend|tuition waiver)\b", re.I)
_COURSE_DEADLINE_KEYS = (
    "deadline",
    "deadlines",
    "application_deadline",
    "admission_rounds",
    "mba_rounds",
    "mba_deadlines",
)
_NON_COURSE_DEADLINE = re.compile(
    r"scholarship|funding|financial aid|award|studentship|test.?booking|test.?registration|standardized.?test|admissions.?test",
    re.I,
)


def _non_empty_text(value: Any) -> TypeGuard[str]:
    return isinstance(value, str) and bool(value.strip())


def _program_name(program: dict[str, Any]) -> str:
    return str(program.get("name") or program.get("title") or "").strip()


def _levels_for_record(record: dict[str, Any], *, program: bool = False) -> set[str]:
    """Return levels stated by this record; do not infer a degree from a generic label."""
    raw_levels = record.get("study_levels")
    if isinstance(raw_levels, (str, int)):
        raw_levels = [raw_levels]
    raw_scope = record.get("scope")
    if isinstance(raw_scope, dict) and raw_scope.get("level"):
        raw_levels = list(raw_levels) if isinstance(raw_levels, list) else []
        raw_levels.append(raw_scope["level"])
    levels: set[str] = set()
    for raw_level in raw_levels if isinstance(raw_levels, list) else []:
        value = re.sub(r"[^a-z]+", " ", str(raw_level or "").lower()).strip()
        if value in {"bachelor", "bachelors", "undergraduate", "undergrad", "bachelor degree"}:
            levels.add("bachelor")
        elif value in {"master", "masters", "master degree", "postgraduate taught", "integrated master"}:
            levels.add("master")
        elif value in {"doctorate", "doctoral", "doctoral degree", "phd", "ph d", "dphil"}:
            levels.add("doctorate")
        elif value in {"professional", "professional degree", "professional program"}:
            levels.add("professional")
        elif value in {"mba", "master of business administration"}:
            levels.add("mba")

    labels = " ".join(
        str(record.get(key) or "")
        for key in ("id", "name", "title", "label", "scope", "program_name")
    )
    token_text = re.sub(r"[^a-z0-9]+", " ", labels.lower())
    is_mba = bool(_MBA_RE.search(token_text))
    has_non_mba_masters = bool(
        re.search(r"\b(?:msc|mfin|mban|msx|master(?:'s)?\s+(?!of\s+business\s+administration))\b", token_text, re.I)
    )
    if program and is_mba:
        if not has_non_mba_masters:
            levels.discard("master")
        levels.add("mba")
    elif is_mba:
        # An explicitly MBA-scoped admissions category describes the MBA track,
        # rather than every master's applicant at the institution.
        if not has_non_mba_masters:
            levels.discard("master")
        levels.add("mba")
    if program and re.search(r"/admissions/undergraduate/courses/", str(record.get("url") or ""), re.I):
        # Oxford integrated master's degrees are undergraduate admissions routes.
        # Keep them at bachelor level so graduate-only awards (such as Clarendon)
        # do not attach to the undergraduate course record.
        levels.discard("master")
        levels.add("bachelor")
    return levels.intersection(set(_LEVEL_KEYS) | {"mba"})


def _non_empty_requirement(value: Any) -> bool:
    if isinstance(value, dict):
        return any(_non_empty_requirement(item) for item in value.values())
    if isinstance(value, list):
        return any(_non_empty_requirement(item) for item in value)
    return _non_empty_text(value) or (isinstance(value, (int, float)) and value > 0)


def _has_requirements(category: dict[str, Any]) -> bool:
    requirement_fields = (
        "requirements",
        "exam_requirements",
        "score_profile",
        "published_admission",
        "language_requirements",
        "extra_requirements",
        "required_documents",
        "minimum_scores",
        "minimum_gpa",
    )
    profiles = category.get("requirement_profiles")
    rows = [category]
    if isinstance(profiles, list):
        rows.extend(row for row in profiles if isinstance(row, dict))
    return any(
        _non_empty_requirement(row.get(key))
        for row in rows
        for key in requirement_fields
    )


def _has_funding_data(record: dict[str, Any]) -> bool:
    for key in ("scholarships", "funding_programs", "aid_options"):
        value = record.get(key)
        if isinstance(value, list) and value:
            return True
        if isinstance(value, dict) and value:
            return True
    options = record.get("funding_options")
    if isinstance(options, list):
        for option in options:
            if not isinstance(option, dict):
                continue
            funding_type = str(option.get("funding_type") or "").strip().lower()
            if funding_type in {"grant", "scholarship", "fellowship", "assistantship", "stipend", "aid"}:
                return True
            if any(
                _non_empty_text(option.get(key)) and _AID_TERMS.search(str(option.get(key)))
                for key in ("label", "funding_program", "funding_source", "description")
            ):
                return True
    funding_type = str(record.get("funding_type") or "").strip().lower()
    if funding_type in {"grant", "scholarship", "fellowship", "assistantship", "stipend", "aid"}:
        return True
    for key in ("funding_program", "funding_source", "funding_description"):
        if _non_empty_text(record.get(key)) and _AID_TERMS.search(str(record.get(key))):
            return True
    profiles = record.get("requirement_profiles")
    return isinstance(profiles, list) and any(
        isinstance(profile, dict) and _has_funding_data(profile) for profile in profiles
    )


def _deadline_values(
    value: Any,
    parent_key: str = "",
    *,
    exclude_mba_rounds: bool = False,
    mba_rounds_only: bool = False,
    in_mba_rounds: bool = False,
) -> Iterable[str]:
    if isinstance(value, dict):
        deadline_kind = " ".join(str(value.get(key) or "") for key in ("deadline_type", "type", "kind", "notes"))
        if re.search(r"scholarship|funding|financial aid|award|studentship", deadline_kind, re.I):
            return
        for key, child in value.items():
            key_text = str(key).lower()
            child_in_mba_rounds = in_mba_rounds or "mba" in key_text
            if exclude_mba_rounds and child_in_mba_rounds:
                continue
            if mba_rounds_only and not child_in_mba_rounds and key_text not in {"mba_rounds", "mba_deadlines"}:
                yield from _deadline_values(
                    child,
                    key_text,
                    exclude_mba_rounds=exclude_mba_rounds,
                    mba_rounds_only=mba_rounds_only,
                    in_mba_rounds=in_mba_rounds,
                )
                continue
            is_guidance = "guidance" in key_text
            if "deadline" in key_text:
                if not is_guidance:
                    yield from _deadline_values(
                        child,
                        key_text,
                        exclude_mba_rounds=exclude_mba_rounds,
                        mba_rounds_only=mba_rounds_only,
                        in_mba_rounds=child_in_mba_rounds,
                    )
            elif (
                parent_key in {"deadlines", "admission_rounds", "mba_rounds", "mba_deadlines"}
                and key_text in {
                    "date",
                    "application_deadline",
                    "financial_aid_deadline",
                    "portfolio_deadline",
                    "reply_deadline",
                    "deadline",
                }
                or key_text in {"deadlines", "admission_rounds", "mba_rounds", "mba_deadlines"}
            ):
                yield from _deadline_values(
                    child,
                    key_text,
                    exclude_mba_rounds=exclude_mba_rounds,
                    mba_rounds_only=mba_rounds_only,
                    in_mba_rounds=child_in_mba_rounds,
                )
    elif isinstance(value, list):
        for item in value:
            yield from _deadline_values(
                item,
                parent_key,
                exclude_mba_rounds=exclude_mba_rounds,
                mba_rounds_only=mba_rounds_only,
                in_mba_rounds=in_mba_rounds,
            )
    elif _non_empty_text(value) and (not mba_rounds_only or in_mba_rounds):
        yield value.strip()


def _has_exact_dated_deadline(value: str) -> bool:
    for match in _ISO_DATE_RE.finditer(value):
        try:
            date.fromisoformat(match.group(0))
            return True
        except ValueError:
            continue
    return bool(_MONTH_DATE_RE.search(value) or _DAY_MONTH_DATE_RE.search(value))


def _deadline_status(
    categories: list[dict[str, Any]],
    root_deadlines: Iterable[str] = (),
) -> dict[str, str]:
    values = [value for category in categories for value in _deadline_values(category)]
    values.extend(root_deadlines)
    exact = any(_has_exact_dated_deadline(value) for value in values)
    approximate = any(not _has_exact_dated_deadline(value) for value in values)
    return {
        "exact_dated": AVAILABLE if exact else NOT_CATALOGUED,
        "approximate_or_yearless": AVAILABLE if approximate else NOT_CATALOGUED,
    }


def _course_deadline_rows(value: Any) -> list[Any]:
    rows: list[Any] = []
    if isinstance(value, list):
        for item in value:
            rows.extend(_course_deadline_rows(item))
    elif isinstance(value, dict):
        scoped_deadlines = value.get("scoped_deadlines")
        if isinstance(scoped_deadlines, list):
            return _course_deadline_rows(scoped_deadlines)
        kind = " ".join(str(value.get(key) or "") for key in ("deadline_type", "type", "kind", "notes"))
        if _NON_COURSE_DEADLINE.search(kind):
            return rows
        if any(key in value for key in ("date", "application_deadline", "deadline")) or (
            "publication_status" in value and _non_empty_text(value.get("deadline_type"))
        ):
            rows.append(value)
        else:
            for key, child in value.items():
                if key in _COURSE_DEADLINE_KEYS:
                    rows.extend(_course_deadline_rows(child))
    elif _non_empty_text(value) and not _NON_COURSE_DEADLINE.search(value):
        rows.append(value.strip())
    return rows


def _deadline_values_for_record(record: dict[str, Any]) -> list[Any]:
    rows: list[Any] = []
    for key in _COURSE_DEADLINE_KEYS:
        if key in record:
            rows.extend(_course_deadline_rows(record.get(key)))
    return rows


def _deadline_strings(rows: Iterable[Any]) -> list[str]:
    strings: list[str] = []

    def visit(value: Any, key: str = "") -> None:
        if isinstance(value, dict):
            for child_key, child in value.items():
                visit(child, str(child_key))
        elif isinstance(value, list):
            for child in value:
                visit(child, key)
        elif _non_empty_text(value) and key.lower() in {"date", "deadline", "application_deadline"}:
            strings.append(value.strip())

    for row in rows:
        if _non_empty_text(row):
            strings.append(row.strip())
        else:
            visit(row)
    return strings


def _has_program_cost(program: dict[str, Any]) -> bool:
    price_facts = program.get("price_facts")
    if isinstance(price_facts, list) and any(
        isinstance(fact, dict)
        and str(fact.get("publication_status") or "").strip().lower() == "published"
        and isinstance(fact.get("amount"), (int, float))
        and not isinstance(fact.get("amount"), bool)
        and fact["amount"] > 0
        for fact in price_facts
    ):
        return True

    def visit(value: Any, key: str = "") -> bool:
        key_lower = key.lower()
        cost_field = any(token in key_lower for token in ("tuition", "cost", "fee")) and not any(
            token in key_lower for token in ("application", "admission", "registration")
        )
        if cost_field and isinstance(value, (int, float)) and not isinstance(value, bool):
            return value > 0
        if isinstance(value, dict):
            return any(visit(child, str(child_key)) for child_key, child in value.items())
        if isinstance(value, list):
            return any(visit(child, key) for child in value)
        return False

    return visit(program)


def _has_category_cost(category: dict[str, Any]) -> bool:
    profiles = category.get("requirement_profiles")
    sources = [category]
    if isinstance(profiles, list):
        sources.extend(profile for profile in profiles if isinstance(profile, dict))
    for row in sources:
        override = row.get("finance_override")
        if isinstance(override, dict) and _has_program_cost(override):
            return True
    return False


def _has_root_undergraduate_cost(finance: Any) -> bool:
    if not isinstance(finance, dict):
        return False
    for key in ("total_cost_year_usd", "total_cost_year_min", "total_cost_year_max"):
        value = finance.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
            return True
    breakdown = finance.get("costs_breakdown_year_usd")
    return isinstance(breakdown, dict) and any(
        isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0
        for value in breakdown.values()
    )


def _has_level_scoped_root_funding(finance: Any, level: str) -> bool:
    if not isinstance(finance, dict):
        return False
    scoped_keys = {
        "bachelor": ("undergraduate_aid_policy", "undergraduate_funding"),
        "doctorate": ("doctorate_funding_guarantee", "doctoral_funding", "phd_funding"),
    }.get(level, ())
    return any(
        (isinstance(finance.get(key), (dict, list)) and bool(finance.get(key)))
        or _non_empty_requirement(finance.get(key))
        for key in scoped_keys
    )


def _root_deadline_values(university: dict[str, Any], level: str) -> list[str]:
    deadlines = university.get("deadlines")
    if not isinstance(deadlines, dict):
        return []
    values: list[str] = []
    for scope_name, scope_value in deadlines.items():
        key = str(scope_name).lower()
        if "undergraduate" in key or "bachelor" in key:
            scope_level = "bachelor"
        elif "mba" in key:
            scope_level = "mba"
        elif any(token in key for token in ("doctoral", "doctorate", "dphil", "research")):
            scope_level = "doctorate"
        elif any(token in key for token in ("master", "taught", "graduate")):
            scope_level = "master"
        else:
            continue
        if scope_level == level:
            values.extend(_deadline_values(scope_value, exclude_mba_rounds=(level == "master")))
        elif level == "mba" and scope_level == "master":
            values.extend(_deadline_values(scope_value, mba_rounds_only=True))
    return values


def build_coverage_by_level(university: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Summarize only levels supported by an actual program or scoped admission category."""
    if not isinstance(university, dict):
        return {}
    academics = university.get("academics")
    raw_programs = academics.get("programs") if isinstance(academics, dict) else []
    programs = [row for row in raw_programs if isinstance(row, dict)] if isinstance(raw_programs, list) else []
    program_levels: dict[str, set[str]] = {}
    for program in programs:
        levels = _levels_for_record(program, program=True)
        program_id = str(program.get("id") or "").strip().lower()
        program_name = _program_name(program).lower()
        if program_id:
            program_levels[program_id] = levels
        if program_name:
            program_levels[program_name] = levels
    raw_categories = university.get("admission_categories")
    categories = [row for row in raw_categories if isinstance(row, dict)] if isinstance(raw_categories, list) else []

    programs_by_level: dict[str, list[dict[str, Any]]] = {}
    categories_by_level: dict[str, list[dict[str, Any]]] = {}
    for program in programs:
        for level in _levels_for_record(program, program=True):
            programs_by_level.setdefault(level, []).append(program)
    for category in categories:
        levels = _levels_for_record(category)
        for reference_key in ("program_ids", "applicable_program_ids", "program_names", "applicable_programs"):
            references = category.get(reference_key)
            if isinstance(references, str):
                references = [references]
            if isinstance(references, list):
                for reference in references:
                    levels.update(program_levels.get(str(reference or "").strip().lower(), set()))
        profiles = category.get("requirement_profiles")
        if isinstance(profiles, list):
            for profile in profiles:
                if isinstance(profile, dict):
                    levels.update(_levels_for_record(profile))
        for level in levels:
            categories_by_level.setdefault(level, []).append(category)

    finance = university.get("finance")
    levels_present = set(programs_by_level) | set(categories_by_level)
    ordered_levels = [level for level in _LEVEL_KEYS if level in levels_present]
    if "mba" in levels_present:
        ordered_levels.append("mba")

    output: dict[str, dict[str, Any]] = {}
    for level in ordered_levels:
        level_programs = programs_by_level.get(level, [])
        level_categories = categories_by_level.get(level, [])
        program_cost = any(_has_program_cost(program) for program in level_programs)
        program_cost = program_cost or any(_has_category_cost(category) for category in level_categories)
        root_cost = level == "bachelor" and _has_root_undergraduate_cost(finance)
        has_requirements = any(_has_requirements(category) for category in level_categories)
        has_funding = any(_has_funding_data(category) for category in level_categories)
        has_funding = has_funding or _has_level_scoped_root_funding(finance, level)
        program_deadlines = [
            deadline
            for program in level_programs
            for deadline in _deadline_strings(_deadline_values_for_record(program))
        ]
        output[level] = {
            "programs": AVAILABLE if level_programs else NOT_CATALOGUED,
            "admissions_requirements": AVAILABLE if has_requirements else NOT_CATALOGUED,
            "deadlines": _deadline_status(
                level_categories,
                [*_root_deadline_values(university, level), *program_deadlines],
            ),
            "costs": {
                "program_specific": AVAILABLE if program_cost else NOT_CATALOGUED,
                "undergraduate_root_finance": AVAILABLE if root_cost else NOT_CATALOGUED,
            },
            "aid_funding": AVAILABLE if has_funding else NOT_CATALOGUED,
        }
    return output
