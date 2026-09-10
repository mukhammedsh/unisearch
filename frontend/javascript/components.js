/* 2. components.js - Элементы интерфейса */
import {
  getCurrentTheme,
  initCustomSelect,
  motionPress,
  replayMotion,
  setupSlidingIndicator,
  toggleTheme,
} from "./utils.js";
import { applyTranslations, getCurrentLanguage, setLanguage, t } from "./i18n.js";
import { heroIcon, setHeroIcon } from "./icons.js";
import { initUniversityTranslations } from "./university-translations.js";
import { routeProfile, routeUniversities } from "./routes.js";
import {
  bindThemeUiSync,
  NAV_LOGO_DARK,
  NAV_LOGO_FALLBACK,
  NAV_LOGO_LIGHT,
  resolveLayoutMarkup,
  syncNavbarLogo,
} from "./components/shell.js";
import { initSettingsUI } from "./components/settings-ui.js";
import { SETTING_STORE_RECENT_UNIVERSITIES, SETTING_OPEN_UNIVERSITIES_NEW_TAB } from "./settings.js";
import { safeSessionStorage } from "./utils/safe-storage.js";

const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";

// Базовый HTML-каркас шапки навигации и модального окна настроек
const LAYOUT_HTML = `
<header class="navbar">
  <div class="navbar-left">
    <a href="${routeUniversities()}" data-route="universities" class="navbar-logo-link">
      <img
        src="${NAV_LOGO_LIGHT}"
        data-logo-light="${NAV_LOGO_LIGHT}"
        data-logo-dark="${NAV_LOGO_DARK}"
        data-fallback-src="${NAV_LOGO_FALLBACK}"
        alt="Logo"
        class="logo"
      />
    </a>
  </div>

  <div class="navbar-search" id="universitySearch" role="search" hidden>
    <span class="navbar-search-icon" aria-hidden="true">${heroIcon("magnifying-glass", "ui-icon ui-icon--18")}</span>
    <input id="qInput" type="search" placeholder="Search university..." data-i18n-placeholder="universities.search_placeholder" aria-label="Search university" data-i18n-aria-label="universities.search_placeholder" autocomplete="off" spellcheck="false" />
    <button id="searchClearBtn" class="navbar-search-clear" type="button" aria-label="Clear search" data-i18n-aria-label="universities.search_clear" title="Clear search" data-i18n-title="universities.search_clear" hidden>
      ${heroIcon("x-mark", "ui-icon ui-icon--16")}
    </button>
  </div>

  <div class="navbar-right">
    <div class="lang-control">
      <select id="languageSelect" class="lang-switch" aria-label="Language" data-i18n-aria-label="nav.language">
        <option value="eng">English (US)</option>
        <option value="rus">Русский</option>
      </select>
    </div>
    <button class="theme-btn" id="themeToggleBtn" type="button" title="Switch theme" aria-label="Switch theme" data-i18n-title="nav.switch_theme" data-i18n-aria-label="nav.switch_theme">${heroIcon("moon", "ui-icon ui-icon--18")}</button>
    <button
      class="settings-trigger-btn"
      id="settingsBtn"
      type="button"
      title="Settings"
      aria-label="Settings"
      aria-haspopup="dialog"
      data-i18n-title="nav.settings"
      data-i18n-aria-label="nav.settings"
    >${heroIcon("cog-6-tooth", "ui-icon ui-icon--18")}</button>
    <a
      class="profile-trigger-btn"
      id="profileBtn"
      href="${routeProfile()}"
      data-route="profile"
      title="Profile"
      aria-label="Profile"
      data-i18n-title="nav.profile"
      data-i18n-aria-label="nav.profile"
    >${heroIcon("user-circle", "ui-icon ui-icon--18")}</a>
  </div>
</header>

<div class="settings-modal" id="settingsModal" aria-hidden="true">
  <div class="settings-backdrop" data-close="settings"></div>
  <section class="settings-card" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
    <div class="settings-header">
      <div>
        <h2 id="settingsTitle" data-i18n="settings.title">Settings</h2>
        <p data-i18n="settings.subtitle">Control how UniSearch stores local interface data on this device.</p>
      </div>
      <button class="icon-btn settings-close" id="settingsCloseBtn" type="button" title="Close" aria-label="Close" data-i18n-title="profile.action.close" data-i18n-aria-label="profile.action.close">
        ${heroIcon("x-mark", "ui-icon ui-icon--18")}
      </button>
    </div>
    <div class="settings-list" id="settingsList">
      <article class="settings-row" data-setting-key="${SETTING_STORE_RECENT_UNIVERSITIES}">
        <div class="settings-copy">
          <h3 data-i18n="settings.option.store_recent.title">Save recently opened</h3>
          <p data-i18n="settings.option.store_recent.desc">When enabled, UniSearch adds universities you open to the local recently viewed list on this device.</p>
        </div>
        <label class="settings-switch">
          <input class="settings-switch-input" type="checkbox" role="switch" aria-label="Save recently opened" data-i18n-aria-label="settings.option.store_recent.title" data-setting-input="${SETTING_STORE_RECENT_UNIVERSITIES}" />
          <span class="settings-switch-track" aria-hidden="true"><span class="settings-switch-thumb"></span></span>
        </label>
      </article>
      <article class="settings-row" data-setting-key="${SETTING_OPEN_UNIVERSITIES_NEW_TAB}">
        <div class="settings-copy">
          <h3 data-i18n="settings.option.open_universities_new_tab.title">Open universities in a new tab</h3>
          <p data-i18n="settings.option.open_universities_new_tab.desc">When enabled, university cards and recently viewed links open detail pages in a separate browser tab while keeping the current list in place.</p>
        </div>
        <label class="settings-switch">
          <input class="settings-switch-input" type="checkbox" role="switch" aria-label="Open universities in a new tab" data-i18n-aria-label="settings.option.open_universities_new_tab.title" data-setting-input="${SETTING_OPEN_UNIVERSITIES_NEW_TAB}" />
          <span class="settings-switch-track" aria-hidden="true"><span class="settings-switch-thumb"></span></span>
        </label>
      </article>
    </div>
  </section>
</div>

<div id="toast-container" class="toast-container"></div>
`;

