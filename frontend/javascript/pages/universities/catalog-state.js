import { loadFilters, saveFilters } from "../../utils.js";

/**
 * Filter state management for university catalog
 */

export function createFilterState(defaults = {}) {
  return {
    q: "",
    country: "",
    region: "",
    city: "",
    study_level: "",
    min_tuition: 0,
    max_tuition: 150000,
    sort: "uni_ai",
    page: 1,
    limit: 24,
    viewMode: "list",
    only_saved: false,
    practice_vs_science: 50,
    social_vs_hardcore: 50,
    budget_vs_prestige: 50,
    city_vs_campus: 50,
    funding_type: "",
    ...defaults
  };
}

export function loadFilterStateFromStorage(key = "universities") {
  const saved = loadFilters(key);
  if (!saved || typeof saved !== "object") return {};
  return saved;
}

export function saveFilterStateToStorage(state, key = "universities") {
  const toSave = {
    q: state.q,
    country: state.country,
    region: state.region,
    city: state.city,
    study_level: state.study_level,
    min_tuition: state.min_tuition,
    max_tuition: state.max_tuition,
    sort: state.sort,
    practice_vs_science: state.practice_vs_science,
    social_vs_hardcore: state.social_vs_hardcore,
    budget_vs_prestige: state.budget_vs_prestige,
    city_vs_campus: state.city_vs_campus,
  };
  saveFilters(key, toSave);
}

export function readFilterStateFromUrl(state, options = {}) {
  const { MAX_TUITION = 150000, MIN_RANGE_GAP = 100, clampTuition = (v) => v } = options;
  const sp = new URL(window.location.href).searchParams;

  if (sp.has("q")) state.q = sp.get("q");
  if (sp.has("country")) state.country = sp.get("country");
  if (sp.has("region")) state.region = sp.get("region");
  if (sp.has("city")) state.city = sp.get("city");
  if (sp.has("study_level")) state.study_level = sp.get("study_level");
  if (sp.has("min_tuition")) state.min_tuition = clampTuition(sp.get("min_tuition"), state.min_tuition);
  if (sp.has("max_tuition")) state.max_tuition = clampTuition(sp.get("max_tuition"), state.max_tuition);
  if (sp.has("only_saved")) state.only_saved = ["1", "true", "yes", "on"].includes(String(sp.get("only_saved") || "").trim().toLowerCase());
  if (sp.has("page")) {
    const page = Number(sp.get("page"));
    if (Number.isFinite(page) && page >= 1) state.page = Math.floor(page);
  }
  if (sp.has("view")) {
    const view = sp.get("view");
    if (view === "map" || view === "list") state.viewMode = view;
  }

  if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
  state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
  if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
    state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
  }

  return sp;
}

export function buildApiParams(state, options = {}) {
  const { forApi = true, isAiSort = false, focusUniId = null, profile = null } = options;
  const p = new URLSearchParams();

  if (state.q) p.set("q", state.q);
  if (state.country) p.set("country", state.country);
  if (state.region) p.set("region", state.region);
  if (state.city) p.set("city", state.city);
  if (state.study_level) p.set("study_level", state.study_level);
  if (state.min_tuition > 0) p.set("min_tuition", String(state.min_tuition));
  if (state.max_tuition < 150000) p.set("max_tuition", String(state.max_tuition));
  if (state.sort && forApi && !isAiSort) p.set("sort", state.sort);

  if (forApi && profile) {
    const major = String(profile?.major || "").trim();
    const mode = String(profile?.studyMode || "").trim();
    if (major) p.set("major", major);
    if (mode && mode.toLowerCase() !== "any") p.set("format", mode);
  }

  if (forApi && state.only_saved) {
    p.set("limit", "2000");
    p.set("page", "1");
  } else if (forApi && state.viewMode === "map") {
    p.set("limit", "200");
    p.set("page", "1");
  } else {
    if (forApi && isAiSort) {
      p.set("limit", "100");
      p.set("page", "1");
    } else {
      p.set("page", String(state.page));
      p.set("limit", String(state.limit));
    }
  }

  if (forApi && state.practice_vs_science !== undefined && state.practice_vs_science !== null) {
    p.set("practice_vs_science", String(state.practice_vs_science));
  }
  if (forApi && state.social_vs_hardcore !== undefined && state.social_vs_hardcore !== null) {
    p.set("social_vs_hardcore", String(state.social_vs_hardcore));
  }
  if (forApi && state.budget_vs_prestige !== undefined && state.budget_vs_prestige !== null) {
    p.set("budget_vs_prestige", String(state.budget_vs_prestige));
  }
  if (forApi && state.city_vs_campus !== undefined && state.city_vs_campus !== null) {
    p.set("city_vs_campus", String(state.city_vs_campus));
  }

  if (state.viewMode) p.set("view", state.viewMode);
  if (!forApi && state.only_saved) p.set("only_saved", "1");
  if (!forApi && focusUniId) p.set("focus_uni", focusUniId);

  return p;
}

export function buildAiSortPayload(state, profile, uiLang, options = {}) {
  const { fundingType = "" } = options;
  const isMapMode = state.viewMode === "map";
  const shouldClientPageSaved = !!state.only_saved;

  const payload = {
    profile,
    lang: uiLang,
    practice_vs_science: state.practice_vs_science,
    social_vs_hardcore: state.social_vs_hardcore,
    budget_vs_prestige: state.budget_vs_prestige,
    city_vs_campus: state.city_vs_campus,
    page: (isMapMode || shouldClientPageSaved) ? 1 : state.page,
    limit: shouldClientPageSaved ? 2000 : (isMapMode ? 200 : state.limit),
  };

  if (state.q) payload.q = state.q;
  if (state.country) payload.country = state.country;
  if (state.region) payload.region = state.region;
  if (state.city) payload.city = state.city;
  if (state.study_level) payload.study_level = state.study_level;
  if (fundingType) payload.funding_type = fundingType;
  if (state.min_tuition) payload.min_tuition = state.min_tuition;
  if (state.max_tuition) payload.max_tuition = state.max_tuition;

  const major = String(profile?.major || "").trim();
  const mode = String(profile?.studyMode || "").trim();
  if (major) payload.major = major;
  if (mode && mode.toLowerCase() !== "any") payload.format = mode;

  return payload;
}

export function buildFallbackListParams(apiParams, state) {
  const fallback = new URLSearchParams(apiParams.toString());
  fallback.set("sort", "name_asc");
  fallback.set("page", state.only_saved ? "1" : String(state.page));
  fallback.set("limit", state.only_saved ? "2000" : String(state.limit));
  return fallback;
}

export function isAiSortMode(sort) {
  return String(sort || "").toLowerCase() === "uni_ai";
}

export function normalizeSortMode(sort, defaultMode = "uni_ai") {
  const normalized = String(sort || "").trim().toLowerCase();
  const validModes = ["uni_ai", "name_asc", "name_desc", "rank_asc", "rank_desc", "cost_asc", "cost_desc"];
  return validModes.includes(normalized) ? normalized : defaultMode;
}
