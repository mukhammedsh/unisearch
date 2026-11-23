import json
import logging
import math
import re
import threading
import time
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

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

# Static fallback rates for supported world currencies relative to base USD (1 USD = X currency)
# Used when both API and caches (Redis, in-memory) are unavailable
FALLBACK_RATES_DATE: str = "2026-11-18"  # ExchangeRate-API time_last_update_utc: Wed, 18 Nov 2026 00:02:31 +0000
FALLBACK_RATES: dict[str, float] = {
    "USD": 1.0,
    "AED": 3.6725,
    "AFN": 65.569445,
    "ALL": 82.33211,
    "AMD": 360.496742,
    "ANG": 1.79,
    "AOA": 929.147823,
    "ARS": 1552.2627,
    "AUD": 1.48436,
    "AWG": 1.79,
    "AZN": 1.700728,
    "BAM": 1.778167,
    "BBD": 2.0,
    "BDT": 124.86223,
    "BGN": 1.778167,
    "BHD": 0.376,
    "BIF": 3006.888053,
    "BMD": 1.0,
    "BND": 1.288383,
    "BOB": 11.662995,
    "BRL": 5.781701,
    "BSD": 1.0,
    "BTN": 93.516187,
    "BWP": 14.508283,
    "BYN": 3.000459,
    "BZD": 2.0,
    "CAD": 1.429407,
    "CDF": 2308.716632,
    "CHF": 0.840712,
    "CLF": 0.025263,
    "CLP": 998.564588,
    "CNH": 6.667956,
    "CNY": 6.679863,
    "COP": 3320.186806,
    "CRC": 446.134339,
    "CUP": 24.0,
    "CVE": 100.248771,
    "CZK": 22.170826,
    "DJF": 177.721,
    "DKK": 6.800425,
    "DOP": 60.637513,
    "DZD": 137.146457,
    "EGP": 53.717698,
    "ERN": 15.0,
    "ETB": 161.134959,
    "EUR": 0.909215,
    "FJD": 2.296274,
    "FKP": 0.757555,
    "FOK": 6.800422,
    "GBP": 0.757596,
    "GEL": 2.593,
    "GGP": 0.757555,
    "GHS": 11.778354,
    "GIP": 0.757555,
    "GMD": 74.811158,
    "GNF": 8850.036393,
    "GTQ": 7.648031,
    "GYD": 209.072444,
    "HKD": 7.846176,
    "HNL": 26.949218,
    "HRK": 6.850083,
    "HTG": 131.070255,
    "HUF": 332.590881,
    "IDR": 18278.202017,
    "ILS": 3.246957,
    "IMP": 0.757555,
    "INR": 93.513494,
    "IQD": 1513.72549,
    "IRR": 1816886.218373,
    "ISK": 124.365658,
    "JEP": 0.757555,
    "JMD": 158.61453,
    "JOD": 0.709,
    "JPY": 159.393063,
    "KES": 130.099085,
    "KGS": 87.453407,
    "KHR": 4063.157895,
    "KID": 1.48436,
    "KMF": 447.278487,
    "KRW": 1335.360704,
    "KWD": 0.311342,
    "KYD": 0.833333,
    "KZT": 444.34436,
    "LAK": 22344.408775,
    "LBP": 89500.0,
    "LKR": 332.614594,
    "LRD": 169.562219,
    "LSL": 16.929365,
    "LYD": 6.458359,
    "MAD": 9.969406,
    "MDL": 18.254106,
    "MGA": 4579.234102,
    "MKD": 54.865608,
    "MMK": 2101.068478,
    "MNT": 3602.456854,
    "MOP": 8.081579,
    "MRU": 40.690473,
    "MUR": 47.856783,
    "MVR": 15.447647,
    "MWK": 1744.899877,
    "MXN": 18.442572,
    "MYR": 4.093341,
    "MZN": 63.721322,
    "NAD": 16.929365,
    "NGN": 1352.738411,
    "NIO": 36.830151,
    "NOK": 9.623495,
    "NPR": 149.625899,
    "NZD": 1.818615,
    "OMR": 0.384497,
    "PAB": 1.0,
    "PEN": 3.41413,
    "PGK": 4.526625,
    "PHP": 63.683951,
    "PKR": 276.818953,
    "PLN": 4.002539,
    "PYG": 6201.196113,
    "QAR": 3.64,
    "RON": 4.863092,
    "RSD": 106.932051,
    "RUB": 82.343695,
    "RWF": 1479.712832,
    "SAR": 3.75,
    "SBD": 8.017727,
    "SCR": 14.762627,
    "SDG": 446.888567,
    "SEK": 10.116792,
    "SGD": 1.288508,
    "SHP": 0.757555,
    "SLE": 23.06523,
    "SLL": 23065.229822,
    "SOS": 571.851852,
    "SRD": 37.553204,
    "SSP": 5751.280712,
    "STN": 22.274474,
    "SYP": 121.79865,
    "SZL": 16.929365,
    "THB": 33.82355,
    "TJS": 9.208671,
    "TMT": 3.5,
    "TND": 3.031605,
    "TOP": 2.397597,
    "TRY": 50.448894,
    "TTD": 6.765163,
    "TVD": 1.48436,
    "TWD": 32.967382,
    "TZS": 2645.508886,
    "UAH": 45.401903,
    "UGX": 4047.220753,
    "UYU": 40.684563,
    "UZS": 11984.031548,
    "VES": 916.6477,
    "VND": 25704.339633,
    "VUV": 120.845917,
    "WST": 2.778094,
    "XAF": 596.371316,
    "XCD": 2.7,
    "XCG": 1.79,
    "XDR": 0.743691,
    "XOF": 596.371316,
    "XPF": 108.492145,
    "YER": 236.637722,
    "ZAR": 16.926458,
    "ZMW": 20.60103,
    "ZWG": 26.6142,
    "ZWL": 26.6142,
}


