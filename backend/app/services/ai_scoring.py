"""UniFit composite personalized ranking and admissions scoring orchestrator."""

from typing import Any

from app.core.utils import (
    clamp01 as _clamp01,
)
from app.core.utils import (
    to_float as _to_num,
)
from app.core.utils import (
    to_float_default as _to_num_default,
)
from app.services import admissions_catalog, preference_factors
from app.services import universities as universities_service
from app.services.finance_modes import normalize_study_mode as _normalize_study_mode
from app.services.ml_scoring import get_ml_recommender, get_ml_runtime_status
from app.services.scoring_costs import (
    _cost_cycle_mismatch,
    _cost_to_usd,
    _effective_track_cost_details,
    _finance_cost_range,
    _track_cost_range_payload,
    _university_matches_major,
)
from app.services.scoring_profile import (
    _admission_choice_key,
    _build_user_context,
    _get_track_funding_type,
    _language_config,
    _normalize_funding_preference,
    _normalize_gpa_score,
    _normalize_selected_admission_choices,
    _normalize_study_level_str,
    _selected_choice_key_for_university,
    _selected_program_id_for_university,
)
from app.services.scoring_requirements import (
    _assess_admissions_selection,
    _chance_locale,
    _chance_percent_value,
    _choice_matches_applicant_route,
    _choice_matches_entry_cycle,
    _choice_matches_program,
    _choice_matches_study_level,
    _choice_result_by_key,
    _get_cached_admission_choices,
    _known_program_ids,
    estimate_uni_chance,
    has_admissions_selection,
)

__all__ = [
    "_assess_admissions_selection",
    "_build_ui_badge_hints",
    "_build_user_context",
    "_chance_locale",
    "_choice_matches_study_level",
    "_cost_cycle_mismatch",
    "_cost_to_usd",
    "_effective_track_cost_details",
    "_extract_university_factors",
    "_finance_cost_range",
    "_normalize_funding_preference",
    "_normalize_gpa_score",
    "_normalize_selected_admission_choices",
    "_normalize_study_level_str",
    "_preference_mismatch",
    "_selected_choice_key_for_university",
    "_selected_program_id_for_university",
    "_track_cost_range_payload",
    "_university_matches_major",
    "estimate_uni_chance",
    "has_admissions_selection",
    "sort_universities_ai",
]

_UI_BADGE_THRESHOLDS = {
    "your_vibe_max_mismatch": 0.14,
    "top_match_max_mismatch": 0.22,
}

_FACTORS_CACHE: dict[str, dict[str, float | None]] = {}


def _preference01(value: Any, fallback: float = 50.0) -> float:
    return _clamp01(_to_num_default(value, fallback) / 100.0)


def _factor01(value: Any, fallback: float = 0.5) -> float:
    parsed = _to_num(value)
    if parsed is None:
        return _clamp01(fallback)
    if parsed > 1.0:
        parsed = parsed / 100.0
    return _clamp01(float(parsed))


def _extract_university_factors(university: dict[str, Any], study_level: Any = "any") -> dict[str, float | None]:
    """University indicators for the preference sliders (see `preference_factors`); None means unknown.

    An explicit value in `factors` wins, including an explicit null. Selectivity describes first-year entry, so it
    is unknown for graduate study levels whatever is stored.
    """
    uid = str(university.get("id") or "").strip()
    target_level = _normalize_study_level_str(study_level)
    revision = admissions_catalog.get_revision() if uid in admissions_catalog.INSTITUTION_IDS else "legacy"
    cache_key = f"{uid}:{target_level}:{revision}"
    if uid and cache_key in _FACTORS_CACHE:
        return _FACTORS_CACHE[cache_key]

    raw = university.get("factors")
    raw = raw if isinstance(raw, dict) else {}

    def stored_or(key: str, compute: Any) -> float | None:
        if key in raw:
            return None if raw[key] is None else _factor01(raw[key])
        return compute()

    res = {
        "practice_vs_science": stored_or("practice_vs_science", lambda: preference_factors.research_intensity(university)),
        "social_vs_hardcore": (
            None
            if target_level in preference_factors.GRADUATE_LEVELS
            else stored_or("social_vs_hardcore", lambda: preference_factors.selectivity(university, target_level))
        ),
        "budget_vs_prestige": stored_or("budget_vs_prestige", lambda: preference_factors.cost_vs_prestige(university)),
        "city_vs_campus": stored_or("city_vs_campus", lambda: preference_factors.location(university)),
    }
    if uid:
        _FACTORS_CACHE[cache_key] = res
    return res


