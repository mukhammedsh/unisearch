"""Validate NU packet ownership and research references without activating data."""

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PACKETS = ("a", "b", "c")


class ValidationError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ValidationError(message)


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValidationError(f"Cannot read UTF-8 JSON: {path.relative_to(ROOT)}") from error


def records(rows, context):
    require(isinstance(rows, list), f"{context}: expected an array")
    result = {}
    for row in rows:
        require(isinstance(row, dict), f"{context}: expected an object")
        record_id = row.get("id")
        require(isinstance(record_id, str) and record_id.strip(), f"{context}: missing ID")
        require(record_id not in result, f"{context}: duplicate ID {record_id}")
        result[record_id] = row
    return result


def reference_ids(value, known, context):
    if value is None:
        return
    values = value if isinstance(value, list) else [value]
    require(all(isinstance(item, str) and item in known for item in values),
            f"{context}: unresolved reference {value}")


def check_references(rows, ids, packet_id):
    sources = ids["sources"]
    facts = ids["facts"]
    routes = ids["application_routes"]
    options = ids["study_options"]
    extra_options = ids["additional_offerings"]

    def source_refs(row, context):
        reference_ids(row.get("source_id"), sources, context)
        reference_ids(row.get("source_ids"), sources, context)

    for row in rows["inventory_entries"]:
        card_id = row.get("inventory_card_id")
        if card_id is not None:
            require(card_id in ids["inventory_cards"], f"packet {packet_id}: unknown inventory card {card_id}")
        for key in ("study_option_id", "study_option_ids"):
            reference_ids(row.get(key), options, f"packet {packet_id} inventory/{key}")
        for key in ("application_route_id", "application_route_ids"):
            reference_ids(row.get(key), routes, f"packet {packet_id} inventory/{key}")
        source_refs(row, f"packet {packet_id} inventory")

    for row in rows["study_options"]:
        context = f"packet {packet_id} study option {row['id']}"
        source_refs(row, context)
        for key in ("catalog_evidence_source_id", "catalog_source_id", "program_source_id"):
            reference_ids(row.get(key), sources, context)
        for key in ("admission_route_refs", "admission_route_ids", "application_route_ids", "route_ids"):
            reference_ids(row.get(key), routes, context)
        reference_ids(row.get("fact_ids"), facts, context)

    for row in rows["application_routes"]:
        context = f"packet {packet_id} route {row['id']}"
        source_refs(row, context)
        for key in ("study_option_ids", "applies_to", "option_ids"):
            reference_ids(row.get(key), options, context)
        for key in ("requirement_fact_ids", "cycle_facts", "shared_policy_fact_ids", "fact_ids"):
            reference_ids(row.get(key), facts, context)
        for key, value in row.items():
            if key.endswith("_fact_id") or key.endswith("_fact_ids"):
                reference_ids(value, facts, context)
        reference_ids(row.get("cross_packet_ref_id"), ids["cross_packet_refs"], context)

    for row in rows["facts"]:
        source_refs(row, f"packet {packet_id} fact {row['id']}")
        scope = row.get("scope")
        if isinstance(scope, dict):
            for key in ("route_ids", "application_route_ids", "application_route_id"):
                reference_ids(scope.get(key), routes, f"packet {packet_id} fact {row['id']} scope")
            card_id = scope.get("inventory_card_id")
            if card_id is not None:
                require(card_id in ids["inventory_cards"], f"packet {packet_id} fact {row['id']} scope: unknown inventory card {card_id}")

    for row in rows["gaps"]:
        context = f"packet {packet_id} gap {row['id']}"
        source_refs(row, context)
        reference_ids(row.get("cross_packet_ref_ids"), ids["cross_packet_refs"], context)

    for row in rows["additional_offerings"]:
        context = f"packet {packet_id} additional offering {row['study_option_id']}"
        reference_ids(row.get("source_ids"), sources, context)
        reference_ids(row.get("application_route_id"), routes, context)
        for key in ("study_fact_id", "entry_fact_id", "related_fact_ids"):
            reference_ids(row.get(key), facts, context)


