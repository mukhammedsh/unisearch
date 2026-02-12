import time
from typing import Any, Dict

from app.services import exams as exams_service
from app.services import languages as languages_service
from app.services import universities as universities_service
from app.services.ml_scoring import get_ml_recommender


def warmup_runtime(trigger: str = "manual") -> Dict[str, Any]:
    started = time.perf_counter()
    result: Dict[str, Any] = {
        "trigger": str(trigger or "manual"),
        "ok": True,
    }

    try:
        universities = universities_service.load_universities()
        result["universities_total"] = len(universities)
    except Exception:
        result["ok"] = False
        result["universities_total"] = 0

    try:
        locations = universities_service.get_locations()
        result["countries_total"] = len(locations.keys()) if isinstance(locations, dict) else 0
    except Exception:
        result["ok"] = False
        result["countries_total"] = 0

    try:
        cfg = languages_service.get_languages_config()
        result["languages_total"] = len((cfg or {}).get("languages", []))
    except Exception:
        result["ok"] = False
        result["languages_total"] = 0

    try:
        exams_service.ensure_exams_cache()
        result["exams_total"] = len(exams_service.EXAMS_CONFIG.keys())
    except Exception:
        result["ok"] = False
        result["exams_total"] = 0

    try:
        result["ml_ready"] = bool(get_ml_recommender().is_ready())
    except Exception:
        result["ok"] = False
        result["ml_ready"] = False

    duration_ms = (time.perf_counter() - started) * 1000.0
    result["duration_ms"] = round(duration_ms, 2)
    return result
