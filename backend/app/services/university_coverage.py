"""Build truthful, level-scoped summaries of the data UniSearch has catalogued."""
from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, Iterable, List, Set


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
_UNPUBLISHED_DEADLINE_TEXT = re.compile(r"\b(?:not yet published|not published|not been published|to be announced|\bTBA\b)\b", re.I)
_CONFLICTING_DEADLINE_TEXT = re.compile(r"\b(?:conflict|conflicting|inconsistent|contradictory|disagree)\b", re.I)


def _non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _program_name(program: Dict[str, Any]) -> str:
    return str(program.get("name") or program.get("title") or "").strip()


def _levels_for_record(record: Dict[str, Any], *, program: bool = False) -> Set[str]:
    """Return levels stated by this record; do not infer a degree from a generic label."""
    raw_levels = record.get("study_levels")
    if isinstance(raw_levels, (str, int)):
        raw_levels = [raw_levels]
    raw_scope = record.get("scope")
    if isinstance(raw_scope, dict) and raw_scope.get("level"):
        raw_levels = list(raw_levels) if isinstance(raw_levels, list) else []
        raw_levels.append(raw_scope["level"])
    levels: Set[str] = set()
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


def _has_requirements(category: Dict[str, Any]) -> bool:
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


def _has_funding_data(record: Dict[str, Any]) -> bool:
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
                        child, key_text, exclude_mba_rounds=exclude_mba_rounds,
                        mba_rounds_only=mba_rounds_only, in_mba_rounds=child_in_mba_rounds,
                    )
            elif parent_key in {"deadlines", "admission_rounds", "mba_rounds", "mba_deadlines"} and key_text in {
                "date", "application_deadline", "financial_aid_deadline", "portfolio_deadline",
                "reply_deadline", "deadline",
            }:
                yield from _deadline_values(
                    child, key_text, exclude_mba_rounds=exclude_mba_rounds,
                    mba_rounds_only=mba_rounds_only, in_mba_rounds=child_in_mba_rounds,
                )
            elif key_text in {"deadlines", "admission_rounds", "mba_rounds", "mba_deadlines"}:
                yield from _deadline_values(
                    child, key_text, exclude_mba_rounds=exclude_mba_rounds,
                    mba_rounds_only=mba_rounds_only, in_mba_rounds=child_in_mba_rounds,
                )
    elif isinstance(value, list):
        for item in value:
            yield from _deadline_values(
                item, parent_key, exclude_mba_rounds=exclude_mba_rounds,
                mba_rounds_only=mba_rounds_only, in_mba_rounds=in_mba_rounds,
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
    categories: List[Dict[str, Any]], root_deadlines: Iterable[str] = ()
) -> Dict[str, str]:
    values = [value for category in categories for value in _deadline_values(category)]
    values.extend(root_deadlines)
    exact = any(_has_exact_dated_deadline(value) for value in values)
    approximate = any(not _has_exact_dated_deadline(value) for value in values)
    return {
        "exact_dated": AVAILABLE if exact else NOT_CATALOGUED,
        "approximate_or_yearless": AVAILABLE if approximate else NOT_CATALOGUED,
    }


def _has_program_cost(program: Dict[str, Any]) -> bool:
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


def _has_category_cost(category: Dict[str, Any]) -> bool:
    profiles = category.get("requirement_profiles")
    sources = [category]
    if isinstance(profiles, list):
        sources.extend(profile for profile in profiles if isinstance(profile, dict))
    return any(
        _has_program_cost(row.get("finance_override"))
        for row in sources
        if isinstance(row.get("finance_override"), dict)
    )


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
        isinstance(finance.get(key), (dict, list)) and bool(finance.get(key))
        or _non_empty_requirement(finance.get(key))
        for key in scoped_keys
    )


def _root_deadline_values(university: Dict[str, Any], level: str) -> List[str]:
    deadlines = university.get("deadlines")
    if not isinstance(deadlines, dict):
        return []
    values: List[str] = []
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


