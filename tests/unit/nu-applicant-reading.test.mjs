import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { publishedTuitionQuotes, renderApplicantSection } = await import("../../frontend/javascript/pages/university/admissions-presentation.js");
const { admissionDeadlineTitle, admissionsCycleLabel, renderAdmissionsContext, renderAdmissionsValue, renderStudyOptionOverview } = await import("../../frontend/javascript/pages/university/admissions-render.js");
const { renderReviewedComparison } = await import("../../frontend/javascript/pages/universities/compare-summary.js");
const { translateFactSource } = await import("../../frontend/javascript/university-translations.js");
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

test("Russian NU Foundation translations render while English keeps the original facts", async () => {
  const pack = JSON.parse(await readFile(new URL("../../backend/data/universities_translations.json", import.meta.url), "utf8")).languages.rus;
  const { loadUniversityTranslationsForLanguage } = await import("../../frontend/javascript/university-translations.js");
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ lang: "rus", data: pack }) });
  try {
    await loadUniversityTranslationsForLanguage("rus", true);
  } finally {
    global.fetch = previousFetch;
  }
  const resolved = context("nu-a-study-nu-foundation-year-program", "nu-a-route-regular-foundation-undergraduate", {
    study: ["nu-a-fact-nufyp-program"], requirements: ["nu-a-fact-fyp-academic"],
  });
  setLanguage("rus", { emit: false });
  assert.match(renderStudyOptionOverview(resolved), /Годичная очная подготовительная программа/);
  const requirements = renderAdmissionsContext(resolved, { domains: ["requirements"], presentation: "simple", includeAssessment: false });
  assert.match(requirements, /общий балл не ниже 120 из 240/);
  assert.match(requirements, /не порог для приёма на бакалавриат/);
  setLanguage("eng", { emit: false });
  assert.match(renderStudyOptionOverview(resolved), /One-academic-year, full-time preparation/);
});

test("all available NU overview descriptions and unknowns have Russian translations", async () => {
  const pack = JSON.parse(await readFile(new URL("../../backend/data/universities_translations.json", import.meta.url), "utf8")).languages.rus;
  const descriptions = nu.study_options.flatMap(option => option.evidence_profiles.map(profile => profile.attributes.description?.text).filter(Boolean));
  descriptions.push(nu.facts.find(row => row.id === "nu-a-fact-nursing-study").value.content);
  assert.equal(descriptions.length, 94);
  for (const source of [...descriptions, ...nu.unknowns.flatMap(row => [row.reason, row.official_next_step])]) {
    assert.match(pack.admission_exact[source] || "", /[а-яё]/iu, source);
  }
});

test("NU unknown records show translated reason and next step while preserving English and escaping fallback", () => {
  const resolved = context("nu-a-study-nuzyp", null, {});
  resolved.unknowns = [nu.unknowns.find(row => row.id === "nu-a-gap-nuzyp-activity"), { reason: "<untranslated>", scope: { option_ids: ["nu-a-study-nuzyp"], route_ids: [] }, source_ids: [] }];
  setLanguage("rus", { emit: false });
  const html = renderAdmissionsContext(resolved, { domains: [], programOnly: true, includeAssessment: false });
  assert.match(html, /Текущий набор, требования, длительность, стоимость и финансирование/);
  assert.match(html, /Найдите объявление о текущем наборе NUZYP/);
  assert.match(html, /Подготовительная программа NU Zero Year Program/);
  assert.match(html, /Уточнение области применения/);
  assert.match(html, /&lt;untranslated&gt;/);
  setLanguage("eng", { emit: false });
  assert.match(renderAdmissionsContext(resolved, { domains: [], programOnly: true }), /None establishes a current intake/);
});

