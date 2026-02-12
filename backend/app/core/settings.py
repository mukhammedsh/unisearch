import os
from app.core.env import load_local_env


load_local_env()

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5501",
)
APP_VERSION = os.getenv("APP_VERSION", "2.1.2").strip() or "2.1.2"


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

QUEUE_ENABLED = _env_bool("QUEUE_ENABLED", "1")
QUEUE_NAME = os.getenv("QUEUE_NAME", "unisearch-default").strip() or "unisearch-default"
AUTO_WARMUP_ON_STARTUP = _env_bool("AUTO_WARMUP_ON_STARTUP", "1")

METRICS_ENABLED = _env_bool("METRICS_ENABLED", "1")
METRICS_PATH = os.getenv("METRICS_PATH", "/metrics").strip() or "/metrics"
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
try:
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0"))
except Exception:
    SENTRY_TRACES_SAMPLE_RATE = 0.0


ML_INTEREST_TRANSLATION_ENABLED = _env_bool("ML_INTEREST_TRANSLATION_ENABLED", "1")
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
