import json
import logging
import math
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from app.core.paths import CURRENCY_FILTER_LIMITS_PATH
from app.core.redis_store import cache_get_json, cache_set_json
from app.core.settings import (
    CURRENCY_RATES_API_URL,
    CURRENCY_RATES_BACKOFF_SEC,
    CURRENCY_RATES_CACHE_TTL_SEC,
    CURRENCY_RATES_ENABLED,
    CURRENCY_RATES_TIMEOUT_SEC,
)

_LOGGER = logging.getLogger("unisearch.currency")
_CURRENCY_CODE_RE = re.compile(r"^[A-Z]{3,5}$")

# Static fallback rates (62 currencies) relative to base USD (1 USD = X currency)
# Used when both API and caches (Redis, in-memory) are unavailable
FALLBACK_RATES: Dict[str, float] = {
    "KZT": 450.00,
    "RUB": 84.37,
    "UZS": 11792.97,
    "KGS": 87.49,
    "BYN": 3.04,
    "TJS": 9.23,
    "UAH": 44.62,
    "MDL": 17.25,
    "AZN": 1.70,
    "GEL": 2.61,
    "AMD": 363.83,
    "EUR": 0.86,
    "GBP": 0.74,
    "CHF": 0.81,
    "PLN": 3.72,
    "CZK": 20.87,
    "HUF": 313.96,
    "RON": 4.30,
    "BGN": 1.68,
    "RSD": 101.00,
    "SEK": 9.67,
    "NOK": 9.27,
    "DKK": 6.43,
    "ISK": 125.00,
    "USD": 1.00,
    "CAD": 1.38,
    "BRL": 5.11,
    "MXN": 16.97,
    "ARS": 950.00,
    "CLP": 910.00,
    "COP": 3950.00,
    "PEN": 3.70,
    "AUD": 1.39,
    "CNY": 6.73,
    "HKD": 7.84,
    "IDR": 17561.81,
    "INR": 95.51,
    "JPY": 154.25,
    "KRW": 1345.06,
    "MYR": 4.07,
    "NZD": 1.72,
    "PHP": 62.66,
    "PKR": 278.00,
    "BDT": 118.00,
    "SGD": 1.27,
    "THB": 33.00,
    "TWD": 31.60,
    "VND": 25879.19,
    "MNT": 3450.00,
    "AED": 3.67,
    "BHD": 0.38,
    "EGP": 47.00,
    "ILS": 3.04,
    "KES": 130.00,
    "KWD": 0.31,
    "MAD": 9.80,
    "NGN": 1450.00,
    "OMR": 0.38,
    "QAR": 3.64,
    "SAR": 3.75,
    "TRY": 48.56,
    "ZAR": 16.19,
}


_CIRCUIT_STATE = "CLOSED"  # "CLOSED", "OPEN", "HALF_OPEN"
_CONSECUTIVE_FAILURES = 0
_BACKOFF_UNTIL = 0.0
_CIRCUIT_LOCK = threading.Lock()

_MEMORY_CACHE: Dict[str, Any] = {}
_CACHE_LOCK = threading.Lock()

_FILTER_LIMITS_CACHE: Optional[Dict[str, Dict[str, int]]] = None
_FILTER_LIMITS_LOCK = threading.Lock()

_LAST_FETCH_TIME: Optional[float] = None
_LAST_FETCH_SOURCE: Optional[str] = None
_LAST_ERROR: Optional[str] = None


def _record_success() -> None:
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL, _LAST_ERROR
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES = 0
        _CIRCUIT_STATE = "CLOSED"
        _BACKOFF_UNTIL = 0.0
        _LAST_ERROR = None


