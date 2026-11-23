"""University name variants, translations, search alias expansion, and payload localization."""

import copy
import json
import logging
import re
from collections.abc import Callable
from typing import Any

from app.core.files import file_mtime
from app.core.paths import UNIVERSITIES_TRANSLATIONS_PATH, UNIVERSITY_NAME_VARIANTS_PATH
from app.core.utils import (
    norm_space as _norm_space,
)
from app.core.utils import (
    normalize_search_lang as _normalize_search_lang,
)
from app.core.utils import (
    safe_lower as _safe_lower,
)
from app.services import search as search_service
from app.services.query_aliases import word_alias_candidates
from app.services.university_costs import student_size_band

SEARCH_LANG_ENG = "eng"
SEARCH_LANG_RUS = "rus"
SEARCH_LANG_KAZ = "kaz"

_LOGGER = logging.getLogger("unisearch.translations")

_NAME_VARIANTS_CACHE: dict[str, Any] = {"mtime": None, "data": {}}
_UNI_TRANSLATIONS_CACHE: dict[str, Any] = {"mtime": None, "data": {}}

_MAP_LABEL_FALLBACK_ORDER = {
    SEARCH_LANG_ENG: (SEARCH_LANG_ENG,),
    SEARCH_LANG_RUS: (SEARCH_LANG_RUS, SEARCH_LANG_ENG),
    SEARCH_LANG_KAZ: (SEARCH_LANG_KAZ, SEARCH_LANG_RUS, SEARCH_LANG_ENG),
}

_NAME_LANGS = (SEARCH_LANG_ENG, SEARCH_LANG_RUS, SEARCH_LANG_KAZ)


