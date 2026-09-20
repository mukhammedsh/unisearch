import hmac
import ipaddress
import threading
import time
import uuid
from collections import OrderedDict, deque
from typing import Any, Deque, Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.settings import (
    METRICS_PATH,
    OPS_ADMIN_HEADER,
    OPS_ADMIN_TOKEN,
    TRUST_CF_CONNECTING_IP,
    TRUST_PRIVATE_NETWORK_PROXIES,
    TRUST_X_FORWARDED_FOR,
    TRUSTED_PROXY_IPS,
)
from app.core.redis_store import get_redis_client, is_redis_configured


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 2048):
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self.max_keys = max(16, int(max_keys))
        self._events: OrderedDict[str, Deque[float]] = OrderedDict()
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
            else:
                self._events.move_to_end(key)

            if len(q) >= self.limit:
                retry_after = max(0.0, self.window_seconds - (current - q[0]))
                return False, 0, retry_after

            q.append(current)
            remaining = max(0, self.limit - len(q))

            while len(self._events) > self.max_keys:
                oldest_key, _ = self._events.popitem(last=False)
                if oldest_key == key:
                    self._events[oldest_key] = q
                    break

            return True, remaining, 0.0


class RedisSlidingWindowRateLimiter:
    _CHECK_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local cutoff = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_ts = now
    if oldest and oldest[2] then
        oldest_ts = tonumber(oldest[2]) or now
    end
    return {0, 0, math.max(0, ttl - (now - oldest_ts))}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl + 1)
local count_after = redis.call('ZCARD', key)
return {1, math.max(0, limit - count_after), 0}
"""

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
        member = f"{current:.6f}:{uuid.uuid4().hex}"
        try:
            result = self._redis.eval(
                self._CHECK_SCRIPT,
                1,
                redis_key,
                current,
                cutoff,
                self.limit,
                self.window_seconds,
                member,
            )
            allowed, remaining, retry_after = result or [0, 0, self.window_seconds]
            return bool(int(allowed)), int(remaining or 0), float(retry_after or 0.0)
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


def _validate_and_normalize_ip(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return None


def _parse_trusted_proxy_entry(entry: str) -> Optional[Any]:
    raw = str(entry).strip()
    if not raw:
        return None
    try:
        if "/" in raw:
            return ipaddress.ip_network(raw, strict=False)
        return ipaddress.ip_address(raw)
    except ValueError:
        return None


def _get_trusted_proxy_entries() -> list[Any]:
    entries: list[Any] = []
    for item in TRUSTED_PROXY_IPS:
        parsed = _parse_trusted_proxy_entry(item)
        if parsed is not None:
            entries.append(parsed)
    return entries


def _is_trusted_proxy_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if TRUST_PRIVATE_NETWORK_PROXIES:
        if _is_private_or_local_proxy_ip(ip_obj):
            return True

    for entry in _get_trusted_proxy_entries():
        if isinstance(entry, (ipaddress.IPv4Network, ipaddress.IPv6Network)):
            if ip_obj.version == entry.version and ip_obj in entry:
                return True
        elif isinstance(entry, (ipaddress.IPv4Address, ipaddress.IPv6Address)):
            if ip_obj == entry:
                return True

    return False


def _is_private_or_local_proxy_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return only RFC1918/ULA and local proxy ranges, excluding documentation IPs."""
    if ip_obj.is_loopback or ip_obj.is_link_local:
        return True

    packed = ip_obj.packed
    if ip_obj.version == 4:
        first, second = packed[0], packed[1]
        return first == 10 or (first == 172 and 16 <= second <= 31) or (first == 192 and second == 168)

    return (packed[0] & 0xFE) == 0xFC


def _is_trusted_proxy_host(direct_host: str) -> bool:
    normalized = _validate_and_normalize_ip(direct_host)
    if not normalized:
        return False
    try:
        ip_obj = ipaddress.ip_address(normalized)
        return _is_trusted_proxy_ip(ip_obj)
    except ValueError:
        return False


def request_client_ip(request: Optional[Request]) -> str:
    if request is None:
        return "unknown"

    direct_host = ""
    if request.client and request.client.host:
        direct_host = str(request.client.host).strip()

    normalized_direct = _validate_and_normalize_ip(direct_host)
    if not normalized_direct:
        return direct_host or "unknown"

    try:
        direct_ip_obj = ipaddress.ip_address(normalized_direct)
    except ValueError:
        return normalized_direct

    if not _is_trusted_proxy_ip(direct_ip_obj):
        return normalized_direct

    if TRUST_CF_CONNECTING_IP:
        cf_raw = str(request.headers.get("cf-connecting-ip", "")).strip()
        normalized_cf = _validate_and_normalize_ip(cf_raw)
        if normalized_cf:
            return normalized_cf

    if TRUST_X_FORWARDED_FOR:
        xff_raw = str(request.headers.get("x-forwarded-for", "")).strip()
        if xff_raw:
            raw_hops = [part.strip() for part in xff_raw.split(",") if part.strip()]
            client_candidate = normalized_direct
            for raw_hop in reversed(raw_hops):
                norm_hop = _validate_and_normalize_ip(raw_hop)
                if norm_hop is None:
                    # Malformed entry; stop traversing further left
                    break
                try:
                    hop_ip_obj = ipaddress.ip_address(norm_hop)
                except ValueError:
                    break
                client_candidate = norm_hop
                if not _is_trusted_proxy_ip(hop_ip_obj):
                    return client_candidate
            return client_candidate

    return normalized_direct


def request_scope_path(request: Optional[Request]) -> str:
    if request is None:
        return ""
    scope = getattr(request, "scope", {}) or {}
    path = str(scope.get("path") or "").strip()
    return path or "/"


def is_protected_ops_request(request: Request) -> bool:
    path = request_scope_path(request)
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
