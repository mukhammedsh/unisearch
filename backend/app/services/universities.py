"""University catalog loading, filtering, search, sorting, and response orchestration."""

import hashlib
import json
import logging
from typing import Any

from app.core.files import RequiredDataUnavailable, file_mtime
from app.core.paths import CITIES_PATH, DATA_PATH
from app.core.utils import (
    norm_space as _norm_space,
)
from app.core.utils import (
    norm_tag_key as _norm_tag_key,
)
from app.core.utils import (
    normalize_search_lang as _normalize_search_lang,
)
from app.core.utils import (
    safe_lower as _safe_lower,
)
from app.services import admissions_catalog, admissions_editorial
from app.services import search as search_service
from app.services.finance_modes import normalize_study_mode as _normalize_study_mode
from app.services.university_costs import (
    LARGE_STUDENT_LIMIT,
    SMALL_STUDENT_LIMIT,
    _catalog_cost_range_usd,
    _catalog_costs,
    _effective_university_cost_usd,
    _get_list,
    _get_nested,
    _get_university_acceptance_rate,
    _has_any_aid,
    _profiled_legacy_costs,
    _to_float,
    student_size_band,
)
from app.services.university_coverage import (
    _MBA_RE,
    build_coverage_by_level,
    build_coverage_by_program,
)
from app.services.university_localization import (
    _CITY_LOCALIZED_BY_LANG,
    _COUNTRY_LOCALIZED_BY_LANG,
    _MAJOR_LOCALIZED_BY_LANG,
    _NAME_VARIANTS_CACHE,
    _STATE_LOCALIZED_BY_LANG,
    _TAG_LOCALIZED_BY_LANG,
    SEARCH_LANG_ENG,
    SEARCH_LANG_KAZ,
    SEARCH_LANG_RUS,
    _abbreviations_for_university,
    _full_name_from_variants,
    _hidden_search_aliases_for_university,
    _load_localized_university_names,
    _load_university_translations_raw,
    _localize_university_payload,
    _map_label_for_university,
    _search_query_candidates,
    _translate_group_value,
    _translate_program_name,
    _uniq_non_empty,
)
from app.services.university_projection import (
    _normalize_university_schema,
    _project_universities,
    _sanitize_public_source_urls,
    to_university_card,
    to_university_map_point,
)
from app.services.university_tracks import (
    _canonical_major,
    _iter_programs,
    _major_tags_from_text,
    _normalize_major_text,
    expand_admission_choices,
)

__all__ = [
    "DATA_PATH",
    "LARGE_STUDENT_LIMIT",
    "SEARCH_LANG_ENG",
    "SEARCH_LANG_KAZ",
    "SEARCH_LANG_RUS",
    "SMALL_STUDENT_LIMIT",
    "UNIVERSITY_DETAIL_REPR_VERSION",
    "_NAME_VARIANTS_CACHE",
    "_UNI_CACHE",
    "_abbreviations_for_university",
    "_apply_sort",
    "_build_university_meta",
    "_catalog_cost_range_usd",
    "_effective_university_cost_usd",
    "_filter_by_search_query",
    "_full_name_from_variants",
    "_get_university_acceptance_rate",
    "_hidden_search_aliases_for_university",
    "_load_localized_university_names",
    "_load_university_translations_raw",
    "_map_label_for_university",
    "_normalize_university_schema",
    "_sanitize_public_source_urls",
    "_search_query_candidates",
    "expand_admission_choices",
    "file_mtime",
    "get_locations",
    "get_universities_with_meta",
    "get_university_by_id",
    "get_university_etag",
    "get_university_translation_bundle",
    "list_universities",
    "load_universities",
    "student_size_band",
    "to_university_card",
    "to_university_map_point",
]

UNIVERSITY_DETAIL_REPR_VERSION = 7

