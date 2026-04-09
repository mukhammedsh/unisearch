import copy
import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.files import file_mtime
from app.core.paths import DATA_PATH, CITIES_PATH, UNIVERSITIES_TRANSLATIONS_PATH
from app.services import exams as exams_service
from app.services import search as search_service


def _num_or_none(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (ValueError, TypeError):
        return None


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


def _safe_lower(x: Any) -> str:
    if x is None:
        return ""
    return str(x).strip().lower()


def _norm_space(value: Any) -> str:
    return re.sub(r"\s+", " ", _safe_lower(value)).strip()


def _norm_tag_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _safe_lower(value)).strip("_")


SEARCH_LANG_ENG = "eng"
SEARCH_LANG_RUS = "rus"
UNIVERSITY_DETAIL_REPR_VERSION = 4

_HIDDEN_SEARCH_ALIASES_BY_UNIVERSITY_ID: Dict[str, List[str]] = {
    "mit-usa-cambridge": ["MIT", "МИТ"],
    "imperial-college-london-uk": ["Imperial", "ICL", "Империал", "ИКЛ"],
    "stanford-university-usa-ca": ["Stanford", "Стэнфорд", "Стенфорд"],
    "harvard-usa-cambridge": ["Harvard", "Гарвард"],
    "eth-zurich-ch-zurich": ["ETH", "ETH Zurich", "ЕТН", "ЕТХ", "ЕТН Цюрих"],
    "national-university-of-singapore-sg-singapore": ["NUS", "НУС"],
    "epfl-ch-lausanne": ["EPFL", "ЕПФЛ"],
    "technical-university-of-munich-de-munich": ["TUM", "ТУМ"],
    "university-of-toronto-ca-toronto": ["U of T", "UofT", "Toronto", "Торонто", "Ю оф Т"],
    "cuhk-hk-shatin": ["CUHK", "КУХК"],
    "university-of-tokyo-jp-tokyo": ["UTokyo", "Todai", "Тодай", "УТокио"],
    "seoul-national-university-kr-seoul": ["SNU", "СНУ"],
    "delft-university-of-technology-nl-delft": ["TU Delft", "Delft Tech", "ТУ Делфт", "Делфт Тех"],
    "kaist-kr-daejeon": ["KAIST", "КАИСТ", "КАЙСТ"],
    "tsinghua-university-cn-beijing": ["Tsinghua", "THU", "Цинхуа", "ТХУ"],
    "nazarbayev-university-kaz-astana": ["NU", "НУ"],
    "kyoto-university-jp-kyoto": ["KyotoU", "Kyodai", "Киото", "Кёто", "Кёодай"],
    "university-of-melbourne-au-melbourne": ["UniMelb", "Melbourne", "Мельбурн", "ЮниМелб"],
    "suleyman-demirel-university-kaz-kaskelen": ["SDU", "СДУ"],
    "astana-it-university-kaz-astana": ["AITU", "АИТУ"],
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
    "unsw-sydney-au-sydney": ["UNSW", "University of New South Wales", "New South Wales", "ЮНСВ"],
    "university-of-sydney-au-sydney": ["USyd", "Sydney", "Сидней"],
    "australian-national-university-au-canberra": ["ANU", "Australian National University", "АНУ"],
    "university-of-hong-kong-hk-hong-kong": ["HKU", "Hong Kong University", "ХКУ"],
    "hkust-hk-hong-kong": ["HKUST", "Hong Kong University of Science and Technology", "ХКУСТ"],
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
    return re.sub(escaped, lambda _: str(replacement or ""), str(text or ""), flags=re.IGNORECASE)


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
    table = pack.get("program_names") if isinstance(pack.get("program_names"), dict) else {}
    return str(table.get(_keyify(raw), raw))


def _translate_admission_text(value: Any, search_lang: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return raw
    if _normalize_search_lang(search_lang) == SEARCH_LANG_ENG:
        return raw
    pack = _translation_lang_pack(search_lang)
    exact = pack.get("admission_exact") if isinstance(pack.get("admission_exact"), dict) else {}
    if raw in exact:
        return str(exact[raw])
    rules = pack.get("admission_replace") if isinstance(pack.get("admission_replace"), list) else []
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
    table = pack.get("track_labels") if isinstance(pack.get("track_labels"), dict) else {}
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


def _translate_university_name(university_id: Any, fallback: Any, search_lang: Any) -> str:
    fallback_text = str(fallback or "").strip()
    uid = str(university_id or "").strip()
    if not uid:
        return fallback_text
    pack = _translation_lang_pack(search_lang)
    names = pack.get("university_names") if isinstance(pack.get("university_names"), dict) else {}
    translated = str(names.get(uid, "")).strip()
    return translated or fallback_text


def _translate_university_description(university: Dict[str, Any], search_lang: Any) -> str:
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


def _localize_university_payload(university: Dict[str, Any], search_lang: Any) -> Dict[str, Any]:
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
        location["country"] = _translate_group_value("country", location.get("country"), lang)
        location["city"] = _translate_group_value("city", location.get("city"), lang)
        location["state"] = _translate_group_value("state", location.get("state"), lang)

    tags = u.get("tags")
    if isinstance(tags, list):
        u["tags"] = [_translate_group_value("tag", tag, lang) for tag in tags]

    student_life = u.get("student_life")
    if isinstance(student_life, dict):
        student_life["size"] = _translate_group_value("campus_size", student_life.get("size"), lang)

    academics = u.get("academics")
    if isinstance(academics, dict):
        if isinstance(academics.get("majors"), list):
            academics["majors"] = [_translate_program_name(x, lang) for x in academics.get("majors", [])]
        if isinstance(academics.get("study_levels"), list):
            academics["study_levels"] = [
                _translate_group_value("study_level", x, lang) for x in academics.get("study_levels", [])
            ]
        if isinstance(academics.get("formats"), list):
            academics["formats"] = [
                _translate_group_value("study_mode", x, lang) for x in academics.get("formats", [])
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

    def localize_track_payload(track: Dict[str, Any]) -> None:
        if not isinstance(track, dict):
            return

        track["label"] = _translate_track_label(track.get("label"), lang)
        track["track_badge"] = _translate_admission_text(track.get("track_badge"), lang)
        track["description"] = _translate_admission_text(track.get("description"), lang)
        track["funding_program"] = _translate_admission_text(track.get("funding_program"), lang)
        track["funding_source"] = _translate_admission_text(track.get("funding_source"), lang)
        if isinstance(track.get("applicable_majors"), list):
            track["applicable_majors"] = [
                _translate_program_name(x, lang) for x in track.get("applicable_majors", [])
            ]
        if isinstance(track.get("study_mode"), (str, list)):
            track["study_mode"] = _translate_maybe_list(
                track.get("study_mode"),
                lambda x: _translate_group_value("study_mode", x, lang),
            )
        if isinstance(track.get("extra_requirements"), list):
            track["extra_requirements"] = [
                _translate_admission_text(x, lang) for x in track.get("extra_requirements", [])
            ]

        lang_reqs = track.get("language_requirements")
        if isinstance(lang_reqs, list):
            for row in lang_reqs:
                if not isinstance(row, dict):
                    continue
                row["code"] = _translate_group_value("language", row.get("code"), lang)

        scholarships = track.get("scholarships")
        if isinstance(scholarships, list):
            for scholarship in scholarships:
                if not isinstance(scholarship, dict):
                    continue
                scholarship["name"] = _translate_admission_text(scholarship.get("name"), lang)

        funding_options = track.get("funding_options")
        if isinstance(funding_options, list):
            for option in funding_options:
                localize_track_payload(option)

    tracks = u.get("admission_tracks")
    if isinstance(tracks, list):
        for track in tracks:
            localize_track_payload(track)

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
    },
}

def _load_localized_university_names(search_lang: str) -> Dict[str, str]:
    lang = _normalize_search_lang(search_lang)
    if lang != SEARCH_LANG_RUS:
        return {}
    pack = _translation_lang_pack(lang)
    names = pack.get("university_names") if isinstance(pack.get("university_names"), dict) else {}
    out: Dict[str, str] = {}
    for uni_id, uni_name in names.items():
        key = str(uni_id or "").strip()
        value = str(uni_name or "").strip()
        if key and value:
            out[key] = value
    return out


def _search_query_candidates(query: Any, search_lang: str = SEARCH_LANG_ENG) -> List[str]:
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
    for localized, canonical in (_MAJOR_QUERY_ALIASES_BY_LANG.get(lang, {}) or {}).items():
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


def _normalize_study_mode(value: Any) -> str:
    raw = _safe_lower(value)
    if not raw or raw == "any":
        return "any"
    if raw in {"on-campus", "on campus", "campus", "offline", "in-person", "hybrid", "blended", "mixed"}:
        return "on-campus"
    if raw in {"online", "distance", "remote", "online / distance"}:
        return "online"
    return "any"


def _normalize_cost_key(key: Any) -> str:
    return re.sub(r"[^a-z]", "", str(key or "").strip().lower())


def _mode_value_from_map(mode_map: Any, mode: str) -> Any:
    if not isinstance(mode_map, dict):
        return None
    target = _normalize_study_mode(mode)
    for key, value in mode_map.items():
        if _normalize_study_mode(key) == target:
            return value
    return None


def _mode_breakdown_from_finance(finance: Dict[str, Any], mode: str) -> Optional[Dict[str, Any]]:
    if not isinstance(finance, dict):
        return None
    for key in ("costs_breakdown_year_usd_by_mode", "costs_breakdown_by_mode_year_usd", "mode_costs_breakdown_year_usd"):
        val = _mode_value_from_map(finance.get(key), mode)
        if isinstance(val, dict):
            return val
    return None


def _mode_total_from_finance(finance: Dict[str, Any], mode: str) -> Optional[float]:
    if not isinstance(finance, dict):
        return None
    for key in ("total_cost_year_usd_by_mode", "total_cost_by_mode_year_usd", "mode_total_cost_year_usd"):
        val = _mode_value_from_map(finance.get(key), mode)
        amount = _to_float(val)
        if amount is not None and amount >= 0:
            return float(amount)
    return None


def _extract_tuition_cost(breakdown: Dict[str, Any]) -> Optional[float]:
    if not isinstance(breakdown, dict):
        return None
    for key, value in breakdown.items():
        if "tuition" in _normalize_cost_key(key):
            amount = _to_float(value)
            if amount is not None and amount >= 0:
                return amount
    return None


def _effective_university_cost(u: Dict[str, Any], format_preference: Any = "any") -> float:
    mode = _normalize_study_mode(format_preference)
    finance = u.get("finance") if isinstance(u.get("finance"), dict) else {}
    total = _to_float(finance.get("total_cost_year_usd")) or 0.0
    breakdown = finance.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    tuition = _extract_tuition_cost(breakdown)

    if mode == "online":
        mode_breakdown = _mode_breakdown_from_finance(finance, "online")
        mode_tuition = _extract_tuition_cost(mode_breakdown if isinstance(mode_breakdown, dict) else {})
        if mode_tuition is not None and mode_tuition >= 0:
            return max(0.0, mode_tuition)
        if tuition is not None and tuition >= 0:
            return max(0.0, tuition)
        mode_total = _mode_total_from_finance(finance, "online")
        if mode_total is not None and mode_total >= 0:
            return max(0.0, mode_total)
        return 0.0

    return max(0.0, total)


_CANONICAL_MAJORS = [
    "computer science",
    "engineering",
    "business",
    "medicine",
    "natural sciences",
    "economics",
    "physics",
    "mathematics",
    "law",
    "social sciences",
    "architecture",
    "psychology",
    "humanities",
    "design",
    "life sciences",
    "education",
    "agriculture",
]

_MAJOR_PHRASES: Dict[str, List[str]] = {
    "computer science": [
        "computer science",
        "computing",
        "informatics",
        "software engineering",
        "information systems",
        "computer engineering",
        "computer science and engineering",
        "computer science and technology",
        "cs",
        "eecs",
    ],
    "engineering": [
        "engineering",
        "aerospace",
        "mechanical",
        "electrical",
        "civil",
        "chemical",
        "industrial",
        "mechatronics",
        "robotics",
    ],
    "business": ["business", "management", "finance", "marketing", "accounting", "mba"],
    "medicine": ["medicine", "medical", "clinical", "nursing", "pharmacy", "dentistry"],
    "natural sciences": ["natural sciences", "natural science", "chemistry", "earth science", "environmental science"],
    "economics": ["economics", "economy", "econometrics"],
    "physics": ["physics", "astrophysics"],
    "mathematics": ["mathematics", "math", "statistics", "actuarial"],
    "law": ["law", "legal", "jurisprudence", "llb", "jd"],
    "social sciences": ["social sciences", "social science", "sociology", "political science", "anthropology"],
    "architecture": ["architecture", "urban planning", "built environment"],
    "psychology": ["psychology", "psychological"],
    "humanities": ["humanities", "history", "philosophy", "linguistics", "literature", "classics"],
    "design": ["design", "graphic design", "industrial design", "interaction design", "ux", "ui", "product design"],
    "life sciences": ["life sciences", "life science", "biology", "biotechnology", "biomedical", "genetics", "neuroscience"],
    "education": ["education", "teaching", "pedagogy", "curriculum", "teacher"],
    "agriculture": ["agriculture", "agricultural", "agronomy", "horticulture"],
}


def _normalize_major_text(value: Any) -> str:
    text = _safe_lower(value).replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _contains_phrase(text: str, phrase: str) -> bool:
    if not text or not phrase:
        return False
    pattern = r"\b" + re.escape(phrase).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, text) is not None


