from fastapi import APIRouter, HTTPException, Response

from app.services import exams as exams_service
from app.schemas import ExamValidateRequest


router = APIRouter()


@router.get("/exams/config")
def get_exam_config(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    exams_service.ensure_exams_cache()
    return exams_service.EXAMS_CONFIG


@router.get("/exams/config/full")
def get_exam_config_full(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    exams_service.ensure_exams_cache()
    return exams_service.EXAMS_CONFIG


@router.post("/exams/validate")
def validate_exam(payload: ExamValidateRequest):
    exam_raw = payload.exam
    score_raw = payload.score

    key = exams_service.resolve_exam_key(exam_raw.strip().upper())

    try:
        score = exams_service.validate_exam_value(key, score_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid score format")

    return {"ok": True, "exam": key, "score": score}
