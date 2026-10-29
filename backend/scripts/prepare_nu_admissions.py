"""Convert the independently accepted NU research catalog to shared storage."""

import copy
import hashlib
import json
from pathlib import Path


NU_ID = "nazarbayev-university-kaz-astana"
LEVELS = {"preparation", "undergraduate", "masters", "doctoral", "professional", "residency", "non_degree"}


def _list(value):
    return value if isinstance(value, list) else [] if value is None else [value]


def _scope(row):
    raw = row.get("scope") or {}
    return {"option_ids": _list(raw.get("option_ids")), "route_ids": _list(raw.get("route_ids")),
            "levels": _list(raw.get("study_levels", raw.get("levels"))),
            "applicant_categories": _list(raw.get("applicant_categories")), "cycle": raw.get("cycle"),
            "fee_status": _list(raw.get("fee_status")), "additional_dimensions": raw.get("additional_dimensions") or {}}


def _provenance(row):
    original = copy.deepcopy(row.get("provenance") or {})
    scope = original.get("original_scope")
    if scope is not None and not isinstance(scope, dict):
        scope = {"source_scope_text": scope}
    return {**original, "evidence_file": original.get("evidence_file") or "research-catalog.json",
            "original_id": original.get("original_id") or row["id"], "original_scope": scope,
            "original_source_ids": original.get("original_source_ids")}