function initThemeToggleUi() {
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (!themeToggleBtn) return;

    const syncThemeButton = (themeOverride = "") => {
        const theme = String(themeOverride || getCurrentTheme() || "").trim().toLowerCase();
        setHeroIcon(themeToggleBtn, theme === "dark" ? "sun" : "moon", "ui-icon ui-icon--18");
        themeToggleBtn.title = t("nav.switch_theme", "Switch theme");
        themeToggleBtn.setAttribute("aria-label", t("nav.switch_theme", "Switch theme"));
        syncNavbarLogo(theme);
    };

    syncThemeButton();

    if (themeToggleBtn.dataset.themeBound !== "1") {
        themeToggleBtn.dataset.themeBound = "1";
        themeToggleBtn.addEventListener("click", () => {
            syncThemeButton(toggleTheme());
        });
    }

    if (window.__unisearchThemeShellBound !== true) {
        window.__unisearchThemeShellBound = true;
        window.addEventListener("themeChanged", (e) => {
            const theme = String(e?.detail?.theme || "").trim().toLowerCase();
            syncThemeButton(theme);
        });
        window.addEventListener("pageshow", () => {
            syncThemeButton();
        });
    }
}

function bindProfileNavAction() {
    const profileBtn = document.getElementById("profileBtn");
    if (!profileBtn || profileBtn.dataset.profileBound === "1") return;
    profileBtn.dataset.profileBound = "1";

    profileBtn.addEventListener("click", (event) => {
        const isProfile = Boolean(
            document.body.dataset.page === "profile" ||
            /\/profile(?:\.html)?$/i.test(window.location.pathname)
        );
        if (isProfile) {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            safeSessionStorage.set(PROFILE_RETURN_URL_KEY, window.location.href);
        }
    });
}

