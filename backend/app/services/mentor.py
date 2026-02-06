
import json
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen
from urllib.error import URLError, HTTPError

from fastapi import HTTPException

from app.core.settings import (
    UNIMENTOR_NAME,
    UNIMENTOR_PROVIDER,
    UNIMENTOR_ENABLE_ONLINE,
    UNIMENTOR_GEMINI_MODEL,
    UNIMENTOR_GEMINI_FALLBACK_MODEL,
    UNIMENTOR_GEMINI_ENABLE_WEB,
    GEMINI_API_KEY,
    UNIMENTOR_TIMEOUT,
)
from app.services.universities import load_universities


def _mentor_http_json(url: str) -> Optional[Dict[str, Any]]:
    try:
        req = UrlRequest(url, headers={"User-Agent": "UniSearch-UniMentor/1.0"})
        with urlopen(req, timeout=UNIMENTOR_TIMEOUT) as r:
            body = r.read().decode("utf-8", errors="ignore")
            data = json.loads(body)
            return data if isinstance(data, dict) else None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
    except Exception:
        return None


def _mentor_find_university(question: str, university_id: str = "") -> Optional[Dict[str, Any]]:
    items = load_universities()
    uid = str(university_id or "").strip().lower()
    if uid:
        for u in items:
            if str(u.get("id", "")).strip().lower() == uid:
                return u

    q = str(question or "").strip().lower()
    if not q:
        return None

    for u in items:
        name = str(u.get("name", "")).strip().lower()
        if name and name in q:
            return u

    return None


def _mentor_fmt_num(v: Any) -> str:
    try:
        if v is None or v == "":
            return ""
        f = float(v)
        if abs(f - int(f)) < 1e-9:
            return str(int(f))
        return str(round(f, 2))
    except Exception:
        return str(v)


def _mentor_cefr_label(v: Any) -> str:
    try:
        m = int(v)
    except Exception:
        return str(v)
    return {1: "A1", 2: "A2", 3: "B1", 4: "B2", 5: "C1", 6: "C2"}.get(m, str(m))


def _mentor_profile_state(profile: Dict[str, Any]) -> Dict[str, Any]:
    p = profile if isinstance(profile, dict) else {}
    scores: Dict[str, float] = {}
    langs: Dict[str, Any] = {}

    gpa = p.get("gpa", None)
    if gpa not in (None, ""):
        try:
            scores["GPA"] = float(gpa)
        except Exception:
            pass

    for e in (p.get("exams", []) or []):
        if not isinstance(e, dict):
            continue
        exam_id = str(e.get("id") or e.get("exam") or "").strip().upper()
        score = e.get("score", None)
        if exam_id and score not in (None, ""):
            try:
                scores[exam_id] = float(score)
            except Exception:
                pass

    for l in (p.get("languages", []) or []):
        if not isinstance(l, dict):
            continue
        code = str(l.get("code") or l.get("lang") or "").strip().lower()
        kind = str(l.get("kind") or "").strip().lower()
        if not code or not kind:
            continue
        if code not in langs:
            langs[code] = {"native": False, "cefr": None, "exams": {}}

        if kind == "native":
            langs[code]["native"] = True
        elif kind == "cefr":
            try:
                level = int(l.get("level"))
                langs[code]["cefr"] = max(langs[code]["cefr"] or 0, level)
            except Exception:
                pass
        elif kind == "exam":
            exam_id = str(l.get("exam") or l.get("examId") or "").strip().upper()
            score = l.get("score", None)
            if exam_id and score not in (None, ""):
                try:
                    langs[code]["exams"][exam_id] = max(
                        langs[code]["exams"].get(exam_id) or 0,
                        float(score),
                    )
                    scores[exam_id] = max(
                        scores.get(exam_id) or 0,
                        float(score),
                    )
                except Exception:
                    pass

    has_evidence = bool(scores) or any(
        (v.get("native") or v.get("cefr") or v.get("exams")) for v in langs.values()
    )

    return {
        "scores": scores,
        "languages": langs,
        "budget": p.get("budget", None),
        "has_evidence": has_evidence,
        "study_mode": str(p.get("studyMode") or "").strip(),
    }


