import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.observability import setup_observability
from app.core.settings import APP_VERSION, AUTO_WARMUP_ON_STARTUP, FRONTEND_ORIGIN
from app.routers import root, universities, exams, languages
from app.services.background_tasks import warmup_runtime


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("unisearch.api")

app = FastAPI(title="UniSearch AI API", version=APP_VERSION)
setup_observability(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "ETag",
        "Cache-Control",
        "X-Request-Id",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Window",
        "Retry-After",
        "X-Redis-Cache",
    ],
)


@app.middleware("http")
async def request_metrics(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000.0
        logger.exception(
            "request_failed request_id=%s method=%s path=%s duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (time.perf_counter() - start) * 1000.0
    response.headers["X-Request-Id"] = request_id
    logger.info(
        "request_ok request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.on_event("startup")
async def startup_runtime_warmup():
    if not AUTO_WARMUP_ON_STARTUP:
        return

    sync_result = warmup_runtime(trigger="startup_sync")
    logger.info(
        "warmup_sync ok=%s duration_ms=%s",
        sync_result.get("ok"),
        sync_result.get("duration_ms"),
    )

app.include_router(root.router)
app.include_router(universities.router)
app.include_router(exams.router)
app.include_router(languages.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
