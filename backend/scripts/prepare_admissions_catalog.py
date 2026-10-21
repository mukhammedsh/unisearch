"""Resolve the accepted admissions batch offline, without activating runtime data."""

import argparse
import hashlib
import json
import re
from pathlib import Path
import sys


REPO = Path(__file__).resolve().parents[2]
DRAFTS = REPO / "backend/data/drafts"
BATCH = ("mit", "imperial-college-london-uk", "stanford-university-usa-ca")
VERSION = "admissions-storage-1.0"
LEVELS = {
    "Bachelor": "undergraduate", "Master": "masters", "Doctorate": "doctoral",
    "Professional": "professional", "bachelor": "undergraduate", "master": "masters",
    "master's": "masters", "doctorate": "doctoral", "postgraduate_taught": "masters",
    "undergraduate": "undergraduate", "masters": "masters", "doctoral": "doctoral",
    "professional": "professional", "institution": "institution", "graduate": "graduate",
    "professional graduate": "professional graduate", "intermediate graduate": "intermediate graduate",
}
LEVEL_CONTEXTS = {"institution", "graduate", "professional graduate", "intermediate graduate",
                  "professional_apprenticeship_inventory", "postgraduate other",
                  "professional graduate degrees explicitly listed by KHS"}


class PreparationError(ValueError):
    """An accepted input no longer satisfies its preparation contract."""


def require(condition, message):
    if not condition:
        raise PreparationError(message)


def records(rows, context):
    require(isinstance(rows, list), f"{context}: expected an array")
    result = {}
    for row in rows:
        require(isinstance(row, dict) and isinstance(row.get("id"), str) and bool(row["id"].strip()), f"{context}: missing record ID")
        require(row["id"] not in result, f"{context}: duplicate ID {row['id']}")
        result[row["id"]] = row
    return result


def attributes(row, consumed):
    return {key: value for key, value in row.items() if key not in consumed}


def index_attributes(index, raw, consumed):
    return {key: value for key, value in attributes(index, consumed).items()
            if key not in raw or raw[key] != value}


def as_list(value):
    if value is None:
        return []
    require(isinstance(value, (str, list)), "Scope dimension must be a string, array, or null")
    return [value] if isinstance(value, str) else value


def scope(row, original=None):
    original = row if original is None else original
    level_values = row.get("levels", row.get("study_levels", row.get("study_level", row.get("level"))))
    levels = as_list(level_values)
    require(all(level in LEVELS or level in LEVEL_CONTEXTS or level == "undergraduate_and_postgraduate_taught"
                for level in levels), f"Unsupported scope level: {levels}")
    normalized_levels = []
    for level in levels:
        if level == "undergraduate_and_postgraduate_taught":
            normalized_levels.extend(["undergraduate", "masters"])
        elif level not in LEVEL_CONTEXTS:
            normalized_levels.append(LEVELS[level])
    known = {"option_ids", "study_option_ids", "study_option_id", "route_ids", "procedure_ids",
             "levels", "study_levels", "study_level", "level", "applicant_categories", "applicant_category",
             "cycle", "admission_cycle", "fee_status", "original_scope"}
    return {
        "option_ids": as_list(row.get("option_ids", row.get("study_option_ids", row.get("study_option_id")))),
        "route_ids": as_list(row.get("route_ids", row.get("procedure_ids"))),
        "levels": normalized_levels,
        "applicant_categories": as_list(row.get("applicant_categories", row.get("applicant_category"))),
        "cycle": row.get("cycle", row.get("admission_cycle")),
        "fee_status": as_list(row.get("fee_status")),
        "additional_dimensions": {
            **attributes(row, known), **attributes(original, known),
            **({"level_context": [level for level in levels if level in LEVEL_CONTEXTS]}
               if any(level in LEVEL_CONTEXTS for level in levels) else {}),
        },
    }


def provenance(index, raw, filename):
    return {
        "evidence_file": filename,
        "original_id": raw["id"],
        "original_scope": raw.get("scope"),
        "original_source_ids": raw.get("source_ids"),
    }


