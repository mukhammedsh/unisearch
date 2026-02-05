/* 4. pages.js - ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ */

import {
  API_BASE,
  $,
  debounce,
  loadFilters,
  saveFilters,
  setUrlParams,
  nested,
  escapeHtml,
  initials,
  moneyUSD,
  loadProfile,
  getFlagImg,
  initCustomSelect,
  CITY_OPTIONS_BY_COUNTRY,
  getExamDisplayName,
  EXAM_CONFIG,
  LANG_CONFIG,
  aiName,
} from "./utils.js";

import { getUniSort } from "./algo.js";
import { estimateUniChance } from "./ai/unichance.js";
import { initUniMentor } from "./ai/mentor.js";
import { setupTabs } from "./components.js";

// =====================================
// PAGE: UNIVERSITIES LIST (Список вузов)
// =====================================
export function initUniversitiesPage() {
    const MAX_TUITION = 150000;
    const MIN_RANGE_GAP = 100;
    const clampTuition = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(0, Math.min(MAX_TUITION, Math.round(n)));
    };

    const el = {
        qInput: $("qInput"), countrySelect: $("countrySelect"), stateDiv: $("stateDiv"),
        stateSelect: $("stateSelect"), citySelect: $("citySelect"),
        minInput: $("minCostInput"), maxInput: $("maxCostInput"),
        minSlider: $("minCostSlider"), maxSlider: $("maxCostSlider"), track: $("sliderTrack"),
        sortSelect: $("sortSelect"), sliderContainer: $("aiSliderContainer"),
        slider: $("uniFitSlider"), sliderLabel: $("sliderLabel"), resetBtn: $("resetFiltersBtn"),
        list: $("universitiesList"), mapContainer: $("mapContainer"), total: $("totalCount"), 
        state: $("listState"), pagination: $("pagination"),
        btnList: $("viewListBtn"), btnMap: $("viewMapBtn")
    };

    if (!el.list) return;

    const applyAISortOptionLabel = () => {
        if (!el.sortSelect) return;
        const aiOpt = el.sortSelect.querySelector('option[value="uni_ai"]');
        if (aiOpt) aiOpt.textContent = `✨ ${aiName("fit")}: AI Smart Sort`;
    };
    applyAISortOptionLabel();

    const savedState = loadFilters();
    const initialMin = clampTuition(savedState.min_tuition, 0);
    const initialMax = clampTuition(savedState.max_tuition, MAX_TUITION);
    const state = {
        q: savedState.q || "", country: savedState.country || "", region: savedState.region || "", 
        city: savedState.city || "", study_level: savedState.study_level || "", 
        min_tuition: initialMin,
        max_tuition: Math.max(initialMax, initialMin + MIN_RANGE_GAP), 
        sort: savedState.sort || "uni_ai", ai_balance: savedState.ai_balance !== undefined ? savedState.ai_balance : 50, 
        viewMode: savedState.viewMode || "list", page: 1, limit: 12,
    };
    if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
    state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
    if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
        state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
    }
    let focusUniId = "";
    let focusUniDone = false;

    // --- Слайдеры ---
    function fillTrack() {
        if (!el.minSlider || !el.maxSlider || !el.track) return;
        const minVal = parseInt(el.minSlider.value); const maxVal = parseInt(el.maxSlider.value); const maxRange = parseInt(el.maxSlider.max);
        const percent1 = (minVal / maxRange) * 100; const percent2 = (maxVal / maxRange) * 100;
        const styles = getComputedStyle(document.documentElement);
        const inactive = (styles.getPropertyValue("--slider-track-inactive") || "#d4d8e0").trim();
        const active = (styles.getPropertyValue("--slider-track-active") || "#5d17ea").trim();
        el.track.style.background = `linear-gradient(to right, ${inactive} ${percent1}%, ${active} ${percent1}%, ${active} ${percent2}%, ${inactive} ${percent2}%)`;
    }
    function slideMin() {
        let minVal = parseInt(el.minSlider.value);
        const maxVal = parseInt(el.maxSlider.value);
        if (maxVal - minVal <= MIN_RANGE_GAP) {
            minVal = Math.max(0, maxVal - MIN_RANGE_GAP);
            el.minSlider.value = String(minVal);
        }
        el.minInput.value = el.minSlider.value; state.min_tuition = el.minSlider.value; fillTrack();
    }
    function slideMax() {
        const minVal = parseInt(el.minSlider.value);
        let maxVal = parseInt(el.maxSlider.value);
        if (maxVal - minVal <= MIN_RANGE_GAP) {
            maxVal = Math.min(MAX_TUITION, minVal + MIN_RANGE_GAP);
            el.maxSlider.value = String(maxVal);
        }
        el.maxInput.value = el.maxSlider.value; state.max_tuition = el.maxSlider.value; fillTrack();
    }

    // --- Карта ---
    let mapInstance = null;
    let markersLayer = null;
    let markersByUniId = new Map();

    readFromUrl(); 
    
    const initLocations = () => {
        updateCountryOptions();
        if (state.country) {
            if (el.countrySelect) el.countrySelect.value = state.country;
            updateLocationLogic(state.country);
            if (state.region && el.stateSelect) { el.stateSelect.value = state.region; updateCitiesForState(state.country, state.region); }
            if (state.city && el.citySelect) el.citySelect.value = state.city;
        }
        applyToForm();
    };
    
    if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) initLocations();
    window.addEventListener("citiesLoaded", initLocations);

    applyToForm();
    updateSliderVisibility(); 
    
    switchView(state.viewMode, false);
    
    const refetch = debounce(() => { 
        state.page = 1; 
        saveFilters(state);
        fetchAndRender(); 
    }, 250);

    // --- Listeners ---
    el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
    
    el.countrySelect?.addEventListener("change", () => {
        state.country = el.countrySelect.value; state.region = ""; state.city = ""; 
        if(el.stateSelect) el.stateSelect.value = ""; if(el.citySelect) el.citySelect.value = "";
        updateLocationLogic(state.country); refetch();
    });
    
    el.stateSelect?.addEventListener("change", () => { state.region = el.stateSelect.value; state.city = ""; updateCitiesForState(state.country, state.region); refetch(); });
    el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
    
    if ($("studyLevelSelect")) $("studyLevelSelect").addEventListener("change", () => { state.study_level = $("studyLevelSelect").value; refetch(); });

    el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; updateSliderVisibility(); refetch(); });
    el.slider?.addEventListener("input", () => { state.ai_balance = parseInt(el.slider.value); updateSliderLabel(); refetch(); });

    el.resetBtn?.addEventListener("click", () => {
        Object.assign(state, { q: "", country: "", region: "", city: "", study_level: "", min_tuition: 0, max_tuition: MAX_TUITION, sort: "uni_ai", ai_balance: 50, page: 1 });
        saveFilters(state);
        applyToForm();
        if (el.stateDiv) el.stateDiv.style.display = "none"; 
        updateCityDropdown([]); 
        updateSliderVisibility(); 
        fetchAndRender();
    });

    el.list.addEventListener("click", (e) => {
        const card = e.target.closest("[data-uni-id]");
        if (!card || e.target.tagName === "A") return;
        window.location.href = `university.html?id=${encodeURIComponent(card.getAttribute("data-uni-id"))}`;
    });

    el.btnList?.addEventListener("click", () => { switchView("list", true); });
    el.btnMap?.addEventListener("click", () => { switchView("map", true); });

    if (el.minSlider && el.maxSlider) {
        el.minSlider.addEventListener("input", slideMin);
        el.maxSlider.addEventListener("input", slideMax);
        el.minSlider.addEventListener("change", () => refetch());
        el.maxSlider.addEventListener("change", () => refetch());
    }

    el.minInput?.addEventListener("change", () => {
        let val = clampTuition(el.minInput.value, 0);
        if (val >= parseInt(el.maxSlider.value)) val = Math.max(0, parseInt(el.maxSlider.value) - MIN_RANGE_GAP);
        el.minSlider.value = val; state.min_tuition = val; fillTrack(); refetch();
    });

    el.maxInput?.addEventListener("change", () => {
        let val = clampTuition(el.maxInput.value, MAX_TUITION);
        if (val <= parseInt(el.minSlider.value)) val = Math.min(MAX_TUITION, parseInt(el.minSlider.value) + MIN_RANGE_GAP);
        el.maxSlider.value = val; state.max_tuition = val; fillTrack(); refetch();
    });

    fetchAndRender(); 
    window.addEventListener("profileUpdated", () => fetchAndRender());

    function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);
        if (mode === "map") {
            el.list.style.display = "none"; el.pagination.style.display = "none"; 
            el.mapContainer.style.display = "block"; el.btnList.classList.remove("active"); el.btnMap.classList.add("active");
            initMap(); setTimeout(() => { if(mapInstance) mapInstance.invalidateSize(); }, 100);
            if (shouldFetch) fetchAndRender(); 
        } else {
            el.list.style.display = "grid"; el.pagination.style.display = "flex"; el.mapContainer.style.display = "none";
            el.btnList.classList.add("active"); el.btnMap.classList.remove("active");
            if (shouldFetch) fetchAndRender();
        }
    }

    function initMap() {
        if (mapInstance) return;
        if (typeof L === "undefined") return;
        mapInstance = L.map('mapContainer', { maxBounds: [[-90, -180], [90, 180]], maxBoundsViscosity: 1.0, minZoom: 2, maxZoom: 19, zoomAnimation: true, markerZoomAnimation: true }).setView([25, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true }).addTo(mapInstance);
        markersLayer = L.markerClusterGroup({
            showCoverageOnHover: false, zoomToBoundsOnClick: false, spiderfyOnMaxZoom: true, animate: true, animationDuration: 1000,
            iconCreateFunction: function(cluster) {
                const markers = cluster.getAllChildMarkers(); const count = markers.length;
                const firstMarkerHtml = markers[0].options.icon.options.html;
                const idMatch = firstMarkerHtml.match(/logos\/(.+?)\.png/);
                const firstId = idMatch ? idMatch[1] : 'default';
                const logoUrl = `images/logos/${firstId}.png`;
                return L.divIcon({ html: `<div class="cluster-node-fix"><div class="map-marker-container"><div class="marker-img-inner" style="background-image: url('${logoUrl}');"></div></div><div class="cluster-badge">+${count - 1}</div></div>`, className: 'cluster-icon-container', iconSize: [44, 44], iconAnchor: [22, 22] });
            }
        });
        markersLayer.on('clusterclick', function (a) { mapInstance.flyToBounds(a.layer.getBounds(), { padding: [80, 80], duration: 1.0 }); });
        mapInstance.addLayer(markersLayer);
    }

    function updateMapMarkers(items) {
        if (!mapInstance || !markersLayer) return;
        markersLayer.clearLayers();
        markersByUniId = new Map();
        const profile = loadProfile(); const userBudget = parseFloat(profile.budget);
        const newMarkers = [];
        items.forEach(u => {
            if (u.coordinates?.lat && u.coordinates?.lon) {
                const customIcon = L.divIcon({ className: 'custom-div-icon', html: `<div class="map-marker-container"><div class="marker-img-inner" style="background-image: url('images/logos/${u.id}.png');"></div></div>`, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -24] });
                const marker = L.marker([u.coordinates.lat, u.coordinates.lon], { icon: customIcon });
                const cardHTML = `<div class="map-card-wrapper">${renderCard(u, userBudget)}</div>`;
                marker.bindPopup(cardHTML, { minWidth: 280, maxWidth: 320, className: 'custom-map-popup', autoPan: false });
                marker.on('click', function(e) { this.setZIndexOffset(1000); mapInstance.flyTo(e.target.getLatLng(), 16, { animate: true, duration: 3.0, easeLinearity: 0.1 }); setTimeout(() => { if (!marker.getPopup().isOpen()) marker.openPopup(); }, 100); });
                newMarkers.push(marker);
                markersByUniId.set(String(u.id), marker);
            }
        });
        markersLayer.addLayers(newMarkers);
        if (state.viewMode === "map" && focusUniId && !focusUniDone) {
            const target = markersByUniId.get(focusUniId);
            if (target) {
                focusUniDone = true;
                const latLng = target.getLatLng();
                mapInstance.flyTo(latLng, 14, { animate: true, duration: 1.2 });
                setTimeout(() => {
                    target.setZIndexOffset(1200);
                    target.openPopup();
                }, 700);
            }
        }
    }

    function updateSliderVisibility() {
        if (!el.sliderContainer) return;
        if (state.sort === "uni_ai") { el.sliderContainer.style.display = "block"; updateSliderLabel(); } 
        else { el.sliderContainer.style.display = "none"; }
    }
    function updateSliderLabel() {
        if (!el.sliderLabel) return;
        const val = state.ai_balance;
        let text = "Balanced (50/50)";
        if (val <= 20) text = "Strict Budget Priority 💰";
        else if (val >= 80) text = "Top Prestige Priority 🏆";
        else if (val < 50) text = `Focus on Budget (${100-val}%)`;
        else text = `Focus on Prestige (${val}%)`;
        el.sliderLabel.textContent = text;
    }
    
    function buildParams(forApi = false) {
        const p = new URLSearchParams();
        if (state.q) p.set("q", state.q); if (state.country) p.set("country", state.country);
        if (state.region) p.set("region", state.region); if (state.city) p.set("city", state.city);
        if (state.min_tuition) p.set("min_tuition", state.min_tuition);
        if (state.max_tuition) p.set("max_tuition", state.max_tuition);
        if (state.study_level) p.set("study_level", state.study_level);

        const isAiSort = (state.sort === "uni_ai");
        p.set("sort", forApi ? (isAiSort ? "name_asc" : state.sort) : state.sort);
        
        if (forApi && state.viewMode === "map") {
            p.set("limit", "200"); p.set("page", "1");
        } else {
            if (forApi && isAiSort) { p.set("limit", "100"); p.set("page", "1"); } 
            else { p.set("page", String(state.page)); p.set("limit", String(state.limit)); }
        }
        if (state.ai_balance !== undefined && state.ai_balance !== null) p.set("ai_balance", String(state.ai_balance));
        if (state.viewMode) p.set("view", state.viewMode);
        if (!forApi && focusUniId) p.set("focus_uni", focusUniId);
        return p;
    }

    function applyToForm() {
        if(el.qInput) el.qInput.value = state.q; if(el.countrySelect) el.countrySelect.value = state.country;
        if(el.stateSelect) el.stateSelect.value = state.region; if(el.citySelect) el.citySelect.value = state.city;
        if(el.slider) el.slider.value = state.ai_balance;
        if (el.minSlider) el.minSlider.value = state.min_tuition;
        if (el.maxSlider) el.maxSlider.value = state.max_tuition;
        if (el.minInput) el.minInput.value = state.min_tuition;
        if (el.maxInput) el.maxInput.value = state.max_tuition;
        
        fillTrack(); 

        ["countrySelect", "stateSelect", "citySelect", "sortSelect", "studyLevelSelect"].forEach(id => initCustomSelect(id));
    }

    function updateLocationLogic(country) {
        if (!el.stateDiv) return;
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (!country || !countryData) { el.stateDiv.style.display = "none"; updateCityDropdown([]); return; }
        if (Array.isArray(countryData)) { el.stateDiv.style.display = "none"; updateCityDropdown(countryData); } 
        else {
            el.stateDiv.style.display = "block"; 
            const states = Object.keys(countryData).sort();
            el.stateSelect.innerHTML = `<option value="">All States / Regions</option>`;
            states.forEach(s => { el.stateSelect.innerHTML += `<option value="${s}">${s}</option>`; });
            initCustomSelect("stateSelect");
            updateCityDropdown([]);
        }
    }
    function updateCitiesForState(country, region) {
        if (!country || !region) { updateCityDropdown([]); return; }
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (countryData && !Array.isArray(countryData)) { updateCityDropdown(countryData[region] || []); }
    }
    function updateCityDropdown(cities) {
        if (!el.citySelect) return;
        if (!cities || cities.length === 0) { el.citySelect.innerHTML = `<option value="">Select region/country first</option>`; el.citySelect.disabled = true; } 
        else { el.citySelect.disabled = false; el.citySelect.innerHTML = `<option value="">All Cities</option>`; cities.sort().forEach(c => { const opt = document.createElement("option"); opt.value = c; opt.textContent = c; el.citySelect.appendChild(opt); }); }
        initCustomSelect("citySelect");
    }
    function updateCountryOptions() {
        if (!el.countrySelect) return;
        const countries = Object.keys(CITY_OPTIONS_BY_COUNTRY).sort();
        const currentVal = el.countrySelect.value || state.country;
        let html = `<option value="">🌍 Global</option>`;
        countries.forEach(c => { 
            const isSelected = (c === currentVal) ? "selected" : ""; 
            html += `<option value="${c}" ${isSelected}>${c}</option>`; 
        });
        el.countrySelect.innerHTML = html;
        initCustomSelect("countrySelect");
    }
    function readFromUrl() {
        const sp = new URL(window.location.href).searchParams;
        if(sp.has("q")) state.q = sp.get("q");
        if(sp.has("country")) state.country = sp.get("country");
        if(sp.has("region")) state.region = sp.get("region");
        if(sp.has("city")) state.city = sp.get("city");
        if(sp.has("study_level")) state.study_level = sp.get("study_level");
        if(sp.has("min_tuition")) state.min_tuition = clampTuition(sp.get("min_tuition"), state.min_tuition);
        if(sp.has("max_tuition")) state.max_tuition = clampTuition(sp.get("max_tuition"), state.max_tuition);
        if(sp.has("sort")) state.sort = sp.get("sort");
        if(sp.has("ai_balance")) {
            const ab = Number(sp.get("ai_balance"));
            if (Number.isFinite(ab)) state.ai_balance = Math.max(0, Math.min(100, Math.round(ab)));
        }
        if(sp.has("page")) {
            const page = Number(sp.get("page"));
            if (Number.isFinite(page) && page >= 1) state.page = Math.floor(page);
        }
        if(sp.has("view")) {
            const view = sp.get("view");
            if (view === "map" || view === "list") state.viewMode = view;
        }
        if (sp.has("focus_uni")) {
            const id = String(sp.get("focus_uni") || "").trim();
            if (id) focusUniId = id;
        }

        if (state.min_tuition > (MAX_TUITION - MIN_RANGE_GAP)) state.min_tuition = MAX_TUITION - MIN_RANGE_GAP;
        state.max_tuition = Math.min(MAX_TUITION, state.max_tuition);
        if (state.max_tuition < state.min_tuition + MIN_RANGE_GAP) {
            state.max_tuition = state.min_tuition + MIN_RANGE_GAP;
        }
    }

    async function fetchAndRender() {
        if (el.state && state.viewMode === 'list') el.state.textContent = "Loading...";
        if (state.viewMode === 'list') el.list.innerHTML = "";
        if (el.pagination) el.pagination.innerHTML = "";

        const urlParams = buildParams(false);
        const apiParams = buildParams(true);
        setUrlParams(urlParams);

        try {
        const res = await fetch(`${API_BASE}/universities?${apiParams.toString()}`);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        let items = data.items || [];
        const total = data.total || 0;
        const isAiSort = (state.sort === "uni_ai");
        
        if (state.viewMode === 'list') {
            let displayItems = items;
            let displayTotal = total;

            if (isAiSort) { 
                items = getUniSort(items, state.ai_balance, state); 
                displayTotal = items.length;
                const start = (state.page - 1) * state.limit;
                const end = start + state.limit;
                displayItems = items.slice(start, end);
            }

            if (el.total) el.total.textContent = String(displayTotal);
            
            if (!displayItems.length) { 
                if (el.state) el.state.textContent = "No universities found."; 
                return; 
            }
            if (el.state) el.state.textContent = "";
            const profile = loadProfile();
            const userBudget = parseFloat(profile.budget);
            
            el.list.innerHTML = displayItems.map(u => renderCard(u, userBudget)).join("");
            renderPagination(displayTotal);
        } else if (state.viewMode === 'map') {
            if (el.total) el.total.textContent = String(items.length);
            updateMapMarkers(items);
            if (el.state) el.state.textContent = "";
        }

        } catch (err) {
        console.error(err);
        if (el.state) el.state.textContent = "Failed to load data.";
        }
    }

    // --- RENDER CARD (БЕЗ ROI) ---
    function renderCard(u, myBudget) {
        const id = u.id; const name = u.name; const country = nested(u, ["location", "country"], "");
        const city = nested(u, ["location", "city"], ""); 
        let locString = city;
        if (country) {
            const flagHtml = getFlagImg(country);
            locString = city 
                ? `<div style="display:flex; align-items:center; gap:6px;">${city}, ${flagHtml} ${country}</div>`
                : `<div style="display:flex; align-items:center; gap:6px;">${flagHtml} ${country}</div>`;
        }
        const match = u.matchData || {};

        // Базовая цена (трековая, если algo её дал)
        const baseCost =
        (match.costYearUSD !== undefined ? match.costYearUSD : null) ??
        nested(u, ["finance", "total_cost_year_usd"], 0);

        // Итоговая цена с учётом scholarship amount (если есть)
        const cost =
        (match.costWithAmountUSD !== undefined ? match.costWithAmountUSD : null) ??
        baseCost;

        let badgesHTML = "";

        // “Есть ли вообще aid/grants”
        const aidAnyFallback =
        !!(u.finance?.financial_aid?.merit_based || u.finance?.financial_aid?.need_based) ||
        (Array.isArray(u.admission_tracks) && u.admission_tracks.some(t => Array.isArray(t?.scholarships) && t.scholarships.length > 0));

        const aidAny =
        (match.aidAvailable !== undefined) ? !!match.aidAvailable : aidAnyFallback;

        // “Юзер проходит на грант/aid по требованиям”
        const aidEligible =
        (match.grantEligible !== undefined) ? !!match.grantEligible : !!match.grantName;

        // ВАЖНО: если aidEligible=true, ты сам писал “no budget penalty”
        // значит overBudget считаем только когда aidEligible=false
        const overBudget = (myBudget > 0 && cost > myBudget && !aidEligible);

        const badges = [];

        if (match.meetMinRequirements) {
            badges.push(
                `<span class="uni-pill uni-pill--neutral">✅ Requirements Met</span>`
            );
        } else if (match.trackLabel) {
            badges.push(
                `<span class="uni-pill uni-pill--warn">⚠️ Below Requirements</span>`
            );
        }


        // Grant/Aid badges
        if (match.grantName) {
        badges.push(
            `<span class="uni-pill uni-pill--success">🏆 ${match.grantName}</span>`
        );
        } else if (overBudget) {
        if (aidEligible) {
            badges.push(
            `<span class="uni-pill uni-pill--success">🎓 Grant/Aid Likely (no budget penalty)</span>`
            );
        } else if (aidAny) {
            badges.push(
            `<span class="uni-pill uni-pill--warn">💸 Over Budget • Aid Available</span>`
            );
        } else {
            badges.push(
            `<span class="uni-pill uni-pill--budget">💰 Over Budget</span>`
            );
        }
        } else {
        // Не over budget
        if (aidAny) {
            badges.push(
            `<span class="uni-pill uni-pill--success">🎓 Aid Available</span>`
            );
        }
        }

        // Fallback: acceptance
        if (badges.length === 0) {
        const acc = u.academics?.acceptance_rate_percent;
        badges.push(
            `<span class="uni-pill uni-pill--neutral">Acceptance: ${acc ?? "—"}%</span>`
        );
        }

        badgesHTML = badges.join(" ");

        
        // ROI УБРАН ПОЛНОСТЬЮ

        const logoSrc = `images/logos/${id}.png`; 
        const thumbSrc = `images/thumbnails/${id}.jpg`;
        return `
        <article class="uni-card" data-uni-id="${escapeHtml(id)}">
            <div class="uni-media" style="background-image: url('${thumbSrc}');">
            <div class="uni-price"><small>Est. Cost/Year</small><b>${moneyUSD(cost)}</b></div>
            <div class="uni-logo"><img src="${logoSrc}" alt="${initials(name)}" onerror="this.onerror=null; this.parentNode.textContent='${initials(name)}';"></div>
            </div>
            <div class="uni-body">
            <h3 class="uni-title">${escapeHtml(name)}</h3>
            <div class="uni-loc" style="margin-bottom:8px;">📍 ${locString}</div> 
            <div class="uni-badge" style="margin-top:auto; min-height:24px; display:flex; flex-direction:column; align-items:flex-start; gap:4px;">${badgesHTML}</div>
            <div class="uni-footer"><a class="uni-details" href="university.html?id=${encodeURIComponent(id)}">View Details →</a></div>
            </div>
        </article>
        `;
    }

    function renderPagination(total) {
        if (!el.pagination) return;
        const totalPages = Math.ceil(total / state.limit);
        if (totalPages <= 1) { el.pagination.innerHTML = ""; return; }
        let html = ""; const p = state.page; const maxVisible = 5;
        const createBtn = (page, text, isActive = false) => { const activeClass = isActive ? "page-btn--active" : ""; return `<button class="page-btn ${activeClass}" data-page="${page}">${text}</button>`; };
        if (p > 1) { html += createBtn(1, "«"); html += createBtn(p - 1, "‹ Prev"); }
        let startPage, endPage;
        if (totalPages <= maxVisible) { startPage = 1; endPage = totalPages; } else { const maxPagesBefore = Math.floor(maxVisible / 2); const maxPagesAfter = Math.ceil(maxVisible / 2) - 1; if (p <= maxPagesBefore + 1) { startPage = 1; endPage = maxVisible; } else if (p + maxPagesAfter >= totalPages) { startPage = totalPages - maxVisible + 1; endPage = totalPages; } else { startPage = p - maxPagesBefore; endPage = p + maxPagesAfter; } }
        if (startPage > 1) html += `<span class="page-dots">...</span>`; for (let i = startPage; i <= endPage; i++) { html += createBtn(i, i, i === p); } if (endPage < totalPages) html += `<span class="page-dots">...</span>`;
        if (p < totalPages) { html += createBtn(p + 1, "Next ›"); html += createBtn(totalPages, "»"); }
        el.pagination.innerHTML = html;
        el.pagination.querySelectorAll("button").forEach(b => { b.onclick = () => { const newPage = Number(b.dataset.page); if (newPage && newPage !== state.page) { state.page = newPage; fetchAndRender(); window.scrollTo({top: 0, behavior: 'smooth'}); } }; });
    }
}

