import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async (url) => {
  const target = String(url || "").split("?")[0];
  if (target.endsWith("Localization/eng")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  if (target.endsWith("Localization/ru")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { getProgramLevelKeys, renderProgramCoverage, renderProgramsSection, resolveDisplayedCoverageProgram, resolveProgramByIdentifier, resolveProgramByName, resolveProgramCoverage } = await import("../../frontend/javascript/pages/university/render-content.js");
const { renderAdmissionsContext } = await import("../../frontend/javascript/pages/university/admissions-render.js");
await initI18n();

const admissionsCatalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
const acceptedInstitutions = Object.fromEntries(admissionsCatalog.institutions.map(row => [row.institution.id, row]));
const universitiesCatalog = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));

function acceptedContext(institutionId, optionId, routeId, factIds) {
  const institution = acceptedInstitutions[institutionId];
  const option = institution.study_options.find(row => row.id === optionId);
  const route = institution.application_routes.find(row => row.id === routeId);
  const facts = factIds.map(id => institution.facts.find(row => row.id === id));
  const domains = { study_content: "study", application_process: "application", costs: "costs", degree_completion: "degree_completion" };
  const fact_groups = {};
  for (const fact of facts) {
    const domain = domains[fact.topic] || "other";
    (fact_groups[domain] ||= []).push(fact.id);
  }
  const sourceIds = new Set([...option.source_ids, ...route.source_ids, ...facts.flatMap(fact => fact.source_ids || [])]);
  return {
    selected_option: option,
    selected_route: route,
    facts,
    fact_groups,
    sources: institution.sources.filter(source => sourceIds.has(source.id)),
    reference_labels: Object.fromEntries(institution.study_options.map(row => [row.id, row.title])),
  };
}

function assertHasExactHref(html, expectedUrl) {
  assert.ok([...html.matchAll(/(?:^|\s)href="([^"]+)"/g)].some(([, href]) => href === expectedUrl));
}

test("official source assertions require an exact href attribute", () => {
  assert.throws(() => assertHasExactHref(
    '<a href="https://example.edu/fees/extra">',
    "https://example.edu/fees/",
  ));
  assert.throws(() => assertHasExactHref(
    '<a data-href="https://example.edu/fees/">',
    "https://example.edu/fees/",
  ));
});

test("MBA level does not depend on the translated program name", () => {
  const base = { study_levels: ["Master"], degree_type: "MBA + SM" };
  assert.deepEqual(getProgramLevelKeys({ ...base, name: "Leaders for Global Operations dual degree" }), ["mba"]);
  assert.deepEqual(getProgramLevelKeys({ ...base, name: "Двойная степень Leaders for Global Operations (MBA и SM)" }), ["mba"]);
});

test("accepted MIT study facts keep curriculum separate from institution-wide admission and link official sources", () => {
  const context = acceptedContext("mit-usa-cambridge", "mit-bs-15-2", "mit-first-year", ["mit-bs-15-2-description", "mit-first-year-description"]);
  const option = context.selected_option;
  const route = context.selected_route;
  assert.equal(option.attributes.application.classification, "post_admission_major");
  assert.equal(route.classification, "institution_wide");
  assert.equal(route.target, "MIT undergraduate admission");
  assert.ok(route.option_ids.includes(option.id));

  const html = renderAdmissionsContext(context, { domains: ["study", "application"], includeAssessment: false });
  assert.match(html, /programming, probability and statistics, operations analytics/);
  assert.match(html, /these are degree requirements, not admission prerequisites/);
  assert.match(html, /MIT undergraduate admission/);
  assertHasExactHref(html, "https://catalog.mit.edu/degree-charts/business-analytics-course-15-2/");
  assertHasExactHref(html, "https://mitadmissions.org/apply/firstyear/deadlines-requirements/");
});

test("accepted sparse study fact shows its published selection condition without an invented program summary", () => {
  const context = acceptedContext("mit-usa-cambridge", "mit-bs-3-c", "mit-first-year", ["mit-bs-3-c-selection"]);
  const html = renderAdmissionsContext(context, { domains: ["degree_completion"], includeAssessment: false });
  assert.match(html, /SB in Archaeology and Materials/);
  assert.match(html, /Not external admission prerequisite/);
  assertHasExactHref(html, "https://catalog.mit.edu/degree-charts/archaeology-materials-course-3-c/");
  assert.doesNotMatch(html, /Detailed description not catalogued|specific course description/);
});

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

test("program matching preserves nested parenthetical labels", () => {
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderProgramsSection({
    admissionsData: { programs: [row({ program_name: "-- Data Engineering (Artificial Intelligence (ML)) --" })] },
    container,
    university: {
      id: "test-university",
      academics: { programs: [{ id: "computer-science", name: "Computer Science (Artificial Intelligence (ML))", study_levels: ["Bachelor"] }] },
    },
  });

  assert.notEqual(container.innerHTML.indexOf('class="program-signal__row"'), -1);
  assert.doesNotMatch(container.innerHTML, /program-signal--residual/);
});

test("accepted undergraduate costs remain scoped to the shared institutional route, not the selected program", () => {
  const context = acceptedContext("mit-usa-cambridge", "mit-bs-15-2", "mit-first-year", ["undergraduate-budget-2026-27"]);
  const cost = context.facts[0];
  assert.deepEqual(cost.scope.option_ids, []);
  assert.ok(cost.scope.route_ids.includes(context.selected_route.id));
  assert.equal(context.selected_route.classification, "institution_wide");

  const html = renderAdmissionsContext(context, { domains: ["costs"], includeAssessment: false });
  assert.match(html, /MIT undergraduate admission/);
  assert.match(html, /Academic year/);
  assert.match(html, /USD/);
  assertHasExactHref(html, "https://sfs.mit.edu/cost-of-attendance-class-of-2030/");
  assert.doesNotMatch(html, /Business Analytics|Course 15-2|program-specific price/i);
});

test("route-wide and institution-wide facts have localized scope labels", () => {
  const route = row({ requirements: { status: "available", scope: "route_wide" } });
  const institution = row({ requirements: { status: "available", scope: "institution_wide" } });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  assert.match(renderProgramCoverage([route], program), /Route-wide/);
  assert.match(renderProgramCoverage([institution], program), /Institution-wide/);

  setLanguage("ru", { persist: false, emit: false });
  assert.match(renderProgramCoverage([route], program), /Данные относятся ко всему маршруту поступления/);
  assert.match(renderProgramCoverage([institution], program), /Данные относятся ко всему университету/);
  setLanguage("eng", { persist: false, emit: false });
});

test("structured Home price facts show localized fee status, period, currency, and source metadata", () => {
  const priced = row({
    tuition_mandatory_fees: {
      status: "available",
      scope: "route_wide",
      values: { tuition_home_academic_year_gbp: 10050, currency: "GBP" },
      price_facts: [{
        kind: "tuition",
        amount: 10050,
        currency: "GBP",
        period: "academic_year",
        fee_status: "home",
      }],
      cycle: "2027-28",
      source_url: "https://uni.example/fees",
      verified_at: "2026-09-24",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([priced], program);
  assert.match(english, /Route-wide/);
  assert.match(english, /Tuition · Home fee status · per academic year: GBP 10[\s,]050/);
  assert.doesNotMatch(english, /Overseas|tuition_home_academic_year_gbp/);
  assert.match(english, /2027[-‐‑‒–—−]28/);
  assert.match(english, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  assert.match(english, /https:\/\/uni\.example\/fees/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([priced], program);
  assert.match(russian, /Домашний тариф · за учебный год/);
  assert.match(russian, /GBP\s+10[\s,]050/);
  assert.doesNotMatch(russian, /Overseas|tuition_home_academic_year_gbp/);
  assert.match(russian, /2027[-‐‑‒–—−]28/);
  assert.match(russian, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  setLanguage("eng", { persist: false, emit: false });
});

test("Stanford structured tuition distinguishes every unit-load price basis in English and Russian", () => {
  const stanford = row({
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      price_facts: [
        { kind: "tuition", amount: 15100, currency: "USD", period: "quarter", quantity_basis: "8_10_units", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 23239, currency: "USD", period: "quarter", quantity_basis: "11_18_units", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 1549, currency: "USD", period: "credit", quantity_basis: "above_18_units", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 1510, currency: "USD", period: "credit", quantity_basis: "summer_1_7_units", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 79000, currency: "USD", period: "academic_year", quantity_basis: "first_year", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 80000, currency: "USD", period: "academic_year", quantity_basis: "second_year", fee_status: "same_all_statuses" },
        { kind: "tuition", amount: 2300, currency: "USD", period: "credit", quantity_basis: "12_20_units", fee_status: "same_all_statuses" },
      ],
      cycle: "2026-27",
      source_url: "https://uni.example/tuition",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([stanford], program);
  assert.match(english, /per quarter · 8–10 units: USD 15,100/);
  assert.match(english, /per quarter · 11–18 units: USD 23,239/);
  assert.match(english, /per credit · above 18 units: USD 1,549/);
  assert.match(english, /per credit · summer, 1–7 units: USD 1,510/);
  assert.match(english, /first year: USD 79,000/);
  assert.match(english, /second year: USD 80,000/);
  assert.match(english, /per credit · 12–20 units: USD 2,300/);
  assert.doesNotMatch(english, /quantity_basis|8_10_units|above_18_units/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([stanford], program);
  assert.match(russian, /за квартал · нагрузка 8–10 учебных единиц/);
  assert.match(russian, /за квартал · нагрузка 11–18 учебных единиц/);
  assert.match(russian, /за учебный кредит · нагрузка более 18 учебных единиц/);
  assert.match(russian, /за учебный кредит · летом, нагрузка 1–7 учебных единиц/);
  assert.match(russian, /первый год обучения: USD 79[\s,]000/);
  assert.match(russian, /второй год обучения: USD 80[\s,]000/);
  assert.match(russian, /за учебный кредит · нагрузка 12–20 учебных единиц/);
  assert.doesNotMatch(russian, /quantity_basis|8_10_units|above_18_units/);
  setLanguage("eng", { persist: false, emit: false });
});

test("an unpublished course deadline keeps its official status and source metadata", () => {
  const unpublished = row({
    deadline: {
      status: "not_catalogued",
      publication_status: "not_yet_published",
      publication_facts: [{ publication_status: "not_yet_published" }],
      scope: "program_specific",
      values: [],
      cycle: "Fall 2027 entry",
      source_url: "https://uni.example/deadlines",
      verified_at: "2026-09-24",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([unpublished], program);
  const deadlineStart = english.indexOf('data-coverage-kind="deadline"');
  const costStart = english.indexOf('data-coverage-kind="cost"');
  const englishDeadline = english.slice(deadlineStart, costStart);
  assert.match(englishDeadline, /Not yet published by the university/);
  assert.doesNotMatch(englishDeadline, /Not catalogued/);
  assert.match(englishDeadline, /Check the official admissions page for updates to the deadline/);
  assert.match(englishDeadline, /Fall 2027 entry/);
  assert.match(englishDeadline, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  assert.match(englishDeadline, /https:\/\/uni\.example\/deadlines/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([unpublished], program);
  const russianDeadlineStart = russian.indexOf('data-coverage-kind="deadline"');
  const russianCostStart = russian.indexOf('data-coverage-kind="cost"');
  const russianDeadline = russian.slice(russianDeadlineStart, russianCostStart);
  assert.match(russianDeadline, /Университет ещё не опубликовал срок/);
  assert.doesNotMatch(russianDeadline, /Нет данных в каталоге/);
  assert.match(russianDeadline, /Следите за обновлениями срока на официальной странице приёма/);
  assert.match(russianDeadline, /Поступление осенью 2027 года/);
  assert.match(russianDeadline, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  setLanguage("eng", { persist: false, emit: false });
});

test("an unpublished additional round does not hide published course deadline values", () => {
  const mixed = row({
    deadline: {
      status: "exact_dated",
      publication_facts: [{ publication_status: "not_yet_published", round: "Round 2" }],
      scope: "program_specific",
      values: [{ date: "2026-12-02", round: 1 }],
      cycle: "2027 entry",
      source_url: "https://uni.example/deadlines",
      verified_at: "2026-09-24",
    },
  });
  const html = renderProgramCoverage([mixed], { id: "p1", name: "Selected Program" });
  const deadlineStart = html.indexOf('data-coverage-kind="deadline"');
  const costStart = html.indexOf('data-coverage-kind="cost"');
  const deadline = html.slice(deadlineStart, costStart);

  assert.match(deadline, /Published dated course deadline/);
  assert.doesNotMatch(deadline, /Not yet published by the university/);
  assert.match(deadline, /2026[-‐‑‒–—−]12[-‐‑‒–—−]02 · Round 1/);
});

test("conflicting deadline publication shows a localized status and official follow-up without a date", () => {
  const conflicting = row({
    deadline: {
      status: "not_catalogued",
      publication_status: "conflicting",
      publication_facts: [{ publication_status: "conflicting" }],
      scope: "program_specific",
      values: [],
      cycle: "Fall 2027 entry",
      source_url: "https://uni.example/deadlines",
      verified_at: "2026-09-24",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([conflicting], program);
  const englishDeadline = english.slice(english.indexOf('data-coverage-kind="deadline"'), english.indexOf('data-coverage-kind="cost"'));
  assert.match(englishDeadline, /Official deadline information conflicts/);
  assert.match(englishDeadline, /Compare the official admissions pages and confirm the applicable deadline/);
  assert.match(englishDeadline, /Fall 2027 entry/);
  assert.match(englishDeadline, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  assert.match(englishDeadline, /https:\/\/uni\.example\/deadlines/);
  assert.doesNotMatch(englishDeadline, /program-coverage__values/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([conflicting], program);
  const russianDeadline = russian.slice(russian.indexOf('data-coverage-kind="deadline"'), russian.indexOf('data-coverage-kind="cost"'));
  assert.match(russianDeadline, /Официальные сведения о сроке подачи расходятся/);
  assert.match(russianDeadline, /Сравните официальные страницы приёма и уточните подходящий срок/);
  assert.doesNotMatch(russianDeadline, /program-coverage__values/);
  setLanguage("eng", { persist: false, emit: false });
});

test("saved legacy course number and current program ID both resolve to the same program", () => {
  const migrated = { id: "mit-course-6-3-bachelor", course_number: "Course 6-3", name: "Computer Science and Engineering" };
  const programs = [migrated];

  assert.equal(resolveProgramByIdentifier(programs, "Course 6-3"), migrated);
  assert.equal(resolveProgramByIdentifier(programs, "mit-course-6-3-bachelor"), migrated);
  assert.equal(resolveProgramByIdentifier(programs, "unknown"), null);
});

test("a saved program name still resolves when a migrated program has no matching legacy ID", () => {
  const migrated = { id: "harvard-cs-concentration", name: "Computer Science" };
  const programs = [migrated];

  assert.equal(resolveProgramByName(programs, "Computer Science"), migrated);
  assert.equal(resolveProgramByName(programs, "Computer Science, Harvard College"), null);
  assert.equal(resolveProgramByName(programs, "Computer Science, Harvard College", { allowPartial: true }), migrated);
});

test("ambiguous legacy Harvard program names do not select the first new route", () => {
  const programs = [
    { id: "harvard-gsd-march-i", name: "Architecture (MArch I)" },
    { id: "harvard-gsd-march-ii", name: "Architecture (MArch II)" },
    { id: "harvard-chan-mph-45", name: "Public Health (MPH-45, residential)" },
    { id: "harvard-chan-mph-65", name: "Public Health (MPH-65, residential)" },
    { id: "harvard-chan-mph-generalist", name: "Public Health (MPH-Generalist, online/part-time)" },
  ];

  assert.equal(resolveProgramByName(programs, "Architecture (MArch)", { allowPartial: true }), null);
  assert.equal(resolveProgramByName(programs, "Public Health (MPH)", { allowPartial: true }), null);
  assert.equal(resolveProgramByName(programs, "Architecture (MArch II)"), programs[1]);
  assert.equal(resolveProgramByName(programs, "Public Health (MPH-65, residential)"), programs[3]);
});

test("an unpublished Imperial Home fee stays unknown while the published Overseas fee remains scoped", () => {
  const imperial = row({
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      values: { tuition_overseas_academic_year_gbp: 43000, currency: "GBP" },
      price_facts: [{ kind: "tuition", amount: 43000, currency: "GBP", period: "academic_year", fee_status: "overseas", publication_status: "published" }],
      publication_status: "not_yet_published",
      publication_facts: [{ kind: "tuition", currency: "GBP", period: "academic_year", fee_status: "home", publication_status: "not_yet_published", cycle: "2027-28", source_url: "https://uni.example/fees", verified_at: "2026-09-24" }],
      historical_legacy_values: { values: { tuition_home_academic_year_gbp: 10050 }, currency: "GBP", cycle: "2026-27" },
      cycle: "2027-28",
      source_url: "https://uni.example/fees",
      verified_at: "2026-09-24",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([imperial], program);
  const englishCost = english.slice(english.indexOf('data-coverage-kind="cost"'), english.indexOf('data-coverage-kind="awards"'));
  assert.match(englishCost, /Tuition · Home fee status · per academic year: Current fee not yet published \(GBP\)/);
  assert.match(englishCost, /Tuition · Overseas fee status · per academic year: GBP 43,000/);
  assert.match(englishCost, /2027[-‐‑‒–—−]28/);
  assert.match(englishCost, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  assert.match(englishCost, /https:\/\/uni\.example\/fees/);
  assert.doesNotMatch(englishCost, /10,050|2026[-‐‑‒–—−]27/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([imperial], program);
  const russianCost = russian.slice(russian.indexOf('data-coverage-kind="cost"'), russian.indexOf('data-coverage-kind="awards"'));
  assert.match(russianCost, /Стоимость обучения · Домашний тариф · за учебный год: Текущий тариф ещё не опубликован \(GBP\)/);
  assert.match(russianCost, /Зарубежный тариф · за учебный год: GBP\s+43[\s,]000/);
  assert.doesNotMatch(russianCost, /10[\s,]050/);
  setLanguage("eng", { persist: false, emit: false });
});

test("conflicting Imperial fee publication shows scope and source without hiding another published fee status", () => {
  const imperial = row({
    tuition_mandatory_fees: {
      status: "available",
      scope: "program_specific",
      publication_status: "conflicting",
      values: { tuition_overseas_academic_year_gbp: 43000, currency: "GBP" },
      price_facts: [{ kind: "tuition", amount: 43000, currency: "GBP", period: "academic_year", fee_status: "overseas", publication_status: "published" }],
      publication_facts: [{ kind: "tuition", currency: "GBP", period: "academic_year", fee_status: "home", publication_status: "conflicting" }],
      historical_legacy_values: { values: { tuition_home_academic_year_gbp: 10050 }, currency: "GBP", cycle: "2026-27" },
      cycle: "2027-28",
      source_url: "https://uni.example/fees",
      verified_at: "2026-09-24",
    },
  });
  const program = { id: "p1", name: "Selected Program" };

  setLanguage("eng", { persist: false, emit: false });
  const english = renderProgramCoverage([imperial], program);
  const englishCost = english.slice(english.indexOf('data-coverage-kind="cost"'), english.indexOf('data-coverage-kind="awards"'));
  assert.match(englishCost, /Official fee information conflicts/);
  assert.match(englishCost, /Compare the official fee pages and confirm the applicable rate/);
  assert.match(englishCost, /Tuition · Home fee status · per academic year: Official fee information conflicts \(GBP\)/);
  assert.match(englishCost, /Tuition · Overseas fee status · per academic year: GBP 43,000/);
  assert.match(englishCost, /2027[-‐‑‒–—−]28/);
  assert.match(englishCost, /2026[-‐‑‒–—−]09[-‐‑‒–—−]24/);
  assert.match(englishCost, /https:\/\/uni\.example\/fees/);
  assert.doesNotMatch(englishCost, /10,050|2026[-‐‑‒–—−]27/);

  setLanguage("ru", { persist: false, emit: false });
  const russian = renderProgramCoverage([imperial], program);
  const russianCost = russian.slice(russian.indexOf('data-coverage-kind="cost"'), russian.indexOf('data-coverage-kind="awards"'));
  assert.match(russianCost, /Официальные сведения о стоимости расходятся/);
  assert.match(russianCost, /Сравните официальные страницы со стоимостью и уточните подходящий тариф/);
  assert.match(russianCost, /Домашний тариф · за учебный год: Официальные сведения о стоимости расходятся \(GBP\)/);
  assert.match(russianCost, /Зарубежный тариф · за учебный год: GBP\s+43[\s,]000/);
  assert.doesNotMatch(russianCost, /10[\s,]050/);
  setLanguage("eng", { persist: false, emit: false });
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

test("renderProgramsSection formats program details, level filter, search filter, and signals", () => {
  const container = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const university = {
    id: "oxford-uk",
    academics: {
      programs: [
        {
          id: "cs-1",
          name: "MSc in Computer Science",
          study_levels: ["master"],
          duration: "1 year",
          language: ["English"],
          study_mode: "Full-time",
          acceptance_rate_percent: 15,
          major_tags: ["Computer Science", "Software"],
          tuition_year_usd: 35000,
          description: "Advanced study of computer science principles.",
          source_url: "https://www.ox.ac.uk/cs",
          catalog_url: "https://www.ox.ac.uk/catalog/cs",
        },
      ],
      majors: ["Computer Science"],
    },
    coverage_by_program: [],
  };
  const admissionsData = {
    programs: [
      {
        program_name: "MSc in Computer Science",
        provenance: { verified_at: "2026-01-01" },
      },
    ],
    program_level: { kind: "program_specific" },
  };

  renderProgramsSection({
    admissionsData,
    container,
    university,
    profileMajor: "Computer Science",
    coverageProgram: null,
  });

  assert.ok(container.innerHTML.includes("MSc in Computer Science"));
  assert.match(container.innerHTML, /<form class="admissions-programs__toolbar admissions-programs__toolbar--catalog" data-program-search-form>/);
  assert.match(container.innerHTML, /<label for="program-search-input">Study option or subject<\/label>/);
  assert.match(container.innerHTML, /data-program-search-submit/);
  assert.ok(container.innerHTML.includes("Advanced study of computer science principles."));
  assert.ok(container.innerHTML.includes("Software"));
  const essentials = container.innerHTML.match(/<dl class="program-card-rows admissions-programs__essentials">([\s\S]*?)<\/dl>/)?.[1];
  assert.ok(essentials);
  assert.doesNotMatch(essentials, /program-tag|program-pill/);
  assert.match(essentials, /<dd class="program-card-value">/);
  assert.ok(container.innerHTML.includes("35 000") || container.innerHTML.includes("35,000") || container.innerHTML.includes("USD"));
  assert.ok(container.innerHTML.includes("15%"));
});

test("every other catalog university renders selectable cards from its stored programs", () => {
  const reviewed = new Set(["mit-usa-cambridge", "imperial-college-london-uk", "stanford-university-usa-ca"]);
  const institutions = universitiesCatalog.filter((university) => !reviewed.has(university.id));
  assert.equal(institutions.length, 47);
  for (const university of institutions) {
    const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
    renderProgramsSection({ admissionsData: {}, container, university });
    const count = (container.innerHTML.match(/<article class="program-card/g) || []).length;
    assert.ok(count > 0 && count <= university.academics.programs.length, university.id);
    assert.equal((container.innerHTML.match(/data-program-admission=/g) || []).length, count, university.id);
    assert.ok(container.innerHTML.includes("Subjects"), university.id);
    assert.doesNotMatch(container.innerHTML, /A detailed summary is not yet catalogued/, university.id);
  }
});

test("renderProgramsSection with no programs fallback renders majors list", () => {
  const container = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const university = {
    id: "test-uni",
    academics: {
      programs: [],
      majors: ["Engineering", "Mathematics"],
    },
  };

  renderProgramsSection({
    admissionsData: {},
    container,
    university,
  });

  assert.ok(container.innerHTML.includes("program-major-chip"));
  assert.ok(container.innerHTML.includes("Engineering"));
  assert.ok(container.innerHTML.includes("Mathematics"));
});


test("renderProgramsSection binds card toggles, level filters, admission action and search events", () => {
  let eventListeners = {};
  const mockInput = {
    value: "Computer",
    addEventListener: (event, handler) => { eventListeners[event] = handler; },
    focus: () => {},
  };
  const mockClearBtn = {
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    addEventListener: (event, handler) => { eventListeners["clear_" + event] = handler; },
  };
  const mockCard1 = {
    getAttribute: (attr) => attr === "data-search" ? "msc computer science" : (attr === "data-program-key" ? "key-1" : null),
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    classList: { contains: () => false, toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => null,
  };
  const mockCard2 = {
    getAttribute: (attr) => attr === "data-search" ? "ba history" : (attr === "data-program-key" ? "key-2" : null),
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    classList: { contains: () => false, toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => null,
  };
  const mockToggleBtn1 = {
    closest: () => mockCard1,
    getAttribute: () => null,
    setAttribute: () => {},
      querySelectorAll: () => [],
    addEventListener: (event, handler) => { eventListeners["toggle_1_" + event] = handler; },
  };
  const mockAdmissionBtn = {
    dataset: { programAdmission: "cs-1" },
    addEventListener: (event, handler) => { eventListeners["admission_" + event] = handler; },
  };
  const mockLevelBtn = {
    getAttribute: () => "master",
    addEventListener: (event, handler) => { eventListeners["level_" + event] = handler; },
  };

  const container = {
    innerHTML: "",
    querySelector: (sel) => {
      if (sel === "[data-program-search]") return mockInput;
      if (sel === "[data-program-search-clear]") return mockClearBtn;
      if (sel === "[data-program-empty]") return { setAttribute: () => {},
      querySelectorAll: () => [], removeAttribute: () => {} };
      if (sel === "[data-program-coverage-host]") return { innerHTML: "" };
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === ".program-card") return [mockCard1, mockCard2];
      if (sel === ".program-card.is-open") return [];
      if (sel === "[data-program-toggle]") return [mockToggleBtn1];
      if (sel === "[data-program-admission]") return [mockAdmissionBtn];
      if (sel === "[data-program-level]") return [mockLevelBtn];
      return [];
    },
  };

  const university = {
    id: "oxford-uk",
    academics: {
      programs: [
        {
          id: "cs-1",
          name: "MSc in Computer Science",
          study_levels: ["master"],
          duration: "1 year",
          language: ["English"],
          study_mode: "Full-time",
          acceptance_rate_percent: 15,
          major_tags: ["Computer Science"],
          boolean_field: true,
          false_field: false,
          null_field: null,
          empty_arr: [],
          tuition_usd: 35000,
          description: "Advanced study of computer science principles.",
          source_url: "https://www.ox.ac.uk/cs",
          catalog_url: "https://www.ox.ac.uk/catalog/cs",
        },
        {
          id: "cs-2",
          name: "BA in History",
          study_levels: ["bachelor"],
          duration: "3 years",
          language: "English",
          study_mode: "Full-time",
        }
      ],
    },
    coverage_by_program: [],
  };

  const admissionsData = {
    programs: [
      {
        program_name: "MSc in Computer Science",
        provenance: { verified_at: "2026-01-01" },
      },
      {
        program_name: "BA in History (Honours)",
      },
      {
        program_name: "Non Existent Program (Special (Track))",
      }
    ],
    program_level: { kind: "program_specific" },
  };

  let admissionSelected = false;
  renderProgramsSection({
    admissionsData,
    container,
    university,
    profileMajor: "Computer Science",
    coverageProgram: null,
    onProgramAdmissionSelected: () => { admissionSelected = true; },
  });

  if (eventListeners["input"]) eventListeners["input"]();
  if (eventListeners["keydown"]) eventListeners["keydown"]({ key: "Escape" });
  if (eventListeners["clear_click"]) eventListeners["clear_click"]();
  if (eventListeners["toggle_1_click"]) eventListeners["toggle_1_click"]();
  if (eventListeners["admission_click"]) eventListeners["admission_click"]();
  if (eventListeners["level_click"]) eventListeners["level_click"]();

  assert.equal(admissionSelected, true);
});

test("renderProgramsSection search filtering, toggle close, escape key, and profile study level selection", () => {
  let eventListeners = {};
  const mockInput = {
    value: "NonMatchingSearchTermQuery",
    addEventListener: (event, handler) => { eventListeners[event] = handler; },
    focus: () => {},
  };
  const mockClearBtn = {
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    addEventListener: (event, handler) => { eventListeners["clear_" + event] = handler; },
  };
  const mockSearchEmpty = {
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
  };
  const mockCard1 = {
    getAttribute: (attr) => attr === "data-search" ? "msc computer science" : (attr === "data-program-key" ? "key-1" : null),
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    classList: {
      _open: true,
      contains: (c) => c === "is-open" ? mockCard1.classList._open : false,
      toggle: (c, val) => { mockCard1.classList._open = val; },
      add: () => {},
      remove: () => {},
    },
    querySelector: () => null,
  };
  const mockCard2 = {
    getAttribute: (attr) => attr === "data-search" ? "ba history" : (attr === "data-program-key" ? "key-2" : null),
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    classList: { contains: () => false, toggle: () => {}, add: () => {}, remove: () => {} },
    querySelector: () => null,
  };
  const mockToggleBtn1 = {
    closest: () => mockCard1,
    getAttribute: () => null,
    setAttribute: () => {},
      querySelectorAll: () => [],
    addEventListener: (event, handler) => { eventListeners["toggle_1_" + event] = handler; },
  };

  const container = {
    innerHTML: "",
    querySelector: (sel) => {
      if (sel === "[data-program-search]") return mockInput;
      if (sel === "[data-program-search-clear]") return mockClearBtn;
      if (sel === "[data-program-empty]") return mockSearchEmpty;
      if (sel === "[data-program-coverage-host]") return { innerHTML: "" };
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === ".program-card") return [mockCard1, mockCard2];
      if (sel === ".program-card.is-open") return [mockCard1];
      if (sel === "[data-program-toggle]") return [mockToggleBtn1];
      return [];
    },
  };

  const university = {
    id: "oxford-uk-2",
    academics: {
      programs: [
        {
          id: "cs-1",
          name: "MSc in Computer Science",
          study_levels: ["master"],
        },
        {
          id: "hist-1",
          name: "BA in History",
          study_levels: ["bachelor"],
        },
      ],
    },
  };

  renderProgramsSection({
    admissionsData: {},
    container,
    university,
  });

  if (eventListeners["input"]) eventListeners["input"]();
  if (eventListeners["keydown"]) eventListeners["keydown"]({ key: "Escape" });
  if (eventListeners["toggle_1_click"]) eventListeners["toggle_1_click"]();
});

test("renderProgramsSection selects profile study level when activeLevelStored is not set", () => {
  const container = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const university = {
    id: "oxford-uk-profile-level-test",
    academics: {
      programs: [
        {
          id: "cs-master",
          name: "MSc in Computer Science",
          study_levels: ["master"],
        },
        {
          id: "history-bachelor",
          name: "BA in History",
          study_levels: ["bachelor"],
        },
      ],
    },
  };

  const originalStorage = window.localStorage;
  window.localStorage = {
    getItem: (key) => key === "unisearch_profile" ? JSON.stringify({ studyLevel: "master" }) : null,
    setItem: () => {},
    removeItem: () => {},
  };
  try {
    renderProgramsSection({
      admissionsData: {},
      container,
      university,
    });

    assert.match(container.innerHTML, /class="programs-level-tab is-active" data-program-level="master"/);
    assert.equal((container.innerHTML.match(/<article class="program-card/g) || []).length, 1);
  } finally {
    if (originalStorage === undefined) delete window.localStorage;
    else window.localStorage = originalStorage;
  }
});


test("formatProgramValue, formatListValue, and renderValueCell handling of custom fields and types", () => {
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  const university = {
    id: "oxford-uk-coverage-boost",
    academics: {
      programs: [
        {
          id: "prog-boost-1",
          name: "MSc in Artificial Intelligence",
          study_levels: ["master"],
          language: ["English", "French"],
          study_mode: "Full-time",
          acceptance_rate_percent: "invalid-number",
          custom_bool: false,
          custom_text: "Some custom text value",
          custom_null: null,
          custom_empty: "",
          custom_arr: [],
          required_documents: ["CV", "Passport"],
        },
      ],
    },
  };

  renderProgramsSection({
    admissionsData: {},
    container,
    university,
  });

  assert.ok(container.innerHTML.includes("MSc in Artificial Intelligence"));
  assert.ok(container.innerHTML.includes("Some custom text value"));
});

test("renderProgramsSection validates official program URLs and does not render them as fields", () => {
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  const university = {
    id: "test-uni",
    academics: {
      programs: [{
        name: "MSc in Computer Science",
        source_url: "javascript:alert(1)",
        catalog_url: "javascript:alert(2)",
      }],
    },
  };

  renderProgramsSection({ admissionsData: {}, container, university });

  assert.doesNotMatch(container.innerHTML, /href="javascript:/i);
  assert.doesNotMatch(container.innerHTML, /Catalog Url/);
});

test("a general source URL keeps its general source label", () => {
  const container = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  renderProgramsSection({
    admissionsData: {},
    container,
    university: {
      id: "source-label-test",
      academics: { programs: [{ name: "Computer Science", source_url: "https://example.edu/admissions" }] },
    },
  });

  assert.match(container.innerHTML, /href="https:\/\/example\.edu\/admissions"[^>]*>Official source/);
  assert.doesNotMatch(container.innerHTML, /Official program page/);
});

test("renderProgramsSection residual signal rows and program-level filters", () => {
  const container = {
    innerHTML: "",
    querySelector: (sel) => sel === "[data-program-coverage-host]" ? { innerHTML: "" } : null,
    querySelectorAll: () => [],
  };
  const university = {
    id: "oxford-uk-residual-test",
    academics: {
      programs: [
        {
          id: "prog-1",
          name: "Bachelor of Arts in Philosophy",
          study_levels: ["bachelor"],
        },
        {
          id: "prog-2",
          name: "MSc in Physics",
          study_levels: ["master"],
        },
      ],
    },
    coverage_by_program: [],
  };
  const admissionsData = {
    programs: [
      {
        program_name: "Unmatched Doctoral Program",
        provenance: { verified_at: "2026-02-01" },
      },
    ],
    status_date: "2026-02-01",
    program_level: { kind: "institution_wide_only" },
  };

  renderProgramsSection({
    admissionsData,
    container,
    university,
  });

  assert.ok(container.innerHTML.includes("program-signal--residual"));
  assert.ok(container.innerHTML.includes("Unmatched Doctoral Program"));
  assert.ok(container.innerHTML.includes("programs-level-filter"));
});

test("comprehensive unit tests for renderProgramsSection extracted helpers", () => {
  let eventListeners = {};
  let focusedInput = false;

  const mockInput = {
    value: "SearchQuery",
    addEventListener: (event, handler) => { eventListeners["input_" + event] = handler; },
    focus: () => { focusedInput = true; },
  };
  const mockClearBtn = {
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
    addEventListener: (event, handler) => { eventListeners["clear_" + event] = handler; },
  };
  const mockSearchEmpty = {
    removeAttribute: () => {},
    setAttribute: () => {},
      querySelectorAll: () => [],
  };

  const createCard = (key, search, isOpen = false) => {
    const card = {
      key,
      search,
      isOpen,
      classList: {
        contains: (cls) => cls === "is-open" ? card.isOpen : false,
        toggle: (cls, val) => { card.isOpen = val; },
        add: () => {},
        remove: () => {},
      },
      getAttribute: (attr) => attr === "data-search" ? card.search : (attr === "data-program-key" ? card.key : null),
      setAttribute: () => {},
      querySelectorAll: () => [],
      removeAttribute: () => {},
      querySelector: (sel) => {
        if (sel === ".program-card__title") return { textContent: "Program Title" };
        if (sel === ".program-card__body") return body;
        if (sel === "[data-program-toggle]") return toggleBtn;
        return null;
      },
    };
    const body = {
      classList: { remove: () => {}, add: () => {} },
      setAttribute: () => {},
      querySelectorAll: () => [],
      removeAttribute: () => {},
    };
    const toggleBtn = {
      closest: () => card,
      getAttribute: () => null,
      setAttribute: () => {},
      querySelectorAll: () => [],
      addEventListener: (event, handler) => { eventListeners["toggle_" + key + "_" + event] = handler; },
    };
    return { card, body, toggleBtn };
  };

  const card1Info = createCard("c1", "msc computer science", true);
  const card2Info = createCard("c2", "ba history", false);

  const mockAdmissionBtn = {
    dataset: { programAdmission: "p1" },
    addEventListener: (event, handler) => { eventListeners["admission_" + event] = handler; },
  };
  const mockLevelBtn = {
    getAttribute: () => "doctorate",
    addEventListener: (event, handler) => { eventListeners["level_" + event] = handler; },
  };

  const container = {
    innerHTML: "",
    querySelector: (sel) => {
      if (sel === "[data-program-search]") return mockInput;
      if (sel === "[data-program-search-clear]") return mockClearBtn;
      if (sel === "[data-program-empty]") return mockSearchEmpty;
      if (sel === "[data-program-coverage-host]") return { innerHTML: "" };
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === ".program-card") return [card1Info.card, card2Info.card];
      if (sel === ".program-card.is-open") return [card1Info.card];
      if (sel === "[data-program-toggle]") return [card1Info.toggleBtn, card2Info.toggleBtn];
      if (sel === "[data-program-admission]") return [mockAdmissionBtn];
      if (sel === "[data-program-level]") return [mockLevelBtn];
      return [];
    },
  };

  const university = {
    id: "oxford-uk-max-coverage",
    academics: {
      programs: [
        {
          id: "p1",
          name: "MSc in Computer Science (Artificial Intelligence)",
          study_levels: ["master"],
          study_mode: ["full-time"],
          language: ["en"],
          acceptance_rate_percent: 12.34,
          tuition_year_usd: 40000,
          application_fee_gbp: 75,
          boolean_val: true,
          false_val: false,
          null_val: null,
          empty_val: "",
          array_tags: ["AI", "ML"],
          required_documents: ["Transcript"],
          entry_requirements: "High Second Class",
          description: "Full CS master programme",
          source_url: "https://ox.ac.uk/cs",
          catalog_url: "https://ox.ac.uk/catalog",
        },
        {
          id: "p2",
          name: "BA in History",
          study_levels: ["bachelor"],
          study_mode: "part-time",
          duration: "3 years",
          acceptance_rate_percent: "not-a-number",
          major_tags: ["History"],
        },
        {
          id: "p3",
          name: "Doctor of Philosophy (PhD) in Physics",
          study_levels: ["doctorate"],
        },
        {
          id: "p4",
          name: "Master of Business Administration (MBA)",
          study_levels: ["mba"],
        },
        {
          id: "p5",
          name: "Doctor of Medicine (MD)",
          study_levels: ["professional"],
        },
      ],
    },
  };

  const admissionsData = {
    programs: [
      {
        program_name: "MSc in Computer Science (Artificial Intelligence)",
        provenance: { verified_at: "2026-01-01" },
      },
      {
        program_name: "BA in History",
      },
      {
        program_name: "Doctor of Philosophy (PhD) in Physics",
      },
      {
        program_name: "Master of Business Administration (MBA)",
      },
      {
        program_name: "Doctor of Medicine (MD)",
      },
      {
        program_name: "Unmatched Extra Program",
      },
    ],
    status_date: "2026-01-01",
    program_level: { kind: "program_specific" },
  };

  let selectedProgram = null;
  renderProgramsSection({
    admissionsData,
    container,
    university,
    profileMajor: "Computer Science",
    coverageProgram: null,
    onProgramAdmissionSelected: (p) => { selectedProgram = p; },
  });

  // Test event listeners
  if (eventListeners["toggle_c1_click"]) eventListeners["toggle_c1_click"](); // close card 1
  if (eventListeners["toggle_c2_click"]) eventListeners["toggle_c2_click"](); // open card 2
  if (eventListeners["admission_click"]) eventListeners["admission_click"](); // select admission
  if (eventListeners["level_click"]) eventListeners["level_click"](); // level filter
  if (eventListeners["input_input"]) eventListeners["input_input"](); // input search
  if (eventListeners["input_keydown"]) eventListeners["input_keydown"]({ key: "Escape" }); // escape
  if (eventListeners["clear_click"]) eventListeners["clear_click"](); // clear click

  assert.equal(selectedProgram.id, "p1");
  assert.equal(focusedInput, true);
});
