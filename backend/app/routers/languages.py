from fastapi import APIRouter, HTTPException, Response

from app.services import languages as lang_service
from app.schemas import LanguageValidateRequest


router = APIRouter()


@router.get("/languages/config")
def get_languages_config(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    return lang_service.get_languages_config()


@router.post("/languages/validate")
def validate_language(payload: LanguageValidateRequest):
    try:
        return lang_service.validate_language(payload.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid language payload")