def _preference_weights(user_pref: dict[str, float]) -> dict[str, float]:
    """A centred slider expresses no preference; its distance from the centre is how much the axis matters."""
    return {key: _clamp01(abs(float(value) - 0.5) * 2.0) for key, value in user_pref.items()}


def _preference_mismatch(
    user_pref: dict[str, float],
    uni_factors: dict[str, float | None],
) -> tuple[float | None, dict[str, float | None]]:
    """Weighted mean distance over the sliders the user moved.

    A moved slider without university data counts as the expected distance to a university placed uniformly on the
    scale, so missing data neither wins a perfect match nor reads as a failure. Returns (mismatch, per-axis
    distances, None where unknown); the mismatch is None when no moved slider has university data at all.
    """
    weights = _preference_weights(user_pref)
    deltas: dict[str, float | None] = {}
    weighted, total, known = 0.0, 0.0, False
    for key, requested in user_pref.items():
        observed = uni_factors.get(key)
        deltas[key] = None if observed is None else abs(float(requested) - float(observed))
        if weights[key] <= 0:
            continue
        if deltas[key] is None:
            weighted += weights[key] * (requested * requested + (1.0 - requested) ** 2) / 2.0
        else:
            weighted += weights[key] * deltas[key]
            known = True
        total += weights[key]
    return (_clamp01(weighted / total) if known else None), deltas


def _build_ui_badge_hints(
    *,
    preference_mismatch: Any,
    conditional: Any,
    conditional_requirements: Any,
    meets_min_requirements: bool = False,
    below_requirements: bool = False,
    budget_status: str = "not_set",
    aid_any: bool | None = False,
    missing_program: bool = False,
) -> dict[str, Any]:
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
            "preferenceMismatch": None if preference_mismatch is None else round(mismatch01, 4),
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


