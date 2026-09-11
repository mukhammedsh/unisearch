import {
  API_BASE,
  escapeHtml,
  escapeHtmlAttr,
  getFlagImg,
  initials,
  initCustomSelect,
  markMotionEnter,
  motionPress,
  replayMotion,
} from "../utils.js";
import { heroIcon } from "../icons.js";
import { renderNoConnection } from "../components.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { routeUniversityDetail } from "../routes.js";
import { shouldOpenUniversitiesInNewTab } from "../settings.js";
import {
  humanizeMachineLabel,
  translateDataValue,
  translateUniversityName,
  translateUnknownWord,
} from "../university-translations.js";

let rankingBadgeResizeBound = false;
let rankingBadgeResizeRaf = 0;
let rankingFetchController = null;
let rankingLanguageChangedHandler = null;
let rankingSearchInputHandler = null;
let rankingSearchBlurHandler = null;
let rankingCountryChangeHandler = null;
let rankingLastSearchInput = null;
let rankingLastCountrySelect = null;

const universityLinkAttrs = () => (
  shouldOpenUniversitiesInNewTab()
    ? ' target="_blank" rel="noopener noreferrer"'
    : ""
);

function safePathSegment(raw) {
  return encodeURIComponent(String(raw || "").trim());
}

function buildApiUrl(path) {
  const base = String(API_BASE || "").trim().replace(/\/+$/, "");
  const suffix = String(path || "").replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

function unknownFieldText(fieldKey, fallbackField) {
  return translateUnknownWord(fieldKey, fallbackField);
}

function textOrUnknown(value, fieldKey, fallbackField) {
  const text = String(value ?? "").trim();
  return text || unknownFieldText(fieldKey, fallbackField);
}

function renderLocationMarkup({
  city = "",
  country = "",
  flagHtml = "",
  wrapperClass = "",
  cityClass = "",
  countryClass = "",
  fallbackClass = "",
} = {}) {
  const cityText = String(city || "").trim();
  const countryText = String(country || "").trim();
  const parts = [];
  if (cityText) parts.push(`<span class="${cityClass}">${escapeHtml(cityText)}${countryText ? "," : ""}</span>`);
  if (countryText) {
    const countryLabel = `<span>${escapeHtml(countryText)}</span>`;
    parts.push(`<span class="${countryClass}">${flagHtml ? `${flagHtml}${countryLabel}` : countryLabel}</span>`);
  }
  if (!parts.length) {
    parts.push(`<span class="${fallbackClass || cityClass}">${escapeHtml(unknownFieldText("placeholder.field.location", "Location"))}</span>`);
  }
  return `<div class="${wrapperClass}">${parts.join("")}</div>`;
}

function trCountry(value) {
  return translateDataValue("country", value, value);
}

function trCity(value) {
  return translateDataValue("city", value, value);
}

function trUniversityName(university) {
  return translateUniversityName(university?.id, String(university?.name || ""));
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function acronymForName(name) {
  const skip = new Set(["of", "the", "and", "for", "de", "la", "le", "в", "и"]);
  return String(name || "")
    .split(/[^A-Za-zА-Яа-яЁё0-9]+/)
    .filter((word) => word && !skip.has(word.toLowerCase()))
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

function rankingSearchTokens(university) {
  const name = String(university?.name || "");
  const translatedName = trUniversityName(university);
  const id = String(university?.id || "");
  const city = String(university?.location?.city || "");
  const country = String(university?.location?.country || "");
  const tokens = [
    name,
    translatedName,
    id,
    id.replace(/-/g, " "),
    city,
    trCity(city),
    country,
    trCountry(country),
    acronymForName(name),
    acronymForName(translatedName),
  ];
  return Array.from(new Set(tokens.map(normalizeSearchText).filter(Boolean)));
}

function matchesRankingQuery(university, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return true;
  return rankingSearchTokens(university).some((token) => token.includes(query) || query.includes(token));
}

function rankingStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return unknownFieldText("placeholder.field.global_rank", "Global Rank");
  if (key === "not_published") return t("common.na", "N/A");
  const fallback = humanizeMachineLabel(key, key);
  return t(`ranking.source_status.${key}`, fallback);
}

function uniThumbnailSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const size = String(opts.size || "").trim().toLowerCase();
  const format = String(opts.format || "webp").trim().toLowerCase() === "jpg" ? "jpg" : "webp";
  const forceFull = !!opts.forceFull || size === "full" || size === "large";
  const folder = forceFull
    ? "thumbnails"
    : size === "medium"
      ? "thumbnails-medium"
      : "thumbnails-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.${format}`);
}

function uniLogoSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "logos" : "logos-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.png`);
}

