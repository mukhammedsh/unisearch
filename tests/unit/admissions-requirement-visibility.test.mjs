import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { readForSinglePublishedCycle } = await import("../../frontend/javascript/pages/university/admissions-cycle.js");
const { englishRequirementItems } = await import("../../frontend/javascript/pages/university/admissions-english.js");
const { applicationFeeText, fundingKeyLines } = await import("../../frontend/javascript/pages/university/admissions-funding-lines.js");
const { sectionMinimumsText } = await import("../../frontend/javascript/pages/university/admissions-minimums.js");
const { glossaryTerms, termsForRoute } = await import("../../frontend/javascript/pages/university/admissions-glossary.js");
const { costFact, deadlineFact, fundingFact, minimumChecklist, renderAdmissionsKeyFacts } = await import("../../frontend/javascript/pages/university/admissions-key-facts.js");
const { checklistItems, deadlineCard } = await import("../../frontend/javascript/pages/university/overview-summary.js");
await initI18n();
setLanguage("eng", { emit: false });

const published = { publication: "published", review: "verified" };
const fact = (id, topic, value, extra = {}) => ({ id, topic, value, normalized_status: published, applicability: { status: "conditional" }, scope: {}, ...extra });
const resolvedWith = (facts, extra = {}) => ({ selected_route: { id: "route", title: "Route", shared_policy_context_ids: [] }, facts, sources: [], available_routes: [],
  fact_groups: { requirements: facts.map(row => row.id), funding: facts.map(row => row.id), costs: facts.map(row => row.id) }, assessment: { activeChoice: { details: { checks: [] } } }, ...extra });

test("a path that publishes one entry cycle is read again for that cycle, and a cycle the reader set is kept", async () => {
  const calls = [];
  const read = async context => {
    calls.push(context.intended_entry_cycle);
    return context.intended_entry_cycle ? { assessment: { reason: "missing_evidence" } }
      : { assessment: { reason: "entry_cycle_required" }, fact_groups: { requirements: ["a"] }, facts: [{ id: "a", scope: { cycle: "Fall 2027" } }] };
  };
  const first = await readForSinglePublishedCycle(read, { intended_entry_cycle: "" });
  assert.deepEqual(calls, ["", "Fall 2027"]);
  assert.equal(first.cycle, "Fall 2027");
  assert.equal(first.resolved.assessment.reason, "missing_evidence");
  calls.length = 0;
  assert.equal((await readForSinglePublishedCycle(read, { intended_entry_cycle: "Fall 2028" })).cycle, "");
  assert.deepEqual(calls, ["Fall 2028"]);
});

test("section minimums stand beside the total: the Writing band, other sections and the UNT literacy scores", () => {
  assert.equal(sectionMinimumsText({ exam_id: "IELTS", component_minimums: { IELTS_WRITING: 6, IELTS_READING: 5.5, IELTS_LISTENING: 5.5, IELTS_SPEAKING: 5.5 } }),
    "Writing at least 6.0, other sections at least 5.5");
  assert.equal(sectionMinimumsText({ exam_id: "IELTS", component_minimums: { IELTS_WRITING: 6, IELTS_READING: 6, IELTS_LISTENING: 6, IELTS_SPEAKING: 6 } }), "every section at least 6.0");
  assert.equal(sectionMinimumsText({ exam_id: "UNT", component_minimums: { UNT_MATHEMATICAL_LITERACY: 8, UNT_READING_LITERACY: 8 } }), "mathematical literacy and reading literacy at least 8");
  assert.equal(sectionMinimumsText({ exam_id: "IELTS" }), "");
});

const ntu = { kind: "language_requirement", factId: "english", status: "missing", measurable: true,
  rule: { alternatives: [{ exam_id: "IELTS", minimum: 6, component_minimums: { IELTS_WRITING: 6, IELTS_READING: 5.5, IELTS_LISTENING: 5.5, IELTS_SPEAKING: 5.5 } }] },
  provided: { exam: "IELTS", score: 6.5, minimum_checks: [{ exam: "IELTS", status: "met" }, { exam: "IELTS_WRITING", status: "missing" }] },
  missingInputs: [{ exam: "IELTS", needs: ["components", "taken_on"] }] };
const unt = { kind: "academic_requirement", factId: "academic", status: "missing", measurable: true,
  rule: { alternatives: [{ exam_id: "UNT", minimum: 85, component_minimums: { UNT_MATHEMATICAL_LITERACY: 8, UNT_READING_LITERACY: 8 } }] },
  provided: { exam: "UNT", score: 110, minimum_checks: [{ exam: "UNT", status: "met" }, { exam: "UNT_READING_LITERACY", status: "missing" }] },
  missingInputs: [{ exam: "UNT", needs: ["components"] }] };

