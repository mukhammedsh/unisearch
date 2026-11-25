const MAP_ASSETS = {
  leafletCss: {
    href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    integrity: "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
  },
  markerClusterCss: {
    href: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css",
    integrity: "sha384-lPzjPsFQL6te2x+VxmV6q1DpRxpRk0tmnl2cpwAO5y04ESyc752tnEWPKDfl1olr",
  },
  markerClusterDefaultCss: {
    href: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css",
    integrity: "sha384-5kMSQJ6S4Qj5i09mtMNrWpSi8iXw230pKU76xTmrpezGnNJQzj0NzXjQLLg+jE7k",
  },
  leafletJs: {
    src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    integrity: "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH",
  },
  markerClusterJs: {
    src: "https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js",
    integrity: "sha384-RLIyj5q1b5XJTn0tqUhucRZe40nFTocRP91R/NkRJHwAe4XxnTV77FXy/vGLiec2",
  },
};

let leafletPromise = null;
let mapLibrariesPromise = null;

function loadStylesheetOnce(id, asset) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const href = String(typeof asset === "string" ? asset : asset?.href || "").trim();
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    if (typeof asset !== "string" && asset?.integrity) link.integrity = asset.integrity;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });
}

function loadScriptOnce(id, asset) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const src = String(typeof asset === "string" ? asset : asset?.src || "").trim();
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    if (typeof asset !== "string" && asset?.integrity) script.integrity = asset.integrity;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function ensureLeaflet() {
  if (window.L && typeof window.L.map === "function") {
    return Promise.resolve(window.L);
  }
  if (!leafletPromise) {
    leafletPromise = Promise.all([
      loadStylesheetOnce("leafletCss", MAP_ASSETS.leafletCss),
      loadScriptOnce("leafletJs", MAP_ASSETS.leafletJs),
    ]).then(() => {
      if (!window.L || typeof window.L.map !== "function") {
        throw new Error("Leaflet is unavailable");
      }
      return window.L;
    }).catch((error) => {
      leafletPromise = null;
      throw error;
    });
  }
  return leafletPromise;
}

export function ensureMapLibraries() {
  if (window.L && typeof window.L.markerClusterGroup === "function") {
    return Promise.resolve(window.L);
  }
  if (!mapLibrariesPromise) {
    mapLibrariesPromise = Promise.all([
      ensureLeaflet(),
      loadStylesheetOnce("leafletMarkerClusterCss", MAP_ASSETS.markerClusterCss),
      loadStylesheetOnce("leafletMarkerClusterDefaultCss", MAP_ASSETS.markerClusterDefaultCss),
    ])
      .then(() => loadScriptOnce("leafletMarkerClusterJs", MAP_ASSETS.markerClusterJs))
      .then(() => {
        if (!window.L || typeof window.L.markerClusterGroup !== "function") {
          throw new Error("Leaflet marker cluster is unavailable");
        }
        return window.L;
      })
      .catch((error) => {
        mapLibrariesPromise = null;
        throw error;
      });
  }
  return mapLibrariesPromise;
}
