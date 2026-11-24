import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readAdmissionsCatalog } from "./admissions-catalog-fixture.mjs";

global.fetch = async (url) => {
  const target = String(url || "").split("?")[0];
  if (target.endsWith("Localization/eng")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/eng", import.meta.url), "utf8"); } };
  if (target.endsWith("Localization/ru")) return { ok: true, async text() { return readFile(new URL("../../frontend/Localization/ru", import.meta.url), "utf8"); } };
  return { ok: false, async text() { return ""; } };
};

const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { resolveQualificationGuidance, renderQualificationGuidance } = await import("../../frontend/javascript/pages/university/render-content.js");
const { renderAdmissionsContext } = await import("../../frontend/javascript/pages/university/admissions-render.js");
await initI18n();

const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
const universities = Object.fromEntries(rows.map((row) => [row.id, row]));
const admissionsCatalog = await readAdmissionsCatalog();
const acceptedInstitutions = Object.fromEntries(admissionsCatalog.institutions.map(row => [row.institution.id, row]));

function acceptedContext(institutionId, optionId, routeId, factId) {
  const institution = acceptedInstitutions[institutionId];
  const selected_option = institution.study_options.find(option => option.id === optionId);
  const selected_route = institution.application_routes.find(route => route.id === routeId);
  const fact = institution.facts.find(row => row.id === factId);
  const sourceIds = new Set([...selected_option.source_ids, ...selected_route.source_ids, ...fact.source_ids]);
  return {
    selected_option,
    selected_route,
    facts: [fact],
    fact_groups: { requirements: [fact.id] },
    sources: institution.sources.filter(source => sourceIds.has(source.id)),
    reference_labels: Object.fromEntries(institution.study_options.map(option => [option.id, option.title])),
    assessment: {
      chancePercent: null,
      reason: "unassessed_minimums",
      activeChoice: { details: { checks: [{
        kind: "credential",
        status: "unassessed",
        rule: fact.value,
        sourceRule: fact,
        source_ids: fact.source_ids,
      }] } },
      reportedEvidence: {
        origin: "self_reported",
        institutional_evidence: [{ kind: "enrollment", university_id: institutionId, status: "enrolled" }],
      },
    },
  };
}

test("Oxford guidance lists every published rule and fallback without any personal matching", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const { entries } = resolveQualificationGuidance({ university: oxford });
  assert.deepEqual(
    entries.map((entry) => [entry.id, entry.status, entry.studyLevel]),
    [
      ["oxford-kazakhstan-attestat-undergraduate", "not_accepted", "Bachelor"],
      ["oxford-international-baccalaureate-undergraduate", "accepted", "Bachelor"],
      ["", "needs_review", "Bachelor"],
      ["", "needs_review", "graduate"],
    ],
  );
  assert.equal(entries.length, oxford.qualification_guidance.rules.length + oxford.qualification_guidance.fallbacks.length);
  assert.equal(entries[0].verifiedAt, "2026-09-24");
  assert.match(entries[0].sourceUrl, /^https:\/\/www\.ox\.ac\.uk\//);
  assert.match(entries[1].reason, /course-specific/i);
});

test("Harvard guidance keeps its single rule and both fallbacks in review", () => {
  const { entries } = resolveQualificationGuidance({ university: universities["harvard-usa-cambridge"] });
  assert.equal(entries.length, 3);
  assert.ok(entries.every((entry) => entry.status === "needs_review"));
  assert.ok(entries.every((entry) => /^https:\/\//.test(entry.sourceUrl) || entry.requiresProgramPage));
});

test("resolution ignores whatever a saved profile contains", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  assert.deepEqual(
    resolveQualificationGuidance({ university: oxford, profile: { studyLevel: "Master", applicantRoute: "transfer", countryOfEducation: "KZ", intendedEntryCycle: "2031" } }),
    resolveQualificationGuidance({ university: oxford }),
  );
});

test("accepted MIT and Stanford qualification context stays source-scoped and unassessed", () => {
  const cases = [
    ["mit-usa-cambridge", "mit-course-6-3-bachelor", "mit-first-year", "first-year-foundations-context-not-prescribed-cutoffs", /National\/curricular context assessed/],
    ["stanford-university-usa-ca", "stanford-option-cs-bs", "undergraduate-shared-evidence:stanford-first-year", "undergraduate-shared-evidence:stanford-ug-international-academic-records", /school\/country/],
  ];

  for (const [institutionId, optionId, routeId, factId, sourceText] of cases) {
    const html = renderAdmissionsContext(acceptedContext(institutionId, optionId, routeId, factId), { domains: ["requirements"] });
    assert.match(html, sourceText, institutionId);
    assert.match(html, /Not assessed/, institutionId);
    assert.match(html, /Some conditions cannot be compared with your profile/, institutionId);
    assert.doesNotMatch(html, /<strong>\d+(?:\.\d+)?%<\/strong>/, institutionId);
    assert.match(html, /Applicant evidence is self-reported/, institutionId);
    assert.doesNotMatch(html, /Accepted qualification|Explicitly not accepted/, institutionId);
    assert.match(html, /href="https:\/\//, institutionId);
  }
});

test("graduate qualification guidance asks for a selected official programme page, then links it", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const graduate = (result) => result.entries.find((entry) => entry.requiresProgramPage);
  const noProgram = resolveQualificationGuidance({ university: oxford });
  assert.equal(graduate(noProgram).status, "needs_review");
  assert.equal(graduate(noProgram).reasonKey, "university.qualification_guidance.reason.select_program");
  assert.match(graduate(noProgram).sourceUrl, /^https:\/\/www\.ox\.ac\.uk\/admissions\/graduate\//);

  const program = { id: "msc", name: "MSc Computer Science", study_levels: ["Master"], url: "https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science" };
  const selectedProgram = resolveQualificationGuidance({ university: oxford, program });
  assert.equal(graduate(selectedProgram).reasonKey, "university.qualification_guidance.reason.graduate_review");
  assert.equal(graduate(selectedProgram).sourceUrl, program.url);
});

test("renderer shows every rule and fallback as published reference with status, checked date, and official source", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const container = { innerHTML: "" };
  const result = renderQualificationGuidance({ container, university: oxford });
  assert.equal(result.entries.length, 4);
  assert.equal(container.innerHTML.match(/data-qualification-entry/g).length, 4);
  assert.match(container.innerHTML, /Explicitly not accepted/);
  assert.match(container.innerHTML, /Accepted qualification/);
  assert.match(container.innerHTML, /2026-09-24/);
  assert.match(container.innerHTML, /2026-09-23/);
  assert.match(container.innerHTML, /href="https:\/\/www\.ox\.ac\.uk\/[^"<>]*"/);
  assert.match(container.innerHTML, /Each applies only to the qualification, study level, and cycle it names/);
  assert.doesNotMatch(container.innerHTML, /profile\.html|your profile|Intended entry cycle/);
});

test("a university without catalogued guidance keeps the single no-verified-decision notice", () => {
  const container = { innerHTML: "" };
  renderQualificationGuidance({ container, university: { id: "no-guidance" } });
  assert.equal(container.innerHTML.match(/data-qualification-entry/g).length, 1);
  assert.match(container.innerHTML, /No verified decision for this exact qualification combination is catalogued/);
  assert.doesNotMatch(container.innerHTML, /Each applies only to the qualification/);
});

test("Russian qualification rendering translates known scope and cycle text while unknown copy keeps its safe fallback", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const container = { innerHTML: "" };
  setLanguage("rus", { persist: false, emit: false });
  renderQualificationGuidance({ container, university: oxford });
  assert.match(container.innerHTML, /Это относится к стандартному поступлению на первый курс бакалавриата в Оксфорде/);
  assert.match(container.innerHTML, /Действующие опубликованные правила; источник не указывает год поступления/);
  assert.doesNotMatch(container.innerHTML, /Undergraduate first-year qualification status|Current published policy/);

  const unknownUniversity = {
    id: "unknown-university",
    qualification_guidance: {
      verified_at: "2026-09-23",
      rules: [{
        id: "unknown-rule",
        study_level: "Bachelor",
        applicant_routes: ["first_year"],
        education_country: "KZ",
        education_credential: "national_secondary",
        status: "needs_review",
        reason: "Unknown reason text",
        scope: "Untranslated custom scope",
        cycle_scope: "Untranslated custom cycle text",
        source_url: "https://example.edu/admissions",
        verified_at: "2026-09-23",
      }],
      fallbacks: [],
    },
  };
  container.innerHTML = "";
  renderQualificationGuidance({ container, university: unknownUniversity });
  assert.match(container.innerHTML, /Untranslated custom scope/);
  assert.match(container.innerHTML, /Untranslated custom cycle text/);
  setLanguage("eng", { persist: false, emit: false });
});
