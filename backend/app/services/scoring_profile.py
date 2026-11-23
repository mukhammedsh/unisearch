"""Applicant profile normalization, exam and language scoring, and admission choice keys."""

import math
import re
from functools import lru_cache
from typing import Any

from app.core.utils import clamp as _clamp
from app.core.utils import clamp01 as _clamp01
from app.core.utils import to_float as _to_num
from app.services import exams as exams_service
from app.services import languages as languages_service
from app.services.finance_modes import normalize_study_mode as _normalize_study_mode

_NON_ALNUM_UPPER_RE = re.compile(r"[^A-Z0-9]")

_LANGUAGE_INDEX_LOOKUP_CACHE: dict[str, Any] = {
    "index": None,
    "by_lang": {},
    "any_map": {},
    "toefl_ranges": {},
    "parents": {},
}
_LANG_CODE_LOOKUP_CACHE: dict[str, Any] = {
    "cfg": None,
    "lookup": {},
}


@lru_cache(maxsize=1024)
def _canonical_exam_key_str(raw: str) -> str:
    return _NON_ALNUM_UPPER_RE.sub("", raw.strip().upper())


def _canonical_exam_key(key: Any) -> str:
    if key is None:
        return ""
    return _canonical_exam_key_str(str(key))


def _get_language_exam_lookup() -> dict[str, Any]:
    index = languages_service.get_languages_index()
    if _LANGUAGE_INDEX_LOOKUP_CACHE["index"] is index:
        return _LANGUAGE_INDEX_LOOKUP_CACHE

    exams_by_lang = index.get("exams_by_lang", {}) if isinstance(index, dict) else {}
    by_lang: dict[str, dict[str, str]] = {}
    any_map: dict[str, str] = {}
    toefl_ranges: dict[str, list[tuple[str, float, float]]] = {}
    parents: dict[str, dict[str, str]] = {}

    if isinstance(exams_by_lang, dict):
        for lang_code, exams in exams_by_lang.items():
            if not isinstance(exams, list):
                continue
            code_str = str(lang_code)
            lang_map: dict[str, str] = {}
            lang_toefl: list[tuple[str, float, float]] = []
            lang_parents: dict[str, str] = {}
            for exam in exams:
                if not isinstance(exam, dict):
                    continue
                raw_id = exam.get("id")
                exam_id_str = str(raw_id or "")
                canon = _canonical_exam_key(raw_id)
                if canon not in lang_map:
                    lang_map[canon] = exam_id_str
                if canon and canon not in any_map:
                    any_map[canon] = exam_id_str
                if (
                    canon.startswith("TOEFL")
                    and (min_bound := _to_num(exam.get("min"))) is not None
                    and (max_bound := _to_num(exam.get("max"))) is not None
                ):
                    lang_toefl.append((exam_id_str, float(min_bound), float(max_bound)))
                scheme = exam.get("breakdown_scheme")
                if isinstance(scheme, dict):
                    for component in scheme.get("fixed_components", []):
                        if isinstance(component, dict) and "exam" in component and "id" in exam:
                            lang_parents[component["exam"]] = exam["id"]
            by_lang[code_str] = lang_map
            toefl_ranges[code_str] = lang_toefl
            parents[code_str] = lang_parents

    _LANGUAGE_INDEX_LOOKUP_CACHE["index"] = index
    _LANGUAGE_INDEX_LOOKUP_CACHE["by_lang"] = by_lang
    _LANGUAGE_INDEX_LOOKUP_CACHE["any_map"] = any_map
    _LANGUAGE_INDEX_LOOKUP_CACHE["toefl_ranges"] = toefl_ranges
    _LANGUAGE_INDEX_LOOKUP_CACHE["parents"] = parents
    return _LANGUAGE_INDEX_LOOKUP_CACHE


def _configured_language_exam_id(code: str, exam_id: Any, minimum: Any) -> str:
    """Resolve an exact configured exam or an unambiguous legacy TOEFL total key."""
    exam_key = _canonical_exam_key(exam_id)
    lookup = _get_language_exam_lookup()
    lang_map = lookup["by_lang"].get(code)
    if lang_map is None:
        return ""
    if exam_key in lang_map:
        return lang_map[exam_key]

    # Older catalog rows used "TOEFL" for numeric totals. Accept that key only
    # when exactly one configured TOEFL total has a range containing its floor.
    if exam_key != "TOEFL":
        return ""
    floor = _to_num(minimum)
    if floor is None:
        return ""
    compatible = [
        exam_id_str
        for exam_id_str, minimum_bound, maximum_bound in lookup["toefl_ranges"].get(code, ())
        if minimum_bound <= floor <= maximum_bound
    ]
    return compatible[0] if len(compatible) == 1 else ""


def _configured_language_exam_id_any(exam_id: Any) -> str:
    exam_key = _canonical_exam_key(exam_id)
    if not exam_key:
        return ""
    return _get_language_exam_lookup()["any_map"].get(exam_key, "")


