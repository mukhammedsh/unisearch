/* frontend/javascript/pages/universities/filter-controls.js */

import {
    $,
    CITY_OPTIONS_BY_COUNTRY,
    escapeHtml,
    initCustomSelect,
    motionPress,
    saveFilters,
} from "../../utils.js";
import { t, tFormat } from "../../i18n.js";
import {
    convert,
    formatMoney,
    getFilterLimits,
    getPreferredCurrency,
} from "../../currency.js";
import { buildFilterResetPatch } from "./filter-reset.js";
import {
    clampPercent,
    clampTuition,
    countActiveFilters,
    getProfileFundingQueryValue,
} from "./query-state.js";
import {
    normalizeSortMode,
    trCity,
    trCountry,
    trState,
} from "../_shared.js";

const TRADEOFF_CONFIGS = [
    {
        sliderKey: "practice_vs_science",
        sliderProp: "focusSlider",
        labelProp: "focusLabel",
        leftKey: "universities.tradeoff.focus.left",
        leftFallback: "Career & Practice",
        rightKey: "universities.tradeoff.focus.right",
        rightFallback: "Science & Research",
    },
    {
        sliderKey: "social_vs_hardcore",
        sliderProp: "atmosphereSlider",
        labelProp: "atmosphereLabel",
        leftKey: "universities.tradeoff.atmosphere.left",
        leftFallback: "Social & Events",
        rightKey: "universities.tradeoff.atmosphere.right",
        rightFallback: "Hardcore Study",
    },
    {
        sliderKey: "budget_vs_prestige",
        sliderProp: "financeSlider",
        labelProp: "financeLabel",
        leftKey: "universities.tradeoff.finance.left",
        leftFallback: "Budget & Grants",
        rightKey: "universities.tradeoff.finance.right",
        rightFallback: "Prestige & Comfort",
    },
    {
        sliderKey: "city_vs_campus",
        sliderProp: "locationSlider",
        labelProp: "locationLabel",
        leftKey: "universities.tradeoff.location.left",
        leftFallback: "Study in City",
        rightKey: "universities.tradeoff.location.right",
        rightFallback: "Study Outside City",
    },
];

function clearSidebarInertAttributes() {
    document.querySelectorAll("[data-sidebar-inert='1']").forEach((node) => {
        node.inert = false;
        delete node.dataset.sidebarInert;
    });
}

/**
 * Manage tuition range sliders, currency conversions, UniFit tradeoff sliders,
 * cascading location dropdowns, filter resets, and the mobile filter drawer.
 * @param {{
 *   el: Record<string, any>,
 *   state: Record<string, any>,
 *   defaultSortMode: string,
 *   getCurrentCurrency: () => string,
 *   setCurrentCurrency: (currency: string) => void,
 *   getCurrentLimits: () => { min: number, max: number, step: number },
 *   setCurrentLimits: (limits: { min: number, max: number, step: number }) => void,
 *   syncSearchClearButton: () => void,
 *   syncSavedFilterButtons: () => void,
 *   clearSavedScrollPosition: () => void,
 *   refetch: () => void,
 *   fetchAndRender: () => Promise<void>|void,
 * }} options
 */
