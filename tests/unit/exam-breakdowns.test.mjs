import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { EXAM_CONFIG } = await import("../../frontend/javascript/utils/config.js");
const {
  buildBreakdownState,
  gradeOptionsForExam,
  normalizeBreakdownDefinitions,
  normalizeBreakdownRows,
  parseAlevelGrades,
  readBreakdownFieldPayload,
  readSubjectBreakdownDraft,
  renderBreakdownValueControl,
  renderSpecialExamInput,
} = await import("../../frontend/javascript/components/profile/exam-breakdowns.js");

Object.assign(EXAM_CONFIG, JSON.parse(await readFile(new URL("../../backend/data/exams.json", import.meta.url), "utf8")));

function fieldRow(exam, value) {
  return {
    getAttribute(name) {
      return { "data-breakdown-exam": exam, "data-breakdown-label": exam }[name] || "";
    },
    querySelector(selector) {
      if (selector.includes("data-breakdown-subject-select")) return { value: exam };
      return selector.includes("data-breakdown-value") ? { value } : null;
    },
  };
}

function breakdownContainer(exam, { fixed = [], selectable = [], extra = [] } = {}) {
  return {
    dataset: { breakdownExam: exam },
    querySelectorAll(selector) {
      if (selector.includes("fixed-row")) return fixed;
      if (selector.includes("selectable-row")) return selectable;
      if (selector.includes("extra-row")) return extra;
      return [];
    },
  };
}

test("A-Level grade parsing accepts complete lists and rejects partial input", () => {
  assert.deepEqual(parseAlevelGrades(" a* / B, c "), ["A*", "B", "C"]);
  assert.deepEqual(parseAlevelGrades("A X B"), []);
  assert.deepEqual(parseAlevelGrades(""), []);
  assert.deepEqual(gradeOptionsForExam("A_LEVEL_MATHEMATICS"), ["A*", "A", "B", "C", "D", "E", "U"]);
});

test("breakdown definitions and saved rows normalize aliases, optional flags, scores, and details", () => {
  const definitions = normalizeBreakdownDefinitions([
    "GRE_VERBAL",
    { exam_id: "GRE_QUANTITATIVE", required: false },
    null,
    "",
  ], { defaultRequired: true });
  assert.deepEqual(definitions.map(({ exam, required }) => [exam, required]), [
    ["GRE_VERBAL", true],
    ["GRE_QUANTITATIVE", false],
  ]);

  const details = { grades: ["A*", "A", "B"] };
  const rows = normalizeBreakdownRows([
    { exam: "GRE_VERBAL", score: "160", rawValue: "160", details },
    { exam: "GRE_QUANTITATIVE", score: "Infinity", displayValue: "165" },
    null,
  ]);
  assert.deepEqual(rows, [
    { exam: "GRE_VERBAL", score: 160, raw_value: "160", details },
    { exam: "GRE_QUANTITATIVE", score: null, raw_value: "165", details: null },
  ]);
  assert.notEqual(rows[0].details, details);
  assert.deepEqual(normalizeBreakdownRows("not rows"), []);
});

