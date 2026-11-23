"""University indicators for the UniFit preference sliders.

Each indicator sits on a fixed 0..1 scale whose anchors are stated below, so a university's value does not move when
other universities enter or leave the catalog. An indicator is ``None`` when its source data is missing; callers must
leave that slider out for the university instead of substituting a neutral value.

- Research focus (``practice_vs_science``): OpenAlex works per enrolled student, on a log scale from 0.1 (teaching
  focus) to 30 (research-intensive). Dividing by enrolment keeps a large university from reading as research-focused
  only because of its size.
- Selectivity (``social_vs_hardcore``, kept as the API identifier): applicants per admitted or offered place from the
  published admission rate, on a log scale from 1 (everyone admitted) to 40 (a 2.5% admission rate). It describes
  first-year undergraduate entry, so it is unknown for graduate study levels.
- Location (``city_vs_campus``): population of the university's urban area on the OECD functional-urban-area size
  classes, on a log scale between the 50,000 minimum urban-area size (1.0, outside a city) and the 1.5 million
  large-metropolitan threshold (0.0). The urban-area figure (OECD FUA or national statistics) is preferred; the city's
  own population is the fallback, which understates a campus town inside a larger metropolitan area.
- Cost vs prestige (``budget_vs_prestige``): the mean of the annual cost in USD on a log scale from $1,000 to
  $100,000 and the official rank on a log scale from 1 (1.0) to 1,000 (0.0), using whichever parts are known.
"""

from __future__ import annotations

import math
from typing import Any

RESEARCH_INTENSITY_ANCHORS: tuple[float, float] = (0.1, 30.0)
APPLICANTS_PER_PLACE_ANCHORS: tuple[float, float] = (1.0, 40.0)
URBAN_AREA_POPULATION_ANCHORS: tuple[float, float] = (50_000.0, 1_500_000.0)
ANNUAL_COST_USD_ANCHORS: tuple[float, float] = (1_000.0, 100_000.0)
RANK_ANCHORS: tuple[float, float] = (1.0, 1_000.0)

GRADUATE_LEVELS = {"master", "mba", "doctorate"}


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def log_position(value: float, low: float, high: float) -> float:
    """Position of ``value`` between ``low`` (0.0) and ``high`` (1.0) on a log scale, clamped to 0..1."""
    position = (math.log(value) - math.log(low)) / (math.log(high) - math.log(low))
    return max(0.0, min(1.0, position))


def _raw_metrics(university: dict[str, Any]) -> dict[str, Any]:
    meta = university.get("factors_meta")
    metrics = meta.get("raw_metrics") if isinstance(meta, dict) else None
    return metrics if isinstance(metrics, dict) else {}


def research_intensity(university: dict[str, Any]) -> float | None:
    openalex = _raw_metrics(university).get("openalex")
    works = _number(openalex.get("works_count")) if isinstance(openalex, dict) else None
    students = _number(university.get("student_count"))
    # Zero works means the OpenAlex record was not matched to the institution, not that it publishes nothing.
    if works is None or works <= 0 or students is None or students <= 0:
        return None
    return round(log_position(works / students, *RESEARCH_INTENSITY_ANCHORS), 4)


def admission_rate_percent(university: dict[str, Any]) -> float | None:
    """Published first-year admission (or offer) rate: the reviewed statistics first, then the earlier field."""
    stats = university.get("admission_statistics")
    rate = _number(stats.get("rate_percent")) if isinstance(stats, dict) else None
    if rate is None:
        academics = university.get("academics")
        rate = _number(academics.get("acceptance_rate_percent")) if isinstance(academics, dict) else None
    return rate if rate is not None and 0 < rate <= 100 else None


def selectivity(university: dict[str, Any], study_level: str = "any") -> float | None:
    if study_level in GRADUATE_LEVELS:
        return None
    rate = admission_rate_percent(university)
    if rate is None:
        return None
    return round(log_position(100.0 / rate, *APPLICANTS_PER_PLACE_ANCHORS), 4)


def location(university: dict[str, Any]) -> float | None:
    metrics = _raw_metrics(university)
    urban_area = metrics.get("urban_area")
    population = _number(urban_area.get("population")) if isinstance(urban_area, dict) else None
    city = metrics.get("city")
    city = city if isinstance(city, dict) else {}
    if population is None:
        population = _number(city.get("population_official_fallback"))
    if population is None:
        population = _number(city.get("population"))
    if population is None:
        population = _number(city.get("population_wikidata_fallback"))
    if population is None or population <= 0:
        return None
    return round(1.0 - log_position(population, *URBAN_AREA_POPULATION_ANCHORS), 4)


def official_rank(university: dict[str, Any]) -> float | None:
    meta = university.get("rank_meta")
    if not isinstance(meta, dict) or str(meta.get("status") or "").strip().lower() != "official":
        return None
    rank = _number(university.get("rank"))
    return rank if rank is not None and rank >= 1 else None


def cost_vs_prestige(university: dict[str, Any], annual_cost_usd: float | None = None) -> float | None:
    """Mean of the known cost and rank positions; ``annual_cost_usd`` overrides the earlier finance field."""
    if annual_cost_usd is None:
        finance = university.get("finance")
        annual_cost_usd = _number(finance.get("total_cost_year_usd")) if isinstance(finance, dict) else None
        currency = str((finance or {}).get("currency") or "USD").strip().upper() if isinstance(finance, dict) else "USD"
        if annual_cost_usd is not None and currency != "USD":
            from app.services.currency import convert

            try:
                annual_cost_usd = _number(convert(annual_cost_usd, currency, "USD"))
            except ValueError:
                annual_cost_usd = None
    parts = []
    if annual_cost_usd is not None and annual_cost_usd > 0:
        parts.append(log_position(annual_cost_usd, *ANNUAL_COST_USD_ANCHORS))
    rank = official_rank(university)
    if rank is not None:
        parts.append(1.0 - log_position(rank, *RANK_ANCHORS))
    return round(sum(parts) / len(parts), 4) if parts else None
