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

/**
 * Manage the UniFit ranking banner, card badge legend, and localized AI sort label.
 * @param {{ el: Record<string, any>, state: Record<string, any> }} options
 */
export function createUnifitBannerController({ el, state }) {
    let dismissed = false;
    let dismissHandler = null;

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) {
            aiOpt.textContent = cleanDecoratedText(
                tFormat("universities.sort_ai", { fit: aiName("fit") }, `${aiName("fit")}: ${t("common.ai_short", "AI")} Smart Sort`)
            );
        }
    };

    // Legend of the icon badges that are on the rendered cards, drawn with the same icons and tones as the badges,
    // so a first-time visitor learns the mapping once. Called after the banner updates and after each card render.
    const refreshLegend = () => {
        const box = el.unifitLegend;
        if (!box) return;
        const scope = state.viewMode === "map" ? el.mapResults : el.list;
        const badges = state.sort === "uni_ai" && scope
            ? Array.from(scope.querySelectorAll(".uni-card:not(.is-skeleton) .uni-status-trigger[data-legend]"))
                .map((node) => ({ key: node.dataset.legend, icon: node.dataset.legendIcon, tone: node.dataset.legendTone }))
            : [];
        const entries = legendEntries(badges);
        box.hidden = !entries.length;
        box.innerHTML = entries.length
            ? `<span class="u-unifit-legend__lead">${escapeHtml(t("universities.ux2.legend.lead"))}</span>${entries.map(({ icon, tone, labelKey }) =>
                `<span class="u-unifit-legend__item"><span class="uni-status-trigger uni-status-trigger--${escapeHtmlAttr(tone)}" aria-hidden="true">${renderInlineIcon(icon, 16, "uni-status-icon")}</span><span class="u-unifit-legend__label">${escapeHtml(t(labelKey))}</span></span>`).join("")}`
            : "";
    };

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
        refreshLegend();
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
        el.unifitWarningDismiss?.addEventListener("click", dismissHandler);
    };

    const dispose = () => {
        if (dismissHandler && el.unifitWarningDismiss) {
            el.unifitWarningDismiss.removeEventListener("click", dismissHandler);
        }
        dismissHandler = null;
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
