import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  API_LANG_DEFAULT,
  I18N_STORAGE_KEY,
  getUiLanguageForApi,
  normalizeUiLanguageForApi,
} from "../../frontend/javascript/utils/locale.js";
import { safeLocalStorage } from "../../frontend/javascript/utils/safe-storage.js";

describe("locale.js", () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key) => mockStore[key] ?? null,
      setItem: (key, val) => { mockStore[key] = String(val); },
      removeItem: (key) => { delete mockStore[key]; },
    };
    global.localStorage = mockStorage;
    if (global.window) global.window.localStorage = mockStorage;

    Object.defineProperty(global, "navigator", {
      value: { languages: ["en-US"], language: "en-US" },
      configurable: true,
      writable: true,
    });
  });

  describe("normalizeUiLanguageForApi", () => {
    it("returns supported language codes unchanged", () => {
      assert.equal(normalizeUiLanguageForApi("eng"), "eng");
      assert.equal(normalizeUiLanguageForApi("rus"), "rus");
      assert.equal(normalizeUiLanguageForApi("  ENG  "), "eng");
      assert.equal(normalizeUiLanguageForApi("RUS"), "rus");
    });

    it("normalizes locale codes with prefix matching", () => {
      assert.equal(normalizeUiLanguageForApi("en-US"), "eng");
      assert.equal(normalizeUiLanguageForApi("en-GB"), "eng");
      assert.equal(normalizeUiLanguageForApi("ru-RU"), "rus");
      assert.equal(normalizeUiLanguageForApi("ru-KZ"), "rus");
    });

    it("returns empty string for unsupported or empty input", () => {
      assert.equal(normalizeUiLanguageForApi(""), "");
      assert.equal(normalizeUiLanguageForApi(null), "");
      assert.equal(normalizeUiLanguageForApi(undefined), "");
      assert.equal(normalizeUiLanguageForApi("de-DE"), "");
      assert.equal(normalizeUiLanguageForApi("fr"), "");
      assert.equal(normalizeUiLanguageForApi("es-ES"), "");
    });
  });

  describe("getUiLanguageForApi", () => {
    it("prioritizes stored language from safeLocalStorage", () => {
      safeLocalStorage.set(I18N_STORAGE_KEY, "rus");
      assert.equal(getUiLanguageForApi(), "rus");

      safeLocalStorage.set(I18N_STORAGE_KEY, "ru-RU");
      assert.equal(getUiLanguageForApi(), "rus");
    });

    it("falls back to navigator.languages when storage is empty", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["ru-RU", "en-US"], language: "ru-RU" },
        configurable: true,
        writable: true,
      });
      assert.equal(getUiLanguageForApi(), "rus");
    });

    it("falls back to navigator.language when navigator.languages is empty", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: [], language: "ru" },
        configurable: true,
        writable: true,
      });
      assert.equal(getUiLanguageForApi(), "rus");
    });

    it("returns default eng when navigator language is unsupported", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["ja-JP"], language: "ja-JP" },
        configurable: true,
        writable: true,
      });
      assert.equal(getUiLanguageForApi(), API_LANG_DEFAULT);
    });
  });
});
