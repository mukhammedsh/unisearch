#!/usr/bin/env python3
"""Apply structured official admissions data to the universities dataset.

The admissions catalog is stored in `backend/data/official_admissions.json`.
It is intentionally richer than the legacy flat acceptance-rate fields and can
store official status, raw counts, semantics, sources, and verified-null cases.
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = ROOT / "backend" / "data" / "universities.json"
DEFAULT_ADMISSIONS_PATH = ROOT / "backend" / "data" / "official_admissions.json"


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_num(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _normalize_sources(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, str]] = []
    seen = set()
    for item in value:
        if isinstance(item, dict):
            url = _clean_text(item.get("url"))
            label = _clean_text(item.get("label"))
            if not url:
                continue
            key = (url, label)
            if key in seen:
                continue
            seen.add(key)
            row = {"url": url}
            if label:
                row["label"] = label
            out.append(row)
            continue
        url = _clean_text(item)
        if not url:
            continue
        key = (url, "")
        if key in seen:
            continue
        seen.add(key)
        out.append({"url": url})
    return out


def _normalize_counts(value: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(value, dict):
        return None
    out: Dict[str, Any] = {}
    for key, raw in value.items():
        if isinstance(raw, (dict, list)):
            out[str(key)] = raw
            continue
        num = _safe_num(raw)
        if num is not None:
            if float(num).is_integer():
                out[str(key)] = int(num)
            else:
                out[str(key)] = round(float(num), 2)
            continue
        text = _clean_text(raw)
        if text:
            out[str(key)] = text
    return out or None


def _normalize_provenance(value: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(value, dict):
        return None
    out: Dict[str, Any] = {}
    for key in ("source", "source_url", "verified_at", "status", "confidence", "method"):
        text = _clean_text(value.get(key))
        if text:
            out[key] = text
    basis = value.get("basis")
    if isinstance(basis, dict) and basis:
        out["basis"] = basis
    return out or None


def _normalize_section(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {
            "status": "no_official_source",
            "kind": None,
            "acceptance_rate_percent": None,
            "counts": None,
            "semantics": "",
            "sources": [],
        }

    rate = _safe_num(value.get("acceptance_rate_percent"))
    out = {
        "status": _clean_text(value.get("status")) or "no_official_source",
        "kind": _clean_text(value.get("kind")) or None,
        "acceptance_rate_percent": round(float(rate), 2) if rate is not None else None,
        "counts": _normalize_counts(value.get("counts")),
        "semantics": _clean_text(value.get("semantics")),
        "sources": _normalize_sources(value.get("sources")),
    }
    provenance = _normalize_provenance(value.get("provenance"))
    if provenance is not None:
        out["provenance"] = provenance
    return out


def _normalize_program_level(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {
            "status": "no_official_source",
            "kind": None,
            "acceptance_rate_percent": None,
            "counts": None,
            "notes": "",
            "sources": [],
        }

    rate = _safe_num(value.get("acceptance_rate_percent"))
    return {
        "status": _clean_text(value.get("status")) or "no_official_source",
        "kind": _clean_text(value.get("kind")) or None,
        "acceptance_rate_percent": round(float(rate), 2) if rate is not None else None,
        "counts": _normalize_counts(value.get("counts")),
        "notes": _clean_text(value.get("notes")),
        "sources": _normalize_sources(value.get("sources")),
    }


def _normalize_programs(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        row = copy.deepcopy(item)
        name = _clean_text(row.get("program_name") or row.get("name"))
        if name:
            row["program_name"] = name
        rate = _safe_num(row.get("acceptance_rate_percent"))
        row["acceptance_rate_percent"] = round(float(rate), 2) if rate is not None else None
        row["counts"] = _normalize_counts(row.get("counts"))
        row["sources"] = _normalize_sources(row.get("sources"))
        row["provenance"] = _normalize_provenance(row.get("provenance"))
        out.append(row)
    return out


def _normalize_admissions_payload(payload: Dict[str, Any], status_date: str, schema_version: int) -> Dict[str, Any]:
    return {
        "schema_version": schema_version,
        "status_date": status_date,
        "university_wide": _normalize_section(payload.get("university_wide")),
        "program_level": _normalize_program_level(payload.get("program_level")),
        "programs": _normalize_programs(payload.get("programs")),
    }


def apply_official_admissions(
    universities: List[Dict[str, Any]],
    catalog: Dict[str, Any],
) -> int:
    changed = 0
    admissions_rows = catalog.get("universities") if isinstance(catalog, dict) else {}
    admissions_rows = admissions_rows if isinstance(admissions_rows, dict) else {}
    status_date = _clean_text(catalog.get("verified_at") or catalog.get("status_date")) or "2026-03-25"
    schema_version = int(catalog.get("schema_version") or 1)

    for row in universities:
        if not isinstance(row, dict):
            continue
        uid = _clean_text(row.get("id"))
        if not uid:
            continue
        payload = admissions_rows.get(uid)
        if not isinstance(payload, dict):
            continue

        before = copy.deepcopy(row)
        academics = row.get("academics")
        if not isinstance(academics, dict):
            academics = {}
            row["academics"] = academics

        normalized = _normalize_admissions_payload(payload, status_date=status_date, schema_version=schema_version)
        if academics.get("admissions") != normalized:
            academics["admissions"] = normalized

        if row != before:
            changed += 1

    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply structured official admissions data to universities.json")
    parser.add_argument("--data", default=str(DEFAULT_DATA_PATH), help="Path to universities.json")
    parser.add_argument("--admissions", default=str(DEFAULT_ADMISSIONS_PATH), help="Path to official_admissions.json")
    args = parser.parse_args()

    data_path = Path(args.data).resolve()
    admissions_path = Path(args.admissions).resolve()
    universities = json.loads(data_path.read_text(encoding="utf-8"))
    catalog = json.loads(admissions_path.read_text(encoding="utf-8"))
    if not isinstance(universities, list):
        raise RuntimeError("universities.json root must be a list")

    changed = apply_official_admissions(universities, catalog)
    data_path.write_text(json.dumps(universities, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {changed} university rows from structured official admissions data")


if __name__ == "__main__":
    main()