def convert_research_catalog(catalog):
    """Preserve reviewed values; this pure conversion does not grant acceptance."""
    if catalog.get("university_id") != NU_ID or catalog.get("runtime_active") is not False or catalog.get("research_status") != "ready_for_review":
        raise ValueError("NU research catalog is not inactive and review-ready")
    for row in catalog["unknowns"]:
        if not row.get("source_ids") or not row.get("checked_at") or not row.get("review_status"):
            raise ValueError(f"NU publication gap lacks reviewed source provenance: {row['id']}")
    sources = [{"id": row["id"], "url": row["url"], "title": row["title"], "checked_at": row.get("checked_at"),
                "attributes": {key: copy.deepcopy(value) for key, value in row.items() if key not in {"id", "url", "title", "checked_at"}}}
               for row in catalog["sources"]]
    facts = [{"id": row["id"], "topic": row["topic"], "topics": [], "scope": _scope(row),
              "value": copy.deepcopy(row.get("value")), "conditions": copy.deepcopy(row.get("conditions")),
              "conditions_and_exceptions": copy.deepcopy(row.get("conditions_and_exceptions")), "exceptions": copy.deepcopy(row.get("exceptions")),
              "source_ids": list(row["source_ids"]), "publication_status": row.get("publication_status"), "review_status": row.get("review_status"),
              "checked_at": row.get("checked_at"), "content_reviewed_at": row.get("content_reviewed_at"), "period": copy.deepcopy(row.get("period")),
              "related_fact_ids": _list(row.get("related_fact_ids")), "provenance": _provenance(row),
              "attributes": copy.deepcopy(row.get("attributes") or {}), "index_attributes": {"owner_packet": row["owner_packet"]}}
             for row in catalog["facts"]]
    unknowns = [{"id": row["id"], "reason": row["reason"], "official_next_step": row["official_next_step"],
                 "scope": _scope(row), "source_ids": list(row["source_ids"]), "publication_status": row.get("publication_status"),
                 "review_status": row.get("review_status"), "checked_at": row.get("checked_at"), "content_reviewed_at": row.get("content_reviewed_at"),
                 "provenance": _provenance(row), "attributes": copy.deepcopy(row.get("attributes") or {}), "index_attributes": {"owner_packet": row["owner_packet"]}}
                for row in catalog["unknowns"]]
    routes = [{"id": row["id"], "title": row.get("title"), "classification": row.get("classification"), "target": row.get("target"),
               "destination": row.get("destination"), "shared_form_family": row.get("shared_form_family"),
               "option_ids": _list(row.get("option_ids")), "fact_ids": _list(row.get("fact_ids")), "source_ids": list(row["source_ids"]),
               "shared_policy_context_ids": _list(row.get("shared_policy_context_ids")), "provenance": _provenance(row),
               "attributes": copy.deepcopy(row.get("attributes") or {}), "index_attributes": {"owner_packet": row["owner_packet"]}}
              for row in catalog["application_routes"]]
    option_rows = copy.deepcopy(catalog["study_options"])
    for row in catalog.get("additional_offerings", []):
        option_rows.append({**row, "levels": ["preparation"] if row["classification"] == "graduate_preparatory" else ["non_degree"],
                            "inventory_card_ids": [], "attributes": {**row.get("attributes", {}), "application_classification": row["classification"],
                                                                    "linked_degree_option_id": row.get("linked_degree_option_id")}})
    options = []
    for row in option_rows:
        levels = _list(row.get("levels"))
        if not levels or not set(levels).issubset(LEVELS):
            raise ValueError(f"Unsupported NU option levels: {row['id']}")
        metadata = copy.deepcopy(row.get("attributes") or {})
        profile = metadata.get("study_profile") or {}
        detail = profile.get("program_page_confirmed") or {}
        format_value = metadata.get("delivery_mode") or metadata.get("mode") or detail.get("mode") or profile.get("catalog_delivery_mode")
        if format_value:
            metadata["format"] = {"mode": {"full_time_on_campus": "Full time, on-campus"}.get(format_value, format_value)} if isinstance(format_value, str) else {"mode": format_value}
            for field, value in (("duration", metadata.get("duration") or profile.get("catalog_duration") or
                                  (f"{metadata['duration_years']} years" if metadata.get("duration_years") is not None else None)),
                                 ("language", metadata.get("language") or profile.get("catalog_language")),
                                 ("campus", metadata.get("campus") or metadata.get("location") or detail.get("campus"))):
                if value is not None:
                    metadata["format"][field] = value
        description = metadata.get("study_content") or metadata.get("study_detail") or metadata.get("study_description") or detail.get("study_scope") or profile.get("catalog_description")
        linked_facts = set(_list(row.get("fact_ids"))) | {fact["id"] for fact in facts if row["id"] in fact["scope"]["option_ids"]}
        profiles = [{"evidence_file": "research-catalog.json", "original_id": row["id"], "source_ids": list(row["source_ids"]),
                     "attributes": {"description": {"text": description}}}] if isinstance(description, str) and description.strip() else []
        metadata.update({"catalog_classification": row.get("classification"), "inventory_card_ids": _list(row.get("inventory_card_ids")),
                         "native_award": metadata.get("native_award") or row["title"]})
        awards = [] if set(levels).issubset({"preparation", "non_degree"}) else metadata.get("native_awards", [metadata["native_award"]])
        options.append({"id": row["id"], "title": row["title"], "levels": levels, "awards": awards,
                        "route_ids": _list(row.get("route_ids")), "parent_option_id": None,
                        "source_ids": list(row["source_ids"]), "fact_ids": sorted(linked_facts), "evidence_profiles": profiles,
                        "attributes": metadata})
    option_index = {row["id"]: row for row in options}
    for row in routes:
        row["option_ids"] = list(dict.fromkeys([*row["option_ids"], *[option["id"] for option in options if row["id"] in option["route_ids"]]]))
        row["fact_ids"] = list(dict.fromkeys([*row["fact_ids"], *[fact["id"] for fact in facts if row["id"] in fact["scope"]["route_ids"]]]))
        levels = {level for option_id in row["option_ids"] for level in option_index[option_id]["levels"]}
        row["attributes"].setdefault("applicant_route", "graduate" if levels and levels.issubset({"masters", "doctoral", "professional", "residency"}) else "transfer" if "transfer" in row["id"] else "first_year")
    _resolve_scopes(options, routes, facts, unknowns)
    _residency_contexts(options, routes, facts, unknowns)
    route_index = {row["id"]: row for row in routes}
    route_index["nu-a-route-financial-support"]["classification"] = "financial_support_application"
    route_index["nu-a-route-nufyp-progression"]["attributes"]["applicant_route"] = "first_year"
    for row in routes:
        if row["destination"] is None and row["id"] != "nu-a-route-masters-common-packet-b":
            row["destination"] = "https://admissions.nu.edu.kz/"
        if isinstance(row["destination"], str) and row["destination"].startswith("https://"):
            row["attributes"]["application_url"] = row["destination"]
    _program_facets(facts, options)
    _cost_projections(facts, options)
    _deadline_projections(facts)
    result = {"institution": {"id": NU_ID, "official_name": catalog["official_name"], "attributes": {}},
              "snapshot": copy.deepcopy(catalog["snapshot"]), "inputs": [], "sources": sources, "study_options": options,
              "application_routes": routes, "facts": facts, "unknowns": unknowns, "collection_tasks": [],
              "organization": {"coverage": copy.deepcopy(catalog["coverage"]), "cross_packet_refs": copy.deepcopy(catalog["cross_packet_refs"]),
                               "additional_offering_ids": [row["id"] for row in catalog.get("additional_offerings", [])]},
              "supporting_records": [], "dossier_metadata": copy.deepcopy(catalog["packet_metadata"]), "historical_provenance": []}
    return result


