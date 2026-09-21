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
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type, handler) { if (this.listeners.get(type) === handler) this.listeners.delete(type); }
  emit(type, event = {}) { this.listeners.get(type)?.(event); }
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

  const modal = new FakeElement();
  const openButton = new FakeElement();
  const closeButton = new FakeElement();
  const backdrop = new FakeElement();
  const recent = new FakeElement({ tagName: "INPUT", type: "checkbox", settingKey: "disable_recent_universities" });
  recent.track = new FakeElement();
  const newTab = new FakeElement({ tagName: "INPUT", type: "checkbox", settingKey: "open_universities_new_tab" });
  newTab.track = new FakeElement();
  const currency = new FakeElement({ tagName: "SELECT", settingKey: "preferred_currency" });
  const display = new FakeElement({ tagName: "SELECT", settingKey: "currency_display_mode" });
  const theme = new FakeElement({ tagName: "SELECT", theme: true });
  const settingsInputs = [recent, newTab, currency, display];
  const themeInputs = [theme];
  modal.querySelector = (selector) => (selector === ".settings-backdrop" ? backdrop : null);
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
    assert.equal(modal.classList.contains("is-open"), true);
    assert.equal(modal.attrs["aria-hidden"], "false");
    assert.equal(body.classList.contains("modal-open"), true);
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
    backdrop.emit("click");
    assert.equal(modal.classList.contains("is-open"), false);
    assert.equal(modal.attrs["aria-hidden"], "true");
    assert.equal(body.classList.contains("modal-open"), false);
    assert.equal(openButton.focusCalls, 1);

    openButton.emit("click");
    documentHandlers.keydown({ key: "Escape" });
    assert.equal(modal.classList.contains("is-open"), false);
    documentHandlers.keydown({ key: "Enter" });

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
