import math
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.settings import ML_INTEREST_TRANSLATION_DEBUG
from app.services import languages as languages_service
from app.services.ml_scoring import get_ml_recommender, get_ml_runtime_status
from app.services.text_translation import translate_interest_text_for_ml

_UI_BADGE_THRESHOLDS = {
    "your_vibe_max_mismatch": 0.14,
    "top_match_max_mismatch": 0.22,
    "likely_grant_min_chance_pct": 65,
    "paid_admission_min_chance_pct": 45,
}
_LOGGER = logging.getLogger("unisearch.ai_scoring")


def _preview_text(value: Any, max_len: int = 180) -> str:
    raw = str(value or "").replace("\n", " ").strip()
    if len(raw) <= max_len:
        return raw
    return f"{raw[:max_len]}..."


def _to_num(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        out = float(value)
        if math.isfinite(out):
            return out
        return None
    except Exception:
        return None


def _to_num_default(value: Any, default: float) -> float:
    parsed = _to_num(value)
    if parsed is None:
        return float(default)
    return float(parsed)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _clamp01(value: float) -> float:
    return _clamp(value, 0.0, 1.0)


def _canonical_exam_key(key: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(key or "").strip().upper())


def _normalize_funding_preference(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in ("grant", "paid"):
        return raw
    return "any"


def _normalize_study_mode(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw or raw == "any":
        return "any"
    if raw in ("on-campus", "on campus", "campus", "offline", "in-person", "hybrid", "blended", "mixed"):
        return "on-campus"
    if raw in ("online", "distance", "remote", "online / distance"):
        return "online"
    return "any"


def _get_track_funding_type(track: Dict[str, Any]) -> str:
    raw_type = str(track.get("funding_type", "")).strip().lower()
    if raw_type in ("grant", "paid"):
        return raw_type
    badge = str(track.get("track_badge", "")).strip().lower()
    return "grant" if re.search(r"grant|scholar", badge) else "paid"


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
        amount = _to_num(val)
        if amount is not None and amount >= 0:
            return float(amount)
    return None


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


def _finance_for_cost(university: Dict[str, Any], track: Dict[str, Any]) -> Dict[str, Any]:
    track_fin = track.get("finance_override") if isinstance(track.get("finance_override"), dict) else {}
    uni_fin = university.get("finance") if isinstance(university.get("finance"), dict) else {}
    total = _to_num(track_fin.get("total_cost_year_usd"))
    if total is None:
        total = _to_num(uni_fin.get("total_cost_year_usd"))
    breakdown = track_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = uni_fin.get("costs_breakdown_year_usd")
    if not isinstance(breakdown, dict):
        breakdown = {}
    return {
        "total": max(0.0, float(total or 0.0)),
        "breakdown": breakdown,
        "track_finance": track_fin,
        "university_finance": uni_fin,
    }


def _extract_tuition_cost(breakdown: Dict[str, Any]) -> Optional[float]:
    if not isinstance(breakdown, dict):
        return None
    for key, value in breakdown.items():
        if "tuition" in _normalize_cost_key(key):
            amount = _to_num(value)
            if amount is not None and amount >= 0:
                return float(amount)
    return None


def _effective_cost_mode(preferred_mode: Any, track_mode: Any) -> str:
    pref = _normalize_study_mode(preferred_mode)
    if pref != "any":
        return pref
    mode = _normalize_study_mode(track_mode)
    return mode if mode != "any" else "on-campus"


def _effective_track_cost_with_mode(university: Dict[str, Any], track: Dict[str, Any], preferred_mode: Any = "any") -> Tuple[float, str]:
    finance = _finance_for_cost(university, track)
    total = float(finance.get("total") or 0.0)
    breakdown = finance.get("breakdown") if isinstance(finance.get("breakdown"), dict) else {}
    tuition = _extract_tuition_cost(breakdown)
    mode = _effective_cost_mode(preferred_mode, _track_study_mode(university, track))
    track_fin = finance.get("track_finance") if isinstance(finance.get("track_finance"), dict) else {}
    uni_fin = finance.get("university_finance") if isinstance(finance.get("university_finance"), dict) else {}

    if mode == "on-campus":
        return max(0.0, total), "on-campus_exact"

    if mode == "online":
        for source in (track_fin, uni_fin):
            mode_breakdown = _mode_breakdown_from_finance(source, "online")
            mode_tuition = _extract_tuition_cost(mode_breakdown if isinstance(mode_breakdown, dict) else {})
            if mode_tuition is not None and mode_tuition >= 0:
                return max(0.0, float(mode_tuition)), "online_tuition_only"
        if tuition is not None and tuition >= 0:
            return max(0.0, float(tuition)), "online_tuition_only"
        for source in (track_fin, uni_fin):
            mode_total = _mode_total_from_finance(source, "online")
            if mode_total is not None and mode_total >= 0:
                return max(0.0, float(mode_total)), "online_mode_total"
        return 0.0, "online_missing_tuition"

    return max(0.0, total), "on-campus_exact"


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


def _build_user_context(profile: Dict[str, Any], lang_cfg: Dict[str, Any]) -> Dict[str, Any]:
    user_scores: Dict[str, float] = {}
    user_languages: Dict[str, Dict[str, Any]] = {}

    _set_best_score(user_scores, "GPA", profile.get("gpa"))

    for row in profile.get("exams", []) or []:
        if not isinstance(row, dict):
            continue
        _set_best_score(user_scores, row.get("id", row.get("exam")), row.get("score"))

    for row in profile.get("languages", []) or []:
        if not isinstance(row, dict):
            continue
        code = _normalize_lang_code(row.get("code", row.get("lang")), lang_cfg)
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
            exam_id = str(row.get("exam", row.get("examId", row.get("id", "")))).strip()
            score = _to_num(row.get("score"))
            if not exam_id or score is None:
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


def _exam_weight(exam_id: Any, mode: str = "sort") -> float:
    up = str(exam_id or "").upper()
    if up == "GPA":
        return 1.35
    if up in ("SAT", "ACT", "UNT", "ENT"):
        return 1.25 if mode == "sort" else 1.2
    if _is_language_exam_key(exam_id):
        return 1.15 if mode == "sort" else 1.1
    return 1.0


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


def _score_language_bundle(track: Dict[str, Any], user_languages: Dict[str, Any], lang_cfg: Dict[str, Any], mode: str = "sort") -> Dict[str, Any]:
    bundle = _collect_language_requirements(track)
    rules = [x for x in bundle.get("items", []) if isinstance(x, dict)]
    if not rules:
        return {"score": 0.72 if mode != "sort" else 0.70, "pass": True, "hardFails": 0, "conditionalCount": 0}

    if bundle.get("mode") == "any":
        options = [_score_single_language_rule(rule, user_languages, lang_cfg, mode=mode) for rule in rules]
        options.sort(key=lambda x: -float(x.get("score", 0.0)))
        best = options[0] if options else {"score": 0.15, "pass": False, "hardFails": 1, "conditional": True}
        return {
            "score": float(best.get("score", 0.0)),
            "pass": bool(best.get("pass")),
            "hardFails": 0 if bool(best.get("pass")) else 1,
            "conditionalCount": 1 if bool(best.get("conditional")) else 0,
        }

    total = 0.0
    count = 0
    pass_all = True
    hard_fails = 0
    worst_gap = 0.0
    conditional_count = 0
    for rule in rules:
        row = _score_single_language_rule(rule, user_languages, lang_cfg, mode=mode)
        total += float(row.get("score", 0.0))
        count += 1
        if bool(row.get("conditional")):
            conditional_count += 1
        if not bool(row.get("pass")):
            pass_all = False
            hard_fails += 1
            worst_gap = max(worst_gap, float(row.get("gap", 0.0)))
    return {
        "score": (total / count) if count else 0.2,
        "pass": pass_all,
        "hardFails": hard_fails,
        "gap": worst_gap,
        "conditionalCount": conditional_count,
    }


def _track_fit(track: Dict[str, Any], user_scores: Dict[str, Any], user_languages: Dict[str, Any], lang_cfg: Dict[str, Any], mode: str = "sort") -> Dict[str, Any]:
    req = track.get("requirements", {})
    avg = track.get("stats_avg", {})
    if not isinstance(req, dict):
        req = {}
    if not isinstance(avg, dict):
        avg = {}

    has_structured_lang = len(_collect_language_requirements(track).get("items", [])) > 0
    weighted = 0.0
    weights = 0.0
    hard_fails = 0
    req_count = 0
    missing_evidence = False
    worst_gap = 0.0
    conditional_count = 0

    for exam_id, min_val in req.items():
        if has_structured_lang and _is_language_exam_key(exam_id):
            continue
        user = _get_user_score(user_scores, exam_id, user_languages)
        if user is None:
            missing_evidence = True
        avg_val = avg.get(exam_id) if exam_id in avg else None
        higher = _is_higher_better(exam_id)
        rr = _score_requirement(user, min_val, avg_val, higher_is_better=higher, mode=mode)
        if bool(rr.get("conditional")):
            conditional_count += 1
        w = _exam_weight(exam_id, mode=mode)
        weighted += float(rr.get("score", 0.0)) * w
        weights += w
        req_count += 1
        if not bool(rr.get("pass")):
            hard_fails += 1
            worst_gap = max(worst_gap, float(rr.get("gap", 0.0)))

    lang = _score_language_bundle(track, user_languages, lang_cfg, mode=mode)
    conditional_count += int(lang.get("conditionalCount", 0) or 0)
    lang_items_count = len(_collect_language_requirements(track).get("items", []))
    fail_count = hard_fails + (0 if bool(lang.get("pass")) else max(1, int(lang.get("hardFails", 1))))
    total_constraints = req_count + (1 if lang_items_count > 0 else 0)
    fail_ratio = _clamp01(fail_count / total_constraints) if total_constraints > 0 else 0.0

    fit = (weighted / weights) if weights > 0 else (0.55 if mode == "sort" else 0.65)
    return {
        "fit": _clamp01(fit),
        "langScore": float(lang.get("score", 0.0)),
        "hardPassAll": fail_count == 0,
        "worstGap": worst_gap,
        "missingEvidence": missing_evidence,
        "failRatio": fail_ratio,
        "conditional": conditional_count > 0,
        "conditionalRequirements": conditional_count,
    }


def _acceptance_score(university: Dict[str, Any], mode: str = "sort") -> float:
    academics = university.get("academics", {}) if isinstance(university, dict) else {}
    ar = _to_num(academics.get("acceptance_rate_percent"))
    if ar is None:
        vals = []
        for row in academics.get("programs", []) or []:
            if isinstance(row, dict):
                v = _to_num(row.get("acceptance_rate_percent"))
                if v is not None:
                    vals.append(v)
        if vals:
            ar = sum(vals) / len(vals)
    if ar is None:
        return 0.35 if mode == "sort" else 0.55
    return _clamp01(math.sqrt(_clamp(ar, 1.0 if mode != "sort" else 0.0, 100.0) / 100.0))


def _track_cost(university: Dict[str, Any], track: Dict[str, Any], preferred_mode: Any = "any") -> float:
    return _effective_track_cost(university, track, preferred_mode=preferred_mode)


def _affordability_score(
    university: Dict[str, Any],
    track: Dict[str, Any],
    budget: Optional[float],
    aid_eligible: bool,
    aid_any: bool,
    mode: str = "sort",
    preferred_mode: Any = "any",
) -> float:
    cost = _track_cost(university, track, preferred_mode=preferred_mode)
    if budget is None or budget <= 0:
        return 0.55 if mode == "sort" else 0.6
    if cost <= 0:
        return 0.55 if mode == "sort" else 0.6
    if mode == "sort" and aid_eligible:
        return 1.0
    if cost <= budget:
        if mode == "sort":
            t = _clamp01(cost / budget)
            return _clamp01(0.60 + 0.40 * (t ** 0.70))
        return 1.0

    ratio = cost / budget
    if mode == "sort":
        score = _clamp01(1.0 / (ratio ** 1.8))
        return _clamp01(score + 0.10) if aid_any else score

    score = _clamp(0.2 + 0.8 * (_clamp01(budget / cost) ** 0.75), 0.2, 1.0)
    return _clamp01(score + 0.08) if aid_any else score


def _rank_score_factory(items: List[Dict[str, Any]]):
    ranks = []
    for row in items:
        if isinstance(row, dict):
            r = _to_num(row.get("rank"))
            if r is not None and r > 0:
                ranks.append(r)
    min_rank = min(ranks) if ranks else 1.0
    max_rank = max(ranks) if ranks else 2000.0
    log_min = math.log(min_rank + 1.0)
    log_max = math.log(max_rank + 1.0)
    denom = max(log_max - log_min, 1e-9)

    def score(rank: Any) -> float:
        r = _to_num(rank)
        if r is None or r <= 0:
            return 0.15
        x = 1.0 - ((math.log(r + 1.0) - log_min) / denom)
        return _clamp01(x)

    return score


def _track_key(track: Dict[str, Any], idx: int) -> str:
    tid = str(track.get("id", "")).strip()
    if tid:
        return tid
    label = str(track.get("label", "")).strip()
    if label:
        return f"label:{label}"
    return f"track:{idx}"


def _chance_level(chance_pct: float) -> Dict[str, str]:
    if chance_pct >= 80:
        return {"id": "high", "label": "High chance"}
    if chance_pct >= 60:
        return {"id": "good", "label": "Good chance"}
    if chance_pct >= 40:
        return {"id": "medium", "label": "Moderate chance"}
    return {"id": "low", "label": "Low chance"}


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
    text = " ".join(
        [
            str(university.get("name") or ""),
            str(university.get("description") or ""),
            str((((university.get("academics") or {}).get("focus_areas")) or "")),
        ]
    ).lower()
    research_tokens = ("research", "science", "laboratory", "fundamental", "theory", "phd")
    practice_tokens = ("practice", "industry", "internship", "applied", "career", "startup")
    score = 0.5 + (0.06 * sum(1 for token in research_tokens if token in text)) - (0.06 * sum(1 for token in practice_tokens if token in text))
    rank = _to_num(university.get("rank"))
    if rank is not None and rank <= 10:
        score += 0.05
    return _clamp01(score)


def _fallback_social_vs_hardcore(university: Dict[str, Any]) -> float:
    acceptance = _acceptance_percent(university)
    strictness = 0.55 if acceptance is None else _clamp01(1.0 - (acceptance / 100.0))
    rank = _to_num(university.get("rank"))
    rank_boost = 0.0
    if rank is not None and rank > 0:
        rank_boost = _clamp01(1.0 - ((rank - 1.0) / 200.0)) * 0.18
    return _clamp01(0.30 + 0.60 * strictness + rank_boost)


def _fallback_budget_vs_prestige(university: Dict[str, Any]) -> float:
    finance = university.get("finance")
    finance = finance if isinstance(finance, dict) else {}
    cost = _to_num(finance.get("total_cost_year_usd"))
    cost_norm = 0.45 if cost is None else _clamp01(float(cost) / 100000.0)
    rank = _to_num(university.get("rank"))
    rank_prestige = 0.5
    if rank is not None and rank > 0:
        rank_prestige = _clamp01(1.0 - ((rank - 1.0) / 120.0))
    return _clamp01(0.50 * cost_norm + 0.50 * rank_prestige)


def _fallback_city_vs_campus(university: Dict[str, Any]) -> float:
    city = str((((university.get("location") or {}).get("city")) or "")).strip().lower()
    if not city:
        return 0.5
    mega_cities = {
        "london",
        "tokyo",
        "seoul",
        "singapore",
        "beijing",
        "toronto",
        "cambridge",
        "zurich",
        "melbourne",
        "hong kong",
    }
    medium_cities = {"astana", "munich", "kyoto", "daejeon", "delft", "lausanne"}
    if city in mega_cities:
        return 0.18
    if city in medium_cities:
        return 0.42
    return 0.60


def _extract_university_factors(university: Dict[str, Any]) -> Dict[str, float]:
    raw = university.get("factors")
    raw = raw if isinstance(raw, dict) else {}
    return {
        "practice_vs_science": _factor01(raw.get("practice_vs_science"), _fallback_practice_vs_science(university)),
        "social_vs_hardcore": _factor01(raw.get("social_vs_hardcore"), _fallback_social_vs_hardcore(university)),
        "budget_vs_prestige": _factor01(raw.get("budget_vs_prestige"), _fallback_budget_vs_prestige(university)),
        "city_vs_campus": _factor01(raw.get("city_vs_campus"), _fallback_city_vs_campus(university)),
    }


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
    selected_chance_type: Any,
    grant_chance: Any,
    general_chance: Any,
) -> Dict[str, Any]:
    mismatch01 = _clamp01(_to_num_default(preference_mismatch, 1.0))
    conditional_count = max(0, int(_to_num_default(conditional_requirements, 0.0)))
    show_conditional = bool(conditional) and conditional_count > 0
    selected_type = str(selected_chance_type or "").strip().lower()
    grant_pct = _clamp(_to_num_default(grant_chance, 0.0), 0.0, 100.0)
    general_pct = _clamp(_to_num_default(general_chance, 0.0), 0.0, 100.0)

    vibe = ""
    if mismatch01 <= float(_UI_BADGE_THRESHOLDS["your_vibe_max_mismatch"]):
        vibe = "your_vibe"
    elif mismatch01 <= float(_UI_BADGE_THRESHOLDS["top_match_max_mismatch"]):
        vibe = "top_match"

    finance = ""
    if selected_type == "grant" and grant_pct >= float(_UI_BADGE_THRESHOLDS["likely_grant_min_chance_pct"]):
        finance = "likely_grant"
    elif selected_type == "general" and general_pct >= float(_UI_BADGE_THRESHOLDS["paid_admission_min_chance_pct"]):
        finance = "paid_admission"

    return {
        "showConditionalExamNeeded": show_conditional,
        "vibe": vibe,
        "finance": finance,
        "priorityOrder": [
            "conditional_exam_needed",
            "your_vibe",
            "top_match",
            "likely_grant",
            "paid_admission",
        ],
        "metrics": {
            "preferenceMismatch": round(mismatch01, 4),
            "conditionalRequirements": conditional_count,
            "selectedChanceType": selected_type,
            "grantChance": int(round(grant_pct)),
            "generalChance": int(round(general_pct)),
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
    translation_client_key: str = "",
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
    finance_pref = float(user_pref["budget_vs_prestige"])
    rank_score = _rank_score_factory(items)
    profile_any = dict(profile)
    profile_any["fundingType"] = "any"
    profile_any["funding_type"] = "any"
    profile_grant = dict(profile)
    profile_grant["fundingType"] = "grant"
    profile_grant["funding_type"] = "grant"
    interest_text_raw = str(profile.get("interests") or "").strip()
    locale_hint = (
        profile.get("locale")
        or profile.get("language")
        or profile.get("lang")
        or ""
    )
    translation_meta = (
        translate_interest_text_for_ml(
            interest_text_raw,
            source_hint=locale_hint,
            client_key=translation_client_key,
        )
        if interest_text_raw
        else {"text": "", "translated": False, "source": "auto", "reason": "empty", "provider": "none"}
    )
    interest_text = str(translation_meta.get("text") or "").strip()
    if ML_INTEREST_TRANSLATION_DEBUG:
        _LOGGER.info(
            "translation_flow interests_raw_len=%s raw_preview=%r locale_hint=%r translated=%s source=%s provider=%s reason=%s cache_hit=%s translated_preview=%r",
            len(interest_text_raw),
            _preview_text(interest_text_raw),
            str(locale_hint or ""),
            bool(translation_meta.get("translated")),
            str(translation_meta.get("source") or ""),
            str(translation_meta.get("provider") or ""),
            str(translation_meta.get("reason") or ""),
            bool(translation_meta.get("cacheHit")),
            _preview_text(interest_text),
        )

    ml_scores_by_id: Dict[str, float] = {}
    ml_status = get_ml_runtime_status() if interest_text else {"available": False, "message": ""}
    ml_available = bool(ml_status.get("available"))
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
            ml_unavailable_warning = bool(interest_text)
            ml_warning_message = "Machine Learning unavailable"

    enriched: List[Dict[str, Any]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        row_id = str(row.get("id") or "").strip()
        uni_factors = _extract_university_factors(row)
        total_distance, distance_deltas = _distance_breakdown(user_pref, uni_factors)
        preference_mismatch = _clamp01(
            (
                float(distance_deltas.get("practice_vs_science", 0.0))
                + float(distance_deltas.get("social_vs_hardcore", 0.0))
                + float(distance_deltas.get("city_vs_campus", 0.0))
            )
            / 3.0
        )
        chance_general = estimate_uni_chance(row, profile_any)
        chance_grant = estimate_uni_chance(row, profile_grant)
        general_chance01 = _clamp01((_to_num(chance_general.get("overallChance")) or 0.0) / 100.0)
        grant_chance01 = _clamp01((_to_num(chance_grant.get("overallChance")) or 0.0) / 100.0)
        if finance_pref < 0.5:
            selected_chance01 = grant_chance01
            selected_chance_type = "grant"
        elif finance_pref > 0.5:
            selected_chance01 = general_chance01
            selected_chance_type = "general"
        else:
            selected_chance01 = _clamp01((grant_chance01 + general_chance01) / 2.0)
            selected_chance_type = "balanced"
        admission_risk = _clamp01(1.0 - selected_chance01)
        final_score = _clamp01((0.60 * preference_mismatch) + (0.40 * admission_risk))
        hard_score = _clamp01(1.0 - preference_mismatch)

        tracks = row.get("admission_tracks")
        if not isinstance(tracks, list) or not tracks:
            tracks = [{"id": "default", "label": "Standard", "requirements": {}, "stats_avg": {}, "scholarships": []}]
        tracks = [t for t in tracks if isinstance(t, dict)]

        if not tracks:
            item = dict(row)
            item["matchData"] = {
                "finalPrice": 0.0,
                "aidAny": False,
                "aidEligible": False,
                "grantName": "",
                "trackLabel": "No matching track",
                "missingRequiredEvidence": True,
                "hardScore": hard_score,
                "finalScore": final_score,
                "mlScore": float(ml_scores_by_id.get(row_id, 0.0)) if use_ml else 0.0,
                "distanceScore": _clamp01(1.0 - preference_mismatch),
                "totalDistance": total_distance,
                "distanceDeltas": distance_deltas,
                "preferenceMismatch": preference_mismatch,
                "admissionRisk": admission_risk,
                "selectedChance": int(round(selected_chance01 * 100.0)),
                "selectedChanceType": selected_chance_type,
                "grantChance": int(round(grant_chance01 * 100.0)),
                "generalChance": int(round(general_chance01 * 100.0)),
                "uiBadgeHints": _build_ui_badge_hints(
                    preference_mismatch=preference_mismatch,
                    conditional=False,
                    conditional_requirements=0,
                    selected_chance_type=selected_chance_type,
                    grant_chance=int(round(grant_chance01 * 100.0)),
                    general_chance=int(round(general_chance01 * 100.0)),
                ),
                "factors": uni_factors,
                "userPreferences": user_pref,
                "mlEnabled": bool(interest_text),
                "mlApplied": use_ml,
                "mlAvailable": ml_available,
                "mlUnavailable": ml_unavailable_warning,
                "mlWarning": ml_warning_message,
                "mlQueryTranslated": bool(translation_meta.get("translated")),
                "mlQuerySource": str(translation_meta.get("source") or ""),
                "mlQueryTranslationReason": str(translation_meta.get("reason") or ""),
                "mlQueryProvider": str(translation_meta.get("provider") or ""),
                "mlQueryCacheHit": bool(translation_meta.get("cacheHit")),
                "mlQueryProviderError": str(translation_meta.get("error") or ""),
                "mlQueryInputPreview": _preview_text(interest_text_raw),
                "mlQueryOutputPreview": _preview_text(interest_text),
                "mlQueryOutputLength": len(interest_text),
            }
            item["__ai_score"] = final_score
            item["__distance"] = preference_mismatch
            enriched.append(item)
            continue

        best = None
        for track in tracks:
            fit = _track_fit(track, ctx["userScores"], ctx["userLanguages"], lang_cfg, mode="sort")
            scholarships = track.get("scholarships", [])
            scholarships = scholarships if isinstance(scholarships, list) else []

            eligible_scholar = None
            best_scholar_potential = 0.0
            for sch in scholarships:
                if not isinstance(sch, dict):
                    continue
                req = sch.get("requirements", {})
                req = req if isinstance(req, dict) else {}
                if not req:
                    best_scholar_potential = max(best_scholar_potential, 0.60)
                    if eligible_scholar is None:
                        eligible_scholar = sch
                    continue
                s_weighted = 0.0
                s_weights = 0.0
                pass_all = True
                for exam_id, min_val in req.items():
                    user = _get_user_score(ctx["userScores"], exam_id, ctx["userLanguages"])
                    rr = _score_requirement(user, min_val, None, higher_is_better=_is_higher_better(exam_id), mode="sort")
                    w = _exam_weight(exam_id, mode="sort")
                    s_weighted += float(rr.get("score", 0.0)) * w
                    s_weights += w
                    if not bool(rr.get("pass")):
                        pass_all = False
                sch_fit = (s_weighted / s_weights) if s_weights > 0 else 0.60
                best_scholar_potential = max(best_scholar_potential, sch_fit)
                if pass_all and (eligible_scholar is None or sch_fit >= best_scholar_potential):
                    eligible_scholar = sch

            aid_any = bool(scholarships) or bool((((row.get("finance") or {}).get("financial_aid") or {}).get("merit_based"))) or bool((((row.get("finance") or {}).get("financial_aid") or {}).get("need_based")))
            aid_eligible = eligible_scholar is not None

            acceptance = _acceptance_score(row, mode="sort")
            admit = _clamp01(float(fit.get("fit", 0.0)) * (0.55 + 0.45 * acceptance))
            if not bool(fit.get("hardPassAll")):
                gap_penalty = _clamp01(1.0 - 1.35 * float(fit.get("worstGap", 0.0)))
                admit *= (0.12 + 0.88 * gap_penalty)
                admit = _clamp01(admit)

            cost, cost_mode = _effective_track_cost_with_mode(row, track, preferred_mode=preferred_mode)
            aff = _affordability_score(
                row,
                track,
                ctx["budget"],
                aid_eligible=aid_eligible,
                aid_any=aid_any,
                mode="sort",
                preferred_mode=preferred_mode,
            )
            if use_ml:
                ml_score = float(ml_scores_by_id.get(row_id, 0.0))
            else:
                ml_score = 0.0

            amount = _to_num((eligible_scholar or {}).get("amount")) if isinstance(eligible_scholar, dict) else None
            final_price = max(0.0, cost - amount) if (aid_eligible and amount is not None) else cost
            match_data = {
                "trackId": str(track.get("id") or "track"),
                "trackLabel": str(track.get("label") or "Standard"),
                "finalPrice": final_price,
                "aidAny": aid_any,
                "aidEligible": aid_eligible,
                "grantName": str((eligible_scholar or {}).get("name") or "") if isinstance(eligible_scholar, dict) else "",
                "admitChance": admit,
                "meetMinRequirements": bool(fit.get("hardPassAll")),
                "missingRequiredEvidence": bool(fit.get("missingEvidence")),
                "conditional": bool(fit.get("conditional")),
                "conditionalRequirements": int(fit.get("conditionalRequirements", 0) or 0),
                "costYearUSD": cost,
                "grantPotential": best_scholar_potential,
                "grantEligible": aid_eligible,
                "hardScore": hard_score,
                "distanceScore": _clamp01(1.0 - preference_mismatch),
                "totalDistance": total_distance,
                "distanceDeltas": distance_deltas,
                "preferenceMismatch": preference_mismatch,
                "admissionRisk": admission_risk,
                "selectedChance": int(round(selected_chance01 * 100.0)),
                "selectedChanceType": selected_chance_type,
                "grantChance": int(round(grant_chance01 * 100.0)),
                "generalChance": int(round(general_chance01 * 100.0)),
                "uiBadgeHints": _build_ui_badge_hints(
                    preference_mismatch=preference_mismatch,
                    conditional=bool(fit.get("conditional")),
                    conditional_requirements=int(fit.get("conditionalRequirements", 0) or 0),
                    selected_chance_type=selected_chance_type,
                    grant_chance=int(round(grant_chance01 * 100.0)),
                    general_chance=int(round(general_chance01 * 100.0)),
                ),
                "factors": uni_factors,
                "userPreferences": user_pref,
                "mlScore": ml_score,
                "finalScore": final_score,
                "legacySignals": {
                    "admitChance": admit,
                    "affordability": aff,
                    "rankScore": rank_score(row.get("rank")),
                },
                "mlEnabled": bool(interest_text),
                "mlApplied": use_ml,
                "mlAvailable": ml_available,
                "mlUnavailable": ml_unavailable_warning,
                "mlWarning": ml_warning_message,
                "mlQueryTranslated": bool(translation_meta.get("translated")),
                "mlQuerySource": str(translation_meta.get("source") or ""),
                "mlQueryTranslationReason": str(translation_meta.get("reason") or ""),
                "mlQueryProvider": str(translation_meta.get("provider") or ""),
                "mlQueryCacheHit": bool(translation_meta.get("cacheHit")),
                "mlQueryProviderError": str(translation_meta.get("error") or ""),
                "mlQueryInputPreview": _preview_text(interest_text_raw),
                "mlQueryOutputPreview": _preview_text(interest_text),
                "mlQueryOutputLength": len(interest_text),
                "costMode": cost_mode,
            }
            candidate = {"score": admit, "matchData": match_data}
            if best is None or float(candidate["score"]) > float(best["score"]):
                best = candidate

        item = dict(row)
        item["matchData"] = (best or {}).get("matchData", {})
        item["__ai_score"] = final_score
        item["__distance"] = preference_mismatch
        enriched.append(item)

    enriched.sort(
        key=lambda u: (
            float(u.get("__ai_score", 1.0)),
            float(u.get("__distance", 1.0)),
            -float(_to_num(((u.get("matchData") or {}).get("selectedChance"))) or 0.0),
            float(_to_num(u.get("rank")) or 999999.0),
            -float(_to_num(((u.get("matchData") or {}).get("admitChance"))) or 0.0),
            float(_to_num(((u.get("matchData") or {}).get("finalPrice"))) or 1e18),
        )
    )

    out = []
    for row in enriched:
        cleaned = dict(row)
        cleaned.pop("__ai_score", None)
        cleaned.pop("__distance", None)
        out.append(cleaned)
    return out


def estimate_uni_chance(university: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    lang_cfg = _language_config()
    ctx = _build_user_context(profile, lang_cfg)
    funding_type = _normalize_funding_preference(profile.get("fundingType") or profile.get("funding_type") or "any")
    preferred_mode = _normalize_study_mode(
        profile.get("studyMode")
        or profile.get("study_mode")
        or profile.get("format")
        or "any"
    )

    tracks = university.get("admission_tracks")
    if not isinstance(tracks, list) or not tracks:
        tracks = [{"id": "default", "label": "General admission", "requirements": {}, "stats_avg": {}}]
    tracks = [t for t in tracks if isinstance(t, dict)]
    entries = [{"track": t, "idx": i} for i, t in enumerate(tracks)]
    if funding_type != "any":
        entries = [row for row in entries if _get_track_funding_type(row["track"]) == funding_type]

    has_evidence = bool(ctx["userScores"]) or any(
        isinstance(v, dict) and (bool(v.get("native")) or _to_num(v.get("cefr")) is not None or bool(v.get("exams")))
        for v in (ctx["userLanguages"] or {}).values()
    )
    if not has_evidence:
        per_track = []
        for row in entries:
            track = row["track"]
            idx = int(row["idx"])
            per_track.append(
                {
                    "trackKey": _track_key(track, idx),
                    "trackId": str(track.get("id") or ""),
                    "trackLabel": str(track.get("label") or f"Track {idx + 1}"),
                    "chancePercent": 0,
                    "level": _chance_level(0),
                    "conditional": True,
                    "details": {"academic": 0, "language": 0, "selectivity": 0, "affordability": 0, "feasibilityGate": 0, "conditionalRequirements": 0},
                }
            )
        best = per_track[0] if per_track else {"trackKey": "default", "trackId": "default", "trackLabel": "General admission"}
        return {
            "overallChance": 0,
            "level": _chance_level(0),
            "bestTrackKey": best.get("trackKey"),
            "bestTrackId": best.get("trackId"),
            "bestTrackLabel": best.get("trackLabel"),
            "tracks": per_track,
            "missingEvidence": True,
            "conditional": True,
            "fundingType": funding_type,
        }

    if not entries:
        return {
            "overallChance": 0,
            "level": _chance_level(0),
            "bestTrackKey": "none",
            "bestTrackId": "",
            "bestTrackLabel": "No tracks for selected funding type",
            "tracks": [],
            "missingEvidence": False,
            "conditional": False,
            "fundingType": funding_type,
        }

    per_track = []
    for row in entries:
        track = row["track"]
        idx = int(row["idx"])
        fit = _track_fit(track, ctx["userScores"], ctx["userLanguages"], lang_cfg, mode="chance")
        academic = float(fit.get("fit", 0.0))
        language = float(fit.get("langScore", 0.0))
        selectivity = _acceptance_score(university, mode="chance")
        aid_any = bool((((university.get("finance") or {}).get("financial_aid") or {}).get("merit_based"))) or bool((((university.get("finance") or {}).get("financial_aid") or {}).get("need_based"))) or bool(track.get("scholarships"))
        affordability = _affordability_score(
            university,
            track,
            ctx["budget"],
            aid_eligible=False,
            aid_any=aid_any,
            mode="chance",
            preferred_mode=preferred_mode,
        )
        scholarship_boost = 0.08 if bool(track.get("scholarships")) else 0.0

        base = _clamp01((academic * 0.53) + (language * 0.24) + (selectivity * 0.13) + (affordability * 0.10))
        feasibility_gate = _clamp(1.0 - 0.78 * float(fit.get("failRatio", 0.0)), 0.18, 1.0)
        chance01 = _clamp01(base * feasibility_gate + scholarship_boost)
        chance_pct = int(round(chance01 * 100.0))

        per_track.append(
            {
                "trackKey": _track_key(track, idx),
                "trackId": str(track.get("id") or ""),
                "trackLabel": str(track.get("label") or f"Track {idx + 1}"),
                "chancePercent": chance_pct,
                "level": _chance_level(chance_pct),
                "conditional": bool(fit.get("conditional")),
                "details": {
                    "academic": int(round(academic * 100.0)),
                    "language": int(round(language * 100.0)),
                    "selectivity": int(round(selectivity * 100.0)),
                    "affordability": int(round(affordability * 100.0)),
                    "feasibilityGate": int(round(feasibility_gate * 100.0)),
                    "conditionalRequirements": int(fit.get("conditionalRequirements", 0) or 0),
                },
            }
        )

    per_track.sort(key=lambda x: -int(x.get("chancePercent", 0)))
    best = per_track[0] if per_track else {
        "trackKey": "default",
        "trackId": "default",
        "trackLabel": "General admission",
        "chancePercent": 0,
        "level": _chance_level(0),
    }
    return {
        "overallChance": int(best.get("chancePercent", 0)),
        "level": best.get("level", _chance_level(0)),
        "bestTrackKey": best.get("trackKey"),
        "bestTrackId": best.get("trackId"),
        "bestTrackLabel": best.get("trackLabel"),
        "tracks": per_track,
        "missingEvidence": False,
        "conditional": bool(best.get("conditional")),
        "fundingType": funding_type,
    }


def estimate_university_roi(university: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    user_major = str(profile.get("major") or "").strip()
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
        outcomes.get("average_salary_by_major")
        or outcomes.get("salary_by_major")
        or outcomes.get("average_salary_by_program")
        or outcomes.get("average_early_career_salary_by_major_usd")
        or {}
    )
    if not isinstance(salaries_by_major_raw, dict):
        salaries_by_major_raw = {}
    avg_salary_generic = _to_num(outcomes.get("average_early_career_salary_usd")) or 0.0

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

    salary_used = 0.0
    context_type = "no_data"
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

    if salary_used <= 0:
        context_type = "no_salary_data"
        salary_used = 0.0

    annual_cost = _effective_track_cost(university, {}, preferred_mode=preferred_mode)
    tracks = university.get("admission_tracks")
    if isinstance(tracks, list) and tracks:
        prices = []
        for track in tracks:
            if not isinstance(track, dict):
                continue
            cost = _track_cost(university, track, preferred_mode=preferred_mode)
            if cost is not None and cost > 0:
                prices.append(cost)
        if prices:
            annual_cost = min(prices)
    if annual_cost <= 0:
        annual_cost = 1.0

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
