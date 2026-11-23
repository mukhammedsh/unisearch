import hashlib
import json
import threading
import time
from collections import OrderedDict
from typing import Annotated, TypedDict

from app.core.http_cache import apply_etag_or_not_modified, resolve_search_lang
from app.core.redis_store import cache_get_json, cache_set_json
from app.core.settings import (
    AI_SORT_CACHE_TTL_SEC,
    REDIS_CACHE_TTL_SEC,
)
from app.core.utils import normalize_search_lang
from app.routers._params import LangQuery, UniversityFilterDep, UniversityIdPath
from app.schemas import (
    ProfiledUniversitiesRequest,
    UniversitiesAiSortRequest,
)
from app.schemas.payloads import to_profile_dict
from app.services import admissions_assessment, admissions_catalog
from app.services import ai_scoring as ai_scoring_service
from app.services import universities as uni_service
from fastapi import APIRouter, HTTPException, Query, Request, Response


class _AiSortCacheEntry(TypedDict):
    ts: float
    items: list[dict[str, object]]


router = APIRouter()
_AI_SORT_CACHE_TTL_SEC = max(15.0, float(AI_SORT_CACHE_TTL_SEC))
_AI_SORT_CACHE_MAX_ITEMS = 512
_AI_SORT_CACHE: OrderedDict[str, _AiSortCacheEntry] = OrderedDict()
_AI_SORT_CACHE_LOCK = threading.Lock()


def _quantize_slider_value(val: object) -> int | None:
    if val is None:
        return None
    try:
        return int(round(float(val)))  # type: ignore[arg-type]
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
    raw["search_lang"] = normalize_search_lang(search_lang if search_lang is not None else payload.lang)
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


def _ai_sort_cache_get(key: str) -> list[dict[str, object]] | None:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        row = _AI_SORT_CACHE.get(key)
        if not row:
            return None
        if (now - float(row["ts"])) > _AI_SORT_CACHE_TTL_SEC:
            _AI_SORT_CACHE.pop(key, None)
            return None
        _AI_SORT_CACHE.move_to_end(key)
        return row["items"]


def _ai_sort_cache_set(key: str, items: list[dict[str, object]]) -> None:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        _AI_SORT_CACHE[key] = {
            "ts": now,
            "items": items,
        }
        _AI_SORT_CACHE.move_to_end(key)
        while len(_AI_SORT_CACHE) > _AI_SORT_CACHE_MAX_ITEMS:
            _AI_SORT_CACHE.popitem(last=False)


def _cache_key(namespace: str, payload: dict[str, object]) -> str:
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{namespace}:{digest}"


@router.get("/universities", summary="List universities", description="Returns a paginated, filterable list of universities. Supports search, country/city/region filters, budget range, study level, funding type, and format filters.")
def list_universities(
    filters: UniversityFilterDep,
    request: Request,
    response: Response,
    sort: Annotated[
        str,
        Query(pattern="^(name_asc|tuition_asc|tuition_desc|acceptance_asc|acceptance_desc|rank_asc|rank_desc|relevance)$"),
    ] = "name_asc",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    limit: Annotated[int, Query(ge=1, le=2000)] = 200,
    fields: Annotated[str, Query(pattern="^(card|full)$")] = "card",
):
    search_lang = resolve_search_lang(filters.lang, request)
    filter_kwargs = filters.model_dump(exclude={"lang"})
    cache_payload = {
        **filter_kwargs,
        "admissions_revision": admissions_catalog.get_revision(),
        "sort": sort,
        "page": page,
        "limit": limit,
        "fields": fields,
        "search_lang": search_lang,
    }
    redis_cache_key = _cache_key("api:universities:list", cache_payload)

    cached = cache_get_json(redis_cache_key)
    if isinstance(cached, dict):
        response.headers["Cache-Control"] = "public, max-age=60"
        response.headers["X-Redis-Cache"] = "HIT"
        return cached

    result = uni_service.list_universities(
        **filter_kwargs,
        sort=sort,
        page=page,
        limit=limit,
        response_mode=fields,
        search_lang=search_lang,
    )

    cache_set_json(redis_cache_key, result, ttl_seconds=max(1, int(REDIS_CACHE_TTL_SEC)))

    response.headers["Cache-Control"] = "public, max-age=60"
    response.headers["X-Redis-Cache"] = "MISS"
    return result


