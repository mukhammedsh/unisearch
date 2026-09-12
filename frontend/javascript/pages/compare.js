import {
  API_BASE,
  bindImageFallbacks,
  escapeHtml,
  escapeHtmlAttr,
  initials,
  loadProfile,
  loadProfileForApi,
  markMotionEnter,
  replayMotion,
} from "../utils.js";
import { t, tFormat } from "../i18n.js";
import { translateWord } from "../university-translations.js";
import { heroIcon } from "../icons.js";
import {
  navigateToAppRoute,
  routeCompare,
  routeCompareSelection,
  routeUniversities,
  routeUniversityDetail,
} from "../routes.js";
import {
  fetchUniversityDetailCached,
  modeAwareAnnualCost,
  normalizeStudyModeForCost,
  readIdListStorage,
  renderInlineIcon,
  shouldOpenUniversitiesInNewTab,
  uniLogoSrc,
} from "./_shared.js";
import {
  compareAdmissionChoiceOptionLabel,
  compareAdmissionOptionEntries,
  compareAdmissionSelectionFromEntry,
  compareChoiceKey,
  compareLocationText,
  compareRankText,
  compareAcceptanceText,
  compareSelectedAdmissionEntry,
  compareSelectedAnnualCost,
  compareUniversityName,
  fetchCompareProfiles,
  formatCompareCost,
  loadCompareUniversities,
  readCompareAdmissionChoices,
  writeCompareAdmissionChoices,
} from "./universities/compare-helpers.js";
import {
  buildCompareConclusionHtml,
  buildCompareKeyDifferencesHtml,
  buildCompareOverviewHtml,
  compareBestBadges,
  compareMetrics,
  compareRowsHtml,
  compareSlotLabel,
} from "./universities/compare-specs.js";
import {
  applyPercentWidths,
  renderTrackChanceChip,
  renderUniChanceSummary,
} from "../university-detail-helpers.js";
import { renderAdmissionSection } from "./university/render-sections.js";

const COMPARE_PAIR_SIZE = 2;
const COMPARE_UNIVERSITIES_KEY = "unisearch_compare_university_ids_v1";

let activeUniversities = [];
let compareChancesByUniId = new Map();
let compareAdmissionChoices = new Map();
let isDiffOnly = false;
let currentStage = "results";

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

  const choices = ids.map((id) => compareChoiceKey(compareAdmissionChoices.get(id))).filter(Boolean);
  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  if (choices.length) params.set("choices", choices.join(","));
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

