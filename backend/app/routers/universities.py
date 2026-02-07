from fastapi import APIRouter, HTTPException, Query, Request, Response
from typing import Any, Dict, Optional

from app.services import universities as uni_service
from app.services import gap_coach as gap_coach_service
from app.services import ai_scoring as ai_scoring_service


router = APIRouter()


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
def list_universities_ai_sort(payload: Dict[str, Any], response: Response = None):
    def _to_float_or_none(value: Any) -> Optional[float]:
        try:
            if value is None or value == "":
                return None
            return float(value)
        except Exception:
            return None

    profile = payload.get("profile", {})
    if profile is None:
        profile = {}
    if not isinstance(profile, dict):
        raise HTTPException(status_code=400, detail="profile must be an object")

    q = payload.get("q")
    country = payload.get("country")
    city = payload.get("city")
    region = payload.get("region")
    major = payload.get("major")
    study_level = payload.get("study_level")
    funding_type = payload.get("funding_type")
    fmt = payload.get("format")
    min_tuition = _to_float_or_none(payload.get("min_tuition"))
    max_tuition = _to_float_or_none(payload.get("max_tuition"))
    min_acceptance = _to_float_or_none(payload.get("min_acceptance"))
    max_acceptance = _to_float_or_none(payload.get("max_acceptance"))
    size = payload.get("size")
    ai_balance = payload.get("ai_balance", 50)
    page_raw = payload.get("page", 1)
    limit_raw = payload.get("limit", 200)

    try:
        page = int(page_raw)
        if page < 1:
            page = 1
    except Exception:
        page = 1

    try:
        limit = int(limit_raw)
        if limit < 1:
            limit = 1
        if limit > 2000:
            limit = 2000
    except Exception:
        limit = 200

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
        limit=100000,
    )

    sorted_items = ai_scoring_service.sort_universities_ai(
        base.get("items", []),
        profile=profile,
        ai_balance=ai_balance,
        funding_type=funding_type,
    )

    total = len(sorted_items)
    start = (page - 1) * limit
    end = start + limit
    page_items = sorted_items[start:end] if start < total else []

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"

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
def get_university_uni_chance(university_id: str, payload: Dict[str, Any], response: Response = None):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = payload.get("profile", {})
    if profile is None:
        profile = {}
    if not isinstance(profile, dict):
        raise HTTPException(status_code=400, detail="profile must be an object")

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
    return ai_scoring_service.estimate_uni_chance(university, profile)


@router.post("/universities/{university_id}/roi")
def get_university_roi(university_id: str, payload: Dict[str, Any], response: Response = None):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = payload.get("profile", {})
    if profile is None:
        profile = {}
    if not isinstance(profile, dict):
        raise HTTPException(status_code=400, detail="profile must be an object")

    if response is not None:
        response.headers["Cache-Control"] = "private, max-age=30"
    return ai_scoring_service.estimate_university_roi(university, profile)


@router.post("/universities/{university_id}/gap-coach")
def get_university_gap_coach(
    university_id: str,
    payload: Dict[str, Any],
    request: Request,
    response: Response = None,
):
    university = uni_service.get_university_by_id(university_id)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    profile = payload.get("profile", {})
    if not isinstance(profile, dict):
        raise HTTPException(status_code=400, detail="profile must be an object")

    top_n = gap_coach_service.normalize_top_n(payload.get("top_n_actions", 3))
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
