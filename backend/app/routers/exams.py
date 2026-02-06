from fastapi import APIRouter, HTTPException, Response
from typing import Any, Dict

from app.services import exams as exams_service


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
def validate_exam(payload: Dict[str, Any]):
    exam_raw = str(payload.get("exam", "")).strip()
    score_raw = payload.get("score", None)

    if not exam_raw:
        raise HTTPException(status_code=400, detail="Exam name is required")
    if score_raw is None or score_raw == "":
        raise HTTPException(status_code=400, detail="Score is required")

    key = exams_service.resolve_exam_key(exam_raw.strip().upper())

    try:
        score = exams_service.validate_exam_value(key, score_raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid score format")

    return {"ok": True, "exam": key, "score": score}
