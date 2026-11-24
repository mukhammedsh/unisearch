/* frontend/javascript/pages/universities/compare-controller.js */

import {
    escapeHtml,
    escapeHtmlAttr,
    motionPress,
    replayMotion,
    saveFilters,
} from "../../utils.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import {
    navigateToAppRoute,
    routeCompare,
    routeCompareConfigure,
    routeUniversityDetail,
} from "../../routes.js";
import { translateUniversityName } from "../../university-translations.js";
import {
    readCompareAdmissionChoices,
    writeCompareAdmissionChoices as persistCompareAdmissionChoices,
} from "./compare-helpers.js";
import { normalizeCompareIdList } from "./query-state.js";
import { createCompareTrayMotion } from "./compare-tray-motion.js";
import {
    COMPARE_UNIVERSITIES_KEY,
    MAX_COMPARE_UNIVERSITIES,
    SAVED_UNIVERSITIES_KEY,
    getDetailCacheEntry,
    readIdListStorage,
    renderInlineIcon,
    shouldOpenUniversitiesInNewTab,
    trUniversityName,
    writeIdListStorage,
} from "../_shared.js";

function compensateCardAnchorShift(card, beforeTop) {
    if (!(card instanceof Element) || !Number.isFinite(beforeTop)) return;
    window.requestAnimationFrame(() => {
        const afterTop = card.getBoundingClientRect().top;
        const delta = afterTop - beforeTop;
        if (Math.abs(delta) > 1) {
            window.scrollBy({ top: delta, left: 0, behavior: "auto" });
        }
    });
}

/**
 * Manage saved & comparison university selection, the compare tray UI,
 * card save/compare button states, and university detail navigation.
 * @param {{
 *   el: Record<string, any>,
 *   state: Record<string, any>,
 *   initialCompareIds: string[],
 *   getLastRenderedItems: () => Array<Record<string, any>>,
 *   onRenderRecentlyViewed?: () => void,
 *   onHideSearchSuggestions?: () => void,
 *   onRefetch?: () => void,
 *   onSyncSectionVisibility?: (options: Record<string, any>) => Promise<void>,
 * }} options
 */
