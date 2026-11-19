import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALLOWED_ID_SELECTORS,
  analyzeDuplicateMediaBlocks,
  analyzeIdSelectors,
  extractSelectorIds,
  findDuplicateMediaBlocks,
  findIdSelectors,
  normalizeAtRuleParams,
  splitSelectorList,
} from "../../scripts/audit-css.mjs";

test("normalizeAtRuleParams normalizes spacing around parentheses, colons, and commas", () => {
  assert.equal(normalizeAtRuleParams(" ( max-width :  768px ) "), "(max-width: 768px)");
  assert.equal(
    normalizeAtRuleParams("(hover:hover)  and  ( pointer : fine )"),
    "(hover: hover) and (pointer: fine)"
  );
});

test("findDuplicateMediaBlocks detects fragmented @media blocks under the same context", () => {
  const css = `
    @media (max-width: 768px) {
      .card { padding: 12px; }
    }
    @media (max-width: 480px) {
      .card { padding: 8px; }
    }
    @media ( max-width : 768px ) {
      .header { gap: 8px; }
    }
    @supports (display: grid) {
      @media (max-width: 768px) {
        .grid { display: grid; }
      }
    }
  `;

  const duplicates = findDuplicateMediaBlocks(css, "frontend/css/example.css");
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0], {
    file: "frontend/css/example.css",
    context: "top-level",
    query: "@media (max-width: 768px)",
    lines: [2, 8],
    occurrences: 2,
  });
});

test("findDuplicateMediaBlocks also flags duplicates nested under the same @supports context", () => {
  const css = `
    @supports (backdrop-filter: blur(4px)) {
      @media (min-width: 640px) { .a { opacity: 0.9; } }
      @media (min-width: 640px) { .b { opacity: 0.8; } }
    }
  `;

  const duplicates = findDuplicateMediaBlocks(css, "frontend/css/nested.css");
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].context, "@supports (backdrop-filter: blur(4px))");
  assert.equal(duplicates[0].occurrences, 2);
});

test("splitSelectorList preserves commas inside pseudo-classes and attribute selectors", () => {
  const parts = splitSelectorList(
    '.box:is(.a, .b), .field[data-items="x,y"], #admissionsContextApply:hover:not(:disabled)'
  );
  assert.deepEqual(parts, [
    ".box:is(.a, .b)",
    '.field[data-items="x,y"]',
    "#admissionsContextApply:hover:not(:disabled)",
  ]);
});

test("extractSelectorIds finds ID tokens while ignoring attribute values", () => {
  assert.deepEqual(extractSelectorIds("#tab-programs .program-card"), ["#tab-programs"]);
  assert.deepEqual(extractSelectorIds(".nav a[href='#top']"), []);
  assert.deepEqual(extractSelectorIds('[id="profileModal"] .body'), []);
  assert.deepEqual(extractSelectorIds(".wrap > :is(#firstId, .cls, #second-id)"), ["#firstId", "#second-id"]);
});

test("findIdSelectors ignores hex colors in declarations and enforces allowlist per file and selector", () => {
  const css = `
    .card { color: #123456; background-color: #abcdef; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .u-compare-mode-btn #compareModeLabel { display: inline; }
    #tab-programs .program-card { padding: 12px; }
    #admissionsUniversityInfo, .admissions-context__form { gap: 12px; }
  `;

  const customAllowlist = new Map([
    ["frontend/css/sample.css::.u-compare-mode-btn #compareModeLabel", "Classless label span"],
  ]);

  const found = findIdSelectors(css, "frontend/css/sample.css", customAllowlist);
  assert.equal(found.length, 3);
  assert.deepEqual(
    found.map((item) => ({ selector: item.selector, allowed: item.allowed, ids: item.ids })),
    [
      { selector: ".u-compare-mode-btn #compareModeLabel", allowed: true, ids: ["#compareModeLabel"] },
      { selector: "#tab-programs .program-card", allowed: false, ids: ["#tab-programs"] },
      { selector: "#admissionsUniversityInfo", allowed: false, ids: ["#admissionsUniversityInfo"] },
    ]
  );
});

test("analyzeDuplicateMediaBlocks and analyzeIdSelectors report unexpected IDs and stale allowlist entries", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "unisearch-audit-css-"));
  const filePath = path.join(tmpDir, "test.css");
  fs.writeFileSync(
    filePath,
    `
      .a { color: #ff00aa; }
      #unexpectedHack .btn { margin: 0; }
      @media (max-width: 640px) { .a { display: none; } }
      @media (max-width: 640px) { .b { display: block; } }
    `,
    "utf8"
  );

  try {
    const dupMedias = analyzeDuplicateMediaBlocks([filePath]);
    assert.equal(dupMedias.length, 1);
    assert.equal(dupMedias[0].query, "@media (max-width: 640px)");
    assert.equal(dupMedias[0].occurrences, 2);

    const allowlist = new Map([["some/stale.css::#oldId", "Removed in refactor"]]);
    const idReport = analyzeIdSelectors([filePath], allowlist);
    assert.equal(idReport.all.length, 1);
    assert.equal(idReport.unexpected.length, 1);
    assert.deepEqual(idReport.unexpected[0].ids, ["#unexpectedHack"]);
    assert.equal(idReport.staleAllowlistEntries.length, 1);
    assert.equal(idReport.staleAllowlistEntries[0].key, "some/stale.css::#oldId");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("ALLOWED_ID_SELECTORS keys use normalized relFile::selector format with documented reasons", () => {
  assert.ok(ALLOWED_ID_SELECTORS.size > 0);
  for (const [key, reason] of ALLOWED_ID_SELECTORS.entries()) {
    assert.match(key, /^frontend\/css\/.+\.css::.+$/);
    assert.ok(typeof reason === "string" && reason.trim().length > 10, `Missing reason for ${key}`);
  }
});
