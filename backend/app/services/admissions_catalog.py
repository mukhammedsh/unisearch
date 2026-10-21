"""Read the active, reviewed three-institution admissions snapshot."""

import copy
import hashlib
import json
import math
import re
import threading
from pathlib import Path

from app.core.paths import DATA_DIR
from app.services import search as search_service
from app.services.university_tracks import _canonical_major, _major_tags_from_text, _normalize_major_text


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
                    _references(_route_metadata(route).get("policy_for_route_ids", []), entities["application_routes"])
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


def matching_study_options(institution_id, major=None, study_level=None):
    """Use the catalog subject taxonomy without choosing an application target."""
    institution = get_institution(institution_id)
    if institution is None:
        return []
    level = _normalized_level(study_level)
    subject = _canonical_major(major) if major else None
    return [option for option in institution["study_options"]
            if (not level or level == "any" or level in option["levels"])
            and (not major or (subject in _major_tags_from_text(option["title"]) if subject
                 else _normalize_major_text(major) == _normalize_major_text(option["title"])))]


def catalog_costs(institution_id, study_level=None, study_mode="any", *, major=None,
                  fee_status_context=None, intended_entry_cycle=None, study_option_id=None,
                  application_route_id=None, profile=None):
    """Return published reference prices without claiming personal affordability."""
    institution = get_institution(institution_id)
    summary = {"annual_total": None, "tuition": None, "reference": True}
    if institution is None or study_mode == "online":
        return summary
    profile = profile or {}
    selection = profile.get("selectedAdmissionChoices", {}).get(institution_id, {})
    study_level = study_level or profile.get("study_level") or profile.get("studyLevel")
    major = major if major is not None else profile.get("major")
    fee_status_context = fee_status_context or selection.get("feeStatusContext") or profile.get("fee_status_context", "unknown")
    intended_entry_cycle = intended_entry_cycle or selection.get("intendedEntryCycle") or profile.get("intended_entry_cycle")
    level = _normalized_level(study_level)
    if level == "any":
        level = None
    options = {option["id"]: option for option in institution["study_options"]}
    selected = options.get(study_option_id or selection.get("studyOptionId"))
    if selected and (not level or level in selected["levels"]):
        study_option_id = selected["id"]
        application_route_id = application_route_id or selection.get("applicationRouteId")
        if not level and len(selected["levels"]) == 1:
            level = selected["levels"][0]
    candidate_ids = {option["id"] for option in matching_study_options(institution_id, major, level)}
    if selection.get("studyOptionId") and selection["studyOptionId"] not in options:
        candidate_ids.clear()
    if study_option_id:
        candidate_ids.intersection_update([study_option_id])
    if not selection.get("studyOptionId"):
        application_route_id = application_route_id or selection.get("applicationRouteId")
    if application_route_id:
        route = next((route for route in institution["application_routes"] if route["id"] == application_route_id), None)
        candidate_ids.intersection_update(route["option_ids"] if route else [])
    summary["scope"] = {"study_level": level, "major": major or "", "option_ids": sorted(candidate_ids),
                        "fee_status_context": fee_status_context, "intended_entry_cycle": intended_entry_cycle}
    quotes = []

    def add(row, basis, amount, currency, period, fee_status="", exclusions=()):
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
            return
        if not isinstance(currency, str) or not re.fullmatch(r"[A-Z]{3}", currency) or not period:
            return
        scoped_options = set(row["scope"]["option_ids"])
        if not candidate_ids or (scoped_options and not candidate_ids.intersection(scoped_options)):
            return
        if application_route_id and row["scope"]["route_ids"] and application_route_id not in row["scope"]["route_ids"]:
            return
        levels = row["scope"]["levels"] or sorted({value for option_id in scoped_options for value in options[option_id]["levels"]})
        if level and level not in levels:
            return
        if not set(levels).intersection(value for option_id in candidate_ids for value in options[option_id]["levels"]):
            return
        expected_fee = {"self_reported_home_domestic": "Home fee", "self_reported_international_overseas": "Overseas fee"}.get(fee_status_context)
        if fee_status and fee_status_context not in (None, "unknown") and fee_status != expected_fee:
            return
        quotes.append({"basis": basis, "amount": amount, "currency": currency, "period": period,
                       "levels": levels, "fee_status": fee_status, "exclusions": list(exclusions),
                       "option_ids": sorted(option_id for option_id in candidate_ids
                                            if (not scoped_options or option_id in scoped_options) and set(levels).intersection(options[option_id]["levels"])),
                       "fact_id": row["id"], "source_ids": row["source_ids"]})

    for row in institution["facts"]:
        if row["publication_status"] != "published" or not re.search(r"verified|reviewed|rechecked|carried_forward_review", row.get("review_status") or "") or re.search(r"superseded|conflict|partial|pending", row.get("review_status") or ""):
            continue
        value = row.get("attributes", {}).get("catalog_costs") or row.get("value")
        if not isinstance(value, dict):
            continue
        period = value.get("academic_year") or (row.get("period") or {}).get("label")
        if value.get("period") == "Academic year":
            add(row, "tuition", value.get("tuition"), value.get("currency"), period)
            add(row, "annual_total", value.get("total_before_aid"), value.get("currency"), period,
                exclusions=value.get("exclusions", ["insurance", "travel"] if value.get("health_insurance") else []))
        panels = value.get("course_page_tuition_fees")
        if not isinstance(panels, dict):
            continue
        for status in ("Home fee", "Overseas fee"):
            for panel in panels.get(status, []):
                if panel.get("panel_status") != "published":
                    continue
                for text in panel.get("amounts_and_periods", []):
                    annual = re.fullmatch(r"£([\d,]+(?:\.\d+)?) per year", text)
                    one_year = re.fullmatch(r"£([\d,]+(?:\.\d+)?)", text) if value.get("duration") == "1 year" and value.get("mode") == "Full-time" else None
                    if annual or one_year:
                        add(row, "tuition", float((annual or one_year)[1].replace(",", "")), panel.get("currency"), panel.get("panel_cycle_label"), status)

    for basis in ("annual_total", "tuition"):
        candidates = [quote for quote in quotes if quote["basis"] == basis]
        if not candidates:
            continue
        # Keep one source period and currency; do not join prices across entry years.
        def period_matches(quote):
            actual = re.fullmatch(r"(20\d{2})-(?:\d{2}|20\d{2})", quote["period"])
            published = actual[1] if actual else quote["period"]
            target = _cycle(intended_entry_cycle)
            return _cycle_axis(published, str(target[0]) if target and target[1] != "spring" else intended_entry_cycle) == "matched"

        latest = max(candidates, key=lambda quote: (period_matches(quote), (re.findall(r"20\d{2}", quote["period"]) or [""])[0]))
        candidates = [quote for quote in candidates if (quote["period"], quote["currency"]) == (latest["period"], latest["currency"])]
        source_ids = {source_id for quote in candidates for source_id in quote["source_ids"]}
        summary[basis] = {"min": min(quote["amount"] for quote in candidates), "max": max(quote["amount"] for quote in candidates),
                          "amounts": sorted({quote["amount"] for quote in candidates}),
                          "currency": latest["currency"], "period": latest["period"], "study_level": level or "",
                          "fee_statuses": sorted({quote["fee_status"] for quote in candidates if quote["fee_status"]}),
                          "fee_status_match": ("not_required" if not any(quote["fee_status"] for quote in candidates)
                                               else "unknown" if fee_status_context in (None, "unknown") else "matched"),
                          "cycle_status": "matched" if period_matches(latest) else "dated_reference" if intended_entry_cycle else "unspecified",
                          "levels": sorted({value for quote in candidates for value in quote["levels"]}),
                          "option_ids": sorted({value for quote in candidates for value in quote["option_ids"]}),
                          "candidate_option_count": len(candidate_ids),
                          "priced_option_count": len({value for quote in candidates for value in quote["option_ids"]}),
                          "exclusions": sorted({item for quote in candidates for item in quote["exclusions"]}),
                          "fact_ids": sorted({quote["fact_id"] for quote in candidates}),
                          "source_urls": [source["url"] for source in institution["sources"] if source["id"] in source_ids]}
    return summary


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


