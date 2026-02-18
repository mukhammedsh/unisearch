import hashlib
import json
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.core.redis_store import cache_get_json, cache_set_json
from app.core.settings import AI_SORT_CACHE_TTL_SEC, REDIS_CACHE_TTL_SEC
from app.schemas import ProfileOnlyRequest, UniversitiesAiSortRequest
from app.schemas.payloads import to_profile_dict
from app.services import universities as uni_service
from app.services import ai_scoring as ai_scoring_service


router = APIRouter()
_AI_SORT_CACHE_TTL_SEC = max(15.0, float(AI_SORT_CACHE_TTL_SEC))
_AI_SORT_CACHE_MAX_ITEMS = 48
_AI_SORT_CACHE: Dict[str, Dict[str, Any]] = {}
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


def _request_client_key(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"
    xff = str(request.headers.get("x-forwarded-for", "")).strip()
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def _request_locale_hint(request: Optional[Request]) -> str:
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
    if raw.startswith("kk") or raw.startswith("kz") or raw == "kaz":
        return "kz"
    return "eng"


def _resolve_search_lang(explicit_lang: Any, request: Optional[Request]) -> str:
    if str(explicit_lang or "").strip():
        return _normalize_search_lang(explicit_lang)
    return _normalize_search_lang(_request_locale_hint(request))


def _ai_sort_cache_key(payload: UniversitiesAiSortRequest) -> str:
    raw = payload.model_dump(exclude_none=True)
    raw.pop("page", None)
    raw.pop("limit", None)
    return json.dumps(raw, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def _ai_sort_cache_get(key: str) -> Optional[List[Dict[str, Any]]]:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        stale_keys = [
            k
            for k, row in _AI_SORT_CACHE.items()
            if (now - float(row.get("ts", 0.0))) > _AI_SORT_CACHE_TTL_SEC
        ]
        for stale in stale_keys:
            _AI_SORT_CACHE.pop(stale, None)

        row = _AI_SORT_CACHE.get(key)
        if not row:
            return None
        return row.get("items")


def _ai_sort_cache_set(key: str, items: List[Dict[str, Any]]) -> None:
    now = time.time()
    with _AI_SORT_CACHE_LOCK:
        _AI_SORT_CACHE[key] = {
            "ts": now,
            "items": items,
        }
        if len(_AI_SORT_CACHE) <= _AI_SORT_CACHE_MAX_ITEMS:
            return

        overflow = len(_AI_SORT_CACHE) - _AI_SORT_CACHE_MAX_ITEMS
        if overflow <= 0:
            return
        oldest_keys = sorted(
            _AI_SORT_CACHE.keys(),
            key=lambda k: float(_AI_SORT_CACHE[k].get("ts", 0.0)),
        )
        candidates = [k for k in oldest_keys if k != key]
        for stale in candidates[:overflow]:
            _AI_SORT_CACHE.pop(stale, None)


def _cache_key(namespace: str, payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"{namespace}:{digest}"


@router.get("/universities")
def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    major: Optional[str] = None,
    study_level: Optional[str] = None,
    funding_type: Optional[str] = None,
    format: Optional[str] = None,
    user_budget: Optional[float] = Query(None, ge=0),
    min_tuition: Optional[float] = Query(None, ge=0),
    max_tuition: Optional[float] = Query(None, ge=0),
    min_acceptance: Optional[float] = Query(None, ge=0),
    max_acceptance: Optional[float] = Query(None, ge=0),
    size: Optional[str] = None,
    sort: str = "name_asc",
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=2000),
    fields: str = Query("card", pattern="^(card|full)$"),
    lang: Optional[str] = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    search_lang = _resolve_search_lang(lang, request)
    cache_payload = {
        "q": q,
        "country": country,
        "city": city,
        "region": region,
        "major": major,
        "study_level": study_level,
        "funding_type": funding_type,
        "format": format,
        "user_budget": user_budget,
        "min_tuition": min_tuition,
        "max_tuition": max_tuition,
        "min_acceptance": min_acceptance,
        "max_acceptance": max_acceptance,
        "size": size,
        "sort": sort,
        "page": page,
        "limit": limit,
        "fields": fields,
        "search_lang": search_lang,
    }
    redis_cache_key = _cache_key("api:universities:list", cache_payload)

    use_redis_cache = limit <= 500
    if use_redis_cache:
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
        user_budget=user_budget,
        min_tuition=min_tuition,
        max_tuition=max_tuition,
        min_acceptance=min_acceptance,
        max_acceptance=max_acceptance,
        size=size,
        sort=sort,
        page=page,
        limit=limit,
        response_mode=fields,
        search_lang=search_lang,
    )

    if use_redis_cache:
        cache_set_json(redis_cache_key, result, ttl_seconds=max(1, int(REDIS_CACHE_TTL_SEC)))

    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=60"
        response.headers["X-Redis-Cache"] = "MISS" if use_redis_cache else "BYPASS"
    return result


@router.post("/universities/ai-sort")
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
    min_acceptance = payload.min_acceptance
    max_acceptance = payload.max_acceptance
    size = payload.size
    practice_vs_science = payload.practice_vs_science
    social_vs_hardcore = payload.social_vs_hardcore
    budget_vs_prestige = payload.budget_vs_prestige
    city_vs_campus = payload.city_vs_campus
    ai_balance = payload.ai_balance
    admission_bias = payload.admission_bias
    page = payload.page
    limit = payload.limit

    cache_key = _ai_sort_cache_key(payload)
    search_lang = _resolve_search_lang(payload.lang, request)
    client_key = _request_client_key(request)
    sorted_items = _ai_sort_cache_get(cache_key)
    cache_hit = sorted_items is not None

    if sorted_items is None:
        base = uni_service.list_universities(
            q=q,
            country=country,
            city=city,
            region=region,
            major=major,
            study_level=study_level,
            funding_type=None,
            format=fmt,
            min_tuition=min_tuition,
            max_tuition=max_tuition,
            min_acceptance=min_acceptance,
            max_acceptance=max_acceptance,
            size=size,
            sort="name_asc",
            page=1,
            limit=200,
            paginate=False,
            response_mode="full",
            search_lang=search_lang,
        )

        sorted_items = ai_scoring_service.sort_universities_ai(
            base.get("items", []),
            profile=profile,
            practice_vs_science=practice_vs_science,
            social_vs_hardcore=social_vs_hardcore,
            budget_vs_prestige=budget_vs_prestige,
            city_vs_campus=city_vs_campus,
            ai_balance=ai_balance,
            admission_bias=admission_bias,
            funding_type=funding_type,
            translation_client_key=client_key,
        )
        _ai_sort_cache_set(cache_key, sorted_items)

    total = len(sorted_items or [])
    start = (page - 1) * limit
    end = start + limit
    page_items = (sorted_items or [])[start:end] if start < total else []
    probe_items = page_items if page_items else ((sorted_items or [])[:1] if sorted_items else [])
    ml_unavailable = any(
        bool(((row.get("matchData") or {}).get("mlUnavailable")))
        for row in probe_items
        if isinstance(row, dict)
    )
    warnings = ["Machine Learning unavailable"] if ml_unavailable else []

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
        response.headers["X-AI-Sort-Cache"] = "HIT" if cache_hit else "MISS"

    return {
        "items": [uni_service.to_university_card(row, format_preference=fmt) for row in page_items],
        "count": len(page_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": "uni_ai",
        "warnings": warnings,
    }


@router.get("/universities/{university_id}")
def get_university(university_id: str, request: Request, response: Response = None):
    u = uni_service.get_university_by_id(university_id)
    if u is None:
        raise HTTPException(status_code=404, detail="University not found")

    etag = uni_service.get_university_etag(university_id)
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=120"
        response.headers["ETag"] = etag

    if _etag_matches(request.headers.get("if-none-match", ""), etag):
        return Response(status_code=304, headers={
            "Cache-Control": "public, max-age=300, stale-while-revalidate=120",
            "ETag": etag,
        })

    return u


@router.post("/universities/{university_id}/uni-chance")
def get_university_uni_chance(
    university_id: str,
    payload: ProfileOnlyRequest,
    response: Response = None,
):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = to_profile_dict(payload.profile)
    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
    return ai_scoring_service.estimate_uni_chance(university, profile)


@router.post("/universities/{university_id}/roi")
def get_university_roi(
    university_id: str,
    payload: ProfileOnlyRequest,
    response: Response = None,
):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = to_profile_dict(payload.profile)
    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
    return ai_scoring_service.estimate_university_roi(university, profile)


@router.get("/locations")
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


@router.get("/stats")
def get_stats(response: Response = None):
    cached = cache_get_json("api:stats")
    if isinstance(cached, dict):
        if response is not None:
            response.headers["Cache-Control"] = "public, max-age=120"
            response.headers["X-Redis-Cache"] = "HIT"
        return cached

    data = uni_service.get_stats()
    cache_set_json("api:stats", data if isinstance(data, dict) else {}, ttl_seconds=120)
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=120"
        response.headers["X-Redis-Cache"] = "MISS"
    return data
