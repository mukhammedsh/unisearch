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
import { routeAbout, routeGuide, routeHome, routeUniversities } from "./routes.js";
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


// HTML-код меню и профиля (вшит прямо сюда, чтобы избежать проблем с загрузкой файлов)
const LAYOUT_HTML = `
<header class="navbar">
  <div class="navbar-left">
    <a href="${routeHome()}" data-route="home" class="navbar-logo-link">
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

  <nav class="navbar-center" id="primaryNav">
    <a href="${routeHome()}" data-route="home" data-link="home" data-i18n="nav.home">Home</a>
    <a href="${routeUniversities({ tab: "catalog" })}" data-route="universities" data-link="universities" data-i18n="nav.universities">Universities</a>
    <a href="${routeGuide()}" data-route="guide" data-link="guide" data-i18n="nav.guide">Guide</a>
    <a href="${routeAbout()}" data-route="about" data-link="about" data-i18n="nav.about">About Us</a>
  </nav>

  <div class="navbar-right">
    <button class="menu-btn" id="menuToggleBtn" type="button" aria-controls="primaryNav" aria-expanded="false" aria-label="Open menu" data-i18n-aria-label="nav.open_menu">${heroIcon("bars-3", "ui-icon ui-icon--18")}</button>
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
    <button
      class="profile-trigger-btn"
      id="profileBtn"
      type="button"
      title="Profile"
      aria-label="Profile"
      aria-haspopup="dialog"
      data-i18n-title="nav.profile"
      data-i18n-aria-label="nav.profile"
    >${heroIcon("user-circle", "ui-icon ui-icon--18")}</button>
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
          <input class="settings-switch-input" type="checkbox" data-setting-input="${SETTING_STORE_RECENT_UNIVERSITIES}" />
          <span class="settings-switch-track" aria-hidden="true"><span class="settings-switch-thumb"></span></span>
          <span class="settings-switch-text" data-i18n="settings.type.bool">Off / on</span>
        </label>
      </article>
      <article class="settings-row" data-setting-key="${SETTING_OPEN_UNIVERSITIES_NEW_TAB}">
        <div class="settings-copy">
          <h3 data-i18n="settings.option.open_universities_new_tab.title">Open universities in a new tab</h3>
          <p data-i18n="settings.option.open_universities_new_tab.desc">When enabled, university cards and recently viewed links open detail pages in a separate browser tab while keeping the current list in place.</p>
        </div>
        <label class="settings-switch">
          <input class="settings-switch-input" type="checkbox" data-setting-input="${SETTING_OPEN_UNIVERSITIES_NEW_TAB}" />
          <span class="settings-switch-track" aria-hidden="true"><span class="settings-switch-thumb"></span></span>
          <span class="settings-switch-text" data-i18n="settings.type.bool">Off / on</span>
        </label>
      </article>
    </div>
  </section>
</div>

<div class="profile-modal" id="profileModal">
  <div class="profile-backdrop" data-close="profile"></div>
  <div class="profile-card" role="dialog">
    <div class="profile-header">
      <div class="profile-title">
        <div class="profile-username">
          <span id="profileNameDisplay">User</span>
          <input id="profileNameInput" class="profile-name-input" type="text" value="User" minlength="3" maxlength="16" />
          <button class="icon-btn" id="editNameBtn" title="Edit Name" data-i18n-title="profile.action.edit_name">
            ${heroIcon("pencil-square", "ui-icon ui-icon--18")}
          </button>
        </div>
        <div class="profile-subtitle" data-i18n="nav.profile">Profile</div>
      </div>
      <button class="icon-btn profile-close" id="profileCloseBtn" title="Close" data-i18n-title="profile.action.close">
        ${heroIcon("x-mark", "ui-icon ui-icon--18")}
      </button>
    </div>

    <div id="usernameError" class="profile-error profile-error--username"></div>

    <div class="profile-progress" id="profileProgressText" data-i18n="profile.progress.empty">Complete your profile for better matches.</div>
    <div class="profile-section-tabs" role="tablist" aria-label="Profile sections" data-i18n-aria-label="profile.sections.aria">
      <button class="profile-section-tab is-active" type="button" data-profile-tab="basics" role="tab" aria-selected="true" data-i18n="profile.section.basics">Basics</button>
      <button class="profile-section-tab" type="button" data-profile-tab="scores" role="tab" aria-selected="false" data-i18n="profile.section.scores">Scores</button>
      <button class="profile-section-tab" type="button" data-profile-tab="languages" role="tab" aria-selected="false" data-i18n="profile.section.languages">Languages</button>
      <button class="profile-section-tab" type="button" data-profile-tab="preferences" role="tab" aria-selected="false" data-i18n="profile.section.preferences">Preferences</button>
    </div>

    <div class="profile-body">
      
      <div class="profile-field" data-profile-section="basics">
        <label class="profile-label" data-i18n="profile.label.budget">Total Budget (USD / year)</label>
        <div class="profile-budget">
          <input id="budgetInput" class="profile-input" type="text" placeholder="e.g. 20000" data-i18n-placeholder="profile.placeholder.budget" />
        </div>
        <div class="profile-hint" data-i18n="profile.hint.budget_range">Range: 0вЂ‘1,000,000</div>
      </div>

      <div class="profile-field" data-profile-section="basics">
        <label class="profile-label" data-i18n="profile.label.study_mode">Preferred Study Mode</label>
        <select id="studyModeSelect" class="profile-input profile-input--select">
           <option value="Any" data-i18n="profile.option.study_mode_any">Any (All formats)</option>
           <option value="On-campus" data-i18n="profile.option.study_mode_oncampus">On-campus (Live)</option>
           <option value="Online" data-i18n="profile.option.study_mode_online">Online / Distance</option>
        </select>
      </div>

      <div class="profile-field" data-profile-section="basics">
        <label class="profile-label" data-i18n="profile.label.funding_type">Preferred Funding Type</label>
        <select id="profileFundingTypeSelect" class="profile-input profile-input--select">
           <option value="any" data-i18n="profile.option.funding_any">Any (Grant + Paid)</option>
           <option value="grant" data-i18n="profile.option.funding_grant">Grant only</option>
           <option value="paid" data-i18n="profile.option.funding_paid">Paid only</option>
        </select>
        <div id="profileLowBudgetGrantHint" class="profile-budget-grant-hint" hidden>
          <span class="profile-budget-grant-hint__text" data-i18n="profile.hint.low_budget_grant">Budget is under $1000. Maybe you need Grant only.</span>
          <div class="profile-budget-grant-hint__actions">
            <button id="profileLowBudgetGrantApply" type="button" class="profile-budget-grant-hint__cta" data-i18n="profile.hint.low_budget_grant_action">Set Grant only</button>
            <button id="profileLowBudgetGrantDismiss" type="button" class="profile-budget-grant-hint__dismiss" title="Dismiss hint" data-i18n-title="profile.hint.dismiss" aria-label="Dismiss hint">${heroIcon("x-mark", "ui-icon ui-icon--16")}</button>
          </div>
        </div>
      </div>

      <div class="profile-field" data-profile-section="preferences">
        <label class="profile-label" data-i18n="profile.label.major">Intended Major</label>
        <select id="profileMajorSelect" class="profile-input profile-input--select">
           <option value="" data-i18n="profile.option.major_any">Undecided / Any</option>
        </select>
      </div>

      <div class="profile-field" data-profile-section="preferences">
        <label class="profile-label" data-i18n="profile.label.interests">What You Want in a University</label>
        <textarea
          id="profileInterestsInput"
          class="profile-input"
          rows="4"
          maxlength="1200"
          placeholder="Example: computer science with AI/ML focus, strong research labs, tuition under $20k, scholarships for international students, big city, internships at tech companies"
          data-i18n-placeholder="profile.placeholder.interests"
        ></textarea>
        <div
          id="profileInterestsLangWarning"
          class="profile-interests-warning"
          hidden
          data-i18n="profile.warning.interests_english_only"
        >If automatic translation is unavailable, write this field in English.</div>
        <div class="profile-hint" data-i18n="profile.hint.interests">Write what matters to you in a university so UniSearch can sort results more personally.</div>
        <div class="profile-interest-chips" aria-label="Interest examples" data-i18n-aria-label="profile.interest_examples">
          <button type="button" data-interest-chip="computer science, scholarships, internships" data-i18n="profile.interest_chip.tech">Tech + scholarships</button>
          <button type="button" data-interest-chip="big city, strong student life, internships" data-i18n="profile.interest_chip.city">Big city</button>
          <button type="button" data-interest-chip="research labs, science, academic environment" data-i18n="profile.interest_chip.research">Research labs</button>
        </div>
      </div>

      <div class="profile-field" data-profile-section="scores">
        <div class="profile-label-row">
          <label class="profile-label" for="gpaInput" data-i18n="profile.label.gpa">GPA (Percent)</label>
          <span class="profile-info-wrap">
            <button
              type="button"
              class="profile-info"
              aria-label="How GPA works here"
              data-i18n-aria-label="profile.gpa_info_title"
            >${heroIcon("information-circle", "ui-icon ui-icon--14")}</button>
            <span class="profile-tooltip" role="tooltip">
              <strong data-i18n="profile.gpa_info_title">How GPA works here</strong>
              <span data-i18n="profile.gpa_info_tooltip">Enter GPA as percent from 0 to 100. This is a UniSearch-only format for matching and estimates. Real universities review your original transcript and grading scale in context.</span>
            </span>
          </span>
        </div>
        <div class="profile-budget profile-budget--with-unit">
          <input id="gpaInput" class="profile-input" type="number" min="0" max="100" step="0.1" placeholder="e.g. 92" data-i18n-placeholder="profile.placeholder.gpa" />
          <span class="profile-unit" data-i18n="profile.unit.gpa">% (0 to 100)</span>
        </div>
      </div>

      <div class="profile-field" data-profile-section="scores">
        <label class="profile-label" data-i18n="profile.label.exams">Exams (list, optional)</label>
        
        <div class="profile-exam-form">
          <select id="examNameSelect" class="profile-input profile-input--select">
             <option value="" disabled selected data-i18n="profile.option.select_exam">Select Exam</option>
             <option value="IELTS">IELTS</option>
             <option value="TOEFL">TOEFL</option>
             <option value="SAT">SAT</option>
             <option value="ACT">ACT</option>
          </select>

          <input id="examScoreInput" class="profile-input" type="number" step="0.1" placeholder="Score" data-i18n-placeholder="profile.placeholder.score" />
          <div id="examSpecialInputContainer" class="profile-exam-special" hidden></div>
          <button id="addExamBtn" class="profile-add" type="button" data-i18n="profile.add">Add</button>
        </div>
        
        <div id="examError" class="profile-error"></div>
        <div id="examList" class="profile-exam-list"></div>
      </div>

      <section class="profile-block" id="languagesBlock" data-profile-section="languages">
        <div class="profile-block-head">
            <h3 data-i18n="profile.languages">Languages</h3>
        </div>

        <div class="lang-add-grid lang-add-grid--compact">
            <div>
            <span class="mini-label" data-i18n="profile.language">Language</span>
            <select id="langCode" class="profile-input" data-flags="off"></select>
            </div>

            <div>
            <span class="mini-label" data-i18n="profile.type">Type</span>
            <select id="langKind" class="profile-input"></select>
            </div>

            <div id="cefrContainer" class="profile-lang-conditional">
            <span class="mini-label" data-i18n="profile.cefr">CEFR</span>
            <select id="langCefr" class="profile-input">
                <option value="1">A1</option>
                <option value="2">A2</option>
                <option value="3">B1</option>
                <option value="4">B2</option>
                <option value="5">C1</option>
                <option value="6">C2</option>
            </select>
            </div>

            <div id="examContainer" class="profile-lang-conditional">
            <span class="mini-label" data-i18n="profile.exam">Exam</span>
            <select id="langExam" class="profile-input" data-flags="off"></select>
            </div>

            <div id="scoreContainer" class="profile-lang-conditional">
            <span class="mini-label" data-i18n="profile.score">Score</span>
            <input id="langExamScore"
                    type="text"
                    inputmode="decimal"
                    class="profile-input"
                    placeholder="Score (e.g. 7.5)"
                    data-i18n-placeholder="profile.placeholder.lang_score" />
            </div>

            <div id="langExamSpecialContainer" class="profile-exam-special profile-lang-conditional" hidden></div>

            <button id="langAddBtn" class="profile-add" type="button" data-i18n="profile.add">Add</button>
        </div>

        <div id="langList" class="lang-list"></div>
        </section>

      <div class="profile-actions">
        <span id="profileSaveState" class="profile-save-state" data-i18n="profile.state.saved">Saved</span>
        <button id="saveProfileBtn" class="profile-add profile-add--primary" type="button" data-i18n="profile.action.save_all">Save Profile</button>
      </div>

      <div class="profile-reset-zone">
        <div class="profile-reset-copy">
          <strong data-i18n="profile.reset.title">Reset profile data</strong>
          <span data-i18n="profile.reset.note">Clears budget, GPA, exams, languages, interests, and other saved profile fields on this device.</span>
        </div>
        <button id="resetProfileBtn" class="profile-delete profile-delete--danger" type="button" data-i18n="profile.reset.cta">Reset data</button>
      </div>

  </div>
</div>

<div class="profile-confirm-modal" id="profileUnsavedModal" aria-hidden="true">
  <div class="profile-confirm-backdrop" data-close="unsaved"></div>
  <div class="profile-confirm-card" role="dialog" aria-modal="true" aria-labelledby="profileUnsavedTitle">
    <h3 id="profileUnsavedTitle" data-i18n="profile.unsaved.title">Unsaved Changes</h3>
    <p data-i18n="profile.unsaved.message">You have unsaved profile changes. What do you want to do?</p>
    <div class="profile-confirm-actions">
      <button id="profileDiscardBtn" class="profile-delete" type="button" data-i18n="profile.unsaved.discard">Close without saving</button>
      <button id="profileCancelCloseBtn" class="profile-add profile-add--secondary" type="button" data-i18n="profile.unsaved.cancel">Cancel</button>
      <button id="profileSaveAndCloseBtn" class="profile-add" type="button" data-i18n="profile.unsaved.save_close">Save and close</button>
    </div>
  </div>
</div>

<div class="profile-confirm-modal" id="profileResetModal" aria-hidden="true">
  <div class="profile-confirm-backdrop" data-close="reset"></div>
  <div class="profile-confirm-card" role="dialog" aria-modal="true" aria-labelledby="profileResetTitle">
    <h3 id="profileResetTitle" data-i18n="profile.reset.confirm_title">Reset all profile data?</h3>
    <p data-i18n="profile.reset.confirm_message">This will remove all saved profile data on this device and set the profile back to empty values.</p>
    <div class="profile-confirm-actions">
      <button id="profileResetCancelBtn" class="profile-add profile-add--secondary" type="button" data-i18n="profile.reset.cancel">Cancel</button>
      <button id="profileResetConfirmBtn" class="profile-delete profile-delete--danger" type="button" data-i18n="profile.reset.confirm">Reset data</button>
    </div>
  </div>
</div>

<div id="toast-container" class="toast-container"></div>
`;

