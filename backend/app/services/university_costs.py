"""Cost, financial-aid, acceptance-rate, and student-size helpers for universities."""

import math
import re
from typing import Any

from app.core.utils import to_float as _num_or_none
from app.services import admissions_catalog
from app.services.finance_modes import (
    extract_tuition_cost as _extract_tuition_cost,
)
from app.services.finance_modes import (
    mode_breakdown_from_finance as _mode_breakdown_from_finance,
)
from app.services.finance_modes import (
    mode_total_from_finance as _mode_total_from_finance,
)
from app.services.finance_modes import (
    normalize_study_mode as _normalize_study_mode,
)
from app.services.university_tracks import (
    _canonical_major,
    _iter_programs,
    _major_tags_from_text,
    _safe_lower,
    expand_admission_choices,
)

# Size bands by total student count. The stored campus-size bucket mixed land area for some universities
# with student numbers for others; the published student count is known for every catalog university.
SMALL_STUDENT_LIMIT = 10000
LARGE_STUDENT_LIMIT = 30000


def student_size_band(u: dict[str, Any]) -> str:
    """Return small (under 10,000), medium (10,000-30,000) or large (over 30,000), or "" without a count."""
    count = _num_or_none(u.get("student_count")) if isinstance(u, dict) else None
    if count is None or count <= 0:
        return ""
    if count < SMALL_STUDENT_LIMIT:
        return "small"
    return "medium" if count <= LARGE_STUDENT_LIMIT else "large"


def _get_nested(u: dict[str, Any], path: list[str], default: Any = None) -> Any:
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _get_list(u: dict[str, Any], path: list[str]) -> list[Any]:
    val = _get_nested(u, path, [])
    if isinstance(val, list):
        return val
    return []


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _to_float(x: Any) -> float | None:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None


def _to_bool(x: Any) -> bool:
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return x != 0
    if isinstance(x, str):
        return x.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(x)


def _effective_university_cost(
    u: dict[str, Any],
    format_preference: Any = "any",
) -> float | None:
    mode = _normalize_study_mode(format_preference)
    finance = _as_dict(u.get("finance"))
    total = _to_float(finance.get("total_cost_year_usd"))
    breakdown = finance.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    tuition = _extract_tuition_cost(breakdown)

    if mode == "online":
        mode_breakdown = _mode_breakdown_from_finance(finance, "online")
        mode_tuition = _extract_tuition_cost(
            mode_breakdown if isinstance(mode_breakdown, dict) else {}
        )
        if mode_tuition is not None and mode_tuition >= 0:
            return max(0.0, mode_tuition)
        if tuition is not None and tuition >= 0:
            return max(0.0, tuition)
        mode_total = _mode_total_from_finance(finance, "online")
        if mode_total is not None and mode_total >= 0:
            return max(0.0, mode_total)
        return None

    return total if total is not None and math.isfinite(total) and total >= 0 else None


def _effective_university_cost_usd(
    u: dict[str, Any],
    format_preference: Any = "any",
) -> float | None:
    mode = _normalize_study_mode(format_preference)
    raw_cost = _effective_university_cost(u, format_preference=mode)
    if raw_cost is None:
        return None
    if raw_cost <= 0:
        return raw_cost
    finance = _as_dict(u.get("finance"))
    currency_code = str(finance.get("currency") or "USD").strip().upper()
    if not currency_code or currency_code == "USD":
        return raw_cost
    try:
        from app.services.currency import convert

        return max(0.0, float(convert(raw_cost, currency_code, "USD")))
    except ValueError:
        return None


