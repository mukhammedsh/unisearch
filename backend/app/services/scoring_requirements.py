"""Published admissions requirements fit evaluation and per-choice chance estimation."""

import re
from typing import Any

from app.core.utils import clamp as _clamp
from app.core.utils import to_float as _to_num
from app.services import admissions_assessment, admissions_catalog
from app.services import exams as exams_service
from app.services.scoring_costs import _entry_cycle_parts
from app.services.scoring_profile import (
    _admission_choice_key,
    _build_user_context,
    _collect_language_requirements,
    _configured_language_exam_id_any,
    _get_user_score,
    _has_profile_evidence,
    _is_higher_better,
    _is_language_exam_key,
    _language_config,
    _language_rule_assessments,
    _normalize_funding_preference,
    _normalize_gpa_score,
    _normalize_study_level_str,
    _score_requirement,
    _score_single_language_rule,
    _selected_choice_key_for_university,
    _selected_program_id_for_university,
)
from app.services.university_tracks import _has_explicit_empty_program_mapping, expand_admission_choices

_EXPANDED_CHOICES_CACHE: dict[tuple[str, bool], tuple[Any, list[dict[str, Any]]]] = {}


def _get_cached_admission_choices(
    university: dict[str, Any],
    *,
    include_funding: bool = True,
) -> list[dict[str, Any]]:
    """Expand and cache admission choices while validating raw list identity to stay safe on test mutations."""
    raw_categories = university.get("admission_categories") if isinstance(university, dict) else None
    uid = str(university.get("id") or "").strip() if isinstance(university, dict) else ""
    cache_key = (uid, include_funding)
    cached = _EXPANDED_CHOICES_CACHE.get(cache_key) if uid else None
    if cached is not None and cached[0] is raw_categories:
        return cached[1]
    choices = [
        choice
        for choice in expand_admission_choices(raw_categories, include_funding=include_funding)
        if isinstance(choice, dict)
    ]
    if uid and raw_categories is not None:
        _EXPANDED_CHOICES_CACHE[cache_key] = (raw_categories, choices)
    return choices


def has_admissions_selection(profile: dict[str, Any], university_id: str = "") -> bool:
    selections = profile.get("selectedAdmissionChoices") or {}
    rows = [selections.get(university_id, {})] if university_id else selections.values()
    return any(isinstance(row, dict) and (row.get("studyOptionId") or row.get("applicationRouteId")) for row in rows)


def _assess_admissions_selection(university_id: str, profile: dict[str, Any]) -> dict[str, Any]:
    resolved = admissions_catalog.resolve_context(university_id, profile=profile)
    result = admissions_assessment.assess_resolved_context(resolved, profile)
    choice = result["choices"][0]
    percent = result.get("overallChance")
    level = _chance_level(percent) if percent is not None else _no_data_chance_level(profile)
    choice["level"] = level
    result.update({
        "bestChoiceKey": choice["choiceKey"], "bestChoiceId": choice["choiceId"],
        "bestChoiceLabel": choice["choiceLabel"], "selectedChoiceKey": choice["choiceKey"],
        "selectedByUser": has_admissions_selection(profile, university_id), "level": level,
        "catalogRevision": resolved["revision"],
    })
    return result


def _choice_matches_applicant_route(choice: dict[str, Any], target_route: Any) -> bool:
    expected = str(target_route or "").strip().lower()
    actual = str(choice.get("applicant_route") or "").strip().lower()
    return not expected or not actual or actual == expected


def _choice_matches_program(choice: dict[str, Any], program_id: str) -> bool:
    if not program_id:
        return True
    if _has_explicit_empty_program_mapping(choice):
        return False
    raw_ids = choice.get("program_ids")
    ids = [str(value or "").strip().casefold() for value in raw_ids] if isinstance(raw_ids, list) else []
    ids = [value for value in ids if value]
    return not ids or program_id.casefold() in ids


def _choice_matches_entry_cycle(choice: dict[str, Any], target_cycle: Any) -> bool:
    expected = _entry_cycle_parts(target_cycle)
    actual = _entry_cycle_parts(choice.get("cycle"))
    if not expected or not actual:
        return True
    if expected[0] is None or actual[0] is None:
        return True
    if expected[0] != actual[0]:
        return False
    return not (expected[1] and actual[1] and expected[1] != actual[1])


