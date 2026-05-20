import { t, tFormat } from "../../i18n.js";
import { escapeHtml } from "../../utils.js";
import { renderInlineIcon } from "../_shared.js";
import { aiName } from "../../utils.js";

/**
 * Tour and modal functions for university catalog
 */

export function ensureUniversitiesTourModal() {
    let modal = document.getElementById("universitiesTourModal");
    if (modal) {
        return modal;
    }

    modal = document.createElement("div");
    modal.id = "universitiesTourModal";
    modal.className = "u-tour-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="u-tour-backdrop" data-action="close"></div>
        <div class="u-tour-card" role="dialog" aria-modal="true" aria-labelledby="uTourTitle">
            <button class="u-tour-close" type="button" data-action="close" aria-label="${escapeHtml(t("tour.close", "Close tour"))}" title="${escapeHtml(t("tour.close", "Close tour"))}">${renderInlineIcon("x-mark", 18, "u-tour-close-icon")}</button>
            <div class="u-tour-progress">
                <span id="uTourProgressLabel"></span>
                <div id="uTourDots" class="u-tour-dots"></div>
            </div>
            <div id="uTourSlide" class="u-tour-slide" aria-live="polite"></div>
            <div class="u-tour-actions">
                <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="skip">${escapeHtml(t("tour.skip", "Skip"))}</button>
                <div class="u-tour-actions-right">
                    <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="prev">${escapeHtml(t("tour.back", "Back"))}</button>
                    <button class="u-tour-btn u-tour-btn--primary" type="button" data-action="next">${escapeHtml(t("tour.next", "Next"))}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

export function showUniversitiesTour(markUniversitiesTourSeen) {
    return new Promise((resolve) => {
        const modal = ensureUniversitiesTourModal();
        const slideEl = modal.querySelector("#uTourSlide");
        const dotsEl = modal.querySelector("#uTourDots");
        const progressLabelEl = modal.querySelector("#uTourProgressLabel");
        const prevBtn = modal.querySelector("[data-action='prev']");
        const nextBtn = modal.querySelector("[data-action='next']");
        const skipBtn = modal.querySelector("[data-action='skip']");
        const actionsEl = modal.querySelector(".u-tour-actions");
        const closeEls = modal.querySelectorAll("[data-action='close']");

        const steps = [
            {
                kicker: t("tour.step1.kicker", "Welcome"),
                title: t("tour.step1.title", "Find universities faster"),
                desc: t("tour.step1.desc", "This page helps you quickly pick universities by country, cost, and your profile."),
                points: [
                    t("tour.step1.point1", "Use search + filters in the left panel."),
                    t("tour.step1.point2", "Switch between List and Map view on the top right."),
                    tFormat("tour.step1.point3", { fit: aiName("fit") }, `Use ${aiName("fit")} to sort by personalized fit.`),
                ],
                action: "",
            },
            {
                kicker: t("tour.step2.kicker", "Step 1"),
                title: t("tour.step2.title", "Fill your profile first"),
                desc: t("tour.step2.desc", "Profile data makes recommendations and admission estimates more accurate."),
                points: [
                    t("tour.step2.point1", "Add budget, major, and GPA."),
                    t("tour.step2.point2", "Add exam and language scores."),
                    tFormat("tour.step2.point3", { fit: aiName("fit"), chance: aiName("chance") }, `This improves ${aiName("fit")} and ${aiName("chance")} quality.`),
                ],
                action: "open_profile",
            },
            {
                kicker: t("tour.step3.kicker", "Step 2"),
                title: t("tour.step3.title", "Use filtering strategically"),
                desc: t("tour.step3.desc", "Start broad, then narrow by country, city, cost range, study level, and funding type."),
                points: [
                    t("tour.step3.point1", "Adjust tuition min/max with the slider."),
                    t("tour.step3.point2", "Use the grant/paid funding filter for finance planning."),
                    t("tour.step3.point3", "Use map view to spot location clusters."),
                ],
                action: "",
            },
            {
                kicker: t("tour.step4.kicker", "Step 3"),
                title: t("tour.step4.title", "Open details and compare admission choices"),
                desc: t("tour.step4.desc", "Click any card to inspect admission categories, requirement profiles, finance, and requirements."),
                points: [
                    tFormat("tour.step4.point1", { chance: aiName("chance") }, `Review ${aiName("chance")} by selected requirement profile in the detail page.`),
                    t("tour.step4.point2", "Check Admission and Costs tabs for requirement and funding details."),
                    t("tour.step4.point3", "Compare yearly cost and scholarships before applying."),
                ],
                action: "",
            },
        ];

        let idx = 0;
        let isPausedForProfile = false;

        const renderStep = (direction = "forward") => {
            const step = steps[idx];
            if (!step || !slideEl || !dotsEl || !progressLabelEl || !prevBtn || !nextBtn || !skipBtn || !actionsEl) return;

            progressLabelEl.textContent = "";
            progressLabelEl.style.display = "none";
            dotsEl.innerHTML = steps
                .map((_, i) => `<span class="u-tour-dot ${i === idx ? "is-active" : ""}" aria-hidden="true"></span>`)
                .join("");

            const actionHtml = step.action === "open_profile"
                ? `<button class="u-tour-inline-btn" type="button" data-action="open-profile">${escapeHtml(t("tour.open_profile", "Open Profile"))}</button>`
                : "";

            slideEl.classList.remove("is-enter-forward", "is-enter-back");
            void slideEl.offsetWidth;
            slideEl.classList.add(direction === "back" ? "is-enter-back" : "is-enter-forward");
            slideEl.innerHTML = `
                <article class="u-tour-step">
                    <div class="u-tour-kicker">${escapeHtml(step.kicker || "")}</div>
                    <h3 id="uTourTitle" class="u-tour-title">${escapeHtml(step.title)}</h3>
                    <p class="u-tour-desc">${escapeHtml(step.desc)}</p>
                    <ul class="u-tour-list">
                        ${step.points.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
                    </ul>
                    ${actionHtml}
                </article>
            `;

            slideEl.querySelector("[data-action='open-profile']")?.addEventListener("click", () => {
                const profileBtn = document.getElementById("profileBtn");
                if (!profileBtn) return;

                isPausedForProfile = true;
                modal.classList.remove("is-open");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";

                const onProfileClosed = () => {
                    isPausedForProfile = false;
                    modal.style.display = "flex";
                    modal.classList.add("is-open");
                    modal.setAttribute("aria-hidden", "false");
                    nextBtn?.focus();
                };

                window.addEventListener("profileModalClosed", onProfileClosed, { once: true });
                profileBtn.click();
            });

            prevBtn.disabled = idx === 0;
            prevBtn.style.display = idx === 0 ? "none" : "";
            nextBtn.textContent = idx === steps.length - 1 ? t("tour.finish", "Finish") : t("tour.next", "Next");
            skipBtn.textContent = t("tour.skip", "Skip");
            skipBtn.disabled = idx === steps.length - 1;
            skipBtn.style.display = idx === steps.length - 1 ? "none" : "";
            skipBtn.style.visibility = idx === steps.length - 1 ? "hidden" : "visible";
            actionsEl.style.justifyContent = idx === steps.length - 1 ? "flex-end" : "space-between";
        };

        const cleanup = () => {
            nextBtn?.removeEventListener("click", onNext);
            prevBtn?.removeEventListener("click", onPrev);
            skipBtn?.removeEventListener("click", onSkip);
            closeEls.forEach((el) => el.removeEventListener("click", onSkip));
            document.removeEventListener("keydown", onKey);
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            modal.style.display = "none";
            resolve();
        };

        const onNext = () => {
            if (idx >= steps.length - 1) {
                cleanup();
                return;
            }
            idx += 1;
            renderStep("forward");
        };

        const onPrev = () => {
            if (idx <= 0) return;
            idx -= 1;
            renderStep("back");
        };

        const onSkip = () => cleanup();

        const onKey = (e) => {
            if (isPausedForProfile) return;
            if (e.key === "Escape") {
                e.preventDefault();
                cleanup();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                onNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                onPrev();
            }
        };

        markUniversitiesTourSeen();
        renderStep("forward");

        nextBtn?.addEventListener("click", onNext);
        prevBtn?.addEventListener("click", onPrev);
        skipBtn?.addEventListener("click", onSkip);
        closeEls.forEach((el) => el.addEventListener("click", onSkip));
        document.addEventListener("keydown", onKey);

        modal.style.display = "flex";
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        nextBtn?.focus();
    });
}

export function ensureUniFitWarningModal() {
    let modal = document.getElementById("unifitWarningModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "unifitWarningModal";
    modal.className = "unifit-warning-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="unifit-warning-backdrop" data-action="cancel"></div>
        <div class="unifit-warning-card" role="dialog" aria-modal="true" aria-labelledby="unifitWarningTitle">
            <div class="unifit-warning-icon">${renderInlineIcon("exclamation-triangle", 20, "unifit-warning-icon-svg")}</div>
            <div class="unifit-warning-content">
                <h3 id="unifitWarningTitle">${escapeHtml(t("unifit.warning.title", "Limited Profile Data"))}</h3>
                <p>${escapeHtml(t("unifit.warning.desc", "UniFit is more accurate when your profile includes exam or language scores."))}</p>
            </div>
            <div class="unifit-warning-actions">
                <button class="unifit-warning-btn unifit-warning-confirm" data-action="confirm" type="button">${escapeHtml(t("unifit.warning.confirm", "Okay I understand"))}</button>
                <button class="unifit-warning-btn unifit-warning-cancel" data-action="cancel" type="button">${escapeHtml(t("unifit.warning.cancel", "Cancel"))}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

export function showUniFitWarning() {
    return new Promise((resolve) => {
        const modal = ensureUniFitWarningModal();
        const okBtn = modal.querySelector("[data-action='confirm']");
        const cancelEls = modal.querySelectorAll("[data-action='cancel']");

        const cleanup = (result) => {
            okBtn?.removeEventListener("click", onOk);
            cancelEls.forEach((el) => el.removeEventListener("click", onCancel));
            document.removeEventListener("keydown", onKey);
            modal.classList.remove("is-open");
            modal.setAttribute("aria-hidden", "true");
            modal.style.display = "none";
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                cleanup(false);
            }
        };

        okBtn?.addEventListener("click", onOk);
        cancelEls.forEach((el) => el.addEventListener("click", onCancel));
        document.addEventListener("keydown", onKey);

        modal.style.display = "flex";
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden");
        okBtn?.focus();
    });
}
