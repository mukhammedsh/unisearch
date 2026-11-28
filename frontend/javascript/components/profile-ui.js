import {
  EXAM_CONFIG,
  MAJOR_OPTIONS,
  bindDialogLightDismiss,
  canonicalizeExamId,
  clearProfile,
  escapeHtml,
  getExamInputMode,
  isFutureProfile,
  loadFilters,
  loadProfile,
  motionPress,
  replayMotion,
  saveFilters,
  saveProfile,
  showToast,
  trapFocus,
} from "../utils.js";
import { applyTranslations, t } from "../i18n.js";
import { translateProgramName } from "../university-translations.js";
import { bindInfoTooltips } from "../tooltip.js";
import { hydrateHeroIcons } from "../icons.js";
import { isProfilePath, isUniversitiesListPath } from "../routes.js";
import { bindProfileSections } from "./profile/profile-sections.js";
import { renderAdmissionEvidence } from "./profile/admission-evidence.js";
import { applyBudgetCurrencyChoice, reinterpretBudgetCurrency } from "./profile/budget-currency.js";
import {
  applyBudgetEntry,
  budgetInCurrency,
  cloneProfile,
  enforceGpaMaxLength,
  ensureProfileShape,
  getBudgetCurrency,
  hasProfileForRanking,
  normalizeAmountRaw,
  normalizeFundingType,
  normalizeGpaRaw,
  setFieldInvalid,
  stableProfileSignature,
} from "./profile/profile-utils.js";
import {
  getProfileReturnUrl,
  closeDialogWithMotion,
  closeImmediately,
  closeResetDialog,
  closeUnsavedDialog,
  openResetDialog,
  openUnsavedDialog,
  profileValidationFocusTarget,
  requestClose,
} from "./profile/profile-dialogs.js";
import {
  getInterestsDraft,
  initCommonSelects,
  isProfileDirty,
  refreshSaveState,
  renderGpaHint,
  renderLowBudgetGrantHint,
  renderProfileSummary,
  setGpaScale,
  syncInputsToDraft,
  updateBudgetUI,
  updateGpaScaleUI,
  validateBudgetInput,
  validateGpaInput,
} from "./profile/profile-form-fields.js";
import {
  LANGUAGE_EXAM_PREFIX,
  examDraftControls,
  findExistingExamEntry,
  handleAddExam,
  handleExamListClick,
  populateExamSelect,
  readSelectedExamPayload,
  refreshExamActionButton,
  renderProfileData,
  renderSpecialExamInput,
  syncExamScoreInputState,
} from "./profile/profile-exam-editor.js";

export {
  readSelectedExamPayload,
  profileValidationFocusTarget,
  closeDialogWithMotion,
  closeUnsavedDialog,
  closeResetDialog,
  openUnsavedDialog,
  openResetDialog,
};

let activeProfileNavigationClose = null;

export function requestProfileNavigationClose() {
    return activeProfileNavigationClose ? activeProfileNavigationClose() : true;
}

const queryProfileElements = (modal) => {
    const unsavedModal = document.getElementById("profileUnsavedModal");
    const resetModal = document.getElementById("profileResetModal");
    const budgetInput = document.getElementById("budgetInput");

    return {
        modal,
        unsavedModal,
        unsavedCard: unsavedModal?.querySelector(".profile-confirm-card"),
        discardBtn: document.getElementById("profileDiscardBtn"),
        cancelCloseBtn: document.getElementById("profileCancelCloseBtn"),
        saveAndCloseBtn: document.getElementById("profileSaveAndCloseBtn"),
        resetModal,
        resetCard: resetModal?.querySelector(".profile-confirm-card"),
        resetCancelBtn: document.getElementById("profileResetCancelBtn"),
        resetConfirmBtn: document.getElementById("profileResetConfirmBtn"),
        openBtn: document.getElementById("profileBtn"),
        closeBtn: document.getElementById("profileCloseBtn"),
        sectionBackBtn: document.getElementById("profileSectionBackBtn"),
        backdrop: modal.querySelector(".profile-backdrop"),
        budgetInput,
        profileBudgetUnit: document.getElementById("profileBudgetUnit"),
        profileBudgetCurrency: document.getElementById("profileBudgetCurrency"),
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
        clearExamDraftBtn: document.getElementById("clearExamDraftBtn"),
        examList: document.getElementById("examList"),
        profileMajorSelect: document.getElementById("profileMajorSelect"),
        profileInterestsInput: document.getElementById("profileInterestsInput"),
        saveProfileBtn: document.getElementById("saveProfileBtn"),
        resetProfileBtn: document.getElementById("resetProfileBtn"),
        profileSaveState: document.getElementById("profileSaveState"),
        studyLevelSelect: document.getElementById("studyLevelSelect"),
        profileStorageNote: document.getElementById("profileStorageNote"),
        profileSectionTabs: Array.from(modal.querySelectorAll(".profile-section-tab")),
        profileSectionNodes: Array.from(modal.querySelectorAll("[data-profile-section]")),
    };
};

