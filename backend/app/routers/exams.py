from fastapi import APIRouter, HTTPException, Response

from app.services import exams as exams_service
from app.schemas import ExamValidateRequest


router = APIRouter()


@router.get("/exams/config", summary="Exam configuration", description="Returns the map of supported exams with their score ranges, input modes, and level bands.")
def get_exam_config(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    exams_service.ensure_exams_cache()
    return exams_service.EXAMS_CONFIG


@router.get("/exams/config/full", summary="Full exam configuration", description="Returns the complete exam configuration, identical to /exams/config in the current version.")
def get_exam_config_full(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    exams_service.ensure_exams_cache()
    return exams_service.EXAMS_CONFIG


@router.post("/exams/validate", summary="Validate exam submission", description="Validates and coerces an exam score submission, returning the canonical score, raw value, and display value.")
def validate_exam(payload: ExamValidateRequest):
    exam_raw = payload.exam
    score_raw = payload.score
    raw_value = payload.raw_value or payload.rawValue
    details = payload.details

    key = exams_service.resolve_exam_key(exam_raw.strip().upper())

    try:
        result = exams_service.coerce_exam_submission(
            key,
            score_raw=score_raw,
            raw_value=raw_value,
            details=details,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid score format")

    return {"ok": True, **result}
