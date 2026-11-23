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

    candidates = raw_multi.split(",") if raw_multi else list(_LOCAL_FRONTEND_ORIGINS)

    normalized_candidates = {_normalize_origin(str(value)) for value in candidates if str(value).strip()}
    if normalized_candidates & {"http://127.0.0.1:5501", "http://localhost:5501"}:
        candidates.extend(_LOCAL_FRONTEND_ORIGINS)

    origins: list[str] = []
    for value in candidates:
        origin = _normalize_origin(str(value))
        if origin and origin not in origins:
            origins.append(origin)

    return origins or [str(_LOCAL_FRONTEND_ORIGINS[0])]


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


def _env_int(name: str, default: int, *, fallback_env: str | None = None) -> int:
    raw = os.getenv(name)
    if not (raw and raw.strip()) and fallback_env:
        raw = os.getenv(fallback_env)
    if not raw or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except (ValueError, TypeError):
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw or not raw.strip():
        return default
    try:
        return float(raw.strip())
    except (ValueError, TypeError):
        return default


FRONTEND_ORIGINS = _parse_frontend_origins()
BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1").strip() or "127.0.0.1"
BACKEND_PORT = _env_int("BACKEND_PORT", 8000, fallback_env="PORT")

REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_PREFIX = os.getenv("REDIS_PREFIX", "unisearch").strip() or "unisearch"
REDIS_CACHE_TTL_SEC = _env_int("REDIS_CACHE_TTL_SEC", 60)
AI_SORT_CACHE_TTL_SEC = _env_float("AI_SORT_CACHE_TTL_SEC", 300.0)
REDIS_CONNECT_TIMEOUT_SEC = _env_float("REDIS_CONNECT_TIMEOUT_SEC", 0.35)
REDIS_OPERATION_TIMEOUT_SEC = _env_float("REDIS_OPERATION_TIMEOUT_SEC", 0.35)

AUTO_WARMUP_ON_STARTUP = _env_bool("AUTO_WARMUP_ON_STARTUP", "1")
WARMUP_ML_ON_STARTUP = _env_bool("WARMUP_ML_ON_STARTUP", "0")

METRICS_ENABLED = _env_bool("METRICS_ENABLED", "0")
METRICS_PATH = os.getenv("METRICS_PATH", "/metrics").strip() or "/metrics"
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
SENTRY_TRACES_SAMPLE_RATE = _env_float("SENTRY_TRACES_SAMPLE_RATE", 0.0)


OPS_ADMIN_TOKEN = os.getenv("OPS_ADMIN_TOKEN", "").strip()
OPS_ADMIN_HEADER = os.getenv("OPS_ADMIN_HEADER", "X-UniSearch-Ops-Token").strip() or "X-UniSearch-Ops-Token"
DOCS_ENABLED = _env_bool(
    "DOCS_ENABLED",
    "1" if BACKEND_HOST in ("127.0.0.1", "localhost") else "0",
)
TRUST_X_FORWARDED_FOR = _env_bool("TRUST_X_FORWARDED_FOR", "0")
TRUST_PRIVATE_NETWORK_PROXIES = _env_bool("TRUST_PRIVATE_NETWORK_PROXIES", "0")
TRUST_CF_CONNECTING_IP = _env_bool("TRUST_CF_CONNECTING_IP", "0")
TRUSTED_PROXY_IPS = [
    value.strip()
    for value in os.getenv("TRUSTED_PROXY_IPS", "").split(",")
    if value.strip()
]
REQUEST_BODY_MAX_BYTES = _env_int("REQUEST_BODY_MAX_BYTES", 131072)
RATE_LIMIT_ENABLED = _env_bool("RATE_LIMIT_ENABLED", "1")
GLOBAL_RATE_LIMIT_REQUESTS = _env_int("GLOBAL_RATE_LIMIT_REQUESTS", 600)
GLOBAL_RATE_LIMIT_WINDOW_SEC = _env_int("GLOBAL_RATE_LIMIT_WINDOW_SEC", 60)
EXPENSIVE_RATE_LIMIT_REQUESTS = _env_int("EXPENSIVE_RATE_LIMIT_REQUESTS", 120)
EXPENSIVE_RATE_LIMIT_WINDOW_SEC = _env_int("EXPENSIVE_RATE_LIMIT_WINDOW_SEC", 60)


ML_SEMANTIC_EMBEDDINGS_ENABLED = _env_bool("ML_SEMANTIC_EMBEDDINGS_ENABLED", "1")
ML_SEMANTIC_EMBEDDINGS_MODEL = os.getenv(
    "ML_SEMANTIC_EMBEDDINGS_MODEL",
    "intfloat/multilingual-e5-base",
).strip() or "intfloat/multilingual-e5-base"
ML_SEMANTIC_EMBEDDINGS_DEVICE = os.getenv("ML_SEMANTIC_EMBEDDINGS_DEVICE", "cpu").strip().lower() or "cpu"
ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE = _env_int("ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE", 32)
ML_SEMANTIC_EMBEDDINGS_E5_PREFIX = os.getenv("ML_SEMANTIC_EMBEDDINGS_E5_PREFIX", "auto").strip().lower() or "auto"

CURRENCY_RATES_ENABLED = _env_bool("CURRENCY_RATES_ENABLED", "1")
CURRENCY_RATES_API_URL = (
    os.getenv("CURRENCY_RATES_API_URL", "https://open.er-api.com/v6/latest/USD").strip()
    or "https://open.er-api.com/v6/latest/USD"
)
CURRENCY_RATES_CACHE_TTL_SEC = _env_int("CURRENCY_RATES_CACHE_TTL_SEC", 43200)
CURRENCY_RATES_TIMEOUT_SEC = _env_float("CURRENCY_RATES_TIMEOUT_SEC", 5.0)
CURRENCY_RATES_BACKOFF_SEC = _env_int("CURRENCY_RATES_BACKOFF_SEC", 300)