def _major_tags_from_text(value: Any) -> List[str]:
    text = _normalize_major_text(value)
    if not text:
        return []
    out: List[str] = []
    for canonical in _CANONICAL_MAJORS:
        phrases = _MAJOR_PHRASES.get(canonical, [canonical])
        if any(_contains_phrase(text, _normalize_major_text(p)) for p in phrases):
            out.append(canonical)
    return out


def _canonical_major(value: Any) -> str:
    text = _normalize_major_text(value)
    if not text:
        return ""
    if text in _CANONICAL_MAJORS:
        return text
    tags = _major_tags_from_text(text)
    if len(tags) == 1:
        return tags[0]
    return ""


def _iter_programs(u: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = _get_nested(u, ["academics", "programs"], [])
    if not isinstance(raw, list):
        return []
    return [p for p in raw if isinstance(p, dict)]


def _track_program_names(u: Dict[str, Any]) -> List[str]:
    academics = u.get("academics")
    academics_obj = academics if isinstance(academics, dict) else {}
    names = [p.get("name") for p in _iter_programs(u)]
    majors = academics_obj.get("majors")
    if isinstance(majors, list):
        names.extend(majors)
    return _uniq_non_empty(names)


def _is_foundation_program_name(value: Any) -> bool:
    text = _normalize_major_text(value)
    return bool(text) and (
        _contains_phrase(text, "foundation")
        or _contains_phrase(text, "nufyp")
        or _contains_phrase(text, "preparatory")
    )


def _track_targets_foundation(blob: str) -> bool:
    return bool(blob) and any(
        token in blob for token in ("foundation", "nufyp", "preparatory")
    )


def _track_targets_undergraduate(blob: str) -> bool:
    return bool(blob) and any(
        token in blob
        for token in (
            "undergraduate",
            "direct admission",
            "sat",
            "act",
            "olympiad",
            "transfer",
            "mid year",
            "mid-year",
            "bachelor",
        )
    )


def _merge_track_variant_dict(base_value: Any, variant_value: Any) -> Any:
    if isinstance(base_value, dict) and isinstance(variant_value, dict):
        out = copy.deepcopy(base_value)
        out.update(copy.deepcopy(variant_value))
        return out
    if variant_value is not None:
        return copy.deepcopy(variant_value)
    return copy.deepcopy(base_value)


def _expand_track_funding_options(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not isinstance(track, dict):
        return []

    raw_options = track.get("funding_options")
    options = [row for row in raw_options if isinstance(row, dict)] if isinstance(raw_options, list) else []
    if not options:
        return [copy.deepcopy(track)]

    base_track = copy.deepcopy(track)
    base_track.pop("funding_options", None)
    expanded: List[Dict[str, Any]] = []

    for option in options:
        variant = copy.deepcopy(base_track)
        option_copy = copy.deepcopy(option)
        option_copy.pop("funding_options", None)

        merged_requirements = _merge_track_variant_dict(
            base_track.get("requirements"),
            option_copy.pop("requirements", None),
        )
        if isinstance(merged_requirements, dict) and merged_requirements:
            variant["requirements"] = merged_requirements
        else:
            variant.pop("requirements", None)

        merged_stats_avg = _merge_track_variant_dict(
            base_track.get("stats_avg"),
            option_copy.pop("stats_avg", None),
        )
        if isinstance(merged_stats_avg, dict) and merged_stats_avg:
            variant["stats_avg"] = merged_stats_avg
        elif "stats_avg" in variant and not isinstance(variant.get("stats_avg"), dict):
            variant.pop("stats_avg", None)

        merged_finance_override = _merge_track_variant_dict(
            base_track.get("finance_override"),
            option_copy.pop("finance_override", None),
        )
        if isinstance(merged_finance_override, dict) and merged_finance_override:
            variant["finance_override"] = merged_finance_override

        variant.update(option_copy)
        if not str(variant.get("id") or "").strip():
            variant["id"] = base_track.get("id")
        if not str(variant.get("label") or "").strip():
            variant["label"] = base_track.get("label")
        expanded.append(variant)

    return expanded or [base_track]


def expand_admission_track_variants(tracks: Any) -> List[Dict[str, Any]]:
    if not isinstance(tracks, list):
        return []

    expanded: List[Dict[str, Any]] = []
    for track in tracks:
        if not isinstance(track, dict):
            continue
        expanded.extend(_expand_track_funding_options(track))
    return expanded


def _derive_track_applicable_majors(u: Dict[str, Any], track: Dict[str, Any]) -> List[str]:
    explicit = track.get("applicable_majors")
    if isinstance(explicit, list) and explicit:
        return _uniq_non_empty(explicit)

    program_names = _track_program_names(u)
    if not program_names:
        return []

    blob_parts: List[Any] = [
        track.get("id"),
        track.get("label"),
        track.get("description"),
    ]
    extra_requirements = track.get("extra_requirements")
    if isinstance(extra_requirements, list):
        blob_parts.extend(extra_requirements)
    blob = _normalize_major_text(" ".join(str(part or "") for part in blob_parts))

    matched_programs = [
        name
        for name in program_names
        if _contains_phrase(blob, _normalize_major_text(name))
    ]
    matched_programs = _uniq_non_empty(matched_programs)
    if matched_programs:
        return matched_programs

    foundation_programs = [name for name in program_names if _is_foundation_program_name(name)]
    non_foundation_programs = [
        name for name in program_names if not _is_foundation_program_name(name)
    ]

    if foundation_programs and non_foundation_programs:
        if _track_targets_undergraduate(blob):
            return non_foundation_programs
        if _track_targets_foundation(blob):
            return foundation_programs
        return non_foundation_programs
    if foundation_programs and _track_targets_foundation(blob):
        return foundation_programs

    return program_names


def _should_keep_track_for_product_scope(u: Dict[str, Any], track: Dict[str, Any]) -> bool:
    majors = track.get("applicable_majors")
    if not isinstance(majors, list) or not majors:
        return True

    major_names = _uniq_non_empty(majors)
    if not major_names:
        return True

    has_non_foundation_program = any(
        not _is_foundation_program_name(name) for name in _track_program_names(u)
    )
    if not has_non_foundation_program:
        return True

    return not all(_is_foundation_program_name(name) for name in major_names)


def _track_requirement_exam_candidates(track: Dict[str, Any]) -> List[str]:
    ordered: List[str] = []
    seen = set()

    def collect(source: Any) -> None:
        if not isinstance(source, dict):
            return
        primary = []
        fallback = []
        for raw_key in source.keys():
            exam_id = str(raw_key or "").strip().upper()
            if not exam_id or exam_id in seen:
                continue
            if exam_id == "GPA":
                fallback.append(exam_id)
            else:
                primary.append(exam_id)
        for exam_id in primary + fallback:
            if exam_id in seen:
                continue
            seen.add(exam_id)
            ordered.append(exam_id)

    collect(track.get("requirements"))
    collect(track.get("stats_avg"))
    return ordered


def _track_primary_exam_id(track: Dict[str, Any]) -> str:
    candidates = _track_requirement_exam_candidates(track)
    return candidates[0] if candidates else ""


def _score_profile_program_matches_track(track: Dict[str, Any], program: Dict[str, Any]) -> bool:
    if not isinstance(track, dict) or not isinstance(program, dict):
        return False
    program_name = str(program.get("program_name") or program.get("name") or "").strip()
    if not program_name:
        return False

    applicable = track.get("applicable_majors")
    if isinstance(applicable, list):
        for major in applicable:
            major_text = str(major or "").strip()
            if not major_text:
                continue
            major_norm = _normalize_major_text(major_text)
            program_norm = _normalize_major_text(program_name)
            if (
                major_norm == program_norm
                or _contains_phrase(program_norm, major_norm)
                or _contains_phrase(major_norm, program_norm)
            ):
                return True
            major_canonical = _canonical_major(major_text)
            program_canonical = _canonical_major(program_name)
            if major_canonical and program_canonical and major_canonical == program_canonical:
                return True

    label_norm = _normalize_major_text(track.get("label"))
    return bool(label_norm and _contains_phrase(label_norm, _normalize_major_text(program_name)))


def _score_profile_route_matches_track(track: Dict[str, Any], program: Dict[str, Any]) -> bool:
    track_blob = _normalize_major_text(
        " ".join(
            str(part or "")
            for part in (
                track.get("id"),
                track.get("label"),
                track.get("description"),
                " ".join(_track_requirement_exam_candidates(track)),
            )
        )
    )
    program_blob = _normalize_major_text(
        " ".join(
            str(part or "")
            for part in (
                program.get("source_scope"),
                program.get("data_type"),
                program.get("metric_unit"),
                program.get("semantics"),
                program.get("notes"),
            )
        )
    )
    route_tokens = [
        "jupas",
        "hkdse",
        "a level",
        "polytechnic",
        "ossd",
        "sat",
        "act",
        "ib",
        "unt",
        "nuet",
    ]
    program_tokens = [token for token in route_tokens if token in program_blob]
    if not program_tokens:
        return True
    return any(token in track_blob for token in program_tokens)


def _parse_numeric_multiplier(value: Any) -> Optional[float]:
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)", str(value or ""))
    if not match:
        return None
    return _num_or_none(match.group(1))


def _weighted_total_scale_max(counts: Dict[str, Any]) -> Optional[float]:
    if not isinstance(counts, dict):
        return None
    best_of = 5
    selection_principle = str(counts.get("selection_principle") or "").strip().lower()
    match = re.search(r"best\s*(\d+)", selection_principle)
    if match:
        best_of = max(1, int(match.group(1)))

    subject_weighting = counts.get("subject_weighting")
    weights: List[float] = []
    if isinstance(subject_weighting, dict):
        for raw_value in subject_weighting.values():
            multiplier = _parse_numeric_multiplier(raw_value)
            if multiplier is not None and multiplier > 0:
                weights.append(float(multiplier))

    best_of = max(best_of, len(weights))
    total_weight = sum(weights) + max(0, best_of - len(weights))
    if total_weight <= 0:
        return None
    return round(total_weight * 7.0, 4)


def _score_scale(metric_id: str, counts: Dict[str, Any]) -> Optional[Tuple[float, float, str]]:
    resolved = exams_service.resolve_exam_key(metric_id)
    cfg = exams_service.EXAMS_CONFIG.get(resolved) if resolved else None
    if isinstance(cfg, dict) and str(cfg.get("type") or "").strip().lower() != "bool":
        mn = _num_or_none(cfg.get("min"))
        mx = _num_or_none(cfg.get("max"))
        if mn is not None and mx is not None and mx > mn:
            return float(mn), float(mx), resolved

    metric_key = _safe_lower(metric_id)
    if metric_key == "weighted_total":
        upper = _weighted_total_scale_max(counts)
        if upper is not None and upper > 0:
            return 0.0, float(upper), ""
    return None


def _normalize_score_value(raw_value: float, scale: Tuple[float, float, str]) -> float:
    _, _, metric_exam_id = scale
    if metric_exam_id:
        normalized = exams_service.normalize_exam_score(metric_exam_id, raw_value)
        if normalized is not None:
            return float(normalized)
    mn, mx, _ = scale
    return max(0.0, min(100.0, ((float(raw_value) - mn) / max(mx - mn, 1e-9)) * 100.0))


def _extract_track_score_percentiles(counts: Dict[str, Any]) -> Optional[Dict[str, float]]:
    if not isinstance(counts, dict):
        return None

    for raw_key in counts.keys():
        key = str(raw_key or "")
        if not key.startswith("lower_quartile_"):
            continue
        metric_id = key[len("lower_quartile_") :]
        p25 = _num_or_none(counts.get(key))
        median = _num_or_none(counts.get(f"median_{metric_id}"))
        p75 = _num_or_none(counts.get(f"upper_quartile_{metric_id}"))
        if p25 is None or median is None or p75 is None:
            continue
        return {
            "metric_id": metric_id,
            "p25_raw": float(p25),
            "median_raw": float(median),
            "p75_raw": float(p75),
        }

    for raw_key in counts.keys():
        key = str(raw_key or "")
        match = re.match(r"(.+)_25th_percentile$", key)
        if not match:
            continue
        metric_id = str(match.group(1) or "")
        p25 = _num_or_none(counts.get(key))
        median = _num_or_none(counts.get(f"{metric_id}_50th_percentile"))
        p75 = _num_or_none(counts.get(f"{metric_id}_75th_percentile"))
        if p25 is None or median is None or p75 is None:
            continue
        return {
            "metric_id": metric_id,
            "p25_raw": float(p25),
            "median_raw": float(median),
            "p75_raw": float(p75),
        }

    return None


def _derive_track_score_profile(u: Dict[str, Any], track: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    explicit = track.get("score_profile")
    if isinstance(explicit, dict) and explicit:
        return explicit

    academics = u.get("academics")
    academics = academics if isinstance(academics, dict) else {}
    admissions = academics.get("admissions")
    admissions = admissions if isinstance(admissions, dict) else {}
    programs = admissions.get("programs")
    if not isinstance(programs, list) or not programs:
        return None

    primary_exam_id = _track_primary_exam_id(track)
    matched_programs = [
        row
        for row in programs
        if isinstance(row, dict)
        and _score_profile_program_matches_track(track, row)
        and _score_profile_route_matches_track(track, row)
    ]
    candidates = matched_programs or [
        row
        for row in programs
        if isinstance(row, dict) and _score_profile_route_matches_track(track, row)
    ]
    university_acceptance = _num_or_none(academics.get("acceptance_rate_percent"))

    for program in candidates:
        counts = program.get("counts")
        if not isinstance(counts, dict):
            continue
        extracted = _extract_track_score_percentiles(counts)
        if not isinstance(extracted, dict):
            continue
        scale = _score_scale(str(extracted.get("metric_id") or ""), counts)
        if scale is None:
            continue

        metric_exam_id = str(scale[2] or "").strip().upper()
        resolved_primary_exam_id = str(exams_service.resolve_exam_key(primary_exam_id) or "").strip().upper()
        compatible_exam_ids = []
        if metric_exam_id:
            compatible_exam_ids.append(metric_exam_id)
            if resolved_primary_exam_id and resolved_primary_exam_id == metric_exam_id and resolved_primary_exam_id not in compatible_exam_ids:
                compatible_exam_ids.append(resolved_primary_exam_id)

        provenance = program.get("provenance")
        provenance = provenance if isinstance(provenance, dict) else {}
        uses_exam_anchor = bool(metric_exam_id) and exams_service.exam_supports_percentile_normalization(metric_exam_id)
        profile = {
            "metric_id": str(extracted.get("metric_id") or ""),
            "metric_unit": str(program.get("metric_unit") or ""),
            "p25_raw": round(float(extracted["p25_raw"]), 2),
            "median_raw": round(float(extracted["median_raw"]), 2),
            "p75_raw": round(float(extracted["p75_raw"]), 2),
            "p25_normalized": round(_normalize_score_value(float(extracted["p25_raw"]), scale), 2),
            "median_normalized": round(_normalize_score_value(float(extracted["median_raw"]), scale), 2),
            "p75_normalized": round(_normalize_score_value(float(extracted["p75_raw"]), scale), 2),
            "confidence": str(provenance.get("confidence") or "estimated"),
            "source_program_name": str(program.get("program_name") or program.get("name") or ""),
            "source_scope": str(program.get("source_scope") or program.get("scope") or ""),
            "source_url": str(provenance.get("source_url") or ""),
            "normalization_method": (
                "exam_anchor_percentile"
                if uses_exam_anchor
                else ("exam_min_max_scale" if metric_exam_id else "scale_fallback")
            ),
        }
        if compatible_exam_ids:
            profile["exam_id"] = compatible_exam_ids[0]
            profile["compatible_exam_ids"] = compatible_exam_ids
        if university_acceptance is not None:
            profile["acceptance_rate_percent"] = round(float(university_acceptance), 2)
        return profile

    return None


def _is_foundation_study_level(value: Any) -> bool:
    return _contains_phrase(_normalize_major_text(value), "foundation")


def _is_foundation_program_row(program: Dict[str, Any]) -> bool:
    if not isinstance(program, dict):
        return False

    if _is_foundation_program_name(program.get("name")):
        return True

    levels = program.get("study_levels")
    if isinstance(levels, list) and any(_is_foundation_study_level(level) for level in levels):
        return True
    if levels is not None and _is_foundation_study_level(levels):
        return True

    return False


def _filter_academics_for_product_scope(academics: Dict[str, Any]) -> None:
    if not isinstance(academics, dict):
        return

    programs = academics.get("programs")
    if isinstance(programs, list):
        academics["programs"] = [
            program
            for program in programs
            if isinstance(program, dict) and not _is_foundation_program_row(program)
        ]

    majors = academics.get("majors")
    if isinstance(majors, list):
        academics["majors"] = [
            major for major in majors if not _is_foundation_program_name(major)
        ]

    study_levels = academics.get("study_levels")
    if isinstance(study_levels, list):
        academics["study_levels"] = [
            level for level in study_levels if not _is_foundation_study_level(level)
        ]

    admissions = academics.get("admissions")
    if isinstance(admissions, dict):
        admissions_programs = admissions.get("programs")
        if isinstance(admissions_programs, list):
            admissions["programs"] = [
                row
                for row in admissions_programs
                if isinstance(row, dict)
                and not _is_foundation_program_name(row.get("program_name") or row.get("name"))
            ]


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
    programs = [p for p in programs_raw if isinstance(p, dict)] if isinstance(programs_raw, list) else []

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

    tracks = u.get("admission_tracks")
    if isinstance(tracks, list):
        kept_tracks: List[Dict[str, Any]] = []
        for raw_track in tracks:
            if not isinstance(raw_track, dict):
                continue

            track = copy.deepcopy(raw_track)
            derived_majors = _derive_track_applicable_majors(u, track)
            if derived_majors:
                track["applicable_majors"] = derived_majors
            track["score_profile"] = _derive_track_score_profile(u, track)

            raw_options = track.get("funding_options")
            if isinstance(raw_options, list) and raw_options:
                expanded_options = _expand_track_funding_options(track)
                normalized_options: List[Dict[str, Any]] = []
                for option_idx, raw_option in enumerate(raw_options):
                    if not isinstance(raw_option, dict):
                        continue
                    option = copy.deepcopy(raw_option)
                    variant = expanded_options[option_idx] if option_idx < len(expanded_options) else None
                    if isinstance(variant, dict):
                        option_majors = variant.get("applicable_majors")
                        if isinstance(option_majors, list) and option_majors:
                            option["applicable_majors"] = copy.deepcopy(option_majors)
                        option_score_profile = variant.get("score_profile")
                        if isinstance(option_score_profile, dict) and option_score_profile:
                            option["score_profile"] = copy.deepcopy(option_score_profile)
                    normalized_options.append(option)
                track["funding_options"] = normalized_options

            if _should_keep_track_for_product_scope(u, track):
                kept_tracks.append(track)
        u["admission_tracks"] = kept_tracks

    _filter_academics_for_product_scope(academics)

    return u


def _build_university_meta(u: Dict[str, Any]) -> Dict[str, Any]:
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
            for value in (majors + program_names + explicit_major_tags + program_major_tags)
            for tag in _major_tags_from_text(value)
        ]
    )
    uni_id = str(u.get("id", "")).strip()
    rus_names = _load_localized_university_names(SEARCH_LANG_RUS)

    country_key = _norm_space(_get_nested(u, ["location", "country"]))
    city_key = _norm_space(_get_nested(u, ["location", "city"]))
    state_key = _norm_space(_get_nested(u, ["location", "state"]))
    description = _safe_lower(u.get("description"))
    raw_tags = [str(x or "").strip() for x in (u.get("tags") or []) if str(x or "").strip()]
    hidden_search_aliases = _hidden_search_aliases_for_university(u)
    tag_keys = [_norm_tag_key(x) for x in raw_tags if _norm_tag_key(x)]

    major_exact_rus = _uniq_non_empty(
        [_MAJOR_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(_safe_lower(x), "") for x in major_exact if x]
    )
    tags_rus = _uniq_non_empty(
        [_TAG_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(_norm_tag_key(x), "") for x in tag_keys if x]
    )
    name_raw = _safe_lower(u.get("name"))
    city_raw = _safe_lower(_get_nested(u, ["location", "city"]))
    country_raw = _safe_lower(_get_nested(u, ["location", "country"]))
    name_rus = _safe_lower(rus_names.get(uni_id, ""))
    city_rus = _safe_lower(_CITY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(city_key, ""))
    country_rus = _safe_lower(_COUNTRY_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(country_key, ""))
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
        "state_rus": _safe_lower(_STATE_LOCALIZED_BY_LANG[SEARCH_LANG_RUS].get(state_key, "")),
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
        "study_levels": [_safe_lower(x) for x in study_levels if x] + [_safe_lower(x) for x in program_levels if x],
        "formats": [_safe_lower(x) for x in formats if x] + [_safe_lower(x) for x in program_formats if x],
    }


