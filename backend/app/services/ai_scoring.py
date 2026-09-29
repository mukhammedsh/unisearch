import math
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.utils import to_float as _to_num, to_float_default as _to_num_default, clamp as _clamp, clamp01 as _clamp01
from app.services import exams as exams_service
from app.services.finance_modes import (
    extract_tuition_cost as _extract_tuition_cost,
    mode_breakdown_from_finance as _mode_breakdown_from_finance,
    mode_total_from_finance as _mode_total_from_finance,
    normalize_study_mode as _normalize_study_mode,
)
from app.services import languages as languages_service
from app.services import universities as universities_service
from app.services.university_tracks import (
    _canonical_major,
    _normalize_major_text,
    _iter_programs,
)
from app.services.citizenship import resolve_citizenship_status
from app.services.ml_scoring import get_ml_recommender, get_ml_runtime_status

_UI_BADGE_THRESHOLDS = {
    "your_vibe_max_mismatch": 0.14,
    "top_match_max_mismatch": 0.22,
}


def _preview_text(value: Any, max_len: int = 180) -> str:
    raw = str(value or "").replace("\n", " ").strip()
    if len(raw) <= max_len:
        return raw
    return f"{raw[:max_len]}..."




def _canonical_exam_key(key: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(key or "").strip().upper())


