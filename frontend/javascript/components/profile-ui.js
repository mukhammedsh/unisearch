import {
  API_BASE,
  EXAM_CONFIG,
  MAJOR_OPTIONS,
  animateElementOut,
  calculateProfileCompletion,
  canonicalizeExamId,
  clearProfile,
  escapeHtml,
  escapeHtmlAttr,
  formatExamValue,
  getExamConfig,
  getExamDisplayName,
  getExamInputMode,
  initCustomSelect,
  loadProfile,
  isFutureProfile,
  MAX_PROFILE_CITIZENSHIPS,
  markMotionEnter,
  motionPress,
  prefersReducedMotion,
  replayMotion,
  saveProfile,
  setupSlidingIndicator,
  showToast,
  trapFocus,
} from "../utils.js";
import { applyTokenSubstitutions, applyTranslations, getCurrentLanguage, t, tFormat } from "../i18n.js";
import { CURRENCY_FORMAT_MAP, convert, formatMoney } from "../currency.js";
import { translateProgramName } from "../university-translations.js";
import { bindInfoTooltips } from "../tooltip.js";
import { hydrateHeroIcons } from "../icons.js";
import { safeSessionStorage } from "../utils/safe-storage.js";
import { COUNTRY_CODES, getCountryName, getCountryOptions } from "../utils/countries.js";
import { hasUniversitiesTourResumeStep } from "../pages/shared/cache.js";
import { isProfilePath, navigateToAppRoute, routeUniversities } from "../routes.js";
import {
  breakdownSchemeFor,
  readSubjectBreakdownDraft as readSubjectBreakdownDraftFromModule,
  renderSpecialExamInput as renderSpecialExamInputFromModule,
} from "./profile/exam-breakdowns.js";
import { renderAdmissionEvidence } from "./profile/admission-evidence.js";
import {
  cloneProfile,
  enforceGpaMaxLength,
  ensureProfileShape,
  formatExamValidationToast,
  getBudgetCurrency,
  getBudgetPlaceholderValue,
  getLowBudgetGrantThreshold,
  getMaxBudgetForCurrency,
  normalizeFundingType,
  normalizeGpaRaw,
  reportInvalidDate,
  setFieldInvalid,
  stableProfileSignature,
} from "./profile/profile-utils.js";

const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";
let activeProfileNavigationClose = null;

export function requestProfileNavigationClose() {
    return activeProfileNavigationClose ? activeProfileNavigationClose() : true;
}

export const queryProfileElements = (modal) => {
    const unsavedModal = document.getElementById("profileUnsavedModal");
    const resetModal = document.getElementById("profileResetModal");
    const budgetInput = document.getElementById("budgetInput");

    return {
        modal,
        unsavedModal,
        unsavedBackdrop: unsavedModal?.querySelector(".profile-confirm-backdrop"),
        discardBtn: document.getElementById("profileDiscardBtn"),
        cancelCloseBtn: document.getElementById("profileCancelCloseBtn"),
        saveAndCloseBtn: document.getElementById("profileSaveAndCloseBtn"),
        resetModal,
        resetBackdrop: resetModal?.querySelector(".profile-confirm-backdrop"),
        resetCancelBtn: document.getElementById("profileResetCancelBtn"),
        resetConfirmBtn: document.getElementById("profileResetConfirmBtn"),
        openBtn: document.getElementById("profileBtn"),
        closeBtn: document.getElementById("profileCloseBtn"),
        backdrop: modal.querySelector(".profile-backdrop"),
        budgetInput,
        profileBudgetUnit: document.getElementById("profileBudgetUnit"),
        budgetHint: budgetInput?.closest(".profile-field")?.querySelector(".profile-hint"),
        familyIncomeInput: document.getElementById("familyIncomeInput"),
        familyIncomeCurrencySelect: document.getElementById("familyIncomeCurrencySelect"),
        gpaInput: document.getElementById("gpaInput"),
        gpaUnit: document.getElementById("gpaUnit"),
        gpaHint: document.getElementById("gpaHint"),
        examNameSelect: document.getElementById("examNameSelect"),
        studyModeSelect: document.getElementById("studyModeSelect"),
        profileFundingTypeSelect: document.getElementById("profileFundingTypeSelect"),
        lowBudgetGrantHint: document.getElementById("profileLowBudgetGrantHint"),
        lowBudgetGrantApplyBtn: document.getElementById("profileLowBudgetGrantApply"),
        lowBudgetGrantDismissBtn: document.getElementById("profileLowBudgetGrantDismiss"),
        examScoreInput: document.getElementById("examScoreInput"),
        examTakenOnInput: document.getElementById("examTakenOnInput"),
        admissionEvidenceFields: document.getElementById("admissionEvidenceFields"),
        examSpecialInputContainer: document.getElementById("examSpecialInputContainer"),
        addExamBtn: document.getElementById("addExamBtn"),
        examList: document.getElementById("examList"),
        profileMajorSelect: document.getElementById("profileMajorSelect"),
        profileInterestsInput: document.getElementById("profileInterestsInput"),
        saveProfileBtn: document.getElementById("saveProfileBtn"),
        resetProfileBtn: document.getElementById("resetProfileBtn"),
        profileSaveState: document.getElementById("profileSaveState"),
        studyLevelSelect: document.getElementById("studyLevelSelect"),
        citizenshipChipsList: document.getElementById("citizenshipChipsList"),
        citizenshipCountrySelect: document.getElementById("citizenshipCountrySelect"),
        citizenshipOtherInput: document.getElementById("citizenshipOtherInput"),
        addCitizenshipBtn: document.getElementById("addCitizenshipBtn"),
        countryOfEducationSelect: document.getElementById("countryOfEducationSelect"),
        countryOfEducationOtherInput: document.getElementById("countryOfEducationOtherInput"),
        educationCredentialSelect: document.getElementById("educationCredentialSelect"),
        educationCredentialOtherInput: document.getElementById("educationCredentialOtherInput"),
        applicantRouteSelect: document.getElementById("applicantRouteSelect"),
        intendedEntryCycleInput: document.getElementById("intendedEntryCycleInput"),
        currentResidenceCountrySelect: document.getElementById("currentResidenceCountrySelect"),
        currentResidenceOtherInput: document.getElementById("currentResidenceOtherInput"),
        feeStatusContextSelect: document.getElementById("feeStatusContextSelect"),
        profileProgressText: document.getElementById("profileProgressText"),
        profileProgressFill: document.getElementById("profileProgressFill"),
        profileSectionTabs: Array.from(modal.querySelectorAll(".profile-section-tab")),
        profileSectionNodes: Array.from(modal.querySelectorAll("[data-profile-section]")),
    };
};

export const initCommonSelects = (selectIds = []) => {
    if (typeof initCustomSelect !== "function") return;
    selectIds.forEach((id) => {
        if (id) initCustomSelect(id);
    });
};

export const isProfileDirty = (state) => stableProfileSignature(state.profile) !== state.savedSignature;

export const setProfileDraft = (state, els, next, options = {}) => {
    state.profile = ensureProfileShape(next);
    if (options.markAsSaved) {
        state.savedSignature = stableProfileSignature(state.profile);
    }
    refreshSaveState(els, state);
};

export const populateMajors = (select) => {
    if (!select) return;
    select.innerHTML = `<option value="">${escapeHtml(t("profile.option.major_any", "Undecided / Any"))}</option>`;
    MAJOR_OPTIONS.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = translateProgramName(m, m);
        select.appendChild(opt);
    });
};

export const populateExamSelect = (els, state) => {
    if (!els.examNameSelect) return;
    els.examNameSelect.innerHTML = `<option value="" disabled selected>${escapeHtml(t("profile.option.select_exam", "Select Exam"))}</option>`;

    const seen = new Set();
    Object.keys(EXAM_CONFIG).forEach((examKey) => {
        const cfg = EXAM_CONFIG?.[examKey];
        if (cfg?.hidden) return;
        const normalized = canonicalizeExamId(examKey);
        const key = String(normalized || examKey).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!key || key === "GPA") return;
        if (seen.has(key)) return;
        seen.add(key);

        const opt = document.createElement("option");
        opt.value = normalized || examKey;
        opt.textContent = getExamDisplayName(normalized || examKey, { locale: getCurrentLanguage() });
        els.examNameSelect.appendChild(opt);
    });

    initCommonSelects(["examNameSelect"]);
    syncExamScoreInputState(els, state);
    refreshExamActionButton(els, state);
};

export const populateFamilyIncomeCurrencyOptions = (select) => {
    if (!select || select.options.length) return;
    const fragment = document.createDocumentFragment();
    Object.keys(CURRENCY_FORMAT_MAP).sort((left, right) => left.localeCompare(right)).forEach((code) => {
        const option = document.createElement("option");
        option.value = code;
        option.dataset.i18n = `currency.opt.${code.toLowerCase()}`;
        option.textContent = t(`currency.opt.${code.toLowerCase()}`, code);
        fragment.appendChild(option);
    });
    select.appendChild(fragment);
};

