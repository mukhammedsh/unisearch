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
const { resolveQualificationGuidance, renderQualificationGuidance } = await import("../../frontend/javascript/pages/university/render-content.js");
await initI18n();

const rows = JSON.parse(await readFile(new URL("../../backend/data/universities.json", import.meta.url), "utf8"));
const universities = Object.fromEntries(rows.map((row) => [row.id, row]));

test("Oxford rejects only the explicitly named Kazakhstan Attestat and accepts an IB diploma at qualification-type level", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const rejected = resolveQualificationGuidance({
    university: oxford,
    profile: {
      studyLevel: "Bachelor",
      applicantRoute: "first_year",
      countryOfEducation: "KZ",
      educationCredential: "other",
      educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
      intendedEntryCycle: "2027 Fall",
    },
  });
  assert.equal(rejected.status, "not_accepted");
  assert.equal(rejected.verifiedAt, "2026-09-23");
  assert.match(rejected.sourceUrl, /^https:\/\/www\.ox\.ac\.uk\//);

  const accepted = resolveQualificationGuidance({
    university: oxford,
    profile: { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "DE", educationCredential: "ib" },
  });
  assert.equal(accepted.status, "accepted");
  assert.match(accepted.reason, /course-specific/i);
});

test("generic national-secondary and unlisted credentials stay in official review", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const broadCategory = resolveQualificationGuidance({
    university: oxford,
    profile: { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "KZ", educationCredential: "national_secondary" },
  });
  assert.equal(broadCategory.status, "needs_review");
  assert.equal(broadCategory.needsExactCredential, true);

  const unlisted = resolveQualificationGuidance({
    university: oxford,
    profile: { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "ZZ", educationCredential: "other", educationCredentialOther: "Unknown certificate" },
  });
  assert.equal(unlisted.status, "needs_review");
  assert.equal(unlisted.needsExactCredential, false);
});

test("Oxford KZ rejection requires an exact normalized Attestat title for either credential entry path", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const base = { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "KZ" };

  const nationalAttestat = resolveQualificationGuidance({
    university: oxford,
    profile: {
      ...base,
      educationCredential: "national_secondary",
      educationCredentialOther: "Attestat/Svidetel' stvo o Srednem Obrazovanii (Certificate of Secondary Education)",
    },
  });
  assert.equal(nationalAttestat.status, "not_accepted");

  const otherNationalTitle = resolveQualificationGuidance({
    university: oxford,
    profile: { ...base, educationCredential: "national_secondary", educationCredentialOther: "National school leaving certificate" },
  });
  assert.equal(otherNationalTitle.status, "needs_review");

  const mixedCredentialText = resolveQualificationGuidance({
    university: oxford,
    profile: { ...base, educationCredential: "national_secondary", educationCredentialOther: "IB instead of Attestat" },
  });
  assert.equal(mixedCredentialText.status, "needs_review");
});

test("US school context at MIT, Stanford, and Harvard does not create an acceptance or rejection", () => {
  const profile = { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "US", educationCredential: "us_high_school_diploma" };
  for (const id of ["mit-usa-cambridge", "stanford-university-usa-ca", "harvard-usa-cambridge"]) {
    const result = resolveQualificationGuidance({ university: universities[id], profile });
    assert.equal(result.status, "needs_review", id);
    assert.match(result.reason, /context|requirements|application/i, id);
    assert.match(result.sourceUrl, /^https:\/\//, id);
  }
});

test("graduate qualification guidance requires a selected official programme page", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const profile = { studyLevel: "Master", applicantRoute: "graduate", countryOfEducation: "KZ", educationCredential: "national_secondary", intendedEntryCycle: "2027 Fall" };
  const noProgram = resolveQualificationGuidance({ university: oxford, profile });
  assert.equal(noProgram.status, "needs_review");
  assert.equal(noProgram.sourceUrl, "");

  const program = { id: "msc", name: "MSc Computer Science", study_levels: ["Master"], url: "https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science" };
  const selectedProgram = resolveQualificationGuidance({ university: oxford, profile, program });
  assert.equal(selectedProgram.status, "needs_review");
  assert.equal(selectedProgram.sourceUrl, program.url);
});

test("a distant entry cycle and a different applicant route require review", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const profile = { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "KZ", educationCredential: "other", educationCredentialOther: "Attestat", intendedEntryCycle: "2029 Fall" };
  assert.equal(resolveQualificationGuidance({ university: oxford, profile }).status, "needs_review");
  assert.equal(resolveQualificationGuidance({ university: oxford, profile: { ...profile, applicantRoute: "transfer", intendedEntryCycle: "2027 Fall" } }).status, "needs_review");
});

test("renderer exposes an official status, checked date, source, and a precise-certificate action", () => {
  const container = { innerHTML: "" };
  const result = renderQualificationGuidance({
    container,
    university: universities["university-of-oxford-uk-oxford"],
    profile: { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "KZ", educationCredential: "national_secondary" },
  });
  assert.equal(result.status, "needs_review");
  assert.match(container.innerHTML, /2026-09-23/);
  assert.match(container.innerHTML, /www\.ox\.ac\.uk/);
  assert.match(container.innerHTML, /profile\.html/);
});

test("Russian qualification rendering translates known scope and cycle text while unknown copy keeps its safe fallback", () => {
  const oxford = universities["university-of-oxford-uk-oxford"];
  const container = { innerHTML: "" };
  setLanguage("rus", { persist: false, emit: false });
  renderQualificationGuidance({
    container,
    university: oxford,
    profile: {
      studyLevel: "Bachelor",
      applicantRoute: "first_year",
      countryOfEducation: "KZ",
      educationCredential: "national_secondary",
      educationCredentialOther: "Attestat",
    },
  });
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
  renderQualificationGuidance({
    container,
    university: unknownUniversity,
    profile: { studyLevel: "Bachelor", applicantRoute: "first_year", countryOfEducation: "KZ", educationCredential: "national_secondary" },
  });
  assert.match(container.innerHTML, /Untranslated custom scope/);
  assert.match(container.innerHTML, /Untranslated custom cycle text/);
  setLanguage("eng", { persist: false, emit: false });
});
