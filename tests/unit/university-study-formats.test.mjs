import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { universityStudyFormats } = await import("../../frontend/javascript/pages/university/render-content.js");

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