_UNI_CACHE: dict[str, Any] = {"mtime": None, "data": [], "by_id": {}, "meta": []}
_LOGGER = logging.getLogger("unisearch.translations")
# language -> (source pack, editorial clauses, cleaned pack); identity checks follow the loaders' own caches.
_CLEAN_TRANSLATION_CACHE: dict[str, tuple[Any, Any, dict[str, Any]]] = {}
_LOC_CACHE: dict[str, Any] = {"mtime": None, "data": {}}


def _build_university_meta(
    u: dict[str, Any],
    rus_names: dict[str, str] | None = None,
    kaz_names: dict[str, str] | None = None,
) -> dict[str, Any]:
    programs = _iter_programs(u)
    majors = _get_list(u, ["academics", "majors"])
    explicit_major_tags = _get_list(u, ["academics", "major_tags"])
    study_levels = _get_list(u, ["academics", "study_levels"])
    formats = _get_list(u, ["academics", "formats"])

    program_names = [p.get("name") for p in programs]
    reviewed = admissions_catalog.get_institution_summary(str(u.get("id") or ""))
    if reviewed:
        program_names = [option["title"] for option in reviewed["study_options"]]
        study_levels = [level for option in reviewed["study_options"] for level in option["levels"]]
        program_levels: list[Any] = [
            "MBA"
            for option in reviewed["study_options"]
            if any(_MBA_RE.search(award) for award in option["awards"])
        ]
    else:
        program_levels = []
    program_major_tags: list[Any] = []
    for p in programs:
        p_tags = p.get("major_tags")
        if isinstance(p_tags, list):
            program_major_tags.extend(p_tags)
        elif p_tags is not None:
            program_major_tags.append(p_tags)
        lv = p.get("study_levels")
        if isinstance(lv, list):
            program_levels.extend(lv)
        else:
            program_levels.append(lv)
        program_name = str(p.get("name") or "")
        if _MBA_RE.search(program_name):
            program_levels.append("MBA")
    program_formats = [p.get("study_mode") for p in programs]
    major_exact = _uniq_non_empty(
        [
            tag
            for value in (
                majors + program_names + explicit_major_tags + program_major_tags
            )
            for tag in _major_tags_from_text(value)
        ]
    )
    uni_id = str(u.get("id", "")).strip()
    if rus_names is None:
        rus_names = _load_localized_university_names(SEARCH_LANG_RUS)
    if kaz_names is None:
        kaz_names = _load_localized_university_names(SEARCH_LANG_KAZ)

    country_key = _norm_space(_get_nested(u, ["location", "country"]))
    city_key = _norm_space(_get_nested(u, ["location", "city"]))
    state_key = _norm_space(_get_nested(u, ["location", "state"]))
    description = _safe_lower(u.get("description"))
    raw_tags = [
        str(x or "").strip() for x in (u.get("tags") or []) if str(x or "").strip()
    ]
    hidden_search_aliases = _hidden_search_aliases_for_university(u)
    tag_keys = [_norm_tag_key(x) for x in raw_tags if _norm_tag_key(x)]

    major_exact_rus = _uniq_non_empty(
        [
            _MAJOR_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(_safe_lower(x), "")
            for x in major_exact
            if x
        ]
    )
    tags_rus = _uniq_non_empty(
        [
            _TAG_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(_norm_tag_key(x), "")
            for x in tag_keys
            if x
        ]
    )
    name_raw = _safe_lower(_full_name_from_variants(uni_id, SEARCH_LANG_ENG, str(u.get("name") or "")))
    city_raw = _safe_lower(_get_nested(u, ["location", "city"]))
    country_raw = _safe_lower(_get_nested(u, ["location", "country"]))
    name_rus = _safe_lower(_full_name_from_variants(uni_id, SEARCH_LANG_RUS, rus_names.get(uni_id, "")))
    city_rus = _safe_lower(_CITY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(city_key, ""))
    country_rus = _safe_lower(
        _COUNTRY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(country_key, "")
    )
    description_rus = _norm_space(
        f"{name_rus or name_raw} {city_rus or city_raw} {country_rus or country_raw} {' '.join(tags_rus)}"
    )
    name_kaz = _safe_lower(_full_name_from_variants(uni_id, SEARCH_LANG_KAZ, kaz_names.get(uni_id, "")))
    city_kaz = _safe_lower(_translate_group_value("city", city_key, SEARCH_LANG_KAZ))
    country_kaz = _safe_lower(
        _translate_group_value("country", country_key, SEARCH_LANG_KAZ)
    )
    state_kaz = _safe_lower(
        _translate_group_value("state", state_key, SEARCH_LANG_KAZ)
    )
    major_exact_kaz = _uniq_non_empty(
        [
            _safe_lower(_translate_program_name(value, SEARCH_LANG_KAZ))
            for value in major_exact
            if value
        ]
    )
    tags_kaz = _uniq_non_empty(
        [
            _safe_lower(_translate_group_value("tag", value, SEARCH_LANG_KAZ))
            for value in raw_tags
            if value
        ]
    )
    description_kaz = _norm_space(
        f"{name_kaz or name_raw} {city_kaz or city_raw} {country_kaz or country_raw} {' '.join(tags_kaz)}"
    )

    choices = expand_admission_choices(u.get("admission_categories"))
    # Reviewed institutions keep funding facts in the admissions catalog, not in legacy
    # admission choices, so these flags are unknown (None) rather than False for them.
    has_grant = (
        None
        if reviewed
        else any(_safe_lower(c.get("funding_type")) == "grant" for c in choices if isinstance(c, dict))
    )
    has_paid = (
        None
        if reviewed
        else any(_safe_lower(c.get("funding_type")) == "paid" for c in choices if isinstance(c, dict))
    )
    acceptance_rate = _get_university_acceptance_rate(u)
    cost_usd_any = _effective_university_cost_usd(u, "any")
    cost_usd_online = _effective_university_cost_usd(u, "online")
    cost_usd_oncampus = _effective_university_cost_usd(u, "on-campus")
    rank_num = _to_float(u.get("rank")) or 999999.0
    has_aid = None if reviewed else _has_any_aid(u)

    return {
        "name": name_raw,
        "name_rus": name_rus,
        "country": _safe_lower(_get_nested(u, ["location", "country"])),
        "country_rus": country_rus,
        "city": _safe_lower(_get_nested(u, ["location", "city"])),
        "city_rus": city_rus,
        "state": _safe_lower(_get_nested(u, ["location", "state"])),
        "state_rus": _safe_lower(
            _STATE_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(state_key, "")
        ),
        "description": description,
        "description_rus": description_rus,
        "name_kaz": name_kaz,
        "country_kaz": country_kaz,
        "city_kaz": city_kaz,
        "state_kaz": state_kaz,
        "description_kaz": description_kaz,
        "search_aliases": [_safe_lower(x) for x in hidden_search_aliases if x],
        "tags": [_safe_lower(x) for x in raw_tags if x],
        "tags_rus": [_safe_lower(x) for x in tags_rus if x],
        "tags_kaz": tags_kaz,
        "size": student_size_band(u),
        "majors": [_safe_lower(x) for x in majors if x],
        "program_names": [_safe_lower(x) for x in program_names if x],
        "major_exact": [_safe_lower(x) for x in major_exact if x],
        "major_exact_rus": [_safe_lower(x) for x in major_exact_rus if x],
        "major_exact_kaz": major_exact_kaz,
        "study_levels": [_safe_lower(x) for x in study_levels if x]
        + [_safe_lower(x) for x in program_levels if x],
        "formats": [_safe_lower(x) for x in formats if x]
        + [_safe_lower(x) for x in program_formats if x],
        "cost_usd_any": cost_usd_any,
        "cost_usd_online": cost_usd_online,
        "cost_usd_oncampus": cost_usd_oncampus,
        "acceptance_rate": acceptance_rate,
        "rank_num": rank_num,
        "has_grant": has_grant,
        "has_paid": has_paid,
        "has_aid": has_aid,
    }


