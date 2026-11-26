import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  API_LANG_DEFAULT,
  I18N_STORAGE_KEY,
  detectInitialUiLanguage,
  getUiLanguageForApi,
  normalizeUiLanguageForApi,
  resolveUiLanguage,
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
    if (global.window) {
      global.window.localStorage = mockStorage;
      global.window.location = { protocol: "http:", hostname: "localhost", pathname: "/", search: "" };
    }

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
      assert.equal(normalizeUiLanguageForApi("kaz"), "kaz");
      assert.equal(normalizeUiLanguageForApi("  ENG  "), "eng");
      assert.equal(normalizeUiLanguageForApi("RUS"), "rus");
      assert.equal(normalizeUiLanguageForApi("KAZ"), "kaz");
    });

    it("normalizes locale codes with BCP 47 primary subtags", () => {
      assert.equal(normalizeUiLanguageForApi("en-US"), "eng");
      assert.equal(normalizeUiLanguageForApi("en-GB"), "eng");
      assert.equal(normalizeUiLanguageForApi("ru-RU"), "rus");
      assert.equal(normalizeUiLanguageForApi("ru-KZ"), "rus");
      assert.equal(normalizeUiLanguageForApi("kk-KZ"), "kaz");
      assert.equal(normalizeUiLanguageForApi("kaz-KZ"), "kaz");
    });

    it("returns empty string for unsupported or empty input", () => {
      assert.equal(normalizeUiLanguageForApi(""), "");
      assert.equal(normalizeUiLanguageForApi(null), "");
      assert.equal(normalizeUiLanguageForApi(undefined), "");
      assert.equal(normalizeUiLanguageForApi("de-DE"), "");
      assert.equal(normalizeUiLanguageForApi("fr"), "");
      assert.equal(normalizeUiLanguageForApi("es-ES"), "");
      assert.equal(normalizeUiLanguageForApi("enter"), "");
    });
  });

  describe("detectInitialUiLanguage", () => {
    it("defaults visitors in Kazakhstan time zones or KZ primary region to Kazakh", () => {
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Almaty", languages: ["ru-RU", "ru", "en-US"] }),
        "kaz",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Aqtau", languages: ["en-US"] }),
        "kaz",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Qostanay", languages: ["ru-RU"] }),
        "kaz",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Tashkent", languages: ["ru-KZ", "ru"] }),
        "kaz",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "UTC", languages: ["en-KZ", "en-US"] }),
        "kaz",
      );
    });

    it("walks the full ordered navigator.languages array outside Kazakhstan", () => {
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Europe/Moscow", languages: ["ru-RU", "en-US"] }),
        "rus",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Tashkent", languages: ["uz-UZ", "ru", "en-US"] }),
        "rus",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Europe/Kyiv", languages: ["uk-UA", "en-US"] }),
        "eng",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Europe/London", languages: ["kk-KZ", "en-GB"] }),
        "kaz",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "America/New_York", languages: ["es-MX", "en-US"] }),
        "eng",
      );
    });

    it("falls back to Russian for CIS regions without a direct match and English elsewhere", () => {
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Bishkek", languages: ["ky-KG"] }),
        "rus",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Tashkent", languages: ["uz-UZ"] }),
        "rus",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Europe/Vilnius", languages: ["lt-LT"] }),
        "eng",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Tbilisi", languages: ["ka-GE"] }),
        "eng",
      );
      assert.equal(
        detectInitialUiLanguage({ timeZone: "Asia/Tokyo", languages: ["ja-JP"] }),
        API_LANG_DEFAULT,
      );
    });
  });

  describe("resolveUiLanguage & getUiLanguageForApi", () => {
    it("prioritizes URL ?lang= parameter over stored and device language", () => {
      safeLocalStorage.set(I18N_STORAGE_KEY, "eng");
      global.window.location.search = "?lang=kaz";
      assert.deepEqual(resolveUiLanguage(), { language: "kaz", source: "url" });
      assert.equal(getUiLanguageForApi(), "kaz");
    });

    it("prioritizes stored language from safeLocalStorage over device signals", () => {
      safeLocalStorage.set(I18N_STORAGE_KEY, "rus");
      assert.deepEqual(resolveUiLanguage(), { language: "rus", source: "storage" });
      assert.equal(getUiLanguageForApi(), "rus");

      safeLocalStorage.set(I18N_STORAGE_KEY, "ru-RU");
      assert.equal(getUiLanguageForApi(), "rus");
    });

    it("walks navigator.languages when storage is empty", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["uz-UZ", "ru-RU", "en-US"], language: "uz-UZ" },
        configurable: true,
        writable: true,
      });
      assert.deepEqual(resolveUiLanguage(), { language: "rus", source: "device" });
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

    it("returns default eng when navigator language is unsupported outside CIS/KZ", () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["ja-JP"], language: "ja-JP" },
        configurable: true,
        writable: true,
      });
      assert.equal(getUiLanguageForApi(), API_LANG_DEFAULT);
    });

    it("does not write automatic first-visit language into localStorage during initI18n", async () => {
      Object.defineProperty(global, "navigator", {
        value: { languages: ["ru-KZ", "ru"], language: "ru-KZ" },
        configurable: true,
        writable: true,
      });
      global.fetch = async () => ({ ok: true, text: async () => "meta.code: KZ\n" });
      const { initI18n, getCurrentLanguage } = await import(`../../frontend/javascript/i18n.js?first-visit=${Date.now()}`);
      await initI18n();
      assert.equal(getCurrentLanguage(), "kaz");
      assert.equal(mockStore[I18N_STORAGE_KEY], undefined);

      global.window.location.search = "?lang=rus";
      await initI18n();
      assert.equal(getCurrentLanguage(), "rus");
      assert.equal(mockStore[I18N_STORAGE_KEY], "rus");
    });
  });
});
