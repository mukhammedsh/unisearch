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

    if raw_multi:
        candidates = [part for part in raw_multi.split(",")]
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
APP_VERSION = os.getenv("APP_VERSION", "3.4.6").strip() or "3.4.6"
BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1").strip() or "127.0.0.1"
try:
    BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000") or 8000)
except Exception:
    BACKEND_PORT = 8000


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_PREFIX = os.getenv("REDIS_PREFIX", "unisearch").strip() or "unisearch"
try:
    REDIS_CACHE_TTL_SEC = int(os.getenv("REDIS_CACHE_TTL_SEC", "60") or 60)
except Exception:
    REDIS_CACHE_TTL_SEC = 60
try:
    AI_SORT_CACHE_TTL_SEC = float(os.getenv("AI_SORT_CACHE_TTL_SEC", "300") or 300)
except Exception:
    AI_SORT_CACHE_TTL_SEC = 300.0
try:
    REDIS_CONNECT_TIMEOUT_SEC = float(os.getenv("REDIS_CONNECT_TIMEOUT_SEC", "0.35") or 0.35)
except Exception:
    REDIS_CONNECT_TIMEOUT_SEC = 0.35
try:
    REDIS_OPERATION_TIMEOUT_SEC = float(os.getenv("REDIS_OPERATION_TIMEOUT_SEC", "0.35") or 0.35)
except Exception:
    REDIS_OPERATION_TIMEOUT_SEC = 0.35

AUTO_WARMUP_ON_STARTUP = _env_bool("AUTO_WARMUP_ON_STARTUP", "1")

METRICS_ENABLED = _env_bool("METRICS_ENABLED", "0")
METRICS_PATH = os.getenv("METRICS_PATH", "/metrics").strip() or "/metrics"
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
try:
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0"))
except Exception:
    SENTRY_TRACES_SAMPLE_RATE = 0.0


OPS_ADMIN_TOKEN = os.getenv("OPS_ADMIN_TOKEN", "").strip()
OPS_ADMIN_HEADER = os.getenv("OPS_ADMIN_HEADER", "X-UniSearch-Ops-Token").strip() or "X-UniSearch-Ops-Token"
TRUST_X_FORWARDED_FOR = _env_bool("TRUST_X_FORWARDED_FOR", "0")
TRUSTED_PROXY_IPS = [
    value.strip()
    for value in os.getenv("TRUSTED_PROXY_IPS", "").split(",")
    if value.strip()
]
try:
    REQUEST_BODY_MAX_BYTES = int(os.getenv("REQUEST_BODY_MAX_BYTES", "131072") or 131072)
except Exception:
    REQUEST_BODY_MAX_BYTES = 131072
RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", "1")
try:
    GLOBAL_RATE_LIMIT_REQUESTS = int(os.getenv("GLOBAL_RATE_LIMIT_REQUESTS", "600") or 600)
except Exception:
    GLOBAL_RATE_LIMIT_REQUESTS = 600
try:
    GLOBAL_RATE_LIMIT_WINDOW_SEC = int(os.getenv("GLOBAL_RATE_LIMIT_WINDOW_SEC", "60") or 60)
except Exception:
    GLOBAL_RATE_LIMIT_WINDOW_SEC = 60
try:
    EXPENSIVE_RATE_LIMIT_REQUESTS = int(os.getenv("EXPENSIVE_RATE_LIMIT_REQUESTS", "120") or 120)
except Exception:
    EXPENSIVE_RATE_LIMIT_REQUESTS = 120
try:
    EXPENSIVE_RATE_LIMIT_WINDOW_SEC = int(os.getenv("EXPENSIVE_RATE_LIMIT_WINDOW_SEC", "60") or 60)
except Exception:
    EXPENSIVE_RATE_LIMIT_WINDOW_SEC = 60


ML_INTEREST_TRANSLATION_ENABLED = _env_bool("ML_INTEREST_TRANSLATION_ENABLED", "1")
ML_INTEREST_TRANSLATION_DEBUG = _env_bool("ML_INTEREST_TRANSLATION_DEBUG", "0")
ML_INTEREST_TRANSLATION_PROVIDER = os.getenv("ML_INTEREST_TRANSLATION_PROVIDER", "libretranslate").strip().lower() or "libretranslate"
ML_INTEREST_TRANSLATION_TARGET = os.getenv("ML_INTEREST_TRANSLATION_TARGET", "en").strip().lower() or "en"
ML_INTEREST_TRANSLATION_SOURCE = os.getenv("ML_INTEREST_TRANSLATION_SOURCE", "auto").strip().lower() or "auto"
LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "http://127.0.0.1:5000/translate").strip()
LIBRETRANSLATE_API_KEY = os.getenv("LIBRETRANSLATE_API_KEY", "").strip()
try:
    ML_INTEREST_TRANSLATION_TIMEOUT_SEC = float(os.getenv("ML_INTEREST_TRANSLATION_TIMEOUT_SEC", "1.2"))
except Exception:
    ML_INTEREST_TRANSLATION_TIMEOUT_SEC = 1.2
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


ML_SEMANTIC_EMBEDDINGS_ENABLED = _env_bool("ML_SEMANTIC_EMBEDDINGS_ENABLED", "1")
ML_SEMANTIC_EMBEDDINGS_MODEL = os.getenv(
    "ML_SEMANTIC_EMBEDDINGS_MODEL",
    "intfloat/multilingual-e5-base",
).strip() or "intfloat/multilingual-e5-base"
ML_SEMANTIC_EMBEDDINGS_DEVICE = os.getenv("ML_SEMANTIC_EMBEDDINGS_DEVICE", "cpu").strip().lower() or "cpu"
try:
    ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE = int(os.getenv("ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE", "32"))
except Exception:
    ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE = 32
ML_SEMANTIC_EMBEDDINGS_E5_PREFIX = os.getenv("ML_SEMANTIC_EMBEDDINGS_E5_PREFIX", "auto").strip().lower() or "auto"
