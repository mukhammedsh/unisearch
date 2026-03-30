const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizePath(pathname = "/") {
  const raw = String(pathname || "").trim();
  if (!raw) return "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withSlash.length <= 1) return "/";
  return withSlash.replace(/\/+$/, "");
}

function toQueryString(value) {
  if (!value) return "";
  if (typeof value === "string") return value.replace(/^\?+/, "").trim();
  if (value instanceof URLSearchParams) return value.toString();
  if (typeof value === "object") {
    const params = new URLSearchParams();
    Object.entries(value).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") return;
      params.set(String(k), String(v));
    });
    return params.toString();
  }
  return "";
}

function withQuery(pathname, queryOrParams = "") {
  const q = toQueryString(queryOrParams);
  return q ? `${pathname}?${q}` : pathname;
}

export function usePrettyUrls() {
  if (typeof window === "undefined") return true;
  if (typeof window.APP_USE_PRETTY_URLS === "boolean") return window.APP_USE_PRETTY_URLS;
  const host = String(window.location?.hostname || "").toLowerCase();
  const port = String(window.location?.port || "").trim();
  const isLocal = LOCAL_HOSTS.has(host);
  const isDevStaticHost = !isLocal && ["5501", "5510"].includes(port) && !!host;
  return !(isLocal || isDevStaticHost);
}

export function routeHome(queryOrParams = "") {
  return withQuery(usePrettyUrls() ? "/" : "index.html", queryOrParams);
}

export function routeUniversities(queryOrParams = "") {
  return withQuery(usePrettyUrls() ? "/universities" : "universities.html", queryOrParams);
}

export function routeRanking(queryOrParams = "") {
  return withQuery(usePrettyUrls() ? "/ranking" : "ranking.html", queryOrParams);
}

export function routeGuide(queryOrParams = "") {
  return withQuery(usePrettyUrls() ? "/guide" : "guide.html", queryOrParams);
}

export function routeAbout(queryOrParams = "") {
  return withQuery(usePrettyUrls() ? "/about" : "about.html", queryOrParams);
}

export function routeUniversityDetail(universityId, queryOrParams = "") {
  const id = String(universityId || "").trim();
  if (!id) return routeUniversities(queryOrParams);

  if (usePrettyUrls()) {
    return withQuery(`/universities/${encodeURIComponent(id)}`, queryOrParams);
  }

  const params = new URLSearchParams(toQueryString(queryOrParams));
  params.set("id", id);
  return withQuery("university.html", params);
}

export function isHomePath(pathname = "") {
  const path = normalizePath(pathname).toLowerCase();
  return path === "/" || /\/index(?:\.html)?$/.test(path);
}

export function isUniversitiesListPath(pathname = "") {
  const path = normalizePath(pathname).toLowerCase();
  return /\/universities(?:\.html)?$/.test(path);
}

export function isUniversityDetailPath(pathname = "") {
  const path = normalizePath(pathname).toLowerCase();
  return /\/university(?:\.html)?$/.test(path) || /\/universities\/[^/]+$/.test(path);
}

export function isRankingPath(pathname = "") {
  const path = normalizePath(pathname).toLowerCase();
  return /\/ranking(?:\.html)?$/.test(path);
}

export function isGuidePath(pathname = "") {
  const path = normalizePath(pathname).toLowerCase();
  return /\/guide(?:\.html)?$/.test(path);
}

export function getUniversityIdFromPath(pathname = "") {
  const path = normalizePath(pathname);
  const match = path.match(/\/universities\/([^/]+)$/i);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1] || "").trim();
  } catch (e) {
    return String(match[1] || "").trim();
  }
}

export function extractUniversityIdFromLocation(locationLike = null) {
  const loc = locationLike || (typeof window !== "undefined" ? window.location : null);
  if (!loc) return "";

  try {
    const search = String(loc.search || "");
    const params = new URLSearchParams(search);
    const queryId = String(params.get("id") || "").trim();
    if (queryId) return queryId;
  } catch (e) {
    // continue with path parsing
  }

  return getUniversityIdFromPath(String(loc.pathname || ""));
}

export function applyRouteLinks(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;

  root.querySelectorAll("a[data-route]").forEach((link) => {
    const route = String(link.getAttribute("data-route") || "").trim().toLowerCase();
    if (!route) return;

    let href = "";
    if (route === "home") href = routeHome();
    if (route === "universities") href = routeUniversities();
    if (route === "ranking") href = routeRanking();
    if (route === "guide") href = routeGuide();
    if (route === "about") href = routeAbout();

    if (route === "university") {
      const rawId = String(link.getAttribute("data-route-id") || "").trim();
      if (rawId) href = routeUniversityDetail(rawId);
    }

    if (href) link.setAttribute("href", href);
  });
}