def _record_failure(error_msg: str) -> None:
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL, _LAST_ERROR
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES += 1
        _LAST_ERROR = error_msg
        if CURRENCY_RATES_BACKOFF_SEC <= 0:
            return
        backoff_duration = float(CURRENCY_RATES_BACKOFF_SEC)
        if _CONSECUTIVE_FAILURES >= 2 or _CIRCUIT_STATE == "HALF_OPEN":
            _CIRCUIT_STATE = "OPEN"
            multiplier = min(4, 2 ** (_CONSECUTIVE_FAILURES - 2))
            _BACKOFF_UNTIL = time.time() + (backoff_duration * multiplier)
        else:
            _BACKOFF_UNTIL = time.time() + backoff_duration


def _in_backoff() -> bool:
    global _CIRCUIT_STATE
    with _CIRCUIT_LOCK:
        now = time.time()
        if now < _BACKOFF_UNTIL:
            return True
        if _CIRCUIT_STATE == "OPEN":
            _CIRCUIT_STATE = "HALF_OPEN"
            return False
        return False


def _clear_cache_for_testing() -> None:
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL, _LAST_ERROR
    global _LAST_FETCH_TIME, _LAST_FETCH_SOURCE, _FILTER_LIMITS_CACHE
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES = 0
        _CIRCUIT_STATE = "CLOSED"
        _BACKOFF_UNTIL = 0.0
        _LAST_ERROR = None
    with _CACHE_LOCK:
        _MEMORY_CACHE.clear()
    with _FILTER_LIMITS_LOCK:
        _FILTER_LIMITS_CACHE = None
    _LAST_FETCH_TIME = None
    _LAST_FETCH_SOURCE = None


