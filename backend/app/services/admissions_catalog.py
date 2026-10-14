"""Read the active, reviewed three-institution admissions snapshot."""

import copy
import hashlib
import json
import re
import threading
from pathlib import Path

from app.core.paths import DATA_DIR
from app.services import search as search_service


CATALOG_PATH = DATA_DIR / "admissions" / "catalog.json"
INSTITUTION_IDS = {"mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca"}
LEVELS = {"undergraduate", "masters", "doctoral", "professional"}
LEVEL_ALIASES = {"bachelor": "undergraduate", "master": "masters", "doctorate": "doctoral", "phd": "doctoral"}
_LOCK = threading.Lock()
_CACHE = {"signature": None, "revision": None, "institutions": {}, "indexes": {}}
DOMAINS = {
    "institution": ("institution",), "study_content": ("study",), "curriculum_structure": ("study",),
    "study_structure": ("study",), "study_learning_outcomes": ("study",),
    "degree_completion": ("degree_completion",), "degree_completion_policy": ("degree_completion",),
    "degree_completion_grading": ("degree_completion",), "degree_completion_gpa": ("degree_completion",),
    "degree_external_credit_policy": ("degree_completion",),
    "eligibility": ("requirements",), "subject_preparation": ("requirements",),
    "academic_tests": ("requirements",), "language_tests": ("requirements",),
    "course_specific_academic_requirements_and_selection": ("requirements",),
    "course_specific_qualification_alternatives": ("requirements",),
    "documents": ("application",), "portfolio_interview": ("application",),
    "application_process": ("application",), "application_directory": ("application",),
    "application_windows": ("deadlines",), "application_deadline": ("deadlines",), "deadlines": ("deadlines",),
    "costs": ("costs",), "tuition": ("costs",), "application_fee": ("costs",),
    "funding": ("funding",), "offer_enrollment": ("offer_enrollment",), "career": ("career",),
    "study_option_curriculum_and_course_page_costs": ("study", "costs"),
    "study_structure_and_degree_completion": ("study", "degree_completion"),
    "course_specific_application_dates_documents_and_conditions": ("deadlines", "application", "requirements"),
    "course_specific_admission_dates_fees_funding_awards": ("deadlines", "costs", "funding"),
    "cost_and_funding": ("costs", "funding"), "study_structure_and_funding": ("study", "funding"),
    "housing": ("student_support",), "student_support": ("student_support",),
    "institutional_student_support": ("student_support",), "institution_location": ("institution",),
    "career_guidance": ("career",), "study_option_and_published_minimum": ("study", "requirements"),
}
# Topic labels index evidence for presentation; they never establish a minimum or applicability.
DOMAIN_TOKENS = {
    "requirements": {"academic", "eligibility", "prerequisite", "prerequisites", "qualification", "qualifications",
                     "credential", "credentials", "english", "test", "tests", "gre", "requirements", "minima"},
    "deadlines": {"deadline", "deadlines", "window", "windows", "dates", "timeline", "timing"},
    "costs": {"cost", "costs", "tuition", "fee", "fees", "billing", "payment", "charges"},
    "funding": {"funding", "scholarship", "scholarships", "aid", "stipend", "fellowship", "fellowships"},
    "application": {"application", "admission", "admissions", "documents", "materials", "interview", "selection", "recruitment"},
    "study": {"study", "curriculum", "structure", "duration", "format", "tracks", "learning", "content"},
    "degree_completion": {"completion", "grading", "graduation", "declaration"},
    "offer_enrollment": {"offer", "enrollment", "decision", "decisions", "deferral", "verification"},
}