def _meta_for_search_lang(meta_row: dict[str, Any], search_lang: str) -> dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    if lang not in {SEARCH_LANG_RUS, SEARCH_LANG_KAZ}:
        return meta_row

    out = dict(meta_row)

    def merged_text(*values: Any) -> str:
        vals = _uniq_non_empty(
            [str(v or "").strip() for v in values if str(v or "").strip()]
        )
        return " ".join(vals).strip()

    suffix = "kaz" if lang == SEARCH_LANG_KAZ else "rus"
    out["name"] = merged_text(meta_row.get("name"), meta_row.get(f"name_{suffix}", ""))
    out["country"] = merged_text(
        meta_row.get("country"), meta_row.get(f"country_{suffix}", "")
    )
    out["city"] = merged_text(meta_row.get("city"), meta_row.get(f"city_{suffix}", ""))
    out["state"] = merged_text(meta_row.get("state"), meta_row.get(f"state_{suffix}", ""))
    out["description"] = merged_text(
        meta_row.get("description"), meta_row.get(f"description_{suffix}", "")
    )
    out["tags"] = _uniq_non_empty(
        list(meta_row.get("tags", []) or [])
        + list(meta_row.get(f"tags_{suffix}", []) or [])
    )

    localized_major_exact = list(meta_row.get(f"major_exact_{suffix}", []) or [])
    out["major_exact"] = _uniq_non_empty(
        list(meta_row.get("major_exact", []) or []) + localized_major_exact
    )
    out["majors"] = _uniq_non_empty(
        list(meta_row.get("majors", []) or []) + localized_major_exact
    )
    out["program_names"] = _uniq_non_empty(
        list(meta_row.get("program_names", []) or []) + localized_major_exact
    )
    return out


