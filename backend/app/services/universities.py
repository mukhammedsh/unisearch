import copy
import hashlib
import json
import re
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from app.core.files import file_mtime
from app.core.paths import DATA_PATH, CITIES_PATH, UNIVERSITIES_TRANSLATIONS_PATH
from app.core.utils import (
    to_float as _num_or_none,
    safe_lower as _safe_lower,
    norm_space as _norm_space,
    norm_tag_key as _norm_tag_key,
)
from app.services.finance_modes import (
    extract_tuition_cost as _extract_tuition_cost,
    mode_breakdown_from_finance as _mode_breakdown_from_finance,
    mode_total_from_finance as _mode_total_from_finance,
    normalize_study_mode as _normalize_study_mode,
)
from app.services import search as search_service


def _uniq_non_empty(items: List[Any]) -> List[str]:
    out: List[str] = []
    seen = set()
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


SEARCH_LANG_ENG = "eng"
SEARCH_LANG_RUS = "rus"
UNIVERSITY_DETAIL_REPR_VERSION = 4
COLLEGE_SCORECARD_PUBLIC_API_KEY = "DEMO_KEY"
COLLEGE_SCORECARD_HOST = "api.data.gov"
COLLEGE_SCORECARD_PATH_PREFIX = "/ed/collegescorecard/"

_HIDDEN_SEARCH_ALIASES_BY_UNIVERSITY_ID: Dict[str, List[str]] = {
    "mit-usa-cambridge": ["MIT", "МИТ"],
    "imperial-college-london-uk": ["Imperial", "ICL", "Империал", "ИКЛ"],
    "stanford-university-usa-ca": ["Stanford", "Стэнфорд", "Стенфорд"],
    "harvard-usa-cambridge": ["Harvard", "Гарвард"],
    "eth-zurich-ch-zurich": ["ETH", "ETH Zurich", "ЕТН", "ЕТХ", "ЕТН Цюрих"],
    "national-university-of-singapore-sg-singapore": ["NUS", "НУС"],
    "epfl-ch-lausanne": ["EPFL", "ЕПФЛ"],
    "technical-university-of-munich-de-munich": ["TUM", "ТУМ"],
    "university-of-toronto-ca-toronto": [
        "U of T",
        "UofT",
        "Toronto",
        "Торонто",
        "Ю оф Т",
    ],
    "cuhk-hk-shatin": ["CUHK", "КУХК"],
    "university-of-tokyo-jp-tokyo": ["UTokyo", "Todai", "Тодай", "УТокио"],
    "seoul-national-university-kr-seoul": ["SNU", "СНУ"],
    "delft-university-of-technology-nl-delft": [
        "TU Delft",
        "Delft Tech",
        "ТУ Делфт",
        "Делфт Тех",
    ],
    "kaist-kr-daejeon": ["KAIST", "КАИСТ", "КАЙСТ"],
    "tsinghua-university-cn-beijing": ["Tsinghua", "THU", "Цинхуа", "ТХУ"],
    "nazarbayev-university-kaz-astana": ["NU", "НУ"],
    "kyoto-university-jp-kyoto": ["KyotoU", "Kyodai", "Киото", "Кёто", "Кёодай"],
    "university-of-melbourne-au-melbourne": [
        "UniMelb",
        "Melbourne",
        "Мельбурн",
        "ЮниМелб",
    ],
    "suleyman-demirel-university-kaz-kaskelen": ["SDU", "СДУ"],
    "astana-it-university-kaz-astana": ["AITU", "АИТУ"],
    "astana-medical-university-kaz-astana": ["MUA", "AMU", "МУА"],
    "international-information-technology-university-kaz-almaty": ["IITU", "MUIT", "МУИТ"],
    "satbayev-university-kaz-almaty": ["Satbayev", "KazNRTU", "KazNTU", "КазНИТУ"],
    "kazakhstan-british-technical-university-kaz-almaty": ["KBTU", "КБТУ"],
    "al-farabi-kazakh-national-university-kaz-almaty": ["KazNU", "КазНУ"],
    "l-n-gumilyov-eurasian-national-university-kaz-astana": ["ENU", "ЕНУ"],
    "narxoz-university-kaz-almaty": ["Narxoz", "Нархоз"],
    "kimep-university-kaz-almaty": ["KIMEP", "КИМЭП"],
    "asfendiyarov-kazakh-national-medical-university-kaz-almaty": ["KazNMU", "КазНМУ"],
    "abai-kazakh-national-pedagogical-university-kaz-almaty": ["KazNPU", "КазНПУ"],
    "university-of-oxford-uk-oxford": ["Oxford", "Оксфорд"],
    "university-of-cambridge-uk-cambridge": ["Cambridge", "Кембридж"],
    "ucl-uk-london": ["UCL", "University College London", "ЮКЛ"],
    "kings-college-london-uk-london": ["KCL", "King's College London", "Кингс"],
    "university-of-edinburgh-uk-edinburgh": ["Edinburgh", "Эдинбург"],
    "university-of-manchester-uk-manchester": ["Manchester", "Манчестер"],
    "caltech-usa-pasadena": ["Caltech", "Калтех"],
    "uc-berkeley-usa-berkeley": ["Berkeley", "UC Berkeley", "Беркли"],
    "princeton-university-usa-princeton": ["Princeton", "Принстон"],
    "yale-university-usa-new-haven": ["Yale", "Йель"],
    "university-of-chicago-usa-chicago": ["UChicago", "Chicago", "Чикаго"],
    "university-of-pennsylvania-usa-philadelphia": ["Penn", "UPenn", "Пенн"],
    "cornell-university-usa-ithaca": ["Cornell", "Корнелл"],
    "columbia-university-usa-new-york": ["Columbia", "Колумбия"],
    "johns-hopkins-university-usa-baltimore": ["JHU", "Johns Hopkins", "Хопкинс"],
    "ucla-usa-los-angeles": ["UCLA", "ЮКЛА"],
    "mcgill-university-ca-montreal": ["McGill", "Макгилл"],
    "university-of-british-columbia-ca-vancouver": ["UBC", "British Columbia", "ЮБиСи"],
    "university-of-waterloo-ca-waterloo": ["Waterloo", "Ватерлоо"],
    "unsw-sydney-au-sydney": [
        "UNSW",
        "University of New South Wales",
        "New South Wales",
        "ЮНСВ",
    ],
    "university-of-sydney-au-sydney": ["USyd", "Sydney", "Сидней"],
    "australian-national-university-au-canberra": [
        "ANU",
        "Australian National University",
        "АНУ",
    ],
    "university-of-hong-kong-hk-hong-kong": ["HKU", "Hong Kong University", "ХКУ"],
    "hkust-hk-hong-kong": [
        "HKUST",
        "Hong Kong University of Science and Technology",
        "ХКУСТ",
    ],
    "nanyang-technological-university-sg-singapore": ["NTU", "Nanyang", "НТУ"],
}


