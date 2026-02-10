import hashlib
import json
import re
import threading
import time
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from app.core.security import SlidingWindowRateLimiter
from app.core.settings import (
    LIBRETRANSLATE_API_KEY,
    LIBRETRANSLATE_URL,
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


_CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
_KAZAKH_CYRILLIC_RE = re.compile(r"[ӘәҒғҚқҢңӨөҰұҮүІіҺһ]")
_LATIN_RE = re.compile(r"[A-Za-z]")

_TRANSLATION_CACHE: Dict[str, Dict[str, Any]] = {}
_TRANSLATION_CACHE_LOCK = threading.Lock()
_TRANSLATION_RATE_LIMITER = SlidingWindowRateLimiter(
    limit=ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS,
    window_seconds=ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC,
)
_PROVIDER_BACKOFF_UNTIL = 0.0
_PROVIDER_BACKOFF_LOCK = threading.Lock()


def _normalize_source_hint(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if raw in ("eng", "en", "en-us", "en-gb") or raw.startswith("en"):
        return "en"
    if raw in ("rus", "ru", "ru-ru") or raw.startswith("ru"):
        return "ru"
    if raw in ("kk", "kz", "kaz", "kk-kz", "kz-kz") or raw.startswith("kk") or raw.startswith("kz"):
        return "kk"
    return ""


def _detect_source_lang(text: str, source_hint: Any = "") -> str:
    hinted = _normalize_source_hint(source_hint)
    if hinted:
        return hinted

    if not text:
        return "auto"

    cyr = len(_CYRILLIC_RE.findall(text))
    lat = len(_LATIN_RE.findall(text))
    if cyr <= 0:
        return "en" if lat > 0 else "auto"

    if _KAZAKH_CYRILLIC_RE.search(text):
        return "kk"
    return "ru"


def _cache_key(provider: str, source_lang: str, target_lang: str, text: str) -> str:
    base = f"{provider}|{source_lang}|{target_lang}|{text}"
    return hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    now = time.time()
    with _TRANSLATION_CACHE_LOCK:
        stale = [
            k
            for k, row in _TRANSLATION_CACHE.items()
            if (now - float(row.get("ts", 0.0))) > ML_INTEREST_TRANSLATION_CACHE_TTL_SEC
        ]
        for stale_key in stale:
            _TRANSLATION_CACHE.pop(stale_key, None)

        row = _TRANSLATION_CACHE.get(key)
        if not row:
            return None
        return {
            "text": str(row.get("text") or ""),
            "translated": bool(row.get("translated")),
            "source": str(row.get("source") or ""),
            "provider": str(row.get("provider") or ""),
        }


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    now = time.time()
    with _TRANSLATION_CACHE_LOCK:
        _TRANSLATION_CACHE[key] = {
            "ts": now,
            "text": str(value.get("text") or ""),
            "translated": bool(value.get("translated")),
            "source": str(value.get("source") or ""),
            "provider": str(value.get("provider") or ""),
        }
        if len(_TRANSLATION_CACHE) <= ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS:
            return

        overflow = len(_TRANSLATION_CACHE) - ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS
        if overflow <= 0:
            return
        oldest_keys = sorted(
            _TRANSLATION_CACHE.keys(),
            key=lambda k: float(_TRANSLATION_CACHE[k].get("ts", 0.0)),
        )
        for stale_key in oldest_keys[:overflow]:
            _TRANSLATION_CACHE.pop(stale_key, None)


def _provider_in_backoff() -> bool:
    with _PROVIDER_BACKOFF_LOCK:
        return time.time() < _PROVIDER_BACKOFF_UNTIL


def _provider_set_backoff() -> None:
    global _PROVIDER_BACKOFF_UNTIL
    if ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC <= 0:
        return
    with _PROVIDER_BACKOFF_LOCK:
        _PROVIDER_BACKOFF_UNTIL = time.time() + float(ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC)


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


def translate_interest_text_for_ml(
    text: Any,
    source_hint: Any = "",
    client_key: str = "",
) -> Dict[str, Any]:
    raw = str(text or "").strip()
    if not raw:
        return {
            "text": "",
            "translated": False,
            "source": "auto",
            "provider": "none",
            "reason": "empty",
            "cacheHit": False,
        }

    source_lang = _detect_source_lang(raw, source_hint)
    if source_lang == "en":
        return {
            "text": raw,
            "translated": False,
            "source": source_lang,
            "provider": "none",
            "reason": "already_english",
            "cacheHit": False,
        }

    provider = str(ML_INTEREST_TRANSLATION_PROVIDER or "none").strip().lower()
    target = str(ML_INTEREST_TRANSLATION_TARGET or "en").strip().lower() or "en"
    if not ML_INTEREST_TRANSLATION_ENABLED or provider != "libretranslate":
        return {
            "text": raw,
            "translated": False,
            "source": source_lang,
            "provider": "none",
            "reason": "disabled",
            "cacheHit": False,
        }
    if _provider_in_backoff():
        return {
            "text": raw,
            "translated": False,
            "source": source_lang,
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
        return out

    limiter_key = str(client_key or "global").strip() or "global"
    allowed, _, retry_after = _TRANSLATION_RATE_LIMITER.check(limiter_key)
    if not allowed:
        return {
            "text": raw,
            "translated": False,
            "source": source_lang,
            "provider": provider,
            "reason": "rate_limited",
            "retryAfterSec": max(1, int(round(retry_after))),
            "cacheHit": False,
        }

    try:
        translated_text = _libretranslate_request(raw, source_lang or "auto", target)
    except Exception:
        _provider_set_backoff()
        return {
            "text": raw,
            "translated": False,
            "source": source_lang,
            "provider": provider,
            "reason": "provider_error",
            "cacheHit": False,
        }

    out = {
        "text": translated_text,
        "translated": translated_text.strip().lower() != raw.strip().lower(),
        "source": source_lang,
        "provider": provider,
        "reason": "translated",
        "cacheHit": False,
    }
    _cache_set(cache_key, out)
    return out
