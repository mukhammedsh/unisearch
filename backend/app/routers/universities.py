from fastapi import APIRouter, HTTPException, Query, Response
from typing import Optional

from app.services import universities as uni_service


router = APIRouter()


@router.get("/universities")
def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    major: Optional[str] = None,
    study_level: Optional[str] = None,
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


@router.get("/universities/{university_id}")
def get_university(university_id: str, response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    u = uni_service.get_university_by_id(university_id)
    if u is not None:
        return u
    raise HTTPException(status_code=404, detail="University not found")


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