def fetch_rates(base: str = "USD") -> Dict[str, Any]:
    """Fetches real-time exchange rates from the configured API provider using urllib.request."""
    base_code = (base or "USD").strip().upper()
    if not _CURRENCY_CODE_RE.match(base_code):
        raise ValueError(f"Invalid base currency code: {base}")

    url = CURRENCY_RATES_API_URL
    if not (url.startswith("https://") or url.startswith("http://")):
        raise RuntimeError("Invalid currency API URL scheme: must start with https:// or http://")

    if "{base}" in url:
        url = url.format(base=base_code)
    elif url.endswith("/USD") and base_code != "USD":
        url = f"{url[:-3]}{base_code}"

    req = UrlRequest(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "UniSearch-CurrencyService/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=max(0.5, float(CURRENCY_RATES_TIMEOUT_SEC))) as response:
            raw = response.read().decode("utf-8", errors="ignore")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise RuntimeError("Currency API returned non-JSON response")
        if data.get("result") == "error":
            err_type = data.get("error-type", "unknown")
            raise RuntimeError(f"Currency API error: {err_type}")

        raw_rates = data.get("rates")
        if not isinstance(raw_rates, dict) or not raw_rates:
            raise RuntimeError("Currency API returned empty rates")

        rates: Dict[str, float] = {}
        for code, rate in raw_rates.items():
            if not isinstance(code, str):
                continue
            code_upper = code.strip().upper()
            if not _CURRENCY_CODE_RE.match(code_upper):
                continue
            if isinstance(rate, (int, float)) and math.isfinite(rate) and 0 < rate < 1e12:
                rates[code_upper] = float(rate)

        if not rates:
            raise RuntimeError("Currency API returned no valid rates")

        if base_code not in rates or rates[base_code] != 1.0:
            rates[base_code] = 1.0

        date_str = str(data.get("time_last_update_utc") or "")
        if not date_str:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        return {
            "rates": rates,
            "date": date_str,
            "source": "api",
        }
    except HTTPError as e:
        raise RuntimeError(f"Currency API HTTP {e.code}") from e
    except URLError as e:
        raise RuntimeError(f"Currency API network error: {getattr(e, 'reason', e)}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Currency API invalid JSON: {e}") from e


def get_rates(base: str = "USD", force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns currency exchange rates using two-tier cache (memory + Redis),
    with fallback to API and static FALLBACK_RATES.
    """
    global _LAST_FETCH_TIME, _LAST_FETCH_SOURCE
    base_code = (base or "USD").strip().upper()
    now = time.time()
    redis_key = f"currency:rates:{base_code}"

    # Tier 1: In-memory cache
    if not force_refresh:
        with _CACHE_LOCK:
            mem = _MEMORY_CACHE.get(base_code)
            if mem:
                age = now - float(mem.get("ts", 0.0))
                if age <= CURRENCY_RATES_CACHE_TTL_SEC and mem.get("rates"):
                    _LAST_FETCH_SOURCE = "cache"
                    return {
                        "rates": dict(mem["rates"]),
                        "date": mem.get("date", ""),
                        "source": "cache",
                    }

    # Tier 2: Redis cache
    if not force_refresh:
        redis_cached = cache_get_json(redis_key)
        if isinstance(redis_cached, dict) and isinstance(redis_cached.get("rates"), dict):
            parsed_rates = {
                str(k).upper(): float(v)
                for k, v in redis_cached["rates"].items()
                if isinstance(v, (int, float)) and v > 0
            }
            if parsed_rates:
                date_str = str(redis_cached.get("date") or "")
                with _CACHE_LOCK:
                    _MEMORY_CACHE[base_code] = {
                        "rates": parsed_rates,
                        "date": date_str,
                        "ts": now,
                    }
                _LAST_FETCH_TIME = now
                _LAST_FETCH_SOURCE = "cache"
                return {
                    "rates": dict(parsed_rates),
                    "date": date_str,
                    "source": "cache",
                }

    # API fetch if enabled and not backing off
    if CURRENCY_RATES_ENABLED and not _in_backoff():
        try:
            fetched = fetch_rates(base=base_code)
            rates = fetched["rates"]
            date_str = fetched.get("date", "")
            _record_success()
            _LAST_FETCH_TIME = now
            _LAST_FETCH_SOURCE = "api"

            # Populate in-memory & Redis caches
            with _CACHE_LOCK:
                _MEMORY_CACHE[base_code] = {
                    "rates": rates,
                    "date": date_str,
                    "ts": now,
                }
            cache_set_json(
                redis_key,
                {"rates": rates, "date": date_str},
                ttl_seconds=CURRENCY_RATES_CACHE_TTL_SEC,
            )
            return {
                "rates": dict(rates),
                "date": date_str,
                "source": "api",
            }
        except Exception as e:
            _record_failure(str(e))
            _LOGGER.warning("Failed to fetch rates from API (%s): %s", CURRENCY_RATES_API_URL, e)

    # Fallback to in-memory cache even if slightly stale, before falling back to static
    with _CACHE_LOCK:
        mem = _MEMORY_CACHE.get(base_code)
        if mem and mem.get("rates"):
            _LAST_FETCH_SOURCE = "cache"
            return {
                "rates": dict(mem["rates"]),
                "date": mem.get("date", ""),
                "source": "cache",
            }

    # Static fallback
    _LAST_FETCH_SOURCE = "fallback"
    return {
        "rates": dict(FALLBACK_RATES),
        "date": "fallback",
        "source": "fallback",
    }


def convert(amount: float, from_currency: str, to_currency: str) -> float:
    """
    Synchronously converts an amount from one currency to another using cached rates.
    Throws ValueError for invalid amounts or unsupported currency codes.
    """
    if amount is None:
        raise ValueError("Amount cannot be None")
    try:
        num_amount = float(amount)
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid amount: {amount}") from e

    if not math.isfinite(num_amount) or abs(num_amount) > 1e15:
        raise ValueError("Amount must be a finite number within valid bounds")

    from_c = (from_currency or "").strip().upper()
    to_c = (to_currency or "").strip().upper()

    if not _CURRENCY_CODE_RE.match(from_c):
        raise ValueError(f"Unsupported or unknown currency: {from_currency}")
    if not _CURRENCY_CODE_RE.match(to_c):
        raise ValueError(f"Unsupported or unknown currency: {to_currency}")

    if from_c == to_c:
        return num_amount

    rates_info = get_rates()
    rates = rates_info.get("rates") or {}

    if from_c not in rates:
        raise ValueError(f"Unsupported or unknown currency: {from_currency}")
    if to_c not in rates:
        raise ValueError(f"Unsupported or unknown currency: {to_currency}")

    from_rate = rates[from_c]
    to_rate = rates[to_c]

    if from_rate <= 0 or to_rate <= 0 or not math.isfinite(from_rate) or not math.isfinite(to_rate):
        raise ValueError(f"Invalid rate for currency pair {from_c}/{to_c}")

    usd_amount = num_amount / from_rate
    return usd_amount * to_rate


def load_filter_limits_config() -> Dict[str, Dict[str, int]]:
    """Loads and caches currency slider bounds from currency_filter_limits.json."""
    global _FILTER_LIMITS_CACHE
    with _FILTER_LIMITS_LOCK:
        if _FILTER_LIMITS_CACHE is not None:
            return dict(_FILTER_LIMITS_CACHE)

        try:
            with open(CURRENCY_FILTER_LIMITS_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                cleaned: Dict[str, Dict[str, int]] = {}
                for k, v in raw.items():
                    if k.startswith("_") or not isinstance(v, dict):
                        continue
                    key = "default" if k.lower() == "default" else k.upper()
                    cleaned[key] = {
                        "min": max(0, int(v.get("min", 0))),
                        "max": max(1, int(v.get("max", 50000))),
                        "step": max(1, int(v.get("step", 100))),
                    }
                _FILTER_LIMITS_CACHE = cleaned
                return dict(cleaned)
        except Exception as e:
            _LOGGER.warning("Failed to load currency filter limits from %s: %s", CURRENCY_FILTER_LIMITS_PATH, e)

        default_cfg = {
            "default": {"min": 0, "max": 50000, "step": 100},
            "USD": {"min": 0, "max": 50000, "step": 100},
        }
        _FILTER_LIMITS_CACHE = default_cfg
        return dict(default_cfg)


def get_filter_limits(currency_code: str) -> Dict[str, int]:
    """
    Returns slider bounds for a currency.
    If the currency is configured in currency_filter_limits.json, returns its specific limits.
    Otherwise, converts default USD limits into the target currency using current rates.
    """
    code = (currency_code or "").strip().upper()
    if not _CURRENCY_CODE_RE.match(code):
        raise ValueError(f"Invalid or unsupported currency code: {currency_code}")

    config = load_filter_limits_config()
    if code in config:
        return dict(config[code])

    default_limits = config.get("default") or {"min": 0, "max": 50000, "step": 100}

    # Will raise ValueError if currency code is not in rates
    conv_min = convert(default_limits["min"], "USD", code)
    conv_max = convert(default_limits["max"], "USD", code)
    conv_step = convert(default_limits["step"], "USD", code)

    min_val = max(0, int(round(conv_min)))
    max_val = max(min_val + 1, int(round(conv_max)))
    step_val = max(1, int(round(conv_step)))

    return {
        "min": min_val,
        "max": max_val,
        "step": step_val,
    }


def get_rates_status() -> Dict[str, Any]:
    """Runtime health and diagnostic probe for currency service."""
    rates_info = get_rates()
    now = time.time()
    with _CACHE_LOCK:
        mem = _MEMORY_CACHE.get("USD", {})
        cache_ts = float(mem.get("ts", 0.0)) if mem else 0.0

    staleness = round(now - cache_ts, 2) if cache_ts > 0 else None

    with _CIRCUIT_LOCK:
        state = _CIRCUIT_STATE
        failures = _CONSECUTIVE_FAILURES
        last_err = _LAST_ERROR

    safe_last_err = str(last_err)[:200] if last_err else None

    return {
        "enabled": bool(CURRENCY_RATES_ENABLED),
        "source": rates_info.get("source", "unknown"),
        "date": rates_info.get("date"),
        "circuit_state": state,
        "consecutive_failures": failures,
        "rates_count": len(rates_info.get("rates") or {}),
        "last_fetch": _LAST_FETCH_TIME,
        "staleness_sec": staleness,
        "last_error": safe_last_err,
    }

