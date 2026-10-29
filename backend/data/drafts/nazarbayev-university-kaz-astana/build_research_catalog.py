"""Build a normalized, inactive research catalog from the three NU packets."""

import hashlib
import json
from collections import Counter
from pathlib import Path

from validate_research_packets import validate as validate_packets


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
PACKETS = ("a", "b", "c")
OUTPUT = ROOT / "research-catalog.json"
EXAMPLE_OUTPUT = ROOT / "research-catalog.example.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def unique(values):
    return list(dict.fromkeys(value for value in values if value is not None))


def list_value(value):
    if value is None:
        return None
    return value if isinstance(value, list) else [value]


def attributes(row, consumed):
    return {key: value for key, value in row.items() if key not in consumed}


def handoff_status(packet_id):
    path = ROOT / f"packet-{packet_id}/handoff.md"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("**Status:"):
            if "ready_for_review" in line:
                return "ready_for_review"
            if "needs_research" in line:
                return "needs_research"
            return line.strip("* :`.")
    return "missing"


def normalized_levels(raw_level, classification, title):
    level_text = " ".join(str(value) for value in list_value(raw_level) or []).lower()
    class_text = str(classification or "").lower().replace("_", " ")
    title_text = str(title or "").lower()
    combined = f"{level_text} {class_text} {title_text}"
    if "residency" in combined:
        return ["residency"]
    if "doctor of medicine" in title_text or class_text in {"md", "doctor of medicine"}:
        return ["professional"]
    if "professional doctorate" in class_text:
        return ["doctoral", "professional"]
    if any(value in combined for value in ("foundation", "preparatory", "nuzyp", "nufyp")):
        return ["preparation"]
    if "non-degree" in class_text or "non degree" in class_text or "microcredential" in class_text:
        return ["non_degree", "professional"] if "professional" in class_text else ["non_degree"]
    if "doctoral" in level_text or "doctorate" in class_text or "ph.d" in title_text or "phd" in title_text:
        return ["doctoral"]
    if "master" in level_text or "master" in class_text:
        return ["masters"]
    if "undergraduate" in level_text or "bachelor" in level_text or "bachelor" in class_text:
        return ["undergraduate"]
    return []


def normalized_scope(raw_scope, route_ids=None, card_to_options=None):
    if not isinstance(raw_scope, dict):
        return {
            "option_ids": None,
            "route_ids": route_ids or None,
            "study_levels": None,
            "applicant_categories": None,
            "cycle": None,
            "fee_status": None,
            "additional_dimensions": {"unparsed_scope": raw_scope} if raw_scope is not None else {},
            "original_scope": raw_scope,
        }
    consumed = {
        "option_ids", "study_option_ids", "study_option_id", "route_ids", "application_route_ids",
        "application_route_id", "levels", "study_levels", "study_level", "level",
        "applicant_categories", "applicant_category", "cycle", "admission_cycle", "fee_status",
    }
    option_ids = raw_scope.get("option_ids", raw_scope.get("study_option_ids", raw_scope.get("study_option_id")))
    if option_ids is None and card_to_options:
        card_id = raw_scope.get("inventory_card_id", raw_scope.get("catalog_card_id"))
        option_ids = card_to_options.get(card_id)
    explicit_route_ids = raw_scope.get("route_ids", raw_scope.get("application_route_ids", raw_scope.get("application_route_id")))
    levels = raw_scope.get("levels", raw_scope.get("study_levels", raw_scope.get("study_level", raw_scope.get("level"))))
    categories = raw_scope.get("applicant_categories", raw_scope.get("applicant_category"))
    return {
        "option_ids": list_value(option_ids),
        "route_ids": unique((list_value(explicit_route_ids) or []) + (route_ids or [])) or None,
        "study_levels": list_value(levels),
        "applicant_categories": list_value(categories),
        "cycle": raw_scope.get("cycle", raw_scope.get("admission_cycle")),
        "fee_status": list_value(raw_scope.get("fee_status")),
        "additional_dimensions": attributes(raw_scope, consumed),
        "original_scope": raw_scope,
    }


def record_provenance(packet_id, raw, evidence_file):
    return {
        "packet_id": packet_id,
        "evidence_file": evidence_file,
        "original_id": raw.get("id", raw.get("inventory_card_id", raw.get("study_option_id"))),
        "original_scope": raw.get("scope"),
        "original_source_ids": raw.get("source_ids"),
    }