const setProfileDraft = (state, els, next, options = {}) => {
    state.profile = ensureProfileShape(next);
    if (options.markAsSaved) {
        state.savedSignature = stableProfileSignature(state.profile);
        state.savedProfile = cloneProfile(state.profile);
        state.showSavedStatus = false;
    }
    refreshSaveState(els, state);
};

const populateMajors = (select) => {
    if (!select) return;
    select.innerHTML = `<option value="">${escapeHtml(t("profile.option.major_any", "Undecided / Any"))}</option>`;
    MAJOR_OPTIONS.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = translateProgramName(m, m);
        select.appendChild(opt);
    });
};

const applyDraftToInputs = (els, state, { preserveExam = false } = {}) => {
    setFieldInvalid(els.budgetInput, false);
    setFieldInvalid(els.gpaInput, false);
    setFieldInvalid(els.examScoreInput, false);

    state.budgetInputCurrency = getBudgetCurrency();
    if (els.budgetInput) els.budgetInput.value = String(budgetInCurrency(state.profile, state.budgetInputCurrency));
    updateGpaScaleUI(els, state, Number(state.profile.gpaScale) === 5 ? 5 : 4);
    if (els.gpaInput) els.gpaInput.value = state.profile.gpa === "" ? "" : String(state.profile.gpa);
    if (els.studyModeSelect) els.studyModeSelect.value = state.profile.studyMode || "Any";
    if (els.profileFundingTypeSelect) els.profileFundingTypeSelect.value = normalizeFundingType(state.profile.fundingType);
    if (els.profileMajorSelect) els.profileMajorSelect.value = state.profile.major || "";
    if (els.profileInterestsInput) els.profileInterestsInput.value = state.profile.interests || "";
    if (els.studyLevelSelect) els.studyLevelSelect.value = state.profile.studyLevel || "Any";
    renderAdmissionEvidence(els.admissionEvidenceFields, state.profile, (next) => {
        state.profile = ensureProfileShape({
            ...state.profile,
            languageEvidence: next.languageEvidence,
            institutionalEvidence: next.institutionalEvidence,
        });
        refreshSaveState(els, state);
    });
    applyTranslations(els.admissionEvidenceFields);
    if (!preserveExam) {
        state.editorResetRevision += 1;
        state.examEditorDirty = state.languageEditorDirty = false;
        window.dispatchEvent(new Event("profileReportDraftReset"));
        if (els.examNameSelect) els.examNameSelect.value = "";
        if (els.examScoreInput) els.examScoreInput.value = "";
        if (els.examTakenOnInput) {
            els.examTakenOnInput.value = "";
            els.examTakenOnInput.max = new Date().toISOString().slice(0, 10);
        }
        if (els.examSpecialInputContainer) {
            els.examSpecialInputContainer.replaceChildren();
            els.examSpecialInputContainer.style.display = "none";
            delete els.examSpecialInputContainer.dataset.breakdownExam;
        }
    }
    initCommonSelects([
        "studyModeSelect",
        "profileFundingTypeSelect",
        "profileMajorSelect",
        "examNameSelect",
        "studyLevelSelect",
    ]);
    renderProfileData(els, state);
    updateBudgetUI(els, state);
    refreshSaveState(els, state);
};

const resetFields = (els, state) => {
    state.gpaScaleAutoSwitched = false;
    const savedProfile = ensureProfileShape(loadProfile());
    setProfileDraft(state, els, savedProfile, { markAsSaved: true });
    applyDraftToInputs(els, state);
};

