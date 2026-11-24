"""University schema normalization, URL sanitization, card projection, and map points."""

import copy
import urllib.parse
from typing import Any

from app.core.utils import (
    normalize_search_lang as _normalize_search_lang,
)
from app.core.utils import (
    safe_lower as _safe_lower,
)
from app.core.utils import (
    to_float as _num_or_none,
)
from app.services import admissions_catalog
from app.services.finance_modes import normalize_study_mode as _normalize_study_mode
from app.services.university_costs import (
    _catalog_costs,
    _effective_university_cost,
    _get_university_acceptance_rate,
    _has_any_aid,
    _rank_meta_from_university,
    _to_bool,
    _to_float,
    _university_cost_range,
)
from app.services.university_covers import cover_available
from app.services.university_localization import (
    SEARCH_LANG_ENG,
    _abbreviations_for_university,
    _hidden_search_aliases_for_university,
    _localize_university_payload,
    _map_label_for_university,
    _translate_group_value,
    _translate_university_name,
    _uniq_non_empty,
)
from app.services.university_tracks import (
    _derive_track_applicable_majors,
    _derive_track_score_profile,
    _filter_academics_for_product_scope,
    _should_keep_track_for_product_scope,
)

COLLEGE_SCORECARD_PUBLIC_API_KEY = "DEMO_KEY"
COLLEGE_SCORECARD_HOST = "api.data.gov"
COLLEGE_SCORECARD_PATH_PREFIX = "/ed/collegescorecard/"


def _sanitize_public_source_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(value)
    except ValueError:
        return value
    if parsed.hostname != COLLEGE_SCORECARD_HOST:
        return value
    if not parsed.path.startswith(COLLEGE_SCORECARD_PATH_PREFIX):
        return value

    pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    changed = False
    sanitized_pairs = []
    for key, item_value in pairs:
        if key == "api_key" and item_value != COLLEGE_SCORECARD_PUBLIC_API_KEY:
            sanitized_pairs.append((key, COLLEGE_SCORECARD_PUBLIC_API_KEY))
            changed = True
        else:
            sanitized_pairs.append((key, item_value))
    if not changed:
        return value

    return urllib.parse.urlunsplit(
        parsed._replace(query=urllib.parse.urlencode(sanitized_pairs, doseq=True))
    )


def _sanitize_public_source_urls(data: Any) -> Any:
    if isinstance(data, str):
        return _sanitize_public_source_url(data)
    if isinstance(data, list):
        return [_sanitize_public_source_urls(item) for item in data]
    if isinstance(data, dict):
        return {key: _sanitize_public_source_urls(value) for key, value in data.items()}
    return data


