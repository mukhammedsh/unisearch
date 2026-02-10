import os
from app.core.env import load_local_env


load_local_env()

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5501",
)
APP_VERSION = os.getenv("APP_VERSION", "2.1.1").strip() or "2.1.1"


def _env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


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
