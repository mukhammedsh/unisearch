import { t } from "../../i18n.js";
import { escapeHtml, escapeHtmlAttr, initials, nested, loadProfile } from "../../utils.js";
import {
  uniLogoSrc,
  trUniversityName,
  trCity,
  trCountry,
  textOrUnknown,
  moneyOrUnknown,
  unknownFieldText,
  shouldOpenUniversitiesInNewTab,
  rememberRecentUniversity,
  toFiniteNumber
} from "../_shared.js";
import { clusterMarkerLogoHtml, mapMarkerLogoHtml } from "../../university-detail-helpers.js";
import { routeUniversityDetail } from "../../routes.js";

/**
 * Map functionality for university catalog
 */

let mapInstance = null;
let markersLayer = null;
let markersByUniId = new Map();
let activeMapUniId = "";

export function getMapInstance() {
  return mapInstance;
}

export function getActiveMapUniId() {
  return activeMapUniId;
}

export function setActiveMapUniId(id) {
  activeMapUniId = String(id || "").trim();
}

export function initMap(containerId = "mapContainer") {
  if (mapInstance) return mapInstance;
  if (typeof L === "undefined") return null;

  mapInstance = L.map(containerId, {
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
    minZoom: 2,
    maxZoom: 18,
    zoomAnimation: true,
    zoomAnimationThreshold: 4,
    fadeAnimation: true,
    markerZoomAnimation: true,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelDebounceTime: 30,
    wheelPxPerZoomLevel: 120
  }).setView([25, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true }).addTo(mapInstance);

  markersLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    spiderfyOnMaxZoom: true,
    animate: true,
    animationDuration: 1000,
    chunkedLoading: true,
    chunkInterval: 30,
    chunkDelay: 30,
    iconCreateFunction: function(cluster) {
      const markers = cluster.getAllChildMarkers();
      const count = markers.length;
      let best = null;
      for (const m of markers) {
        const r = Number(m?.options?.uniRank);
        if (!Number.isFinite(r)) continue;
        if (!best || r < best.rank) best = { rank: r, id: m?.options?.uniId };
      }
      const fallbackId = markers[0]?.options?.uniId || "default";
      const bestId = (best && best.id) ? best.id : fallbackId;
      const logoUrl = uniLogoSrc(bestId, { forceFull: true });
      return L.divIcon({
        html: clusterMarkerLogoHtml(logoUrl, count - 1),
        className: "cluster-icon-container",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }
  });

  markersLayer.on('clusterclick', function (a) {
    mapInstance.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 });
  });

  mapInstance.on('popupclose', (e) => {
    if (markersByUniId.size === 0) return;
    const source = e.popup && typeof e.popup.getSource === "function" ? e.popup.getSource() : e.popup?._source;
    const closedUniId = source?.options?.uniId;
    if (closedUniId && closedUniId === activeMapUniId) {
      updateMapResultsSelection("");
    }
  });

  mapInstance.addLayer(markersLayer);
  return mapInstance;
}

export function updateMapResultsSelection(uniId, mapResultsContainer) {
  activeMapUniId = String(uniId || "").trim();
  const container = mapResultsContainer || document.getElementById("mapResultsPanel");
  if (!container) return;
  container.querySelectorAll(".u-map-result-card[data-uni-id]").forEach((card) => {
    const isActive = card.getAttribute("data-uni-id") === activeMapUniId;
    card.classList.toggle("is-active", isActive);
  });
}

export function focusMapUniversity(uniId, options = {}) {
  const { openPopup = true, fly = true, zoom = 14 } = options;
  const targetId = String(uniId || "").trim();
  if (!targetId || !mapInstance) return;
  const marker = markersByUniId.get(targetId);
  if (!marker) return;

  const latLng = marker.getLatLng();
  const openTarget = () => {
    marker.setZIndexOffset(1200);
    if (openPopup) marker.openPopup();
  };

  if (fly) {
    mapInstance.once('moveend', openTarget);
    mapInstance.flyTo(latLng, zoom, {
      animate: true,
      duration: 1.0,
      easeLinearity: 0.2
    });
    return;
  }

  mapInstance.panTo(latLng);
  openTarget();
}

