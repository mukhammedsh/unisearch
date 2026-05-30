import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng")) {
    return {
      ok: true,
      async text() {
        return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8");
      },
    };
  }
  if (target.endsWith("Localization/ru")) {
    return {
      ok: true,
      async text() {
        return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8");
      },
    };
  }
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const {
  renderTrackChanceChip,
  renderTrackFactors,
} = await import("../../frontend/javascript/university-detail-helpers.js");

await initI18n();

test("renderTrackFactors localizes known factor keys in Russian", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    factors: [
      {
        key: "academic_strength",
        status: "positive",
        label: "Academic profile",
        message: "Academic scores are strong for this requirement profile.",
      },
    ],
  });

  assert.match(html, /Сильный академический профиль/);
  assert.match(html, /Академические баллы хорошо подходят для этого профиля требований\./);
  assert.doesNotMatch(html, /Academic profile/);
  assert.doesNotMatch(html, /Academic scores are strong/);
});

test("renderTrackFactors keeps backend fallback for unknown factor keys", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackFactors({
    factors: [
      {
        key: "future_signal",
        status: "neutral",
        label: "Future signal",
        message: "Backend fallback stays visible.",
      },
    ],
  });

  assert.match(html, /Future signal/);
  assert.match(html, /Backend fallback stays visible\./);
});

test("renderTrackChanceChip uses Russian badge labels without mixed English terms", () => {
  setLanguage("rus", { persist: false, emit: false });

  const html = renderTrackChanceChip({
    chancePercent: 72,
    badges: ["foundation_required", "need_aware", "need_blind"],
  });

  assert.match(html, /Может потребоваться подготовительная программа/);
  assert.match(html, /Финансовая нуждаемость учитывается/);
  assert.match(html, /Финансовая нуждаемость не учитывается/);
  assert.doesNotMatch(html, /Need-aware|Need-blind|foundation route/);
});