def _choice_applicability(
    choice: dict[str, Any], target_route: Any, target_cycle: Any, program_id: str, program_is_known: bool = True
) -> dict[str, str]:
    """Describe whether the selected applicant context is supported by route metadata."""
    actual_route = str(choice.get("applicant_route") or "").strip().lower()
    expected_route = str(target_route or "").strip().lower()
    actual_cycle = _entry_cycle_parts(choice.get("cycle"))
    expected_cycle = _entry_cycle_parts(target_cycle)
    raw_program_ids = choice.get("program_ids")
    program_ids = {
        str(value or "").strip().casefold()
        for value in raw_program_ids if str(value or "").strip()
    } if isinstance(raw_program_ids, list) else set()

    return {
        "route": (
            "not_selected" if not expected_route else
            "unknown" if not actual_route else "matched"
        ),
        "cycle": (
            "not_selected" if not expected_cycle else
            "unknown" if not actual_cycle or actual_cycle[0] is None or expected_cycle[0] is None else "matched"
        ),
        "program": (
            "not_selected" if not program_id else
            "unknown" if not program_is_known else
            "unknown" if not program_ids else
            "matched" if program_id.casefold() in program_ids else "mismatched"
        ),
    }


def _applicability_unknown_reason(applicability: dict[str, str]) -> str:
    return "applicability_unknown" if "unknown" in applicability.values() else ""


def _known_program_ids(university: dict[str, Any], choices: list[dict[str, Any]]) -> set[str]:
    ids: set[str] = set()
    for choice in choices:
        p_ids = choice.get("program_ids")
        if isinstance(p_ids, list):
            for value in p_ids:
                ids.add(str(value or "").strip().casefold())
    academics = university.get("academics") if isinstance(university, dict) else None
    programs = academics.get("programs") if isinstance(academics, dict) else None
    if isinstance(programs, list):
        ids.update(
            str(program.get("id") or "").strip().casefold()
            for program in programs if isinstance(program, dict) and program.get("id")
        )
    ids.discard("")
    return ids


def _choice_result_by_key(rows: list[dict[str, Any]], choice_key: Any) -> dict[str, Any] | None:
    wanted = str(choice_key or "").strip()
    if not wanted:
        return None
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("choiceKey") or "").strip() == wanted:
            return row
    return None


def _chance_level(chance_pct: float) -> dict[str, str]:
    if chance_pct >= 100:
        return {"id": "all_met", "label": "All published requirements met"}
    if chance_pct >= 80:
        return {"id": "mostly_met", "label": "Most published requirements met"}
    if chance_pct > 0:
        return {"id": "some_met", "label": "Some published requirements met"}
    return {"id": "none_met", "label": "No published requirements met"}


def _chance_locale(profile: dict[str, Any]) -> str:
    raw = str((profile or {}).get("locale") or "").strip().lower()
    if raw.startswith("kk") or raw == "kaz":
        return "kaz"
    return "rus" if raw.startswith("ru") else "eng"