def _uniq_non_empty(items: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for it in items:
        s = str(it).strip()
        if not s:
            continue
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
    return out


def _load_university_name_variants() -> dict[str, dict[str, Any]]:
    """Per university id: eng/rus/kaz name lists and map labels (backend/data/university_name_variants.json)."""
    mtime = file_mtime(UNIVERSITY_NAME_VARIANTS_PATH)
    if mtime != _NAME_VARIANTS_CACHE.get("mtime") or mtime is None:
        data: dict[str, dict[str, Any]] = {}
        if mtime is None:
            _LOGGER.warning("University name variants file is missing: %s", UNIVERSITY_NAME_VARIANTS_PATH)
        else:
            try:
                with open(UNIVERSITY_NAME_VARIANTS_PATH, encoding="utf-8") as f:
                    loaded = json.load(f).get("universities")
                if isinstance(loaded, dict):
                    data = {str(key): value for key, value in loaded.items() if isinstance(value, dict)}
            except (OSError, ValueError, AttributeError):
                _LOGGER.warning(
                    "University name variants file is unreadable: %s",
                    UNIVERSITY_NAME_VARIANTS_PATH,
                    exc_info=True,
                )
        _NAME_VARIANTS_CACHE["mtime"] = mtime
        _NAME_VARIANTS_CACHE["data"] = data
    return _NAME_VARIANTS_CACHE["data"]


def _names_in_language(uid: str, lang: str) -> dict[str, Any]:
    """One university's names in one language.

    official: the full name; main_abbreviation: the one abbreviation the map shows ("" when there is none);
    short_name: what the map shows instead when there is no main abbreviation; abbreviations and
    alternatives: every other name, searched in every language.
    """
    names = _load_university_name_variants().get(uid, {}).get(lang)
    if not isinstance(names, dict):
        return {"official": "", "main_abbreviation": "", "short_name": "", "abbreviations": [], "alternatives": []}

    def clean(values: Any) -> list[str]:
        return [str(value).strip() for value in values or [] if str(value or "").strip()]

    return {
        "official": str(names.get("official") or "").strip(),
        "main_abbreviation": str(names.get("main_abbreviation") or "").strip(),
        "short_name": str(names.get("short_name") or "").strip(),
        "abbreviations": clean(names.get("abbreviations")),
        "alternatives": clean(names.get("alternatives")),
    }


def _map_label_for_university(uid: str, lang: str) -> str | None:
    """Marker text for the locale: the main abbreviation, else the short name.

    A language with nothing to show falls back to Russian for Kazakh and to English for Russian.
    """
    for key in _MAP_LABEL_FALLBACK_ORDER.get(lang, (SEARCH_LANG_ENG,)):
        names = _names_in_language(uid, key)
        label = names["main_abbreviation"] or names["short_name"]
        if label:
            return label
    return None


def _hidden_search_aliases_for_university(u: dict[str, Any]) -> list[str]:
    """Every name a university goes by in any language: official names, abbreviations and alternatives.

    Search matches all of them whatever the interface language is, so a Cyrillic abbreviation
    finds a university from the English interface and the other way round.
    """
    uid = str((u or {}).get("id") or "").strip()
    if not uid:
        return []
    values: list[Any] = []
    for lang in _NAME_LANGS:
        names = _names_in_language(uid, lang)
        values.extend([names["official"], *names["abbreviations"], *names["alternatives"]])
    return _uniq_non_empty(values)


def _abbreviations_for_university(u: dict[str, Any]) -> list[str]:
    """Abbreviations only, in every language (what the search box may show as a badge)."""
    uid = str((u or {}).get("id") or "").strip()
    if not uid:
        return []
    return _uniq_non_empty(
        [value for lang in _NAME_LANGS for value in _names_in_language(uid, lang)["abbreviations"]]
    )


def _full_name_from_variants(uid: str, lang: str, fallback: str) -> str:
    """The searchable official full name in a language, from the name variants file when the university has one."""
    return _names_in_language(uid, lang)["official"] or fallback


def _keyify(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _safe_lower(value)).strip("_")


def _load_university_translations_raw() -> dict[str, Any]:
    mtime = file_mtime(UNIVERSITIES_TRANSLATIONS_PATH)
    if mtime is None:
        _UNI_TRANSLATIONS_CACHE["mtime"] = None
        _UNI_TRANSLATIONS_CACHE["data"] = {}
        return {}

    if mtime != _UNI_TRANSLATIONS_CACHE.get("mtime"):
        try:
            with open(UNIVERSITIES_TRANSLATIONS_PATH, encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                data = {}
        except (OSError, json.JSONDecodeError, ValueError):
            data = {}
        _UNI_TRANSLATIONS_CACHE["mtime"] = mtime
        _UNI_TRANSLATIONS_CACHE["data"] = data

    cached = _UNI_TRANSLATIONS_CACHE.get("data")
    return cached if isinstance(cached, dict) else {}


def _translation_lang_pack(search_lang: Any) -> dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    data = _load_university_translations_raw()
    langs = data.get("languages") if isinstance(data.get("languages"), dict) else {}
    pack = langs.get(lang)
    return pack if isinstance(pack, dict) else {}


def _translation_group(search_lang: Any, group: str) -> dict[str, str]:
    pack = _translation_lang_pack(search_lang)
    groups = pack.get("groups") if isinstance(pack.get("groups"), dict) else {}
    group_map = groups.get(group)
    return group_map if isinstance(group_map, dict) else {}


def _replace_insensitive(text: str, search: str, replacement: str) -> str:
    src = str(search or "")
    if not src:
        return str(text or "")
    escaped = rf"(?<![A-Za-z]){re.escape(src)}(?![A-Za-z])"
    return re.sub(
        escaped, lambda _: str(replacement or ""), str(text or ""), flags=re.IGNORECASE
    )


def _translate_group_value(group: str, value: Any, search_lang: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    if _normalize_search_lang(search_lang) == SEARCH_LANG_ENG:
        return raw
    group_map = _translation_group(search_lang, group)
    return str(group_map.get(_keyify(raw), raw))


def _translate_program_name(value: Any, search_lang: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    if _normalize_search_lang(search_lang) == SEARCH_LANG_ENG:
        return raw
    pack = _translation_lang_pack(search_lang)
    table = (
        pack.get("program_names") if isinstance(pack.get("program_names"), dict) else {}
    )
    if _keyify(raw) in table:
        return str(table[_keyify(raw)])
    if raw in table:
        return str(table[raw])
    return raw


def _translate_admission_text(value: Any, search_lang: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    if _normalize_search_lang(search_lang) == SEARCH_LANG_ENG:
        return raw
    pack = _translation_lang_pack(search_lang)
    exact = (
        pack.get("admission_exact")
        if isinstance(pack.get("admission_exact"), dict)
        else {}
    )
    if raw in exact:
        return str(exact[raw])
    norm_quotes = re.sub(r"[\u2018\u2019`]", "'", raw)
    if norm_quotes in exact:
        return str(exact[norm_quotes])
    rules = (
        pack.get("admission_replace")
        if isinstance(pack.get("admission_replace"), list)
        else []
    )
    out = raw
    for rule in rules:
        if not isinstance(rule, (list, tuple)) or len(rule) < 2:
            continue
        out = _replace_insensitive(out, str(rule[0]), str(rule[1]))
    return out


def _translate_track_label(value: Any, search_lang: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    if _normalize_search_lang(search_lang) == SEARCH_LANG_ENG:
        return raw
    pack = _translation_lang_pack(search_lang)
    table = (
        pack.get("track_labels") if isinstance(pack.get("track_labels"), dict) else {}
    )
    direct = table.get(_keyify(raw))
    if direct:
        return str(direct)
    if raw in table:
        return str(table[raw])
    out = _translate_admission_text(raw, search_lang)
    fallback_rules = (
        pack.get("track_label_fallback_replace")
        if isinstance(pack.get("track_label_fallback_replace"), list)
        else []
    )
    for rule in fallback_rules:
        if not isinstance(rule, (list, tuple)) or len(rule) < 2:
            continue
        out = _replace_insensitive(out, str(rule[0]), str(rule[1]))
    return out


def _translate_university_name(
    university_id: Any, fallback: Any, search_lang: Any
) -> str:
    fallback_text = str(fallback or "").strip()
    uid = str(university_id or "").strip()
    if not uid:
        return fallback_text
    pack = _translation_lang_pack(search_lang)
    names = (
        pack.get("university_names")
        if isinstance(pack.get("university_names"), dict)
        else {}
    )
    translated = str(names.get(uid, "")).strip()
    return translated or fallback_text


def _translate_university_description(
    university: dict[str, Any], search_lang: Any
) -> str:
    u = university if isinstance(university, dict) else {}
    source = str(u.get("description") or "").strip()
    lang = _normalize_search_lang(search_lang)
    uid = str(u.get("id") or "").strip()
    pack = _translation_lang_pack(lang)

    if source:
        if lang == SEARCH_LANG_ENG:
            return source
        desc_map = (
            pack.get("university_descriptions")
            if isinstance(pack.get("university_descriptions"), dict)
            else {}
        )
        if uid:
            localized = str(desc_map.get(uid, "")).strip()
            if localized:
                return localized
        return source
    return ""


def _translate_maybe_list(value: Any, translator: Callable[[Any], str]) -> Any:
    if isinstance(value, list):
        return [translator(x) for x in value]
    if value is None:
        return value
    return translator(value)


def _localize_university_payload(
    university: dict[str, Any], search_lang: Any
) -> dict[str, Any]:
    if not isinstance(university, dict):
        return {}
    lang = _normalize_search_lang(search_lang)
    u = copy.deepcopy(university)
    academics = u.get("academics")
    programs = academics.get("programs") if isinstance(academics, dict) else None
    if isinstance(programs, list):
        for program in programs:
            if isinstance(program, dict) and str(program.get("name") or "").strip():
                program["source_name"] = str(program["name"]).strip()
    if lang == SEARCH_LANG_ENG:
        u["description"] = _translate_university_description(u, lang)
        return u

    uid = str(u.get("id") or "").strip()
    u["name"] = _translate_university_name(uid, u.get("name"), lang)
    u["description"] = _translate_university_description(u, lang)

    location = u.get("location")
    if isinstance(location, dict):
        location["country"] = _translate_group_value(
            "country", location.get("country"), lang
        )
        location["city"] = _translate_group_value("city", location.get("city"), lang)
        location["state"] = _translate_group_value("state", location.get("state"), lang)

    tags = u.get("tags")
    if isinstance(tags, list):
        u["tags"] = [_translate_group_value("tag", tag, lang) for tag in tags]

    student_life = u.get("student_life")
    if isinstance(student_life, dict):
        student_life["size"] = _translate_group_value(
            "campus_size", student_size_band(u) or student_life.get("size"), lang
        )

    academics = u.get("academics")
    if isinstance(academics, dict):
        if isinstance(academics.get("majors"), list):
            academics["majors"] = [
                _translate_program_name(x, lang) for x in academics.get("majors", [])
            ]
        if isinstance(academics.get("study_levels"), list):
            academics["study_levels"] = [
                _translate_group_value("study_level", x, lang)
                for x in academics.get("study_levels", [])
            ]
        if isinstance(academics.get("formats"), list):
            academics["formats"] = [
                _translate_group_value("study_mode", x, lang)
                for x in academics.get("formats", [])
            ]
        programs = academics.get("programs")
        if isinstance(programs, list):
            for p in programs:
                if not isinstance(p, dict):
                    continue
                p["name"] = _translate_program_name(p.get("name"), lang)
                p["study_levels"] = _translate_maybe_list(
                    p.get("study_levels"),
                    lambda x: _translate_group_value("study_level", x, lang),
                )
                p["study_mode"] = _translate_maybe_list(
                    p.get("study_mode"),
                    lambda x: _translate_group_value("study_mode", x, lang),
                )
                p["language"] = _translate_maybe_list(
                    p.get("language"),
                    lambda x: _translate_group_value("language", x, lang),
                )
                if isinstance(p.get("major_tags"), list):
                    p["major_tags"] = [
                        _translate_program_name(x, lang) for x in p.get("major_tags", [])
                    ]

    def localize_admission_payload(row: dict[str, Any]) -> None:
        if not isinstance(row, dict):
            return

        row["label"] = _translate_track_label(row.get("label") or row.get("name"), lang)
        row["track_badge"] = _translate_admission_text(row.get("track_badge"), lang)
        row["description"] = _translate_admission_text(row.get("description"), lang)
        row["funding_description"] = _translate_admission_text(row.get("funding_description"), lang)
        row["funding_program"] = _translate_admission_text(row.get("funding_program"), lang)
        row["funding_source"] = _translate_admission_text(row.get("funding_source"), lang)
        if isinstance(row.get("applicable_majors"), list):
            row["applicable_majors"] = [
                _translate_program_name(x, lang) for x in row.get("applicable_majors", [])
            ]
        if isinstance(row.get("study_mode"), (str, list)):
            row["study_mode"] = _translate_maybe_list(
                row.get("study_mode"),
                lambda x: _translate_group_value("study_mode", x, lang),
            )
        if isinstance(row.get("extra_requirements"), list):
            row["extra_requirements"] = [
                _translate_admission_text(x, lang) for x in row.get("extra_requirements", [])
            ]

        lang_reqs = row.get("language_requirements")
        if isinstance(lang_reqs, list):
            for lang_row in lang_reqs:
                if not isinstance(lang_row, dict):
                    continue
                lang_row["code"] = _translate_group_value("language", lang_row.get("code"), lang)

        scholarships = row.get("scholarships")
        if isinstance(scholarships, list):
            for scholarship in scholarships:
                if not isinstance(scholarship, dict):
                    continue
                scholarship["name"] = _translate_admission_text(
                    scholarship.get("name") or scholarship.get("label"), lang
                )

        funding_options = row.get("funding_options")
        if isinstance(funding_options, list):
            for option in funding_options:
                localize_admission_payload(option)

        requirement_profiles = row.get("requirement_profiles")
        if isinstance(requirement_profiles, list):
            for profile in requirement_profiles:
                localize_admission_payload(profile)

    categories = u.get("admission_categories")
    if isinstance(categories, list):
        for category in categories:
            localize_admission_payload(category)

    return u


_COUNTRY_LOCALIZED_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "usa": "США",
        "uk": "Великобритания",
        "switzerland": "Швейцария",
        "singapore": "Сингапур",
        "germany": "Германия",
        "canada": "Канада",
        "hong kong": "Гонконг",
        "japan": "Япония",
        "south korea": "Южная Корея",
        "netherlands": "Нидерланды",
        "china": "Китай",
        "kazakhstan": "Казахстан",
        "australia": "Австралия",
    },
}

_CITY_LOCALIZED_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "almaty": "Алматы",
        "astana": "Астана",
        "boston": "Бостон",
        "beijing": "Пекин",
        "cambridge": "Кембридж",
        "daejeon": "Тэджон",
        "delft": "Делфт",
        "kaskelen": "Каскелен",
        "kyoto": "Киото",
        "lausanne": "Лозанна",
        "london": "Лондон",
        "melbourne": "Мельбурн",
        "munich": "Мюнхен",
        "seoul": "Сеул",
        "sha tin": "Ша-Тин",
        "singapore": "Сингапур",
        "stanford": "Стэнфорд",
        "tokyo": "Токио",
        "toronto": "Торонто",
        "zurich": "Цюрих",
    },
}

_STATE_LOCALIZED_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "bavaria": "Бавария",
        "ca": "Калифорния",
        "ma": "Массачусетс",
        "massachusetts": "Массачусетс",
        "ontario": "Онтарио",
        "vaud": "Во",
        "victoria": "Виктория",
    },
}

