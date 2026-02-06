from fastapi import APIRouter, HTTPException, Response
from typing import Any, Dict

from app.services import languages as lang_service


router = APIRouter()


@router.get("/languages/config")
def get_languages_config(response: Response = None):
    if response is not None:
        response.headers["Cache-Control"] = "public, max-age=300"
    return lang_service.get_languages_config()


@router.post("/languages/validate")
def validate_language(payload: Dict[str, Any]):
    try:
        return lang_service.validate_language(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid language payload")
