import hashlib
import json
import threading
import time
from collections import OrderedDict
from typing import Any, Literal

from app.core.redis_store import cache_get_json, cache_set_json
from app.core.settings import (
    AI_SORT_CACHE_TTL_SEC,
    REDIS_CACHE_TTL_SEC,
)
from app.schemas import (
    ProfiledUniversitiesRequest,
    UniversitiesAiSortRequest,
)
from app.schemas.payloads import to_profile_dict
from app.services import admissions_assessment, admissions_catalog
from app.services import ai_scoring as ai_scoring_service
from app.services import universities as uni_service
from fastapi import APIRouter, HTTPException, Path, Query, Request, Response

router = APIRouter()
_AI_SORT_CACHE_TTL_SEC = max(15.0, float(AI_SORT_CACHE_TTL_SEC))
_AI_SORT_CACHE_MAX_ITEMS = 512
_AI_SORT_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()
_AI_SORT_CACHE_LOCK = threading.Lock()


def _etag_matches(if_none_match: str, etag: str) -> bool:
    raw = str(if_none_match or "").strip()
    if not raw:
        return False
    if raw == "*":
        return True
    target = etag.strip()
    target_weak = f"W/{target}"
    candidates = [part.strip() for part in raw.split(",") if part.strip()]
    return target in candidates or target_weak in candidates


def _request_locale_hint(request: Request | None) -> str:
    if request is None:
        return ""
    raw = str(request.headers.get("accept-language", "")).strip()
    if not raw:
        return ""
    return raw.split(",")[0].strip().lower()


