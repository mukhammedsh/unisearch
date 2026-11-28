/* frontend/javascript/pages/universities/tour-modals.js */

import { aiName, closeMotionLayer, escapeHtml } from "../../utils.js";
import { clamp } from "../../utils/runtime.js";
import { t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";
import { navigateToAppRoute, routeProfile } from "../../routes.js";
import { safeSessionStorage } from "../../utils/safe-storage.js";
import { markUniversitiesTourSeen } from "../shared/cache.js";

const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";
const VIEWPORT_PADDING_PX = 16;
const SPOTLIGHT_PADDING_PX = 6;
const CARD_OFFSET_PX = 16;
const MOBILE_BREAKPOINT_PX = 768;

let universitiesTourModal = null;
let activeTourCleanup = null;

function buildTourSteps() {
    const fit = aiName("fit");
    const chance = aiName("chance");
    return [
        {
            id: "filters",
            icon: "funnel",
            placement: "right",
            label: t("tour.step1.label", "Search & filters"),
            title: t("tour.step1.title", "Narrow options by country, level, and budget"),
            desc: t(
                "tour.step1.desc",
                "Search by university, city, or abbreviation, then filter by study level, location, and yearly budget in your currency. Turn on Detailed admission terms to see universities whose requirements, deadlines, and costs are given for each program."
            ),
            action: "",
            resolveTarget: () => {
                if (window.innerWidth <= 1024) {
                    return document.getElementById("mobileFilterToggle") || document.getElementById("navbarSearchToggle");
                }
                return document.querySelector("#uSidebar .u-filter-card") || document.getElementById("universitySearch");
            },
        },
        {
            id: "profile",
            icon: "user-circle",
            placement: "below-end",
            label: tFormat("tour.step2.label", { fit }, `Profile & ${fit}`),
            title: t("tour.step2.title", "Personalize sorting without an account"),
            desc: tFormat(
                "tour.step2.desc",
                { fit },
                `Add what you already know — subject, budget, GPA, or exam scores — saved privately on this device. ${fit} ranks matching universities first and never treats missing scores as zero.`
            ),
            action: "open_profile",
            resolveTarget: () => document.getElementById("profileBtn"),
        },
        {
            id: "card",
            icon: "academic-cap",
            placement: "right",
            label: t("tour.step3.label", "Requirements & costs"),
            title: t("tour.step3.title", "Check official requirements and real costs"),
            desc: tFormat(
                "tour.step3.desc",
                { chance },
                `Open any university to inspect study options, admission routes, deadlines, full annual costs before aid, and official sources. ${chance} checks published numeric minimums against your profile.`
            ),
            action: "",
            resolveTarget: () => (
                document.querySelector("#universitiesList .uni-card:not(.is-skeleton)")
                || document.querySelector(".u-map-results-list .uni-card:not(.is-skeleton)")
                || document.getElementById("universitiesCatalogPane")
            ),
        },
        {
            id: "compare",
            icon: "adjustments-horizontal",
            placement: "below-end",
            label: t("tour.step4.label", "Compare"),
            title: t("tour.step4.title", "Compare two universities side by side"),
            desc: t(
                "tour.step4.desc",
                "Turn on Compare mode or use the compare button on cards to place two universities side by side — deadlines, requirements, tuition, scholarships, and PDF export in one view."
            ),
            action: "",
            resolveTarget: () => document.getElementById("compareModeBtn"),
        },
    ];
}

function isElementVisible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function ensureTargetInViewport(target) {
    if (!isElementVisible(target)) return;
    const rect = target.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
    const visibleBottomLimit = isMobile ? Math.max(220, vh - 260) : vh - VIEWPORT_PADDING_PX;

    if (window.scrollY > 120 && rect.top < VIEWPORT_PADDING_PX) {
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
    }
    if (rect.top < VIEWPORT_PADDING_PX || rect.top > visibleBottomLimit - 60) {
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
}

function positionSpotlightAndCard(modal, card, step) {
    const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const isMobile = vw <= MOBILE_BREAKPOINT_PX;
    const rawTarget = step?.resolveTarget?.() || null;
    const target = isElementVisible(rawTarget) ? rawTarget : null;

    if (!target) {
        modal.classList.add("has-no-target");
        return;
    }

    modal.classList.remove("has-no-target");
    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const cardWidth = cardRect.width || Math.min(400, vw - VIEWPORT_PADDING_PX * 2);
    const cardHeight = cardRect.height || 240;

    const spotLeft = clamp(rect.left - SPOTLIGHT_PADDING_PX, 8, Math.max(8, vw - 24));
    const spotTop = clamp(rect.top - SPOTLIGHT_PADDING_PX, 8, Math.max(8, vh - 24));
    const maxSpotBottom = isMobile
        ? Math.max(spotTop + 36, Math.min(vh - 8, vh - cardHeight - VIEWPORT_PADDING_PX * 1.5))
        : vh - 8;
    const spotRight = clamp(rect.right + SPOTLIGHT_PADDING_PX, spotLeft + 24, vw - 8);
    const spotBottom = clamp(rect.bottom + SPOTLIGHT_PADDING_PX, spotTop + 24, maxSpotBottom);
    const spotWidth = Math.max(24, spotRight - spotLeft);
    const spotHeight = Math.max(24, spotBottom - spotTop);

    modal.style.setProperty("--tour-spot-left", `${Math.round(spotLeft)}px`);
    modal.style.setProperty("--tour-spot-top", `${Math.round(spotTop)}px`);
    modal.style.setProperty("--tour-spot-width", `${Math.round(spotWidth)}px`);
    modal.style.setProperty("--tour-spot-height", `${Math.round(spotHeight)}px`);

    if (isMobile) return;

    let left;
    let top;
    const spaceRight = vw - spotRight - CARD_OFFSET_PX - VIEWPORT_PADDING_PX;
    const spaceLeft = spotLeft - CARD_OFFSET_PX - VIEWPORT_PADDING_PX;
    const spaceBelow = vh - spotBottom - CARD_OFFSET_PX - VIEWPORT_PADDING_PX;

    if (step.placement === "below-end") {
        left = spotRight - cardWidth;
        top = spaceBelow >= cardHeight || spaceBelow >= spotTop - VIEWPORT_PADDING_PX
            ? spotBottom + CARD_OFFSET_PX
            : spotTop - cardHeight - CARD_OFFSET_PX;
    } else if (spaceRight >= cardWidth) {
        left = spotRight + CARD_OFFSET_PX;
        top = spotTop;
    } else if (spaceLeft >= cardWidth) {
        left = spotLeft - cardWidth - CARD_OFFSET_PX;
        top = spotTop;
    } else if (spaceBelow >= cardHeight) {
        left = spotLeft;
        top = spotBottom + CARD_OFFSET_PX;
    } else {
        left = spotLeft;
        top = spotTop - cardHeight - CARD_OFFSET_PX;
    }

    const clampedLeft = clamp(left, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, vw - cardWidth - VIEWPORT_PADDING_PX));
    const clampedTop = clamp(top, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, vh - cardHeight - VIEWPORT_PADDING_PX));
    modal.style.setProperty("--tour-card-left", `${Math.round(clampedLeft)}px`);
    modal.style.setProperty("--tour-card-top", `${Math.round(clampedTop)}px`);
}