export const getCountryLabel = (code) => {
    const normalized = String(code || "").trim();
    const upper = normalized.toUpperCase();
    return COUNTRY_CODES.includes(upper) ? `${getCountryName(upper, getCurrentLanguage())} (${upper})` : normalized;
};

export const populateCountryOptionsInSelect = (select, searchPlaceholder) => {
    if (!select) return;
    select.querySelectorAll("option[data-country-code]").forEach((option) => option.remove());
    const otherOption = select.querySelector('option[value="OTHER"]');
    const fragment = document.createDocumentFragment();
    getCountryOptions(getCurrentLanguage()).forEach(({ code, name }) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = `${name} (${code})`;
        option.dataset.countryCode = code;
        fragment.appendChild(option);
    });
    select.insertBefore(fragment, otherOption);
    if (searchPlaceholder) select.dataset.searchPlaceholder = searchPlaceholder;
};

export const populateCitizenshipCountries = (select) =>
    populateCountryOptionsInSelect(select, t("profile.citizenship.search_placeholder", "Search countries"));

export const populateContextCountrySelect = (select) =>
    populateCountryOptionsInSelect(select, t("profile.applicant_context.country_search", "Search countries"));

export const syncOtherContextInput = (select, input, otherValue = "OTHER") => {
    if (!select || !input) return;
    input.hidden = select.value !== otherValue;
};

export const parseBudgetDraftValue = (els, state) => {
    const raw = String(els.budgetInput?.value || state.profile?.budget || "").trim();
    if (!raw) return null;
    if (raw.includes(".") || raw.includes(",")) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
};

export const shouldShowLowBudgetGrantHint = (els, state) => {
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
    const formattedMax = new Intl.NumberFormat("en-US").format(maxBudget);
    if (els.profileBudgetUnit) {
        els.profileBudgetUnit.textContent = applyTokenSubstitutions(t("profile.unit.currency_year", "{currency} / year"));
    }
    if (els.budgetHint) {
        els.budgetHint.textContent = tFormat("profile.hint.budget_range", { max: formattedMax }, `Range: 0–${formattedMax}`);
    }
    if (els.budgetInput) {
        const exampleVal = getBudgetPlaceholderValue(currency);
        els.budgetInput.placeholder = tFormat("profile.placeholder.budget", { example: String(exampleVal) }, `e.g. ${exampleVal}`);
        els.budgetInput.maxLength = String(maxBudget).length;
    }
    renderLowBudgetGrantHint(els, state);
};

export const updateProfileProgress = (els, state) => {
    const { completed, total, percentage } = calculateProfileCompletion(state.profile);
    if (els.profileProgressText) {
        els.profileProgressText.textContent = completed
            ? tFormat("profile.progress.count", { completed: String(completed), total: String(total) }, `${completed}/${total} profile areas complete`)
            : t("profile.progress.empty", "Complete your profile for better matches.");
    }
    if (els.profileProgressFill) {
        els.profileProgressFill.style.width = `${percentage}%`;
    }
    const meter = els.modal.querySelector(".profile-progress-meter");
    if (meter) {
        meter.setAttribute("role", "progressbar");
        meter.setAttribute("aria-valuenow", String(percentage));
        meter.setAttribute("aria-valuemin", "0");
        meter.setAttribute("aria-valuemax", "100");
        meter.setAttribute("title", `${percentage}% (${completed}/${total})`);
    }
};

export const refreshSaveState = (els, state) => {
    const dirty = isProfileDirty(state);
    if (els.profileSaveState) {
        if (dirty) {
            els.profileSaveState.textContent = t("profile.state.unsaved", "Unsaved changes");
        } else {
            els.profileSaveState.textContent = state.profileStoragePersistent
                ? t("profile.state.saved_local", "Saved on this device")
                : t("profile.state.saved_session", "Saved until this tab is closed");
        }
        els.profileSaveState.classList.toggle("is-dirty", dirty);
    }
    if (els.saveProfileBtn) els.saveProfileBtn.disabled = !dirty;
    renderLowBudgetGrantHint(els, state);
    updateProfileProgress(els, state);
    return dirty;
};

export const setProfileSection = (els, state, section = "basics") => {
    const active = String(section || "basics");
    els.profileSectionTabs.forEach((tab) => {
        const isActive = String(tab.dataset.profileTab || "") === active;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    els.profileSectionNodes.forEach((node) => {
        const isActive = String(node.getAttribute("data-profile-section") || "") === active;
        node.classList.toggle("is-section-hidden", !isActive);
        if (isActive) replayMotion(node, "is-motion-active", { timeoutMs: 420 });
    });
    requestAnimationFrame(() => {
        state.updateProfileTabsIndicator?.();
        if (window.matchMedia("(max-width: 768px)").matches) {
            const activeTab = els.modal.querySelector(".profile-section-tab.is-active");
            if (activeTab && typeof activeTab.scrollIntoView === "function") {
                try {
                    activeTab.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                        behavior: prefersReducedMotion() ? "auto" : "smooth",
                    });
                } catch (error) {
                    activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
                }
            }
        }
    });
};

export const findExistingExamEntry = (examId, els, state) => {
    const selected = canonicalizeExamId(examId);
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    if (!selected || !Array.isArray(state.profile.exams)) return null;
    return state.profile.exams.find((row) => canonicalizeExamId(row?.exam ?? row?.id ?? "") === selected
        && String(row?.taken_on || "") === takenOn) || null;
};

export const readSubjectBreakdownDraft = (examId, els, state, options = {}) =>
    readSubjectBreakdownDraftFromModule(examId, els.examSpecialInputContainer, {
        ...options,
        findExistingExamEntry: (id) => findExistingExamEntry(id, els, state),
    });

export const renderSpecialExamInput = (examId, els, state) =>
    renderSpecialExamInputFromModule(examId, els.examSpecialInputContainer, {
        findExistingExamEntry: (id) => findExistingExamEntry(id, els, state),
    });

export const syncExamScoreInputState = (els, state) => {
    if (!els.examScoreInput) return;

    const selectedExam = canonicalizeExamId(els.examNameSelect?.value);
    const mode = getExamInputMode(selectedExam);
    const cfg = getExamConfig(selectedExam);
    const breakdownScheme = breakdownSchemeFor(selectedExam);
    const examForm = els.examScoreInput.closest(".profile-exam-form");
    const existing = findExistingExamEntry(selectedExam, els, state);
    const usesCompositeParentScore = mode === "subject_breakdown"
        && String(breakdownScheme?.total_strategy || "").trim().toLowerCase() === "use_parent_score";
    const usesNumberInput = mode === "number" || usesCompositeParentScore;
    const usesSpecialInput = mode === "band_select" || mode === "grade_combo" || mode === "subject_breakdown";

    els.examScoreInput.hidden = !usesNumberInput;
    els.examScoreInput.disabled = !usesNumberInput;
    els.examScoreInput.setAttribute("aria-hidden", usesNumberInput ? "false" : "true");

    if (els.examSpecialInputContainer) {
        els.examSpecialInputContainer.hidden = !usesSpecialInput;
        els.examSpecialInputContainer.style.display = usesSpecialInput ? "" : "none";
        els.examSpecialInputContainer.setAttribute("aria-hidden", usesSpecialInput ? "false" : "true");
        if (usesSpecialInput) renderSpecialExamInput(selectedExam, els, state);
        else els.examSpecialInputContainer.innerHTML = "";
    }

    if (examForm) {
        examForm.classList.toggle("profile-exam-form--no-score", !usesNumberInput && !usesSpecialInput);
        examForm.classList.toggle("profile-exam-form--with-special", usesSpecialInput);
        examForm.classList.toggle("profile-exam-form--grades", mode === "grade_combo");
        examForm.classList.toggle("profile-exam-form--band", mode === "band_select");
        examForm.classList.toggle("profile-exam-form--breakdown", mode === "subject_breakdown");
    }

    if (!usesNumberInput) {
        els.examScoreInput.value = "";
        return;
    }

    els.examScoreInput.placeholder = usesCompositeParentScore
        ? t("profile.exam_total_placeholder", "Overall total")
        : t("profile.placeholder.score", "Score");
    if (existing && Number.isFinite(Number(existing?.score))) {
        els.examScoreInput.value = String(existing.score);
    } else {
        els.examScoreInput.value = "";
    }

    if (cfg) {
        if (cfg.min !== undefined) els.examScoreInput.min = String(cfg.min);
        else els.examScoreInput.removeAttribute("min");
        if (cfg.max !== undefined) els.examScoreInput.max = String(cfg.max);
        else els.examScoreInput.removeAttribute("max");
        if (cfg.step !== undefined) els.examScoreInput.step = String(cfg.step);
        else els.examScoreInput.step = cfg.type === "float" ? "any" : "1";
        return;
    }

    els.examScoreInput.removeAttribute("min");
    els.examScoreInput.removeAttribute("max");
    els.examScoreInput.step = "0.1";
};

