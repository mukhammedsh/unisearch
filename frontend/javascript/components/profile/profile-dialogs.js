import { prefersReducedMotion, trapFocus } from "../../utils.js";
import { safeSessionStorage } from "../../utils/safe-storage.js";
import { t } from "../../i18n.js";
import { isProfilePath, navigateToAppRoute, routeUniversities } from "../../routes.js";
import { isProfileEditorHistoryEntry } from "./profile-sections.js";

export const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";

export const getProfileReturnUrl = () => {
    const candidates = [safeSessionStorage.get(PROFILE_RETURN_URL_KEY, ""), document.referrer];
    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            const url = new URL(candidate, window.location.href);
            if (url.origin === window.location.origin && !isProfilePath(url.pathname)) return url;
        } catch (error) {
            if (!(error instanceof TypeError)) throw error;
        }
    }
    return null;
};

export const profileValidationFocusTarget = (els, state) => {
    if (state.examEditorDirty) return els.addExamBtn || null;
    if (state.languageEditorDirty) return document.getElementById("langAddBtn");
    if (els.budgetInput?.getAttribute("aria-invalid") === "true") return els.budgetInput;
    if (els.gpaInput?.getAttribute("aria-invalid") === "true") return els.gpaInput;
    return null;
};

export const closeDialogWithMotion = (modal, focusTrapCleanup, focusTargetOnClose) => {
    if (!modal || modal.classList.contains("is-closing")) return;
    window.clearTimeout(modal._closeMotionTimer);
    const isNativeDialog = typeof modal.close === "function";
    const finish = () => {
        modal._closeMotionTimer = null;
        focusTrapCleanup?.();
        modal.classList.remove("is-open", "is-closing");
        if (isNativeDialog) {
            if (modal.open) modal.close();
        } else {
            modal.setAttribute("aria-hidden", "true");
            modal.style.display = "none";
        }
        if (focusTargetOnClose) focusTargetOnClose.focus();
    };
    if (prefersReducedMotion() || !modal.classList.contains("is-open")) {
        finish();
        return;
    }
    modal.classList.add("is-closing");
    modal._closeMotionTimer = window.setTimeout(finish, 180);
};

export const closeUnsavedDialog = (els, state, focusCloseButton = false, focusTarget = null) => {
    if (!els.unsavedModal) return;
    closeDialogWithMotion(els.unsavedModal, () => {
        state.cleanupUnsavedFocusTrap?.();
        state.cleanupUnsavedFocusTrap = null;
    }, focusTarget || (focusCloseButton ? state.unsavedTrigger || els.closeBtn : null));
};

export const closeResetDialog = (els, state, focusResetButton = false) => {
    if (!els.resetModal) return;
    closeDialogWithMotion(els.resetModal, () => {
        state.cleanupResetFocusTrap?.();
        state.cleanupResetFocusTrap = null;
    }, focusResetButton ? els.resetProfileBtn : null);
};

export const closeImmediately = (els, state, { onResetFields } = {}) => {
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
            const returnUrl = getProfileReturnUrl();
            safeSessionStorage.remove(PROFILE_RETURN_URL_KEY);
            if (returnUrl) {
                const backSteps = isProfileEditorHistoryEntry() ? 2 : 1;
                if (window.history.length > backSteps) {
                    window.history.go(-backSteps);
                } else {
                    navigateToAppRoute(returnUrl.href);
                }
            } else {
                navigateToAppRoute(routeUniversities());
            }
            return;
        }
        els.modal.classList.remove("is-open", "is-closing");
        els.modal.style.display = "none";
        els.modal.setAttribute("aria-hidden", "true");
        if (els.openBtn) els.openBtn.focus();
        onResetFields?.();
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
    if (!els.unsavedModal.classList.contains("is-open")) state.unsavedTrigger = document.activeElement;
    window.clearTimeout(els.unsavedModal._closeMotionTimer);
    els.unsavedModal.classList.remove("is-closing");
    els.unsavedModal.classList.add("is-open");
    if (typeof els.unsavedModal.showModal === "function") {
        if (!els.unsavedModal.open) els.unsavedModal.showModal();
    } else {
        els.unsavedModal.style.display = "flex";
        els.unsavedModal.setAttribute("aria-hidden", "false");
        state.cleanupUnsavedFocusTrap?.();
        state.cleanupUnsavedFocusTrap = trapFocus(els.unsavedModal);
    }
    els.cancelCloseBtn?.focus();
};

export const openResetDialog = (els, state, { onResetProfileData } = {}) => {
    if (!els.resetModal) {
        if (window.confirm(t("profile.reset.confirm_message", "This will remove all saved profile data on this device and set the profile back to empty values."))) {
            onResetProfileData?.();
        }
        return;
    }
    window.clearTimeout(els.resetModal._closeMotionTimer);
    els.resetModal.classList.remove("is-closing");
    els.resetModal.classList.add("is-open");
    if (typeof els.resetModal.showModal === "function") {
        if (!els.resetModal.open) els.resetModal.showModal();
    } else {
        els.resetModal.style.display = "flex";
        els.resetModal.setAttribute("aria-hidden", "false");
        state.cleanupResetFocusTrap?.();
        state.cleanupResetFocusTrap = trapFocus(els.resetModal);
    }
    els.resetCancelBtn?.focus();
};

export const requestClose = (els, state, { syncInputsToDraft, refreshSaveState, onResetFields } = {}) => {
    if (!els.modal.classList.contains("is-open") && !state.isDedicatedPage) return;
    syncInputsToDraft?.();
    if (!refreshSaveState?.()) {
        closeImmediately(els, state, { onResetFields });
        return;
    }
    openUnsavedDialog(els, state);
};