export function createFilterControls({
    el,
    state,
    defaultSortMode,
    getCurrentCurrency,
    setCurrentCurrency,
    getCurrentLimits,
    setCurrentLimits,
    syncSearchClearButton,
    syncSavedFilterButtons,
    clearSavedScrollPosition,
    refetch,
    fetchAndRender,
}) {
    let mobileFiltersApi = null;
    let citiesLoadedHandler = null;
    let mobileFilterKeydownHandler = null;
    let initialPrefsSyncDone = false;

    const countActiveTradeoffs = () => TRADEOFF_CONFIGS.reduce(
        (acc, config) => acc + (clampPercent(state[config.sliderKey], 50) !== 50 ? 1 : 0),
        0
    );

    const updateUnifitPrefsCount = () => {
        const count = countActiveTradeoffs();
        if (el.unifitPrefsCount) {
            el.unifitPrefsCount.hidden = count <= 0;
            el.unifitPrefsCount.textContent = String(count);
        }
    };

    const updateMobileFilterUi = () => {
        const count = countActiveFilters(state, getCurrentLimits());
        if (el.mobileFilterCount) {
            el.mobileFilterCount.hidden = count <= 0;
            el.mobileFilterCount.textContent = String(count);
        }
    };

    const updateSliderLabels = () => {
        const limits = getCurrentLimits();
        const pref = getCurrentCurrency() || getPreferredCurrency();
        const minVal = Number(el.minSlider ? el.minSlider.value : state.min_tuition) || 0;
        const maxVal = Number(el.maxSlider ? el.maxSlider.value : state.max_tuition) || limits.max;
        const formattedMin = formatMoney(minVal, pref);
        const formattedMax = formatMoney(maxVal, pref);
        // At the right edge the filter has no upper limit, so pricier universities still match.
        const openEnded = maxVal >= limits.max;
        if (el.minCostLabel) el.minCostLabel.textContent = formattedMin;
        if (el.maxCostLabel) el.maxCostLabel.textContent = openEnded ? `${formattedMax}+` : formattedMax;
        if (el.minSlider) el.minSlider.setAttribute("aria-valuetext", formattedMin);
        if (el.maxSlider) el.maxSlider.setAttribute("aria-valuetext", openEnded ? tFormat("universities.cost.max_open", { amount: formattedMax }) : formattedMax);
    };

    const applySliderBounds = (limits) => {
        setCurrentLimits(limits);
        [el.minSlider, el.maxSlider, el.minInput, el.maxInput].forEach((input) => {
            if (!input) return;
            input.min = String(limits.min);
            input.max = String(limits.max);
            input.step = String(limits.step);
        });
        if (el.minInput) el.minInput.placeholder = String(limits.min);
        if (el.maxInput) el.maxInput.placeholder = String(limits.max);
        updateSliderLabels();
    };

    const fillTrack = () => {
        if (!el.minSlider || !el.maxSlider || !el.track) return;
        const limits = getCurrentLimits();
        const minVal = Number(el.minSlider.value) || 0;
        const maxVal = Number(el.maxSlider.value) || 0;
        const minLimit = Number(el.minSlider.min) || limits.min || 0;
        const maxRange = Number(el.maxSlider.max) || limits.max || 100000;
        const rangeSpan = Math.max(1, maxRange - minLimit);

        const r1 = Math.max(0, Math.min(1, (minVal - minLimit) / rangeSpan));
        const r2 = Math.max(0, Math.min(1, (maxVal - minLimit) / rangeSpan));

        const thumbSize = 18;
        const getThumbPos = (r) => {
            const pct = (r * 100).toFixed(2);
            const offset = (0.5 - r) * thumbSize;
            if (Math.abs(offset) < 0.001) return `${pct}%`;
            const sign = offset >= 0 ? "+" : "-";
            return `calc(${pct}% ${sign} ${Math.abs(offset).toFixed(2)}px)`;
        };

        const pos1 = getThumbPos(r1);
        const pos2 = getThumbPos(r2);

        const styles = getComputedStyle(el.track);
        const inactive = styles.getPropertyValue("--slider-track-inactive").trim();
        const active = styles.getPropertyValue("--slider-track-active").trim();
        el.track.style.background = `linear-gradient(to right, ${inactive} 0%, ${inactive} ${pos1}, ${active} ${pos1}, ${active} ${pos2}, ${inactive} ${pos2}, ${inactive} 100%)`;
    };

    const slideMin = () => {
        const limits = getCurrentLimits();
        const gap = limits.step;
        let minVal = Number.parseInt(el.minSlider.value, 10) || 0;
        const maxVal = Number.parseInt(el.maxSlider.value, 10) || limits.max;
        if (maxVal - minVal < gap) {
            minVal = Math.max(limits.min, maxVal - gap);
            el.minSlider.value = String(minVal);
        }
        el.minInput.value = el.minSlider.value;
        state.min_tuition = Number(el.minSlider.value);
        fillTrack();
        updateSliderLabels();
    };

    const slideMax = () => {
        const limits = getCurrentLimits();
        const gap = limits.step;
        const minVal = Number.parseInt(el.minSlider.value, 10) || 0;
        let maxVal = Number.parseInt(el.maxSlider.value, 10) || limits.max;
        if (maxVal - minVal < gap) {
            maxVal = Math.min(limits.max, minVal + gap);
            el.maxSlider.value = String(maxVal);
        }
        el.maxInput.value = el.maxSlider.value;
        state.max_tuition = Number(el.maxSlider.value);
        fillTrack();
        updateSliderLabels();
    };

    const updateTradeoffLabel = (labelEl, value, config) => {
        if (!labelEl) return;
        const val = clampPercent(value, 50);
        const leftText = t(config.leftKey, config.leftFallback);
        const rightText = t(config.rightKey, config.rightFallback);
        let text = t("universities.tradeoff.balanced", "Balanced (50/50)");
        if (val < 50) text = `${leftText} (${100 - val}%)`;
        else if (val > 50) text = `${rightText} (${val}%)`;
        labelEl.textContent = text;
    };

    const updateTradeoffLabels = () => {
        TRADEOFF_CONFIGS.forEach((config) => {
            updateTradeoffLabel(el[config.labelProp], state[config.sliderKey], config);
        });
    };

    const updateSliderVisibility = () => {
        if (el.sortStrategyInfoWrap) {
            const showSortInfo = state.sort === "uni_ai";
            el.sortStrategyInfoWrap.style.display = showSortInfo ? "" : "none";
            el.sortStrategyInfoWrap.setAttribute("aria-hidden", showSortInfo ? "false" : "true");
            if (!showSortInfo) el.sortStrategyInfoWrap.classList.remove("is-open");
        }
        if (el.sortAiTagsHint) {
            const showAiTagsHint = state.sort !== "uni_ai";
            el.sortAiTagsHint.style.display = showAiTagsHint ? "" : "none";
            el.sortAiTagsHint.setAttribute("aria-hidden", showAiTagsHint ? "false" : "true");
        }
        if (el.unifitPrefsPanel) {
            el.unifitPrefsPanel.hidden = state.sort !== "uni_ai";
        }
        updateUnifitPrefsCount();
        if (!el.sliderContainer) return;
        if (state.sort === "uni_ai") {
            el.sliderContainer.style.display = "block";
            updateTradeoffLabels();
        } else {
            el.sliderContainer.style.display = "none";
        }
    };

    const updateCityDropdown = (cities) => {
        if (!el.citySelect) return;
        if (!cities || cities.length === 0) {
            el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.select_country_first", "Select country first"))}</option>`;
            el.citySelect.disabled = true;
        } else {
            el.citySelect.disabled = false;
            el.citySelect.innerHTML = `<option value="">${escapeHtml(t("universities.all_cities", "All Cities"))}</option>`;
            cities.toSorted((a, b) => a.localeCompare(b)).forEach((c) => {
                const value = String(c || "");
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = trCity(value);
                el.citySelect.appendChild(opt);
            });
        }
        initCustomSelect("citySelect");
    };

    const updateCitiesForState = (country, region) => {
        if (!country) {
            updateCityDropdown([]);
            return;
        }
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (Array.isArray(countryData)) {
            updateCityDropdown(countryData);
            return;
        }
        if (countryData && typeof countryData === "object") {
            const cities = region
                ? countryData[region] || []
                : [...new Set(Object.values(countryData).flatMap((items) => (Array.isArray(items) ? items : [])))];
            updateCityDropdown(cities);
        }
    };

    const updateLocationLogic = (country) => {
        if (!el.stateDiv) return;
        const countryData = CITY_OPTIONS_BY_COUNTRY[country];
        if (!country || !countryData) {
            el.stateDiv.style.display = "none";
            updateCityDropdown([]);
            return;
        }
        if (Array.isArray(countryData)) {
            el.stateDiv.style.display = "none";
            updateCityDropdown(countryData);
            return;
        }
        el.stateDiv.style.display = "block";
        const states = Object.keys(countryData).sort((a, b) => a.localeCompare(b));
        el.stateSelect.innerHTML = `<option value="">${escapeHtml(t("universities.any_state", "Any State"))}</option>`;
        states.forEach((s) => {
            const value = String(s || "");
            const label = trState(value);
            el.stateSelect.innerHTML += `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
        });
        initCustomSelect("stateSelect");
        updateCitiesForState(country, "");
    };

    const updateCountryOptions = () => {
        if (!el.countrySelect) return;
        const countries = Object.keys(CITY_OPTIONS_BY_COUNTRY).sort((a, b) => a.localeCompare(b));
        const currentVal = el.countrySelect.value || state.country;
        let html = `<option value="">${escapeHtml(t("universities.global", "Global"))}</option>`;
        countries.forEach((c) => {
            const isSelected = c === currentVal ? "selected" : "";
            const value = String(c || "");
            const text = escapeHtml(trCountry(value));
            html += `<option value="${escapeHtml(value)}" ${isSelected}>${text}</option>`;
        });
        el.countrySelect.innerHTML = html;
        initCustomSelect("countrySelect");
    };

    const applyToForm = () => {
        if (el.qInput) el.qInput.value = state.q;
        syncSearchClearButton();
        if (el.countrySelect) el.countrySelect.value = state.country;
        if (el.stateSelect) el.stateSelect.value = state.region;
        if (el.citySelect) el.citySelect.value = state.city;
        if (el.sortSelect) {
            state.sort = normalizeSortMode(state.sort);
            el.sortSelect.value = state.sort;
            if (el.sortSelect.value !== state.sort) {
                state.sort = defaultSortMode;
                el.sortSelect.value = state.sort;
            }
        }
        const studyLevelSelect = $("studyLevelSelect");
        if (studyLevelSelect) studyLevelSelect.value = state.study_level || "";
        const costBasisSelect = $("costBasisSelect");
        if (costBasisSelect) costBasisSelect.value = state.cost_basis;
        TRADEOFF_CONFIGS.forEach(({ sliderKey, sliderProp }) => {
            if (el[sliderProp]) el[sliderProp].value = state[sliderKey];
        });
        if (el.minSlider) el.minSlider.value = state.min_tuition;
        if (el.maxSlider) el.maxSlider.value = state.max_tuition;
        if (el.minInput) el.minInput.value = state.min_tuition;
        if (el.maxInput) el.maxInput.value = state.max_tuition;
        if (el.reviewedOnlyToggle) el.reviewedOnlyToggle.checked = Boolean(state.only_reviewed);
        if (!initialPrefsSyncDone) {
            initialPrefsSyncDone = true;
            if (el.unifitPrefsPanel && countActiveTradeoffs() > 0) {
                el.unifitPrefsPanel.open = true;
            }
        }
        syncSavedFilterButtons();

        fillTrack();
        updateSliderLabels();

        ["countrySelect", "stateSelect", "citySelect", "sortSelect", "studyLevelSelect", "costBasisSelect"].forEach((id) => initCustomSelect(id));
        updateSliderVisibility();
        updateTradeoffLabels();
        updateMobileFilterUi();
    };

    const applySelectedCountryCascade = () => {
        if (el.countrySelect) el.countrySelect.value = state.country;
        updateLocationLogic(state.country);
        if (state.region && el.stateSelect) {
            el.stateSelect.value = state.region;
            updateCitiesForState(state.country, state.region);
        }
        if (state.city && el.citySelect) {
            el.citySelect.value = state.city;
        }
    };

    const initLocations = () => {
        updateCountryOptions();
        if (state.country) {
            applySelectedCountryCascade();
        }
        applyToForm();
    };

    const refreshLocationFilterLabels = () => {
        updateCountryOptions();
        if (!state.country) {
            if (el.countrySelect) el.countrySelect.value = "";
            if (el.stateSelect) el.stateSelect.value = "";
            if (el.citySelect) el.citySelect.value = "";
            updateLocationLogic("");
            return;
        }
        applySelectedCountryCascade();
        ["countrySelect", "stateSelect", "citySelect"].forEach((id) => initCustomSelect(id));
    };

    const resetFilterState = ({ keepSaved = false, persistAndFetch = false } = {}) => {
        clearSavedScrollPosition();
        Object.assign(state, buildFilterResetPatch(state, {
            fundingType: getProfileFundingQueryValue(),
            limits: getCurrentLimits(),
            onlySaved: keepSaved ? state.only_saved : false,
        }));
        if (persistAndFetch) saveFilters(state);
        applyToForm();
        if (el.stateDiv) el.stateDiv.style.display = "none";
        updateCityDropdown([]);
        updateSliderVisibility();
        updateMobileFilterUi();
        if (persistAndFetch) void fetchAndRender();
    };

    const handleResetAllFilters = ({ keepSaved = false } = {}) => {
        resetFilterState({ keepSaved, persistAndFetch: true });
    };

    /** Drop only the price range; every other filter stays as the visitor set it. */
    const handleClearPriceFilter = () => {
        const limits = getCurrentLimits();
        clearSavedScrollPosition();
        Object.assign(state, { min_tuition: limits.min, max_tuition: limits.max, page: 1 });
        saveFilters(state);
        applyToForm();
        void fetchAndRender();
    };

    const handleCurrencyChanged = (e) => {
        const newCurrency = String(e?.detail?.currency || e?.detail?.preferredCurrency || getPreferredCurrency() || "USD").trim().toUpperCase();
        const oldCurrency = getCurrentCurrency() || "USD";
        if (newCurrency === oldCurrency) {
            return false;
        }

        // 1. Read current slider positions
        const oldMin = Number(el.minSlider ? el.minSlider.value : state.min_tuition);
        const oldMax = Number(el.maxSlider ? el.maxSlider.value : state.max_tuition);
        const oldLimits = getCurrentLimits() || getFilterLimits(oldCurrency);

        // 2. Convert: old currency -> USD -> new currency
        const wasAtMin = !Number.isFinite(oldMin) || oldMin <= oldLimits.min;
        const wasAtMax = !Number.isFinite(oldMax) || oldMax >= oldLimits.max;

        const usdMin = convert(oldMin, oldCurrency, "USD");
        const usdMax = convert(oldMax, oldCurrency, "USD");

        const convertedMin = convert(usdMin, "USD", newCurrency);
        const convertedMax = convert(usdMax, "USD", newCurrency);

        // 3. Get new bounds from getFilterLimits(newCurrency)
        const newLimits = getFilterLimits(newCurrency);
        setCurrentLimits(newLimits);
        setCurrentCurrency(newCurrency);

        // 4. Clamp converted positions to new bounds
        const step = newLimits.step || 1;
        let clampedMin = wasAtMin ? newLimits.min : Math.max(newLimits.min, Math.min(newLimits.max, Math.round(convertedMin / step) * step));
        let clampedMax = wasAtMax ? newLimits.max : Math.max(newLimits.min, Math.min(newLimits.max, Math.round(convertedMax / step) * step));

        if (clampedMax - clampedMin < step) {
            if (clampedMin + step <= newLimits.max) {
                clampedMax = clampedMin + step;
            } else {
                clampedMin = Math.max(newLimits.min, clampedMax - step);
            }
        }

        // 5. Update slider min/max/step attributes
        applySliderBounds(newLimits);

        // 6. Update slider positions and input values
        if (el.minSlider) el.minSlider.value = String(clampedMin);
        if (el.maxSlider) el.maxSlider.value = String(clampedMax);
        if (el.minInput) el.minInput.value = String(clampedMin);
        if (el.maxInput) el.maxInput.value = String(clampedMax);
        state.min_tuition = clampedMin;
        state.max_tuition = clampedMax;
        state.currency = newCurrency;
        saveFilters(state);
        fillTrack();

        // 7. Re-render slider labels
        updateSliderLabels();
        return true;
    };

    const setupMobileFilters = () => {
        const toggleBtn = $("mobileFilterToggle");
        const sidebar = $("uSidebar");
        if (!toggleBtn || !sidebar) return null;

        let draftSnapshot = null;
        let isEditing = false;
        const isMobileViewport = () => window.innerWidth <= 1024;

        const setBackgroundInert = (active) => {
            if (!active) {
                clearSidebarInertAttributes();
                return;
            }
            let current = sidebar;
            while (current && current.parentElement && current !== document.body) {
                for (const sibling of current.parentElement.children) {
                    if (sibling !== current && sibling.tagName !== "SCRIPT" && sibling.id !== "toast-container") {
                        sibling.inert = true;
                        sibling.dataset.sidebarInert = "1";
                    }
                }
                current = current.parentElement;
            }
        };

        const setOpen = (isOpen, { apply = false } = {}) => {
            if (isOpen && !isMobileViewport()) return;
            const wasOpen = sidebar.classList.contains("is-open");
            if (isOpen) {
                draftSnapshot = { ...state };
                isEditing = true;
            } else if (isEditing && !apply && draftSnapshot) {
                Object.assign(state, draftSnapshot);
                applyToForm();
            }
            sidebar.classList.toggle("is-open", isOpen);
            if (isOpen) {
                sidebar.setAttribute("role", "dialog");
                sidebar.setAttribute("aria-modal", "true");
            } else {
                sidebar.removeAttribute("role");
                sidebar.removeAttribute("aria-modal");
            }
            toggleBtn.classList.toggle("is-active", isOpen);
            toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
            toggleBtn.hidden = isOpen;
            setBackgroundInert(isOpen);
            document.documentElement.classList.toggle("sidebar-filters-open", isOpen);
            if (isOpen) {
                const firstFocusTarget = el.mobileFilterClose || sidebar.querySelector("button, input, select, [tabindex='0']");
                firstFocusTarget?.focus({ preventScroll: true });
            } else {
                isEditing = false;
                draftSnapshot = null;
                updateMobileFilterUi();
                if (wasOpen) {
                    toggleBtn.focus({ preventScroll: true });
                }
            }
        };

        toggleBtn.addEventListener("click", () => {
            setOpen(!sidebar.classList.contains("is-open"));
        });
        el.mobileFilterClose?.addEventListener("click", () => setOpen(false));
        el.mobileResetFilters?.addEventListener("click", () => resetFilterState({ keepSaved: false, persistAndFetch: false }));
        el.mobileApplyFilters?.addEventListener("click", () => {
            if (!isEditing) return;
            state.page = 1;
            clearSavedScrollPosition();
            setOpen(false, { apply: true });
            saveFilters(state);
            void fetchAndRender();
        });

        // Close sidebar when clicking outside on mobile backdrop
        sidebar.addEventListener("click", (e) => {
            if (window.innerWidth <= 1024 && e.target === sidebar) {
                setOpen(false);
            }
        });

        mobileFilterKeydownHandler = (event) => {
            if (event.key === "Escape" && sidebar.classList.contains("is-open")) setOpen(false);
        };
        document.addEventListener("keydown", mobileFilterKeydownHandler);

        return {
            isEditing: () => isEditing,
            closeIfDesktop: () => {
                if (!isMobileViewport() && sidebar.classList.contains("is-open")) {
                    setOpen(false);
                }
            },
        };
    };

    const bindEvents = () => {
        citiesLoadedHandler = initLocations;
        window.addEventListener("citiesLoaded", citiesLoadedHandler);

        mobileFiltersApi = setupMobileFilters();

        el.countrySelect?.addEventListener("change", () => {
            state.country = el.countrySelect.value;
            state.region = "";
            state.city = "";
            if (el.stateSelect) el.stateSelect.value = "";
            if (el.citySelect) el.citySelect.value = "";
            updateLocationLogic(state.country);
            refetch();
        });

        el.stateSelect?.addEventListener("change", () => {
            state.region = el.stateSelect.value;
            state.city = "";
            updateCitiesForState(state.country, state.region);
            refetch();
        });
        el.citySelect?.addEventListener("change", () => {
            state.city = el.citySelect.value;
            refetch();
        });

        const studyLevelSelect = $("studyLevelSelect");
        if (studyLevelSelect) {
            studyLevelSelect.addEventListener("change", () => {
                state.study_level = studyLevelSelect.value;
                refetch();
            });
        }
        $("costBasisSelect")?.addEventListener("change", () => {
            state.cost_basis = $("costBasisSelect").value;
            refetch();
        });
        el.reviewedOnlyToggle?.addEventListener("change", () => {
            state.only_reviewed = Boolean(el.reviewedOnlyToggle.checked);
            refetch();
        });

        TRADEOFF_CONFIGS.forEach((config) => {
            const sliderEl = el[config.sliderProp];
            const labelEl = el[config.labelProp];
            if (!sliderEl) return;
            sliderEl.addEventListener("input", () => {
                state[config.sliderKey] = clampPercent(sliderEl.value, 50);
                updateTradeoffLabel(labelEl, state[config.sliderKey], config);
                updateUnifitPrefsCount();
            });
            sliderEl.addEventListener("change", () => {
                state[config.sliderKey] = clampPercent(sliderEl.value, 50);
                updateTradeoffLabel(labelEl, state[config.sliderKey], config);
                updateUnifitPrefsCount();
                refetch();
            });
        });

        if (el.minSlider && el.maxSlider) {
            el.minSlider.addEventListener("input", slideMin);
            el.maxSlider.addEventListener("input", slideMax);
            el.minSlider.addEventListener("change", () => refetch());
            el.maxSlider.addEventListener("change", () => refetch());
        }

        el.minInput?.addEventListener("change", () => {
            const limits = getCurrentLimits();
            const gap = limits.step;
            let val = clampTuition(el.minInput.value, limits, limits.min);
            const maxVal = Number.parseInt(el.maxSlider?.value, 10) || limits.max;
            if (val > maxVal - gap) {
                val = Math.max(limits.min, maxVal - gap);
            }
            el.minInput.value = String(val);
            if (el.minSlider) el.minSlider.value = String(val);
            state.min_tuition = val;
            fillTrack();
            updateSliderLabels();
            refetch();
        });

        el.maxInput?.addEventListener("change", () => {
            const limits = getCurrentLimits();
            const gap = limits.step;
            let val = clampTuition(el.maxInput.value, limits, limits.max);
            const minVal = Number.parseInt(el.minSlider?.value, 10) || 0;
            if (val < minVal + gap) {
                val = Math.min(limits.max, minVal + gap);
            }
            el.maxInput.value = String(val);
            if (el.maxSlider) el.maxSlider.value = String(val);
            state.max_tuition = val;
            fillTrack();
            updateSliderLabels();
            refetch();
        });

        el.resetBtn?.addEventListener("click", () => {
            motionPress(el.resetBtn);
            handleResetAllFilters();
        });
    };

    const dispose = () => {
        if (citiesLoadedHandler) {
            window.removeEventListener("citiesLoaded", citiesLoadedHandler);
            citiesLoadedHandler = null;
        }
        if (mobileFilterKeydownHandler) {
            document.removeEventListener("keydown", mobileFilterKeydownHandler);
            mobileFilterKeydownHandler = null;
        }
        mobileFiltersApi = null;
        document.documentElement.classList.remove("sidebar-filters-open");
        document.body.classList.remove("sidebar-filters-open");
        clearSidebarInertAttributes();
    };

    return {
        applySliderBounds,
        updateSliderLabels,
        fillTrack,
        updateSliderVisibility,
        updateTradeoffLabels,
        updateMobileFilterUi,
        applyToForm,
        initLocations,
        refreshLocationFilterLabels,
        handleResetAllFilters,
        handleClearPriceFilter,
        handleCurrencyChanged,
        isMobileEditing: () => Boolean(mobileFiltersApi?.isEditing()),
        closeMobileIfDesktop: () => mobileFiltersApi?.closeIfDesktop(),
        bindEvents,
        dispose,
    };
}