_MAJOR_LOCALIZED_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "computer science": "компьютерные науки",
        "engineering": "инженерия",
        "business": "бизнес",
        "medicine": "медицина",
        "natural sciences": "естественные науки",
        "economics": "экономика",
        "physics": "физика",
        "mathematics": "математика",
        "law": "право",
        "social sciences": "социальные науки",
        "architecture": "архитектура",
        "psychology": "психология",
        "humanities": "гуманитарные науки",
        "design": "дизайн",
        "life sciences": "науки о жизни",
        "education": "образование",
        "agriculture": "сельское хозяйство",
        "dentistry": "стоматология",
        "artificial intelligence": "искусственный интеллект",
        "informatics": "информатика",
        "information security": "информационная безопасность",
        "information systems": "информационные системы",
        "petroleum engineering": "нефтегазовая инженерия",
        "oil and gas engineering": "нефтегазовая инженерия",
        "international relations": "международные отношения",
        "digital business": "цифровой бизнес",
        "management": "менеджмент",
        "international law": "международное право",
        "public health": "общественное здоровье",
        "pedagogy and psychology": "педагогика и психология",
    },
}

_MAJOR_QUERY_ALIASES_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_KAZ: {
        "компьютерлік ғылым": "computer science",
        "компьютерлік ғылымдар": "computer science",
    },
    SEARCH_LANG_RUS: {
        "компьютерные науки": "computer science",
        "информатика": "computer science",
        "компьютерная инженерия": "computer science",
        "искусственный интеллект": "computer science",
        "машинное обучение": "computer science",
        "кибербезопасность": "computer science",
        "робототехника": "computer science",
        "программная инженерия": "computer science",
        "наука о данных": "computer science",
        "информационные системы": "computer science",
        "инженерия": "engineering",
        "механическая инженерия": "engineering",
        "электротехника": "engineering",
        "аэрокосмическая инженерия": "engineering",
        "гражданское строительство": "engineering",
        "химическая инженерия": "engineering",
        "бизнес": "business",
        "менеджмент": "business",
        "финансы": "business",
        "маркетинг": "business",
        "медицина": "medicine",
        "биомедицина": "medicine",
        "медицинские науки": "medicine",
        "естественные науки": "natural sciences",
        "биология": "natural sciences",
        "химия": "natural sciences",
        "экономика": "economics",
        "физика": "physics",
        "математика": "mathematics",
        "право": "law",
        "социальные науки": "social sciences",
        "архитектура": "architecture",
        "психология": "psychology",
        "гуманитарные науки": "humanities",
        "дизайн": "design",
        "науки о жизни": "life sciences",
        "образование": "education",
        "сельское хозяйство": "agriculture",
    },
}

