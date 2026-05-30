import threading
import logging
import mimetypes
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.observability import setup_observability
from app.core.paths import UNIVERSITY_ASSETS_DIR
from app.core.security import (
    build_rate_limiter,
    is_protected_ops_request,
    ops_request_is_authorized,
    protected_ops_response,
    request_client_ip,
    request_scope_path,
)
from app.core.settings import (
    APP_VERSION,
    AUTO_WARMUP_ON_STARTUP,
    BACKEND_HOST,
    BACKEND_PORT,
    EXPENSIVE_RATE_LIMIT_REQUESTS,
    EXPENSIVE_RATE_LIMIT_WINDOW_SEC,
    FRONTEND_ORIGINS,
    GLOBAL_RATE_LIMIT_REQUESTS,
    GLOBAL_RATE_LIMIT_WINDOW_SEC,
    OPS_ADMIN_HEADER,
    RATE_LIMIT_ENABLED,
    REQUEST_BODY_MAX_BYTES,
)
from app.routers import root, universities, exams, languages
from app.services.background_tasks import warmup_runtime


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

mimetypes.add_type("image/webp", ".webp")
logger = logging.getLogger("unisearch.api")


def _run_startup_warmup() -> None:
    sync_result = warmup_runtime(trigger="startup_sync")
    logger.info(
        "warmup_sync ok=%s duration_ms=%s",
        sync_result.get("ok"),
        sync_result.get("duration_ms"),
    )


@asynccontextmanager
async def _lifespan(app: FastAPI):
    if AUTO_WARMUP_ON_STARTUP:
        warmup_thread = threading.Thread(
            target=_run_startup_warmup,
            name="startup-warmup",
            daemon=True,
        )
        warmup_thread.start()
        logger.info("warmup_sync scheduled trigger=startup_sync")
    yield


app = FastAPI(title="UniSearch AI API", version=APP_VERSION, lifespan=_lifespan)
setup_observability(app)

_GLOBAL_RATE_LIMITER = build_rate_limiter(
    limit=GLOBAL_RATE_LIMIT_REQUESTS,
    window_seconds=GLOBAL_RATE_LIMIT_WINDOW_SEC,
    redis_key_prefix="api:rate-limit:global",
)
_EXPENSIVE_RATE_LIMITER = build_rate_limiter(
    limit=EXPENSIVE_RATE_LIMIT_REQUESTS,
    window_seconds=EXPENSIVE_RATE_LIMIT_WINDOW_SEC,
    redis_key_prefix="api:rate-limit:expensive",
)
_EXPENSIVE_POST_PATHS = {
    "/universities/ai-sort",
    "/exams/validate",
    "/languages/validate",
}


class RequestBodyTooLarge(RuntimeError):
    pass


class RequestBodyLimitMiddleware:
    def __init__(self, app, max_body_bytes: int):
        self.app = app
        self.max_body_bytes = max(0, int(max_body_bytes))

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or self.max_body_bytes <= 0:
            await self.app(scope, receive, send)
            return

        consumed = 0
        response_started = False
        body_too_large = False

        async def limited_receive():
            nonlocal consumed, body_too_large
            if body_too_large:
                return {"type": "http.disconnect"}
            message = await receive()
            if message.get("type") == "http.request":
                consumed += len(message.get("body") or b"")
                if consumed > self.max_body_bytes:
                    body_too_large = True
                    return {"type": "http.disconnect"}
            return message

        async def send_wrapper(message):
            nonlocal response_started
            if body_too_large:
                return
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, send_wrapper)
        except RequestBodyTooLarge:
            if response_started:
                raise
            response = _apply_security_headers(JSONResponse({"detail": "Request body too large"}, status_code=413))
            await response(scope, receive, send)
            return

        if body_too_large and not response_started:
            response = _apply_security_headers(JSONResponse({"detail": "Request body too large"}, status_code=413))
            await response(scope, receive, send)


def _is_expensive_request(request: Request) -> bool:
    path = request_scope_path(request)
    if request.method.upper() != "POST":
        return False
    if path in _EXPENSIVE_POST_PATHS:
        return True
    if path.endswith("/uni-chance") or path.endswith("/roi") or path == "/ops/warmup":
        return True
    return False


def _security_headers() -> dict[str, str]:
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "connect-src 'self' http://127.0.0.1:* http://localhost:*; "
            "script-src 'self' https://unpkg.com; "
            "img-src 'self' data: https://unpkg.com https://*.tile.openstreetmap.org; "
            "style-src 'self' 'unsafe-inline' https://unpkg.com; "
            "base-uri 'self'; "
            "frame-ancestors 'none'; "
            "object-src 'none'"
        ),
    }


