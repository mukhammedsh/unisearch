import json
import threading
import time
from typing import Any, Dict, Optional

from app.core.settings import (
    REDIS_CONNECT_TIMEOUT_SEC,
    REDIS_OPERATION_TIMEOUT_SEC,
    REDIS_PREFIX,
    REDIS_URL,
)

try:
    import redis
except Exception:  # pragma: no cover - optional dependency
    redis = None  # type: ignore[assignment]


_REDIS_CLIENT = None
_REDIS_CLIENT_LOCK = threading.Lock()
_REDIS_PING_CACHE_TTL_SEC = 5.0
_REDIS_PING_STATE = {
    "ts": 0.0,
    "ok": False,
    "reason": "unknown",
}


def _redis_key(key: str) -> str:
    normalized = str(key or "").strip()
    if not normalized:
        return f"{REDIS_PREFIX}:empty"
    return f"{REDIS_PREFIX}:{normalized}"


def is_redis_configured() -> bool:
    return bool(REDIS_URL)


def _build_redis_client():
    if redis is None or not REDIS_URL:
        return None
    try:
        return redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=max(0.05, float(REDIS_CONNECT_TIMEOUT_SEC)),
            socket_timeout=max(0.05, float(REDIS_OPERATION_TIMEOUT_SEC)),
            retry_on_timeout=False,
        )
    except Exception:
        return None


def get_redis_client():
    global _REDIS_CLIENT
    if redis is None or not REDIS_URL:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    with _REDIS_CLIENT_LOCK:
        if _REDIS_CLIENT is None:
            _REDIS_CLIENT = _build_redis_client()
    return _REDIS_CLIENT


def redis_runtime_status(force_check: bool = False) -> Dict[str, Any]:
    if not REDIS_URL:
        return {"configured": False, "available": False, "reason": "not_configured"}
    if redis is None:
        return {"configured": True, "available": False, "reason": "dependency_missing"}

    now = time.time()
    age = now - float(_REDIS_PING_STATE.get("ts", 0.0))
    if not force_check and age <= _REDIS_PING_CACHE_TTL_SEC:
        return {
            "configured": True,
            "available": bool(_REDIS_PING_STATE.get("ok")),
            "reason": str(_REDIS_PING_STATE.get("reason") or "unknown"),
        }

    client = get_redis_client()
    if client is None:
        _REDIS_PING_STATE["ts"] = now
        _REDIS_PING_STATE["ok"] = False
        _REDIS_PING_STATE["reason"] = "client_unavailable"
        return {"configured": True, "available": False, "reason": "client_unavailable"}

    try:
        pong = client.ping()
        ok = bool(pong)
    except Exception:
        ok = False

    _REDIS_PING_STATE["ts"] = now
    _REDIS_PING_STATE["ok"] = ok
    _REDIS_PING_STATE["reason"] = "ok" if ok else "ping_failed"
    return {"configured": True, "available": ok, "reason": _REDIS_PING_STATE["reason"]}


def cache_get_json(key: str) -> Optional[Dict[str, Any]]:
    client = get_redis_client()
    if client is None:
        return None
    try:
        raw = client.get(_redis_key(key))
        if raw is None:
            return None
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
        return None
    except Exception:
        return None


def cache_set_json(key: str, value: Dict[str, Any], ttl_seconds: int) -> bool:
    client = get_redis_client()
    if client is None:
        return False
    if not isinstance(value, dict):
        return False
    try:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        ttl = max(1, int(ttl_seconds))
        client.setex(_redis_key(key), ttl, payload)
        return True
    except Exception:
        return False


def cache_del(key: str) -> bool:
    client = get_redis_client()
    if client is None:
        return False
    try:
        client.delete(_redis_key(key))
        return True
    except Exception:
        return False
