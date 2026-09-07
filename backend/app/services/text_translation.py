import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from app.core.redis_store import cache_get_json, cache_set_json
from app.core.security import build_rate_limiter
from app.core.settings import (
    LIBRETRANSLATE_API_KEY,
    LIBRETRANSLATE_URL,
    ML_INTEREST_TRANSLATION_DEBUG,
    ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS,
    ML_INTEREST_TRANSLATION_CACHE_TTL_SEC,
    ML_INTEREST_TRANSLATION_ENABLED,
    ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC,
    ML_INTEREST_TRANSLATION_PROVIDER,
    ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS,
    ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC,
    ML_INTEREST_TRANSLATION_SOURCE,
    ML_INTEREST_TRANSLATION_TARGET,
    ML_INTEREST_TRANSLATION_TIMEOUT_SEC,
)


_TRANSLATION_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_TRANSLATION_CACHE_LOCK = threading.Lock()
_TRANSLATION_REDIS_KEY_PREFIX = "translation:ml-interest"
_TRANSLATION_RATE_LIMITER = build_rate_limiter(
    limit=ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS,
    window_seconds=ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC,
    redis_key_prefix="translation:rate-limit",
)
_PROVIDER_BACKOFF_UNTIL = 0.0
_PROVIDER_CONSECUTIVE_FAILURES = 0
_PROVIDER_CIRCUIT_STATE = "CLOSED"
_PROVIDER_BACKOFF_LOCK = threading.Lock()
_LOGGER = logging.getLogger("unisearch.translation")
_PROVIDER_STATUS_CACHE: Dict[str, Any] = {"ts": 0.0, "value": None}
_PROVIDER_STATUS_CACHE_LOCK = threading.Lock()
_PROVIDER_STATUS_CACHE_TTL_SEC = 20.0


def _text_fingerprint(value: Any) -> str:
    raw = str(value or "")
    return hashlib.sha256(raw.encode("utf-8", errors="ignore")).hexdigest()[:16]


def _debug_log(event: str, **fields: Any) -> None:
    if not ML_INTEREST_TRANSLATION_DEBUG:
        return
    payload = {k: fields.get(k) for k in sorted(fields.keys())}
    _LOGGER.info("translation_debug %s %s", event, payload)