export const readSelectedExamPayload = (examId, els, state) => {
    const mode = getExamInputMode(examId);
    if (mode === "flag") {
        return { score: 1 };
    }

    if (mode === "band_select") {
        const bandSelect = els.examSpecialInputContainer?.querySelector("#examBandSelect");
        const band = String(bandSelect?.value || "").trim();
        if (!band) {
            showToast(t("profile.exam_band_required", "Select a level"), "error");
            return null;
        }
        return {
            raw_value: band,
            details: { band },
        };
    }

    if (mode === "grade_combo") {
        const cfg = getExamConfig(examId);
        const gradeScheme = cfg?.grade_scheme || {};
        const minCount = Math.max(1, Number(gradeScheme?.subject_count_min) || 3);
        const gradeSelects = Array.from(els.examSpecialInputContainer?.querySelectorAll("[data-grade-slot]") || []);
        const grades = gradeSelects.map((node) => String(node?.value || "").trim());
        const requiredGrades = grades.slice(0, minCount);
        if (requiredGrades.some((grade) => !grade)) {
            showToast(
                tFormat(
                    "profile.exam_grade_required",
                    { exam: getExamDisplayName(examId, { locale: getCurrentLanguage() }), count: minCount },
                    `Choose ${minCount} grades for ${getExamDisplayName(examId, { locale: getCurrentLanguage() })}`
                ),
                "error"
            );
            return null;
        }

        const normalizedGrades = grades.filter(Boolean);
        const rawValue = normalizedGrades.join("");
        return {
            raw_value: rawValue,
            details: { grades: normalizedGrades },
        };
    }

    if (mode === "subject_breakdown") {
        const scheme = breakdownSchemeFor(examId);
        const draft = readSubjectBreakdownDraft(examId, els, state);
        if (!draft) return null;

        const selectableMin = Math.max(0, Number(scheme?.selectable_count_min) || 0);
        const selectableSet = new Set(draft.selectable.map((item) => item.exam));
        const selectedOptionalCount = draft.components.filter((row) => selectableSet.has(row.exam)).length;
        if (selectedOptionalCount < selectableMin) {
            showToast(
                tFormat(
                    "profile.exam_subject_required_count",
                    { count: selectableMin, exam: getExamDisplayName(examId, { locale: getCurrentLanguage() }) },
                    `Choose at least ${selectableMin} subjects for ${getExamDisplayName(examId, { locale: getCurrentLanguage() })}`
                ),
                "error"
            );
            return null;
        }

        const payload = {
            details: {
                components: draft.components,
                ...(draft.extraScores.length ? { extra_scores: draft.extraScores } : {}),
            },
        };

        if (String(scheme?.total_strategy || "").trim().toLowerCase() === "use_parent_score") {
            const rawScore = String(els.examScoreInput?.value || "").trim();
            const score = Number(rawScore);
            if (!rawScore || Number.isNaN(score)) {
                showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
                return null;
            }
            payload.score = score;
            payload.raw_input_score = rawScore;
        }

        return payload;
    }

    const rawScore = String(els.examScoreInput?.value || "").trim();
    const score = Number.parseFloat(rawScore);
    return { score, raw_input_score: rawScore };
};

export const refreshExamActionButton = (els, state) => {
    if (!els.addExamBtn || !els.examNameSelect) return;
    const selected = canonicalizeExamId(els.examNameSelect.value);
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    const hasExisting = !!selected && Array.isArray(state.profile.exams)
        && state.profile.exams.some((e) => canonicalizeExamId(e.exam ?? e.id ?? "") === selected && String(e.taken_on || "") === takenOn);
    const key = hasExisting ? "profile.edit" : "profile.add";
    const fallback = hasExisting ? "Edit" : "Add";
    els.addExamBtn.setAttribute("data-i18n", key);
    els.addExamBtn.textContent = t(key, fallback);
};

export const getInterestsDraft = (els) => String(els.profileInterestsInput?.value || "").trim().slice(0, 1200);

export const syncApplicantContext = (els, profile) => {
    profile.countryOfEducation = String(els.countryOfEducationSelect?.value || "").trim();
    profile.countryOfEducationOther = profile.countryOfEducation === "OTHER" ? String(els.countryOfEducationOtherInput?.value || "").trim() : "";
    profile.educationCredential = String(els.educationCredentialSelect?.value || "").trim();
    profile.educationCredentialOther = profile.educationCredential === "other" ? String(els.educationCredentialOtherInput?.value || "").trim() : "";
    profile.applicantRoute = String(els.applicantRouteSelect?.value || "").trim();
    profile.intendedEntryCycle = String(els.intendedEntryCycleInput?.value || "").trim();
    profile.currentResidenceCountry = String(els.currentResidenceCountrySelect?.value || "").trim();
    profile.currentResidenceOther = profile.currentResidenceCountry === "OTHER" ? String(els.currentResidenceOtherInput?.value || "").trim() : "";
    profile.feeStatusContext = String(els.feeStatusContextSelect?.value || "unknown").trim() || "unknown";
};

export const syncInputsToDraft = (els, state) => {
    if (els.budgetInput) state.profile.budget = String(els.budgetInput.value || "").trim();
    state.profile.budgetCurrency = getBudgetCurrency();
    if (els.familyIncomeInput) state.profile.familyIncomeAmount = String(els.familyIncomeInput.value || "").trim().replace(/,/g, ".");
    if (els.familyIncomeCurrencySelect) state.profile.familyIncomeCurrency = String(els.familyIncomeCurrencySelect.value || getBudgetCurrency()).toUpperCase();
    if (els.gpaInput) state.profile.gpa = normalizeGpaRaw(els.gpaInput.value || "");
    state.profile.gpaScale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    if (els.studyModeSelect) state.profile.studyMode = String(els.studyModeSelect.value || "Any").trim() || "Any";
    if (els.profileFundingTypeSelect) state.profile.fundingType = normalizeFundingType(els.profileFundingTypeSelect.value);
    if (els.profileMajorSelect) state.profile.major = String(els.profileMajorSelect.value || "").trim();
    if (els.profileInterestsInput) state.profile.interests = getInterestsDraft(els);
    if (els.studyLevelSelect) state.profile.studyLevel = String(els.studyLevelSelect.value || "Any").trim() || "Any";
    syncApplicantContext(els, state.profile);
    state.profile.citizenships = Array.isArray(state.profile.citizenships) ? state.profile.citizenships : [];
    state.profile.citizenship = state.profile.citizenships.length ? state.profile.citizenships[0] : "";
    state.profile = ensureProfileShape(state.profile);
};

export const reportFieldValidationError = (inputEl, message) => {
    setFieldInvalid(inputEl, true, message);
    inputEl?.focus();
    return { ok: false, value: "" };
};

export const validateBudgetInput = (els) => {
    const rawVal = String(els.budgetInput?.value || "").trim();
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

export const validateFamilyIncomeInput = (els) => {
    const rawVal = String(els.familyIncomeInput?.value || "").trim().replace(/,/g, ".");
    if (!rawVal) {
        setFieldInvalid(els.familyIncomeInput, false);
        return { ok: true, value: "" };
    }
    const val = Number(rawVal);
    if (!Number.isFinite(val) || val < 0 || val > 1_000_000_000_000) {
        return reportFieldValidationError(els.familyIncomeInput, t("profile.family_income_invalid", "Enter an amount from 0 to 1,000,000,000,000."));
    }
    setFieldInvalid(els.familyIncomeInput, false);
    return { ok: true, value: val };
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
        const toggleLabel = tFormat(
            "profile.scale.toggle",
            { scale: s === 5 ? "4.0" : "5.0" },
            `Switch GPA scale to ${s === 5 ? "4.0" : "5.0"}`
        );
        els.gpaUnit.setAttribute("aria-label", toggleLabel);
        els.gpaUnit.title = toggleLabel;
    }
    if (els.gpaHint) {
        els.gpaHint.textContent = s === 5
            ? t("profile.scale.gpa_5", "5.0 (KZ / CIS)")
            : t("profile.scale.gpa_4", "4.0 (US / International)");
    }
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

export const resetCitizenshipInputs = (els) => {
    if (els.citizenshipCountrySelect) els.citizenshipCountrySelect.value = "";
    if (els.citizenshipOtherInput) {
        els.citizenshipOtherInput.value = "";
        els.citizenshipOtherInput.style.display = "none";
    }
};

export const renderCitizenshipChips = (els, state) => {
    if (!els.citizenshipChipsList) return;
    const list = Array.isArray(state.profile.citizenships) ? state.profile.citizenships : [];
    if (!list.length) {
        els.citizenshipChipsList.innerHTML = `<span class="profile-hint">${escapeHtml(t("profile.citizenship.empty_hint", "No citizenships added yet. Add them for fee and aid policy review."))}</span>`;
        return;
    }
    els.citizenshipChipsList.innerHTML = list.map((countryCode, idx) => {
        const isPrimary = idx === 0;
        const label = getCountryLabel(countryCode);
        const primaryBadge = isPrimary
            ? `<span class="profile-citizenship-chip__badge">${escapeHtml(t("profile.citizenship.primary_badge", "Primary"))}</span>`
            : `<button type="button" class="profile-citizenship-chip__btn" data-make-primary-idx="${idx}" title="${escapeHtmlAttr(t("profile.citizenship.set_primary_title", "Make primary citizenship"))}">
                <span data-heroicon="arrow-up" data-icon-size="14"></span>
              </button>`;
        const removeBtn = `<button type="button" class="profile-citizenship-chip__btn" data-remove-citizenship-idx="${idx}" title="${escapeHtmlAttr(t("profile.citizenship.remove_title", "Remove citizenship"))}" aria-label="${escapeHtmlAttr(t("profile.citizenship.remove_title", "Remove citizenship"))}">
            <span data-heroicon="x-mark" data-icon-size="14"></span>
          </button>`;
        return `
          <div class="profile-citizenship-chip${isPrimary ? " profile-citizenship-chip--primary" : ""}" data-citizenship-chip="${idx}">
            <span>${escapeHtml(label)}</span>
            ${primaryBadge}
            ${removeBtn}
          </div>
        `;
    }).join("");
    hydrateHeroIcons(els.citizenshipChipsList);

    els.citizenshipChipsList.querySelectorAll("[data-remove-citizenship-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.getAttribute("data-remove-citizenship-idx"));
            if (Number.isInteger(idx) && idx >= 0 && idx < state.profile.citizenships.length) {
                state.profile.citizenships.splice(idx, 1);
                state.profile.citizenship = state.profile.citizenships.length ? state.profile.citizenships[0] : "";
                renderCitizenshipChips(els, state);
                refreshSaveState(els, state);
            }
        });
    });

    els.citizenshipChipsList.querySelectorAll("[data-make-primary-idx]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.getAttribute("data-make-primary-idx"));
            if (Number.isInteger(idx) && idx > 0 && idx < state.profile.citizenships.length) {
                const item = state.profile.citizenships.splice(idx, 1)[0];
                state.profile.citizenships.unshift(item);
                state.profile.citizenship = state.profile.citizenships[0];
                renderCitizenshipChips(els, state);
                refreshSaveState(els, state);
            }
        });
    });
};