@router.get(
    "/universities/map-points",
    summary="List university map points",
    description="Returns compact university coordinates inside the requested map bounds for client-side Leaflet clustering.",
)
def list_university_map_points(
    west: Annotated[float, Query(ge=-180, le=180)],
    south: Annotated[float, Query(ge=-90, le=90)],
    east: Annotated[float, Query(ge=-180, le=180)],
    north: Annotated[float, Query(ge=-90, le=90)],
    filters: UniversityFilterDep,
    request: Request,
    response: Response,
):
    if south > north:
        raise HTTPException(status_code=422, detail="south must not exceed north")

    search_lang = resolve_search_lang(filters.lang, request)
    filter_kwargs = filters.model_dump(exclude={"lang"})
    cache_payload = {
        "west": round(west, 5),
        "admissions_revision": admissions_catalog.get_revision(),
        "south": round(south, 5),
        "east": round(east, 5),
        "north": round(north, 5),
        **filter_kwargs,
        "search_lang": search_lang,
    }
    redis_cache_key = _cache_key("api:universities:map-points", cache_payload)
    cached = cache_get_json(redis_cache_key)
    if isinstance(cached, dict):
        response.headers["Cache-Control"] = "public, max-age=60"
        response.headers["X-Redis-Cache"] = "HIT"
        return cached

    result = uni_service.list_universities(
        **filter_kwargs,
        sort="rank_asc",
        page=1,
        limit=10_000,
        paginate=False,
        response_mode="map",
        search_lang=search_lang,
    )

    def is_in_bounds(item: dict[str, object]) -> bool:
        coordinates = item.get("coordinates") if isinstance(item, dict) else None
        if not isinstance(coordinates, dict):
            return False
        try:
            lat = float(coordinates.get("lat"))  # type: ignore[arg-type]
            lon = float(coordinates.get("lon"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return False
        longitude_matches = west <= lon <= east if west <= east else (lon >= west or lon <= east)
        return south <= lat <= north and longitude_matches

    bounded_items = [item for item in result.get("items", []) if is_in_bounds(item)]
    total = len(bounded_items)
    payload: dict[str, object] = {
        "items": bounded_items[:10_000],
        "count": min(total, 10_000),
        "total": total,
        "truncated": total > 10_000,
    }
    cache_set_json(redis_cache_key, payload, ttl_seconds=max(1, int(REDIS_CACHE_TTL_SEC)))
    response.headers["Cache-Control"] = "public, max-age=60"
    response.headers["X-Redis-Cache"] = "MISS"
    return payload


@router.post("/universities/profiled", summary="List universities with profile-based cost estimates")
def list_universities_profiled(payload: ProfiledUniversitiesRequest, request: Request, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    return uni_service.list_universities(
        q=payload.q, country=payload.country, city=payload.city, region=payload.region,
        major=payload.major, study_level=payload.study_level, funding_type=payload.funding_type,
        format=payload.format, min_tuition=payload.min_tuition, max_tuition=payload.max_tuition,
        cost_basis=payload.cost_basis, sort=payload.sort, page=payload.page, limit=payload.limit,
        response_mode=payload.fields, search_lang=resolve_search_lang(payload.lang, request),
        profile=to_profile_dict(payload.profile),
    )


@router.post("/universities/ai-sort", summary="AI-sorted university list (UniFit)", description="Sorts universities by profile fit using the UniFit algorithm. Considers exams, budget, interests, languages, and preference sliders to produce a personalized ranking.")
def list_universities_ai_sort(payload: UniversitiesAiSortRequest, request: Request, response: Response):
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

    search_lang = resolve_search_lang(payload.lang, request)
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
    request: Request,
    response: Response,
    lang: LangQuery = None,
):
    search_lang = resolve_search_lang(lang, request)
    response.headers["Cache-Control"] = "public, max-age=300"
    return uni_service.get_university_translation_bundle(search_lang)


@router.get("/universities/{university_id}", summary="University detail", description="Returns full details for a single university, including admission categories, finance, programs, and student life. Supports ETag caching and language localization.")
def get_university(
    university_id: UniversityIdPath,
    request: Request,
    response: Response,
    lang: LangQuery = None,
):
    search_lang = resolve_search_lang(lang, request)
    u = uni_service.get_university_by_id(
        university_id,
        search_lang=search_lang,
        localized=True,
    )
    if u is None:
        raise HTTPException(status_code=404, detail="University not found")

    etag = uni_service.get_university_etag(university_id, search_lang=search_lang, payload=u)
    not_modified = apply_etag_or_not_modified(
        request,
        response,
        etag=etag,
        cache_control="public, max-age=300, stale-while-revalidate=120",
    )
    if not_modified is not None:
        return not_modified

    return u


@router.get("/locations", summary="Available locations", description="Returns a tree of countries, regions, and cities that have universities in the catalog.")
def get_locations(response: Response):
    cached = cache_get_json("api:locations")
    if isinstance(cached, dict):
        response.headers["Cache-Control"] = "public, max-age=300"
        response.headers["X-Redis-Cache"] = "HIT"
        return cached

    data = uni_service.get_locations()
    cache_set_json("api:locations", data if isinstance(data, dict) else {}, ttl_seconds=300)
    response.headers["Cache-Control"] = "public, max-age=300"
    response.headers["X-Redis-Cache"] = "MISS"
    return data
