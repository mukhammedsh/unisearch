/* frontend/javascript/pages/universities/unifit-banner.js */

import {
    aiName,
    getExamDisplayName,
    loadProfile,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { formatMoney } from "../../currency.js";
import { routeProfile } from "../../routes.js";
import { translateProgramName } from "../../university-translations.js";
import { cleanDecoratedText } from "../_shared.js";
import { describeRankingProfile } from "./unifit-explanation.js";
import { hasProfileEvidence } from "./query-state.js";

/**
 * Manage the UniFit ranking banner, preferences shortcut, and localized AI sort label.
 * @param {{ el: Record<string, any>, state: Record<string, any> }} options
 */
export function createUnifitBannerController({ el, state }) {
    let dismissed = false;
    let dismissHandler = null;
    let prefsHandler = null;

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) {
            aiOpt.textContent = cleanDecoratedText(
                tFormat("universities.sort_ai", { fit: aiName("fit") }, `${aiName("fit")}: ${t("common.ai_short", "AI")} Smart Sort`)
            );
        }
    };

    // Card badges now display plain-language text directly inside each card body.
    const refreshLegend = () => {};

    const update = () => {
        if (!el.unifitWarningBanner) return;
        if (state.sort !== "uni_ai") {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        if (dismissed) {
            el.unifitWarningBanner.hidden = true;
            return;
        }
        // The banner states which profile answers the ranking uses, so the list never looks unexplained.
        const profile = loadProfile();
        const parts = describeRankingProfile(profile, {
            t,
            tFormat,
            formatMoney,
            majorLabel: (major) => translateProgramName(major, major),
            examName: (id) => getExamDisplayName(id, { locale: getCurrentLanguage() }),
        });
        const hasEvidence = hasProfileEvidence(profile);
        if (el.unifitBannerTitle) {
            el.unifitBannerTitle.textContent = parts.length
                ? tFormat("universities.ux2.banner.ranked", { values: parts.join(" · ") })
                : t(hasEvidence ? "universities.ux2.banner.scores_only" : "universities.ux2.banner.generic");
        }
        if (el.unifitBannerEdit) {
            el.unifitBannerEdit.textContent = t(parts.length || hasEvidence ? "universities.ux2.banner.edit" : "universities.ux2.banner.set_up");
            el.unifitBannerEdit.setAttribute("href", routeProfile());
        }
        el.unifitWarningBanner.hidden = false;
    };

    const resetDismissed = () => {
        dismissed = false;
        if (el.unifitWarningBanner) {
            el.unifitWarningBanner.hidden = true;
        }
    };

    const bindEvents = () => {
        applyAISortOptionLabel();
        dismissHandler = () => {
            dismissed = true;
            if (el.unifitWarningBanner) {
                el.unifitWarningBanner.hidden = true;
            }
        };
        prefsHandler = () => {
            if (window.innerWidth <= 1024 && el.mobileFilterToggle && !el.sidebar?.classList.contains("is-open")) {
                el.mobileFilterToggle.click();
            }
            if (el.unifitPrefsPanel) {
                el.unifitPrefsPanel.hidden = false;
                el.unifitPrefsPanel.open = true;
                el.unifitPrefsPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
            window.requestAnimationFrame(() => {
                el.focusSlider?.focus({ preventScroll: false });
            });
        };
        el.unifitWarningDismiss?.addEventListener("click", dismissHandler);
        el.unifitBannerPrefsBtn?.addEventListener("click", prefsHandler);
    };

    const dispose = () => {
        if (dismissHandler && el.unifitWarningDismiss) {
            el.unifitWarningDismiss.removeEventListener("click", dismissHandler);
        }
        if (prefsHandler && el.unifitBannerPrefsBtn) {
            el.unifitBannerPrefsBtn.removeEventListener("click", prefsHandler);
        }
        dismissHandler = null;
        prefsHandler = null;
    };

    return {
        applyAISortOptionLabel,
        refreshLegend,
        update,
        resetDismissed,
        bindEvents,
        dispose,
    };
}
