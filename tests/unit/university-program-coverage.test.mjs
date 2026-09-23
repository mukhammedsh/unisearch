import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "");
  if (target.endsWith("Localization/eng")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  if (target.endsWith("Localization/ru")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { renderProgramCoverage, resolveDisplayedCoverageProgram, resolveProgramCoverage } = await import("../../frontend/javascript/pages/university/render-content.js");
await initI18n();

function row(overrides = {}) {
  return {
    program_id: "p1",
    program_name: "Selected Program",
    study_levels: ["master"],
    requirements: { status: "not_catalogued", scope: "not_catalogued" },
    deadline: { status: "not_catalogued", scope: "not_catalogued", values: [] },
    tuition_mandatory_fees: { status: "not_catalogued", scope: "not_catalogued", values: {} },
    awards: { status: "not_catalogued", scope: "not_catalogued", items: [] },
    ...overrides,
  };
}

test("MIT undergraduate coverage labels general route and university cost guidance without claiming program price", () => {
  const mit = row({
    program_id: "Course 6-3",
    program_name: "Computer Science and Engineering (Course 6-3)",
    study_levels: ["bachelor"],
    requirements: { status: "available", scope: "institution_wide_route", source_url: "https://mitadmissions.org/apply/firstyear/deadlines-requirements/", cycle: "2027 entry" },
    deadline: { status: "approximate_or_yearless", scope: "institution_wide_route", values: ["November 1", "January 4"], source_url: "https://mitadmissions.org/apply/firstyear/deadlines-requirements/", cycle: "2027 entry" },
    tuition_mandatory_fees: { status: "available", scope: "university_guidance", values: { Tuition: 66720, currency: "USD" }, source_url: "https://sfs.mit.edu/cost-of-attendance-class-of-2030/", cycle: "2026-27" },
  });
  const html = renderProgramCoverage([mit], { id: "Course 6-3", name: mit.program_name });

  assert.match(html, /University-wide admission route/);
  assert.match(html, /November 1; January 4/);
  assert.match(html, /2027 entry/);
  assert.match(html, /university-level guidance; not a program price/i);
  assert.doesNotMatch(html, /USD 66,720/);
  assert.match(html, /https:\/\/mitadmissions\.org\/apply\/firstyear\/deadlines-requirements\//);
});

test("Imperial Home fee guidance shows its provisional amount without a generic program price", () => {
  const imperial = row({
    program_id: "imperial-computing-beng",
    program_name: "Computing (BEng)",
    study_levels: ["bachelor"],
    tuition_mandatory_fees: {
      status: "available",
      scope: "university_guidance",
      values: { undergraduate_home_expected_tuition_gbp: 10050, currency: "GBP", total_cost_year_usd: 40000 },
      cycle: "2027-28 Home undergraduate tuition expected, subject to parliamentary approval",
      source_url: "https://www.imperial.ac.uk/study/courses/undergraduate/computing-beng/",
    },
  });
  const html = renderProgramCoverage([imperial], { id: imperial.program_id, name: imperial.program_name });
  assert.match(html, /Expected Home undergraduate tuition \(subject to approval\): GBP 10[\s,]050/);
  assert.match(html, /subject to parliamentary approval/);
  assert.doesNotMatch(html, /USD 40,000/);
});

test("Stanford graduate tuition coverage keeps quarterly units and the unknown next cycle explicit", () => {
  const stanford = row({
    program_id: "stanford-ms-cs",
    program_name: "Master of Science in Computer Science (MS CS)",
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      values: {
        tuition_per_quarter_8_10_units_usd: 15100,
        tuition_per_quarter_11_18_units_usd: 23239,
        tuition_per_quarter_above_18_units_usd: 1549,
        tuition_per_summer_unit_1_7_usd: 1510,
        currency: null,
      },
      cycle: "2026-27 published Engineering graduate tuition; billed quarterly by unit load. Student-specific annual total depends on units and enrolled quarters; 2027-28 rates are unknown.",
      source_url: "https://studentservices.stanford.edu/tuition-rates/2026-2027-graduate-and-professional-tuition-rates",
    },
  });
  const program = { id: stanford.program_id, name: stanford.program_name };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([stanford], program);
  assert.match(english, /Tuition per quarter \(8–10 units\): USD 15(?:[,.]|\s)100/);
  assert.match(english, /Tuition per quarter \(11–18 units\): USD 23(?:[,.]|\s)239/);
  assert.match(english, /Summer tuition per unit \(1–7 units\): USD 1(?:[,.]|\s)510/);
  assert.match(english, /2027[‐‑‒–—−-]28 rates are unknown/);
  assert.doesNotMatch(english, /Annual tuition/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([stanford], program);
  assert.match(russian, /Плата за квартал при нагрузке 8–10 единиц: USD 15(?:[,.]|\s)100/);
  assert.match(russian, /Летняя плата за единицу \(1–7 единиц\): USD 1(?:[,.]|\s)510/);
  assert.match(russian, /тарифы на 2027–28 пока неизвестны/);
  assert.doesNotMatch(russian, /Annual tuition/);
  setLanguage("eng", { persist: false, emit: false });
});

test("Stanford JD and MD tuition labels localize, and MD preserves the unconfirmed next cycle", () => {
  const jd = row({
    program_id: "stanford-jd",
    program_name: "Juris Doctor (JD)",
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      values: { tuition_year_usd: 79779, tuition_rate_per_quarter_usd: 26593, currency: "USD" },
      cycle: "2026-27 published tuition; three tuition quarters total USD 79,779, before separate mandatory school fees. Cardinal Care may be waived. 2027-28 rates are unknown.",
      source_url: "https://law.stanford.edu/apply/tuition-financial-aid/cost-of-attendance/",
    },
  });
  const md = row({
    program_id: "stanford-md",
    program_name: "Doctor of Medicine (MD)",
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      values: { tuition_rate_per_quarter_usd: 24034, tuition_four_quarter_total_usd: 96136, currency: "USD" },
      cycle: "2026-27 academic year; regular MD tuition payable in Autumn, Winter, Spring, and Summer quarters; 2027-28 rate not confirmed",
      source_url: "https://med.stanford.edu/md/mdhandbook/section-7-tuition-and-financial-aid/tuition---fees.html",
    },
  });

  setLanguage("eng", { persist: false, emit: false });
  const jdEnglish = renderProgramCoverage([jd], { id: jd.program_id, name: jd.program_name });
  const mdEnglish = renderProgramCoverage([md], { id: md.program_id, name: md.program_name });
  assert.match(jdEnglish, /Tuition per quarter: USD 26(?:[,.]|\s)593/);
  assert.match(mdEnglish, /Tuition per quarter: USD 24(?:[,.]|\s)034/);
  assert.match(mdEnglish, /Tuition total for four quarters: USD 96(?:[,.]|\s)136/);
  assert.match(mdEnglish, /2026[-‐‑–]27 academic year; regular MD tuition payable/);
  assert.match(mdEnglish, /2027[-‐‑–]28 rate not confirmed/);

  setLanguage("ru", { persist: false, emit: false });
  const jdRussian = renderProgramCoverage([jd], { id: jd.program_id, name: jd.program_name });
  const mdRussian = renderProgramCoverage([md], { id: md.program_id, name: md.program_name });
  assert.match(jdRussian, /Плата за квартал: USD 26(?:[,.]|\s)593/);
  assert.match(mdRussian, /Плата за квартал: USD 24(?:[,.]|\s)034/);
  assert.match(mdRussian, /Стоимость обучения за четыре квартала: USD 96(?:[,.]|\s)136/);
  assert.match(mdRussian, /Учебный год 2026–27/);
  assert.match(mdRussian, /тариф на 2027–28 не подтверждён/);
  assert.doesNotMatch(mdRussian, /regular MD tuition payable|2027-28 rate not confirmed/);
  setLanguage("eng", { persist: false, emit: false });
});

test("Stanford LLM coverage presents Knight-Hennessy only as a potential award", () => {
  const llm = row({
    program_id: "stanford-llm",
    program_name: "Master of Laws (LLM)",
    awards: {
      status: "available",
      scope: "award_program_scope",
      items: [{
        id: "stanford-knight-hennessy-scholars-2027",
        name: "Knight-Hennessy Scholars",
        program_scope: "Separate competitive award; eligibility must be confirmed for the current cohort.",
        source_url: "https://knight-hennessy.stanford.edu/",
      }],
    },
  });
  const program = { id: llm.program_id, name: llm.program_name };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([llm], program);
  assert.match(english, /Potential award records; not confirmed funding/);
  assert.match(english, /Records do not confirm applicant eligibility or an award/);
  assert.doesNotMatch(english, /Confirmed funding|Confirmed award/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([llm], program);
  assert.match(russian, /Возможные гранты/);
  assert.match(russian, /не подтверждают право кандидата на участие или получение гранта/);
  setLanguage("eng", { persist: false, emit: false });
});

test("Oxford graduate program keeps generic graduate deadline outside the course deadline fact", () => {
  const oxford = row({
    program_id: "msc_advanced_computer_science_pgt",
    program_name: "MSc in Advanced Computer Science",
    requirements: { status: "available", scope: "program_specific", source_url: "https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science" },
    deadline: { status: "not_catalogued", scope: "not_catalogued", values: [] },
    awards: { status: "available", scope: "award_program_scope", items: [{ name: "Clarendon Fund Scholarship", award_application_deadline: "Relevant course deadline; exact date is course-specific", cycle: "2027-2028", source_url: "https://www.ox.ac.uk/admissions/graduate/fees-and-funding/funding/clarendon/applicants" }] },
  });
  const html = renderProgramCoverage([oxford], { id: oxford.program_id, name: oxford.program_name });
  const courseStart = html.indexOf('data-coverage-kind="deadline"');
  const awardsStart = html.indexOf('data-coverage-kind="awards"');
  const courseDeadlineFact = html.slice(courseStart, awardsStart);

  assert.match(courseDeadlineFact, /Not catalogued/);
  assert.match(courseDeadlineFact, /Confirm the course application deadline and entry year/);
  assert.doesNotMatch(courseDeadlineFact, /December or January|Relevant course deadline/);
  assert.match(html, /Award application deadline/);
  assert.match(html, /course-specific/);
});

test("Imperial PhD scholarship rounds remain separate from an unknown course deadline", () => {
  const imperial = row({
    program_id: "imperial-phd-computing",
    program_name: "PhD in Computing",
    study_levels: ["doctorate"],
    deadline: { status: "not_catalogued", scope: "not_catalogued", values: [] },
    awards: { status: "available", scope: "award_program_scope", items: [{ name: "President's PhD Scholarships", program_scope: "Imperial PhD research programmes", applicant_scope: "Applicants worldwide; no nationality restriction", award_application_deadline: [{ date: "2026-11-02", time: "23:59", round: 1 }], deadline_timezone: "UK time", cycle: "2027-28", source_url: "https://www.imperial.ac.uk/study/fees-and-funding/postgraduate-doctoral/grants-scholarships/presidents-phd/" }] },
  });
  const html = renderProgramCoverage([imperial], { id: imperial.program_id, name: imperial.program_name });
  const courseStart = html.indexOf('data-coverage-kind="deadline"');
  const awardsStart = html.indexOf('data-coverage-kind="awards"');
  const courseDeadlineFact = html.slice(courseStart, awardsStart);
  const awardsFact = html.slice(awardsStart);

  assert.match(courseDeadlineFact, /Not catalogued/);
  assert.doesNotMatch(courseDeadlineFact, /2026-11-02/);
  assert.match(awardsFact, /2026[-‐‑‒–—−]11[-‐‑‒–—−]02 · 23:59 · Round 1/);
  assert.match(awardsFact, /not confirmed funding/);
  assert.match(awardsFact, /Applicant scope to check/);
});

test("integrated Oxford undergraduate masters do not inherit a graduate-only Clarendon award candidate", () => {
  const oxfordProgram = {
    id: "computer_science_ug",
    name: "Computer Science",
    study_levels: ["Bachelor", "Integrated Master"],
  };
  const oxfordCoverage = row({
    program_id: "computer_science_ug",
    program_name: "Computer Science",
    study_levels: ["bachelor", "master"],
    awards: {
      status: "available",
      scope: "award_program_scope",
      items: [
        { name: "Reach Oxford Scholarship", program_scope: "Oxford undergraduate courses except Medicine", source_url: "https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/reach-oxford" },
        { name: "Clarendon Fund Scholarship", program_scope: "Eligible full-time or part-time Oxford Master’s and DPhil courses", source_url: "https://www.ox.ac.uk/admissions/graduate/fees-and-funding/funding/clarendon/applicants" },
      ],
    },
  });

  const html = renderProgramCoverage([oxfordCoverage], oxfordProgram);
  assert.match(html, /Reach Oxford Scholarship/);
  assert.doesNotMatch(html, /Clarendon Fund Scholarship/);
});

test("coverage lookup requires the selected program id or exact title", () => {
  const rows = [row()];
  assert.equal(resolveProgramCoverage({ coverageByProgram: rows, program: { id: "p1", name: "Some other title" } }), rows[0]);
  assert.equal(resolveProgramCoverage({ coverageByProgram: rows, program: { id: "p2", name: "Selected Program extra" } }), null);
  assert.equal(resolveProgramCoverage({ coverageByProgram: rows, program: null }), null);
});

test("expanded program supplies coverage without changing the selected admission route", () => {
  const expanded = { id: "ppe", name: "Philosophy, Politics and Economics (PPE)" };
  const items = [{ key: "philosophy politics and economics ppe", program: expanded }];
  assert.equal(resolveDisplayedCoverageProgram(items, null, items[0].key), expanded);
  const routeSelected = { id: "msc", name: "MSc in Advanced Computer Science" };
  assert.equal(resolveDisplayedCoverageProgram(items, routeSelected, items[0].key), expanded);
  assert.equal(resolveDisplayedCoverageProgram(items, routeSelected, ""), routeSelected);
  assert.equal(resolveDisplayedCoverageProgram(items, null, ""), null);
});