def _resolve_scopes(options, routes, facts, unknowns):
    option_index = {row["id"]: row for row in options}
    route_index = {row["id"]: row for row in routes}
    route_index["nu-a-route-midyear-2026-27"]["attributes"]["admission_scope"] = "institution_wide_undergraduate"
    extra_options = {"nu-a-fact-nds-study": "nu-a-study-non-degree-study", "nu-a-fact-nds-entry": "nu-a-study-non-degree-study",
                     "nu-a-fact-nuzyp-current-status": "nu-a-study-nuzyp", "nu-a-fact-nuzyp-funding-history": "nu-a-study-nuzyp",
                     "nu-a-fact-microcredential-study": "nu-a-study-mining-microcredential",
                     "nu-a-fact-microcredential-entry-cost-cycle": "nu-a-study-mining-microcredential"}
    _unknown_scopes(options, route_index, unknowns)
    for row in [*facts, *unknowns]:
        scope = row["scope"]
        if row["id"] in extra_options:
            scope["option_ids"] = [extra_options[row["id"]]]
        if row["id"] in {"nu-a-fact-nuet-support", "nu-a-fact-financial-support-eligibility-2027-28"}:
            row["attributes"]["reading_route_ids"] = scope["route_ids"]
            scope["route_ids"] = ["nu-a-route-financial-support"]
        if scope["levels"] and not set(scope["levels"]).issubset(LEVELS):
            scope["additional_dimensions"]["source_level_labels"] = scope["levels"]
            scope["levels"] = []
        option_ids = scope["option_ids"] or [ident for route in scope["route_ids"] for ident in route_index[route]["option_ids"]]
        if not scope["levels"] and option_ids:
            scope["levels"] = sorted({level for ident in option_ids for level in option_index[ident]["levels"]})
        if scope["cycle"] == "2027/28" and row["index_attributes"]["owner_packet"] == "a":
            row["attributes"]["entry_cycle_aliases"] = ["2027/28", "2027-2028"]
            scope["cycle"] = "Fall 2027"
        if scope["route_ids"] == ["nu-a-route-midyear-2026-27"]:
            row["attributes"]["entry_cycle_aliases"] = ["2026/27_midyear"]
            scope["cycle"] = "Spring 2027"
            row["attributes"]["retain_as_dated_history"] = True
        if row["attributes"].get("entry_cycle_aliases"):
            row["attributes"]["entry_cycle_context_aliases"] = {"2027/28": "Fall 2027", "2027/2028": "Fall 2027",
                                                               "2027-2028": "Fall 2027", "2026/27_midyear": "Spring 2027"}
        if row["id"] == "nu-a-gap-policy-future-revision":
            row["attributes"]["original_official_next_step"] = row["official_next_step"]
            row["official_next_step"] = "Recheck the scheduled policy revision after 2026-12-01; the current effective policy remains the dated reference until replaced."
    for ident in ("nu-c-residency-unconditional", "nu-c-residency-conditional"):
        next(row for row in facts if row["id"] == ident)["topics"].append("admission_requirements")
    next(row for row in facts if row["id"] == "nu-c-phd-requirements")["attributes"]["presentation_reference"] = True
    for row in facts:
        if row["id"] in {"nu-a-fact-transfer-route-details", "nu-a-fact-joint-bba-admissions"}:
            row["topics"].append("admission_requirements")