def _topic_domains(topic):
    if topic in DOMAINS:
        return DOMAINS[topic]
    tokens = set(re.split(r"[_\s-]+", str(topic).casefold()))
    domains = [domain for domain, words in DOMAIN_TOKENS.items() if tokens.intersection(words)]
    # Degree completion and major declaration are not admissions prerequisites.
    if "completion" in tokens or "declaration" in tokens or topic in {"degree_external_credit_policy", "degree_completion_gpa"}:
        domains = [domain for domain in domains if domain != "requirements"]
    if topic in {"language_exemptions", "language_preparation", "language_prerequisite", "language_tests"}:
        domains.append("requirements")
    return tuple(dict.fromkeys(domains)) or ("other",)


class AdmissionsCatalogError(ValueError):
    """The normalized snapshot is unavailable or invalid."""


class InstitutionNotFoundError(AdmissionsCatalogError):
    """The requested institution is outside the reviewed normalized batch."""


def clear_cache():
    global _CACHE
    with _LOCK:
        _CACHE = {"signature": None, "revision": None, "institutions": {}, "indexes": {}}


def _records(rows, label):
    if not isinstance(rows, list):
        raise AdmissionsCatalogError(f"Invalid normalized {label}")
    indexed = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"] or row["id"] in indexed:
            raise AdmissionsCatalogError(f"Invalid or duplicate normalized {label} ID")
        indexed[row["id"]] = row
    return indexed


