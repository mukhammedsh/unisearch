/* frontend/javascript/pages/universities/unifit-banner.js */

import {
    aiName,
    escapeHtml,
    escapeHtmlAttr,
    getExamDisplayName,
    loadProfile,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { formatMoney } from "../../currency.js";
import { routeProfile } from "../../routes.js";
import { translateProgramName } from "../../university-translations.js";
import { cleanDecoratedText, renderInlineIcon } from "../_shared.js";
import { describeRankingProfile, legendEntries } from "./unifit-explanation.js";
import { hasProfileEvidence } from "./query-state.js";
import { isRevealing, setRevealed } from "../../utils/motion-reveal.js";

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

    // On-demand legend of the mini status icons visible on rendered cards, collapsed by default to keep the header compact.
    const refreshLegend = () => {
        const box = el.unifitLegend;
        const disclosure = el.unifitLegendDetails;
        if (!box) return;
        const scope = state.viewMode === "map" ? el.mapResults : el.list;
        const badges = state.sort === "uni_ai" && scope
            ? Array.from(scope.querySelectorAll(".uni-card:not(.is-skeleton) .uni-status-trigger[data-legend]"))
                .map((node) => ({ key: node.dataset.legend, icon: node.dataset.legendIcon, tone: node.dataset.legendTone }))
            : [];
        const entries = legendEntries(badges);
        box.hidden = !entries.length;
        box.innerHTML = entries.length
            ? entries.map(({ icon, tone, labelKey }) =>
                `<span class="u-unifit-legend__item"><span class="uni-status-trigger uni-status-trigger--${escapeHtmlAttr(tone)}" aria-hidden="true">${renderInlineIcon(icon, 14, "uni-status-icon")}</span><span class="u-unifit-legend__label">${escapeHtml(t(labelKey))}</span></span>`
            ).join("")
            : "";
        const banner = el.unifitWarningBanner;
        const bannerRevealing = Boolean(banner && isRevealing(banner));
        // Inside a settled banner the legend grows on its own; while the banner itself is still
        // growing, the legend appears at once and the banner retargets to its new full height.
        if (disclosure) setRevealed(disclosure, entries.length > 0, { instant: !banner || banner.hidden || bannerRevealing });
        if (bannerRevealing) setRevealed(banner, true, { retarget: true });
    };

    // The first paint after load places the banner without motion; later changes grow or shrink it.
    let bannerMotionReady = false;
    const revealBanner = (visible) => {
        setRevealed(el.unifitWarningBanner, visible, { instant: !bannerMotionReady });
        bannerMotionReady = true;
    };

    const update = () => {
        if (!el.unifitWarningBanner) return;
        if (state.sort !== "uni_ai") {
            revealBanner(false);
            return;
        }
        if (dismissed) {
            revealBanner(false);
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
        // Legend first: it changes the banner height that the reveal measures.
        refreshLegend();
        revealBanner(true);
    };

    const resetDismissed = () => {
        dismissed = false;
        if (el.unifitWarningBanner) revealBanner(false);
    };

    const bindEvents = () => {
        applyAISortOptionLabel();
        dismissHandler = () => {
            dismissed = true;
            if (el.unifitWarningBanner) revealBanner(false);
        };
        prefsHandler = () => {
            if (window.innerWidth <= 1024 && el.mobileFilterToggle && !el.sidebar?.classList.contains("is-open")) {
                el.mobileFilterToggle.click();
            }
            if (el.unifitPrefsPanel) {
                setRevealed(el.unifitPrefsPanel, true);
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