test("a total that meets the minimum while section scores are missing is partly checked, with the section minimums and what to add", () => {
  const items = minimumChecklist(resolvedWith([], { assessment: { activeChoice: { details: { checks: [ntu, unt] } } } }));
  assert.deepEqual(items.map(item => item.mark), ["partial", "partial"]);
  assert.equal(items[0].text, "English: IELTS Academic 6.0 (Writing at least 6.0, other sections at least 5.5)");
  assert.match(items[0].note, /^Partly checked\. You have: IELTS Academic 6\.5; the overall score meets the minimum\./);
  assert.equal(items[1].text, "Academic result: UNT (Kazakhstan) 85 (mathematical literacy and reading literacy at least 8)");
  assert.match(items[1].note, /add: UNT \(Kazakhstan\): scores for mathematical literacy and reading literacy$/);
  // The Overview carries the same state; a missing total never becomes met or below.
  assert.deepEqual(checklistItems(resolvedWith([], { assessment: { activeChoice: { details: { checks: [ntu] } } } })).map(item => item.mark), ["partial"]);
  const unknown = { ...ntu, provided: { exam: "IELTS", score: 6.5, minimum_checks: [] } };
  assert.equal(minimumChecklist(resolvedWith([], { assessment: { activeChoice: { details: { checks: [unknown] } } } }))[0].mark, "todo");
});

test("a recommendation is not listed as still to prepare and keeps its condition on the Overview", () => {
  const english = fact("english", "language_tests", { presence: "strongly_recommended", minima_and_recommendations: [{ exam: "IELTS Academic", minimum: 7, recommended: 7.5 }] },
    { conditions: [{ when: "Non-native English speaker AND (using English for fewer than five years)" }] });
  const [plain] = checklistItems(resolvedWith([english]));
  assert.equal(plain.mark, "recommended");
  assert.match(plain.text, /strongly recommended.*if English is not your first language/);
  const [withProfile] = checklistItems(resolvedWith([english]), { languages: [] });
  assert.match(withProfile.text, /IELTS Academic 7\.0 \(better 7\.5\), if English is not your first language/);
  const [notNative] = checklistItems(resolvedWith([english]), { languages: [{ code: "ru", kind: "native" }] });
  assert.doesNotMatch(notNative.text, /first language/);
});

test("the English requirement is visible: no test required (Stanford) and the course's IELTS level with section minimum (Imperial)", () => {
  const stanford = fact("review", "international_applicant_treatment", "Citizenship does not change the route. Undergraduate English-proficiency exams are not required; fluency in English is an admission prerequisite, and applicants may self-report English exam scores if they wish.");
  const [none] = englishRequirementItems(resolvedWith([stanford]));
  assert.equal(none.mark, "note");
  assert.match(none.text, /^English test: not required\./);
  // A sentence that exempts only some applicants is not "no test needed".
  assert.deepEqual(englishRequirementItems(resolvedWith([fact("x", "language_tests", "English-proficiency exams are not required for applicants who studied in English.")])), []);
  const ielts = fact("imperial-english-ielts-academic", "language_tests", { standard: { overall: 6.5, each_element: 6 }, higher: { overall: 7, each_element: 6.5 } });
  const course = (text) => fact("course", "course_specific_academic_requirements_and_selection", { course_english_language_requirement_level: text });
  const [standard] = englishRequirementItems(resolvedWith([ielts, course("you must achieve the standard university requirement")]));
  assert.equal(standard.text, "English, Standard level for this course: IELTS 6.5, at least 6.0 in every section");
  assert.match(standard.note, /Other accepted tests/);
  const [both] = englishRequirementItems(resolvedWith([ielts]));
  assert.match(both.text, /Standard — IELTS 6\.5, at least 6\.0 in every section; Higher — IELTS 7\.0, at least 6\.5 in every section/);
  // A measured language check replaces these lines on the Overview.
  assert.equal(checklistItems(resolvedWith([ielts, course("standard university requirement")]))[0].text, standard.text);
  assert.match(renderAdmissionsKeyFacts(resolvedWith([ielts, course("standard university requirement")]), { now: new Date(2026, 10, 1) }), /IELTS 6\.5, at least 6\.0 in every section/);
});