def prepare_institution(folder):
    folder = Path(folder).resolve()
    manifest = {}

    def input_bytes(name):
        require(isinstance(name, str), "Input path must be a string")
        path = (folder / name).resolve()
        require(path.is_relative_to(folder) and path != folder, f"Input escapes institution directory: {name}")
        require(path.is_file(), f"Missing input: {name}")
        data = path.read_bytes()
        manifest[name] = {"path": f"backend/data/drafts/{folder.name}/{name}",
                          "sha256": hashlib.sha256(data).hexdigest()}
        return data

    def read(name):
        data = input_bytes(name)
        try:
            return json.loads(data.decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise PreparationError(f"Invalid UTF-8 JSON: {name}") from error

    catalog = read("catalog.json")
    kind = folder.name
    require(kind in BATCH, f"Unsupported institution: {kind}")
    expected_id = "mit-usa-cambridge" if kind == "mit" else kind
    require(catalog.get("institution", {}).get("id") == expected_id, "Institution ID does not match its accepted directory")
    expected_version = {"mit": "2.0", "imperial-college-london-uk": "imperial-stage1-1.0",
                        "stanford-university-usa-ca": "1.0"}[kind]
    require(catalog.get("schema_version") == expected_version, "Unsupported draft structural version")
    if kind == "imperial-college-london-uk":
        require(catalog.get("status") == "stage1_reviewed", "Imperial draft is not accepted")
    else:
        require(catalog.get("snapshot", {}).get("completion_status") in ("complete", "reviewed"),
                "Draft completion status is not accepted")
    if kind == "stanford-university-usa-ca":
        require(read("recheck-owner.json").get("review_status") == "reviewed", "Stanford comprehensive recheck is not accepted")
    bundles = {}
    for filename, fingerprint in catalog.get("evidence_fingerprints", {}).items():
        bundles[filename] = read(filename)
        text_hash = hashlib.sha256((folder / filename).read_text(encoding="utf-8").encode("utf-8")).hexdigest()
        require(text_hash == fingerprint, f"Stale evidence fingerprint: {filename}")
    if kind != "mit":
        require(bool(bundles), "Linked draft has no evidence fingerprints")
    for name, bundle in bundles.items():
        require(not bundle.get("uncompleted_collection"), f"Unfinished collection in {name}")
        require(all(task.get("status") in ("completed", "superseded_by_reviewed_evidence")
                    for task in bundle.get("collection_tasks", [])), f"Unfinished collection in {name}")
    lookups = {(name, key): records(bundle.get(key, []), f"{name}/{key}")
               for name, bundle in bundles.items()
               for key in ("facts", "unresolved", "researched_unknowns", "study_options", "application_procedures")}

    def resolve(index, key):
        filename = index.get("evidence_file", "catalog.json")
        if filename == "catalog.json":
            return index, filename
        require(filename in bundles, f"Unfingerprinted evidence: {filename}")
        original_id = index.get("original_id", index["id"])
        raw = lookups[(filename, key)].get(original_id)
        require(raw is not None, f"Broken evidence link: {filename}/{key}/{original_id}")
        return raw, filename

    source_rows = catalog.get("sources")
    if source_rows is None:
        source_rows = read(catalog.get("sources_file", catalog.get("source_file")))["sources"]
    records(source_rows, "sources")
    source_index = {row["id"]: row for row in source_rows}
    for filename, bundle in bundles.items():
        for raw in bundle["sources"]:
            source_id = f"{Path(filename).stem}:{raw['id']}" if kind == "stanford-university-usa-ca" else raw["id"]
            indexed = source_index.get(source_id)
            require(indexed is not None, f"Unindexed evidence source: {filename}/{raw['id']}")
            if kind == "imperial-college-london-uk":
                require(raw in indexed.get("evidence_records", []), f"Source evidence records differ: {source_id}")
            else:
                require(all(indexed.get(key) == value for key, value in raw.items() if key != "id"),
                        f"Source record differs: {source_id}")
    sources = [{"id": row["id"], "url": row["url"], "title": row["title"],
                "checked_at": row.get("checked_at"),
                "attributes": attributes(row, {"id", "url", "title", "checked_at"})} for row in source_rows]
    facts = []
    for index in catalog["facts"]:
        raw, filename = resolve(index, "facts")
        for key in ("publication_status", "review_status"):
            require(index.get(key) == raw.get(key), f"Indexed {key} differs: {index['id']}")
        require(index.get("topic", index.get("group")) == raw.get("topic", raw.get("group")), f"Indexed topic differs: {index['id']}")
        if "checked_at" in index:
            require(index["checked_at"] == raw.get("checked_at"), f"Indexed review date differs: {index['id']}")
        expected_sources = ([f"{Path(filename).stem}:{source_id}" for source_id in raw["source_ids"]]
                            if kind == "stanford-university-usa-ca" else raw["source_ids"])
        require(index["source_ids"] == expected_sources, f"Indexed source references differ: {index['id']}")
        require("value" in raw and isinstance(raw.get("scope"), dict), f"Incomplete fact: {index['id']}")
        require(index.get("original_scope", index["scope"].get("original_scope", raw["scope"])) == raw["scope"],
                f"Stale original scope: {index['id']}")
        consumed = {"id", "topic", "value", "scope", "conditions", "conditions_and_exceptions", "exceptions",
                    "source_ids", "publication_status", "review_status", "checked_at", "content_reviewed_at",
                    "period", "related_fact_ids", "topics"}
        facts.append({
            "id": index["id"], "topic": raw.get("topic", raw.get("group")), "topics": raw.get("topics", []),
            "scope": scope(index["scope"], raw["scope"]), "value": raw["value"],
            "conditions": raw.get("conditions"), "conditions_and_exceptions": raw.get("conditions_and_exceptions"),
            "exceptions": raw.get("exceptions"), "source_ids": index["source_ids"],
            "publication_status": raw.get("publication_status"), "review_status": raw.get("review_status"),
            "checked_at": raw.get("checked_at"),
            "content_reviewed_at": raw.get("content_reviewed_at", index.get("content_reviewed_at")),
            "period": raw.get("period"), "related_fact_ids": raw.get("related_fact_ids", []),
            "provenance": provenance(index, raw, filename), "attributes": attributes(raw, consumed),
            "index_attributes": index_attributes(index, raw, consumed | {"evidence_file", "original_id", "original_scope"}),
        })
    if bundles:
        linked = {(row["provenance"]["evidence_file"], row["provenance"]["original_id"]) for row in facts}
        require(len(linked) == len(facts), "An evidence fact was indexed more than once")
        expected = {(name, fact_id) for name in bundles for fact_id in lookups[(name, "facts")]}
        require(linked == expected, "Catalog does not index every evidence fact exactly once")
    routes = []
    for index in catalog.get("application_routes", catalog.get("application_procedures", [])):
        raw, filename = resolve(index, "application_procedures")
        consumed = {"id", "title", "option_ids", "source_ids", "shared_policy_context_ids", "destination", "classification", "shared_form_family", "fact_ids"}
        routes.append({"id": index["id"], "title": index.get("title", index.get("official_target", index.get("target"))),
                       "classification": index.get("classification", index.get("application_classification")),
                       "target": index.get("official_target", index.get("application_target", index.get("target"))),
                       "destination": index.get("destination"), "shared_form_family": index.get("shared_form_family"),
                       "option_ids": index.get("option_ids", index.get("study_option_ids", [])),
                       "source_ids": index.get("source_ids", []),
                       "fact_ids": list(dict.fromkeys([*index.get("fact_ids", []),
                                    *[fact["id"] for fact in facts if index["id"] in fact["scope"]["route_ids"]]])),
                       "shared_policy_context_ids": index.get("shared_policy_context_ids", []),
                       "provenance": provenance(index, raw, filename),
                       "attributes": attributes(raw, consumed),
                       "index_attributes": index_attributes(index, raw, consumed | {"evidence_file", "original_id"})})
    options = []
    for index in catalog["study_options"]:
        level_values = index.get("study_levels", [index.get("level")])
        require(all(level in LEVELS and LEVELS[level] in ("undergraduate", "masters", "doctoral", "professional")
                    for level in level_values), f"Unsupported option level: {index['id']}")
        profiles = []
        option_source_ids = list(index.get("source_ids", []))
        for link in index.get("evidence_profiles", []):
            raw, filename = resolve({"id": link["id"], "evidence_file": link["evidence_file"]}, "study_options")
            profile_sources = []
            for original_source_id in raw.get("source_ids", []):
                matches = [row["id"] for row in source_rows
                           if row.get("evidence_file") == filename and row.get("original_id") == original_source_id]
                require(len(matches) == 1, f"Broken profile source link: {filename}/{original_source_id}")
                profile_sources.append(matches[0])
                if matches[0] not in option_source_ids:
                    option_source_ids.append(matches[0])
            profiles.append({"evidence_file": filename, "original_id": raw["id"],
                             "source_ids": profile_sources, "attributes": attributes(raw, {"id"})})
        consumed = {"id", "title", "level", "award", "source_ids", "fact_ids", "parent_option_id",
                    "evidence_profiles", "procedure_ids"}
        options.append({"id": index["id"], "title": index.get("title", index.get("official_name")),
                        "levels": [LEVELS[level] for level in level_values],
                        "awards": index.get("awards", [index["award"]] if "award" in index else []),
                        "route_ids": index.get("procedure_ids", index.get("application", {}).get("route_ids", [])),
                        "parent_option_id": index.get("parent_option_id"),
                        "source_ids": option_source_ids,
                        "fact_ids": list(dict.fromkeys([*index.get("fact_ids", []),
                                     *[fact["id"] for fact in facts if index["id"] in fact["scope"]["option_ids"]]])),
                        "evidence_profiles": profiles, "attributes": attributes(index, consumed)})
    unknown_key = "researched_unknowns" if kind == "imperial-college-london-uk" else "unresolved"
    unknowns = []
    for index in catalog.get(unknown_key, []):
        raw, filename = resolve(index, unknown_key)
        for key in ("publication_status", "review_status", "checked_at"):
            require(index.get(key) == raw.get(key), f"Indexed unknown {key} differs: {index['id']}")
        raw_sources = raw.get("source_ids", raw.get("evidence_source_ids", raw.get("reviewed_source_ids", [])))
        expected_sources = ([f"{Path(filename).stem}:{source_id}" for source_id in raw_sources]
                            if kind == "stanford-university-usa-ca" else raw_sources)
        require(index.get("source_ids", []) == expected_sources, f"Indexed unknown sources differ: {index['id']}")
        raw_scope = raw.get("scope", {key: raw[key] for key in (
            "option_ids", "procedure_ids", "levels", "study_level", "applicant_category", "cycle", "fee_status", "route") if key in raw})
        indexed_scope = dict(index.get("scope", raw_scope))
        if kind == "imperial-college-london-uk" and "option_ids" in index:
            indexed_scope["option_ids"] = index["option_ids"]
        consumed = {"id", "scope", "source_ids", "reason", "official_next_step", "publication_status",
                    "review_status", "checked_at", "content_reviewed_at"}
        unknowns.append({"id": index["id"], "reason": raw.get("reason", raw.get("finding")),
                         "official_next_step": raw.get("official_next_step", raw.get("next_official_step", raw.get("next_step"))),
                         "scope": scope(indexed_scope, raw_scope), "source_ids": index.get("source_ids", []),
                         "publication_status": raw.get("publication_status"), "review_status": raw.get("review_status"),
                         "checked_at": raw.get("checked_at"), "content_reviewed_at": raw.get("content_reviewed_at"),
                         "provenance": provenance(index, raw, filename), "attributes": attributes(raw, consumed),
                         "index_attributes": index_attributes(index, raw, consumed | {"evidence_file", "original_id", "original_scope"})})
    if bundles:
        linked_unknowns = {(row["provenance"]["evidence_file"], row["provenance"]["original_id"]) for row in unknowns}
        expected_unknowns = {(name, record_id) for name in bundles for record_id in lookups[(name, unknown_key)]}
        require(len(linked_unknowns) == len(unknowns) and linked_unknowns == expected_unknowns,
                "Catalog does not index every researched unknown exactly once")
    tasks = catalog.get("collection_tasks", catalog.get("uncompleted_collection", catalog.get("coverage", {}).get("uncompleted_collection", [])))
    require(all(isinstance(task, dict) and task.get("status") in ("completed", "superseded", "superseded_by_completed_research", "superseded_by_reviewed_evidence")
                for task in tasks), "Unfinished collection cannot enter the accepted prepared batch")
    historical = []
    for filename in [catalog.get("historical_provenance_file"), *catalog.get("coverage", {}).get("historical_inputs", [])]:
        if filename:
            input_bytes(filename)
            historical.append({**manifest[filename], "role": "historical_input_not_current_policy"})
    if kind == "stanford-university-usa-ca" and (folder / "runtime-provenance.json").is_file():
        read("runtime-provenance.json")
        historical.append({**manifest["runtime-provenance.json"], "role": "historical_input_not_current_policy"})
    supporting = []
    for filename in ("route-coverage.json", "coverage-index.json", catalog.get("inventory_file")):
        if filename and (filename == catalog.get("inventory_file") or (folder / filename).is_file()):
            read(filename)
            supporting.append({**manifest[filename], "role": "supporting_evidence_not_policy_inheritance"})
    dossier_metadata = {name: {key: bundle[key] for key in ("scope", "catalog_period", "owner_scope", "coverage_assessments",
                                                          "course_scope_coverage", "fee_panel_reconciliation", "external_references")
                              if key in bundle}
                        for name, bundle in bundles.items()}
    consumed_catalog = {"schema_version", "institution", "snapshot", "sources", "sources_file", "source_file", "study_options",
                        "application_routes", "application_procedures", "facts", "unresolved", "researched_unknowns",
                        "collection_tasks", "uncompleted_collection", "historical_provenance_file", "evidence_fingerprints",
                        "evidence_files", "inventory_file"}
    result = {"institution": {"id": catalog["institution"]["id"],
                               "official_name": catalog["institution"].get("official_name", catalog["institution"].get("name")),
                               "attributes": attributes(catalog["institution"], {"id", "official_name", "name"})},
              "snapshot": catalog.get("snapshot", {"checked_at": catalog.get("checked_at"), "reviewed_at": catalog.get("reviewed_at"), "status": catalog.get("status")}),
              "inputs": [manifest[name] for name in sorted(manifest)], "sources": sources, "study_options": options,
              "application_routes": routes, "facts": facts, "unknowns": unknowns, "collection_tasks": tasks,
              "organization": attributes(catalog, consumed_catalog), "supporting_records": supporting,
              "dossier_metadata": dossier_metadata, "historical_provenance": historical}
    for fact in facts:
        if fact["id"] != "undergraduate-shared-evidence:stanford-ug-tuition-and-budget-2026-27":
            continue
        # shortcut: parse this reviewed prose budget until the accepted dossier has structured cost fields.
        text = fact["value"]
        tuition = re.search(r"\btuition USD ([\d,]+);", text)
        total = re.search(r"\btotal USD ([\d,]+)\.", text)
        year = re.fullmatch(r"(20\d{2}-20\d{2}) academic year", fact["scope"]["cycle"])
        require(tuition and total and year, "Stanford undergraduate reference cost wording needs review")
        fact["attributes"]["catalog_costs"] = {
            "period": "Academic year", "academic_year": year[1], "currency": "USD",
            "tuition": int(tuition[1].replace(",", "")), "total_before_aid": int(total[1].replace(",", "")),
            "exclusions": ["insurance", "travel", "one_time_fees"],
        }
    validate_institution(result)
    return result


def validate_institution(institution):
    entities = {key: records(institution[key], key) for key in ("sources", "study_options", "application_routes", "facts", "unknowns")}

    def refs(values, key, context):
        require(isinstance(values, list) and all(isinstance(value, str) for value in values), f"Invalid reference array: {context}")
        missing = set(values) - entities[key].keys()
        require(not missing, f"Broken {key} reference in {context}: {sorted(missing)}")

    for key in ("study_options", "application_routes", "facts", "unknowns"):
        for row in institution[key]:
            context = row["id"]
            refs(row["source_ids"], "sources", context)
            if key == "study_options":
                refs(row["route_ids"], "application_routes", context)
                refs(row["fact_ids"], "facts", context)
                for profile in row["evidence_profiles"]:
                    refs(profile["source_ids"], "sources", context)
                if row["parent_option_id"]:
                    refs([row["parent_option_id"]], "study_options", context)
            if key == "application_routes":
                refs(row["option_ids"], "study_options", context)
                refs(row["shared_policy_context_ids"], "application_routes", context)
                metadata = {**row["attributes"], **row["index_attributes"]}
                refs(metadata.get("policy_for_route_ids", []), "application_routes", context)
                refs(row["fact_ids"], "facts", context)
            if key in ("facts", "unknowns"):
                refs(row["scope"]["option_ids"], "study_options", context)
                refs(row["scope"]["route_ids"], "application_routes", context)
            if key == "facts":
                refs(row["related_fact_ids"], "facts", context)
            if key == "unknowns":
                require(bool(row["reason"]) and bool(row["official_next_step"]), f"Unknown lacks reason/official next step: {context}")


def prepare_batch(drafts=DRAFTS):
    return {"schema_version": VERSION, "runtime_active": False,
            "institutions": [prepare_institution(Path(drafts) / name) for name in BATCH]}


def write_output(prepared, directory, repo=REPO):
    destination = Path(directory).resolve()
    root = Path(repo).resolve()
    allowed = (root / ".tmp_test").resolve()
    require(allowed.is_relative_to(root), "Repository .tmp_test resolves outside the workspace")
    require(destination.is_relative_to(allowed) and destination != allowed, "Output must be a new directory below repository .tmp_test")
    require(not destination.exists(), "Output directory already exists; refusing to overwrite")
    destination.mkdir(parents=True, exist_ok=False)
    path = destination / "admissions-catalog.json"
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(prepared, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, help="Write to a new directory below repository .tmp_test; default only checks")
    args = parser.parse_args(argv)
    try:
        prepared = prepare_batch()
        if args.output_dir:
            print(f"Prepared inactive catalog: {write_output(prepared, args.output_dir)}")
        for institution in prepared["institutions"]:
            print(f"{institution['institution']['id']}: {len(institution['study_options'])} options, "
                  f"{len(institution['application_routes'])} routes, {len(institution['facts'])} facts, "
                  f"{len(institution['unknowns'])} separate unknowns; runtime inactive")
        return 0
    except (PreparationError, OSError, KeyError, TypeError) as error:
        print(f"Admissions preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
