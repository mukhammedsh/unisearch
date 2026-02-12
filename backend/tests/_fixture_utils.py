import json
from pathlib import Path
from typing import Any, Dict, List


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _read_json(filename: str) -> Any:
    path = FIXTURES_DIR / filename
    with open(path, "r", encoding="utf-8") as fp:
        return json.load(fp)


def load_personas() -> List[Dict[str, Any]]:
    raw = _read_json("personas.json")
    if not isinstance(raw, list):
        return []
    return [row for row in raw if isinstance(row, dict)]


def load_natural_inputs() -> List[Dict[str, Any]]:
    raw = _read_json("persona_inputs_natural_text.json")
    if not isinstance(raw, list):
        return []
    return [row for row in raw if isinstance(row, dict)]


def build_ai_sort_payload(
    persona: Dict[str, Any],
    budget_vs_prestige: int = 55,
    limit: int = 20,
) -> Dict[str, Any]:
    profile = persona.get("profile", {}) if isinstance(persona, dict) else {}
    locale = str(persona.get("locale", "")).strip()
    payload = {
        "profile": dict(profile) if isinstance(profile, dict) else {},
        "practice_vs_science": 50,
        "social_vs_hardcore": 50,
        "budget_vs_prestige": int(budget_vs_prestige),
        "city_vs_campus": 50,
        "page": 1,
        "limit": int(limit),
    }
    if locale:
        payload["profile"]["locale"] = locale
    return payload