def _apply_sort(
    items: list[dict[str, Any]],
    sort: str,
    format_preference: Any = "any",
    cost_basis: str = "annual_total",
) -> list[dict[str, Any]]:
    sort = (sort or "").strip()

    if sort in ("name_asc", "relevance"):
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(
            items,
            key=lambda u: (
                (cost := _catalog_cost_range_usd(u, cost_basis, format_preference)) is None,
                cost[0] if cost is not None else 0.0,
            ),
        )
    if sort == "tuition_desc":
        return sorted(
            items,
            key=lambda u: (
                (cost := _catalog_cost_range_usd(u, cost_basis, format_preference)) is None,
                -(cost[0] if cost is not None else 0.0),
            ),
        )

    if sort == "acceptance_asc":
        return sorted(
            items,
            key=lambda u: (
                (rate := _get_university_acceptance_rate(u)) is None,
                rate if rate is not None else 0.0,
            ),
        )
    if sort == "acceptance_desc":
        return sorted(
            items,
            key=lambda u: (
                (rate := _get_university_acceptance_rate(u)) is None,
                -(rate if rate is not None else 0.0),
            ),
        )

    if sort == "rank_asc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 999999.0))
    if sort == "rank_desc":
        return sorted(
            items, key=lambda u: (_to_float(u.get("rank")) or 0.0), reverse=True
        )

    return sorted(items, key=lambda u: _safe_lower(u.get("name")))