_TAG_LOCALIZED_BY_LANG: dict[str, dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "academic_mobility": "академическая мобильность",
        "aerospace": "аэрокосмос",
        "agriculture": "сельское хозяйство",
        "ai": "ии",
        "architecture": "архитектура",
        "bilingual": "двуязычное обучение",
        "biomedical": "биомедицина",
        "business": "бизнес",
        "clinical_training": "клиническая подготовка",
        "collegiate": "коллегиальная система",
        "comprehensive": "классический университет",
        "comprehensive_university": "классический университет",
        "computer_science": "компьютерные науки",
        "computing": "компьютерные науки",
        "cybersecurity": "кибербезопасность",
        "data_science": "наука о данных",
        "design": "дизайн",
        "digital_technology": "цифровые технологии",
        "economics": "экономика",
        "education": "образование",
        "engineering": "инженерия",
        "english_medium": "обучение на английском",
        "health_sciences": "науки о здоровье",
        "humanities": "гуманитарные науки",
        "ict": "икт",
        "industry_partnerships": "партнерства с индустрией",
        "innovation": "инновации",
        "interdisciplinary": "междисциплинарность",
        "international_partnerships": "международные партнерства",
        "international_relations": "международные отношения",
        "law": "право",
        "liberal_arts": "свободные искусства",
        "life_sciences": "науки о жизни",
        "medicine": "медицина",
        "mobility": "мобильность",
        "national_university": "национальный университет",
        "natural_resources": "природные ресурсы",
        "natural_sciences": "естественные науки",
        "pedagogy": "педагогика",
        "policy": "политика",
        "private_university": "частный университет",
        "public_health": "общественное здравоохранение",
        "public_policy": "государственная политика",
        "public_university": "государственный университет",
        "research": "исследования",
        "robotics": "робототехника",
        "science_and_technology": "наука и технологии",
        "semiconductors": "полупроводники",
        "social_sciences": "социальные науки",
        "software_engineering": "программная инженерия",
        "startups": "стартапы",
        "stem": "stem",
        "student_life": "студенческая жизнь",
        "sustainability": "устойчивое развитие",
        "technology": "технологии",
        "urban": "городская среда",
    },
}