function ensureUniversitiesTourModal() {
    if (universitiesTourModal && universitiesTourModal.parentElement) return universitiesTourModal;
    const existing = document.getElementById("uTourModal");
    if (existing) {
        universitiesTourModal = existing;
        return universitiesTourModal;
    }

    const modal = document.createElement("dialog");
    modal.id = "uTourModal";
    modal.className = "u-tour-modal";
    modal.setAttribute("closedby", "any");
    modal.setAttribute("aria-labelledby", "uTourTitle");
    modal.innerHTML = `
        <div class="u-tour-spotlight" aria-hidden="true"></div>
        <div class="u-tour-card">
            <div class="u-tour-header">
                <div id="uTourSteps" class="u-tour-steps" role="tablist"></div>
                <div class="u-tour-header-end">
                    <p id="uTourProgressLabel" class="u-tour-progress" aria-live="polite"></p>
                    <button class="ui-btn ui-btn--icon ui-btn--ghost icon-btn u-tour-close" type="button" data-action="close">${heroIcon("x-mark", "ui-icon ui-icon--18")}</button>
                </div>
            </div>
            <div id="uTourSlide" class="u-tour-slide" aria-live="polite"></div>
            <div class="u-tour-actions">
                <button class="ui-btn ui-btn--sm ui-btn--ghost u-tour-btn u-tour-btn--skip" type="button" data-action="skip"></button>
                <div class="u-tour-actions-right">
                    <button class="ui-btn ui-btn--sm u-tour-btn" type="button" data-action="prev"></button>
                    <button class="ui-btn ui-btn--sm ui-btn--primary u-tour-btn u-tour-btn--primary" type="button" data-action="next" autofocus></button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    universitiesTourModal = modal;
    return modal;
}

/**
 * Open the 4-step interactive spotlight tour over the live catalog workspace.
 * @param {{ startStep?: number }} [options]
 * @returns {Promise<void>}
 */
export function showUniversitiesTour(options = {}) {
    if (typeof activeTourCleanup === "function") {
        activeTourCleanup({ immediate: true });
    }

    return new Promise((resolve) => {
        const modal = ensureUniversitiesTourModal();
        const card = modal.querySelector(".u-tour-card");
        const slideEl = modal.querySelector("#uTourSlide");
        const stepsEl = modal.querySelector("#uTourSteps");
        const progressLabelEl = modal.querySelector("#uTourProgressLabel");
        const prevBtn = modal.querySelector("[data-action='prev']");
        const nextBtn = modal.querySelector("[data-action='next']");
        const skipBtn = modal.querySelector("[data-action='skip']");
        const closeBtn = modal.querySelector("[data-action='close']");
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        let steps = buildTourSteps();
        let idx = clamp(Number(options.startStep) || 0, 0, steps.length - 1);
        let rafId = 0;
        let pressedOutside = false;
        let closed = false;

        const schedulePositionSync = () => {
            if (rafId) window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(() => {
                rafId = 0;
                if (closed || !card) return;
                positionSpotlightAndCard(modal, card, steps[idx]);
            });
        };

        const renderStep = (direction = "forward", { scrollTarget = true } = {}) => {
            steps = buildTourSteps();
            idx = clamp(idx, 0, steps.length - 1);
            const step = steps[idx];
            if (!step || !slideEl || !stepsEl || !progressLabelEl || !prevBtn || !nextBtn || !skipBtn || !card) return;

            if (scrollTarget) {
                const target = step.resolveTarget?.();
                if (target) ensureTargetInViewport(target);
            }

            stepsEl.setAttribute("aria-label", t("tour.steps_label", "Tutorial steps"));
            stepsEl.innerHTML = steps
                .map((item, i) => `
                    <button
                        class="u-tour-steps__item ${i === idx ? "is-current" : ""} ${i < idx ? "is-complete" : ""}"
                        type="button"
                        role="tab"
                        aria-selected="${i === idx ? "true" : "false"}"
                        aria-label="${escapeHtml(`${i + 1}. ${item.label}`)}"
                        title="${escapeHtml(item.label)}"
                        data-step-index="${i}"
                    >${i + 1}</button>
                `)
                .join("");

            progressLabelEl.textContent = tFormat(
                "tour.progress",
                { current: idx + 1, total: steps.length },
                `Step ${idx + 1} of ${steps.length}`
            );

            const actionHtml = step.action === "open_profile"
                ? `<button class="ui-btn ui-btn--sm u-tour-inline-btn" type="button" data-action="open-profile">${heroIcon("user-circle", "ui-icon ui-icon--16")}<span>${escapeHtml(t("tour.open_profile", "Open Profile"))}</span></button>`
                : "";

            slideEl.classList.remove("is-enter-forward", "is-enter-back");
            if (direction !== "none") {
                void slideEl.offsetWidth;
                slideEl.classList.add(direction === "back" ? "is-enter-back" : "is-enter-forward");
            }
            slideEl.innerHTML = `
                <div class="u-tour-step">
                    <p class="u-tour-kicker">${heroIcon(step.icon, "ui-icon ui-icon--16")}<span>${escapeHtml(step.label)}</span></p>
                    <h2 id="uTourTitle" class="u-tour-title">${escapeHtml(step.title)}</h2>
                    <p class="u-tour-desc">${escapeHtml(step.desc)}</p>
                    ${actionHtml}
                </div>
            `;

            prevBtn.hidden = idx === 0;
            prevBtn.textContent = t("tour.back", "Back");
            const isLast = idx === steps.length - 1;
            nextBtn.textContent = isLast ? t("tour.finish", "Done") : t("tour.next", "Next");
            skipBtn.textContent = t("tour.skip_all", "Skip");
            skipBtn.hidden = isLast;
            if (closeBtn) {
                const closeLabel = t("tour.close", "Close tutorial");
                closeBtn.title = closeLabel;
                closeBtn.setAttribute("aria-label", closeLabel);
            }

            positionSpotlightAndCard(modal, card, step);
        };

        const cleanup = ({ immediate = false, onClosed = null } = {}) => {
            if (closed) return;
            closed = true;
            activeTourCleanup = null;
            if (rafId) {
                window.cancelAnimationFrame(rafId);
                rafId = 0;
            }
            window.removeEventListener("resize", schedulePositionSync);
            window.removeEventListener("scroll", schedulePositionSync, true);
            window.removeEventListener("languageChanged", onLanguageChanged);
            modal.removeEventListener("cancel", onCancel);
            modal.removeEventListener("close", onNativeClose);
            modal.removeEventListener("pointerdown", onPointerDown);
            modal.removeEventListener("pointerup", onPointerUp);
            stepsEl?.removeEventListener("click", onStepsClick);
            stepsEl?.removeEventListener("keydown", onStepsKeydown);
            slideEl?.removeEventListener("click", onSlideClick);
            prevBtn?.removeEventListener("click", onPrev);
            nextBtn?.removeEventListener("click", onNext);
            skipBtn?.removeEventListener("click", onSkip);
            closeBtn?.removeEventListener("click", onSkip);

            markUniversitiesTourSeen();

            const finalizeClose = () => {
                modal.classList.remove("is-open", "is-closing", "has-no-target");
                if (typeof modal.close === "function") {
                    if (modal.open) modal.close();
                } else if (previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
                    previouslyFocused.focus({ preventScroll: true });
                }
                onClosed?.();
                resolve();
            };

            if (immediate) {
                finalizeClose();
                return;
            }
            closeMotionLayer(modal, finalizeClose);
        };

        activeTourCleanup = cleanup;

        const isOutsideCard = (event) => {
            if (!card) return false;
            const r = card.getBoundingClientRect();
            return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
        };

        const onPointerDown = (event) => {
            pressedOutside = event.target === modal && isOutsideCard(event);
        };

        const onPointerUp = (event) => {
            if (pressedOutside && event.target === modal && isOutsideCard(event)) {
                cleanup();
            }
            pressedOutside = false;
        };

        const onCancel = (event) => {
            event.preventDefault();
            cleanup();
        };

        const onNativeClose = () => {
            if (!closed) cleanup({ immediate: true });
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

        const onStepsClick = (event) => {
            const btn = event.target instanceof Element ? event.target.closest("[data-step-index]") : null;
            if (!btn) return;
            const nextIdx = Number.parseInt(btn.getAttribute("data-step-index") || "", 10);
            if (!Number.isInteger(nextIdx) || nextIdx === idx || nextIdx < 0 || nextIdx >= steps.length) return;
            const direction = nextIdx < idx ? "back" : "forward";
            idx = nextIdx;
            renderStep(direction);
        };

        const onStepsKeydown = (event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const nextIdx = (idx + delta + steps.length) % steps.length;
            const direction = delta < 0 ? "back" : "forward";
            idx = nextIdx;
            renderStep(direction);
            stepsEl?.querySelector(`[data-step-index="${idx}"]`)?.focus();
        };

        const onSlideClick = (event) => {
            const profileAction = event.target instanceof Element ? event.target.closest("[data-action='open-profile']") : null;
            if (!profileAction) return;
            safeSessionStorage.set(PROFILE_RETURN_URL_KEY, window.location.href);
            cleanup({
                onClosed: () => {
                    navigateToAppRoute(routeProfile());
                },
            });
        };

        const onLanguageChanged = () => {
            renderStep("none", { scrollTarget: false });
        };

        prevBtn?.addEventListener("click", onPrev);
        nextBtn?.addEventListener("click", onNext);
        skipBtn?.addEventListener("click", onSkip);
        closeBtn?.addEventListener("click", onSkip);
        stepsEl?.addEventListener("click", onStepsClick);
        stepsEl?.addEventListener("keydown", onStepsKeydown);
        slideEl?.addEventListener("click", onSlideClick);
        modal.addEventListener("cancel", onCancel);
        modal.addEventListener("close", onNativeClose);
        modal.addEventListener("pointerdown", onPointerDown);
        modal.addEventListener("pointerup", onPointerUp);
        window.addEventListener("resize", schedulePositionSync);
        window.addEventListener("scroll", schedulePositionSync, true);
        window.addEventListener("languageChanged", onLanguageChanged);

        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
        if (typeof modal.showModal === "function" && !modal.open) modal.showModal();
        renderStep("none");
        nextBtn?.focus({ preventScroll: true });
    });
}