def _normalize_funding_preference(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in ("grant", "paid"):
        return raw
    return "any"


def _get_track_funding_type(track: dict[str, Any]) -> str:
    raw_type = str(track.get("funding_type", "")).strip().lower()
    if raw_type in ("grant", "paid"):
        return raw_type
    badge = str(track.get("track_badge", "")).strip().lower()
    return "grant" if re.search(r"grant|scholar", badge) else "paid"


def _track_study_mode(university: dict[str, Any], track: dict[str, Any]) -> str:
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


def _language_config() -> dict[str, Any]:
    cfg = languages_service.get_languages_config()
    return cfg if isinstance(cfg, dict) else {}


def _normalize_lang_code(value: Any, lang_cfg: dict[str, Any]) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if _LANG_CODE_LOOKUP_CACHE["cfg"] is not lang_cfg:
        lookup: dict[str, str] = {}
        languages = lang_cfg.get("languages", []) if isinstance(lang_cfg, dict) else []
        if isinstance(languages, list):
            for row in languages:
                if not isinstance(row, dict):
                    continue
                code = str(row.get("code", "")).strip().lower()
                if not code:
                    continue
                for field in ("code", "name", "label", "native_name"):
                    alias = str(row.get(field, "")).strip().lower()
                    if alias and alias not in lookup:
                        lookup[alias] = code
        _LANG_CODE_LOOKUP_CACHE["cfg"] = lang_cfg
        _LANG_CODE_LOOKUP_CACHE["lookup"] = lookup
    return _LANG_CODE_LOOKUP_CACHE["lookup"].get(raw, raw)


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


def _set_best_score(dst: dict[str, float], exam_id: Any, score: Any) -> None:
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


def _normalize_gpa_score(val: Any, scale: Any = None) -> float | None:
    num = _to_num(val)
    if num is None or num < 0.0 or num > 5.0:
        return None
    scale_num = _to_num(scale)
    if scale_num is not None and math.isclose(scale_num, 5.0):
        return round((num / 5.0) * 4.0, 2)
    if num <= 4.0:
        return round(float(num), 2)
    return round((num / 5.0) * 4.0, 2)


def _build_user_context(profile: dict[str, Any], lang_cfg: dict[str, Any]) -> dict[str, Any]:
    user_scores: dict[str, float] = {}
    valid_exam_ids: set[str] = set()
    user_languages: dict[str, dict[str, Any]] = {}

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
                taken_on=row.get("taken_on"),
            )
            if exams_service._config_entry(parsed["exam"]).get("type") == "bool" and not parsed.get("score"):
                continue
            _set_best_score(user_scores, parsed.get("exam", exam_id), parsed.get("score"))
            if parsed.get("exam"):
                valid_exam_ids.add(str(parsed["exam"]).strip().upper())
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
                        if nested_exam:
                            valid_exam_ids.add(str(nested_exam).strip().upper())
        except (ValueError, TypeError):
            continue

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
                    valid_exam_ids.add(parsed_exam_id.upper())
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
                            if nested_exam:
                                valid_exam_ids.add(str(nested_exam).strip().upper())
                continue
            except (ValueError, TypeError):
                continue

    return {
        "userScores": user_scores,
        "validExamIds": valid_exam_ids,
        "userLanguages": user_languages,
        "budget": _to_num(profile.get("budget")),
    }


def _get_user_score(user_scores: dict[str, Any], exam_id: Any, user_languages: dict[str, Any] | None = None) -> float | None:
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


def _score_requirement(user: Any, min_val: Any, avg_val: Any, higher_is_better: bool = True, mode: str = "sort") -> dict[str, Any]:
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


def _collect_language_requirements(track: dict[str, Any]) -> dict[str, Any]:
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


def _score_single_language_rule(lang_rule: dict[str, Any], user_languages: dict[str, Any], lang_cfg: dict[str, Any], mode: str = "sort") -> dict[str, Any]:
    code = _normalize_lang_code(lang_rule.get("code"), lang_cfg)
    state = user_languages.get(code) if code else None
    if not isinstance(state, dict):
        state = {}

    if bool(lang_rule.get("accept_native")) and bool(state.get("native")):
        return {"score": 1.0, "pass": True, "gap": 0.0, "conditional": False}

    candidates: list[dict[str, Any]] = []

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

    parent_exams = _get_language_exam_lookup()["parents"].get(code, {})
    exam_groups: dict[str, list[tuple[Any, dict[str, Any]]]] = {}
    for exam_id, min_val in req.items():
        # Do not infer exam-equivalent score from CEFR/native evidence.
        # Language exam thresholds (IELTS/TestDaF/DSH/etc.) must be met by
        # explicit exam evidence in this language rule.
        configured_exam_id = _configured_language_exam_id(code, exam_id, min_val)
        if not configured_exam_id or _to_num(min_val) is None:
            continue
        user = _get_user_score(state.get("exams", {}), configured_exam_id, None)
        if user is None and configured_exam_id != exam_id:
            user = _get_user_score(state.get("exams", {}), exam_id, None)
        avg_val = avg.get(exam_id) if exam_id in avg else None
        higher = _is_higher_better(exam_id)
        family = parent_exams.get(configured_exam_id, configured_exam_id)
        exam_groups.setdefault(family, []).append((user, _score_requirement(user, min_val, avg_val, higher_is_better=higher, mode=mode)))

    # A test's total and required sections are conjunctive; different tests are alternatives.
    for rows in exam_groups.values():
        if not any(user is not None for user, _ in rows):
            continue
        results = [result for _, result in rows]
        candidates.append({
            "score": min(result["score"] for result in results),
            "pass": all(result["pass"] for result in results),
            "gap": max(result["gap"] for result in results),
            "conditional": any(result["conditional"] for result in results),
        })

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

    best = max(candidates, key=lambda row: (bool(row["pass"]) and not row["conditional"], bool(row["conditional"]), row["score"]))
    return {
        "score": _clamp01(float(best["score"])),
        "pass": bool(best["pass"]),
        "gap": float(best["gap"]),
        "conditional": bool(best["conditional"]),
    }