def _resolve_ml_relevance(
    interest_text: str,
) -> tuple[dict[str, float], dict[str, Any], bool, str, bool, str, bool]:
    """Query semantic ML recommender when interests text is present, returning explicit unavailable status on error."""
    ml_scores_by_id: dict[str, float] = {}
    ml_status: dict[str, Any] = (
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
            # Semantic embeddings are optional runtime enhancement; expose unavailable state cleanly.
            ml_scores_by_id = {}
            use_ml = False
            ml_available = False
            ml_runtime_mode = "unavailable"
            ml_unavailable_warning = bool(interest_text)
            ml_warning_message = "Machine Learning unavailable"
    return (
        ml_scores_by_id,
        ml_status,
        ml_available,
        ml_runtime_mode,
        ml_unavailable_warning,
        ml_warning_message,
        use_ml,
    )


def _resolve_choice_selection_for_sort(
    row: dict[str, Any],
    canonical_context: bool,
    profile: dict[str, Any],
    chance_general: dict[str, Any],
) -> dict[str, Any]:
    """Resolve eligible choices, user selection state, and active choice metadata for a university."""
    choices = (
        []
        if canonical_context
        else _get_cached_admission_choices(row, include_funding=True)
    )
    target_level = _normalize_study_level_str(
        chance_general["context"].get("study_level")
        if canonical_context
        else profile.get("studyLevel") or profile.get("study_level") or ""
    )
    target_route = profile.get("applicant_route")
    target_cycle = profile.get("intended_entry_cycle")
    selected_program_id = _selected_program_id_for_university(profile, row)
    selected_program_is_known = (
        not selected_program_id
        or selected_program_id.casefold() in _known_program_ids(row, choices)
    )
    eligible_choices = [
        (idx, choice)
        for idx, choice in enumerate(choices)
        if (target_level == "any" or _choice_matches_study_level(choice, target_level))
        and _choice_matches_applicant_route(choice, target_route)
        and _choice_matches_entry_cycle(choice, target_cycle)
        and (
            not selected_program_id
            or not selected_program_is_known
            or _choice_matches_program(choice, selected_program_id)
        )
    ]
    selected_choice_key = (
        str(chance_general.get("activeChoiceKey") or "")
        if canonical_context
        else _selected_choice_key_for_university(profile, row)
    )

    general_choice_results = (
        chance_general.get("choices") if isinstance(chance_general.get("choices"), list) else []
    )
    selected_general_choice = _choice_result_by_key(general_choice_results, selected_choice_key)
    selected_actual_chance = _chance_percent_value(chance_general.get("overallChance"))
    selected_by_user = bool(chance_general.get("selectedByUser")) and selected_general_choice is not None

    selected_raw_choice = None
    if selected_choice_key and eligible_choices:
        for idx, choice in eligible_choices:
            if _admission_choice_key(choice, idx) == selected_choice_key:
                selected_raw_choice = choice
                break
    if selected_by_user and selected_raw_choice is not None:
        selected_actual_chance = _chance_percent_value((selected_general_choice or {}).get("chancePercent"))

    recommended_choice_key = str(
        chance_general.get("recommendedChoiceKey") or chance_general.get("bestChoiceKey") or ""
    )
    recommended_choice_id = str(
        chance_general.get("recommendedChoiceId") or chance_general.get("bestChoiceId") or ""
    )
    recommended_choice_label = str(
        chance_general.get("recommendedChoiceLabel") or chance_general.get("bestChoiceLabel") or ""
    )
    active_choice_key = (
        selected_choice_key
        if (selected_by_user and selected_choice_key)
        else str(chance_general.get("bestChoiceKey") or recommended_choice_key)
    )

    active_raw_choice: dict[str, Any] = {}
    if eligible_choices:
        for idx, choice in eligible_choices:
            if _admission_choice_key(choice, idx) == active_choice_key:
                active_raw_choice = choice
                break
        if not active_raw_choice:
            active_idx, active_raw_choice = eligible_choices[0]
            active_choice_key = _admission_choice_key(active_raw_choice, active_idx)

    base_choices = (
        []
        if canonical_context
        else _get_cached_admission_choices(row, include_funding=False)
    )
    base_raw_choice = next(
        (
            choice
            for choice in base_choices
            if choice.get("category_id") == active_raw_choice.get("category_id")
            and choice.get("requirement_profile_id") == active_raw_choice.get("requirement_profile_id")
        ),
        active_raw_choice,
    )

    active_choice_meta = _choice_result_by_key(general_choice_results, active_choice_key) or {}
    if canonical_context:
        active_raw_choice = {
            "id": active_choice_meta.get("choiceId"),
            "label": active_choice_meta.get("choiceLabel"),
            "category_id": active_choice_meta.get("categoryId"),
        }

    return {
        "target_level": target_level,
        "target_route": target_route,
        "target_cycle": target_cycle,
        "selected_program_id": selected_program_id,
        "eligible_choices": eligible_choices,
        "selected_actual_chance": selected_actual_chance,
        "selected_by_user": selected_by_user,
        "recommended_choice_key": recommended_choice_key,
        "recommended_choice_id": recommended_choice_id,
        "recommended_choice_label": recommended_choice_label,
        "active_choice_key": active_choice_key,
        "active_raw_choice": active_raw_choice,
        "base_raw_choice": base_raw_choice,
        "active_choice_meta": active_choice_meta,
    }


def _compute_sort_budget_outcome(
    *,
    row: dict[str, Any],
    row_id: str,
    canonical_context: bool,
    profile: dict[str, Any],
    budget: float | None,
    preferred_mode: str,
    selection_state: dict[str, Any],
) -> dict[str, Any]:
    """Compute tuition/living cost numbers, budget status, and affordability gap."""
    target_level = selection_state["target_level"]
    target_route = selection_state["target_route"]
    target_cycle = selection_state["target_cycle"]
    selected_program_id = selection_state["selected_program_id"]
    eligible_choices = selection_state["eligible_choices"]
    active_raw_choice = selection_state["active_raw_choice"]
    base_raw_choice = selection_state["base_raw_choice"]

    if canonical_context or (
        not eligible_choices
        and (target_level != "any" or target_route or target_cycle or selected_program_id)
    ):
        finance = row.get("finance") if isinstance(row.get("finance"), dict) else {}
        cost_usd, cost_native = 0.0, 0.0
        cost_currency = str(finance.get("currency") or "USD").strip().upper()
        cost_mode = "unavailable"
    else:
        cost_usd, cost_native, cost_currency, cost_mode = _effective_track_cost_details(
            row,
            base_raw_choice,
            preferred_mode=preferred_mode,
            intended_entry_cycle=target_cycle,
        )
    aid_any = None if canonical_context else _get_track_funding_type(active_raw_choice) == "grant"

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
    final_price_native: float | None = None if cost_unavailable else cost_native
    final_price_usd: float | None = (
        None if final_price_native is None else _cost_to_usd(final_price_native, cost_currency)
    )

    affordability_gap: float | None = None
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
                if final_price_usd > budget
                else 0.0
            )
            budget_status = "over_budget" if final_price_usd > budget else "within_budget"

    cost_quote = None
    budget_assessment = None
    projected_costs = None
    if canonical_context:
        projected_costs = admissions_catalog.catalog_costs(row_id, target_level, preferred_mode, profile=profile)
        # Preserve price-band annotations from the same scoped catalog projection.
        for basis_key in ("annual_total", "tuition"):
            previous = (row.get("catalog_costs") or {}).get(basis_key) or {}
            if projected_costs.get(basis_key) and previous.get("filter_match"):
                projected_costs[basis_key]["filter_match"] = previous["filter_match"]
        annual_total = projected_costs.get("annual_total")
        basis = (
            "annual_total"
            if annual_total and annual_total.get("calculation") != "tuition_plus_living_range"
            else "tuition"
        )
        quote = projected_costs.get(basis)
        evidence = "unavailable"
        status = "not_set" if budget is None or budget <= 0 else "unknown_cost"
        affordability_gap = None
        bounds: tuple[float, float] | None = None
        if quote:
            bounds = universities_service._catalog_cost_range_usd({"catalog_costs": projected_costs}, basis)
            cost_quote = {
                **quote,
                "basis": basis,
                "minUSD": bounds[0] if bounds else None,
                "maxUSD": bounds[1] if bounds else None,
            }
            evidence = (
                "period_not_annual"
                if quote.get("annual_comparable") is False
                else "fee_status_unknown"
                if quote["fee_status_match"] == "unknown"
                else "scope_unknown"
                if target_level == "any" and not projected_costs.get("scope", {}).get("study_level")
                else "applicable"
                if quote["cycle_status"] == "matched"
                else "dated_reference"
            )
            if bounds and budget is not None and budget > 0 and evidence not in {"fee_status_unknown", "scope_unknown"}:
                low, high = bounds
                if low > budget:
                    status, affordability_gap = "over_budget", _clamp01(1.0 - budget / low)
                elif high <= budget:
                    status, affordability_gap = "within_budget", 0.0
                else:
                    status = "uncertain_range"
        full_budget = basis == "annual_total" and quote is not None
        budget_assessment = {
            "status": status,
            "basis": basis if quote else None,
            "evidence": evidence,
            "full_budget": full_budget,
            "exclusions": quote["exclusions"] if quote else [],
        }
        budget_status = (
            status
            if full_budget and evidence == "applicable"
            else "not_set"
            if budget is None or budget <= 0
            else "unknown_cost"
        )
        cost_mode = (
            "published_annual_total"
            if full_budget and evidence == "applicable"
            else "published_reference"
            if quote
            else "unavailable"
        )
        cost_unavailable = not (
            full_budget and evidence == "applicable" and bounds is not None and quote["min"] == quote["max"]
        )
        if not cost_unavailable and quote is not None and cost_quote is not None:
            cost_native, cost_currency = quote["min"], quote["currency"]
            cost_usd = cost_quote["minUSD"]
            final_price_native, final_price_usd = cost_native, cost_usd

    return {
        "aid_any": aid_any,
        "cost_usd": cost_usd,
        "cost_native": cost_native,
        "cost_currency": cost_currency,
        "cost_mode": cost_mode,
        "cost_range_payload": cost_range_payload,
        "cost_unavailable": cost_unavailable,
        "final_price_native": final_price_native,
        "final_price_usd": final_price_usd,
        "affordability_gap": affordability_gap,
        "budget_status": budget_status,
        "cost_quote": cost_quote,
        "budget_assessment": budget_assessment,
        "projected_costs": projected_costs,
    }


