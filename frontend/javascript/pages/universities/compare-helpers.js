export async function loadCompareUniversities(ids, options = {}) {
  const cleanIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const getRenderedUniversityById = options.getRenderedUniversityById || (() => null);
  const getUniversityDisplayNameById = options.getUniversityDisplayNameById || ((id) => id);
  const fetchUniversityDetailCached = options.fetchUniversityDetailCached;

  const fallbackById = new Map(cleanIds.map((id) => [
    id,
    getRenderedUniversityById(id) || { id, name: getUniversityDisplayNameById(id) },
  ]));

  const universities = await Promise.all(cleanIds.map(async (id) => {
    try {
      const detail = await fetchUniversityDetailCached(id);
      return detail || fallbackById.get(id);
    } catch (error) {
      return fallbackById.get(id);
    }
  }));

  return universities.filter(Boolean);
}

export async function fetchCompareChances(ids, options = {}) {
  const apiBase = String(options.apiBase || "");
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const loadProfileForApi = typeof options.loadProfileForApi === "function"
    ? options.loadProfileForApi
    : () => ({});
  const cleanIds = Array.isArray(ids)
    ? ids.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  const chances = await Promise.all(cleanIds.map(async (id) => {
    try {
      const response = await fetchImpl(`${apiBase}/universities/${encodeURIComponent(id)}/uni-chance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: loadProfileForApi() }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }));

  return new Map(cleanIds.map((id, index) => [id, chances[index]]));
}

export async function resolveAiSortResult(options = {}) {
  const canUseFastFallback = Boolean(options.canUseFastFallback);
  const fetchAi = options.fetchAi;
  const fetchFallback = options.fetchFallback;
  const renderData = typeof options.renderData === "function" ? options.renderData : () => {};
  const isCurrentRun = typeof options.isCurrentRun === "function" ? options.isCurrentRun : () => true;
  const fastFallbackMs = Number(options.fastFallbackMs || 450);
  const onAiError = typeof options.onAiError === "function" ? options.onAiError : () => {};

  if (!canUseFastFallback) {
    try {
      const aiData = await fetchAi();
      if (!aiData?.__aborted && isCurrentRun()) renderData(aiData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      onAiError(error, "direct");
    }
    const fallbackData = await fetchFallback();
    if (!fallbackData?.__aborted && isCurrentRun()) renderData(fallbackData);
    return;
  }

  const aiPromise = fetchAi().catch((error) => {
    if (error?.name !== "AbortError") onAiError(error, "fast-fallback");
    return null;
  });
  const fastAiData = await Promise.race([
    aiPromise,
    new Promise((resolve) => window.setTimeout(() => resolve(null), fastFallbackMs)),
  ]);

  if (fastAiData && !fastAiData.__aborted && isCurrentRun()) {
    renderData(fastAiData);
    return;
  }

  const fallbackData = await fetchFallback();
  if (!fallbackData?.__aborted && isCurrentRun()) {
    renderData(fallbackData);
  }
  const lateAiData = await aiPromise;
  if (lateAiData && !lateAiData.__aborted && isCurrentRun()) renderData(lateAiData);

  return;
}