function initMobileMenu() {
    const navbar = document.querySelector(".navbar");
    const menuBtn = document.getElementById("menuToggleBtn");
    const nav = document.getElementById("primaryNav");
    if (!navbar || !menuBtn || !nav) return;
    if (menuBtn.dataset.bound === "1") return;
    menuBtn.dataset.bound = "1";

    const closeMenu = () => {
        navbar.classList.remove("is-menu-open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.setAttribute("aria-label", t("nav.open_menu", "Open menu"));
        setHeroIcon(menuBtn, "bars-3", "ui-icon ui-icon--18");
    };

    const openMenu = () => {
        navbar.classList.add("is-menu-open");
        menuBtn.setAttribute("aria-expanded", "true");
        menuBtn.setAttribute("aria-label", t("nav.close_menu", "Close menu"));
        setHeroIcon(menuBtn, "x-mark", "ui-icon ui-icon--18");
    };

    menuBtn.addEventListener("click", () => {
        const isOpen = navbar.classList.contains("is-menu-open");
        if (isOpen) closeMenu();
        else openMenu();
    });

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
    });

    const media = window.matchMedia("(max-width: 980px)");
    const onViewportChange = (e) => {
        if (!e.matches) closeMenu();
    };
    if (typeof media.addEventListener === "function") {
        media.addEventListener("change", onViewportChange);
    } else if (typeof media.addListener === "function") {
        media.addListener(onViewportChange);
    }
}

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

