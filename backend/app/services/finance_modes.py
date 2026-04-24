import re
from typing import Any, Dict, Optional


def to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_study_mode(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw or raw == "any":
        return "any"
    if raw in {"on-campus", "on campus", "campus", "offline", "in-person", "hybrid", "blended", "mixed"}:
        return "on-campus"
    if raw in {"online", "distance", "remote", "online / distance"}:
        return "online"
    return "any"


def normalize_cost_key(key: Any) -> str:
    return re.sub(r"[^a-z]", "", str(key or "").strip().lower())


def mode_value_from_map(mode_map: Any, mode: str) -> Any:
    if not isinstance(mode_map, dict):
        return None
    target = normalize_study_mode(mode)
    for key, value in mode_map.items():
        if normalize_study_mode(key) == target:
            return value
    return None


def mode_breakdown_from_finance(finance: Dict[str, Any], mode: str) -> Optional[Dict[str, Any]]:
    if not isinstance(finance, dict):
        return None
    for key in ("costs_breakdown_year_usd_by_mode", "costs_breakdown_by_mode_year_usd", "mode_costs_breakdown_year_usd"):
        value = mode_value_from_map(finance.get(key), mode)
        if isinstance(value, dict):
            return value
    return None


def mode_total_from_finance(finance: Dict[str, Any], mode: str) -> Optional[float]:
    if not isinstance(finance, dict):
        return None
    for key in ("total_cost_year_usd_by_mode", "total_cost_by_mode_year_usd", "mode_total_cost_year_usd"):
        amount = to_float(mode_value_from_map(finance.get(key), mode))
        if amount is not None and amount >= 0:
            return float(amount)
    return None


def extract_tuition_cost(breakdown: Dict[str, Any]) -> Optional[float]:
    if not isinstance(breakdown, dict):
        return None
    for key, value in breakdown.items():
        if "tuition" not in normalize_cost_key(key):
            continue
        amount = to_float(value)
        if amount is not None and amount >= 0:
            return float(amount)
    return None
