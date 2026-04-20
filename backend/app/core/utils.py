"""
Shared numeric and string utility functions used across backend services.

These are pure helpers with no dependencies on app state or configuration.
"""
from __future__ import annotations

import math
import re
from typing import Optional


def to_float(x: object) -> Optional[float]:
    """Convert a value to float, returning None if not possible or not finite."""
    try:
        if x is None or x == "":
            return None
        result = float(x)  # type: ignore[arg-type]
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def to_float_default(x: object, default: float) -> float:
    """Convert a value to float, returning *default* if conversion fails."""
    parsed = to_float(x)
    return float(default) if parsed is None else parsed


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* to the inclusive range [lo, hi]."""
    return max(lo, min(hi, value))


def clamp01(value: float) -> float:
    """Clamp *value* to [0.0, 1.0]."""
    return clamp(value, 0.0, 1.0)


def safe_lower(x: object) -> str:
    """Return stripped, lowercased string representation of *x*."""
    if x is None:
        return ""
    return str(x).strip().lower()


def norm_space(value: object) -> str:
    """Collapse internal whitespace and strip the result."""
    return re.sub(r"\s+", " ", safe_lower(value)).strip()


def norm_tag_key(value: object) -> str:
    """Convert *value* to a normalised key suitable for tag lookups."""
    return re.sub(r"[^a-z0-9]+", "_", safe_lower(value)).strip("_")