def _unknown_scopes(options, routes, unknowns):
    """Resolve reviewed gap scopes by stable source/option IDs, never by runtime prose matching."""
    a_masters = [row["id"] for row in options if row["id"].startswith("nu-a-") and row["levels"] == ["masters"]]
    a_assigned = [row["id"] for row in options if row["id"].startswith("nu-a-") and row["attributes"]["inventory_card_ids"]]
    b_options = [row["id"] for row in options if row["id"].startswith("nu-b-")]
    central_exclusions = {"nu-b-study-" + suffix for suffix in ("master-of-business-administration", "master-of-science-in-finance",
        "executive-master-of-business-administration", "doctor-of-business-administration", "phd-in-business-administration",
        "master-of-arts-in-global-affairs-and-eurasian-studies-joint-degree-with-soas", "doctor-of-medicine", "master-of-science-in-nursing")}
    central = [row["id"] for row in options if row["id"] not in central_exclusions
               and set(row["levels"]).intersection({"masters", "doctoral", "professional"})]
    definitions = {
        "nu-a-gap-policy-future-revision": ([], ["nu-a-route-regular-foundation-undergraduate", "nu-a-route-financial-support", "nu-a-route-transfer", "nu-a-route-nufyp-progression"], ["preparation", "undergraduate"]),
        "nu-a-gap-midyear-conflict": ([], ["nu-a-route-midyear-2026-27"], ["undergraduate"]),
        "nu-a-gap-nuzyp-activity": (["nu-a-study-nuzyp"], [], ["preparation"]),
        "nu-a-gap-nufyp-progression": ([], ["nu-a-route-nufyp-progression"], ["undergraduate"]),
        "nu-a-gap-engineering-masters": (a_masters, [], ["masters"]),
        "nu-a-gap-joint-bba": (routes["nu-a-route-joint-bba"]["option_ids"], ["nu-a-route-joint-bba"], ["undergraduate"]),
        "nu-a-gap-nursing": (["nu-a-study-bachelor-in-nursing"], [], ["undergraduate"]),
        "nu-a-gap-ump": (["nu-a-study-6-year-undergraduate-medical-program"], [], ["undergraduate"]),
        "nu-a-gap-fee-refresh": (a_assigned, [], ["preparation", "undergraduate", "masters"]),
        "nu-a-gap-catalog-award-language": (["nu-a-study-bachelor-in-nursing"], [], ["undergraduate"]),
        "nu-a-gap-credential-cycle-conflict": ([ident for ident in routes["nu-a-route-regular-foundation-undergraduate"]["option_ids"] if ident != "nu-a-study-nu-foundation-year-program"],
                                               ["nu-a-route-regular-foundation-undergraduate", "nu-a-route-financial-support"], ["undergraduate"]),
        "nu-a-gap-nds-fee-and-transition": (["nu-a-study-non-degree-study"], [], ["non_degree"]),
        "nu-a-gap-support-coverage-documents": ([], ["nu-a-route-financial-support"], ["preparation", "undergraduate"]),
        "nu-a-gap-microcredential-next-intake": (["nu-a-study-mining-microcredential"], [], ["non_degree"]),
        "nu-b-gap-future-central-dates": (central, [], ["masters", "doctoral", "professional"]),
        "nu-b-gap-undated-fees": ([ident for ident in b_options if "executive-master" not in ident], [], ["masters", "doctoral", "professional"]),
        "nu-b-gap-gsb-source-conflicts": (["nu-b-study-master-of-business-administration", "nu-b-study-executive-master-of-business-administration"], [], ["masters"]),
        "nu-b-gap-emba-price": (["nu-b-study-executive-master-of-business-administration"], [], ["masters"]),
        "nu-b-gap-som-phd-regular-gpa": (["nu-b-study-ph-d-in-global-health", "nu-b-study-ph-d-in-biomedical-sciences"], [], ["doctoral"]),
        "nu-b-gap-joint-future-and-funding": (["nu-b-study-master-of-arts-in-global-affairs-and-eurasian-studies-joint-degree-with-soas"], [], ["masters"]),
        "nu-b-gap-public-account-checklists": ([ident for ident in b_options if "joint-degree-with-soas" not in ident], [], ["masters", "doctoral", "professional"]),
        "nu-b-gap-gspp-mpa-fee": (["nu-b-study-master-in-public-administration"], [], ["masters"]),
        "nu-b-gap-curriculum-anomalies": (["nu-b-study-master-of-science-in-computer-science", "nu-b-study-master-of-science-in-life-sciences"], [], ["masters"]),
        "nu-b-gap-funding-allocations": (b_options, [], ["masters", "doctoral", "professional"]),
    }
    for row in unknowns:
        if row["id"] in definitions:
            option_ids, route_ids, levels = definitions[row["id"]]
            row["scope"].update(option_ids=option_ids, route_ids=route_ids, levels=levels)


def _program_facets(facts, options):
    """Index the reviewed C program record by section without repeating its entire body."""
    fields = {
        "requirements": {"admissions", "ielts_rule", "english_requirement", "prior_qualification", "medical_exam", "admission_variants"},
        "deadlines": {"application_dates"}, "costs": {"tuition"}, "funding": {"funding"},
    }
    for original in list(facts):
        if original["topic"] != "program_details":
            continue
        value = original["value"]
        used = set().union(*fields.values())
        sections = {**fields, "study": set(value) - used}
        for topic, keys in sections.items():
            subset = {key: copy.deepcopy(item) for key, item in value.items() if key in keys}
            if not subset:
                continue
            facet = copy.deepcopy(original)
            facet.update(id=f"{original['id']}--{topic}", topic={"requirements": "admission_requirements", "study": "study_content"}.get(topic, topic), value=subset)
            facet["related_fact_ids"] = [original["id"]]
            facet["attributes"]["projection_of"] = original["id"]
            facts.append(facet)
            for option in options:
                if original["id"] in option["fact_ids"]:
                    option["fact_ids"].append(facet["id"])