def _meta_for_search_lang(meta_row: Dict[str, Any], search_lang: str) -> Dict[str, Any]:
    lang = _normalize_search_lang(search_lang)
    if lang != SEARCH_LANG_RUS:
        return meta_row

    out = dict(meta_row)

    def merged_text(*values: Any) -> str:
        vals = _uniq_non_empty([str(v or "").strip() for v in values if str(v or "").strip()])
        return " ".join(vals).strip()

    out["name"] = merged_text(meta_row.get("name"), meta_row.get("name_rus", ""))
    out["country"] = merged_text(meta_row.get("country"), meta_row.get("country_rus", ""))
    out["city"] = merged_text(meta_row.get("city"), meta_row.get("city_rus", ""))
    out["state"] = merged_text(meta_row.get("state"), meta_row.get("state_rus", ""))
    out["description"] = merged_text(meta_row.get("description"), meta_row.get("description_rus", ""))
    out["tags"] = _uniq_non_empty(list(meta_row.get("tags", []) or []) + list(meta_row.get("tags_rus", []) or []))

    localized_major_exact = list(meta_row.get("major_exact_rus", []) or [])
    out["major_exact"] = _uniq_non_empty(list(meta_row.get("major_exact", []) or []) + localized_major_exact)
    out["majors"] = _uniq_non_empty(list(meta_row.get("majors", []) or []) + localized_major_exact)
    out["program_names"] = _uniq_non_empty(list(meta_row.get("program_names", []) or []) + localized_major_exact)
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

    tracks = expand_admission_track_variants(u.get("admission_tracks"))
    if not tracks:
        return False

    for track in tracks:
        if not isinstance(track, dict):
            continue
        if _safe_lower(track.get("funding_type")) == "grant":
            return True
        scholarships = track.get("scholarships")
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
    if not any(bool(str(v).strip()) for k, v in out.items() if k != "is_official_external_rank"):
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
            "total_cost_year_usd": _effective_university_cost(u, format_preference=format_preference),
            "financial_aid": {
                "merit_based": _to_bool(aid_obj.get("merit_based")),
                "need_based": _to_bool(aid_obj.get("need_based")),
            },
        },
        "academics": {
            "acceptance_rate_percent": _get_university_acceptance_rate(u),
        },
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
        return [to_university_card(u, format_preference=format_preference, search_lang=search_lang) for u in items]
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


