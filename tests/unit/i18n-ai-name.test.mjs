import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const localizationDir = new URL("../../frontend/Localization/", import.meta.url);
global.fetch = async (url) => {
  const language = String(url).split("?")[0].split("/").at(-1);
  return {
    ok: true,
    text: async () => readFile(new URL(language, localizationDir), "utf8"),
  };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { aiName } = await import("../../frontend/javascript/utils/runtime.js");

test("the requirements match display name follows the active UI language", async () => {
  await initI18n();
  assert.equal(aiName("chance"), "Minimum requirements match");

  setLanguage("rus", { persist: false, emit: false });
  assert.equal(aiName("chance"), "Соответствие минимальным требованиям");

  setLanguage("kaz", { persist: false, emit: false });
  assert.equal(aiName("chance"), "Ең төменгі талаптарға сәйкестік");
  assert.equal(aiName("fit"), "UniFit");
});