// =====================================
// PAGE: UNIVERSITY DETAILS (Детальная)
// =====================================
export async function initUniversityPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const stateEl = document.getElementById("detailState");
  const cardEl = document.getElementById("detailCard");

  if (!id) {
    if (stateEl) stateEl.innerHTML = "<h2 style='color:red; text-align:center;'>Error: No ID provided.</h2>";
    return;
  }

  try {
    if (stateEl) stateEl.textContent = "Loading...";
    const res = await fetch(`${API_BASE}/universities/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Backend error");
    const u = await res.json();

    // 1. Шапка
    const setTxt = (eid, val) => { const e = document.getElementById(eid); if (e) e.textContent = val || "—"; };
    setTxt("detailName", u.name); 
    setTxt("detailLocation", u.location ? `${u.location.city}, ${u.location.country}` : "—");
    
    let minPrice = u.finance?.total_cost_year_usd || 0;
    if (u.admission_tracks) {
        const prices = u.admission_tracks.map(t => t.finance_override?.total_cost_year_usd || u.finance?.total_cost_year_usd || 0);
        if (prices.length > 0) minPrice = Math.min(...prices);
    }
    setTxt("detailPrice", `from ${moneyUSD(minPrice)} / year`);
    setTxt("detailLogo", (u.name || "U").substring(0, 2).toUpperCase());

    const coverEl = document.getElementById("detailCover");
    if (coverEl) coverEl.style.backgroundImage = `url('images/thumbnails/${u.id}.jpg')`;

    const logoEl = document.getElementById("detailLogo");
    if (logoEl) {
        const initialsText = (u.name || "U").substring(0, 2).toUpperCase();
        logoEl.innerHTML = `<img src="images/logos/${u.id}.png" alt="Logo" onerror="this.style.display='none'; this.parentNode.textContent='${initialsText}'" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const siteBtn = document.getElementById("detailWebsite");
    if (siteBtn && u.website) { siteBtn.href = u.website; siteBtn.style.display = "inline-flex"; }
    const mapBtn = document.getElementById("detailMapLink");
    if (mapBtn) {
        const p = new URLSearchParams();
        p.set("view", "map");
        p.set("focus_uni", String(u.id || id));
        if (u.location?.country) p.set("country", String(u.location.country));
        if (u.location?.city) p.set("city", String(u.location.city));
        mapBtn.href = `universities.html?${p.toString()}`;
        mapBtn.style.display = "inline-flex";
    }
    let uniChance = null;
    let uniChanceByTrackKey = new Map();
    const recomputeUniChance = () => {
        uniChance = estimateUniChance(u, loadProfile());
        uniChanceByTrackKey = new Map((uniChance?.tracks || []).map((x) => [String(x.trackKey), x]));
    };
    recomputeUniChance();

    // --- TAB 1: GENERAL ---
    const recDiv = document.getElementById("detailRecommendations");
    if (recDiv) {
        let rankHtml = "<span>—</span>";
        if (u.rank) {
            let trophy = "";
            if (u.rank === 1) trophy = "🥇 "; else if (u.rank === 2) trophy = "🥈 "; else if (u.rank === 3) trophy = "🥉 ";
            rankHtml = `<span style="color:#5d17ea; font-size:1.1em;">${trophy}#${u.rank}</span>`;
        }
        
        recDiv.innerHTML = `
            <div class="d-kv"><span>Global Rank</span>${rankHtml}</div>
            <div class="d-kv"><span>Acceptance Rate</span><span>${u.academics.acceptance_rate_percent}%</span></div>
            <div class="d-kv" style="border-bottom:none;"><span>Campus Size</span><span>${u.student_life?.size || "Medium"}</span></div>
        `;
    }

    const extraDiv = document.getElementById("detailExtra");
    if (extraDiv) {
         const description = u.description ? `<p style="margin-bottom:15px; line-height:1.6; color:#444;">${u.description}</p>` : ""; 
         const studentCount = u.student_count ? new Intl.NumberFormat('en-US').format(u.student_count) : "—";
         
         extraDiv.innerHTML = `
            ${description}
            <div class="d-kv"><span>Total Students</span><span>${studentCount}</span></div>
            <div class="d-kv" style="border-bottom:none;"><span>Study Formats</span><span>${u.academics?.formats?.join(", ") || "On-campus"}</span></div>
         `;
    }

    // --- TAB 2: PROGRAMS ---
    const progDiv = document.getElementById("detailPrograms");
    if (progDiv && u.academics?.majors) {
        progDiv.innerHTML = u.academics.majors.map(m => `<span style="display:inline-block; background:#f1f1f1; padding:5px 10px; margin:2px; border-radius:8px; font-size:0.9rem;">${m}</span>`).join(" ");
    }

    function isLanguageExam(examKey) {
        const k = String(examKey || "").toUpperCase();
        return (
            k.includes("IELTS") ||
            k.includes("TOEFL") ||
            k.includes("DET") ||
            k.includes("DUOLINGO") ||
            k.includes("PTE") ||
            k.includes("CAMBRIDGE") ||
            k.includes("TESTDAF") ||
            k.includes("DSH") ||
            k.includes("DELF") ||
            k.includes("DALF") ||
            k.includes("TCF") ||
            k.includes("TEF") ||
            k.includes("NT2") ||
            k.includes("HSK") ||
            k.includes("JLPT") ||
            k.includes("TOPIK")
        );
        }

        function formatExamScore(examKey, score) {
        const k = String(examKey || "").toUpperCase();
        // В твоей базе GPA в процентах
        if (k === "GPA") return `${score}%`;
        if (k.includes("JLPT")) return `N${score}`;
        if (k.includes("TOPIK") || k.includes("HSK") || k.includes("TESTDAF") || k.includes("DSH")) return `Level ${score}`;
        return String(score);
        }

        function splitExamEntries(obj) {
        const lang = [];
        const acad = [];
        for (const [k, v] of Object.entries(obj || {})) {
            if (v === null || v === undefined) continue;
            (isLanguageExam(k) ? lang : acad).push([k, v]);
        }
        return { lang, acad };
        }

        function renderExamGroup(title, pairs, color) {
        if (!pairs.length) return "";
        return `
            <div style="margin-top:10px;">
            <div style="font-size:11px; font-weight:800; color:${color}; margin-bottom:6px; letter-spacing:0.4px;">
                ${title}
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; font-size:13px;">
                ${pairs.map(([exam, score]) => `
                <div><strong>${escapeHtml(getExamDisplayName(exam))}:</strong> ${escapeHtml(formatExamScore(exam, score))}</div>
                `).join("")}
            </div>
            </div>
        `;
        }

        function cefrLabel(id) {
        const n = Number(id);
        if (n === 1) return "A1";
        if (n === 2) return "A2";
        if (n === 3) return "B1";
        if (n === 4) return "B2";
        if (n === 5) return "C1";
        if (n === 6) return "C2";
        return String(id);
        }

        function renderLanguageRequirements(track) {
        const list = Array.isArray(track?.language_requirements) ? track.language_requirements : [];
        if (!list.length) return "";

        const mode = String(track?.language_requirements_mode || "all").toLowerCase() === "any" ? "any" : "all";
        const modeText = mode === "any"
            ? "Any one language proof is enough"
            : "All listed language proofs are required";

        return `
            <div style="margin-top:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px;">
              <div style="font-size:11px; font-weight:800; color:#1d4ed8; margin-bottom:8px; letter-spacing:0.4px;">
                LANGUAGE TRACK RULES
              </div>
              <div style="font-size:12px; color:#1e3a8a; margin-bottom:10px;">${escapeHtml(modeText)}</div>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${list.map(lr => {
                    const code = String(lr?.code || "").toUpperCase();
                    const nativeOk = !!lr?.accept_native;
                    const minCefr = lr?.min_cefr != null ? cefrLabel(lr.min_cefr) : null;
                    const recCefr = lr?.recommended_cefr != null ? cefrLabel(lr.recommended_cefr) : null;

                    const reqPairs = Object.entries(lr?.requirements || {});
                    const avgPairs = Object.entries(lr?.stats_avg || {});

                    return `
                      <div style="background:#fff; border:1px solid #dbeafe; border-radius:8px; padding:10px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                          <span style="font-size:10px; font-weight:800; color:#1d4ed8; border:1px solid #93c5fd; background:#eff6ff; padding:2px 6px; border-radius:999px;">
                            ${escapeHtml(code || "LANG")}
                          </span>
                          ${nativeOk ? `<span style="font-size:11px; color:#065f46; font-weight:700;">Native accepted</span>` : ""}
                        </div>
                        ${(minCefr || recCefr) ? `
                          <div style="font-size:12px; color:#334155; margin-bottom:6px;">
                            ${minCefr ? `<span><strong>Min CEFR:</strong> ${escapeHtml(minCefr)}</span>` : ""}
                            ${(minCefr && recCefr) ? `<span> • </span>` : ""}
                            ${recCefr ? `<span><strong>Typical:</strong> ${escapeHtml(recCefr)}</span>` : ""}
                          </div>
                        ` : ""}
                        ${reqPairs.length ? `
                          <div style="font-size:12px; color:#334155;">
                            <strong>Exam minimums:</strong>
                            ${reqPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))} ≥ ${escapeHtml(String(v))}</div>`).join("")}
                          </div>
                        ` : ""}
                        ${avgPairs.length ? `
                          <div style="font-size:12px; color:#475569; margin-top:6px;">
                            <strong>Typical admitted:</strong>
                            ${avgPairs.map(([k, v]) => `<div>${escapeHtml(getExamDisplayName(k, { langCode: lr?.code }))}: ${escapeHtml(String(v))}</div>`).join("")}
                          </div>
                        ` : ""}
                      </div>
                    `;
                }).join("")}
              </div>
            </div>
        `;
        }

        function trackLookupKey(track, idx) {
        const id = String(track?.id || "").trim();
        if (id) return id;
        const label = String(track?.label || "").trim();
        if (label) return `label:${label}`;
        return `track:${idx}`;
        }

        function chanceTone(chance) {
        const c = Number(chance) || 0;
        if (c >= 80) return { cls: "chance-high", label: "High chance" };
        if (c >= 60) return { cls: "chance-good", label: "Good chance" };
        if (c >= 40) return { cls: "chance-medium", label: "Moderate chance" };
        return { cls: "chance-low", label: "Low chance" };
        }

        function renderUniChanceSummary() {
        if (!uniChance) return "";
        const chance = Number(uniChance.overallChance) || 0;
        const tone = chanceTone(chance);
        return `
            <div class="chance-panel">
              <div class="chance-head">
                <div>
                  <div class="chance-title">${escapeHtml(aiName("chance"))} AI - Admission Probability</div>
                  <div class="chance-sub">Estimated from your profile, minimum requirements, language rules, selectivity, and affordability context.</div>
                </div>
                <div class="chance-percent ${tone.cls}">${chance}%</div>
              </div>
              <div class="chance-meter"><div class="chance-fill ${tone.cls}" style="width:${chance}%;"></div></div>
              <div class="chance-foot">Best track: <strong>${escapeHtml(uniChance.bestTrackLabel || "General admission")}</strong> • ${escapeHtml(tone.label)}</div>
            </div>
        `;
        }

        function renderTrackChanceChip(trackChance) {
        if (!trackChance) return "";
        const chance = Number(trackChance.chancePercent) || 0;
        const tone = chanceTone(chance);
        return `<div class="chance-track-chip ${tone.cls}">${escapeHtml(aiName("chance"))} ${chance}%</div>`;
        }


    // --- TAB 3: ADMISSION (ИСПРАВЛЕНО: Вернул Цену и Средние баллы) ---
    const reqDiv = document.getElementById("detailRequirements");
    const renderAdmissionTab = () => {
        if (!reqDiv) return;
        if (!u.admission_tracks || u.admission_tracks.length === 0) {
            reqDiv.innerHTML = `<div style="padding:10px 0; color:#666;">No specific admission tracks data.</div>`;
        } else {
            let tracksHTML = renderUniChanceSummary();
            u.admission_tracks.forEach((track, idx) => {
                const trackChance = uniChanceByTrackKey.get(trackLookupKey(track, idx));
                let majorsBadge = "";
                if (track.applicable_majors && track.applicable_majors.length > 0) {
                    majorsBadge = `<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:6px;">
                        ${track.applicable_majors.map(m => 
                            `<span style="background:#f0fdf4; color:#166534; font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #bbf7d0;">📚 ${m}</span>`
                        ).join("")}
                    </div>`;
                } else {
                    majorsBadge = `<span style="font-size:12px; color:#666; font-style:italic;">For all majors</span>`;
                }
                
                // Цена трека (Вернули!)
                const trackPrice = track.finance_override?.total_cost_year_usd || u.finance?.total_cost_year_usd || 0;

                // Требования
                const reqSplit = splitExamEntries(track.requirements || {});
                const minList =
                    renderExamGroup("ACADEMIC EXAMS", reqSplit.acad, "#6b7280") +
                    renderExamGroup("LANGUAGE EXAMS", reqSplit.lang, "#2563eb");


                // Средние баллы
                const avgSplit = splitExamEntries(track.stats_avg || {});
                let avgList = "";

                if (Object.keys(track.stats_avg || {}).length > 0) {
                avgList =
                    renderExamGroup("ACADEMIC EXAMS", avgSplit.acad, "#047857") +
                    renderExamGroup("LANGUAGE EXAMS", avgSplit.lang, "#047857");
                } else {
                avgList = `<div style="color:#999; font-style:italic;">Not available</div>`;
                }

                const languageReqInfo = renderLanguageRequirements(track);

                // Гранты
                let grantsInfo = "";
                if (track.scholarships && track.scholarships.length > 0) {
                    grantsInfo = `
                    <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e5e7eb;">
                        <div style="font-size:11px; font-weight:700; color:#059669; margin-bottom:8px; letter-spacing:0.5px;">AVAILABLE GRANTS & AID:</div>
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${track.scholarships.map(s => {
                                let conditions = "";
                                if (s.requirements) {
                                    conditions = Object.entries(s.requirements).map(([k, v]) => `${k} ≥ ${v}`).join(" • ");
                                }
                                const badgeText = s.amount 
                                    ? `Cover: ${moneyUSD(s.amount)}` 
                                    : (s.type === 'need' ? 'Need-based Aid' : 'Merit Scholarship');

                                return `
                                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                        <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#064e3b; font-size:13px;">
                                            <span>🏆</span> ${s.name}
                                        </div>
                                        <div style="font-size:10px; font-weight:700; background:#fff; color:#059669; padding:2px 6px; border-radius:4px; border:1px solid #86efac;">
                                            ${badgeText}
                                        </div>
                                    </div>
                                    ${conditions ? `
                                        <div style="font-size:11px; color:#4b5563; margin-left:22px;">
                                            <span style="font-weight:600; color:#059669;">Requires:</span> ${conditions}
                                        </div>
                                    ` : `<div style="font-size:11px; color:#9ca3af; margin-left:22px; font-style:italic;">No specific requirements listed</div>`}
                                </div>
                                `;
                            }).join("")}
                        </div>
                    </div>`;
                }

                tracksHTML += `
                <div class="track-card" style="border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin-bottom:16px; background:#fff; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <div>
                            <h4 style="margin:0 0 4px 0; font-size:18px; color:#5d17ea;">${track.label}</h4>
                            ${renderTrackChanceChip(trackChance)}
                            ${majorsBadge}
                            <p style="margin:8px 0 0; font-size:13px; color:#555; line-height:1.5;">${track.description || ""}</p>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px; color:#666;">Est. Cost</div>
                            <div style="font-size:16px; font-weight:800; color:#111;">${moneyUSD(trackPrice)}</div>
                        </div>
                    </div>
                    
                    <div class="track-stats-grid">
                        <div style="background:#f9fafb; padding:12px; border-radius:8px; border:1px solid #f3f4f6;">
                            <div style="font-size:10px; font-weight:700; color:#6b7280; margin-bottom:6px; text-transform:uppercase;">Minimum To Apply</div>
                            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">${minList || "None"}</div>
                        </div>
                        <div style="background:#ecfdf5; padding:12px; border-radius:8px; border:1px solid #d1fae5;">
                            <div style="font-size:10px; font-weight:700; color:#047857; margin-bottom:6px; text-transform:uppercase;">Real Average (Admitted)</div>
                            <div style="font-size:13px; display:flex; flex-direction:column; gap:4px;">${avgList}</div>
                        </div>
                    </div>
                    ${languageReqInfo}
                    ${grantsInfo}
                </div>
                `;
            });
            reqDiv.innerHTML = tracksHTML;
        }
    };
    renderAdmissionTab();
    window.addEventListener("profileUpdated", () => {
        recomputeUniChance();
        renderAdmissionTab();
    });

    // --- TAB 4: FINANCE (С блоком ROI) ---
    const finDiv = document.getElementById("detailFinance");
    const scholDiv = document.getElementById("detailScholarshipInfo"); 
    const priceBig = document.getElementById("detailPrice");           
    
    if (u.finance) {
        // Блок скидок
        if (scholDiv) {
            const fa = u.finance.financial_aid || {};
            const meritHtml = fa.merit_based 
                ? `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-weight:600; color:#065f46;"><span style="font-size:16px;">✅</span> Merit-based scholarships available</div>` 
                : `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; opacity:0.6; color:#4b5563;"><span style="font-size:16px;">❌</span> No merit-based scholarships</div>`;
            const needHtml = fa.need_based 
                ? `<div style="display:flex; align-items:center; gap:8px; font-weight:600; color:#065f46;"><span style="font-size:16px;">✅</span> Need-based financial aid</div>` 
                : `<div style="display:flex; align-items:center; gap:8px; opacity:0.6; color:#4b5563;"><span style="font-size:16px;">❌</span> No need-based aid</div>`;
            scholDiv.innerHTML = meritHtml + needHtml;
        }

        // Блок цены
        if (priceBig) {
            let minTotal = u.finance.total_cost_year_usd || 0;
            if (u.admission_tracks) {
                const prices = u.admission_tracks.map(t => t.finance_override?.total_cost_year_usd || u.finance?.total_cost_year_usd || 0).filter(p => p > 0);
                if (prices.length > 0) minTotal = Math.min(...prices);
            }
            priceBig.innerHTML = `<span style="font-size:0.5em; color:#64748b; vertical-align:middle; margin-right:4px;">from</span>${moneyUSD(minTotal)}`;
        }
        
        // Карточки треков
        if (finDiv) {
            finDiv.innerHTML = ""; 
            const tracks = (u.admission_tracks && u.admission_tracks.length > 0) ? u.admission_tracks : [{ label: "General Tuition", finance_override: null }];
            let financeHTML = "";

            tracks.forEach(track => {
                const fData = track.finance_override || u.finance;
                const total = fData.total_cost_year_usd;
                const breakdown = fData.costs_breakdown_year_usd || {};

                let barHTML = `<div class="cost-progress-bar" style="height:8px; display:flex; border-radius:4px; overflow:hidden; background:#e5e7eb;">`;
                let legendHTML = `<div class="cost-legend">`;
                
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
                let i = 0;

                if (Object.keys(breakdown).length > 0) {
                    for (const [key, val] of Object.entries(breakdown)) {
                        const color = colors[i % colors.length];
                        const percent = (val / total) * 100;
                        barHTML += `<div style="width:${percent}%; background:${color};" title="${key}"></div>`;
                        legendHTML += `
                            <div style="display:flex; align-items:center; font-size:13px; margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="width:8px; height:8px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
                                    <span style="color:#555;">${key.replace(/_/g, " ")}</span>
                                </div>
                                <span style="font-weight:700; color:#111; margin-left:12px;">${moneyUSD(val)}</span>
                            </div>
                        `;
                        i++;
                    }
                } else {
                    barHTML += `<div style="width:100%; background:#3b82f6;"></div>`;
                    legendHTML += `<div style="font-size:13px;">Tuition: <b>${moneyUSD(total)}</b></div>`;
                }
                barHTML += `</div>`;
                legendHTML += `</div>`;

                financeHTML += `
                <div class="finance-card">
                    <div class="finance-header">
                        <div class="finance-track-name">${track.label || "General Cost"}</div>
                        <div class="finance-total">
                            <small>Total / Year</small>
                            <span>${moneyUSD(total)}</span>
                        </div>
                    </div>
                    
                    <div class="finance-body">
                        ${barHTML}
                        ${legendHTML}
                    </div>

                    ${track.scholarships && track.scholarships.length > 0 ? `
                        <div class="finance-footer">
                            <div class="finance-grant-title">Available Scholarships:</div>
                            <ul class="finance-grant-list">
                                ${track.scholarships.map(s => `<li>${s.name}</li>`).join("")}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                `;
            });

            // 🔥 ROI БЛОК (Сделано!)
            const profile = loadProfile();
            const userMajor = profile.major || "";
            
            const outcomes = u.outcomes || {};
            const salariesByMajor = outcomes.average_salary_by_major || {};
            const avgSalaryGeneric = outcomes.average_early_career_salary_usd || 0;
            
            let roiTitle = "Estimated ROI (Return on Investment)";
            let roiContent = "";
            let userSalary = 0;

            if (!userMajor) {
                userSalary = avgSalaryGeneric;
                roiContent = `
                    <div style="background:#fff3cd; color:#856404; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #ffeeba;">
                        ⚠️ <strong>Tip:</strong> Select your <b>Major</b> in Profile to see precise ROI for your field. Showing average for all graduates.
                    </div>
                `;
            } else {
                if (salariesByMajor[userMajor]) {
                    userSalary = salariesByMajor[userMajor];
                    roiContent = `
                        <div style="background:#d1fae5; color:#065f46; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #a7f3d0;">
                            ✅ Calculation based on <b>${userMajor}</b> graduates from this university.
                        </div>
                    `;
                } else {
                    userSalary = avgSalaryGeneric;
                    roiContent = `
                        <div style="background:#f3f4f6; color:#374151; padding:12px; border-radius:8px; margin-bottom:15px; font-size:13px; border:1px solid #e5e7eb;">
                            ℹ️ Specific data for <b>${userMajor}</b> not available. Showing average for all graduates.
                        </div>
                    `;
                }
            }

            let minPrice = u.finance?.total_cost_year_usd || 1;
             if (u.admission_tracks && u.admission_tracks.length > 0) {
                const prices = u.admission_tracks.map(t => t.finance_override?.total_cost_year_usd || u.finance?.total_cost_year_usd || 0).filter(p => p > 0);
                if (prices.length > 0) minPrice = Math.min(...prices);
            }
            const roiValue = (userSalary / minPrice).toFixed(1);
            
            const roiBlock = `
                <div class="roi-box" style="margin-top:30px; background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:25px; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <h3 style="margin:0 0 10px 0; color:#5d17ea; font-size:18px;">${roiTitle}</h3>
                    <p style="font-size:13px; color:#666; margin-bottom:20px; line-height:1.5;">
                        <b>What is ROI?</b> It calculates how many times your first annual salary covers the cost of one year of education. 
                        <br><i>Formula: Avg. Graduate Salary / Annual Tuition Cost</i>
                    </p>
                    
                    ${roiContent}

                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px;">
                        <div style="flex:1; min-width:200px;">
                            <div style="font-size:12px; color:#666; text-transform:uppercase; font-weight:700;">Est. Graduate Salary</div>
                            <div style="font-size:24px; font-weight:800; color:#111;">${moneyUSD(userSalary)}</div>
                            <div style="font-size:11px; color:#999;">per year (early career)</div>
                        </div>
                        <div style="width:1px; height:50px; background:#eee; display:none; @media(min-width:600px){display:block;}"></div>
                        <div style="flex:1; min-width:200px;">
                            <div style="font-size:12px; color:#666; text-transform:uppercase; font-weight:700;">ROI Score</div>
                            <div style="font-size:32px; font-weight:900; color:${roiValue > 1.5 ? '#059669' : '#d97706'};">
                                ${roiValue}x
                            </div>
                            <div style="font-size:11px; color:${roiValue > 1.5 ? '#059669' : '#d97706'}; font-weight:600;">
                                ${roiValue > 2.0 ? 'Excellent Return' : (roiValue > 1.0 ? 'Positive Return' : 'High Investment')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            finDiv.innerHTML = `<div class="finance-grid-new">${financeHTML}</div>` + roiBlock;
        }
    }

    if (stateEl) stateEl.textContent = "";
    if (cardEl) {
        cardEl.style.display = "block";
        cardEl.classList.add("is-mounted");
    }
    initUniMentor(u);
    setupTabs(); 

  } catch (err) {
    console.error(err);
    if (stateEl) stateEl.textContent = "Error loading details.";
  }
}