def _apply_sort(items: List[Dict[str, Any]], sort: str, format_preference: Any = "any") -> List[Dict[str, Any]]:
    sort = (sort or "").strip()

    def get_val(u, path):
        return _to_float(_get_nested(u, path)) or 0.0

    if sort == "name_asc":
        return sorted(items, key=lambda u: _safe_lower(u.get("name")))

    if sort == "tuition_asc":
        return sorted(items, key=lambda u: _effective_university_cost(u, format_preference=format_preference))
    if sort == "tuition_desc":
        return sorted(items, key=lambda u: _effective_university_cost(u, format_preference=format_preference), reverse=True)

    if sort == "acceptance_asc":
        return sorted(items, key=lambda u: (_get_university_acceptance_rate(u) or 0.0))
    if sort == "acceptance_desc":
        return sorted(items, key=lambda u: (_get_university_acceptance_rate(u) or 0.0), reverse=True)

    if sort == "rank_asc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 999999.0))
    if sort == "rank_desc":
        return sorted(items, key=lambda u: (_to_float(u.get("rank")) or 0.0), reverse=True)

    if sort == "gpa_desc":
        return sorted(items, key=lambda u: get_val(u, ["exams_avg", "GPA"]), reverse=True)

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
        except Exception:
            data = []

        out: List[Dict[str, Any]] = []
        meta_list: List[Dict[str, Any]] = []
        by_id: Dict[str, Dict[str, Any]] = {}
        for row in data:
            if not isinstance(row, dict):
                continue
            norm = _normalize_university_schema(row)
            out.append(norm)
            meta_list.append(_build_university_meta(norm))
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
    digest = hashlib.sha1(
        f"{mtime_key}:{tr_key}:{uid}:{lang}:{UNIVERSITY_DETAIL_REPR_VERSION}".encode("utf-8")
    ).hexdigest()
    return f"\"{digest}\""


