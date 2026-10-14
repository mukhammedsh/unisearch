import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { isSpacingProperty, scanCssFile, spacingTokenFor, spacingValueViolations } from "../../scripts/check-design-lint.mjs";

test("the CSS file scanner catches spacing declarations in single-line blocks", () => {
  const filePath = path.resolve("tests/unit/fixtures/design-lint-single-line.css");
  const { violations } = scanCssFile(filePath);
  assert.ok(violations.some(({ type, code }) => type === "spacing-hardcoded-value" && code.includes("padding: 10px")));
});

test("spacing lint recognizes physical and logical spacing properties", () => {
  assert.equal(isSpacingProperty("margin-top"), true);
  assert.equal(isSpacingProperty("padding-inline-start"), true);
  assert.equal(isSpacingProperty("scroll-padding-block-end"), true);
  assert.equal(isSpacingProperty("--mobile-safe-gutter"), true);
  assert.equal(isSpacingProperty("font-size"), false);
});

test("spacing tokens cover compact, regular, and page-level values", () => {
  assert.equal(spacingTokenFor(2), "var(--space-0-5) (2px)");
  assert.equal(spacingTokenFor(6), "var(--space-1-5) (6px)");
  assert.equal(spacingTokenFor(40), "var(--space-10) (40px)");
  assert.equal(spacingTokenFor(96), "var(--space-24) (96px)");
});

test("spacing lint requires tokens even inside calc expressions", () => {
  assert.deepEqual(spacingValueViolations("padding-inline-start", "var(--space-2)"), []);
  assert.deepEqual(spacingValueViolations("margin-block-end", "10px"), [
    { text: "10px", suggestion: "var(--space-2) (8px)" },
  ]);
  assert.deepEqual(spacingValueViolations("gap", "calc(100% - 18px)"), [
    { text: "18px", suggestion: "var(--space-4) (16px)" },
  ]);
  assert.deepEqual(spacingValueViolations("--mobile-safe-gutter", "clamp(12px, 4vw, 20px)"), [
    { text: "12px", suggestion: "var(--space-3) (12px)" },
    { text: "20px", suggestion: "var(--space-5) (20px)" },
  ]);
  assert.deepEqual(spacingValueViolations("gap", "0 auto"), []);
});
