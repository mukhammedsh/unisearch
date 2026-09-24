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
const { renderProgramCoverage, resolveDisplayedCoverageProgram, resolveProgramByIdentifier, resolveProgramByName, resolveProgramCoverage } = await import("../../frontend/javascript/pages/university/render-content.js");
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
  assert.match(russianDeadline, /Fall 2027 entry/);
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