export function createCompareController({
    el,
    state,
    initialCompareIds,
    getLastRenderedItems,
    onRenderRecentlyViewed,
    onHideSearchSuggestions,
    onRefetch,
    onSyncSectionVisibility,
}) {
    const savedUniversityIds = new Set(readIdListStorage(SAVED_UNIVERSITIES_KEY));
    let compareUniversityIds = new Set(
        initialCompareIds.length === MAX_COMPARE_UNIVERSITIES
            ? initialCompareIds
            : normalizeCompareIdList(readIdListStorage(COMPARE_UNIVERSITIES_KEY))
    );
    compareUniversityIds = new Set(normalizeCompareIdList(Array.from(compareUniversityIds)));

    const compareAdmissionChoices = readCompareAdmissionChoices();
    // A pair is compared only within one data group: universities with rechecked (reviewed) admissions data, or
    // universities in the earlier format. The group of an id comes from its catalog row or cached detail; an unknown
    // group never blocks a choice here, and the comparison page itself explains a mixed pair.
    const compareGroupById = new Map();
    let compareTrayNotice = "";

    let mapCardActionHandler = null;
    let trayClickHandler = null;
    let compareModeBtnHandler = null;

    const isCompareSelectionMode = () => state.activeTab === "compare";

    const getRenderedUniversityById = (id) => {
        const cleanId = String(id || "").trim();
        const items = getLastRenderedItems?.() || [];
        return items.find((item) => String(item?.id || "") === cleanId) || null;
    };

    const getUniversityDisplayNameById = (id) => {
        const cleanId = String(id || "").trim();
        if (!cleanId) return "";

        const rendered = getRenderedUniversityById(cleanId);
        const renderedName = String(rendered ? trUniversityName(rendered) : "").trim();
        if (renderedName) return renderedName;

        const cachedLanguages = [getCurrentLanguage(), "eng", "ru"];
        for (const lang of cachedLanguages) {
            const cached = getDetailCacheEntry(cleanId, lang);
            const cachedName = String(cached?.data ? trUniversityName(cached.data) : "").trim();
            if (cachedName) return cachedName;
        }

        const translated = String(translateUniversityName(cleanId, "") || "").trim();
        return translated && translated !== cleanId ? translated : "";
    };

    const comparePairIds = () => normalizeCompareIdList(Array.from(compareUniversityIds));
    const setComparePairIds = (ids) => {
        const nextIds = normalizeCompareIdList(ids);
        compareUniversityIds = new Set(nextIds);
        const nextSet = new Set(nextIds);
        Array.from(compareAdmissionChoices.keys()).forEach((id) => {
            if (!nextSet.has(id)) compareAdmissionChoices.delete(id);
        });
    };
    const writeCompareAdmissionChoices = () => persistCompareAdmissionChoices(compareAdmissionChoices, comparePairIds());

    const compareGroupOf = (id) => {
        const cleanId = String(id || "").trim();
        const known = compareGroupById.get(cleanId);
        if (known) return known;
        const row = getRenderedUniversityById(cleanId)
            || [getCurrentLanguage(), "eng", "ru"].map((lang) => getDetailCacheEntry(cleanId, lang)?.data).find(Boolean);
        const availability = row?.admissions_catalog?.availability;
        if (!availability) return "";
        const group = availability === "reviewed" ? "reviewed" : "legacy";
        compareGroupById.set(cleanId, group);
        return group;
    };
    const comparePairGroups = () => new Set(comparePairIds().map(compareGroupOf).filter(Boolean));
    const isComparePairMixed = () => comparePairGroups().size > 1;
    const isComparePairReady = () => comparePairIds().length >= 2 && !isComparePairMixed();

    const syncCompareSelectionFromStorage = () => {
        const rawIds = readIdListStorage(COMPARE_UNIVERSITIES_KEY);
        const storedIds = normalizeCompareIdList(rawIds);
        if (rawIds.length !== storedIds.length) {
            writeIdListStorage(COMPARE_UNIVERSITIES_KEY, storedIds);
        }
        if (!storedIds.length) return;
        const currentIds = comparePairIds();
        if (storedIds.join("|") !== currentIds.join("|")) {
            setComparePairIds(storedIds);
        }
    };

    const syncCompareModeControls = () => {
        if (!el.compareModeBtn || !el.compareModeLabel) return;
        const active = isCompareSelectionMode();
        el.compareModeBtn.classList.toggle("is-active", active);
        el.compareModeBtn.setAttribute("aria-pressed", active ? "true" : "false");
        const label = t("universities.compare.enter", "Compare mode");
        el.compareModeBtn.setAttribute("aria-label", label);
        el.compareModeBtn.setAttribute("title", label);
        el.compareModeLabel.textContent = label;
    };

    const trayMotion = el.compareTray ? createCompareTrayMotion(el.compareTray) : null;

    const renderCompareTray = () => {
        if (!el.compareTray) return;
        if (isCompareSelectionMode()) syncCompareSelectionFromStorage();
        const ids = comparePairIds();
        if (!ids.length || !isCompareSelectionMode()) {
            trayMotion.hide();
            return;
        }
        if (trayMotion.deferForRemovedChips(ids, renderCompareTray)) return;
        trayMotion.show(ids, () => renderCompareTrayContent(ids));
    };

    /** @param {string[]} ids */
    const renderCompareTrayContent = (ids) => {
        el.compareTray.classList.toggle("is-ready", isComparePairReady());
        const canCompare = isComparePairReady();
        const notice = isComparePairMixed() ? t("universities.compare.tray_mixed") : compareTrayNotice;
        const chipsHtml = ids.map((id) => {
            const name = getUniversityDisplayNameById(id);
            const removeLabel = t("universities.compare.remove", "Remove from comparison");
            return `
                <div class="compare-tray__chip" role="listitem" data-uni-id="${escapeHtmlAttr(id)}">
                    <span class="compare-tray__chip-name" title="${escapeHtmlAttr(name)}">${escapeHtml(name)}</span>
                    <button class="compare-tray__chip-remove" type="button" data-action="remove-compare-slot" data-uni-id="${escapeHtmlAttr(id)}" title="${escapeHtmlAttr(removeLabel)}" aria-label="${escapeHtmlAttr(removeLabel)}">
                        ${renderInlineIcon("x-mark", 12)}
                    </button>
                </div>
            `;
        }).join("");
        el.compareTray.classList.toggle("has-note", Boolean(notice));
        el.compareTray.innerHTML = `
            ${notice ? `<p class="compare-tray__note" role="status">${escapeHtml(notice)}</p>` : ""}
            <span class="compare-tray__badge">${ids.length}/${MAX_COMPARE_UNIVERSITIES}</span>
            <div class="compare-tray__chips" role="list" aria-label="${escapeHtmlAttr(t("universities.compare.selection", "Selected universities"))}">
                ${chipsHtml}
            </div>
            <div class="compare-tray__actions">
                <button class="compare-tray__btn compare-tray__btn--ghost" type="button" data-action="clear-compare">${escapeHtml(t("universities.compare.clear", "Clear"))}</button>
                <button class="compare-tray__btn compare-tray__btn--primary" type="button" data-action="open-compare"${canCompare ? "" : " disabled"}>${escapeHtml(t(canCompare ? "universities.compare.continue" : "universities.compare.open", canCompare ? "Continue" : "Compare"))}</button>
            </div>
        `;
    };

    const syncCardActionState = () => {
        const showCompareSelection = isCompareSelectionMode();
        const pairGroups = showCompareSelection ? comparePairGroups() : new Set();
        const pairGroup = pairGroups.size === 1 ? [...pairGroups][0] : "";
        document.querySelectorAll(".uni-card[data-uni-id]").forEach((card) => {
            const rowId = String(card.getAttribute("data-uni-id") || "").trim();
            const saved = savedUniversityIds.has(rowId);
            const compared = showCompareSelection && compareUniversityIds.has(rowId);
            const rowGroup = pairGroup && !compared ? compareGroupOf(rowId) : "";
            const otherGroup = Boolean(rowGroup && rowGroup !== pairGroup);
            const saveBtn = card.querySelector("[data-card-action='save']");
            const compareBtn = card.querySelector("[data-card-action='compare']");
            card.classList.toggle("uni-card--compare-selected", compared);
            card.classList.toggle("uni-card--compare-unavailable", otherGroup);
            card.setAttribute("data-compare-selected", compared ? "true" : "false");
            if (saveBtn) {
                saveBtn.classList.toggle("is-active", saved);
                saveBtn.setAttribute("aria-pressed", saved ? "true" : "false");
            }
            const details = card.querySelector(".uni-details");
            if (details) {
                const label = showCompareSelection
                    ? (compared
                        ? t("universities.card.compare_selected_short", "Selected")
                        : otherGroup ? t("universities.card.compare_other_group") : t("universities.card.compare_short", "Compare"))
                    : t("universities.card.view_details", "View details");
                details.innerHTML = otherGroup ? escapeHtml(label) : `${escapeHtml(label)}<span aria-hidden="true">→</span>`;
                if (otherGroup) details.setAttribute("title", t("universities.card.compare_other_group_title"));
                else details.removeAttribute("title");
            }
            if (compareBtn) {
                const label = compared
                    ? t("universities.card.compare_selected", "Selected for comparison")
                    : otherGroup ? t("universities.card.compare_other_group_title") : t("universities.card.compare", "Add to compare");
                compareBtn.classList.toggle("is-active", compared);
                compareBtn.setAttribute("aria-pressed", compared ? "true" : "false");
                if (otherGroup) compareBtn.setAttribute("aria-disabled", "true");
                else compareBtn.removeAttribute("aria-disabled");
                compareBtn.setAttribute("title", label);
                compareBtn.setAttribute("aria-label", label);
                compareBtn.innerHTML = renderInlineIcon(compared ? "check-circle" : "adjustments-horizontal", 16, "uni-action-icon");
            }
        });
    };

    const persistSavedAndCompare = () => {
        setComparePairIds(comparePairIds());
        writeIdListStorage(SAVED_UNIVERSITIES_KEY, Array.from(savedUniversityIds));
        writeIdListStorage(COMPARE_UNIVERSITIES_KEY, comparePairIds());
        writeCompareAdmissionChoices();
        renderCompareTray();
        syncCompareModeControls();
        onRenderRecentlyViewed?.();
        syncCardActionState();
    };

    const toggleCompareUniversity = (uniId) => {
        const cleanId = String(uniId || "").trim();
        if (!cleanId) return false;
        const currentPair = comparePairIds();
        const wasCompared = currentPair.includes(cleanId);
        const pairGroups = comparePairGroups();
        const group = compareGroupOf(cleanId);
        if (!wasCompared && group && pairGroups.size === 1 && !pairGroups.has(group)) {
            // The other data group cannot join this pair; the tray says why instead of silently replacing a choice.
            compareTrayNotice = tFormat(`universities.compare.tray_blocked_${group}`, { university: getUniversityDisplayNameById(cleanId) });
            renderCompareTray();
            return true;
        }
        compareTrayNotice = "";
        if (wasCompared) {
            setComparePairIds(currentPair.filter((id) => id !== cleanId));
        } else {
            const nextPair = currentPair.length >= MAX_COMPARE_UNIVERSITIES
                ? currentPair.slice(1)
                : currentPair.slice();
            nextPair.push(cleanId);
            setComparePairIds(nextPair);
        }
        syncCardActionState();
        persistSavedAndCompare();
        return true;
    };

    const handleCardAction = (actionBtn, options = {}) => {
        if (!(actionBtn instanceof Element)) return false;
        const card = actionBtn.closest("[data-uni-id]");
        const uniId = String(card?.getAttribute("data-uni-id") || "").trim();
        const action = String(actionBtn.getAttribute("data-card-action") || "").trim();
        if (!card || !uniId || !action) return false;

        motionPress(actionBtn);

        if (action === "save") {
            const wasSaved = savedUniversityIds.has(uniId);
            const beforeTop = card.getBoundingClientRect().top;
            const savedCountBefore = savedUniversityIds.size;
            const shouldCompensateShift = Boolean(options.compensateLayoutShift) && (
                (!wasSaved && savedCountBefore === 0) ||
                wasSaved
            );
            if (wasSaved) savedUniversityIds.delete(uniId);
            else savedUniversityIds.add(uniId);
            syncCardActionState();
            replayMotion(
                actionBtn.querySelector(".uni-action-icon") || actionBtn,
                wasSaved ? "motion-icon-unsave" : "motion-icon-save",
                { timeoutMs: 320 }
            );
            persistSavedAndCompare();
            if (state.only_saved && wasSaved) {
                onRefetch?.();
            } else if (shouldCompensateShift) {
                compensateCardAnchorShift(card, beforeTop);
            }
            return true;
        }

        if (action === "compare") {
            return isCompareSelectionMode() ? toggleCompareUniversity(uniId) : false;
        }

        return false;
    };

    const openCompareResultsPage = async () => {
        const ids = comparePairIds();
        if (ids.length !== MAX_COMPARE_UNIVERSITIES || isComparePairMixed()) return;
        // Rechecked universities open their one-stage comparison; earlier-format pairs choose admission options first.
        const reviewedPair = ids.every((id) => compareGroupOf(id) === "reviewed");
        navigateToAppRoute(reviewedPair ? routeCompare(ids) : routeCompareConfigure(ids));
    };

    const setCompareSelectionMode = (enabled, { replaceUrl = false } = {}) => {
        onHideSearchSuggestions?.();
        const nextTab = enabled ? "compare" : "catalog";
        if (nextTab === state.activeTab) return;
        state.activeTab = nextTab;
        saveFilters(state);
        const items = getLastRenderedItems?.() || [];
        onSyncSectionVisibility?.({
            shouldFetch: !items.length,
            updateUrl: true,
            replaceUrl,
        }).catch((err) => console.error(err));
        syncCardActionState();
    };

    const universityLinkAttrs = () => (
        shouldOpenUniversitiesInNewTab()
            ? ' target="_blank" rel="noopener noreferrer"'
            : ""
    );

    const openUniversityDetail = (id) => {
        const cleanId = String(id || "").trim();
        if (!cleanId) return;
        const href = routeUniversityDetail(cleanId);
        if (shouldOpenUniversitiesInNewTab()) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
        }
        navigateToAppRoute(href);
    };

    const bindEvents = () => {
        mapCardActionHandler = (e) => {
            const target = e.target instanceof Element ? e.target : null;
            const actionBtn = target?.closest(".map-card-wrapper [data-card-action]");
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                handleCardAction(actionBtn, { compensateLayoutShift: false });
                return;
            }
            if (!isCompareSelectionMode()) return;
            const popupCard = target?.closest(".map-card-wrapper [data-uni-id]");
            if (!popupCard) return;
            e.preventDefault();
            e.stopPropagation();
            toggleCompareUniversity(popupCard.getAttribute("data-uni-id"));
        };
        document.addEventListener("click", mapCardActionHandler, true);

        trayClickHandler = (e) => {
            const action = e.target instanceof Element ? e.target.closest("[data-action]")?.getAttribute("data-action") : "";
            const actionButton = e.target instanceof Element ? e.target.closest("[data-action]") : null;
            if (actionButton) motionPress(actionButton);
            if (action === "clear-compare") {
                compareTrayNotice = "";
                compareUniversityIds.clear();
                compareAdmissionChoices.clear();
                persistSavedAndCompare();
                syncCardActionState();
            }
            if (action === "remove-compare-slot") {
                const slotUniId = String(actionButton?.getAttribute("data-uni-id") || "").trim();
                if (slotUniId) {
                    toggleCompareUniversity(slotUniId);
                }
            }
            if (action === "open-compare") {
                openCompareResultsPage().catch((err) => console.error(err));
            }
        };
        el.compareTray?.addEventListener("click", trayClickHandler);

        compareModeBtnHandler = () => {
            motionPress(el.compareModeBtn);
            setCompareSelectionMode(!isCompareSelectionMode());
        };
        el.compareModeBtn?.addEventListener("click", compareModeBtnHandler);
    };

    const dispose = () => {
        trayMotion?.dispose();
        if (mapCardActionHandler) {
            document.removeEventListener("click", mapCardActionHandler, true);
            mapCardActionHandler = null;
        }
        if (trayClickHandler && el.compareTray) {
            el.compareTray.removeEventListener("click", trayClickHandler);
        }
        trayClickHandler = null;
        if (compareModeBtnHandler && el.compareModeBtn) {
            el.compareModeBtn.removeEventListener("click", compareModeBtnHandler);
        }
        compareModeBtnHandler = null;
    };

    return {
        isCompareSelectionMode,
        getSavedUniversityIds: () => savedUniversityIds,
        getCompareUniversityIds: () => compareUniversityIds,
        getUniversityDisplayNameById,
        syncCompareModeControls,
        renderCompareTray,
        syncCardActionState,
        toggleCompareUniversity,
        handleCardAction,
        setCompareSelectionMode,
        universityLinkAttrs,
        openUniversityDetail,
        bindEvents,
        dispose,
    };
}