function rankingSkeletonMarkup(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="rank-card rank-card--skeleton is-skeleton" aria-hidden="true">
      <div class="skeleton-line rank-skeleton-num"></div>
      <div class="rank-logo"></div>
      <div class="rank-info">
        <div class="skeleton-line" style="width: 72%; height: 18px;"></div>
        <div class="skeleton-line" style="width: 42%; height: 13px;"></div>
      </div>
      <div class="skeleton-line rank-skeleton-badge"></div>
    </div>
  `).join("");
}

function fitRankingBadgeText(container) {
  if (!container) return;
  const badges = Array.from(container.querySelectorAll(".rank-badge"));
  badges.forEach((badge) => {
    const baseSize = 13;
    const minSize = 9;
    let size = baseSize;
    badge.style.fontSize = `${baseSize}px`;
    badge.style.whiteSpace = "nowrap";
    while (badge.scrollWidth > badge.clientWidth && size > minSize) {
      size -= 0.25;
      badge.style.fontSize = `${size.toFixed(2)}px`;
    }
  });
}

function ensureRankingBadgeResizeHandler() {
  if (rankingBadgeResizeBound) return;
  const onViewportChange = () => {
    if (rankingBadgeResizeRaf) cancelAnimationFrame(rankingBadgeResizeRaf);
    rankingBadgeResizeRaf = requestAnimationFrame(() => {
      rankingBadgeResizeRaf = 0;
      const listEl = document.getElementById("rankingList");
      if (!listEl) return;
      fitRankingBadgeText(listEl);
    });
  };
  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("orientationchange", onViewportChange, { passive: true });
  rankingBadgeResizeBound = true;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildNormalizedRankingItems(items) {
  const rows = Array.isArray(items) ? items : [];
  const compareNullableAsc = (a, b) => {
    const aMissing = a === null || a === undefined;
    const bMissing = b === null || b === undefined;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return a - b;
  };

  const scored = rows.map((university, index) => {
    const rankMeta = (university && typeof university.rank_meta === "object" && university.rank_meta) ? university.rank_meta : {};
    const rankStatus = String(rankMeta.status || "").trim().toLowerCase();
    const rawRank = toFiniteNumber(university?.rank);
    const hasOfficialRank = rankStatus === "official" && rawRank !== null && rawRank > 0;
    const nameKey = String(university?.name || university?.id || "").trim().toLowerCase();
    return { item: university, index, nameKey, rawRank, hasOfficialRank };
  });

  const official = scored
    .filter((row) => row.hasOfficialRank)
    .sort((a, b) => {
      const byRank = compareNullableAsc(a.rawRank, b.rawRank);
      if (byRank !== 0) return byRank;
      const byName = a.nameKey.localeCompare(b.nameKey);
      if (byName !== 0) return byName;
      return a.index - b.index;
    });

  const unranked = scored
    .filter((row) => !row.hasOfficialRank)
    .sort((a, b) => {
      const byName = a.nameKey.localeCompare(b.nameKey);
      if (byName !== 0) return byName;
      return a.index - b.index;
    });

  return [...official, ...unranked].map((row) => ({
    ...row.item,
    rank_display: row.hasOfficialRank ? row.rawRank : null,
    rank_is_official: row.hasOfficialRank,
  }));
}

let rankingListClickBound = false;
let currentResetCallback = null;

function ensureRankingListClickHandler(listEl) {
  if (rankingListClickBound || !listEl) return;
  listEl.addEventListener("click", (event) => {
    const resetBtn = event.target instanceof Element ? event.target.closest('[data-action="reset-ranking-filters"]') : null;
    if (!resetBtn) return;
    motionPress(resetBtn);
    if (typeof currentResetCallback === "function") {
      currentResetCallback();
      return;
    }
    const resetFiltersBtn = document.getElementById("resetFiltersBtn");
    if (resetFiltersBtn) {
      resetFiltersBtn.click();
    }
  });
  rankingListClickBound = true;
}

export function renderRankingList(items = [], totalCount = null, onReset = null) {
  const listEl = document.getElementById("rankingList");
  if (!listEl) return;
  if (typeof onReset === "function") currentResetCallback = onReset;
  ensureRankingBadgeResizeHandler();
  ensureRankingListClickHandler(listEl);

  const rows = Array.isArray(items) ? items : [];
  listEl.innerHTML = rows.map((university, index) => {
    const rank = Number(university.rank_display);
    const hasOfficialRank = university?.rank_is_official === true && Number.isFinite(rank) && rank > 0;

    let rankClass = "";
    if (hasOfficialRank && rank === 1) rankClass = "rank-1";
    else if (hasOfficialRank && rank === 2) rankClass = "rank-2";
    else if (hasOfficialRank && rank === 3) rankClass = "rank-3";

    const logoSrc = uniLogoSrc(university.id);
    const logoSrcFull = uniLogoSrc(university.id, { forceFull: true });
    const thumbSrc = uniThumbnailSrc(university.id);
    const thumbSrcMedium = uniThumbnailSrc(university.id, { size: "medium" });
    const thumbSrcFull = uniThumbnailSrc(university.id, { forceFull: true });
    const thumbSrcFullFallback = uniThumbnailSrc(university.id, { forceFull: true, format: "jpg" });
    const thumbSrcset = `${thumbSrc} 640w, ${thumbSrcMedium} 960w, ${thumbSrcFull} 1600w`;
    const loadingAttr = index < 4 ? "eager" : "lazy";
    const fetchPriorityAttr = index < 2 ? "high" : "auto";
    const cityRaw = String(university?.location?.city || "");
    const countryRaw = String(university?.location?.country || "");
    const flag = getFlagImg(countryRaw);
    const universityName = textOrUnknown(trUniversityName(university), "placeholder.field.university_name", "University name");
    const rankMeta = (university && typeof university.rank_meta === "object" && university.rank_meta) ? university.rank_meta : {};
    const rankSource = String(rankMeta.source || "").trim();
    const rankStatusRaw = String(rankMeta.status || "").trim().toLowerCase();
    const statusLabel = rankStatusRaw
      ? rankingStatusLabel(rankStatusRaw)
      : unknownFieldText("placeholder.field.global_rank", "Global Rank");
    const rankVerifiedAt = String(rankMeta.verified_at || "").trim()
      || unknownFieldText("placeholder.field.verification_date", "Verification date");
    const sourceTooltip = rankSource
      ? tFormat("ranking.source_tooltip", { source: rankSource, status: statusLabel, verified_at: rankVerifiedAt }, `Source: ${rankSource} | Type: ${statusLabel} | Checked: ${rankVerifiedAt}`)
      : "";
    const sourceTitleAttr = sourceTooltip ? ` title="${escapeHtmlAttr(sourceTooltip)}"` : "";
    const rankDisplay = hasOfficialRank ? `#${rank}` : escapeHtml(statusLabel);
    const rankBadge = escapeHtml(tFormat("ranking.source_status_label", { status: statusLabel }, `Type: ${statusLabel}`));
    const locationHtml = renderLocationMarkup({
      city: trCity(cityRaw),
      country: trCountry(countryRaw),
      flagHtml: flag,
      wrapperClass: "rank-loc",
      cityClass: "rank-loc-city",
      countryClass: "rank-loc-country",
      fallbackClass: "rank-loc-text",
    });

    return `
      <a href="${routeUniversityDetail(university.id)}" class="rank-card"${universityLinkAttrs()}${sourceTitleAttr}>
        <img class="rank-bg-img" src="${thumbSrc}" srcset="${escapeHtmlAttr(thumbSrcset)}" sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 100vw" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(thumbSrcFullFallback)}" data-final-src="${escapeHtmlAttr(logoSrcFull)}">
        <div class="rank-num ${rankClass}${hasOfficialRank ? "" : " rank-num--meta"}">${rankDisplay}</div>
        <div class="rank-logo">
          <img src="${logoSrc}" alt="${initials(universityName)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" data-fallback-src="${escapeHtmlAttr(logoSrcFull)}" data-fallback-text="${escapeHtmlAttr(initials(universityName))}">
        </div>
        <div class="rank-info">
          <div class="rank-title">${escapeHtml(universityName)}</div>
          ${locationHtml}
        </div>
        <div class="rank-badge">${rankBadge}</div>
      </a>
    `;
  }).join("");

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="rank-empty" role="status">
        <strong>${escapeHtml(t("ranking.empty.title", "No ranking matches"))}</strong>
        <span>${escapeHtml(t("ranking.empty.body", "Try a different search or country filter."))}</span>
        <div class="rank-empty__actions">
          <button type="button" class="rank-empty__btn" data-action="reset-ranking-filters">
            ${heroIcon("arrow-path", 16)}
            <span>${escapeHtml(t("ranking.empty.reset_filters", "Reset filters"))}</span>
          </button>
        </div>
      </div>
    `;
  }

  markMotionEnter(listEl, ".rank-card, .rank-empty", { limit: 18, staggerMs: 20 });
  replayMotion(listEl, "motion-panel-enter", { timeoutMs: 420 });
  requestAnimationFrame(() => fitRankingBadgeText(listEl));
}

export function setRankingLoading(isLoading, count = 8) {
  const listEl = document.getElementById("rankingList");
  if (!listEl) return;
  if (isLoading) {
    listEl.innerHTML = rankingSkeletonMarkup(count);
  }
}

export function renderRankingError({ onRetry } = {}) {
  renderNoConnection({
    containerId: "rankingList",
    onRetry: () => {
      if (typeof onRetry === "function") onRetry();
      else initRankingPage();
    },
  });
}

export async function initRankingPage() {
  const listEl = document.getElementById("rankingList");
  if (!listEl) return;
  if (rankingLanguageChangedHandler) {
    window.removeEventListener("languageChanged", rankingLanguageChangedHandler);
    rankingLanguageChangedHandler = null;
  }

  const onRankingLanguageChanged = () => {
    rankingLanguageChangedHandler = null;
    initRankingPage();
  };
  rankingLanguageChangedHandler = onRankingLanguageChanged;
  window.addEventListener("languageChanged", onRankingLanguageChanged, { once: true });
  ensureRankingBadgeResizeHandler();

  if (typeof window.__unisearchFetchAndRenderRanking === "function") {
    return window.__unisearchFetchAndRenderRanking();
  }

  if (rankingFetchController) rankingFetchController.abort();
  const controller = new AbortController();
  rankingFetchController = controller;
  setRankingLoading(true);

  try {
    const uiLang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
    const searchInput = document.getElementById("qInput");
    const countrySelect = document.getElementById("countrySelect");
    const params = new URLSearchParams();
    params.set("limit", "200");
    params.set("sort", "rank_asc");
    params.set("lang", uiLang);
    params.set("fields", "card");
    if (searchInput?.value?.trim()) params.set("q", searchInput.value.trim());
    if (countrySelect?.value?.trim()) params.set("country", countrySelect.value.trim());

    const res = await fetch(`${API_BASE}/universities?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Error loading ranking");
    const data = await res.json();
    const items = buildNormalizedRankingItems(data.items || []);
    renderRankingList(items, items.length);
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.error(err);
    renderRankingError({ onRetry: () => initRankingPage() });
  } finally {
    if (rankingFetchController === controller) rankingFetchController = null;
  }
}

