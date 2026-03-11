#!/usr/bin/env python3
"""Refresh per-university fact provenance for key numeric fields.

Adds/updates `fact_provenance` for:
- rank
- tuition_total_cost_year_usd

Rank behavior:
- if `rank_meta.status == official`, rank fact is written as official external QS rank.
- if `rank_meta.status in {excluded, not_listed}`, rank fact is preserved as non-official with that status.
- otherwise rank fact falls back to internal derived prestige order metadata.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = ROOT / "backend" / "data" / "universities.json"


def _safe_num(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        out = float(value)
        return out
    except Exception:
        return None


def _pick_source_url(university: Dict[str, Any], preferred_topics: List[str]) -> str:
    verified = university.get("verified_sources")
    if isinstance(verified, list):
        for row in verified:
            if not isinstance(row, dict):
                continue
            topic = str(row.get("topic") or "").strip().lower()
            url = str(row.get("url") or "").strip()
            if not url:
                continue
            if topic in preferred_topics:
                return url
    website = str(university.get("website") or "").strip()
    if website:
        return website
    description_source = str(university.get("description_source") or "").strip()
    return description_source


def _rank_fact(university: Dict[str, Any], verified_at: str) -> Dict[str, Any]:
    value = _safe_num(university.get("rank"))
    rank_meta = university.get("rank_meta") if isinstance(university.get("rank_meta"), dict) else {}
    meta_status = str(rank_meta.get("status") or "").strip().lower()
    meta_source = str(rank_meta.get("source") or "").strip()
    meta_source_url = str(rank_meta.get("source_url") or "").strip()
    meta_note = str(rank_meta.get("note") or "").strip()
    meta_verified_at = str(rank_meta.get("verified_at") or "").strip()
    effective_verified_at = meta_verified_at or verified_at

    if meta_status == "official":
        return {
            "value": int(value) if value is not None else None,
            "unit": "position",
            "source": meta_source or "QS World University Rankings 2026",
            "source_url": meta_source_url or "https://www.topuniversities.com/world-university-rankings",
            "external_reference": "QS World University Rankings 2026",
            "is_official_external_rank": True,
            "verified_at": effective_verified_at,
            "confidence": "high",
            "status": "official",
            "method": meta_note or "Direct value from published QS WUR 2026 table.",
        }

    if meta_status in ("excluded", "not_listed"):
        return {
            "value": int(value) if value is not None else None,
            "unit": "position",
            "source": meta_source or "QS World University Rankings 2026",
            "source_url": meta_source_url or "https://www.topuniversities.com/world-university-rankings",
            "external_reference": "QS World University Rankings 2026",
            "is_official_external_rank": False,
            "verified_at": effective_verified_at,
            "confidence": "medium",
            "status": meta_status,
            "method": meta_note or "Fallback internal position for sorting; university is not in published QS WUR 2026 table.",
        }

    return {
        "value": int(value) if value is not None else None,
        "unit": "position",
        "source": "UniSearch prestige normalization model (QS-seeded)",
        "source_url": "https://www.topuniversities.com/world-university-rankings",
        "external_reference": "QS World University Rankings",
        "is_official_external_rank": False,
        "verified_at": effective_verified_at,
        "confidence": "medium",
        "status": "derived_prestige_order",
        "method": (
            "Relative prestige order within UniSearch dataset, seeded by QS references "
            "and normalized for internal comparison."
        ),
    }


def _tuition_fact(university: Dict[str, Any], verified_at: str) -> Dict[str, Any]:
    finance = university.get("finance") if isinstance(university.get("finance"), dict) else {}
    value = _safe_num(finance.get("total_cost_year_usd"))
    source_url = _pick_source_url(
        university,
        preferred_topics=["undergraduate_requirements", "programs", "formats"],
    )
    return {
        "value": value,
        "unit": "usd_per_year",
        "source": "University official admissions/program pages (curated in UniSearch dataset)",
        "source_url": source_url,
        "verified_at": verified_at,
        "confidence": "medium" if source_url else "low",
        "status": "curated",
    }


def refresh_fact_provenance(payload: List[Dict[str, Any]], verified_at: str) -> int:
    changed = 0
    for row in payload:
        if not isinstance(row, dict):
            continue
        new_obj = {
            "schema_version": 1,
            "facts": {
                "rank": _rank_fact(row, verified_at),
                "tuition_total_cost_year_usd": _tuition_fact(row, verified_at),
            },
        }
        if row.get("fact_provenance") != new_obj:
            row["fact_provenance"] = new_obj
            changed += 1
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh fact_provenance in universities dataset.")
    parser.add_argument("--data", default=str(DEFAULT_DATA_PATH), help="Path to universities.json")
    parser.add_argument(
        "--verified-at",
        default="2026-02-24",
        help="Verification date in YYYY-MM-DD format",
    )
    args = parser.parse_args()

    data_path = Path(args.data).resolve()
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("Dataset root must be a list")

    changed = refresh_fact_provenance(payload, verified_at=str(args.verified_at).strip() or "2026-02-21")
    data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated fact_provenance for {changed} rows")


if __name__ == "__main__":
    main()