def _cost_projections(facts, options):
    """Project exact reviewed fee fields; source prose and unresolved categories remain intact."""
    index = {row["id"]: row for row in facts}

    def quote(ident, amount, currency="USD", *, period="academic_year", year=None, option_ids=None, fee_status="", modes=(), campus=None, study_years=(), reference_only=False):
        row = index[ident]
        entry = {"basis": "tuition", "amount": amount, "currency": currency, "billing_period": period,
                 "period_label": year or {"academic_year": "Academic year", "whole_program": "Whole program", "per_credit": "Per credit"}[period],
                 "source_year": year, "fee_status": fee_status, "exclusions": ["living", "travel", "application_and_guarantee_fees"],
                 "study_modes": list(modes), "campus": campus, "study_years": list(study_years), "reference_only": reference_only}
        if option_ids is not None:
            entry["option_ids"] = option_ids
        row["attributes"].setdefault("catalog_costs", {"quotes": []})["quotes"].append(entry)

    common_ug = index["nu-a-fact-ug-english"]["scope"]["option_ids"]
    foundation = ["nu-a-study-nu-foundation-year-program"]
    quote("nu-a-fact-admission-fees", 12000, year="2026-2027", option_ids=foundation)
    quote("nu-a-fact-admission-fees", 15000, year="2026-2027", option_ids=common_ug)
    for ident in ("nu-b-finance-tuition", "nu-b-mba-tuition"):
        for amount in index[ident]["value"]["amounts"]:
            quote(ident, amount["amount"], amount["currency"], period="whole_program", fee_status=amount["fee_category"])
    quote("nu-b-joint-soas-dates-cost-support", 15000, "GBP", period="whole_program")
    joint = index["nu-a-fact-joint-bba-costs"]["value"]
    quote("nu-a-fact-joint-bba-costs", joint["reference_amounts"]["NU_years_1_2"]["tuition"]["amount"],
          campus="Nazarbayev University", study_years=[1, 2], reference_only=True)
    quote("nu-a-fact-joint-bba-costs", joint["reference_amounts"]["HKUST_years_3_4"]["tuition"]["amount"],
          campus="HKUST", study_years=[3, 4], reference_only=True)
    quote("nu-a-fact-joint-bba-costs", joint["reference_amounts"]["HKUST_years_3_4"]["total_tuition"]["amount"],
          period="whole_program", campus="Nazarbayev University and HKUST", study_years=[1, 2, 3, 4], reference_only=True)
    quote("nu-a-fact-joint-bba-costs", joint["special_2026_intake"]["NU_tuition"]["amount"], year="2026 intake",
          campus="Nazarbayev University", study_years=[1, 2], reference_only=True)
    quote("nu-b-msn-fee-scope-reviewed", 6000)
    for amount in index["nu-b-md-fees-funding-reviewed"]["value"]["tuition"]:
        quote("nu-b-md-fees-funding-reviewed", amount["amount"], fee_status=amount["fee_category"])
    for ident in ("nu-b-mpa-costs", "nu-b-mpp-costs", "nu-b-dpm-cost", "nu-b-phd-cost", "nu-b-dba-cost-reviewed"):
        quote(ident, index[ident]["value"]["amount"], modes=("on-campus", "online") if ident == "nu-b-mpa-costs" else ())
    for row in facts:
        if row["id"] in {"nu-b-joint-soas-dates-cost-support", "nu-b-md-fees-funding-reviewed"}:
            continue
        if row["id"].startswith("nu-b-") and row["review_status"] == "verified" and row["topic"] in {"cost_and_funding", "course_specific_admission_dates_fees_funding_awards"}:
            value = row["value"]
            tuition = value.get("tuition_reference") or value.get("tuition")
            if isinstance(tuition, dict) and tuition.get("amount") and tuition.get("currency") == "USD" and tuition.get("period") in {"academic year", "per year"}:
                quote(row["id"], tuition["amount"], modes=("on-campus", "online") if row["id"] == "nu-b-msc-ai-dates-cost-funding" else ())
    for ident in ("nu-c-phd-fee-2025-26", "nu-c-residency-fee-2025-26"):
        quote(ident, index[ident]["value"]["amount"], year="2025-2026")
    # The SoE reference excludes the unconfirmed cross-school MEng Management price.
    school_options = [row["id"] for row in options if row["id"].startswith("nu-a-study-") and row["levels"] == ["masters"]
                      and row["id"] not in {"nu-a-study-master-of-science-in-robotics", "nu-a-study-master-of-engineering-management"}]
    quote("nu-a-fact-soe-masters-tuition", 16000, option_ids=school_options)


def _deadline_projections(facts):
    index = {row["id"]: row for row in facts}
    row = index["nu-a-fact-financial-support-eligibility-2027-28"]
    tests = row["value"]["categories"]["SAT_ACT"]["last_test_dates_for_support"]
    row["attributes"]["deadline_events"] = [
        {"date": day, "deadline_type": "test_date", "label": f"Last {test} test date for financial support",
         "time": None, "timezone": None, "cycle": "2027/28", "publication_status": "published", "exam_id": test,
         "application_category": "financial_support", "source_ids": row["source_ids"]}
        for test, day in tests.items()]
    # Exact past references remain dated; TBA, yearless and conflicting windows cannot become calendar events.
    for row in facts:
        if row["review_status"] != "verified" or row["topic"] not in {"application_windows", "course_specific_application_dates_documents_and_conditions"}:
            continue
        value = row["value"]
        cycle = value.get("past_cycle") or value.get("cycle")
        if cycle != "2026-2027":
            continue
        events = []
        def visit(data, path=()):
            if isinstance(data, dict) and "date" not in data:
                for key, child in data.items():
                    if key not in {"documents", "future_cycle", "past_cycle", "cycle"}:
                        visit(child, (*path, key))
                return
            text = data.get("date") if isinstance(data, dict) else data
            if not isinstance(text, str):
                return
            import re
            match = re.fullmatch(r"(2026-\d{2}-\d{2})(?: (\d{2}:\d{2}) Astana)?", text)
            if not match:
                return
            label = " / ".join(path)
            is_test = any(word in label.casefold() for word in ("test", "english", "mcat"))
            events.append({"date": match[1], "deadline_type": "test_submission" if is_test else "application",
                           "label": label, "time": data.get("time") if isinstance(data, dict) else match[2],
                           "timezone": "Asia/Almaty" if (isinstance(data, dict) and data.get("timezone") == "Astana") or match[2] else None,
                           "cycle": cycle, "publication_status": "published_dated_reference", "source_ids": row["source_ids"]})
        visit(value)
        if events:
            row["attributes"]["deadline_events"] = events


