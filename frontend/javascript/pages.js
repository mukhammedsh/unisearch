/* 4. pages.js - Логика страниц */
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
} from "./utils.js";

import { getUniSort } from "./algo.js";

import { setupTabs } from "./components.js";


// =====================================
// PAGE: UNIVERSITIES LIST (Список + Карта)
// =====================================
export function initUniversitiesPage() {
    const el = {
        qInput: $("qInput"), countrySelect: $("countrySelect"), stateDiv: $("stateDiv"),
        stateSelect: $("stateSelect"), citySelect: $("citySelect"),
        minInput: $("minCostInput"),
        maxInput: $("maxCostInput"),
        minSlider: $("minCostSlider"),
        maxSlider: $("maxCostSlider"),
        track: $("sliderTrack"),
        sortSelect: $("sortSelect"), sliderContainer: $("aiSliderContainer"),
        slider: $("uniFitSlider"), sliderLabel: $("sliderLabel"), resetBtn: $("resetFiltersBtn"),
        
        // Списки и контейнеры
        list: $("universitiesList"), 
        mapContainer: $("mapContainer"), // Контейнер карты
        total: $("totalCount"), 
        state: $("listState"), 
        pagination: $("pagination"),
        
        // Кнопки переключения
        btnList: $("viewListBtn"),
        btnMap: $("viewMapBtn")
    };

    if (!el.list) return;

    // 1. Начальное состояние (Загружаем из LocalStorage или дефолт)
    const savedState = loadFilters(); // из utils.js
    
    const state = {
        q: savedState.q || "", 
        country: savedState.country || "", 
        region: savedState.region || "", 
        city: savedState.city || "", 
        min_tuition: savedState.min_tuition || 0, 
        max_tuition: savedState.max_tuition || 1000000,
        sort: savedState.sort || "uni_ai", 
        ai_balance: savedState.ai_balance !== undefined ? savedState.ai_balance : 50, 
        viewMode: savedState.viewMode || "list", // 'list' или 'map'
        page: 1, 
        limit: 12,
    };

    // --- ФУНКЦИЯ: Отрисовка цветной полоски ---
    function fillTrack() {
        if (!el.minSlider || !el.maxSlider || !el.track) return;
        
        const minVal = parseInt(el.minSlider.value);
        const maxVal = parseInt(el.maxSlider.value);
        const maxRange = parseInt(el.maxSlider.max);
        
        const percent1 = (minVal / maxRange) * 100;
        const percent2 = (maxVal / maxRange) * 100;
        
        // Красим градиентом: Серый -> Фиолетовый -> Серый
        el.track.style.background = `linear-gradient(to right, #e0e0e0 ${percent1}%, #5d17ea ${percent1}%, #5d17ea ${percent2}%, #e0e0e0 ${percent2}%)`;
    }

    // --- ФУНКЦИЯ: Контроль пересечения ползунков ---
    function slideMin() {
        let gap = 10000; // Минимальный разрыв между ценами (10k)
        let minVal = parseInt(el.minSlider.value);
        let maxVal = parseInt(el.maxSlider.value);

        if (maxVal - minVal <= gap) {
            el.minSlider.value = maxVal - gap;
        }
        el.minInput.value = el.minSlider.value;
        state.min_tuition = el.minSlider.value;
        fillTrack();
    }

    function slideMax() {
        let gap = 10000;
        let minVal = parseInt(el.minSlider.value);
        let maxVal = parseInt(el.maxSlider.value);

        if (maxVal - minVal <= gap) {
            el.maxSlider.value = minVal + gap;
        }
        el.maxInput.value = el.maxSlider.value;
        state.max_tuition = el.maxSlider.value;
        fillTrack();
    }

    // Переменные для карты
    let mapInstance = null;
    let markersLayer = null;

    // Инициализация
    readFromUrl(); 
    
    const initLocations = () => {
        updateCountryOptions();
        if (state.country) {
            if (el.countrySelect) el.countrySelect.value = state.country;
            
            updateLocationLogic(state.country);
            
            if (state.region && el.stateSelect) {
                el.stateSelect.value = state.region;
                updateCitiesForState(state.country, state.region);
            }
            if (state.city && el.citySelect) el.citySelect.value = state.city;
        }

        // 🔥 ДОБАВИТЬ ЭТУ СТРОЧКУ В КОНЕЦ:
        // Это заставит кастомные селекты перерисоваться с новыми значениями
        applyToForm();
    };
    
    if (Object.keys(CITY_OPTIONS_BY_COUNTRY).length > 0) initLocations();
    window.addEventListener("citiesLoaded", initLocations);

    applyToForm();
    updateSliderVisibility(); 
    
    // Применяем сохраненный режим (Карта или Список)
    // И сразу грузим данные (fetchAndRender внутри switchView не вызывался при старте)
    switchView(state.viewMode, false); // false = не вызывать fetch повторно, т.к. вызовем ниже
    
    const refetch = debounce(() => { 
        state.page = 1; 
        saveFilters(state);
        fetchAndRender(); 
    }, 250);

    // --- LISTENERS ---
    el.qInput?.addEventListener("input", () => { state.q = el.qInput.value.trim(); refetch(); });
    
    el.countrySelect?.addEventListener("change", () => {
        state.country = el.countrySelect.value; state.region = ""; state.city = ""; 
        if(el.stateSelect) el.stateSelect.value = ""; if(el.citySelect) el.citySelect.value = "";
        updateLocationLogic(state.country); refetch();
    });
    
    el.stateSelect?.addEventListener("change", () => { state.region = el.stateSelect.value; state.city = ""; updateCitiesForState(state.country, state.region); refetch(); });
    el.citySelect?.addEventListener("change", () => { state.city = el.citySelect.value; refetch(); });
    el.minTuitionInput?.addEventListener("input", () => { state.min_tuition = el.minTuitionInput.value; refetch(); });
    el.maxTuitionInput?.addEventListener("input", () => { state.max_tuition = el.maxTuitionInput.value; refetch(); });
    el.sortSelect?.addEventListener("change", () => { state.sort = el.sortSelect.value; updateSliderVisibility(); refetch(); });
    el.slider?.addEventListener("input", () => { state.ai_balance = parseInt(el.slider.value); updateSliderLabel(); refetch(); });

    el.resetBtn?.addEventListener("click", () => {
        Object.assign(state, { q: "", country: "", region: "", city: "", min_tuition: "", max_tuition: "", sort: "uni_ai", ai_balance: 50, page: 1 });
        saveFilters(state);
        state.min_tuition = 0;
        state.max_tuition = 1000000;
        applyToForm(); // Это само обновит слайдеры и закраску
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

    // Переключатели
    el.btnList?.addEventListener("click", () => { switchView("list", true); });
    el.btnMap?.addEventListener("click", () => { switchView("map", true); });

    // --- СЛУШАТЕЛИ СОБЫТИЙ ---
    // Используем событие 'input' для плавности и 'change' для запроса API
    
    if (el.minSlider && el.maxSlider) {
        el.minSlider.addEventListener("input", slideMin);
        el.maxSlider.addEventListener("input", slideMax);
        
        // Запрос отправляем только когда отпустили ползунок (чтобы не спамить API)
        el.minSlider.addEventListener("change", () => refetch());
        el.maxSlider.addEventListener("change", () => refetch());
    }

    // Синхронизация инпутов (если ввели цифрами)
    el.minInput?.addEventListener("change", () => {
        let val = parseInt(el.minInput.value) || 0;
        // Не даем ввести больше макс. слайдера
        if (val >= parseInt(el.maxSlider.value)) val = parseInt(el.maxSlider.value) - 10000;
        el.minSlider.value = val;
        state.min_tuition = val;
        fillTrack();
        refetch();
    });

    el.maxInput?.addEventListener("change", () => {
        let val = parseInt(el.maxInput.value) || 1000000;
        if (val <= parseInt(el.minSlider.value)) val = parseInt(el.minSlider.value) + 10000;
        el.maxSlider.value = val;
        state.max_tuition = val;
        fillTrack();
        refetch();
    });

    fetchAndRender(); // Первый запуск
    window.addEventListener("profileUpdated", () => fetchAndRender());


    // --- ФУНКЦИИ КАРТЫ ---
    function switchView(mode, shouldFetch = false) {
        state.viewMode = mode;
        saveFilters(state);

        if (mode === "map") {
            el.list.style.display = "none";
            el.pagination.style.display = "none"; 
            el.mapContainer.style.display = "block";
            
            el.btnList.classList.remove("active");
            el.btnMap.classList.add("active");

            initMap(); 
            setTimeout(() => { if(mapInstance) mapInstance.invalidateSize(); }, 100);
            
            // 🔥 При переключении на карту грузим данные (чтобы получить все 200 точек)
            if (shouldFetch) fetchAndRender(); 

        } else {
            el.list.style.display = "grid";
            el.pagination.style.display = "flex";
            el.mapContainer.style.display = "none";
            
            el.btnList.classList.add("active");
            el.btnMap.classList.remove("active");
            
            // 🔥 При переключении на список грузим данные (чтобы сбросить лимит до 12 и пагинацию)
            if (shouldFetch) fetchAndRender();
        }
    }

    function initMap() {
        if (mapInstance) return; 
        if (typeof L === "undefined") return;

        mapInstance = L.map('mapContainer', {
            maxBounds: [[-90, -180], [90, 180]],
            maxBoundsViscosity: 1.0,
            minZoom: 2,
            maxZoom: 19,
            // Включаем нативную поддержку анимаций самого Leaflet
            zoomAnimation: true,
            markerZoomAnimation: true
        }).setView([25, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            noWrap: true
        }).addTo(mapInstance);

        markersLayer = L.markerClusterGroup({
            showCoverageOnHover: false,
            zoomToBoundsOnClick: false,
            spiderfyOnMaxZoom: true,
            animate: true,
            animationDuration: 1000,
            // 🔥 ТЕПЕРЬ ИСПОЛЬЗУЕМ ЛОГОТИП
            iconCreateFunction: function(cluster) {
                const markers = cluster.getAllChildMarkers();
                const count = markers.length;
                
                // Достаем ID первого универа из его маркера
                const firstMarkerHtml = markers[0].options.icon.options.html;
                const idMatch = firstMarkerHtml.match(/logos\/(.+?)\.png/);
                const firstId = idMatch ? idMatch[1] : 'default';

                const logoUrl = `images/logos/${firstId}.png`;
                
                return L.divIcon({
                    html: `
                    <div class="cluster-node-fix">
                        <div class="map-marker-container">
                            <div class="marker-img-inner" style="background-image: url('${logoUrl}');"></div>
                        </div>
                        <div class="cluster-badge">+${count - 1}</div>
                    </div>
                    `,
                    className: 'cluster-icon-container',
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                });
            }
        });

        // Плавный полет при клике на группу (кластер)
        markersLayer.on('clusterclick', function (a) {
            mapInstance.flyToBounds(a.layer.getBounds(), {
                padding: [80, 80],
                duration: 1.0 // Можешь менять здесь скорость полета к группе
            });
        });

        mapInstance.addLayer(markersLayer);
    }

    function updateMapMarkers(items) {
        if (!mapInstance || !markersLayer) return;
        markersLayer.clearLayers(); 
        const profile = loadProfile();
        const userBudget = parseFloat(profile.budget);
        const newMarkers = [];

        items.forEach(u => {
            if (u.coordinates?.lat && u.coordinates?.lon) {
                const customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                    <div class="map-marker-container">
                        <div class="marker-img-inner" style="background-image: url('images/logos/${u.id}.png');"></div>
                    </div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    popupAnchor: [0, -24]
                });

                const marker = L.marker([u.coordinates.lat, u.coordinates.lon], { icon: customIcon });
                
                // Настраиваем попап ЗАРАНЕЕ, но отключаем всё авто-движение
                const cardHTML = `<div class="map-card-wrapper">${renderCard(u, userBudget)}</div>`;
                marker.bindPopup(cardHTML, { 
                    minWidth: 280, maxWidth: 320, 
                    className: 'custom-map-popup',
                    autoPan: false // ⬅️ КРИТИЧНО: Чтобы попап не дергал карту
                });

                // 🔥 РУЧНОЙ КОНТРОЛЬ ПОЛЕТА
                marker.on('click', function(e) {
                    this.setZIndexOffset(1000);
                    
                    // Сначала летим плавно...
                    mapInstance.flyTo(e.target.getLatLng(), 16, {
                        animate: true,
                        duration: 3.0,     // ⬅️ ТЕПЕРЬ ЭТО ТОЧНО ЗАРАБОТАЕТ. Поставь 5.0 для теста.
                        easeLinearity: 0.1
                    });

                    // ...и только ПОСЛЕ начала полета открываем попап вручную через 100мс
                    setTimeout(() => {
                        if (!marker.getPopup().isOpen()) marker.openPopup();
                    }, 100);
                });

                newMarkers.push(marker);
            }
        });

        markersLayer.addLayers(newMarkers);
    }

    // --- ФУНКЦИИ СТРАНИЦЫ ---
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
    
    function buildParams() {
        const p = new URLSearchParams();
        if (state.q) p.set("q", state.q); if (state.country) p.set("country", state.country);
        if (state.region) p.set("region", state.region); if (state.city) p.set("city", state.city);
        if (state.min_tuition) p.set("min_tuition", state.min_tuition);
        if (state.max_tuition) p.set("max_tuition", state.max_tuition);
        const isAiSort = (state.sort === "uni_ai");
        p.set("sort", isAiSort ? "name_asc" : state.sort);
        
        if (state.viewMode === "map") {
            p.set("limit", "200"); p.set("page", "1");
        } else {
            if (isAiSort) { p.set("limit", "100"); p.set("page", "1"); } 
            else { p.set("page", String(state.page)); p.set("limit", String(state.limit)); }
        }
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
        
        fillTrack(); // Красим полоску при загрузке

        ["countrySelect", "stateSelect", "citySelect", "sortSelect"].forEach(id => initCustomSelect(id));
    }

    // --- НОВЫЕ СЛУШАТЕЛИ СОБЫТИЙ (LISTENERS) ---

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
        
        // Оставляем обычный HTML для совместимости (вдруг JS отключен или ошибка)
        let html = `<option value="">All Countries</option>`;
        countries.forEach(c => { 
            const isSelected = (c === currentVal) ? "selected" : ""; 
            html += `<option value="${c}" ${isSelected}>${c}</option>`; 
        });
        el.countrySelect.innerHTML = html;

        // 🔥 ДОБАВЛЕНО: Превращаем его в кастомный список с флагами
        initCustomSelect("countrySelect");
    }
    function readFromUrl() {
        const sp = new URL(window.location.href).searchParams;
        if(sp.has("q")) state.q = sp.get("q");
        if(sp.has("country")) state.country = sp.get("country");
    }

    async function fetchAndRender() {
        if (el.state && state.viewMode === 'list') el.state.textContent = "Loading...";
        if (state.viewMode === 'list') el.list.innerHTML = "";
        if (el.pagination) el.pagination.innerHTML = "";

        const params = buildParams();
        setUrlParams(params);

        try {
        const res = await fetch(`${API_BASE}/universities?${params.toString()}`);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        let items = data.items || [];
        const total = data.total || 0;
        const isAiSort = (state.sort === "uni_ai");
        
        // === Рендер СПИСКА ===
        if (state.viewMode === 'list') {
            let displayItems = items;
            let displayTotal = total;

            // 🔥 Исправление: Нарезаем на страницы на КЛИЕНТЕ для AI Sort
            if (isAiSort) { 
                // Передаем весь объект state, так как там лежит выбранный major
                items = getUniSort(items, state.ai_balance, state);
                displayTotal = items.length; // Всего загружено (100)
                
                const start = (state.page - 1) * state.limit;
                const end = start + state.limit;
                displayItems = items.slice(start, end); // Берем только 12 штук для текущей страницы
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
            
            // Передаем правильное общее количество для пагинации
            renderPagination(displayTotal);
        } 
        
        // === Рендер КАРТЫ ===
        else if (state.viewMode === 'map') {
            if (el.total) el.total.textContent = String(items.length);
            updateMapMarkers(items);
            if (el.state) el.state.textContent = "";
        }

        } catch (err) {
        console.error(err);
        if (el.state) el.state.textContent = "Failed to load data.";
        }
    }

    function renderCard(u, myBudget) { 
        const id = u.id; 
        const name = u.name; 
        const country = nested(u, ["location", "country"], "");
        const city = nested(u, ["location", "city"], ""); 
        
        // Логика флага
        let locString = city;
        if (country) {
            const flagHtml = getFlagImg(country);
            locString = city 
                ? `<div style="display:flex; align-items:center; gap:6px;">${city}, ${flagHtml} ${country}</div>`
                : `<div style="display:flex; align-items:center; gap:6px;">${flagHtml} ${country}</div>`;
        }

        // --- НОВАЯ ЛОГИКА ОТОБРАЖЕНИЯ (Smart Match) ---
        // Если алгоритм отработал, у нас есть u.matchData
        const match = u.matchData || {}; 
        
        // 1. Цена (Берем персональную или общую)
        const cost = match.finalPrice !== undefined ? match.finalPrice : nested(u, ["finance", "total_cost_year_usd"], 0);
        
        // 2. Бейджики (Статус поступления)
        let badgesHTML = "";
        
        // А. Трек (Сценарий)
        if (match.trackLabel) {
            badgesHTML += `<span style="background:#eff6ff; color:#1e40af; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #dbeafe; margin-bottom:4px;">🚀 Track: ${match.trackLabel}</span> `;
        }

        // Б. Грант
        if (match.grantName) {
            // Зеленый бейдж, если грант доступен
            badgesHTML += `<span style="background:#d1fae5; color:#065f46; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #6ee7b7; margin-bottom:4px;">🏆 ${match.grantName}</span> `;
        } else if (cost > myBudget && myBudget > 0) {
            // Фиолетовый бейдж, если дорого и без гранта
            badgesHTML += `<span style="background:#f3e8ff; color:#6b21a8; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid #d8b4fe; margin-bottom:4px;">💰 Over Budget</span> `;
        } else if (match.trackLabel) {
             // Серый бейдж "Matched", если просто прошли по баллам
             badgesHTML += `<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid #e5e7eb; margin-bottom:4px;">✅ Requirements Met</span> `;
        } else {
             // Фолбек для обычного списка (если алгоритм не запускался или это карта)
             const acc = u.academics?.acceptance_rate_percent;
             badgesHTML = `<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; border:1px solid #e5e7eb;">Acceptance: ${acc}%</span>`;
        }

        // В. ROI Score (Окупаемость)
        if (match.roiScore && match.roiScore > 0) {
            const isHigh = match.roiScore > 15; // Порог можно настроить
            const roiColor = isHigh ? "#059669" : "#d97706"; // Зеленый или оранжевый
            const roiBg = isHigh ? "#d1fae5" : "#fef3c7";
            badgesHTML += `<span style="background:${roiBg}; color:${roiColor}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold; border:1px solid ${roiColor}30; margin-bottom:4px;">📈 ROI: ${match.roiScore}x</span> `;
        }

        // 3. Логотип и картинка
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

        let html = "";
        const p = state.page;
        const maxVisible = 5;

        const createBtn = (page, text, isActive = false) => {
            const activeClass = isActive ? "page-btn--active" : "";
            return `<button class="page-btn ${activeClass}" data-page="${page}">${text}</button>`;
        };

        if (p > 1) {
            html += createBtn(1, "«"); 
            html += createBtn(p - 1, "‹ Prev");
        }

        let startPage, endPage;
        if (totalPages <= maxVisible) {
            startPage = 1; endPage = totalPages;
        } else {
            const maxPagesBefore = Math.floor(maxVisible / 2);
            const maxPagesAfter = Math.ceil(maxVisible / 2) - 1;
            if (p <= maxPagesBefore + 1) { startPage = 1; endPage = maxVisible; } 
            else if (p + maxPagesAfter >= totalPages) { startPage = totalPages - maxVisible + 1; endPage = totalPages; } 
            else { startPage = p - maxPagesBefore; endPage = p + maxPagesAfter; }
        }

        if (startPage > 1) html += `<span class="page-dots">...</span>`;
        for (let i = startPage; i <= endPage; i++) { html += createBtn(i, i, i === p); }
        if (endPage < totalPages) html += `<span class="page-dots">...</span>`;

        if (p < totalPages) {
            html += createBtn(p + 1, "Next ›");
            html += createBtn(totalPages, "»");
        }

        el.pagination.innerHTML = html;
        el.pagination.querySelectorAll("button").forEach(b => {
            b.onclick = () => {
                const newPage = Number(b.dataset.page);
                if (newPage && newPage !== state.page) {
                    state.page = newPage;
                    fetchAndRender();
                    window.scrollTo({top: 0, behavior: 'smooth'});
                }
            };
        });
    }
}