def _university_cost_range(u: dict[str, Any]) -> dict[str, Any] | None:
    finance = _as_dict(u.get("finance"))
    minimum = _to_float(finance.get("total_cost_year_min"))
    maximum = _to_float(finance.get("total_cost_year_max"))
    if minimum is None or maximum is None or minimum < 0 or maximum < minimum:
        return None

    currency = str(finance.get("currency") or "").strip().upper() or None
    minimum_usd = maximum_usd = None
    if currency == "USD":
        minimum_usd, maximum_usd = minimum, maximum
    elif currency:
        try:
            from app.services.currency import convert

            minimum_usd = max(0.0, float(convert(minimum, currency, "USD")))
            maximum_usd = max(0.0, float(convert(maximum, currency, "USD")))
        except ValueError:
            minimum_usd = maximum_usd = None

    return {
        "min": minimum,
        "max": maximum,
        "currency": currency,
        "min_usd": minimum_usd,
        "max_usd": maximum_usd,
        "academic_year": finance.get("academic_year"),
        "source_url": finance.get("source_url"),
        "source_urls": finance.get("source_urls"),
    }


def _catalog_costs(u: dict[str, Any], format_preference: Any = "any") -> dict[str, Any]:
    if isinstance(u.get("catalog_costs"), dict):
        return u["catalog_costs"]
    if u.get("id") in admissions_catalog.INSTITUTION_IDS:
        return admissions_catalog.catalog_costs(u["id"], study_mode=_normalize_study_mode(format_preference))
    finance = u.get("finance") or {}
    mode = _normalize_study_mode(format_preference)
    breakdown = _mode_breakdown_from_finance(finance, mode) if mode == "online" else finance.get("costs_breakdown_year_usd")
    tuition = _extract_tuition_cost(breakdown or {})
    total = _effective_university_cost(u, format_preference)
    currency = finance.get("currency") or "USD"

    def quote(amount: float | None) -> dict[str, Any] | None:
        if amount is None or not math.isfinite(amount) or amount < 0:
            return None
        return {
            "min": amount,
            "max": amount,
            "currency": currency,
            "period": finance.get("academic_year") or "",
            "study_level": "",
            "fee_statuses": [],
            "exclusions": [],
        }

    price_range = None
    if mode != "online":
        lower, upper = _to_float(finance.get("total_cost_year_min")), _to_float(finance.get("total_cost_year_max"))
        if lower is not None and upper is not None and math.isfinite(lower) and math.isfinite(upper) and 0 <= lower <= upper:
            low_quote = quote(lower)
            if low_quote is not None:
                price_range = {**low_quote, "max": upper, "currency": finance.get("currency")}
    return {"annual_total": quote(total) or price_range, "tuition": quote(tuition), "reference": False}


