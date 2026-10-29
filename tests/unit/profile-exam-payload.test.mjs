import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { EXAM_CONFIG, formatExamValue } from "../../frontend/javascript/utils/config.js";
import { readSelectedExamPayload } from "../../frontend/javascript/components/profile-ui.js";

Object.assign(EXAM_CONFIG, JSON.parse(await readFile(new URL("../../backend/data/exams.json", import.meta.url), "utf8")));

function input(exam, total, scores) {
  const rows = Object.entries(scores).map(([id, value]) => ({
    getAttribute: (name) => name === "data-breakdown-exam" ? id : "",
    querySelector: () => ({ value }),
  }));
  return {
    examScoreInput: { value: total },
    examSpecialInputContainer: {
      dataset: { breakdownExam: exam },
      querySelectorAll: (selector) => selector === "[data-breakdown-fixed-row]" ? rows : [],
    },
  };
}

const state = { profile: { exams: [] } };

test("NUET retains an old reported total and only known sections", () => {
  const totalOnly = readSelectedExamPayload("NUET", input("NUET", "120", { NUET_MATH: "", NUET_CRITICAL_THINKING: "" }), state);
  assert.equal(totalOnly.score, 120);
  assert.deepEqual(totalOnly.details.components, []);

  const partial = readSelectedExamPayload("NUET", input("NUET", "120", { NUET_MATH: "70", NUET_CRITICAL_THINKING: "" }), state);
  assert.equal(partial.score, 120);
  assert.deepEqual(partial.details.components, [{ exam: "NUET_MATH", score: 70 }]);
});

test("complete NUET sections can leave total derivation to the shared API validator", () => {
  const payload = readSelectedExamPayload("NUET", input("NUET", "", { NUET_MATH: "70", NUET_CRITICAL_THINKING: "50" }), state);
  assert.equal(payload.score, undefined);
  assert.deepEqual(payload.details.components, [{ exam: "NUET_MATH", score: 70 }, { exam: "NUET_CRITICAL_THINKING", score: 50 }]);
});

test("Nursing NAT records independent known percentages without inventing a total", () => {
  const payload = readSelectedExamPayload("NURSING_NAT", input("NURSING_NAT", "", { NAT_KNOWLEDGE: "70", NAT_CLINICAL_SKILLS: "" }), state);
  assert.equal(payload.score, undefined);
  assert.deepEqual(payload.details.components, [{ exam: "NAT_KNOWLEDGE", score: 70 }]);
});

test("residency report inputs record report presence without a numeric result", () => {
  for (const exam of ["IFOM_BSE", "USMLE_STEP_1"]) {
    assert.deepEqual(readSelectedExamPayload(exam, {}, state), { score: 1 });
    assert.equal(formatExamValue(exam, { score: 1, display_value: "Pass" }, { locale: "eng" }), "Added");
    assert.equal(formatExamValue(exam, { score: 0 }, { locale: "eng" }), "Not recorded");
  }
});

test("low single-subject A-level grades remain grades rather than report-presence labels", () => {
  assert.equal(formatExamValue("A_LEVEL_MATHEMATICS", 0), "U");
  assert.equal(formatExamValue("A_LEVEL_MATHEMATICS", 1), "E");
  assert.equal(formatExamValue("A_LEVEL_MATHEMATICS", 1, { context: "requirement" }), "E");
});