def _chance_no_data_label(reason: str, profile: dict[str, Any]) -> str:
    labels = {
        "eng": {
            "missing_evidence": "Add exam scores or language evidence",
            "requirements_not_met": "A required minimum is not met",
            "missing_exam_score": "Need exam data to see the chance for this track",
            "unsupported_exam_normalization": "Track score data is not yet comparable",
            "no_score_profile": "No admitted-score data",
            "no_published_requirements": "No measurable published minimums for this route",
            "unassessed_minimums": "Published minimums cannot be assessed from the available profile evidence",
            "requirements_not_reviewed": "Published minimums have not yet been reviewed for this route",
            "applicability_unknown": "This route is not confirmed for the selected applicant, program, or entry cycle",
        },
        "rus": {
            "missing_evidence": "Добавьте результаты экзаменов или языковые данные",
            "requirements_not_met": "Не выполнен обязательный минимум",
            "missing_exam_score": "Нужны данные по экзамену, чтобы оценить шанс по этому варианту поступления",
            "unsupported_exam_normalization": "Пока нельзя корректно сопоставить ваш экзамен с этим вариантом поступления",
            "no_score_profile": "Нет данных о баллах зачисленных",
            "no_published_requirements": "Для этого варианта нет измеримых опубликованных минимумов",
            "unassessed_minimums": "Опубликованные минимумы нельзя оценить по имеющимся данным профиля",
            "requirements_not_reviewed": "Опубликованные минимумы для этого маршрута ещё не проверены",
            "applicability_unknown": "Применимость этого маршрута к выбранному типу заявителя, программе или циклу не подтверждена",
        },
        "kaz": {
            "missing_evidence": "Емтихан нәтижесін немесе тіл деңгейін қосыңыз",
            "requirements_not_met": "Міндетті ең төменгі талапқа сай емессіз",
            "missing_exam_score": "Осы түсу жолын бағалау үшін емтихан нәтижесі керек",
            "unsupported_exam_normalization": "Бұл емтихан нәтижесін әзірге осы түсу жолымен салыстыру мүмкін емес",
            "no_score_profile": "Оқуға қабылданғандар ұпайы туралы дерек жоқ",
            "no_published_requirements": "Бұл түсу жолы бойынша өлшенетін жарияланған ең төменгі талап жоқ",
            "unassessed_minimums": "Профильдегі дерекпен жарияланған ең төменгі талаптарды бағалау мүмкін емес",
            "requirements_not_reviewed": "Бұл түсу жолының жарияланған ең төменгі талаптары әлі тексерілмеген",
            "applicability_unknown": "Бұл жолдың таңдалған талапкерге, бағдарламаға не қабылдау цикліне сай екені расталмаған",
        },
    }
    locale = _chance_locale(profile)
    if locale == "rus" and reason == "missing_exam_score":
        return "Нужны данные по экзаменам, чтобы оценить шанс по этому варианту поступления"
    if locale == "kaz" and reason == "missing_exam_score":
        return "Осы түсу жолын бағалау үшін емтихан нәтижелері керек"
    return str((labels.get(locale) or labels["eng"]).get(reason) or (labels.get(locale) or labels["eng"])["no_score_profile"])


def _no_data_chance_level(profile: dict[str, Any]) -> dict[str, str]:
    return {
        "id": "no_data",
        "label": {"rus": "Нет данных", "kaz": "Дерек жоқ"}.get(_chance_locale(profile), "No data"),
    }


def _published_requirements_for_choice(
    university: dict[str, Any], choice: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]], str]:
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
            requirements: dict[str, Any] = {}
            for source in (category, profile_row):
                raw = source.get("requirements")
                if isinstance(raw, dict):
                    requirements.update(raw)
            unassessed = profile_row.get("unassessed_published_minimums")
            review_status = str(profile_row.get("requirements_review_status") or "")
            return requirements, [row for row in unassessed if isinstance(row, dict)] if isinstance(unassessed, list) else [], review_status
    return {}, [], ""


def _assess_academic_requirements(
    requirements: dict[str, Any],
    has_language_rules: bool,
    user_scores: dict[str, Any],
    user_languages: dict[str, Any],
) -> tuple[list[bool], int, list[dict[str, Any]], list[dict[str, Any]]]:
    checks: list[bool] = []
    measurable_checks = 0
    assessments: list[dict[str, Any]] = []
    missing_evidence: list[dict[str, Any]] = []

    for exam_id, raw_minimum in requirements.items():
        if has_language_rules and _is_language_exam_key(exam_id):
            continue
        minimum = _normalize_gpa_score(raw_minimum) if str(exam_id).strip().upper() == "GPA" else _to_num(raw_minimum)
        if minimum is None:
            assessments.append({"exam": str(exam_id), "minimum": raw_minimum, "provided": None, "status": "unassessed"})
            continue
        exam_key = str(exam_id).strip()
        is_language_exam = _is_language_exam_key(exam_id)
        exam_config = (
            exams_service._config_entry(exam_key)
            if exam_key.upper() != "GPA" and not is_language_exam
            else {"min": 0, "max": 5}
        )
        if not exam_config:
            assessments.append({"exam": exam_key, "minimum": minimum, "provided": None, "status": "unassessed"})
            continue
        measurable_checks += 1
        user_value = _get_user_score(
            user_scores, exam_id, None if _is_language_exam_key(exam_id) else user_languages
        )
        if user_value is None:
            missing_evidence.append({"type": "academic_exam", "id": str(exam_id), "minimum": minimum})
            assessments.append({"exam": exam_key, "minimum": minimum, "provided": None, "status": "missing"})
            continue
        result = _score_requirement(
            user_value,
            minimum,
            None,
            higher_is_better=_is_higher_better(exam_id),
            mode="chance",
        )
        passed = bool(result.get("pass"))
        checks.append(passed)
        assessments.append({"exam": exam_key, "minimum": minimum, "provided": user_value, "status": "met" if passed else "unmet"})

    return checks, measurable_checks, assessments, missing_evidence


