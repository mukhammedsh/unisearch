import "./setup.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { renderAdmissionsValue } from "../../frontend/javascript/pages/university/admissions-render.js";

const catalog = JSON.parse(await readFile(new URL("../../backend/data/admissions/catalog.json", import.meta.url), "utf8"));
const LOCALIZATION = ["eng", "ru", "kaz"].map(language => readFileSync(new URL(`../../frontend/Localization/${language}`, import.meta.url), "utf8"));
const ENUM_KEY = /^university\.admissions\.catalog\.enum\.([a-z0-9_]+):/gm;
const enumKeys = LOCALIZATION.map(text => new Set([...text.matchAll(ENUM_KEY)].map(match => match[1])));

// Snake_case codes are internal enum values; a plain-language label must replace them in applicant text.
const RAW_CODE = /(?<![\w@./-])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\w@/-])/;
const PYTHON_DICT = /\{'|': True|': False|': None/;
// The raw catalog keeps these research sentences; the API removes or restates them through editorial_notes.json
// (covered by test_admissions_editorial). Listed so that new ones fail here.
const PENDING_EDITORIAL_DOSSIER = new Set([
  "medicine-graduate-evidence:bmds-ms-types:value",
  "fact_imperial_digital_health_leadership_pg_dip_course_admission_dates_fees_awards:value",
]);
const OFFICIAL_TEXT_KEYS = new Set(["source_content", "published_text", "original_source_text", "source_text", "verbatim", "quote", "official_text", "original_text"]);
const VALUE_FIELDS = ["value", "conditions", "conditions_and_exceptions", "exceptions", "reason", "official_next_step"];

function visibleText(html) {
  // &amp; is decoded last so an escaped entity such as "&amp;quot;" is not decoded twice.
  return html.replace(/<[^>]+>/g, "\n").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function withoutOfficialText(value) {
  if (Array.isArray(value)) return value.map(withoutOfficialText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !OFFICIAL_TEXT_KEYS.has(key)).map(([key, entry]) => [key, withoutOfficialText(entry)]));
  }
  return value;
}

function applicantTexts(row) {
  const texts = [];
  for (const field of VALUE_FIELDS) {
    const value = row[field];
    if (value === null || value === undefined) continue;
    texts.push([field, renderAdmissionsValue(withoutOfficialText(value), {})]);
  }
  const scope = row.scope || {};
  const scopeNames = Object.fromEntries(["applicant_categories", "levels", "fee_status", "additional_dimensions"]
    .filter(key => scope[key] && (!Array.isArray(scope[key]) || scope[key].length)).map(key => [key, scope[key]]));
  if (Object.keys(scopeNames).length) texts.push(["scope", renderAdmissionsValue(scopeNames, {})]);
  return texts;
}

test("applicant-visible admissions text has no raw snake_case codes or Python dict literals for the four accepted institutions", () => {
  const violations = [];
  for (const institution of catalog.institutions) {
    for (const collection of ["facts", "unknowns"]) {
      for (const row of institution[collection] || []) {
        // Research notes superseded by completed research are dropped from applicant history by the backend.
        if (row.review_status === "superseded_by_completed_research") continue;
        for (const [field, html] of applicantTexts(row)) {
          const text = visibleText(html);
          const where = `${institution.institution.id} ${collection}:${row.id}:${field}`;
          const code = text.match(RAW_CODE);
          if (code) violations.push(`${where} shows code "${code[0]}"`);
          if (PYTHON_DICT.test(text)) violations.push(`${where} shows Python dict text`);
          if (/dossier/i.test(text) && !PENDING_EDITORIAL_DOSSIER.has(`${row.id}:${field}`) && !PENDING_EDITORIAL_DOSSIER.has(row.id)) {
            violations.push(`${where} shows research-process wording "dossier"`);
          }
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("every applicant category and scope code has a localized label in English, Russian and Kazakh", () => {
  const codes = new Set();
  for (const institution of catalog.institutions) {
    for (const row of [...institution.facts, ...(institution.unknowns || [])]) {
      const scope = row.scope || {};
      for (const code of scope.applicant_categories || []) codes.add(code);
      for (const values of Object.values(scope.additional_dimensions || {})) {
        for (const code of Array.isArray(values) ? values : [values]) if (typeof code === "string") codes.add(code);
      }
    }
  }
  const codePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
  const missing = [...codes].filter(code => codePattern.test(code))
    .flatMap(code => enumKeys.map((keys, index) => (keys.has(code) ? null : `${["eng", "ru", "kaz"][index]}:${code}`)).filter(Boolean));
  assert.deepEqual(missing, []);
});

test("Python dict notes are shown as readable flags instead of literal dict text", () => {
  const html = renderAdmissionsValue("2026-27 Bulletin degree metadata: {'externalAdmissions': True, 'coterm': False, 'unitsProgramMin': 45}.", {});
  const text = visibleText(html);
  assert.doesNotMatch(text, /\{'|externalAdmissions|unitsProgramMin/);
  assert.match(text, /2026.27 Bulletin degree metadata/);
  assert.match(text, /45/);
});

test("text shaped like a Python dict is parsed in linear time and malformed dicts stay plain text", () => {
  // The shape CodeQL flagged for exponential backtracking: many repeated entries and no closing brace.
  const hostile = `{{'A':True${" 'A':0".repeat(50000)}`;
  const started = performance.now();
  const html = renderAdmissionsValue(hostile, {});
  assert.ok(performance.now() - started < 1000, "parsing must not backtrack");
  assert.ok(html.includes("A&#039;:True"), "an unparseable value stays as text");
  // An entry that is not a plain literal keeps the whole value as text.
  assert.ok(renderAdmissionsValue("Note: {'a': 1, 'b': [2]}", {}).includes("b&#039;: [2]"));
  // A trailing comma and no leading note are accepted.
  assert.match(visibleText(renderAdmissionsValue("{'coterm': False,}", {})), /coterm|Coterm|\bNo\b/i);
});
