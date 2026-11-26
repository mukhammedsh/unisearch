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
import { describeRankingProfile, summarizeRankingProfile } from "./unifit-explanation.js";
import { hasProfileEvidence } from "./query-state.js";
import { setRevealed } from "../../utils/motion-reveal.js";

/**
 * Manage the compact inline UniFit ranking context row, its info tooltip, and the localized AI sort label.
 * @param {{ el: Record<string, any>, state: Record<string, any> }} options
 */
export function createUnifitBannerController({ el, state }) {
    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) {
            aiOpt.textContent = cleanDecoratedText(
                tFormat("universities.sort_ai", { fit: aiName("fit") }, `${aiName("fit")}: Best for your profile`)
            );
        }
    };

    // The first paint after load places the context line without motion; later sort switches reveal or collapse it.
    let contextMotionReady = false;
    const revealContext = (visible) => {
        setRevealed(el.unifitContextBar, visible, { instant: !contextMotionReady });
        contextMotionReady = true;
    };

    const update = () => {
        if (!el.unifitContextBar) return;
        if (state.sort !== "uni_ai") {
            revealContext(false);
            return;
        }
        const profile = loadProfile();
        const parts = describeRankingProfile(profile, {
            t,
            tFormat,
            formatMoney,
            majorLabel: (major) => translateProgramName(major, major),
            examName: (id) => getExamDisplayName(id, { locale: getCurrentLanguage() }),
        });
        const hasEvidence = hasProfileEvidence(profile);
        const hasProfile = Boolean(parts.length || hasEvidence);
        if (el.unifitBannerTitle) {
            el.unifitBannerTitle.textContent = parts.length
                ? tFormat("universities.ux2.banner.ranked", { values: summarizeRankingProfile(parts, 2) })
                : t(hasEvidence ? "universities.ux2.banner.scores_only" : "universities.ux2.banner.generic");
        }
        if (el.unifitTooltipProfile) {
            el.unifitTooltipProfile.hidden = parts.length === 0;
            el.unifitTooltipProfile.textContent = parts.length
                ? tFormat("universities.ux2.banner.tooltip_profile", { values: parts.join(" · ") })
                : "";
        }
        if (el.unifitBannerEdit) {
            el.unifitBannerEdit.hidden = hasProfile;
            if (!hasProfile) {
                el.unifitBannerEdit.textContent = t("universities.ux2.banner.set_up");
                el.unifitBannerEdit.setAttribute("href", routeProfile());
            }
        }
        revealContext(true);
    };

    return {
        applyAISortOptionLabel,
        update,
    };
}