export const renderProfileData = (els, state) => {
    if (!Array.isArray(state.profile.exams)) state.profile.exams = [];
    if (els.examList) {
        els.examList.innerHTML = state.profile.exams.map((ex, i) => `
            <div class="profile-exam-item">
                <div class="profile-exam-meta">
                    <span class="profile-exam-name">${escapeHtml(getExamDisplayName(ex.exam, { locale: getCurrentLanguage() }))}</span>
                    <span class="profile-exam-score">${escapeHtml([formatExamValue(ex.exam, ex, { context: "profile", locale: getCurrentLanguage() }), ex.taken_on].filter(Boolean).join(" · "))}</span>
                </div>
                <button type="button" data-edit-idx="${i}" class="profile-button-subtle">${escapeHtml(t("profile.edit", "Edit"))}</button>
                <button type="button" data-idx="${i}" class="profile-delete">${escapeHtml(t("profile.delete", "Delete"))}</button>
            </div>
        `).join("");
        markMotionEnter(els.examList, ".profile-exam-item", { limit: 8, staggerMs: 18 });
    }
    refreshExamActionButton(els, state);
};

export const applyDraftToInputs = (els, state) => {
    setFieldInvalid(els.budgetInput, false);
    setFieldInvalid(els.familyIncomeInput, false);
    setFieldInvalid(els.gpaInput, false);
    setFieldInvalid(els.examScoreInput, false);

    const activeCurrency = getBudgetCurrency();
    if (state.profile.budget !== "" && Number.isFinite(Number(state.profile.budget)) && state.profile.budgetCurrency && state.profile.budgetCurrency !== activeCurrency) {
        const converted = Math.round(convert(Number(state.profile.budget), state.profile.budgetCurrency, activeCurrency));
        state.profile.budget = converted;
        state.profile.budgetCurrency = activeCurrency;
        state.profileStoragePersistent = saveProfile(state.profile);
        state.savedSignature = stableProfileSignature(state.profile);
    } else if (!state.profile.budgetCurrency) {
        state.profile.budgetCurrency = activeCurrency;
    }

    if (els.budgetInput) els.budgetInput.value = state.profile.budget === "" ? "" : String(state.profile.budget);
    populateFamilyIncomeCurrencyOptions(els.familyIncomeCurrencySelect);
    if (els.familyIncomeInput) els.familyIncomeInput.value = state.profile.familyIncomeAmount === "" ? "" : String(state.profile.familyIncomeAmount);
    if (els.familyIncomeCurrencySelect) {
        els.familyIncomeCurrencySelect.value = state.profile.familyIncomeAmount === ""
            ? getBudgetCurrency()
            : state.profile.familyIncomeCurrency || getBudgetCurrency();
    }
    updateGpaScaleUI(els, state, Number(state.profile.gpaScale) === 5 ? 5 : 4);
    if (els.gpaInput) els.gpaInput.value = state.profile.gpa === "" ? "" : String(state.profile.gpa);
    if (els.studyModeSelect) els.studyModeSelect.value = state.profile.studyMode || "Any";
    if (els.profileFundingTypeSelect) els.profileFundingTypeSelect.value = normalizeFundingType(state.profile.fundingType);
    if (els.profileMajorSelect) els.profileMajorSelect.value = state.profile.major || "";
    if (els.profileInterestsInput) els.profileInterestsInput.value = state.profile.interests || "";
    if (els.studyLevelSelect) els.studyLevelSelect.value = state.profile.studyLevel || "Any";
    populateContextCountrySelect(els.countryOfEducationSelect);
    populateContextCountrySelect(els.currentResidenceCountrySelect);
    if (els.countryOfEducationSelect) els.countryOfEducationSelect.value = state.profile.countryOfEducation || "";
    if (els.countryOfEducationOtherInput) els.countryOfEducationOtherInput.value = state.profile.countryOfEducation === "OTHER" ? state.profile.countryOfEducationOther || "" : "";
    if (els.educationCredentialSelect) els.educationCredentialSelect.value = state.profile.educationCredential || "";
    if (els.educationCredentialOtherInput) els.educationCredentialOtherInput.value = state.profile.educationCredential === "other" ? state.profile.educationCredentialOther || "" : "";
    if (els.applicantRouteSelect) els.applicantRouteSelect.value = state.profile.applicantRoute || "";
    if (els.intendedEntryCycleInput) els.intendedEntryCycleInput.value = state.profile.intendedEntryCycle || "";
    if (els.currentResidenceCountrySelect) els.currentResidenceCountrySelect.value = state.profile.currentResidenceCountry || "";
    if (els.currentResidenceOtherInput) els.currentResidenceOtherInput.value = state.profile.currentResidenceCountry === "OTHER" ? state.profile.currentResidenceOther || "" : "";
    if (els.feeStatusContextSelect) els.feeStatusContextSelect.value = state.profile.feeStatusContext || "unknown";
    syncOtherContextInput(els.countryOfEducationSelect, els.countryOfEducationOtherInput);
    syncOtherContextInput(els.educationCredentialSelect, els.educationCredentialOtherInput, "other");
    syncOtherContextInput(els.currentResidenceCountrySelect, els.currentResidenceOtherInput);
    populateCitizenshipCountries(els.citizenshipCountrySelect);
    resetCitizenshipInputs(els);
    renderCitizenshipChips(els, state);
    renderAdmissionEvidence(els.admissionEvidenceFields, state.profile, (next) => {
        state.profile = ensureProfileShape({
            ...state.profile,
            languageEvidence: next.languageEvidence,
            institutionalEvidence: next.institutionalEvidence,
        });
        refreshSaveState(els, state);
    });
    applyTranslations(els.admissionEvidenceFields);
    if (els.examNameSelect) els.examNameSelect.value = "";
    if (els.examScoreInput) els.examScoreInput.value = "";
    if (els.examTakenOnInput) {
        els.examTakenOnInput.value = "";
        els.examTakenOnInput.max = new Date().toISOString().slice(0, 10);
    }
    if (els.examSpecialInputContainer) {
        els.examSpecialInputContainer.innerHTML = "";
        els.examSpecialInputContainer.style.display = "none";
        delete els.examSpecialInputContainer.dataset.breakdownExam;
    }
    initCommonSelects([
        "studyModeSelect",
        "profileFundingTypeSelect",
        "familyIncomeCurrencySelect",
        "profileMajorSelect",
        "examNameSelect",
        "studyLevelSelect",
        "citizenshipCountrySelect",
        "countryOfEducationSelect",
        "educationCredentialSelect",
        "applicantRouteSelect",
        "currentResidenceCountrySelect",
        "feeStatusContextSelect",
    ]);
    renderProfileData(els, state);
    updateBudgetUI(els, state);
    refreshSaveState(els, state);
};