def _load():
    global _CACHE
    path = Path(CATALOG_PATH)
    with _LOCK:
        try:
            stat = path.stat()
            signature = (str(path.resolve()), stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)
            if _CACHE["signature"] == signature:
                return _CACHE
            raw = path.read_bytes()
            data = json.loads(raw.decode("utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise AdmissionsCatalogError("Normalized admissions catalog is unavailable") from error
        if not isinstance(data, dict) or data.get("schema_version") != "admissions-storage-1.0" or data.get("runtime_active") is not True:
            raise AdmissionsCatalogError("Unsupported normalized admissions catalog contract")
        institutions = {}
        indexes = {}
        try:
            for institution in data["institutions"]:
                institution_id = institution["institution"]["id"]
                if institution_id in institutions or institution_id not in INSTITUTION_IDS:
                    raise AdmissionsCatalogError("Invalid normalized institution membership")
                entities = {key: _records(institution[key], key) for key in ("study_options", "application_routes", "facts", "unknowns", "sources")}
                for option in entities["study_options"].values():
                    if not isinstance(option["levels"], list) or not set(option["levels"]).issubset(LEVELS):
                        raise AdmissionsCatalogError("Invalid normalized study levels")
                    _references(option["route_ids"], entities["application_routes"])
                    _references(option["fact_ids"], entities["facts"])
                    _references(option["source_ids"], entities["sources"])
                    if option["parent_option_id"]:
                        _references([option["parent_option_id"]], entities["study_options"])
                for route in entities["application_routes"].values():
                    _references(route["option_ids"], entities["study_options"])
                    _references(route["fact_ids"], entities["facts"])
                    _references(route["source_ids"], entities["sources"])
                    _references(route["shared_policy_context_ids"], entities["application_routes"])
                for key in ("facts", "unknowns"):
                    for fact in entities[key].values():
                        _references(fact["scope"]["option_ids"], entities["study_options"])
                        _references(fact["scope"]["route_ids"], entities["application_routes"])
                        _references(fact["source_ids"], entities["sources"])
                        if key == "facts":
                            _references(fact["related_fact_ids"], entities["facts"])
                entities["search"] = {option["id"]: search_service.prepare_search_meta({
                    "name": option["title"], "program_names": [option["title"], *option["awards"]],
                    "study_levels": option["levels"], "search_aliases": option.get("attributes", {}).get("search_aliases", []),
                }) for option in entities["study_options"].values()}
                institutions[institution_id] = institution
                indexes[institution_id] = entities
        except (KeyError, TypeError) as error:
            raise AdmissionsCatalogError("Invalid normalized admissions entity structure") from error
        if set(institutions) != INSTITUTION_IDS:
            raise AdmissionsCatalogError("Normalized admissions catalog must contain the accepted three institutions")
        _CACHE = {"signature": signature, "revision": hashlib.sha256(raw).hexdigest(),
                  "institutions": institutions, "indexes": indexes}
        return _CACHE


def _references(values, index):
    if not isinstance(values, list) or any(not isinstance(value, str) or value not in index for value in values):
        raise AdmissionsCatalogError("Broken normalized admissions reference")


def get_revision():
    return _load()["revision"]


def get_institution(institution_id):
    return _load()["institutions"].get(institution_id)


def get_public_contract(institution_id):
    cached = _load()
    institution = cached["institutions"].get(institution_id)
    if institution is None:
        return {"availability": "legacy_unreviewed", "schema_version": "admissions-storage-1.0", "revision": None,
                "study_option_count": None, "study_levels": []}
    return {"availability": "reviewed", "schema_version": "admissions-storage-1.0", "revision": cached["revision"],
            "study_option_count": len(institution["study_options"]),
            "study_levels": sorted({level for option in institution["study_options"] for level in option["levels"]})}


def _institution(institution_id):
    cached = _load()
    if institution_id not in cached["institutions"]:
        raise InstitutionNotFoundError("Reviewed admissions institution not found")
    return cached, cached["institutions"][institution_id], cached["indexes"][institution_id]


def _option_summary(option):
    summary = {key: option[key] for key in ("id", "title", "levels", "awards", "route_ids", "parent_option_id", "source_ids", "fact_ids")}
    metadata = option.get("attributes", {})
    for key in ("application", "application_classification", "application_classifications", "catalog_classification",
                "new_applicant_availability", "inventory_status", "application_relationship", "reconciled_application_relationship",
                "independent_application_status", "ucas_course_codes", "course_url", "catalog_code", "format"):
        if key in metadata:
            summary[key] = metadata[key]
    return copy.deepcopy(summary)


def _route_summary(route):
    return copy.deepcopy({key: route[key] for key in ("id", "title", "classification", "target", "destination", "shared_form_family",
                                                   "option_ids", "source_ids", "fact_ids", "shared_policy_context_ids")})


def _reference_labels(indexed):
    labels = {}
    for collection in ("study_options", "application_routes"):
        for row in indexed[collection].values():
            for alias in [row["id"], *(entry.get("original_id") for entry in row.get("evidence_profiles", []))]:
                if alias and row.get("title"):
                    labels.setdefault(alias, set()).add(row["title"])
    return {alias: next(iter(titles)) for alias, titles in labels.items() if len(titles) == 1}


def list_study_options(institution_id, search_candidates=(), study_level=None, page=1, limit=30):
    cached, institution, indexed = _institution(institution_id)
    queries = [query for candidate in search_candidates
               if (query := search_service.prepare_query(candidate))]
    items = []
    for option in institution["study_options"]:
        if study_level and study_level not in option["levels"]:
            continue
        scores = [search_service.score_prepared(indexed["search"][option["id"]], query) for query in queries]
        score = max((score for score in scores if score is not None), default=None) if queries else 0
        if score is not None:
            items.append((score, option))
    if queries:
        items.sort(key=lambda row: (-row[0], row[1]["title"].casefold(), row[1]["id"]))
    start = (page - 1) * limit
    return {"institution_id": institution_id, "revision": cached["revision"], "total": len(items), "page": page, "limit": limit,
            "items": [_option_summary(option) for _, option in items[start:start + limit]]}


def _normalized_level(value):
    text = str(value or "").strip().casefold()
    return LEVEL_ALIASES.get(text, text) or None


def _axis(values, selected):
    if not values or not selected:
        return "unknown"
    return "matched" if selected in values else "mismatched"


def _history(row):
    return str(row.get("review_status") or "").startswith("superseded") or row.get("publication_status") in {
        "historical", "published_historical_cycle"}


def _cycle(value):
    label = str(value or "").strip().casefold()
    label = re.sub(r"\s+entry$", "", label)
    match = re.fullmatch(r"(20\d{2})", label)
    if match:
        return int(match[1]), None
    match = re.fullmatch(r"(fall|autumn|spring)\s+(20\d{2})|(20\d{2})\s+(fall|autumn|spring)", label)
    if match:
        term = match[1] or match[4]
        return int(match[2] or match[3]), "fall" if term == "autumn" else term
    match = re.fullmatch(r"(20\d{2})-(\d{2}|20\d{2})\s+entry", str(value or "").strip().casefold())
    if match:
        first_year = int(match[1])
        last_year = int(match[2]) if len(match[2]) == 4 else 2000 + int(match[2])
        if last_year == first_year + 1:
            return first_year, None
    return None


def _cycle_axis(published, selected):
    if not published or not selected:
        return "unknown"
    if str(published).strip().casefold() == str(selected).strip().casefold():
        return "matched"
    actual, expected = _cycle(published), _cycle(selected)
    if actual is None or expected is None:
        return "unknown"
    if actual[0] != expected[0]:
        return "mismatched"
    if expected[1] and not actual[1]:
        return "unknown"
    if actual[1] and expected[1] and actual[1] != expected[1]:
        return "mismatched"
    return "matched"


def _published_cycle(row):
    if row["scope"]["cycle"]:
        return row["scope"]["cycle"]
    period = row.get("period")
    if isinstance(period, dict) and period.get("kind") == "named":
        label = period.get("label")
        parsed = _cycle(label)
        if parsed and (parsed[1] or str(label or "").strip().casefold().endswith(" entry")):
            return label
    return None


def _fact_applicability(row, context, context_status, shared_route_ids):
    declared = row["scope"]
    axes = {
        "option": _axis(declared["option_ids"], context["study_option_id"]),
        "route": _axis(declared["route_ids"], context["application_route_id"]),
        "level": _axis(declared["levels"], context["study_level"]),
        "applicant": "unknown", "cycle": "unknown", "fee_status": "unknown", "conditions": "unknown",
    }
    if axes["route"] == "mismatched" and shared_route_ids.intersection(declared["route_ids"]):
        axes["route"] = "unknown"
    for fact_axis, selected_axis in (("option", "option"), ("route", "route"), ("level", "level")):
        if context_status[selected_axis] == "unknown":
            axes[fact_axis] = "unknown"
        elif context_status[selected_axis] == "mismatched":
            axes[fact_axis] = "mismatched"
    applicant_values = declared["applicant_categories"]
    if applicant_values and set(applicant_values).issubset({"first_year", "transfer", "graduate"}):
        axes["applicant"] = _axis(applicant_values, context["applicant_route"])
    elif context["applicant_route"] in applicant_values:
        axes["applicant"] = "matched"
    axes["cycle"] = _cycle_axis(_published_cycle(row), context["intended_entry_cycle"])
    fee_values = declared["fee_status"]
    fee_context = context["fee_status_context"]
    if fee_values and fee_context and fee_context != "unknown":
        if fee_context in fee_values:
            axes["fee_status"] = "matched"
        elif set(fee_values).issubset({"self_reported_home_domestic", "self_reported_international_overseas"}):
            axes["fee_status"] = "mismatched"
    conditions = any(row.get(key) for key in ("conditions", "conditions_and_exceptions", "exceptions"))
    if not conditions and not declared["additional_dimensions"]:
        axes["conditions"] = "matched"
    status = "mismatched" if "mismatched" in axes.values() else "conditional" if "unknown" in axes.values() else "matched"
    return {**axes, "status": status}


def resolve_context(institution_id, profile=None, context=None):
    cached, institution, indexed = _institution(institution_id)
    profile = profile or {}
    context = context or {}
    selection = profile.get("selectedAdmissionChoices", {}).get(institution_id, {})
    effective = {
        "study_option_id": selection.get("studyOptionId"), "application_route_id": selection.get("applicationRouteId"),
        "study_level": _normalized_level(profile.get("study_level") or profile.get("studyLevel")), "applicant_route": profile.get("applicant_route"),
        "intended_entry_cycle": profile.get("intended_entry_cycle"), "fee_status_context": profile.get("fee_status_context", "unknown"),
    }
    for selected_key, context_key in (
        ("studyLevel", "study_level"), ("applicantRoute", "applicant_route"),
        ("intendedEntryCycle", "intended_entry_cycle"), ("feeStatusContext", "fee_status_context"),
    ):
        if selected_key in selection:
            effective[context_key] = selection[selected_key]
    for key in effective:
        if key in context:
            effective[key] = context[key]
    effective["study_level"] = _normalized_level(effective["study_level"])
    option = indexed["study_options"].get(effective["study_option_id"])
    if effective["study_level"] == "mba" and option and len(option["levels"]) == 1:
        effective["study_level"] = option["levels"][0]
    route = indexed["application_routes"].get(effective["application_route_id"])
    statuses = {"option": "matched" if option else "unknown", "route": "matched" if route else "unknown", "level": "unknown"}
    if effective["study_level"]:
        statuses["level"] = ("matched" if effective["study_level"] in LEVELS else "unknown")
        if option and effective["study_level"] not in option["levels"]:
            statuses["level"] = "mismatched"
    if option and route and (route["id"] not in option["route_ids"] or option["id"] not in route["option_ids"]):
        statuses["route"] = "mismatched"
    invalid_selection = ((effective["study_option_id"] and option is None)
                         or (effective["application_route_id"] and route is None)
                         or statuses["route"] == "mismatched"
                         or (option is None and route is None))
    shared_route_ids = set(route["shared_policy_context_ids"]) if route else set()
    facts = []
    unknowns = []
    history = {"fact_ids": [], "unknown_ids": [], "facts": [], "unknowns": []}
    excluded = {"facts": [], "unknowns": []}
    source_ids = set(option["source_ids"] if option else []) | set(route["source_ids"] if route else [])
    groups = {}
    for key, result in (("facts", facts), ("unknowns", unknowns)):
        for row in institution[key]:
            applicability = _fact_applicability(row, effective, statuses, shared_route_ids)
            if _history(row):
                history["fact_ids" if key == "facts" else "unknown_ids"].append(row["id"])
                historical_context = {**effective, "intended_entry_cycle": None}
                historical_applicability = _fact_applicability(row, historical_context, statuses, shared_route_ids)
                if not invalid_selection and historical_applicability["status"] != "mismatched":
                    history[key].append({**copy.deepcopy(row), "applicability": historical_applicability})
                    source_ids.update(row["source_ids"])
                continue
            if invalid_selection or applicability["status"] == "mismatched":
                excluded[key].append({"id": row["id"], "applicability": applicability})
                continue
            result.append({**copy.deepcopy(row), "applicability": applicability})
            source_ids.update(row["source_ids"])
            if key == "facts":
                topics = list(dict.fromkeys([row["topic"], *row.get("topics", [])]))
                domains = list(dict.fromkeys(domain for topic in topics for domain in _topic_domains(topic)))
                for domain in domains:
                    groups.setdefault(domain, []).append(row["id"])
    available_routes = [_route_summary(indexed["application_routes"][route_id]) for route_id in option["route_ids"]] if option else []
    return {"institution_id": institution_id, "revision": cached["revision"], "context": effective,
            "context_applicability": statuses, "selected_option": _option_summary(option) if option else None,
            "selected_route": _route_summary(route) if route else None, "available_routes": available_routes,
            "facts": facts, "unknowns": unknowns, "fact_groups": groups,
            "sources": [copy.deepcopy(source) for source in institution["sources"] if source["id"] in source_ids],
            "reference_labels": _reference_labels(indexed),
            "history": history, "excluded": excluded}
