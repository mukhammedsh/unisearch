import { escapeHtml } from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { t } from "../../i18n.js";
import { ensureLeaflet } from "../universities/map-assets.js";

const COVER_MAP_ZOOM = 15;
const COVER_MAP_MIN_ZOOM = 3;
const COVER_MAP_MAX_ZOOM = 18;
// Match the catalog map's vertical Web Mercator bounds while leaving horizontal room for worldCopyJump.
const COVER_MAP_WORLD_WRAP_BOUNDS = [
  [-58, -540],
  [83, 540],
];
// Trigger only once the 36px campus marker has fully left the cover viewport so the two pins never overlap.
const MARKER_VISIBLE_INSET_PX = -18;
const EDGE_PADDING_PX = 30;

/**
 * Picks the horizontal world-copy longitude of `targetLng` closest to `centerLng` (within ±180°),
 * so the off-screen pointer and fly-back always follow the shortest path around the globe.
 * @param {number} targetLng
 * @param {number} centerLng
 * @returns {number}
 */
export function nearestWrappedLng(targetLng, centerLng) {
  return centerLng + ((((targetLng - centerLng + 180) % 360) + 360) % 360 - 180);
}

/**
 * Extracts finite `[lat, lon]` coordinates from a university coordinates object.
 * @param {{ lat?: unknown, lon?: unknown } | null | undefined} coordinates
 * @returns {[number, number] | null}
 */
export function parseCoverCoordinates(coordinates) {
  const rawLat = coordinates?.lat;
  const rawLon = coordinates?.lon;
  if (rawLat == null || rawLat === "" || rawLon == null || rawLon === "") return null;
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lat, lon];
}

/**
 * Computes edge-clamped position and pointing angle for an off-screen campus marker.
 * Returns `null` when the marker is already visible inside the cover viewport.
 * @param {{ x: number, y: number }} point
 * @param {number} width
 * @param {number} height
 * @returns {{ x: number, y: number, angleDeg: number } | null}
 */
export function computeEdgePointer(point, width, height) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (!(width > 0 && height > 0)) return null;

  if (
    point.x >= MARKER_VISIBLE_INSET_PX
    && point.x <= width - MARKER_VISIBLE_INSET_PX
    && point.y >= MARKER_VISIBLE_INSET_PX
    && point.y <= height - MARKER_VISIBLE_INSET_PX
  ) {
    return null;
  }

  const cx = width / 2;
  const cy = height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const rx = Math.max(1, cx - EDGE_PADDING_PX);
  const ry = Math.max(1, cy - EDGE_PADDING_PX);
  const scaleX = dx !== 0 ? rx / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? ry / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  let x = cx + dx * scale;
  let y = cy + dy * scale;

  // Keep the edge pointer clear of the four corner controls (Back, Show on map, Photo/Map, Zoom).
  const topLeftClear = 78;
  const topRightClearX = Math.max(width - 176, cx);
  const topRightClearY = 68;
  const bottomLeftClearX = 116;
  const bottomLeftClearY = height - 74;
  const bottomRightClearX = width - 78;
  const bottomRightClearY = height - 114;

  if (x < topLeftClear && y < topLeftClear) {
    if (scaleX < scaleY) y = topLeftClear;
    else x = topLeftClear;
  } else if (x > topRightClearX && y < topRightClearY) {
    if (scaleX < scaleY) y = topRightClearY;
    else x = topRightClearX;
  } else if (x < bottomLeftClearX && y > bottomLeftClearY) {
    if (scaleX < scaleY) y = bottomLeftClearY;
    else x = bottomLeftClearX;
  } else if (x > bottomRightClearX && y > bottomRightClearY) {
    if (scaleX < scaleY) y = bottomRightClearY;
    else x = bottomRightClearX;
  }

  x = Math.min(Math.max(x, EDGE_PADDING_PX), width - EDGE_PADDING_PX);
  y = Math.min(Math.max(y, EDGE_PADDING_PX), height - EDGE_PADDING_PX);

  const angleDeg = (Math.atan2(point.y - y, point.x - x) * 180) / Math.PI;
  return { x, y, angleDeg };
}