test("funding shows award, coverage and deadline lines, and never points to records that say nothing", () => {
  const inspires = fact("inspires", "funding", { funding_program: "Imperial Inspires (2027/28)", funding_type: "competitive_scholarship", availability: "conditional",
    value: "£15,000 per year of the course; 150 awards are listed for undergraduate applicants.", deadline: { date: "2027-02-05", time: "23:59", timezone: "Europe/London" },
    outcome: "Notification no later than 30 April 2027." });
  const lines = fundingKeyLines([inspires]);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^Imperial Inspires \(2027\/28\): £15,000 per year/);
  assert.equal(lines[1], "Apply by February 5, 2027, 23:59 Europe/London");
  const discounts = fact("discounts", "funding_reference", { published_tuition_coverage_percent: { socially_vulnerable_Kazakhstan_categories: 75, second_and_later_fee_paying_sibling: 25, full_annual_tuition_single_payment: 5 } });
  assert.deepEqual(fundingKeyLines([discounts]).map(line => line.split(":")[0]), ["75% of tuition", "25% of tuition", "5% of tuition"]);
  const grants = fact("grants", "financial_support_eligibility", { process: "Separate application after a regular admission offer. 2027/28 deadlines are TBA.",
    published_tuition_coverage_options: [{ coverage_percent: 75, scope: "citizens of Kazakhstan in listed vulnerable categories: orphan" }, { coverage_percent: 5, scope: "one-time payment; payment discount, not a need/merit award" }] });
  assert.deepEqual(fundingKeyLines([grants]), ["Separate application after a regular admission offer. 2027/28 deadlines are TBA.", "75% of tuition: citizens of Kazakhstan in listed vulnerable categories"]);
  assert.deepEqual(fundingKeyLines([fact("prose", "financial_aid", "Aid is need-based.")]), []);
  const withLines = fundingFact(resolvedWith([inspires]));
  assert.match(withLines.text, /^What the university publishes for this path/);
  assert.equal(withLines.lines.length, 3);
  // Without a summarisable record the text points to the sources, not to a description "below".
  assert.doesNotMatch(fundingFact(resolvedWith([fact("prose", "financial_aid", "Aid is need-based.")]), { onCostsTab: true }).text, /described below/);
  assert.match(renderAdmissionsKeyFacts(resolvedWith([inspires]), { now: new Date(2026, 10, 1) }), /<ul class="admissions-key-facts__lines"><li>Imperial Inspires/);
});

test("the application fee is shown from the published amount with its late fee", () => {
  const fee = fact("fee", "application_fee", { amount: 10000, currency: "KZT", late_fee: 30000, late_window: "last two weeks before approved deadline or extension" });
  assert.match(applicationFeeText(resolvedWith([fee])), /^≈ \$23 Late fee: ≈ \$68, if you apply in the last two weeks before the deadline\.$/);
  assert.equal(applicationFeeText(resolvedWith([fact("prose", "application_fee", "Application fee is USD 100.")])), "");
  assert.match(renderAdmissionsKeyFacts(resolvedWith([fee]), { now: new Date(2026, 10, 1) }), /data-key-fact="application_fee"/);
});

test("an annual date without a stated year is shown without one, and a rolling application period says so", () => {
  const rounds = fact("rounds", "application_windows", { windows: [{ name: "Regular Action", application_due: "January 4" }] },
    { period: { kind: "yearless_policy", label: "Recurring first-year dates; page does not state entry year" } });
  const resolved = resolvedWith([rounds], { fact_groups: { deadlines: ["rounds"] } });
  const card = deadlineCard(deadlineFact(resolved, new Date(2026, 10, 13, 12, 0)));
  assert.doesNotMatch(card.headline, /2027/);
  assert.match(card.headline, /year/);
  const period = fact("window", "application_window", { application_period: "October 2026–August 2027", submission: "rolling basis", other_international_applicants: "to be announced later" },
    { normalized_status: published });
  const nu = deadlineFact(resolvedWith([period], { fact_groups: { deadlines: ["window"] } }), new Date(2026, 10, 13, 12, 0));
  assert.equal(nu.status, "period");
  assert.deepEqual(nu.notes, ["Applications are accepted on a rolling basis, as they arrive.", "Dates for some other international applicants are not published yet."]);
  assert.deepEqual(deadlineCard(nu).lines, nu.notes);
});

test("a price that depends on the fee status offers a button to the field, and transfer paths drop first-year round terms", () => {
  const quote = { min: 47800, max: 47800, currency: "GBP", period: "2027", billing_period: "academic_year", annual_comparable: true,
    fee_statuses: ["Home fee", "Overseas fee"], fee_status_match: "unknown", usd: { min: 60000, max: 60000 } };
  const cost = costFact({ selected_costs: { annual_total: quote }, facts: [], sources: [] }, 40000);
  assert.equal(cost.feeStatusAction, true);
  assert.ok(cost.notes.includes("Depends on fee status (Home or Overseas)"));
  const html = renderAdmissionsKeyFacts(resolvedWith([], { selected_costs: { annual_total: quote } }), { now: new Date(2026, 10, 1) });
  assert.match(html, /<button type="button" class="admissions-key-facts__link" data-key-facts-fee-status>Set your fee status<\/button>/);
  const terms = glossaryTerms("first-year REA November 15; RD February 15; transfer March 15");
  assert.deepEqual(termsForRoute(terms, { applicant_route: "transfer" }), []);
  assert.deepEqual(termsForRoute(terms, { applicant_route: "first_year" }), terms);
  assert.deepEqual(termsForRoute(terms, null), terms);
});

test("the Russian budget comparison reads as a comparison with the reader's budget, not as an amount over it", () => {
  setLanguage("rus", { emit: false });
  try {
    const quote = { min: 40000, max: 40000, currency: "USD", period: "2027", billing_period: "academic_year", annual_comparable: true,
      fee_statuses: [], fee_status_match: "not_required", usd: { min: 40000, max: 40000 } };
    assert.match(costFact({ selected_costs: { annual_total: quote } }, 5000).flag.text, /^Дороже вашего бюджета \(/);
  } finally { setLanguage("eng", { emit: false }); }
});
