import "./setup.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

global.fetch = async url => ({ ok: true, text: () => readFile(new URL(`../../frontend/${String(url).split("?")[0]}`, import.meta.url), "utf8") });
const { initI18n, setLanguage } = await import("../../frontend/javascript/i18n.js");
const { glossaryTerms, renderTermHelp, renderTermList, routeWording } = await import("../../frontend/javascript/pages/university/admissions-glossary.js");
await initI18n();
setLanguage("eng", { emit: false });

const TERMS = ["restrictive_early_action", "early_action", "regular_action", "regular_decision", "ucas", "tmua", "foundation", "css_profile", "fee_status"];

test("terms are found in published wording, not in translated interface text", () => {
  assert.deepEqual(glossaryTerms(routeWording({ classification: "ucas_course_choice", destination: "UCAS; shared undergraduate route" })), ["ucas"]);
  assert.deepEqual(glossaryTerms(routeWording({ title: "Regular Foundation/Undergraduate admission" })), ["foundation"]);
  assert.deepEqual(glossaryTerms(routeWording({ title: "NUFYP internal progression to undergraduate" })), ["foundation"]);
  assert.deepEqual(glossaryTerms(["Early Action", "Regular Action"], "Early Action"), ["early_action", "regular_action"]);
  assert.deepEqual(glossaryTerms("Regular Decision", "RD", "TMUA"), ["regular_decision", "tmua"]);
  assert.deepEqual(glossaryTerms(["CSS Profile"], undefined, null), ["css_profile"]);
  assert.deepEqual(glossaryTerms("Home fee", "Overseas fee"), ["fee_status"]);
  assert.deepEqual(glossaryTerms("MIT undergraduate admission", "Computer Science"), []);
});

test("Restrictive Early Action is its own term and does not also count as Early Action", () => {
  assert.deepEqual(glossaryTerms("Restrictive Early Action"), ["restrictive_early_action"]);
  assert.deepEqual(glossaryTerms("REA priority November 15; RD February 15"), ["restrictive_early_action", "regular_decision"]);
  assert.deepEqual(glossaryTerms("Restrictive Early Action", "Early Action"), ["restrictive_early_action", "early_action"]);
});

test("every term has a title and a one-sentence explanation in all three languages", () => {
  const seen = new Map();
  for (const language of ["eng", "rus", "kaz"]) {
    setLanguage(language, { emit: false });
    for (const term of TERMS) {
      const html = renderTermHelp(term);
      const text = html.match(/ui-tooltip-text">([^<]+)</)?.[1];
      assert.ok(text && text.length > 40 && text.length < 400, `${language}/${term}`);
      assert.ok(html.includes(`data-term="${term}"`));
      if (language === "eng") seen.set(term, text);
      else assert.notEqual(text, seen.get(term), `${language}/${term} is translated`);
    }
  }
  setLanguage("eng", { emit: false });
});

test("a term help is a keyboard and touch operable tooltip", () => {
  const html = renderTermHelp("ucas");
  assert.match(html, /<span class="ui-tooltip-wrap admissions-term"/);
  assert.match(html, /<button type="button" class="ui-tooltip-trigger admissions-term__trigger"/);
  assert.match(html, /aria-label="What is UCAS\?"/);
  assert.match(html, /aria-expanded="false"/);
  const id = html.match(/aria-describedby="([^"]+)"/)[1];
  assert.match(html, new RegExp(`<span id="${id}" class="ui-tooltip-bubble admissions-term__bubble" role="tooltip">`));
  assert.notEqual(renderTermHelp("ucas").match(/aria-describedby="([^"]+)"/)[1], id);
});

test("an unknown term or an empty list renders nothing", () => {
  assert.equal(renderTermHelp("not_a_term"), "");
  assert.equal(renderTermList([]), "");
  assert.match(renderTermList(["ucas", "tmua"]), /^<p class="admissions-term-list">.*data-term="tmua"/s);
});
