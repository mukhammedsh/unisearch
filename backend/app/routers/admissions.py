"""Read-only endpoints for the active, reviewed admissions catalog."""

import hashlib
import json
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Path, Query, Request, Response

from app.schemas.admissions import AdmissionsContextRequest
from app.services import admissions_catalog, admissions_assessment, universities as university_service
from app.routers.universities import _resolve_search_lang


router = APIRouter()


def _etag_matches(if_none_match: str, etag: str) -> bool:
    raw = str(if_none_match or "").strip()
    if raw == "*":
        return True
    target = etag.strip()
    return target in [part.strip() for part in raw.split(",") if part.strip()] or f"W/{target}" in [
        part.strip() for part in raw.split(",") if part.strip()
    ]


def _catalog_error(error: Exception) -> HTTPException:
    if isinstance(error, admissions_catalog.InstitutionNotFoundError):
        return HTTPException(status_code=404, detail="Admissions catalog not found")
    if isinstance(error, admissions_catalog.AdmissionsCatalogError):
        return HTTPException(status_code=503, detail="Admissions catalog is unavailable")
    raise error


@router.get(
    "/universities/{university_id}/study-options",
    summary="List accepted study options",
    description="Returns a paginated index of reviewed study options from the accepted admissions catalog.",
)
def list_study_options(
    university_id: str = Path(..., min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$"),
    search: str = Query("", max_length=200),
    study_level: Optional[Literal["undergraduate", "masters", "doctoral", "professional"]] = Query(None),
    page: int = Query(1, ge=1, le=10_000),
    limit: int = Query(30, ge=1, le=100),
    lang: Optional[str] = Query(None, max_length=16),
    request: Request = None,
    response: Response = None,
):
    try:
        language = _resolve_search_lang(lang, request)
        result = admissions_catalog.list_study_options(
            university_id,
            search_candidates=university_service._search_query_candidates(search.strip(), search_lang=language),
            study_level=study_level, page=page, limit=limit,
        )
        revision = result["revision"]
        etag = '"' + hashlib.sha256(json.dumps(
            [revision, university_id, search.strip(), study_level, page, limit, language],
            ensure_ascii=True, separators=(",", ":"),
        ).encode("utf-8")).hexdigest() + '"'
        cache_control = "public, max-age=300, stale-while-revalidate=60"
        if response is not None:
            response.headers["Cache-Control"] = cache_control
            response.headers["ETag"] = etag
            response.headers["Vary"] = "Accept-Language"
        if _etag_matches(request.headers.get("if-none-match", "") if request else "", etag):
            return Response(status_code=304, headers={"Cache-Control": cache_control, "ETag": etag, "Vary": "Accept-Language"})
        return result
    except HTTPException:
        raise
    except admissions_catalog.AdmissionsCatalogError as error:
        raise _catalog_error(error) from error


@router.post(
    "/universities/{university_id}/admissions-context",
    summary="Resolve admissions context",
    description="Resolves one selected study option and route against reviewed facts and exposes source-backed assessment states. Unsupported conditions do not produce a percentage.",
)
def resolve_admissions_context(
    payload: AdmissionsContextRequest,
    university_id: str = Path(..., min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$"),
    response: Response = None,
):
    if response is not None:
        response.headers["Cache-Control"] = "private, no-store"
    try:
        profile = payload.profile.model_dump(exclude_none=True)
        resolved = admissions_catalog.resolve_context(
            university_id,
            profile=profile,
            context=payload.context.model_dump(exclude_unset=True),
        )
        resolved["assessment"] = admissions_assessment.assess_resolved_context(resolved, profile)
        return resolved
    except admissions_catalog.InstitutionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Admissions catalog not found") from error
    except admissions_catalog.AdmissionsCatalogError as error:
        raise HTTPException(status_code=503, detail="Admissions catalog is unavailable") from error
