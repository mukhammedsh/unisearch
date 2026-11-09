import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const calls = [];
global.fetch = async (url) => {
  const target = String(url || "");
  const resourcePath = target.split("?")[0];
  if (resourcePath.endsWith("Localization/eng") || resourcePath.endsWith("Localization/ru")) {
    const language = resourcePath.endsWith("/ru") ? "ru" : "eng";
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
          admission_replace: [["Academic", "Академический"], ["Interview", "Собеседование"], ["transcript", "транскрипт"], ["Application fee", "Регистрационный сбор"], ["document", "документ"], ["final", "финальный"]],
          track_labels: { merit_grant: "Грант за заслуги" },
          track_label_fallback_replace: [["Paid", "Платное"]],
          program_names: { computer_science: "Информатика" },
          fact_sources: { "Official report": "Официальный отчёт" },
        },
      }),
    };
  }
  if (target.endsWith("Localization/universities-kaz.json")) {
    return {
      ok: true,
      json: async () => JSON.parse(await readFile(new URL("../../frontend/Localization/universities-kaz.json", import.meta.url), "utf8")),
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
  assert.equal(translations.translateAdmissionText("Interview required"), "Interview required");
  assert.equal(translations.translateAdmissionSummary("Official route"), "Официальный путь");
  assert.equal(translations.translateAdmissionSummary("Interview required"), "");
  assert.equal(translations.translateTrackLabel("Merit Grant"), "Грант за заслуги");
  assert.equal(translations.translateTrackLabel("Paid"), "Платное");
  assert.equal(translations.translateTrackLabel("Paid route"), "Paid route");
  assert.equal(translations.translateProgramName("Computer Science"), "Информатика");
  assert.equal(translations.translateFactSource("Official report"), "Официальный отчёт");
  assert.equal(translations.translateFactSource("Computer Science"), "Информатика");
  assert.equal(translations.translateFactSource("Academic foundations | MIT Admissions"), "Academic foundations | MIT Admissions");
  setLanguage("kaz", { persist: false, emit: false });
  await translations.loadUniversityTranslationsForLanguage("kaz", true);
  assert.equal(translations.translateFactSource("Academic foundations | MIT Admissions"), "Academic foundations | MIT Admissions");
  setLanguage("rus", { persist: false, emit: false });
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
  assert.equal(translations.translateFactSource("Computer Science"), "Computer Science");
  assert.equal(await translations.loadUniversityTranslationsForLanguage("eng", true), null);
});

test("replacement rules translate only complete standalone labels and never produce mixed-language text", async () => {
  setLanguage("rus", { persist: false, emit: false });
  await translations.loadUniversityTranslationsForLanguage("rus", true);
  const mixedSources = [
    "Secondary school report with transcript",
    "Application fee is USD 100",
    "Notifications about a missing-document",
    "Final transcript",
    "Academic interview results",
  ];
  for (const source of mixedSources) assert.equal(translations.translateAdmissionText(source, source), source, source);
  for (const [source, expected] of [["transcript", "транскрипт"], ["Transcript", "Транскрипт"], ["  application FEE ", "Регистрационный сбор"], ["Interview.", "Собеседование."], ["Official route", "Официальный путь"]]) {
    assert.equal(translations.translateAdmissionText(source, source), expected, source);
  }
  assert.equal(translations.translateAdmissionSummary("Final transcript"), "");
  assert.equal(translations.translateTrackLabel("Final transcript"), "Final transcript");
  setLanguage("eng", { persist: false, emit: false });
  assert.equal(translations.translateAdmissionText("transcript"), "transcript");
});
