import {
  API_BASE,
  escapeHtml,
  escapeHtmlAttr,
  getFlagImg,
  initials,
} from "../utils.js";
import { renderNoConnection } from "../components.js";
import { getCurrentLanguage, t, tFormat } from "../i18n.js";
import { routeUniversityDetail } from "../routes.js";
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

function rankingStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  if (!key) return unknownFieldText("placeholder.field.global_rank", "Global Rank");
  const fallback = humanizeMachineLabel(key, key);
  return t(`ranking.source_status.${key}`, fallback);
}

function uniThumbnailSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "thumbnails" : "thumbnails-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.jpg`);
}

function uniLogoSrc(universityId, opts = {}) {
  const safeId = safePathSegment(universityId);
  const forceFull = !!opts.forceFull;
  const folder = forceFull ? "logos" : "logos-small";
  return buildApiUrl(`universities/assets/${folder}/${safeId}.png`);
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

function buildNormalizedRankingItems(items) {
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

  if (rankingFetchController) rankingFetchController.abort();
  const controller = new AbortController();
  rankingFetchController = controller;

  try {
    const uiLang = String(getCurrentLanguage() || "eng").trim().toLowerCase() || "eng";
    const res = await fetch(`${API_BASE}/universities?limit=200&sort=rank_asc&lang=${encodeURIComponent(uiLang)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Error loading ranking");
    const data = await res.json();
    const items = buildNormalizedRankingItems(data.items || []);

    listEl.innerHTML = items.map((university, index) => {
      const rank = Number(university.rank_display);
      const hasOfficialRank = university?.rank_is_official === true && Number.isFinite(rank) && rank > 0;

      let rankClass = "";
      if (hasOfficialRank && rank === 1) rankClass = "rank-1";
      else if (hasOfficialRank && rank === 2) rankClass = "rank-2";
      else if (hasOfficialRank && rank === 3) rankClass = "rank-3";

      const logoSrc = uniLogoSrc(university.id);
      const logoSrcFull = uniLogoSrc(university.id, { forceFull: true });
      const thumbSrc = uniThumbnailSrc(university.id);
      const thumbSrcFull = uniThumbnailSrc(university.id, { forceFull: true });
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
        <a href="${routeUniversityDetail(university.id)}" class="rank-card"${sourceTitleAttr}>
          <img class="rank-bg-img" src="${thumbSrc}" alt="" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${thumbSrcFull}';}else{this.src='${logoSrcFull}';}">
          <div class="rank-num ${rankClass}${hasOfficialRank ? "" : " rank-num--meta"}">${rankDisplay}</div>
          <div class="rank-logo">
            <img src="${logoSrc}" alt="${initials(universityName)}" loading="${loadingAttr}" fetchpriority="${fetchPriorityAttr}" decoding="async" onerror="if(!this.dataset.full){this.dataset.full='1';this.src='${logoSrcFull}';}else{this.parentNode.textContent='${initials(universityName)}';}">
          </div>
          <div class="rank-info">
            <div class="rank-title">${escapeHtml(universityName)}</div>
            ${locationHtml}
          </div>
          <div class="rank-badge">${rankBadge}</div>
        </a>
      `;
    }).join("");

    requestAnimationFrame(() => fitRankingBadgeText(listEl));
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.error(err);
    renderNoConnection({
      containerId: "rankingList",
      onRetry: () => initRankingPage(),
    });
  } finally {
    if (rankingFetchController === controller) rankingFetchController = null;
  }
}
