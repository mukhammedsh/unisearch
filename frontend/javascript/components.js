/* 2. components.js - Элементы интерфейса */
import {
  loadProfile,
  normalizeProfileData,
  saveProfile,
  initCustomSelect,
  EXAM_CONFIG,
  getExamDisplayName,
  canonicalizeExamId,
  escapeHtml,
  showToast,
  API_BASE,
  MAJOR_OPTIONS,
  toggleTheme,
  getCurrentTheme,
} from "./utils.js";
import { applyTranslations, getCurrentLanguage, setLanguage, t, tFormat } from "./i18n.js";
import { initUniversityTranslations, translateProgramName } from "./university-translations.js";
import { routeAbout, routeGuide, routeHome, routeRanking, routeUniversities } from "./routes.js";

function syncNavbarLogo(themeOverride = "") {
    const navbarLogo = document.querySelector(".logo[data-logo-light][data-logo-dark]");
    if (!navbarLogo) return;
    const theme = (themeOverride || getCurrentTheme() || "light").toLowerCase();
    const nextLogo = theme === "dark" ? "/images/darklogo.png" : "/images/whitelogo.png";
    if (!nextLogo) return;
    if (navbarLogo.getAttribute("src") !== nextLogo) {
        navbarLogo.dataset.fallback = "0";
        navbarLogo.setAttribute("src", nextLogo);
    }
}

let __themeUiSyncBound = false;
function bindThemeUiSync() {
    if (__themeUiSyncBound) return;
    __themeUiSyncBound = true;

    const syncNow = () => syncNavbarLogo();

    try {
        const obs = new MutationObserver(() => syncNow());
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {
        // ignore
    }

    window.addEventListener("load", syncNow);
    window.addEventListener("pageshow", syncNow);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) syncNow();
    });
}

const LAYOUT_CACHE_KEY = "unisearch_layout_cache_v1";
const TRANSLATION_STATUS_CACHE_TTL_MS = 60_000;
const PROFILE_DRAFT_TRANSFER_KEY = "unisearch_profile_draft_transfer_v1";
const PROFILE_DRAFT_TRANSFER_TTL_MS = 5 * 60_000;
let __translationStatusCache = {
    ts: 0,
    data: null,
    inFlight: null,
};

function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash);
}