export function renderMapResultsPanel(container, items, options = {}) {
  const {
    isCompareSelectionMode = false,
    compareUniversityIds = new Set(),
    toggleCompareUniversity = () => {},
    openUniversityDetail = () => {},
    focusUniId = ""
  } = options;

  if (!container) return;

  const mappedItems = (Array.isArray(items) ? items : []).filter((u) => u?.coordinates?.lat && u?.coordinates?.lon);
  const heading = escapeHtml(t("universities.map_panel.title", "Results on the map"));
  const subheading = escapeHtml(isCompareSelectionMode
    ? t("universities.map_panel.compare_subtitle", "Comparison shortlist on the map.")
    : t("universities.map_panel.subtitle", "Pick a university to center the map and open its details."));

  if (!mappedItems.length) {
    container.innerHTML = `
      <div class="u-map-results-head">
        <h3>${heading}</h3>
        <p>${subheading}</p>
      </div>
      <div class="u-map-results-empty">${escapeHtml(t("universities.map_panel.empty", "No universities with map coordinates match these filters."))}</div>
    `;
    return;
  }

  const visibleItems = mappedItems.slice(0, 10);
  const preferredId = visibleItems.some((u) => String(u.id || "") === activeMapUniId)
    ? activeMapUniId
    : (visibleItems.some((u) => String(u.id || "") === focusUniId) ? String(focusUniId || "") : "");
  activeMapUniId = preferredId;

  container.innerHTML = `
    <div class="u-map-results-head">
      <h3>${heading}</h3>
      <p>${subheading}</p>
    </div>
    <div class="u-map-results-list">
      ${visibleItems.map((u) => {
        const uniId = String(u.id || "");
        const match = u.matchData || {};
        const baseCost =
          (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
          (match.cost !== undefined ? match.cost : null) ??
          nested(u, ["finance", "total_cost_year_usd"], 0);
        const finalCost =
          (match.finalPrice !== undefined ? match.finalPrice : null) ??
          (match.costWithAmountUSD !== undefined ? match.costWithAmountUSD : null) ??
          baseCost;
        const city = String(trCity(u?.location?.city || "") || "").trim();
        const country = String(trCountry(u?.location?.country || "") || "").trim();
        const locationText = [city, country].filter(Boolean).join(", ");
        const rank = toFiniteNumber(u?.rank);
        const detailHref = routeUniversityDetail(uniId);
        const isActive = uniId === preferredId;
        const isCompared = isCompareSelectionMode && compareUniversityIds.has(uniId);
        const compareLabel = isCompared
          ? t("universities.card.compare_selected", "Selected for comparison")
          : t("universities.card.compare", "Add to compare");
        return `
          <article class="u-map-result-card${isActive ? " is-active" : ""}${isCompared ? " is-selected" : ""}" data-uni-id="${escapeHtmlAttr(uniId)}" aria-selected="${isCompared ? "true" : "false"}">
            <button type="button" class="u-map-result-focus" data-uni-focus="${escapeHtmlAttr(uniId)}">
              <span class="u-map-result-logo">
                <img src="${uniLogoSrc(uniId)}" alt="" loading="lazy" decoding="async" data-fallback-src="${escapeHtmlAttr(uniLogoSrc(uniId, { forceFull: true }))}" data-fallback-text="${escapeHtmlAttr(initials(trUniversityName(u) || "U"))}">
              </span>
              <span class="u-map-result-copy">
                <span class="u-map-result-name">${escapeHtml(textOrUnknown(trUniversityName(u), "placeholder.field.university_name", "University name"))}</span>
                <span class="u-map-result-meta">${escapeHtml(locationText || unknownFieldText("placeholder.field.location", "Location"))}</span>
              </span>
              <span class="u-map-result-rank">${rank !== null && rank > 0 ? `#${escapeHtml(String(rank))}` : ""}</span>
            </button>
            <div class="u-map-result-bottom">
              <span class="u-map-result-price">${escapeHtml(moneyOrUnknown(finalCost, "placeholder.field.cost", "Cost"))}</span>
              <a class="u-map-result-link" href="${detailHref}">${escapeHtml(t("universities.card.view_details", "View details →"))}</a>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  container.querySelectorAll("[data-uni-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      if (isCompareSelectionMode) {
        const card = button.closest("[data-uni-id]");
        toggleCompareUniversity(card?.getAttribute("data-uni-id"), card);
      }
      focusMapUniversity(button.getAttribute("data-uni-focus"), {
        openPopup: true,
        fly: true,
        zoom: 14,
      });
    });
  });

  container.querySelectorAll(".u-map-result-card[data-uni-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (!isCompareSelectionMode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, a")) return;
      toggleCompareUniversity(card.getAttribute("data-uni-id"), card);
    });
  });

  container.querySelectorAll(".u-map-result-link").forEach((link) => {
    if (isCompareSelectionMode) {
      link.classList.add("u-map-result-compare-link");
      link.textContent = compareUniversityIds.has(link.closest("[data-uni-id]")?.getAttribute("data-uni-id") || "")
        ? t("universities.card.compare_selected", "Selected for comparison")
        : t("universities.card.compare", "Add to compare");
    }
    link.addEventListener("click", (event) => {
      if (isCompareSelectionMode) {
        const card = link.closest("[data-uni-id]");
        event.preventDefault();
        toggleCompareUniversity(card?.getAttribute("data-uni-id"), card);
        return;
      }
      if (!shouldOpenUniversitiesInNewTab()) return;
      const card = link.closest("[data-uni-id]");
      const uniId = card?.getAttribute("data-uni-id");
      rememberRecentUniversity(uniId);
      event.preventDefault();
      openUniversityDetail(uniId);
    });
  });
}

