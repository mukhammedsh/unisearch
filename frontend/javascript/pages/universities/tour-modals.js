/* frontend/javascript/pages/universities/tour-modals.js */

import { escapeHtml, closeMotionLayer, aiName, trapFocus } from "../../utils.js";
import { t, tFormat } from "../../i18n.js";
import { saveUniversitiesTourResumeStep } from "../shared/cache.js";

let universitiesTourModal = null;
let uniFitWarningModal = null;
let uniFitWarningShownInSession = false;

export function ensureUniversitiesTourModal() {
    if (universitiesTourModal && universitiesTourModal.parentElement) return universitiesTourModal;
    const existing = document.getElementById("uTourModal");
    if (existing) {
        universitiesTourModal = existing;
        return universitiesTourModal;
    }

    const modal = document.createElement("div");
    modal.id = "uTourModal";
    modal.className = "u-tour-modal";
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="u-tour-backdrop" aria-hidden="true"></div>
        <div class="u-tour-card" role="dialog" aria-modal="true" aria-labelledby="uTourTitle">
            <div class="u-tour-header">
                <div>
                    <p class="u-tour-overline">${escapeHtml(t("tour.overline", "Getting started"))}</p>
                    <h2 id="uTourTitle" class="u-tour-heading">${escapeHtml(t("tour.heading", "Your university search, step by step"))}</h2>
                </div>
                <p id="uTourProgressLabel" class="u-tour-progress" aria-live="polite"></p>
            </div>
            <div class="u-tour-layout">
                <ol id="uTourSteps" class="u-tour-steps" aria-label="${escapeHtml(t("tour.steps_label", "Tutorial steps"))}"></ol>
                <div class="u-tour-main">
                    <div id="uTourSlide" class="u-tour-slide" aria-live="polite"></div>
                    <div class="u-tour-actions">
                        <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="skip">${escapeHtml(t("tour.skip_all", "Skip tutorial"))}</button>
                        <div class="u-tour-actions-right">
                            <button class="u-tour-btn u-tour-btn--ghost" type="button" data-action="prev">${escapeHtml(t("tour.back", "Back"))}</button>
                            <button class="u-tour-btn u-tour-btn--primary" type="button" data-action="next">${escapeHtml(t("tour.next", "Next"))}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    universitiesTourModal = modal;
    return modal;
}

