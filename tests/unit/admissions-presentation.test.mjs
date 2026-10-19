import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { formatPublishedDate, renderApplicantSection } = await import("../../frontend/javascript/pages/university/admissions-presentation.js");
const { admissionsCycleLabel, admissionsRouteName } = await import("../../frontend/javascript/pages/university/admissions-render.js");
await initI18n();

test("readable route labels retain the official source title for references", () => {
  setLanguage("rus", { emit: false });
  const route = { id: "undergraduate-shared-evidence:stanford-first-year", title: "University-wide first-year undergraduate admission" };
  assert.equal(admissionsRouteName(route, { presentation: "simple" }), "Первый курс после школы");
  assert.equal(admissionsRouteName(route), route.title);
});

function context(rows, groups) {
  return { selected_option: { id: "cs", title: "Computer Science" }, selected_route: { id: "first-year", shared_policy_context_ids: [] },
    facts: rows, fact_groups: groups, sources: [{ id: "official", title: "Official policy", url: "https://example.edu/admissions" }],
    unknowns: [], assessment: {}, history: {} };
}
function fact(id, value, extra = {}) {
  return { id, value, topic: "academic_tests", scope: { option_ids: [], route_ids: ["first-year"], applicant_categories: [] },
    source_ids: ["official"], publication_status: "published", review_status: "verified", applicability: { status: "conditional" }, ...extra };
}

test("yearless deadlines are localized without inventing a year and keep their source", () => {
  const resolved = context([fact("dates", { windows: [{ name: "Early Action", application_due: "November 1", aid_due: "November 30", decision: "mid-December" }] }, { topic: "application_windows" })], { deadlines: ["dates"] });
  for (const [language, month] of [["eng", "November"], ["rus", "ноября"], ["kaz", "қараша"]]) {
    setLanguage(language, { emit: false });
    const html = renderApplicantSection(resolved, ["deadlines"]);
    assert.ok(html.includes(month));
    assert.match(html, /<caption>.+<\/caption>/);
    assert.match(html, /https:\/\/example.edu\/admissions/);
    assert.doesNotMatch(formatPublishedDate("November 1"), /2000|2027/);
    assert.equal(formatPublishedDate("February 31"), "February 31");
  }
});

test("a selected route without deadline records explains the empty section", () => {
  setLanguage("eng", { emit: false });
  const html = renderApplicantSection(context([], { deadlines: [] }), ["deadlines"]);
  assert.match(html, /No source records are catalogued for this selection/);
});

test("Kazakh deadlines remain readable without browser locale data", () => {
  setLanguage("kaz", { emit: false });
  const original = Intl.DateTimeFormat;
  Intl.DateTimeFormat = class { constructor() { throw new RangeError("Locale data unavailable"); } };
  try {
    assert.equal(formatPublishedDate("November 1"), "1 қараша");
    assert.equal(formatPublishedDate("January 4"), "4 қаңтар");
    assert.equal(formatPublishedDate("mid-December"), "желтоқсан айының ортасы");
    assert.equal(formatPublishedDate("February 31"), "February 31");
  } finally {
    Intl.DateTimeFormat = original;
  }
});

test("displayed cycles translate without changing stored or unknown source labels", () => {
  setLanguage("rus", { emit: false });
  assert.equal(admissionsCycleLabel("Fall 2027"), "Осенний набор 2027");
  assert.equal(admissionsCycleLabel("2027 entry"), "Набор 2027");
  assert.equal(admissionsCycleLabel("2026-2027 academic year"), "2026-2027 academic year");
  setLanguage("kaz", { emit: false });
  assert.equal(admissionsCycleLabel("Spring 2027 entry"), "2027 жылғы көктемгі қабылдау");
});

test("published ISO dates retain the stated year and do not normalize invalid calendar dates", () => {
  setLanguage("rus", { emit: false });
  assert.equal(formatPublishedDate("2027-01-13"), "13 января 2027");
  assert.equal(formatPublishedDate("2027-02-29"), "2027-02-29");
  assert.equal(formatPublishedDate("January 13"), "13 января");
  assert.equal(admissionsCycleLabel("October 2027"), "октябрь 2027");
});