let profileUiPromise = null;

function bindLazyProfileUi() {
    const profileBtn = document.getElementById("profileBtn");
    if (!profileBtn || profileBtn.dataset.profileLazyBound === "1") return;
    profileBtn.dataset.profileLazyBound = "1";

    const loadProfileUi = async () => {
        if (!profileUiPromise) {
            profileUiPromise = Promise.all([
                import("./components/profile-ui.js"),
                initUniversityTranslations().catch(() => null),
            ]).then(([module]) => {
                module.initProfileUI?.();
                return module;
            });
        }
        return profileUiPromise;
    };

    const onProfileClick = async (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        profileBtn.disabled = true;
        try {
            await loadProfileUi();
            profileBtn.removeEventListener("click", onProfileClick, true);
            profileBtn.dataset.profileLazyBound = "loaded";
            profileBtn.disabled = false;
            profileBtn.click();
        } catch (error) {
            profileUiPromise = null;
            console.error("Profile UI failed to load:", error);
        } finally {
            profileBtn.disabled = false;
        }
    };

    profileBtn.addEventListener("click", onProfileClick, true);
}

function syncAdaptiveNavbarLayout() {
    const navbar = document.querySelector(".navbar");
    const left = document.querySelector(".navbar-left");
    const center = document.querySelector(".navbar-center");
    const right = document.querySelector(".navbar-right");
    if (!navbar || !left || !center || !right) return;

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
    const centerWidth = Math.max(center.scrollWidth || 0, center.getBoundingClientRect().width || 0);
    const requiredWidth = Math.ceil(leftWidth + centerWidth + rightWidth);

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

export async function loadGlobalLayout() {
    if (document.getElementById("profileModal")) return;
    try {
        document.body.insertAdjacentHTML("afterbegin", resolveLayoutMarkup(LAYOUT_HTML));
        syncNavbarLogo();
        bindThemeUiSync();

        // Подсветка активной ссылки в меню
        const currentPageRaw = String(document.body.getAttribute('data-page') || "").trim().toLowerCase();
        const currentPage = (currentPageRaw === "university") ? "universities" : currentPageRaw;
        if (currentPage) {
            document.querySelectorAll(".navbar-center a").forEach((link) => link.classList.remove("is-active"));
            const activeLink = document.querySelector(`.navbar-center a[data-link="${currentPage}"]`) || 
                               document.querySelector(`.navbar-center a[href*="${currentPage}"]`);
            if (activeLink) {
                activeLink.classList.add("is-active");
            }
        }

        initMobileMenu();
        initThemeToggleUi();
        initLanguageSwitcher();
        applyTranslations(document);
        if (typeof initCustomSelect === "function") initCustomSelect("languageSelect");
        initAdaptiveNavbarLayout();

        // Add sliding indicator for navbar
        setupSlidingIndicator("#primaryNav", "a", "is-active");
        initSettingsUI();

        // Запускаем логику профиля
        bindLazyProfileUi();

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
      btn.onclick = (e) => {
        e.preventDefault();
        onRetry();
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