def route_fact_ids(route):
    refs = []
    for key, value in route.items():
        if key.endswith("_fact_id") and isinstance(value, str):
            refs.append(value)
        elif key.endswith("_fact_ids") or key in {"cycle_facts", "shared_policy_fact_ids"}:
            if isinstance(value, list):
                refs.extend(value)
    return unique(refs)


def route_option_ids(route):
    values = []
    for key in ("study_option_ids", "applies_to", "option_ids", "study_option_id"):
        values.extend(list_value(route.get(key)) or [])
    return unique(values)


def checked_at(row, keys):
    return next((row[key] for key in keys if row.get(key) is not None), None)


def build_catalog():
    validate_packets()
    assignment = read_json(ROOT / "assignment.json")
    packet_data = {packet: read_json(ROOT / f"packet-{packet}/research.json") for packet in PACKETS}
    packet_status = {packet: handoff_status(packet) for packet in PACKETS}
    packet_inventory = {}
    option_to_cards = {}
    card_to_options = {}
    for packet in PACKETS:
        packet_inventory[packet] = {
            row["inventory_card_id"]: row for row in packet_data[packet]["inventory_entries"]
        }
        for row in packet_data[packet]["inventory_entries"]:
            option_ids = row.get("study_option_id", row.get("study_option_ids", []))
            for option_id in list_value(option_ids) or []:
                option_to_cards.setdefault(option_id, []).append(row["inventory_card_id"])
                card_to_options.setdefault(row["inventory_card_id"], []).append(option_id)

    inventory = []
    for raw in assignment["inventory"]:
        packet = raw["packet_id"]
        packet_row = packet_inventory[packet][raw["inventory_card_id"]]
        option_ids = packet_row.get("study_option_id", packet_row.get("study_option_ids", []))
        inventory.append({
            "id": raw["inventory_card_id"],
            "title": raw["title"],
            "url": raw["url"],
            "official_level": raw["official_level"],
            "owner_packet": packet,
            "source_order": raw["source_order"],
            "study_option_ids": list_value(option_ids) or [],
            "source_ids": packet_row.get("source_ids"),
            "reconciliation_status": packet_row.get("reconciliation", packet_row.get("mapping_status")),
            "attributes": {
                **attributes(raw, {"inventory_card_id", "title", "url", "official_level", "source_order", "packet_id"}),
                **attributes(packet_row, {"inventory_card_id", "id", "title", "url", "official_level", "source_order", "packet_id", "study_option_id", "study_option_ids", "source_ids", "reconciliation", "mapping_status"}),
            },
            "provenance": record_provenance(packet, packet_row, f"packet-{packet}/research.json"),
        })

    sources = []
    study_options = []
    routes = []
    facts = []
    unknowns = []
    resolved_history = []
    additional = []
    cross_refs = []
    packet_coverage = []
    packet_metadata = []

    for packet in PACKETS:
        raw_data = packet_data[packet]
        evidence_file = f"packet-{packet}/research.json"
        route_rows = raw_data.get("application_routes", [])
        route_fact_map = {}
        for route in route_rows:
            for fact_id in route_fact_ids(route):
                route_fact_map.setdefault(fact_id, []).append(route["id"])

        for row in raw_data.get("sources", []):
            review_key = next((key for key in ("content_review_status", "review_status") if key in row), None)
            consumed = {
                "id", "url", "title", "access_checked", "access_checked_at", "accessed_on",
                "content_reviewed", "content_reviewed_at", "content_reviewed_on", "access_status",
                "content_review_status", "review_status", "publication_status",
            }
            sources.append({
                "id": row["id"],
                "owner_packet": packet,
                "url": row["url"],
                "title": row["title"],
                "checked_at": checked_at(row, ("access_checked_at", "access_checked", "accessed_on")),
                "content_reviewed_at": checked_at(row, ("content_reviewed_at", "content_reviewed", "content_reviewed_on")),
                "access_status": row.get("access_status"),
                "review_status": row.get(review_key) if review_key else None,
                "review_status_field": review_key,
                "publication_status": row.get("publication_status"),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("study_options", []):
            title = row.get("official_name", row.get("official_title", row.get("name", row.get("title"))))
            level = row.get("study_levels", row.get("official_level", row.get("inventory_level_label")))
            classification = row.get("award_kind", row.get("study_type", row.get("kind")))
            source_ids = row.get("source_ids")
            if source_ids is None:
                source_ids = unique([row.get("catalog_evidence_source_id"), row.get("program_source_id")])
            source_ids = list_value(source_ids)
            route_ids = unique(sum((list_value(row.get(key)) or [] for key in (
                "admission_route_refs", "admission_route_ids", "application_route_ids", "route_ids"
            )), []))
            consumed = {
                "id", "official_name", "official_title", "name", "title", "official_level", "study_levels",
                "inventory_level_label", "award_kind", "study_type", "kind", "source_ids",
                "catalog_evidence_source_id", "program_source_id", "admission_route_refs", "admission_route_ids",
                "application_route_ids", "route_ids", "fact_ids", "inventory_card_id", "catalog_card_id",
            }
            study_options.append({
                "id": row["id"],
                "owner_packet": packet,
                "title": title,
                "levels": normalized_levels(level, classification, title),
                "inventory_card_ids": option_to_cards.get(row["id"], []),
                "classification": classification,
                "source_ids": source_ids,
                "route_ids": route_ids or None,
                "fact_ids": row.get("fact_ids"),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in route_rows:
            title = row.get("route_name", row.get("name", row.get("application_target")))
            classification = row.get("route_family", row.get("classification", row.get("type")))
            target = row.get("application_target", row.get("target", row.get("official_target")))
            destination = row.get("application_destination", row.get("destination"))
            consumed = {
                "id", "route_name", "name", "application_target", "target", "official_target",
                "application_destination", "destination", "route_family", "classification", "type",
                "source_ids", "study_option_ids", "applies_to", "option_ids", "study_option_id",
                "requirement_fact_ids", "cycle_facts", "shared_policy_fact_ids", "fact_ids",
            }
            routes.append({
                "id": row["id"],
                "owner_packet": packet,
                "title": title,
                "classification": classification,
                "target": target,
                "destination": destination,
                "option_ids": route_option_ids(row),
                "fact_ids": route_fact_ids(row),
                "source_ids": row.get("source_ids"),
                "scope": normalized_scope(row.get("scope"), [row["id"]], card_to_options),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("facts", []):
            topic_key = next((key for key in ("kind", "category", "group", "topic") if key in row), None)
            topic = row.get(topic_key) if topic_key else "unclassified"
            review_key = "review_status" if "review_status" in row else None
            consumed = {
                "id", "kind", "category", "group", "topic", "value", "scope", "source_ids",
                "checked_date", "checked_at", "checked_on", "publication_status", "review_status",
                "conditions", "conditions_and_exceptions", "exceptions", "period", "related_fact_ids", "topics",
            }
            facts.append({
                "id": row["id"],
                "owner_packet": packet,
                "topic": topic,
                "topic_field": topic_key,
                "value": row.get("value"),
                "scope": normalized_scope(row.get("scope"), route_fact_map.get(row["id"]), card_to_options),
                "conditions": row.get("conditions"),
                "conditions_and_exceptions": row.get("conditions_and_exceptions"),
                "exceptions": row.get("exceptions"),
                "period": row.get("period"),
                "related_fact_ids": row.get("related_fact_ids"),
                "source_ids": row.get("source_ids"),
                "publication_status": row.get("publication_status"),
                "review_status": row.get(review_key) if review_key else None,
                "review_status_field": review_key,
                "checked_at": checked_at(row, ("checked_date", "checked_at", "checked_on")),
                "attributes": {**attributes(row, consumed), **({"topics": row["topics"]} if "topics" in row else {})},
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("gaps", []):
            next_step_field = "official_next_step" if "official_next_step" in row else "next_action" if "next_action" in row else None
            consumed = {"id", "scope", "reason", "official_next_step", "next_action", "source_ids", "publication_status", "review_status", "checked_date", "checked_at", "checked_on"}
            unknowns.append({
                "id": row["id"],
                "owner_packet": packet,
                "scope": normalized_scope(row.get("scope"), card_to_options=card_to_options),
                "reason": row.get("reason"),
                "official_next_step": row.get(next_step_field) if next_step_field else None,
                "next_step_field": next_step_field,
                "cross_packet_ref_ids": row.get("cross_packet_ref_ids", []),
                "source_ids": row.get("source_ids"),
                "publication_status": row.get("publication_status"),
                "review_status": row.get("review_status"),
                "checked_at": checked_at(row, ("checked_date", "checked_at", "checked_on")),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("resolved_gap_history", []):
            resolved_history.append({
                "id": row.get("id"),
                "owner_packet": packet,
                "resolved_on": row.get("resolved_on"),
                "resolution_status": row.get("resolution_status", row.get("status")),
                "source_ids": row.get("source_ids"),
                "record": row,
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("additional_offerings", []):
            consumed = {
                "study_option_id", "inventory_card_id", "official_name", "study_type", "application_route_id",
                "source_ids", "study_fact_id", "entry_fact_id", "related_fact_ids", "linked_degree_option_id",
            }
            additional.append({
                "id": row["study_option_id"],
                "owner_packet": packet,
                "inventory_card_id": row.get("inventory_card_id"),
                "title": row.get("official_name"),
                "classification": row.get("study_type"),
                "route_ids": list_value(row.get("application_route_id")),
                "linked_degree_option_id": row.get("linked_degree_option_id"),
                "source_ids": row.get("source_ids"),
                "fact_ids": unique([row.get("study_fact_id"), row.get("entry_fact_id")] + (row.get("related_fact_ids") or [])),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        for row in raw_data.get("cross_packet_refs", []):
            linked_fact_ids = unique((row.get("target_fact_ids") or []) + (row.get("fact_ids") or []))
            linked_record_ids = list_value(row.get("target_ids")) or []
            if not linked_fact_ids and not linked_record_ids and isinstance(row.get("target"), str) and row["target"].startswith("nu-"):
                linked_fact_ids = [row["target"]]
            consumed = {
                "id", "owner_packet", "owner_directory", "target", "target_packet", "consumer_packet",
                "reference", "applicability", "scope", "resolution_status", "target_fact_ids",
                "target_source_ids", "target_ids", "fact_ids", "study_option_ids", "source_ids",
            }
            cross_refs.append({
                "id": row["id"],
                "record_owner_packet": packet,
                "reference_owner_packet": row.get("owner_packet", row.get("target_packet")),
                "consumer_packet": row.get("consumer_packet", row.get("target_packet", packet)),
                "target": row.get("target"),
                "linked_fact_ids": linked_fact_ids,
                "linked_record_ids": linked_record_ids,
                "study_option_ids": row.get("study_option_ids"),
                "source_ids": row.get("target_source_ids", row.get("source_ids")),
                "reference": row.get("reference"),
                "applicability": row.get("applicability"),
                "scope": normalized_scope(row.get("scope")),
                "resolution_status": row.get("resolution_status"),
                "attributes": attributes(row, consumed),
                "provenance": record_provenance(packet, row, evidence_file),
            })

        summary = {
            "packet_id": packet,
            "handoff_status": packet_status[packet],
            "inventory_count": len(packet_inventory[packet]),
            "study_option_count": sum(1 for option in raw_data["study_options"]),
            "route_count": len(route_rows),
            "fact_count": len(raw_data.get("facts", [])),
            "source_count": len(raw_data.get("sources", [])),
            "unknown_count": len(raw_data.get("gaps", [])),
            "resolved_gap_history_count": len(raw_data.get("resolved_gap_history", [])),
            "additional_offering_count": len(raw_data.get("additional_offerings", [])),
        }
        packet_coverage.append(summary)
        packet_metadata.append({
            "packet_id": packet,
            "schema_version": raw_data.get("schema_version"),
            "checked_at": checked_at(raw_data, ("checked_date", "checked_at", "checked_on", "snapshot_date")),
            "research_checkpoints": raw_data.get("research_checkpoints"),
            "review_batches": raw_data.get("review_batches"),
            "research_status": raw_data.get("research_status"),
            "shared_master_policy": raw_data.get("shared_master_policy"),
            "attributes": attributes(raw_data, {
                "schema_version", "university_id", "packet_id", "runtime_active", "checked_date", "checked_at",
                "checked_on", "snapshot_date", "inventory_source_url", "inventory_snapshot_date", "inventory_entries",
                "study_options", "application_routes", "facts", "sources", "gaps", "cross_packet_refs",
                "additional_offerings", "research_checkpoints", "review_batches", "research_status", "shared_master_policy", "resolved_gap_history",
            }),
        })

    # Resolve option fact indexes from explicit option scope and linked route scope.
    for option in study_options:
        linked = set(option["fact_ids"] or [])
        option_routes = set(option["route_ids"] or [])
        for fact in facts:
            scope = fact["scope"]
            scoped_options = scope["option_ids"]
            if scoped_options is not None:
                if option["id"] in scoped_options:
                    linked.add(fact["id"])
            elif option_routes.intersection(scope["route_ids"] or []):
                linked.add(fact["id"])
        option["fact_ids"] = sorted(linked)
        if not option["fact_ids"]:
            raise ValueError(f"Study option has no linked study/admission/price fact: {option['id']}")

    source_review_counts = Counter(str(row["review_status"]) if row["review_status"] is not None else "not_provided" for row in sources)
    unresolved_cross_refs = [row["id"] for row in cross_refs if any(term in str(row.get("resolution_status") or "").lower() for term in ("pending", "unresolved", "needs"))]
    ready = all(status == "ready_for_review" for status in packet_status.values()) and not unresolved_cross_refs
    assignment_path = ROOT / "assignment.json"
    manifests = [{
        "packet_id": "assignment",
        "path": assignment_path.relative_to(REPO).as_posix(),
        "sha256": hashlib.sha256(assignment_path.read_bytes()).hexdigest(),
        "handoff_status": "not_applicable",
        "handoff_path": None,
        "handoff_sha256": None,
    }]
    for packet in PACKETS:
        path = ROOT / f"packet-{packet}/research.json"
        handoff_path = ROOT / f"packet-{packet}/handoff.md"
        relative = path.relative_to(REPO).as_posix()
        manifests.append({
            "packet_id": packet,
            "path": relative,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "handoff_status": packet_status[packet],
            "handoff_path": handoff_path.relative_to(REPO).as_posix(),
            "handoff_sha256": hashlib.sha256(handoff_path.read_bytes()).hexdigest(),
        })
    catalog = {
        "schema_version": "nu-research-catalog-1.0",
        "university_id": assignment["university_id"],
        "official_name": "Nazarbayev University",
        "runtime_active": False,
        "research_status": "ready_for_review" if ready else "in_progress",
        "snapshot": {
            "assignment_date": assignment["snapshot_date"],
            "assigned_inventory_count": assignment["inventory_count"],
        },
        "inputs": manifests,
        "inventory_entries": inventory,
        "study_options": study_options,
        "application_routes": routes,
        "facts": facts,
        "sources": sources,
        "unknowns": unknowns,
        "resolved_gap_history": resolved_history,
        "additional_offerings": additional,
        "cross_packet_refs": cross_refs,
        "packet_metadata": packet_metadata,
        "coverage": {
            "assigned_inventory_count": len(inventory),
            "study_option_count": len(study_options),
            "fact_count": len(facts),
            "study_option_fact_link_count": sum(len(row["fact_ids"]) for row in study_options),
            "study_options_with_facts": sum(bool(row["fact_ids"]) for row in study_options),
            "source_count": len(sources),
            "unknown_count": len(unknowns),
            "resolved_gap_history_count": len(resolved_history),
            "additional_offering_count": len(additional),
            "source_review_status_counts": dict(source_review_counts),
            "unresolved_cross_packet_ref_ids": unresolved_cross_refs,
            "packets": packet_coverage,
        },
    }
    validate_catalog(catalog)
    return catalog


def build_example(catalog):
    route_ids = {"nu-a-route-financial-support", "nu-a-route-midyear-2026-27"}
    routes = [row for row in catalog["application_routes"] if row["id"] in route_ids]
    fact_ids = {fact_id for route in routes for fact_id in route["fact_ids"]}
    facts = [row for row in catalog["facts"] if row["id"] in fact_ids]
    source_ids = {source_id for row in routes for source_id in (row["source_ids"] or [])}
    source_ids.update(source_id for row in facts for source_id in (row["source_ids"] or []))
    sources = [row for row in catalog["sources"] if row["id"] in source_ids]
    unknowns = [row for row in catalog["unknowns"] if row["id"] == "nu-a-gap-midyear-conflict"]
    packet_metadata = [row for row in catalog["packet_metadata"] if row["packet_id"] == "a"]
    counts = Counter(row["review_status"] if row["review_status"] is not None else "not_provided" for row in sources)
    example = {
        "schema_version": catalog["schema_version"],
        "university_id": catalog["university_id"],
        "official_name": catalog["official_name"],
        "runtime_active": False,
        "research_status": "in_progress",
        "example_scope": "Partial excerpt showing that 2027/28 post-offer NUET support (120/50/50) and 2026/27 mid-year admission (130/60/60) remain separate. This is not the complete 93-card catalog.",
        "snapshot": catalog["snapshot"],
        "inputs": [row for row in catalog["inputs"] if row["packet_id"] == "a"],
        "inventory_entries": [],
        "study_options": [],
        "application_routes": routes,
        "facts": facts,
        "sources": sources,
        "unknowns": unknowns,
        "resolved_gap_history": [],
        "additional_offerings": [],
        "cross_packet_refs": [],
        "packet_metadata": packet_metadata,
        "coverage": {
            "assigned_inventory_count": 0,
            "study_option_count": 0,
            "fact_count": len(facts),
            "study_option_fact_link_count": 0,
            "study_options_with_facts": 0,
            "source_count": len(sources),
            "unknown_count": len(unknowns),
            "resolved_gap_history_count": 0,
            "additional_offering_count": 0,
            "source_review_status_counts": dict(counts),
            "unresolved_cross_packet_ref_ids": [],
            "packets": [{
                "packet_id": "a",
                "handoff_status": "ready_for_review",
                "inventory_count": 0,
                "study_option_count": 0,
                "route_count": len(routes),
                "fact_count": len(facts),
                "source_count": len(sources),
                "unknown_count": len(unknowns),
                "resolved_gap_history_count": 0,
                "additional_offering_count": 0,
            }],
        },
    }
    validate_catalog(example, complete=False, resolve_references=False)
    return example


def validate_catalog(catalog, complete=True, resolve_references=True):
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    inventory = {row["id"] for row in catalog["inventory_entries"]}
    options = {row["id"] for row in catalog["study_options"]}
    routes = {row["id"] for row in catalog["application_routes"]}
    facts = {row["id"] for row in catalog["facts"]}
    sources = {row["id"] for row in catalog["sources"]}
    extra = {row["id"] for row in catalog["additional_offerings"]}
    for item in catalog["inputs"]:
        path = REPO / item["path"]
        require(path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"],
                f"Stale or missing catalog input: {item['path']}")
        if item["handoff_path"] is not None:
            handoff_path = REPO / item["handoff_path"]
            require(handoff_path.is_file() and hashlib.sha256(handoff_path.read_bytes()).hexdigest() == item["handoff_sha256"],
                    f"Stale or missing handoff input: {item['handoff_path']}")
    for name, rows in (("inventory", catalog["inventory_entries"]), ("study options", catalog["study_options"]),
                       ("routes", catalog["application_routes"]), ("facts", catalog["facts"]),
                       ("sources", catalog["sources"]), ("unknowns", catalog["unknowns"]),
                       ("resolved history", catalog["resolved_gap_history"]),
                       ("cross references", catalog["cross_packet_refs"])):
        ids = [row["id"] for row in rows]
        require(len(ids) == len(set(ids)), f"Duplicate {name} IDs")
    if complete:
        require(len(inventory) == 93, f"Expected 93 inventory cards, found {len(inventory)}")
    require(not (options & extra), "Additional offerings collide with assigned study options")
    if resolve_references:
        for row in catalog["inventory_entries"]:
            require(set(row["study_option_ids"]) <= options, f"Inventory card {row['id']} references a missing option")
            require(set(row["source_ids"] or []) <= sources, f"Inventory card {row['id']} references a missing source")
        for row in catalog["study_options"]:
            require(set(row["inventory_card_ids"]) <= inventory, f"Study option {row['id']} references a missing inventory card")
            require(set(row["source_ids"] or []) <= sources, f"Study option {row['id']} references a missing source")
            require(set(row["route_ids"] or []) <= routes, f"Study option {row['id']} references a missing route")
            require(set(row["fact_ids"]) <= facts, f"Study option {row['id']} references a missing fact")
            if complete:
                require(row["fact_ids"], f"Study option has no linked facts: {row['id']}")
        for row in catalog["application_routes"]:
            require(set(row["option_ids"]) <= options, f"Route {row['id']} references a missing option")
            require(set(row["fact_ids"]) <= facts, f"Route {row['id']} references a missing fact")
            require(set(row["source_ids"] or []) <= sources, f"Route {row['id']} references a missing source")
        for row in catalog["facts"]:
            require(set(row["source_ids"] or []) <= sources, f"Fact {row['id']} references a missing source")
            require(set(row["scope"]["option_ids"] or []) <= options, f"Fact {row['id']} references a missing option")
            require(set(row["scope"]["route_ids"] or []) <= routes, f"Fact {row['id']} references a missing route")
            require(set(row["related_fact_ids"] or []) <= facts, f"Fact {row['id']} references a missing related fact")
        for row in catalog["unknowns"]:
            require(set(row["source_ids"] or []) <= sources, f"Unknown {row['id']} references a missing source")
            require(set(row["scope"]["option_ids"] or []) <= options, f"Unknown {row['id']} references a missing option")
            require(set(row["scope"]["route_ids"] or []) <= routes, f"Unknown {row['id']} references a missing route")
            require(set(row["cross_packet_ref_ids"] or []) <= {x["id"] for x in catalog["cross_packet_refs"]},
                    f"Unknown {row['id']} references a missing cross-packet ref")
        for row in catalog["additional_offerings"]:
            require(set(row["route_ids"] or []) <= routes, f"Additional offering {row['id']} references a missing route")
            require(set(row["source_ids"] or []) <= sources, f"Additional offering {row['id']} references a missing source")
            require(set(row["fact_ids"] or []) <= facts, f"Additional offering {row['id']} references a missing fact")
        for row in catalog["cross_packet_refs"]:
            require(set(row["linked_fact_ids"] or []) <= facts, f"Cross-reference {row['id']} targets a missing fact")
            require(set(row["linked_record_ids"] or []) <= (options | routes | facts | sources),
                    f"Cross-reference {row['id']} targets a missing record")
            require(set(row["study_option_ids"] or []) <= options, f"Cross-reference {row['id']} targets a missing option")
            require(set(row["source_ids"] or []) <= sources, f"Cross-reference {row['id']} targets a missing source")
        for row in catalog["resolved_gap_history"]:
            require(set(row["source_ids"] or []) <= sources, f"Resolved history {row['id']} references a missing source")
    if complete:
        a_options = {row["id"]: row for row in catalog["study_options"] if row["owner_packet"] == "a"}
        fyp_id = "nu-a-study-nu-foundation-year-program"
        regular = next(row for row in catalog["application_routes"] if row["id"] == "nu-a-route-regular-foundation-undergraduate")
        common_ug = set(regular["option_ids"]) - {fyp_id}
        fyp = a_options[fyp_id]["fact_ids"]
        require({"nu-a-fact-fyp-english", "nu-a-fact-fyp-academic"} <= set(fyp),
                "Foundation option is missing its Foundation-only thresholds")
        require(not ({"nu-a-fact-ug-english", "nu-a-fact-ug-academic-alternatives"} & set(fyp)),
                "UG thresholds leaked onto the Foundation option")
        for option_id in common_ug:
            linked = set(a_options[option_id]["fact_ids"])
            require({"nu-a-fact-ug-english", "nu-a-fact-ug-academic-alternatives"} <= linked,
                    f"Common UG option is missing its UG requirements: {option_id}")
            require(not ({"nu-a-fact-fyp-english", "nu-a-fact-fyp-academic"} & linked),
                    f"Foundation thresholds leaked onto UG option: {option_id}")


def main():
    catalog = build_catalog()
    example = build_example(catalog)
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    EXAMPLE_OUTPUT.write_text(json.dumps(example, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT.name}: {catalog['research_status']}, {len(catalog['inventory_entries'])} cards, "
          f"{len(catalog['study_options'])} options, {len(catalog['facts'])} facts, {len(catalog['sources'])} sources.")
    print(f"Wrote {EXAMPLE_OUTPUT.name}: {len(example['application_routes'])} routes, "
          f"{len(example['facts'])} facts, {len(example['sources'])} sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