def _normalize_funding_preference(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in ("grant", "paid"):
        return raw
    return "any"


def _get_track_funding_type(track: Dict[str, Any]) -> str:
    raw_type = str(track.get("funding_type", "")).strip().lower()
    if raw_type in ("grant", "paid"):
        return raw_type
    badge = str(track.get("track_badge", "")).strip().lower()
    return "grant" if re.search(r"grant|scholar", badge) else "paid"


def _track_study_mode(university: Dict[str, Any], track: Dict[str, Any]) -> str:
    mode = track.get("study_mode")
    if isinstance(mode, list):
        mode = next((x for x in mode if x), "")
    normalized = _normalize_study_mode(mode)
    if normalized != "any":
        return normalized

    formats = ((university.get("academics") or {}).get("formats")) if isinstance(university, dict) else None
    if isinstance(formats, list) and formats:
        one = _normalize_study_mode(formats[0] if len(formats) == 1 else "")
        if one != "any":
            return one
    return "any"


def _cost_to_usd(amount: Optional[float], currency_code: str) -> float:
    if amount is None or amount <= 0:
        return 0.0
    code = str(currency_code or "USD").strip().upper()
    if not code or code == "USD":
        return max(0.0, float(amount))
    try:
        from app.services.currency import convert
        return max(0.0, float(convert(amount, code, "USD")))
    except Exception:
        return max(0.0, float(amount))


def _university_matches_major(university: Dict[str, Any], major: str) -> bool:
    target_major = str(major or "").strip()
    if not target_major or not isinstance(university, dict):
        return True
    m_exact = _canonical_major(target_major)
    m_raw = _normalize_major_text(target_major)
    academics = university.get("academics") if isinstance(university.get("academics"), dict) else {}
    programs = _iter_programs(university)

    for p in programs:
        if not isinstance(p, dict):
            continue
        p_name = _normalize_major_text(p.get("name"))
        if m_raw and (p_name == m_raw or m_raw in p_name):
            return True
        p_tags = p.get("major_tags") or []
        if isinstance(p_tags, list):
            for tag in p_tags:
                tag_exact = _canonical_major(tag)
                if m_exact and tag_exact == m_exact:
                    return True
                if m_raw and _normalize_major_text(tag) == m_raw:
                    return True

    majors = academics.get("majors") or []
    if isinstance(majors, list):
        for m in majors:
            m_tag = _canonical_major(m)
            if m_exact and m_tag == m_exact:
                return True
            if m_raw and _normalize_major_text(m) == m_raw:
                return True

    major_tags = academics.get("major_tags") or []
    if isinstance(major_tags, list):
        for m in major_tags:
            m_tag = _canonical_major(m)
            if m_exact and m_tag == m_exact:
                return True
            if m_raw and _normalize_major_text(m) == m_raw:
                return True

    return False


def _finance_cost_range(finance: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    minimum = _to_num(finance.get("total_cost_year_min"))
    maximum = _to_num(finance.get("total_cost_year_max"))
    if minimum is None or maximum is None or minimum < 0 or maximum < minimum:
        return None
    return {
        "min": float(minimum),
        "max": float(maximum),
        "currency": str(finance.get("currency") or "").strip().upper() or None,
        "academic_year": finance.get("academic_year"),
        "source": finance.get("source"),
        "source_url": finance.get("source_url"),
        "source_urls": finance.get("source_urls"),
        "fee_status": finance.get("fee_status"),
        "scope": finance.get("scope"),
    }


def _finance_for_cost(university: Dict[str, Any], track: Dict[str, Any]) -> Dict[str, Any]:
    track_fin = track.get("finance_override") if isinstance(track.get("finance_override"), dict) else {}
    uni_fin = university.get("finance") if isinstance(university.get("finance"), dict) else {}
    levels = track.get("study_levels") if isinstance(track.get("study_levels"), list) else []
    raw_scope = track.get("scope")
    scope = (
        " ".join(str(value or "") for value in raw_scope.values()).strip().lower()
        if isinstance(raw_scope, dict)
        else str(raw_scope or "").strip().lower()
    )
    scope_level = (
        _normalize_study_level_str(raw_scope.get("level"))
        if isinstance(raw_scope, dict)
        else _normalize_study_level_str(raw_scope)
    )
    graduate_track = (
        any(_normalize_study_level_str(level) in {"master", "mba", "doctorate"} for level in levels)
        or scope_level in {"master", "mba", "doctorate"}
        or scope.startswith(("graduate", "postgraduate", "doctoral"))
    )
    track_range = _finance_cost_range(track_fin)
    university_range = _finance_cost_range(uni_fin)
    total = _to_num(track_fin.get("total_cost_year_usd"))
    cost_range = track_range if total is None else None
    cost_cycle_source = track_fin if total is not None or cost_range is not None else {}
    if total is None and cost_range is None and not graduate_track:
        total = _to_num(uni_fin.get("total_cost_year_usd"))
        if total is None:
            cost_range = university_range
        if total is not None or cost_range is not None:
            cost_cycle_source = uni_fin
    known_currency = (
        track_fin.get("currency")
        or (track_range or {}).get("currency")
        or uni_fin.get("currency")
        or (university_range or {}).get("currency")
    )
    currency = str(known_currency or "USD").strip().upper()
    if cost_range and not cost_range.get("currency") and known_currency:
        cost_range = {**cost_range, "currency": currency}
    total_usd = _cost_to_usd(total, currency)
    breakdown = track_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict) and not graduate_track:
        breakdown = uni_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    return {
        "total": total_usd,
        "raw_total": total,
        "breakdown": breakdown,
        "track_finance": track_fin,
        "university_finance": uni_fin,
        "currency": currency,
        "unavailable": total is None and cost_range is None,
        "cost_range": cost_range,
        "cost_cycle_source": cost_cycle_source,
    }


def _track_cost_range_payload(university: Dict[str, Any], track: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    finance = _finance_for_cost(university, track)
    cost_range = finance.get("cost_range")
    if not isinstance(cost_range, dict):
        return None
    currency = str(cost_range.get("currency") or "").strip().upper() or None
    minimum = float(cost_range["min"])
    maximum = float(cost_range["max"])
    minimum_usd = maximum_usd = None
    if currency == "USD":
        minimum_usd, maximum_usd = minimum, maximum
    elif currency:
        try:
            from app.services.currency import convert
            minimum_usd = max(0.0, float(convert(minimum, currency, "USD")))
            maximum_usd = max(0.0, float(convert(maximum, currency, "USD")))
        except ValueError:
            minimum_usd = maximum_usd = None
    return {
        "minNative": minimum,
        "maxNative": maximum,
        "currency": currency,
        "minUSD": minimum_usd,
        "maxUSD": maximum_usd,
        "academicYear": cost_range.get("academic_year"),
        "feeStatus": cost_range.get("fee_status"),
        "scope": cost_range.get("scope"),
        "source": cost_range.get("source"),
        "sourceUrl": cost_range.get("source_url"),
        "sourceUrls": cost_range.get("source_urls"),
    }


def _effective_cost_mode(preferred_mode: Any, track_mode: Any) -> str:
    pref = _normalize_study_mode(preferred_mode)
    if pref != "any":
        return pref
    mode = _normalize_study_mode(track_mode)
    return mode if mode != "any" else "on-campus"


def _effective_track_cost_details(
    university: Dict[str, Any],
    track: Dict[str, Any],
    preferred_mode: Any = "any",
    intended_entry_cycle: Any = None,
) -> Tuple[float, float, str, str]:
    """
    Returns (cost_usd, cost_native, currency, cost_mode)
    """
    finance = _finance_for_cost(university, track)
    total_usd = float(finance.get("total") or 0.0)
    raw_total = float(_to_num(finance.get("raw_total")) or 0.0)
    breakdown = finance.get("breakdown") if isinstance(finance.get("breakdown"), dict) else {}
    tuition = _extract_tuition_cost(breakdown)
    mode = _effective_cost_mode(preferred_mode, _track_study_mode(university, track))
    track_fin = finance.get("track_finance") if isinstance(finance.get("track_finance"), dict) else {}
    uni_fin = finance.get("university_finance") if isinstance(finance.get("university_finance"), dict) else {}
    currency = str(finance.get("currency") or "USD").strip().upper()

    if _cost_cycle_mismatch(finance.get("cost_cycle_source"), intended_entry_cycle):
        return 0.0, 0.0, currency, "unavailable"

    if mode == "on-campus":
        cost_range = finance.get("cost_range")
        if isinstance(cost_range, dict):
            max_native = float(cost_range["max"])
            return _cost_to_usd(max_native, currency), max_native, currency, "on-campus_range"
        if finance.get("unavailable"):
            return 0.0, 0.0, currency, "unavailable"
        return max(0.0, total_usd), max(0.0, raw_total), currency, "on-campus_exact"

    if mode == "online":
        for source in (track_fin, uni_fin):
            mode_breakdown = _mode_breakdown_from_finance(source, "online")
            mode_tuition = _extract_tuition_cost(mode_breakdown if isinstance(mode_breakdown, dict) else {})
            if mode_tuition is not None and mode_tuition >= 0:
                cost_native = float(mode_tuition)
                return _cost_to_usd(cost_native, currency), cost_native, currency, "online_tuition_only"
        if tuition is not None and tuition >= 0:
            cost_native = float(tuition)
            return _cost_to_usd(cost_native, currency), cost_native, currency, "online_tuition_only"
        for source in (track_fin, uni_fin):
            mode_total = _mode_total_from_finance(source, "online")
            if mode_total is not None and mode_total >= 0:
                cost_native = float(mode_total)
                return _cost_to_usd(cost_native, currency), cost_native, currency, "online_mode_total"
        return 0.0, 0.0, currency, "online_missing_tuition"

    return max(0.0, total_usd), max(0.0, raw_total), currency, "on-campus_exact"


def _effective_track_cost_with_mode(
    university: Dict[str, Any],
    track: Dict[str, Any],
    preferred_mode: Any = "any",
) -> Tuple[float, str]:
    cost_usd, _cost_native, _currency, cost_mode = _effective_track_cost_details(
        university, track, preferred_mode=preferred_mode
    )
    return cost_usd, cost_mode


def _effective_track_cost(university: Dict[str, Any], track: Dict[str, Any], preferred_mode: Any = "any") -> float:
    return _effective_track_cost_with_mode(university, track, preferred_mode=preferred_mode)[0]


def _language_config() -> Dict[str, Any]:
    cfg = languages_service.get_languages_config()
    return cfg if isinstance(cfg, dict) else {}


def _normalize_lang_code(value: Any, lang_cfg: Dict[str, Any]) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    languages = lang_cfg.get("languages", [])
    if not isinstance(languages, list):
        return raw
    for row in languages:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code", "")).strip().lower()
        name = str(row.get("name", "")).strip().lower()
        label = str(row.get("label", "")).strip().lower()
        native_name = str(row.get("native_name", "")).strip().lower()
        if raw in (code, name, label, native_name) and code:
            return code
    return raw


def _is_language_exam_key(exam_id: Any) -> bool:
    key = str(exam_id or "").upper()
    if not key:
        return False
    return any(
        marker in key
        for marker in (
            "IELTS",
            "TOEFL",
            "DET",
            "DUOLINGO",
            "PTE",
            "CAMBRIDGE",
            "TESTDAF",
            "DSH",
            "DELF",
            "DALF",
            "TCF",
            "TEF",
            "NT2",
            "HSK",
            "JLPT",
            "TOPIK",
        )
    )


def _is_higher_better(exam_id: Any) -> bool:
    return "JLPT" not in str(exam_id or "").upper()


def _set_best_score(dst: Dict[str, float], exam_id: Any, score: Any) -> None:
    raw = str(exam_id or "").strip()
    val = _to_num(score)
    if not raw or val is None:
        return
    higher_is_better = _is_higher_better(raw)
    for key in (raw, raw.upper(), _canonical_exam_key(raw)):
        if not key:
            continue
        prev = _to_num(dst.get(key))
        if prev is None:
            dst[key] = val
        else:
            dst[key] = max(prev, val) if higher_is_better else min(prev, val)


def _normalize_gpa_score(val: Any, scale: Any = None) -> Optional[float]:
    num = _to_num(val)
    if num is None or num < 0.0 or num > 5.0:
        return None
    scale_num = _to_num(scale)
    if scale_num is not None and math.isclose(scale_num, 5.0):
        return round((num / 5.0) * 4.0, 2)
    if num <= 4.0:
        return round(float(num), 2)
    return round((num / 5.0) * 4.0, 2)


def _build_user_context(profile: Dict[str, Any], lang_cfg: Dict[str, Any]) -> Dict[str, Any]:
    user_scores: Dict[str, float] = {}
    user_languages: Dict[str, Dict[str, Any]] = {}

    scale = profile.get("gpa_scale")
    normalized_gpa = _normalize_gpa_score(profile.get("gpa"), scale=scale)
    if normalized_gpa is not None:
        _set_best_score(user_scores, "GPA", normalized_gpa)

    for row in profile.get("exams", []) or []:
        if not isinstance(row, dict):
            continue
        exam_id = row.get("id") or row.get("exam")
        raw_score = row.get("score")
        raw_value = row.get("raw_value")
        details = row.get("details")
        try:
            parsed = exams_service.coerce_exam_submission(
                exam_id,
                score_raw=raw_score,
                raw_value=raw_value,
                details=details,
            )
            _set_best_score(user_scores, parsed.get("exam", exam_id), parsed.get("score"))
            parsed_details = parsed.get("details")
            if isinstance(parsed_details, dict):
                for bucket_name in ("components", "extra_scores"):
                    bucket = parsed_details.get(bucket_name)
                    if not isinstance(bucket, list):
                        continue
                    for item in bucket:
                        if not isinstance(item, dict):
                            continue
                        nested_exam = item.get("exam") or item.get("id")
                        _set_best_score(user_scores, nested_exam, item.get("score"))
        except Exception:
            _set_best_score(user_scores, exam_id, raw_score)

    for row in profile.get("languages", []) or []:
        if not isinstance(row, dict):
            continue
        code = _normalize_lang_code(row.get("code"), lang_cfg)
        kind = str(row.get("kind", "")).strip().lower()
        if not code or not kind:
            continue
        if code not in user_languages:
            user_languages[code] = {"native": False, "cefr": None, "exams": {}}

        if kind == "native":
            user_languages[code]["native"] = True
            continue

        if kind == "cefr":
            level = _to_num(row.get("level"))
            if level is not None:
                prev = _to_num(user_languages[code].get("cefr"))
                user_languages[code]["cefr"] = level if prev is None else max(prev, level)
            continue

        if kind == "exam":
            exam_id = str(row.get("exam") or "").strip()
            raw_score = row.get("score")
            raw_value = row.get("raw_value")
            details = row.get("details")
            if not exam_id:
                continue
            try:
                parsed_lang = languages_service.validate_language(
                    {
                        "code": code,
                        "kind": "exam",
                        "exam": exam_id,
                        "score": raw_score,
                        "raw_value": raw_value,
                        "details": details,
                    }
                ).get("language", {})
                parsed_exam_id = str(parsed_lang.get("exam") or exam_id).strip()
                parsed_score = _to_num(parsed_lang.get("score"))
                if parsed_exam_id and parsed_score is not None:
                    _set_best_score(user_languages[code]["exams"], parsed_exam_id, parsed_score)
                    _set_best_score(user_scores, parsed_exam_id, parsed_score)
                parsed_details = parsed_lang.get("details")
                if isinstance(parsed_details, dict):
                    bucket = parsed_details.get("components")
                    if isinstance(bucket, list):
                        for item in bucket:
                            if not isinstance(item, dict):
                                continue
                            nested_exam = item.get("exam") or item.get("id")
                            nested_score = item.get("score")
                            _set_best_score(user_languages[code]["exams"], nested_exam, nested_score)
                            _set_best_score(user_scores, nested_exam, nested_score)
                continue
            except Exception:
                score = _to_num(raw_score)
                if score is None:
                    continue
                _set_best_score(user_languages[code]["exams"], exam_id, score)
                _set_best_score(user_scores, exam_id, score)

    return {
        "userScores": user_scores,
        "userLanguages": user_languages,
        "budget": _to_num(profile.get("budget")),
    }


def _get_user_score(user_scores: Dict[str, Any], exam_id: Any, user_languages: Optional[Dict[str, Any]] = None) -> Optional[float]:
    raw = str(exam_id or "").strip()
    if not raw:
        return None

    direct_keys = [raw, raw.upper(), _canonical_exam_key(raw)]
    for key in direct_keys:
        val = _to_num(user_scores.get(key))
        if val is not None:
            return val

    # Infer exam score from language evidence if explicit score is missing.
    if isinstance(user_languages, dict) and _is_language_exam_key(raw):
        for state in user_languages.values():
            if not isinstance(state, dict):
                continue
            if state.get("native"):
                return 1.0
            cefr = _to_num(state.get("cefr"))
            if cefr is not None:
                return cefr
    return None


def _score_requirement(user: Any, min_val: Any, avg_val: Any, higher_is_better: bool = True, mode: str = "sort") -> Dict[str, Any]:
    u = _to_num(user)
    mn = _to_num(min_val)
    av = _to_num(avg_val)

    if mn is None:
        return {"score": 0.60 if mode == "sort" else 0.65, "pass": True, "gap": 0.0, "conditional": False}
    if u is None:
        if mode == "sort":
            return {"score": 0.42, "pass": True, "gap": 0.0, "conditional": True}
        return {"score": 0.55, "pass": True, "gap": 0.0, "conditional": True}

    uu = u if higher_is_better else (-u)
    mm = mn if higher_is_better else (-mn)
    aa_raw = av if (av is not None and higher_is_better) else ((-av) if av is not None else None)
    aa = aa_raw if (aa_raw is not None and aa_raw >= mm) else mm

    if uu < mm:
        denom = max(abs(mm), 1e-9)
        ratio = _clamp01(uu / denom)
        if mode == "sort":
            return {"score": 0.5 * ratio, "pass": False, "gap": _clamp01((mm - uu) / denom), "conditional": False}
        return {"score": _clamp(0.05 + 0.45 * ratio, 0.02, 0.5), "pass": False, "gap": _clamp01((mm - uu) / denom), "conditional": False}

    if uu <= aa:
        t = _clamp01((uu - mm) / max(aa - mm, 1e-9))
        return {"score": (0.50 + 0.25 * t) if mode == "sort" else (0.55 + 0.25 * t), "pass": True, "gap": 0.0, "conditional": False}

    t = _clamp01((uu - aa) / max(abs(aa) * (0.15 if mode == "sort" else 0.2), 1e-9))
    return {"score": (0.75 + 0.25 * t) if mode == "sort" else (0.80 + 0.20 * t), "pass": True, "gap": 0.0, "conditional": False}


def _collect_language_requirements(track: Dict[str, Any]) -> Dict[str, Any]:
    raw = track.get("language_requirements")
    mode_raw = str(track.get("language_requirements_mode", track.get("language_mode", "all"))).strip().lower()
    mode = "any" if mode_raw == "any" else "all"

    if not raw:
        return {"mode": mode, "items": []}

    if isinstance(raw, dict) and isinstance(raw.get("items"), list):
        nested_mode = str(raw.get("mode", mode)).strip().lower()
        return {
            "mode": "any" if nested_mode == "any" else "all",
            "items": [x for x in raw.get("items", []) if x],
        }

    if isinstance(raw, list):
        return {"mode": mode, "items": [x for x in raw if x]}

    if isinstance(raw, dict):
        out = []
        for code, cfg in raw.items():
            if not isinstance(cfg, dict):
                continue
            item = {"code": code}
            item.update(cfg)
            out.append(item)
        return {"mode": mode, "items": out}

    return {"mode": mode, "items": []}


def _score_single_language_rule(lang_rule: Dict[str, Any], user_languages: Dict[str, Any], lang_cfg: Dict[str, Any], mode: str = "sort") -> Dict[str, Any]:
    code = _normalize_lang_code(lang_rule.get("code"), lang_cfg)
    state = user_languages.get(code) if code else None
    if not isinstance(state, dict):
        state = {}

    if bool(lang_rule.get("accept_native")) and bool(state.get("native")):
        return {"score": 1.0, "pass": True, "gap": 0.0, "conditional": False}

    candidates: List[Dict[str, Any]] = []

    min_cefr = _to_num(lang_rule.get("min_cefr"))
    avg_cefr = _to_num(lang_rule.get("recommended_cefr", lang_rule.get("avg_cefr", lang_rule.get("stats_avg_cefr"))))
    cefr_user = _to_num(state.get("cefr"))
    if min_cefr is not None and cefr_user is not None:
        candidates.append(_score_requirement(cefr_user, min_cefr, avg_cefr, higher_is_better=True, mode=mode))

    req = lang_rule.get("requirements", {})
    if not isinstance(req, dict):
        req = lang_rule.get("exams", {})
    if not isinstance(req, dict):
        req = {}

    avg = lang_rule.get("stats_avg", {})
    if not isinstance(avg, dict):
        avg = lang_rule.get("exams_avg", {})
    if not isinstance(avg, dict):
        avg = {}

    for exam_id, min_val in req.items():
        # Do not infer exam-equivalent score from CEFR/native evidence.
        # Language exam thresholds (IELTS/TestDaF/DSH/etc.) must be met by
        # explicit exam evidence in this language rule.
        user = _get_user_score(state.get("exams", {}), exam_id, None)
        if user is None:
            continue
        avg_val = avg.get(exam_id) if exam_id in avg else None
        higher = _is_higher_better(exam_id)
        candidates.append(_score_requirement(user, min_val, avg_val, higher_is_better=higher, mode=mode))

    if not candidates:
        has_thresholds = (min_cefr is not None) or bool(req)
        if has_thresholds:
            if mode == "chance":
                return {"score": 0.55, "pass": True, "gap": 0.0, "conditional": True}
            return {"score": 0.15, "pass": False, "gap": 1.0, "conditional": True}
        return {
            "score": 0.55 if mode == "sort" else 0.30,
            "pass": mode == "sort",
            "gap": 1.0 if mode != "sort" else 0.0,
            "conditional": False,
        }

    best_score = max((x.get("score", 0.0) for x in candidates), default=0.0)
    passed = any(bool(x.get("pass")) for x in candidates)
    min_gap = min((x.get("gap", 1.0) for x in candidates), default=1.0)
    is_conditional = all(bool(x.get("conditional")) for x in candidates)
    return {
        "score": _clamp01(float(best_score)),
        "pass": passed,
        "gap": 0.0 if passed else float(min_gap),
        "conditional": is_conditional,
    }


def _admission_choice_key(choice: Dict[str, Any], idx: int) -> str:
    explicit = str(choice.get("choice_key", "")).strip()
    if explicit:
        return explicit
    category_id = str(choice.get("category_id", "")).strip()
    profile_id = str(choice.get("requirement_profile_id", "")).strip()
    funding_id = str(choice.get("funding_option_id", "")).strip()
    parts = [part for part in (category_id, profile_id, funding_id) if part]
    if parts:
        return "::".join(parts)
    cid = str(choice.get("id", "")).strip()
    if cid:
        return cid
    label = str(choice.get("label", "")).strip()
    if label:
        return f"label:{label}"
    return f"choice:{idx}"


def _normalize_selected_admission_choices(profile: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    if not isinstance(profile, dict):
        return {}
    raw = profile.get("selectedAdmissionChoices")
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for uni_id, selection in raw.items():
        uni = str(uni_id or "").strip()
        if not isinstance(selection, dict):
            continue
        normalized = {
            key: str(selection.get(key) or "").strip()
            for key in ("choiceKey", "programId", "programName", "categoryId", "requirementProfileId", "fundingOptionId")
            if str(selection.get(key) or "").strip()
        }
        if uni and normalized:
            out[uni] = normalized
    return out


def _selected_choice_key_for_university(profile: Dict[str, Any], university: Dict[str, Any]) -> str:
    selections = _normalize_selected_admission_choices(profile)
    uni_id = str((university or {}).get("id") or "").strip()
    if not uni_id:
        return ""
    return str(selections.get(uni_id, {}).get("choiceKey") or "").strip()


def _selected_program_id_for_university(profile: Dict[str, Any], university: Dict[str, Any]) -> str:
    selections = _normalize_selected_admission_choices(profile)
    uni_id = str((university or {}).get("id") or "").strip()
    return str(selections.get(uni_id, {}).get("programId") or "").strip() if uni_id else ""


def _choice_matches_applicant_route(choice: Dict[str, Any], target_route: Any) -> bool:
    expected = str(target_route or "").strip().lower()
    actual = str(choice.get("applicant_route") or "").strip().lower()
    return not expected or not actual or actual == expected


def _choice_matches_program(choice: Dict[str, Any], program_id: str) -> bool:
    if not program_id:
        return True
    raw_ids = choice.get("program_ids")
    ids = [str(value or "").strip().casefold() for value in raw_ids] if isinstance(raw_ids, list) else []
    ids = [value for value in ids if value]
    return not ids or program_id.casefold() in ids


def _choice_matches_entry_cycle(choice: Dict[str, Any], target_cycle: Any) -> bool:
    expected = _entry_cycle_parts(target_cycle)
    actual = _entry_cycle_parts(choice.get("cycle"))
    if not expected or not actual:
        return True
    if expected[0] is None or actual[0] is None:
        return True
    if expected[0] != actual[0]:
        return False
    return not (expected[1] and actual[1] and expected[1] != actual[1])


def _entry_cycle_parts(value: Any) -> Optional[Tuple[Optional[int], Optional[str]]]:
    text = " ".join(str(value or "").strip().casefold().replace("–", "-").replace("—", "-").split())
    if not text:
        return None
    if re.search(r"\b20\d{2}\s*[-/]\s*\d{2,4}\b", text):
        return (None, None)
    years = re.findall(r"(?<!\d)(20\d{2})(?!\d)", text)
    # Academic-year ranges can refer to an application cycle or an entry year;
    # without a more specific schema field their relationship is unknown.
    if len(set(years)) != 1:
        return (None, None)
    year = int(years[0]) if years else None
    seasons = [
        season for season, pattern in (
            ("spring", r"\bspring\b"),
            ("summer", r"\b(?:summer)\b"),
            ("fall", r"\b(?:fall|autumn)\b"),
            ("winter", r"\bwinter\b"),
        ) if re.search(pattern, text)
    ]
    if len(seasons) > 1:
        return (None, None)
    if year is None and not seasons:
        return (None, None)
    return (year, seasons[0] if seasons else None)


def _cost_cycle_mismatch(cost_source: Any, intended_entry_cycle: Any) -> bool:
    target = _entry_cycle_parts(intended_entry_cycle)
    if not isinstance(cost_source, dict) or not target or target[0] is None:
        return False
    cycle = cost_source.get("academic_year") or cost_source.get("cycle") or cost_source.get("tuition_cycle")
    if not cycle:
        cost_range = cost_source.get("cost_range")
        cycle = cost_range.get("academic_year") if isinstance(cost_range, dict) else None
    text = " ".join(str(cycle or "").strip().casefold().replace("–", "-").replace("—", "-").split())
    if not text:
        return False
    range_match = re.search(r"\b(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})\b", text)
    if range_match:
        start = int(range_match.group(1))
        end_text = range_match.group(2)
        end = int(end_text) if len(end_text) == 4 else (start // 100) * 100 + int(end_text)
        if end < start:
            end += 100
        target_year, target_season = target
        if target_season == "spring":
            return target_year != end
        if target_season == "summer":
            return target_year not in {start, end}
        if target_season == "winter":
            return False
        return target_year != start
    years = re.findall(r"(?<!\d)(20\d{2})(?!\d)", text)
    return len(set(years)) == 1 and int(years[0]) != target[0]


def _known_program_ids(university: Dict[str, Any], choices: List[Dict[str, Any]]) -> set[str]:
    ids = {
        str(value or "").strip().casefold()
        for choice in choices
        for value in (choice.get("program_ids") if isinstance(choice.get("program_ids"), list) else [])
    }
    academics = university.get("academics") if isinstance(university, dict) else None
    programs = academics.get("programs") if isinstance(academics, dict) else None
    if isinstance(programs, list):
        ids.update(
            str(program.get("id") or "").strip().casefold()
            for program in programs if isinstance(program, dict) and program.get("id")
        )
    ids.discard("")
    return ids


def _choice_result_by_key(rows: List[Dict[str, Any]], choice_key: Any) -> Optional[Dict[str, Any]]:
    wanted = str(choice_key or "").strip()
    if not wanted:
        return None
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("choiceKey") or "").strip() == wanted:
            return row
    return None


def _chance_level(chance_pct: float) -> Dict[str, str]:
    if chance_pct >= 100:
        return {"id": "all_met", "label": "All published requirements met"}
    if chance_pct >= 80:
        return {"id": "mostly_met", "label": "Most published requirements met"}
    if chance_pct > 0:
        return {"id": "some_met", "label": "Some published requirements met"}
    return {"id": "none_met", "label": "No published requirements met"}


def _chance_locale(profile: Dict[str, Any]) -> str:
    raw = str((profile or {}).get("locale") or "").strip().lower()
    return "rus" if raw.startswith("ru") else "eng"


def _chance_no_data_label(reason: str, profile: Dict[str, Any]) -> str:
    labels = {
        "eng": {
            "missing_evidence": "Add exam scores or language evidence",
            "requirements_not_met": "A required minimum is not met",
            "missing_exam_score": "Need exam data to see the chance for this track",
            "unsupported_exam_normalization": "Track score data is not yet comparable",
            "no_score_profile": "No admitted-score data",
            "no_published_requirements": "No measurable published minimums for this route",
            "unassessed_minimums": "Published minimums cannot be assessed from the available GPA profile fields",
            "requirements_not_reviewed": "Published minimums have not yet been reviewed for this route",
        },
        "rus": {
            "missing_evidence": "Добавьте результаты экзаменов или языковые данные",
            "requirements_not_met": "Не выполнен обязательный минимум",
            "missing_exam_score": "Нужны данные по экзамену, чтобы оценить шанс по этому варианту поступления",
            "unsupported_exam_normalization": "Пока нельзя корректно сопоставить ваш экзамен с этим вариантом поступления",
            "no_score_profile": "Нет данных о баллах зачисленных",
            "no_published_requirements": "Для этого варианта нет измеримых опубликованных минимумов",
            "unassessed_minimums": "Опубликованные минимумы нельзя оценить по доступным полям GPA в профиле",
            "requirements_not_reviewed": "Опубликованные минимумы для этого маршрута ещё не проверены",
        },
    }
    locale = _chance_locale(profile)
    if locale == "rus" and reason == "missing_exam_score":
        return "Нужны данные по экзаменам, чтобы оценить шанс по этому варианту поступления"
    return str((labels.get(locale) or labels["eng"]).get(reason) or (labels.get(locale) or labels["eng"])["no_score_profile"])


def _no_data_chance_level(profile: Dict[str, Any]) -> Dict[str, str]:
    return {
        "id": "no_data",
        "label": "Нет данных" if _chance_locale(profile) == "rus" else "No data",
    }


def _published_requirements_for_choice(
    university: Dict[str, Any], choice: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], str]:
    """Return scored requirements and published minimums the profile cannot assess."""
    categories = university.get("admission_categories")
    if not isinstance(categories, list):
        return {}, [], ""
    category_id = str(choice.get("category_id") or "")
    profile_id = str(choice.get("requirement_profile_id") or "")
    for category in categories:
        if not isinstance(category, dict) or str(category.get("id") or "") != category_id:
            continue
        profiles = category.get("requirement_profiles")
        profile_rows = [row for row in profiles if isinstance(row, dict)] if isinstance(profiles, list) else []
        if not profile_rows:
            profile_rows = [{"id": "general"}]
        for profile_row in profile_rows:
            if str(profile_row.get("id") or "") != profile_id:
                continue
            requirements: Dict[str, Any] = {}
            for source in (category, profile_row):
                raw = source.get("requirements")
                if isinstance(raw, dict):
                    requirements.update(raw)
            unassessed = profile_row.get("unassessed_published_minimums")
            review_status = str(profile_row.get("requirements_review_status") or "")
            return requirements, [row for row in unassessed if isinstance(row, dict)] if isinstance(unassessed, list) else [], review_status
    return {}, [], ""


def _published_requirements_fit(
    *,
    university: Dict[str, Any],
    choice: Dict[str, Any],
    user_scores: Dict[str, Any],
    user_languages: Dict[str, Any],
    lang_cfg: Dict[str, Any],
) -> Tuple[Optional[int], str, int]:
    """Score the share of measurable published minimum checks that are met."""
    checks: List[bool] = []
    requirements, unassessed_minimums, review_status = _published_requirements_for_choice(university, choice)
    if review_status == "not_reviewed":
        return None, "requirements_not_reviewed", 0
    language_rules = _collect_language_requirements(choice)
    has_language_rules = bool(language_rules.get("items"))

    for exam_id, raw_minimum in requirements.items():
        if has_language_rules and _is_language_exam_key(exam_id):
            continue
        minimum = _normalize_gpa_score(raw_minimum) if str(exam_id).strip().upper() == "GPA" else _to_num(raw_minimum)
        if minimum is None:
            continue
        user_value = _get_user_score(
            user_scores, exam_id, None if _is_language_exam_key(exam_id) else user_languages
        )
        if user_value is None:
            return None, "missing_evidence", len(checks)
        result = _score_requirement(
            user_value,
            minimum,
            None,
            higher_is_better=_is_higher_better(exam_id),
            mode="chance",
        )
        checks.append(bool(result.get("pass")))

    measurable_language_rules = []
    for rule in language_rules.get("items", []):
        if not isinstance(rule, dict):
            continue
        raw_requirements = rule.get("requirements")
        if not isinstance(raw_requirements, dict):
            raw_requirements = rule.get("exams")
        measurable = bool(rule.get("accept_native")) or _to_num(rule.get("min_cefr")) is not None
        measurable = measurable or (
            isinstance(raw_requirements, dict)
            and any(_to_num(value) is not None for value in raw_requirements.values())
        )
        if measurable:
            measurable_language_rules.append(rule)

    if language_rules.get("mode") == "any" and measurable_language_rules:
        results = [
            _score_single_language_rule(rule, user_languages, lang_cfg, mode="chance")
            for rule in measurable_language_rules
        ]
        if any(bool(result.get("pass")) and not bool(result.get("conditional")) for result in results):
            checks.append(True)
        elif any(bool(result.get("conditional")) for result in results):
            return None, "missing_evidence", len(checks)
        else:
            checks.append(False)
    else:
        for rule in measurable_language_rules:
            result = _score_single_language_rule(rule, user_languages, lang_cfg, mode="chance")
            if bool(result.get("conditional")):
                return None, "missing_evidence", len(checks)
            checks.append(bool(result.get("pass")))

    if not checks:
        if unassessed_minimums:
            return None, "unassessed_minimums", 0
        return None, "no_published_requirements", 0
    return int(round(100 * sum(checks) / len(checks))), "", len(checks)


def _chance_percent_value(value: Any) -> Optional[float]:
    parsed = _to_num(value)
    if parsed is None:
        return None
    return _clamp(float(parsed), 0.0, 100.0)


def _preference01(value: Any, fallback: float = 50.0) -> float:
    return _clamp01(_to_num_default(value, fallback) / 100.0)


def _factor01(value: Any, fallback: float = 0.5) -> float:
    parsed = _to_num(value)
    if parsed is None:
        return _clamp01(fallback)
    if parsed > 1.0:
        parsed = parsed / 100.0
    return _clamp01(float(parsed))


def _acceptance_percent(university: Dict[str, Any]) -> Optional[float]:
    academics = university.get("academics")
    if not isinstance(academics, dict):
        academics = {}
    direct = _to_num(academics.get("acceptance_rate_percent"))
    if direct is not None:
        return _clamp(float(direct), 0.0, 100.0)
    programs = academics.get("programs")
    if not isinstance(programs, list):
        return None
    vals = []
    for row in programs:
        if not isinstance(row, dict):
            continue
        v = _to_num(row.get("acceptance_rate_percent"))
        if v is not None:
            vals.append(_clamp(float(v), 0.0, 100.0))
    if not vals:
        return None
    return float(sum(vals) / len(vals))


def _fallback_practice_vs_science(university: Dict[str, Any]) -> float:
    tags = university.get("tags") or []
    tags_str = " ".join(str(t) for t in tags) if isinstance(tags, list) else str(tags or "")
    major_focus = university.get("major_focus") or []
    major_focus_str = " ".join(str(m) for m in major_focus) if isinstance(major_focus, list) else str(major_focus or "")
    text = " ".join(
        [
            str(university.get("name") or ""),
            str(university.get("description") or ""),
            str((((university.get("academics") or {}).get("focus_areas")) or "")),
            tags_str,
            major_focus_str,
        ]
    ).lower()
    research_tokens = (
        "research", "science", "laboratory", "fundamental", "theory", "phd",
        "исследован", "научн", "фундаментальн", "лаборатор", "теория", "академическ",
    )
    practice_tokens = (
        "practice", "industry", "internship", "applied", "career", "startup", "business",
        "практик", "индустр", "стажировк", "прикладн", "карьер", "стартап", "бизнес",
    )
    score = 0.5 + (0.06 * sum(1 for token in research_tokens if token in text)) - (0.06 * sum(1 for token in practice_tokens if token in text))
    rank = _to_num(university.get("rank"))
    if rank is not None and rank <= 10:
        score += 0.05
    return _clamp01(score)


def _fallback_social_vs_hardcore(university: Dict[str, Any], study_level: Any = "any") -> float:
    target_level = _normalize_study_level_str(study_level)
    acceptance = None if target_level in {"master", "mba", "doctorate"} else _acceptance_percent(university)
    strictness = 0.55 if acceptance is None else _clamp01(1.0 - (acceptance / 100.0))
    rank = _to_num(university.get("rank"))
    rank_boost = 0.0
    if rank is not None and rank > 0:
        rank_boost = _clamp01(1.0 - ((rank - 1.0) / 200.0)) * 0.18
    return _clamp01(0.30 + 0.60 * strictness + rank_boost)


def _fallback_budget_vs_prestige(university: Dict[str, Any]) -> float:
    finance = university.get("finance")
    finance = finance if isinstance(finance, dict) else {}
    cost_raw = _to_num(finance.get("total_cost_year_usd"))
    currency = str(finance.get("currency") or "USD").strip().upper()
    cost_usd = _cost_to_usd(cost_raw, currency) if cost_raw is not None else None
    cost_norm = 0.45 if cost_usd is None else _clamp01(float(cost_usd) / 100000.0)
    rank = _to_num(university.get("rank"))
    rank_prestige = 0.5
    if rank is not None and rank > 0:
        # Smooth logarithmic prestige scaling across top 1000 universities
        rank_prestige = _clamp01(1.0 - (math.log1p(max(0.0, float(rank) - 1.0)) / math.log1p(1000.0)))
    return _clamp01(0.50 * cost_norm + 0.50 * rank_prestige)


def _fallback_city_vs_outside_city(university: Dict[str, Any]) -> float:
    factors_meta = university.get("factors_meta")
    factors_meta = factors_meta if isinstance(factors_meta, dict) else {}
    raw_metrics = factors_meta.get("raw_metrics")
    raw_metrics = raw_metrics if isinstance(raw_metrics, dict) else {}
    city_meta = raw_metrics.get("city")
    city_meta = city_meta if isinstance(city_meta, dict) else {}

    population = _to_num(city_meta.get("population"))
    if population is None:
        population = _to_num(city_meta.get("population_wikidata_fallback"))
    if population is None:
        return 0.5

    # Convert city population to location preference axis:
    # 0.0 -> major city life, 1.0 -> outside major cities.
    # Uses only traceable numeric city-population metrics from factors_meta.
    max_reference_population = 20_000_000.0
    city_intensity = _clamp01(math.log1p(max(0.0, float(population))) / math.log1p(max_reference_population))
    return _clamp01(1.0 - city_intensity)


_FACTORS_CACHE: Dict[str, Dict[str, float]] = {}
_CHOICES_CACHE: Dict[str, List[Dict[str, Any]]] = {}


def _extract_university_factors(university: Dict[str, Any], study_level: Any = "any") -> Dict[str, float]:
    uid = str(university.get("id") or "").strip()
    target_level = _normalize_study_level_str(study_level)
    cache_key = f"{uid}:{target_level}"
    if uid and cache_key in _FACTORS_CACHE:
        return _FACTORS_CACHE[cache_key]

    raw = university.get("factors")
    raw = raw if isinstance(raw, dict) else {}
    res = {
        "practice_vs_science": _factor01(raw.get("practice_vs_science"), _fallback_practice_vs_science(university)),
        "social_vs_hardcore": _factor01(raw.get("social_vs_hardcore"), _fallback_social_vs_hardcore(university, target_level)),
        "budget_vs_prestige": _factor01(raw.get("budget_vs_prestige"), _fallback_budget_vs_prestige(university)),
        "city_vs_campus": _factor01(raw.get("city_vs_campus"), _fallback_city_vs_outside_city(university)),
    }
    if uid:
        _FACTORS_CACHE[cache_key] = res
    return res


def _distance_breakdown(user_pref: Dict[str, float], uni_factors: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
    deltas = {
        "practice_vs_science": abs(float(user_pref["practice_vs_science"]) - float(uni_factors["practice_vs_science"])),
        "social_vs_hardcore": abs(float(user_pref["social_vs_hardcore"]) - float(uni_factors["social_vs_hardcore"])),
        "budget_vs_prestige": abs(float(user_pref["budget_vs_prestige"]) - float(uni_factors["budget_vs_prestige"])),
        "city_vs_campus": abs(float(user_pref["city_vs_campus"]) - float(uni_factors["city_vs_campus"])),
    }
    total_distance = float(sum(deltas.values()))
    return total_distance, deltas


def _build_ui_badge_hints(
    *,
    preference_mismatch: Any,
    conditional: Any,
    conditional_requirements: Any,
    meets_min_requirements: bool = False,
    below_requirements: bool = False,
    budget_status: str = "not_set",
    aid_any: bool = False,
    missing_program: bool = False,
) -> Dict[str, Any]:
    mismatch01 = _clamp01(_to_num_default(preference_mismatch, 1.0))
    conditional_count = max(0, int(_to_num_default(conditional_requirements, 0.0)))
    show_conditional = bool(conditional) and conditional_count > 0

    # 1. Preference match group (mutually exclusive)
    vibe = ""
    if mismatch01 <= float(_UI_BADGE_THRESHOLDS["your_vibe_max_mismatch"]):
        vibe = "your_vibe"
    elif mismatch01 <= float(_UI_BADGE_THRESHOLDS["top_match_max_mismatch"]):
        vibe = "top_match"

    # 2. Requirements state group (mutually exclusive; conditional suppresses requirements_met)
    requirements = ""
    if below_requirements:
        requirements = "below_requirements"
    elif meets_min_requirements and not show_conditional:
        requirements = "requirements_met"

    # 3. Budget & aid state group (mutually exclusive)
    budget_aid = ""
    over_budget = budget_status == "over_budget"
    if over_budget:
        budget_aid = "over_budget_aid" if aid_any else "over_budget"
    elif aid_any:
        budget_aid = "aid_available"

    return {
        "showConditionalExamNeeded": show_conditional,
        "showMissingProgram": bool(missing_program),
        "missingProgram": bool(missing_program),
        "vibe": vibe,
        "finance": "",
        "requirements": requirements,
        "budgetAid": budget_aid,
        "priorityOrder": [
            "missing_program",
            "conditional_exam_needed",
            "your_vibe",
            "top_match",
            "below_requirements",
            "requirements_met",
            "over_budget_aid",
            "over_budget",
            "aid_available",
        ],
        "metrics": {
            "preferenceMismatch": round(mismatch01, 4),
            "conditionalRequirements": conditional_count,
            "budgetStatus": budget_status,
            "meetsMinRequirements": meets_min_requirements,
            "belowRequirements": below_requirements,
            "missingProgram": bool(missing_program),
            "overBudget": over_budget,
            "aidAny": aid_any,
        },
        "thresholds": dict(_UI_BADGE_THRESHOLDS),
    }


def sort_universities_ai(
    items: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]] = None,
    practice_vs_science: Any = None,
    social_vs_hardcore: Any = None,
    budget_vs_prestige: Any = None,
    city_vs_campus: Any = None,
    ai_balance: Any = 50,
    admission_bias: Any = 50,
    funding_type: Any = "any",
) -> List[Dict[str, Any]]:
    profile = profile if isinstance(profile, dict) else {}
    lang_cfg = _language_config()
    ctx = _build_user_context(profile, lang_cfg)
    preferred_mode = _normalize_study_mode(
        profile.get("studyMode")
        or profile.get("study_mode")
        or profile.get("format")
        or "any"
    )
    user_pref = {
        "practice_vs_science": _preference01(practice_vs_science, 50.0),
        "social_vs_hardcore": _preference01(
            social_vs_hardcore if social_vs_hardcore is not None else admission_bias,
            50.0,
        ),
        "budget_vs_prestige": _preference01(
            budget_vs_prestige if budget_vs_prestige is not None else ai_balance,
            50.0,
        ),
        "city_vs_campus": _preference01(city_vs_campus, 50.0),
    }
    profile_any = dict(profile)
    profile_any["fundingType"] = "any"
    profile_any["funding_type"] = "any"
    interest_text = str(profile.get("interests") or "").strip()
    profile_major = str(profile.get("major") or "").strip()

    ml_scores_by_id: Dict[str, float] = {}
    ml_status = (
        get_ml_runtime_status()
        if interest_text
        else {"available": False, "message": "", "mode": "disabled", "reason": "empty_interest"}
    )
    ml_available = bool(ml_status.get("available"))
    ml_runtime_mode = str(ml_status.get("mode") or "unavailable")
    ml_unavailable_warning = bool(interest_text) and not ml_available
    ml_warning_message = str(ml_status.get("message") or "") if ml_unavailable_warning else ""
    use_ml = bool(interest_text) and ml_available
    if use_ml:
        try:
            ml_scores_by_id = get_ml_recommender().predict_relevance(interest_text)
        except Exception:
            ml_scores_by_id = {}
            use_ml = False
            ml_available = False
            ml_runtime_mode = "unavailable"
            ml_unavailable_warning = bool(interest_text)
            ml_warning_message = "Machine Learning unavailable"

    enriched: List[Dict[str, Any]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        row_id = str(row.get("id") or "").strip()
        choices = universities_service.expand_admission_choices(row.get("admission_categories"))
        choices = [t for t in choices if isinstance(t, dict)]
        target_level = _normalize_study_level_str(
            profile.get("studyLevel") or profile.get("study_level") or ""
        )
        target_route = profile.get("applicant_route")
        target_cycle = profile.get("intended_entry_cycle")
        selected_program_id = _selected_program_id_for_university(profile, row)
        if selected_program_id.casefold() not in _known_program_ids(row, choices):
            selected_program_id = ""
        eligible_choices = [
            (idx, choice)
            for idx, choice in enumerate(choices)
            if (target_level == "any" or _choice_matches_study_level(choice, target_level))
            and _choice_matches_applicant_route(choice, target_route)
            and _choice_matches_entry_cycle(choice, target_cycle)
            and _choice_matches_program(choice, selected_program_id)
        ]
        selected_choice_key = _selected_choice_key_for_university(profile, row)

        uni_factors = _extract_university_factors(row, target_level)
        total_distance, distance_deltas = _distance_breakdown(user_pref, uni_factors)
        preference_mismatch = _clamp01(
            (
                float(distance_deltas.get("practice_vs_science", 0.0))
                + float(distance_deltas.get("social_vs_hardcore", 0.0))
                + float(distance_deltas.get("city_vs_campus", 0.0))
                + float(distance_deltas.get("budget_vs_prestige", 0.0))
            )
            / 4.0
        )

        chance_general = estimate_uni_chance(row, profile_any, user_context=ctx, lang_cfg=lang_cfg)
        active_chance_bundle = chance_general
        general_choice_results = chance_general.get("choices") if isinstance(chance_general.get("choices"), list) else []
        selected_general_choice = _choice_result_by_key(general_choice_results, selected_choice_key)
        selected_actual_chance = _chance_percent_value(chance_general.get("overallChance"))

        # Check if user explicitly chose a track for this university
        selected_by_user = bool(chance_general.get("selectedByUser")) and selected_general_choice is not None
        selected_raw_choice = None
        if selected_choice_key and eligible_choices:
            for idx, c in eligible_choices:
                if _admission_choice_key(c, idx) == selected_choice_key:
                    selected_raw_choice = c
                    break

        if selected_by_user and selected_raw_choice is not None:
            selected_actual_chance = _chance_percent_value((selected_general_choice or {}).get("chancePercent"))

        missing_program = bool(profile_major) and not _university_matches_major(row, profile_major)
        program_missing_penalty = 0.25 if missing_program else 0.0

        row_ml_score = _clamp01(float(ml_scores_by_id.get(row_id, 0.0))) if use_ml else 0.0
        hard_score = _clamp01(1.0 - preference_mismatch)

        # Resolve the active admission choice
        recommended_choice_key = str(chance_general.get("recommendedChoiceKey") or chance_general.get("bestChoiceKey") or "")
        recommended_choice_id = str(chance_general.get("recommendedChoiceId") or chance_general.get("bestChoiceId") or "")
        recommended_choice_label = str(chance_general.get("recommendedChoiceLabel") or chance_general.get("bestChoiceLabel") or "")

        active_choice_key = selected_choice_key if (selected_by_user and selected_choice_key) else (
            str(active_chance_bundle.get("bestChoiceKey") or recommended_choice_key)
        )

        active_raw_choice: Dict[str, Any] = {}
        if eligible_choices:
            for idx, c in eligible_choices:
                if _admission_choice_key(c, idx) == active_choice_key:
                    active_raw_choice = c
                    break
            if not active_raw_choice:
                active_idx, active_raw_choice = eligible_choices[0]
                active_choice_key = _admission_choice_key(active_raw_choice, active_idx)

        base_choices = universities_service.expand_admission_choices(
            row.get("admission_categories"), include_funding=False
        )
        base_raw_choice = next(
            (
                choice for choice in base_choices
                if choice.get("category_id") == active_raw_choice.get("category_id")
                and choice.get("requirement_profile_id") == active_raw_choice.get("requirement_profile_id")
            ),
            active_raw_choice,
        )

        # Active choice chance metadata
        choice_meta_list = active_chance_bundle.get("choices") if isinstance(active_chance_bundle.get("choices"), list) else []
        active_choice_meta = _choice_result_by_key(choice_meta_list, active_choice_key) or {}

        if not eligible_choices and (target_level != "any" or target_route or target_cycle or selected_program_id):
            finance = row.get("finance") if isinstance(row.get("finance"), dict) else {}
            cost_usd, cost_native = 0.0, 0.0
            cost_currency, cost_mode = str(finance.get("currency") or "USD").strip().upper(), "unavailable"
        else:
            cost_usd, cost_native, cost_currency, cost_mode = _effective_track_cost_details(
                row, base_raw_choice, preferred_mode=preferred_mode,
                intended_entry_cycle=target_cycle,
            )
        aid_any = _get_track_funding_type(active_raw_choice) == "grant"

        cost_range_payload = (
            _track_cost_range_payload(row, base_raw_choice)
            if cost_mode == "on-campus_range"
            else None
        )
        cost_unavailable = cost_mode in {
            "unavailable",
            "online_missing_tuition",
            "on-campus_range",
        }
        final_price_native = None if cost_unavailable else cost_native

        final_price_usd = None if final_price_native is None else _cost_to_usd(final_price_native, cost_currency)

        budget = ctx["budget"]
        affordability_gap = None
        budget_status = "not_set"
        if budget is not None and budget > 0:
            budget_status = "unknown_cost"
            if cost_mode == "on-campus_range" and isinstance(cost_range_payload, dict):
                min_usd = _to_num(cost_range_payload.get("minUSD"))
                max_usd = _to_num(cost_range_payload.get("maxUSD"))
                if min_usd is not None and min_usd > budget:
                    affordability_gap = _clamp01(1.0 - (budget / min_usd))
                    budget_status = "over_budget"
                elif max_usd is not None and max_usd <= budget:
                    affordability_gap = 0.0
                    budget_status = "within_budget"
                elif min_usd is not None and max_usd is not None:
                    budget_status = "uncertain_range"
            elif not cost_unavailable and final_price_usd is not None:
                affordability_gap = (
                    _clamp01(1.0 - (budget / final_price_usd))
                    if final_price_usd > budget else 0.0
                )
                budget_status = "over_budget" if final_price_usd > budget else "within_budget"

        requirements_gap = (
            _clamp01(1.0 - selected_actual_chance / 100.0)
            if selected_actual_chance is not None else None
        )
        components = [(0.35 if use_ml else 0.60, preference_mismatch)]
        if requirements_gap is not None:
            components.append((0.30 if use_ml else 0.40, requirements_gap))
        if use_ml:
            components.append((0.35, _clamp01(1.0 - row_ml_score)))
        if affordability_gap is not None:
            components.append((0.20, affordability_gap))
        major_penalty = (
            0.20 * _clamp01((0.05 - row_ml_score) / 0.05)
            if use_ml and interest_text and row_ml_score < 0.05 else 0.0
        )
        final_score = _clamp01(
            sum(weight * value for weight, value in components) / sum(weight for weight, _ in components)
            + major_penalty + program_missing_penalty
        )

        active_fit_percent = _chance_percent_value(active_choice_meta.get("chancePercent"))
        below_req = active_fit_percent is not None and active_fit_percent < 100
        meet_min_req = active_fit_percent == 100
        is_conditional = active_choice_meta.get("reason") == "missing_evidence"
        conditional_count = 1 if is_conditional else 0

        effective_selected_by_user = selected_by_user and active_choice_key != recommended_choice_key
        has_uni_aid = bool(row.get("aid_any")) or aid_any

        ui_badge_hints = _build_ui_badge_hints(
            preference_mismatch=preference_mismatch,
            conditional=is_conditional,
            conditional_requirements=conditional_count,
            meets_min_requirements=meet_min_req,
            below_requirements=below_req,
            budget_status=budget_status,
            aid_any=has_uni_aid,
            missing_program=missing_program,
        )

        choice_id = str(active_raw_choice.get("id") or active_choice_meta.get("choiceId") or "default")
        choice_label = str(active_raw_choice.get("label") or active_choice_meta.get("choiceLabel") or "General admission")

        match_data = {
            "choiceKey": active_choice_key,
            "choiceId": choice_id,
            "choiceLabel": choice_label,
            "categoryId": str(active_raw_choice.get("category_id") or ""),
            "requirementProfileId": str(active_raw_choice.get("requirement_profile_id") or ""),
            "fundingOptionId": str(active_raw_choice.get("funding_option_id") or ""),
            "finalPrice": final_price_native,
            "finalPriceUSD": final_price_usd,
            "currency": cost_currency,
            "aidAny": aid_any,
            "aidEligible": None,
            "grantName": str(active_raw_choice.get("funding_program") or "") if aid_any else "",
            "admitChance": None,
            "requirementsFitPercent": selected_actual_chance,
            "scoreMeaning": "published_requirements_met_percent",
            "meetMinRequirements": meet_min_req,
            "missingRequiredEvidence": is_conditional,
            "missingProgram": missing_program,
            "conditional": is_conditional,
            "conditionalRequirements": conditional_count,
            "costYearUSD": None if cost_unavailable else cost_usd,
            "costYearNative": None if cost_unavailable else cost_native,
            "grantPotential": None,
            "grantEligible": None,
            "hardScore": hard_score,
            "distanceScore": _clamp01(1.0 - preference_mismatch),
            "totalDistance": total_distance,
            "distanceDeltas": distance_deltas,
            "preferenceMismatch": preference_mismatch,
            "admissionRisk": None,
            "requirementsGap": requirements_gap,
            "selectedChance": int(round(selected_actual_chance)) if selected_actual_chance is not None else None,
            "selectedChanceType": "requirements_fit",
            "grantChance": None,
            "generalChance": None,
            "uiBadgeHints": ui_badge_hints,
            "factors": uni_factors,
            "userPreferences": user_pref,
            "mlScore": row_ml_score,
            "mlMode": ml_runtime_mode if use_ml else "disabled",
            "mlSemanticScore": row_ml_score if (use_ml and ml_runtime_mode == "semantic") else 0.0,
            "finalScore": final_score,
            "budgetStatus": budget_status,
            "affordabilityGap": affordability_gap,
            "interestScope": "university" if use_ml else "unavailable",
            "mlEnabled": bool(interest_text),
            "mlApplied": use_ml,
            "mlAvailable": ml_available,
            "mlUnavailable": ml_unavailable_warning,
            "mlWarning": ml_warning_message,
            "mlReason": str(ml_status.get("reason") or ""),
            "mlModel": str(ml_status.get("semanticModel") or ml_status.get("semanticModelConfigured") or ""),
            "costMode": cost_mode,
            "costRange": cost_range_payload,
            "recommendedChoiceKey": recommended_choice_key,
            "recommendedChoiceId": recommended_choice_id,
            "recommendedChoiceLabel": recommended_choice_label,
            "selectedChoiceKey": active_choice_key,
            "selectedChoiceId": choice_id,
            "selectedChoiceLabel": choice_label,
            "selectedByUser": effective_selected_by_user,
            "choiceSelectionSource": "user" if effective_selected_by_user else "recommended",
        }

        item = dict(row)
        item["matchData"] = match_data
        item["__ai_score"] = final_score
        item["__distance"] = preference_mismatch
        enriched.append(item)

    enriched.sort(
        key=lambda u: (
            float(u.get("__ai_score", 1.0)),
            str((u.get("matchData") or {}).get("budgetStatus") or "") in {"unknown_cost", "uncertain_range"},
            float(u.get("__distance", 1.0)),
            -float(_to_num(((u.get("matchData") or {}).get("selectedChance"))) or 0.0),
            float(_to_num(u.get("rank")) or 999999.0),
            -float(_to_num(((u.get("matchData") or {}).get("admitChance"))) or 0.0),
            float(_to_num(((u.get("matchData") or {}).get("finalPriceUSD") or ((u.get("matchData") or {}).get("finalPrice")))) or 1e18),
        )
    )

    out = []
    for row in enriched:
        cleaned = dict(row)
        cleaned.pop("__ai_score", None)
        cleaned.pop("__distance", None)
        out.append(cleaned)
    return out


def _choice_text_blob(choice: Dict[str, Any]) -> str:
    parts: List[str] = []
    for key in (
        "id",
        "choice_key",
        "label",
        "description",
        "category_label",
        "requirement_profile_label",
        "funding_program",
        "funding_source",
        "track_badge",
    ):
        value = choice.get(key)
        if isinstance(value, str):
            parts.append(value)
    return " ".join(parts).lower()


def _track_verified_badges(choice: Dict[str, Any]) -> List[str]:
    blob = _choice_text_blob(choice)
    badges: List[str] = []
    if "need-blind" in blob or "need blind" in blob:
        badges.append("need_blind")
    return badges


def _chance_factor(
    key: str,
    status: str,
    label: str,
    message: str,
    severity: str = "medium",
) -> Dict[str, str]:
    return {
        "key": key,
        "status": status,
        "label": label,
        "message": message,
        "severity": severity,
    }


def _build_chance_factors(
    *,
    score_percent: Optional[int],
    reason: str,
) -> List[Dict[str, str]]:
    if score_percent is None:
        if reason in {"unassessed_minimums", "requirements_not_reviewed"}:
            return []
        key = "missing_evidence" if reason == "missing_evidence" else "insufficient_data"
        label = "Required evidence" if key == "missing_evidence" else "Published requirements"
        message = (
            "Add the missing evidence required to check this route."
            if key == "missing_evidence"
            else "This route has no measurable published minimums."
        )
        return [_chance_factor(key, "neutral", label, message, "medium")]
    if score_percent == 100:
        return [_chance_factor("requirements_met", "positive", "Requirements", "All measurable published minimums are met.", "low")]
    return [_chance_factor("requirements_gap", "negative", "Requirements", "Some measurable published minimums are not met.", "medium")]


def _normalize_study_level_str(val: Any) -> str:
    s = str(val or "").strip().lower()
    if not s or s == "any":
        return "any"
    tokens = set(re.sub(r"[^a-z0-9]+", " ", s).split())
    if "mba" in tokens or "master of business administration" in s:
        return "mba"
    if tokens.intersection({"master", "masters", "msc", "ma", "meng", "graduate", "postgrad"}):
        return "master"
    if tokens.intersection({"undergrad", "undergraduate", "bachelor", "bsc", "ba"}) or "first-year" in s or "first_year" in s:
        return "bachelor"
    if tokens.intersection({"doctor", "doctoral", "doctorate", "phd", "dphil"}):
        return "doctorate"
    return s


def _choice_matches_study_level(choice: Dict[str, Any], target_level: str) -> bool:
    if not target_level or target_level == "any":
        return True
    raw_levels = choice.get("study_levels")
    levels = [_normalize_study_level_str(x) for x in raw_levels] if isinstance(raw_levels, list) else []
    if not levels and choice.get("study_level"):
        levels = [_normalize_study_level_str(choice.get("study_level"))]
    raw_scope = choice.get("scope")
    if isinstance(raw_scope, dict):
        scope_values = [str(value or "") for value in raw_scope.values()]
        scope_level = _normalize_study_level_str(raw_scope.get("level"))
    else:
        scope_values = [str(raw_scope or "")]
        scope_text = str(raw_scope or "").strip().lower()
        if scope_text.startswith(("doctoral", "doctorate", "postgraduate_research", "postgraduate research")):
            scope_level = "doctorate"
        elif scope_text.startswith(("graduate", "postgraduate_taught", "postgraduate taught")):
            scope_level = "master"
        else:
            scope_level = _normalize_study_level_str(raw_scope)
    scope = " ".join(scope_values).strip().lower()
    if scope_level not in {"bachelor", "master", "mba", "doctorate"}:
        scope_level = "any"

    if target_level == "mba":
        if "mba" in levels:
            return True
        if levels and not {"master", "mba"}.intersection(levels):
            return False
        description = " ".join(str(choice.get(key) or "") for key in (
            "category_id", "category_label", "label", "program_name", "description", "scope",
        ))
        return bool(re.search(r"\bmba\b|master of business administration", description, re.IGNORECASE))

    # Explicitly scoped levels are authoritative. Use scope only for legacy
    # categories that predate study_levels, where it is the remaining signal.
    if levels:
        if target_level == "master":
            return bool({"master", "mba"}.intersection(levels))
        return target_level in levels

    if scope_level != "any":
        if target_level == "master" and scope_level == "mba":
            return True
        if scope_level != target_level:
            return False
        return True

    if target_level == "bachelor":
        if any(value.strip().lower() in {"general", "program", "program_group"} for value in scope_values):
            return True
        return scope.startswith(("undergraduate", "bachelor", "first-year", "first year"))

    if target_level == "master":
        return scope.startswith(("graduate", "postgraduate_taught", "postgraduate taught"))

    if target_level == "doctorate":
        return scope.startswith(("doctoral", "doctorate", "postgraduate_research", "postgraduate research"))

    return bool(scope and _normalize_study_level_str(scope) == target_level)


def estimate_uni_chance(
    university: Dict[str, Any],
    profile: Optional[Dict[str, Any]] = None,
    *,
    user_context: Optional[Dict[str, Any]] = None,
    lang_cfg: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    lang_cfg = lang_cfg if isinstance(lang_cfg, dict) else _language_config()
    ctx = user_context if isinstance(user_context, dict) else _build_user_context(profile, lang_cfg)
    funding_type = _normalize_funding_preference(profile.get("fundingType") or profile.get("funding_type") or "any")

    uid = str(university.get("id") or "").strip()
    choices = _CHOICES_CACHE.get(uid) if uid else None
    if choices is None:
        choices = universities_service.expand_admission_choices(university.get("admission_categories"))
        if not choices:
            choices = [{"id": "default", "choice_key": "default", "label": "General admission", "requirements": {}, "stats_avg": {}}]
        choices = [choice for choice in choices if isinstance(choice, dict)]
        if uid:
            _CHOICES_CACHE[uid] = choices
    entries = [{"choice": choice, "idx": idx} for idx, choice in enumerate(choices)]
    selected_choice_key = _selected_choice_key_for_university(profile, university)

    target_level = _normalize_study_level_str(
        profile.get("studyLevel") or profile.get("study_level") or ""
    )
    target_route = profile.get("applicant_route")
    target_cycle = profile.get("intended_entry_cycle")
    selected_program_id = _selected_program_id_for_university(profile, university)
    if selected_program_id.casefold() not in _known_program_ids(university, choices):
        selected_program_id = ""

    entries = [
        row for row in entries
        if (target_level == "any" or _choice_matches_study_level(row["choice"], target_level))
        and _choice_matches_applicant_route(row["choice"], target_route)
        and _choice_matches_entry_cycle(row["choice"], target_cycle)
        and _choice_matches_program(row["choice"], selected_program_id)
    ]

    has_evidence = bool(ctx["userScores"]) or any(
        isinstance(v, dict) and (bool(v.get("native")) or _to_num(v.get("cefr")) is not None or bool(v.get("exams")))
        for v in (ctx["userLanguages"] or {}).values()
    )

    citizenships = profile.get("citizenships") or []
    if isinstance(citizenships, str):
        citizenships = [c.strip() for c in citizenships.split(",") if c.strip()]
    elif isinstance(citizenships, list):
        citizenships = [str(c).strip() for c in citizenships if str(c).strip()]
    if not citizenships and profile.get("citizenship"):
        citizenships = [str(profile.get("citizenship")).strip()]
    location = university.get("location")
    uni_country = str(
        (location.get("country") if isinstance(location, dict) else None)
        or university.get("country")
        or ""
    )
    citizenship_status = resolve_citizenship_status(uni_country, citizenships)

    if not entries:
        return {
            "overallChance": None,
            "scoreMeaning": "published_requirements_met_percent",
            "level": _no_data_chance_level(profile),
            "bestChoiceKey": "none",
            "bestChoiceId": "",
            "bestChoiceLabel": "No choices for selected filters",
            "recommendedChoiceKey": "none",
            "recommendedChoiceId": "",
            "recommendedChoiceLabel": "No choices for selected filters",
            "selectedChoiceKey": "none",
            "selectedChoiceId": "",
            "selectedChoiceLabel": "No choices for selected filters",
            "choices": [],
            "missingEvidence": not has_evidence,
            "conditional": False,
            "fundingType": funding_type,
            "selectedByUser": False,
            "choiceSelectionSource": "recommended",
            "chanceAvailable": False,
            "reason": "no_choices",
            "label": "Нет вариантов для выбранных фильтров"
            if _chance_locale(profile) == "rus"
            else "No choices for the selected filters",
            "citizenshipStatus": citizenship_status,
        }

    per_choice = []
    for row in entries:
        choice = row["choice"]
        idx = int(row["idx"])
        chance_pct, no_data_reason, measurable_checks = _published_requirements_fit(
            university=university,
            choice=choice,
            user_scores=ctx["userScores"],
            user_languages=ctx["userLanguages"],
            lang_cfg=lang_cfg,
        )
        track_badges = _track_verified_badges(choice)
        factors = _build_chance_factors(
            score_percent=chance_pct,
            reason=no_data_reason,
        )

        per_choice.append(
            {
                "choiceKey": _admission_choice_key(choice, idx),
                "assessmentKey": "::".join(
                    part for part in (str(choice.get("category_id") or ""), str(choice.get("requirement_profile_id") or "")) if part
                ),
                "choiceId": str(choice.get("id") or ""),
                "choiceLabel": str(choice.get("requirement_profile_label") or choice.get("category_label") or f"Choice {idx + 1}"),
                "categoryId": str(choice.get("category_id") or ""),
                "requirementProfileId": str(choice.get("requirement_profile_id") or ""),
                "fundingOptionId": str(choice.get("funding_option_id") or ""),
                "chancePercent": chance_pct,
                "scoreMeaning": "published_requirements_met_percent",
                "level": _chance_level(chance_pct) if chance_pct is not None else _no_data_chance_level(profile),
                "badges": track_badges,
                "factors": factors,
                "conditional": no_data_reason == "missing_evidence",
                "chanceAvailable": chance_pct is not None,
                "reason": no_data_reason,
                "label": _chance_no_data_label(no_data_reason, profile) if chance_pct is None else "",
                "details": {
                    "measurableRequirements": measurable_checks,
                },
            }
        )

    per_choice.sort(
        key=lambda x: (
            x.get("chancePercent") is None,
            -float(_to_num(x.get("chancePercent")) or 0.0),
            str(x.get("choiceLabel") or ""),
        )
    )
    recommended = per_choice[0] if per_choice else {
        "choiceKey": "default",
        "choiceId": "default",
        "choiceLabel": "General admission",
        "chancePercent": None,
        "scoreMeaning": "published_requirements_met_percent",
        "level": _no_data_chance_level(profile),
        "chanceAvailable": False,
        "reason": "no_published_requirements",
        "label": _chance_no_data_label("no_published_requirements", profile),
    }
    user_selected = _choice_result_by_key(per_choice, selected_choice_key)
    selected_by_user = user_selected is not None and str(user_selected.get("choiceKey") or "") != str(recommended.get("choiceKey") or "")
    best = user_selected if selected_by_user else recommended
    return {
        "overallChance": best.get("chancePercent"),
        "scoreMeaning": "published_requirements_met_percent",
        "level": best.get("level", _no_data_chance_level(profile)),
        "bestChoiceKey": best.get("choiceKey"),
        "bestChoiceId": best.get("choiceId"),
        "bestChoiceLabel": best.get("choiceLabel"),
        "recommendedChoiceKey": recommended.get("choiceKey"),
        "recommendedChoiceId": recommended.get("choiceId"),
        "recommendedChoiceLabel": recommended.get("choiceLabel"),
        "selectedChoiceKey": best.get("choiceKey"),
        "selectedChoiceId": best.get("choiceId"),
        "selectedChoiceLabel": best.get("choiceLabel"),
        "categoryId": best.get("categoryId"),
        "requirementProfileId": best.get("requirementProfileId"),
        "fundingOptionId": best.get("fundingOptionId"),
        "choices": per_choice,
        "missingEvidence": best.get("reason") == "missing_evidence",
        "conditional": bool(best.get("conditional")),
        "fundingType": funding_type,
        "selectedByUser": selected_by_user,
        "choiceSelectionSource": "user" if selected_by_user else "recommended",
        "chanceAvailable": bool(best.get("chanceAvailable")),
        "reason": str(best.get("reason") or ""),
        "label": str(best.get("label") or ""),
        "citizenshipStatus": citizenship_status,
    }


def estimate_university_roi(university: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    user_major = str(profile.get("major") or "").strip()
    study_level = _normalize_study_level_str(profile.get("studyLevel") or profile.get("study_level"))
    choices = universities_service.expand_admission_choices(university.get("admission_categories"))
    target_route = profile.get("applicant_route")
    target_cycle = profile.get("intended_entry_cycle")
    selected_program_id = _selected_program_id_for_university(profile, university)
    if selected_program_id.casefold() not in _known_program_ids(university, choices):
        selected_program_id = ""
    has_explicit_admission_context = bool(target_route or target_cycle or selected_program_id)
    has_graduate_choices = any(
        isinstance(choice, dict)
        and any(
            _choice_matches_study_level(choice, level)
            for level in ("master", "doctorate", "professional")
        )
        for choice in choices
    )
    has_undergraduate_choices = any(
        isinstance(choice, dict) and _choice_matches_study_level(choice, "bachelor")
        for choice in choices
    )
    if study_level in {"master", "mba", "doctorate", "professional"} or (
        study_level == "any" and has_graduate_choices and not has_undergraduate_choices
    ):
        return {
            "title": "Estimated ROI (Return on Investment)",
            "salary_used_usd": None,
            "annual_cost_usd": None,
            "roi_value": None,
            "roi_label": "No Data",
            "roi_tone": "neutral",
            "context_type": "insufficient_level_data",
            "user_major": user_major,
            "matched_major": "",
            "salary_data_points": 0,
        }
    preferred_mode = _normalize_study_mode(
        profile.get("studyMode")
        or profile.get("study_mode")
        or profile.get("format")
        or "any"
    )

    outcomes = university.get("outcomes", {}) if isinstance(university, dict) else {}
    if not isinstance(outcomes, dict):
        outcomes = {}
    salaries_by_major_raw = (
        outcomes.get("salary_by_major")
        if isinstance(outcomes.get("salary_by_major"), dict)
        else {}
    )
    avg_salary_generic = _to_num(outcomes.get("early_career_salary_usd")) or 0.0

    def normalize_major_key(value: Any) -> str:
        return re.sub(r"[^a-z0-9]+", " ", str(value or "").strip().lower()).strip()

    salary_entries: List[Tuple[str, float]] = []
    for major_name, salary in salaries_by_major_raw.items():
        major = str(major_name or "").strip()
        sal = _to_num(salary)
        if major and sal is not None and sal > 0:
            salary_entries.append((major, sal))

    avg_across_majors = (
        sum(x[1] for x in salary_entries) / float(len(salary_entries))
        if salary_entries
        else 0.0
    )
    fallback_salary = avg_across_majors if avg_across_majors > 0 else avg_salary_generic

    user_major_norm = normalize_major_key(user_major)
    exact_match = None
    for major_name, salary in salary_entries:
        if normalize_major_key(major_name) == user_major_norm and user_major_norm:
            exact_match = (major_name, salary)
            break

    loose_match = exact_match
    if loose_match is None and user_major_norm:
        for major_name, salary in salary_entries:
            major_norm = normalize_major_key(major_name)
            if major_norm and (major_norm in user_major_norm or user_major_norm in major_norm):
                loose_match = (major_name, salary)
                break

    major_matched = ""
    if not user_major:
        context_type = "missing_major"
        salary_used = fallback_salary
    elif loose_match is not None:
        context_type = "matched_major"
        major_matched = str(loose_match[0] or "")
        salary_used = float(loose_match[1] or 0.0)
    else:
        context_type = "fallback_major"
        salary_used = fallback_salary

    annual_cost = 0.0
    cost_available = False
    matching_choices = [
        choice for choice in choices
        if isinstance(choice, dict)
        and _choice_matches_study_level(
            choice,
            "bachelor" if study_level == "any" and has_undergraduate_choices else study_level,
        )
        and _choice_matches_applicant_route(choice, target_route)
        and _choice_matches_entry_cycle(choice, target_cycle)
        and _choice_matches_program(choice, selected_program_id)
    ]
    if matching_choices:
        prices = []
        for choice in matching_choices:
            cost_usd, _cost_native, _currency, cost_mode = _effective_track_cost_details(
                university, choice, preferred_mode=preferred_mode,
                intended_entry_cycle=target_cycle,
            )
            if cost_mode not in {"unavailable", "online_missing_tuition"}:
                prices.append(cost_usd)
        if prices:
            annual_cost = min(prices)
            cost_available = annual_cost > 0
    elif not choices and not has_explicit_admission_context:
        annual_cost = _effective_track_cost(university, {}, preferred_mode=preferred_mode)
        cost_available = annual_cost > 0
    elif choices and not has_explicit_admission_context:
        # Preserve the legacy institution-level cost only when no admission
        # context was requested and no scoped choice cost is available.
        annual_cost = _effective_track_cost(university, {}, preferred_mode=preferred_mode)
        cost_available = annual_cost > 0
    if annual_cost <= 0:
        cost_available = False

    if not cost_available:
        return {
            "title": "Estimated ROI (Return on Investment)",
            "salary_used_usd": None,
            "annual_cost_usd": None,
            "roi_value": None,
            "roi_label": "No Data",
            "roi_tone": "neutral",
            "context_type": "no_cost_data",
            "user_major": user_major,
            "matched_major": "",
            "salary_data_points": len(salary_entries),
        }

    if salary_used <= 0:
        return {
            "title": "Estimated ROI (Return on Investment)",
            "salary_used_usd": None,
            "annual_cost_usd": float(round(annual_cost, 2)),
            "roi_value": None,
            "roi_label": "No Data",
            "roi_tone": "neutral",
            "context_type": "no_salary_data",
            "user_major": user_major,
            "matched_major": "",
            "salary_data_points": len(salary_entries),
        }

    roi_value = salary_used / annual_cost if annual_cost > 0 else 0.0
    roi_value_rounded = round(roi_value, 1)

    if roi_value > 2.0:
        roi_label = "Excellent Return"
        roi_tone = "excellent"
    elif roi_value > 1.0:
        roi_label = "Positive Return"
        roi_tone = "good"
    else:
        roi_label = "High Investment"
        roi_tone = "warn"

    return {
        "title": "Estimated ROI (Return on Investment)",
        "salary_used_usd": float(round(salary_used, 2)),
        "annual_cost_usd": float(round(annual_cost, 2)),
        "roi_value": float(roi_value_rounded),
        "roi_label": roi_label,
        "roi_tone": roi_tone,
        "context_type": context_type,
        "user_major": user_major,
        "matched_major": major_matched,
        "salary_data_points": len(salary_entries),
    }
