import {
  bindImageFallbacks,
  escapeHtml,
  escapeHtmlAttr,
  loadProfile,
  loadProfileForApi,
  markMotionEnter,
  replayMotion,
} from "../utils.js";
import { t, tFormat } from "../i18n.js";
import { heroIcon } from "../icons.js";
import { renderErrorScreen } from "../components.js";
import { classifyError } from "../components/network-status.js";
import {
  navigateToAppRoute,
  routeCompareSelection,
  routeUniversityDetail,
} from "../routes.js";
import {
  COMPARE_UNIVERSITIES_KEY,
  fetchUniversityDetailCached,
  modeAwareAnnualCost,
  normalizeStudyModeForCost,
  readIdListStorage,
  renderInlineIcon,
  shouldOpenUniversitiesInNewTab,
  writeIdListStorage,
} from "./_shared.js";
import {
  compareAdmissionChoiceOptionLabel,
  compareAdmissionOptionEntries,
  compareAdmissionSelectionFromEntry,
  compareChoiceKey,
  compareCampusHtml,
  compareLocationText,
  compareRankText,
  comparePublishedAdmission,
  comparePercentText,
  compareSelectedAdmissionEntry,
  compareSelectedCostContext,
  compareCostContextText,
  compareUniversityName,
  formatCompareCostRange,
  loadCompareUniversities,
  readCompareAdmissionChoices,
  writeCompareAdmissionChoices,
  hasReviewedAdmissions,
} from "./universities/compare-helpers.js";
import {
  buildCompareDecisionSupportHtml,
  compareMetrics,
  compareRowsHtml,
  compareSlotLabel,
} from "./universities/compare-specs.js";
import { getFinanceForChoice, renderAdmissionSection } from "./university/render-sections.js";
import { loadPhotoCredits } from "./university/cover-credit.js";
import { mountReviewedComparison, openUniversitySwapDialog } from "./universities/compare-reviewed.js";
import { initUniversityTranslations } from "../university-translations.js";

const COMPARE_PAIR_SIZE = 2;

let activeUniversities = [];
let comparePhotos = null;
let compareAdmissionChoices = new Map();
let isDiffOnly = false;
let currentStage = "results";
// Two rechecked universities use the reviewed comparison; this file keeps the earlier-format pairs only.
let reviewedView = null;
let ignoreProfileUpdates = false;
let compareLoadRun = 0;
let comparePopStateHandler = null;
let compareProfileUpdatedHandler = null;
let compareLanguageChangedHandler = null;
function getCompareIdsFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const rawIds = String(params.get("ids") || "").split(",");
  const cleanIds = Array.from(new Set(rawIds.map((id) => id.trim()).filter(Boolean))).slice(0, COMPARE_PAIR_SIZE);
  if (cleanIds.length === COMPARE_PAIR_SIZE) return cleanIds;

  const stored = readIdListStorage(COMPARE_UNIVERSITIES_KEY).slice(0, COMPARE_PAIR_SIZE);
  if (stored.length === COMPARE_PAIR_SIZE) return stored;

  return cleanIds;
}

function getChoicesFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("choices") || "").split(",").map((c) => c.trim());
}

function getStageFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const stage = String(params.get("stage") || params.get("compare") || "").trim().toLowerCase();
  return stage === "configure" ? "configure" : "results";
}

function syncUrlWithState(stage = currentStage, { push = false } = {}) {
  const ids = activeUniversities.map((u) => String(u?.id || "").trim()).filter(Boolean);
  if (ids.length !== COMPARE_PAIR_SIZE) return;

  const choices = ids.map((id) => compareChoiceKey(compareAdmissionChoices.get(id)));
  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  if (choices.some(Boolean)) params.set("choices", choices.join(","));
  if (stage === "configure") {
    params.set("stage", "configure");
  }

  const url = new URL(window.location.href);
  url.search = params.toString();
  if (push) {
    window.history.pushState({ stage }, "", url.toString());
  } else {
    window.history.replaceState({ stage }, "", url.toString());
  }
}

