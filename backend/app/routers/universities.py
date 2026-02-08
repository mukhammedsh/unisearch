import json
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.schemas import GapCoachRequest, ProfileOnlyRequest, UniversitiesAiSortRequest
from app.schemas.payloads import to_profile_dict
from app.services import universities as uni_service
from app.services import gap_coach as gap_coach_service
from app.services import ai_scoring as ai_scoring_service


router = APIRouter()
_AI_SORT_CACHE_TTL_SEC = 45.0
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
    response: Response = None,
):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=60"
    return uni_service.list_universities(
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
    )


@router.post("/universities/ai-sort")
def list_universities_ai_sort(payload: UniversitiesAiSortRequest, response: Response = None):
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
    ai_balance = payload.ai_balance
    page = payload.page
    limit = payload.limit

    cache_key = _ai_sort_cache_key(payload)
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
            funding_type=funding_type,
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
        )

        sorted_items = ai_scoring_service.sort_universities_ai(
            base.get("items", []),
            profile=profile,
            ai_balance=ai_balance,
            funding_type=funding_type,
        )
        _ai_sort_cache_set(cache_key, sorted_items)

    total = len(sorted_items or [])
    start = (page - 1) * limit
    end = start + limit
    page_items = (sorted_items or [])[start:end] if start < total else []

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
        response.headers["X-AI-Sort-Cache"] = "HIT" if cache_hit else "MISS"

    return {
        "items": page_items,
        "count": len(page_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": "uni_ai",
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


@router.post("/universities/{university_id}/gap-coach")
def get_university_gap_coach(
    university_id: str,
    payload: GapCoachRequest,
    request: Request,
    response: Response = None,
):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = to_profile_dict(payload.profile)
    top_n = gap_coach_service.normalize_top_n(payload.top_n_actions)
    uni_etag = uni_service.get_university_etag(university_id)
    etag = gap_coach_service.build_gap_coach_etag(uni_etag, profile, top_n)

    cache_control = "private, max-age=60, stale-while-revalidate=120"
    if response is not None:
        response.headers["Cache-Control"] = cache_control
        response.headers["ETag"] = etag

    if _etag_matches(request.headers.get("if-none-match", ""), etag):
        return Response(
            status_code=304,
            headers={
                "Cache-Control": cache_control,
                "ETag": etag,
            },
        )

    return gap_coach_service.build_gap_coach(university, profile, top_n)


@router.get("/locations")
def get_locations(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    return uni_service.get_locations()


@router.get("/stats")
def get_stats(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=120"
    return uni_service.get_stats()
