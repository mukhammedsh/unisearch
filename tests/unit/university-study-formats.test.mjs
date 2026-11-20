import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { renderOverviewSection, universityStudyFormats } = await import("../../frontend/javascript/pages/university/render-content.js");

test("program formats group into campus, hybrid and online without schedule wording", () => {
  assert.deepEqual(universityStudyFormats(["On-campus", "not_stated", "Full-time academic program; primarily in-person evening schedule"]), ["on_campus"]);
  assert.deepEqual(universityStudyFormats(["Full-time", "full time"]), []);
  assert.deepEqual(universityStudyFormats(["blended: online evening twice weekly and two-day on-campus intensive every five weeks"]), ["hybrid"]);
  assert.deepEqual(universityStudyFormats(["campus or remote", "low-residency with2-3-week campus intensives"]), ["on_campus", "hybrid", "online"]);
  assert.deepEqual(universityStudyFormats(null), []);
  // Values arrive translated for Russian and Kazakh readers.
  assert.deepEqual(universityStudyFormats(["Очно (кампус)", "not_stated", "Очная программа; занятия преимущественно вечером"]), ["on_campus"]);
  assert.deepEqual(universityStudyFormats(["Кампуста", "Онлайн / Қашықтан", "Толық оқу жүктемесі бар бағдарлама; сабақтар негізінен кешкі уақытта бетпе-бет өтеді."]), ["on_campus", "online"]);
});

test("MIT's reviewed program formats do not describe the university as an evening school", async () => {
  const catalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
  const mit = catalog.institutions.find(row => row.institution.id === "mit-usa-cambridge");
  const modes = mit.study_options.map(option => option.attributes?.format).map(format => (format && typeof format === "object" ? format.mode : format)).flat().filter(value => typeof value === "string");
  const formats = universityStudyFormats(modes);
  assert.ok(formats.includes("on_campus"));
  assert.ok(formats.every(bucket => ["on_campus", "hybrid", "online"].includes(bucket)));
});

test("the campus area is stated in hectares with an everyday comparison and its source", async () => {
  global.fetch = async (url) => String(url).split("?")[0].endsWith("Localization/eng")
    ? { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } }
    : { ok: false, async text() { return ""; } };
  const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
  const { campusAreaFact } = await import("../../frontend/javascript/pages/_shared.js");
  await initI18n();
  setLanguage("eng", { persist: false, emit: false });
  assert.equal(campusAreaFact({ size: "medium" }), null);
  const mit = campusAreaFact({ campus_area_m2: 679968, size_source_url: "https://facts.mit.edu/mit-campus/", size_is_approximate: true,
    size_source_title: "MIT Facts — Campus", size_checked_at: "2026-11-20", size_scope: "Cambridge campus" });
  assert.equal(mit.sourceUrl, "https://facts.mit.edu/mit-campus/");
  assert.equal(mit.sourceTitle, "MIT Facts — Campus");
  assert.equal(mit.checkedAt, "2026-11-20");
  assert.equal(mit.scope, "Cambridge campus");
  assert.match(mit.text, /^≈/);
  assert.match(mit.comparison, /95/);
  // Very large estates are given in km² without a pitch count.
  const stanford = campusAreaFact({ campus_area_m2: 33104376 });
  assert.match(stanford.text, /33/);
  assert.equal(stanford.comparison, "");
});

test("the overview links metric sources and shows recorded check dates", async () => {
  global.fetch = async (url) => String(url).split("?")[0].endsWith("Localization/eng")
    ? { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } }
    : { ok: false, async text() { return ""; } };
  const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
  await initI18n();
  setLanguage("eng", { persist: false, emit: false });
  const container = { innerHTML: "" };
  renderOverviewSection({
    container,
    includeAdmissionRate: false,
    officialRank: true,
    university: {
      rank: 1,
      rank_meta: { source: "Example Ranking", source_url: "https://ranking.example/", verified_at: "2026-04-09" },
      student_count: 11920,
      fact_provenance: { facts: { student_count: { source: "University Facts", source_url: "https://facts.example/", verified_at: "2026-03-12",
        basis: { scope: "All students, 2025–2026" } } } },
      academics: { formats: ["On-campus"] },
      verified_sources: [
        { topic: "formats", url: "https://www.university.example/study", title: "Computer Science Bachelor",
          scope: "BSc Computer Science", checked_at: "2026-11-20", format_modes: ["On-campus"] },
        { topic: "formats", url: "https://catalog.example/study" },
      ],
    },
  });
  assert.match(container.innerHTML, /href="https:\/\/ranking\.example\/"/);
  assert.match(container.innerHTML, /Example Ranking/);
  assert.match(container.innerHTML, /Last checked: 2026.04-09/);
  assert.match(container.innerHTML, /href="https:\/\/facts\.example\/"/);
  assert.match(container.innerHTML, /University Facts/);
  assert.match(container.innerHTML, /Last checked: 2026.03-12/);
  assert.match(container.innerHTML, /Source scope: All students, 2025/);
  assert.match(container.innerHTML, /Check date not recorded/);
  assert.match(container.innerHTML, /href="https:\/\/www\.university\.example\/study"/);
  assert.match(container.innerHTML, /On-campus · Computer Science Bachelor/);
  assert.match(container.innerHTML, /Scope: BSc Computer Science/);
  assert.match(container.innerHTML, /Formats are based on cited program pages/);
});