def _score_university_for_ai(
    row: dict[str, Any],
    *,
    profile: dict[str, Any],
    profile_any: dict[str, Any],
    ctx: dict[str, Any],
    lang_cfg: dict[str, Any],
    preferred_mode: str,
    user_pref: dict[str, float],
    preference_strength: float,
    interest_text: str,
    profile_major: str,
    ml_scores_by_id: dict[str, float],
    ml_status: dict[str, Any],
    ml_available: bool,
    ml_runtime_mode: str,
    ml_unavailable_warning: bool,
    ml_warning_message: str,
    use_ml: bool,
) -> dict[str, Any]:
    row_id = str(row.get("id") or "").strip()
    canonical_context = row_id in admissions_catalog.INSTITUTION_IDS
    chance_general = estimate_uni_chance(row, profile_any, user_context=ctx, lang_cfg=lang_cfg)
    selection_state = _resolve_choice_selection_for_sort(
        row,
        canonical_context,
        profile,
        chance_general,
    )
    target_level = selection_state["target_level"]

    uni_factors = _extract_university_factors(row, target_level)
    preference_mismatch, distance_deltas = _preference_mismatch(user_pref, uni_factors)

    matching_options: list[dict[str, Any]] = []
    unknown_option = False
    if canonical_context:
        matching_options = admissions_catalog.matching_study_options(row_id, profile_major, target_level)
        selected_option_id = chance_general["context"].get("study_option_id")
        selected_option = (chance_general.get("selectedContext") or {}).get("option") or {}
        applicability = chance_general.get("applicability") or {}
        unknown_option = bool(selected_option_id) and (
            not selected_option.get("id") or "mismatched" in applicability.values()
        )
        if selected_option_id:
            matching_options = [
                option
                for option in matching_options
                if option["id"] == selected_option_id and not unknown_option
            ]
        missing_program = bool(profile_major) and not matching_options and not unknown_option
    else:
        missing_program = bool(profile_major) and not _university_matches_major(row, profile_major)
    program_missing_penalty = 0.25 if missing_program else 0.0

    row_ml_score = _clamp01(float(ml_scores_by_id.get(row_id, 0.0))) if use_ml else 0.0
    preference_fit = None if preference_mismatch is None else _clamp01(1.0 - preference_mismatch)

    budget_outcome = _compute_sort_budget_outcome(
        row=row,
        row_id=row_id,
        canonical_context=canonical_context,
        profile=profile,
        budget=ctx["budget"],
        preferred_mode=preferred_mode,
        selection_state=selection_state,
    )

    selected_actual_chance = selection_state["selected_actual_chance"]
    affordability_gap = budget_outcome["affordability_gap"]
    requirements_gap = (
        _clamp01(1.0 - selected_actual_chance / 100.0)
        if selected_actual_chance is not None
        else None
    )
    # The preference component counts as much as the strongest slider was moved: centred sliders leave it out.
    components: list[tuple[float, float]] = []
    if preference_mismatch is not None:
        components.append(((0.35 if use_ml else 0.60) * preference_strength, preference_mismatch))
    if requirements_gap is not None:
        components.append((0.30 if use_ml else 0.40, requirements_gap))
    if use_ml:
        components.append((0.35, _clamp01(1.0 - row_ml_score)))
    if affordability_gap is not None:
        components.append((0.20, affordability_gap))
    major_penalty = (
        0.20 * _clamp01((0.05 - row_ml_score) / 0.05)
        if use_ml and interest_text and row_ml_score < 0.05
        else 0.0
    )
    final_score = _clamp01(
        # No component at all (centred sliders and no budget, minimums or interests): every university ties
        # and the sort below falls back to its later keys, such as rank.
        (sum(weight * value for weight, value in components) / sum(weight for weight, _ in components) if components else 0.0)
        + major_penalty
        + program_missing_penalty
    )

    active_choice_meta = selection_state["active_choice_meta"]
    active_raw_choice = selection_state["active_raw_choice"]
    active_choice_key = selection_state["active_choice_key"]
    recommended_choice_key = selection_state["recommended_choice_key"]
    selected_by_user = selection_state["selected_by_user"]
    aid_any = budget_outcome["aid_any"]
    budget_status = budget_outcome["budget_status"]

    active_fit_percent = _chance_percent_value(active_choice_meta.get("chancePercent"))
    below_req = active_fit_percent is not None and active_fit_percent < 100
    meet_min_req = active_fit_percent == 100
    is_conditional = active_choice_meta.get("reason") == "missing_evidence"
    conditional_count = 1 if is_conditional else 0
    active_choice_details = (
        active_choice_meta.get("details") if isinstance(active_choice_meta.get("details"), dict) else {}
    )
    requirement_checks = (
        active_choice_details.get("checks") if isinstance(active_choice_details.get("checks"), list) else []
    )
    missing_evidence = (
        active_choice_meta.get("missingEvidence")
        if isinstance(active_choice_meta.get("missingEvidence"), list)
        else []
    )

    effective_selected_by_user = (
        selected_by_user
        if canonical_context
        else selected_by_user and active_choice_key != recommended_choice_key
    )
    ui_badge_hints = _build_ui_badge_hints(
        preference_mismatch=preference_mismatch,
        conditional=is_conditional,
        conditional_requirements=conditional_count,
        meets_min_requirements=meet_min_req,
        below_requirements=below_req,
        budget_status=budget_status,
        aid_any=aid_any,
        missing_program=missing_program,
    )

    choice_id = str(active_raw_choice.get("id") or active_choice_meta.get("choiceId") or "default")
    choice_label = str(active_raw_choice.get("label") or active_choice_meta.get("choiceLabel") or "General admission")
    cost_unavailable = budget_outcome["cost_unavailable"]

    match_data: dict[str, Any] = {
        "choiceKey": active_choice_key,
        "choiceId": choice_id,
        "choiceLabel": choice_label,
        "categoryId": str(active_raw_choice.get("category_id") or ""),
        "requirementProfileId": str(active_raw_choice.get("requirement_profile_id") or ""),
        "fundingOptionId": str(active_raw_choice.get("funding_option_id") or ""),
        "finalPrice": budget_outcome["final_price_native"],
        "finalPriceUSD": budget_outcome["final_price_usd"],
        "currency": budget_outcome["cost_currency"],
        "aidAny": aid_any,
        "aidEligible": None,
        "grantName": str(active_raw_choice.get("funding_program") or "") if aid_any else "",
        "admitChance": None,
        "requirementsFitPercent": selected_actual_chance,
        "scoreMeaning": "published_requirements_met_percent",
        "requirementsReason": str(active_choice_meta.get("reason") or ""),
        "requirementChecks": requirement_checks,
        "missingEvidence": missing_evidence,
        "applicability": (
            active_choice_meta.get("applicability")
            if isinstance(active_choice_meta.get("applicability"), dict)
            else {}
        ),
        "meetMinRequirements": meet_min_req,
        "missingRequiredEvidence": is_conditional,
        "missingProgram": missing_program,
        "conditional": is_conditional,
        "conditionalRequirements": conditional_count,
        "costYearUSD": None if cost_unavailable else budget_outcome["cost_usd"],
        "costYearNative": None if cost_unavailable else budget_outcome["cost_native"],
        "grantPotential": None,
        "grantEligible": None,
        "hardScore": preference_fit,
        "distanceScore": preference_fit,
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
        "costMode": budget_outcome["cost_mode"],
        "costRange": budget_outcome["cost_range_payload"],
        "recommendedChoiceKey": recommended_choice_key,
        "recommendedChoiceId": selection_state["recommended_choice_id"],
        "recommendedChoiceLabel": selection_state["recommended_choice_label"],
        "selectedChoiceKey": active_choice_key,
        "selectedChoiceId": choice_id,
        "selectedChoiceLabel": choice_label,
        "selectedByUser": effective_selected_by_user,
        "choiceSelectionSource": "user" if effective_selected_by_user else "recommended",
    }
    if canonical_context:
        budget_assessment = budget_outcome["budget_assessment"]
        match_data["admissionsContext"] = chance_general.get("context")
        selection = chance_general.get("selectedContext") or {}
        match_data["admissionsSelection"] = {
            key: {"id": item["id"], "title": item["title"]} if item and item.get("id") else None
            for key in ("option", "route")
            for item in (selection.get(key),)
        }
        match_data["catalogRevision"] = chance_general.get("catalogRevision")
        match_data["assessmentRevision"] = chance_general.get("assessmentRevision")
        match_data["costQuote"] = budget_outcome["cost_quote"]
        match_data["budgetAssessment"] = budget_assessment
        match_data["subjectMatch"] = {
            "status": (
                "unknown"
                if unknown_option
                else "missing"
                if missing_program
                else "matched"
                if profile_major
                else "not_set"
            ),
            "option_ids": [option["id"] for option in matching_options] if profile_major else [],
            "study_level": target_level,
        }
        match_data["costReason"] = budget_assessment["evidence"]

    item = dict(row)
    if canonical_context and budget_outcome["projected_costs"] is not None:
        item["catalog_costs"] = budget_outcome["projected_costs"]
    item["matchData"] = match_data
    item["__ai_score"] = final_score
    item["__distance"] = 1.0 if preference_mismatch is None else preference_mismatch
    # With moved sliders, a university without data for any of them follows those whose fit is known.
    item["__preference_unknown"] = preference_strength > 0 and preference_mismatch is None
    return item