export const resetFields = (els, state) => {
    const savedProfile = ensureProfileShape(loadProfile());
    setProfileDraft(state, els, savedProfile, { markAsSaved: true });
    applyDraftToInputs(els, state);
};

export const saveAllProfileChanges = (els, state) => {
    syncInputsToDraft(els, state);

    const budgetCheck = validateBudgetInput(els);
    if (!budgetCheck.ok) return false;
    const familyIncomeCheck = validateFamilyIncomeInput(els);
    if (!familyIncomeCheck.ok) return false;
    const gpaCheck = validateGpaInput(els, state);
    if (!gpaCheck.ok) return false;

    state.profile.budget = budgetCheck.value;
    state.profile.budgetCurrency = getBudgetCurrency();
    state.profile.familyIncomeAmount = familyIncomeCheck.value;
    state.profile.familyIncomeCurrency = String(els.familyIncomeCurrencySelect?.value || getBudgetCurrency()).toUpperCase();
    state.profile.gpa = gpaCheck.value;
    state.profile.gpaScale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    state.profile.interests = getInterestsDraft(els);
    state.profile.studyMode = String(els.studyModeSelect?.value || state.profile.studyMode || "Any").trim() || "Any";
    state.profile.fundingType = normalizeFundingType(els.profileFundingTypeSelect?.value || state.profile.fundingType || "any");
    state.profile.major = String(els.profileMajorSelect?.value || state.profile.major || "").trim();
    state.profile.studyLevel = String(els.studyLevelSelect?.value || state.profile.studyLevel || "Any").trim() || "Any";
    state.profile.citizenships = Array.isArray(state.profile.citizenships) ? state.profile.citizenships : [];
    state.profile.citizenship = state.profile.citizenships.length ? state.profile.citizenships[0] : "";
    state.profile = ensureProfileShape(state.profile);

    if (els.budgetInput) els.budgetInput.value = state.profile.budget === "" ? "" : String(state.profile.budget);
    if (els.familyIncomeInput) els.familyIncomeInput.value = state.profile.familyIncomeAmount === "" ? "" : String(state.profile.familyIncomeAmount);
    if (els.gpaInput) els.gpaInput.value = state.profile.gpa === "" ? "" : String(state.profile.gpa);

    state.profileStoragePersistent = saveProfile(state.profile);
    state.savedSignature = stableProfileSignature(state.profile);
    refreshSaveState(els, state);
    replayMotion(els.profileSaveState, "motion-state-pulse", { timeoutMs: 520 });
    replayMotion(els.saveProfileBtn, "motion-state-pulse", { timeoutMs: 520 });

    return true;
};

export const closeDialogWithMotion = (modal, focusTrapCleanup, focusTargetOnClose) => {
    if (!modal) return;
    window.clearTimeout(modal._closeMotionTimer);
    const finish = () => {
        modal._closeMotionTimer = null;
        focusTrapCleanup?.();
        modal.classList.remove("is-open", "is-closing");
        modal.setAttribute("aria-hidden", "true");
        modal.style.display = "none";
        if (focusTargetOnClose) focusTargetOnClose.focus();
    };
    if (prefersReducedMotion() || !modal.classList.contains("is-open")) {
        finish();
        return;
    }
    modal.classList.add("is-closing");
    modal._closeMotionTimer = window.setTimeout(finish, 180);
};

export const closeUnsavedDialog = (els, state, focusCloseButton = false) => {
    if (!els.unsavedModal) return;
    closeDialogWithMotion(els.unsavedModal, () => {
        state.cleanupUnsavedFocusTrap?.();
        state.cleanupUnsavedFocusTrap = null;
    }, focusCloseButton ? els.closeBtn : null);
};

export const closeResetDialog = (els, state, focusResetButton = false) => {
    if (!els.resetModal) return;
    closeDialogWithMotion(els.resetModal, () => {
        state.cleanupResetFocusTrap?.();
        state.cleanupResetFocusTrap = null;
    }, focusResetButton ? els.resetProfileBtn : null);
};

export const closeImmediately = (els, state) => {
    if (!els.modal.classList.contains("is-open") && !state.isDedicatedPage) return;
    state.isDiscarding = true;

    closeUnsavedDialog(els, state, false);
    closeResetDialog(els, state, false);
    if (typeof state.cleanupFocusTrap === "function") {
        state.cleanupFocusTrap();
        state.cleanupFocusTrap = null;
    }

    const finish = () => {
        window.dispatchEvent(new Event("profileModalClosed"));
        if (state.isDedicatedPage) {
            const returnUrl = safeSessionStorage.get(PROFILE_RETURN_URL_KEY, "");
            if (returnUrl) {
                safeSessionStorage.remove(PROFILE_RETURN_URL_KEY);
                try {
                    const parsed = new URL(returnUrl, window.location.href);
                    if (parsed.origin === window.location.origin && !isProfilePath(parsed.pathname)) {
                        if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            navigateToAppRoute(parsed.href);
                        }
                        return;
                    }
                } catch (_) {}
            }

            if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                navigateToAppRoute(routeUniversities());
            }
            return;
        }
        els.modal.classList.remove("is-open", "is-closing");
        els.modal.style.display = "none";
        els.modal.setAttribute("aria-hidden", "true");
        if (els.openBtn) els.openBtn.focus();
        resetFields(els, state);
    };
    if (prefersReducedMotion()) {
        finish();
        return;
    }
    if (!state.isDedicatedPage) {
        els.modal.classList.add("is-closing");
        window.setTimeout(finish, 180);
    } else {
        finish();
    }
};

export const openUnsavedDialog = (els, state) => {
    if (!els.unsavedModal) return;
    window.clearTimeout(els.unsavedModal._closeMotionTimer);
    els.unsavedModal.style.display = "flex";
    els.unsavedModal.classList.remove("is-closing");
    els.unsavedModal.classList.add("is-open");
    els.unsavedModal.setAttribute("aria-hidden", "false");
    state.cleanupUnsavedFocusTrap?.();
    state.cleanupUnsavedFocusTrap = trapFocus(els.unsavedModal);
    els.cancelCloseBtn?.focus();
};

export const openResetDialog = (els, state) => {
    if (!els.resetModal) {
        if (window.confirm(t("profile.reset.confirm_message", "This will remove all saved profile data on this device and set the profile back to empty values."))) {
            resetProfileData(els, state);
        }
        return;
    }
    window.clearTimeout(els.resetModal._closeMotionTimer);
    els.resetModal.style.display = "flex";
    els.resetModal.classList.remove("is-closing");
    els.resetModal.classList.add("is-open");
    els.resetModal.setAttribute("aria-hidden", "false");
    state.cleanupResetFocusTrap?.();
    state.cleanupResetFocusTrap = trapFocus(els.resetModal);
    els.resetCancelBtn?.focus();
};

export const requestClose = (els, state) => {
    if (!els.modal.classList.contains("is-open") && !state.isDedicatedPage) return;
    syncInputsToDraft(els, state);
    if (!refreshSaveState(els, state)) {
        closeImmediately(els, state);
        return;
    }
    openUnsavedDialog(els, state);
};

export const resetProfileData = (els, state) => {
    state.lowBudgetGrantHintDismissed = false;
    safeSessionStorage.remove(PROFILE_RETURN_URL_KEY);
    state.profileStoragePersistent = clearProfile();
    const emptyProfile = ensureProfileShape({});
    setProfileDraft(state, els, emptyProfile, { markAsSaved: true });
    applyDraftToInputs(els, state);
    renderLowBudgetGrantHint(els, state);
    closeResetDialog(els, state, false);
    window.dispatchEvent(new Event("profileUpdated"));
    showToast(t("profile.reset.done", "Profile data reset"), "success");
};

export const retranslateProfileUi = (els, state) => {
    const selectedExam = els.examNameSelect ? String(els.examNameSelect.value || "") : "";
    const selectedLangCode = document.getElementById("langCode");
    const selectedLangKind = document.getElementById("langKind");
    const selectedLangCefr = document.getElementById("langCefr");
    const selectedLangExam = document.getElementById("langExam");
    const prevLangCode = selectedLangCode ? String(selectedLangCode.value || "") : "";
    const prevLangKind = selectedLangKind ? String(selectedLangKind.value || "") : "";
    const prevLangCefr = selectedLangCefr ? String(selectedLangCefr.value || "") : "";
    const prevLangExam = selectedLangExam ? String(selectedLangExam.value || "") : "";

    populateMajors(els.profileMajorSelect);
    populateExamSelect(els, state);
    if (els.examNameSelect && selectedExam) {
        els.examNameSelect.value = selectedExam;
    }

    applyTranslations(els.modal);
    if (els.unsavedModal) applyTranslations(els.unsavedModal);
    if (els.resetModal) applyTranslations(els.resetModal);
    updateBudgetUI(els, state);
    applyDraftToInputs(els, state);
    refreshExamActionButton(els, state);

    if (selectedLangCode && prevLangCode) selectedLangCode.value = prevLangCode;
    if (selectedLangKind && prevLangKind) selectedLangKind.value = prevLangKind;
    if (selectedLangCefr && prevLangCefr) selectedLangCefr.value = prevLangCefr;
    if (selectedLangExam && prevLangExam) selectedLangExam.value = prevLangExam;

    initCommonSelects([
        "examNameSelect",
        "studyModeSelect",
        "profileFundingTypeSelect",
        "profileMajorSelect",
        selectedLangCode ? "langCode" : null,
        selectedLangKind ? "langKind" : null,
        selectedLangCefr ? "langCefr" : null,
        selectedLangExam ? "langExam" : null,
    ]);
};