_CIRCUIT_STATE = "CLOSED"  # "CLOSED", "OPEN", "HALF_OPEN"
_CONSECUTIVE_FAILURES = 0
_BACKOFF_UNTIL = 0.0
_CIRCUIT_LOCK = threading.Lock()

_MEMORY_CACHE: dict[str, Any] = {}
_CACHE_LOCK = threading.Lock()


def _record_success() -> None:
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES = 0
        _CIRCUIT_STATE = "CLOSED"
        _BACKOFF_UNTIL = 0.0


def _record_failure() -> None:
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES += 1
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
    global _CONSECUTIVE_FAILURES, _CIRCUIT_STATE, _BACKOFF_UNTIL
    with _CIRCUIT_LOCK:
        _CONSECUTIVE_FAILURES = 0
        _CIRCUIT_STATE = "CLOSED"
        _BACKOFF_UNTIL = 0.0
    with _CACHE_LOCK:
        _MEMORY_CACHE.clear()
    _load_filter_limits_config_cached.cache_clear()


def fetch_rates(base: str = "USD") -> dict[str, Any]:
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

        rates: dict[str, float] = {}
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

        if base_code not in rates or not math.isclose(rates[base_code], 1.0):
            rates[base_code] = 1.0

        date_str = str(data.get("time_last_update_utc") or "")
        if not date_str:
            date_str = datetime.now(UTC).strftime("%Y-%m-%d")

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


_REFRESH_LOCK = threading.Lock()


def _refresh_in_background(base_code: str) -> None:
    """Refresh rates in a daemon thread; at most one refresh runs at a time per process."""
    if not _REFRESH_LOCK.acquire(blocking=False):
        return

    def refresh() -> None:
        try:
            get_rates(base_code, force_refresh=True)
        finally:
            _REFRESH_LOCK.release()

    threading.Thread(target=refresh, name="currency-refresh", daemon=True).start()


