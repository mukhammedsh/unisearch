"""Cost normalization, finance mode selection, entry cycles, and major matching."""

import re
from typing import Any

from app.core.utils import to_float as _to_num
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
from app.services.scoring_profile import _normalize_study_level_str, _track_study_mode
from app.services.university_tracks import _canonical_major, _iter_programs, _normalize_major_text


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _cost_to_usd(amount: float | None, currency_code: str) -> float:
    if amount is None or amount <= 0:
        return 0.0
    code = str(currency_code or "USD").strip().upper()
    if not code or code == "USD":
        return max(0.0, float(amount))
    try:
        from app.services.currency import convert
        return max(0.0, float(convert(amount, code, "USD")))
    except (ValueError, TypeError, LookupError):
        return max(0.0, float(amount))


def _university_matches_major(university: dict[str, Any], major: str) -> bool:
    target_major = str(major or "").strip()
    if not target_major or not isinstance(university, dict):
        return True
    m_exact = _canonical_major(target_major)
    m_raw = _normalize_major_text(target_major)
    academics = _as_dict(university.get("academics"))
    programs = _iter_programs(university)

    for p in programs:
        if not isinstance(p, dict):
            continue
        p_name = _normalize_major_text(p.get("name"))
        if m_raw and (p_name == m_raw or m_raw in p_name):
            return True
        p_tags = p.get("major_tags") or []
        if isinstance(p_tags, list):
            for tag in p_tags:
                tag_exact = _canonical_major(tag)
                if m_exact and tag_exact == m_exact:
                    return True
                if m_raw and _normalize_major_text(tag) == m_raw:
                    return True

    majors = academics.get("majors") or []
    if isinstance(majors, list):
        for m in majors:
            m_tag = _canonical_major(m)
            if m_exact and m_tag == m_exact:
                return True
            if m_raw and _normalize_major_text(m) == m_raw:
                return True

    major_tags = academics.get("major_tags") or []
    if isinstance(major_tags, list):
        for m in major_tags:
            m_tag = _canonical_major(m)
            if m_exact and m_tag == m_exact:
                return True
            if m_raw and _normalize_major_text(m) == m_raw:
                return True

    return False


def _finance_cost_range(finance: dict[str, Any]) -> dict[str, Any] | None:
    minimum = _to_num(finance.get("total_cost_year_min"))
    maximum = _to_num(finance.get("total_cost_year_max"))
    if minimum is None or maximum is None or minimum < 0 or maximum < minimum:
        return None
    return {
        "min": float(minimum),
        "max": float(maximum),
        "currency": str(finance.get("currency") or "").strip().upper() or None,
        "academic_year": finance.get("academic_year"),
        "source": finance.get("source"),
        "source_url": finance.get("source_url"),
        "source_urls": finance.get("source_urls"),
        "fee_status": finance.get("fee_status"),
        "scope": finance.get("scope"),
    }


def _finance_for_cost(university: dict[str, Any], track: dict[str, Any]) -> dict[str, Any]:
    track_fin = _as_dict(track.get("finance_override"))
    uni_fin = _as_dict(university.get("finance"))
    levels = _as_list(track.get("study_levels"))
    raw_scope = track.get("scope")
    scope = (
        " ".join(str(value or "") for value in raw_scope.values()).strip().lower()
        if isinstance(raw_scope, dict)
        else str(raw_scope or "").strip().lower()
    )
    scope_level = (
        _normalize_study_level_str(raw_scope.get("level"))
        if isinstance(raw_scope, dict)
        else _normalize_study_level_str(raw_scope)
    )
    graduate_track = (
        any(_normalize_study_level_str(level) in {"master", "mba", "doctorate"} for level in levels)
        or scope_level in {"master", "mba", "doctorate"}
        or scope.startswith(("graduate", "postgraduate", "doctoral"))
    )
    track_range = _finance_cost_range(track_fin)
    university_range = _finance_cost_range(uni_fin)
    total = _to_num(track_fin.get("total_cost_year_usd"))
    cost_range = track_range if total is None else None
    cost_cycle_source = track_fin if total is not None or cost_range is not None else {}
    if total is None and cost_range is None and not graduate_track:
        total = _to_num(uni_fin.get("total_cost_year_usd"))
        if total is None:
            cost_range = university_range
        if total is not None or cost_range is not None:
            cost_cycle_source = uni_fin
    known_currency = (
        track_fin.get("currency")
        or (track_range or {}).get("currency")
        or uni_fin.get("currency")
        or (university_range or {}).get("currency")
    )
    currency = str(known_currency or "USD").strip().upper()
    if cost_range and not cost_range.get("currency") and known_currency:
        cost_range = {**cost_range, "currency": currency}
    total_usd = _cost_to_usd(total, currency)
    breakdown = track_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict) and not graduate_track:
        breakdown = uni_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    return {
        "total": total_usd,
        "raw_total": total,
        "breakdown": breakdown,
        "track_finance": track_fin,
        "university_finance": uni_fin,
        "currency": currency,
        "unavailable": total is None and cost_range is None,
        "cost_range": cost_range,
        "cost_cycle_source": cost_cycle_source,
    }


