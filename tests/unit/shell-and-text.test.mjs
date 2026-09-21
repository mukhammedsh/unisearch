import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { normalizeTranslationKey, stabilizeNumericRanges } = await import("../../frontend/javascript/utils/text.js");
const shell = await import("../../frontend/javascript/components/shell.js");

test("numeric range stabilization only replaces complete numeric hyphens", () => {
  assert.equal(stabilizeNumericRanges("SAT 1200 - 1400, GPA 3.5-4.0"), "SAT 1200‑1400, GPA 3.5‑4.0");
  assert.equal(stabilizeNumericRanges("room 12 - A and -5"), "room 12 - A and -5");
  assert.equal(stabilizeNumericRanges(""), "");
  assert.equal(stabilizeNumericRanges(null), "");
});

test("translation keys normalize punctuation and repeated separators", () => {
  assert.equal(normalizeTranslationKey("  IELTS Academic / Overall  "), "ielts_academic_overall");
  assert.equal(normalizeTranslationKey("A--B___C"), "a_b_c");
  assert.equal(normalizeTranslationKey("***"), "");
});

test("navbar logo sync selects theme assets and avoids redundant writes", () => {
  const originalQuery = document.querySelector;
  const attrs = { src: "old" };
  const logo = {
    dataset: { fallback: "2" },
    getAttribute: (name) => attrs[name] ?? null,
    setAttribute: (name, value) => { attrs[name] = value; },
  };
  document.querySelector = () => logo;
  try {
    shell.syncNavbarLogo("dark");
    assert.equal(attrs.src, shell.NAV_LOGO_DARK);
    assert.equal(logo.dataset.fallback, "0");
    logo.dataset.fallback = "1";
    shell.syncNavbarLogo("dark");
    assert.equal(logo.dataset.fallback, "1");
    shell.syncNavbarLogo("light");
    assert.equal(attrs.src, shell.NAV_LOGO_LIGHT);
  } finally {
    document.querySelector = originalQuery;
  }
});

test("navbar logo sync tolerates absent markup", () => {
  const originalQuery = document.querySelector;
  document.querySelector = () => null;
  try {
    assert.doesNotThrow(() => shell.syncNavbarLogo());
  } finally {
    document.querySelector = originalQuery;
  }
});

test("theme UI binding reacts to lifecycle and visible-theme changes once", () => {
  const originalObserver = global.MutationObserver;
  const originalWindowAdd = window.addEventListener;
  const originalDocumentAdd = document.addEventListener;
  const originalQuery = document.querySelector;
  const windowHandlers = {};
  const documentHandlers = {};
  let observed = null;
  let writes = 0;
  const logo = {
    dataset: {},
    getAttribute: () => "old",
    setAttribute: () => { writes += 1; },
  };
  document.querySelector = () => logo;
  global.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target, options) { observed = { target, options, callback: this.callback }; }
  };
  window.addEventListener = (type, handler) => { windowHandlers[type] = handler; };
  document.addEventListener = (type, handler) => { documentHandlers[type] = handler; };
  try {
    shell.bindThemeUiSync();
    assert.deepEqual(observed.options, { attributes: true, attributeFilter: ["data-theme"] });
    windowHandlers.load();
    windowHandlers.pageshow();
    document.hidden = true;
    documentHandlers.visibilitychange();
    document.hidden = false;
    documentHandlers.visibilitychange();
    observed.callback();
    assert.equal(writes, 4);

    shell.bindThemeUiSync();
    assert.equal(Object.keys(windowHandlers).length, 2);
  } finally {
    global.MutationObserver = originalObserver;
    window.addEventListener = originalWindowAdd;
    document.addEventListener = originalDocumentAdd;
    document.querySelector = originalQuery;
    document.hidden = false;
  }
});
