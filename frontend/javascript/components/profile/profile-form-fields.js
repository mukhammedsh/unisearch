import {
  initCustomSelect,
  loadProfile,
  prefersReducedMotion,
} from "../../utils.js";
import { applyTranslations, t, tFormat } from "../../i18n.js";
import { formatMoney } from "../../currency.js";
import { fillBudgetCurrencyOptions, syncBudgetCurrencySelect } from "./budget-currency.js";
import { buildSectionFillStates } from "./profile-summary.js";
import {
  applyBudgetEntry,
  ensureProfileShape,
  getBudgetCurrency,
  getBudgetPlaceholderValue,
  getLowBudgetGrantThreshold,
  getMaxBudgetForCurrency,
  normalizeAmountRaw,
  normalizeFundingType,
  normalizeGpaRaw,
  setFieldInvalid,
  stableProfileSignature,
} from "./profile-utils.js";

export const initCommonSelects = (selectIds = []) => {
    if (typeof initCustomSelect !== "function") return;
    selectIds.forEach((id) => {
        if (id) initCustomSelect(id);
    });
};

export const isProfileDirty = (state) =>
    !!(state.examEditorDirty || state.languageEditorDirty)
    || stableProfileSignature(state.profile) !== state.savedSignature;

const parseBudgetDraftValue = (els, state) => {
    const raw = String(els.budgetInput?.value || state.profile?.budget || "").trim();
    if (!raw) return null;
    if (raw.includes(".") || raw.includes(",")) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
};

const shouldShowLowBudgetGrantHint = (els, state) => {
    const budgetValue = parseBudgetDraftValue(els, state);
    if (budgetValue === null) return false;
    const currency = getBudgetCurrency();
    const threshold = getLowBudgetGrantThreshold(currency);
    if (budgetValue >= threshold) return false;
    const fundingType = normalizeFundingType(els.profileFundingTypeSelect?.value || state.profile?.fundingType || "any");
    return fundingType !== "grant";
};

export const renderLowBudgetGrantHint = (els, state) => {
    if (!els.lowBudgetGrantHint) return;

    const shouldShow = shouldShowLowBudgetGrantHint(els, state);
    if (!shouldShow) {
        state.lowBudgetGrantHintDismissed = false;
        els.lowBudgetGrantHint.hidden = true;
        return;
    }

    if (state.lowBudgetGrantHintDismissed) {
        els.lowBudgetGrantHint.hidden = true;
        return;
    }

    const currency = getBudgetCurrency();
    const threshold = getLowBudgetGrantThreshold(currency);
    const formattedAmount = formatMoney(threshold, currency);

    const textEl = els.lowBudgetGrantHint.querySelector(".profile-budget-grant-hint__text");
    if (textEl) {
        textEl.removeAttribute("data-i18n");
        textEl.textContent = tFormat(
            "profile.hint.low_budget_grant",
            { amount: formattedAmount },
            `Budget is under ${formattedAmount}. Maybe you need Grant only.`
        );
    }
    if (els.lowBudgetGrantApplyBtn) {
        els.lowBudgetGrantApplyBtn.textContent = t("profile.hint.low_budget_grant_action", "Set Grant only");
    }
    if (els.lowBudgetGrantDismissBtn) {
        const dismissTitle = t("profile.hint.dismiss", "Dismiss hint");
        els.lowBudgetGrantDismissBtn.title = dismissTitle;
        els.lowBudgetGrantDismissBtn.setAttribute("aria-label", dismissTitle);
    }

    els.lowBudgetGrantHint.hidden = false;
};

export const updateBudgetUI = (els, state) => {
    const currency = getBudgetCurrency();
    const maxBudget = getMaxBudgetForCurrency(currency);
    if (els.profileBudgetUnit) els.profileBudgetUnit.textContent = t("profile.unit.per_year", "/ year");
    if (els.profileBudgetCurrency) {
        const select = els.profileBudgetCurrency;
        if (fillBudgetCurrencyOptions(select)) applyTranslations(select);
        syncBudgetCurrencySelect(select, currency);
        select.setAttribute("aria-label", t("profile.budget_currency_label", "Budget currency"));
        initCommonSelects(["profileBudgetCurrency"]);
    }
    if (els.budgetInput) {
        els.budgetInput.removeAttribute("data-i18n-placeholder");
        const exampleVal = getBudgetPlaceholderValue(currency);
        els.budgetInput.placeholder = tFormat("profile.placeholder.budget", { example: String(exampleVal) }, `e.g. ${exampleVal}`);
        els.budgetInput.maxLength = String(maxBudget).length * 2;
    }
    renderLowBudgetGrantHint(els, state);
};