def _load_universities_cached() -> list[dict[str, Any]]:
    mtime = file_mtime(DATA_PATH)
    admissions_revision = admissions_catalog.get_revision()
    if mtime is None:
        raise RequiredDataUnavailable("University data is unavailable")

    if mtime != _UNI_CACHE["mtime"] or admissions_revision != _UNI_CACHE.get("admissions_revision"):
        try:
            with open(DATA_PATH, encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list) or not data or any(not isinstance(row, dict) for row in data):
                raise ValueError("universities.json must contain university records")
            data = _sanitize_public_source_urls(data)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            raise RequiredDataUnavailable("University data is unavailable") from exc

        out: list[dict[str, Any]] = []
        meta_list: list[dict[str, Any]] = []
        by_id: dict[str, dict[str, Any]] = {}
        rus_names = _load_localized_university_names(SEARCH_LANG_RUS)
        kaz_names = _load_localized_university_names(SEARCH_LANG_KAZ)
        for row in data:
            if not isinstance(row, dict):
                continue
            norm = _normalize_university_schema(row)
            out.append(norm)
            meta_row = _build_university_meta(
                norm, rus_names=rus_names, kaz_names=kaz_names
            )
            uid = str(norm.get("id", "")).strip()
            if uid:
                by_id[uid] = norm
                # Pre-build search meta for all supported search languages.
                pm_eng = search_service.prepare_search_meta(meta_row)
                meta_rus = _meta_for_search_lang(meta_row, SEARCH_LANG_RUS)
                pm_rus = search_service.prepare_search_meta(meta_rus)
                meta_kaz = _meta_for_search_lang(meta_row, SEARCH_LANG_KAZ)
                pm_kaz = search_service.prepare_search_meta(meta_kaz)
                meta_row["prepared_search_meta_eng"] = pm_eng
                meta_row["prepared_search_meta_rus"] = pm_rus
                meta_row["prepared_search_meta_kaz"] = pm_kaz
            meta_list.append(meta_row)

        _UNI_CACHE["mtime"] = mtime
        _UNI_CACHE["admissions_revision"] = admissions_revision
        _UNI_CACHE["data"] = out
        _UNI_CACHE["by_id"] = by_id
        _UNI_CACHE["meta"] = meta_list

    return _UNI_CACHE["data"]


def load_universities() -> list[dict[str, Any]]:
    return _load_universities_cached()


def get_universities_with_meta() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    _load_universities_cached()
    return _UNI_CACHE["data"], _UNI_CACHE["meta"]


def get_university_by_id(
    university_id: str,
    search_lang: str | None = None,
    localized: bool = False,
) -> dict[str, Any] | None:
    _load_universities_cached()
    item = _UNI_CACHE["by_id"].get(str(university_id))
    if item is None:
        return None
    if not localized:
        return item
    payload = _localize_university_payload(item, search_lang)
    if str(item.get("id") or "") not in admissions_catalog.INSTITUTION_IDS:
        payload["coverage_by_level"] = build_coverage_by_level(item)
        payload["coverage_by_program"] = build_coverage_by_program(item)
    return payload


def get_university_etag(
    university_id: str,
    search_lang: str | None = None,
    *,
    payload: dict[str, Any] | None = None,
) -> str:
    if payload is None:
        payload = get_university_by_id(university_id, search_lang=search_lang, localized=True)
    # Hash the captured response so a snapshot refresh cannot give an older body a newer ETag.
    raw = json.dumps(
        [UNIVERSITY_DETAIL_REPR_VERSION, _normalize_search_lang(search_lang), payload],
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f'"{digest}"'


def get_university_translation_bundle(
    search_lang: str | None = None,
) -> dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    raw = _load_university_translations_raw()
    raw_langs = raw.get("languages")
    langs: dict[str, Any] = raw_langs if isinstance(raw_langs, dict) else {}
    raw_pack = langs.get(lang)
    pack: dict[str, Any] = raw_pack if isinstance(raw_pack, dict) else {}
    try:
        clauses = admissions_editorial.load_clauses()
        cached = _CLEAN_TRANSLATION_CACHE.get(lang)
        if not cached or cached[0] is not pack or cached[1] is not clauses:
            cached = (pack, clauses, admissions_editorial.clean_translation_pack(pack, lang))
            _CLEAN_TRANSLATION_CACHE[lang] = cached
        pack = cached[2]
    except admissions_catalog.AdmissionsCatalogError:
        # The admissions endpoints fail explicitly in this state; general translations stay available.
        _LOGGER.warning("Admissions editorial notes are unavailable; translations are served unfiltered")
    return {
        "lang": lang,
        "schema_version": raw.get("schema_version", 1),
        "data": pack if isinstance(pack, dict) else {},
    }


def get_locations() -> dict[str, Any]:
    mtime = file_mtime(CITIES_PATH)
    if mtime is None:
        _LOC_CACHE["mtime"] = None
        _LOC_CACHE["data"] = {}
        return {}
    if mtime != _LOC_CACHE["mtime"]:
        try:
            with open(CITIES_PATH, encoding="utf-8") as f:
                data = json.load(f)
            _LOC_CACHE["data"] = data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError, ValueError):
            _LOC_CACHE["data"] = {}
        _LOC_CACHE["mtime"] = mtime
    return _LOC_CACHE["data"]