/**
 * Mounts an embedded Leaflet campus location map inside the university cover box.
 * Supports toggling visibility without reloading tiles via `{ show, hide, dispose }`.
 * @param {HTMLElement} cover
 * @param {{ coordinates?: { lat?: unknown, lon?: unknown } | null, universityName?: string, mapHref?: string }} options
 * @returns {{ show: () => void, hide: () => void, dispose: () => void }}
 */
export function mountCoverMap(cover, { coordinates, universityName = "", mapHref = "" } = {}) {
  const coords = parseCoverCoordinates(coordinates);
  if (!cover || !coords) {
    return { show() {}, hide() {}, dispose() {} };
  }

  let disposed = false;
  let mapInstance = null;
  let markerInstance = null;
  let pinButton = null;
  let resizeObserver = null;
  let isHidden = false;

  cover.classList.add("is-cover-map");

  const stage = document.createElement("div");
  stage.className = "d-cover-map";
  stage.setAttribute("role", "region");
  stage.setAttribute("aria-label", universityName
    ? `${universityName} — ${t("university.action.map", "Map")}`
    : t("university.action.map", "Map"));

  const fallback = document.createElement("div");
  fallback.className = "d-cover-map-fallback";
  fallback.setAttribute("aria-hidden", "true");
  fallback.innerHTML = heroIcon("building-office-2", "ui-icon ui-icon--24");

  const canvas = document.createElement("div");
  canvas.className = "d-cover-map-canvas";
  stage.append(fallback, canvas);
  cover.append(stage);

  let mapLink = null;
  if (mapHref) {
    mapLink = document.createElement("a");
    mapLink.className = "d-cover-map-link";
    mapLink.href = mapHref;
    mapLink.setAttribute("data-route", "universities");
    mapLink.innerHTML = `${heroIcon("map-pin", "ui-icon ui-icon--14")}<span>${escapeHtml(t("university.show_on_map", "Show on map"))}</span>`;
    cover.append(mapLink);
  }

  const recenterLabel = t("university.cover.recenter", "Center on campus");
  const pinLabel = universityName ? `${universityName} — ${recenterLabel}` : recenterLabel;
  const recenterBtn = document.createElement("button");
  recenterBtn.type = "button";
  recenterBtn.className = "d-cover-map-recenter";
  recenterBtn.hidden = true;
  recenterBtn.title = recenterLabel;
  recenterBtn.setAttribute("aria-label", recenterLabel);
  recenterBtn.innerHTML = `<span class="d-cover-map-recenter__arrow" aria-hidden="true"></span><span class="d-cover-map-recenter__icon" aria-hidden="true">${heroIcon("academic-cap", "ui-icon ui-icon--16")}</span>`;
  cover.append(recenterBtn);

  function syncRecenterPosition() {
    if (disposed || !mapInstance || isHidden) {
      recenterBtn.hidden = true;
      return;
    }
    const size = mapInstance.getSize();
    const wrappedLng = nearestWrappedLng(coords[1], mapInstance.getCenter().lng);
    const wrappedCoords = [coords[0], wrappedLng];
    // Keep the marker on the active world copy so it never vanishes across ±360° wraps or after flyTo.
    if (markerInstance && markerInstance.getLatLng().lng !== wrappedLng) {
      markerInstance.setLatLng(wrappedCoords);
    }
    const point = mapInstance.latLngToContainerPoint(wrappedCoords);
    const placement = computeEdgePointer(point, size.x, size.y);
    if (!placement) {
      recenterBtn.hidden = true;
      if (pinButton) pinButton.inert = false;
      return;
    }
    if (pinButton) pinButton.inert = true;
    recenterBtn.style.setProperty("--recenter-x", `${placement.x.toFixed(1)}px`);
    recenterBtn.style.setProperty("--recenter-y", `${placement.y.toFixed(1)}px`);
    recenterBtn.style.setProperty("--recenter-angle", `${placement.angleDeg.toFixed(1)}deg`);
    recenterBtn.hidden = false;
  }

  function recenterOnCampus() {
    if (disposed || !mapInstance) return;
    const target = [coords[0], nearestWrappedLng(coords[1], mapInstance.getCenter().lng)];
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      mapInstance.setView(coords, COVER_MAP_ZOOM, { animate: false });
    } else {
      mapInstance.flyTo(target, COVER_MAP_ZOOM, { duration: 0.55 });
    }
  }

  recenterBtn.addEventListener("click", recenterOnCampus);

  ensureLeaflet()
    .then((L) => {
      if (disposed || !canvas.isConnected) return;
      mapInstance = L.map(canvas, {
        center: coords,
        zoom: COVER_MAP_ZOOM,
        minZoom: COVER_MAP_MIN_ZOOM,
        maxZoom: COVER_MAP_MAX_ZOOM,
        worldCopyJump: true,
        maxBounds: COVER_MAP_WORLD_WRAP_BOUNDS,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomAnimation: true,
        fadeAnimation: true,
        zoomSnap: 1,
        zoomDelta: 1,
        wheelDebounceTime: 30,
        wheelPxPerZoomLevel: 60,
        attributionControl: true,
      });

      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: COVER_MAP_MAX_ZOOM,
        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${escapeHtml(t("universities.map_controls.osm_contributors", "OpenStreetMap contributors"))}</a>`,
      });
      tiles.once("load", () => {
        if (!disposed) stage.classList.add("is-ready");
      });
      tiles.addTo(mapInstance);

      L.control.zoom({
        position: "bottomright",
        zoomInTitle: t("universities.map_controls.zoom_in", "Zoom in"),
        zoomOutTitle: t("universities.map_controls.zoom_out", "Zoom out"),
      }).addTo(mapInstance);

      pinButton = document.createElement("button");
      pinButton.type = "button";
      pinButton.className = "d-cover-map-pin";
      pinButton.title = pinLabel;
      pinButton.setAttribute("aria-label", pinLabel);
      pinButton.innerHTML = heroIcon("academic-cap", "ui-icon ui-icon--16");
      pinButton.addEventListener("click", (event) => {
        if (event.detail !== 0 && mapInstance?.dragging?.moved?.()) return;
        event.stopPropagation();
        recenterOnCampus();
      });
      const pinIcon = L.divIcon({
        className: "d-cover-map-pin-icon",
        html: pinButton,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      markerInstance = L.marker(coords, {
        icon: pinIcon,
        interactive: true,
        keyboard: false,
      });
      markerInstance.on("dblclick", (event) => {
        L.DomEvent.stopPropagation(event);
      });
      markerInstance.addTo(mapInstance);
      mapInstance.on("move zoom moveend zoomend", syncRecenterPosition);
      stage.classList.add("is-mounted");

      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed && mapInstance && !stage.hidden) {
            mapInstance.invalidateSize({ pan: false, animate: false });
            syncRecenterPosition();
          }
        });
        resizeObserver.observe(stage);
      }
    })
    .catch((error) => {
      console.warn("cover_map_init_failed", error);
    });

  return {
    show() {
      if (disposed) return;
      isHidden = false;
      stage.hidden = false;
      if (mapLink) mapLink.hidden = false;
      cover.classList.add("is-cover-map");
      if (mapInstance) {
        requestAnimationFrame(() => {
          if (!disposed && mapInstance) {
            mapInstance.invalidateSize({ pan: false, animate: false });
            syncRecenterPosition();
          }
        });
      }
    },
    hide() {
      if (disposed) return;
      isHidden = true;
      stage.hidden = true;
      if (mapLink) mapLink.hidden = true;
      recenterBtn.hidden = true;
      cover.classList.remove("is-cover-map");
    },
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
      markerInstance = null;
      pinButton = null;
      cover.classList.remove("is-cover-map");
      stage.remove();
      mapLink?.remove();
      recenterBtn.remove();
    },
  };
}