function compareCardsHtml(universities) {
  return universities.map((u, index) => {
    const id = String(u?.id || "");
    const detailUrl = routeUniversityDetail(id);
    const publishedAdmission = comparePublishedAdmission(u, compareAdmissionChoices);
    const cost = compareSelectedCostContext(u, compareAdmissionChoices);
    const admissionContext = [
      publishedAdmission.scope === "program"
        ? t("universities.compare.scope.program", "course-specific")
        : t("universities.compare.scope.institution", "institution-wide"),
      publishedAdmission.cycle,
    ].filter(Boolean).join(" · ");
    const costContext = compareCostContextText({ ...cost, scope: "" });
    const linkAttrs = shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : "";

    return `
      <article class="compare-uni-card compare-uni-card--pair" data-compare-slot="${index + 1}" data-uni-id="${escapeHtmlAttr(id)}">
        ${compareCampusHtml(id, comparePhotos)}
        <div class="compare-uni-card__top">
          <span class="compare-uni-card__slot">${escapeHtml(compareSlotLabel(index))}</span>
          <button type="button" class="compare-uni-card__swap" data-action="swap-compare-uni" data-uni-id="${escapeHtmlAttr(id)}">${renderInlineIcon("arrows-right-left", 16)}<span>${escapeHtml(t("universities.compare.swap_university"))}</span></button>
        </div>
        <h3>${escapeHtml(compareUniversityName(u))}</h3>
        <p>${escapeHtml(compareLocationText(u))}</p>
        <p class="admissions-context__note">${escapeHtml(t("universities.compare.legacy_unreviewed"))}</p>
        <div class="compare-uni-card__metrics">
          <span><small>${escapeHtml(t("universities.compare.published_rank", "Published rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
          <span><small>${escapeHtml([t("universities.compare.sticker_cost", "Sticker cost"), costContext].filter(Boolean).join(" · "))}</small><strong>${escapeHtml(formatCompareCostRange(cost))}</strong></span>
          <span><small>${escapeHtml([t("universities.compare.published_rate", "Published selectivity"), admissionContext].filter(Boolean).join(" · "))}</small><strong>${escapeHtml(publishedAdmission.value === null ? t("common.na", "N/A") : comparePercentText(publishedAdmission.value))}</strong></span>
        </div>
        ${(() => {
          const entries = compareAdmissionOptionEntries(u);
          if (entries.length <= 1) return "";
          const selectedKey = compareChoiceKey(compareAdmissionChoices.get(id));
          return `
            <div class="compare-uni-card__track">
              <label class="compare-uni-card__track-label" for="track-select-${escapeHtmlAttr(id)}">${escapeHtml(t("universities.compare.change_track", "Change track"))}</label>
              <select class="compare-track-select" id="track-select-${escapeHtmlAttr(id)}" data-uni-id="${escapeHtmlAttr(id)}" data-action="change-compare-track" aria-label="${escapeHtmlAttr(t("universities.compare.change_track", "Change track"))}">
                ${entries.map((e) => {
                  const label = compareAdmissionChoiceOptionLabel(e, u);
                  const isSelected = e.key === selectedKey;
                  return `<option value="${escapeHtmlAttr(e.key)}"${isSelected ? " selected" : ""}>${escapeHtml(label || e.key)}</option>`;
                }).join("")}
              </select>
            </div>
          `;
        })()}
        <a class="compare-uni-card__link" href="${escapeHtmlAttr(detailUrl)}"${linkAttrs}>${escapeHtml(t("universities.card.view_details", "View details"))}</a>
      </article>
    `;
  }).join("");
}

function updateDiffOnlySections(tableWrap, diffOnly) {
  if (!tableWrap) return;
  tableWrap.classList.toggle("is-diff-only", diffOnly);
  const sectionRows = tableWrap.querySelectorAll(".compare-table__section-row");
  sectionRows.forEach((sectionRow) => {
    const section = sectionRow.getAttribute("data-section");
    const dataRows = Array.from(tableWrap.querySelectorAll(`tr[data-row-section="${section}"]`));
    if (!dataRows.length) return;
    const allHidden = diffOnly && dataRows.every((r) => r.classList.contains("compare-row--identical"));
    sectionRow.style.display = allHidden ? "none" : "";
  });
}