def _filter_by_search_query(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    q: str,
    lang: str,
) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], dict[str, float]]:
    query_candidates = _search_query_candidates(q, search_lang=lang)
    prepared_queries = []
    for q_val in query_candidates:
        pq = search_service.prepare_query(q_val)
        if pq:
            prepared_queries.append(pq)

    scored_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    search_scores: dict[str, float] = {}
    prepared_key = {
        SEARCH_LANG_ENG: "prepared_search_meta_eng",
        SEARCH_LANG_RUS: "prepared_search_meta_rus",
        SEARCH_LANG_KAZ: "prepared_search_meta_kaz",
    }[lang]
    for u, m in pairs:
        pm = m.get(prepared_key)
        if not pm:
            meta_search = _meta_for_search_lang(m, lang)
            pm = search_service.prepare_search_meta(meta_search)
            if not pm:
                continue

        best_score: float | None = None
        for pq in prepared_queries:
            score = search_service.score_prepared(pm, pq)
            if score is None or score <= 0:
                continue
            if best_score is None or score > best_score:
                best_score = float(score)

        if best_score is None:
            continue
        uid = str(u.get("id", "")).strip() or f"@{id(u)}"
        search_scores[uid] = best_score
        scored_pairs.append((u, m))
    return scored_pairs, search_scores