test("source-specific field labels translate without changing values or English", () => {
  setLanguage("rus", { emit: false });
  const html = renderAdmissionsValue({ campus: "Astana, Kazakhstan", curriculum_summary: "Untranslated source", section_minimum: 50, program: "Master of Science in Data Science" });
  assert.match(html, /Кампус/);
  assert.match(html, /Обзор учебного плана/);
  assert.match(html, /Минимальный балл раздела/);
  assert.match(html, /<dd>50<\/dd>/);
  assert.match(html, /Магистратура.*наук.*данных/i);
  assert.match(html, /Untranslated source/);
  setLanguage("eng", { emit: false });
  assert.match(renderAdmissionsValue({ curriculum_summary: "Source" }), /Curriculum summary/);
});

test("Russian NU source facts render their available narrative translations", () => {
  const originals = new Set(["TOEFL iBT Home Edition", "IELTS Indicator", "TOEFL Home Edition", "Academic IELTS"]);
  const texts = new Set();
  const collect = value => {
    if (typeof value === "string" && value.length > 12 && value.includes(" ") && !/^(?:https?:|nu-)/.test(value) && !originals.has(value)) texts.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  for (const fact of nu.facts) for (const key of ["value", "conditions", "conditions_and_exceptions", "exceptions"]) collect(fact[key]);
  setLanguage("rus", { emit: false });
  const missing = [...texts].filter(text => !/[а-яё]/iu.test(renderAdmissionsValue(text)));
  const missingSources = nu.sources.map(source => source.title).filter(title => !/[а-яё]/iu.test(translateFactSource(title)));
  setLanguage("eng", { emit: false });
  assert.deepEqual(missing, []);
  assert.deepEqual(missingSources, []);
});

test("Russian NU structured fact labels remain readable", () => {
  const keys = new Set();
  const collect = value => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => { keys.add(key); collect(entry); });
  };
  for (const fact of nu.facts) for (const key of ["value", "conditions", "conditions_and_exceptions", "exceptions"]) collect(fact[key]);
  for (const row of [...nu.facts, ...nu.unknowns]) collect(row.scope?.additional_dimensions);
  setLanguage("rus", { emit: false });
  const officialLabels = new Set(["A_level_NIS", "A_Level_NIS", "TOEFL_iBT", "toefl_ibT", "TOEFL_iBT_0_120", "gre", "GRE", "GMAT", "PhD"]);
  const missing = [...keys].filter(key => {
    const label = renderAdmissionsValue({ [key]: 1 }).match(/<dt>(.*?)<\/dt>/)?.[1];
    return label && !officialLabels.has(key) && !/[а-яё]/iu.test(label) && !/^(?:[A-Z\d/ .+-]+|IELTS Academic)$/u.test(label);
  });
  setLanguage("eng", { emit: false });
  assert.deepEqual(missing, []);
});

test("Russian NU scope descriptions render without English fallback", () => {
  const texts = new Set();
  const collect = value => {
    if (typeof value === "string" && value.length > 12 && value.includes(" ") && !/^(?:https?:|nu-)/.test(value)) texts.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.entries(value).filter(([key]) => !/(?:^|_)(?:ids?|refs?)$/.test(key)).forEach(([, entry]) => collect(entry));
  };
  for (const row of [...nu.facts, ...nu.unknowns]) collect(row.scope?.additional_dimensions);
  setLanguage("rus", { emit: false });
  const missing = [...texts].filter(text => !/[а-яё]/iu.test(renderAdmissionsValue(text)));
  setLanguage("eng", { emit: false });
  assert.deepEqual(missing, []);
});

test("NU deadline event names use Russian labels while English keeps source labels", () => {
  const names = new Set(nu.facts.flatMap(fact => (fact.attributes?.deadline_events || []).map(event => event.label).filter(Boolean)));
  setLanguage("rus", { emit: false });
  for (const name of names) assert.match(admissionsCycleLabel(name), /[а-яё]/iu, name);
  assert.match(admissionDeadlineTitle({ kind: "application", name: "paid_prior_visa / MCAT" }), /Платное обучение.*MCAT/);
  setLanguage("eng", { emit: false });
  assert.equal(admissionsCycleLabel("paid_prior_visa / MCAT"), "paid_prior_visa / MCAT");
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
