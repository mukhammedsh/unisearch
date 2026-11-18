import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

class FakeElement extends global.HTMLElement {
  constructor({ tagName = "DIV", id = "", type = "", settingKey = "", theme = false } = {}) {
    super();
    this.tagName = tagName;
    this.id = id;
    this.type = type;
    this.settingKey = settingKey;
    this.theme = theme;
    this.value = "";
    this.checked = false;
    this.attrs = {};
    this.classes = new Set();
    this.listeners = new Map();
    this.open = false;
    this.focusCalls = 0;
    this.offsetWidth = 10;
    this.offsetHeight = 10;
  }

  classList = {
    add: (...names) => names.forEach((name) => this.classes.add(name)),
    remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    contains: (name) => this.classes.has(name),
  };

  getAttribute(name) {
    if (name === "data-setting-input") return this.settingKey;
    return this.attrs[name] ?? null;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  showModal() { this.open = true; this.setAttribute("open", ""); }
  close() { this.open = false; delete this.attrs.open; }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type, handler) { if (this.listeners.get(type) === handler) this.listeners.delete(type); }
  emit(type, event = {}) { this.listeners.get(type)?.({ preventDefault() {}, ...event }); }
  focus() { this.focusCalls += 1; }
  getClientRects() { return [{}]; }
  closest() { return { querySelector: () => this.track }; }
}

test("settings modal synchronizes controls, persists changes, and closes accessibly", async () => {
  const localValues = {};
  global.localStorage = window.localStorage = {
    getItem: (key) => localValues[key] ?? null,
    setItem: (key, value) => { localValues[key] = String(value); },
    removeItem: (key) => { delete localValues[key]; },
  };

  const originalDocument = global.document;
  const originalAdd = window.addEventListener;
  const originalDispatch = window.dispatchEvent;
  const originalMatchMedia = window.matchMedia;
  const originalTimeout = window.setTimeout;
  const windowHandlers = {};
  const documentHandlers = {};
  const dispatched = [];

  const modal = new FakeElement({ tagName: "DIALOG" });
  const card = new FakeElement({ tagName: "SECTION" });
  const openButton = new FakeElement();
  const closeButton = new FakeElement();
  const recent = new FakeElement({ tagName: "INPUT", type: "checkbox", settingKey: "disable_recent_universities" });
  recent.track = new FakeElement();
  const newTab = new FakeElement({ tagName: "INPUT", type: "checkbox", settingKey: "open_universities_new_tab" });
  newTab.track = new FakeElement();
  const currency = new FakeElement({ tagName: "SELECT", settingKey: "preferred_currency" });
  const display = new FakeElement({ tagName: "SELECT", settingKey: "currency_display_mode" });
  const theme = new FakeElement({ tagName: "SELECT", theme: true });
  const settingsInputs = [recent, newTab, currency, display];
  const themeInputs = [theme];
  modal.querySelector = (selector) => (selector === ".settings-card" ? card : null);
  modal.querySelectorAll = (selector) => {
    if (selector === "[data-setting-input]") return settingsInputs;
    if (selector === "[data-theme-input]") return themeInputs;
    return [closeButton];
  };
  modal.contains = (node) => node === closeButton;

  const body = new FakeElement();
  const htmlAttrs = { "data-theme": "light" };
  global.document = {
    body,
    activeElement: closeButton,
    documentElement: {
      getAttribute: (name) => htmlAttrs[name] ?? null,
      setAttribute: (name, value) => { htmlAttrs[name] = String(value); },
      style: {},
      classList: { add() {}, remove() {} },
    },
    getElementById: (id) => ({ settingsModal: modal, settingsBtn: openButton, settingsCloseBtn: closeButton }[id] || null),
    addEventListener: (type, handler) => { documentHandlers[type] = handler; },
  };
  window.addEventListener = (type, handler) => { windowHandlers[type] = handler; };
  window.dispatchEvent = (event) => { dispatched.push(event); };
  window.matchMedia = () => ({ matches: true });
  window.setTimeout = (callback) => { callback(); return 1; };
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };

  try {
    const { initSettingsUI } = await import("../../frontend/javascript/components/settings-ui.js");
    initSettingsUI();
    assert.equal(recent.checked, true);
    assert.equal(currency.value, "USD");
    assert.equal(display.value, "preferred");
    assert.equal(theme.value, "system");

    openButton.emit("click");
    assert.equal(modal.open, true);
    assert.equal(modal.classList.contains("is-open"), true);
    assert.equal(closeButton.focusCalls, 1);

    recent.checked = false;
    recent.emit("change");
    assert.equal(recent.checked, false, "the inverse privacy switch remains enabled when unchecked");
    assert.equal(recent.track.classList.contains("motion-switch-toggle"), false, "reduced motion avoids animation classes");

    newTab.checked = true;
    newTab.emit("change");
    assert.equal(newTab.checked, true);

    currency.value = "EUR";
    currency.emit("change");
    const currencyEvent = dispatched.find((event) => event.type === "currencyChanged" && event.detail.key === "preferred_currency");
    assert.equal(currencyEvent.detail.preferredCurrency, "EUR");
    assert.equal(currencyEvent.detail.displayMode, "preferred");

    display.value = "both";
    display.emit("change");
    const displayEvent = dispatched.find((event) => event.type === "currencyChanged" && event.detail.key === "currency_display_mode");
    assert.equal(displayEvent.detail.preferredCurrency, "EUR");
    assert.equal(displayEvent.detail.displayMode, "both");

    theme.value = "dark";
    theme.emit("change");
    assert.equal(htmlAttrs["data-theme"], "dark");
    assert.equal(localValues.unisearch_theme, "dark");

    windowHandlers.settingsChanged();
    windowHandlers.themeChanged();
    modal.emit("pointerdown", { target: modal });
    modal.emit("pointerup", { target: modal });
    assert.equal(modal.open, false);
    assert.equal(modal.classList.contains("is-open"), false);

    openButton.emit("click");
    modal.emit("cancel");
    assert.equal(modal.open, false);
    assert.equal(modal.classList.contains("is-open"), false);

    // Fallback path when native HTMLDialogElement showModal/close methods are unavailable.
    modal.showModal = null;
    modal.close = null;
    global.document.activeElement = openButton;
    openButton.emit("click");
    assert.equal(modal.classList.contains("is-open"), true);
    modal.emit("pointerdown", { target: modal });
    modal.emit("pointerup", { target: modal });
    assert.equal(modal.classList.contains("is-open"), false);
    assert.equal(openButton.focusCalls, 1);

    initSettingsUI();
    assert.equal(openButton.listeners.size, 1);
  } finally {
    global.document = originalDocument;
    window.addEventListener = originalAdd;
    window.dispatchEvent = originalDispatch;
    window.matchMedia = originalMatchMedia;
    window.setTimeout = originalTimeout;
  }
});