const saveAllProfileChanges = (els, state) => {
    if (state.examEditorDirty || state.languageEditorDirty) {
        state.showSection(state.examEditorDirty ? "scores" : "languages", { focusHeading: false });
        (state.examEditorDirty ? els.addExamBtn : document.getElementById("langAddBtn"))?.focus();
        showToast(t("profile.report_draft_pending"), "error");
        return false;
    }
    syncInputsToDraft(els, state);

    const budgetCheck = validateBudgetInput(els);
    if (!budgetCheck.ok) {
        state.showSection("preferences", { focusHeading: false });
        els.budgetInput?.focus();
        return false;
    }
    const gpaCheck = validateGpaInput(els, state);
    if (!gpaCheck.ok) {
        state.showSection("scores", { focusHeading: false });
        els.gpaInput?.focus();
        return false;
    }

    state.profile = applyBudgetEntry(state.profile, budgetCheck.value, state.budgetInputCurrency || getBudgetCurrency());
    // A draft keeps the typed text; the saved profile stores the budget as a whole number, as before.
    if (/^\d+$/.test(String(state.profile.budget))) state.profile.budget = Number(state.profile.budget);
    state.profile.gpa = gpaCheck.value;
    state.profile.gpaScale = Number(state.profile.gpaScale) === 5 ? 5 : 4;
    state.profile.interests = getInterestsDraft(els);
    state.profile.studyMode = String(els.studyModeSelect?.value || state.profile.studyMode || "Any").trim() || "Any";
    state.profile.fundingType = normalizeFundingType(els.profileFundingTypeSelect?.value || state.profile.fundingType || "any");
    state.profile.major = String(els.profileMajorSelect?.value || state.profile.major || "").trim();
    state.profile.studyLevel = String(els.studyLevelSelect?.value || state.profile.studyLevel || "Any").trim() || "Any";
    state.profile = ensureProfileShape(state.profile);

    if (els.budgetInput) els.budgetInput.value = String(budgetInCurrency(state.profile, state.budgetInputCurrency || getBudgetCurrency()));
    if (els.gpaInput) els.gpaInput.value = state.profile.gpa === "" ? "" : String(state.profile.gpa);

    const hadRankingProfile = hasProfileForRanking(loadProfile());
    state.profileStoragePersistent = saveProfile(state.profile);
    if (!hadRankingProfile && hasProfileForRanking(state.profile)) {
        const savedFilters = loadFilters();
        if (savedFilters && savedFilters.sort === "name_asc") {
            saveFilters({ ...savedFilters, sort: "uni_ai" });
        }
    }
    state.savedSignature = stableProfileSignature(state.profile);
    state.savedProfile = cloneProfile(state.profile);
    state.showSavedStatus = true;
    refreshSaveState(els, state);
    replayMotion(els.profileSaveState, "motion-state-pulse", { timeoutMs: 520 });
    replayMotion(els.saveProfileBtn, "motion-state-pulse", { timeoutMs: 520 });

    return true;
};

const resetProfileData = (els, state) => {
    state.lowBudgetGrantHintDismissed = false;
    state.profileStoragePersistent = clearProfile();
    const emptyProfile = ensureProfileShape({});
    setProfileDraft(state, els, emptyProfile, { markAsSaved: true });
    applyDraftToInputs(els, state);
    renderLowBudgetGrantHint(els, state);
    closeResetDialog(els, state, false);
    window.dispatchEvent(new Event("profileUpdated"));
    showToast(t("profile.reset.done", "Profile data reset"), "success");
};