def _filter_pairs_by_location(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    region: str | None,
    country: str | None,
    city: str | None,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    reg = _safe_lower(region) if region else None
    cc = _safe_lower(country) if country else None
    cit = _safe_lower(city) if city else None
    return [
        (u, m)
        for u, m in pairs
        if (not reg or m.get("state", "") == reg)
        and (not cc or m.get("country", "") == cc)
        and (not cit or m.get("city", "") == cit)
    ]


def _filter_pairs_by_major(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    major: str,
    study_level: str | None,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    m_exact = _canonical_major(major)
    m_raw = _normalize_major_text(major)
    return [
        (u, meta_row)
        for (u, meta_row) in pairs
        if (
            (
                bool(admissions_catalog.matching_study_options(u["id"], major, study_level))
                if u.get("id") in admissions_catalog.INSTITUTION_IDS
                else (bool(m_exact) and any(x == m_exact for x in meta_row.get("major_exact", [])))
            )
            or (
                u.get("id") not in admissions_catalog.INSTITUTION_IDS
                and not m_exact
                and (
                    any(_normalize_major_text(x) == m_raw for x in meta_row.get("majors", []))
                    or any(_normalize_major_text(x) == m_raw for x in meta_row.get("program_names", []))
                )
            )
        )
    ]


def _filter_pairs_by_study_level(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    study_level: str,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    sl = _safe_lower(study_level)
    return [
        (u, meta_row)
        for (u, meta_row) in pairs
        if any(
            _safe_lower(x) == sl
            or (
                u.get("id") in admissions_catalog.INSTITUTION_IDS
                and admissions_catalog._normalized_level(sl) == _safe_lower(x)
            )
            or (sl in ("undergraduate", "bachelor") and _safe_lower(x) in ("undergraduate", "bachelor"))
            or (sl in ("masters", "master") and _safe_lower(x) in ("masters", "master"))
            or (sl in ("doctorate", "phd", "doctoral") and _safe_lower(x) in ("doctorate", "phd", "doctoral"))
            for x in meta_row.get("study_levels", [])
        )
    ]


def _filter_pairs_by_tuition(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    min_tuition: float | None,
    max_tuition: float | None,
    cost_basis: str,
    mode_pref: str,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    from app.services.currency import convert

    filtered: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for u, m in pairs:
        basis = cost_basis
        cost = _catalog_cost_range_usd(u, basis, mode_pref)
        # A reviewed card without a published total shows its tuition, so the filter reads the same price.
        if cost is None and basis == "annual_total" and u.get("id") in admissions_catalog.INSTITUTION_IDS:
            basis = "tuition"
            cost = _catalog_cost_range_usd(u, basis, mode_pref)
        if cost is None:
            continue
        quote = _catalog_costs(u, mode_pref).get(basis) or {}
        if quote.get("intervals") or quote.get("amounts"):
            try:
                ranges = quote.get("intervals") or [{"min": amount, "max": amount} for amount in quote["amounts"]]
                costs = [
                    (
                        convert(row["min"], quote["currency"], "USD"),
                        convert(row["max"], quote["currency"], "USD"),
                    )
                    for row in ranges
                ]
            except (KeyError, TypeError, ValueError):
                continue
            if not any(
                (min_tuition is None or high >= min_tuition)
                and (max_tuition is None or low <= max_tuition)
                for low, high in costs
            ):
                continue
            quote["filter_match"] = (
                "full"
                if all(
                    (min_tuition is None or low >= min_tuition)
                    and (max_tuition is None or high <= max_tuition)
                    for low, high in costs
                )
                else "partial"
            )
        else:
            if (min_tuition is not None and cost[1] < min_tuition) or (
                max_tuition is not None and cost[0] > max_tuition
            ):
                continue
            quote["filter_match"] = (
                "full"
                if (min_tuition is None or cost[0] >= min_tuition)
                and (max_tuition is None or cost[1] <= max_tuition)
                else "partial"
            )
        # Tuition alone cannot confirm that a full yearly budget fits the range.
        if basis != cost_basis or quote.get("priced_option_count", 0) < quote.get("candidate_option_count", 0):
            quote["filter_match"] = "partial"
        filtered.append((u, m))
    return filtered


def _filter_university_pairs(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
    region: str | None = None,
    country: str | None = None,
    city: str | None = None,
    major: str | None = None,
    study_level: str | None = None,
    format: str | None = None,
    funding_type: str | None = None,
    min_tuition: float | None = None,
    max_tuition: float | None = None,
    cost_basis: str = "annual_total",
    mode_pref: str = "any",
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    if region or country or city:
        pairs = _filter_pairs_by_location(pairs, region, country, city)

    if major:
        pairs = _filter_pairs_by_major(pairs, major, study_level)

    if study_level:
        pairs = _filter_pairs_by_study_level(pairs, study_level)

    # Reviewed institutions keep these facts in the admissions catalog, so an empty legacy value means
    # unknown, not "no": only a known mismatch excludes them, like the funding filter below.
    def reviewed_unknown(u: dict[str, Any], value: Any) -> bool:
        return value is None and u.get("id") in admissions_catalog.INSTITUTION_IDS

    if format:
        fm = _safe_lower(format)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if any(x == fm for x in meta_row.get("formats", []))
            or reviewed_unknown(u, meta_row.get("formats") or None)
        ]

    if funding_type:
        ft = _safe_lower(funding_type)
        # Only a known "no" excludes; unknown (None) funding availability stays visible.
        if ft == "grant":
            pairs = [(u, m) for (u, m) in pairs if m.get("has_grant", False) is not False]
        elif ft == "paid":
            pairs = [(u, m) for (u, m) in pairs if m.get("has_paid", False) is not False]

    if min_tuition is not None or max_tuition is not None:
        pairs = _filter_pairs_by_tuition(pairs, min_tuition, max_tuition, cost_basis, mode_pref)

    return pairs


def _sort_university_items(
    items: list[dict[str, Any]],
    q: str | None,
    sort: str,
    search_scores: dict[str, float],
    mode_pref: str,
    cost_basis: str = "annual_total",
) -> list[dict[str, Any]]:
    if q and sort in ("name_asc", "relevance"):
        return sorted(
            items,
            key=lambda u: (
                -(search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0)),
                _safe_lower(u.get("name")),
            ),
        )
    if q and search_scores:
        top_exact = [
            u
            for u in items
            if search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0) >= 200.0
        ]
        rest = [
            u
            for u in items
            if search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0) < 200.0
        ]
        top_exact = sorted(
            top_exact,
            key=lambda u: (
                -(search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0)),
                _safe_lower(u.get("name")),
            ),
        )
        return top_exact + _apply_sort(rest, sort, format_preference=mode_pref, cost_basis=cost_basis)
    return _apply_sort(items, sort, format_preference=mode_pref, cost_basis=cost_basis)