function compareCardsHtml(universities, metrics) {
  return universities.map((u, index) => {
    const id = String(u?.id || "");
    const logoSrc = uniLogoSrc(id);
    const logoSrcFull = uniLogoSrc(id, { forceFull: true });
    const badges = compareBestBadges(u, metrics);
    const linkAttrs = shouldOpenUniversitiesInNewTab() ? ' target="_blank" rel="noopener noreferrer"' : "";

    return `
      <article class="compare-uni-card compare-uni-card--pair" data-compare-slot="${index + 1}" data-uni-id="${escapeHtmlAttr(id)}">
        <div class="compare-uni-card__head">
          <div class="compare-uni-card__identity">
            <span class="compare-uni-card__slot">${escapeHtml(compareSlotLabel(index))}</span>
            <div class="compare-uni-card__logo">
              <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(compareUniversityName(u)))}">
            </div>
          </div>
        </div>
        <h3>${escapeHtml(compareUniversityName(u))}</h3>
        <p>${escapeHtml(compareLocationText(u))}</p>
        <div class="compare-uni-card__metrics">
          <span><small>${escapeHtml(translateWord("global_rank", "Rank"))}</small><strong>${escapeHtml(compareRankText(u))}</strong></span>
          <span><small>${escapeHtml(t("universities.card.cost_short", "Cost"))}</small><strong>${escapeHtml(formatCompareCost(compareSelectedAnnualCost(u, compareAdmissionChoices)))}</strong></span>
          <span><small>${escapeHtml(t("ranking.acceptance", "Acceptance"))}</small><strong>${escapeHtml(compareAcceptanceText(u))}</strong></span>
        </div>
        ${(() => {
          const uniChance = compareChancesByUniId.get(id);
          const selectedKey = compareChoiceKey(compareAdmissionChoices.get(id));
          const trackChance = (uniChance?.choices || []).find((x) => String(x.choiceKey) === selectedKey);
          return trackChance ? `<div class="compare-uni-card__chance">${renderTrackChanceChip(trackChance)}</div>` : "";
        })()}
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
        ${badges.length ? `<div class="compare-uni-card__badges">${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
        <a class="compare-uni-card__link" href="${routeUniversityDetail(id)}"${linkAttrs}>${escapeHtml(t("universities.card.view_details", "View details"))}</a>
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
      <h2>${escapeHtml(t("universities.compare.results.empty_title", "No comparison yet"))}</h2>
      <p>${escapeHtml(t("universities.compare.results.empty_body", "Select exactly two universities to build a comparison pair."))}</p>
      <div class="compare-results-actions" style="justify-content: center; margin-top: 20px;">
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
        <h2>${escapeHtml(t("universities.compare.configure.title", "Choose admission choices"))}</h2>
        <p class="compare-config-subtitle">${escapeHtml(t("universities.compare.configure.subtitle", "Pick one admission category, requirement profile, and funding option for each university. The comparison will use that choice for requirements, language proof, cost, and funding."))}</p>
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
        const logoSrc = uniLogoSrc(id);
        const logoSrcFull = uniLogoSrc(id, { forceFull: true });
        const uniName = compareUniversityName(u);
        const location = compareLocationText(u);
        return `
          <article class="compare-config-column" data-uni-id="${escapeHtmlAttr(id)}">
            <div class="compare-config-column__head">
              <div class="compare-config-column__identity">
                <span class="compare-config-column__slot">${escapeHtml(compareSlotLabel(index))}</span>
                <div class="compare-config-column__logo">
                  <img src="${logoSrc}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(uniName))}">
                </div>
              </div>
              <h2>${escapeHtml(uniName)}</h2>
              ${location ? `<p class="compare-config-column__location">${escapeHtml(location)}</p>` : ""}
              <p class="compare-config-column__status">${escapeHtml(selected ? t("universities.compare.configure.selected", "Admission choice selected") : t("universities.compare.configure.required", "Select one option before comparing"))}</p>
            </div>
            <div class="compare-config-chance">
              ${renderUniChanceSummary(compareChancesByUniId.get(id))}
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
      const uniChance = compareChancesByUniId.get(id);
      const uniChanceByChoiceKey = new Map((uniChance?.choices || []).map((choice) => [String(choice.choiceKey), choice]));
      const profileStudyMode = normalizeStudyModeForCost(loadProfile()?.studyMode || loadProfile()?.study_mode || "");
      const annualCostForTrack = (track) => modeAwareAnnualCost(((track && track.finance_override) || u.finance || {}), profileStudyMode);

      renderAdmissionSection({
        annualCostForTrack,
        container: optContainer,
        uniChance,
        uniChanceByChoiceKey,
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

  applyPercentWidths(container);
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
  const keyDifferencesHtml = buildCompareKeyDifferencesHtml(activeUniversities, metrics);
  const overviewHtml = buildCompareOverviewHtml(activeUniversities, metrics);
  const conclusionHtml = buildCompareConclusionHtml(activeUniversities, metrics);

  container.innerHTML = `
    <div class="compare-results-head compare-results-head--pair">
      <div>
        <p class="compare-results-kicker">${escapeHtml(t("universities.compare.results.kicker", "Comparison results"))}</p>
        <h2>${escapeHtml(t("universities.compare.results.title", "University comparison"))}</h2>
      </div>
      <div class="compare-results-actions">
        <button class="compare-results-action compare-results-action--ghost" type="button" data-action="back-to-tracks" title="${escapeHtmlAttr(t("universities.compare.back_to_tracks", "Back to tracks"))}">
          ${heroIcon("arrow-left", "ui-icon ui-icon--16")}
          <span>${escapeHtml(t("universities.compare.back_to_tracks", "Back to tracks"))}</span>
        </button>
      </div>
    </div>
    <div class="compare-uni-grid compare-uni-grid--pair">${compareCardsHtml(activeUniversities, metrics)}</div>
    ${keyDifferencesHtml}
    ${overviewHtml}
    <section class="compare-analysis-block compare-tests" aria-labelledby="compareTestsTitle">
      <div class="compare-block-head">
        <div class="compare-block-icon">${renderInlineIcon("document-check", 20, "compare-block-icon-svg")}</div>
        <div class="compare-block-title-wrap">
          <h2 id="compareTestsTitle">${escapeHtml(t("universities.compare.tests.title", "Tests and characteristics"))}</h2>
          <p>${escapeHtml(t("universities.compare.tests.subtitle", "Detailed table of published values. Green cells mark the strongest comparable value in each row."))}</p>
        </div>
        <div class="compare-block-tools">
          <label class="compare-diff-toggle" title="${escapeHtmlAttr(t("universities.compare.diff_only", "Differences only"))}">
            <input type="checkbox" data-action="toggle-diff-only"${isDiffOnly ? " checked" : ""}>
            <span class="compare-diff-toggle__track"><span class="compare-diff-toggle__thumb"></span></span>
            <span class="compare-diff-toggle__label">${escapeHtml(t("universities.compare.diff_only", "Differences only"))}</span>
          </label>
        </div>
      </div>
      <div class="compare-table-wrap compare-table-wrap--pair${isDiffOnly ? " is-diff-only" : ""}">
        <table class="compare-table">
          <thead>
            <tr>
              <th>${escapeHtml(t("universities.compare.row.metric", "Metric"))}</th>
              ${activeUniversities.map((u) => `<th>${escapeHtml(compareUniversityName(u))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </section>
    ${conclusionHtml}
  `;

  const tableWrap = container.querySelector(".compare-table-wrap");
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
  });

    window.addEventListener("popstate", () => {
    const targetStage = getStageFromUrl();
    if (targetStage !== currentStage && activeUniversities.length === COMPARE_PAIR_SIZE) {
      if (targetStage === "configure") {
        renderCompareConfigure(container, { pushState: false }).catch((err) => console.error(err));
      } else {
        renderCompareResults(container, { pushState: false }).catch((err) => console.error(err));
      }
    }
  });

  container.addEventListener("change", async (event) => {
    const diffToggle = event.target.closest("[data-action='toggle-diff-only']");
    if (diffToggle) {
      isDiffOnly = Boolean(diffToggle.checked);
      const tableWrap = container.querySelector(".compare-table-wrap");
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

export async function initComparePage() {
  const container = document.getElementById("compareResultsPane");
  if (!container) return;

  bindCompareEvents(container);

  const ids = getCompareIdsFromUrl();
  if (ids.length !== COMPARE_PAIR_SIZE) {
    renderEmptyState(container);
    return;
  }

  container.innerHTML = `
    <div class="compare-results-loading" role="status">
      <div class="skeleton-line" style="width: 38%; height: 22px;"></div>
      <div class="skeleton-line" style="width: 100%; height: 118px;"></div>
      <div class="skeleton-line" style="width: 92%; height: 180px;"></div>
    </div>
  `;

  try {
    const [universities, compareProfiles] = await Promise.all([
      loadCompareUniversities(ids, { fetchUniversityDetailCached }),
      fetchCompareProfiles(ids, {
        apiBase: API_BASE,
        fetchImpl: fetch,
        loadProfileForApi,
      }),
    ]);

    if (universities.length !== COMPARE_PAIR_SIZE) {
      renderEmptyState(container);
      return;
    }

    activeUniversities = universities;
    compareChancesByUniId = compareProfiles.chances;
    compareAdmissionChoices = readCompareAdmissionChoices();

    const urlChoices = getChoicesFromUrl();
    activeUniversities.forEach((u, idx) => {
      const id = String(u?.id || "");
      const entries = compareAdmissionOptionEntries(u);
      const urlChoiceKey = urlChoices[idx] || "";
      const storedKey = compareChoiceKey(compareAdmissionChoices.get(id));
      const targetKey = urlChoiceKey || storedKey;
      let matchedEntry = targetKey ? entries.find((e) => e.key === targetKey) : null;
      if (!matchedEntry && entries.length) {
        const uniChance = compareChancesByUniId.get(id);
        const recKey = String(uniChance?.selectedChoiceKey || uniChance?.recommendedChoiceKey || uniChance?.bestChoiceKey || "").trim();
        matchedEntry = recKey ? entries.find((e) => e.key === recKey) : null;
        if (!matchedEntry) matchedEntry = entries[0];
      }
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
    console.error("Failed to load universities for comparison:", err);
    renderEmptyState(container);
  }
}
