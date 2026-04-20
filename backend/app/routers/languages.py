from fastapi import APIRouter, HTTPException, Response

from app.services import languages as lang_service
from app.schemas import LanguageValidateRequest


router = APIRouter()


@router.get("/languages/config", summary="Language configuration", description="Returns the list of supported languages with their CEFR levels, exam mappings, and display labels.")
def get_languages_config(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    return lang_service.get_languages_config()


@router.post("/languages/validate", summary="Validate language submission", description="Validates a language proficiency entry (native, CEFR level, or exam score) and returns the normalized result.")
def validate_language(payload: LanguageValidateRequest):
    try:
        return lang_service.validate_language(payload.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid language payload")