function readLayoutCache() {
    try {
        const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.html !== "string" || typeof parsed.hash !== "string") return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function writeLayoutCache(html, hash) {
    try {
        localStorage.setItem(LAYOUT_CACHE_KEY, JSON.stringify({ html, hash, ts: Date.now() }));
    } catch (e) {
        // ignore
    }
}

function persistProfileDraftForReload(reason = "reload", nextLanguage = "") {
    try {
        const draftApi = window.__unisearchProfileDraft;
        if (!draftApi || typeof draftApi.get !== "function") return;

        const draft = draftApi.get();
        if (!draft || typeof draft !== "object") return;

        const payload = {
            ts: Date.now(),
            path: String(window.location.pathname || ""),
            reason: String(reason || "reload"),
            nextLanguage: String(nextLanguage || "").trim().toLowerCase(),
            active: typeof draftApi.isActive === "function" ? Boolean(draftApi.isActive()) : false,
            draft,
        };
        sessionStorage.setItem(PROFILE_DRAFT_TRANSFER_KEY, JSON.stringify(payload));
    } catch (e) {
        // ignore
    }
}

function consumeProfileDraftAfterReload() {
    try {
        const raw = sessionStorage.getItem(PROFILE_DRAFT_TRANSFER_KEY);
        if (!raw) return null;
        sessionStorage.removeItem(PROFILE_DRAFT_TRANSFER_KEY);

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (!parsed.draft || typeof parsed.draft !== "object") return null;

        const ts = Number(parsed.ts);
        if (!Number.isFinite(ts)) return null;
        if ((Date.now() - ts) > PROFILE_DRAFT_TRANSFER_TTL_MS) return null;

        const path = String(parsed.path || "");
        if (path !== String(window.location.pathname || "")) return null;

        return parsed;
    } catch (e) {
        try {
            sessionStorage.removeItem(PROFILE_DRAFT_TRANSFER_KEY);
        } catch (err) {
            // ignore
        }
        return null;
    }
}

// HTML-код меню и профиля (вшит прямо сюда, чтобы избежать проблем с загрузкой файлов)
const LAYOUT_HTML = `
<header class="navbar">
  <div class="navbar-left">
    <a href="${routeHome()}" data-route="home" class="navbar-logo-link">
      <img
        src="/images/whitelogo.png"
        data-logo-light="/images/whitelogo.png"
        data-logo-dark="/images/darklogo.png"
        onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='/images/minilogo.png';}"
        alt="Logo"
        class="logo"
      />
    </a>
  </div>

  <nav class="navbar-center" id="primaryNav">
    <a href="${routeHome()}" data-route="home" data-link="home" data-i18n="nav.home">Home</a>
    <a href="${routeUniversities()}" data-route="universities" data-link="universities" data-i18n="nav.universities">Universities</a>
    <a href="${routeRanking()}" data-route="ranking" data-link="ranking" data-i18n="nav.rankings">Rankings</a>
    <a href="${routeGuide()}" data-route="guide" data-link="guide" data-i18n="nav.guide">Guide</a>
    <a href="${routeAbout()}" data-route="about" data-link="about" data-i18n="nav.about">About Us</a>
  </nav>

  <div class="navbar-right">
    <button class="menu-btn" id="menuToggleBtn" type="button" aria-controls="primaryNav" aria-expanded="false" aria-label="Open menu" data-i18n-aria-label="nav.open_menu">☰</button>
    <div class="lang-control">
      <select id="languageSelect" class="lang-switch" aria-label="Language" data-i18n-aria-label="nav.language">
        <option value="eng" data-i18n="nav.lang.eng">English (US)</option>
        <option value="rus" data-i18n="nav.lang.rus">Русский</option>
        <option value="kz" data-i18n="nav.lang.kz">Қазақша</option>
      </select>
    </div>
    <button class="theme-btn" id="themeToggleBtn" type="button" title="Switch theme" aria-label="Switch theme" data-i18n-title="nav.switch_theme" data-i18n-aria-label="nav.switch_theme">🌙</button>
    <button class="login-btn" id="profileBtn" data-i18n="nav.profile">Profile</button>
  </div>
</header>

<div class="profile-modal" id="profileModal">
  <div class="profile-backdrop" data-close="profile"></div>
  <div class="profile-card" role="dialog">
    <div class="profile-header">
      <div class="profile-title">
        <div class="profile-username">
          <span id="profileNameDisplay">User</span>
          <input id="profileNameInput" class="profile-name-input" type="text" value="User" minlength="3" maxlength="16" />
          <button class="icon-btn" id="editNameBtn" title="Edit Name" data-i18n-title="profile.action.edit_name">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M14 6l4 4"/></svg>
          </button>
        </div>
        <div class="profile-subtitle" data-i18n="nav.profile">Profile</div>
      </div>
      <button class="icon-btn profile-close" id="profileCloseBtn" title="Close" data-i18n-title="profile.action.close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
      </button>
    </div>

    <div id="usernameError" class="profile-error profile-error--username"></div>

    <div class="profile-body">
      
      <div class="profile-field">
        <label class="profile-label" data-i18n="profile.label.budget">Total Budget (USD / year)</label>
        <div class="profile-budget">
          <input id="budgetInput" class="profile-input" type="text" placeholder="e.g. 20000" data-i18n-placeholder="profile.placeholder.budget" />
        </div>
        <div class="profile-hint" data-i18n="profile.hint.budget_range">Range: 0 - 1,000,000</div>
      </div>

      <div class="profile-field">
        <label class="profile-label" data-i18n="profile.label.study_mode">Preferred Study Mode</label>
        <select id="studyModeSelect" class="profile-input profile-input--select">
           <option value="Any" data-i18n="profile.option.study_mode_any">Any (All formats)</option>
           <option value="On-campus" data-i18n="profile.option.study_mode_oncampus">On-campus (Live)</option>
           <option value="Online" data-i18n="profile.option.study_mode_online">Online / Distance</option>
        </select>
      </div>

      <div class="profile-field">
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
            <button id="profileLowBudgetGrantDismiss" type="button" class="profile-budget-grant-hint__dismiss" title="Dismiss hint" data-i18n-title="profile.hint.dismiss" aria-label="Dismiss hint">×</button>
          </div>
        </div>
      </div>

      <div class="profile-field">
        <label class="profile-label" data-i18n="profile.label.major">Intended Major</label>
        <select id="profileMajorSelect" class="profile-input profile-input--select">
           <option value="" data-i18n="profile.option.major_any">Undecided / Any</option>
        </select>
      </div>

      <div class="profile-field">
        <label class="profile-label" data-i18n="profile.label.interests">University Interests (AI)</label>
        <textarea
          id="profileInterestsInput"
          class="profile-input"
          rows="4"
          maxlength="1200"
          placeholder="Write only what you want to find (programs, research, location). Do not list what you do not want."
          data-i18n-placeholder="profile.placeholder.interests"
        ></textarea>
        <div
          id="profileInterestsLangWarning"
          class="profile-interests-warning"
          hidden
          data-i18n="profile.warning.interests_english_only"
        >Translation is unavailable. Please write interests in English.</div>
        <div class="profile-hint" data-i18n="profile.hint.interests">Used to personalize your recommendations.</div>
      </div>

      <div class="profile-field">
        <label class="profile-label" data-i18n="profile.label.gpa">GPA (Percent)</label>
        <div class="profile-budget profile-budget--with-unit">
          <input id="gpaInput" class="profile-input" type="number" min="0" max="100" step="0.1" placeholder="e.g. 92" data-i18n-placeholder="profile.placeholder.gpa" />
          <span class="profile-unit" data-i18n="profile.unit.gpa">% (0 to 100)</span>
        </div>
        <div class="profile-hint" data-i18n="profile.hint.gpa">GPA is stored as percent and used in admission matching.</div>
      </div>

      <div class="profile-field">
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
          <button id="addExamBtn" class="profile-add" type="button" data-i18n="profile.add">Add</button>
        </div>
        
        <div id="examError" class="profile-error"></div>
        <div id="examList" class="profile-exam-list"></div>
      </div>

      <section class="profile-block" id="languagesBlock">
        <div class="profile-block-head">
            <h3 data-i18n="profile.languages">Languages</h3>
        </div>

        <div class="lang-add-grid lang-add-grid--compact">
            <div>
            <span class="mini-label" data-i18n="profile.language">Language</span>
            <select id="langCode" class="profile-input"></select>
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
            <select id="langExam" class="profile-input"></select>
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

            <button id="langAddBtn" class="profile-add" type="button" data-i18n="profile.add">Add</button>
        </div>

        <div id="langList" class="lang-list"></div>
        </section>

      <div class="profile-actions">
        <span id="profileSaveState" class="profile-save-state" data-i18n="profile.state.saved">Saved</span>
        <button id="saveProfileBtn" class="profile-add profile-add--primary" type="button" data-i18n="profile.action.save_all">Save Profile</button>
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
        menuBtn.textContent = "☰";
    };

    const openMenu = () => {
        navbar.classList.add("is-menu-open");
        menuBtn.setAttribute("aria-expanded", "true");
        menuBtn.setAttribute("aria-label", t("nav.close_menu", "Close menu"));
        menuBtn.textContent = "✕";
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

    const media = window.matchMedia("(max-width: 599px)");
    const onViewportChange = (e) => {
        if (!e.matches) closeMenu();
    };
    if (typeof media.addEventListener === "function") {
        media.addEventListener("change", onViewportChange);
    } else if (typeof media.addListener === "function") {
        media.addListener(onViewportChange);
    }
}

function syncAdaptiveNavbarLayout() {
    const navbar = document.querySelector(".navbar");
    const left = document.querySelector(".navbar-left");
    const center = document.querySelector(".navbar-center");
    const right = document.querySelector(".navbar-right");
    if (!navbar || !left || !center || !right) return;

    // Mobile/tablet layout is handled via CSS media rules.
    if (window.matchMedia("(max-width: 768px)").matches) {
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

async function fetchTranslationRuntimeStatus(force = false) {
    const now = Date.now();
    if (!force && __translationStatusCache.data && (now - __translationStatusCache.ts) < TRANSLATION_STATUS_CACHE_TTL_MS) {
        return __translationStatusCache.data;
    }
    if (__translationStatusCache.inFlight) {
        return __translationStatusCache.inFlight;
    }
    __translationStatusCache.inFlight = (async () => {
        try {
            const res = await fetch(`${API_BASE}/ops/translation-status`, {
                cache: "no-store",
                headers: { "Accept": "application/json" },
            });
            if (!res.ok) throw new Error(`translation-status http ${res.status}`);
            const data = await res.json();
            __translationStatusCache.ts = Date.now();
            __translationStatusCache.data = data && typeof data === "object" ? data : null;
            return __translationStatusCache.data;
        } catch (e) {
            __translationStatusCache.ts = Date.now();
            __translationStatusCache.data = null;
            return null;
        } finally {
            __translationStatusCache.inFlight = null;
        }
    })();
    return __translationStatusCache.inFlight;
}

// 🔥 1. Функция загрузки (теперь берет строку, а не файл)
export async function loadGlobalLayout() {
    if (document.getElementById("profileModal")) return;
    try {
        const currentHash = hashString(LAYOUT_HTML);
        const cached = readLayoutCache();
        const htmlToInject = (cached && cached.hash === currentHash) ? cached.html : LAYOUT_HTML;

        if (!cached || cached.hash !== currentHash) {
            writeLayoutCache(LAYOUT_HTML, currentHash);
        }

        // Вставляем HTML из кэша (или из переменной, если кэш устарел/отсутствует)
        document.body.insertAdjacentHTML('afterbegin', htmlToInject);
        syncNavbarLogo();
        bindThemeUiSync();

        // Подсветка активной ссылки в меню
        const currentPage = document.body.getAttribute('data-page');
        if (currentPage) {
            document.querySelectorAll(".navbar-center a").forEach((link) => link.classList.remove("is-active"));
            const activeLink = document.querySelector(`.navbar-center a[data-link="${currentPage}"]`) || 
                               document.querySelector(`.navbar-center a[href*="${currentPage}"]`);
            if (activeLink) {
                activeLink.classList.add("is-active");
            }
        }

        initMobileMenu();
        initLanguageSwitcher();
        applyTranslations(document);
        if (typeof initCustomSelect === "function") initCustomSelect("languageSelect");
        initAdaptiveNavbarLayout();

        // Запускаем логику профиля
        initProfileUI();

    } catch (error) {
        console.error("Error loading layout:", error);
    }
}

let __profileInited = false;
function initProfileUI() {
    if (__profileInited) return;
    __profileInited = true;

    const modal = document.getElementById("profileModal");
    if (!modal) {
        console.error("initProfileUI: profile modal is missing");
        return;
    }

    modal.setAttribute("aria-hidden", "true");

    if (modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";

    const unsavedModal = document.getElementById("profileUnsavedModal");
    const unsavedBackdrop = unsavedModal?.querySelector(".profile-confirm-backdrop");
    const discardBtn = document.getElementById("profileDiscardBtn");
    const cancelCloseBtn = document.getElementById("profileCancelCloseBtn");
    const saveAndCloseBtn = document.getElementById("profileSaveAndCloseBtn");

    const openBtn = document.getElementById("profileBtn");
    const closeBtn = document.getElementById("profileCloseBtn");
    const backdrop = modal.querySelector(".profile-backdrop");

    const nameInput = document.getElementById("profileNameInput");
    const budgetInput = document.getElementById("budgetInput");
    const gpaInput = document.getElementById("gpaInput");
    const nameDisplay = document.getElementById("profileNameDisplay");
    const themeToggleBtn = document.getElementById("themeToggleBtn");

    const examNameSelect = document.getElementById("examNameSelect");
    const studyModeSelect = document.getElementById("studyModeSelect");
    const profileFundingTypeSelect = document.getElementById("profileFundingTypeSelect");
    const lowBudgetGrantHint = document.getElementById("profileLowBudgetGrantHint");
    const lowBudgetGrantApplyBtn = document.getElementById("profileLowBudgetGrantApply");
    const lowBudgetGrantDismissBtn = document.getElementById("profileLowBudgetGrantDismiss");
    const examScoreInput = document.getElementById("examScoreInput");
    const addExamBtn = document.getElementById("addExamBtn");
    const examList = document.getElementById("examList");
    const profileMajorSelect = document.getElementById("profileMajorSelect");
    const profileInterestsInput = document.getElementById("profileInterestsInput");
    const profileInterestsLangWarning = document.getElementById("profileInterestsLangWarning");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const profileSaveState = document.getElementById("profileSaveState");

    const editNameBtn = document.getElementById("editNameBtn");
    const profileUsernameDiv = document.querySelector(".profile-username");

    const syncThemeButton = (themeOverride = "") => {
        if (!themeToggleBtn) return;
        const theme = String(themeOverride || getCurrentTheme() || "").trim().toLowerCase();
        themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
        themeToggleBtn.title = t("nav.switch_theme", "Switch theme");
        themeToggleBtn.setAttribute("aria-label", t("nav.switch_theme", "Switch theme"));
        syncNavbarLogo(theme);
    };
    syncThemeButton();
    themeToggleBtn?.addEventListener("click", () => {
        const nextTheme = toggleTheme();
        syncThemeButton(nextTheme);
    });
    window.addEventListener("themeChanged", (e) => {
        const theme = String(e?.detail?.theme || "").trim().toLowerCase();
        syncNavbarLogo(theme);
        syncThemeButton(theme);
    });
    window.addEventListener("pageshow", () => {
        syncNavbarLogo();
        syncThemeButton();
    });

    const normalizeFundingType = (value) => {
        const raw = String(value || "").trim().toLowerCase();
        return (raw === "grant" || raw === "paid") ? raw : "any";
    };

    const cloneProfile = (value) => JSON.parse(JSON.stringify(value && typeof value === "object" ? value : {}));

    const ensureProfileShape = (raw) => {
        const out = normalizeProfileData(raw);
        out.name = String(out.name || "User").trim() || "User";
        out.budget = out.budget === null || out.budget === undefined ? "" : out.budget;
        out.gpa = out.gpa === null || out.gpa === undefined ? "" : out.gpa;
        out.major = String(out.major || "").trim();
        out.interests = String(out.interests || "").trim().slice(0, 1200);
        out.studyMode = String(out.studyMode || "Any").trim() || "Any";
        out.fundingType = normalizeFundingType(out.fundingType || out.funding_type || "any");
        return out;
    };

    const stableProfileSignature = (raw) => {
        const p = ensureProfileShape(raw);
        const exams = (Array.isArray(p.exams) ? p.exams : [])
            .map((row) => {
                const exam = String(row?.exam || row?.id || "").trim();
                const score = Number(row?.score);
                if (!exam || !Number.isFinite(score)) return null;
                return { exam: canonicalizeExamId(exam), score };
            })
            .filter(Boolean)
            .sort((a, b) => String(a.exam).localeCompare(String(b.exam)));

        const languages = (Array.isArray(p.languages) ? p.languages : [])
            .map((row) => {
                const code = String(row?.code || row?.lang || "").trim().toLowerCase();
                const kind = String(row?.kind || "").trim().toLowerCase();
                if (!code || !kind) return null;
                if (kind === "native") return { code, kind };
                if (kind === "cefr") {
                    const level = Number(row?.level);
                    if (!Number.isInteger(level)) return null;
                    return { code, kind, level };
                }
                if (kind === "exam") {
                    const exam = String(row?.exam || row?.examId || "").trim();
                    const score = Number(row?.score);
                    if (!exam || !Number.isFinite(score)) return null;
                    return { code, kind, exam, score };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

        return JSON.stringify({
            name: String(p.name || "").trim(),
            budget: String(p.budget ?? "").trim(),
            gpa: String(p.gpa ?? "").trim(),
            major: String(p.major || "").trim(),
            interests: String(p.interests || "").trim(),
            studyMode: String(p.studyMode || "Any").trim() || "Any",
            fundingType: normalizeFundingType(p.fundingType),
            exams,
            languages,
        });
    };

    let profile = ensureProfileShape(loadProfile());
    const transferredDraftPayload = consumeProfileDraftAfterReload();
    let transferredProfileDraft = transferredDraftPayload?.draft
        ? ensureProfileShape(transferredDraftPayload.draft)
        : null;
    let savedSignature = "";
    let lowBudgetGrantHintDismissed = false;

    const getInterestsDraft = () => String(profileInterestsInput?.value || "").trim().slice(0, 1200);
    const getNameDraft = () => String(nameInput?.value || "").trim();
    const isUsernameDraftDirty = () => Boolean(
        profileUsernameDiv?.classList.contains("is-editing")
        && getNameDraft() !== String(profile.name || "").trim(),
    );
    const isProfileDirty = () => stableProfileSignature(profile) !== savedSignature;

    const renderInterestsTranslationWarning = (status) => {
        if (!profileInterestsLangWarning) return;
        const enabled = Boolean(status && status.enabled);
        const available = Boolean(status && status.available);
        const shouldShow = !enabled || !available;
        profileInterestsLangWarning.hidden = !shouldShow;
        profileInterestsLangWarning.textContent = t(
            "profile.warning.interests_english_only",
            "Translation is unavailable. Please write interests in English.",
        );
    };

    const parseBudgetDraftValue = () => {
        const raw = String(budgetInput?.value || profile?.budget || "").trim();
        if (!raw) return null;
        if (raw.includes(".") || raw.includes(",")) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) return null;
        return value;
    };

    const shouldShowLowBudgetGrantHint = () => {
        const budgetValue = parseBudgetDraftValue();
        if (budgetValue === null) return false;
        if (budgetValue >= 1000) return false;
        const fundingType = normalizeFundingType(profileFundingTypeSelect?.value || profile?.fundingType || "any");
        return fundingType !== "grant";
    };

    const renderLowBudgetGrantHint = () => {
        if (!lowBudgetGrantHint) return;

        const shouldShow = shouldShowLowBudgetGrantHint();
        if (!shouldShow) {
            lowBudgetGrantHintDismissed = false;
            lowBudgetGrantHint.hidden = true;
            return;
        }

        if (lowBudgetGrantHintDismissed) {
            lowBudgetGrantHint.hidden = true;
            return;
        }

        const textEl = lowBudgetGrantHint.querySelector(".profile-budget-grant-hint__text");
        if (textEl) {
            textEl.textContent = t(
                "profile.hint.low_budget_grant",
                "Budget is under $1000. Maybe you need Grant only.",
            );
        }
        if (lowBudgetGrantApplyBtn) {
            lowBudgetGrantApplyBtn.textContent = t("profile.hint.low_budget_grant_action", "Set Grant only");
        }
        if (lowBudgetGrantDismissBtn) {
            const dismissTitle = t("profile.hint.dismiss", "Dismiss hint");
            lowBudgetGrantDismissBtn.title = dismissTitle;
            lowBudgetGrantDismissBtn.setAttribute("aria-label", dismissTitle);
        }

        lowBudgetGrantHint.hidden = false;
    };

    const refreshSaveState = () => {
        const profileDirty = isProfileDirty();
        const usernameDirty = isUsernameDraftDirty();
        const isDirty = profileDirty || usernameDirty;
        if (profileSaveState) {
            profileSaveState.textContent = isDirty
                ? t("profile.state.unsaved", "Unsaved changes")
                : t("profile.state.saved", "Saved");
            profileSaveState.classList.toggle("is-dirty", isDirty);
        }
        if (saveProfileBtn) saveProfileBtn.disabled = !isDirty;
        renderLowBudgetGrantHint();
        return isDirty;
    };

    const setProfileDraft = (next, options = {}) => {
        profile = ensureProfileShape(next);
        if (options.markAsSaved) {
            savedSignature = stableProfileSignature(profile);
        }
        refreshSaveState();
    };

    window.__unisearchProfileDraft = {
        isActive: () => modal.classList.contains("is-open"),
        get: () => cloneProfile(profile),
        set: (nextProfile) => {
            setProfileDraft(nextProfile);
        },
    };

    const populateMajors = () => {
        if (!profileMajorSelect) return;
        profileMajorSelect.innerHTML = `<option value="">${escapeHtml(t("profile.option.major_any", "Undecided / Any"))}</option>`;
        MAJOR_OPTIONS.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = translateProgramName(m, m);
            profileMajorSelect.appendChild(opt);
        });
    };
    populateMajors();

    const populateExamSelect = () => {
        if (!examNameSelect) return;
        examNameSelect.innerHTML = `<option value="" disabled selected>${escapeHtml(t("profile.option.select_exam", "Select Exam"))}</option>`;

        const seen = new Set();
        Object.keys(EXAM_CONFIG).forEach((examKey) => {
            const normalized = canonicalizeExamId(examKey);
            const key = String(normalized || examKey).toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (!key || key === "GPA") return;
            if (seen.has(key)) return;
            seen.add(key);

            const opt = document.createElement("option");
            opt.value = normalized || examKey;
            opt.textContent = getExamDisplayName(normalized || examKey);
            examNameSelect.appendChild(opt);
        });

        if (typeof initCustomSelect === "function") initCustomSelect("examNameSelect");
        refreshExamActionButton();
    };

    if (Object.keys(EXAM_CONFIG).length > 0) {
        populateExamSelect();
    }
    window.addEventListener("examConfigLoaded", populateExamSelect);

    function refreshExamActionButton() {
        if (!addExamBtn || !examNameSelect) return;
        const selected = canonicalizeExamId(examNameSelect.value);
        const hasExisting = !!selected && Array.isArray(profile.exams)
            && profile.exams.some((e) => canonicalizeExamId(e.exam ?? e.id ?? "") === selected);
        const key = hasExisting ? "profile.edit" : "profile.add";
        const fallback = hasExisting ? "Edit" : "Add";
        addExamBtn.setAttribute("data-i18n", key);
        addExamBtn.textContent = t(key, fallback);
    }

    const retranslateProfileUi = () => {
        const selectedExam = examNameSelect ? String(examNameSelect.value || "") : "";
        const selectedLangCode = document.getElementById("langCode");
        const selectedLangKind = document.getElementById("langKind");
        const selectedLangCefr = document.getElementById("langCefr");
        const selectedLangExam = document.getElementById("langExam");
        const prevLangCode = selectedLangCode ? String(selectedLangCode.value || "") : "";
        const prevLangKind = selectedLangKind ? String(selectedLangKind.value || "") : "";
        const prevLangCefr = selectedLangCefr ? String(selectedLangCefr.value || "") : "";
        const prevLangExam = selectedLangExam ? String(selectedLangExam.value || "") : "";

        populateMajors();
        populateExamSelect();
        if (examNameSelect && selectedExam) {
            examNameSelect.value = selectedExam;
        }

        applyTranslations(modal);
        if (unsavedModal) applyTranslations(unsavedModal);
        applyDraftToInputs();
        refreshExamActionButton();

        if (selectedLangCode && prevLangCode) selectedLangCode.value = prevLangCode;
        if (selectedLangKind && prevLangKind) selectedLangKind.value = prevLangKind;
        if (selectedLangCefr && prevLangCefr) selectedLangCefr.value = prevLangCefr;
        if (selectedLangExam && prevLangExam) selectedLangExam.value = prevLangExam;

        if (typeof initCustomSelect === "function") {
            initCustomSelect("examNameSelect");
            initCustomSelect("studyModeSelect");
            initCustomSelect("profileFundingTypeSelect");
            initCustomSelect("profileMajorSelect");
            if (selectedLangCode) initCustomSelect("langCode");
            if (selectedLangKind) initCustomSelect("langKind");
            if (selectedLangCefr) initCustomSelect("langCefr");
            if (selectedLangExam) initCustomSelect("langExam");
        }
    };

    const syncInputsToDraft = () => {
        if (budgetInput) profile.budget = String(budgetInput.value || "").trim();
        if (gpaInput) profile.gpa = String(gpaInput.value || "").trim();
        if (studyModeSelect) profile.studyMode = String(studyModeSelect.value || "Any").trim() || "Any";
        if (profileFundingTypeSelect) profile.fundingType = normalizeFundingType(profileFundingTypeSelect.value);
        if (profileMajorSelect) profile.major = String(profileMajorSelect.value || "").trim();
        if (profileInterestsInput) profile.interests = getInterestsDraft();
        profile = ensureProfileShape(profile);
    };

    const commitProfileName = (notify = true) => {
        const nextName = getNameDraft();
        const currentName = String(profile.name || "").trim();
        if (nextName === currentName) {
            if (nameInput) nameInput.value = currentName;
            if (profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");
            refreshSaveState();
            return true;
        }
        const validName = /^[A-Za-z0-9 ]+$/;
        if (nextName.length < 3 || nextName.length > 16) {
            showToast(t("profile.name_invalid_length", "Name length must be 3-16 chars"), "error");
            return false;
        }
        if (!validName.test(nextName)) {
            showToast(t("profile.name_invalid_symbols", "Invalid symbols in name"), "error");
            return false;
        }

        const persisted = ensureProfileShape(loadProfile());
        persisted.name = nextName;
        saveProfile(persisted);

        profile.name = nextName;
        if (nameDisplay) nameDisplay.textContent = nextName;
        if (nameInput) nameInput.value = nextName;
        if (profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");

        savedSignature = stableProfileSignature(ensureProfileShape(loadProfile()));
        refreshSaveState();

        if (notify) showToast(t("profile.nickname_updated", "Nickname updated!"), "success");
        return true;
    };

    const validateBudgetInput = () => {
        const rawVal = String(budgetInput?.value || "").trim();
        if (!rawVal) return { ok: true, value: "" };
        if (rawVal.includes(".") || rawVal.includes(",")) {
            showToast(t("profile.budget_integers_only", "Integers only (no dots/commas)"), "error");
            return { ok: false, value: "" };
        }
        const val = Number(rawVal);
        if (!Number.isFinite(val)) {
            showToast(t("profile.budget_must_number", "Budget must be a number"), "error");
            return { ok: false, value: "" };
        }
        if (val < 0 || val > 1000000) {
            showToast(t("profile.budget_limit", "Limit: 0 - 1,000,000 USD"), "error");
            return { ok: false, value: "" };
        }
        return { ok: true, value: val };
    };

    const validateGpaInput = () => {
        const rawVal = String(gpaInput?.value || "").trim();
        if (!rawVal) return { ok: true, value: "" };

        const val = Number(rawVal);
        if (!Number.isFinite(val)) {
            showToast(t("profile.gpa_must_number", "GPA must be a number"), "error");
            return { ok: false, value: "" };
        }

        const cfg = EXAM_CONFIG?.GPA || { min: 0, max: 100, step: 1 };
        const min = Number.isFinite(Number(cfg?.min)) ? Number(cfg.min) : 0;
        const max = Number.isFinite(Number(cfg?.max)) ? Number(cfg.max) : 100;
        const step = Number.isFinite(Number(cfg?.step)) ? Number(cfg.step) : 1;

        if (val < min || val > max) {
            showToast(tFormat("profile.gpa_range", { min, max }, `GPA must be between ${min} and ${max}%`), "error");
            return { ok: false, value: "" };
        }
        if (step > 0) {
            const k = (val - min) / step;
            if (Math.abs(k - Math.round(k)) > 1e-9) {
                showToast(tFormat("profile.gpa_step", { step }, `GPA must use step ${step}`), "error");
                return { ok: false, value: "" };
            }
        }
        return { ok: true, value: Number(Math.round(val * 1000) / 1000) };
    };

    const renderProfileData = () => {
        if (!Array.isArray(profile.exams)) profile.exams = [];
        if (examList) {
            examList.innerHTML = profile.exams.map((ex, i) => `
                <div class="profile-exam-item">
                    <div class="profile-exam-meta">
                        <span class="profile-exam-name">${escapeHtml(getExamDisplayName(ex.exam))}</span>
                        <span class="profile-exam-score">${escapeHtml(tFormat("profile.exam_score_label", { score: String(ex.score) }, `Score: ${String(ex.score)}`))}</span>
                    </div>
                    <button data-idx="${i}" class="profile-delete">${escapeHtml(t("profile.delete", "Delete"))}</button>
                </div>
            `).join("");
        }
        refreshExamActionButton();
    };

    const applyDraftToInputs = () => {
        if (nameInput) nameInput.value = profile.name;
        if (nameDisplay) nameDisplay.textContent = profile.name;
        if (budgetInput) budgetInput.value = profile.budget === "" ? "" : String(profile.budget);
        if (gpaInput) gpaInput.value = profile.gpa === "" ? "" : String(profile.gpa);
        if (profileUsernameDiv) profileUsernameDiv.classList.remove("is-editing");
        if (studyModeSelect) studyModeSelect.value = profile.studyMode || "Any";
        if (profileFundingTypeSelect) profileFundingTypeSelect.value = normalizeFundingType(profile.fundingType);
        if (profileMajorSelect) profileMajorSelect.value = profile.major || "";
        if (profileInterestsInput) profileInterestsInput.value = profile.interests || "";
        renderInterestsTranslationWarning(__translationStatusCache.data);
        renderProfileData();
        refreshSaveState();
    };

    const resetFields = (options = {}) => {
        const preferTransferred = options.preferTransferred !== false;
        const consumeTransferred = options.consumeTransferred !== false;
        if (preferTransferred && transferredProfileDraft) {
            setProfileDraft(ensureProfileShape(transferredProfileDraft));
            applyDraftToInputs();
            if (consumeTransferred) transferredProfileDraft = null;
            return;
        }

        const savedProfile = ensureProfileShape(loadProfile());
        setProfileDraft(savedProfile, { markAsSaved: true });
        applyDraftToInputs();
    };

    if (examNameSelect) {
        examNameSelect.addEventListener("change", refreshExamActionButton);
    }

    const saveAllProfileChanges = (notify = true) => {
        syncInputsToDraft();

        const budgetCheck = validateBudgetInput();
        if (!budgetCheck.ok) return false;
        const gpaCheck = validateGpaInput();
        if (!gpaCheck.ok) return false;

        profile.budget = budgetCheck.value;
        profile.gpa = gpaCheck.value;
        profile.interests = getInterestsDraft();
        profile.studyMode = String(studyModeSelect?.value || profile.studyMode || "Any").trim() || "Any";
        profile.fundingType = normalizeFundingType(profileFundingTypeSelect?.value || profile.fundingType || "any");
        profile.major = String(profileMajorSelect?.value || profile.major || "").trim();
        profile = ensureProfileShape(profile);

        if (budgetInput) budgetInput.value = profile.budget === "" ? "" : String(profile.budget);
        if (gpaInput) gpaInput.value = profile.gpa === "" ? "" : String(profile.gpa);

        saveProfile(profile);
        savedSignature = stableProfileSignature(profile);
        refreshSaveState();

        if (notify) showToast(t("profile.saved_all", "Profile saved"), "success");
        return true;
    };

    const closeUnsavedDialog = (focusCloseButton = false) => {
        if (!unsavedModal) return;
        unsavedModal.classList.remove("is-open");
        unsavedModal.setAttribute("aria-hidden", "true");
        unsavedModal.style.display = "none";
        if (focusCloseButton && closeBtn) closeBtn.focus();
    };

    const closeImmediately = () => {
        if (!modal.classList.contains("is-open")) return;

        closeUnsavedDialog(false);
        if (openBtn) openBtn.focus();

        modal.classList.remove("is-open");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        window.dispatchEvent(new Event("profileModalClosed"));
        resetFields();
    };

    const closeForLanguageSwitch = () => {
        if (!modal.classList.contains("is-open")) return;
        syncInputsToDraft();
        transferredProfileDraft = ensureProfileShape(profile);
        closeUnsavedDialog(false);
        modal.classList.remove("is-open");
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        window.dispatchEvent(new Event("profileModalClosed"));
    };

    const openUnsavedDialog = () => {
        if (!unsavedModal) return;
        unsavedModal.style.display = "flex";
        unsavedModal.classList.add("is-open");
        unsavedModal.setAttribute("aria-hidden", "false");
    };

    const requestClose = () => {
        if (!modal.classList.contains("is-open")) return;
        syncInputsToDraft();
        if (!refreshSaveState()) {
            closeImmediately();
            return;
        }
        openUnsavedDialog();
    };

    if (profileMajorSelect) {
        profileMajorSelect.addEventListener("change", () => {
            profile.major = profileMajorSelect.value;
            refreshSaveState();
        });
    }

    if (studyModeSelect) {
        studyModeSelect.addEventListener("change", () => {
            profile.studyMode = String(studyModeSelect.value || "Any").trim() || "Any";
            refreshSaveState();
        });
    }

    if (profileFundingTypeSelect) {
        profileFundingTypeSelect.addEventListener("change", () => {
            profile.fundingType = normalizeFundingType(profileFundingTypeSelect.value);
            lowBudgetGrantHintDismissed = false;
            refreshSaveState();
        });
    }

    if (profileInterestsInput) {
        profileInterestsInput.addEventListener("input", () => {
            profile.interests = getInterestsDraft();
            refreshSaveState();
        });
    }

    if (budgetInput) {
        budgetInput.addEventListener("input", () => {
            profile.budget = String(budgetInput.value || "").trim();
            lowBudgetGrantHintDismissed = false;
            refreshSaveState();
        });
        budgetInput.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (isUsernameDraftDirty() && !commitProfileName(false)) {
                return;
            }
            saveAllProfileChanges(true);
        });
    }

    lowBudgetGrantDismissBtn?.addEventListener("click", () => {
        lowBudgetGrantHintDismissed = true;
        renderLowBudgetGrantHint();
    });

    lowBudgetGrantApplyBtn?.addEventListener("click", () => {
        if (!profileFundingTypeSelect) return;
        lowBudgetGrantHintDismissed = true;
        profileFundingTypeSelect.value = "grant";
        if (typeof initCustomSelect === "function") {
            initCustomSelect("profileFundingTypeSelect");
        }
        profileFundingTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (gpaInput) {
        gpaInput.addEventListener("input", () => {
            profile.gpa = String(gpaInput.value || "").trim();
            refreshSaveState();
        });
        gpaInput.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (isUsernameDraftDirty() && !commitProfileName(false)) {
                return;
            }
            saveAllProfileChanges(true);
        });
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", () => {
            if (isUsernameDraftDirty() && !commitProfileName(false)) {
                return;
            }
            saveAllProfileChanges(true);
        });
    }

    if (openBtn) openBtn.onclick = () => {
        resetFields({ preferTransferred: true, consumeTransferred: true });
        void fetchTranslationRuntimeStatus(false).then((status) => {
            renderInterestsTranslationWarning(status);
        });
        window.dispatchEvent(new Event("profileModalOpened"));
        modal.classList.add("is-open");
        modal.style.display = "flex";
        modal.removeAttribute("aria-hidden");

        if (typeof initCustomSelect === "function") {
            initCustomSelect("examNameSelect");
            initCustomSelect("studyModeSelect");
            initCustomSelect("profileFundingTypeSelect");
            initCustomSelect("profileMajorSelect");
        }
    };

    if (closeBtn) closeBtn.onclick = requestClose;
    if (backdrop) backdrop.onclick = requestClose;

    discardBtn?.addEventListener("click", () => {
        closeImmediately();
    });
    cancelCloseBtn?.addEventListener("click", () => {
        closeUnsavedDialog(true);
    });
    saveAndCloseBtn?.addEventListener("click", () => {
        syncInputsToDraft();
        if (isUsernameDraftDirty() && !commitProfileName(false)) {
            closeUnsavedDialog(true);
            return;
        }
        if (isProfileDirty() && !saveAllProfileChanges(false)) {
            closeUnsavedDialog(true);
            return;
        }
        closeImmediately();
    });
    unsavedBackdrop?.addEventListener("click", () => {
        closeUnsavedDialog(true);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (unsavedModal?.classList.contains("is-open")) {
            closeUnsavedDialog(true);
            return;
        }
        requestClose();
    });

    window.addEventListener("languageChanged", () => {
        retranslateProfileUi();
    });

    if (editNameBtn && profileUsernameDiv && nameInput) {
        editNameBtn.onclick = () => {
            const isEditing = profileUsernameDiv.classList.contains("is-editing");
            if (!isEditing) {
                profileUsernameDiv.classList.add("is-editing");
                nameInput.focus();
                return;
            }
            commitProfileName(true);
        };

        nameInput.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            if (!profileUsernameDiv.classList.contains("is-editing")) return;
            e.preventDefault();
            commitProfileName(true);
        });
        nameInput.addEventListener("input", () => {
            if (!profileUsernameDiv.classList.contains("is-editing")) return;
            refreshSaveState();
        });
    }

    if (addExamBtn) {
        addExamBtn.onclick = async () => {
            const name = examNameSelect.value;
            const rawScore = examScoreInput.value;
            const score = parseFloat(rawScore);

            const cfg = EXAM_CONFIG?.[name];
            if (cfg) {
                const min = (cfg.min !== undefined) ? Number(cfg.min) : null;
                const max = (cfg.max !== undefined) ? Number(cfg.max) : null;
                const step = (cfg.step !== undefined) ? Number(cfg.step) : null;

                if (Number.isFinite(min) && score < min) {
                    showToast(
                        tFormat(
                            "profile.exam_score_min",
                            { exam: name, min },
                            `Min for ${name} is ${min}`
                        ),
                        "error"
                    );
                    return;
                }
                if (Number.isFinite(max) && score > max) {
                    showToast(
                        tFormat(
                            "profile.exam_score_max",
                            { exam: name, max },
                            `Max for ${name} is ${max}`
                        ),
                        "error"
                    );
                    return;
                }

                if (Number.isFinite(step) && step > 0) {
                    const base = Number.isFinite(min) ? min : 0;
                    const k = (score - base) / step;
                    const diff = Math.abs(k - Math.round(k));
                    if (diff > 1e-9) {
                        showToast(
                            tFormat(
                                "profile.exam_score_step",
                                { exam: name, step },
                                `${name} score must use step ${step}`
                            ),
                            "error"
                        );
                        return;
                    }
                }
            }

            if (!name) {
                showToast(t("profile.exam_select_required", "Please select an exam"), "error");
                return;
            }
            if (Number.isNaN(score)) {
                showToast(t("profile.exam_invalid_score", "Invalid score format"), "error");
                return;
            }

            if (name !== "IELTS" && !Number.isInteger(score)) {
                showToast(tFormat("profile.exam_integer_required", { exam: name }, `${name} score must be an integer (e.g. 1400)`), "error");
                return;
            }

            if (name === "IELTS" && (score % 0.5 !== 0)) {
                showToast(t("profile.exam_ielts_step", "IELTS score must end with .0 or .5"), "error");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/exams/validate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ exam: name, score }),
                });
                let json = {};
                try {
                    json = await res.json();
                } catch (e) {
                    json = {};
                }
                if (!res.ok) {
                    const rawDetail = json && (json.detail || json.message || json.error);
                    const code = String(
                        typeof rawDetail === "string" && rawDetail.trim()
                            ? rawDetail
                            : (Array.isArray(rawDetail) ? "validation_error" : `http_${res.status}`)
                    )
                        .trim()
                        .replace(/\s+/g, "_")
                        .slice(0, 64);
                    const err = new Error("exam_validate_failed");
                    err.code = code || "unknown";
                    throw err;
                }

                const examId = canonicalizeExamId(json.exam ?? json.id ?? name);
                const examLabel = getExamDisplayName(examId || name);
                if (!Array.isArray(profile.exams)) profile.exams = [];
                const existingIndex = profile.exams.findIndex((e) =>
                    canonicalizeExamId(e.exam ?? e.id ?? "") === examId
                );

                if (existingIndex !== -1) {
                    profile.exams[existingIndex].score = json.score;
                    showToast(tFormat("profile.exam_updated", { exam: examLabel, score: json.score }, `Updated ${examLabel} to ${json.score}`), "success");
                } else {
                    profile.exams.push({ exam: examId, score: json.score });
                    showToast(tFormat("profile.exam_added", { exam: examLabel }, `Added ${examLabel}`), "success");
                }

                profile = ensureProfileShape(profile);
                refreshSaveState();
                renderProfileData();

                examScoreInput.value = "";
                examNameSelect.value = "";
                if (typeof initCustomSelect === "function") {
                    initCustomSelect("examNameSelect");
                }
            } catch (e) {
                const rawCode = String(e?.code || e?.name || "unknown").trim();
                const safeCode = rawCode.replace(/\s+/g, "_").slice(0, 64) || "unknown";
                showToast(
                    tFormat(
                        "profile.exam_validate_failed",
                        { code: safeCode },
                        `Failed to validate exam score (code: ${safeCode})`
                    ),
                    "error"
                );
            }
        };
    }

    if (examList) {
        examList.onclick = (e) => {
            if (e.target.tagName !== "BUTTON") return;
            const idx = Number(e.target.dataset.idx);
            if (!Number.isFinite(idx)) return;
            if (!Array.isArray(profile.exams)) profile.exams = [];

            profile.exams.splice(idx, 1);
            profile = ensureProfileShape(profile);
            refreshSaveState();
            renderProfileData();
            showToast(t("profile.exam_removed", "Exam removed"), "success");
        };
    }

    resetFields({ preferTransferred: true, consumeTransferred: false });
}
let __tabsBound = false;
export function setupTabs() {
  const tabsRoot = document.querySelector(".d-tabs");
  if (!tabsRoot) return;
  if (__tabsBound) return;
  __tabsBound = true;

  tabsRoot.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest(".d-tab-btn") : null;
    if (!btn || !tabsRoot.contains(btn)) return;
    const buttons = document.querySelectorAll(".d-tab-btn");
    const panes = document.querySelectorAll(".d-tab-pane");
    buttons.forEach((b) => b.classList.remove("active"));
    panes.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const tabId = btn.getAttribute("data-tab");
    const targetPane = tabId ? document.getElementById(tabId) : null;
    if (targetPane) targetPane.classList.add("active");
  });
}