// =====================================
// PAGE: RANKING (Исправлена сортировка)
// =====================================
export async function initRankingPage() {
    const listEl = document.getElementById("rankingList");
    if (!listEl) return;

    try {
        // Запрашиваем 200 вузов
        const res = await fetch(`${API_BASE}/universities?limit=200`);
        if (!res.ok) throw new Error("Error loading ranking");
        const data = await res.json();
        let items = data.items || [];

        // 🔥 FIX: Сортируем массив вручную от 1 к 100
        items.sort((a, b) => (a.rank || 999) - (b.rank || 999));

        const html = items.map((u, index) => {
            const rank = u.rank || (index + 1);
            
            // Цвета для топ-3
            let rankClass = "";
            if (rank === 1) rankClass = "rank-1";
            else if (rank === 2) rankClass = "rank-2";
            else if (rank === 3) rankClass = "rank-3";

            const logoSrc = `images/logos/${u.id}.png`;
            const flag = getFlagImg(u.location.country);

            return `
            <a href="university.html?id=${encodeURIComponent(u.id)}" class="rank-card">
                <div class="rank-num ${rankClass}">#${rank}</div>
                <div class="rank-logo">
                    <img src="${logoSrc}" alt="${initials(u.name)}" onerror="this.parentNode.textContent='${initials(u.name)}'">
                </div>
                <div class="rank-info">
                    <div class="rank-title">${escapeHtml(u.name)}</div>
                    <div class="rank-loc">
                        ${flag} 
                        <span style="margin-left:6px;">${u.location.city}, ${u.location.country}</span>
                    </div>
                </div>
                <div class="rank-badge">
                    Acceptance: <b>${u.academics.acceptance_rate_percent}%</b>
                </div>
            </a>
            `;
        }).join("");

        listEl.innerHTML = html;

    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Failed to load rankings.</div>`;
    }
}

// =====================================
// PAGE: GUIDE
// =====================================
export function initGuidePage() {
    const page = document.getElementById("guidePage");
    if (!page) return;

    const academicWrap = document.getElementById("guideAcademicExams");
    const languageWrap = document.getElementById("guideLanguageExams");
    const glossaryWrap = document.getElementById("guideGlossary");

    const fitName = aiName("fit");
    const chanceName = aiName("chance");
    const mentorName = aiName("mentor");

    const gloss = [
        { term: fitName, desc: "AI ranking mode that balances prestige, affordability, and admission feasibility." },
        { term: chanceName, desc: "AI probability (0-100) of your admission, computed per track from your profile and requirements." },
        { term: mentorName, desc: "AI consultant chatbot that answers university questions using project data and optional web context." },
        { term: "Admission Track", desc: "A specific way to apply to a university (e.g., direct, exam-based, scholarship path)." },
        { term: "Requirements", desc: "Minimum scores to be considered for a track." },
        { term: "Stats Avg", desc: "Typical scores of admitted students on that track." },
        { term: "Language Requirements", desc: "Accepted proof of language ability: native, CEFR, or language exam." },
        { term: "Mode = any", desc: "You need to satisfy at least one listed language option." },
        { term: "Mode = all", desc: "You must satisfy every listed language requirement." },
        { term: "Match Score", desc: `Internal ${fitName} ranking score; higher means a better fit for your profile.` },
    ];

    function typeLabel(t) {
        const x = String(t || "").toLowerCase();
        if (x === "int") return "Integer";
        if (x === "float") return "Decimal";
        if (x === "bool") return "Boolean";
        return x || "Number";
    }

    function renderGlossary() {
        if (!glossaryWrap) return;
        glossaryWrap.innerHTML = gloss.map((g) => `
            <div class="guide-card">
                <h4>${escapeHtml(g.term)}</h4>
                <p>${escapeHtml(g.desc)}</p>
            </div>
        `).join("");
    }

    function renderAcademicExams() {
        if (!academicWrap) return;

        const langIds = new Set();
        const groups = LANG_CONFIG?.language_exams || {};
        for (const arr of Object.values(groups)) {
            if (!Array.isArray(arr)) continue;
            arr.forEach((x) => langIds.add(String(x?.id || "").trim()));
        }

        const exams = Object.entries(EXAM_CONFIG || {})
            .filter(([id]) => !langIds.has(String(id)))
            .sort((a, b) => getExamDisplayName(a[0]).localeCompare(getExamDisplayName(b[0])));

        if (!exams.length) {
            academicWrap.innerHTML = `<p class="guide-muted">Exam config is loading...</p>`;
            return;
        }

        academicWrap.innerHTML = exams.map(([id, cfg]) => `
            <div class="guide-card">
                <h4>${escapeHtml(getExamDisplayName(id))}</h4>
                <p><strong>Type:</strong> ${escapeHtml(typeLabel(cfg?.type))}</p>
                <p><strong>Range:</strong> ${escapeHtml(String(cfg?.min ?? "—"))} - ${escapeHtml(String(cfg?.max ?? "—"))}</p>
                <p><strong>Step:</strong> ${escapeHtml(String(cfg?.step ?? "—"))}</p>
            </div>
        `).join("");
    }

    function renderLanguageExams() {
        if (!languageWrap) return;
        const groups = LANG_CONFIG?.language_exams || {};
        const languages = LANG_CONFIG?.languages || [];
        const nameByCode = Object.fromEntries(languages.map((x) => [x.code, x.name || x.label || x.code]));

        const codes = Object.keys(groups).sort();
        if (!codes.length) {
            languageWrap.innerHTML = `<p class="guide-muted">Language exam config is loading...</p>`;
            return;
        }

        languageWrap.innerHTML = codes.map((code) => {
            const arr = Array.isArray(groups[code]) ? groups[code] : [];
            if (!arr.length) return "";
            const title = nameByCode[code] || code.toUpperCase();

            return `
                <section class="guide-subsection">
                    <h4>${escapeHtml(title)} (${escapeHtml(code.toUpperCase())})</h4>
                    <div class="guide-grid">
                        ${arr.map((ex) => `
                            <div class="guide-card">
                                <h5>${escapeHtml(ex?.label || getExamDisplayName(ex?.id, { langCode: code }))}</h5>
                                <p><strong>Type:</strong> ${escapeHtml(typeLabel(ex?.type))}</p>
                                <p><strong>Range:</strong> ${escapeHtml(String(ex?.min ?? "—"))} - ${escapeHtml(String(ex?.max ?? "—"))}</p>
                                <p><strong>Step:</strong> ${escapeHtml(String(ex?.step ?? "—"))}</p>
                            </div>
                        `).join("")}
                    </div>
                </section>
            `;
        }).join("");
    }

    function renderAll() {
        renderGlossary();
        renderAcademicExams();
        renderLanguageExams();
    }

    renderAll();
    window.addEventListener("examConfigLoaded", renderAll);
    window.addEventListener("languageConfigLoaded", renderAll);
}