export const renderProfileSummary = (els, state) => {
    const fillStates = buildSectionFillStates(state.profile);

    els.profileSectionTabs.forEach((tab) => {
        const filled = !!fillStates[String(tab.dataset.profileTab || "")];
        tab.dataset.filled = filled ? "true" : "false";
        const status = tab.querySelector(".profile-outline__status");
        if (status) {
            status.textContent = filled
                ? t("profile.ux2.nav.filled", "has answers")
                : t("profile.ux2.nav.empty", "no answers yet");
        }
    });
};

export const refreshSaveState = (els, state) => {
    const dirty = isProfileDirty(state);
    if (els.profileSaveState) {
        els.profileSaveState.removeAttribute("data-i18n");
        if (dirty) {
            els.profileSaveState.textContent = state.examEditorDirty || state.languageEditorDirty
                ? t("profile.report_draft_pending") : t("profile.state.unsaved", "Unsaved changes");
        } else {
            els.profileSaveState.textContent = state.profileStoragePersistent
                ? t("profile.state.saved_local", "Saved on this device")
                : t("profile.state.saved_session", "Saved until this tab is closed");
        }
        els.profileSaveState.classList.toggle("is-dirty", dirty);
    }
    if (els.saveProfileBtn) els.saveProfileBtn.disabled = !dirty;
    renderLowBudgetGrantHint(els, state);
    renderProfileSummary(els, state);
    return dirty;
};

export const sectionIdOf = (node) => String(node?.getAttribute("data-profile-section") || "");

export const setActiveProfileSection = (els, section) => {
    const active = String(section || "basics");
    els.profileSectionTabs.forEach((tab) => {
        const isActive = String(tab.dataset.profileTab || "") === active;
        tab.classList.toggle("is-active", isActive);
        if (isActive) tab.setAttribute("aria-current", "location");
        else tab.removeAttribute("aria-current");
    });
};

// All sections stay visible; the outline only scrolls to one of them and marks it as current.
export const goToProfileSection = (els, state, section, { focusHeading = true } = {}) => {
    const node = els.profileSectionNodes.find((candidate) => sectionIdOf(candidate) === section);
    if (!node) return;
    setActiveProfileSection(els, section);
    // Ignore the scroll observer while the smooth scroll runs, so the clicked item stays current.
    state.sectionNavLockUntil = Date.now() + 900;
    const region = node.closest(".profile-workspace-layout");
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (region && getComputedStyle(region).overflowY === "auto") {
        region.scrollTo({
            top: region.scrollTop + node.getBoundingClientRect().top - region.getBoundingClientRect().top,
            behavior,
        });
    } else {
        node.scrollIntoView({ block: "start", behavior });
    }
    if (focusHeading) node.querySelector(".profile-section-title")?.focus({ preventScroll: true });
};

export const getInterestsDraft = (els) => String(els.profileInterestsInput?.value || "").trim().slice(0, 1200);

export const syncInputsToDraft = (els, state) => {
    if (els.budgetInput) {
        state.profile = applyBudgetEntry(state.profile, normalizeAmountRaw(els.budgetInput.value), state.budgetInputCurrency || getBudgetCurrency());
    }
    if (els.gpaInput) state.profile.gpa = normalizeGpaRaw(els.gpaInput.value || "");
    state.profile.gpaScale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    if (els.studyModeSelect) state.profile.studyMode = String(els.studyModeSelect.value || "Any").trim() || "Any";
    if (els.profileFundingTypeSelect) state.profile.fundingType = normalizeFundingType(els.profileFundingTypeSelect.value);
    if (els.profileMajorSelect) state.profile.major = String(els.profileMajorSelect.value || "").trim();
    if (els.profileInterestsInput) state.profile.interests = getInterestsDraft(els);
    if (els.studyLevelSelect) state.profile.studyLevel = String(els.studyLevelSelect.value || "Any").trim() || "Any";
    // University choices are edited separately and may have changed in another tab.
    state.profile.selectedAdmissionChoices = ensureProfileShape(loadProfile()).selectedAdmissionChoices;
    state.profile = ensureProfileShape(state.profile);
};

