import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { stabilizeNumericRanges, typesetDateRanges } = await import("../../frontend/javascript/utils/text.js");

const EN = "–";
const NB = "‑";

test("academic and calendar year ranges use an en dash whatever dash the source used", () => {
  for (const source of ["2026-2027", "2026 - 2027", `2026${EN}2027`, `2026${NB}2027`]) {
    assert.equal(typesetDateRanges(source), `2026${EN}2027`);
  }
  for (const source of ["2027-28", `2027${EN}28`, `2027${NB}28`, "2027 - 28"]) {
    assert.equal(typesetDateRanges(source), `2027${EN}28`);
  }
  assert.equal(typesetDateRanges("Catalog 2026-2027/current, 2021-2025."), `Catalog 2026${EN}2027/current, 2021${EN}2025.`);
});

test("day ranges next to an English, Russian or Kazakh month use an en dash", () => {
  assert.equal(typesetDateRanges("12-16 October"), `12${EN}16 October`);
  assert.equal(typesetDateRanges("26-27 Sep"), `26${EN}27 Sep`);
  assert.equal(typesetDateRanges("March 1-31"), `March 1${EN}31`);
  assert.equal(typesetDateRanges("12-16 октября"), `12${EN}16 октября`);
  assert.equal(typesetDateRanges("12-16 қазан"), `12${EN}16 қазан`);
});

test("ISO dates, year-months, codes, times and URL paths are not rewritten", () => {
  for (const source of ["2027-01-15", "2026-12", "2027-28-01", "6-3", "Course 6-9", "09:00-17:00", "FY2026-27", "/fees/2026-27/page", "3-4 times"]) {
    assert.equal(typesetDateRanges(source), source);
  }
  assert.equal(typesetDateRanges("Maybe 3-4 weeks"), "Maybe 3-4 weeks");
});

test("stabilizing keeps ISO dates in plain hyphens and other numeric ranges non-breaking", () => {
  assert.equal(stabilizeNumericRanges("Last checked: 2026-11-13"), "Last checked: 2026-11-13");
  assert.equal(stabilizeNumericRanges("2026-27 and 6-3"), `2026${EN}27 and 6${NB}3`);
  assert.equal(stabilizeNumericRanges("TOEFL (0-120)"), `TOEFL (0${NB}120)`);
});