def _normalize_search_lang(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw.startswith("ru") or raw == "rus":
        return "rus"
    if raw.startswith("kk") or raw == "kaz":
        return "kaz"
    return "eng"


def _resolve_search_lang(explicit_lang: Any, request: Request | None) -> str:
    if str(explicit_lang or "").strip():
        return _normalize_search_lang(explicit_lang)
    return _normalize_search_lang(_request_locale_hint(request))


def _quantize_slider_value(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(round(float(val)))
    except (ValueError, TypeError):
        return None


def _ai_sort_cache_key(
    payload: UniversitiesAiSortRequest,
    search_lang: str | None = None,
) -> str:
    raw = payload.model_dump(exclude_none=True)
    raw["admissions_revision"] = admissions_catalog.get_revision()
    raw["assessment_revision"] = admissions_assessment.get_assessment_revision()
    raw.pop("lang", None)
    raw["search_lang"] = _normalize_search_lang(search_lang if search_lang is not None else payload.lang)
    raw.pop("page", None)
    raw.pop("limit", None)
    for field in (
        "practice_vs_science",
        "social_vs_hardcore",
        "budget_vs_prestige",
        "city_vs_campus",
    ):
        if field in raw:
            raw[field] = _quantize_slider_value(raw[field])
    profile = raw.get("profile")
    if isinstance(profile, dict):
        interests = str(profile.get("interests") or "").strip().lower()
        if interests:
            profile["interests"] = " ".join(interests.split())
    return json.dumps(raw, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def _ai_sort_cache_get(key: str) -> list[dict[str, Any]] | None:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        row = _AI_SORT_CACHE.get(key)
        if not row:
            return None
        if (now - float(row.get("ts", 0.0))) > _AI_SORT_CACHE_TTL_SEC:
            _AI_SORT_CACHE.pop(key, None)
            return None
        _AI_SORT_CACHE.move_to_end(key)
        return row.get("items")


def _ai_sort_cache_set(key: str, items: list[dict[str, Any]]) -> None:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        _AI_SORT_CACHE[key] = {
            "ts": now,
            "items": items,
        }
        _AI_SORT_CACHE.move_to_end(key)
        while len(_AI_SORT_CACHE) > _AI_SORT_CACHE_MAX_ITEMS:
            _AI_SORT_CACHE.popitem(last=False)


def _cache_key(namespace: str, payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{namespace}:{digest}"


@router.get("/universities", summary="List universities", description="Returns a paginated, filterable list of universities. Supports search, country/city/region filters, budget range, study level, funding type, and format filters.")
def list_universities(
    q: str | None = Query(None, max_length=200),
    country: str | None = Query(None, max_length=80),
    city: str | None = Query(None, max_length=80),
    region: str | None = Query(None, max_length=80),
    major: str | None = Query(None, max_length=120),
    study_level: str | None = Query(None, max_length=40),
    funding_type: str | None = Query(None, max_length=20),
    format: str | None = Query(None, max_length=32),
    min_tuition: float | None = Query(None, ge=0, le=1_000_000),
    max_tuition: float | None = Query(None, ge=0, le=1_000_000),
    cost_basis: Literal["annual_total", "tuition"] = Query("annual_total"),
    fee_status_context: Literal["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"] | None = Query(None),
    intended_entry_cycle: str | None = Query(None, max_length=40),
    sort: str = Query("name_asc", pattern="^(name_asc|tuition_asc|tuition_desc|acceptance_asc|acceptance_desc|rank_asc|rank_desc|relevance)$"),
    page: int = Query(1, ge=1, le=10_000),
    limit: int = Query(200, ge=1, le=2000),
    fields: str = Query("card", pattern="^(card|full)$"),
    lang: str | None = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    search_lang = _resolve_search_lang(lang, request)
    cache_payload = {
        "q": q,
        "admissions_revision": admissions_catalog.get_revision(),
        "country": country,
        "city": city,
        "region": region,
        "major": major,
        "study_level": study_level,
        "funding_type": funding_type,
        "format": format,
        "min_tuition": min_tuition,
        "max_tuition": max_tuition,
        "cost_basis": cost_basis,
        "fee_status_context": fee_status_context,
        "intended_entry_cycle": intended_entry_cycle,
        "sort": sort,
        "page": page,
        "limit": limit,
        "fields": fields,
        "search_lang": search_lang,
    }
    redis_cache_key = _cache_key("api:universities:list", cache_payload)

    cached = cache_get_json(redis_cache_key)
    if isinstance(cached, dict):
        if response is not None:
            response.headers["Cache-Control"] = "public, max-age=60"
            response.headers["X-Redis-Cache"] = "HIT"
        return cached

    result = uni_service.list_universities(
        q=q,
        country=country,
        city=city,
        region=region,
        major=major,
        study_level=study_level,
        funding_type=funding_type,
        format=format,
        min_tuition=min_tuition,
        max_tuition=max_tuition,
        cost_basis=cost_basis,
        fee_status_context=fee_status_context,
        intended_entry_cycle=intended_entry_cycle,
        sort=sort,
        page=page,
        limit=limit,
        response_mode=fields,
        search_lang=search_lang,
    )

    cache_set_json(redis_cache_key, result, ttl_seconds=max(1, int(REDIS_CACHE_TTL_SEC)))

    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=60"
        response.headers["X-Redis-Cache"] = "MISS"
    return result


@router.get(
    "/universities/map-points",
    summary="List university map points",
    description="Returns compact university coordinates inside the requested map bounds for client-side Leaflet clustering.",
)
def list_university_map_points(
    west: float = Query(..., ge=-180, le=180),
    south: float = Query(..., ge=-90, le=90),
    east: float = Query(..., ge=-180, le=180),
    north: float = Query(..., ge=-90, le=90),
    q: str | None = Query(None, max_length=200),
    country: str | None = Query(None, max_length=80),
    city: str | None = Query(None, max_length=80),
    region: str | None = Query(None, max_length=80),
    major: str | None = Query(None, max_length=120),
    study_level: str | None = Query(None, max_length=40),
    funding_type: str | None = Query(None, max_length=20),
    format: str | None = Query(None, max_length=32),
    min_tuition: float | None = Query(None, ge=0, le=1_000_000),
    max_tuition: float | None = Query(None, ge=0, le=1_000_000),
    cost_basis: Literal["annual_total", "tuition"] = Query("annual_total"),
    fee_status_context: Literal["unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"] | None = Query(None),
    intended_entry_cycle: str | None = Query(None, max_length=40),
    lang: str | None = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    if south > north:
        raise HTTPException(status_code=422, detail="south must not exceed north")

    search_lang = _resolve_search_lang(lang, request)
    cache_payload = {
        "west": round(west, 5),
        "admissions_revision": admissions_catalog.get_revision(),
        "south": round(south, 5),
        "east": round(east, 5),
        "north": round(north, 5),
        "q": q,
        "country": country,
        "city": city,
        "region": region,
        "major": major,
        "study_level": study_level,
        "funding_type": funding_type,
        "format": format,
        "min_tuition": min_tuition,
        "max_tuition": max_tuition,
        "cost_basis": cost_basis,
        "fee_status_context": fee_status_context,
        "intended_entry_cycle": intended_entry_cycle,
        "search_lang": search_lang,
    }
    redis_cache_key = _cache_key("api:universities:map-points", cache_payload)
    cached = cache_get_json(redis_cache_key)
    if isinstance(cached, dict):
        if response is not None:
            response.headers["Cache-Control"] = "public, max-age=60"
            response.headers["X-Redis-Cache"] = "HIT"
        return cached

    result = uni_service.list_universities(
        q=q,
        country=country,
        city=city,
        region=region,
        major=major,
        study_level=study_level,
        funding_type=funding_type,
        format=format,
        min_tuition=min_tuition,
        max_tuition=max_tuition,
        cost_basis=cost_basis,
        fee_status_context=fee_status_context,
        intended_entry_cycle=intended_entry_cycle,
        sort="rank_asc",
        page=1,
        limit=10_000,
        paginate=False,
        response_mode="map",
        search_lang=search_lang,
    )

    def is_in_bounds(item: dict[str, Any]) -> bool:
        coordinates = item.get("coordinates") if isinstance(item, dict) else None
        if not isinstance(coordinates, dict):
            return False
        try:
            lat = float(coordinates.get("lat"))
            lon = float(coordinates.get("lon"))
        except (TypeError, ValueError):
            return False
        longitude_matches = west <= lon <= east if west <= east else (lon >= west or lon <= east)
        return south <= lat <= north and longitude_matches

    bounded_items = [item for item in result.get("items", []) if is_in_bounds(item)]
    total = len(bounded_items)
    payload = {
        "items": bounded_items[:10_000],
        "count": min(total, 10_000),
        "total": total,
        "truncated": total > 10_000,
    }
    cache_set_json(redis_cache_key, payload, ttl_seconds=max(1, int(REDIS_CACHE_TTL_SEC)))
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=60"
        response.headers["X-Redis-Cache"] = "MISS"
    return payload


@router.post("/universities/profiled", summary="List universities with profile-based cost estimates")
def list_universities_profiled(payload: ProfiledUniversitiesRequest, request: Request, response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "private, no-store"
    return uni_service.list_universities(
        q=payload.q, country=payload.country, city=payload.city, region=payload.region,
        major=payload.major, study_level=payload.study_level, funding_type=payload.funding_type,
        format=payload.format, min_tuition=payload.min_tuition, max_tuition=payload.max_tuition,
        cost_basis=payload.cost_basis, sort=payload.sort, page=payload.page, limit=payload.limit,
        response_mode=payload.fields, search_lang=_resolve_search_lang(payload.lang, request),
        profile=to_profile_dict(payload.profile),
    )


@router.post("/universities/ai-sort", summary="AI-sorted university list (UniFit)", description="Sorts universities by profile fit using the UniFit algorithm. Considers exams, budget, interests, languages, and preference sliders to produce a personalized ranking.")
def list_universities_ai_sort(payload: UniversitiesAiSortRequest, request: Request, response: Response = None):
    profile = to_profile_dict(payload.profile)
    q = payload.q
    country = payload.country
    city = payload.city
    region = payload.region
    major = payload.major
    study_level = payload.study_level
    funding_type = payload.funding_type
    fmt = payload.format
    min_tuition = payload.min_tuition
    max_tuition = payload.max_tuition
    practice_vs_science = payload.practice_vs_science
    social_vs_hardcore = payload.social_vs_hardcore
    budget_vs_prestige = payload.budget_vs_prestige
    city_vs_campus = payload.city_vs_campus
    page = payload.page
    limit = payload.limit

    search_lang = _resolve_search_lang(payload.lang, request)
    cache_key = _ai_sort_cache_key(payload, search_lang)
    sorted_items = _ai_sort_cache_get(cache_key)
    cache_hit = sorted_items is not None

    if sorted_items is None:
        effective_profile = dict(profile)
        if major:
            effective_profile["major"] = major
        if study_level:
            effective_profile["study_level"] = study_level
        if fmt:
            effective_profile["studyMode"] = fmt

        base = uni_service.list_universities(
            q=q,
            country=country,
            city=city,
            region=region,
            major=None,
            study_level=effective_profile.get("study_level"),
            profile=effective_profile,
            funding_type=funding_type,
            format=fmt,
            min_tuition=min_tuition,
            max_tuition=max_tuition,
            cost_basis=payload.cost_basis,
            sort="name_asc",
            page=1,
            limit=200,
            paginate=False,
            response_mode="full",
            search_lang=search_lang,
            localize_output=False,
        )

        sorted_items = ai_scoring_service.sort_universities_ai(
            base.get("items", []),
            profile=effective_profile,
            practice_vs_science=practice_vs_science,
            social_vs_hardcore=social_vs_hardcore,
            budget_vs_prestige=budget_vs_prestige,
            city_vs_campus=city_vs_campus,
            funding_type=funding_type,
        )
        _ai_sort_cache_set(cache_key, sorted_items)

    total = len(sorted_items or [])
    start = (page - 1) * limit
    end = start + limit
    page_items = (sorted_items or [])[start:end] if start < total else []
    probe_items = page_items if page_items else ((sorted_items or [])[:1] if sorted_items else [])
    ml_unavailable = any(
        bool((row.get("matchData") or {}).get("mlUnavailable"))
        for row in probe_items
        if isinstance(row, dict)
    )
    warnings = ["Machine Learning unavailable"] if ml_unavailable else []

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
        response.headers["X-AI-Sort-Cache"] = "HIT" if cache_hit else "MISS"

    return {
        "items": [
            uni_service.to_university_card(
                row,
                format_preference=fmt,
                search_lang=search_lang,
            )
            for row in page_items
        ],
        "count": len(page_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": "uni_ai",
        "warnings": warnings,
    }


@router.get("/universities/translations", summary="University translation bundle", description="Returns localized university names, descriptions, tags, and program labels for the requested language.")
def get_universities_translations(
    lang: str | None = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    search_lang = _resolve_search_lang(lang, request)
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    return uni_service.get_university_translation_bundle(search_lang)


@router.get("/universities/{university_id}", summary="University detail", description="Returns full details for a single university, including admission categories, finance, programs, and student life. Supports ETag caching and language localization.")
def get_university(
    university_id: str = Path(..., min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$"),
    lang: str | None = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    search_lang = _resolve_search_lang(lang, request)
    u = uni_service.get_university_by_id(
        university_id,
        search_lang=search_lang,
        localized=True,
    )
    if u is None:
        raise HTTPException(status_code=404, detail="University not found")

    etag = uni_service.get_university_etag(university_id, search_lang=search_lang, payload=u)
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=120"
        response.headers["ETag"] = etag
        response.headers["Vary"] = "Accept-Language"

    request_if_none_match = request.headers.get("if-none-match", "") if request is not None else ""
    if _etag_matches(request_if_none_match, etag):
        return Response(status_code=304, headers={
            "Cache-Control": "public, max-age=300, stale-while-revalidate=120",
            "ETag": etag,
            "Vary": "Accept-Language",
        })

    return u


@router.get("/locations", summary="Available locations", description="Returns a tree of countries, regions, and cities that have universities in the catalog.")
def get_locations(response: Response = None):
    cached = cache_get_json("api:locations")
    if isinstance(cached, dict):
        if response is not None:
            response.headers["Cache-Control"] = "public, max-age=300"
            response.headers["X-Redis-Cache"] = "HIT"
        return cached

    data = uni_service.get_locations()
    cache_set_json("api:locations", data if isinstance(data, dict) else {}, ttl_seconds=300)
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
        response.headers["X-Redis-Cache"] = "MISS"
    return data