const retranslateProfileUi = (els, state) => {
    const selectedExam = els.examNameSelect ? String(els.examNameSelect.value || "") : "";
    const examValues = examDraftControls(els).map(control => control.value);
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
    applyDraftToInputs(els, state, { preserveExam: true });
    examDraftControls(els).forEach((control, index) => { if (examValues[index] !== undefined) control.value = examValues[index]; });
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

const openProfile = (els, state) => {
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
    renderProfileSummary(els, state);
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
};

const bindProfileEvents = (els, state) => {
    const globalListenerDisposers = [];
    const listenGlobal = (target, type, handler) => {
        target.addEventListener(type, handler);
        globalListenerDisposers.push(() => target.removeEventListener(type, handler));
    };
    let pendingNavigationPromise = null;
    let resolvePendingNavigation = null;
    const settleNavigationClose = (allowed) => {
        if (!resolvePendingNavigation) return;
        if (allowed && els.unsavedModal?.open && els.unsavedModal.classList.contains("is-closing")) {
            els.unsavedModal.addEventListener("close", () => settleNavigationClose(true), { once: true });
            return;
        }
        const resolve = resolvePendingNavigation;
        resolvePendingNavigation = null;
        pendingNavigationPromise = null;
        resolve(allowed);
    };
    const closeCallbacks = {
        syncInputsToDraft: () => syncInputsToDraft(els, state),
        refreshSaveState: () => refreshSaveState(els, state),
        onResetFields: () => resetFields(els, state),
    };
    const closeModalNow = () => closeImmediately(els, state, { onResetFields: () => resetFields(els, state) });
    const examForm = els.modal.querySelector(".profile-exam-form");
    const markExamDraftChanged = event => {
        state.examDraftRevision += 1;
        if (event.target !== els.examNameSelect) {
            state.examEditorDirty = !!els.examNameSelect?.value && examDraftControls(els).some(control => String(control.value || "").trim());
        }
        if (event.target?.matches("[data-breakdown-value]")) setFieldInvalid(event.target, false);
        refreshSaveState(els, state);
    };
    examForm?.addEventListener("input", markExamDraftChanged);
    examForm?.addEventListener("change", markExamDraftChanged);
    examForm?.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.defaultPrevented || event.repeat || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.target.closest(".custom-select-wrapper.open, button")) return;
        event.preventDefault();
        void handleAddExam(els, state);
    });
    if (Object.keys(EXAM_CONFIG).length > 0) {
        populateExamSelect(els, state);
    }
    listenGlobal(window, "examConfigLoaded", () => populateExamSelect(els, state));

    if (els.examNameSelect) {
        els.examNameSelect.addEventListener("change", () => {
            const value = String(els.examNameSelect.value || "");
            if (value.startsWith(LANGUAGE_EXAM_PREFIX)) {
                els.examNameSelect.value = "";
                initCommonSelects(["examNameSelect"]);
                void state.navigateSection("languages").then((opened) => {
                    if (opened) window.dispatchEvent(new CustomEvent("unisearch:open-language-exam", { detail: { exam: value.slice(LANGUAGE_EXAM_PREFIX.length) } }));
                });
                return;
            }
            syncExamScoreInputState(els, state);
            // Values restored from an already added report are not an unfinished draft.
            state.examEditorDirty = !!els.examNameSelect.value
                && !findExistingExamEntry(els.examNameSelect.value, els, state)
                && examDraftControls(els).some(control => String(control.value || "").trim());
            refreshExamActionButton(els, state);
            refreshSaveState(els, state);
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
        if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        saveAllProfileChanges(els, state);
    };

    if (els.budgetInput) {
        els.budgetInput.addEventListener("input", () => {
            setFieldInvalid(els.budgetInput, false);
            state.profile.budget = normalizeAmountRaw(els.budgetInput.value);
            state.lowBudgetGrantHintDismissed = false;
            refreshSaveState(els, state);
        });
        els.budgetInput.addEventListener("keydown", handleEnterSave);
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
            // A grade above 4 cannot be on the 4.0 scale; a 4–5 grade is a Kazakhstan/CIS five-point grade, so the scale follows it.
            const value = Number(state.profile.gpa);
            if (Number(state.profile.gpaScale) !== 5 && Number.isFinite(value) && value > 4 && value <= 5) {
                state.gpaScaleAutoSwitched = true;
                setGpaScale(els, state, 5);
            }
            renderGpaHint(els, state);
            refreshSaveState(els, state);
        });
        els.gpaInput.addEventListener("keydown", handleEnterSave);
    }

    // The radio options choose the scale shown next to the GPA input.
    document.querySelectorAll('#gpaScaleChoice input[name="gpaScale"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            if (!radio.checked) return;
            state.gpaScaleAutoSwitched = false;
            setGpaScale(els, state, Number(radio.value) === 5 ? 5 : 4);
        });
    });

    els.profileBudgetCurrency?.addEventListener("change", () => {
        // The select is the unit of the typed number: keep the number and read it in the chosen currency.
        const code = String(els.profileBudgetCurrency.value || "").trim().toUpperCase();
        if (els.budgetInput && code) {
            state.profile = reinterpretBudgetCurrency(state.profile, els.budgetInput.value, code);
            state.budgetInputCurrency = code;
        }
        applyBudgetCurrencyChoice(els.profileBudgetCurrency);
    });
    els.clearExamDraftBtn?.addEventListener("click", () => {
        if (state.examValidationPending) return;
        els.examNameSelect.value = "";
        els.examScoreInput.value = "";
        if (els.examTakenOnInput) els.examTakenOnInput.value = "";
        state.examEditorDirty = false;
        state.examDraftRevision += 1;
        syncExamScoreInputState(els, state);
        initCommonSelects(["examNameSelect"]);
        refreshExamActionButton(els, state);
        refreshSaveState(els, state);
    });

    if (els.saveProfileBtn) {
        els.saveProfileBtn.addEventListener("click", () => {
            motionPress(els.saveProfileBtn);
            if (saveAllProfileChanges(els, state)) els.profileSaveState?.focus({ preventScroll: true });
        });
    }

    els.resetProfileBtn?.addEventListener("click", () => {
        motionPress(els.resetProfileBtn);
        openResetDialog(els, state, { onResetProfileData: () => resetProfileData(els, state) });
    });

    const openProfileHandler = () => openProfile(els, state);
    const requestCloseHandler = () => requestClose(els, state, closeCallbacks);
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
        closeModalNow();
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
            closeUnsavedDialog(els, state, false, profileValidationFocusTarget(els, state));
            settleNavigationClose(false);
            return;
        }
        if (pendingNavigationPromise) {
            closeUnsavedDialog(els, state, false);
            settleNavigationClose(true);
            return;
        }
        closeModalNow();
    });
    bindDialogLightDismiss(els.unsavedModal, els.unsavedCard, () => {
        closeUnsavedDialog(els, state, true);
        settleNavigationClose(false);
    });
    bindDialogLightDismiss(els.resetModal, els.resetCard, () => {
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
    };
    listenGlobal(document, "keydown", handleProfileKeydown);

    const handleLanguageChanged = () => {
        retranslateProfileUi(els, state);
    };
    listenGlobal(window, "languageChanged", handleLanguageChanged);

    // The field follows the display currency, while the stored budget keeps the amount and currency it was entered in.
    const handleCurrencyChanged = () => {
        const activeCurrency = getBudgetCurrency();
        if (els.budgetInput) {
            const typed = normalizeAmountRaw(els.budgetInput.value);
            // A typed edit belongs to the currency the field showed when it was typed.
            if (/^\d*$/.test(typed)) state.profile = applyBudgetEntry(state.profile, typed, state.budgetInputCurrency || activeCurrency);
            state.budgetInputCurrency = activeCurrency;
            els.budgetInput.value = String(budgetInCurrency(state.profile, activeCurrency));
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
        const deferred = Promise.withResolvers();
        pendingNavigationPromise = deferred.promise;
        resolvePendingNavigation = deferred.resolve;
        openUnsavedDialog(els, state);
        return pendingNavigationPromise;
    };
    activeProfileNavigationClose = requestNavigationClose;
    Object.assign(state, bindProfileSections(els, {
        requestNavigationClose,
        listen: listenGlobal,
        onSectionChange: () => {
            state.showSavedStatus = false;
            refreshSaveState(els, state);
        },
    }));
    const handleBeforeUnload = (event) => {
        if (!hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = "";
        return "";
    };
    listenGlobal(window, "beforeunload", handleBeforeUnload);
    return () => {
        state.disposed = true;
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
    const returnUrl = getProfileReturnUrl();
    if (els.closeBtn && returnUrl) {
        const fromCatalog = isUniversitiesListPath(returnUrl.pathname);
        els.closeBtn.dataset.i18n = fromCatalog ? "profile.overview.results" : "profile.action.back";
    }

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
        examValidationPending: false,
        examDraftRevision: 0,
        editorResetRevision: 0,
        examEditorDirty: false,
        languageEditorDirty: false,
        disposed: false,
    };
    state.profileStoragePersistent = !isFutureProfile(state.profile);

    window.__unisearchProfileDraft = {
        isActive: () => isDedicatedPage || modal.classList.contains("is-open"),
        get: () => cloneProfile(state.profile),
        set: (nextProfile) => {
            setProfileDraft(state, els, nextProfile);
        },
        setLanguageEditorDirty: (dirty) => {
            state.languageEditorDirty = dirty;
            refreshSaveState(els, state);
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