export function showUniversitiesTour(options = {}) {
    return new Promise((resolve) => {
        const modal = ensureUniversitiesTourModal();
        const slideEl = modal.querySelector("#uTourSlide");
        const stepsEl = modal.querySelector("#uTourSteps");
        const progressLabelEl = modal.querySelector("#uTourProgressLabel");
        const prevBtn = modal.querySelector("[data-action='prev']");
        const nextBtn = modal.querySelector("[data-action='next']");
        const skipBtn = modal.querySelector("[data-action='skip']");
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        let cleanupFocusTrap = () => {};

        const steps = [
            {
                label: t("tour.step1.label", "How UniSearch helps"),
                kicker: t("tour.step1.kicker", "Welcome"),
                title: t("tour.step1.title", "Start with a clear plan"),
                desc: t("tour.step1.desc", "UniSearch helps you choose bachelor's universities that fit your goals. You do not need to know where to begin: work through the same simple route every time."),
                points: [
                    t("tour.step1.point1", "Tell us what matters to you in your profile."),
                    t("tour.step1.point2", "Browse widely, then use filters to narrow the list."),
                    t("tour.step1.point3", "Open promising universities, compare them, and check the details before you apply."),
                ],
                action: "",
            },
            {
                label: t("tour.step2.label", "Build your profile"),
                kicker: t("tour.step2.kicker", "First, tell us about you"),
                title: t("tour.step2.title", "Fill in your profile"),
                desc: t("tour.step2.desc", "Your profile gives the catalog useful context. Add only the information you already know; you can return and improve it later."),
                points: [
                    t("tour.step2.point1", "Start with the subject you want to study, your budget, and GPA if you have it."),
                    t("tour.step2.point2", "Add language and entrance-exam results when available."),
                    tFormat("tour.step2.point3", { fit: aiName("fit"), chance: aiName("chance") }, `More complete data makes ${aiName("fit")} and ${aiName("chance")} more useful; missing data is never treated as a zero.`),
                ],
                action: "open_profile",
            },
            {
                label: t("tour.step3.label", "Explore choices"),
                kicker: t("tour.step3.kicker", "Then, browse broadly"),
                title: t("tour.step3.title", "Search for an idea, not a perfect answer"),
                desc: t("tour.step3.desc", "Use the search field when you already have a university or city in mind. Otherwise, start with the list: it is normal to explore first and decide later."),
                points: [
                    t("tour.step3.point1", "Each result is a university you can open for fuller information."),
                    t("tour.step3.point2", "Use List to scan names and facts; switch to Map when location is important."),
                    tFormat("tour.step3.point3", { fit: aiName("fit") }, `When your profile is ready, sort by ${aiName("fit")} to see the most relevant options first.`),
                ],
                action: "",
            },
            {
                label: t("tour.step4.label", "Narrow the list"),
                kicker: t("tour.step4.kicker", "Make the list manageable"),
                title: t("tour.step4.title", "Use filters one decision at a time"),
                desc: t("tour.step4.desc", "Filters update the results so you can focus on realistic choices. Begin with the few constraints that matter most, then add more only when you need them."),
                points: [
                    t("tour.step4.point1", "Choose countries or cities you would genuinely consider."),
                    t("tour.step4.point2", "Set a tuition range and funding preference to keep costs realistic."),
                    t("tour.step4.point3", "Use subject and other filters after the basics; clear or adjust any filter whenever the list becomes too small."),
                ],
                action: "",
            },
            {
                label: t("tour.step5.label", "Check the details"),
                kicker: t("tour.step5.kicker", "Before you shortlist"),
                title: t("tour.step5.title", "Open a university and read the evidence"),
                desc: t("tour.step5.desc", "A card is a starting point, not a final decision. Open it to understand what that university expects and what studying there may cost."),
                points: [
                    t("tour.step5.point1", "Review admission requirements and choose the relevant admission option."),
                    tFormat("tour.step5.point2", { chance: aiName("chance") }, `Use ${aiName("chance")} as an estimate, not a guarantee of admission.`),
                    t("tour.step5.point3", "Compare tuition, scholarships, and other costs with the information shown for that university."),
                ],
                action: "",
            },
            {
                label: t("tour.step6.label", "Choose confidently"),
                kicker: t("tour.step6.kicker", "Your final short list"),
                title: t("tour.step6.title", "Compare a few realistic options"),
                desc: t("tour.step6.desc", "Keep several universities in view rather than chasing one perfect choice. Comparison makes the trade-offs between fit, admission requirements, and costs easier to see."),
                points: [
                    t("tour.step6.point1", "Use Compare to place promising universities side by side."),
                    t("tour.step6.point2", "Keep a balanced list: ambitious, realistic, and safer choices."),
                    t("tour.step6.point3", "Return to your profile or filters whenever your priorities change."),
                ],
                action: "",
            },
        ];

        let idx = Math.min(Math.max(Number(options.startStep) || 0, 0), steps.length - 1);
        let isPausedForProfile = false;

        const renderStep = (direction = "forward") => {
            const step = steps[idx];
            if (!step || !slideEl || !stepsEl || !progressLabelEl || !prevBtn || !nextBtn || !skipBtn) return;

            progressLabelEl.textContent = tFormat("tour.progress", { current: idx + 1, total: steps.length }, `Step ${idx + 1} of ${steps.length}`);
            stepsEl.innerHTML = steps
                .map((item, i) => `<li class="u-tour-steps__item ${i === idx ? "is-current" : ""} ${i < idx ? "is-complete" : ""}"${i === idx ? ' aria-current="step"' : ""}><span class="u-tour-steps__number">${i + 1}</span><span>${escapeHtml(item.label)}</span></li>`)
                .join("");

            const actionHtml = step.action === "open_profile"
                ? `<button class="u-tour-inline-btn" type="button" data-action="open-profile">${escapeHtml(t("tour.open_profile", "Open Profile"))}</button>`
                : "";

            slideEl.classList.remove("is-enter-forward", "is-enter-back");
            void slideEl.offsetWidth;
            slideEl.classList.add(direction === "back" ? "is-enter-back" : "is-enter-forward");
            slideEl.innerHTML = `
                <div class="u-tour-step">
                    <p class="u-tour-kicker">${escapeHtml(step.kicker)}</p>
                    <h3 class="u-tour-title">${escapeHtml(step.title)}</h3>
                    <p class="u-tour-desc">${escapeHtml(step.desc)}</p>
                    <ul class="u-tour-list">${step.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
                    ${actionHtml}
                </div>
            `;

            prevBtn.style.visibility = idx === 0 ? "hidden" : "visible";
            const isLast = idx === steps.length - 1;
            nextBtn.textContent = isLast ? t("tour.finish", "Finish tutorial") : t("tour.next", "Next");
            skipBtn.textContent = t("tour.skip_all", "Skip tutorial");

            const inlineProfileBtn = slideEl.querySelector("[data-action='open-profile']");
            if (inlineProfileBtn) {
                inlineProfileBtn.addEventListener("click", () => {
                    const profileBtn = document.getElementById("profileBtn");
                    if (!profileBtn) return;
                    isPausedForProfile = true;
                    saveUniversitiesTourResumeStep(idx);
                    cleanupFocusTrap();
                    cleanupFocusTrap = () => {};
                    modal.style.display = "none";
                    modal.setAttribute("aria-hidden", "true");
                    profileBtn.click();
                }, { once: true });
            }
        };

        const cleanup = () => {
            cleanupFocusTrap();
            window.removeEventListener("profileModalClosed", onProfileClosed);
            prevBtn?.removeEventListener("click", onPrev);
            nextBtn?.removeEventListener("click", onNext);
            skipBtn?.removeEventListener("click", onSkip);
            closeMotionLayer(modal, () => {
                modal.classList.remove("is-open", "is-closing");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";
                if (previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
                    previouslyFocused.focus();
                }
                resolve();
            });
        };

        const onPrev = () => {
            if (idx > 0) {
                idx -= 1;
                renderStep("back");
            }
        };

        const onNext = () => {
            if (idx < steps.length - 1) {
                idx += 1;
                renderStep("forward");
            } else {
                cleanup();
            }
        };

        const onSkip = () => cleanup();

        const onProfileClosed = () => {
            if (!isPausedForProfile) return;
            isPausedForProfile = false;
            modal.style.display = "flex";
            modal.removeAttribute("aria-hidden");
            modal.classList.remove("is-closing");
            modal.classList.add("is-open");
            renderStep("forward");
            cleanupFocusTrap = trapFocus(modal);
            slideEl?.querySelector("[data-action='open-profile']")?.focus();
        };

        prevBtn?.addEventListener("click", onPrev);
        nextBtn?.addEventListener("click", onNext);
        skipBtn?.addEventListener("click", onSkip);
        window.addEventListener("profileModalClosed", onProfileClosed);

        modal.style.display = "flex";
        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden");
        renderStep("forward");
        cleanupFocusTrap = trapFocus(modal);
        nextBtn?.focus();
    });
}