def _mentor_pick_score(scores: Dict[str, float], exam_id: str) -> Optional[float]:
    if not scores or not exam_id:
        return None
    up = str(exam_id).strip().upper()
    if up in scores:
        return scores.get(up)
    for k, v in scores.items():
        if str(k).strip().upper() == up:
            return v
    return None


def _mentor_language_rules(track: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = track.get("language_requirements")
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        out = []
        for code, cfg in raw.items():
            if isinstance(cfg, dict):
                out.append({"code": code, **cfg})
        return out
    return []


def _mentor_eval_lang_rule(rule: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    code = str(rule.get("code") or "").strip().lower()
    if not code:
        return {"ok": False, "missing": ["language code missing"], "summary": ""}
    lang = (state.get("languages") or {}).get(code, {})
    global_scores = state.get("scores") or {}
    min_cefr = rule.get("min_cefr")
    accept_native = bool(rule.get("accept_native"))
    reqs = rule.get("requirements") or {}

    missing = []

    if accept_native and lang.get("native"):
        return {"ok": True, "missing": [], "summary": f"{code.upper()}: native accepted."}

    user_cefr = lang.get("cefr")
    if min_cefr is not None:
        if user_cefr is not None and user_cefr >= int(min_cefr):
            return {
                "ok": True,
                "missing": [],
                "summary": f"{code.upper()}: CEFR {_mentor_cefr_label(user_cefr)} meets minimum {_mentor_cefr_label(min_cefr)}.",
            }
        missing.append(f"{code.upper()}: CEFR >= {_mentor_cefr_label(min_cefr)}")

    if reqs and isinstance(reqs, dict):
        for ex_id, min_v in reqs.items():
            user = _mentor_pick_score(global_scores, ex_id)
            if user is None:
                user = _mentor_pick_score(lang.get("exams") or {}, ex_id)
            if user is None:
                missing.append(f"{ex_id} >= {_mentor_fmt_num(min_v)}")
            elif user < float(min_v):
                missing.append(f"{ex_id} {_mentor_fmt_num(user)}/{_mentor_fmt_num(min_v)}")
            else:
                best_ok = f"{ex_id} {_mentor_fmt_num(user)} >= {_mentor_fmt_num(min_v)}"
                return {"ok": True, "missing": [], "summary": best_ok}

    if missing:
        return {"ok": False, "missing": missing, "summary": ""}
    return {"ok": True, "missing": [], "summary": ""}


def _mentor_eval_language(track: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    rules = _mentor_language_rules(track)
    if not rules:
        return {"ok": True, "missing": [], "summary": ""}
    mode = str(track.get("language_requirements_mode") or "all").strip().lower()
    results = [_mentor_eval_lang_rule(r, state) for r in rules]
    if mode == "any":
        ok = any(r.get("ok") for r in results)
        missing = []
        if not ok:
            for r in results:
                missing.extend(r.get("missing", []))
        return {"ok": ok, "missing": missing, "summary": ""}
    missing = []
    ok = True
    for r in results:
        if not r.get("ok"):
            ok = False
            missing.extend(r.get("missing", []))
    return {"ok": ok, "missing": missing, "summary": ""}


def _mentor_track_cost(track: Dict[str, Any], university_tuition: Any) -> Optional[float]:
    cost = None
    if track.get("finance_override"):
        cost = track.get("finance_override", {}).get("total_cost_year_usd")
    if cost is None:
        cost = university_tuition
    try:
        return float(cost) if cost is not None else None
    except Exception:
        return None


def _mentor_eval_track(track: Dict[str, Any], university_tuition: Any, state: Dict[str, Any], idx: int) -> Dict[str, Any]:
    label = track.get("label") or f"Track {idx + 1}"
    reqs = track.get("requirements", {}) or {}
    scores = state.get("scores", {}) or {}

    missing = []
    below = []
    for ex, mn in reqs.items():
        user = _mentor_pick_score(scores, ex)
        if user is None:
            missing.append(f"{ex} >= {_mentor_fmt_num(mn)}")
            continue
        if user < float(mn):
            below.append(f"{ex} {_mentor_fmt_num(user)}/{_mentor_fmt_num(mn)}")

    lang = _mentor_eval_language(track, state)
    academic_pass = not missing and not below
    language_pass = bool(lang.get("ok"))
    cost = _mentor_track_cost(track, university_tuition)
    score = 1.0
    if not academic_pass:
        score -= 0.35
    if not language_pass:
        score -= 0.25

    return {
        "label": label,
        "missing": missing,
        "below": below,
        "academic_pass": academic_pass,
        "language_pass": language_pass,
        "language_missing": lang.get("missing", []),
        "cost": cost,
        "score": max(0.0, score),
    }


def _mentor_best_track(university: Dict[str, Any], state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tracks = university.get("admission_tracks") or []
    if not tracks:
        return None
    tuition = (university.get("finance") or {}).get("total_cost_year_usd")
    scored = [_mentor_eval_track(t, tuition, state, i) for i, t in enumerate(tracks)]
    scored.sort(key=lambda x: x.get("score", 0), reverse=True)
    return scored[0] if scored else None


def _mentor_detect_intent(question: str) -> str:
    q = str(question or "").strip().lower()
    if not q:
        return "general"
    if any(x in q for x in ["compare", "vs", "versus"]):
        return "compare"
    if any(x in q for x in ["checklist", "documents", "required docs", "requirements"]):
        return "checklist"
    if any(x in q for x in ["admission", "chance", "probability", "get in", "acceptance"]):
        return "admission"
    if any(x in q for x in ["improve", "roadmap", "plan", "increase"]):
        return "improve"
    if any(x in q for x in ["fit", "match"]):
        return "fit"
    return "general"


def _mentor_build_action_plan(best: Dict[str, Any], state: Dict[str, Any]) -> List[str]:
    items = []
    scores = state.get("scores", {}) or {}
    for miss in best.get("missing", [])[:4]:
        items.append(f"Add {miss}.")
    for low in best.get("below", [])[:4]:
        items.append(f"Improve {low}.")

    if not items and not state.get("has_evidence"):
        items.append("Add your GPA/exam scores and language proficiency to get a precise evaluation.")

    if not items:
        items.append("Your profile meets the basics; focus on boosting your strongest exam or language score for better odds.")
    return items


def _mentor_track_comparison_text(name: str, analysis: Optional[Dict[str, Any]]) -> str:
    if not analysis:
        return f"{name} has no detailed admission track data in our dataset."
    lines = [f"{name} best track: {analysis.get('label', 'Track')}"]
    if analysis.get("academic_pass"):
        lines.append("Academic minimums: passed.")
    else:
        missing_parts = []
        if analysis.get("missing"):
            missing_parts.append("missing " + ", ".join(analysis.get("missing", [])[:3]))
        if analysis.get("below"):
            missing_parts.append("below minimum " + ", ".join(analysis.get("below", [])[:3]))
        lines.append("Academic minimums: not fully met (" + "; ".join(missing_parts) + ").")
    if analysis.get("language_pass"):
        lines.append("Language: requirement satisfied.")
    else:
        lm = ", ".join(analysis.get("language_missing", [])[:3]) or "language evidence is insufficient"
        lines.append(f"Language: not satisfied ({lm}).")
    return "\n".join(lines)


def _mentor_build_quick_options(university: Optional[Dict[str, Any]], profile: Dict[str, Any], intent: str = "general") -> List[str]:
    st = _mentor_profile_state(profile)
    items = []
    name = str((university or {}).get("name") or "this university")
    if intent in ("general", "fit"):
        items.append(f"What are the admission requirements for {name}?")
        items.append(f"Do I meet the minimum requirements for {name}?")
        items.append(f"How much does it cost to study at {name}?")
    if not st.get("has_evidence"):
        items.append("How do I set up my profile (GPA, exams, languages)?")
    if intent in ("admission", "fit"):
        items.append("Compare admission tracks and best fit for me.")
    if intent in ("improve", "checklist"):
        items.append("Give me a checklist for my application.")
    return items[:6]


def _mentor_university_answer(university: Dict[str, Any], question: str, profile: Optional[Dict[str, Any]] = None) -> str:
    u = university or {}
    name = str(u.get("name") or "This university")
    city = str((u.get("location") or {}).get("city") or "Unknown city")
    country = str((u.get("location") or {}).get("country") or "Unknown country")
    rank = u.get("rank", None)
    tuition = (u.get("finance") or {}).get("total_cost_year_usd")
    tracks = u.get("admission_tracks") or []

    intent = _mentor_detect_intent(question)
    state = _mentor_profile_state(profile or {})
    analysis = _mentor_best_track(u, state) if tracks else None

    if intent == "compare":
        return _mentor_track_comparison_text(name, analysis)

    if intent == "improve":
        if not tracks:
            return f"{name} has no detailed admission track data in our dataset."
        if not analysis:
            return f"{name} admission data exists, but I could not evaluate your profile. Add exams/languages in Profile and ask again."
        best = analysis
        plan = _mentor_build_action_plan(best, state)
        lines = [
            f"{name} improvement plan for '{best.get('label', 'Track')}' (current local fit {int(round((best.get('score', 0) or 0) * 100))}%):"
        ]
        lines.extend([f"{i+1}) {step}" for i, step in enumerate(plan[:6])])
        lines.append("After each update in Profile, ask again and I will re-rank priorities.")
        return "\n".join(lines)

    if intent in ("admission", "fit", "checklist"):
        if not tracks:
            return f"{name} has no detailed admission track data in our dataset."
        if not analysis:
            return f"{name} admission data exists, but I could not evaluate your profile. Add exams/languages in Profile and ask again."

        best = analysis
        lines = [
            f"{name} profile-based admission check:",
            f"1) Best track now: {best.get('label', 'Track')} (local fit {int(round((best.get('score', 0) or 0) * 100))}%).",
        ]
        if best.get("academic_pass"):
            lines.append("2) Academic minimums: passed.")
        else:
            missing_parts = []
            if best.get("missing"):
                missing_parts.append("missing " + ", ".join(best.get("missing", [])[:3]))
            if best.get("below"):
                missing_parts.append("below minimum " + ", ".join(best.get("below", [])[:3]))
            lines.append("2) Academic minimums: not fully met (" + "; ".join(missing_parts) + ").")
        if best.get("language_pass"):
            lines.append("3) Language: requirement satisfied.")
        else:
            lm = ", ".join(best.get("language_missing", [])[:3]) or "language evidence is insufficient"
            lines.append(f"3) Language: not satisfied ({lm}).")

        budget = state.get("budget")
        try:
            budget = float(budget) if budget is not None else None
        except Exception:
            budget = None
        cost = best.get("cost")
        try:
            cost = float(cost) if cost is not None else None
        except Exception:
            cost = None

        if budget is not None and cost is not None:
            if budget + 1e-9 >= cost:
                lines.append(f"4) Budget: affordable for this track (${int(round(cost)):,}/year vs budget ${int(round(budget)):,}).")
            else:
                gap = max(0.0, cost - budget)
                lines.append(f"4) Budget: gap about ${int(round(gap)):,}/year (${int(round(cost)):,} vs ${int(round(budget)):,}).")
        else:
            lines.append("4) Budget: add your budget in Profile to get affordability advice.")

        if intent == "checklist":
            lines.extend([
                "5) Checklist: verify official track page, prepare required exam proofs, gather transcript/documents, and check deadlines.",
                "6) After each profile update, ask again to re-check missing requirements.",
            ])
        else:
            lines.append("5) Ask me for a priority improvement roadmap or track comparison.")
        return "\n".join(lines)

    base = f"{name} is located in {city}, {country}."
    if isinstance(rank, int):
        base += f" Global rank in our dataset is #{rank}."
    if isinstance(tuition, (int, float)):
        base += f" Estimated annual cost starts around ${int(round(tuition)):,} USD."
    if tracks:
        base += f" We track {len(tracks)} admission pathway(s)."
    if analysis:
        base += f" Based on your current profile, best path is '{analysis.get('label', 'Track')}' ({int(round((analysis.get('score', 0) or 0)*100))}% local fit)."
    elif not state.get("has_evidence"):
        base += " Add exam/language profile data to get personalized admission analysis."
    return base


def _mentor_online_context(university: Optional[Dict[str, Any]], question: str, enabled: bool) -> List[Dict[str, str]]:
    if not enabled or not UNIMENTOR_ENABLE_ONLINE:
        return []

    q = str(question or "").strip()
    if not q:
        return []

    uni_name = str((university or {}).get("name", "")).strip()
    seed = f"{uni_name} {q}".strip()
    sources: List[Dict[str, str]] = []

    if uni_name:
        wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(uni_name)}"
        wiki = _mentor_http_json(wiki_url)
        if wiki:
            extract = str(wiki.get("extract", "")).strip()
            page_url = ((wiki.get("content_urls") or {}).get("desktop") or {}).get("page", "")
            if extract:
                sources.append({
                    "title": f"Wikipedia: {uni_name}",
                    "url": str(page_url or f"https://en.wikipedia.org/wiki/{quote(uni_name)}"),
                    "snippet": extract[:500],
                })

    ddg_params = urlencode({"q": seed, "format": "json", "no_html": "1", "skip_disambig": "1"})
    ddg_url = f"https://api.duckduckgo.com/?{ddg_params}"
    ddg = _mentor_http_json(ddg_url)
    if ddg:
        abstract = str(ddg.get("AbstractText", "")).strip()
        abstract_url = str(ddg.get("AbstractURL", "")).strip()
        heading = str(ddg.get("Heading", "")).strip() or "DuckDuckGo Instant Answer"
        if abstract:
            sources.append({
                "title": heading,
                "url": abstract_url or "https://duckduckgo.com/",
                "snippet": abstract[:500],
            })

    return sources[:4]


def _mentor_profile_summary(profile: Dict[str, Any]) -> Dict[str, Any]:
    p = profile if isinstance(profile, dict) else {}
    exams = []
    for e in (p.get("exams", []) or []):
        if not isinstance(e, dict):
            continue
        exam_id = str(e.get("id") or e.get("exam") or "").strip()
        score = e.get("score", None)
        if exam_id and score not in (None, ""):
            exams.append({"exam": exam_id, "score": score})

    langs = []
    for l in (p.get("languages", []) or []):
        if not isinstance(l, dict):
            continue
        code = str(l.get("code") or l.get("lang") or "").strip().lower()
        kind = str(l.get("kind") or "").strip().lower()
        if not code or not kind:
            continue
        row = {"code": code, "kind": kind}
        if kind == "cefr":
            row["level"] = l.get("level")
        if kind == "exam":
            row["exam"] = l.get("exam")
            row["score"] = l.get("score")
        langs.append(row)

    return {
        "name": str(p.get("name", "")).strip(),
        "major": str(p.get("major", "")).strip(),
        "study_mode": str(p.get("studyMode", "")).strip(),
        "budget_usd": p.get("budget", None),
        "exams": exams[:20],
        "languages": langs[:20],
    }


def _mentor_university_summary(university: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(university, dict):
        return {}
    tracks_raw = university.get("admission_tracks", []) or []
    tracks = []
    for t in tracks_raw[:6]:
        if not isinstance(t, dict):
            continue
        tracks.append({
            "id": t.get("id"),
            "label": t.get("label"),
            "requirements": t.get("requirements", {}) or {},
            "stats_avg": t.get("stats_avg", {}) or {},
            "language_requirements_mode": t.get("language_requirements_mode", "all"),
            "language_requirements": t.get("language_requirements", []) or [],
            "finance_override": (t.get("finance_override", {}) or {}).get("total_cost_year_usd"),
        })
    return {
        "id": university.get("id"),
        "name": university.get("name"),
        "website": university.get("website"),
        "location": university.get("location", {}) or {},
        "rank": university.get("rank"),
        "finance_total_cost_year_usd": (university.get("finance", {}) or {}).get("total_cost_year_usd"),
        "admission_tracks": tracks,
    }


def _mentor_parse_gemini_text(resp: Dict[str, Any]) -> str:
    if not isinstance(resp, dict):
        return ""
    out: List[str] = []
    for cand in (resp.get("candidates", []) or []):
        if not isinstance(cand, dict):
            continue
        content = cand.get("content", {}) or {}
        for part in (content.get("parts", []) or []):
            if isinstance(part, dict):
                txt = str(part.get("text", "")).strip()
                if txt:
                    out.append(txt)
    return "\n\n".join(out).strip()


def _mentor_parse_gemini_sources(resp: Dict[str, Any]) -> List[Dict[str, str]]:
    if not isinstance(resp, dict):
        return []
    seen: set = set()
    out: List[Dict[str, str]] = []

    def add(title: str, url: str):
        u = str(url or "").strip()
        if not u or u in seen:
            return
        seen.add(u)
        out.append({"title": str(title or "Web source").strip() or "Web source", "url": u})

    for cand in (resp.get("candidates", []) or []):
        if not isinstance(cand, dict):
            continue
        gm = cand.get("groundingMetadata") or cand.get("grounding_metadata") or {}
        chunks = gm.get("groundingChunks") or gm.get("grounding_chunks") or []
        for ch in (chunks or []):
            if not isinstance(ch, dict):
                continue
            web = ch.get("web", {}) or {}
            add(web.get("title", "Web source"), web.get("uri", ""))
        cm = cand.get("citationMetadata") or cand.get("citation_metadata") or {}
        for c in (cm.get("citations", []) or []):
            if isinstance(c, dict):
                add(c.get("title", "Citation"), c.get("uri", ""))
    return out[:5]


def _mentor_trim_error(text: str, limit: int = 240) -> str:
    msg = " ".join(str(text or "").split())
    if len(msg) <= limit:
        return msg
    return msg[: limit - 3] + "..."


def _mentor_allow_next_steps(intent: str) -> bool:
    return str(intent or "").strip().lower() in ("improve", "checklist")


def _mentor_strip_unsolicited_next_steps(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        return raw
    cleaned = re.sub(r"(?is)\n?\s*(next\s*steps?|recommended\s*next\s*steps?|action\s*plan)\s*:\s*.*$", "", raw).strip()
    return cleaned or raw


def _mentor_http_post_json(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    req = UrlRequest(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "UniSearch-UniMentor/1.0",
            "x-goog-api-key": GEMINI_API_KEY,
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=max(UNIMENTOR_TIMEOUT, 8.0)) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise RuntimeError("Gemini returned non-JSON response")
        return data
    except HTTPError as e:
        detail = ""
        try:
            raw = e.read().decode("utf-8", errors="ignore")
            parsed = json.loads(raw) if raw else {}
            if isinstance(parsed, dict):
                err = parsed.get("error", {}) or {}
                detail = str(err.get("message") or raw)
            else:
                detail = raw
        except Exception:
            detail = str(e)
        raise RuntimeError(f"Gemini HTTP {e.code}: {_mentor_trim_error(detail)}") from e
    except URLError as e:
        raise RuntimeError(f"Gemini network error: {_mentor_trim_error(str(getattr(e, 'reason', e)))}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini invalid JSON: {_mentor_trim_error(str(e))}") from e


def _mentor_call_gemini_for_model(model: str, question: str, university: Optional[Dict[str, Any]], profile: Dict[str, Any], online: bool, allow_next_steps: bool = False) -> Dict[str, Any]:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent"
    profile_ctx = _mentor_profile_summary(profile)
    uni_ctx = _mentor_university_summary(university)
    system_text = (
        f"You are {UNIMENTOR_NAME}, an admissions consultant for UniSearch. "
        "Use provided profile and university context first. "
        "Be concise, practical, and explicit about uncertainty. "
        "Output plain text only (no markdown symbols like **, *, #, or code blocks). "
        "Use short paragraphs and numbered steps when useful. "
        "Do not invent scholarships, deadlines, or hard requirements. "
        "If information is missing, say it clearly and suggest what to check on official university websites. "
        "Do not provide unsolicited advice or plans. "
        "Only answer the user’s explicit question. "
        "Do not suggest admission plans, roadmaps, or next steps unless the user explicitly asks for them. "
        "Do not add a 'Next Steps' section when the user did not request it. "
    )
    user_payload = {
        "question": question,
        "user_profile": profile_ctx,
        "university_context": uni_ctx,
        "task": (
            "Answer only the user question directly."
            if not allow_next_steps
            else "Answer the question and include concise, concrete next steps."
        ),
    }
    body: Dict[str, Any] = {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(user_payload, ensure_ascii=False)}]}],
        "generationConfig": {"temperature": 0.15, "maxOutputTokens": 700},
    }
    warning = ""
    data: Dict[str, Any]
    used_web_grounding = False
    if online and UNIMENTOR_GEMINI_ENABLE_WEB:
        body_with_tools = dict(body)
        body_with_tools["tools"] = [{"google_search": {}}]
        try:
            data = _mentor_http_post_json(endpoint, body_with_tools)
            used_web_grounding = True
        except RuntimeError as e:
            warning = f"Gemini web grounding unavailable: {_mentor_trim_error(str(e))}"
            data = _mentor_http_post_json(endpoint, body)
    else:
        data = _mentor_http_post_json(endpoint, body)

    text = _mentor_parse_gemini_text(data)
    if not text:
        raise ValueError("Empty response from Gemini")
    return {
        "answer": text,
        "sources": _mentor_parse_gemini_sources(data),
        "model": model,
        "online_used": bool(used_web_grounding),
        "warning": warning,
    }


def _mentor_call_gemini(question: str, university: Optional[Dict[str, Any]], profile: Dict[str, Any], online: bool, mode: str = "auto", allow_next_steps: bool = False) -> Dict[str, Any]:
    primary = UNIMENTOR_GEMINI_MODEL
    fallback = UNIMENTOR_GEMINI_FALLBACK_MODEL
    mode_norm = str(mode or "auto").strip().lower()

    if mode_norm == "gemini":
        return _mentor_call_gemini_for_model(primary, question, university, profile, online, allow_next_steps=allow_next_steps)

    if mode_norm == "fallback":
        if not fallback:
            raise RuntimeError("Fallback model is not configured")
        return _mentor_call_gemini_for_model(fallback, question, university, profile, online, allow_next_steps=allow_next_steps)

    try:
        return _mentor_call_gemini_for_model(primary, question, university, profile, online, allow_next_steps=allow_next_steps)
    except RuntimeError as e:
        msg = str(e).lower()
        can_retry = ("http 429" in msg or "quota" in msg) and fallback and fallback != primary
        if not can_retry:
            raise
        res = _mentor_call_gemini_for_model(fallback, question, university, profile, online, allow_next_steps=allow_next_steps)
        prev = str(res.get("warning", "")).strip()
        note = f"Primary model quota reached; switched to fallback model: {fallback}."
        res["warning"] = (prev + " " + note).strip() if prev else note
        return res


def _mentor_resolve_mode(raw: Any) -> str:
    mode = str(raw or "auto").strip().lower()
    allowed = {"auto", "gemini", "fallback", "local"}
    return mode if mode in allowed else "auto"


def mentor_ask(payload: Dict[str, Any]) -> Dict[str, Any]:
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    university_id = str(payload.get("university_id", "")).strip()
    online = bool(payload.get("online", True))
    profile = payload.get("profile", {}) if isinstance(payload.get("profile"), dict) else {}
    mode = _mentor_resolve_mode(payload.get("mode"))

    university = _mentor_find_university(question, university_id)
    intent = _mentor_detect_intent(question)
    db_answer = _mentor_university_answer(university, question, profile) if university else "I could not match a specific university from your request. Ask me to help with profile setup, exam strategy, language requirements, or budget planning."
    quick_options = _mentor_build_quick_options(university, profile, intent)
    answer = db_answer
    web_sources: List[Dict[str, str]] = []
    online_used = False
    provider_used = "local"
    provider_requested = "local"
    model_used = "local-smart"
    warning = ""

    if mode == "local":
        use_gemini = False
        provider_requested = "local"
    elif mode == "gemini":
        use_gemini = True
        provider_requested = "gemini-primary"
    elif mode == "fallback":
        use_gemini = True
        provider_requested = "gemini-fallback"
    else:
        use_gemini = UNIMENTOR_PROVIDER in ("gemini", "auto")
        provider_requested = "gemini-auto" if use_gemini else "local"

    if use_gemini and GEMINI_API_KEY:
        try:
            gemini_mode = "auto"
            allow_next_steps = _mentor_allow_next_steps(intent)
            if mode == "gemini":
                gemini_mode = "gemini"
            elif mode == "fallback":
                gemini_mode = "fallback"
            g = _mentor_call_gemini(question, university, profile, online=online, mode=gemini_mode, allow_next_steps=allow_next_steps)
            answer = g["answer"]
            if not allow_next_steps:
                answer = _mentor_strip_unsolicited_next_steps(answer)
            web_sources = g.get("sources", []) or []
            online_used = bool(g.get("online_used", False))
            provider_used = "gemini"
            model_used = str(g.get("model") or "gemini")
            warning = str(g.get("warning", "")).strip()
        except Exception as e:
            web_sources = _mentor_online_context(university, question, online)
            answer = db_answer
            if web_sources:
                answer += " I also found extra context online; please verify official details directly on university websites."
            warning = f"Gemini fallback to local mode: {_mentor_trim_error(str(e) or type(e).__name__)}"
    else:
        web_sources = _mentor_online_context(university, question, online)
        if web_sources:
            answer += " I also found extra context online; please verify official details directly on university websites."
        if use_gemini and not GEMINI_API_KEY:
            warning = "Gemini fallback to local mode: missing GEMINI_API_KEY"

    out_sources: List[Dict[str, str]] = []
    if university and str(university.get("website", "")).strip():
        out_sources.append({
            "title": f"{university.get('name', 'University')} official website",
            "url": str(university.get("website")),
        })
    for s in web_sources:
        out_sources.append({"title": s.get("title", "Source"), "url": s.get("url", "")})

    return {
        "assistant": UNIMENTOR_NAME,
        "answer": answer,
        "university_id": (university or {}).get("id", None),
        "sources": [s for s in out_sources if s.get("url")][:5],
        "online_used": bool(online_used or web_sources),
        "provider": provider_used,
        "provider_requested": provider_requested,
        "mode_selected": mode,
        "model_used": model_used,
        "warning": warning,
        "quick_options": quick_options,
    }

