import assert from "node:assert/strict";
import test from "node:test";
import { baselineUpdateBlocked, customPropertiesSetByJavaScript, javascriptStyleViolations, undefinedCssVariables } from "../../scripts/check-inline-styles.mjs";

test("undefined CSS variables ignore declarations, comments, strings, and references with fallbacks", () => {
  const files = [
    { relPath: "tokens.css", content: ":root { --known: red; } /* var(--commented) */ .x { color: var(--known); content: 'var(--string)'; width: var(--optional, 640px); }" },
    { relPath: "page.css", content: ".x { color: var(--missing); }" },
  ];
  assert.deepEqual(undefinedCssVariables(files), [{ file: "page.css", line: 1, variable: "--missing" }]);
});

test("undefined CSS variables inspect nested fallback references", () => {
  const files = [{ relPath: "page.css", content: ".x { color: var(--known, var(--missing)); }" }];
  assert.deepEqual(undefinedCssVariables(files), [{ file: "page.css", line: 1, variable: "--missing" }]);
});

test("only root and same-stylesheet CSS declarations satisfy references", () => {
  const files = [
    { relPath: "shared/foundation.css", content: ":root { --global-token: blue; }" },
    { relPath: "components/other.css", content: ".other { --component-token: red; }" },
    { relPath: "components/page.css", content: ".local { --local-token: green; } .page { color: var(--global-token); background: var(--local-token); border-color: var(--component-token); }" },
  ];
  assert.deepEqual(undefinedCssVariables(files), [{ file: "components/page.css", line: 1, variable: "--component-token" }]);
});

test("ordinary JavaScript strings do not declare CSS custom properties", () => {
  const help = 'const help = "--missing: red";';
  assert.deepEqual(customPropertiesSetByJavaScript(help), []);
  assert.deepEqual(undefinedCssVariables([{ relPath: "page.css", content: ".page { color: var(--missing); }" }], customPropertiesSetByJavaScript(help)), [
    { file: "page.css", line: 1, variable: "--missing" },
  ]);
});

test("JavaScript style checks flag static design assignments but allow dynamic progress values", () => {
  const source = [
    '// node.style.color = "red";',
    'node.style.color = "red";',
    'node.style["backgroundColor"] = "blue";',
    "node.style.width = `${percentage}%`;",
    'node.style.setProperty("--fill-width", `${percentage}%`);',
    'node.style.display = "none";',
    'const example = `node.style.color = "not executable"`;',
  ].join("\n");
  assert.deepEqual(javascriptStyleViolations(source), [
    { property: "color", value: "red", line: 2 },
    { property: "backgroundColor", value: "blue", line: 3 },
  ]);
  assert.deepEqual(customPropertiesSetByJavaScript(source), ["--fill-width"]);
});

test("JavaScript regex literals are ignored by the style-write scanner", () => {
  assert.deepEqual(javascriptStyleViolations('const pattern = /style.color = "red"/;'), []);
  assert.deepEqual(javascriptStyleViolations('function pattern() { return /style.color = "red"/; }'), []);
  assert.deepEqual(javascriptStyleViolations('const pattern = () => /style.color = "red"/;'), []);
});

test("baseline updates are blocked by CSS variable and static JS style findings", () => {
  assert.equal(baselineUpdateBlocked({ missingVariables: [{ variable: "--missing" }], staticStyleWrites: [] }), true);
  assert.equal(baselineUpdateBlocked({ missingVariables: [], staticStyleWrites: [{ property: "color" }] }), true);
  assert.equal(baselineUpdateBlocked({ missingVariables: [], staticStyleWrites: [] }), false);
});
