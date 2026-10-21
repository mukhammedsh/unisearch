import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { renderDeadlineCalendar } = await import("../../frontend/javascript/pages/university/deadline-calendar-view.js");
await initI18n();

test("calendar exposes native date controls, source time and applicant restrictions in each language", () => {
  const events = [{ id: "deadline", kind: "application", deadline: "2027-01-13", name: "Round 2", time: "18:00", timezone: "Europe/London", sourceFactId: "official",
    sourceUrl: "https://example.edu/apply", applicantCategoryLabel: "US citizen; US permanent resident" }];
  for (const [language, title] of [["eng", "Application deadline"], ["rus", "Срок подачи заявления"], ["kaz", "Өтініш беру мерзімі"]]) {
    setLanguage(language, { emit: false });
    const html = renderDeadlineCalendar(events, { monthKey: "2027-01" });
    assert.ok(html.includes(title));
    assert.match(html, /data-calendar-day="2027-01-13"[^>]*aria-pressed="true"/);
    assert.match(html, /data-calendar-month="previous" aria-label=/);
    assert.match(html, /18:00 · Europe\/London/);
    assert.match(html, /US citizen; US permanent resident/);
    assert.ok([...html.matchAll(/\bhref="([^"]*)"/g)].some(([, href]) => href === "https://example.edu/apply"));
    assert.match(html, /data-calendar-export="0"/);
  }
});

test("yearless and approximate dates produce an honest empty calendar without export controls", () => {
  setLanguage("eng", { emit: false });
  const html = renderDeadlineCalendar([{ deadline: "November 1" }, { deadline: "2027-01-13", approximate: true }]);
  assert.match(html, /No deadlines with an exact published date and year/);
  assert.doesNotMatch(html, /data-calendar-day|data-calendar-export/);
});