test("settings modal displays and reactively updates currency rate status in user language and timezone", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const localValues = {};
  const sessionValues = {};
  global.localStorage = window.localStorage = {
    getItem: (key) => localValues[key] ?? null,
    setItem: (key, value) => { localValues[key] = String(value); },
    removeItem: (key) => { delete localValues[key]; },
  };
  global.sessionStorage = window.sessionStorage = {
    getItem: (key) => sessionValues[key] ?? null,
    setItem: (key, value) => { sessionValues[key] = String(value); },
    removeItem: (key) => { delete sessionValues[key]; },
  };

  const originalDocument = global.document;
  const originalAdd = window.addEventListener;
  const originalDispatch = window.dispatchEvent;
  const originalMatchMedia = window.matchMedia;
  const originalTimeout = window.setTimeout;
  const originalFetch = global.fetch;
  const windowHandlers = new Map();

  const modal = new FakeElement({ tagName: "DIALOG" });
  const card = new FakeElement({ tagName: "SECTION" });
  const openButton = new FakeElement();
  const closeButton = new FakeElement();
  const statusEl = new FakeElement({ tagName: "P", id: "currencyRatesStatus" });
  statusEl.hidden = true;
  statusEl.removeAttribute = (name) => { delete statusEl.attrs[name]; };
  const currency = new FakeElement({ tagName: "SELECT", settingKey: "preferred_currency" });
  const settingsInputs = [currency];
  modal.querySelector = (selector) => {
    if (selector === ".settings-card") return card;
    if (selector === "#currencyRatesStatus") return statusEl;
    return null;
  };
  modal.querySelectorAll = (selector) => {
    if (selector === "[data-setting-input]") return settingsInputs;
    if (selector === "[data-theme-input]") return [];
    return [closeButton];
  };
  modal.contains = (node) => node === closeButton;

  const body = new FakeElement();
  const htmlAttrs = { "data-theme": "light", lang: "en" };
  global.document = {
    body,
    activeElement: closeButton,
    documentElement: {
      getAttribute: (name) => htmlAttrs[name] ?? null,
      setAttribute: (name, value) => { htmlAttrs[name] = String(value); },
      style: {},
      classList: { add() {}, remove() {} },
    },
    getElementById: (id) => ({
      settingsModal: modal,
      settingsBtn: openButton,
      settingsCloseBtn: closeButton,
      currencyRatesStatus: statusEl,
    }[id] || null),
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  window.addEventListener = (type, handler) => {
    if (!windowHandlers.has(type)) windowHandlers.set(type, new Set());
    windowHandlers.get(type).add(handler);
  };
  window.dispatchEvent = (event) => {
    const handlers = windowHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) handler(event);
    }
  };
  window.matchMedia = () => ({ matches: true });
  window.setTimeout = (callback) => { callback(); return 1; };
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };

  const readLoc = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
  global.fetch = async (url) => {
    const textUrl = String(url);
    if (textUrl.includes("Localization/eng")) return { ok: true, text: async () => readLoc("frontend/Localization/eng") };
    if (textUrl.includes("Localization/ru")) return { ok: true, text: async () => readLoc("frontend/Localization/ru") };
    if (textUrl.includes("Localization/kaz")) return { ok: true, text: async () => readLoc("frontend/Localization/kaz") };
    throw new Error("API offline");
  };

  try {
    const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
    const { FALLBACK_RATES, FALLBACK_RATES_DATE, formatRatesTimestamp, loadRates } = await import("../../frontend/javascript/currency.js");
    const { initSettingsUI } = await import("../../frontend/javascript/components/settings-ui.js?case=rates-status");

    await initI18n();
    setLanguage("eng", { emit: false });
    await loadRates();

    initSettingsUI();
    assert.equal(statusEl.hidden, false);
    assert.equal(statusEl.getAttribute("data-rates-status"), "fallback");
    assert.equal(
      statusEl.textContent,
      `Offline rates from ${formatRatesTimestamp(FALLBACK_RATES_DATE, "eng")}`,
    );

    // Simulate background live rates arrival (cache/api from server)
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        rates: { USD: 1.0, KZT: FALLBACK_RATES.KZT },
        date: "Wed, 18 Nov 2026 00:02:31 +0000",
        source: "cache",
      }),
    });
    await loadRates();
    assert.equal(statusEl.getAttribute("data-rates-status"), "live");
    assert.equal(
      statusEl.textContent,
      `Updated: ${formatRatesTimestamp("Wed, 18 Nov 2026 00:02:31 +0000", "eng")}`,
    );
    assert.equal(/\b(cache|api)\b/i.test(statusEl.textContent), false);

    // Language switch updates attribution status text & localized date
    setLanguage("rus");
    assert.equal(
      statusEl.textContent,
      `Обновлено: ${formatRatesTimestamp("Wed, 18 Nov 2026 00:02:31 +0000", "rus")}`,
    );

    setLanguage("kaz");
    assert.equal(
      statusEl.textContent,
      `Жаңартылды: ${formatRatesTimestamp("Wed, 18 Nov 2026 00:02:31 +0000", "kaz")}`,
    );

    // Opening settings keeps attribution synced
    delete sessionValues.unisearch_currency_rates_cache_v1;
    global.fetch = async () => { throw new Error("Offline"); };
    await loadRates();
    openButton.emit("click");
    assert.equal(statusEl.getAttribute("data-rates-status"), "fallback");
    assert.match(statusEl.textContent, /Офлайн-режим/);
  } finally {
    global.document = originalDocument;
    window.addEventListener = originalAdd;
    window.dispatchEvent = originalDispatch;
    window.matchMedia = originalMatchMedia;
    window.setTimeout = originalTimeout;
    global.fetch = originalFetch;
  }
});