test("exam definitions build fixed, selectable, and extra-score drafts from saved values", () => {
  const gre = buildBreakdownState("GRE", {
    score: "not numeric",
    details: { components: [{ exam: "GRE_VERBAL", score: 160 }] },
  });
  assert.equal(gre.totalScore, null);
  assert.equal(gre.fixed.length, 3);
  assert.ok(gre.fixed.every((item) => item.required));
  assert.equal(gre.components[0].score, 160);

  const draft = readSubjectBreakdownDraft("GRE", breakdownContainer("GRE", {
    fixed: [fieldRow("GRE_VERBAL", "160"), fieldRow("GRE_QUANTITATIVE", "166"), fieldRow("GRE_ANALYTICAL_WRITING", "4.5")],
  }), { silent: true });
  assert.deepEqual(draft.components.map(({ exam, score }) => [exam, score]), [
    ["GRE_VERBAL", 160],
    ["GRE_QUANTITATIVE", 166],
    ["GRE_ANALYTICAL_WRITING", 4.5],
  ]);

  const esat = readSubjectBreakdownDraft("ESAT", breakdownContainer("ESAT", {
    selectable: [fieldRow("ESAT_MATH_1", "7.2"), fieldRow("", "")],
  }), { silent: true });
  assert.deepEqual(esat.components, [{ exam: "ESAT_MATH_1", score: 7.2 }]);

  const hkdse = EXAM_CONFIG.HKDSE_LEVEL;
  const hkdseDraft = readSubjectBreakdownDraft("HKDSE_LEVEL", breakdownContainer("HKDSE_LEVEL", {
    fixed: hkdse.breakdown_scheme.fixed_components.map((component) => fieldRow(component.exam, "5")),
    extra: [fieldRow("HKDSE_WEIGHTED_TOTAL", "36.5")],
  }), { silent: true });
  assert.equal(hkdseDraft.components.length, hkdse.breakdown_scheme.fixed_components.length);
  assert.deepEqual(hkdseDraft.extraScores, [{ exam: "HKDSE_WEIGHTED_TOTAL", score: 36.5 }]);

  const missing = readSubjectBreakdownDraft("GRE", breakdownContainer("GRE", { fixed: [fieldRow("GRE_VERBAL", "")] }), { silent: true });
  assert.deepEqual(missing.components, [{ exam: "GRE_VERBAL", score: null }]);
  assert.equal(readSubjectBreakdownDraft("GRE", breakdownContainer("GRE", { fixed: [fieldRow("GRE_VERBAL", "invalid")] }), { silent: true }), null);
});

test("breakdown controls preserve band, grade, flag, and numeric input modes", () => {
  assert.match(renderBreakdownValueControl({ parentExamId: "GRE", examId: "GRE_VERBAL", slotKey: "fixed", valueState: { score: 160 } }), /min="130"[\s\S]*max="170"/);
  assert.match(renderBreakdownValueControl({ parentExamId: "A_LEVEL_CERT", examId: "A_LEVEL_MATHEMATICS", slotKey: "grade", valueState: { details: { grades: ["A*"] } } }), /data-breakdown-value="grade"[\s\S]*value="A\*" selected/);
  assert.match(renderBreakdownValueControl({ parentExamId: "UCAT", examId: "UCAT_SJT", slotKey: "band", valueState: { raw_value: "Band 2" } }), /data-breakdown-value="band"[\s\S]*Band 2/);
  assert.match(renderBreakdownValueControl({ parentExamId: "UCAT", examId: "UCAT_SJT", slotKey: "extra", valueState: { score: 0 }, isExtra: true }), /data-breakdown-value="band"[\s\S]*Band 1/);

  assert.deepEqual(readBreakdownFieldPayload({ querySelector: () => ({ value: "Band 2" }) }, "UCAT_SJT"), { raw_value: "Band 2" });
  assert.deepEqual(readBreakdownFieldPayload({ querySelector: () => ({ value: "A*" }) }, "A_LEVEL_MATHEMATICS"), { raw_value: "A*" });
  assert.deepEqual(readBreakdownFieldPayload({ querySelector: () => ({ value: "0" }) }, "SWISS_MATURITY_CERT"), { score: 0 });
  assert.deepEqual(readBreakdownFieldPayload({ querySelector: () => ({ value: "bad" }) }, "GRE_VERBAL"), { invalid: true, raw: "bad" });
  assert.equal(readBreakdownFieldPayload({ querySelector: () => ({ value: "" }) }, "GRE_VERBAL"), null);
  assert.equal(readBreakdownFieldPayload(null, "GRE_VERBAL"), null);
});

