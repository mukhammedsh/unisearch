"""Read-only endpoints for the active, reviewed admissions catalog."""

import hashlib
import json
from typing import Annotated, Literal

from app.core.http_cache import apply_etag_or_not_modified, resolve_search_lang
from app.routers._params import LangQuery, UniversityIdPath
from app.schemas.admissions import AdmissionsContextRequest
from app.services import admissions_assessment, admissions_catalog, admissions_editorial
from app.services import universities as university_service
from fastapi import APIRouter, HTTPException, Query, Request, Response

router = APIRouter()


def _catalog_error(error: admissions_catalog.AdmissionsCatalogError) -> HTTPException:
    if isinstance(error, admissions_catalog.InstitutionNotFoundError):
        return HTTPException(status_code=404, detail="Admissions catalog not found")
    return HTTPException(status_code=503, detail="Admissions catalog is unavailable")


@router.get(
    "/universities/{university_id}/study-options",
    summary="List accepted study options",
    description="Returns a paginated index of reviewed study options from the accepted admissions catalog.",
)
def list_study_options(
    university_id: UniversityIdPath,
    request: Request,
    response: Response,
    search: Annotated[str, Query(max_length=200)] = "",
    major: Annotated[str | None, Query(max_length=120)] = None,
    study_level: Annotated[
        Literal["preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"] | None,
        Query(),
    ] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    lang: LangQuery = None,
):
    try:
        language = resolve_search_lang(lang, request)
        major = (major or "").strip() or None
        result = admissions_catalog.list_study_options(
            university_id,
            search_candidates=university_service._search_query_candidates(search.strip(), search_lang=language, match_name_words=True),
            study_level=study_level, page=page, limit=limit, major=major,
        )
        revision = result["revision"]
        etag = '"' + hashlib.sha256(json.dumps(
            [revision, admissions_catalog.RESPONSE_SHAPE, admissions_editorial.revision(), university_id, search.strip(), study_level, major, page, limit, language],
            ensure_ascii=True, separators=(",", ":"),
        ).encode("utf-8")).hexdigest() + '"'
        not_modified = apply_etag_or_not_modified(
            request,
            response,
            etag=etag,
            cache_control="public, max-age=300, stale-while-revalidate=60",
        )
        if not_modified is not None:
            return not_modified
        return admissions_editorial.strip_applicant_payload(admissions_catalog.public_study_options(result))
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
    university_id: UniversityIdPath,
    payload: AdmissionsContextRequest,
    response: Response,
):
    response.headers["Cache-Control"] = "private, no-store"
    try:
        profile = payload.profile.model_dump(exclude_none=True)
        resolved = admissions_catalog.resolve_context(
            university_id,
            profile=profile,
            context=payload.context.model_dump(exclude_unset=True),
        )
        resolved["assessment"] = admissions_assessment.assess_resolved_context(resolved, profile)
        resolved["selected_costs"] = admissions_catalog.selected_costs(university_id, resolved["context"])
        # The assessment hashes the complete reviewed facts first. The response copy then drops fields no page reads
        # and loses maintainer notes; neither step touches the stored records.
        return admissions_editorial.strip_applicant_payload(admissions_catalog.public_context(resolved))
    except admissions_catalog.InstitutionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Admissions catalog not found") from error
    except admissions_catalog.AdmissionsCatalogError as error:
        raise HTTPException(status_code=503, detail="Admissions catalog is unavailable") from error