def sort_universities_ai(
    items: list[dict[str, Any]],
    profile: dict[str, Any] | None = None,
    practice_vs_science: Any = None,
    social_vs_hardcore: Any = None,
    budget_vs_prestige: Any = None,
    city_vs_campus: Any = None,
    funding_type: Any = "any",
) -> list[dict[str, Any]]:
    del funding_type  # Kept in signature for caller compatibility; UniFit evaluates all funding routes.
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
        "social_vs_hardcore": _preference01(social_vs_hardcore, 50.0),
        "budget_vs_prestige": _preference01(budget_vs_prestige, 50.0),
        "city_vs_campus": _preference01(city_vs_campus, 50.0),
    }
    preference_strength = max(_preference_weights(user_pref).values())
    profile_any = dict(profile)
    profile_any["fundingType"] = "any"
    profile_any["funding_type"] = "any"
    interest_text = str(profile.get("interests") or "").strip()
    profile_major = str(profile.get("major") or "").strip()

    (
        ml_scores_by_id,
        ml_status,
        ml_available,
        ml_runtime_mode,
        ml_unavailable_warning,
        ml_warning_message,
        use_ml,
    ) = _resolve_ml_relevance(interest_text)

    enriched = [
        _score_university_for_ai(
            row,
            profile=profile,
            profile_any=profile_any,
            ctx=ctx,
            lang_cfg=lang_cfg,
            preferred_mode=preferred_mode,
            user_pref=user_pref,
            preference_strength=preference_strength,
            interest_text=interest_text,
            profile_major=profile_major,
            ml_scores_by_id=ml_scores_by_id,
            ml_status=ml_status,
            ml_available=ml_available,
            ml_runtime_mode=ml_runtime_mode,
            ml_unavailable_warning=ml_unavailable_warning,
            ml_warning_message=ml_warning_message,
            use_ml=use_ml,
        )
        for row in items
        if isinstance(row, dict)
    ]

    enriched.sort(
        key=lambda u: (
            bool(u.get("__preference_unknown")),
            float(u.get("__ai_score", 1.0)),
            str((u.get("matchData") or {}).get("budgetStatus") or "") in {"unknown_cost", "uncertain_range"},
            float(u.get("__distance", 1.0)),
            -float(_to_num((u.get("matchData") or {}).get("selectedChance")) or 0.0),
            float(_to_num(u.get("rank")) or 999999.0),
            -float(_to_num((u.get("matchData") or {}).get("admitChance")) or 0.0),
            float(
                _to_num(
                    (u.get("matchData") or {}).get("finalPriceUSD")
                    or ((u.get("matchData") or {}).get("finalPrice"))
                )
                or 1e18
            ),
        )
    )

    out: list[dict[str, Any]] = []
    for row in enriched:
        cleaned = dict(row)
        cleaned.pop("__ai_score", None)
        cleaned.pop("__distance", None)
        cleaned.pop("__preference_unknown", None)
        out.append(cleaned)
    return out
