/* frontend/javascript/pages/universities/welcome-banner.js */

import { loadProfile } from "../../utils.js";
import { routeProfile } from "../../routes.js";
import { safeSessionStorage } from "../../utils/safe-storage.js";
import { setRevealed } from "../../utils/motion-reveal.js";
import { hasSeenUniversitiesTour, markUniversitiesTourSeen } from "../_shared.js";
import { hasProfileForRanking } from "./query-state.js";

const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";

function hasNarrowCatalogContext(state) {
    return Boolean(
        state.q
        || state.country
        || state.region
        || state.city
        || state.study_level
        || state.only_saved
        || state.only_reviewed
    );
}

/**
 * Manage the calm, non-blocking first-visit welcome card above the university catalog.
 * @param {{
 *   el: Record<string, HTMLElement|null>,
 *   state: Record<string, unknown>,
 *   isCompareSelectionMode: () => boolean,
 *   onStartTour: () => void,
 * }} options
 */
export function createWelcomeBannerController({ el, state, isCompareSelectionMode, onStartTour }) {
    let motionReady = false;
    let dismissHandler = null;
    let profileClickHandler = null;
    let tourClickHandler = null;

    const reveal = (visible) => {
        if (!el.welcomeBanner) return;
        setRevealed(el.welcomeBanner, visible, { instant: !motionReady });
        motionReady = true;
    };

    const shouldDisplay = () => {
        if (!el.welcomeBanner) return false;
        if (hasSeenUniversitiesTour()) return false;
        if (state.sort === "uni_ai") return false;
        if (isCompareSelectionMode()) return false;
        if (hasNarrowCatalogContext(state)) return false;
        if (hasProfileForRanking(loadProfile())) return false;
        return true;
    };

    const update = () => {
        if (!el.welcomeBanner) return;
        if (el.welcomeProfileLink) {
            el.welcomeProfileLink.setAttribute("href", routeProfile());
        }
        reveal(shouldDisplay());
    };

    const dismiss = () => {
        markUniversitiesTourSeen();
        reveal(false);
    };

    const bindEvents = () => {
        dismissHandler = () => dismiss();
        profileClickHandler = () => {
            markUniversitiesTourSeen();
            safeSessionStorage.set(PROFILE_RETURN_URL_KEY, window.location.href);
        };
        tourClickHandler = () => {
            onStartTour();
        };

        el.welcomeDismissBtn?.addEventListener("click", dismissHandler);
        el.welcomeProfileLink?.addEventListener("click", profileClickHandler);
        el.welcomeTourBtn?.addEventListener("click", tourClickHandler);
    };

    const dispose = () => {
        if (dismissHandler && el.welcomeDismissBtn) {
            el.welcomeDismissBtn.removeEventListener("click", dismissHandler);
        }
        if (profileClickHandler && el.welcomeProfileLink) {
            el.welcomeProfileLink.removeEventListener("click", profileClickHandler);
        }
        if (tourClickHandler && el.welcomeTourBtn) {
            el.welcomeTourBtn.removeEventListener("click", tourClickHandler);
        }
        dismissHandler = null;
        profileClickHandler = null;
        tourClickHandler = null;
    };

    return {
        update,
        dismiss,
        bindEvents,
        dispose,
    };
}