def list_universities(
    q: str | None = None,
    country: str | None = None,
    city: str | None = None,
    region: str | None = None,
    major: str | None = None,
    study_level: str | None = None,
    funding_type: str | None = None,
    format: str | None = None,
    min_tuition: float | None = None,
    max_tuition: float | None = None,
    cost_basis: str = "annual_total",
    fee_status_context: str | None = None,
    intended_entry_cycle: str | None = None,
    profile: dict[str, Any] | None = None,
    sort: str = "name_asc",
    page: int = 1,
    limit: int = 200,
    paginate: bool = True,
    response_mode: str = "full",
    search_lang: str | None = None,
    localize_output: bool = True,
) -> dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    mode_pref = _normalize_study_mode(format or "any")
    items, meta = get_universities_with_meta()
    pairs = list(zip(items, meta, strict=True))
    pairs = [
        (
            {
                **u,
                "catalog_costs": admissions_catalog.catalog_costs(
                    u["id"],
                    study_level,
                    mode_pref,
                    profile,
                    major=major,
                    fee_status_context=fee_status_context,
                    intended_entry_cycle=intended_entry_cycle,
                )
                if u.get("id") in admissions_catalog.INSTITUTION_IDS
                else _profiled_legacy_costs(u, mode_pref, profile),
            },
            m,
        )
        for u, m in pairs
    ]
    search_scores: dict[str, float] = {}

    if q:
        pairs, search_scores = _filter_by_search_query(pairs, q, lang)

    pairs = _filter_university_pairs(
        pairs,
        region=region,
        country=country,
        city=city,
        major=major,
        study_level=study_level,
        format=format,
        funding_type=funding_type,
        min_tuition=min_tuition,
        max_tuition=max_tuition,
        cost_basis=cost_basis,
        mode_pref=mode_pref,
    )

    items = [u for (u, _) in pairs]
    items = _sort_university_items(items, q, sort, search_scores, mode_pref, cost_basis)

    total = len(items)
    output_lang = lang if localize_output else SEARCH_LANG_ENG
    if not paginate:
        view_items = _project_universities(
            items,
            response_mode=response_mode,
            format_preference=mode_pref,
            search_lang=output_lang,
        )
        return {
            "items": view_items,
            "count": len(view_items),
            "total": total,
            "page": 1,
            "limit": total,
            "sort": sort,
        }

    start = (page - 1) * limit
    end = start + limit
    page_items = items[start:end] if start < total else []
    view_items = _project_universities(
        page_items,
        response_mode=response_mode,
        format_preference=mode_pref,
        search_lang=output_lang,
    )

    return {
        "items": view_items,
        "count": len(view_items),
        "total": total,
        "page": page,
        "limit": limit,
        "sort": sort,
    }
