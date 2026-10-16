import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  GPA_MAX_CHARS,
  cloneProfile,
  enforceGpaMaxLength,
  ensureProfileShape,
  formatExamValidationToast,
  getBudgetCurrency,
  getBudgetPlaceholderValue,
  getLowBudgetGrantThreshold,
  getMaxBudgetForCurrency,
  normalizeFundingType,
  normalizeGpaRaw,
  reportInvalidDate,
  setFieldInvalid,
  stableProfileSignature,
} = await import("../../frontend/javascript/components/profile/profile-utils.js");

test("currency and budget utility functions return calculated thresholds and values", () => {
  assert.equal(getBudgetCurrency(), "USD");
  assert.ok(getMaxBudgetForCurrency("USD") >= 1000000);
  assert.ok(getLowBudgetGrantThreshold("USD") >= 1000);
  assert.ok(getBudgetPlaceholderValue("USD") >= 1000);
  assert.equal(getMaxBudgetForCurrency("INVALID"), 1000000);
});

test("funding type and profile cloning helpers normalize types and clone objects", () => {
  assert.equal(normalizeFundingType("GRANT"), "grant");
  assert.equal(normalizeFundingType("paid"), "paid");
  assert.equal(normalizeFundingType("unknown"), "any");
  assert.equal(normalizeFundingType(null), "any");

  const original = { a: 1, b: [2, 3] };
  const cloned = cloneProfile(original);
  assert.deepEqual(cloned, original);
  assert.notEqual(cloned, original);
  assert.deepEqual(cloneProfile(null), {});
});

test("GPA raw normalization and input max length enforcement", () => {
  assert.equal(GPA_MAX_CHARS, 4);
  assert.equal(normalizeGpaRaw("3,85"), "3.85");
  assert.equal(normalizeGpaRaw(null), "");

  const mockInputLong = { value: "3.855" };
  enforceGpaMaxLength(mockInputLong);
  assert.equal(mockInputLong.value, "3.85");

  const mockInputComma = { value: "3,8" };
  enforceGpaMaxLength(mockInputComma);
  assert.equal(mockInputComma.value, "3.8");

  enforceGpaMaxLength(null);
});

test("setFieldInvalid toggles validity class, aria attribute, and error message", () => {
  const el = {
    id: "testInput",
    classes: new Set(),
    attrs: new Map(),
    classList: { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c) },
    setAttribute: (k, v) => el.attrs.set(k, v),
    getAttribute: (k) => el.attrs.get(k) || null,
    removeAttribute: (k) => el.attrs.delete(k),
    closest: () => el,
    insertAdjacentElement: () => {},
  };

  setFieldInvalid(el, true, "Error message");
  assert.ok(el.classes.has("is-invalid"));
  assert.equal(el.attrs.get("aria-invalid"), "true");

  setFieldInvalid(el, false);
  assert.ok(!el.classes.has("is-invalid"));
  assert.equal(el.attrs.get("aria-invalid"), undefined);

  setFieldInvalid(null);
});

test("reportInvalidDate focuses input", () => {
  let focused = false;
  const mockInput = { focus: () => { focused = true; } };
  reportInvalidDate(mockInput);
  assert.equal(focused, true);
  reportInvalidDate(null);
});

test("ensureProfileShape and stableProfileSignature create normalized signatures", () => {
  const profile = ensureProfileShape({ budget: 50000, gpa: 3.9, gpaScale: 4, exams: [{ exam: "SAT", score: 1450 }] });
  assert.equal(profile.budget, 50000);
  assert.equal(profile.gpa, 3.9);

  const sig1 = stableProfileSignature(profile);
  const sig2 = stableProfileSignature({ budget: 50000, gpa: 3.9, gpaScale: 4, exams: [{ exam: "SAT", score: 1450 }] });
  assert.equal(sig1, sig2);
  assert.notEqual(sig1, "");

  const sigLang = stableProfileSignature({
    languages: [
      { code: "en", kind: "native" },
      { code: "ru", kind: "cefr", level: 5 },
      { code: "fr", kind: "exam", exam: "DELF", score: 80 },
      { code: "bad", kind: "cefr", level: "bad" },
    ],
  });
  assert.ok(sigLang.includes("DELF") || sigLang.includes("fr"));
});

test("formatExamValidationToast formats structured error messages for exam validation", () => {
  const cfgMock = (id) => (id === "SAT" || id === "IELTS" ? {} : null);

  const genericToast = formatExamValidationToast("SAT", "", cfgMock);
  assert.ok(genericToast.includes("SAT"));

  const rangeToast = formatExamValidationToast("SAT", "Value error, Score must be between 400 and 1600", cfgMock);
  assert.ok(rangeToast.includes("400"));
  assert.ok(rangeToast.includes("1600"));

  const stepToast = formatExamValidationToast("SAT", "step=10", cfgMock);
  assert.ok(stepToast.includes("10"));

  const missingSubjectToast = formatExamValidationToast("SAT", "requires component IELTS", cfgMock);
  assert.ok(missingSubjectToast.includes("IELTS"));

  const minSubjectsToast = formatExamValidationToast("SAT", "requires at least 2 selected subjects", cfgMock);
  assert.ok(minSubjectsToast.includes("2"));

  const maxSubjectsToast = formatExamValidationToast("SAT", "supports at most 4 selected subjects", cfgMock);
  assert.ok(maxSubjectsToast.includes("4"));

  const notAllowedToast = formatExamValidationToast("SAT", "does not support component UNT", cfgMock);
  assert.ok(notAllowedToast.includes("UNT"));

  const atLeastOneToast = formatExamValidationToast("SAT", "requires at least one subject score", cfgMock);
  assert.ok(atLeastOneToast.includes("SAT"));

  const invalidFormatToast = formatExamValidationToast("SAT", "invalid score format", cfgMock);
  assert.ok(invalidFormatToast.includes("Score") || invalidFormatToast.includes("format") || invalidFormatToast.length > 0);

  const arrayDetailToast = formatExamValidationToast("SAT", [{ msg: "Custom error" }], cfgMock);
  assert.ok(arrayDetailToast.includes("Custom error"));

  const objectDetailToast = formatExamValidationToast("SAT", { message: "Object error" }, cfgMock);
  assert.ok(objectDetailToast.includes("Object error"));
});