def _normalize_university_schema(u: dict[str, Any]) -> dict[str, Any]:
    """
    Adds backward-compatible academics fields for the new DB structure:
    - academics.programs[].name -> academics.majors
    - academics.programs[].study_levels -> academics.study_levels
    - academics.programs[].study_mode -> academics.formats
    - average(programs[].acceptance_rate_percent) -> academics.acceptance_rate_percent
    """
    if not isinstance(u, dict):
        return {}

    uid = str(u.get("id") or "")
    u["cover_available"] = cover_available(uid)
    u["admissions_catalog"] = admissions_catalog.get_public_contract(uid)
    if uid in admissions_catalog.INSTITUTION_IDS:
        summary = admissions_catalog.get_institution_summary(uid)
        options = summary["study_options"] if summary else []
        for key in (
            "admission_categories",
            "finance",
            "qualification_guidance",
            "admission_portals",
            "fellowships_and_grants",
            "requirements",
        ):
            u.pop(key, None)
        provenance = u.get("fact_provenance")
        if isinstance(provenance, dict) and isinstance(provenance.get("facts"), dict):
            provenance["facts"] = {
                key: value
                for key, value in provenance["facts"].items()
                if key not in {"acceptance_rate_percent", "tuition_total_cost_year_usd"}
            }
        u["academics"] = {
            "majors": _uniq_non_empty([option["title"] for option in options]),
            "study_levels": u["admissions_catalog"]["study_levels"],
            "formats": list(summary["formats"]) if summary else [],
        }
        return u

    academics = u.get("academics")
    if not isinstance(academics, dict):
        academics = {}
        u["academics"] = academics

    programs_raw = academics.get("programs", [])
    programs = (
        [p for p in programs_raw if isinstance(p, dict)]
        if isinstance(programs_raw, list)
        else []
    )

    majors = academics.get("majors")
    if not isinstance(majors, list) or len(majors) == 0:
        academics["majors"] = _uniq_non_empty([p.get("name") for p in programs])

    study_levels = academics.get("study_levels")
    if not isinstance(study_levels, list) or len(study_levels) == 0:
        levels: list[Any] = []
        for p in programs:
            lv = p.get("study_levels")
            if isinstance(lv, list):
                levels.extend(lv)
            elif lv is not None:
                levels.append(lv)
        academics["study_levels"] = _uniq_non_empty(levels)

    existing_formats = academics.get("formats")
    if not isinstance(existing_formats, list) or len(existing_formats) == 0:
        fmts: list[Any] = []
        for p in programs:
            mode = p.get("study_mode")
            if isinstance(mode, list):
                fmts.extend(mode)
            elif mode is not None:
                fmts.append(mode)
        academics["formats"] = _uniq_non_empty(fmts)

    acc = _num_or_none(academics.get("acceptance_rate_percent"))
    if acc is None:
        vals = []
        for p in programs:
            v = _num_or_none(p.get("acceptance_rate_percent"))
            if v is not None:
                vals.append(v)
        if vals:
            academics["acceptance_rate_percent"] = round(sum(vals) / len(vals), 2)

    categories = u.get("admission_categories")
    if isinstance(categories, list):
        kept_categories: list[dict[str, Any]] = []
        for raw_category in categories:
            if not isinstance(raw_category, dict):
                continue

            category = copy.deepcopy(raw_category)
            derived_majors = _derive_track_applicable_majors(u, category)
            has_explicit_program_mapping = any(
                isinstance(category.get(key), (list, str))
                for key in ("program_ids", "program_names")
            )
            if derived_majors or has_explicit_program_mapping or isinstance(category.get("applicable_majors"), list):
                category["applicable_majors"] = derived_majors

            raw_profiles = category.get("requirement_profiles")
            profiles = [row for row in raw_profiles if isinstance(row, dict)] if isinstance(raw_profiles, list) else []
            normalized_profiles: list[dict[str, Any]] = []
            for raw_profile in profiles:
                profile = copy.deepcopy(raw_profile)
                context = copy.deepcopy(category)
                context.update(profile)
                profile_majors = profile.get("applicable_majors") or category.get("applicable_majors")
                if profile_majors:
                    profile["applicable_majors"] = copy.deepcopy(profile_majors)
                    context["applicable_majors"] = copy.deepcopy(profile_majors)
                score_profile = _derive_track_score_profile(u, context)
                if score_profile:
                    profile["score_profile"] = score_profile
                if _should_keep_track_for_product_scope(u, profile):
                    normalized_profiles.append(profile)
            category["requirement_profiles"] = normalized_profiles

            if _should_keep_track_for_product_scope(u, category) and normalized_profiles:
                kept_categories.append(category)
        u["admission_categories"] = kept_categories

    _filter_academics_for_product_scope(academics)

    return u