test("UCAS Medicine and other courses retain separate published deadlines", () => {
  setLanguage("eng", { emit: false });
  const row = fact("ucas", { medicine_deadline: { date: "2026-10-15", time: "18:00", timezone: "Europe/London" },
    other_course_equal_consideration: { date: "2027-01-13", time: "18:00", timezone: "Europe/London" } });
  for (const [id, date, other] of [["cs", "January 13, 2027", "October 15, 2026"], ["imperial-option-medicine", "October 15, 2026", "January 13, 2027"]]) {
    const resolved = context([row], { deadlines: [row.id] });
    resolved.selected_option.id = id;
    const html = renderApplicantSection(resolved, ["deadlines"]);
    const summary = html.split('<details class="admissions-reading__references"')[0];
    assert.ok(summary.includes(date));
    assert.ok(!summary.includes(other));
    assert.match(summary, /Europe\/London/);
  }
});

test("requirements distinguish required alternatives from conditional language recommendations", () => {
  setLanguage("rus", { emit: false });
  const rows = [fact("sat", { presence: "required", alternatives: ["SAT", "ACT"], cutoff: null }),
    fact("english", { presence: "strongly_recommended", minima_and_recommendations: [{ exam: "IELTS Academic", minimum: 7, recommended: 7.5 }] }, {
      topic: "language_tests", conditions: [{ when: "Non-native English speaker AND (using English for fewer than five years OR not speaking English at home or school)", effect: "Strong recommendation" }],
    })];
  const html = renderApplicantSection(context(rows, { requirements: ["sat", "english"] }), ["requirements"]);
  assert.match(html, /SAT или ACT/);
  assert.match(html, /Настоятельно рекомендуется/);
  assert.match(html, /менее пяти лет/);
  assert.match(html, /IELTS Academic/);
  assert.match(html, /7,5/);
});

test("unlinked special rules remain in additional references rather than the selected requirements", () => {
  setLanguage("eng", { emit: false });
  const rows = [fact("tests", { presence: "required", alternatives: ["SAT", "ACT"] }), fact("internal", "Graduate residence policy", { scope: { option_ids: [], route_ids: [] }, topic: "funding" })];
  const html = renderApplicantSection(context(rows, { requirements: ["tests", "internal"] }), ["requirements"]);
  assert.match(html, /data-general-references/);
  const referenceStart = html.indexOf("data-general-references");
  assert.ok(html.indexOf("Graduate residence policy") > referenceStart);
  assert.ok(html.indexOf("SAT or ACT") < referenceStart);
  assert.match(html, /applicability to this selection is unresolved/);
});

test("reference budgets keep zero, period and currency and funding is summarized once", () => {
  setLanguage("eng", { emit: false });
  const rows = [fact("budget", { currency: "USD", total_before_aid: 100, tuition: 0, housing_estimate: 100 }, { topic: "costs", period: { kind: "academic_year", label: "2026-27" } }),
    fact("sat-aid", { funding_type: "grant", funding_program: "Need-based Aid", description: "SAT source record" }, { topic: "funding" }),
    fact("act-aid", { funding_type: "grant", funding_program: "Need-based Aid", description: "ACT source record" }, { topic: "funding" })];
  const html = renderApplicantSection(context(rows, { costs: ["budget"], funding: ["sat-aid", "act-aid"] }), ["costs", "funding"]);
  assert.match(html, /0 USD/);
  assert.match(html, /2026[‑-]27/);
  assert.match(html, /not a confirmed price for another entry cycle/);
  assert.equal((html.match(/<h3>Need-based financial aid<\/h3>/g) || []).length, 1);
  assert.match(html, /SAT source record/);
  assert.match(html, /ACT source record/);
  const noBudget = renderApplicantSection(context(rows.slice(1), { funding: ["sat-aid", "act-aid"] }), ["costs", "funding"]);
  assert.match(noBudget, /No comparable budget is confirmed/);
});

test("structured catalog cost references retain original prose and expose their dated budget", () => {
  setLanguage("eng", { emit: false });
  const row = fact("budget", "Official source prose and conditional fees remain available.", { topic: "cost_of_attendance",
    attributes: { catalog_costs: { currency: "USD", academic_year: "2026-2027", tuition: 67731, total_before_aid: 97545, exclusions: ["insurance", "one_time_fees"] } } });
  const resolved = context([row], { costs: [row.id] });
  const html = renderApplicantSection(resolved, ["costs"]);
  assert.match(html, /97,545 USD/);
  assert.match(html, /2026[‑-]2027/);
  assert.match(html, /Insurance is additional/);
  assert.match(html, /Official source prose and conditional fees remain available/);
});