def _residency_contexts(options, routes, facts, unknowns):
    """The single official application family has two verified admission statuses."""
    base = next(row for row in routes if row["id"] == "nu-c-residency-route")
    identifiers = {"unconditional": "nu-residency-unconditional", "conditional": "nu-residency-conditional-umc"}
    base["attributes"]["policy_for_route_ids"] = list(identifiers.values())
    base["classification"] = "shared_residency_application_family"
    branch_facts = {"nu-c-residency-unconditional": identifiers["unconditional"], "nu-c-residency-conditional": identifiers["conditional"]}
    for branch, ident in identifiers.items():
        child = copy.deepcopy(base)
        child.update({"id": ident, "title": "Residency: unconditional admission" if branch == "unconditional" else "Residency: UMC-recommended conditional admission",
                      "classification": "residency_unconditional" if branch == "unconditional" else "residency_conditional_umc",
                      "shared_form_family": base["id"], "shared_policy_context_ids": [base["id"]]})
        child["attributes"].pop("policy_for_route_ids", None)
        child["attributes"]["admission_status"] = branch
        child["fact_ids"] = [value for value in child["fact_ids"] if value not in branch_facts or branch_facts[value] == ident]
        routes.append(child)
    for option in options:
        if base["id"] in option["route_ids"]:
            option["route_ids"] = [value for value in option["route_ids"] if value != base["id"]] + list(identifiers.values())
    for fact in facts:
        if fact["id"] in branch_facts:
            fact["scope"]["route_ids"] = [branch_facts[fact["id"]]]
    for unknown in unknowns:
        if base["id"] in unknown["scope"]["route_ids"]:
            unknown["scope"]["route_ids"] = list(identifiers.values())