def _profiled_legacy_costs(
    u: dict[str, Any],
    format_preference: Any = "any",
    profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    published = _catalog_costs(u, format_preference)
    if profile is None:
        return published
    finance = u.get("finance") or {}
    currency = str(finance.get("currency") or "").upper()
    if u.get("id") == "university-of-oxford-uk-oxford" and _normalize_study_mode(format_preference) != "online":
        choice = (profile.get("selectedAdmissionChoices") or {}).get(u["id"], {})
        level = str(choice.get("studyLevel") or profile.get("study_level") or "").lower()
        level_names = {
            "bachelor": {"Bachelor", "Integrated Master"},
            "undergraduate": {"Bachelor", "Integrated Master"},
            "integrated master": {"Integrated Master"},
            "master": {"Master"},
            "masters": {"Master"},
            "doctoral": {"Doctorate"},
            "doctorate": {"Doctorate"},
        }.get(level, {"Bachelor", "Integrated Master"} if not level else set())
        wanted = _canonical_major(profile.get("major"))
        selected_id = choice.get("programId") or choice.get("studyOptionId")
        programs = [
            program
            for program in _iter_programs(u)
            if level_names.intersection(program.get("study_levels") or [])
            and (not selected_id or program.get("id") == selected_id)
        ]
        if wanted and not selected_id:
            matches = [
                program
                for program in programs
                if wanted in (program.get("major_tags") or []) or wanted in _major_tags_from_text(program.get("name"))
            ]
            if matches:
                programs = matches
        fee_context = str(choice.get("feeStatusContext") or profile.get("fee_status_context") or "")
        fee_field_map: dict[str, tuple[str, ...]] = {
            "self_reported_home_domestic": ("home_annual_fee_gbp",),
            "self_reported_international_overseas": ("overseas_annual_fee_gbp",),
        }
        fee_fields = fee_field_map.get(fee_context, ("home_annual_fee_gbp", "overseas_annual_fee_gbp"))
        amounts = [
            float(program[field])
            for program in programs
            for field in fee_fields
            if isinstance(program.get(field), (int, float)) and program[field] >= 0
        ]
        living_range = (finance.get("living_costs_monthly_gbp") or {}).get("total_annual_range_9_months") or {}
        living_low, living_high = _to_float(living_range.get("min")), _to_float(living_range.get("max"))
        if amounts and currency == "GBP":
            amounts = sorted(set(amounts))
            source_urls = sorted({str(url) for program in programs if (url := program.get("tuition_source_url"))})
            tuition = {
                "min": amounts[0],
                "max": amounts[-1],
                "amounts": amounts,
                "currency": currency,
                "period": finance.get("academic_year") or "",
                "source_urls": source_urls,
                "fee_statuses": ["Home fee" if field.startswith("home_") else "Overseas fee" for field in fee_fields],
            }
            total = None
            if level_names.intersection({"Bachelor", "Integrated Master"}) and living_low is not None and living_high is not None and 0 <= living_low <= living_high:
                intervals = [{"min": amount + living_low, "max": amount + living_high} for amount in amounts]
                total = {
                    **tuition,
                    "min": intervals[0]["min"],
                    "max": intervals[-1]["max"],
                    "intervals": intervals,
                    "calculation": "tuition_plus_living_range",
                    "living_min": living_low,
                    "living_max": living_high,
                    "living_period": "9 months",
                    "source_urls": source_urls + [finance["living_costs_monthly_gbp"]["source_url"]],
                }
                total.pop("amounts")
            return {"annual_total": total, "tuition": tuition, "reference": True}
    if u.get("id") == "harvard-usa-cambridge":
        choice = (profile.get("selectedAdmissionChoices") or {}).get(u["id"], {})
        level = str(choice.get("studyLevel") or profile.get("study_level") or "").lower()
        if level in {"master", "masters", "professional", "doctoral", "doctorate"}:
            harvard_level_names: dict[str, str] = {
                "master": "Master",
                "masters": "Master",
                "professional": "Professional",
                "doctoral": "Doctorate",
                "doctorate": "Doctorate",
            }
            selected_id = choice.get("programId") or choice.get("studyOptionId")
            wanted = _canonical_major(profile.get("major"))
            programs = [
                program
                for program in _iter_programs(u)
                if harvard_level_names[level] in (program.get("study_levels") or [])
                and (not selected_id or program.get("id") == selected_id)
            ]
            if wanted and not selected_id:
                matches = [
                    program
                    for program in programs
                    if wanted in (program.get("major_tags") or [])
                    or wanted in _major_tags_from_text(program.get("name"))
                ]
                if matches:
                    programs = matches
            priced = [
                program
                for program in programs
                if isinstance(program.get("tuition_year_usd"), (int, float))
                and program["tuition_year_usd"] >= 0
            ]
            if priced:
                latest_period = max(
                    (program.get("tuition_academic_year") or "" for program in priced),
                    key=lambda period: (re.findall(r"20\d{2}", period) or [""])[0],
                )
                priced = [program for program in priced if (program.get("tuition_academic_year") or "") == latest_period]
                amounts = sorted({float(program["tuition_year_usd"]) for program in priced})
                tuition = {
                    "min": amounts[0],
                    "max": amounts[-1],
                    "amounts": amounts,
                    "currency": "USD",
                    "period": latest_period,
                    "source_urls": sorted({str(url) for program in priced if (url := program.get("tuition_source_url"))}),
                }
                return {"annual_total": None, "tuition": tuition, "reference": True}
            return {"annual_total": None, "tuition": None, "reference": True}
    breakdown = finance.get("costs_breakdown_year_usd") or {}
    if currency == "USD" and isinstance(breakdown, dict) and breakdown:
        tuition_amount = _extract_tuition_cost(breakdown)
        costs = [_to_float(value) for value in breakdown.values()]
        if tuition_amount is not None and all(value is not None and value >= 0 for value in costs):
            base = sum(value for value in costs if value is not None) - tuition_amount
            published["annual_total"] = {
                **(published.get("annual_total") or {}),
                "min": tuition_amount + base,
                "max": tuition_amount + base,
                "currency": "USD",
                "calculation": "published_fixed_budget",
            }
    return published


def _catalog_cost_range_usd(
    u: dict[str, Any],
    basis: str = "annual_total",
    format_preference: Any = "any",
    *,
    published_only: bool = False,
) -> tuple[float, float] | None:
    quote = _catalog_costs(u, format_preference).get(basis)
    if not isinstance(quote, dict):
        return None
    if quote.get("annual_comparable") is False:
        return None
    low: float | None
    high: float | None
    if published_only and "published_intervals" in quote:
        intervals = quote["published_intervals"]
        if not intervals:
            return None
        bounds = [(_to_float(interval.get("min")), _to_float(interval.get("max"))) for interval in intervals]
        if any(low is None or high is None for low, high in bounds):
            return None
        low = min(bound[0] for bound in bounds if bound[0] is not None)
        high = max(bound[1] for bound in bounds if bound[1] is not None)
    elif published_only and quote.get("calculation") == "tuition_plus_living_range":
        return None
    else:
        low, high = _to_float(quote.get("min")), _to_float(quote.get("max"))
    if low is None or high is None or not math.isfinite(low) or not math.isfinite(high) or low < 0 or high < low:
        return None
    currency = quote.get("currency")
    if currency == "USD":
        return low, high
    if not currency:
        return None
    try:
        from app.services.currency import convert

        return float(convert(low, currency, "USD")), float(convert(high, currency, "USD"))
    except ValueError:
        return None


def _get_university_acceptance_rate(u: dict[str, Any]) -> float | None:
    direct = _to_float(_get_nested(u, ["academics", "acceptance_rate_percent"]))
    if direct is not None:
        return direct
    vals: list[float] = []
    for program in _iter_programs(u):
        val = _to_float(program.get("acceptance_rate_percent"))
        if val is not None:
            vals.append(val)
    if vals:
        return sum(vals) / len(vals)
    return None


def _has_any_aid(u: dict[str, Any]) -> bool:
    finance = u.get("finance")
    if isinstance(finance, dict):
        aid = finance.get("financial_aid")
        if isinstance(aid, dict) and (_to_bool(aid.get("merit_based")) or _to_bool(aid.get("need_based"))):
            return True

    choices = expand_admission_choices(u.get("admission_categories"))
    if not choices:
        return False

    for choice in choices:
        if not isinstance(choice, dict):
            continue
        if _safe_lower(choice.get("funding_type")) == "grant":
            return True
        scholarships = choice.get("scholarships")
        if isinstance(scholarships, list) and len(scholarships) > 0:
            return True
    return False


def _rank_meta_from_university(u: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(u, dict):
        return {}
    prov = u.get("fact_provenance")
    if not isinstance(prov, dict):
        return {}
    facts = prov.get("facts")
    if not isinstance(facts, dict):
        return {}
    rank_fact = facts.get("rank")
    if not isinstance(rank_fact, dict):
        return {}

    out = {
        "source": str(rank_fact.get("source") or ""),
        "source_url": str(rank_fact.get("source_url") or ""),
        "external_reference": str(rank_fact.get("external_reference") or ""),
        "status": str(rank_fact.get("status") or ""),
        "verified_at": str(rank_fact.get("verified_at") or ""),
        "is_official_external_rank": bool(rank_fact.get("is_official_external_rank")),
    }
    if not any(
        bool(str(v).strip()) for k, v in out.items() if k != "is_official_external_rank"
    ):
        return {}
    return out
