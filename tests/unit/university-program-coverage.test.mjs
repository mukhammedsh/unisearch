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

const { initI18n } = await import("../../frontend/javascript/i18n.js");
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
