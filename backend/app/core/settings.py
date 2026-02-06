import os
from app.core.env import load_local_env


load_local_env()

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5501",
)

UNIMENTOR_NAME = os.getenv("UNIMENTOR_NAME", "UniMentor").strip() or "UniMentor"
UNIMENTOR_PROVIDER = os.getenv("UNIMENTOR_PROVIDER", "local").strip().lower() or "local"
UNIMENTOR_ENABLE_ONLINE = os.getenv("UNIMENTOR_ENABLE_ONLINE", "1").strip().lower() not in ("0", "false", "no")
UNIMENTOR_GEMINI_MODEL = os.getenv("UNIMENTOR_GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
UNIMENTOR_GEMINI_FALLBACK_MODEL = os.getenv("UNIMENTOR_GEMINI_FALLBACK_MODEL", "gemini-2.0-flash-lite").strip() or "gemini-2.0-flash-lite"
UNIMENTOR_GEMINI_ENABLE_WEB = os.getenv("UNIMENTOR_GEMINI_ENABLE_WEB", "1").strip().lower() not in ("0", "false", "no")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

try:
    UNIMENTOR_TIMEOUT = float(os.getenv("UNIMENTOR_TIMEOUT", "6"))
except Exception:
    UNIMENTOR_TIMEOUT = 6.0

MENTOR_API_KEY = (os.getenv("UNIMENTOR_API_KEY") or os.getenv("MENTOR_API_KEY") or "").strip()
