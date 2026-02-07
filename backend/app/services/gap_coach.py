import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple


TYPE_ORDER = {"academic": 0, "language": 1, "budget": 2}


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _num_out(value: Any) -> Optional[float]:
    num = _to_float(value)
    if num is None:
        return None
    if abs(num - round(num)) < 1e-9:
        return int(round(num))
    return round(num, 3)


def _fmt_num(value: Any) -> str:
    num = _to_float(value)
    if num is None:
        return ""
    if abs(num - round(num)) < 1e-9:
        return str(int(round(num)))
    return f"{num:.2f}".rstrip("0").rstrip(".")


def _canonical_exam_key(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    return "".join(ch for ch in raw if ch.isalnum())


def _pick_score(scores: Dict[str, float], exam_id: str) -> Optional[float]:
    if not scores:
        return None
    target = _canonical_exam_key(exam_id)
    if not target:
        return None
    for key, val in scores.items():
        if _canonical_exam_key(key) == target:
            return _to_float(val)
    return None


def normalize_top_n(value: Any, default: int = 3) -> int:
    try:
        out = int(value)
    except (TypeError, ValueError):
        out = default
    return max(1, min(6, out))


def _profile_state(profile: Dict[str, Any]) -> Dict[str, Any]:
    p = profile if isinstance(profile, dict) else {}

    scores: Dict[str, float] = {}
    langs: Dict[str, Dict[str, Any]] = {}

    gpa = _to_float(p.get("gpa"))
    if gpa is not None:
        scores["GPA"] = gpa

    for exam in (p.get("exams") or []):
        if not isinstance(exam, dict):
            continue
        exam_id = str(exam.get("id") or exam.get("exam") or "").strip().upper()
        score = _to_float(exam.get("score"))
        if not exam_id or score is None:
            continue
        if exam_id not in scores:
            scores[exam_id] = score
        else:
            scores[exam_id] = max(scores[exam_id], score)

    for lang in (p.get("languages") or []):
        if not isinstance(lang, dict):
            continue
        code = str(lang.get("code") or lang.get("lang") or "").strip().lower()
        kind = str(lang.get("kind") or "").strip().lower()
        if not code or not kind:
            continue
        if code not in langs:
            langs[code] = {"native": False, "cefr": None, "exams": {}}

        if kind == "native":
            langs[code]["native"] = True
            continue

        if kind == "cefr":
            try:
                level = int(lang.get("level"))
            except (TypeError, ValueError):
                continue
            prev = langs[code].get("cefr")
            langs[code]["cefr"] = max(prev or 0, level)
            continue

        if kind == "exam":
            exam_id = str(lang.get("exam") or lang.get("examId") or "").strip().upper()
            score = _to_float(lang.get("score"))
            if not exam_id or score is None:
                continue
            prev_lang = _to_float(langs[code]["exams"].get(exam_id)) or 0.0
            langs[code]["exams"][exam_id] = max(prev_lang, score)
            prev_global = _to_float(scores.get(exam_id)) or 0.0
            scores[exam_id] = max(prev_global, score)

    has_evidence = bool(scores) or any(
        bool(v.get("native") or v.get("cefr") or (v.get("exams") or {}))
        for v in langs.values()
    )

    return {
        "scores": scores,
        "languages": langs,
        "budget": _to_float(p.get("budget")),
        "major": str(p.get("major") or "").strip(),
        "study_mode": str(p.get("studyMode") or "").strip(),
        "has_evidence": has_evidence,
    }


def _track_id_label(track: Dict[str, Any], idx: int) -> Tuple[str, str]:
    track_id = str(track.get("id") or "").strip() or f"track_{idx + 1}"
    label = str(track.get("label") or "").strip() or f"Track {idx + 1}"
    return track_id, label


def _track_cost(track: Dict[str, Any], university_tuition: Any) -> Optional[float]:
    override = track.get("finance_override")
    if isinstance(override, dict):
        val = _to_float(override.get("total_cost_year_usd"))
        if val is not None:
            return val
    return _to_float(university_tuition)


def _language_rules(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = track.get("language_requirements")
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        out: List[Dict[str, Any]] = []
        for code, cfg in raw.items():
            if isinstance(cfg, dict):
                out.append({"code": code, **cfg})
        return out
    return []


def _language_rule_eval(rule: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    code = str(rule.get("code") or "").strip().lower()
    if not code:
        return {"ok": True, "blockers": [], "severity": 0.0}

    lang = (state.get("languages") or {}).get(code, {})
    reqs = rule.get("requirements")
    reqs = reqs if isinstance(reqs, dict) else {}
    min_cefr = rule.get("min_cefr")
    accept_native = bool(rule.get("accept_native"))

    if accept_native and bool(lang.get("native")):
        return {"ok": True, "blockers": [], "severity": 0.0}

    blockers: List[Dict[str, Any]] = []
    satisfied = False

    min_cefr_num = _to_float(min_cefr)
    user_cefr = _to_float(lang.get("cefr"))
    if min_cefr_num is not None:
        if user_cefr is not None and user_cefr + 1e-9 >= min_cefr_num:
            satisfied = True
        else:
            blockers.append({
                "type": "language",
                "key": f"CEFR_{code.upper()}",
                "required_min": min_cefr_num,
                "current": user_cefr,
                "delta_needed": None if user_cefr is None else max(0.0, min_cefr_num - user_cefr),
            })

    exam_blockers: List[Dict[str, Any]] = []
    exam_passed = False
    for exam_id, required in sorted(reqs.items(), key=lambda x: str(x[0]).upper()):
        required_num = _to_float(required)
        if required_num is None:
            continue
        current = _pick_score(lang.get("exams") or {}, str(exam_id))
        if current is None:
            current = _pick_score(state.get("scores") or {}, str(exam_id))
        if current is not None and current + 1e-9 >= required_num:
            exam_passed = True
        else:
            exam_blockers.append({
                "type": "language",
                "key": str(exam_id).strip().upper(),
                "required_min": required_num,
                "current": current,
                "delta_needed": None if current is None else max(0.0, required_num - current),
            })

    if reqs:
        if exam_passed:
            satisfied = True
        else:
            blockers.extend(exam_blockers)

    if not reqs and min_cefr_num is None:
        satisfied = True

    if satisfied:
        return {"ok": True, "blockers": [], "severity": 0.0}

    severity = float(len(blockers) * 100.0)
    for blocker in blockers:
        delta = _to_float(blocker.get("delta_needed"))
        if delta is not None:
            severity += min(delta, 100.0)

    return {"ok": False, "blockers": blockers, "severity": severity}


def _language_eval(track: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    rules = _language_rules(track)
    if not rules:
        return {"ok": True, "blockers": [], "rules_total": 0, "rules_failed": 0}

    mode = str(track.get("language_requirements_mode") or "all").strip().lower()
    results = [_language_rule_eval(rule, state) for rule in rules]

    if mode == "any":
        if any(result.get("ok") for result in results):
            return {"ok": True, "blockers": [], "rules_total": 1, "rules_failed": 0}
        candidate = min(results, key=lambda r: (float(r.get("severity") or 0.0), len(r.get("blockers") or [])))
        return {
            "ok": False,
            "blockers": list(candidate.get("blockers") or []),
            "rules_total": 1,
            "rules_failed": 1,
        }

    blockers: List[Dict[str, Any]] = []
    rules_failed = 0
    for result in results:
        if result.get("ok"):
            continue
        rules_failed += 1
        blockers.extend(result.get("blockers") or [])

    return {
        "ok": rules_failed == 0,
        "blockers": blockers,
        "rules_total": len(rules),
        "rules_failed": rules_failed,
    }


def _academic_eval(track: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    reqs = track.get("requirements")
    reqs = reqs if isinstance(reqs, dict) else {}
    scores = state.get("scores") or {}

    blockers: List[Dict[str, Any]] = []
    total = 0
    failed = 0
    for exam_id, required in sorted(reqs.items(), key=lambda x: str(x[0]).upper()):
        required_num = _to_float(required)
        if required_num is None:
            continue
        total += 1
        current = _pick_score(scores, str(exam_id))
        if current is None:
            failed += 1
            blockers.append({
                "type": "academic",
                "key": str(exam_id).strip().upper(),
                "required_min": required_num,
                "current": None,
                "delta_needed": required_num,
            })
            continue
        if current + 1e-9 < required_num:
            failed += 1
            blockers.append({
                "type": "academic",
                "key": str(exam_id).strip().upper(),
                "required_min": required_num,
                "current": current,
                "delta_needed": max(0.0, required_num - current),
            })

    return {"blockers": blockers, "requirements_total": total, "requirements_failed": failed}


def _score_from_blockers(
    blockers: List[Dict[str, Any]],
    has_evidence: bool,
    academic_total: int,
    language_total: int,
) -> int:
    score = 100.0

    for blocker in blockers:
        btype = str(blocker.get("type") or "").strip().lower()
        current = _to_float(blocker.get("current"))
        required = _to_float(blocker.get("required_min")) or 0.0
        delta = _to_float(blocker.get("delta_needed")) or 0.0
        ratio = (delta / required) if required > 0 else 0.0

        if btype == "academic":
            if current is None:
                score -= 15.0
            else:
                score -= 9.0 + min(10.0, ratio * 25.0)
            continue

        if btype == "language":
            key = str(blocker.get("key") or "").upper()
            if key.startswith("CEFR_"):
                score -= 10.0 if current is None else 8.0
            elif current is None:
                score -= 12.0
            else:
                score -= 8.0 + min(8.0, ratio * 20.0)
            continue

        if btype == "budget":
            score -= 8.0

    if not has_evidence and (academic_total > 0 or language_total > 0):
        score -= 8.0

    if len(blockers) > 1:
        score -= min(10.0, float((len(blockers) - 1) * 2))

    score = max(0.0, min(100.0, score))
    return int(round(score))


def _status_from_score(score: int) -> str:
    if score >= 75:
        return "safe"
    if score >= 45:
        return "borderline"
    return "at-risk"


def _action_key_slug(value: Any) -> str:
    raw = str(value or "").strip().lower()
    out = []
    for ch in raw:
        if ch.isalnum():
            out.append(ch)
        else:
            out.append("_")
    slug = "".join(out).strip("_")
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug or "item"


def _blocker_sort_key(blocker: Dict[str, Any]) -> Tuple[int, str]:
    btype = str(blocker.get("type") or "").strip().lower()
    key = str(blocker.get("key") or "").strip().upper()
    return TYPE_ORDER.get(btype, 9), key


def _build_actions(blockers: List[Dict[str, Any]], state: Dict[str, Any]) -> List[Dict[str, Any]]:
    dedup: Dict[str, Dict[str, Any]] = {}

    for blocker in blockers:
        btype = str(blocker.get("type") or "").strip().lower()
        key = str(blocker.get("key") or "").strip().upper()
        required = _to_float(blocker.get("required_min"))
        current = _to_float(blocker.get("current"))
        delta = _to_float(blocker.get("delta_needed"))

        action_id = ""
        text = ""
        gain = 0

        if btype == "academic":
            action_id = f"improve_{_action_key_slug(key)}"
            if current is None:
                text = f"Add {key} score and target at least {_fmt_num(required)}"
                gain = 10
            else:
                text = f"Raise {key} by ~{_fmt_num(delta)} points"
                gain = 9

        elif btype == "language":
            if key.startswith("CEFR_"):
                lang_code = key.split("_", 1)[1] if "_" in key else "LANG"
                action_id = f"improve_{_action_key_slug(lang_code)}_cefr"
                text = f"Reach {lang_code} CEFR {_fmt_num(required)}"
                gain = 7
            else:
                action_id = f"improve_{_action_key_slug(key)}"
                if current is None:
                    text = f"Add {key} language score and target {_fmt_num(required)}"
                    gain = 7
                else:
                    text = f"Raise {key} to {_fmt_num(required)}"
                    gain = 6

        elif btype == "budget":
            action_id = "budget_gap"
            text = f"Close yearly budget gap by ${_fmt_num(delta)} or target grant track"
            gain = 4

        if not action_id or not text:
            continue

        existing = dedup.get(action_id)
        if not existing or gain > int(existing.get("estimated_chance_gain_pct") or 0):
            dedup[action_id] = {
                "id": action_id,
                "text": text,
                "estimated_chance_gain_pct": int(gain),
            }

    if not dedup:
        if not state.get("has_evidence"):
            dedup["complete_profile"] = {
                "id": "complete_profile",
                "text": "Fill profile with GPA, exams, and language evidence for precise guidance",
                "estimated_chance_gain_pct": 6,
            }
        elif state.get("budget") is None:
            dedup["set_budget"] = {
                "id": "set_budget",
                "text": "Add yearly budget in profile to unlock affordability guidance",
                "estimated_chance_gain_pct": 3,
            }
        else:
            dedup["maintain_profile"] = {
                "id": "maintain_profile",
                "text": "You meet current minimums; keep profile updated and monitor track changes",
                "estimated_chance_gain_pct": 2,
            }

    out = sorted(
        dedup.values(),
        key=lambda action: (
            -int(action.get("estimated_chance_gain_pct") or 0),
            str(action.get("id") or ""),
        ),
    )
    for idx, action in enumerate(out, start=1):
        action["priority"] = idx
    return out


def _evaluate_track(university: Dict[str, Any], track: Dict[str, Any], state: Dict[str, Any], idx: int) -> Dict[str, Any]:
    track_id, track_label = _track_id_label(track, idx)
    uni_tuition = ((university.get("finance") or {}) or {}).get("total_cost_year_usd")

    academic = _academic_eval(track, state)
    language = _language_eval(track, state)

    blockers: List[Dict[str, Any]] = []
    blockers.extend(academic.get("blockers") or [])
    blockers.extend(language.get("blockers") or [])

    budget = _to_float(state.get("budget"))
    track_cost = _track_cost(track, uni_tuition)
    if budget is not None and track_cost is not None and budget + 1e-9 < track_cost:
        blockers.append({
            "type": "budget",
            "key": "TOTAL_COST_YEAR_USD",
            "required_min": track_cost,
            "current": budget,
            "delta_needed": max(0.0, track_cost - budget),
        })

    blockers = sorted(blockers, key=_blocker_sort_key)
    readiness = _score_from_blockers(
        blockers=blockers,
        has_evidence=bool(state.get("has_evidence")),
        academic_total=int(academic.get("requirements_total") or 0),
        language_total=int(language.get("rules_total") or 0),
    )

    return {
        "id": track_id,
        "label": track_label,
        "readiness_score_0_100": readiness,
        "readiness_status": _status_from_score(readiness),
        "blockers": blockers,
    }


def build_gap_coach(university: Dict[str, Any], profile: Dict[str, Any], top_n_actions: int = 3) -> Dict[str, Any]:
    uni = university if isinstance(university, dict) else {}
    uni_id = str(uni.get("id") or "").strip()
    state = _profile_state(profile)

    tracks_raw = uni.get("admission_tracks")
    tracks = [t for t in tracks_raw if isinstance(t, dict)] if isinstance(tracks_raw, list) else []
    if not tracks:
        tracks = [{"id": "general_admission", "label": "General admission", "requirements": {}}]

    evaluated = [_evaluate_track(uni, track, state, idx) for idx, track in enumerate(tracks)]
    evaluated.sort(
        key=lambda row: (
            -int(row.get("readiness_score_0_100") or 0),
            len(row.get("blockers") or []),
            str(row.get("label") or ""),
        )
    )

    best = evaluated[0] if evaluated else {
        "id": "general_admission",
        "label": "General admission",
        "readiness_score_0_100": 0,
        "readiness_status": "at-risk",
        "blockers": [],
    }

    blockers_out: List[Dict[str, Any]] = []
    for blocker in (best.get("blockers") or []):
        blockers_out.append({
            "type": str(blocker.get("type") or ""),
            "key": str(blocker.get("key") or ""),
            "required_min": _num_out(blocker.get("required_min")),
            "current": _num_out(blocker.get("current")),
            "delta_needed": _num_out(blocker.get("delta_needed")),
        })

    best_blockers = list(best.get("blockers") or [])
    actions = _build_actions(best_blockers, state)
    top_n = normalize_top_n(top_n_actions)
    selected_actions = list(actions[:top_n])

    has_budget_blocker = any(str(b.get("type") or "").strip().lower() == "budget" for b in best_blockers)
    if has_budget_blocker and not any(str(a.get("id") or "") == "budget_gap" for a in selected_actions):
        budget_action = next((a for a in actions if str(a.get("id") or "") == "budget_gap"), None)
        if budget_action is not None:
            if selected_actions:
                selected_actions[-1] = budget_action
            else:
                selected_actions = [budget_action]

    actions_out: List[Dict[str, Any]] = []
    for idx, action in enumerate(selected_actions, start=1):
        actions_out.append({
            "id": str(action.get("id") or f"action_{idx}"),
            "text": str(action.get("text") or ""),
            "priority": idx,
            "estimated_chance_gain_pct": int(action.get("estimated_chance_gain_pct") or 0),
        })

    alternatives = []
    for row in evaluated[1:4]:
        alternatives.append({
            "id": str(row.get("id") or ""),
            "label": str(row.get("label") or ""),
            "readiness_score_0_100": int(row.get("readiness_score_0_100") or 0),
        })

    return {
        "university_id": uni_id,
        "best_track": {
            "id": str(best.get("id") or ""),
            "label": str(best.get("label") or ""),
        },
        "readiness": {
            "score_0_100": int(best.get("readiness_score_0_100") or 0),
            "status": str(best.get("readiness_status") or "at-risk"),
        },
        "blockers": blockers_out,
        "recommended_actions": actions_out,
        "alternative_tracks": alternatives,
    }


def _profile_fingerprint(profile: Dict[str, Any]) -> Dict[str, Any]:
    state = _profile_state(profile)

    scores = {
        str(k): _num_out(v)
        for k, v in sorted((state.get("scores") or {}).items(), key=lambda x: str(x[0]))
    }

    langs: Dict[str, Any] = {}
    for code in sorted((state.get("languages") or {}).keys()):
        lang = (state.get("languages") or {}).get(code) or {}
        exams = {
            str(k): _num_out(v)
            for k, v in sorted((lang.get("exams") or {}).items(), key=lambda x: str(x[0]))
        }
        langs[code] = {
            "native": bool(lang.get("native")),
            "cefr": _num_out(lang.get("cefr")),
            "exams": exams,
        }

    return {
        "scores": scores,
        "languages": langs,
        "budget": _num_out(state.get("budget")),
        "major": str(state.get("major") or ""),
        "study_mode": str(state.get("study_mode") or ""),
    }


def build_gap_coach_etag(university_etag: str, profile: Dict[str, Any], top_n_actions: int) -> str:
    payload = {
        "profile": _profile_fingerprint(profile),
        "top_n_actions": normalize_top_n(top_n_actions),
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    raw = f"{str(university_etag or '')}:{body}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"\"{digest}\""