def _apply_security_headers(response):
    for name, value in _security_headers().items():
        if name not in response.headers:
            response.headers[name] = value
    return response


def _rate_limit_response(limit: int, window_sec: int, retry_after: float) -> JSONResponse:
    retry_after_sec = max(1, int(round(retry_after)))
    response = JSONResponse(
        {"detail": "Too many requests"},
        status_code=429,
        headers={
            "Retry-After": str(retry_after_sec),
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Window": str(window_sec),
        },
    )
    return _apply_security_headers(response)


def _content_length(request: Request) -> int:
    try:
        return int(str(request.headers.get("content-length", "")).strip() or 0)
    except (TypeError, ValueError):
        return 0


def _request_guard_response(request: Request) -> Response | None:
    if is_protected_ops_request(request) and not ops_request_is_authorized(request):
        return protected_ops_response()
    if REQUEST_BODY_MAX_BYTES <= 0:
        return None
    if _content_length(request) <= REQUEST_BODY_MAX_BYTES:
        return None
    return JSONResponse({"detail": "Request body too large"}, status_code=413)


def _rate_limit_headers(limit: int, remaining: int, window_sec: int) -> dict[str, str]:
    return {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Window": str(window_sec),
    }


def _rate_limit_result(request: Request) -> tuple[Response | None, dict[str, str]]:
    if not RATE_LIMIT_ENABLED:
        return None, {}

    client_key = request_client_ip(request)
    allowed, remaining, retry_after = _GLOBAL_RATE_LIMITER.check(client_key)
    if not allowed:
        return _rate_limit_response(
            GLOBAL_RATE_LIMIT_REQUESTS,
            GLOBAL_RATE_LIMIT_WINDOW_SEC,
            retry_after,
        ), {}

    if not _is_expensive_request(request):
        return None, _rate_limit_headers(
            GLOBAL_RATE_LIMIT_REQUESTS,
            remaining,
            GLOBAL_RATE_LIMIT_WINDOW_SEC,
        )

    request_key = f"{client_key}:{request.method.upper()}:{request_scope_path(request)}"
    allowed, remaining, retry_after = _EXPENSIVE_RATE_LIMITER.check(request_key)
    if not allowed:
        return _rate_limit_response(
            EXPENSIVE_RATE_LIMIT_REQUESTS,
            EXPENSIVE_RATE_LIMIT_WINDOW_SEC,
            retry_after,
        ), {}

    return None, _rate_limit_headers(
        EXPENSIVE_RATE_LIMIT_REQUESTS,
        remaining,
        EXPENSIVE_RATE_LIMIT_WINDOW_SEC,
    )


def _log_request_failure(request: Request, request_id: str, start: float) -> None:
    duration_ms = (time.perf_counter() - start) * 1000.0
    logger.exception(
        "request_failed request_id=%s method=%s path=%s duration_ms=%.2f",
        request_id,
        request.method,
        request_scope_path(request),
        duration_ms,
    )


def _finalize_request_response(
    response: Response,
    request: Request,
    request_id: str,
    start: float,
) -> Response:
    duration_ms = (time.perf_counter() - start) * 1000.0
    response.headers["X-Request-Id"] = request_id
    _apply_security_headers(response)
    logger.info(
        "request_ok request_id=%s method=%s path=%s status=%s duration_ms=%.2f",
        request_id,
        request.method,
        request_scope_path(request),
        response.status_code,
        duration_ms,
    )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Authorization",
        "Content-Type",
        "If-None-Match",
        OPS_ADMIN_HEADER,
    ],
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

app.mount(
    "/universities/assets",
    StaticFiles(directory=str(UNIVERSITY_ASSETS_DIR)),
    name="university-assets",
)


@app.middleware("http")
async def request_metrics(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    try:
        response = _request_guard_response(request)
        rate_headers: dict[str, str] = {}
        if response is None:
            response, rate_headers = _rate_limit_result(request)
        if response is None:
            response = await call_next(request)
        response.headers.update(rate_headers)
    except Exception:
        _log_request_failure(request, request_id, start)
        raise

    return _finalize_request_response(response, request, request_id, start)


app.add_middleware(
    RequestBodyLimitMiddleware,
    max_body_bytes=REQUEST_BODY_MAX_BYTES,
)


app.include_router(root.router)
app.include_router(universities.router)
app.include_router(exams.router)
app.include_router(languages.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=BACKEND_HOST, port=BACKEND_PORT)