const reportFieldValidationError = (inputEl, message) => {
    setFieldInvalid(inputEl, true, message);
    inputEl?.focus();
    return { ok: false, value: "" };
};

export const validateBudgetInput = (els) => {
    const rawVal = normalizeAmountRaw(els.budgetInput?.value);
    if (!rawVal) {
        setFieldInvalid(els.budgetInput, false);
        return { ok: true, value: "" };
    }
    if (rawVal.includes(".") || rawVal.includes(",")) {
        return reportFieldValidationError(els.budgetInput, t("profile.budget_integers_only", "Integers only (no dots/commas)"));
    }
    const val = Number(rawVal);
    if (!Number.isFinite(val)) {
        return reportFieldValidationError(els.budgetInput, t("profile.budget_must_number", "Budget must be a number"));
    }
    const currency = getBudgetCurrency();
    const maxBudget = getMaxBudgetForCurrency(currency);
    if (val < 0 || val > maxBudget) {
        const formattedMax = new Intl.NumberFormat("en-US").format(maxBudget);
        return reportFieldValidationError(
            els.budgetInput,
            tFormat("profile.budget_limit", { max: `${formattedMax} ${currency}` }, `Limit: 0–${formattedMax} ${currency}`)
        );
    }
    setFieldInvalid(els.budgetInput, false);
    return { ok: true, value: val };
};

// Warns while typing when a 5-point grade is entered on the 4.0 scale, instead of only failing on save.
export const renderGpaHint = (els, state) => {
    if (!els.gpaHint) return;
    const scale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    const value = Number(normalizeGpaRaw(els.gpaInput?.value || ""));
    const overScale = scale === 4 && Number.isFinite(value) && value > 4 && value <= 5;
    els.gpaHint.removeAttribute("data-i18n");
    els.gpaHint.setAttribute("aria-live", "polite");
    els.gpaHint.classList.toggle("is-warning", overScale);
    els.gpaHint.textContent = overScale
        ? tFormat("profile.ux2.gpa.over_scale", { value: String(value) }, `${value} is above 4.0. If your school uses a 5-point scale, press "/ 4.0" next to the field to switch to 5.0.`)
        : scale === 5 && state.gpaScaleAutoSwitched ? t("profile.ux2.gpa.auto_switched")
        : "";
};

export const updateGpaScaleUI = (els, state, scale) => {
    const s = scale === 5 ? 5 : 4;
    state.profile.gpaScale = s;
    if (els.gpaInput) {
        els.gpaInput.max = String(s);
        els.gpaInput.placeholder = s === 5 ? "4.80" : "3.80";
    }
    if (els.gpaUnit) {
        const unitKey = s === 5 ? "profile.unit.gpa_5" : "profile.unit.gpa_4";
        els.gpaUnit.setAttribute("data-i18n", unitKey);
        els.gpaUnit.textContent = s === 5 ? "/ 5.0" : "/ 4.0";
    }
    document.querySelectorAll('#gpaScaleChoice input[name="gpaScale"]').forEach((radio) => {
        radio.checked = Number(radio.value) === s;
    });
    renderGpaHint(els, state);
};

export const validateGpaInput = (els, state) => {
    const rawVal = normalizeGpaRaw(els.gpaInput?.value || "");
    if (!rawVal) {
        setFieldInvalid(els.gpaInput, false);
        return { ok: true, value: "" };
    }

    const val = Number(rawVal);
    if (!Number.isFinite(val)) {
        return reportFieldValidationError(els.gpaInput, t("profile.gpa_must_number", "GPA must be a number"));
    }

    const scale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    const min = 0;
    const max = scale;

    if (val < min || val > max) {
        return reportFieldValidationError(els.gpaInput, tFormat("profile.gpa_range", { min, max }, `GPA must be between ${min} and ${max}`));
    }
    setFieldInvalid(els.gpaInput, false);
    return { ok: true, value: Number(Math.round(val * 100) / 100) };
};

export const setGpaScale = (els, state, scale) => {
    const nextScale = scale === 5 ? 5 : 4;
    if (Number(state.profile.gpaScale) === nextScale) return;
    updateGpaScaleUI(els, state, nextScale);
    refreshSaveState(els, state);
};
