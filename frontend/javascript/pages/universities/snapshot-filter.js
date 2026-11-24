/* frontend/javascript/pages/universities/snapshot-filter.js */

const LEVEL_ALIASES = {
  bachelor: "undergraduate",
  master: "masters",
  doctorate: "doctoral",
  phd: "doctoral",
  foundation: "preparation",
  "non-degree": "non_degree",
};

const QWERTY_TO_JCUKEN = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з",
  "[": "х", "]": "ъ", a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л",
  l: "д", ";": "ж", "'": "э", z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь",
  ",": "б", ".": "ю", "`": "ё",
};
const JCUKEN_TO_QWERTY = Object.fromEntries(Object.entries(QWERTY_TO_JCUKEN).map(([k, v]) => [v, k]));

const STOP_WORDS = new Set([
  "in", "at", "the", "of", "for", "a", "an", "and", "or", "on", "by", "with", "to", "best", "top",
  "в", "во", "на", "и", "или", "с", "со", "из", "по", "для", "о", "об", "топ", "лучший", "лучшие", "топовые",
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function flipKeyboardLayout(text) {
  let out = "";
  for (const ch of String(text || "").toLowerCase()) {
    out += QWERTY_TO_JCUKEN[ch] || JCUKEN_TO_QWERTY[ch] || ch;
  }
  return out;
}

function tokenizeQuery(raw) {
  const normalized = normalizeText(raw);
  if (!normalized) return [];
  const all = normalized.split(/\s+/).filter(Boolean);
  const meaningful = all.filter((token) => !STOP_WORDS.has(token));
  return meaningful.length ? meaningful : all;
}

function normalizeLevel(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean || clean === "any") return "";
  return LEVEL_ALIASES[clean] || clean;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Return true when the request or visitor profile carries parameters whose card prices
 * depend on server-side scoped catalog cost projections rather than the public snapshot.
 * @param {Record<string, any> | null | undefined} profile
 * @param {Record<string, any>} [params]
 * @returns {boolean}
 */
export function profileRequiresServerCatalogCosts(profile, params = {}) {
  const p = profile && typeof profile === "object" ? profile : {};
  const q = params && typeof params === "object" ? params : {};

  if (String(q.major || "").trim()) return true;
  if (String(q.format || "").trim().toLowerCase() === "online") return true;
  if (String(q.fee_status_context || "").trim() && String(q.fee_status_context).trim().toLowerCase() !== "unknown") return true;
  if (String(q.intended_entry_cycle || "").trim()) return true;

  if (String(p.major || "").trim()) return true;
  if (String(p.studyMode || "").trim().toLowerCase() === "online") return true;
  const profileLevel = normalizeLevel(p.study_level || p.studyLevel);
  if (profileLevel) return true;
  const feeStatus = String(p.fee_status_context || "").trim().toLowerCase();
  if (feeStatus && feeStatus !== "unknown") return true;
  if (String(p.intended_entry_cycle || "").trim()) return true;

  const choices = p.selectedAdmissionChoices;
  if (choices && typeof choices === "object") {
    for (const choice of Object.values(choices)) {
      if (!choice || typeof choice !== "object") continue;
      if (
        choice.studyOptionId
        || choice.applicationRouteId
        || choice.programId
        || choice.studyLevel
        || choice.intendedEntryCycle
        || (choice.feeStatusContext && choice.feeStatusContext !== "unknown")
      ) {
        return true;
      }
    }
  }
  return false;
}

function scoreFieldValues(values, queryNorm, tokens, weight) {
  if (!Array.isArray(values) || !values.length) return 0;
  let best = 0;
  for (const raw of values) {
    const text = normalizeText(raw);
    if (!text) continue;
    if (text === queryNorm) {
      best = Math.max(best, 220 + weight * 10);
      continue;
    }
    if (text.startsWith(queryNorm)) {
      best = Math.max(best, 160 + weight * 8);
      continue;
    }
    if (text.includes(queryNorm)) {
      best = Math.max(best, 110 + weight * 6);
      continue;
    }
    const words = text.split(" ");
    let matchedTokens = 0;
    for (const token of tokens) {
      if (words.some((w) => w === token || w.startsWith(token)) || (token.length >= 3 && text.includes(token))) {
        matchedTokens += 1;
      }
    }
    if (matchedTokens > 0) {
      const ratio = matchedTokens / tokens.length;
      best = Math.max(best, weight * 12 * ratio + (matchedTokens === tokens.length ? 30 : 0));
    }
  }
  return best;
}

function scoreEntrySearch(entry, rawQuery) {
  const candidates = [String(rawQuery || "").trim()];
  const flipped = flipKeyboardLayout(candidates[0]);
  if (flipped && flipped !== candidates[0].toLowerCase()) candidates.push(flipped);

  const search = entry?.meta?.search || {};
  const card = entry?.card || {};
  const aliases = [
    ...(Array.isArray(card.search_aliases) ? card.search_aliases : []),
    ...(Array.isArray(card.abbreviations) ? card.abbreviations : []),
  ];

  let bestScore = 0;
  for (const candidate of candidates) {
    const queryNorm = normalizeText(candidate);
    const tokens = tokenizeQuery(candidate);
    if (!queryNorm || !tokens.length) continue;

    // Require every meaningful query token to appear somewhere across the university's searchable text.
    const combined = normalizeText([
      ...(search.names || []),
      ...aliases,
      ...(search.cities || []),
      ...(search.countries || []),
      ...(search.states || []),
      ...(search.majors || []),
      ...(search.tags || []),
      ...(search.programs || []),
    ].join(" "));
    const allTokensPresent = tokens.every((token) => combined.includes(token));
    if (!allTokensPresent) continue;

    const score = Math.max(
      scoreFieldValues(search.names, queryNorm, tokens, 8.0),
      scoreFieldValues(aliases, queryNorm, tokens, 8.0),
      scoreFieldValues(search.cities, queryNorm, tokens, 4.5),
      scoreFieldValues(search.majors, queryNorm, tokens, 4.5),
      scoreFieldValues(search.countries, queryNorm, tokens, 4.0),
      scoreFieldValues(search.states, queryNorm, tokens, 3.5),
      scoreFieldValues(search.programs, queryNorm, tokens, 3.5),
      scoreFieldValues(search.tags, queryNorm, tokens, 3.0),
    );
    if (score > bestScore) bestScore = score;
  }
  return bestScore;
}

function matchesStudyLevel(entry, requestedLevel) {
  const sl = String(requestedLevel || "").trim().toLowerCase();
  if (!sl || sl === "any") return true;
  const normalized = normalizeLevel(sl);
  const levels = Array.isArray(entry?.meta?.study_levels) ? entry.meta.study_levels : [];
  return levels.some((value) => {
    const x = String(value || "").trim().toLowerCase();
    return x === sl
      || x === normalized
      || (sl === "undergraduate" || sl === "bachelor" ? (x === "undergraduate" || x === "bachelor") : false)
      || (sl === "masters" || sl === "master" ? (x === "masters" || x === "master") : false)
      || ((sl === "doctorate" || sl === "phd" || sl === "doctoral") ? (x === "doctorate" || x === "phd" || x === "doctoral") : false);
  });
}

function resolveEntryCatalogCosts(entry, studyLevel) {
  const normalized = normalizeLevel(studyLevel);
  if (normalized && entry?.costs_by_level && entry.costs_by_level[normalized]) {
    return entry.costs_by_level[normalized];
  }
  return entry?.card?.catalog_costs || {};
}

function quoteRangeUsd(quote, convertToUsd) {
  if (!quote || typeof quote !== "object") return null;
  if (quote.annual_comparable === false) return null;
  const minVal = parseOptionalNumber(quote.min);
  const maxVal = parseOptionalNumber(quote.max);
  if (minVal === null || maxVal === null) return null;
  const currency = String(quote.currency || "USD").trim().toUpperCase();
  const minUsd = currency === "USD" ? minVal : convertToUsd(minVal, currency);
  const maxUsd = currency === "USD" ? maxVal : convertToUsd(maxVal, currency);
  if (!Number.isFinite(minUsd) || !Number.isFinite(maxUsd)) return null;
  return [minUsd, maxUsd];
}

function evaluateTuitionFilter(card, catalogCosts, { minTuition, maxTuition, costBasis, convertToUsd }) {
  const isReviewed = card?.admissions_catalog?.availability === "reviewed";
  let basis = costBasis === "tuition" ? "tuition" : "annual_total";
  let quote = catalogCosts?.[basis];
  let range = quoteRangeUsd(quote, convertToUsd);
  if (!range && basis === "annual_total" && isReviewed) {
    basis = "tuition";
    quote = catalogCosts?.[basis];
    range = quoteRangeUsd(quote, convertToUsd);
  }
  if (!range || !quote) return { matched: false };

  const currency = String(quote.currency || "USD").trim().toUpperCase();
  let filterMatch;
  if (Array.isArray(quote.intervals) && quote.intervals.length || Array.isArray(quote.amounts) && quote.amounts.length) {
    const rawRanges = Array.isArray(quote.intervals) && quote.intervals.length
      ? quote.intervals
      : quote.amounts.map((amount) => ({ min: amount, max: amount }));
    const usdRanges = rawRanges.map((row) => [
      currency === "USD" ? Number(row.min) : convertToUsd(Number(row.min), currency),
      currency === "USD" ? Number(row.max) : convertToUsd(Number(row.max), currency),
    ]);
    if (usdRanges.some(([low, high]) => !Number.isFinite(low) || !Number.isFinite(high))) {
      return { matched: false };
    }
    const anyMatches = usdRanges.some(([low, high]) => (
      (minTuition === null || high >= minTuition) && (maxTuition === null || low <= maxTuition)
    ));
    if (!anyMatches) return { matched: false };
    const allMatch = usdRanges.every(([low, high]) => (
      (minTuition === null || low >= minTuition) && (maxTuition === null || high <= maxTuition)
    ));
    filterMatch = allMatch ? "full" : "partial";
  } else {
    if ((minTuition !== null && range[1] < minTuition) || (maxTuition !== null && range[0] > maxTuition)) {
      return { matched: false };
    }
    filterMatch = (minTuition === null || range[0] >= minTuition) && (maxTuition === null || range[1] <= maxTuition)
      ? "full"
      : "partial";
  }

  if (basis !== (costBasis === "tuition" ? "tuition" : "annual_total")
    || Number(quote.priced_option_count || 0) < Number(quote.candidate_option_count || 0)) {
    filterMatch = "partial";
  }
  return { matched: true, basis, filterMatch };
}

function sortRecords(records, { q, sort, costBasis, convertToUsd }) {
  const mode = String(sort || "name_asc").trim();
  const nameKey = (row) => String(row.card?.name || "").toLowerCase();
  const costMin = (row) => {
    const range = quoteRangeUsd(row.catalogCosts?.[costBasis], convertToUsd);
    return range ? range[0] : null;
  };
  const acceptRate = (row) => parseOptionalNumber(row.entry?.meta?.acceptance_rate);
  const rankNum = (row) => {
    const r = parseOptionalNumber(row.card?.rank);
    return r !== null ? r : null;
  };

  const applyPrimarySort = (list) => {
    if (mode === "tuition_asc") {
      return list.toSorted((a, b) => {
        const ca = costMin(a);
        const cb = costMin(b);
        if (ca === null && cb === null) return nameKey(a).localeCompare(nameKey(b));
        if (ca === null) return 1;
        if (cb === null) return -1;
        return ca - cb;
      });
    }
    if (mode === "tuition_desc") {
      return list.toSorted((a, b) => {
        const ca = costMin(a);
        const cb = costMin(b);
        if (ca === null && cb === null) return nameKey(a).localeCompare(nameKey(b));
        if (ca === null) return 1;
        if (cb === null) return -1;
        return cb - ca;
      });
    }
    if (mode === "acceptance_asc") {
      return list.toSorted((a, b) => {
        const aa = acceptRate(a);
        const ab = acceptRate(b);
        if (aa === null && ab === null) return nameKey(a).localeCompare(nameKey(b));
        if (aa === null) return 1;
        if (ab === null) return -1;
        return aa - ab;
      });
    }
    if (mode === "acceptance_desc") {
      return list.toSorted((a, b) => {
        const aa = acceptRate(a);
        const ab = acceptRate(b);
        if (aa === null && ab === null) return nameKey(a).localeCompare(nameKey(b));
        if (aa === null) return 1;
        if (ab === null) return -1;
        return ab - aa;
      });
    }
    if (mode === "rank_asc") {
      return list.toSorted((a, b) => (rankNum(a) ?? 999999) - (rankNum(b) ?? 999999));
    }
    if (mode === "rank_desc") {
      return list.toSorted((a, b) => (rankNum(b) ?? 0) - (rankNum(a) ?? 0));
    }
    return list.toSorted((a, b) => nameKey(a).localeCompare(nameKey(b)));
  };

  if (q && (mode === "name_asc" || mode === "relevance")) {
    return records.toSorted((a, b) => (b.searchScore - a.searchScore) || nameKey(a).localeCompare(nameKey(b)));
  }
  if (q) {
    const topExact = records
      .filter((row) => row.searchScore >= 200)
      .toSorted((a, b) => (b.searchScore - a.searchScore) || nameKey(a).localeCompare(nameKey(b)));
    const rest = records.filter((row) => row.searchScore < 200);
    return [...topExact, ...applyPrimarySort(rest)];
  }
  return applyPrimarySort(records);
}

function filterCatalogEntries(catalog, rawParams, { convertToUsd }) {
  const params = rawParams instanceof URLSearchParams ? Object.fromEntries(rawParams) : (rawParams || {});
  const q = String(params.q || "").trim();
  const country = String(params.country || "").trim().toLowerCase();
  const region = String(params.region || "").trim().toLowerCase();
  const city = String(params.city || "").trim().toLowerCase();
  const studyLevel = String(params.study_level || "").trim();
  const format = String(params.format || "").trim().toLowerCase();
  const fundingType = String(params.funding_type || "").trim().toLowerCase();
  const minTuition = parseOptionalNumber(params.min_tuition);
  const maxTuition = parseOptionalNumber(params.max_tuition);
  const costBasis = params.cost_basis === "tuition" ? "tuition" : "annual_total";
  const hasPriceFilter = minTuition !== null || maxTuition !== null;

  const matched = [];
  for (const entry of Array.isArray(catalog?.items) ? catalog.items : []) {
    const meta = entry?.meta || {};
    const card = entry?.card;
    if (!card) continue;

    if (country && meta.country !== country) continue;
    if (region && meta.state !== region) continue;
    if (city && meta.city !== city) continue;
    if (studyLevel && !matchesStudyLevel(entry, studyLevel)) continue;
    if (format) {
      const isReviewed = card?.admissions_catalog?.availability === "reviewed";
      const formats = Array.isArray(meta.formats) ? meta.formats : [];
      if (!formats.includes(format) && !(isReviewed && formats.length === 0)) continue;
    }
    if (fundingType === "grant" && meta.has_grant === false) continue;
    if (fundingType === "paid" && meta.has_paid === false) continue;

    let searchScore = 0;
    if (q) {
      searchScore = scoreEntrySearch(entry, q);
      if (searchScore <= 0) continue;
    }

    const baseCosts = resolveEntryCatalogCosts(entry, studyLevel);
    let effectiveCosts = baseCosts;
    if (hasPriceFilter) {
      const result = evaluateTuitionFilter(card, baseCosts, { minTuition, maxTuition, costBasis, convertToUsd });
      if (!result.matched) continue;
      effectiveCosts = {
        ...baseCosts,
        [result.basis]: { ...baseCosts[result.basis], filter_match: result.filterMatch },
      };
    }

    const cardOut = effectiveCosts === card.catalog_costs ? card : { ...card, catalog_costs: effectiveCosts };
    matched.push({ entry, card: cardOut, catalogCosts: effectiveCosts, searchScore });
  }

  return { matched, q, costBasis, params };
}

/**
 * Query, filter, sort, and paginate a static catalog bundle identically to GET /universities.
 * @param {Record<string, any>} catalog
 * @param {URLSearchParams | Record<string, any>} rawParams
 * @param {{ convertToUsd: (amount: number, currency: string) => number }} deps
 * @returns {{ items: Array<Record<string, any>>, count: number, total: number, page: number, limit: number, sort: string }}
 */
export function queryStaticCatalog(catalog, rawParams, { convertToUsd }) {
  const { matched, q, costBasis, params } = filterCatalogEntries(catalog, rawParams, { convertToUsd });
  const sort = String(params.sort || "name_asc").trim() || "name_asc";
  const sorted = sortRecords(matched, { q, sort, costBasis, convertToUsd });
  const total = sorted.length;
  const page = Math.max(1, Number.parseInt(String(params.page || "1"), 10) || 1);
  const limit = Math.max(1, Number.parseInt(String(params.limit || "200"), 10) || 200);
  const start = (page - 1) * limit;
  const items = sorted.slice(start, start + limit).map((row) => row.card);
  return { items, count: items.length, total, page, limit, sort };
}

/**
 * Filter static catalog entries into compact map points inside viewport bounds.
 * @param {Record<string, any>} catalog
 * @param {URLSearchParams | Record<string, any>} rawParams
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 * @param {{ convertToUsd: (amount: number, currency: string) => number }} deps
 * @returns {{ items: Array<Record<string, any>>, count: number, total: number, truncated: boolean }}
 */
export function queryStaticMapPoints(catalog, rawParams, bounds, { convertToUsd }) {
  const { matched, q, costBasis } = filterCatalogEntries(catalog, rawParams, { convertToUsd });
  const sorted = sortRecords(matched, { q, sort: "rank_asc", costBasis, convertToUsd });
  const west = Number(bounds.west);
  const south = Number(bounds.south);
  const east = Number(bounds.east);
  const north = Number(bounds.north);

  const items = [];
  for (const row of sorted) {
    const coords = row.card?.coordinates;
    const lat = parseOptionalNumber(coords?.lat);
    const lon = parseOptionalNumber(coords?.lon);
    if (lat === null || lon === null) continue;
    const lonMatches = west <= east ? (lon >= west && lon <= east) : (lon >= west || lon <= east);
    if (lat < south || lat > north || !lonMatches) continue;
    const point = {
      id: row.card.id,
      name: row.card.name,
      rank: row.card.rank,
      location: {
        country: row.card.location?.country,
        city: row.card.location?.city,
      },
      coordinates: { lat, lon },
      cover_available: Boolean(row.card.cover_available),
    };
    if (row.entry.map_label) point.map_label = row.entry.map_label;
    if (row.card.admissions_catalog) point.admissions_catalog = row.card.admissions_catalog;
    if (row.catalogCosts) point.catalog_costs = row.catalogCosts;
    items.push(point);
  }
  return { items, count: items.length, total: items.length, truncated: false };
}

/**
 * Return up to `limit` top search suggestions from a static catalog bundle.
 * @param {Record<string, any>} catalog
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Array<Record<string, any>>}
 */
export function queryStaticNavbarSearch(catalog, query, limit = 5) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  return queryStaticCatalog(
    catalog,
    { q: trimmed, sort: "relevance", page: 1, limit },
    { convertToUsd: (amount) => amount },
  ).items;
}

/**
 * Filter and paginate a static reviewed institution's study-options payload locally.
 * @param {Record<string, any>} payload
 * @param {{ search?: string, major?: string, study_level?: string, page?: number, limit?: number, translateTitle?: (title: string) => string }} [options]
 * @returns {Record<string, any>}
 */
export function queryStaticStudyOptions(payload, {
  search = "",
  major = "",
  study_level = "",
  page = 1,
  limit = 30,
  translateTitle = null,
} = {}) {
  const level = normalizeLevel(study_level);
  const majorNorm = normalizeText(major);
  const searchRaw = String(search || "").trim();
  const searchVariants = searchRaw ? [searchRaw, flipKeyboardLayout(searchRaw)] : [];
  const searchTokenSets = searchVariants
    .map((candidate) => tokenizeQuery(candidate))
    .filter((tokens) => tokens.length > 0);

  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  const matched = [];
  for (const option of rawItems) {
    if (level && !(Array.isArray(option.levels) && option.levels.includes(level))) continue;
    if (majorNorm) {
      const tags = Array.isArray(option.major_tags) ? option.major_tags.map((tag) => normalizeText(tag)) : [];
      const titleNorm = normalizeText(option.title);
      if (!tags.includes(majorNorm) && titleNorm !== majorNorm) continue;
    }
    let score = 0;
    if (searchTokenSets.length) {
      const localizedTitle = typeof translateTitle === "function" ? translateTitle(option.title) : "";
      const haystack = normalizeText([
        option.title,
        localizedTitle,
        ...(Array.isArray(option.awards) ? option.awards : []),
      ].join(" "));
      let best = 0;
      for (const tokens of searchTokenSets) {
        if (!tokens.every((token) => haystack.includes(token))) continue;
        const phrase = tokens.join(" ");
        best = Math.max(best, haystack.startsWith(phrase) ? 200 : haystack.includes(phrase) ? 140 : 80);
      }
      if (best <= 0) continue;
      score = best;
    }
    matched.push({ option, score });
  }

  const ordered = searchTokenSets.length
    ? matched.toSorted((a, b) => (b.score - a.score)
      || String(a.option.title || "").toLowerCase().localeCompare(String(b.option.title || "").toLowerCase())
      || String(a.option.id || "").localeCompare(String(b.option.id || "")))
    : matched;

  const pageNum = Math.max(1, Number.parseInt(String(page || 1), 10) || 1);
  const limitNum = Math.max(1, Number.parseInt(String(limit || 30), 10) || 30);
  const start = (pageNum - 1) * limitNum;
  const pageItems = ordered.slice(start, start + limitNum).map(({ option }) => {
    const { major_tags: _ignored, ...clean } = option;
    return clean;
  });

  return {
    institution_id: payload.institution_id,
    revision: payload.revision,
    total: ordered.length,
    page: pageNum,
    limit: limitNum,
    shared_routes: (!level || level === "undergraduate") ? (payload.shared_routes || []) : [],
    preparation_entries: (!level || level === "undergraduate" || level === "preparation")
      ? (payload.preparation_entries || [])
      : [],
    items: pageItems,
  };
}
