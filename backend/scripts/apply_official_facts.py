#!/usr/bin/env python3
"""Apply curated official facts to the universities dataset.

The catalog is stored in `backend/data/official_facts.json` and is intended for
facts that were verified on official university pages or official university
documents only.

Supported official-facts payloads:
- `student_count`
- `acceptance_rate_percent`
- `description`
- `tags`
- `verified_sources` topic overrides / replacements
- `clear_verified_topics`
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_PATH = ROOT / "backend" / "data" / "universities.json"
DEFAULT_FACTS_PATH = ROOT / "backend" / "data" / "official_facts.json"


def _safe_num(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_tags(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    seen = set()
    for item in value:
        tag = _clean_text(item)
        if not tag or tag in seen:
            continue
        seen.add(tag)
        out.append(tag)
    return out


def _replace_verified_sources_for_topic(row: Dict[str, Any], topic: str, urls: List[str]) -> bool:
    topic_text = _clean_text(topic)
    if not topic_text:
        return False
    normalized_urls = []
    seen = set()
    for url in urls:
        url_text = _clean_text(url)
        if not url_text or url_text in seen:
            continue
        seen.add(url_text)
        normalized_urls.append(url_text)

    verified = row.get("verified_sources")
    if not isinstance(verified, list):
        verified = []
    filtered = [
        item
        for item in verified
        if not isinstance(item, dict) or _clean_text(item.get("topic")).lower() != topic_text.lower()
    ]
    filtered.extend({"topic": topic_text, "url": url_text} for url_text in normalized_urls)
    if filtered != verified:
        row["verified_sources"] = filtered
        return True
    return False


def _remove_verified_topics(row: Dict[str, Any], topics: List[str]) -> bool:
    normalized = {_clean_text(topic).lower() for topic in topics if _clean_text(topic)}
    if not normalized:
        return False
    verified = row.get("verified_sources")
    if not isinstance(verified, list):
        return False
    filtered = [
        item
        for item in verified
        if not isinstance(item, dict) or _clean_text(item.get("topic")).lower() not in normalized
    ]
    if filtered != verified:
        row["verified_sources"] = filtered
        return True
    return False


def _set_verified_source(row: Dict[str, Any], topic: str, url: str) -> bool:
    return _replace_verified_sources_for_topic(row, topic, [url])


def _fact_record(value: Any, unit: str, payload: Dict[str, Any], verified_at: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "value": value,
        "unit": unit,
        "source": str(payload.get("source") or "").strip(),
        "source_url": str(payload.get("source_url") or "").strip(),
        "verified_at": str(payload.get("verified_at") or verified_at).strip() or verified_at,
        "confidence": str(payload.get("confidence") or "medium").strip() or "medium",
        "status": str(payload.get("status") or "official").strip() or "official",
        "method": str(payload.get("method") or "").strip(),
    }
    prov_type = str(payload.get("provenance_type") or "").strip()
    if prov_type:
        out["provenance_type"] = prov_type
    basis = payload.get("basis")
    if isinstance(basis, dict) and basis:
        out["basis"] = basis
    return out


def _apply_early_career_salary(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    value = _safe_num(payload.get("value"))
    if value is None or value <= 0:
        return False
    changed = False
    rate_value = round(float(value), 2)
    outcomes = row.get("outcomes")
    if not isinstance(outcomes, dict):
        outcomes = {}
        row["outcomes"] = outcomes
        changed = True

    if outcomes.get("early_career_salary_usd") != rate_value:
        outcomes["early_career_salary_usd"] = rate_value
        changed = True
    if "average_early_career_salary_usd" in outcomes:
        del outcomes["average_early_career_salary_usd"]
        changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    new_fact = _fact_record(rate_value, "usd_per_year", payload, verified_at)
    if facts.get("early_career_salary") != new_fact:
        facts["early_career_salary"] = new_fact
        changed = True
    for legacy_fact_key in ("average_early_career_salary", "average_early_career_salary_usd"):
        if legacy_fact_key in facts:
            del facts[legacy_fact_key]
            changed = True

    source_url = str(payload.get("source_url") or "").strip()
    if source_url:
        changed = _set_verified_source(row, "outcomes", source_url) or changed
    return changed


def _apply_salary_by_major(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    val = payload.get("value")
    if not isinstance(val, dict) or not val:
        return False
    clean_val = {}
    for k, v in val.items():
        k_str = _clean_text(k)
        v_num = _safe_num(v)
        if k_str and v_num is not None and v_num > 0:
            clean_val[k_str] = round(float(v_num), 2)
    if not clean_val:
        return False
    changed = False
    outcomes = row.get("outcomes")
    if not isinstance(outcomes, dict):
        outcomes = {}
        row["outcomes"] = outcomes
        changed = True

    if outcomes.get("salary_by_major") != clean_val:
        outcomes["salary_by_major"] = clean_val
        changed = True
    for legacy_outcomes_key in ("average_salary_by_major", "average_salary_by_program", "average_early_career_salary_by_major_usd"):
        if legacy_outcomes_key in outcomes:
            del outcomes[legacy_outcomes_key]
            changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    new_fact = _fact_record(clean_val, "usd_per_year", payload, verified_at)
    if facts.get("salary_by_major") != new_fact:
        facts["salary_by_major"] = new_fact
        changed = True

    source_url = str(payload.get("source_url") or "").strip()
    if source_url:
        changed = _set_verified_source(row, "outcomes", source_url) or changed
    return changed


def _apply_median_earnings_10yr(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    value = _safe_num(payload.get("value"))
    if value is None or value <= 0:
        return False
    changed = False
    rate_value = round(float(value), 2)
    outcomes = row.get("outcomes")
    if not isinstance(outcomes, dict):
        outcomes = {}
        row["outcomes"] = outcomes
        changed = True

    if outcomes.get("median_earnings_10yr_usd") != rate_value:
        outcomes["median_earnings_10yr_usd"] = rate_value
        changed = True

    # Remove deprecated legacy fields if present
    for legacy_key in ("average_early_career_salary_usd", "average_early_career_salary"):
        if legacy_key in outcomes:
            del outcomes[legacy_key]
            changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    new_fact = _fact_record(rate_value, "usd_per_year", payload, verified_at)
    if facts.get("median_earnings_10yr") != new_fact:
        facts["median_earnings_10yr"] = new_fact
        changed = True
    for legacy_fact_key in ("average_early_career_salary", "average_early_career_salary_usd"):
        if legacy_fact_key in facts:
            del facts[legacy_fact_key]
            changed = True

    source_url = str(payload.get("source_url") or "").strip()
    if source_url:
        changed = _set_verified_source(row, "outcomes", source_url) or changed
    return changed


def _apply_student_count(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    value = _safe_num(payload.get("value"))
    if value is None or value <= 0:
        return False
    changed = False
    int_value = int(round(value))
    if row.get("student_count") != int_value:
        row["student_count"] = int_value
        changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    new_fact = _fact_record(float(int_value), "students", payload, verified_at)
    if facts.get("student_count") != new_fact:
        facts["student_count"] = new_fact
        changed = True

    changed = _set_verified_source(row, "student_count", str(payload.get("source_url") or "")) or changed
    return changed


def _apply_acceptance_rate(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    value = _safe_num(payload.get("value"))
    if value is None or value < 0 or value > 100:
        return False
    changed = False
    academics = row.get("academics")
    if not isinstance(academics, dict):
        academics = {}
        row["academics"] = academics
        changed = True
    rate_value = round(float(value), 2)
    if academics.get("acceptance_rate_percent") != rate_value:
        academics["acceptance_rate_percent"] = rate_value
        changed = True

    meta = {
        "source": str(payload.get("source") or "").strip(),
        "source_url": str(payload.get("source_url") or "").strip(),
        "verified_at": str(payload.get("verified_at") or verified_at).strip() or verified_at,
        "status": str(payload.get("status") or "official").strip() or "official",
        "confidence": str(payload.get("confidence") or "medium").strip() or "medium",
        "method": str(payload.get("method") or "").strip(),
    }
    basis = payload.get("basis")
    if isinstance(basis, dict) and basis:
        meta["basis"] = basis
    if academics.get("acceptance_rate_percent_meta") != meta:
        academics["acceptance_rate_percent_meta"] = meta
        changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    new_fact = _fact_record(rate_value, "percent", payload, verified_at)
    if facts.get("acceptance_rate_percent") != new_fact:
        facts["acceptance_rate_percent"] = new_fact
        changed = True

    changed = _set_verified_source(row, "acceptance_rate", str(payload.get("source_url") or "")) or changed
    return changed


def _apply_description(row: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    value = _clean_text(payload.get("value"))
    if not value:
        return False
    changed = False
    if row.get("description") != value:
        row["description"] = value
        changed = True

    source_url = _clean_text(payload.get("source_url"))
    if source_url and row.get("description_source") != source_url:
        row["description_source"] = source_url
        changed = True

    if source_url:
        changed = _replace_verified_sources_for_topic(row, "description", [source_url]) or changed
    return changed


def _apply_tags(row: Dict[str, Any], payload: Dict[str, Any], verified_at: str) -> bool:
    tags = _normalize_tags(payload.get("value"))
    if not tags:
        return False
    changed = False
    if row.get("tags") != tags:
        row["tags"] = tags
        changed = True

    provenance = row.get("fact_provenance")
    if not isinstance(provenance, dict):
        provenance = {"schema_version": 1, "facts": {}}
        row["fact_provenance"] = provenance
        changed = True
    facts = provenance.get("facts")
    if not isinstance(facts, dict):
        facts = {}
        provenance["facts"] = facts
        changed = True

    unit = str(payload.get("unit") or "tags").strip()
    new_fact = _fact_record(tags, unit, payload, verified_at)
    if facts.get("tags") != new_fact:
        facts["tags"] = new_fact
        changed = True

    source_url = _clean_text(payload.get("source_url"))
    if source_url:
        changed = _replace_verified_sources_for_topic(row, "tags", [source_url]) or changed
    return changed


def _apply_verified_source_overrides(row: Dict[str, Any], payload: Dict[str, Any]) -> bool:
    changed = False
    clear_topics = payload.get("clear_verified_topics")
    if isinstance(clear_topics, list):
        changed = _remove_verified_topics(row, [str(topic) for topic in clear_topics]) or changed

    entries = payload.get("verified_sources")
    if not isinstance(entries, list):
        return changed

    grouped: Dict[str, List[str]] = {}
    order: List[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        topic = _clean_text(entry.get("topic"))
        url = _clean_text(entry.get("url"))
        if not topic or not url:
            continue
        if topic not in grouped:
            grouped[topic] = []
            order.append(topic)
        grouped[topic].append(url)

    for topic in order:
        changed = _replace_verified_sources_for_topic(row, topic, grouped.get(topic) or []) or changed
    return changed


def apply_official_facts(
    universities: List[Dict[str, Any]],
    catalog: Dict[str, Any],
    verified_at: str,
) -> int:
    changed = 0
    fact_rows = catalog.get("universities") if isinstance(catalog, dict) else {}
    fact_rows = fact_rows if isinstance(fact_rows, dict) else {}

    for row in universities:
        if not isinstance(row, dict):
            continue
        uid = str(row.get("id") or "").strip()
        if not uid:
            continue
        payload = fact_rows.get(uid)
        if not isinstance(payload, dict):
            continue
        before = copy.deepcopy(row)
        student_payload = payload.get("student_count")
        if isinstance(student_payload, dict):
            _apply_student_count(row, student_payload, verified_at)
        acceptance_payload = payload.get("acceptance_rate_percent")
        if isinstance(acceptance_payload, dict):
            _apply_acceptance_rate(row, acceptance_payload, verified_at)
        early_career_salary_payload = payload.get("early_career_salary") or payload.get("average_early_career_salary_usd")
        if isinstance(early_career_salary_payload, dict):
            _apply_early_career_salary(row, early_career_salary_payload, verified_at)
        salary_by_major_payload = payload.get("salary_by_major") or payload.get("average_salary_by_major")
        if isinstance(salary_by_major_payload, dict):
            _apply_salary_by_major(row, salary_by_major_payload, verified_at)
        median_earnings_payload = payload.get("median_earnings_10yr") or payload.get("median_earnings_10yr_usd")
        if isinstance(median_earnings_payload, dict):
            _apply_median_earnings_10yr(row, median_earnings_payload, verified_at)
        description_payload = payload.get("description")
        if isinstance(description_payload, dict):
            _apply_description(row, description_payload)
        tags_payload = payload.get("tags")
        if isinstance(tags_payload, dict):
            _apply_tags(row, tags_payload, verified_at)
        _apply_verified_source_overrides(row, payload)
        if row != before:
            changed += 1

    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply curated official facts to universities.json")
    parser.add_argument("--data", default=str(DEFAULT_DATA_PATH), help="Path to universities.json")
    parser.add_argument("--facts", default=str(DEFAULT_FACTS_PATH), help="Path to official_facts.json")
    parser.add_argument(
        "--verified-at",
        default="2026-03-12",
        help="Verification date in YYYY-MM-DD format",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    data_path = Path(args.data).resolve()
    facts_path = Path(args.facts).resolve()
    if not (data_path == repo_root or repo_root in data_path.parents):
        raise ValueError(f"Path outside repository is forbidden: {data_path}")
    if not (facts_path == repo_root or repo_root in facts_path.parents):
        raise ValueError(f"Path outside repository is forbidden: {facts_path}")
    universities = json.loads(data_path.read_text(encoding="utf-8"))
    catalog = json.loads(facts_path.read_text(encoding="utf-8"))
    if not isinstance(universities, list):
        raise RuntimeError("universities.json root must be a list")

    changed = apply_official_facts(
        universities,
        catalog,
        verified_at=str(args.verified_at).strip() or "2026-03-12",
    )
    data_path.write_text(json.dumps(universities, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {changed} university rows from curated official facts")


if __name__ == "__main__":
    main()