def _load_localized_university_names(search_lang: str) -> dict[str, str]:
    lang = _normalize_search_lang(search_lang)
    if lang not in {SEARCH_LANG_RUS, SEARCH_LANG_KAZ}:
        return {}
    pack = _translation_lang_pack(lang)
    names = (
        pack.get("university_names")
        if isinstance(pack.get("university_names"), dict)
        else {}
    )
    out: dict[str, str] = {}
    for uni_id, uni_name in names.items():
        key = str(uni_id or "").strip()
        value = str(uni_name or "").strip()
        if key and value:
            out[key] = value
    return out


def _search_query_candidates(
    query: Any, search_lang: str = SEARCH_LANG_ENG, match_name_words: bool = False
) -> list[str]:
    raw = str(query or "").strip()
    if not raw:
        return []
    candidates = _uniq_non_empty([raw])

    lang = _normalize_search_lang(search_lang)
    flipped = search_service.flip_keyboard_layout(raw)
    if flipped and flipped.lower() != raw.lower():
        candidates.append(flipped)

    if lang == SEARCH_LANG_ENG:
        return _uniq_non_empty(candidates)

    norm_query = _norm_space(raw)
    alias_map: dict[str, str] = {}
    for source in (
        _COUNTRY_LOCALIZED_BY_LANG.get(lang, {}),
        _CITY_LOCALIZED_BY_LANG.get(lang, {}),
        _STATE_LOCALIZED_BY_LANG.get(lang, {}),
        _MAJOR_LOCALIZED_BY_LANG.get(lang, {}),
        _TAG_LOCALIZED_BY_LANG.get(lang, {}),
    ):
        for canonical, localized in source.items():
            lk = _norm_space(localized)
            ck = _norm_space(canonical)
            if lk and ck:
                alias_map[lk] = ck
    if lang == SEARCH_LANG_KAZ:
        pack = _translation_lang_pack(lang)
        groups = pack.get("groups") if isinstance(pack.get("groups"), dict) else {}
        for group_name in (
            "country",
            "city",
            "state",
            "tag",
            "study_level",
            "study_mode",
            "language",
        ):
            group_map = groups.get(group_name)
            if not isinstance(group_map, dict):
                continue
            for key, localized in group_map.items():
                lk = _norm_space(localized)
                ck = _norm_space(str(key).replace("_", " "))
                if lk and ck:
                    alias_map[lk] = ck
    pack = _translation_lang_pack(lang)
    program_names = pack.get("program_names") if isinstance(pack.get("program_names"), dict) else {}
    for key, localized in program_names.items():
        lk = _norm_space(localized)
        ck = _norm_space(str(key).replace("_", " "))
        if lk and ck:
            alias_map[lk] = ck
            if lk == norm_query:
                candidates.append(ck)
            elif norm_query.startswith(lk + " (") and norm_query.endswith(")"):
                candidates.append(ck + norm_query[len(lk):])
    for localized, canonical in (
        _MAJOR_QUERY_ALIASES_BY_LANG.get(lang, {}) or {}
    ).items():
        lk = _norm_space(localized)
        ck = _norm_space(canonical)
        if lk and ck:
            alias_map[lk] = ck

    full_alias = alias_map.get(norm_query)
    if full_alias:
        candidates.append(full_alias)
    elif match_name_words:
        # Program search only: one word of a translated program name finds that program.
        candidates.extend(word_alias_candidates(norm_query, alias_map))

    tokens = [part for part in norm_query.split(" ") if part]
    if tokens:
        mapped = [alias_map.get(tok, tok) for tok in tokens]
        candidate = " ".join(mapped).strip()
        if candidate:
            candidates.append(candidate)

    return _uniq_non_empty(candidates)
