from fastapi import APIRouter, HTTPException

from app.core.settings import APP_VERSION
from app.services import exams as exams_service
from app.services import languages as languages_service
from app.services import universities as universities_service

router = APIRouter()


@router.get("/")
def root():
    return {"status": "ok", "service": "unisearch-backend-ai", "version": APP_VERSION}


@router.get("/health")
def health():
    return {"status": "ok", "version": APP_VERSION}


@router.get("/ready")
def ready():
    universities = universities_service.load_universities()
    locations = universities_service.get_locations()
    language_cfg = languages_service.get_languages_config()
    exams_service.ensure_exams_cache()
    exams_total = len(exams_service.EXAMS_CONFIG.keys())

    if not universities:
        raise HTTPException(status_code=503, detail="Universities dataset is not loaded")
    if not isinstance(language_cfg, dict) or not language_cfg.get("languages"):
        raise HTTPException(status_code=503, detail="Languages dataset is not loaded")
    if exams_total == 0:
        raise HTTPException(status_code=503, detail="Exams dataset is not loaded")

    return {
        "status": "ready",
        "version": APP_VERSION,
        "universities_total": len(universities),
        "countries_total": len(locations.keys()) if isinstance(locations, dict) else 0,
        "languages_total": len(language_cfg.get("languages", [])),
        "exams_total": exams_total,
    }