function renderEmptyState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="compare-results-empty">
      <div class="compare-results-empty__copy">
        <h2>${escapeHtml(t("universities.compare.results.empty_title", "No comparison yet"))}</h2>
        <p>${escapeHtml(t("universities.compare.results.empty_body", "Select exactly two universities to build a comparison pair."))}</p>
      </div>
      <div class="compare-results-actions compare-results-actions--centered">
        <button class="compare-results-action" type="button" data-action="back-to-catalog">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_catalog", "Back to catalog"))}</span>
        </button>
      </div>
    </div>
  `;
}

async function renderCompareConfigure(container, { pushState = false } = {}) {
  if (!container) return;
  currentStage = "configure";
  syncUrlWithState("configure", { push: pushState });

  const ready = activeUniversities.every((u) => {
    const id = String(u?.id || "");
    return Boolean(compareChoiceKey(compareAdmissionChoices.get(id)) && compareSelectedAdmissionEntry(u, compareAdmissionChoices));
  });

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.configure.kicker", "Before comparison"))}</p>
        <h2>${escapeHtml(t("universities.compare.configure.title"))}</h2>
        <p class="compare-config-subtitle">${escapeHtml(t("universities.compare.configure.subtitle"))}</p>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-catalog" title="${escapeHtmlAttr(t("universities.compare.back_to_catalog", "Back to catalog"))}">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_catalog", "Back to catalog"))}</span>
        </button>
        <button class="compare-results-action" type="button" data-action="build-compare-results"${ready ? "" : " disabled"}>${escapeHtml(t("universities.compare.continue", "Continue"))}</button>
      </div>
    </div>
    <section class="compare-config-panel" aria-label="${escapeHtmlAttr(t("universities.compare.configure.title", "Choose admission choices"))}">
      ${activeUniversities.map((u, index) => {
        const id = String(u?.id || "");
        const selected = compareChoiceKey(compareAdmissionChoices.get(id));
        const uniName = compareUniversityName(u);
        const location = compareLocationText(u);
        return `
          <article class="compare-config-column" data-uni-id="${escapeHtmlAttr(id)}">
            <div class="compare-config-column__head">
              ${compareCampusHtml(id, comparePhotos)}
              <span class="compare-config-column__slot">${escapeHtml(compareSlotLabel(index))}</span>
              <h2>${escapeHtml(uniName)}</h2>
              ${location ? `<p class="compare-config-column__location">${escapeHtml(location)}</p>` : ""}
              <p class="admissions-context__note">${escapeHtml(t("universities.compare.legacy_unreviewed"))}</p>
              <p class="compare-config-column__status">${escapeHtml(selected ? t("universities.compare.configure.selected", "Admission choice selected") : t("universities.compare.configure.required", "Select one option before comparing"))}</p>
            </div>
            <div class="compare-config-options" id="compare-options-${escapeHtmlAttr(id)}">
            </div>
          </article>
        `;
      }).join("")}
    </section>
  `;

  activeUniversities.forEach((u) => {
    const id = String(u?.id || "");
    const optContainer = container.querySelector(`#compare-options-${id}`);
    if (optContainer) {
      const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
      const annualCostForTrack = (track) => modeAwareAnnualCost(getFinanceForChoice(track, u.finance), profileStudyMode);

      renderAdmissionSection({
        annualCostForTrack,
        container: optContainer,
        university: u,
        effectiveSelectedChoiceKeyOverride: compareChoiceKey(compareAdmissionChoices.get(id)),
        compactMode: true,
        onChoiceSelected: (selection) => {
          const entry = compareAdmissionOptionEntries(u).find((e) => e.key === selection.choiceKey);
          const fullSelection = compareAdmissionSelectionFromEntry(entry);
          compareAdmissionChoices.set(id, fullSelection);
          writeCompareAdmissionChoices(compareAdmissionChoices, activeUniversities.map((x) => x.id));
          syncUrlWithState("configure", { push: pushState });
          renderCompareConfigure(container).catch((err) => console.error(err));
        },
      });
    }
  });

  bindImageFallbacks(container);
  markMotionEnter(container, ".compare-config-column, .admission-category-card", { limit: 16, staggerMs: 18 });
  replayMotion(container, "motion-panel-enter", { timeoutMs: 420 });
}