def validate():
    assignment = read_json(ROOT / "assignment.json")
    require(assignment.get("university_id") == "nazarbayev-university-kaz-astana", "Unexpected university ID")
    packet_specs = {item["id"]: item for item in assignment.get("packets", [])}
    require(set(packet_specs) == set(PACKETS), "Assignment must define exactly packets a, b and c")
    require(assignment.get("inventory_count") == 93, "Assignment inventory count changed")

    loaded = {}
    packet_ids = {}
    inventory_owner = {}
    all_owned_ids = {}
    statuses = {}
    summaries = {}

    for packet_id in PACKETS:
        folder = ROOT / f"packet-{packet_id}"
        research = read_json(folder / "research.json")
        require(research.get("university_id") == assignment["university_id"],
                f"packet {packet_id}: university ID mismatch")
        require(research.get("packet_id") == packet_id, f"packet {packet_id}: packet ID mismatch")
        require(research.get("runtime_active") is False, f"packet {packet_id}: draft must remain inactive")
        if packet_id == "a":
            for source in research.get("sources", []):
                if source.get("content_reviewed") is not None:
                    require(source.get("content_review_status") in {
                        "reviewed", "reviewed_indexed_content", "reviewed_historical_content", "reviewed_wrong_program_content"
                    }, f"packet a source {source.get('id')}: reviewed content needs an explicit outcome")
                else:
                    require(source.get("content_review_status") is None,
                            f"packet a source {source.get('id')}: do not infer content review without a review date")

        collections = {
            name: research.get(name, [])
            for name in ("inventory_entries", "study_options", "application_routes", "facts", "sources", "gaps", "cross_packet_refs")
        }
        ids = {name: records(rows, f"packet {packet_id}/{name}") for name, rows in collections.items()
               if name != "inventory_entries"}
        additional = research.get("additional_offerings", [])
        extra_ids = {row.get("study_option_id") for row in additional}
        require(None not in extra_ids and len(extra_ids) == len(additional),
                f"packet {packet_id}: duplicate or missing additional-offering ID")
        require(not (extra_ids & set(ids["study_options"])),
                f"packet {packet_id}: additional offering duplicates a study option")
        resolved_history = research.get("resolved_gap_history", [])
        history_ids = [row.get("id") for row in resolved_history]
        require(None not in history_ids and len(history_ids) == len(set(history_ids)),
                f"packet {packet_id}: duplicate or missing resolved-history ID")
        active_gap_ids = {row["id"] for row in collections["gaps"]}
        require(not (set(history_ids) & active_gap_ids),
                f"packet {packet_id}: resolved gap remains in the active unknown list")

        expected_cards = set(packet_specs[packet_id]["inventory_card_ids"])
        card_ids = {row.get("inventory_card_id") for row in collections["inventory_entries"]}
        require(None not in card_ids and len(card_ids) == len(collections["inventory_entries"]),
                f"packet {packet_id}: duplicate or missing inventory card ID")
        require(card_ids == expected_cards, f"packet {packet_id}: inventory differs from assignment snapshot")
        for card_id in card_ids:
            require(card_id not in inventory_owner, f"inventory card assigned twice: {card_id}")
            inventory_owner[card_id] = packet_id

        option_ids = set(ids["study_options"])
        option_mapping = set()
        for row in collections["inventory_entries"]:
            values = row.get("study_option_id", row.get("study_option_ids", []))
            if isinstance(values, str):
                values = [values]
            require(isinstance(values, list) and values, f"packet {packet_id}: inventory card has no study option mapping")
            require(set(values) <= option_ids, f"packet {packet_id}: inventory maps to missing study option")
            option_mapping.update(values)
        require(option_mapping == option_ids,
                f"packet {packet_id}: unmapped study options {sorted(option_ids - option_mapping)}")

        ids["study_options"] = option_ids
        ids["additional_offerings"] = extra_ids
        ids["inventory_cards"] = card_ids
        shared_policy = research.get("shared_master_policy")
        if isinstance(shared_policy, dict):
            reference_ids(shared_policy.get("fact_ids"), ids["facts"], f"packet {packet_id} shared Master policy")
        check_references({**collections, "additional_offerings": additional}, ids, packet_id)
        for row in resolved_history:
            previous = row.get("previous_record", {})
            if packet_id == "a":
                require(previous.get("id") == row["id"],
                        f"packet {packet_id}: resolved-history entry lost its previous record")
            reference_ids(row.get("source_ids"), ids["sources"], f"packet {packet_id} resolved history {row['id']}")

        for collection, values in ids.items():
            if collection != "inventory_cards":
                for record_id in values:
                    require(record_id not in all_owned_ids,
                            f"duplicate ID across packets: {record_id} ({all_owned_ids.get(record_id)} and {packet_id})")
                    all_owned_ids[record_id] = packet_id

        handoff_path = folder / "handoff.md"
        handoff = handoff_path.read_text(encoding="utf-8") if handoff_path.exists() else ""
        status = next((line.strip() for line in handoff.splitlines() if line.startswith("**Status:")), "missing")
        statuses[packet_id] = status
        loaded[packet_id] = research
        packet_ids[packet_id] = ids
        summaries[packet_id] = {
            "inventory": len(card_ids),
            "options": len(option_ids),
            "routes": len(ids["application_routes"]),
            "facts": len(ids["facts"]),
            "sources": len(ids["sources"]),
            "gaps": len(ids["gaps"]),
            "additional": len(extra_ids),
        }

    a = loaded["a"]
    a_facts = {row["id"]: row for row in a["facts"]}
    require(all(row.get("review_status") in {"verified", "verified_source_conflict"} for row in a["facts"]),
            "packet A: every fact needs an explicit content-review status")
    regular = next(row for row in a["application_routes"] if row["id"] == "nu-a-route-regular-foundation-undergraduate")
    require(regular.get("classification") and regular.get("target") and regular.get("destination"),
            "packet A: regular Foundation/UG route needs classification, selected-program target and portal")
    foundation = next(row["id"] for row in a["study_options"] if row["id"] == "nu-a-study-nu-foundation-year-program")
    common_ug = set(regular["study_option_ids"]) - {foundation}
    fyp_ids = set(a_facts["nu-a-fact-fyp-english"]["scope"]["study_option_ids"])
    fyp_academic_ids = set(a_facts["nu-a-fact-fyp-academic"]["scope"]["study_option_ids"])
    ug_ids = set(a_facts["nu-a-fact-ug-english"]["scope"]["study_option_ids"])
    ug_academic_ids = set(a_facts["nu-a-fact-ug-academic-alternatives"]["scope"]["study_option_ids"])
    require(fyp_ids == fyp_academic_ids == {foundation}, "packet A: Foundation minima must stay on the Foundation option")
    require(ug_ids == ug_academic_ids == common_ug, "packet A: UG minima must match the common UG route option set")
    require(fyp_ids.isdisjoint(ug_ids), "packet A: Foundation and UG minima must not overlap")
    require(all(row.get("review_status") in {"verified", "verified_source_conflict"}
                and row.get("publication_status") and row.get("checked_date") and row.get("source_ids")
                for row in a["gaps"]),
            "packet A: active gaps need source IDs, publication/review status and a content-check date")
    require("nu-a-gap-card-detail" not in {row["id"] for row in a["gaps"]}
            and "nu-a-gap-card-detail" in {row["id"] for row in a.get("resolved_gap_history", [])},
            "packet A: completed card collection summary must be history, not an active gap")

    require(len(inventory_owner) == 93, f"Expected 93 unique assigned cards, found {len(inventory_owner)}")
    require(sum(s["inventory"] for s in summaries.values()) == assignment["inventory_count"],
            "Packet inventory total differs from assignment")
    all_study_options = set().union(*(packet_ids[p]["study_options"] for p in PACKETS))
    for packet_id in PACKETS:
        for fact in loaded[packet_id]["facts"]:
            scope = fact.get("scope")
            if isinstance(scope, dict):
                reference_ids(scope.get("study_option_ids"), all_study_options,
                              f"packet {packet_id} fact {fact['id']} scope")

    # Cross-packet target lists are explicit; unresolved scope is allowed during research.
    for row in loaded["a"].get("cross_packet_refs", []):
        reference_ids(row.get("target_fact_ids"), packet_ids["b"]["facts"], f"A cross-packet ref {row['id']}")
        reference_ids(row.get("target_source_ids"), packet_ids["b"]["sources"], f"A cross-packet ref {row['id']}")

    a_master_options = {
        row["id"] for row in loaded["a"]["study_options"] if row.get("study_type") == "masters"
    }
    master_export = next(
        row for row in loaded["b"].get("cross_packet_refs", [])
        if row.get("id") == "nu-b-cross-master-policy-export-a"
    )
    require(set(master_export.get("study_option_ids", [])) == a_master_options,
            "B master-policy export must scope exactly to A's ten master options")
    shared_master_ids = set(loaded["b"].get("shared_master_policy", {}).get("fact_ids", []))
    require(set(master_export.get("fact_ids", [])) == shared_master_ids,
            "B master-policy export must link every shared policy fact")
    b_facts_by_id = {row["id"]: row for row in loaded["b"]["facts"]}
    for fact_id in shared_master_ids:
        scope_ids = set(b_facts_by_id[fact_id].get("scope", {}).get("study_option_ids", []))
        require(a_master_options <= scope_ids,
                f"B shared master fact {fact_id} omits an A master option")

    c_record_ids = set().union(*(packet_ids["c"][name] for name in ("study_options", "application_routes", "facts", "sources", "gaps", "cross_packet_refs")))
    for row in loaded["c"].get("cross_packet_refs", []):
        reference_ids(row.get("target_ids"), c_record_ids, f"C cross-packet ref {row['id']}")
    b_phd_ref = next(
        row for row in loaded["b"].get("cross_packet_refs", []) if row.get("id") == "nu-b-cross-phd-policy-c"
    )
    reference_ids(b_phd_ref.get("fact_ids"), packet_ids["c"]["facts"], "B PhD-policy cross-packet ref")

    return summaries, statuses


def main():
    try:
        summaries, statuses = validate()
    except ValidationError as error:
        print(f"Research validation failed: {error}", file=sys.stderr)
        return 1

    for packet_id in PACKETS:
        summary = summaries[packet_id]
        print(
            f"Packet {packet_id.upper()}: {summary['inventory']} cards, {summary['options']} options, "
            f"{summary['routes']} routes, {summary['facts']} facts, {summary['sources']} sources, "
            f"{summary['gaps']} gaps, {summary['additional']} additional offerings; {statuses[packet_id]}"
        )
    print("Research packet structure and references validated; handoff statuses are reported separately.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