export function updateMapMarkers(items, options = {}) {
  const {
    renderCard = () => "",
    mapResultsContainer = null,
    mapContainer = null,
    focusUniId = "",
    focusUniDone = false,
    setFocusUniDone = () => {},
    isCompareSelectionMode = false,
    compareUniversityIds = new Set(),
    toggleCompareUniversity = () => {},
    openUniversityDetail = () => {}
  } = options;

  if (!mapInstance || !markersLayer) return;

  markersLayer.clearLayers();
  markersByUniId = new Map();
  const profile = loadProfile();
  const userBudget = parseFloat(profile.budget);

  renderMapResultsPanel(mapResultsContainer, items, {
    isCompareSelectionMode,
    compareUniversityIds,
    toggleCompareUniversity,
    openUniversityDetail,
    focusUniId
  });

  const isCompactViewport = window.matchMedia("(max-width: 768px)").matches;
  const popupOptions = {
    minWidth: isCompactViewport ? 220 : 320,
    maxWidth: isCompactViewport ? 280 : 380,
    className: "custom-map-popup",
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: L.point(20, 20),
    autoPanPaddingBottomRight: L.point(20, 20)
  };

  const newMarkers = [];
  items.forEach(u => {
    if (u.coordinates?.lat && u.coordinates?.lon) {
      const uniId = String(u.id || "");
      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: mapMarkerLogoHtml(uniLogoSrc(uniId, { forceFull: true })),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
      });
      const rankValue = Number(u.rank);
      const marker = L.marker([u.coordinates.lat, u.coordinates.lon], {
        icon: customIcon,
        uniId: uniId,
        uniRank: Number.isFinite(rankValue) ? rankValue : 999999
      });
      const cardHTML = `<div class="map-card-wrapper">${renderCard(u, userBudget)}</div>`;
      marker.bindPopup(cardHTML, popupOptions);
      marker.on('click', function(e) {
        const clickedMarker = this;
        updateMapResultsSelection(uniId, mapResultsContainer);
        clickedMarker.setZIndexOffset(1000);
        mapInstance.once('moveend', () => {
          if (!clickedMarker.getPopup().isOpen()) clickedMarker.openPopup();
        });
        mapInstance.flyTo(e.target.getLatLng(), 16, {
          animate: true,
          duration: 1.0,
          easeLinearity: 0.2
        });
      });
      newMarkers.push(marker);
      markersByUniId.set(uniId, marker);
    }
  });

  markersLayer.addLayers(newMarkers);

  if (focusUniId && !focusUniDone) {
    const target = markersByUniId.get(focusUniId);
    if (target) {
      updateMapResultsSelection(focusUniId, mapResultsContainer);
      setFocusUniDone(true);
      const latLng = target.getLatLng();
      mapInstance.once('moveend', () => {
        target.setZIndexOffset(1200);
        target.openPopup();
      });
      mapInstance.flyTo(latLng, 14, { animate: true, duration: 1.2 });
    }
  }

  if (!focusUniDone) {
    if (activeMapUniId) updateMapResultsSelection(activeMapUniId, mapResultsContainer);
  }
}

export function resetMapResults(mapResultsContainer) {
  if (mapInstance && typeof mapInstance.closePopup === "function") {
    mapInstance.closePopup();
  }
  if (markersLayer) {
    markersLayer.clearLayers();
  }
  markersByUniId = new Map();
  activeMapUniId = "";
  if (mapResultsContainer) mapResultsContainer.innerHTML = "";
}