def _track_cost_range_payload(university: dict[str, Any], track: dict[str, Any]) -> dict[str, Any] | None:
    finance = _finance_for_cost(university, track)
    cost_range = finance.get("cost_range")
    if not isinstance(cost_range, dict):
        return None
    currency = str(cost_range.get("currency") or "").strip().upper() or None
    minimum = float(cost_range["min"])
    maximum = float(cost_range["max"])
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
        "minNative": minimum,
        "maxNative": maximum,
        "currency": currency,
        "minUSD": minimum_usd,
        "maxUSD": maximum_usd,
        "academicYear": cost_range.get("academic_year"),
        "feeStatus": cost_range.get("fee_status"),
        "scope": cost_range.get("scope"),
        "source": cost_range.get("source"),
        "sourceUrl": cost_range.get("source_url"),
        "sourceUrls": cost_range.get("source_urls"),
    }


def _effective_cost_mode(preferred_mode: Any, track_mode: Any) -> str:
    pref = _normalize_study_mode(preferred_mode)
    if pref != "any":
        return pref
    mode = _normalize_study_mode(track_mode)
    return mode if mode != "any" else "on-campus"


def _effective_track_cost_details(
    university: dict[str, Any],
    track: dict[str, Any],
    preferred_mode: Any = "any",
    intended_entry_cycle: Any = None,
) -> tuple[float, float, str, str]:
    """
    Returns (cost_usd, cost_native, currency, cost_mode)
    """
    finance = _finance_for_cost(university, track)
    total_usd = float(finance.get("total") or 0.0)
    raw_total = float(_to_num(finance.get("raw_total")) or 0.0)
    breakdown = _as_dict(finance.get("breakdown"))
    tuition = _extract_tuition_cost(breakdown)
    mode = _effective_cost_mode(preferred_mode, _track_study_mode(university, track))
    track_fin = _as_dict(finance.get("track_finance"))
    uni_fin = _as_dict(finance.get("university_finance"))
    currency = str(finance.get("currency") or "USD").strip().upper()

    if _cost_cycle_mismatch(finance.get("cost_cycle_source"), intended_entry_cycle):
        return 0.0, 0.0, currency, "unavailable"

    if mode == "on-campus":
        cost_range = finance.get("cost_range")
        if isinstance(cost_range, dict):
            max_native = float(cost_range["max"])
            return _cost_to_usd(max_native, currency), max_native, currency, "on-campus_range"
        if finance.get("unavailable"):
            return 0.0, 0.0, currency, "unavailable"
        return max(0.0, total_usd), max(0.0, raw_total), currency, "on-campus_exact"

    if mode == "online":
        for source in (track_fin, uni_fin):
            mode_breakdown = _mode_breakdown_from_finance(source, "online")
            mode_tuition = _extract_tuition_cost(mode_breakdown if isinstance(mode_breakdown, dict) else {})
            if mode_tuition is not None and mode_tuition >= 0:
                cost_native = float(mode_tuition)
                return _cost_to_usd(cost_native, currency), cost_native, currency, "online_tuition_only"
        if tuition is not None and tuition >= 0:
            cost_native = float(tuition)
            return _cost_to_usd(cost_native, currency), cost_native, currency, "online_tuition_only"
        for source in (track_fin, uni_fin):
            mode_total = _mode_total_from_finance(source, "online")
            if mode_total is not None and mode_total >= 0:
                cost_native = float(mode_total)
                return _cost_to_usd(cost_native, currency), cost_native, currency, "online_mode_total"
        return 0.0, 0.0, currency, "online_missing_tuition"

    return max(0.0, total_usd), max(0.0, raw_total), currency, "on-campus_exact"


def _entry_cycle_parts(value: Any) -> tuple[int | None, str | None] | None:
    text = " ".join(str(value or "").strip().casefold().replace("–", "-").replace("—", "-").split())
    if not text:
        return None
    if re.search(r"\b20\d{2}\s*[-/]\s*\d{2,4}\b", text):
        return (None, None)
    years = re.findall(r"(?<!\d)(20\d{2})(?!\d)", text)
    # Academic-year ranges can refer to an application cycle or an entry year;
    # without a more specific schema field their relationship is unknown.
    if len(set(years)) != 1:
        return (None, None)
    year = int(years[0]) if years else None
    seasons = [
        season for season, pattern in (
            ("spring", r"\bspring\b"),
            ("summer", r"\b(?:summer)\b"),
            ("fall", r"\b(?:fall|autumn)\b"),
            ("winter", r"\bwinter\b"),
        ) if re.search(pattern, text)
    ]
    if len(seasons) > 1:
        return (None, None)
    if year is None and not seasons:
        return (None, None)
    return (year, seasons[0] if seasons else None)


def _cost_cycle_mismatch(cost_source: Any, intended_entry_cycle: Any) -> bool:
    target = _entry_cycle_parts(intended_entry_cycle)
    if not isinstance(cost_source, dict) or not target or target[0] is None:
        return False
    cycle = cost_source.get("academic_year") or cost_source.get("cycle") or cost_source.get("tuition_cycle")
    if not cycle:
        cost_range = cost_source.get("cost_range")
        cycle = cost_range.get("academic_year") if isinstance(cost_range, dict) else None
    text = " ".join(str(cycle or "").strip().casefold().replace("–", "-").replace("—", "-").split())
    if not text:
        return False
    range_match = re.search(r"\b(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})\b", text)
    if range_match:
        start = int(range_match.group(1))
        end_text = range_match.group(2)
        end = int(end_text) if len(end_text) == 4 else (start // 100) * 100 + int(end_text)
        if end < start:
            end += 100
        target_year, target_season = target
        if target_season == "spring":
            return target_year != end
        if target_season == "summer":
            return target_year not in {start, end}
        if target_season == "winter":
            return False
        return target_year != start
    years = re.findall(r"(?<!\d)(20\d{2})(?!\d)", text)
    return len(set(years)) == 1 and int(years[0]) != target[0]