export function ensureUniFitWarningModal() {
    if (uniFitWarningModal && uniFitWarningModal.parentElement) return uniFitWarningModal;
    const existing = document.getElementById("unifitWarningModal");
    if (existing) {
        uniFitWarningModal = existing;
        return uniFitWarningModal;
    }

    const modal = document.createElement("div");
    modal.id = "unifitWarningModal";
    modal.className = "unifit-warning-modal";
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="unifit-warning-backdrop" data-action="cancel"></div>
        <div class="unifit-warning-card" role="dialog" aria-modal="true" aria-labelledby="unifitWarningTitle">
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
    uniFitWarningModal = modal;
    return modal;
}

export function showUniFitWarning() {
    return new Promise((resolve) => {
        uniFitWarningShownInSession = true;
        const modal = ensureUniFitWarningModal();
        const okBtn = modal.querySelector("[data-action='confirm']");
        const cancelEls = modal.querySelectorAll("[data-action='cancel']");
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const cleanupFocusTrap = trapFocus(modal);

        const cleanup = (result) => {
            cleanupFocusTrap();
            okBtn?.removeEventListener("click", onOk);
            cancelEls.forEach((el) => el.removeEventListener("click", onCancel));
            document.removeEventListener("keydown", onKey);
            closeMotionLayer(modal, () => {
                modal.classList.remove("is-open", "is-closing");
                modal.setAttribute("aria-hidden", "true");
                modal.style.display = "none";
                if (previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
                    previouslyFocused.focus();
                }
                resolve(result);
            });
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
        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
        modal.removeAttribute("aria-hidden");
        okBtn?.focus();
    });
}
