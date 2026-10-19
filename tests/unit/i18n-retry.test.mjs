import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

let russianFetches = 0;
global.fetch = async (url) => {
  if (String(url).split("?")[0].endsWith("Localization/ru")) {
    russianFetches += 1;
    if (russianFetches === 1) return { ok: false, text: async () => "" };
    return { ok: true, text: async () => "meta.code: RU\ntest.retry: loaded after retry\n" };
  }
  return { ok: false, text: async () => "" };
};

const { initI18n, setLanguage, t } = await import(`../../frontend/javascript/i18n.js?retry=${Date.now()}`);

test("a failed locale pack is retried when the user selects that language", async () => {
  await initI18n();
  assert.equal(russianFetches, 1);
  assert.equal(t("test.retry", "fallback"), "fallback");

  setLanguage("rus", { persist: false, emit: false });
  for (let attempt = 0; attempt < 50 && t("test.retry", "fallback") === "fallback"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.equal(russianFetches, 2);
  assert.equal(t("test.retry", "fallback"), "loaded after retry");
});