export const setGpaScale = (els, state, scale) => {
    const nextScale = scale === 5 ? 5 : 4;
    if (Number(state.profile.gpaScale) === nextScale) return;
    updateGpaScaleUI(els, state, nextScale);
    refreshSaveState(els, state);
};

export const openProfile = (els, state) => {
    state.isDiscarding = false;
    resetFields(els, state);
    retranslateProfileUi(els, state);

    initCommonSelects([
        "examNameSelect",
        "studyModeSelect",
        "profileFundingTypeSelect",
        "profileMajorSelect",
    ]);
    refreshExamActionButton(els, state);
    updateProfileProgress(els, state);
    hydrateHeroIcons(els.modal);

    window.dispatchEvent(new Event("profileModalOpened"));
    els.modal.classList.remove("is-closing");
    els.modal.classList.add("is-open");
    if (!state.isDedicatedPage) {
        els.modal.style.display = "flex";
    }
    els.modal.removeAttribute("aria-hidden");
    if (!state.isDedicatedPage) {
        if (typeof state.cleanupFocusTrap === "function") state.cleanupFocusTrap();
        state.cleanupFocusTrap = trapFocus(els.modal);
    }
    requestAnimationFrame(() => {
        state.updateProfileTabsIndicator?.();
    });
};

export const showExamScoreError = (inputEl, message) => {
    setFieldInvalid(inputEl, true);
    inputEl?.focus();
    showToast(message, "error");
};

export const handleAddExam = async (els, state) => {
    if (!els.addExamBtn || !els.examNameSelect || state.examValidationPending) return;
    motionPress(els.addExamBtn);
    const name = canonicalizeExamId(els.examNameSelect.value);
    const takenOn = String(els.examTakenOnInput?.value || "").trim();
    const mode = getExamInputMode(name);
    const selectedPayload = readSelectedExamPayload(name, els, state);
    const score = Number(selectedPayload?.score);

    const cfg = getExamConfig(name);
    if (cfg) {
        const min = (cfg.min !== undefined) ? Number(cfg.min) : null;
        const max = (cfg.max !== undefined) ? Number(cfg.max) : null;
        const step = (cfg.step !== undefined) ? Number(cfg.step) : null;
        const usesNumberInput = mode === "number"
            || (mode === "subject_breakdown"
                && String(breakdownSchemeFor(name)?.total_strategy || "").trim().toLowerCase() === "use_parent_score");

        if (usesNumberInput && Number.isFinite(min) && score < min) {
            showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_min", { exam: name, min }, `Min for ${name} is ${min}`));
            return;
        }
        if (usesNumberInput && Number.isFinite(max) && score > max) {
            showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_max", { exam: name, max }, `Max for ${name} is ${max}`));
            return;
        }

        if (usesNumberInput && Number.isFinite(step) && step > 0) {
            const base = Number.isFinite(min) ? min : 0;
            const k = (score - base) / step;
            const diff = Math.abs(k - Math.round(k));
            if (diff > 1e-9) {
                showExamScoreError(els.examScoreInput, tFormat("profile.exam_score_step", { exam: name, step }, `${name} score must use step ${step}`));
                return;
            }
        }
    }

    if (!name) {
        showToast(t("profile.exam_select_required", "Please select an exam"), "error");
        return;
    }
    if (takenOn && (takenOn > new Date().toISOString().slice(0, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(takenOn))) {
        reportInvalidDate(els.examTakenOnInput);
        return;
    }
    if (!selectedPayload) {
        return;
    }
    const compositeUsesParentScore = mode === "subject_breakdown"
        && String(breakdownSchemeFor(name)?.total_strategy || "").trim().toLowerCase() === "use_parent_score";

    if ((mode === "number" || compositeUsesParentScore) && Number.isNaN(score)) {
        showExamScoreError(els.examScoreInput, t("profile.exam_invalid_score", "Invalid score format"));
        return;
    }

    if ((mode === "number" || compositeUsesParentScore) && cfg?.type === "int" && !Number.isInteger(score)) {
        showExamScoreError(els.examScoreInput, tFormat("profile.exam_integer_required", { exam: name }, `${name} score must be an integer (e.g. 1400)`));
        return;
    }

    if ((mode === "number" || compositeUsesParentScore) && name === "IELTS" && (score % 0.5 !== 0)) {
        showExamScoreError(els.examScoreInput, t("profile.exam_ielts_step", "IELTS score must end with .0 or .5"));
        return;
    }

    const submittedDraftRevision = state.examDraftRevision;
    state.examValidationPending = true;
    els.addExamBtn.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/exams/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                exam: name,
                ...(takenOn ? { taken_on: takenOn } : {}),
                ...(selectedPayload.score !== undefined && Number.isFinite(Number(selectedPayload.score)) ? { score: selectedPayload.score } : {}),
                ...(selectedPayload.raw_value ? { raw_value: selectedPayload.raw_value } : {}),
                ...(selectedPayload.details ? { details: selectedPayload.details } : {}),
            }),
        });
        let json = {};
        try {
            json = await res.json();
        } catch (e) {
            json = {};
        }
        if (!res.ok) {
            const rawDetail = json && (json.detail || json.message || json.error);
            const code = String(
                typeof rawDetail === "string" && rawDetail.trim()
                    ? rawDetail
                    : (Array.isArray(rawDetail) ? "validation_error" : `http_${res.status}`)
            )
                .trim()
                .replace(/\s+/g, "_")
                .slice(0, 64);
            const err = new Error("exam_validate_failed");
            err.code = code || "unknown";
            err.detail = rawDetail;
            throw err;
        }

        const examId = canonicalizeExamId(json.exam ?? json.id ?? name);
        const examLabel = getExamDisplayName(examId || name, { locale: getCurrentLanguage() });
        const savedValue = formatExamValue(examId || name, json, { context: "profile", locale: getCurrentLanguage() });
        if (!Array.isArray(state.profile.exams)) state.profile.exams = [];
        const existingIndex = state.profile.exams.findIndex((e) =>
            canonicalizeExamId(e.exam ?? e.id ?? "") === examId
            && String(e.taken_on || "") === takenOn
        );

        const examRecord = {
            exam: examId,
            ...(json.taken_on ? { taken_on: json.taken_on } : {}),
            score: json.score,
            ...(json.raw_value ? { raw_value: json.raw_value } : {}),
            ...(json.display_value ? { display_value: json.display_value } : {}),
            ...(json.details ? { details: json.details } : {}),
        };

        if (existingIndex !== -1) {
            state.profile.exams[existingIndex] = {
                ...state.profile.exams[existingIndex],
                ...examRecord,
            };
            showToast(
                (mode !== "number")
                    ? tFormat("profile.exam_updated_value", { exam: examLabel, value: savedValue || examLabel }, `Updated ${examLabel}: ${savedValue || examLabel}`)
                    : tFormat("profile.exam_updated", { exam: examLabel, score: json.score }, `Updated ${examLabel} to ${json.score}`),
                "success"
            );
        } else {
            state.profile.exams.push(examRecord);
            showToast(
                savedValue
                    ? tFormat("profile.exam_added_value", { exam: examLabel, value: savedValue }, `Added ${examLabel}: ${savedValue}`)
                    : tFormat("profile.exam_added", { exam: examLabel }, `Added ${examLabel}`),
                "success"
            );
        }

        state.profile = ensureProfileShape(state.profile);
        refreshSaveState(els, state);
        renderProfileData(els, state);

        if (state.examDraftRevision === submittedDraftRevision) {
            setFieldInvalid(els.examScoreInput, false);
            els.examScoreInput.value = "";
            if (els.examTakenOnInput) els.examTakenOnInput.value = "";
            els.examNameSelect.value = "";
            syncExamScoreInputState(els, state);
            initCommonSelects(["examNameSelect"]);
        }
        refreshExamActionButton(els, state);
    } catch (e) {
        if (state.examDraftRevision === submittedDraftRevision) {
            showExamScoreError(els.examScoreInput, formatExamValidationToast(name, e?.detail || e?.message || e?.code || e?.name || "", getExamConfig));
        }
    } finally {
        state.examValidationPending = false;
        els.addExamBtn.disabled = false;
    }
};

