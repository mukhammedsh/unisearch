import assert from "node:assert/strict";
import { test } from "node:test";
import { withoutBracketedText } from "../../frontend/javascript/utils/text.js";

test("bracketed parts are dropped from labels in one linear pass", () => {
  assert.equal(withoutBracketedText("IELTS Academic (IELTS)"), "IELTS Academic");
  assert.equal(withoutBracketedText("TOEFL (iBT) Home  Edition (online)"), "TOEFL Home Edition");
  assert.equal(withoutBracketedText("Duolingo English Test"), "Duolingo English Test");
  assert.equal(withoutBracketedText("Exam (outer (inner) part) score"), "Exam score");
  assert.equal(withoutBracketedText(null), "");
  // Unbalanced brackets stay fast and never throw.
  const started = Date.now();
  withoutBracketedText("(".repeat(50000) + "x");
  assert.ok(Date.now() - started < 200);
});