function syncAdaptiveNavbarLayout() {
    const navbar = document.querySelector(".navbar");
    const left = document.querySelector(".navbar-left");
    const center = document.querySelector(".navbar-search:not([hidden])");
    const right = document.querySelector(".navbar-right");
    if (!navbar || !left || !right) return;

    // Mobile/tablet layout is handled via CSS media rules.
    if (window.matchMedia("(max-width: 980px)").matches) {
        navbar.classList.remove("is-compact");
        return;
    }

    navbar.classList.remove("is-compact");

    const navStyle = window.getComputedStyle(navbar);
    const navPadLeft = Number.parseFloat(navStyle.paddingLeft || "0") || 0;
    const navPadRight = Number.parseFloat(navStyle.paddingRight || "0") || 0;
    const availableWidth = Math.max(0, navbar.clientWidth - navPadLeft - navPadRight);

    const leftWidth = left.getBoundingClientRect().width || 0;
    const rightWidth = right.getBoundingClientRect().width || 0;
    const centerWidth = center ? Math.max(center.scrollWidth || 0, center.getBoundingClientRect().width || 0) : 0;
    const columnGap = Number.parseFloat(navStyle.columnGap || navStyle.gap || "0") || 0;
    const requiredWidth = Math.ceil((Math.max(leftWidth, rightWidth) * 2) + centerWidth + (columnGap * 2));

    if (requiredWidth > availableWidth + 1) {
        navbar.classList.add("is-compact");
    }
}

let __adaptiveNavbarBound = false;
function initAdaptiveNavbarLayout() {
    syncAdaptiveNavbarLayout();
    if (__adaptiveNavbarBound) return;
    __adaptiveNavbarBound = true;

    let rafId = 0;
    const scheduleSync = () => {
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => {
            rafId = 0;
            syncAdaptiveNavbarLayout();
        });
    };

    window.addEventListener("resize", scheduleSync);
    window.addEventListener("orientationchange", scheduleSync);
    window.addEventListener("languageChanged", scheduleSync);
    window.addEventListener("load", scheduleSync);
}

function initLanguageSwitcher() {
    const languageSelect = document.getElementById("languageSelect");
    if (!languageSelect) return;
    if (languageSelect.dataset.bound === "1") {
        languageSelect.value = getCurrentLanguage();
        initCustomSelect("languageSelect");
        return;
    }
    languageSelect.dataset.bound = "1";
    languageSelect.value = getCurrentLanguage();

    languageSelect.addEventListener("change", async () => {
        if (languageSelect.dataset.loading === "1") return;
        languageSelect.dataset.loading = "1";
        languageSelect.disabled = true;

        try {
            const next = String(languageSelect.value || "").trim().toLowerCase();
            const nextLang = next || "eng";
            setLanguage(nextLang, { persist: true, emit: false });
            try {
                await initUniversityTranslations();
            } catch (e) {
                // keep fallback localization when translation endpoint is unavailable
            }
            applyTranslations(document);
            window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: nextLang } }));
        } finally {
            languageSelect.disabled = false;
            languageSelect.dataset.loading = "0";
        }
    });

    window.addEventListener("languageChanged", () => {
        languageSelect.value = getCurrentLanguage();
        initCustomSelect("languageSelect");
    });
}

export function addFooterProductLinks() {
    document.querySelectorAll(".site-footer .footer-meta").forEach((meta) => {
        if (meta.querySelector(".footer-product-links")) return;
        const legalNav = meta.querySelector(".footer-legal-links");
        if (!legalNav) return;
        legalNav.insertAdjacentHTML("beforebegin", `
            <nav class="footer-product-links footer-legal-links" aria-label="Product navigation" data-i18n-aria-label="footer.product_nav_aria">
              <a href="guide.html" data-route="guide" data-i18n="nav.guide">Guide</a>
              <span class="footer-divider" aria-hidden="true">&bull;</span>
              <a href="about.html" data-route="about" data-i18n="nav.about">About Us</a>
            </nav>
            <span class="footer-divider" aria-hidden="true">&bull;</span>
        `);
    });
}