def _normalize_search_lang(value: Any) -> str:
    raw = _safe_lower(value)
    if raw.startswith("ru") or raw == "rus":
        return SEARCH_LANG_RUS
    return SEARCH_LANG_ENG


def _hidden_search_aliases_for_university(u: Dict[str, Any]) -> List[str]:
    uid = str((u or {}).get("id") or "").strip()
    if not uid:
        return []
    return _uniq_non_empty(_HIDDEN_SEARCH_ALIASES_BY_UNIVERSITY_ID.get(uid, []))


_UNI_TRANSLATIONS_CACHE: Dict[str, Any] = {"mtime": None, "data": {}}


def _keyify(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _safe_lower(value)).strip("_")


def _load_university_translations_raw() -> Dict[str, Any]:
    mtime = file_mtime(UNIVERSITIES_TRANSLATIONS_PATH)
    if mtime is None:
        _UNI_TRANSLATIONS_CACHE["mtime"] = None
        _UNI_TRANSLATIONS_CACHE["data"] = {}
        return {}

    if mtime != _UNI_TRANSLATIONS_CACHE.get("mtime"):
        try:
            with open(UNIVERSITIES_TRANSLATIONS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        _UNI_TRANSLATIONS_CACHE["mtime"] = mtime
        _UNI_TRANSLATIONS_CACHE["data"] = data

    cached = _UNI_TRANSLATIONS_CACHE.get("data")
    return cached if isinstance(cached, dict) else {}


def _translation_lang_pack(search_lang: Any) -> Dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    data = _load_university_translations_raw()
    langs = data.get("languages") if isinstance(data.get("languages"), dict) else {}
    pack = langs.get(lang)
    return pack if isinstance(pack, dict) else {}


def _translation_group(search_lang: Any, group: str) -> Dict[str, str]:
    pack = _translation_lang_pack(search_lang)
    groups = pack.get("groups") if isinstance(pack.get("groups"), dict) else {}
    group_map = groups.get(group)
    return group_map if isinstance(group_map, dict) else {}


def _replace_insensitive(text: str, search: str, replacement: str) -> str:
    src = str(search or "")
    if not src:
        return str(text or "")
    escaped = re.escape(src)
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
    return str(table.get(_keyify(raw), raw))


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
    rules = (
        pack.get("admission_replace")
        if isinstance(pack.get("admission_replace"), list)
        else []
    )
    out = raw
    for rule in rules:
        if not (isinstance(rule, list) or isinstance(rule, tuple)) or len(rule) < 2:
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
    out = _translate_admission_text(raw, search_lang)
    fallback_rules = (
        pack.get("track_label_fallback_replace")
        if isinstance(pack.get("track_label_fallback_replace"), list)
        else []
    )
    for rule in fallback_rules:
        if not (isinstance(rule, list) or isinstance(rule, tuple)) or len(rule) < 2:
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
    university: Dict[str, Any], search_lang: Any
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


def _translate_maybe_list(value: Any, translator) -> Any:
    if isinstance(value, list):
        return [translator(x) for x in value]
    if value is None:
        return value
    return translator(value)


def _localize_university_payload(
    university: Dict[str, Any], search_lang: Any
) -> Dict[str, Any]:
    if not isinstance(university, dict):
        return {}
    lang = _normalize_search_lang(search_lang)
    if lang == SEARCH_LANG_ENG:
        u = copy.deepcopy(university)
        u["description"] = _translate_university_description(u, lang)
        return u

    u = copy.deepcopy(university)
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
            "campus_size", student_life.get("size"), lang
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

    def localize_admission_payload(row: Dict[str, Any]) -> None:
        if not isinstance(row, dict):
            return

        row["label"] = _translate_track_label(row.get("label"), lang)
        row["track_badge"] = _translate_admission_text(row.get("track_badge"), lang)
        row["description"] = _translate_admission_text(row.get("description"), lang)
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
                    scholarship.get("name"), lang
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


_COUNTRY_LOCALIZED_BY_LANG: Dict[str, Dict[str, str]] = {
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

_CITY_LOCALIZED_BY_LANG: Dict[str, Dict[str, str]] = {
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

_STATE_LOCALIZED_BY_LANG: Dict[str, Dict[str, str]] = {
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

_MAJOR_LOCALIZED_BY_LANG: Dict[str, Dict[str, str]] = {
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

_MAJOR_QUERY_ALIASES_BY_LANG: Dict[str, Dict[str, str]] = {
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

_TAG_LOCALIZED_BY_LANG: Dict[str, Dict[str, str]] = {
    SEARCH_LANG_RUS: {
        "research": "исследования",
        "stem": "stem",
        "ai": "ии",
        "robotics": "робототехника",
        "startups": "стартапы",
        "urban": "городская среда",
        "innovation": "инновации",
        "engineering": "инженерия",
        "computing": "компьютерные науки",
        "medicine": "медицина",
        "sustainability": "устойчивое развитие",
        "interdisciplinary": "междисциплинарность",
        "policy": "политика",
        "business": "бизнес",
        "data_science": "наука о данных",
        "life_sciences": "науки о жизни",
        "semiconductors": "полупроводники",
        "mobility": "мобильность",
        "aerospace": "аэрокосмос",
        "biomedical": "биомедицина",
        "cybersecurity": "кибербезопасность",
        "software_engineering": "программная инженерия",
        "ict": "икт",
        "academic_mobility": "академическая мобильность",
        "clinical_training": "клиническая подготовка",
        "comprehensive_university": "классический университет",
        "digital_technology": "цифровые технологии",
        "economics": "экономика",
        "industry_partnerships": "партнерства с индустрией",
        "international_partnerships": "международные партнерства",
        "international_relations": "международные отношения",
        "natural_resources": "природные ресурсы",
        "pedagogy": "педагогика",
        "public_health": "общественное здоровье",
        "student_life": "студенческая жизнь",
        "technology": "технологии",
    },
}


def _load_localized_university_names(search_lang: str) -> Dict[str, str]:
    lang = _normalize_search_lang(search_lang)
    if lang != SEARCH_LANG_RUS:
        return {}
    pack = _translation_lang_pack(lang)
    names = (
        pack.get("university_names")
        if isinstance(pack.get("university_names"), dict)
        else {}
    )
    out: Dict[str, str] = {}
    for uni_id, uni_name in names.items():
        key = str(uni_id or "").strip()
        value = str(uni_name or "").strip()
        if key and value:
            out[key] = value
    return out


def _search_query_candidates(
    query: Any, search_lang: str = SEARCH_LANG_ENG
) -> List[str]:
    raw = str(query or "").strip()
    if not raw:
        return []
    candidates = _uniq_non_empty([raw])

    lang = _normalize_search_lang(search_lang)
    if lang == SEARCH_LANG_ENG:
        return candidates

    norm_query = _norm_space(raw)
    alias_map: Dict[str, str] = {}
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

    tokens = [part for part in norm_query.split(" ") if part]
    if tokens:
        mapped = [alias_map.get(tok, tok) for tok in tokens]
        candidate = " ".join(mapped).strip()
        if candidate:
            candidates.append(candidate)

    return _uniq_non_empty(candidates)


def _get_nested(u: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    cur: Any = u
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def _get_list(u: Dict[str, Any], path: List[str]) -> List[str]:
    val = _get_nested(u, path, [])
    if isinstance(val, list):
        return val
    return []


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None


def _to_bool(x: Any) -> bool:
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return x != 0
    if isinstance(x, str):
        return x.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(x)


def _effective_university_cost(
    u: Dict[str, Any], format_preference: Any = "any"
) -> float:
    mode = _normalize_study_mode(format_preference)
    finance = u.get("finance") if isinstance(u.get("finance"), dict) else {}
    total = _to_float(finance.get("total_cost_year_usd")) or 0.0
    breakdown = finance.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    tuition = _extract_tuition_cost(breakdown)

    if mode == "online":
        mode_breakdown = _mode_breakdown_from_finance(finance, "online")
        mode_tuition = _extract_tuition_cost(
            mode_breakdown if isinstance(mode_breakdown, dict) else {}
        )
        if mode_tuition is not None and mode_tuition >= 0:
            return max(0.0, mode_tuition)
        if tuition is not None and tuition >= 0:
            return max(0.0, tuition)
        mode_total = _mode_total_from_finance(finance, "online")
        if mode_total is not None and mode_total >= 0:
            return max(0.0, mode_total)
        return 0.0

    return max(0.0, total)


from app.services.university_tracks import (
    _canonical_major,
    _derive_track_applicable_majors,
    _derive_track_score_profile,
    _filter_academics_for_product_scope,
    _iter_programs,
    _major_tags_from_text,
    _normalize_major_text,
    _should_keep_track_for_product_scope,
    expand_admission_choices,
)


def _normalize_university_schema(u: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adds backward-compatible academics fields for the new DB structure:
    - academics.programs[].name -> academics.majors
    - academics.programs[].study_levels -> academics.study_levels
    - academics.programs[].study_mode -> academics.formats
    - average(programs[].acceptance_rate_percent) -> academics.acceptance_rate_percent
    """
    if not isinstance(u, dict):
        return {}

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
        levels: List[Any] = []
        for p in programs:
            lv = p.get("study_levels")
            if isinstance(lv, list):
                levels.extend(lv)
            elif lv is not None:
                levels.append(lv)
        academics["study_levels"] = _uniq_non_empty(levels)

    formats = academics.get("formats")
    if not isinstance(formats, list) or len(formats) == 0:
        fmts: List[Any] = []
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
        kept_categories: List[Dict[str, Any]] = []
        for raw_category in categories:
            if not isinstance(raw_category, dict):
                continue

            category = copy.deepcopy(raw_category)
            derived_majors = _derive_track_applicable_majors(u, category)
            if derived_majors:
                category["applicable_majors"] = derived_majors

            raw_profiles = category.get("requirement_profiles")
            profiles = [row for row in raw_profiles if isinstance(row, dict)] if isinstance(raw_profiles, list) else []
            normalized_profiles: List[Dict[str, Any]] = []
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
                    exam_id = score_profile.get("exam_id")
                    median = score_profile.get("median_raw")
                    if exam_id and median is not None:
                        if "stats_avg" not in profile or not isinstance(profile["stats_avg"], dict):
                            profile["stats_avg"] = {}
                        if exam_id not in profile["stats_avg"]:
                            profile["stats_avg"][exam_id] = median
                if _should_keep_track_for_product_scope(u, profile):
                    normalized_profiles.append(profile)
            category["requirement_profiles"] = normalized_profiles

            if _should_keep_track_for_product_scope(u, category) and normalized_profiles:
                kept_categories.append(category)
        u["admission_categories"] = kept_categories

    _filter_academics_for_product_scope(academics)

    return u


def _build_university_meta(u: Dict[str, Any], rus_names: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    programs = _iter_programs(u)
    majors = _get_list(u, ["academics", "majors"])
    explicit_major_tags = _get_list(u, ["academics", "major_tags"])
    study_levels = _get_list(u, ["academics", "study_levels"])
    formats = _get_list(u, ["academics", "formats"])

    program_names = [p.get("name") for p in programs]
    program_major_tags: List[Any] = []
    program_levels: List[Any] = []
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
    name_raw = _safe_lower(u.get("name"))
    city_raw = _safe_lower(_get_nested(u, ["location", "city"]))
    country_raw = _safe_lower(_get_nested(u, ["location", "country"]))
    name_rus = _safe_lower(rus_names.get(uni_id, ""))
    city_rus = _safe_lower(_CITY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(city_key, ""))
    country_rus = _safe_lower(
        _COUNTRY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(country_key, "")
    )
    description_rus = _norm_space(
        f"{name_rus or name_raw} {city_rus or city_raw} {country_rus or country_raw} {' '.join(tags_rus)}"
    )

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
        "search_aliases": [_safe_lower(x) for x in hidden_search_aliases if x],
        "tags": [_safe_lower(x) for x in raw_tags if x],
        "tags_rus": [_safe_lower(x) for x in tags_rus if x],
        "size": _safe_lower(_get_nested(u, ["student_life", "size"])),
        "majors": [_safe_lower(x) for x in majors if x],
        "program_names": [_safe_lower(x) for x in program_names if x],
        "major_exact": [_safe_lower(x) for x in major_exact if x],
        "major_exact_rus": [_safe_lower(x) for x in major_exact_rus if x],
        "study_levels": [_safe_lower(x) for x in study_levels if x]
        + [_safe_lower(x) for x in program_levels if x],
        "formats": [_safe_lower(x) for x in formats if x]
        + [_safe_lower(x) for x in program_formats if x],
    }


def _meta_for_search_lang(meta_row: Dict[str, Any], search_lang: str) -> Dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    if lang != SEARCH_LANG_RUS:
        return meta_row

    out = dict(meta_row)

    def merged_text(*values: Any) -> str:
        vals = _uniq_non_empty(
            [str(v or "").strip() for v in values if str(v or "").strip()]
        )
        return " ".join(vals).strip()

    out["name"] = merged_text(meta_row.get("name"), meta_row.get("name_rus", ""))
    out["country"] = merged_text(
        meta_row.get("country"), meta_row.get("country_rus", "")
    )
    out["city"] = merged_text(meta_row.get("city"), meta_row.get("city_rus", ""))
    out["state"] = merged_text(meta_row.get("state"), meta_row.get("state_rus", ""))
    out["description"] = merged_text(
        meta_row.get("description"), meta_row.get("description_rus", "")
    )
    out["tags"] = _uniq_non_empty(
        list(meta_row.get("tags", []) or []) + list(meta_row.get("tags_rus", []) or [])
    )

    localized_major_exact = list(meta_row.get("major_exact_rus", []) or [])
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


def _get_university_acceptance_rate(u: Dict[str, Any]) -> Optional[float]:
    direct = _to_float(_get_nested(u, ["academics", "acceptance_rate_percent"]))
    if direct is not None:
        return direct
    vals = []
    for p in _iter_programs(u):
        v = _to_float(p.get("acceptance_rate_percent"))
        if v is not None:
            vals.append(v)
    if vals:
        return sum(vals) / len(vals)
    return None


def _has_any_aid(u: Dict[str, Any]) -> bool:
    finance = u.get("finance")
    if isinstance(finance, dict):
        aid = finance.get("financial_aid")
        if isinstance(aid, dict):
            if _to_bool(aid.get("merit_based")) or _to_bool(aid.get("need_based")):
                return True

    choices = expand_admission_choices(u.get("admission_categories"))
    if not choices:
        return False

    for choice in choices:
        if not isinstance(choice, dict):
            continue
        if _safe_lower(choice.get("funding_type")) == "grant":
            return True
        scholarships = choice.get("scholarships")
        if isinstance(scholarships, list) and len(scholarships) > 0:
            return True
    return False


def _rank_meta_from_university(u: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(u, dict):
        return {}
    prov = u.get("fact_provenance")
    if not isinstance(prov, dict):
        return {}
    facts = prov.get("facts")
    if not isinstance(facts, dict):
        return {}
    rank_fact = facts.get("rank")
    if not isinstance(rank_fact, dict):
        return {}

    out = {
        "source": str(rank_fact.get("source") or ""),
        "source_url": str(rank_fact.get("source_url") or ""),
        "external_reference": str(rank_fact.get("external_reference") or ""),
        "status": str(rank_fact.get("status") or ""),
        "verified_at": str(rank_fact.get("verified_at") or ""),
        "is_official_external_rank": bool(rank_fact.get("is_official_external_rank")),
    }
    if not any(
        bool(str(v).strip()) for k, v in out.items() if k != "is_official_external_rank"
    ):
        return {}
    return out


def to_university_card(
    u: Dict[str, Any],
    format_preference: Any = "any",
    search_lang: Optional[str] = None,
) -> Dict[str, Any]:
    if not isinstance(u, dict):
        return {}

    lang = _normalize_search_lang(search_lang)
    uid = str(u.get("id") or "").strip()
    location = u.get("location")
    location_obj = location if isinstance(location, dict) else {}
    finance = u.get("finance")
    finance_obj = finance if isinstance(finance, dict) else {}
    aid = finance_obj.get("financial_aid")
    aid_obj = aid if isinstance(aid, dict) else {}
    coordinates = u.get("coordinates")
    coordinates_obj = coordinates if isinstance(coordinates, dict) else {}

    name_value = str(u.get("name") or "")
    country_value = location_obj.get("country")
    city_value = location_obj.get("city")
    state_value = location_obj.get("state")
    if lang != SEARCH_LANG_ENG:
        name_value = _translate_university_name(uid, name_value, lang)
        country_value = _translate_group_value("country", country_value, lang)
        city_value = _translate_group_value("city", city_value, lang)
        state_value = _translate_group_value("state", state_value, lang)

    out: Dict[str, Any] = {
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
            "total_cost_year_usd": _effective_university_cost(
                u, format_preference=format_preference
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
        "aid_any": _has_any_aid(u),
    }
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


def _project_universities(
    items: List[Dict[str, Any]],
    response_mode: str,
    format_preference: Any = "any",
    search_lang: Optional[str] = None,
) -> List[Dict[str, Any]]:
    mode = _safe_lower(response_mode)
    if mode == "card":
        return [
            to_university_card(
                u, format_preference=format_preference, search_lang=search_lang
            )
            for u in items
        ]
    lang = _normalize_search_lang(search_lang)
    if lang == SEARCH_LANG_ENG:
        return items
    return [_localize_university_payload(u, search_lang=lang) for u in items]


def _safe_compare_lte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value <= threshold


def _safe_compare_gte(value: Optional[float], threshold: float) -> bool:
    if value is None:
        return False
    return value >= threshold


def _apply_sort(
    items: List[Dict[str, Any]], sort: str, format_preference: Any = "any"
) -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    def get_val(u, path):
        return _to_float(_get_nested(u, path)) or 0.0

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(
            items,
            key=lambda u: _effective_university_cost(
                u, format_preference=format_preference
            ),
        )
    if sort == "tuition_desc":
        return sorted(
            items,
            key=lambda u: _effective_university_cost(
                u, format_preference=format_preference
            ),
            reverse=True,
        )

    if sort == "acceptance_asc":
        return sorted(items, key=lambda u: (_get_university_acceptance_rate(u) or 0.0))
    if sort == "acceptance_desc":
        return sorted(
            items,
            key=lambda u: (_get_university_acceptance_rate(u) or 0.0),
            reverse=True,
        )

    if sort == "rank_asc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 999999.0))
    if sort == "rank_desc":
        return sorted(
            items, key=lambda u: (_to_float(u.get("rank")) or 0.0), reverse=True
        )

    if sort == "gpa_desc":
        return sorted(
            items, key=lambda u: get_val(u, ["exams_avg", "GPA"]), reverse=True
        )

    return sorted(items, key=lambda u: _safe_lower(u.get("name")))


_UNI_CACHE = {"mtime": None, "data": [], "by_id": {}, "meta": []}


def _load_universities_cached() -> List[Dict[str, Any]]:
    mtime = file_mtime(DATA_PATH)
    if mtime is None:
        _UNI_CACHE["mtime"] = None
        _UNI_CACHE["data"] = []
        _UNI_CACHE["by_id"] = {}
        _UNI_CACHE["meta"] = []
        return []

    if mtime != _UNI_CACHE["mtime"]:
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = []
            data = _sanitize_public_source_urls(data)
        except Exception:
            data = []

        out: List[Dict[str, Any]] = []
        meta_list: List[Dict[str, Any]] = []
        by_id: Dict[str, Dict[str, Any]] = {}
        rus_names = _load_localized_university_names(SEARCH_LANG_RUS)
        for row in data:
            if not isinstance(row, dict):
                continue
            norm = _normalize_university_schema(row)
            out.append(norm)
            meta_list.append(_build_university_meta(norm, rus_names=rus_names))
            uid = str(norm.get("id", "")).strip()
            if uid:
                by_id[uid] = norm

        _UNI_CACHE["mtime"] = mtime
        _UNI_CACHE["data"] = out
        _UNI_CACHE["by_id"] = by_id
        _UNI_CACHE["meta"] = meta_list

    return _UNI_CACHE["data"]


def load_universities() -> List[Dict[str, Any]]:
    return _load_universities_cached()


def get_universities_with_meta() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    _load_universities_cached()
    return _UNI_CACHE["data"], _UNI_CACHE["meta"]


def get_university_by_id(
    university_id: str,
    search_lang: Optional[str] = None,
    localized: bool = False,
) -> Optional[Dict[str, Any]]:
    _load_universities_cached()
    item = _UNI_CACHE["by_id"].get(str(university_id))
    if item is None:
        return None
    if not localized:
        return item
    return _localize_university_payload(item, search_lang)


def get_university_etag(university_id: str, search_lang: Optional[str] = None) -> str:
    _load_universities_cached()
    mtime = _UNI_CACHE.get("mtime")
    mtime_key = "none" if mtime is None else str(mtime)
    uid = str(university_id or "").strip()
    lang = _normalize_search_lang(search_lang)
    tr_mtime = file_mtime(UNIVERSITIES_TRANSLATIONS_PATH)
    tr_key = "none" if tr_mtime is None else str(tr_mtime)
    # Include the derived detail representation version so cache invalidation
    # also happens when backend normalization changes without a data-file mtime bump.
    digest = hashlib.sha256(
        f"{mtime_key}:{tr_key}:{uid}:{lang}:{UNIVERSITY_DETAIL_REPR_VERSION}".encode(
            "utf-8"
        )
    ).hexdigest()
    return f'"{digest}"'


def get_university_translation_bundle(
    search_lang: Optional[str] = None,
) -> Dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    raw = _load_university_translations_raw()
    langs = raw.get("languages") if isinstance(raw.get("languages"), dict) else {}
    pack = langs.get(lang) if isinstance(langs.get(lang), dict) else {}
    return {
        "lang": lang,
        "schema_version": raw.get("schema_version", 1),
        "data": pack if isinstance(pack, dict) else {},
    }


_LOC_CACHE = {"mtime": None, "data": {}}


def get_locations() -> Dict[str, Any]:
    mtime = file_mtime(CITIES_PATH)
    if mtime is None:
        _LOC_CACHE["mtime"] = None
        _LOC_CACHE["data"] = {}
        return {}
    if mtime != _LOC_CACHE["mtime"]:
        try:
            with open(CITIES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            _LOC_CACHE["data"] = data if isinstance(data, dict) else {}
        except Exception:
            _LOC_CACHE["data"] = {}
        _LOC_CACHE["mtime"] = mtime
    return _LOC_CACHE["data"]


def get_stats() -> Dict[str, Any]:
    universities = load_universities()
    locations = get_locations()
    return {
        "universities_total": len(universities),
        "countries_total": len(locations.keys()) if isinstance(locations, dict) else 0,
    }


def list_universities(
    q: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    major: Optional[str] = None,
    study_level: Optional[str] = None,
    funding_type: Optional[str] = None,
    format: Optional[str] = None,
    user_budget: Optional[float] = None,
    min_tuition: Optional[float] = None,
    max_tuition: Optional[float] = None,
    min_acceptance: Optional[float] = None,
    max_acceptance: Optional[float] = None,
    size: Optional[str] = None,
    sort: str = "name_asc",
    page: int = 1,
    limit: int = 200,
    paginate: bool = True,
    response_mode: str = "full",
    search_lang: Optional[str] = None,
    localize_output: bool = True,
) -> Dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    mode_pref = _normalize_study_mode(format or "any")
    items, meta = get_universities_with_meta()
    pairs = list(zip(items, meta))
    search_scores: Dict[str, float] = {}

    if q:
        query_candidates = _search_query_candidates(q, search_lang=lang)
        prepared_queries = []
        for q_val in query_candidates:
            pq = search_service.prepare_query(q_val)
            if pq:
                prepared_queries.append(pq)

        scored_pairs = []
        for u, m in pairs:
            meta_search = _meta_for_search_lang(m, lang)
            pm = search_service.prepare_search_meta(meta_search)
            if not pm:
                continue

            best_score: Optional[float] = None
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
        pairs = scored_pairs

    if region or country or city:
        reg = _safe_lower(region) if region else None
        cc = _safe_lower(country) if country else None
        cit = _safe_lower(city) if city else None

        if reg and cc and cit:
            pairs = [
                (u, m)
                for u, m in pairs
                if m.get("state", "") == reg
                and m.get("country", "") == cc
                and m.get("city", "") == cit
            ]
        elif reg and cc:
            pairs = [
                (u, m)
                for u, m in pairs
                if m.get("state", "") == reg and m.get("country", "") == cc
            ]
        elif reg and cit:
            pairs = [
                (u, m)
                for u, m in pairs
                if m.get("state", "") == reg and m.get("city", "") == cit
            ]
        elif cc and cit:
            pairs = [
                (u, m)
                for u, m in pairs
                if m.get("country", "") == cc and m.get("city", "") == cit
            ]
        elif reg:
            pairs = [(u, m) for u, m in pairs if m.get("state", "") == reg]
        elif cc:
            pairs = [(u, m) for u, m in pairs if m.get("country", "") == cc]
        elif cit:
            pairs = [(u, m) for u, m in pairs if m.get("city", "") == cit]

    if major:
        m_exact = _canonical_major(major)
        m_raw = _normalize_major_text(major)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if (
                (
                    bool(m_exact)
                    and any(x == m_exact for x in meta_row.get("major_exact", []))
                )
                or (
                    not m_exact
                    and (
                        any(
                            _normalize_major_text(x) == m_raw
                            for x in meta_row.get("majors", [])
                        )
                        or any(
                            _normalize_major_text(x) == m_raw
                            for x in meta_row.get("program_names", [])
                        )
                    )
                )
            )
        ]

    if study_level:
        sl = _safe_lower(study_level)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if any(x == sl for x in meta_row.get("study_levels", []))
        ]

    if format:
        fm = _safe_lower(format)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if any(x == fm for x in meta_row.get("formats", []))
        ]

    if funding_type:
        ft = _safe_lower(funding_type)
        if ft in {"grant", "paid"}:
            pairs = [
                (u, m)
                for (u, m) in pairs
                if any(
                    _safe_lower(choice.get("funding_type")) == ft
                    for choice in expand_admission_choices(u.get("admission_categories"))
                    if isinstance(choice, dict)
                )
            ]

    if user_budget is not None:
        filtered = []
        for u, m in pairs:
            cost = (
                _effective_university_cost(u, format_preference=mode_pref) or 999999.0
            )
            fa = _get_nested(u, ["finance", "financial_aid"], {})
            aid = fa.get("merit_based") or fa.get("need_based")
            if cost <= user_budget or aid:
                filtered.append((u, m))
        pairs = filtered

    if min_tuition is not None or max_tuition is not None:
        filtered = []
        for u, m in pairs:
            cost = _effective_university_cost(u, format_preference=mode_pref)
            if min_tuition is not None and not _safe_compare_gte(cost, min_tuition):
                continue
            if max_tuition is not None and not _safe_compare_lte(cost, max_tuition):
                continue
            filtered.append((u, m))
        pairs = filtered

    if min_acceptance is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_gte(_get_university_acceptance_rate(u), min_acceptance)
        ]
    if max_acceptance is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_lte(_get_university_acceptance_rate(u), max_acceptance)
        ]

    if size:
        ss = _safe_lower(size)
        pairs = [(u, m) for (u, m) in pairs if m.get("size", "") == ss]

    items = [u for (u, _) in pairs]
    if q and sort == "name_asc":
        items = sorted(
            items,
            key=lambda u: (
                -(search_scores.get(str(u.get("id", "")).strip() or f"@{id(u)}", 0.0)),
                _safe_lower(u.get("name")),
            ),
        )
    else:
        items = _apply_sort(items, sort, format_preference=mode_pref)

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
