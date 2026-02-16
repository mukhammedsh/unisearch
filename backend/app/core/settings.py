import os
from app.core.env import load_local_env


load_local_env()

_LOCAL_FRONTEND_ORIGINS = (
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:5510",
    "http://localhost:5510",
)


def _normalize_origin(value: str) -> str:
    return value.strip().rstrip("/")


def _parse_frontend_origins() -> list[str]:
    raw_multi = os.getenv("FRONTEND_ORIGINS", "").strip()
    raw_single = os.getenv("FRONTEND_ORIGIN", "").strip()

    if raw_multi:
        candidates = [part for part in raw_multi.split(",")]
    elif raw_single:
        candidates = [raw_single]
        # Keep local Playwright runs deterministic when legacy single-origin
        # config points to the default frontend port.
        if _normalize_origin(raw_single) in {"http://127.0.0.1:5501", "http://localhost:5501"}:
            candidates.extend(_LOCAL_FRONTEND_ORIGINS)
    else:
        candidates = list(_LOCAL_FRONTEND_ORIGINS)

    normalized_candidates = {_normalize_origin(str(value)) for value in candidates if str(value).strip()}
    if normalized_candidates & {"http://127.0.0.1:5501", "http://localhost:5501"}:
        candidates.extend(_LOCAL_FRONTEND_ORIGINS)

    origins: list[str] = []
    for value in candidates:
        origin = _normalize_origin(str(value))
        if origin and origin not in origins:
            origins.append(origin)

    return origins or [str(_LOCAL_FRONTEND_ORIGINS[0])]


FRONTEND_ORIGINS = _parse_frontend_origins()
# Backward-compatible single-origin export for old imports.
FRONTEND_ORIGIN = FRONTEND_ORIGINS[0]
APP_VERSION = os.getenv("APP_VERSION", "2.4.0").strip() or "2.4.0"


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_PREFIX = os.getenv("REDIS_PREFIX", "unisearch").strip() or "unisearch"
try:
    REDIS_CACHE_TTL_SEC = int(os.getenv("REDIS_CACHE_TTL_SEC", "60") or 60)
except Exception:
    REDIS_CACHE_TTL_SEC = 60
try:
    REDIS_CONNECT_TIMEOUT_SEC = float(os.getenv("REDIS_CONNECT_TIMEOUT_SEC", "0.35") or 0.35)
except Exception:
    REDIS_CONNECT_TIMEOUT_SEC = 0.35
try:
    REDIS_OPERATION_TIMEOUT_SEC = float(os.getenv("REDIS_OPERATION_TIMEOUT_SEC", "0.35") or 0.35)
except Exception:
    REDIS_OPERATION_TIMEOUT_SEC = 0.35

AUTO_WARMUP_ON_STARTUP = _env_bool("AUTO_WARMUP_ON_STARTUP", "1")

METRICS_ENABLED = _env_bool("METRICS_ENABLED", "1")
METRICS_PATH = os.getenv("METRICS_PATH", "/metrics").strip() or "/metrics"
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
try:
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0"))
except Exception:
    SENTRY_TRACES_SAMPLE_RATE = 0.0


ML_INTEREST_TRANSLATION_ENABLED = _env_bool("ML_INTEREST_TRANSLATION_ENABLED", "1")
ML_INTEREST_TRANSLATION_DEBUG = _env_bool("ML_INTEREST_TRANSLATION_DEBUG", "0")
ML_INTEREST_TRANSLATION_PROVIDER = os.getenv("ML_INTEREST_TRANSLATION_PROVIDER", "libretranslate").strip().lower() or "libretranslate"
ML_INTEREST_TRANSLATION_TARGET = os.getenv("ML_INTEREST_TRANSLATION_TARGET", "en").strip().lower() or "en"
ML_INTEREST_TRANSLATION_SOURCE = os.getenv("ML_INTEREST_TRANSLATION_SOURCE", "auto").strip().lower() or "auto"
LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "http://127.0.0.1:5000/translate").strip()
LIBRETRANSLATE_API_KEY = os.getenv("LIBRETRANSLATE_API_KEY", "").strip()
try:
    ML_INTEREST_TRANSLATION_TIMEOUT_SEC = float(os.getenv("ML_INTEREST_TRANSLATION_TIMEOUT_SEC", "2.5"))
except Exception:
    ML_INTEREST_TRANSLATION_TIMEOUT_SEC = 2.5
try:
    ML_INTEREST_TRANSLATION_CACHE_TTL_SEC = int(os.getenv("ML_INTEREST_TRANSLATION_CACHE_TTL_SEC", "86400"))
except Exception:
    ML_INTEREST_TRANSLATION_CACHE_TTL_SEC = 86400
try:
    ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS = int(os.getenv("ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS", "2000"))
except Exception:
    ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS = 2000
try:
    ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS = int(os.getenv("ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS", "40"))
except Exception:
    ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS = 40
try:
    ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC = int(os.getenv("ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC", "60"))
except Exception:
    ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC = 60
try:
    ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC = int(os.getenv("ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC", "20"))
except Exception:
    ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC = 20