def _assess_required_exam_alternatives(
    choice: dict[str, Any],
    user_scores: dict[str, Any],
    valid_exam_ids: set[str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    assessments: list[dict[str, Any]] = []
    missing_evidence: list[dict[str, Any]] = []

    raw_exam_alternatives = choice.get("required_exam_alternatives")
    if isinstance(raw_exam_alternatives, list):
        for group in raw_exam_alternatives:
            if not isinstance(group, list):
                continue
            exam_ids = [str(value or "").strip() for value in group if str(value or "").strip()]
            if not exam_ids:
                continue
            unsupported_ids = [exam_id for exam_id in exam_ids if not exams_service._config_entry(exam_id)]
            supplied = next((
                exam_id for exam_id in exam_ids
                if exams_service._config_entry(exam_id)
                and (
                    exams_service.resolve_exam_key(exam_id).upper() in valid_exam_ids
                    or _get_user_score(user_scores, exam_id) is not None
                )
            ), None)
            assessments.append({
                "exam": " or ".join(exam_ids), "minimum": None, "provided": supplied,
                "status": "met" if supplied else "unassessed" if unsupported_ids else "missing",
            })
            if not supplied and not unsupported_ids:
                missing_evidence.append({"type": "required_exam_alternative", "ids": exam_ids})

    return assessments, missing_evidence


def _assess_language_rules(
    choice: dict[str, Any],
    user_languages: dict[str, Any],
    lang_cfg: dict[str, Any],
) -> tuple[list[bool], int, list[dict[str, Any]], list[dict[str, Any]]]:
    checks: list[bool] = []
    measurable_checks = 0
    assessments: list[dict[str, Any]] = []
    missing_evidence: list[dict[str, Any]] = []

    language_rules = _collect_language_requirements(choice)
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
            and bool(raw_requirements)
        )
        if measurable:
            measurable_language_rules.append(rule)

    if language_rules.get("mode") == "any" and measurable_language_rules:
        measurable_checks += 1
        results = [
            _score_single_language_rule(rule, user_languages, lang_cfg, mode="chance")
            for rule in measurable_language_rules
        ]
        rule_assessments = [
            _language_rule_assessments(rule, user_languages, lang_cfg, "any")
            for rule in measurable_language_rules
        ]
        if any(bool(result.get("pass")) and not bool(result.get("conditional")) for result in results):
            checks.append(True)
            assessments.extend(item for rows in rule_assessments for item in rows)
        elif any(bool(result.get("conditional")) for result in results):
            missing_evidence.extend(
                {"type": "language_requirement", "code": str(rule.get("code") or ""), "exam": row.get("exam"), "minimum": row.get("minimum")}
                for rule, result, rows in zip(measurable_language_rules, results, rule_assessments, strict=True)
                if bool(result.get("conditional"))
                for row in rows if row.get("status") == "missing"
            )
            assessments.extend(item for rows in rule_assessments for item in rows)
        else:
            checks.append(False)
            assessments.extend(item for rows in rule_assessments for item in rows)
    else:
        for rule in measurable_language_rules:
            measurable_checks += 1
            rows = _language_rule_assessments(rule, user_languages, lang_cfg, "all")
            result = _score_single_language_rule(rule, user_languages, lang_cfg, mode="chance")
            if bool(result.get("conditional")):
                missing_evidence.extend(
                    {"type": "language_requirement", "code": str(rule.get("code") or ""), "exam": row.get("exam"), "minimum": row.get("minimum")}
                    for row in rows if row.get("status") == "missing"
                )
                assessments.extend(rows)
            else:
                passed = bool(result.get("pass"))
                checks.append(passed)
                assessments.extend(rows)

    return checks, measurable_checks, assessments, missing_evidence


def _assess_unassessed_minimums(
    unassessed_minimums: list[dict[str, Any]],
    user_scores: dict[str, Any],
) -> list[dict[str, Any]]:
    assessments: list[dict[str, Any]] = []
    for row in unassessed_minimums:
        source_exam_id = str(row.get("exam_id") or "").strip()
        configured_exam_id = _configured_language_exam_id_any(source_exam_id) if source_exam_id else ""
        provided = _get_user_score(user_scores, configured_exam_id) if configured_exam_id else None
        assessment = {
            "exam": str(row.get("label") or row.get("id") or "Published minimum"),
            "minimum": row.get("minimum"), "provided": provided, "status": "unassessed",
        }
        condition = str(row.get("scale") or "").strip()
        if condition:
            assessment["condition"] = condition
        if configured_exam_id:
            assessment["examId"] = configured_exam_id
        assessments.append(assessment)
    return assessments


def _published_requirements_fit(
    *,
    university: dict[str, Any],
    choice: dict[str, Any],
    user_scores: dict[str, Any],
    valid_exam_ids: set[str],
    user_languages: dict[str, Any],
    lang_cfg: dict[str, Any],
) -> tuple[int | None, str, int, list[dict[str, Any]], list[dict[str, Any]]]:
    """Score the share of measurable published minimum checks that are met."""
    requirements, unassessed_minimums, review_status = _published_requirements_for_choice(university, choice)
    if review_status == "not_reviewed":
        return None, "requirements_not_reviewed", 0, [], []

    language_rules = _collect_language_requirements(choice)
    has_language_rules = bool(language_rules.get("items"))

    checks, measurable_checks, assessments, missing_evidence = _assess_academic_requirements(
        requirements, has_language_rules, user_scores, user_languages
    )

    alt_assessments, alt_missing = _assess_required_exam_alternatives(
        choice, user_scores, valid_exam_ids
    )
    assessments.extend(alt_assessments)
    missing_evidence.extend(alt_missing)

    lang_checks, lang_measurable, lang_assessments, lang_missing = _assess_language_rules(
        choice, user_languages, lang_cfg
    )
    checks.extend(lang_checks)
    measurable_checks += lang_measurable
    assessments.extend(lang_assessments)
    missing_evidence.extend(lang_missing)

    unassessed_assessments = _assess_unassessed_minimums(
        unassessed_minimums, user_scores
    )
    assessments.extend(unassessed_assessments)

    if missing_evidence:
        return None, "missing_evidence", measurable_checks, assessments, missing_evidence

    if unassessed_minimums:
        return None, "unassessed_minimums", measurable_checks, assessments, missing_evidence

    if any(row.get("status") == "unassessed" for row in assessments):
        return None, "unassessed_minimums", measurable_checks, assessments, missing_evidence
    if not checks:
        return None, "no_published_requirements", 0, assessments, missing_evidence
    return int(round(100 * sum(checks) / len(checks))), "", measurable_checks, assessments, missing_evidence


def _chance_percent_value(value: Any) -> float | None:
    parsed = _to_num(value)
    if parsed is None:
        return None
    return _clamp(float(parsed), 0.0, 100.0)


def _choice_text_blob(choice: dict[str, Any]) -> str:
    parts: list[str] = []
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


def _track_verified_badges(choice: dict[str, Any]) -> list[str]:
    blob = _choice_text_blob(choice)
    badges: list[str] = []
    if "need-blind" in blob or "need blind" in blob:
        badges.append("need_blind")
    return badges


def _chance_factor(
    key: str,
    status: str,
    label: str,
    message: str,
    severity: str = "medium",
) -> dict[str, str]:
    return {
        "key": key,
        "status": status,
        "label": label,
        "message": message,
        "severity": severity,
    }


def _build_chance_factors(
    *,
    score_percent: int | None,
    reason: str,
) -> list[dict[str, str]]:
    if score_percent is None:
        if reason in {"unassessed_minimums", "requirements_not_reviewed"}:
            return []
        key = "missing_evidence" if reason == "missing_evidence" else "insufficient_data"
        if reason == "applicability_unknown":
            key, label = "applicability_unknown", "Route applicability"
            message = "The route is not confirmed for the selected applicant, program, or entry cycle."
        else:
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


def _choice_matches_study_level(choice: dict[str, Any], target_level: str) -> bool:
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
        return scope_level == target_level

    if target_level == "bachelor":
        if any(value.strip().lower() in {"general", "program", "program_group"} for value in scope_values):
            return True
        return scope.startswith(("undergraduate", "bachelor", "first-year", "first year"))

    if target_level == "master":
        return scope.startswith(("graduate", "postgraduate_taught", "postgraduate taught"))

    if target_level == "doctorate":
        return scope.startswith(("doctoral", "doctorate", "postgraduate_research", "postgraduate research"))

    return bool(scope and _normalize_study_level_str(scope) == target_level)


def _load_university_admission_choices(university: dict[str, Any]) -> list[dict[str, Any]]:
    choices = _get_cached_admission_choices(university, include_funding=True)
    if not choices:
        return [{"id": "default", "choice_key": "default", "label": "General admission", "requirements": {}, "stats_avg": {}}]
    return choices


def _filter_admission_entries(
    choices: list[dict[str, Any]],
    university: dict[str, Any],
    profile: dict[str, Any],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = [{"choice": choice, "idx": idx} for idx, choice in enumerate(choices)]
    target_level = _normalize_study_level_str(
        profile.get("studyLevel") or profile.get("study_level") or ""
    )
    target_route = profile.get("applicant_route")
    target_cycle = profile.get("intended_entry_cycle")
    selected_program_id = _selected_program_id_for_university(profile, university)
    selected_program_is_known = (
        not selected_program_id
        or selected_program_id.casefold() in _known_program_ids(university, choices)
    )

    return [
        row for row in entries
        if (target_level == "any" or _choice_matches_study_level(row["choice"], target_level))
        and _choice_matches_applicant_route(row["choice"], target_route)
        and _choice_matches_entry_cycle(row["choice"], target_cycle)
        and (not selected_program_id or not selected_program_is_known or _choice_matches_program(row["choice"], selected_program_id))
    ]


def _build_no_choices_chance_response(
    profile: dict[str, Any],
    funding_type: str,
    has_evidence: bool,
) -> dict[str, Any]:
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
    }


def _evaluate_per_choice_chance(
    university: dict[str, Any],
    profile: dict[str, Any],
    entries: list[dict[str, Any]],
    choices: list[dict[str, Any]],
    ctx: dict[str, Any],
    lang_cfg: dict[str, Any],
) -> list[dict[str, Any]]:
    target_route = profile.get("applicant_route")
    target_cycle = profile.get("intended_entry_cycle")
    selected_program_id = _selected_program_id_for_university(profile, university)
    selected_program_is_known = (
        not selected_program_id
        or selected_program_id.casefold() in _known_program_ids(university, choices)
    )

    per_choice = []
    for row in entries:
        choice = row["choice"]
        idx = int(row["idx"])
        applicability = _choice_applicability(
            choice, target_route, target_cycle, selected_program_id, selected_program_is_known
        )
        no_data_reason = _applicability_unknown_reason(applicability)
        chance_pct, fit_reason, measurable_checks, check_assessments, missing_evidence = _published_requirements_fit(
            university=university,
            choice=choice,
            user_scores=ctx["userScores"],
            valid_exam_ids=ctx.get("validExamIds", set()),
            user_languages=ctx["userLanguages"],
            lang_cfg=lang_cfg,
        )
        if no_data_reason:
            chance_pct = None
            no_data_reason = "applicability_unknown"
            missing_evidence = []
            for assessment in check_assessments:
                if assessment.get("status") != "unassessed":
                    assessment["status"] = "unassessed"
        else:
            no_data_reason = fit_reason
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
                "applicability": applicability,
                "missingEvidence": missing_evidence,
                "details": {
                    "measurableRequirements": measurable_checks,
                    "checks": check_assessments,
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
    return per_choice


def estimate_uni_chance(
    university: dict[str, Any],
    profile: dict[str, Any] | None = None,
    *,
    user_context: dict[str, Any] | None = None,
    lang_cfg: dict[str, Any] | None = None,
) -> dict[str, Any]:
    profile = profile if isinstance(profile, dict) else {}
    if str(university.get("id") or "") in admissions_catalog.INSTITUTION_IDS:
        return _assess_admissions_selection(str(university.get("id") or ""), profile)

    lang_cfg = lang_cfg if isinstance(lang_cfg, dict) else _language_config()
    ctx = user_context if isinstance(user_context, dict) else _build_user_context(profile, lang_cfg)
    funding_type = _normalize_funding_preference(profile.get("fundingType") or profile.get("funding_type") or "any")

    choices = _load_university_admission_choices(university)
    selected_choice_key = _selected_choice_key_for_university(profile, university)
    entries = _filter_admission_entries(choices, university, profile)

    has_evidence = _has_profile_evidence(ctx)

    if not entries:
        return _build_no_choices_chance_response(profile, funding_type, has_evidence)

    per_choice = _evaluate_per_choice_chance(university, profile, entries, choices, ctx, lang_cfg)

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
    best: dict[str, Any] = user_selected if (user_selected is not None and selected_by_user) else recommended

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
    }