// =====================================
// PAGE: UNIVERSITY DETAILS (Детальная страница)
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

    // 1. Заполняем шапку
    const setTxt = (eid, val) => { const e = document.getElementById(eid); if (e) e.textContent = val || "—"; };

    setTxt("detailName", u.name); 
    setTxt("detailLocation", u.location ? `${u.location.city}, ${u.location.country}` : "—");
    
    // Формируем цену "ОТ" (самая низкая из треков)
    let minPrice = u.finance?.total_cost_year_usd || 0;
    if (u.admission_tracks) {
        u.admission_tracks.forEach(t => {
            if (t.finance_override?.total_cost_year_usd && t.finance_override.total_cost_year_usd < minPrice) {
                minPrice = t.finance_override.total_cost_year_usd;
            }
        });
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
    if (siteBtn) {
        if (u.website) { siteBtn.href = u.website; siteBtn.style.display = "inline-flex"; } 
        else { siteBtn.style.display = "none"; }
    }

    // --- TAB 1: GENERAL ---
    const recDiv = document.getElementById("detailRecommendations");
    if (recDiv) {
        let rankHtml = "<span>—</span>";
        if (u.rank) {
            let trophy = "";
            if (u.rank === 1) trophy = "🥇 "; else if (u.rank === 2) trophy = "🥈 "; else if (u.rank === 3) trophy = "🥉 ";
            rankHtml = `<span style="color:#5d17ea; font-size:1.1em;">${trophy}#${u.rank}</span>`;
        }
        
        let avgStatsHtml = "";
        // Берем среднее из первого попавшегося трека для overview, или из корня если есть
        const defaultAvg = u.admission_tracks?.[0]?.stats_avg || u.exams_avg;
        if (defaultAvg) {
             for (const [k, v] of Object.entries(defaultAvg)) {
                 avgStatsHtml += `<div class="d-kv"><span>Avg ${k}</span><span>${k==='GPA'?v+'%':v}</span></div>`;
             }
        }

        recDiv.innerHTML = `
            <div class="d-kv"><span>Global Rank</span>${rankHtml}</div>
            <div class="d-kv"><span>Acceptance Rate</span><span>${u.academics.acceptance_rate_percent}%</span></div>
            ${avgStatsHtml}
        `;
    }

    const extraDiv = document.getElementById("detailExtra");
    if (extraDiv) {
         const studentCount = u.student_count ? new Intl.NumberFormat('en-US').format(u.student_count) : "—";
         extraDiv.innerHTML = `
            <div class="d-kv"><span>Students</span><span>${studentCount}</span></div>
            <div class="d-kv"><span>Size</span><span>${u.student_life?.size || "—"}</span></div>
            <div class="d-kv"><span>Formats</span><span>${u.academics?.formats?.join(", ") || "On-campus"}</span></div>
         `;
    }

    // --- TAB 2: PROGRAMS ---
    const progDiv = document.getElementById("detailPrograms");
    if (progDiv && u.academics?.majors) {
        progDiv.innerHTML = u.academics.majors.map(m => `<span style="display:inline-block; background:#f1f1f1; padding:5px 10px; margin:2px; border-radius:8px; font-size:0.9rem;">${m}</span>`).join(" ");
    }

    // --- TAB 3: ADMISSION (Сценарии!) ---
    const reqDiv = document.getElementById("detailRequirements");
    if (reqDiv) {
        // Очищаем и строим треки
        if (!u.admission_tracks || u.admission_tracks.length === 0) {
            reqDiv.innerHTML = `<div style="padding:10px 0; color:#666;">No specific admission tracks data.</div>`;
        } else {
            let tracksHTML = "";
            u.admission_tracks.forEach(track => {
                // Бейджик режима (Online/On-campus)
                let modeBadge = "";
                if (track.study_mode === "Online") modeBadge = `<span style="background:#dbeafe; color:#1e40af; font-size:11px; padding:2px 6px; border-radius:4px; margin-left:8px;">🌐 Online</span>`;
                else if (track.study_mode === "Hybrid") modeBadge = `<span style="background:#f3e8ff; color:#6b21a8; font-size:11px; padding:2px 6px; border-radius:4px; margin-left:8px;">⚡ Hybrid</span>`;
                
                // Требования
                let reqList = "";
                for (const [exam, score] of Object.entries(track.requirements || {})) {
                    reqList += `<div style="display:inline-block; margin-right:12px; font-size:13px;"><strong>${exam}:</strong> ${score}${exam==='GPA'?'%':''}</div>`;
                }

                // Гранты
                let grantsHTML = "";
                if (track.scholarships && track.scholarships.length > 0) {
                    grantsHTML = `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #eee;">
                        <div style="font-size:11px; font-weight:700; color:#065f46; margin-bottom:4px;">AVAILABLE GRANTS:</div>
                        <ul style="margin:0; padding-left:20px; font-size:13px; color:#333;">
                            ${track.scholarships.map(s => `<li>${s.name}</li>`).join("")}
                        </ul>
                    </div>`;
                }

                // Карточка трека
                tracksHTML += `
                <div class="track-card" style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px; background:#fff; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <h4 style="margin:0; font-size:16px; color:#5d17ea;">${track.label} ${modeBadge}</h4>
                    </div>
                    <p style="margin:0 0 10px; font-size:13px; color:#666; line-height:1.4;">${track.description || ""}</p>
                    
                    <div style="background:#f9fafb; padding:8px 12px; border-radius:8px;">
                        <div style="font-size:11px; font-weight:700; color:#6b7280; margin-bottom:4px; text-transform:uppercase;">Entry Requirements (Minimum)</div>
                        ${reqList}
                    </div>
                    ${grantsHTML}
                </div>
                `;
            });
            reqDiv.innerHTML = tracksHTML;
        }
    }

    // --- TAB 4: FINANCE ---
    const finDiv = document.getElementById("detailFinance");
    const priceBig = document.getElementById("detailPrice");
    
    if (u.finance) {
        if (priceBig) priceBig.textContent = moneyUSD(u.finance.total_cost_year_usd);
        
        if (finDiv) {
            // Если есть разные цены в треках, показываем это
            let variationHTML = "";
            if (u.admission_tracks) {
                const differentPrices = u.admission_tracks.filter(t => t.finance_override);
                if (differentPrices.length > 0) {
                    variationHTML = `<div style="margin-bottom:20px; background:#ffffff; border:1px solid #bfdbfe; padding:12px; border-radius:8px;">
                        <div style="font-size:12px; font-weight:bold; color:#1e40af; margin-bottom:6px;">💡 Special Pricing Available:</div>
                        ${differentPrices.map(t => `
                            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                                <span>${t.label}:</span>
                                <b>${moneyUSD(t.finance_override.total_cost_year_usd)}</b>
                            </div>
                        `).join("")}
                    </div>`;
                }
            }

            const breakdown = u.finance.costs_breakdown_year_usd;
            if (breakdown) {
                let listHTML = `<div class="cost-breakdown">`;
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
                let i = 0;
                for (const [key, val] of Object.entries(breakdown)) {
                    const color = colors[i % colors.length];
                    listHTML += `
                        <div class="cost-row">
                            <div class="cost-label"><span class="cost-dot" style="background:${color}"></span>${key.replace(/_/g, " ")}</div>
                            <span class="cost-val" style="color:${color}">${moneyUSD(val)}</span>
                        </div>`;
                    i++;
                }
                listHTML += `</div>`;
                finDiv.innerHTML = variationHTML + listHTML;
            } else {
                finDiv.innerHTML = variationHTML + `<div class="d-kv"><span>Total</span><span>${moneyUSD(u.finance.total_cost_year_usd)}</span></div>`;
            }
        }
    }

    if (stateEl) stateEl.textContent = "";
    if (cardEl) cardEl.style.display = "block"; 
    setupTabs(); 

  } catch (err) {
    console.error(err);
    if (stateEl) stateEl.textContent = "Error loading details.";
  }
}