def _route_metadata(route):
    return {**route.get("attributes", {}), **route.get("index_attributes", {})}


def _route_summary(route):
    summary = {key: route[key] for key in ("id", "title", "classification", "target", "destination", "shared_form_family",
                                         "option_ids", "source_ids", "fact_ids", "shared_policy_context_ids")}
    metadata = _route_metadata(route)
    for key in ("application_url", "admission_scope", "applicant_route", "policy_for_route_ids"):
        if key in metadata:
            summary[key] = metadata[key]
    return copy.deepcopy(summary)


def _reference_labels(indexed):
    labels = {}
    for collection in ("study_options", "application_routes"):
        for row in indexed[collection].values():
            for alias in [row["id"], *(entry.get("original_id") for entry in row.get("evidence_profiles", []))]:
                if alias and row.get("title"):
                    labels.setdefault(alias, set()).add(row["title"])
    return {alias: next(iter(titles)) for alias, titles in labels.items() if len(titles) == 1}


def list_study_options(institution_id, search_candidates=(), study_level=None, page=1, limit=30, *, major=None):
    cached, institution, indexed = _institution(institution_id)
    queries = [query for candidate in search_candidates
               if (query := search_service.prepare_query(candidate))]
    items = []
    for option in matching_study_options(institution_id, major=major, study_level=study_level):
        scores = [search_service.score_prepared(indexed["search"][option["id"]], query, require_all_terms=True) for query in queries]
        score = max((score for score in scores if score is not None), default=None) if queries else 0
        if score is not None:
            items.append((score, option))
    if queries:
        items.sort(key=lambda row: (-row[0], row[1]["title"].casefold(), row[1]["id"]))
    start = (page - 1) * limit
    return {"institution_id": institution_id, "revision": cached["revision"], "total": len(items), "page": page, "limit": limit,
            "shared_routes": [{**_route_summary(route), "levels": ["undergraduate"]}
                              for route in institution["application_routes"]
                              if _route_metadata(route).get("admission_scope") == "institution_wide_undergraduate"
                              and study_level in (None, "undergraduate")],
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
    localized = re.fullmatch(r"(осенний|весенний) набор (20\d{2})(?: года)?", label)
    if localized:
        return int(localized[2]), "fall" if localized[1] == "осенний" else "spring"
    localized = re.fullmatch(r"(20\d{2}) жылғы (күзгі|көктемгі) қабылдау", label)
    if localized:
        return int(localized[1]), "fall" if localized[2] == "күзгі" else "spring"
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
    if context_status["option"] == "not_required" and not declared["option_ids"]:
        axes["option"] = "matched"
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
    shared_reading = (option is None and not effective["study_option_id"] and route is not None
                      and _route_metadata(route).get("admission_scope") == "institution_wide_undergraduate")
    if shared_reading:
        effective["study_level"] = effective["study_level"] or "undergraduate"
        effective["applicant_route"] = effective["applicant_route"] or _route_metadata(route).get("applicant_route")
    statuses = {"option": "matched" if option else "unknown", "route": "matched" if route else "unknown", "level": "unknown"}
    if shared_reading:
        statuses["option"] = "not_required"
    if effective["study_level"]:
        statuses["level"] = ("matched" if effective["study_level"] in LEVELS else "unknown")
        if option and effective["study_level"] not in option["levels"]:
            statuses["level"] = "mismatched"
    if option and route and (route["id"] not in option["route_ids"] or option["id"] not in route["option_ids"]):
        statuses["route"] = "mismatched"
    invalid_selection = ((effective["study_option_id"] and option is None)
                         or (effective["application_route_id"] and route is None)
                         or statuses["route"] == "mismatched"
                         or (option is None and not shared_reading)
                         or (shared_reading and effective["study_level"] != "undergraduate")
                         or (option is None and route is None))
    shared_route_ids = set()
    pending = list(route["shared_policy_context_ids"]) if route else []
    while pending:
        policy_id = pending.pop()
        if policy_id not in shared_route_ids:
            shared_route_ids.add(policy_id)
            pending.extend(indexed["application_routes"][policy_id]["shared_policy_context_ids"])
    facts = []
    unknowns = []
    history = {"fact_ids": [], "unknown_ids": [], "facts": [], "unknowns": []}
    excluded = {"facts": [], "unknowns": []}
    source_ids = set(option["source_ids"] if option else []) | set(route["source_ids"] if route else [])
    groups = {}
    for key, result in (("facts", facts), ("unknowns", unknowns)):
        for row in institution[key]:
            applicability = _fact_applicability(row, effective, statuses, shared_route_ids)
            outside_shared_scope = shared_reading and bool(row["scope"]["option_ids"])
            if outside_shared_scope:
                excluded[key].append({"id": row["id"], "applicability": applicability})
                continue
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
    available_routes = [_route_summary(indexed["application_routes"][route_id]) for route_id in option["route_ids"]
                        if route_id == effective["application_route_id"] or not set(_route_metadata(indexed["application_routes"][route_id]).get("policy_for_route_ids", [])).intersection(option["route_ids"])] if option else []
    selected_option = _option_summary(option) if option else None
    if selected_option is not None:
        selected_option["overviews"] = []
        for evidence_profile in option.get("evidence_profiles", []):
            description = evidence_profile.get("attributes", {}).get("description")
            text = description.get("text") if isinstance(description, dict) else description
            if isinstance(text, str) and text.strip():
                selected_option["overviews"].append({"text": text, "source_ids": copy.deepcopy(evidence_profile.get("source_ids", []))})
    return {"institution_id": institution_id, "revision": cached["revision"], "context": effective,
            "reading_scope": "institution_route" if shared_reading else "study_option",
            "context_applicability": statuses, "selected_option": selected_option,
            "selected_route": _route_summary(route) if route else None, "available_routes": available_routes,
            "facts": facts, "unknowns": unknowns, "fact_groups": groups,
            "sources": [copy.deepcopy(source) for source in institution["sources"] if source["id"] in source_ids],
            "reference_labels": _reference_labels(indexed),
            "history": history, "excluded": excluded}