def get_rates(base: str = "USD", force_refresh: bool = False) -> dict[str, Any]:
    """
    Returns currency exchange rates using two-tier cache (memory + Redis),
    with fallback to API and static FALLBACK_RATES.
    """
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
                return {
                    "rates": dict(parsed_rates),
                    "date": date_str,
                    "source": "cache",
                }

    # An expired in-memory entry still answers: the provider is asked off the request path,
    # so no user request waits for the network once rates have been loaded.
    if not force_refresh and CURRENCY_RATES_ENABLED and not _in_backoff():
        with _CACHE_LOCK:
            stale = _MEMORY_CACHE.get(base_code)
        if stale and stale.get("rates"):
            _refresh_in_background(base_code)
            return {
                "rates": dict(stale["rates"]),
                "date": stale.get("date", ""),
                "source": "cache",
            }

    # API fetch if enabled and not backing off
    if CURRENCY_RATES_ENABLED and not _in_backoff():
        try:
            fetched = fetch_rates(base=base_code)
            rates = fetched["rates"]
            date_str = fetched.get("date", "")
            _record_success()
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
        except (URLError, HTTPError, TimeoutError, OSError, ValueError, RuntimeError):
            _record_failure()
            _LOGGER.warning("Failed to fetch currency rates from the configured API")

    # Fallback to in-memory cache even if slightly stale, before falling back to static
    with _CACHE_LOCK:
        mem = _MEMORY_CACHE.get(base_code)
        if mem and mem.get("rates"):
            return {
                "rates": dict(mem["rates"]),
                "date": mem.get("date", ""),
                "source": "cache",
            }

    # Static fallback
    return {
        "rates": dict(FALLBACK_RATES),
        "date": FALLBACK_RATES_DATE,
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


def _nice_step(raw_step: float) -> int:
    """
    Rounds a raw step to the nearest standard increment on the 1-2-5 scale
    (..., 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, ...).
    """
    if raw_step <= 1:
        return 1
    p = 10 ** math.floor(math.log10(raw_step))
    m = raw_step / p
    # Geometric mean thresholds: sqrt(1*2)=1.414, sqrt(2*5)=3.162, sqrt(5*10)=7.071
    if m < 1.41421356:
        tick = 1
    elif m < 3.16227766:
        tick = 2
    elif m < 7.07106781:
        tick = 5
    else:
        tick = 10
    return max(1, int(round(tick * p)))


def _nice_max(raw_max: float, step: int) -> int:
    """
    Rounds raw max up to clean significant figures, ensuring it is an exact
    integer multiple of step so sliders land cleanly on the upper boundary.
    """
    if raw_max <= step:
        return max(step, 1)
    p = 10 ** max(0, math.floor(math.log10(raw_max)) - 1)
    rounded_unit = max(step, p)
    candidate = math.ceil(raw_max / rounded_unit) * rounded_unit
    if candidate % step != 0:
        candidate = math.ceil(candidate / step) * step
    return max(step, int(candidate))


@lru_cache(maxsize=1)
def _load_filter_limits_config_cached() -> dict[str, dict[str, int]]:
    try:
        with open(CURRENCY_FILTER_LIMITS_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            cleaned: dict[str, dict[str, int]] = {}
            for k, v in raw.items():
                if k.startswith("_") or not isinstance(v, dict):
                    continue
                key = "default" if k.lower() == "default" else k.upper()
                entry: dict[str, int] = {}
                if "min" in v:
                    entry["min"] = max(0, int(v["min"]))
                if "max" in v:
                    entry["max"] = max(1, int(v["max"]))
                if "step" in v:
                    entry["step"] = max(1, int(v["step"]))
                cleaned[key] = entry
            if "default" not in cleaned:
                cleaned["default"] = {"min": 0, "max": 100000, "step": 100}
            return cleaned
    except (OSError, json.JSONDecodeError, ValueError, TypeError) as e:
        _LOGGER.warning("Failed to load currency filter limits from %s: %s", CURRENCY_FILTER_LIMITS_PATH, e)

    return {
        "default": {"min": 0, "max": 100000, "step": 100},
        "USD": {"min": 0, "max": 100000, "step": 100},
    }


def load_filter_limits_config() -> dict[str, dict[str, int]]:
    """Loads and caches currency slider bounds from currency_filter_limits.json."""
    return dict(_load_filter_limits_config_cached())


def get_filter_limits(currency_code: str) -> dict[str, int]:
    """
    Returns slider bounds for a currency.
    If the currency is configured in currency_filter_limits.json, uses its explicit fields.
    For missing fields, computes adaptive limits using 1-2-5 scale nice-number rounding.
    """
    code = (currency_code or "").strip().upper()
    if not _CURRENCY_CODE_RE.match(code):
        raise ValueError(f"Invalid or unsupported currency code: {currency_code}")

    config = load_filter_limits_config()
    override = config.get(code) or {}

    default_limits = config.get("default") or {"min": 0, "max": 100000, "step": 100}
    default_min = default_limits.get("min", 0)
    default_max = default_limits.get("max", 100000)
    default_step = default_limits.get("step", 100)

    # Will raise ValueError if currency code is not in rates
    conv_min = convert(default_min, "USD", code)
    conv_max = convert(default_max, "USD", code)
    conv_step = convert(default_step, "USD", code)

    step_val = max(1, int(override["step"])) if "step" in override else _nice_step(conv_step)
    min_val = max(0, int(override["min"])) if "min" in override else max(0, int(round(conv_min)))

    if "max" in override:
        max_val = max(min_val + step_val, int(override["max"]))
        if max_val % step_val != 0:
            max_val = math.ceil(max_val / step_val) * step_val
    else:
        max_val = max(min_val + step_val, _nice_max(conv_max, step_val))

    return {
        "min": min_val,
        "max": max_val,
        "step": step_val,
    }