// --- Страница Рейтинга ---
export async function initRankingPage() {
    const listEl = document.getElementById("rankingList");
    if (!listEl) return;

    try {
        const res = await fetch(`${API_BASE}/universities?limit=2000`);
        const data = await res.json();
        let items = data.items || [];

        items.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

        const html = items.map((u, index) => {
            const rank = u.rank || (index + 1);
            const rankClass = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "";
            const logoSrc = `images/logos/${u.id}.png`; // Путь от корня
            return `
            <a href="university.html?id=${u.id}" class="rank-card">
                <div class="rank-num ${rankClass}">#${rank}</div>
                <div class="rank-logo">
                    <img src="${logoSrc}" alt="${initials(u.name)}" onerror="this.parentNode.textContent='${initials(u.name)}'">
                </div>
                <div class="rank-info">
                    <div class="rank-title">${escapeHtml(u.name)}</div>
                    <div class="rank-loc">📍 ${u.location?.city}, ${u.location?.country}</div>
                </div>
                <div class="rank-badge">Acceptance: ${u.academics.acceptance_rate_percent}%</div>
            </a>
            `;
        }).join("");

        listEl.innerHTML = html;
    } catch (e) {
        console.error(e);
        listEl.innerHTML = "<p style='text-align:center'>Failed to load rankings.</p>";
    }
}