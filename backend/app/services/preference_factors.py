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
- Location (``city_vs_campus``): population on the OECD functional-urban-area size classes, on a log scale between
  the 50,000 minimum urban-area size (1.0, outside a city) and the 1.5 million large-metropolitan threshold (0.0).
  The stored figure is the city's own population, which understates a campus town inside a larger metropolitan area.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple

RESEARCH_INTENSITY_ANCHORS: Tuple[float, float] = (0.1, 30.0)
APPLICANTS_PER_PLACE_ANCHORS: Tuple[float, float] = (1.0, 40.0)
URBAN_AREA_POPULATION_ANCHORS: Tuple[float, float] = (50_000.0, 1_500_000.0)

GRADUATE_LEVELS = {"master", "mba", "doctorate"}


def _number(value: Any) -> Optional[float]:
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


def _raw_metrics(university: Dict[str, Any]) -> Dict[str, Any]:
    meta = university.get("factors_meta")
    metrics = meta.get("raw_metrics") if isinstance(meta, dict) else None
    return metrics if isinstance(metrics, dict) else {}


def research_intensity(university: Dict[str, Any]) -> Optional[float]:
    openalex = _raw_metrics(university).get("openalex")
    works = _number(openalex.get("works_count")) if isinstance(openalex, dict) else None
    students = _number(university.get("student_count"))
    # Zero works means the OpenAlex record was not matched to the institution, not that it publishes nothing.
    if works is None or works <= 0 or students is None or students <= 0:
        return None
    return round(log_position(works / students, *RESEARCH_INTENSITY_ANCHORS), 4)


def admission_rate_percent(university: Dict[str, Any]) -> Optional[float]:
    """Published first-year admission (or offer) rate: the reviewed statistics first, then the earlier field."""
    stats = university.get("admission_statistics")
    rate = _number(stats.get("rate_percent")) if isinstance(stats, dict) else None
    if rate is None:
        academics = university.get("academics")
        rate = _number(academics.get("acceptance_rate_percent")) if isinstance(academics, dict) else None
    return rate if rate is not None and 0 < rate <= 100 else None


def selectivity(university: Dict[str, Any], study_level: str = "any") -> Optional[float]:
    if study_level in GRADUATE_LEVELS:
        return None
    rate = admission_rate_percent(university)
    if rate is None:
        return None
    return round(log_position(100.0 / rate, *APPLICANTS_PER_PLACE_ANCHORS), 4)


def location(university: Dict[str, Any]) -> Optional[float]:
    city = _raw_metrics(university).get("city")
    city = city if isinstance(city, dict) else {}
    population = _number(city.get("population"))
    if population is None:
        population = _number(city.get("population_wikidata_fallback"))
    if population is None:
        population = _number(city.get("population_official_fallback"))
    if population is None or population <= 0:
        return None
    return round(1.0 - log_position(population, *URBAN_AREA_POPULATION_ANCHORS), 4)
