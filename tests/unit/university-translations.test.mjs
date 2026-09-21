import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const calls = [];
global.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng") || target.endsWith("Localization/ru")) {
    const language = target.endsWith("/ru") ? "ru" : "eng";
    return { ok: true, text: () => readFile(new URL(`../../frontend/Localization/${language}`, import.meta.url), "utf8") };
  }
  if (target.includes("/universities/translations?lang=rus")) {
    calls.push(target);
    return {
      ok: true,
      json: async () => ({
        lang: "rus",
        data: {
          groups: { country: { united_states: "США" } },
          words: { custom_word: "Слово", "common.placeholder_unknown": "Нет данных: {field}" },
          university_names: { "test-university": "Тестовый университет" },
          admission_exact: { "Official route": "Официальный путь" },
          admission_replace: [["Interview", "Собеседование"]],
          track_labels: { merit_grant: "Грант за заслуги" },
          track_label_fallback_replace: [["Paid", "Платное"]],
          program_names: { computer_science: "Информатика" },
          fact_sources: { "Official report": "Официальный отчёт" },
        },
      }),
    };
  }
  return { ok: false, status: 503, json: async () => ({}) };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const translations = await import("../../frontend/javascript/university-translations.js");
await initI18n();

test("university translation packs load once per language and drive typed translation helpers", async () => {
  setLanguage("rus", { persist: false, emit: false });
  const pack = await translations.loadUniversityTranslationsForLanguage("ru-RU", true);
  assert.equal(pack.words.custom_word, "Слово");
  assert.equal(translations.translateDataValue("country", "United States"), "США");
  assert.equal(translations.translateWord("custom_word", "Fallback"), "Слово");
  assert.equal(translations.translateTemplate("custom_word", "Fallback", { unused: 1 }), "Слово");
  assert.equal(translations.translateUnknownField("tuition_fee"), "Нет данных: Tuition Fee");
  assert.equal(translations.translateUnknownWord("custom_word"), "Нет данных: Слово");
  assert.equal(translations.translateUniversityName("test-university", "Fallback"), "Тестовый университет");
  assert.equal(translations.translateUniversityName("", "Fallback"), "Fallback");
  assert.equal(translations.translateAdmissionText("Official route"), "Официальный путь");
  assert.equal(translations.translateAdmissionText("Interview required"), "Собеседование required");
  assert.equal(translations.translateTrackLabel("Merit Grant"), "Грант за заслуги");
  assert.equal(translations.translateTrackLabel("Paid route"), "Платное route");
  assert.equal(translations.translateProgramName("Computer Science"), "Информатика");
  assert.equal(translations.translateFactSource("Official report"), "Официальный отчёт");
  assert.ok(translations.translateFactStatus("official-aggregated"));

  const cached = await translations.loadUniversityTranslationsForLanguage("rus");
  assert.equal(cached, pack);
  assert.equal(calls.length, 1);
  assert.equal(await translations.initUniversityTranslations(), pack);
});

test("translation helpers preserve English source copy and failed packs return null", async () => {
  setLanguage("eng", { persist: false, emit: false });
  assert.equal(translations.humanizeMachineLabel("official_source"), "Official Source");
  assert.equal(translations.humanizeMachineLabel("", "fallback_label"), "Fallback Label");
  assert.equal(translations.translateDataValue("country", "United States"), "United States");
  assert.equal(translations.translateAdmissionText("Official route"), "Official route");
  assert.equal(translations.translateTrackLabel("Paid route"), "Paid route");
  assert.equal(translations.translateProgramName("Computer Science"), "Computer Science");
  assert.equal(translations.translateFactSource("Official report"), "Official report");
  assert.equal(await translations.loadUniversityTranslationsForLanguage("eng", true), null);
});