def _normalize_source_hint(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if raw in ("eng", "en", "en-us", "en-gb") or raw.startswith("en"):
        return "en"
    if raw in ("rus", "ru", "ru-ru") or raw.startswith("ru"):
        return "ru"
    return ""


def _detect_source_lang(text: str, source_hint: Any = "") -> str:
    hinted = _normalize_source_hint(source_hint)
    if hinted:
        return hinted
    if not text:
        return "auto"
    return "auto"


def _cache_key(provider: str, source_lang: str, target_lang: str, text: str) -> str:
    base = f"{provider}|{source_lang}|{target_lang}|{text}"
    return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    redis_row = cache_get_json(f"{_TRANSLATION_REDIS_KEY_PREFIX}:{key}")
    if isinstance(redis_row, dict):
        return {
            "text": str(redis_row.get("text") or ""),
            "translated": bool(redis_row.get("translated")),
            "source": str(redis_row.get("source") or ""),
            "provider": str(redis_row.get("provider") or ""),
        }

    now = time.time()
    with _TRANSLATION_CACHE_LOCK:
        row = _TRANSLATION_CACHE.get(key)
        if not row:
            return None
        if (now - float(row.get("ts", 0.0))) > ML_INTEREST_TRANSLATION_CACHE_TTL_SEC:
            _TRANSLATION_CACHE.pop(key, None)
            return None
        _TRANSLATION_CACHE.move_to_end(key)
        return {
            "text": str(row.get("text") or ""),
            "translated": bool(row.get("translated")),
            "source": str(row.get("source") or ""),
            "provider": str(row.get("provider") or ""),
        }


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    row = {
        "text": str(value.get("text") or ""),
        "translated": bool(value.get("translated")),
        "source": str(value.get("source") or ""),
        "provider": str(value.get("provider") or ""),
    }
    cache_set_json(
        f"{_TRANSLATION_REDIS_KEY_PREFIX}:{key}",
        row,
        ttl_seconds=ML_INTEREST_TRANSLATION_CACHE_TTL_SEC,
    )

    now = time.time()
    with _TRANSLATION_CACHE_LOCK:
        _TRANSLATION_CACHE[key] = {
            "ts": now,
            **row,
        }
        _TRANSLATION_CACHE.move_to_end(key)
        while len(_TRANSLATION_CACHE) > ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS:
            _TRANSLATION_CACHE.popitem(last=False)


def _provider_record_success() -> None:
    global _PROVIDER_CONSECUTIVE_FAILURES, _PROVIDER_CIRCUIT_STATE, _PROVIDER_BACKOFF_UNTIL
    with _PROVIDER_BACKOFF_LOCK:
        _PROVIDER_CONSECUTIVE_FAILURES = 0
        _PROVIDER_CIRCUIT_STATE = "CLOSED"
        _PROVIDER_BACKOFF_UNTIL = 0.0


def _provider_record_failure() -> None:
    global _PROVIDER_CONSECUTIVE_FAILURES, _PROVIDER_CIRCUIT_STATE, _PROVIDER_BACKOFF_UNTIL
    if ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC <= 0:
        return
    with _PROVIDER_BACKOFF_LOCK:
        _PROVIDER_CONSECUTIVE_FAILURES += 1
        backoff_duration = float(ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC)
        if _PROVIDER_CONSECUTIVE_FAILURES >= 2 or _PROVIDER_CIRCUIT_STATE == "HALF_OPEN":
            _PROVIDER_CIRCUIT_STATE = "OPEN"
            multiplier = min(4, 2 ** (_PROVIDER_CONSECUTIVE_FAILURES - 2))
            _PROVIDER_BACKOFF_UNTIL = time.time() + (backoff_duration * multiplier)
        else:
            _PROVIDER_BACKOFF_UNTIL = time.time() + backoff_duration


def _provider_set_backoff() -> None:
    _provider_record_failure()


def _provider_in_backoff() -> bool:
    global _PROVIDER_CIRCUIT_STATE
    with _PROVIDER_BACKOFF_LOCK:
        now = time.time()
        if now < _PROVIDER_BACKOFF_UNTIL:
            return True
        if _PROVIDER_CIRCUIT_STATE == "OPEN":
            _PROVIDER_CIRCUIT_STATE = "HALF_OPEN"
            return False
        return False


def _http_post_json(url: str, body: Dict[str, Any], timeout_sec: float) -> Dict[str, Any]:
    req = UrlRequest(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "UniSearch-Translator/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=max(0.25, float(timeout_sec))) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise RuntimeError("Translator returned non-JSON response")
        return data
    except HTTPError as e:
        raise RuntimeError(f"Translator HTTP {e.code}") from e
    except URLError as e:
        raise RuntimeError(f"Translator network error: {getattr(e, 'reason', e)}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Translator invalid JSON: {e}") from e


def _http_get_json(url: str, timeout_sec: float) -> Any:
    req = UrlRequest(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "UniSearch-Translator/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=max(0.25, float(timeout_sec))) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        return json.loads(raw)
    except HTTPError as e:
        raise RuntimeError(f"Translator HTTP {e.code}") from e
    except URLError as e:
        raise RuntimeError(f"Translator network error: {getattr(e, 'reason', e)}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Translator invalid JSON: {e}") from e


def _libretranslate_request(text: str, source_lang: str, target_lang: str) -> str:
    if not LIBRETRANSLATE_URL:
        raise RuntimeError("LIBRETRANSLATE_URL is not configured")
    body: Dict[str, Any] = {
        "q": text,
        "source": source_lang or ML_INTEREST_TRANSLATION_SOURCE or "auto",
        "target": target_lang or "en",
        "format": "text",
    }
    if LIBRETRANSLATE_API_KEY:
        body["api_key"] = LIBRETRANSLATE_API_KEY
    data = _http_post_json(
        LIBRETRANSLATE_URL,
        body,
        timeout_sec=ML_INTEREST_TRANSLATION_TIMEOUT_SEC,
    )
    out = str(data.get("translatedText") or "").strip()
    if not out:
        raise RuntimeError("Translator response missing translatedText")
    return out


def _libretranslate_languages_url() -> str:
    base = str(LIBRETRANSLATE_URL or "").strip()
    if not base:
        return ""
    if base.endswith("/translate"):
        return f"{base[:-len('/translate')]}/languages"
    return f"{base.rstrip('/')}/languages"


def _libretranslate_provider_available(timeout_sec: float = 1.2) -> Dict[str, Any]:
    url = _libretranslate_languages_url()
    if not url:
        return {"available": False, "reason": "url_missing", "error": "LIBRETRANSLATE_URL is not configured"}
    try:
        payload = _http_get_json(url, timeout_sec=timeout_sec)
        is_ok = isinstance(payload, list)
        return {
            "available": bool(is_ok),
            "reason": "ok" if is_ok else "unexpected_response",
            "languagesCount": len(payload) if isinstance(payload, list) else 0,
        }
    except Exception as exc:
        return {
            "available": False,
            "reason": "provider_error",
            "error": str(exc),
        }


def get_translation_runtime_status(force_check: bool = False) -> Dict[str, Any]:
    provider = str(ML_INTEREST_TRANSLATION_PROVIDER or "none").strip().lower() or "none"
    status = {
        "enabled": bool(ML_INTEREST_TRANSLATION_ENABLED),
        "provider": provider,
        "target": str(ML_INTEREST_TRANSLATION_TARGET or "en").strip().lower() or "en",
        "source": str(ML_INTEREST_TRANSLATION_SOURCE or "auto").strip().lower() or "auto",
        "urlConfigured": bool(str(LIBRETRANSLATE_URL or "").strip()),
        "available": False,
        "reason": "",
        "error": "",
    }
    if not status["enabled"]:
        status["reason"] = "disabled"
        return status
    if provider != "libretranslate":
        status["reason"] = "provider_not_supported"
        return status

    now = time.time()
    if not force_check:
        with _PROVIDER_STATUS_CACHE_LOCK:
            cached = _PROVIDER_STATUS_CACHE.get("value")
            ts = float(_PROVIDER_STATUS_CACHE.get("ts") or 0.0)
            if isinstance(cached, dict) and (now - ts) < _PROVIDER_STATUS_CACHE_TTL_SEC:
                out = dict(status)
                out.update(cached)
                return out

    if _provider_in_backoff():
        result = {
            "available": False,
            "reason": "provider_backoff",
            "error": "",
        }
    else:
        result = _libretranslate_provider_available(timeout_sec=min(1.5, ML_INTEREST_TRANSLATION_TIMEOUT_SEC))

    with _PROVIDER_STATUS_CACHE_LOCK:
        _PROVIDER_STATUS_CACHE["ts"] = time.time()
        _PROVIDER_STATUS_CACHE["value"] = dict(result)

    out = dict(status)
    out.update(result)
    return out


def translate_interest_text_for_ml(
    text: Any,
    source_hint: Any = "",
    client_key: str = "",
) -> Dict[str, Any]:
    raw = str(text or "").strip()
    _debug_log(
        "request_received",
        source_hint=str(source_hint or ""),
        text_hash=_text_fingerprint(raw),
        text_len=len(raw),
    )
    if not raw:
        _debug_log("skip_empty")
        return {
            "text": "",
            "translated": False,
            "source": "auto",
            "provider": "none",
            "reason": "empty",
            "cacheHit": False,
        }

    detected_source = _detect_source_lang(raw, source_hint)
    source_lang = str(ML_INTEREST_TRANSLATION_SOURCE or "auto").strip().lower() or "auto"

    provider = str(ML_INTEREST_TRANSLATION_PROVIDER or "none").strip().lower()
    target = str(ML_INTEREST_TRANSLATION_TARGET or "en").strip().lower() or "en"
    if not ML_INTEREST_TRANSLATION_ENABLED or provider != "libretranslate":
        _debug_log(
            "skip_disabled",
            provider=provider,
            detected_source=detected_source,
            enabled=bool(ML_INTEREST_TRANSLATION_ENABLED),
        )
        return {
            "text": raw,
            "translated": False,
            "source": detected_source,
            "provider": "none",
            "reason": "disabled",
            "cacheHit": False,
        }
    if _provider_in_backoff():
        _debug_log("skip_provider_backoff", provider=provider, detected_source=detected_source)
        return {
            "text": raw,
            "translated": False,
            "source": detected_source,
            "provider": provider,
            "reason": "provider_backoff",
            "cacheHit": False,
        }

    cache_key = _cache_key(provider, source_lang, target, raw)
    cached = _cache_get(cache_key)
    if cached is not None:
        out = dict(cached)
        out["reason"] = "cache_hit"
        out["cacheHit"] = True
        _debug_log(
            "cache_hit",
            provider=provider,
            detected_source=detected_source,
            translated=bool(out.get("translated")),
            out_text_hash=_text_fingerprint(out.get("text")),
        )
        return out

    limiter_key = str(client_key or "global").strip() or "global"
    allowed, _, retry_after = _TRANSLATION_RATE_LIMITER.check(limiter_key)
    if not allowed:
        _debug_log(
            "skip_rate_limited",
            provider=provider,
            detected_source=detected_source,
            retry_after=max(1, int(round(retry_after))),
        )
        return {
            "text": raw,
            "translated": False,
            "source": detected_source,
            "provider": provider,
            "reason": "rate_limited",
            "retryAfterSec": max(1, int(round(retry_after))),
            "cacheHit": False,
        }

    try:
        translated_text = _libretranslate_request(raw, source_lang or "auto", target)
        _provider_record_success()
    except Exception as exc:
        _provider_set_backoff()
        _debug_log(
            "provider_error",
            provider=provider,
            detected_source=detected_source,
            error=str(exc),
            text_hash=_text_fingerprint(raw),
            text_len=len(raw),
        )
        return {
            "text": raw,
            "translated": False,
            "source": detected_source,
            "provider": provider,
            "reason": "provider_error",
            "error": str(exc),
            "cacheHit": False,
        }

    out = {
        "text": translated_text,
        "translated": translated_text.strip().lower() != raw.strip().lower(),
        "source": detected_source,
        "provider": provider,
        "reason": "translated",
        "cacheHit": False,
    }
    _debug_log(
        "translated",
        provider=provider,
        detected_source=detected_source,
        translated=bool(out.get("translated")),
        in_text_hash=_text_fingerprint(raw),
        out_text_hash=_text_fingerprint(translated_text),
        in_text_len=len(raw),
        out_text_len=len(translated_text),
    )
    _cache_set(cache_key, out)
    return out