test("missing composite totals and section scores stay empty while an explicit zero is preserved", () => {
  for (const score of [null, "", undefined]) {
    assert.equal(buildBreakdownState("NUET", { score }).totalScore, null);
    const html = renderBreakdownValueControl({ parentExamId: "NUET", examId: "NUET_MATH", slotKey: "section", valueState: { score } });
    assert.match(html, /value=""/);
    assert.doesNotMatch(html, /value="0"/);
  }
  assert.equal(buildBreakdownState("NUET", { score: 0 }).totalScore, 0);
  assert.match(renderBreakdownValueControl({ parentExamId: "NUET", examId: "NUET_MATH", slotKey: "section", valueState: { score: 0 } }), /value="0"/);
});

test("configured optional fixed sections preserve total-only and partial reports", () => {
  const previous = EXAM_CONFIG.NUET;
  EXAM_CONFIG.NUET = { ...previous, input_mode: "subject_breakdown", breakdown_scheme: {
    fixed_components: [{ exam: "NUET_MATH", required: false }, { exam: "NUET_CRITICAL_THINKING", required: false }],
    total_strategy: "use_parent_score",
  } };
  try {
    const rows = [fieldRow("NUET_MATH", ""), fieldRow("NUET_CRITICAL_THINKING", "")];
    const options = { findExistingExamEntry: () => ({ score: 120 }) };
    assert.deepEqual(readSubjectBreakdownDraft("NUET", breakdownContainer("NUET", { fixed: rows }), options).components, []);
    assert.deepEqual(readSubjectBreakdownDraft("NUET", breakdownContainer("NUET", { fixed: [fieldRow("NUET_MATH", "0"), rows[1]] }), options).components, [{ exam: "NUET_MATH", score: 0 }]);
    assert.equal(readSubjectBreakdownDraft("NUET", breakdownContainer("NUET", { fixed: [fieldRow("NUET_MATH", "invalid")] }), { silent: true }), null);
  } finally {
    EXAM_CONFIG.NUET = previous;
  }
});

test("special exam inputs render grade, band, fixed-score, and selectable-subject controls", () => {
  const grades = { dataset: {}, innerHTML: "" };
  assert.equal(renderSpecialExamInput("A_LEVEL_MATHEMATICS", grades, { findExistingExamEntry: () => ({ raw_value: "A*" }) }), true);
  assert.match(grades.innerHTML, /data-grade-slot="0"/);
  assert.match(grades.innerHTML, /value="A\*" selected/);

  const band = { dataset: {}, innerHTML: "" };
  assert.equal(renderSpecialExamInput("UCAT_SJT", band, { findExistingExamEntry: () => ({ raw_value: "Band 2" }) }), true);
  assert.match(band.innerHTML, /value="Band 2" selected/);

  const gre = { dataset: {}, innerHTML: "" };
  assert.equal(renderSpecialExamInput("GRE", gre), true);
  assert.match(gre.innerHTML, /GRE_VERBAL/);
  assert.match(gre.innerHTML, /data-breakdown-fixed-row/);

  const esat = { dataset: {}, innerHTML: "" };
  assert.equal(renderSpecialExamInput("ESAT", esat, { findExistingExamEntry: () => ({ details: { components: [{ exam: "ESAT_MATH_1", score: 7.2 }] } }) }), true);
  assert.match(esat.innerHTML, /data-breakdown-selectable-row="0"/);
  assert.match(esat.innerHTML, /data-breakdown-slot="selectable-0"/);

  const aLevels = { dataset: {}, innerHTML: "" };
  assert.equal(renderSpecialExamInput("A_LEVEL_CERT", aLevels), true);
  assert.match(aLevels.innerHTML, /data-breakdown-selectable-row="3"/);

  const unknown = { dataset: {}, innerHTML: "stale" };
  assert.equal(renderSpecialExamInput("unknown exam", unknown), false);
  assert.equal(unknown.innerHTML, "");
});