export const handleExamListClick = (e, els, state) => {
    const editBtn = e.target instanceof Element ? e.target.closest("button[data-edit-idx]") : null;
    if (editBtn) {
        motionPress(editBtn);
        const idx = Number(editBtn.dataset.editIdx);
        const entry = state.profile.exams?.[idx];
        if (!entry) return;
        els.examNameSelect.value = canonicalizeExamId(entry.exam ?? entry.id ?? "");
        if (els.examTakenOnInput) els.examTakenOnInput.value = String(entry.taken_on || "");
        initCommonSelects(["examNameSelect"]);
        syncExamScoreInputState(els, state);
        refreshExamActionButton(els, state);
        els.examScoreInput?.focus();
        return;
    }
    const btn = e.target instanceof Element ? e.target.closest("button[data-idx]") : null;
    if (!btn) return;
    motionPress(btn);
    const idx = Number(btn.dataset.idx);
    if (!Number.isFinite(idx)) return;
    if (!Array.isArray(state.profile.exams)) state.profile.exams = [];

    const row = btn.closest(".profile-exam-item");
    animateElementOut(row, () => {
        state.profile.exams.splice(idx, 1);
        state.profile = ensureProfileShape(state.profile);
        refreshSaveState(els, state);
        renderProfileData(els, state);
        showToast(t("profile.exam_removed", "Exam removed"), "success");
    });
};

