import threading
import time
import uuid
from collections import deque
from typing import Any, Deque, Dict, Optional, Tuple

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