def build_coverage_by_level(university: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Summarize only levels supported by an actual program or scoped admission category."""
    if not isinstance(university, dict):
        return {}
    academics = university.get("academics")
    programs = academics.get("programs") if isinstance(academics, dict) else []
    programs = [row for row in programs if isinstance(row, dict)] if isinstance(programs, list) else []
    program_levels: Dict[str, Set[str]] = {}
    for program in programs:
        levels = _levels_for_record(program, program=True)
        program_id = str(program.get("id") or "").strip().lower()
        program_name = _program_name(program).lower()
        if program_id:
            program_levels[program_id] = levels
        if program_name:
            program_levels[program_name] = levels
    categories = university.get("admission_categories")
    categories = [row for row in categories if isinstance(row, dict)] if isinstance(categories, list) else []

    programs_by_level: Dict[str, List[Dict[str, Any]]] = {}
    categories_by_level: Dict[str, List[Dict[str, Any]]] = {}
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

    output: Dict[str, Dict[str, Any]] = {}
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


_PROGRAM_REQUIREMENT_FIELDS = (
    "requirements", "admissions_requirements", "entry_requirements", "academic_entry_requirement",
    "admissions_tests", "admissions_test", "admissions_test_notes", "standard_offer_a_level",
    "standard_offer_ib", "language_requirements", "required_documents", "minimum_gpa",
)
_COURSE_DEADLINE_KEYS = ("deadline", "deadlines", "application_deadline", "admission_rounds", "mba_rounds", "mba_deadlines")
_NON_COURSE_DEADLINE = re.compile(
    r"scholarship|funding|financial aid|award|studentship|test.?booking|test.?registration|standardized.?test|admissions.?test",
    re.I,
)


def _fact_status(status: str, scope: str = "not_catalogued", **metadata: Any) -> Dict[str, Any]:
    return {
        "status": status,
        "scope": scope if status != NOT_CATALOGUED else "not_catalogued",
        "source_url": metadata.get("source_url"),
        "cycle": metadata.get("cycle"),
        "verified_at": metadata.get("verified_at"),
    }


def _metadata_value(records: Iterable[Dict[str, Any]], keys: Iterable[str]) -> Any:
    for record in records:
        if not isinstance(record, dict):
            continue
        for key in keys:
            value = record.get(key)
            if _non_empty_text(value):
                return value.strip()
    return None


def _source_url(records: Iterable[Dict[str, Any]]) -> Any:
    return _metadata_value(records, ("source_url", "url"))


def _cycle(records: Iterable[Dict[str, Any]]) -> Any:
    return _metadata_value(records, ("cycle", "academic_year"))


def _verified_at(records: Iterable[Dict[str, Any]]) -> Any:
    return _metadata_value(records, ("verified_at",))


def _program_refs(category: Dict[str, Any]) -> Set[str]:
    refs: Set[str] = set()
    for key in ("program_ids", "applicable_program_ids", "program_names", "applicable_programs"):
        value = category.get(key)
        if isinstance(value, str):
            value = [value]
        if isinstance(value, list):
            refs.update(str(item or "").strip().lower() for item in value if str(item or "").strip())
    return refs


def _single_program_route(category: Dict[str, Any]) -> bool:
    ids = category.get("program_ids") or category.get("applicable_program_ids") or []
    names = category.get("program_names") or category.get("applicable_programs") or []
    if isinstance(ids, str):
        ids = [ids]
    if isinstance(names, str):
        names = [names]
    return (len(ids) == 1 and len(names) <= 1) or (not ids and len(names) == 1)


def _matches_program(category: Dict[str, Any], program: Dict[str, Any]) -> bool:
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
    return scope in {"undergraduate_general", "institution_wide_undergraduate"} and "bachelor" in levels and "bachelor" in program_levels


def _has_program_requirements(program: Dict[str, Any]) -> bool:
    return any(_non_empty_requirement(program.get(key)) for key in _PROGRAM_REQUIREMENT_FIELDS)


def _course_deadline_rows(value: Any) -> List[Any]:
    rows: List[Any] = []
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
    elif _non_empty_text(value):
        if not _NON_COURSE_DEADLINE.search(value):
            rows.append(value.strip())
    return rows


def _deadline_values_for_record(record: Dict[str, Any]) -> List[Any]:
    rows: List[Any] = []
    for key in _COURSE_DEADLINE_KEYS:
        if key in record:
            rows.extend(_course_deadline_rows(record.get(key)))
    return rows


def _row_program_ids(row: Dict[str, Any]) -> Set[str]:
    value = row.get("program_ids") or row.get("applicable_program_ids")
    if isinstance(value, str):
        value = [value]
    return {str(item or "").strip().lower() for item in value if str(item or "").strip()} if isinstance(value, list) else set()


def _scoped_fact_matches_program(row: Any, program: Dict[str, Any]) -> bool:
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


def _deadline_rows_for_program(record: Dict[str, Any], program: Dict[str, Any]) -> List[Any]:
    return [row for row in _deadline_values_for_record(record) if _scoped_fact_matches_program(row, program)]


def _published_deadline_rows(rows: List[Any]) -> List[Any]:
    return [
        row for row in rows
        if (
            str(row.get("publication_status") or "").strip().lower() == "published"
            if isinstance(row, dict) and "publication_status" in row
            else _legacy_deadline_publication_status(row) is None
        )
    ]


def _legacy_deadline_publication_status(row: Any) -> str | None:
    if isinstance(row, dict) and "publication_status" in row:
        return None
    text = row if isinstance(row, str) else " ".join(
        str(row.get(key) or "") for key in ("date", "deadline", "application_deadline", "notes")
    ) if isinstance(row, dict) else ""
    if _UNPUBLISHED_DEADLINE_TEXT.search(text):
        return "not_yet_published"
    if _CONFLICTING_DEADLINE_TEXT.search(text):
        return "conflicting"
    return None


def _deadline_strings(rows: Iterable[Any]) -> List[str]:
    strings: List[str] = []

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


def _deadline_fact(program: Dict[str, Any], routes: List[Dict[str, Any]], university: Dict[str, Any]) -> Dict[str, Any]:
    program_rows = _deadline_rows_for_program(program, program)
    rows = _published_deadline_rows(program_rows)
    sources: List[Dict[str, Any]] = [program]
    scope = "program_specific"
    if not rows:
        route_rows: List[Any] = []
        matching = [route for route in routes if _matches_program(route, program)]
        for route in matching:
            route_rows.extend(_deadline_rows_for_program(route, program))
        program_refs = {
            str(program.get("id") or "").strip().lower(),
            str(program.get("course_number") or "").strip().lower(),
            _program_name(program).lower(),
        }
        exact_route_rows = [
            row for row in route_rows
            if isinstance(row, dict)
            and row.get("applicability") == "program_specific"
            and _row_program_ids(row).intersection(program_refs)
        ]
        explicit_program_unknown = any(
            isinstance(row, dict) and row.get("publication_status") not in (None, "published")
            or _legacy_deadline_publication_status(row) is not None
            for row in program_rows
        )
        if exact_route_rows:
            route_rows = exact_route_rows
        elif explicit_program_unknown:
            route_rows = []
        if route_rows:
            program_specific_rows = [
                row for row in route_rows
                if isinstance(row, dict)
                and "publication_status" in row
                and row.get("applicability") == "program_specific"
            ]
            if program_specific_rows:
                route_rows = program_specific_rows
            rows = route_rows
            sources = matching
            scope = "program_specific" if any(
                isinstance(row, dict) and row.get("applicability") == "program_specific"
                for row in route_rows
            ) or any(_single_program_route(route) for route in matching) else (
                "shared_admission_route" if any(_program_refs(route) for route in matching) else "institution_wide_route"
            )
        else:
            structured_unknowns = [
                row for row in program_rows
                if isinstance(row, dict) and row.get("publication_status") not in (None, "published")
            ]
            if structured_unknowns:
                rows = structured_unknowns
            else:
                program_publication_status = next(
                    (_legacy_deadline_publication_status(row) for row in program_rows if _legacy_deadline_publication_status(row)),
                    None,
                )
                if program_publication_status:
                    rows = [{"publication_status": program_publication_status, "deadline_type": "course_application"}]
        if not rows and "bachelor" in _levels_for_record(program, program=True):
            # Root undergraduate timelines commonly define a single university deadline.
            # Never project generic graduate deadlines onto named graduate programs.
            root_deadlines = university.get("deadlines")
            undergraduate_roots = [
                value for key, value in root_deadlines.items()
                if "undergraduate" in str(key).lower() or "bachelor" in str(key).lower()
            ] if isinstance(root_deadlines, dict) else []
            for value in undergraduate_roots:
                rows.extend(_course_deadline_rows(value))
            if rows:
                sources = undergraduate_roots
                scope = "university_guidance"
    scoped_rows = rows
    rows = _published_deadline_rows(scoped_rows)
    strings = _deadline_strings(rows)
    status = NOT_CATALOGUED
    if strings:
        status = "exact_dated" if any(_has_exact_dated_deadline(value) for value in strings) else "approximate_or_yearless"
    metadata = {
        "source_url": next((str(row.get("source_url")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("source_url"))), None) or _metadata_value(sources, ("deadline_source_url", "source_url", "url")),
        "cycle": next((str(row.get("cycle")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("cycle"))), None) or _metadata_value(sources, ("deadline_cycle", "cycle", "academic_year")),
        "verified_at": next((str(row.get("verified_at")).strip() for row in scoped_rows if isinstance(row, dict) and _non_empty_text(row.get("verified_at"))), None) or _verified_at(sources),
    }
    result = {**_fact_status(status, scope, **metadata), "values": rows}
    publication_facts = [
        {key: value for key, value in row.items() if key not in {"date", "deadline", "application_deadline", "time", "timezone"}}
        for row in scoped_rows
        if isinstance(row, dict) and row.get("publication_status") not in (None, "published")
    ]
    if publication_facts:
        result["publication_facts"] = publication_facts
        if not rows:
            result["publication_status"] = publication_facts[0].get("publication_status")
    return result


def _program_cost_values(record: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}

    def visit(value: Any, prefix: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                name = str(key)
                if (
                    re.search(r"tuition|annual.?fees?|mandatory.?fees?", name, re.I)
                    and not re.search(r"threshold|income|aid|waiver", name, re.I)
                    and isinstance(child, (int, float)) and not isinstance(child, bool) and child > 0
                ):
                    result[name] = child
                elif isinstance(child, (dict, list)):
                    visit(child, name)
        elif isinstance(value, list):
            for child in value:
                visit(child, prefix)

    visit(record)
    return result


def _all_structured_price_facts(record: Any, program: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(record, dict):
        return []
    facts = record.get("price_facts")
    if not isinstance(facts, list):
        return []
    return [fact for fact in facts if isinstance(fact, dict) and _scoped_fact_matches_program(fact, program)]


def _structured_price_facts(record: Any, program: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        fact for fact in _all_structured_price_facts(record, program)
        if str(fact.get("publication_status") or "").strip().lower() == "published"
    ]


def _price_fact_values(facts: List[Dict[str, Any]]) -> Dict[str, Any]:
    values: Dict[str, Any] = {}
    for fact in facts:
        amount = fact.get("amount")
        if not isinstance(amount, (int, float)) or isinstance(amount, bool) or amount <= 0:
            continue
        parts = [
            fact.get("kind"), fact.get("fee_status"), fact.get("applicant_category"),
            fact.get("period"), fact.get("quantity_basis"), fact.get("currency"),
        ]
        key = "_".join(re.sub(r"[^a-z0-9]+", "_", str(part or "").lower()).strip("_") for part in parts if part)
        values[key] = amount
    return values


def _legacy_historical_values(record: Dict[str, Any], excluded_cycles: Set[str]) -> Optional[Dict[str, Any]]:
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


def _root_costs(finance: Any) -> Dict[str, Any]:
    if not isinstance(finance, dict):
        return {}
    result = _program_cost_values(finance)
    # Annual cost-of-attendance is useful context, but is not a named program price.
    for key in ("total_cost_year_usd", "total_cost_year_min", "total_cost_year_max", "costs_breakdown_year_usd"):
        value = finance.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
            result[key] = value
        elif key == "costs_breakdown_year_usd" and isinstance(value, dict):
            amounts = {name: amount for name, amount in value.items() if isinstance(amount, (int, float)) and not isinstance(amount, bool) and amount > 0}
            if amounts:
                result[key] = amounts
    if result and _non_empty_text(finance.get("currency")):
        result["currency"] = finance["currency"]
    return result


def _cost_fact(program: Dict[str, Any], routes: List[Dict[str, Any]], university: Dict[str, Any]) -> Dict[str, Any]:
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
        published_entries = [(fact, record) for fact, record in entries if str(fact.get("publication_status") or "").strip().lower() == "published"]
        publication_entries = [(fact, record) for fact, record in entries if str(fact.get("publication_status") or "").strip().lower() != "published"]
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
            (fact, record) for fact, record in published_entries
            if (not unknown_cycles or str(fact.get("cycle") or "").strip() in unknown_cycles)
            if (
                str(fact.get("cycle") or "").strip(),
                str(fact.get("kind") or "").strip().lower(),
                str(fact.get("period") or "").strip().lower(),
                str(fact.get("currency") or "").strip().upper(),
                str(fact.get("fee_status") or "").strip().lower(),
                str(fact.get("applicant_category") or "").strip().lower(),
            ) not in unknown_scopes
        ]
        publication_facts = [
            {key: value for key, value in fact.items() if key not in {"amount", "legacy_field"}}
            for fact, _record in publication_entries
        ]
        statuses = {str(fact.get("publication_status") or "unknown") for fact, _record in publication_entries}
        publication_status = next(iter(statuses)) if len(statuses) == 1 else "conflicting" if statuses else None
        historical_facts = [fact for fact, _record in published_entries
                            if unknown_cycles and str(fact.get("cycle") or "").strip() not in unknown_cycles]
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
        meta_fact = ( [fact for fact, _record in publication_entries] if publication_entries and not visible_facts
                     else visible_facts or [fact for fact, _record in publication_entries])[0]
        metadata_record = next((record for fact, record in entries if fact is meta_fact), program)
        result = {
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
        return {**_fact_status(AVAILABLE, "program_specific", source_url=program.get("tuition_source_url") or _source_url([program]), cycle=program.get("tuition_cycle") or _cycle([program]), verified_at=_verified_at([program])), "values": values}
    matching = []
    for route in routes:
        if not _matches_program(route, program):
            continue
        override = route.get("finance_override") or {}
        facts = _structured_price_facts(override, program)
        if facts or _program_cost_values(override):
            matching.append((route, facts))
    if matching:
        route, facts = matching[0]
        override = route.get("finance_override") or {}
        if facts:
            values = _price_fact_values(facts)
        else:
            values = _program_cost_values(override)
            values["currency"] = override.get("currency")
        refs = _program_refs(route)
        scope = str(facts[0].get("applicability")) if facts and facts[0].get("applicability") else "program_specific" if _single_program_route(route) else "shared_admission_route" if refs else "institution_wide_route"
        fact = {**_fact_status(AVAILABLE, scope, source_url=(facts[0].get("source_url") if facts else None) or _source_url([override, route]), cycle=(facts[0].get("cycle") if facts else None) or _cycle([override, route]), verified_at=(facts[0].get("verified_at") if facts else None) or _verified_at([override, route])), "values": values}
        if facts:
            fact["price_facts"] = facts
        return fact
    program_levels = _levels_for_record(program, program=True)
    finance = university.get("finance")
    values = _root_costs(finance) if "bachelor" in program_levels else {}
    if values:
        return {**_fact_status(AVAILABLE, "university_guidance", source_url=_source_url([finance]), cycle=_cycle([finance]), verified_at=_verified_at([finance])), "values": values}
    return {**_fact_status(NOT_CATALOGUED), "values": {}}


def _award_level_set(award: Dict[str, Any]) -> Set[str]:
    levels: Set[str] = set()
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


def _award_matches_program(award: Dict[str, Any], program: Dict[str, Any]) -> bool:
    award_levels = _award_level_set(award)
    program_levels = _levels_for_record(program, program=True)
    if not award_levels or not program_levels or not award_levels.intersection(program_levels):
        return False
    explicit_program_ids = award.get("program_ids")
    if isinstance(explicit_program_ids, list) and explicit_program_ids:
        program_ids = {str(program.get(key) or "").strip().lower() for key in ("id", "course_number")}
        return any(str(item or "").strip().lower() in program_ids for item in explicit_program_ids)
    scope = str(award.get("program_scope") or "").lower()
    program_text = " ".join(str(program.get(key) or "") for key in ("id", "name", "degree_type", "school", "faculty")).lower()
    if "centre for doctoral training" in scope and not re.search(r"\bcdt\b|centre for doctoral training", program_text):
        return False
    if "selected postgraduate taught" in scope and "bachelor" not in program_levels:
        return False
    if re.search(r"except\s+medicine", scope) and "medicine" in program_text:
        return False
    focus_terms = re.findall(r"\b(?:mba|hbs|gsb|mfin|mban|mpp|mpa|jd|bcl)\b", scope)
    return not focus_terms or any(re.search(rf"\b{re.escape(term)}\b", program_text) for term in focus_terms)


def _awards_for_program(finance: Any, program: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(finance, dict):
        return []
    awards = finance.get("scholarships_and_funding")
    if not isinstance(awards, list):
        return []
    output: List[Dict[str, Any]] = []
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


def _requirements_fact(program: Dict[str, Any], routes: List[Dict[str, Any]]) -> Dict[str, Any]:
    if _has_program_requirements(program):
        return _fact_status(AVAILABLE, "program_specific", source_url=_source_url([program]), cycle=_cycle([program]), verified_at=_verified_at([program]))
    matching = [route for route in routes if _matches_program(route, program) and _has_requirements(route)]
    if matching:
        refs = _program_refs(matching[0])
        scope = "program_specific" if _single_program_route(matching[0]) else "shared_admission_route" if refs else "institution_wide_route"
        return _fact_status(AVAILABLE, scope, source_url=_source_url(matching), cycle=_cycle(matching), verified_at=_verified_at(matching))
    return _fact_status(NOT_CATALOGUED)


def build_coverage_by_program(university: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Report catalogued coverage per named program without inheriting broad graduate facts."""
    if not isinstance(university, dict):
        return []
    academics = university.get("academics")
    programs = academics.get("programs") if isinstance(academics, dict) else []
    if not isinstance(programs, list):
        return []
    programs = [program for program in programs if isinstance(program, dict) and _program_name(program)]
    routes = university.get("admission_categories")
    routes = [route for route in routes if isinstance(route, dict)] if isinstance(routes, list) else []
    finance = university.get("finance")
    result: List[Dict[str, Any]] = []
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
