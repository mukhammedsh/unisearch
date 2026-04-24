import hmac
import threading
import time
import uuid
from collections import deque
from typing import Any, Deque, Dict, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.settings import (
    METRICS_PATH,
    OPS_ADMIN_HEADER,
    OPS_ADMIN_TOKEN,
    TRUST_X_FORWARDED_FOR,
    TRUSTED_PROXY_IPS,
)
from app.core.redis_store import get_redis_client, is_redis_configured


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


class RedisSlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int, redis_client: Any, key_prefix: str = "rate-limit"):
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self.key_prefix = str(key_prefix or "rate-limit").strip() or "rate-limit"
        self._redis = redis_client
        self._fallback = SlidingWindowRateLimiter(limit=self.limit, window_seconds=self.window_seconds)

    def _key(self, key: str) -> str:
        return f"{self.key_prefix}:{str(key or 'global').strip() or 'global'}"

    def check(self, key: str, now: Optional[float] = None) -> Tuple[bool, int, float]:
        current = float(now if now is not None else time.time())
        if self._redis is None:
            return self._fallback.check(key, now=current)

        redis_key = self._key(key)
        cutoff = current - self.window_seconds
        try:
            pipe = self._redis.pipeline(transaction=True)
            pipe.zremrangebyscore(redis_key, 0, cutoff)
            pipe.zcard(redis_key)
            pipe.zrange(redis_key, 0, 0, withscores=True)
            _, existing_count, oldest_rows = pipe.execute()
            count = int(existing_count or 0)
        except Exception:
            return self._fallback.check(key, now=current)

        if count >= self.limit:
            oldest_ts = current
            if oldest_rows:
                try:
                    oldest_ts = float(oldest_rows[0][1])
                except Exception:
                    oldest_ts = current
            retry_after = max(0.0, self.window_seconds - (current - oldest_ts))
            return False, 0, retry_after

        member = f"{current:.6f}:{uuid.uuid4().hex}"
        try:
            pipe = self._redis.pipeline(transaction=True)
            pipe.zadd(redis_key, {member: current})
            pipe.expire(redis_key, self.window_seconds + 1)
            pipe.zcard(redis_key)
            _, _, count_after = pipe.execute()
            remaining = max(0, self.limit - int(count_after or 0))
            return True, remaining, 0.0
        except Exception:
            return self._fallback.check(key, now=current)


def build_rate_limiter(
    limit: int,
    window_seconds: int,
    max_keys: int = 2048,
    redis_key_prefix: str = "rate-limit",
):
    redis_client = get_redis_client() if is_redis_configured() else None
    if redis_client is None:
        return SlidingWindowRateLimiter(limit=limit, window_seconds=window_seconds, max_keys=max_keys)
    return RedisSlidingWindowRateLimiter(
        limit=limit,
        window_seconds=window_seconds,
        redis_client=redis_client,
        key_prefix=redis_key_prefix,
    )


def request_client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"

    direct_host = ""
    if request.client and request.client.host:
        direct_host = str(request.client.host).strip()

    if TRUST_X_FORWARDED_FOR and direct_host and direct_host in set(TRUSTED_PROXY_IPS):
        xff = str(request.headers.get("x-forwarded-for", "")).strip()
        if xff:
            first = xff.split(",")[0].strip()
            if first:
                return first

    return direct_host or "unknown"


def is_protected_ops_request(request: Request) -> bool:
    path = str(request.url.path or "")
    if path.startswith("/ops/"):
        return True
    if path == str(METRICS_PATH or "/metrics"):
        return True
    if path == "/health" and str(request.query_params.get("warmup", "")).strip().lower() in {"1", "true", "yes", "on"}:
        return True
    return False


def ops_request_is_authorized(request: Request) -> bool:
    token = str(OPS_ADMIN_TOKEN or "").strip()
    if not token:
        return False

    header_value = str(request.headers.get(OPS_ADMIN_HEADER, "")).strip()
    auth_value = str(request.headers.get("authorization", "")).strip()
    bearer_prefix = "bearer "
    bearer_value = auth_value[len(bearer_prefix):].strip() if auth_value.lower().startswith(bearer_prefix) else ""
    
    return (
        hmac.compare_digest(header_value, token) or 
        hmac.compare_digest(bearer_value, token)
    )


def protected_ops_response() -> JSONResponse:
    if OPS_ADMIN_TOKEN:
        return JSONResponse(
            {"detail": "Ops endpoint requires admin credentials"},
            status_code=401,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return JSONResponse({"detail": "Not found"}, status_code=404)