def build_nu_assessments(institution):
    """Bind supported minima to reviewed facts, retaining all manual source conditions."""
    facts = {row["id"]: row for row in institution["facts"]}
    records = []
    hl_ids = ["IB_MATHEMATICS_HL", "IB_PHYSICS_HL", "IB_CHEMISTRY_HL", "IB_BIOLOGY_HL", "IB_COMPUTER_SCIENCE_HL"]

    def exam(ident, minimum=None, **extra):
        return {"exam_id": ident, **({"minimum": minimum} if minimum is not None else {}), **extra}

    def academic(*alternatives, ident="academic"):
        return {"id": ident, "kind": "academic_requirement", "alternatives": list(alternatives)}

    def nuet(total, section):
        return exam("NUET", total, component_minimums={"NUET_MATH": section, "NUET_CRITICAL_THINKING": section})

    def unt(total, section):
        return exam("UNT", total, component_minimums={"UNT_MATHEMATICAL_LITERACY": section, "UNT_READING_LITERACY": section})

    def grades(ib=27, *, higher=4, a_level=4, additional=None):
        count = {"count": 3, "minimum": higher, "exam_ids": hl_ids}
        return [exam("IB_Diploma", ib, components_at_least=count,
                     **({"additional_component_counts": [{"count": 1, "minimum": 5, "exam_ids": hl_ids}]} if additional else {})),
                exam("A_LEVEL_CERT", components_at_least={"count": 3, "minimum": a_level},
                     **({"additional_component_counts": [{"count": 1, "minimum": 5}]} if additional else {}))]

    def language(overall, writing=None, reading=None, listening=None, speaking=None, *, all_sections=None, toefl=None):
        components = {"IELTS_" + key: value for key, value in
                      (("WRITING", writing), ("READING", reading), ("LISTENING", listening), ("SPEAKING", speaking)) if value is not None}
        if all_sections is not None:
            components = {"IELTS_" + key: all_sections for key in ("WRITING", "READING", "LISTENING", "SPEAKING")}
        alternatives = [exam("IELTS", overall, component_minimums=components)]
        alternatives.append(exam("TOEFL_iBT_0_120", toefl) if isinstance(toefl, (int, float)) else exam("TOEFL_iBT_0_120", requires_review=True))
        alternatives.append(exam("TOEFL_iBT_1_6", requires_review=True))
        return {"id": "english", "kind": "language_requirement", "alternatives": alternatives,
                "possible_exemption_evidence_kinds": ["education", "primary_language"]}

    def manual(ident="prior-degree", **extra):
        return {"id": ident, "kind": "manual_minimum", **extra}

    def add(ident, checks, *, cycles=(), remaining=()):
        row = facts[ident]
        if not checks:
            return
        digest = hashlib.sha256(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        cycle_labels = list(cycles)
        if "2027/28" in cycles:
            cycle_labels += ["Fall 2027", "2027 entry", "2027-2028"]
        if "2026/27_midyear" in cycles:
            cycle_labels += ["Spring 2027"]
        records.append({"id": ident + "-assessment", "institution_id": NU_ID, "fact_id": ident, "fact_sha256": digest,
                        "source_publication_status": row["publication_status"],
                        "scope": {"option_ids": row["scope"]["option_ids"], "route_ids": row["scope"]["route_ids"],
                                  "levels": row["scope"]["levels"], "applicant_routes": [], "cycles": cycle_labels},
                        "addressed_conditions": [], "checks": checks,
                        "remaining_conditions": [*(_list(row.get("conditions"))), *remaining], "mapping_reviewed_at": "2026-10-25"})

    add("nu-a-fact-ug-english", [language(6, 6, 5.5, 5.5, 5.5)], cycles=["2027/28"],
        remaining=["Test-center format, no superscoring, original OSR date and validity through 2027-08-01 require confirmation."])
    add("nu-a-fact-fyp-english", [language(5.5, 5.5, 5.5, 5, 5)], cycles=["2027/28"])
    add("nu-a-fact-ug-academic-alternatives", [academic({"profile_field": "gpa", "minimum": 4, "scale": 5},
        unt(85, 8), exam("SAT", 1240), exam("ACT", 26), *grades())], cycles=["2027/28"])
    add("nu-a-fact-fyp-academic", [academic({"profile_field": "gpa", "minimum": 3.5, "scale": 5},
        unt(75, 7), nuet(120, 50), exam("SAT", 1140, requires_review=True), exam("ACT", 24, requires_review=True))],
        remaining=["The policy restricts the Foundation SAT/ACT category to international applicants; confirm category applicability."])
    midyear = nuet(130, 60)
    midyear["windows"] = [["2026-01-01", "2026-12-31"]]
    add("nu-a-fact-midyear-nuet", [academic(midyear), manual("midyear-eligibility")], cycles=["2026/27_midyear"],
        remaining=["Only NUET from the current calendar year; spring entry is fee-paying."])
    add("nu-a-fact-nuet-support", [academic(nuet(120, 50))], cycles=["2027/28"])
    support = academic(nuet(120, 50), exam("SAT", 1240), exam("ACT", 26), *grades(30, additional=True))
    support["scope"] = {"levels": ["undergraduate"]}
    fyp_support = academic(nuet(120, 50), exam("SAT", 1140), exam("ACT", 24), ident="foundation-support")
    fyp_support["scope"] = {"levels": ["preparation"]}
    add("nu-a-fact-financial-support-eligibility-2027-28", [support, fyp_support], cycles=["2027/28"],
        remaining=["Regular offer, funding category, nationality restrictions, documents and award competition are separate decisions."])
    add("nu-a-fact-nursing-entry", [academic(exam("NURSING_NAT", component_minimums={"NAT_KNOWLEDGE": 70, "NAT_CLINICAL_SKILLS": 70})),
        manual(minimum=2.67, scale=4)], remaining=["Nursing diploma, licence, specialist certificate, post-diploma training and two recent years of practice require verification."])
    add("nu-a-fact-nds-entry", [language(6.5, toefl=79), academic(exam("SAT", 1150), exam("ACT", 23),
        *grades(), unt(None, 9), nuet(110, 40))], remaining=["Non-degree study does not guarantee degree admission or course placement."])
    for ident in ("nu-a-fact-nufyp-progression", "nu-a-fact-transfer-route-details", "nu-a-fact-joint-bba-admissions", "nu-a-fact-ump-program-entry"):
        add(ident, [manual("scoped-published-minimum")])
    for row in institution["facts"]:
        if row["index_attributes"]["owner_packet"] != "b" or row["topic"] != "eligibility" or row["review_status"] == "superseded":
            continue
        value = row["value"]
        checks = []
        gpa = next((value[key] for key in ("cgpa", "gpa", "master_cgpa", "cgpa_equivalent") if isinstance(value.get(key), dict)), None)
        if gpa:
            checks.append(manual(minimum=gpa["minimum"], scale=gpa["scale"]) if "minimum" in gpa else manual("conflicting-gpa"))
        english = value.get("english")
        if isinstance(english, dict):
            overall = english.get("minimum", english.get("IELTS", english.get("IELTS_overall")))
            if isinstance(overall, (int, float)):
                if "components" in english:
                    rule = language(overall)
                    rule["alternatives"][0]["component_minimums"] = english["components"]
                else:
                    each = english.get("each_section", english.get("each_subscore"))
                    rule = language(overall, english.get("writing"), english.get("other_sections"), english.get("other_sections"), english.get("other_sections"),
                                    all_sections=each, toefl=english.get("TOEFL_iBT_0_120"))
                toefl = english.get("TOEFL_iBT_0_120")
                if isinstance(toefl, dict):
                    rule["alternatives"][1] = exam("TOEFL_iBT_0_120", toefl["overall"], component_minimums={
                        "TOEFL_iBT_0_120_WRITING": toefl["writing"], **{"TOEFL_iBT_0_120_" + key: toefl["other_sections"] for key in ("READING", "LISTENING", "SPEAKING")}})
                checks.append(rule)
        quantitative = value.get("academic_test") or value.get("quantitative_test")
        if isinstance(quantitative, dict):
            alternatives = [exam(ident) for ident in quantitative["alternatives"]]
            checks.append({"id": "quantitative-report", "kind": "exam_alternatives", "alternatives": alternatives})
        if isinstance(value.get("MCAT"), dict):
            checks.append(academic(exam("MCAT", value["MCAT"]["minimum"], max_age_years=value["MCAT"]["maximum_test_age_years"]), ident="mcat"))
        if row["id"] in {"nu-b-msn-entry", "nu-b-mba-requirements"}:
            checks.append(manual("applicant-language-category" if row["id"] == "nu-b-msn-entry" else "writing-source-conflict"))
        add(row["id"], checks, remaining=["Prior-degree scope, equivalency, valid test dates/formats, discretionary waivers and selection conditions need source-specific review."])
    for ident in ("nu-c-phd-scai-regular_and_financial_support-requirements", "nu-c-phd-ssh-regular_and_financial_support-requirements",
                  "nu-c-phd-soe-regular-requirements", "nu-c-phd-soe-financial_support-requirements"):
        row = facts[ident]
        english = row["value"]["ielts"]
        add(ident, [manual(), language(english["overall"], all_sections=english["each_minimum"])])
    add("nu-c-residency-unconditional", [{"id": "medical-report", "kind": "exam_alternatives", "alternatives": [exam("IFOM_BSE"), exam("USMLE_STEP_1")]},
        manual("english-source-conflict")], remaining=["A medical report records presence, not a passing cutoff. Prior MD equivalence, recognition, English waiver and clinical suitability need review."])
    add("nu-c-residency-conditional", [manual("umc-recommendation")],
        remaining=["IFOM/USMLE and English evidence may be submitted during the first enrollment year; UMC recommendation and NUSOM decision are required."])
    for record in records:
        if record["fact_id"] in {"nu-a-fact-ug-english", "nu-a-fact-fyp-english", "nu-a-fact-ug-academic-alternatives"}:
            for check in record["checks"]:
                for alternative in check.get("alternatives", []):
                    if alternative.get("exam_id") in {"IELTS", "SAT", "ACT"}:
                        alternative["windows"] = [["2025-08-01", "2027-08-01"]]
    return records


def _reviewed_text_matches(raw, expected):
    # Git changes LF/CRLF on checkout without changing the reviewed UTF-8 content.
    lf = raw.replace(b"\r\n", b"\n")
    return any(hashlib.sha256(value).hexdigest() == expected for value in (raw, lf, lf.replace(b"\n", b"\r\n")))


def prepare_nu_institution(folder):
    folder = Path(folder).resolve()
    repo = folder.parents[3]
    catalog_path = folder / "research-catalog.json"
    raw = catalog_path.read_bytes()
    catalog = json.loads(raw.decode("utf-8"))
    acceptance_path = folder / "packet-b" / "data-acceptance.json"
    try:
        acceptance = json.loads(acceptance_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError("NU requires B's independent data acceptance before preparation") from error
    digest = hashlib.sha256(raw).hexdigest()
    if acceptance.get("status") != "accepted" or not _reviewed_text_matches(raw, acceptance.get("catalog_sha256")):
        raise ValueError("NU independent data acceptance is missing or stale")
    inputs = []
    for item in catalog["inputs"]:
        path = (repo / item["path"]).resolve()
        if not path.is_relative_to(folder) or not _reviewed_text_matches(path.read_bytes(), item["sha256"]):
            raise ValueError(f"NU packet input fingerprint changed: {item['path']}")
        inputs.append({"path": item["path"], "sha256": item["sha256"]})
        if item.get("handoff_path"):
            handoff = (repo / item["handoff_path"]).resolve()
            if not handoff.is_relative_to(folder) or not _reviewed_text_matches(handoff.read_bytes(), item["handoff_sha256"]):
                raise ValueError(f"NU research handoff changed: {item['handoff_path']}")
            inputs.append({"path": item["handoff_path"], "sha256": item["handoff_sha256"]})
    result = convert_research_catalog(catalog)
    result["inputs"] = [*inputs, {"path": catalog_path.relative_to(repo).as_posix(), "sha256": digest},
                         {"path": acceptance_path.relative_to(repo).as_posix(), "sha256": hashlib.sha256(acceptance_path.read_bytes()).hexdigest()}]
    result["institution"]["attributes"]["data_acceptance"] = acceptance
    return result