async function renderCompareResults(container, { pushState = false } = {}) {
  if (!container) return;
  currentStage = "results";
  syncUrlWithState("results", { push: pushState });

  const metrics = compareMetrics(activeUniversities);
  const rowsHtml = compareRowsHtml(activeUniversities, metrics);
  const decisionSupportHtml = buildCompareDecisionSupportHtml(activeUniversities, {
    choices: compareAdmissionChoices,
    budgetUsd: loadProfileForApi()?.budget,
  });

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker", "Comparison results"))}</p>
        <h2>${escapeHtml(t("universities.compare.results.title", "University comparison"))}</h2>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-tracks" title="${escapeHtmlAttr(t("universities.compare.back_to_tracks"))}">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_tracks"))}</span>
        </button>
      </div>
    </div>
    <div class="compare-uni-grid compare-uni-grid--pair">${compareCardsHtml(activeUniversities)}</div>
    ${decisionSupportHtml}
    <section class="compare-analysis-block compare-tests" aria-labelledby="compareTestsTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("document-check", 20, "compare-block-icon-svg")}</div>
        <div class="compare-block-title-wrap">
          <h2 id="compareTestsTitle">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</h2>
          <p>${escapeHtml(t("universities.compare.tests.subtitle", "Detailed published values. Color is used only for a comparable and meaningful difference."))}</p>
        </div>
        <div class="compare-block-tools">
          <label class="compare-diff-toggle" title="${escapeHtmlAttr(t("universities.compare.diff_only", "Differences only"))}">
            <input type="checkbox" data-action="toggle-diff-only"${isDiffOnly ? " checked" : ""}>
            <span class="compare-diff-toggle__track"><span class="compare-diff-toggle__thumb"></span></span>
            <span class="compare-diff-toggle__label">${escapeHtml(t("universities.compare.diff_only", "Differences only"))}</span>
          </label>
        </div>
      </div>
      <p class="compare-table-scroll-hint">${escapeHtml(t("universities.compare.table_scroll_hint", "Swipe horizontally to see both universities."))}</p>
      <div class="compare-table-wrap compare-table-wrap--pair${isDiffOnly ? " is-diff-only" : ""}" tabindex="0" role="region" aria-labelledby="compareTestsTitle">
        <table class="compare-table">
          <caption class="sr-only">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</caption>
          <thead>
            <tr>
              <th scope="col">${escapeHtml(t("universities.compare.row.metric", "Metric"))}</th>
              ${activeUniversities.map((u) => `<th scope="col">${escapeHtml(compareUniversityName(u))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </section>
  `;

  const tableWrap = container.querySelector(".compare-tests .compare-table-wrap");
  if (tableWrap && isDiffOnly) {
    updateDiffOnlySections(tableWrap, true);
  }
  bindImageFallbacks(container);
  markMotionEnter(container, ".compare-analysis-block, .compare-uni-card", { limit: 12, staggerMs: 18 });
  replayMotion(container, "motion-panel-enter", { timeoutMs: 420 });
}

function bindCompareEvents(container) {
  if (!container || container.dataset.boundEvents === "1") return;
  container.dataset.boundEvents = "1";

  container.addEventListener("click", async (event) => {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    const action = actionBtn.getAttribute("data-action");

    if (action === "back-to-catalog") {
      event.preventDefault();
      navigateToAppRoute(routeCompareSelection());
      return;
    }

    if (action === "back-to-tracks") {
      event.preventDefault();
      await renderCompareConfigure(container, { pushState: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "build-compare-results") {
      event.preventDefault();
      await renderCompareResults(container, { pushState: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action === "swap-compare-uni") {
      event.preventDefault();
      const targetId = String(actionBtn.getAttribute("data-uni-id") || "").trim();
      const colIndex = activeUniversities.findIndex((u) => String(u?.id || "") === targetId);
      if (colIndex < 0) return;
      const currentUni = activeUniversities[colIndex];
      const otherId = String(activeUniversities[1 - colIndex]?.id || "");
      openUniversitySwapDialog({
        currentUni,
        otherId,
        trigger: actionBtn,
        reviewedOnly: false,
        onChoose: async (picked) => {
          try {
            const detail = await fetchUniversityDetailCached(picked.id);
            if (!detail || !container.isConnected) return;
            activeUniversities[colIndex] = detail;
            const nextIds = activeUniversities.map((u) => String(u?.id || "").trim()).filter(Boolean);
            writeIdListStorage(COMPARE_UNIVERSITIES_KEY, nextIds);
            const newId = String(detail.id);
            const entries = compareAdmissionOptionEntries(detail);
            const storedKey = compareChoiceKey(compareAdmissionChoices.get(newId));
            const matchedEntry = (storedKey && entries.find((e) => e.key === storedKey)) || entries[0] || null;
            if (matchedEntry) {
              compareAdmissionChoices.set(newId, compareAdmissionSelectionFromEntry(matchedEntry));
            }
            writeCompareAdmissionChoices(compareAdmissionChoices, nextIds);
            syncUrlWithState(currentStage);
            await renderCompareResults(container);
          } catch (error) {
            console.error("Failed to swap comparison university:", error);
          }
        },
      });
      return;
    }
  });

  container.addEventListener("change", async (event) => {
    const diffToggle = event.target.closest("[data-action='toggle-diff-only']");
    if (diffToggle) {
      isDiffOnly = Boolean(diffToggle.checked);
      const tableWrap = container.querySelector(".compare-tests .compare-table-wrap");
      updateDiffOnlySections(tableWrap, isDiffOnly);
      return;
    }

    const trackSelect = event.target.closest("[data-action='change-compare-track']");
    if (trackSelect) {
      const uniId = String(trackSelect.getAttribute("data-uni-id") || "").trim();
      const nextKey = String(trackSelect.value || "").trim();
      const uni = activeUniversities.find((u) => String(u?.id || "") === uniId);
      if (uni && nextKey) {
        const entry = compareAdmissionOptionEntries(uni).find((e) => e.key === nextKey);
        if (entry) {
          compareAdmissionChoices.set(uniId, compareAdmissionSelectionFromEntry(entry));
          writeCompareAdmissionChoices(compareAdmissionChoices, activeUniversities.map((x) => x.id));
          await renderCompareResults(container);
        }
      }
    }
  });
}

function disposeReviewedView() {
  reviewedView?.dispose();
  reviewedView = null;
}

// A pair of one rechecked and one earlier-format university is not compared: their facts differ in kind and accuracy.
function renderMixedState(container, universities) {
  const reviewed = universities.find(hasReviewedAdmissions);
  const legacy = universities.find((u) => !hasReviewedAdmissions(u));
  const linkAttrs = shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : "";
  container.innerHTML = `
    <div class="compare-mixed" data-compare-mixed>
      <div class="compare-mixed__copy">
        <h1>${escapeHtml(t("universities.compare.mixed.title"))}</h1>
        <p>${escapeHtml(tFormat("universities.compare.mixed.text", { reviewed: compareUniversityName(reviewed), legacy: compareUniversityName(legacy) }))}</p>
      </div>
      <ul class="compare-mixed__list">
        ${universities.map((u) => {
          const id = String(u?.id || "");
          const isReviewed = hasReviewedAdmissions(u);
          return `<li class="compare-mixed__item" data-uni-id="${escapeHtmlAttr(id)}">
            <span class="compare-mixed__text"><strong>${escapeHtml(compareUniversityName(u))}</strong><small>${escapeHtml(t(isReviewed ? "universities.compare.mixed.reviewed" : "universities.compare.mixed.legacy"))}</small></span>
            <a class="compare-mixed__link" href="${escapeHtmlAttr(routeUniversityDetail(id))}"${linkAttrs}>${escapeHtml(t("universities.card.view_details"))}${heroIcon("chevron-right", "ui-icon ui-icon--16")}</a>
          </li>`;
        }).join("")}
      </ul>
      <div class="compare-mixed__actions">
        <button class="compare-results-action" type="button" data-action="back-to-catalog">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.mixed.choose_pair"))}</span>
        </button>
      </div>
    </div>
  `;
  bindImageFallbacks(container);
}

export function disposeComparePage() {
  compareLoadRun++;
  disposeReviewedView();
  window.removeEventListener("popstate", comparePopStateHandler);
  window.removeEventListener("profileUpdated", compareProfileUpdatedHandler);
  window.removeEventListener("languageChanged", compareLanguageChangedHandler);
  comparePopStateHandler = compareProfileUpdatedHandler = compareLanguageChangedHandler = null;
}

export async function initComparePage() {
  const container = document.getElementById("compareResultsPane");
  if (!container) return;
  const loadRun = ++compareLoadRun;
  disposeReviewedView();
  window.removeEventListener("popstate", comparePopStateHandler);
  window.removeEventListener("profileUpdated", compareProfileUpdatedHandler);
  window.removeEventListener("languageChanged", compareLanguageChangedHandler);
  comparePopStateHandler = () => {
    if (!container.isConnected || document.body.dataset.page !== "compare" || reviewedView) return;
    const targetStage = getStageFromUrl();
    if (targetStage !== currentStage && activeUniversities.length === COMPARE_PAIR_SIZE) {
      (targetStage === "configure" ? renderCompareConfigure(container) : renderCompareResults(container)).catch(error => console.error(error));
    }
  };
  compareProfileUpdatedHandler = () => {
    if (ignoreProfileUpdates || !container.isConnected || document.body.dataset.page !== "compare") return;
    if (reviewedView) reviewedView.onProfileUpdated();
    else void initComparePage();
  };
  compareLanguageChangedHandler = event => {
    const refresh = (async () => {
      await initUniversityTranslations();
      if (loadRun !== compareLoadRun || !container.isConnected || document.body.dataset.page !== "compare") return;
      if (reviewedView) reviewedView.rerender();
      else if (container.querySelector("[data-compare-mixed]")) renderMixedState(container, activeUniversities);
      else if (activeUniversities.length === COMPARE_PAIR_SIZE) {
        await (currentStage === "configure" ? renderCompareConfigure(container) : renderCompareResults(container));
      }
    })();
    event?.detail?.waitUntil?.(refresh);
    refresh.catch(error => console.error("Failed to translate university comparison:", error));
  };
  window.addEventListener("popstate", comparePopStateHandler);
  window.addEventListener("profileUpdated", compareProfileUpdatedHandler);
  window.addEventListener("languageChanged", compareLanguageChangedHandler);

  bindCompareEvents(container);

  const ids = getCompareIdsFromUrl();
  if (ids.length !== COMPARE_PAIR_SIZE) {
    renderEmptyState(container);
    return;
  }

  container.innerHTML = `
    <div class="compare-results-loading" role="status">
      <div class="skeleton-line compare-results-loading__title"></div>
      <div class="skeleton-line compare-results-loading__summary"></div>
      <div class="skeleton-line compare-results-loading__body"></div>
    </div>
  `;

  try {
    const [universities, photoCredits] = await Promise.all([
      loadCompareUniversities(ids, { fetchUniversityDetailCached }),
      loadPhotoCredits(),
    ]);
    if (loadRun !== compareLoadRun || !container.isConnected) return;

    if (universities.length !== COMPARE_PAIR_SIZE) {
      renderEmptyState(container);
      return;
    }

    activeUniversities = universities;
    comparePhotos = photoCredits?.photos;
    // Reading the stored legacy choices also clears obsolete pointers to rechecked universities, for any pair.
    ignoreProfileUpdates = true;
    compareAdmissionChoices = readCompareAdmissionChoices();
    ignoreProfileUpdates = false;
    const reviewedCount = universities.filter(hasReviewedAdmissions).length;
    if (reviewedCount === COMPARE_PAIR_SIZE) {
      // The reviewed comparison has one stage; an older configure link opens the results.
      currentStage = "results";
      syncUrlWithState("results");
      reviewedView = mountReviewedComparison(container, universities, comparePhotos);
      await reviewedView.ready;
      return;
    }
    if (reviewedCount > 0) {
      renderMixedState(container, universities);
      return;
    }

    const urlChoices = getChoicesFromUrl();
    activeUniversities.forEach((u, idx) => {
      const id = String(u?.id || "");
      const entries = compareAdmissionOptionEntries(u);
      const urlChoiceKey = urlChoices[idx] || "";
      const storedKey = compareChoiceKey(compareAdmissionChoices.get(id));
      const targetKey = urlChoiceKey || storedKey;
      let matchedEntry = targetKey ? entries.find((e) => e.key === targetKey) : null;
      if (!matchedEntry && entries.length) matchedEntry = entries[0];
      if (matchedEntry) {
        compareAdmissionChoices.set(id, compareAdmissionSelectionFromEntry(matchedEntry));
      }
    });
    writeCompareAdmissionChoices(compareAdmissionChoices, ids);

    const initialStage = getStageFromUrl();
    if (initialStage === "configure") {
      await renderCompareConfigure(container);
    } else {
      await renderCompareResults(container);
    }
  } catch (err) {
    if (loadRun !== compareLoadRun || !container.isConnected) return;
    console.error("Failed to load universities for comparison:", err);
    const classified = classifyError(err);
    renderErrorScreen({
      type: classified.type,
      targetEl: container,
      onRetry: () => initComparePage(),
    });
    window.addEventListener("app:online-reconnect", () => {
      initComparePage().catch(() => {});
    }, { once: true });
  }
}
