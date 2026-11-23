import {
  API_BASE,
  debounce,
  escapeHtml,
  escapeHtmlAttr,
  loadProfileForApi,
  markMotionEnter,
  nested,
  saveFilters,
} from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { getCurrentLanguage, t, tFormat } from "../../i18n.js";
import { routeUniversityDetail } from "../../routes.js";
import {
  fetchUniversityDetailCached,
  rememberRecentUniversity,
  textOrUnknown,
  trCity,
  trCountry,
  trUniversityName,
} from "../_shared.js";
import { ensureMapLibraries } from "./map-assets.js";

const MAP_OVERVIEW_CENTER = [25, 0];
const MAP_MIN_ZOOM = 2;
const MAP_MAX_LATITUDE = 85.0511287798;
// Give worldCopyJump enough horizontal room to normalize a wrapped view,
// while preventing panning beyond the finite north/south extent of Web Mercator.
const MAP_WORLD_WRAP_BOUNDS = [
  [-MAP_MAX_LATITUDE, -540],
  [MAP_MAX_LATITUDE, 540],
];
const MAP_MAX_ZOOM = 18;
const MAP_RESULTS_PAGE_SIZE = 100;

export function createUniversitiesMapController(ctx) {
  const {
    el,
    state,
    apiState,
    savedUniversityIds,
    getFocusUniId,
    isFocusUniDone,
    setFocusUniDone,
    setLastRenderedItems,
    getLastRenderedItems,
    setViewModesReady,
    syncViewModeControls,
    scheduleSyncWorkspaceDepth,
    refreshUnifitLegend,
    updateUnifitWarningBanner,
    renderCompareTray,
    syncCardActionState,
    renderRecentlyViewedBar,
    updateMobileFilterUi,
    isCompareSelectionMode,
    toggleCompareUniversity,
    openUniversityDetail,
    universityLinkAttrs,
    renderCard,
    buildParams,
    buildAiSortPayload,
    fetchUniversities,
    fetchUniversitiesAiSort,
    fetchAndRender,
  } = ctx;

  let disposed = false;
  let mapInstance = null;
  let markersLayer = null;
  let markersByUniId = new Map();
  const mapPopupLoads = new Map();
  let activeMapUniId = "";
  let mapFocusSeq = 0;
  let mapPopupOpenCount = 0;
  let suppressMapCloseClear = false;
  let mapInitPromise = null;
  let mapWarmupScheduled = false;
  let mapResultsItems = [];
  let mapResultsOrder = new Map();
  let mapResultsPage = 0;
  let mapResultsTotal = 0;
  let mapResultsHasMore = false;
  let mapResultsLoadingMore = false;
  let mapResultsLoadFailed = false;
  let mapResultsRunSeq = 0;
  let mapPointsRunSeq = 0;
  let lastMapPointsBounds = null;
  let pendingMapFocusId = "";
  let mapPointsFetchController = null;
  let mapResultsObserver = null;
  let mapResizeTimer = 0;

  const scheduleMapPointsRefresh = debounce(() => {
    if (disposed || state.viewMode !== "map" || !mapInstance) return;
    const visibleBounds = mapInstance.getBounds();
    if (lastMapPointsBounds && lastMapPointsBounds.contains(visibleBounds)) return;
    refreshMapPoints().catch((error) => console.warn("Map points refresh failed", error));
  }, 250);

  function syncMapResultsOrder() {
    mapResultsOrder = new Map(mapResultsItems.map((item, index) => [String(item?.id || "").trim(), index]));
    if (markersLayer && typeof markersLayer.refreshClusters === "function") markersLayer.refreshClusters();
  }

  // A group is named like a single marker: by the university that comes
  // first in the selected sort, plus how many others it holds ("КазНУ +3").
  // Without any label to show it is just the count.
  function mapClusterLabel(cluster) {
    const markers = cluster.getAllChildMarkers();
    const orderOf = (marker) => mapResultsOrder.get(marker.options.uniId) ?? Number.MAX_SAFE_INTEGER;
    const top = markers
      .filter((marker) => marker.options.mapLabel)
      .sort((a, b) => (orderOf(a) - orderOf(b)) || (a.options.mapRank - b.options.mapRank))[0];
    return top ? { text: top.options.mapLabel, count: `+${markers.length - 1}` } : null;
  }

  function updateMapResultsSelection(uniId) {
    activeMapUniId = String(uniId || "").trim();
    if (!el.mapResults) return;
    el.mapResults.querySelectorAll(".u-map-results-list .uni-card[data-uni-id]").forEach((card) => {
      const isActive = card.getAttribute("data-uni-id") === activeMapUniId;
      card.classList.toggle("is-active", isActive);
    });
  }

  // Settles the map before a programmatic flight: closes any open card (its
  // autoPan/keepInView would fight the flight) and stops an in-progress pan
  // animation.
  function settleMapForFlight() {
    suppressMapCloseClear = true;
    try {
      mapInstance.closePopup();
    } finally {
      suppressMapCloseClear = false;
    }
    try {
      if (mapInstance._panAnim) mapInstance._panAnim.stop();
    } catch {
      // Pan-animation internals are version-specific; the flight still works without stopping.
    }
  }

  function flyMapToUniversity(targetId, latLng, { openPopup = true, zoom = 14 } = {}) {
    updateMapResultsSelection(targetId);
    const focusSeq = ++mapFocusSeq;
    const flightStartedAt = Date.now();
    const awaitArrival = () => {
      if (disposed || !mapInstance || focusSeq !== mapFocusSeq || state.viewMode !== "map") {
        if (mapInstance) mapInstance.off("moveend", awaitArrival);
        return;
      }
      if (Date.now() - flightStartedAt > 2500) {
        mapInstance.off("moveend", awaitArrival);
        return;
      }
      let arrived = false;
      try {
        arrived = mapInstance.distance(mapInstance.getCenter(), latLng) < 20;
      } catch {
        arrived = false;
      }
      if (!arrived) return;
      mapInstance.off("moveend", awaitArrival);
      const current = markersByUniId.get(targetId);
      if (current) {
        current.setZIndexOffset(1200);
        if (openPopup) {
          try {
            if (!current.getPopup()?.isOpen()) current.openPopup();
          } catch {
            current.openPopup();
          }
        }
      }
      window.setTimeout(() => {
        if (disposed || focusSeq !== mapFocusSeq || !mapInstance || state.viewMode !== "map") return;
        try {
          if (mapInstance._panAnim) mapInstance._panAnim.stop();
        } catch {
          // Pan-animation internals are version-specific.
        }
      }, 400);
    };
    mapInstance.on("moveend", awaitArrival);
    settleMapForFlight();
    mapInstance.flyTo(latLng, zoom, {
      animate: true,
      duration: 1.0,
      easeLinearity: 0.2,
    });
  }

  function focusMapUniversity(uniId, { openPopup = true, fly = true, zoom = 14 } = {}) {
    const targetId = String(uniId || "").trim();
    if (!targetId || !mapInstance) return;
    if (targetId === activeMapUniId) {
      const current = markersByUniId.get(targetId);
      let popupOpen = false;
      try {
        popupOpen = Boolean(current && typeof current.getPopup === "function" && current.getPopup()?.isOpen());
      } catch {
        popupOpen = false;
      }
      if (popupOpen) return;
    }
    const marker = markersByUniId.get(targetId);
    if (!marker) {
      const item = mapResultsItems.find((row) => String(row?.id || "") === targetId);
      const lat = Number(item?.coordinates?.lat);
      const lon = Number(item?.coordinates?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      pendingMapFocusId = targetId;
      updateMapResultsSelection(targetId);
      settleMapForFlight();
      mapInstance.flyTo([lat, lon], zoom, {
        animate: true,
        duration: 1.0,
        easeLinearity: 0.2,
      });
      return;
    }

    const latLng = marker.getLatLng();
    if (fly) {
      flyMapToUniversity(targetId, latLng, { openPopup, zoom });
      return;
    }

    updateMapResultsSelection(targetId);
    mapInstance.panTo(latLng);
    const current = markersByUniId.get(targetId);
    if (!current) return;
    current.setZIndexOffset(1200);
    if (openPopup) current.openPopup();
  }

  function mapResultsFooterHtml() {
    const shown = mapResultsItems.length;
    const total = Math.max(shown, mapResultsTotal);
    const summary = tFormat(
      "universities.map_panel.showing",
      { count: String(shown), total: String(total) },
      `Showing ${shown} of ${total}`
    );
    const buttonLabel = mapResultsLoadFailed
      ? t("error.retry", "Retry")
      : t("universities.map_panel.load_more", "Load more");
    const loadingText = t("universities.map_panel.loading_more", "Loading more universities");
    return `
      <div class="u-map-results-footer" data-map-results-footer>
        <span class="u-map-results-count" role="status" aria-live="polite">${escapeHtml(summary)}</span>
        ${mapResultsHasMore ? `
          <button type="button" class="u-map-results-more" data-action="load-more-map-results"${mapResultsLoadingMore ? " disabled" : ""}>
            ${mapResultsLoadingMore ? `<span class="u-map-results-spinner" aria-hidden="true"></span>${escapeHtml(loadingText)}` : escapeHtml(buttonLabel)}
          </button>
        ` : `<span class="u-map-results-complete">${escapeHtml(t("universities.map_panel.all_loaded", "All matching universities are loaded"))}</span>`}
      </div>
    `;
  }

  function bindMapResultCards(cards) {
    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest(".ui-tooltip-trigger, .ui-tooltip-wrap, .uni-status-trigger, .uni-metric-trigger, .u-tooltip, .ui-tooltip-bubble, .uni-status-overflow")) return;
        const uniId = String(card.getAttribute("data-uni-id") || "").trim();
        if (!uniId) return;
        const detailsLink = target.closest("a.uni-details");
        if (detailsLink) {
          event.preventDefault();
          if (isCompareSelectionMode()) {
            toggleCompareUniversity(uniId);
            return;
          }
          rememberRecentUniversity(uniId);
          openUniversityDetail(uniId);
          return;
        }
        if (isCompareSelectionMode()) {
          toggleCompareUniversity(uniId);
          return;
        }
        focusMapUniversity(uniId, { openPopup: true, fly: true, zoom: 14 });
      });
    });
  }

  function syncMapResultsObserver() {
    if (mapResultsObserver) {
      mapResultsObserver.disconnect();
      mapResultsObserver = null;
    }
    if (disposed || !mapResultsHasMore || mapResultsLoadingMore || state.viewMode !== "map") return;
    const list = el.mapResults?.querySelector(".u-map-results-list");
    const loadMoreButton = list?.querySelector('[data-action="load-more-map-results"]');
    if (!list || !loadMoreButton || typeof IntersectionObserver === "undefined") return;
    mapResultsObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadNextMapResults().catch((error) => console.warn("Map results pagination failed", error));
    }, { root: list, rootMargin: "0px 0px 320px 0px", threshold: 0.01 });
    mapResultsObserver.observe(loadMoreButton);
  }

  function bindMapResultsFooter() {
    const loadMoreButton = el.mapResults?.querySelector('[data-action="load-more-map-results"]');
    loadMoreButton?.addEventListener("click", () => {
      loadNextMapResults().catch((error) => console.warn("Map results pagination failed", error));
    });
    syncMapResultsObserver();
  }

  function renderMapResultsPanel(items, options = {}) {
    if (!el.mapResults) return;
    const append = options.append === true;
    const nextItems = Array.isArray(items) ? items : [];

    if (!append && !nextItems.length) {
      el.mapResults.innerHTML = `
        <div class="u-map-results-empty">${escapeHtml(t("universities.state.empty", "No universities found."))}</div>
      `;
      return;
    }

    const focusUniId = getFocusUniId();
    const preferredId = mapResultsItems.some((u) => String(u.id || "") === activeMapUniId)
      ? activeMapUniId
      : (mapResultsItems.some((u) => String(u.id || "") === focusUniId) ? String(focusUniId || "") : "");
    activeMapUniId = preferredId;

    const profile = loadProfileForApi();
    const userBudget = Number.parseFloat(profile.budget);
    const cardsHtml = nextItems.map((u, idx) => {
      const uniId = String(u?.id || "");
      return renderCard(u, userBudget, (mapResultsItems.length - nextItems.length) + idx, {
        hideMedia: true,
        mapVariant: true,
        isActive: uniId !== "" && uniId === preferredId,
      });
    }).join("");

    if (!append) {
      el.mapResults.innerHTML = `<div class="u-map-results-list">${cardsHtml}${mapResultsFooterHtml()}</div>`;
      bindMapResultCards(Array.from(el.mapResults.querySelectorAll(".u-map-results-list .uni-card[data-uni-id]")));
    } else {
      const list = el.mapResults.querySelector(".u-map-results-list");
      const footer = list?.querySelector("[data-map-results-footer]");
      if (!list || !footer) {
        renderMapResultsPanel(mapResultsItems);
        return;
      }
      footer.insertAdjacentHTML("beforebegin", cardsHtml);
      footer.outerHTML = mapResultsFooterHtml();
      const appendedIds = new Set(nextItems.map((item) => String(item?.id || "")));
      bindMapResultCards(Array.from(list.querySelectorAll(".uni-card[data-uni-id]")).filter((card) => appendedIds.has(String(card.getAttribute("data-uni-id") || ""))));
    }

    refreshUnifitLegend();
    bindMapResultsFooter();
  }

  function refreshMapResultsFooter() {
    const footer = el.mapResults?.querySelector("[data-map-results-footer]");
    if (!footer) return;
    footer.outerHTML = mapResultsFooterHtml();
    bindMapResultsFooter();
  }

  async function fetchMapResultsPage(page) {
    if (state.sort === "uni_ai") {
      const payload = buildAiSortPayload();
      payload.page = state.only_saved ? 1 : page;
      payload.limit = state.only_saved ? 2000 : MAP_RESULTS_PAGE_SIZE;
      return fetchUniversitiesAiSort(payload);
    }

    const params = buildParams(true);
    params.set("page", String(state.only_saved ? 1 : page));
    params.set("limit", String(state.only_saved ? 2000 : MAP_RESULTS_PAGE_SIZE));
    return fetchUniversities(params);
  }

  async function loadNextMapResults({ reset = false, animateResults = true } = {}) {
    if (disposed || mapResultsLoadingMore || (!reset && !mapResultsHasMore)) return;
    const runSeq = reset ? ++mapResultsRunSeq : mapResultsRunSeq;
    const nextPage = reset ? 1 : mapResultsPage + 1;
    if (reset) {
      mapResultsItems = [];
      mapResultsPage = 0;
      mapResultsTotal = 0;
      mapResultsHasMore = true;
      mapResultsLoadFailed = false;
      syncMapResultsOrder();
    }

    mapResultsLoadingMore = true;
    mapResultsLoadFailed = false;
    refreshMapResultsFooter();

    try {
      const data = await fetchMapResultsPage(nextPage);
      if (disposed || data?.__aborted || runSeq !== mapResultsRunSeq || state.viewMode !== "map") return;

      const rawItems = Array.isArray(data.items) ? data.items : [];
      const pageItems = state.only_saved
        ? rawItems.filter((item) => savedUniversityIds.has(String(item?.id || "").trim()))
        : rawItems;
      const existingIds = new Set(mapResultsItems.map((item) => String(item?.id || "")));
      const uniqueItems = pageItems.filter((item) => {
        const id = String(item?.id || "");
        return id && !existingIds.has(id);
      });

      mapResultsItems = reset ? uniqueItems : mapResultsItems.concat(uniqueItems);
      syncMapResultsOrder();
      mapResultsPage = nextPage;
      mapResultsTotal = state.only_saved ? mapResultsItems.length : Number(data.total || 0);
      mapResultsHasMore = !state.only_saved && (nextPage * MAP_RESULTS_PAGE_SIZE) < mapResultsTotal && rawItems.length > 0;
      setLastRenderedItems(mapResultsItems);
      state.lastCatalogTotal = mapResultsTotal;
      if (el.total) el.total.textContent = String(mapResultsTotal);
      updateUnifitWarningBanner();

      renderMapResultsPanel(uniqueItems, { append: !reset });
      if (animateResults && uniqueItems.length) {
        const cards = Array.from(el.mapResults?.querySelectorAll(".u-map-results-list .uni-card") || []).slice(-uniqueItems.length);
        cards.forEach((card, index) => markMotionEnter(card, null, { limit: 1, staggerMs: Math.min(index * 12, 120) }));
      }
      renderCompareTray();
      syncCardActionState();
      renderRecentlyViewedBar();
      updateMobileFilterUi();
      scheduleSyncWorkspaceDepth();
    } catch (error) {
      if (disposed || runSeq !== mapResultsRunSeq || error?.name === "AbortError") return;
      mapResultsLoadFailed = true;
      mapResultsHasMore = true;
      if (!mapResultsItems.length && el.mapResults) {
        el.mapResults.innerHTML = `
          <div class="u-map-results-list">
            <div class="u-map-results-empty" role="alert">${escapeHtml(t("universities.map_panel.load_failed", "Could not load map results."))}</div>
            ${mapResultsFooterHtml()}
          </div>
        `;
      }
      console.error(error);
    } finally {
      if (!disposed && runSeq === mapResultsRunSeq) {
        mapResultsLoadingMore = false;
        refreshMapResultsFooter();
      }
    }
  }

  function buildMapPointsParams(bounds) {
    const params = buildParams(true);
    ["fields", "page", "limit", "sort", "view", "practice_vs_science", "social_vs_hardcore", "budget_vs_prestige", "city_vs_campus"].forEach((key) => params.delete(key));
    if (state.sort === "uni_ai") params.delete("major");
    params.set("west", String(Math.max(-180, bounds.getWest())));
    params.set("south", String(Math.max(-90, bounds.getSouth())));
    params.set("east", String(Math.min(180, bounds.getEast())));
    params.set("north", String(Math.min(90, bounds.getNorth())));
    return params;
  }

  async function refreshMapPoints({ force = false } = {}) {
    if (disposed || !mapInstance || state.viewMode !== "map") return;
    const visibleBounds = mapInstance.getBounds();
    if (!force && lastMapPointsBounds && lastMapPointsBounds.contains(visibleBounds)) return;

    const requestBounds = visibleBounds.pad(0.35);
    const params = buildMapPointsParams(requestBounds);
    const requestSeq = ++mapPointsRunSeq;
    if (mapPointsFetchController) mapPointsFetchController.abort();
    const controller = new AbortController();
    mapPointsFetchController = controller;

    try {
      let response;
      let profiled = Date.now() >= apiState.profiledEndpointUnavailableUntil;
      if (profiled) {
        const payload = {
          ...Object.fromEntries(params),
          profile: loadProfileForApi(),
          fields: "map",
          sort: "rank_asc",
          page: 1,
          limit: 2000,
        };
        ["west", "south", "east", "north"].forEach((key) => delete payload[key]);
        response = await fetch(`${API_BASE}/universities/profiled`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (response.status === 404 || response.status === 405) {
          apiState.profiledEndpointUnavailableUntil = Date.now() + apiState.cacheTtlMs;
          profiled = false;
        }
      }
      if (!profiled) response = await fetch(`${API_BASE}/universities/map-points?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Map points API error");
      const data = await response.json();
      if (disposed || requestSeq !== mapPointsRunSeq || state.viewMode !== "map") return;
      const west = Number(params.get("west"));
      const east = Number(params.get("east"));
      const south = Number(params.get("south"));
      const north = Number(params.get("north"));
      const points = (Array.isArray(data.items) ? data.items : []).filter((item) => (
        (!state.only_saved || savedUniversityIds.has(String(item?.id || "").trim()))
        && (!profiled || (
          Number(item?.coordinates?.lat) >= south && Number(item?.coordinates?.lat) <= north
          && (west <= east
            ? Number(item?.coordinates?.lon) >= west && Number(item?.coordinates?.lon) <= east
            : Number(item?.coordinates?.lon) >= west || Number(item?.coordinates?.lon) <= east)
        ))
      ));
      lastMapPointsBounds = requestBounds;
      updateMapMarkers(points, { renderResults: false });
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    } finally {
      if (mapPointsFetchController === controller) mapPointsFetchController = null;
    }
  }

  function renderMapPointPopup(item, stateName = "loading") {
    const id = String(item?.id || "").trim();
    const name = textOrUnknown(trUniversityName(item), "placeholder.field.university_name", "University name");
    const country = trCountry(nested(item, ["location", "country"], ""));
    const city = trCity(nested(item, ["location", "city"], ""));
    const locationText = [city, country].filter(Boolean).join(", ");
    const isFailed = stateName === "failed";
    const statusText = isFailed
      ? t("universities.map_popup.failed", "Could not load the university card.")
      : t("universities.map_popup.loading", "Loading university card");
    return `
      <div class="map-card-wrapper map-point-popup" data-uni-id="${escapeHtmlAttr(id)}">
        <div class="map-point-popup__head">
          <span class="map-point-popup__copy">
            <strong>${escapeHtml(name)}</strong>
            ${locationText ? `<span>${escapeHtml(locationText)}</span>` : ""}
          </span>
        </div>
        <span class="map-point-popup__status" role="status">
          ${isFailed ? "" : '<span class="u-map-results-spinner" aria-hidden="true"></span>'}
          ${escapeHtml(statusText)}
        </span>
        <a class="uni-details" href="${routeUniversityDetail(id)}"${universityLinkAttrs()}>${escapeHtml(t("universities.card.view_details", "View details"))}<span aria-hidden="true">→</span></a>
      </div>
    `;
  }

  function renderFullMapPopup(item) {
    const profile = loadProfileForApi();
    const userBudget = Number.parseFloat(profile.budget);
    return `<div class="map-card-wrapper">${renderCard(item, userBudget, 0, { costTooltipScope: "map-popup" })}</div>`;
  }

  function findLoadedMapCard(uniId) {
    return mapResultsItems.find((item) => String(item?.id || "").trim() === uniId) || null;
  }

  async function hydrateMapMarkerPopup(marker, point) {
    const uniId = String(point?.id || "").trim();
    if (!uniId || !marker || disposed) return;

    const loadedCard = findLoadedMapCard(uniId);
    if (loadedCard) {
      marker.setPopupContent(renderFullMapPopup(loadedCard));
      marker.getPopup()?.update();
      syncCardActionState();
      return;
    }

    marker.setPopupContent(renderMapPointPopup(point, "loading"));
    marker.getPopup()?.update();
    const cacheKey = `${getCurrentLanguage() || "eng"}:${uniId}`;
    if (!mapPopupLoads.has(cacheKey)) {
      const request = fetchUniversityDetailCached(uniId).catch((error) => {
        mapPopupLoads.delete(cacheKey);
        throw error;
      });
      mapPopupLoads.set(cacheKey, request);
    }

    try {
      const detail = await mapPopupLoads.get(cacheKey);
      if (disposed || markersByUniId.get(uniId) !== marker) return;
      marker.setPopupContent(renderFullMapPopup({ ...detail, catalog_costs: point.catalog_costs || detail.catalog_costs }));
      marker.getPopup()?.update();
      syncCardActionState();
    } catch (error) {
      if (disposed || markersByUniId.get(uniId) !== marker) return;
      marker.setPopupContent(renderMapPointPopup(point, "failed"));
      marker.getPopup()?.update();
      console.warn("Map university card failed to load", error);
    }
  }

  function updateMapMarkers(items, options = {}) {
    if (disposed || !mapInstance || !markersLayer) return;
    const L = window.L;
    if (!L) return;
    markersLayer.clearLayers();
    markersByUniId = new Map();
    if (options.renderResults !== false) renderMapResultsPanel(items);
    const isCompactViewport = window.matchMedia("(max-width: 768px)").matches;
    const popupOptions = {
      minWidth: isCompactViewport ? 220 : 320,
      maxWidth: isCompactViewport ? 280 : 380,
      className: "custom-map-popup",
      autoPan: true,
      keepInView: true,
      autoPanPaddingTopLeft: L.point(20, 20),
      autoPanPaddingBottomRight: L.point(20, 20),
    };
    const newMarkers = [];
    items.forEach((u, index) => {
      const latitude = Number(u?.coordinates?.lat);
      const longitude = Number(u?.coordinates?.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const uniId = String(u.id || "");
        const mapLabel = String(u.map_label || "").trim();
        const customIcon = L.divIcon({
          className: "custom-div-icon",
          html: `<span class="map-university-marker" aria-hidden="true">${heroIcon("academic-cap", "map-university-marker__icon", { "stroke-width": 2 })}${mapLabel ? `<span class="map-university-marker__label">${escapeHtml(mapLabel)}</span>` : ""}</span>`,
          iconSize: null,
          popupAnchor: [0, -24],
        });
        const marker = L.marker([latitude, longitude], {
          icon: customIcon,
          title: trUniversityName(u),
          uniId,
          mapLabel,
          mapRank: index,
        });
        marker.bindTooltip(escapeHtml(trUniversityName(u)), {
          direction: "top",
          offset: [0, -18],
          className: "map-university-tooltip",
        });
        const loadedCard = findLoadedMapCard(uniId);
        const cardHTML = loadedCard ? renderFullMapPopup(loadedCard) : renderMapPointPopup(u, "loading");
        marker.bindPopup(cardHTML, popupOptions);
        marker.on("popupopen", () => {
          hydrateMapMarkerPopup(marker, u).catch((error) => console.warn("Map university card failed to load", error));
        });
        marker.on("click", function () {
          const clickedMarker = this;
          if (uniId === activeMapUniId) {
            let popupOpen = false;
            try {
              popupOpen = Boolean(clickedMarker.getPopup()?.isOpen());
            } catch {
              popupOpen = false;
            }
            if (!popupOpen) clickedMarker.openPopup();
            return;
          }
          clickedMarker.setZIndexOffset(1000);
          flyMapToUniversity(uniId, clickedMarker.getLatLng(), { openPopup: true, zoom: 16 });
        });
        newMarkers.push(marker);
        markersByUniId.set(uniId, marker);
      }
    });
    markersLayer.addLayers(newMarkers);
    if (pendingMapFocusId && markersByUniId.has(pendingMapFocusId)) {
      const pendingId = pendingMapFocusId;
      pendingMapFocusId = "";
      const pendingMarker = markersByUniId.get(pendingId);
      updateMapResultsSelection(pendingId);
      pendingMarker.setZIndexOffset(1200);
      pendingMarker.openPopup();
    }
    const focusUniId = getFocusUniId();
    if (state.viewMode === "map" && focusUniId && !isFocusUniDone()) {
      const target = markersByUniId.get(focusUniId);
      if (target) {
        updateMapResultsSelection(focusUniId);
        setFocusUniDone(true);
        const latLng = target.getLatLng();
        mapInstance.once("moveend", () => {
          target.setZIndexOffset(1200);
          target.openPopup();
        });
        mapInstance.flyTo(latLng, 14, { animate: true, duration: 1.2 });
      }
    }

    if (!isFocusUniDone() && activeMapUniId) {
      updateMapResultsSelection(activeMapUniId);
    }
  }

  async function initMap() {
    if (disposed) return null;
    if (mapInstance) return mapInstance;
    if (mapInitPromise) return mapInitPromise;
    mapInitPromise = (async () => {
      const L = await ensureMapLibraries();
      if (disposed || mapInstance) return mapInstance;
      const container = document.getElementById("mapContainer");
      if (!container) return null;
      mapInstance = L.map("mapContainer", {
        worldCopyJump: true,
        maxBounds: MAP_WORLD_WRAP_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        zoomControl: false,
        zoomAnimation: true,
        zoomAnimationThreshold: 4,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomSnap: 1,
        zoomDelta: 1,
        wheelDebounceTime: 30,
        wheelPxPerZoomLevel: 60,
        keyboard: true,
      }).setView(MAP_OVERVIEW_CENTER, MAP_MIN_ZOOM);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        noWrap: false,
        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">${escapeHtml(t("universities.map_controls.osm_contributors", "OpenStreetMap contributors"))}</a>`,
      }).addTo(mapInstance);
      L.control.zoom({
        position: "topleft",
        zoomInTitle: t("universities.map_controls.zoom_in", "Zoom in"),
        zoomOutTitle: t("universities.map_controls.zoom_out", "Zoom out"),
      }).addTo(mapInstance);

      markersLayer = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: true,
        animate: true,
        animationDuration: 1000,
        maxClusterRadius: 100,
        chunkedLoading: true,
        chunkInterval: 30,
        chunkDelay: 30,
        iconCreateFunction(cluster) {
          const label = mapClusterLabel(cluster);
          return L.divIcon({
            html: label
              ? `<span class="map-cluster-pill" aria-hidden="true"><span class="map-cluster-pill__place">${escapeHtml(label.text)}</span><span class="map-cluster-pill__count">${escapeHtml(label.count)}</span></span>`
              : `<span class="map-cluster-count" aria-hidden="true">${cluster.getChildCount()}</span>`,
            className: "cluster-icon-container",
            iconSize: null,
          });
        },
      });
      markersLayer.on("clusterclick", (a) => {
        mapInstance?.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 });
      });
      mapInstance.on("popupopen", () => {
        mapPopupOpenCount += 1;
      });
      mapInstance.on("popupclose", (e) => {
        if (suppressMapCloseClear || markersByUniId.size === 0) return;
        const source = e.popup && typeof e.popup.getSource === "function" ? e.popup.getSource() : e.popup?._source;
        const closedUniId = source?.options?.uniId;
        if (closedUniId && closedUniId === activeMapUniId) {
          const closeCount = mapPopupOpenCount;
          window.setTimeout(() => {
            if (disposed || mapPopupOpenCount !== closeCount) return;
            if (closedUniId === activeMapUniId) updateMapResultsSelection("");
          }, 0);
        }
      });
      mapInstance.on("moveend", scheduleMapPointsRefresh);
      mapInstance.addLayer(markersLayer);
      return mapInstance;
    })().catch((error) => {
      mapInitPromise = null;
      throw error;
    });
    return mapInitPromise;
  }

  function warmMapMode() {
    if (disposed || mapInstance || mapWarmupScheduled) return;
    mapWarmupScheduled = true;

    const startWarmup = () => {
      if (disposed) return;
      initMap()
        .then(() => {
          if (disposed) return;
          updateMapMarkers(getLastRenderedItems(), { renderResults: false });
          setViewModesReady(true);
          syncViewModeControls();
        })
        .catch((error) => console.warn("Map warmup failed", error));
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(startWarmup, { timeout: 1000 });
    } else {
      window.setTimeout(startWarmup, 0);
    }
  }

  function applyViewVisibility(mode) {
    if (el.list) el.list.style.display = mode === "list" ? "grid" : "none";
    if (el.pagination) el.pagination.style.display = mode === "list" ? "flex" : "none";
    if (el.mapStage) el.mapStage.style.display = mode === "map" ? "grid" : "none";
    if (mode !== "map" && mapResultsObserver) {
      mapResultsObserver.disconnect();
    }
  }

  async function switchView(mode, shouldFetch = false) {
    state.viewMode = mode;
    saveFilters(state);
    syncViewModeControls();

    const lastRenderedItems = getLastRenderedItems();
    if (mode === "map" && Array.isArray(lastRenderedItems) && lastRenderedItems.length > 0) {
      renderMapResultsPanel(lastRenderedItems);
    }

    applyViewVisibility(mode);
    scheduleSyncWorkspaceDepth();

    if (mode === "map") {
      await initMap();
      if (disposed || state.viewMode !== "map") return;
      const latestItems = getLastRenderedItems();
      if (latestItems.length > 0) {
        updateMapMarkers(latestItems, { renderResults: false });
      }
      window.setTimeout(() => {
        if (!disposed && mapInstance) mapInstance.invalidateSize();
      }, 100);
    }

    if (shouldFetch) {
      fetchAndRender({ preserveVisibleResults: true, animateResults: false });
    }
  }

  function resetForEmptySaved() {
    mapResultsItems = [];
    syncMapResultsOrder();
    mapResultsPage = 0;
    mapResultsTotal = 0;
    mapResultsHasMore = false;
    setLastRenderedItems([]);
    state.lastCatalogTotal = 0;
    if (el.total) el.total.textContent = "0";
    renderMapResultsPanel([]);
    updateMapMarkers([], { renderResults: false });
  }

  function scheduleInvalidateSize(delayMs = 150) {
    if (disposed || state.viewMode !== "map" || !mapInstance) return;
    if (mapResizeTimer) window.clearTimeout(mapResizeTimer);
    mapResizeTimer = window.setTimeout(() => {
      mapResizeTimer = 0;
      if (!disposed && mapInstance) mapInstance.invalidateSize();
    }, delayMs);
  }

  function dispose() {
    disposed = true;
    if (mapResizeTimer) {
      window.clearTimeout(mapResizeTimer);
      mapResizeTimer = 0;
    }
    if (mapResultsObserver) {
      mapResultsObserver.disconnect();
      mapResultsObserver = null;
    }
    mapPointsFetchController?.abort();
    mapPointsFetchController = null;
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch {
        // Ignore teardown errors if DOM node was already detached.
      }
      mapInstance = null;
    }
    markersLayer = null;
    markersByUniId = new Map();
    mapInitPromise = null;
  }

  return {
    switchView,
    initMap,
    warmMapMode,
    loadNextMapResults,
    refreshMapPoints,
    updateMapMarkers,
    resetForEmptySaved,
    scheduleInvalidateSize,
    clearBoundsCache: () => { lastMapPointsBounds = null; },
    hasMapInstance: () => Boolean(mapInstance),
    invalidateSize: (options) => { mapInstance?.invalidateSize(options); },
    getMapResultsCount: () => mapResultsItems.length,
    dispose,
  };
}
