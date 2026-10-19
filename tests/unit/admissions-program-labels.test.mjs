import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const catalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
const packs = JSON.parse(await readFile(new URL("../../backend/data/universities_translations.json", import.meta.url), "utf8"));
global.fetch = async url => {
  if (String(url).includes("/universities/translations?")) {
    const language = new URL(url, "https://example.test").searchParams.get("lang");
    return { ok: true, json: async () => ({ lang: language, data: packs.languages[language] }) };
  }
  return { ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") };
};
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { initUniversityTranslations } = await import("../../frontend/javascript/university-translations.js");
const { admissionsProgramLabel, renderStudyOptionOverview } = await import("../../frontend/javascript/pages/university/admissions-render.js");
const { translateAdmissionSummary } = await import("../../frontend/javascript/university-translations.js");
const { renderApplicantSection } = await import("../../frontend/javascript/pages/university/admissions-presentation.js");
await initI18n();

test("MIT titles explain catalog codes separately from localized program names", async () => {
  const option = catalog.institutions[0].study_options.find(option => option.id === "mit-course-6-3-bachelor");
  for (const [language, title] of [["eng", "Computer Science and Engineering"], ["rus", "Компьютерные науки и инженерия"], ["kaz", "Информатика және инженерия"]]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    assert.deepEqual(admissionsProgramLabel(option), { title, officialTitle: option.title, courseCode: "6-3" });
  }
  assert.equal(option.title, "Computer Science and Engineering (Course 6-3)");
});

test("every reviewed program has a Russian and Kazakh title while retaining its official name and award", async () => {
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const institution of catalog.institutions) for (const option of institution.study_options) {
      const before = structuredClone(option);
      const label = admissionsProgramLabel(option);
      assert.match(label.title, /[\u0400-\u04ff]/u, `${language}: ${option.title}`);
      assert.equal(label.officialTitle, option.title);
      assert.deepEqual(option, before);
    }
  }
});

test("award suffixes, distinct subjects and named routes stay visible", () => {
  setLanguage("eng", { emit: false });
  assert.equal(admissionsProgramLabel({ title: "Computer Science (PhD)", awards: ["PHD"] }).title, "Computer Science (PhD)");
  assert.equal(admissionsProgramLabel({ title: "Computing (Software Engineering)", awards: ["MEng"] }).title, "Computing (Software Engineering)");
  assert.equal(admissionsProgramLabel({ title: "Master of Business Administration (Full-Time MBA)", awards: ["MBA"] }).title, "Master of Business Administration (Full-Time MBA)");
  assert.equal(admissionsProgramLabel({ id: "other-institution", title: "Example (Course 6-3)", awards: [] }).courseCode, "");
});

test("program essentials use existing localized value formatters and keep official prose", async () => {
  const resolved = { selected_option: { id: "cs", format: { mode: "On-campus", language: ["English"] } },
    fact_groups: { study: ["overview"] }, facts: [{ id: "overview", publication_status: "published", review_status: "verified",
      scope: { option_ids: ["cs"] }, value: { duration: "4 years", description: "Official description stays available." } }] };
  const before = structuredClone(resolved);
  for (const [language, expected] of [["eng", ["4 years", "On-campus", "English"]], ["rus", ["4 года", "Очно (кампус)", "Английский"]], ["kaz", ["4 жыл", "Кампуста", "Ағылшын"]]]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    const html = renderStudyOptionOverview(resolved);
    for (const value of expected) assert.ok(html.includes(value), `${language}: ${value}`);
    assert.ok(html.includes(resolved.facts[0].value.description));
  }
  assert.deepEqual(resolved, before);
});

test("all available MIT overview descriptions have complete Russian and Kazakh translations", async () => {
  const mit = catalog.institutions[0];
  const descriptions = new Set();
  for (const option of mit.study_options) {
    const rows = mit.facts.filter(row => row.publication_status === "published" && /verified|reviewed|rechecked|carried_forward/.test(row.review_status) && row.scope.option_ids.includes(option.id) && !row.scope.route_ids.length);
    const description = rows.flatMap(row => [row.value?.description, row.value?.course_page_programme_summary, row.value?.A3i6E, row.topic === "study_content" ? row.value?.source_content : undefined]).find(value => typeof value === "string" && value.trim());
    if (description) descriptions.add(description);
  }
  assert.ok(descriptions.size > 150);
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const description of descriptions) assert.match(translateAdmissionSummary(description), /[\u0400-\u04ff]/u, `${language}: ${description}`);
  }
});

test("MIT aid documents are readable without disclosures and keep first-year and transfer dates separate", async () => {
  const mit = catalog.institutions[0];
  const facts = mit.facts.filter(row => ["undergraduate-aid-process-and-renewal", "undergraduate-aid-category-and-documents"].includes(row.id));
  for (const language of ["rus", "kaz"]) {
    setLanguage(language, { emit: false });
    await initUniversityTranslations();
    for (const route of ["mit-first-year", "mit-transfer", "mit_eecs_doctoral_admissions"]) {
      const resolved = { selected_option: mit.study_options[0], selected_route: { id: route }, facts, sources: mit.sources, unknowns: [],
        fact_groups: { funding: facts.map(row => row.id) } };
      const html = renderApplicantSection(resolved, ["costs", "funding"]);
      const highlights = html.split('<details class="admissions-reading__references"')[0];
      if (route === "mit_eecs_doctoral_admissions") { assert.doesNotMatch(highlights, /data-aid-summary/); continue; }
      for (const value of ["data-aid-summary", "CSS Profile", "3514", "IDOC", "data-aid-fafsa"]) assert.ok(highlights.includes(value), `${language} ${route}: ${value}`);
      assert.doesNotMatch(highlights, /Current published policy|Need-based Aid/);
      if (route === "mit-transfer") assert.doesNotMatch(highlights, /Early Action|Regular Action/);
      else assert.match(highlights, /Early Action/);
    }
  }
});
