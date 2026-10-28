"""Assess reviewed source-bound checks against self-reported applicant evidence."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any

from app.services import exams as exams_service, languages as languages_service
from app.core.paths import DATA_DIR
from app.services.admissions_catalog import AdmissionsCatalogError, _cycle_axis

ASSESSMENTS_PATH = DATA_DIR / "admissions" / "assessments.json"


def _fact_hash(fact):
    raw = {key: value for key, value in fact.items() if key != "applicability"}
    return hashlib.sha256(json.dumps(raw, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _annotations():
    try:
        raw = Path(ASSESSMENTS_PATH).read_bytes()
        data = json.loads(raw.decode("utf-8"))
        if data.get("schema_version") != "admissions-assessments-1.0" or not isinstance(data.get("records"), list):
            raise ValueError("Unsupported assessment annotations")
        indexed = {}
        for record in data["records"]:
            key = (record["institution_id"], record["fact_id"])
            if key in indexed or not re.fullmatch(r"[a-f0-9]{64}", record["fact_sha256"]) or not isinstance(record["checks"], list) or not record["checks"]:
                raise ValueError("Invalid assessment record")
            if not isinstance(record["scope"], dict) or not isinstance(record["remaining_conditions"], list):
                raise ValueError("Invalid assessment scope or conditions")
            if any(not isinstance(values, list) or any(not isinstance(value, str) for value in values) for values in record["scope"].values()):
                raise ValueError("Invalid assessment selectors")
            if any(check["kind"] not in {"exam_alternatives", "academic_requirement", "manual_minimum", "scoped_gpa", "enrollment", "enrollment_units", "credential", "language_requirement", "covered_minima"}
                   for check in record["checks"]):
                raise ValueError("Unsupported assessment check")
            check_ids = set()
            for check in record["checks"]:
                if check["id"] in check_ids:
                    raise ValueError("Duplicate assessment check")
                check_ids.add(check["id"])
                if "minimum" in check and (isinstance(check["minimum"], bool) or not math.isfinite(float(check["minimum"]))):
                    raise ValueError("Invalid reviewed minimum")
                if check["kind"] in {"exam_alternatives", "academic_requirement", "language_requirement"}:
                    if not isinstance(check["alternatives"], list) or not check["alternatives"]:
                        raise ValueError("Missing reviewed alternatives")
                    for alternative in check["alternatives"]:
                        if not alternative.get("exam_id") and not alternative.get("credential_id") and not (check["kind"] == "academic_requirement" and alternative.get("profile_field") == "gpa"):
                            raise ValueError("Missing reviewed evidence identifier")
                        component_minima = alternative.get("component_minimums", {})
                        if not isinstance(component_minima, dict) or any(not isinstance(key, str) or not key for key in component_minima):
                            raise ValueError("Invalid reviewed component minima")
                        minima = list(component_minima.values())
                        if "minimum" in alternative:
                            minima.append(alternative["minimum"])
                        for count_rule in ([alternative["components_at_least"]] if alternative.get("components_at_least") else []) + alternative.get("additional_component_counts", []):
                            if not isinstance(count_rule, dict) or type(count_rule.get("count")) is not int or count_rule["count"] < 1:
                                raise ValueError("Invalid reviewed component count")
                            minima.append(count_rule["minimum"])
                        if any(isinstance(value, bool) or not math.isfinite(float(value)) for value in minima):
                            raise ValueError("Invalid reviewed alternative minimum")
                        if check["kind"] == "academic_requirement" and not minima:
                            raise ValueError("Missing reviewed academic minimum")
                        if alternative.get("profile_field") == "gpa" and ("minimum" not in alternative or isinstance(alternative.get("scale"), bool) or not isinstance(alternative.get("scale"), (int, float)) or not 1 <= alternative["scale"] <= 5):
                            raise ValueError("Missing reviewed GPA scale")
                        for first, last in alternative.get("windows", []):
                            if date.fromisoformat(first) > date.fromisoformat(last):
                                raise ValueError("Invalid reviewed test window")
            indexed[key] = record
        for key, record in indexed.items():
            for check in record["checks"]:
                if check["kind"] == "covered_minima":
                    target = indexed.get((key[0], check["covered_by_fact_id"]))
                    if target is None or not set(check["covered_check_ids"]).issubset({item["id"] for item in target["checks"] if item["kind"] in {"scoped_gpa", "enrollment_units", "language_requirement"}}):
                        raise ValueError("Unresolved covered minimum checks")
        return indexed, hashlib.sha256(raw).hexdigest()
    except (OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
        raise AdmissionsCatalogError("Reviewed assessment annotations are unavailable") from error


def get_assessment_revision():
    return _annotations()[1]


def _submitted_exams(profile):
    parsed = []
    for row in profile.get("exams", []):
        if not isinstance(row, dict):
            continue
        exam_id = row.get("id") or row.get("exam")
        try:
            result = exams_service.coerce_exam_submission(exam_id, score_raw=row.get("score"),
                                                         raw_value=row.get("raw_value"), details=row.get("details"), taken_on=row.get("taken_on"),
                                                         allow_total_only_sat=True)
        except (ValueError, TypeError):
            continue
        if exams_service._config_entry(result["exam"]).get("type") == "bool" and not result.get("score"):
            continue
        parsed.append({**result, "taken_on": row.get("taken_on")})
    for row in profile.get("languages", []):
        if not isinstance(row, dict) or row.get("kind") != "exam":
            continue
        try:
            result = languages_service.validate_language(row)["language"]
        except (ValueError, TypeError):
            continue
        parsed.append({**result, "taken_on": row.get("taken_on")})
    return parsed


def _dated_status(taken_on, windows):
    if not windows:
        return "met"
    if not taken_on:
        return "missing"
    try:
        actual = date.fromisoformat(taken_on)
        if actual > date.today():
            return "unassessed"
        return "met" if any(date.fromisoformat(start) <= actual <= date.fromisoformat(end) for start, end in windows) else "unmet"
    except (ValueError, TypeError):
        return "unassessed"


def _exam_minimum(alternative, row):
    """Keep all total/section checks inside one validated test attempt."""
    checks = []

    def add(exam, minimum, provided):
        checks.append({"exam": exam, "minimum": minimum, "provided": provided,
                       "status": "missing" if provided is None else "met" if provided >= minimum else "unmet"})

    if "minimum" in alternative:
        add(alternative["exam_id"], alternative["minimum"], row.get("score"))
    components = {item["exam"]: item.get("score") for item in (row.get("details") or {}).get("components", [])}
    for exam, minimum in alternative.get("component_minimums", {}).items():
        add(exam, minimum, components.get(exam))
    for count_rule in ([alternative["components_at_least"]] if alternative.get("components_at_least") else []) + alternative.get("additional_component_counts", []):
        values = [value for exam, value in components.items()
                  if value is not None and (not count_rule.get("exam_ids") or exam in count_rule["exam_ids"])]
        met = sum(value >= count_rule["minimum"] for value in values)
        checks.append({"exam": alternative["exam_id"], "minimum": count_rule,
                       "provided": {"reported": len(values), "meeting_minimum": met},
                       "status": "met" if met >= count_rule["count"] else "missing" if len(values) < count_rule["count"] else "unmet"})
    status = "missing" if any(item["status"] == "missing" for item in checks) else "unmet" if any(item["status"] == "unmet" for item in checks) else "met"
    dated = _dated_status(row.get("taken_on"), alternative.get("windows"))
    if dated != "met":
        status = dated
    if alternative.get("date_boundary"):
        boundary = alternative["date_boundary"]
        if not row.get("taken_on"):
            status = "missing"
        elif not boundary[0] <= row["taken_on"] <= boundary[1]:
            status = "unassessed"
    if alternative.get("max_age_years"):
        status = "unassessed"
    if alternative.get("requires_review"):
        status = "unassessed"
    return status, {**row, "minimum_checks": checks}


def _check_evidence(check, profile, submissions):
    kind = check["kind"]
    if kind == "manual_minimum":
        return "unassessed", {key: profile[key] for key in ("gpa", "gpa_scale") if profile.get(key) is not None} or None, False
    if kind == "academic_requirement":
        options = []
        for alternative in check["alternatives"]:
            if alternative.get("profile_field") == "gpa":
                if profile.get("gpa") is None:
                    continue
                provided = {"gpa": profile["gpa"], "gpa_scale": profile.get("gpa_scale")}
                status = "unassessed" if profile.get("gpa_scale") != alternative["scale"] else "met" if profile["gpa"] >= alternative["minimum"] else "unmet"
                options.append((status, provided))
            else:
                exam_id = exams_service.resolve_exam_key(alternative["exam_id"])
                options.extend(_exam_minimum(alternative, row) for row in submissions if row.get("exam") == exam_id)
        status = next((state for state in ("met", "missing", "unassessed", "unmet") if any(value[0] == state for value in options)), "missing")
        return status, next((row for state, row in options if state == status), None), True
    if kind == "exam_alternatives":
        options = []
        for alternative in check["alternatives"]:
            if alternative.get("credential_id"):
                rows = [row for row in profile.get("institutional_evidence", []) if row.get("kind") == "credential"
                        and row.get("university_id") == alternative["university_id"] and row.get("credential_id") == alternative["credential_id"]]
                for row in rows:
                    status = "missing" if row.get("status") in {None, "unknown", "in_progress"} or row.get("score_percent") is None else (
                        "met" if row.get("status") == "completed" and row["score_percent"] >= alternative["minimum"] else "unmet")
                    if alternative.get("max_age_years") and status == "met":
                        status = "unassessed"
                    options.append((status, row))
                continue
            rows = [row for row in submissions if row.get("exam") == alternative["exam_id"]]
            for row in rows:
                status = _dated_status(row.get("taken_on"), alternative.get("windows"))
                if alternative.get("max_age_years"):
                    status = "unassessed"
                modules = alternative.get("modules", [])
                submitted_modules = {item.get("exam") for item in row.get("details", {}).get("components", [])}
                if modules and not set(modules).issubset(submitted_modules):
                    status = "missing"
                options.append((status, row))
        status = next((state for state in ("met", "missing", "unassessed", "unmet") if any(value[0] == state for value in options)), "missing")
        evidence = next((row for state, row in options if state == status), None)
        return status, evidence, False
    if kind == "covered_minima":
        return "unassessed", None, False
    if kind in {"scoped_gpa", "enrollment", "enrollment_units", "credential"}:
        evidence_kind = "gpa" if kind == "scoped_gpa" else "enrollment" if kind == "enrollment_units" else kind
        rows = [row for row in profile.get("institutional_evidence", []) if row.get("kind") == evidence_kind
                and row.get("university_id") == check["university_id"]
                and (not check.get("program_id") or row.get("program_id") == check["program_id"])
                and (not check.get("metric") or row.get("metric") == check["metric"])
                and (not check.get("credential_id") or row.get("credential_id") == check["credential_id"])]
        if len(rows) != 1:
            return "missing" if not rows else "unassessed", rows or None, kind in {"scoped_gpa", "enrollment_units"}
        row = rows[0]
        if kind == "enrollment_units":
            units = row.get(check.get("units_field", "units"))
            subjects = row.get(check.get("subjects_field", "completed_major_subjects")) if check.get("subjects_minimum") else None
            if units is None and subjects is None:
                return "missing", row, True
            if (units is not None and units >= check["minimum"]) or (subjects is not None and subjects >= check.get("subjects_minimum", float("inf"))):
                return "met", row, True
            if check.get("subjects_minimum") and (units is None or subjects is None):
                return "unassessed", row, True
            return "unmet", row, True
        if kind == "scoped_gpa":
            if row.get("scale") != check["scale"]:
                return "unassessed", row, True
            return ("met" if row["value"] >= check["minimum"] else "unmet"), row, True
        status = row.get("status", "unknown")
        if status == "unknown":
            return "missing", row, False
        return ("met" if status == check["status"] else "unmet"), row, False
    if kind == "language_requirement":
        primary = next((row for row in profile.get("language_evidence", []) if row.get("kind") == "primary_language"
                        and row.get("language", "").casefold() == "en"), None)
        if check.get("primary_english_exemption") and primary:
            return "met", {"self_reported_exemption": primary}, False
        alternatives = []
        for alternative in check["alternatives"]:
            for row in submissions:
                if row.get("exam") != alternative["exam_id"]:
                    continue
                status, provided = _exam_minimum(alternative, row)
                if check.get("max_age_years"):
                    status = "unassessed"
                alternatives.append((status, provided))
        status = next((state for state in ("met", "missing", "unassessed", "unmet") if any(value[0] == state for value in alternatives)), "missing")
        possible_exemption = [row for row in profile.get("language_evidence", [])
                              if row.get("kind") in check.get("possible_exemption_evidence_kinds", [])
                              and row.get("language", "").casefold() == "en"]
        if not alternatives and possible_exemption:
            return "unassessed", {"possible_exemption_evidence": possible_exemption}, True
        return status, next((row for state, row in alternatives if state == status), None), True
    raise AdmissionsCatalogError("Unsupported reviewed assessment check")


def _annotated_checks(record, fact, resolved, profile, submissions):
    base = {"factId": fact["id"], "sourceIds": fact["source_ids"], "sourceRule": _source_rule(fact),
            "evidenceOrigin": "self_reported"}
    if _fact_hash(fact) != record["fact_sha256"]:
        return [{**base, "kind": "stale_annotation", "status": "unassessed", "reason": "source_fact_changed", "blocksNumericScore": True}]
    if (fact.get("publication_status") != "published" and record.get("source_publication_status") != fact.get("publication_status")) or fact.get("review_status") not in {"verified", "carried_forward_review", "reviewed"}:
        exam_ids = {alternative.get("exam_id") for check in record["checks"] for alternative in check.get("alternatives", [])}
        credentials = {alternative.get("credential_id") for check in record["checks"] for alternative in check.get("alternatives", [])}
        observed = {"exams": [row for row in submissions if row.get("exam") in exam_ids],
                    "institutional_evidence": [row for row in profile.get("institutional_evidence", [])
                                               if row.get("university_id") == record["institution_id"] and
                                               (row.get("kind") != "credential" or row.get("credential_id") in credentials)]}
        return [{**base, "kind": "source_state", "status": "unassessed", "reason": "source_state_not_verified",
                 "provided": observed,
                 "blocksNumericScore": any(check["kind"] in {"academic_requirement", "manual_minimum", "scoped_gpa", "enrollment_units", "language_requirement"}
                                            for check in record["checks"])}]
    context = resolved.get("context", {})
    declared = record["scope"]
    matches = _context_is_applicable(resolved)
    for key, selector in (("option_ids", "study_option_id"), ("route_ids", "application_route_id"),
                          ("levels", "study_level"), ("applicant_routes", "applicant_route")):
        if declared.get(key) and context.get(selector) not in declared[key]:
            matches = False
    if declared.get("cycles") and not any(_cycle_axis(cycle, context.get("intended_entry_cycle")) == "matched" for cycle in declared["cycles"]):
        matches = False
    checks = []
    enrollment_gate = next((check for check in record["checks"] if check["kind"] == "enrollment"), None)
    gate_met = enrollment_gate is None or _check_evidence(enrollment_gate, profile, submissions)[0] == "met"
    for check in record["checks"]:
        if any(context.get(selector) not in check.get("scope", {}).get(key, [context.get(selector)])
               for key, selector in (("option_ids", "study_option_id"), ("route_ids", "application_route_id"), ("levels", "study_level"))):
            continue
        status, provided, measurable = _check_evidence(check, profile, submissions) if matches else ("unassessed", None, False)
        covered_missing = check["kind"] == "covered_minima" and not any(
            row.get("id") == check["covered_by_fact_id"] for row in resolved.get("facts", []))
        if check["kind"] in {"scoped_gpa", "enrollment_units"} and not gate_met and status != "missing":
            status = "unassessed"
        numeric = check["kind"] in {"academic_requirement", "manual_minimum", "scoped_gpa", "enrollment_units", "language_requirement"}
        checks.append({**base, "annotationId": record["id"], "checkId": check["id"], "kind": check["kind"],
                       "status": status, "provided": provided, "minimum": check.get("minimum"),
                       "measurable": measurable, "numericMinimum": numeric,
                       "blocksNumericScore": covered_missing or (numeric and (not matches or status in {"missing", "unassessed"})), "rule": check})
    if record["remaining_conditions"]:
        checks.append({**base, "kind": "remaining_conditions", "status": "unassessed", "conditions": record["remaining_conditions"]})
    return checks


_FACT_APPLICABILITY_AXES = (
    "option", "route", "level", "applicant", "cycle", "fee_status", "conditions",
)


def _context_is_applicable(resolved: dict[str, Any]) -> bool:
    route = resolved.get("selected_route")
    if not isinstance(route, dict) or not route.get("id"):
        return False
    context = resolved.get("context")
    if not isinstance(context, dict):
        return False
    applicability = resolved.get("context_applicability")
    return isinstance(applicability, dict) and all(
        applicability.get(axis) == "matched" or (
            axis == "option" and applicability.get(axis) == "not_required" and resolved.get("reading_scope") == "institution_route"
        ) for axis in ("option", "route", "level")
    )


def _fact_is_current(fact: dict[str, Any]) -> bool:
    if fact.get("review_status") == "superseded":
        return False
    return True


def _fact_applicability_is_matched(fact: dict[str, Any]) -> bool:
    applicability = fact.get("applicability")
    if isinstance(applicability, str):
        return applicability.strip().lower() == "matched"
    return (
        isinstance(applicability, dict)
        and applicability.get("status") == "matched"
        and all(applicability.get(axis) == "matched" for axis in _FACT_APPLICABILITY_AXES)
    )


def _source_lookup(resolved: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = resolved.get("sources")
    if not isinstance(rows, list):
        return {}
    return {str(row.get("id")): row for row in rows if isinstance(row, dict) and row.get("id")}


def _source_rule(fact: dict[str, Any]) -> dict[str, Any]:
    """Retain exact rule fields so a consumer can explain the evidence safely."""
    return {
        key: fact[key]
        for key in (
            "id", "topic", "topics", "value", "conditions",
            "conditions_and_exceptions", "exceptions", "scope", "period",
            "publication_status", "review_status", "checked_at", "content_reviewed_at", "source_ids", "provenance",
        )
        if key in fact
    }


def assess_resolved_context(resolved: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    """Compare supported published minimums, retaining every unresolved source condition."""
    resolved = resolved if isinstance(resolved, dict) else {}
    profile = profile if isinstance(profile, dict) else {}
    selected_route = resolved.get("selected_route") if isinstance(resolved.get("selected_route"), dict) else {}
    selected_option = resolved.get("selected_option") if isinstance(resolved.get("selected_option"), dict) else {}
    context = resolved.get("context") if isinstance(resolved.get("context"), dict) else {}
    source_index = _source_lookup(resolved)
    source_fact_ids: list[str] = []
    checks: list[dict[str, Any]] = []
    missing_evidence: list[dict[str, Any]] = []
    annotations, assessment_revision = _annotations()
    submissions = _submitted_exams(profile)
    valid_exams = {row["exam"].upper() for row in submissions if not row.get("code")}

    context_applicable = _context_is_applicable(resolved)
    requirement_ids = set(
        resolved.get("fact_groups", {}).get("requirements", [])
        if isinstance(resolved.get("fact_groups"), dict) else []
    )
    for fact in resolved.get("facts", []) if isinstance(resolved.get("facts"), list) else []:
        if not isinstance(fact, dict) or fact.get("id") not in requirement_ids or not _fact_is_current(fact):
            continue
        fact_id = str(fact.get("id") or "")
        source_ids = list(fact.get("source_ids") or [])
        source_fact_ids.append(fact_id)
        annotation = annotations.get((resolved.get("institution_id"), fact_id))
        if annotation:
            annotated = _annotated_checks(annotation, fact, resolved, profile, submissions)
            checks.extend(annotated)
            missing_evidence.extend({"type": row["kind"], "factId": fact_id, "checkId": row.get("checkId"),
                                     "sourceIds": source_ids} for row in annotated if row["status"] == "missing")
            continue
        value = fact.get("value") if isinstance(fact.get("value"), dict) else {}
        blocks_numeric = bool(value.get("requirements") or value.get("minima") or any(
            row.get("minimum") is not None for row in value.get("unassessed_published_minimums", []) if isinstance(row, dict)
        ) or any(isinstance(value.get(key), dict) and value[key].get("minimum") is not None for key in ("technical_gpa", "overall_gpa")))
        alternatives = value.get("alternatives")
        is_required_presence = (
            fact.get("publication_status") == "published"
            and value.get("presence") == "required"
            and isinstance(alternatives, list)
            and bool(alternatives)
            and all(isinstance(item, str) and item.strip() for item in alternatives)
        )
        if not context_applicable or not _fact_applicability_is_matched(fact):
            checks.append({
                "factId": fact_id,
                "sourceIds": source_ids,
                "kind": "conditional_rule" if is_required_presence else "published_rule",
                "status": "unassessed",
                "blocksNumericScore": blocks_numeric,
                "sourceRule": _source_rule(fact),
            })
            continue
        if fact.get("publication_status") != "published":
            checks.append({
                "factId": fact_id,
                "sourceIds": source_ids,
                "kind": "unresolved_rule",
                "status": "unassessed",
                "blocksNumericScore": blocks_numeric,
                "sourceRule": _source_rule(fact),
            })
            continue
        if is_required_presence:
            exam_ids = [exams_service.resolve_exam_key(item).upper() for item in alternatives]
            provided = next((exam_id for exam_id in exam_ids if exam_id and exam_id in valid_exams), None)
            checks.append({
                "factId": fact_id,
                "sourceIds": source_ids,
                "kind": "required_exam_presence",
                "examIds": exam_ids,
                "providedExamId": provided,
                "status": "met" if provided else "missing",
                "sourceRule": _source_rule(fact),
            })
            if not provided:
                missing_evidence.append({
                    "type": "required_exam_alternative",
                    "ids": exam_ids,
                    "factId": fact_id,
                    "sourceIds": source_ids,
                })
            continue

        # Textual, scale-specific, conditional, or unsupported evidence is
        # preserved for explanation and never treated as a passed check.
        checks.append({
            "factId": fact_id,
            "sourceIds": source_ids,
            "kind": "published_rule",
            "status": "unassessed",
            "blocksNumericScore": blocks_numeric,
            "sourceRule": _source_rule(fact),
        })

    measurable = [check for check in checks if check.get("measurable")]
    percent = None
    if not context_applicable:
        reason = "applicability_unknown"
    elif missing_evidence:
        reason = "missing_evidence"
    elif any(check.get("status") == "unassessed" for check in checks):
        reason = "unassessed_minimums"
    else:
        # Presence is not a numeric admissions minimum and cannot produce a
        # percentage by itself.
        reason = "no_published_requirements"
    if context_applicable and measurable and not missing_evidence and not any(check.get("blocksNumericScore") for check in checks) and all(check["status"] in {"met", "unmet"} for check in measurable):
        percent = round(100 * sum(check["status"] == "met" for check in measurable) / len(measurable), 1)
        reason = "" if percent == 100 else "requirements_not_met"
    if selected_route.get("classification") == "financial_support_application":
        percent, reason = None, "funding_selection_separate"

    sources = [source_index[source_id] for source_id in dict.fromkeys(
        source_id
        for check in checks
        for source_id in check.get("sourceIds", [])
    ) if source_id in source_index]
    choice_id = "::".join(str(value) for value in (
        selected_route.get("id"), selected_option.get("id")
    ) if value)
    choice = {
        "choiceKey": choice_id or "unresolved-context",
        "choiceId": choice_id or "unresolved-context",
        "choiceLabel": selected_route.get("title") or selected_route.get("official_target") or "Selected admission route",
        "programId": selected_option.get("id"),
        "routeId": selected_route.get("id"),
        "cycle": context.get("intended_entry_cycle"),
        "chancePercent": percent,
        "chanceAvailable": percent is not None,
        "scoreMeaning": "published_requirements_met_percent",
        "reason": reason,
        "requirementsReason": reason,
        "applicability": resolved.get("context_applicability"),
        "missingEvidence": missing_evidence,
        "sourceFactIds": list(dict.fromkeys(source_fact_ids)),
        "details": {"measurableRequirements": len(measurable), "checks": checks},
    }
    return {
        "overallChance": percent,
        "chancePercent": percent,
        "requirementsFitPercent": percent,
        "chanceAvailable": percent is not None,
        "assessmentRevision": assessment_revision,
        "scoreMeaning": "published_requirements_met_percent",
        "reason": reason,
        "requirementsReason": reason,
        "applicability": resolved.get("context_applicability"),
        "context": context,
        "selectedContext": {
            "institutionId": resolved.get("institution_id"),
            "option": selected_option,
            "route": selected_route,
        },
        "activeChoiceKey": choice["choiceKey"],
        "activeChoice": choice,
        "choices": [choice],
        "missingEvidence": bool(missing_evidence),
        "missingEvidenceItems": missing_evidence,
        "sources": sources,
        "unknowns": resolved.get("unknowns", []),
        "reportedEvidence": {
            "origin": "self_reported",
            "language_evidence": profile.get("language_evidence", []),
            "institutional_evidence": [row for row in profile.get("institutional_evidence", []) if row.get("university_id") == resolved.get("institution_id")],
        },
    }
