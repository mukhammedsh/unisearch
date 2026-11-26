import test from "node:test";
import assert from "node:assert/strict";
import { inspectMarkupFile } from "../../scripts/check-ui-primitives.mjs";

test("accepts compliant .ui-input, .ui-switch, .ui-select, and .ui-btn controls", () => {
  const html = `
    <div class="ui-input-composite ui-input-composite--lg">
      <input id="q" class="ui-input" type="search" />
      <button type="button" class="ui-btn ui-btn--icon ui-btn--ghost" aria-label="Clear">x</button>
    </div>
    <textarea class="ui-input ui-input--textarea"></textarea>
    <select class="ui-select ui-select--lg"><option>A</option></select>
    <input type="checkbox" role="switch" class="ui-switch" />
    <button type="button" class="ui-btn ui-btn--primary">Save</button>
  `;
  const result = inspectMarkupFile(html, "sample.html");
  assert.equal(result.violations.length, 0);
  assert.deepEqual(result.counts.inputs, { total: 2, adopted: 2 });
  assert.deepEqual(result.counts.switches, { total: 1, adopted: 1 });
  assert.deepEqual(result.counts.selects, { total: 1, adopted: 1 });
  assert.deepEqual(result.counts.buttons, { total: 2, adopted: 2, structuralExcluded: 0 });
});

test("excludes structural tab, segmented, and tooltip buttons without requiring .ui-btn", () => {
  const html = `
    <div role="tablist">
      <button type="button" class="d-tab-btn" role="tab">Overview</button>
      <button type="button" class="ui-segmented__item active">List</button>
      <button type="button" class="u-info" aria-label="Info">i</button>
      <button type="button" class="program-card__toggle">Program</button>
    </div>
  `;
  const result = inspectMarkupFile(html, "tabs.html");
  assert.equal(result.violations.length, 0);
  assert.equal(result.counts.buttons.total, 0);
  assert.equal(result.counts.buttons.structuralExcluded, 4);
});

test("flags unstyled inputs, missing input types, unstyled selects, and unstyled action buttons", () => {
  const html = `
    <input id="missingType" class="ui-input" />
    <input id="rawInput" type="text" class="page-input" />
    <textarea id="rawTextarea"></textarea>
    <select id="rawSelect"></select>
    <input id="rawSwitch" type="checkbox" role="switch" />
    <button id="rawButton" type="button" class="page-submit">Submit</button>
  `;
  const result = inspectMarkupFile(html, "bad.html");
  assert.equal(result.violations.length, 6);
  assert.match(result.violations[0].reason, /Missing explicit type/);
  assert.match(result.violations[1].reason, /\.ui-input/);
  assert.match(result.violations[2].reason, /\.ui-input/);
  assert.match(result.violations[3].reason, /\.ui-select/);
  assert.match(result.violations[4].reason, /\.ui-switch/);
  assert.match(result.violations[5].reason, /\.ui-btn/);
});
