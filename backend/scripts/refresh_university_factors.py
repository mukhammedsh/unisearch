#!/usr/bin/env python3
"""Refresh university slider factors from traceable external sources.

Sources:
- OpenAlex Institutions API: research activity metrics.
- Open-Meteo Geocoding API: city population.

The script updates:
- `factors` (0.0..1.0 values used by UniFit sliders)
- `factors_meta` (provenance, source URLs, and raw metrics)
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
import time
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[2]
UNIVERSITIES_PATH = ROOT / "backend" / "data" / "universities.json"

OPENALEX_BASE = "https://api.openalex.org/institutions"
OPEN_METEO_BASE = "https://geocoding-api.open-meteo.com/v1/search"
WIKIDATA_SPARQL_BASE = "https://query.wikidata.org/sparql"

COUNTRY_CODE_MAP = {
    "USA": "US",
    "UK": "GB",
    "Switzerland": "CH",
    "Singapore": "SG",
    "Germany": "DE",
    "Canada": "CA",
    "Hong Kong": "HK",
    "Japan": "JP",
    "South Korea": "KR",
    "Netherlands": "NL",
    "China": "CN",
    "Kazakhstan": "KZ",
    "Australia": "AU",
}

COUNTRY_WIKIDATA_QID_MAP = {
    "USA": "Q30",
    "UK": "Q145",
    "Switzerland": "Q39",
    "Singapore": "Q334",
    "Germany": "Q183",
    "Canada": "Q16",
    "Hong Kong": "Q8646",
    "Japan": "Q17",
    "South Korea": "Q884",
    "Netherlands": "Q55",
    "China": "Q148",
    "Kazakhstan": "Q232",
    "Australia": "Q408",
}


def _http_get_json(url: str, timeout_sec: float = 25.0) -> Dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "UniSearchFactorRefresh/1.0 (+https://github.com)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:  # noqa: S310
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _safe_num(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        out = float(value)
        if math.isfinite(out):
            return out
    except Exception:
        return None
    return None


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _norm_name(value: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", " ", str(value or ""))
    cleaned = cleaned.lower()
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(a=_norm_name(a), b=_norm_name(b)).ratio()


def _haversine_km(
    lat1: Optional[float],
    lon1: Optional[float],
    lat2: Optional[float],
    lon2: Optional[float],
) -> Optional[float]:
    if None in (lat1, lon1, lat2, lon2):
        return None
    p = math.pi / 180.0
    phi1 = float(lat1) * p
    phi2 = float(lat2) * p
    dphi = (float(lat2) - float(lat1)) * p
    dlambda = (float(lon2) - float(lon1)) * p
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 6371.0 * (2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a)))


def _minmax(values: Iterable[Optional[float]], default: float = 0.5) -> List[float]:
    vals = [v for v in values if v is not None]
    if not vals:
        return [default for _ in values]
    lo = min(vals)
    hi = max(vals)
    if hi - lo < 1e-9:
        return [default if v is None else 0.5 for v in values]
    out: List[float] = []
    for v in values:
        if v is None:
            out.append(default)
            continue
        out.append((float(v) - lo) / (hi - lo))
    return out


def _average_acceptance_percent(university: Dict[str, Any]) -> Optional[float]:
    academics = university.get("academics")
    academics = academics if isinstance(academics, dict) else {}
    direct = _safe_num(academics.get("acceptance_rate_percent"))
    if direct is not None:
        return max(0.0, min(100.0, float(direct)))

    programs = academics.get("programs")
    if not isinstance(programs, list):
        return None
    vals: List[float] = []
    for row in programs:
        if not isinstance(row, dict):
            continue
        v = _safe_num(row.get("acceptance_rate_percent"))
        if v is not None:
            vals.append(max(0.0, min(100.0, float(v))))
    if not vals:
        return None
    return sum(vals) / len(vals)


def _openalex_candidate_score(
    candidate: Dict[str, Any],
    *,
    target_name: str,
    target_country_code: str,
    target_lat: Optional[float],
    target_lon: Optional[float],
) -> float:
    score = 0.0
    cand_name = str(candidate.get("display_name") or "")
    score += 0.70 * _name_similarity(target_name, cand_name)

    cand_country = str(candidate.get("country_code") or "").upper()
    if target_country_code and cand_country == target_country_code:
        score += 0.20

    geo = candidate.get("geo")
    geo = geo if isinstance(geo, dict) else {}
    c_lat = _safe_num(geo.get("latitude"))
    c_lon = _safe_num(geo.get("longitude"))
    dist = _haversine_km(target_lat, target_lon, c_lat, c_lon)
    if dist is not None:
        score += 0.10 * max(0.0, 1.0 - (dist / 120.0))

    return score


def _fetch_openalex_institution(
    university: Dict[str, Any],
) -> Tuple[Optional[Dict[str, Any]], str]:
    name = str(university.get("name") or "").strip()
    location = university.get("location")
    location = location if isinstance(location, dict) else {}
    country_code = COUNTRY_CODE_MAP.get(str(location.get("country") or "").strip(), "")
    coords = university.get("coordinates")
    coords = coords if isinstance(coords, dict) else {}
    lat = _safe_num(coords.get("lat"))
    lon = _safe_num(coords.get("lon"))

    cleaned = re.sub(r"\([^)]*\)", "", name).strip() or name
    query_candidates = [cleaned, re.sub(r"^the\s+", "", cleaned, flags=re.IGNORECASE), name]
    query_candidates = [q for i, q in enumerate(query_candidates) if q and q not in query_candidates[:i]]

    best_row: Optional[Dict[str, Any]] = None
    best_url = ""
    best_score = -1.0
    for query_name in query_candidates:
        params = {"search": query_name, "per-page": "8"}
        url = f"{OPENALEX_BASE}?{urllib.parse.urlencode(params)}"
        payload = _http_get_json(url)
        results = payload.get("results")
        results = results if isinstance(results, list) else []
        for result in results:
            if not isinstance(result, dict):
                continue
            score = _openalex_candidate_score(
                result,
                target_name=name,
                target_country_code=country_code,
                target_lat=lat,
                target_lon=lon,
            )
            if score > best_score:
                best_score = score
                best_row = result
                best_url = url

    return best_row, best_url


def _open_meteo_candidate_score(
    candidate: Dict[str, Any],
    *,
    state: str,
    target_lat: Optional[float],
    target_lon: Optional[float],
) -> float:
    score = 0.0
    population = _safe_num(candidate.get("population"))
    if population is not None:
        score += min(0.15, math.log1p(population) / 100.0)

    c_lat = _safe_num(candidate.get("latitude"))
    c_lon = _safe_num(candidate.get("longitude"))
    dist = _haversine_km(target_lat, target_lon, c_lat, c_lon)
    if dist is not None:
        score += 0.75 * max(0.0, 1.0 - (dist / 120.0))

    admin1 = str(candidate.get("admin1") or "").strip().lower()
    if state and state.lower() in admin1:
        score += 0.10
    return score


def _fetch_city_population(
    university: Dict[str, Any],
) -> Tuple[Optional[Dict[str, Any]], str]:
    location = university.get("location")
    location = location if isinstance(location, dict) else {}
    city = str(location.get("city") or "").strip()
    state = str(location.get("state") or "").strip()
    country_code = COUNTRY_CODE_MAP.get(str(location.get("country") or "").strip(), "")
    coords = university.get("coordinates")
    coords = coords if isinstance(coords, dict) else {}
    lat = _safe_num(coords.get("lat"))
    lon = _safe_num(coords.get("lon"))

    params = {
        "name": city,
        "count": "10",
        "language": "en",
        "format": "json",
    }
    if country_code:
        params["countryCode"] = country_code
    url = f"{OPEN_METEO_BASE}?{urllib.parse.urlencode(params)}"

    payload = _http_get_json(url)
    results = payload.get("results")
    results = results if isinstance(results, list) else []
    if not results:
        return None, url

    scored = sorted(
        results,
        key=lambda row: _open_meteo_candidate_score(
            row if isinstance(row, dict) else {},
            state=state,
            target_lat=lat,
            target_lon=lon,
        ),
        reverse=True,
    )
    best = scored[0] if scored and isinstance(scored[0], dict) else None
    return best, url


def _fetch_city_population_wikidata(
    university: Dict[str, Any],
) -> Tuple[Optional[float], str]:
    location = university.get("location")
    location = location if isinstance(location, dict) else {}
    city = str(location.get("city") or "").strip()
    country = str(location.get("country") or "").strip()
    country_qid = COUNTRY_WIKIDATA_QID_MAP.get(country, "")
    if not city or not country_qid:
        return None, ""

    city_escaped = city.replace("\\", "\\\\").replace('"', '\\"')
    query = (
        "SELECT ?population WHERE {\n"
        f'  ?city rdfs:label "{city_escaped}"@en;\n'
        f"        wdt:P17 wd:{country_qid}.\n"
        "  OPTIONAL { ?city wdt:P1082 ?population. }\n"
        "}\n"
        "LIMIT 10"
    )
    url = f"{WIKIDATA_SPARQL_BASE}?{urllib.parse.urlencode({'format': 'json', 'query': query})}"

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "UniSearchFactorRefresh/1.0 (+https://github.com)",
            "Accept": "application/sparql-results+json",
        },
    )
    with urllib.request.urlopen(req, timeout=30.0) as resp:  # noqa: S310
        payload = json.loads(resp.read().decode("utf-8"))
    bindings = (((payload.get("results") or {}).get("bindings")) if isinstance(payload, dict) else None) or []

    best_val = None
    for row in bindings:
        if not isinstance(row, dict):
            continue
        pop = _safe_num(((row.get("population") or {}).get("value")))
        if pop is None:
            continue
        if best_val is None or pop > best_val:
            best_val = pop
    return best_val, url


def _research_signal(openalex: Optional[Dict[str, Any]]) -> Optional[float]:
    if not isinstance(openalex, dict):
        return None
    works = _safe_num(openalex.get("works_count"))
    cited = _safe_num(openalex.get("cited_by_count"))
    summary = openalex.get("summary_stats")
    summary = summary if isinstance(summary, dict) else {}
    h_index = _safe_num(summary.get("h_index"))

    components = []
    if cited is not None:
        components.append(0.50 * math.log1p(cited))
    if works is not None:
        components.append(0.35 * math.log1p(works))
    if h_index is not None:
        components.append(0.15 * math.log1p(h_index))
    if not components:
        return None
    return float(sum(components))


def _median(values: Iterable[Optional[float]], default: float = 0.5) -> float:
    vals = sorted(float(v) for v in values if v is not None)
    if not vals:
        return default
    mid = len(vals) // 2
    if len(vals) % 2 == 1:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2.0


def main() -> None:
    universities = json.loads(UNIVERSITIES_PATH.read_text(encoding="utf-8"))
    if not isinstance(universities, list):
        raise RuntimeError(f"Unexpected JSON shape in {UNIVERSITIES_PATH}")

    now_iso = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    staged: List[Dict[str, Any]] = []

    print(f"Refreshing factors for {len(universities)} universities...")
    for idx, university in enumerate(universities, start=1):
        if not isinstance(university, dict):
            continue
        uni_id = str(university.get("id") or f"idx-{idx}")
        print(f"[{idx:02d}/{len(universities):02d}] {uni_id}")

        openalex_row = None
        openalex_url = ""
        geocode_row = None
        geocode_url = ""
        wikidata_population = None
        wikidata_url = ""

        try:
            openalex_row, openalex_url = _fetch_openalex_institution(university)
        except Exception as exc:
            print(f"  OpenAlex lookup failed: {exc}")
        time.sleep(0.12)

        try:
            geocode_row, geocode_url = _fetch_city_population(university)
        except Exception as exc:
            print(f"  Open-Meteo lookup failed: {exc}")
        time.sleep(0.12)

        finance = university.get("finance")
        finance = finance if isinstance(finance, dict) else {}
        acceptance = _average_acceptance_percent(university)
        tuition = _safe_num(finance.get("total_cost_year_usd"))
        research = _research_signal(openalex_row)
        population = _safe_num((geocode_row or {}).get("population"))
        if population is None:
            try:
                wikidata_population, wikidata_url = _fetch_city_population_wikidata(university)
                population = _safe_num(wikidata_population)
            except Exception as exc:
                print(f"  Wikidata population lookup failed: {exc}")
            time.sleep(0.12)

        staged.append(
            {
                "university": university,
                "openalex": openalex_row,
                "openalex_url": openalex_url,
                "geocode": geocode_row,
                "geocode_url": geocode_url,
                "acceptance": acceptance,
                "tuition": tuition,
                "research": research,
                "population": population,
                "wikidata_population": wikidata_population,
                "wikidata_url": wikidata_url,
            }
        )

    research_default = _median((row.get("research") for row in staged), default=0.5)
    population_default = _median((row.get("population") for row in staged), default=500_000.0)
    tuition_default = _median((row.get("tuition") for row in staged), default=0.0)
    strictness_default = 0.5

    research_values = [row.get("research", research_default) for row in staged]
    population_values = [row.get("population", population_default) for row in staged]
    tuition_values = [row.get("tuition", tuition_default) for row in staged]
    strictness_values = [
        (
            _clamp01(1.0 - (float(row["acceptance"]) / 100.0))
            if row.get("acceptance") is not None
            else strictness_default
        )
        for row in staged
    ]

    research_norm = _minmax(
        [v if v is not None else research_default for v in research_values],
        default=0.5,
    )
    population_norm = _minmax(
        [v if v is not None else population_default for v in population_values],
        default=0.5,
    )
    tuition_norm = _minmax(
        [v if v is not None else tuition_default for v in tuition_values],
        default=0.5,
    )

    for idx, row in enumerate(staged):
        university = row["university"]
        focus = _clamp01(research_norm[idx])
        atmosphere = _clamp01((0.70 * strictness_values[idx]) + (0.30 * research_norm[idx]))
        finance = _clamp01((0.60 * tuition_norm[idx]) + (0.40 * research_norm[idx]))
        location = _clamp01(1.0 - population_norm[idx])

        openalex = row.get("openalex")
        openalex = openalex if isinstance(openalex, dict) else {}
        geocode = row.get("geocode")
        geocode = geocode if isinstance(geocode, dict) else {}

        university["factors"] = {
            "practice_vs_science": round(focus, 4),
            "social_vs_hardcore": round(atmosphere, 4),
            "budget_vs_prestige": round(finance, 4),
            "city_vs_campus": round(location, 4),
        }
        university["factors_meta"] = {
            "version": "internet_v1",
            "computed_at": now_iso,
            "method": (
                "Deterministic mapping from OpenAlex (research metrics), "
                "Open-Meteo geocoding (city population), admissions selectivity, and tuition."
            ),
            "source_urls": {
                "openalex_query": row.get("openalex_url", ""),
                "open_meteo_query": row.get("geocode_url", ""),
                "wikidata_population_query": row.get("wikidata_url", ""),
            },
            "raw_metrics": {
                "openalex": {
                    "id": openalex.get("id"),
                    "display_name": openalex.get("display_name"),
                    "country_code": openalex.get("country_code"),
                    "works_count": openalex.get("works_count"),
                    "cited_by_count": openalex.get("cited_by_count"),
                    "h_index": (openalex.get("summary_stats") or {}).get("h_index")
                    if isinstance(openalex.get("summary_stats"), dict)
                    else None,
                },
                "city": {
                    "name": geocode.get("name"),
                    "country_code": geocode.get("country_code"),
                    "admin1": geocode.get("admin1"),
                    "population": geocode.get("population"),
                    "population_wikidata_fallback": row.get("wikidata_population"),
                },
                "admissions_acceptance_percent_avg": row.get("acceptance"),
                "total_cost_year_usd": row.get("tuition"),
                "derived_signals": {
                    "research_signal_raw": row.get("research"),
                    "strictness_0_1": round(strictness_values[idx], 6),
                    "research_norm_0_1": round(research_norm[idx], 6),
                    "tuition_norm_0_1": round(tuition_norm[idx], 6),
                    "city_population_norm_0_1": round(population_norm[idx], 6),
                },
            },
        }

    UNIVERSITIES_PATH.write_text(
        json.dumps(universities, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    matched_openalex = sum(1 for row in staged if isinstance(row.get("openalex"), dict))
    matched_population = sum(
        1
        for row in staged
        if (
            _safe_num(((row.get("geocode") or {}).get("population"))) is not None
            or _safe_num(row.get("wikidata_population")) is not None
        )
    )
    print("")
    print(f"Updated: {UNIVERSITIES_PATH}")
    print(f"OpenAlex matches: {matched_openalex}/{len(staged)}")
    print(f"City population matches (Open-Meteo/Wikidata): {matched_population}/{len(staged)}")


if __name__ == "__main__":
    main()