export const bindProfileEvents = (els, state) => {
    const globalListenerDisposers = [];
    const listenGlobal = (target, type, handler) => {
        target.addEventListener(type, handler);
        globalListenerDisposers.push(() => target.removeEventListener(type, handler));
    };
    let pendingNavigationPromise = null;
    let resolvePendingNavigation = null;
    const settleNavigationClose = (allowed) => {
        if (!resolvePendingNavigation) return;
        const resolve = resolvePendingNavigation;
        resolvePendingNavigation = null;
        pendingNavigationPromise = null;
        resolve(allowed);
    };
    const examForm = els.modal.querySelector(".profile-exam-form");
    const markExamDraftChanged = () => { state.examDraftRevision += 1; };
    examForm?.addEventListener("input", markExamDraftChanged);
    examForm?.addEventListener("change", markExamDraftChanged);
    els.profileSectionTabs.forEach((tab) => {
        tab.addEventListener("click", () => setProfileSection(els, state, tab.dataset.profileTab || "basics"));
    });
    setProfileSection(els, state, "basics");

    if (Object.keys(EXAM_CONFIG).length > 0) {
        populateExamSelect(els, state);
    }
    listenGlobal(window, "examConfigLoaded", () => populateExamSelect(els, state));

    if (els.examNameSelect) {
        els.examNameSelect.addEventListener("change", () => {
            syncExamScoreInputState(els, state);
            refreshExamActionButton(els, state);
        });
    }
    els.examTakenOnInput?.addEventListener("change", () => {
        refreshExamActionButton(els, state);
    });

    if (els.examSpecialInputContainer) {
        els.examSpecialInputContainer.addEventListener("change", (event) => {
            const target = event?.target;
            if (!(target instanceof Element)) return;
            if (!target.matches("[data-breakdown-subject-select]")) return;
            const selectedExam = canonicalizeExamId(els.examNameSelect?.value);
            if (getExamInputMode(selectedExam) !== "subject_breakdown") return;
            renderSpecialExamInput(selectedExam, els, state);
        });
    }

    if (els.profileMajorSelect) {
        els.profileMajorSelect.addEventListener("change", () => {
            state.profile.major = els.profileMajorSelect.value;
            refreshSaveState(els, state);
        });
    }

    if (els.studyModeSelect) {
        els.studyModeSelect.addEventListener("change", () => {
            state.profile.studyMode = String(els.studyModeSelect.value || "Any").trim() || "Any";
            refreshSaveState(els, state);
        });
    }

    if (els.profileFundingTypeSelect) {
        els.profileFundingTypeSelect.addEventListener("change", () => {
            state.profile.fundingType = normalizeFundingType(els.profileFundingTypeSelect.value);
            state.lowBudgetGrantHintDismissed = false;
            refreshSaveState(els, state);
        });
    }

    if (els.studyLevelSelect) {
        els.studyLevelSelect.addEventListener("change", () => {
            state.profile.studyLevel = String(els.studyLevelSelect.value || "Any").trim() || "Any";
            refreshSaveState(els, state);
        });
    }

    const contextControls = [
        els.countryOfEducationSelect,
        els.countryOfEducationOtherInput,
        els.educationCredentialSelect,
        els.educationCredentialOtherInput,
        els.applicantRouteSelect,
        els.intendedEntryCycleInput,
        els.currentResidenceCountrySelect,
        els.currentResidenceOtherInput,
        els.feeStatusContextSelect,
    ].filter(Boolean);
    for (const control of contextControls) {
        const eventName = control.tagName === "INPUT" ? "input" : "change";
        control.addEventListener(eventName, () => {
            syncApplicantContext(els, state.profile);
            syncOtherContextInput(els.countryOfEducationSelect, els.countryOfEducationOtherInput);
            syncOtherContextInput(els.educationCredentialSelect, els.educationCredentialOtherInput, "other");
            syncOtherContextInput(els.currentResidenceCountrySelect, els.currentResidenceOtherInput);
            refreshSaveState(els, state);
        });
    }

    if (els.citizenshipCountrySelect) {
        els.citizenshipCountrySelect.addEventListener("change", () => {
            if (els.citizenshipOtherInput) {
                els.citizenshipOtherInput.style.display = els.citizenshipCountrySelect.value === "OTHER" ? "inline-block" : "none";
                if (els.citizenshipCountrySelect.value === "OTHER") els.citizenshipOtherInput.focus();
            }
        });
    }

    if (els.addCitizenshipBtn) {
        els.addCitizenshipBtn.addEventListener("click", () => {
            let country = String(els.citizenshipCountrySelect?.value || "").trim();
            if (country === "OTHER") {
                country = String(els.citizenshipOtherInput?.value || "").trim();
            }
            if (!country) return;
            if (!Array.isArray(state.profile.citizenships)) state.profile.citizenships = [];
            const upper = country.toUpperCase();
            if (state.profile.citizenships.some((c) => String(c).toUpperCase() === upper)) return;
            if (state.profile.citizenships.length >= MAX_PROFILE_CITIZENSHIPS) {
                showToast(
                    tFormat("profile.citizenship.max_count", { count: MAX_PROFILE_CITIZENSHIPS }, `You can add up to ${MAX_PROFILE_CITIZENSHIPS} citizenships`),
                    "error",
                );
                return;
            }
            state.profile.citizenships.push(country);
            if (!state.profile.citizenship) state.profile.citizenship = country;
            renderCitizenshipChips(els, state);
            resetCitizenshipInputs(els);
            refreshSaveState(els, state);
        });
    }

    if (els.profileInterestsInput) {
        els.profileInterestsInput.addEventListener("input", () => {
            state.profile.interests = getInterestsDraft(els);
            refreshSaveState(els, state);
        });
        els.modal.querySelectorAll("[data-interest-chip]").forEach((chip) => {
            chip.addEventListener("click", () => {
                motionPress(chip);
                const text = String(chip.getAttribute("data-interest-chip") || "").trim();
                if (!text) return;
                const current = getInterestsDraft(els);
                els.profileInterestsInput.value = current ? `${current}, ${text}` : text;
                state.profile.interests = getInterestsDraft(els);
                refreshSaveState(els, state);
            });
        });
    }

    const handleEnterSave = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        saveAllProfileChanges(els, state);
    };

    if (els.budgetInput) {
        els.budgetInput.addEventListener("input", () => {
            setFieldInvalid(els.budgetInput, false);
            state.profile.budget = String(els.budgetInput.value || "").trim();
            state.lowBudgetGrantHintDismissed = false;
            refreshSaveState(els, state);
        });
        els.budgetInput.addEventListener("keydown", handleEnterSave);
    }

    if (els.familyIncomeInput) {
        els.familyIncomeInput.addEventListener("input", () => {
            setFieldInvalid(els.familyIncomeInput, false);
            state.profile.familyIncomeAmount = String(els.familyIncomeInput.value || "").trim().replace(/,/g, ".");
            refreshSaveState(els, state);
        });
        els.familyIncomeInput.addEventListener("keydown", handleEnterSave);
    }

    if (els.familyIncomeCurrencySelect) {
        els.familyIncomeCurrencySelect.addEventListener("change", () => {
            state.profile.familyIncomeCurrency = String(els.familyIncomeCurrencySelect.value || getBudgetCurrency()).toUpperCase();
            refreshSaveState(els, state);
        });
    }

    els.lowBudgetGrantDismissBtn?.addEventListener("click", () => {
        motionPress(els.lowBudgetGrantDismissBtn);
        state.lowBudgetGrantHintDismissed = true;
        renderLowBudgetGrantHint(els, state);
    });

    els.lowBudgetGrantApplyBtn?.addEventListener("click", () => {
        motionPress(els.lowBudgetGrantApplyBtn);
        if (!els.profileFundingTypeSelect) return;
        state.lowBudgetGrantHintDismissed = true;
        els.profileFundingTypeSelect.value = "grant";
        initCommonSelects(["profileFundingTypeSelect"]);
        els.profileFundingTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (els.gpaInput) {
        els.gpaInput.addEventListener("input", () => {
            enforceGpaMaxLength(els.gpaInput);
            setFieldInvalid(els.gpaInput, false);
            state.profile.gpa = normalizeGpaRaw(els.gpaInput.value || "");
            refreshSaveState(els, state);
        });
        els.gpaInput.addEventListener("keydown", handleEnterSave);
    }

    els.gpaUnit?.addEventListener("click", () => {
        motionPress(els.gpaUnit);
        setGpaScale(els, state, Number(state.profile.gpaScale) === 5 ? 4 : 5);
    });

    if (els.saveProfileBtn) {
        els.saveProfileBtn.addEventListener("click", () => {
            motionPress(els.saveProfileBtn);
            if (saveAllProfileChanges(els, state) && hasUniversitiesTourResumeStep()) closeImmediately(els, state);
        });
    }

    els.resetProfileBtn?.addEventListener("click", () => {
        motionPress(els.resetProfileBtn);
        syncInputsToDraft(els, state);
        openResetDialog(els, state);
    });

    const openProfileHandler = () => openProfile(els, state);
    const requestCloseHandler = () => requestClose(els, state);
    if (els.openBtn) els.openBtn.onclick = openProfileHandler;

    if (els.closeBtn) els.closeBtn.onclick = requestCloseHandler;
    if (els.backdrop) els.backdrop.onclick = requestCloseHandler;

    els.discardBtn?.addEventListener("click", () => {
        motionPress(els.discardBtn);
        if (pendingNavigationPromise) {
            state.isDiscarding = false;
            resetFields(els, state);
            closeUnsavedDialog(els, state, false);
            settleNavigationClose(true);
            return;
        }
        closeImmediately(els, state);
    });
    els.cancelCloseBtn?.addEventListener("click", () => {
        motionPress(els.cancelCloseBtn);
        closeUnsavedDialog(els, state, true);
        settleNavigationClose(false);
    });
    els.saveAndCloseBtn?.addEventListener("click", () => {
        motionPress(els.saveAndCloseBtn);
        syncInputsToDraft(els, state);
        if (isProfileDirty(state) && !saveAllProfileChanges(els, state)) {
            closeUnsavedDialog(els, state, true);
            settleNavigationClose(false);
            return;
        }
        if (pendingNavigationPromise) {
            closeUnsavedDialog(els, state, false);
            settleNavigationClose(true);
            return;
        }
        closeImmediately(els, state);
    });
    els.unsavedBackdrop?.addEventListener("click", () => {
        closeUnsavedDialog(els, state, true);
        settleNavigationClose(false);
    });
    els.resetBackdrop?.addEventListener("click", () => {
        closeResetDialog(els, state, true);
    });
    els.resetCancelBtn?.addEventListener("click", () => {
        motionPress(els.resetCancelBtn);
        closeResetDialog(els, state, true);
    });
    els.resetConfirmBtn?.addEventListener("click", () => {
        motionPress(els.resetConfirmBtn);
        resetProfileData(els, state);
    });

    const handleProfileKeydown = (e) => {
        if (e.key !== "Escape") return;
        if (els.resetModal?.classList.contains("is-open")) {
            closeResetDialog(els, state, true);
            return;
        }
        if (els.unsavedModal?.classList.contains("is-open")) {
            closeUnsavedDialog(els, state, true);
            settleNavigationClose(false);
            return;
        }
        requestClose(els, state);
    };
    listenGlobal(document, "keydown", handleProfileKeydown);

    const handleLanguageChanged = () => {
        retranslateProfileUi(els, state);
    };
    listenGlobal(window, "languageChanged", handleLanguageChanged);

    const handleCurrencyChanged = () => {
        const activeCurrency = getBudgetCurrency();
        if (els.familyIncomeInput && !String(els.familyIncomeInput.value || "").trim() && els.familyIncomeCurrencySelect) {
            els.familyIncomeCurrencySelect.value = activeCurrency;
            state.profile.familyIncomeCurrency = activeCurrency;
        }
        const prevCurrency = state.profile.budgetCurrency || "USD";
        if (prevCurrency !== activeCurrency) {
            const rawBudget = els.budgetInput ? els.budgetInput.value.trim() : String(state.profile.budget ?? "").trim();
            if (rawBudget && !rawBudget.includes(".") && !rawBudget.includes(",")) {
                const val = Number(rawBudget);
                if (Number.isFinite(val) && val >= 0) {
                    const converted = Math.round(convert(val, prevCurrency, activeCurrency));
                    state.profile.budget = converted;
                    if (els.budgetInput) els.budgetInput.value = String(converted);
                }
            }
            state.profile.budgetCurrency = activeCurrency;
            if (state.savedSignature) {
                state.profileStoragePersistent = saveProfile(state.profile);
                state.savedSignature = stableProfileSignature(state.profile);
            }
        }
        updateBudgetUI(els, state);
        refreshSaveState(els, state);
    };
    listenGlobal(window, "currencyChanged", handleCurrencyChanged);

    if (els.examScoreInput) {
        els.examScoreInput.addEventListener("input", () => {
            setFieldInvalid(els.examScoreInput, false);
        });
    }

    if (els.addExamBtn) {
        els.addExamBtn.onclick = () => handleAddExam(els, state);
    }

    if (els.examList) {
        els.examList.onclick = (e) => handleExamListClick(e, els, state);
    }

    const hasUnsavedChanges = () => {
        if (state.isDiscarding) return false;
        if (!state.isDedicatedPage && !els.modal.classList.contains("is-open")) return false;
        syncInputsToDraft(els, state);
        return isProfileDirty(state);
    };
    const requestNavigationClose = () => {
        if (!hasUnsavedChanges()) return true;
        if (pendingNavigationPromise) return pendingNavigationPromise;
        pendingNavigationPromise = new Promise((resolve) => {
            resolvePendingNavigation = resolve;
        });
        openUnsavedDialog(els, state);
        return pendingNavigationPromise;
    };
    activeProfileNavigationClose = requestNavigationClose;
    const handleBeforeUnload = (event) => {
        if (!hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = "";
        return "";
    };
    listenGlobal(window, "beforeunload", handleBeforeUnload);
    return () => {
        settleNavigationClose(false);
        globalListenerDisposers.splice(0).forEach((dispose) => dispose());
        if (activeProfileNavigationClose === requestNavigationClose) activeProfileNavigationClose = null;
        if (els.openBtn?.onclick === openProfileHandler) els.openBtn.onclick = null;
        if (els.closeBtn?.onclick === requestCloseHandler) els.closeBtn.onclick = null;
        if (els.backdrop?.onclick === requestCloseHandler) els.backdrop.onclick = null;
        if (els.addExamBtn?.onclick) els.addExamBtn.onclick = null;
        if (els.examList?.onclick) els.examList.onclick = null;
    };
};

export function initProfileUI() {
    const modal = document.getElementById("profileModal");
    if (!modal) {
        console.error("initProfileUI: profile modal is missing");
        return () => {};
    }

    if (modal.dataset.bound === "1") return () => {};
    modal.dataset.bound = "1";

    const isDedicatedPage = Boolean(
        document.body.dataset.page === "profile" ||
        isProfilePath(window.location.pathname) ||
        document.getElementById("profilePage")
    );

    if (!isDedicatedPage) {
        modal.setAttribute("aria-hidden", "true");
    } else {
        modal.removeAttribute("aria-hidden");
    }

    hydrateHeroIcons(modal);
    bindInfoTooltips({ root: modal, wrapSelector: ".profile-info-wrap", buttonSelector: ".profile-info" });

    const els = queryProfileElements(modal);
    const updateProfileTabsIndicator = setupSlidingIndicator(".profile-section-tabs", ".profile-section-tab", "is-active");

    const state = {
        isDedicatedPage,
        modal,
        profile: ensureProfileShape(loadProfile()),
        savedSignature: "",
        profileStoragePersistent: true,
        lowBudgetGrantHintDismissed: false,
        isDiscarding: false,
        cleanupFocusTrap: null,
        cleanupUnsavedFocusTrap: null,
        cleanupResetFocusTrap: null,
        updateProfileTabsIndicator,
        examValidationPending: false,
        examDraftRevision: 0,
    };
    state.profileStoragePersistent = !isFutureProfile(state.profile);

    window.__unisearchProfileDraft = {
        isActive: () => isDedicatedPage || modal.classList.contains("is-open"),
        get: () => cloneProfile(state.profile),
        set: (nextProfile) => {
            setProfileDraft(state, els, nextProfile);
        },
    };

    populateMajors(els.profileMajorSelect);
    const disposeEvents = bindProfileEvents(els, state);

    if (isDedicatedPage) {
        openProfile(els, state);
    } else {
        resetFields(els, state);
    }
    return () => {
        disposeEvents();
        if (modal.dataset.bound === "1") delete modal.dataset.bound;
    };
}
