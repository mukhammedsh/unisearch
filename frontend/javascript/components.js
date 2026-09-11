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
  syncNavbarLogo,
} from "./components/shell.js";
import { initSettingsUI } from "./components/settings-ui.js";
import {
  SETTING_STORE_RECENT_UNIVERSITIES,
  SETTING_OPEN_UNIVERSITIES_NEW_TAB,
  SETTING_PREFERRED_CURRENCY,
  SETTING_CURRENCY_DISPLAY,
} from "./settings.js";
import { safeSessionStorage } from "./utils/safe-storage.js";

const PROFILE_RETURN_URL_KEY = "unisearch_profile_return_url";

// Базовый HTML-каркас шапки навигации и модального окна настроек
const LAYOUT_HTML = `
<a class="skip-link" href="#mainContent" data-i18n="accessibility.skip_to_main">Skip to main content</a>
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

      <h3 class="settings-section-title" data-i18n="settings.section.pricing">Pricing</h3>

      <article class="settings-row" data-setting-key="${SETTING_PREFERRED_CURRENCY}">
        <div class="settings-copy">
          <h3 data-i18n="settings.option.preferred_currency.title">Preferred Currency</h3>
          <p data-i18n="settings.option.preferred_currency.desc">Choose your default currency for tuition fees and estimated costs.</p>
        </div>
        <select id="settingPreferredCurrency" class="settings-select" data-setting-input="${SETTING_PREFERRED_CURRENCY}" aria-label="Preferred Currency" data-i18n-aria-label="settings.option.preferred_currency.title">
          <optgroup label="Central Asia & CIS" data-i18n-label="currency.region.cis">
            <option value="KZT" data-i18n="currency.opt.kzt">Kazakhstani Tenge (KZT, ₸)</option>
            <option value="RUB" data-i18n="currency.opt.rub">Russian Ruble (RUB, ₽)</option>
            <option value="UZS" data-i18n="currency.opt.uzs">Uzbekistani Som (UZS, soʻm)</option>
            <option value="KGS" data-i18n="currency.opt.kgs">Kyrgyzstani Som (KGS, сом)</option>
            <option value="BYN" data-i18n="currency.opt.byn">Belarusian Ruble (BYN, Br)</option>
            <option value="TJS" data-i18n="currency.opt.tjs">Tajikistani Somoni (TJS, смн)</option>
            <option value="UAH" data-i18n="currency.opt.uah">Ukrainian Hryvnia (UAH, ₴)</option>
            <option value="MDL" data-i18n="currency.opt.mdl">Moldovan Leu (MDL, L)</option>
            <option value="AZN" data-i18n="currency.opt.azn">Azerbaijani Manat (AZN, ₼)</option>
            <option value="GEL" data-i18n="currency.opt.gel">Georgian Lari (GEL, ₾)</option>
            <option value="AMD" data-i18n="currency.opt.amd">Armenian Dram (AMD, ֏)</option>
          </optgroup>
          <optgroup label="Europe" data-i18n-label="currency.region.europe">
            <option value="EUR" data-i18n="currency.opt.eur">Euro (EUR, €)</option>
            <option value="GBP" data-i18n="currency.opt.gbp">British Pound (GBP, £)</option>
            <option value="CHF" data-i18n="currency.opt.chf">Swiss Franc (CHF, Fr.)</option>
            <option value="PLN" data-i18n="currency.opt.pln">Polish Zloty (PLN, zł)</option>
            <option value="CZK" data-i18n="currency.opt.czk">Czech Koruna (CZK, Kč)</option>
            <option value="HUF" data-i18n="currency.opt.huf">Hungarian Forint (HUF, Ft)</option>
            <option value="RON" data-i18n="currency.opt.ron">Romanian Leu (RON, lei)</option>
            <option value="BGN" data-i18n="currency.opt.bgn">Bulgarian Lev (BGN, лв.)</option>
            <option value="RSD" data-i18n="currency.opt.rsd">Serbian Dinar (RSD, дин.)</option>
            <option value="SEK" data-i18n="currency.opt.sek">Swedish Krona (SEK, kr)</option>
            <option value="NOK" data-i18n="currency.opt.nok">Norwegian Krone (NOK, kr)</option>
            <option value="DKK" data-i18n="currency.opt.dkk">Danish Krone (DKK, kr)</option>
            <option value="ISK" data-i18n="currency.opt.isk">Icelandic Krona (ISK, kr)</option>
          </optgroup>
          <optgroup label="Americas" data-i18n-label="currency.region.americas">
            <option value="USD" data-i18n="currency.opt.usd">US Dollar (USD, $)</option>
            <option value="CAD" data-i18n="currency.opt.cad">Canadian Dollar (CAD, CA$)</option>
            <option value="BRL" data-i18n="currency.opt.brl">Brazilian Real (BRL, R$)</option>
            <option value="MXN" data-i18n="currency.opt.mxn">Mexican Peso (MXN, Mex$)</option>
            <option value="ARS" data-i18n="currency.opt.ars">Argentine Peso (ARS, $)</option>
            <option value="CLP" data-i18n="currency.opt.clp">Chilean Peso (CLP, $)</option>
            <option value="COP" data-i18n="currency.opt.cop">Colombian Peso (COP, $)</option>
            <option value="PEN" data-i18n="currency.opt.pen">Peruvian Sol (PEN, S/)</option>
          </optgroup>
          <optgroup label="Asia-Pacific" data-i18n-label="currency.region.asia_pacific">
            <option value="AUD" data-i18n="currency.opt.aud">Australian Dollar (AUD, A$)</option>
            <option value="CNY" data-i18n="currency.opt.cny">Chinese Yuan (CNY, ¥)</option>
            <option value="HKD" data-i18n="currency.opt.hkd">Hong Kong Dollar (HKD, HK$)</option>
            <option value="IDR" data-i18n="currency.opt.idr">Indonesian Rupiah (IDR, Rp)</option>
            <option value="INR" data-i18n="currency.opt.inr">Indian Rupee (INR, ₹)</option>
            <option value="JPY" data-i18n="currency.opt.jpy">Japanese Yen (JPY, ¥)</option>
            <option value="KRW" data-i18n="currency.opt.krw">South Korean Won (KRW, ₩)</option>
            <option value="MYR" data-i18n="currency.opt.myr">Malaysian Ringgit (MYR, RM)</option>
            <option value="NZD" data-i18n="currency.opt.nzd">New Zealand Dollar (NZD, NZ$)</option>
            <option value="PHP" data-i18n="currency.opt.php">Philippine Peso (PHP, ₱)</option>
            <option value="PKR" data-i18n="currency.opt.pkr">Pakistani Rupee (PKR, ₨)</option>
            <option value="BDT" data-i18n="currency.opt.bdt">Bangladeshi Taka (BDT, ৳)</option>
            <option value="SGD" data-i18n="currency.opt.sgd">Singapore Dollar (SGD, S$)</option>
            <option value="THB" data-i18n="currency.opt.thb">Thai Baht (THB, ฿)</option>
            <option value="TWD" data-i18n="currency.opt.twd">New Taiwan Dollar (TWD, NT$)</option>
            <option value="VND" data-i18n="currency.opt.vnd">Vietnamese Dong (VND, ₫)</option>
            <option value="MNT" data-i18n="currency.opt.mnt">Mongolian Tugrik (MNT, ₮)</option>
          </optgroup>
          <optgroup label="Middle East & Africa" data-i18n-label="currency.region.middle_east_africa">
            <option value="AED" data-i18n="currency.opt.aed">UAE Dirham (AED, د.إ)</option>
            <option value="SAR" data-i18n="currency.opt.sar">Saudi Riyal (SAR, ﷼)</option>
            <option value="QAR" data-i18n="currency.opt.qar">Qatari Riyal (QAR, ر.ق)</option>
            <option value="TRY" data-i18n="currency.opt.try">Turkish Lira (TRY, ₺)</option>
            <option value="ILS" data-i18n="currency.opt.ils">Israeli New Shekel (ILS, ₪)</option>
            <option value="EGP" data-i18n="currency.opt.egp">Egyptian Pound (EGP, E£)</option>
            <option value="ZAR" data-i18n="currency.opt.zar">South African Rand (ZAR, R)</option>
            <option value="NGN" data-i18n="currency.opt.ngn">Nigerian Naira (NGN, ₦)</option>
            <option value="KES" data-i18n="currency.opt.kes">Kenyan Shilling (KES, KSh)</option>
            <option value="MAD" data-i18n="currency.opt.mad">Moroccan Dirham (MAD, DH)</option>
            <option value="KWD" data-i18n="currency.opt.kwd">Kuwaiti Dinar (KWD, KD)</option>
            <option value="BHD" data-i18n="currency.opt.bhd">Bahraini Dinar (BHD, BD)</option>
            <option value="OMR" data-i18n="currency.opt.omr">Omani Rial (OMR, OMR)</option>
          </optgroup>
          <optgroup label="Other Currencies" data-i18n-label="currency.region.other">
            <option value="AFN">Afghan Afghani (AFN)</option>
            <option value="ALL">Albanian Lek (ALL)</option>
            <option value="ANG">Netherlands Antillean Guilder (ANG)</option>
            <option value="AOA">Angolan Kwanza (AOA)</option>
            <option value="AWG">Aruban Florin (AWG)</option>
            <option value="BAM">Bosnia-Herzegovina Convertible Mark (BAM)</option>
            <option value="BBD">Barbadian Dollar (BBD)</option>
            <option value="BIF">Burundian Franc (BIF)</option>
            <option value="BMD">Bermudan Dollar (BMD)</option>
            <option value="BND">Brunei Dollar (BND)</option>
            <option value="BOB">Bolivian Boliviano (BOB)</option>
            <option value="BSD">Bahamian Dollar (BSD)</option>
            <option value="BTN">Bhutanese Ngultrum (BTN)</option>
            <option value="BWP">Botswanan Pula (BWP)</option>
            <option value="BZD">Belize Dollar (BZD)</option>
            <option value="CDF">Congolese Franc (CDF)</option>
            <option value="CLF">Chilean Unit of Account (UF) (CLF)</option>
            <option value="CNH">Chinese Yuan (Offshore) (CNH)</option>
            <option value="CRC">Costa Rican Colón (CRC)</option>
            <option value="CUP">Cuban Peso (CUP)</option>
            <option value="CVE">Cape Verdean Escudo (CVE)</option>
            <option value="DJF">Djiboutian Franc (DJF)</option>
            <option value="DOP">Dominican Peso (DOP)</option>
            <option value="DZD">Algerian Dinar (DZD)</option>
            <option value="ERN">Eritrean Nakfa (ERN)</option>
            <option value="ETB">Ethiopian Birr (ETB)</option>
            <option value="FJD">Fijian Dollar (FJD)</option>
            <option value="FKP">Falkland Islands Pound (FKP)</option>
            <option value="FOK">Faroese Króna (FOK)</option>
            <option value="GGP">Guernsey Pound (GGP)</option>
            <option value="GHS">Ghanaian Cedi (GHS)</option>
            <option value="GIP">Gibraltar Pound (GIP)</option>
            <option value="GMD">Gambian Dalasi (GMD)</option>
            <option value="GNF">Guinean Franc (GNF)</option>
            <option value="GTQ">Guatemalan Quetzal (GTQ)</option>
            <option value="GYD">Guyanaese Dollar (GYD)</option>
            <option value="HNL">Honduran Lempira (HNL)</option>
            <option value="HRK">Croatian Kuna (HRK)</option>
            <option value="HTG">Haitian Gourde (HTG)</option>
            <option value="IMP">Isle of Man Pound (IMP)</option>
            <option value="IQD">Iraqi Dinar (IQD)</option>
            <option value="IRR">Iranian Rial (IRR)</option>
            <option value="JEP">Jersey Pound (JEP)</option>
            <option value="JMD">Jamaican Dollar (JMD)</option>
            <option value="JOD">Jordanian Dinar (JOD)</option>
            <option value="KHR">Cambodian Riel (KHR)</option>
            <option value="KID">Kiribati Dollar (KID)</option>
            <option value="KMF">Comorian Franc (KMF)</option>
            <option value="KYD">Cayman Islands Dollar (KYD)</option>
            <option value="LAK">Laotian Kip (LAK)</option>
            <option value="LBP">Lebanese Pound (LBP)</option>
            <option value="LKR">Sri Lankan Rupee (LKR)</option>
            <option value="LRD">Liberian Dollar (LRD)</option>
            <option value="LSL">Lesotho Loti (LSL)</option>
            <option value="LYD">Libyan Dinar (LYD)</option>
            <option value="MGA">Malagasy Ariary (MGA)</option>
            <option value="MKD">Macedonian Denar (MKD)</option>
            <option value="MMK">Myanmar Kyat (MMK)</option>
            <option value="MOP">Macanese Pataca (MOP)</option>
            <option value="MRU">Mauritanian Ouguiya (MRU)</option>
            <option value="MUR">Mauritian Rupee (MUR)</option>
            <option value="MVR">Maldivian Rufiyaa (MVR)</option>
            <option value="MWK">Malawian Kwacha (MWK)</option>
            <option value="MZN">Mozambican Metical (MZN)</option>
            <option value="NAD">Namibian Dollar (NAD)</option>
            <option value="NIO">Nicaraguan Córdoba (NIO)</option>
            <option value="NPR">Nepalese Rupee (NPR)</option>
            <option value="PAB">Panamanian Balboa (PAB)</option>
            <option value="PGK">Papua New Guinean Kina (PGK)</option>
            <option value="PYG">Paraguayan Guarani (PYG)</option>
            <option value="RWF">Rwandan Franc (RWF)</option>
            <option value="SBD">Solomon Islands Dollar (SBD)</option>
            <option value="SCR">Seychellois Rupee (SCR)</option>
            <option value="SDG">Sudanese Pound (SDG)</option>
            <option value="SHP">St. Helena Pound (SHP)</option>
            <option value="SLE">Sierra Leonean Leone (SLE)</option>
            <option value="SLL">Sierra Leonean Leone (Old) (SLL)</option>
            <option value="SOS">Somali Shilling (SOS)</option>
            <option value="SRD">Surinamese Dollar (SRD)</option>
            <option value="SSP">South Sudanese Pound (SSP)</option>
            <option value="STN">São Tomé & Príncipe Dobra (STN)</option>
            <option value="SYP">Syrian Pound (SYP)</option>
            <option value="SZL">Swazi Lilangeni (SZL)</option>
            <option value="TMT">Turkmenistani Manat (TMT)</option>
            <option value="TND">Tunisian Dinar (TND)</option>
            <option value="TOP">Tongan Paʻanga (TOP)</option>
            <option value="TTD">Trinidad & Tobago Dollar (TTD)</option>
            <option value="TVD">Tuvaluan Dollar (TVD)</option>
            <option value="TZS">Tanzanian Shilling (TZS)</option>
            <option value="UGX">Ugandan Shilling (UGX)</option>
            <option value="UYU">Uruguayan Peso (UYU)</option>
            <option value="VES">Venezuelan Bolívar (VES)</option>
            <option value="VUV">Vanuatu Vatu (VUV)</option>
            <option value="WST">Samoan Tala (WST)</option>
            <option value="XAF">Central African CFA Franc (XAF)</option>
            <option value="XCD">East Caribbean Dollar (XCD)</option>
            <option value="XCG">Caribbean Guilder (XCG)</option>
            <option value="XDR">Special Drawing Rights (XDR)</option>
            <option value="XOF">West African CFA Franc (XOF)</option>
            <option value="XPF">CFP Franc (XPF)</option>
            <option value="YER">Yemeni Rial (YER)</option>
            <option value="ZMW">Zambian Kwacha (ZMW)</option>
            <option value="ZWG">Zimbabwean Gold (ZWG)</option>
            <option value="ZWL">Zimbabwean Dollar (ZWL)</option>
          </optgroup>
        </select>
      </article>

      <article class="settings-row" data-setting-key="${SETTING_CURRENCY_DISPLAY}">
        <div class="settings-copy">
          <h3 data-i18n="settings.option.currency_display.title">Price Display</h3>
          <p data-i18n="settings.option.currency_display.desc">Choose how university prices are displayed across the catalog and detail pages.</p>
        </div>
        <select id="settingCurrencyDisplay" class="settings-select" data-setting-input="${SETTING_CURRENCY_DISPLAY}" aria-label="Price Display" data-i18n-aria-label="settings.option.currency_display.title">
          <option value="preferred" data-i18n="currency.display.preferred">In preferred currency</option>
          <option value="both" data-i18n="currency.display.both">Both (preferred + original)</option>
          <option value="original" data-i18n="currency.display.original">In original currency</option>
        </select>
      </article>
      <div class="settings-attribution">
        <span data-i18n="currency.attribution">Rates provided by</span>
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">ExchangeRate-API</a>
      </div>
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
        document.body.insertAdjacentHTML("afterbegin", LAYOUT_HTML);
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