export async function loadGlobalLayout() {
    if (document.querySelector(".navbar")) return;
    try {
        document.body.insertAdjacentHTML("afterbegin", resolveLayoutMarkup(LAYOUT_HTML));
        const navbar = document.querySelector(".navbar");
        const search = document.getElementById("universitySearch");
        const isUniversitiesWorkspace = document.body.dataset.page === "universities";
        if (navbar) navbar.classList.toggle("has-university-search", isUniversitiesWorkspace);
        if (search) search.hidden = !isUniversitiesWorkspace;
        syncNavbarLogo();
        bindThemeUiSync();
        initThemeToggleUi();
        initLanguageSwitcher();
        addFooterProductLinks();
        applyTranslations(document);
        if (typeof initCustomSelect === "function") initCustomSelect("languageSelect");
        initAdaptiveNavbarLayout();

        initSettingsUI();

        // Запускаем логику профиля
        bindProfileNavAction();

    } catch (error) {
        console.error("Error loading layout:", error);
    }
}
export function setupTabs() {
  const tabsRoot = document.querySelector(".d-tabs");
  if (!tabsRoot) return;
  if (tabsRoot.dataset.bound === "1") return;
  tabsRoot.dataset.bound = "1";

  const buttons = Array.from(tabsRoot.querySelectorAll(".d-tab-btn"));
  const panes = Array.from(document.querySelectorAll(".d-tab-pane"));

  tabsRoot.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest(".d-tab-btn") : null;
    if (!btn || !tabsRoot.contains(btn)) return;
    buttons.forEach((b) => b.classList.remove("active"));
    panes.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    motionPress(btn);
    const tabId = btn.getAttribute("data-tab");
    const targetPane = tabId ? document.getElementById(tabId) : null;
    if (targetPane) {
      targetPane.classList.add("active");
      replayMotion(targetPane, "motion-panel-enter", { timeoutMs: 420 });
    }
  });
  
  setupSlidingIndicator(".d-tabs", ".d-tab-btn", "active");
}
/**
 * Отрисовывает экран "Нет подключения к интернету"
 * @param {Object} options 
 * @param {Function} options.onRetry Коллбек для кнопки повтора
 * @param {string} options.containerId ID контейнера, куда вставить (опционально)
 * @returns {string} HTML-строка
 */
export function renderNoConnection(options = {}) {
  const { onRetry, containerId, targetEl } = options;
  const html = `
    <div class="error-screen error-screen--full fadeIn">
      <div class="error-icon-wrap">
        ${heroIcon("exclamation-triangle", "ui-icon ui-icon--32")}
      </div>
      <h2 class="error-title" data-i18n="error.no_connection.title">No Internet Connection</h2>
      <p class="error-desc" data-i18n="error.no_connection.desc">We couldn't reach the server. Please check your internet connection and try again.</p>
      <button class="error-btn" id="errorRetryBtn">
        ${heroIcon("arrow-path", "ui-icon ui-icon--18")}
        <span data-i18n="error.retry">Retry</span>
      </button>
    </div>
  `;

  const container = targetEl || (containerId ? document.getElementById(containerId) : null);
  
  if (container) {
    container.innerHTML = html;
    applyTranslations(container);
    const btn = container.querySelector("#errorRetryBtn");
    if (btn && typeof onRetry === "function") {
      btn.onclick = async (e) => {
        e.preventDefault();
        if (btn.disabled || btn.classList.contains("is-loading")) return;
        btn.disabled = true;
        btn.classList.add("is-loading");
        btn.setAttribute("aria-busy", "true");
        try {
          await Promise.resolve(onRetry());
        } finally {
          if (document.body.contains(btn)) {
            btn.disabled = false;
            btn.classList.remove("is-loading");
            btn.removeAttribute("aria-busy");
          }
        }
      };
    }
  }

  // Специфичное требование: если показывается ошибка подключения, загрузчик скелета больше не нужен
  const siteLoader = document.getElementById("siteInitialLoader");
  if (siteLoader) {
    siteLoader.classList.add("is-hidden");
    document.body.classList.remove("initial-loading");
    // Удаляем его через некоторое время, чтобы анимация завершилась
    setTimeout(() => {
        if (siteLoader.parentNode) siteLoader.remove();
    }, 600);
  }

  return html;
}