def _language_rule_assessments(
    rule: dict[str, Any], user_languages: dict[str, Any], lang_cfg: dict[str, Any], mode: str
) -> list[dict[str, Any]]:
    code = _normalize_lang_code(rule.get("code"), lang_cfg)
    state = user_languages.get(code) if code else None
    state = state if isinstance(state, dict) else {}
    rows: list[dict[str, Any]] = []

    def add(exam: str, minimum: Any, provided: Any) -> None:
        passed = bool(_score_requirement(provided, minimum, None, higher_is_better=_is_higher_better(exam), mode="chance").get("pass")) if provided is not None else False
        rows.append({
            "exam": exam, "minimum": minimum, "provided": provided,
            "status": "missing" if provided is None else "met" if passed else "unmet",
            "mode": mode,
        })

    if bool(rule.get("accept_native")):
        rows.append({
            "exam": f"Native {code or 'language'}", "minimum": None,
            "provided": "native" if state.get("native") else None,
            "status": "met" if state.get("native") else "missing", "mode": mode,
        })

    min_cefr = _to_num(rule.get("min_cefr"))
    if min_cefr is not None:
        add(f"CEFR ({code or 'language'})", min_cefr, _to_num(state.get("cefr")))

    requirements = rule.get("requirements")
    if not isinstance(requirements, dict):
        requirements = rule.get("exams")
    if isinstance(requirements, dict):
        user_exam_scores = state.get("exams") if isinstance(state.get("exams"), dict) else {}
        for exam_id, raw_minimum in requirements.items():
            minimum = _to_num(raw_minimum)
            configured_exam_id = _configured_language_exam_id(code, exam_id, raw_minimum)
            if minimum is None or not configured_exam_id:
                rows.append({"exam": str(exam_id), "minimum": raw_minimum, "provided": None, "status": "unassessed", "mode": mode})
            else:
                provided = _get_user_score(user_exam_scores, configured_exam_id)
                if provided is None and configured_exam_id != exam_id:
                    provided = _get_user_score(user_exam_scores, exam_id)
                add(str(exam_id), minimum, provided)
    return rows


def _admission_choice_key(choice: dict[str, Any], idx: int) -> str:
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


def _normalize_selected_admission_choices(profile: dict[str, Any]) -> dict[str, dict[str, str]]:
    if not isinstance(profile, dict):
        return {}
    raw = profile.get("selectedAdmissionChoices")
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict[str, str]] = {}
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


def _selected_choice_key_for_university(profile: dict[str, Any], university: dict[str, Any]) -> str:
    selections = _normalize_selected_admission_choices(profile)
    uni_id = str((university or {}).get("id") or "").strip()
    if not uni_id:
        return ""
    return str(selections.get(uni_id, {}).get("choiceKey") or "").strip()


def _selected_program_id_for_university(profile: dict[str, Any], university: dict[str, Any]) -> str:
    selections = _normalize_selected_admission_choices(profile)
    uni_id = str((university or {}).get("id") or "").strip()
    return str(selections.get(uni_id, {}).get("programId") or "").strip() if uni_id else ""


def _normalize_study_level_str(val: Any) -> str:
    s = str(val or "").strip().lower()
    if not s or s == "any":
        return "any"
    if any(token in s for token in ("магистрат", "магистр")):
        return "master"
    if any(token in s for token in ("бакалавр", "бакалавриат")):
        return "bachelor"
    if any(token in s for token in ("докторант", "аспирант", "доктор философии")):
        return "doctorate"
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


def _has_profile_evidence(ctx: dict[str, Any]) -> bool:
    return bool(ctx["userScores"]) or any(
        isinstance(v, dict) and (bool(v.get("native")) or _to_num(v.get("cefr")) is not None or bool(v.get("exams")))
        for v in (ctx.get("userLanguages") or {}).values()
    )
