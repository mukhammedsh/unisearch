from fastapi import APIRouter, HTTPException, Query

from app.core.redis_store import redis_runtime_status
from app.core.settings import APP_VERSION
from app.services import exams as exams_service
from app.services import languages as languages_service
from app.services import text_translation as text_translation_service
from app.services import universities as universities_service
from app.services.background_tasks import warmup_runtime

router = APIRouter()


@router.get("/", summary="Service status", description="Returns basic service status and version.")
def root():
    return {"status": "ok", "service": "unisearch-backend-ai", "version": APP_VERSION}


@router.get("/health", summary="Health check", description="Lightweight liveness probe. Pass ?warmup=true to trigger a synchronous warmup and include its result.")
def health(warmup: bool = Query(False)):
    payload = {"status": "ok", "version": APP_VERSION}
    if warmup:
        payload["warmup"] = warmup_runtime(trigger="health")
    return payload


@router.get("/ready", summary="Readiness check", description="Verifies that all required datasets (universities, languages, exams) are loaded and Redis is reachable.")
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

    redis_status = redis_runtime_status(force_check=True)
    return {
        "status": "ready",
        "version": APP_VERSION,
        "universities_total": len(universities),
        "countries_total": len(locations.keys()) if isinstance(locations, dict) else 0,
        "languages_total": len(language_cfg.get("languages", [])),
        "exams_total": exams_total,
        "redis": redis_status,
    }


@router.get("/ops/runtime", summary="Runtime status (ops)", description="Returns runtime metadata including app version and Redis connectivity.")
def runtime_status():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "redis": redis_runtime_status(force_check=True),
    }


@router.post("/ops/warmup", summary="Trigger warmup (ops)", description="Runs a synchronous data-warmup cycle and returns the result.")
def runtime_warmup():
    sync_result = warmup_runtime(trigger="ops_sync")
    return {
        "status": "sync",
        "result": sync_result,
    }


@router.get("/ops/translation-status", summary="Translation status (ops)", description="Returns full translation service runtime status including provider details.")
def translation_status():
    return text_translation_service.get_translation_runtime_status(force_check=False)


@router.get("/translation-status", summary="Public translation status", description="Returns a sanitized subset of the translation service status safe for frontend consumption.")
def public_translation_status():
    status = text_translation_service.get_translation_runtime_status(force_check=False)
    return {
        "enabled": bool(status.get("enabled")),
        "provider": str(status.get("provider") or "none"),
        "available": bool(status.get("available")),
        "reason": str(status.get("reason") or ""),
    }
