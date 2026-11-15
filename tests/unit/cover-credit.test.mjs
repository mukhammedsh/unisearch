import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { coverCreditHtml } = await import("../../frontend/javascript/pages/university/cover-credit.js");
await initI18n();
setLanguage("eng", { emit: false });

const credit = {
  source_url: "https://commons.wikimedia.org/wiki/File:Campus.jpg",
  author: "Jane <Doe>",
  license: "CC BY-SA 4.0",
  modified: true,
};

test("the cover credit names the author and license, marks the crop, and links the Commons file page", () => {
  const html = coverCreditHtml(credit);
  assert.match(html, /^<a class="d-cover-credit" href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Campus\.jpg"/);
  assert.match(html, /Photo: Jane &lt;Doe&gt;, CC BY-SA 4\.0 \(cropped\)/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("an unmodified photo has no crop note, and a missing author still keeps the license visible", () => {
  assert.match(coverCreditHtml({ ...credit, modified: false }), />Photo: Jane &lt;Doe&gt;, CC BY-SA 4\.0</);
  assert.match(coverCreditHtml({ ...credit, author: "" }), /Photo: Unknown author, CC BY-SA 4\.0/);
});

test("no credit is rendered without a license, and an unsafe source link falls back to plain text", () => {
  assert.equal(coverCreditHtml({ ...credit, license: "" }), "");
  assert.equal(coverCreditHtml(null), "");
  const html = coverCreditHtml({ ...credit, source_url: "javascript:alert(1)" });
  assert.match(html, /^<span class="d-cover-credit">/);
});
