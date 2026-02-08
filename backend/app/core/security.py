import secrets
import threading
import time
from collections import deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import HTTPException, Request

from app.core.settings import (
    MENTOR_API_KEY,
    MENTOR_RATE_LIMIT_REQUESTS,
    MENTOR_RATE_LIMIT_WINDOW_SEC,
)


def require_mentor_api_key(request: Request) -> None:
    if not MENTOR_API_KEY:
        return
    token = request.headers.get("x-api-key") or ""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    token = (token or "").strip()
    if not token or not secrets.compare_digest(token, MENTOR_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")


def _client_identifier(request: Request) -> str:
    xff = str(request.headers.get("x-forwarded-for", "")).strip()
    if xff:
        ip = xff.split(",")[0].strip()
        if ip:
            return ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _token_identifier(request: Request) -> Optional[str]:
    token = str(request.headers.get("x-api-key") or "").strip()
    auth = str(request.headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    return token or None


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 2048):
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self.max_keys = max(16, int(max_keys))
        self._events: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def _evict_stale(self, now: float) -> None:
        cutoff = now - self.window_seconds
        stale_keys = []
        for key, q in self._events.items():
            while q and q[0] <= cutoff:
                q.popleft()
            if not q:
                stale_keys.append(key)
        for key in stale_keys:
            self._events.pop(key, None)

    def check(self, key: str, now: Optional[float] = None) -> Tuple[bool, int, float]:
        current = float(now if now is not None else time.time())
        with self._lock:
            self._evict_stale(current)
            q = self._events.get(key)
            if q is None:
                q = deque()
                self._events[key] = q

            if len(q) >= self.limit:
                retry_after = max(0.0, self.window_seconds - (current - q[0]))
                return False, 0, retry_after

            q.append(current)
            remaining = max(0, self.limit - len(q))

            if len(self._events) > self.max_keys:
                self._evict_stale(current)
                if len(self._events) > self.max_keys:
                    oldest_key = min(
                        self._events.keys(),
                        key=lambda k: self._events[k][0] if self._events.get(k) else current,
                    )
                    if oldest_key != key:
                        self._events.pop(oldest_key, None)

            return True, remaining, 0.0


_MENTOR_RATE_LIMITER = SlidingWindowRateLimiter(
    limit=MENTOR_RATE_LIMIT_REQUESTS,
    window_seconds=MENTOR_RATE_LIMIT_WINDOW_SEC,
)


def enforce_mentor_rate_limit(request: Request) -> Dict[str, str]:
    key_token = _token_identifier(request)
    key_client = _client_identifier(request)
    key = f"token:{key_token}" if key_token else f"ip:{key_client}"

    allowed, remaining, retry_after = _MENTOR_RATE_LIMITER.check(key)
    headers = {
        "X-RateLimit-Limit": str(_MENTOR_RATE_LIMITER.limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Window": str(_MENTOR_RATE_LIMITER.window_seconds),
    }

    if not allowed:
        retry_seconds = str(max(1, int(round(retry_after))))
        headers["Retry-After"] = retry_seconds
        raise HTTPException(status_code=429, detail="Too many mentor requests", headers=headers)

    return headers