def to_university_card(
    u: dict[str, Any],
    format_preference: Any = "any",
    search_lang: str | None = None,
) -> dict[str, Any]:
    if not isinstance(u, dict):
        return {}

    lang = _normalize_search_lang(search_lang)
    mode = _normalize_study_mode(format_preference)
    uid = str(u.get("id") or "").strip()
    location = u.get("location")
    location_obj = location if isinstance(location, dict) else {}
    finance = u.get("finance")
    finance_obj = finance if isinstance(finance, dict) else {}
    aid = finance_obj.get("financial_aid")
    aid_obj = aid if isinstance(aid, dict) else {}
    coordinates = u.get("coordinates")
    coordinates_obj = coordinates if isinstance(coordinates, dict) else {}
    card_cost = _effective_university_cost(u, format_preference=mode)
    card_cost_range = _university_cost_range(u)

    name_value = str(u.get("name") or "")
    country_value = location_obj.get("country")
    city_value = location_obj.get("city")
    state_value = location_obj.get("state")
    if lang != SEARCH_LANG_ENG:
        name_value = _translate_university_name(uid, name_value, lang)
        country_value = _translate_group_value("country", country_value, lang)
        city_value = _translate_group_value("city", city_value, lang)
        state_value = _translate_group_value("state", state_value, lang)

    out: dict[str, Any] = {
        "id": u.get("id"),
        "name": name_value,
        "rank": u.get("rank"),
        "website": u.get("website"),
        "location": {
            "country": country_value,
            "city": city_value,
            "state": state_value,
        },
        "finance": {
            "total_cost_year_usd": card_cost,
            "total_cost_year_range": card_cost_range,
            "currency": finance_obj.get("currency") or (
                "USD" if card_cost is not None else (card_cost_range or {}).get("currency")
            ),
            "financial_aid": {
                "merit_based": _to_bool(aid_obj.get("merit_based")),
                "need_based": _to_bool(aid_obj.get("need_based")),
            },
        },
        "academics": {
            "acceptance_rate_percent": _get_university_acceptance_rate(u),
        },
        "search_aliases": [
            _safe_lower(x) for x in _hidden_search_aliases_for_university(u)
        ],
        "abbreviations": [_safe_lower(x) for x in _abbreviations_for_university(u)],
        "aid_any": _has_any_aid(u),
        "catalog_costs": _catalog_costs(u, mode),
        "cover_available": bool(u.get("cover_available")),
    }
    if isinstance(u.get("admissions_catalog"), dict):
        out["admissions_catalog"] = u["admissions_catalog"]
    if uid in admissions_catalog.INSTITUTION_IDS:
        out.pop("finance")
        out.pop("aid_any")
    rank_meta = _rank_meta_from_university(u)
    if rank_meta:
        out["rank_meta"] = rank_meta

    lat = _to_float(coordinates_obj.get("lat"))
    lon = _to_float(coordinates_obj.get("lon"))
    if lat is not None and lon is not None:
        out["coordinates"] = {"lat": lat, "lon": lon}

    match_data = u.get("matchData")
    if isinstance(match_data, dict):
        out["matchData"] = match_data

    return out


def to_university_map_point(
    u: dict[str, Any],
    search_lang: str | None = None,
) -> dict[str, Any]:
    """Return the compact payload needed to build a clustered map marker."""
    if not isinstance(u, dict):
        return {}

    coordinates = u.get("coordinates")
    coordinates_obj = coordinates if isinstance(coordinates, dict) else {}
    lat = _to_float(coordinates_obj.get("lat"))
    lon = _to_float(coordinates_obj.get("lon"))
    if lat is None or lon is None:
        return {}

    uid = str(u.get("id") or "").strip()
    location = u.get("location")
    location_obj = location if isinstance(location, dict) else {}
    lang = _normalize_search_lang(search_lang)
    name_value = str(u.get("name") or "")
    country_value = location_obj.get("country")
    city_value = location_obj.get("city")
    if lang != SEARCH_LANG_ENG:
        name_value = _translate_university_name(uid, name_value, lang)
        country_value = _translate_group_value("country", country_value, lang)
        city_value = _translate_group_value("city", city_value, lang)

    out: dict[str, Any] = {
        "id": u.get("id"),
        "name": name_value,
        "rank": u.get("rank"),
        "location": {
            "country": country_value,
            "city": city_value,
        },
        "coordinates": {"lat": lat, "lon": lon},
        "cover_available": bool(u.get("cover_available")),
    }
    map_label = _map_label_for_university(uid, lang)
    if map_label:
        out["map_label"] = map_label
    if isinstance(u.get("admissions_catalog"), dict):
        out["admissions_catalog"] = u["admissions_catalog"]
    if isinstance(u.get("catalog_costs"), dict):
        out["catalog_costs"] = u["catalog_costs"]
    return out


def _project_universities(
    items: list[dict[str, Any]],
    response_mode: str,
    format_preference: Any = "any",
    search_lang: str | None = None,
) -> list[dict[str, Any]]:
    mode = _safe_lower(response_mode)
    if mode == "card":
        return [
            to_university_card(
                u, format_preference=format_preference, search_lang=search_lang
            )
            for u in items
        ]
    if mode == "map":
        return [
            point
            for point in (
                to_university_map_point(u, search_lang=search_lang) for u in items
            )
            if point
        ]
    lang = _normalize_search_lang(search_lang)
    if lang == SEARCH_LANG_ENG:
        return items
    return [_localize_university_payload(u, search_lang=lang) for u in items]
