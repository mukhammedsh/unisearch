import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { publishedTuitionQuotes, renderApplicantSection } = await import("../../frontend/javascript/pages/university/admissions-presentation.js");
const { renderAdmissionsContext, renderStudyOptionOverview } = await import("../../frontend/javascript/pages/university/admissions-render.js");
const { renderReviewedComparison } = await import("../../frontend/javascript/pages/universities/compare-summary.js");
await initI18n();
window.location.href = "http://127.0.0.1/compare.html";
const catalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
const nu = catalog.institutions.find(row => row.institution.id === "nazarbayev-university-kaz-astana");

function context(optionId, routeId, domains) {
  const option = nu.study_options.find(row => row.id === optionId);
  const facts = nu.facts.filter(row => row.scope.option_ids.includes(optionId) && (!row.scope.route_ids.length || row.scope.route_ids.includes(routeId)))
    .map(row => ({ ...row, applicability: { status: "conditional" } }));
  return { selected_option: { ...option, format: option.attributes.format, overviews: [{ text: option.attributes.study_detail || "", source_ids: option.source_ids }] },
    selected_route: nu.application_routes.find(row => row.id === routeId), sources: nu.sources, facts,
    fact_groups: Object.fromEntries(Object.entries(domains).map(([key, ids]) => [key, ids])), unknowns: [], history: {}, assessment: {} };
}

test("NU Foundation and undergraduate tuition keep their own quote in primary reading", () => {
  setLanguage("eng", { emit: false });
  const row = nu.facts.find(row => row.id === "nu-a-fact-admission-fees");
  const foundation = "nu-a-study-nu-foundation-year-program";
  const cs = "nu-a-study-bachelor-of-science-in-computer-science";
  assert.deepEqual(publishedTuitionQuotes(row, foundation).map(quote => quote.amounts[0]), ["12,000 / year"]);
  assert.deepEqual(publishedTuitionQuotes(row, cs).map(quote => quote.amounts[0]), ["15,000 / year"]);
  const resolved = context(foundation, "nu-a-route-regular-foundation-undergraduate", { costs: [row.id] });
  const primary = renderApplicantSection(resolved, ["costs"]).split('<details class="admissions-reading__references"')[0];
  assert.match(primary, /12,000/);
  assert.doesNotMatch(primary, /15,000/);
  const comparison = renderReviewedComparison([{ id: "nu", name: "Nazarbayev University" }], new Map([["nu", { status: "ready", resolved, context: {} }]]));
  assert.match(comparison, /12,000/);
  assert.doesNotMatch(comparison, /15,000/);
});

test("a reviewed untranslated NU study description remains visible with its official source", () => {
  const resolved = context("nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", { study: ["nu-a-fact-nursing-study"] });
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    const html = renderStudyOptionOverview(resolved);
    assert.match(html, /Professional completion program for practicing nurses/);
    assert.doesNotMatch(html, /data-program-overview-missing/);
    assert.match(html, /https:\/\/nusom.nu.edu.kz\/bn/);
    assert.match(html, /English on central A-Z card; Nursing program page says Russian/);
  }
  setLanguage("eng", { emit: false });
});

test("pure NU study facts remain readable before choosing an application route", () => {
  const resolved = context("nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", { study: ["nu-a-fact-nursing-study"] });
  resolved.selected_route = null;
  const html = renderAdmissionsContext(resolved, { domains: ["study"], presentation: "simple", programOnly: true });
  assert.match(html, /Professional completion program for practicing nurses/);
  assert.match(html, /240/);
  assert.doesNotMatch(html, /nursing diploma or equivalent|minimum_gpa/);
});

test("NUZYP distinguishes a structured study record from a missing overview", () => {
  setLanguage("eng", { emit: false });
  const resolved = context("nu-a-study-nuzyp", null, { study: ["nu-a-fact-nuzyp-current-status"] });
  assert.match(renderStudyOptionOverview(resolved), /published study details below/);
  resolved.facts = resolved.facts.map(row => ({ ...row, applicability: { status: "mismatched" } }));
  assert.match(renderStudyOptionOverview(resolved), /study overview has not been collected/);
});

