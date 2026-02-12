from fastapi import APIRouter, HTTPException

from app.core.redis_store import redis_runtime_status
from app.core.settings import APP_VERSION
from app.core.task_queue import enqueue_warmup_task, queue_runtime_status
from app.services import exams as exams_service
from app.services import languages as languages_service
from app.services import universities as universities_service
from app.services.background_tasks import warmup_runtime

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

    redis_status = redis_runtime_status(force_check=True)
    queue_status = queue_runtime_status()
    return {
        "status": "ready",
        "version": APP_VERSION,
        "universities_total": len(universities),
        "countries_total": len(locations.keys()) if isinstance(locations, dict) else 0,
        "languages_total": len(language_cfg.get("languages", [])),
        "exams_total": exams_total,
        "redis": redis_status,
        "queue": queue_status,
    }


@router.get("/ops/runtime")
def runtime_status():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "redis": redis_runtime_status(force_check=True),
        "queue": queue_runtime_status(),
    }


@router.post("/ops/warmup")
def enqueue_runtime_warmup(sync_fallback: bool = True):
    queued = enqueue_warmup_task(trigger="ops")
    if queued.get("enqueued"):
        return {
            "status": "queued",
            "queue": queued.get("queue"),
            "job_id": queued.get("job_id"),
        }

    if not sync_fallback:
        raise HTTPException(status_code=503, detail=f"Queue unavailable: {queued.get('reason')}")

    sync_result = warmup_runtime(trigger="ops_sync_fallback")
    return {
        "status": "sync_fallback",
        "queue_reason": queued.get("reason"),
        "result": sync_result,
    }