def get_university_translation_bundle(search_lang: Optional[str] = None) -> Dict[str, Any]:
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
        scored_pairs = []
        for u, m in pairs:
            meta_search = _meta_for_search_lang(m, lang)
            best_score: Optional[float] = None
            for query_value in query_candidates:
                score = search_service.score_query(meta_search, query_value)
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

    if region:
        reg = _safe_lower(region)
        pairs = [(u, m) for (u, m) in pairs if m.get("state", "") == reg]
    if country:
        cc = _safe_lower(country)
        pairs = [(u, m) for (u, m) in pairs if m.get("country", "") == cc]
    if city:
        cc = _safe_lower(city)
        pairs = [(u, m) for (u, m) in pairs if m.get("city", "") == cc]

    if major:
        m_exact = _canonical_major(major)
        m_raw = _normalize_major_text(major)
        pairs = [
            (u, meta_row)
            for (u, meta_row) in pairs
            if (
                (bool(m_exact) and any(x == m_exact for x in meta_row.get("major_exact", [])))
                or (
                    not m_exact
                    and (
                        any(_normalize_major_text(x) == m_raw for x in meta_row.get("majors", []))
                        or any(_normalize_major_text(x) == m_raw for x in meta_row.get("program_names", []))
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
                    _safe_lower(t.get("funding_type")) == ft
                    for t in expand_admission_track_variants(u.get("admission_tracks"))
                    if isinstance(t, dict)
                )
            ]

    if user_budget is not None:
        filtered = []
        for u, m in pairs:
            cost = _effective_university_cost(u, format_preference=mode_pref) or 999999.0
            fa = _get_nested(u, ["finance", "financial_aid"], {})
            aid = fa.get("merit_based") or fa.get("need_based")
            if cost <= user_budget or aid:
                filtered.append((u, m))
        pairs = filtered

    if min_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_gte(_effective_university_cost(u, format_preference=mode_pref), min_tuition)
        ]
    if max_tuition is not None:
        pairs = [
            (u, m)
            for (u, m) in pairs
            if _safe_compare_lte(_effective_university_cost(u, format_preference=mode_pref), max_tuition)
        ]

    if min_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_gte(_get_university_acceptance_rate(u), min_acceptance)]
    if max_acceptance is not None:
        pairs = [(u, m) for (u, m) in pairs if _safe_compare_lte(_get_university_acceptance_rate(u), max_acceptance)]

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