test("NU requirement disclosures distinguish English, academic alternatives and NAT", () => {
  setLanguage("eng", { emit: false });
  const resolved = context("nu-a-study-nu-foundation-year-program", "nu-a-route-regular-foundation-undergraduate", {
    requirements: ["nu-a-fact-fyp-english", "nu-a-fact-fyp-academic", "nu-a-fact-test-categories"],
  });
  const html = renderAdmissionsContext(resolved, { domains: ["requirements"], presentation: "simple", includeAssessment: false });
  const headings = [...html.matchAll(/<summary class="admissions-catalog__heading"><span>([^<]+)/g)].map(match => match[1]);
  assert.ok(headings.includes("Language requirements"), headings.join("; "));
  assert.ok(headings.includes("Academic qualifications"), headings.join("; "));
  assert.ok(!headings.includes("Application process"));
  const nursing = context("nu-a-study-bachelor-in-nursing", "nu-a-route-nursing", { requirements: ["nu-a-fact-nursing-entry"] });
  assert.match(renderAdmissionsContext(nursing, { domains: ["requirements"], presentation: "simple", includeAssessment: false }), /<span>Academic qualifications · NAT<\/span>/);
});

test("School policy comparisons stay in additional references with their complete source wording", () => {
  setLanguage("eng", { emit: false });
  const row = nu.facts.find(row => row.id === "nu-c-phd-requirements");
  const resolved = { selected_option: { id: "chemistry" }, selected_route: { id: "nu-c-phd-route" }, facts: [row],
    fact_groups: { reference: [row.id] }, sources: nu.sources, unknowns: [], history: {}, assessment: {} };
  const html = renderApplicantSection(resolved, ["requirements"]);
  assert.doesNotMatch(html.split("data-general-references")[0], /committee_may_consider_cgpa|highly ranked university/);
  assert.match(html, /highly ranked university/);
  assert.match(html, /School groups are not a universal PhD rule/);
});

test("a source-conflict assessment status uses plain language instead of a classifier", () => {
  setLanguage("eng", { emit: false });
  const resolved = context("nu-c-study-residency-in-neurology", "nu-residency-unconditional", {});
  const row = { id: "conflict", value: { assessment_state: "source_conflict_requires_confirmation" }, scope: {}, publication_status: "published", source_ids: [] };
  resolved.facts = [row];
  resolved.fact_groups = { requirements: [row.id] };
  const html = renderAdmissionsContext(resolved, { domains: ["requirements"], presentation: "simple", includeAssessment: false });
  assert.match(html, /Conflicting official sources/);
  assert.doesNotMatch(html, /source_conflict_requires_confirmation|Assessment state/);
});

test("a dated micro-credential source stays findable in Dates without becoming a current deadline", () => {
  setLanguage("eng", { emit: false });
  const resolved = context("nu-a-study-mining-microcredential", "nu-a-route-mining-microcredential", { costs: ["nu-a-fact-microcredential-entry-cost-cycle"] });
  const primary = renderApplicantSection(resolved, ["deadlines"]).split('<details class="admissions-reading__references"')[0];
  assert.match(primary, /Past-cycle reference/);
  assert.match(primary, /July 30, 2026/);
  assert.match(primary, /2026[-‑]08/);
  assert.doesNotMatch(primary, /4,806|267|USD|2027/);
  const row = resolved.facts.find(row => row.id === "nu-a-fact-microcredential-entry-cost-cycle");
  row.publication_status = "published";
  row.value = { application_deadline: "2027-02-01" };
  const future = renderApplicantSection(resolved, ["deadlines"]);
  assert.match(future, /February 1, 2027/);
  assert.doesNotMatch(future, /Past-cycle reference/);
});
