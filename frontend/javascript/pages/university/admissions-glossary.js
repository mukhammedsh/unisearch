import { escapeHtml, escapeHtmlAttr } from "../../utils/format.js";
import { t, tFormat } from "../../i18n.js";
import { heroIcon } from "../../icons.js";

// Admissions terms an applicant may not know. Each entry pairs a localization key with the published
// wording that triggers it. Matching uses source fields (route titles, classifications, deadline names),
// never the translated interface text, so every language shows the same explanations.
const TERMS = [
  ["restrictive_early_action", /\bRestrictive Early Action\b|\bREA\b/],
  ["early_action", /\bEarly Action\b/],
  ["regular_action", /\bRegular Action\b/],
  ["regular_decision", /\bRegular Decision\b|\bRD\b/],
  ["ucas", /\bUCAS\b|\bucas_/],
  ["tmua", /\bTMUA\b/],
  ["foundation", /\bNUFYP\b|\bFoundation(?:\/| Year)/],
  ["css_profile", /\bCSS Profile\b/],
  ["fee_status", /\b(?:Home|Overseas) fees?\b|\bfee status\b/i],
];
const RESTRICTIVE = TERMS[0][1];
// Application rounds of a first-year application; a transfer or graduate application has none of them.
const FIRST_YEAR_ROUNDS = new Set(["restrictive_early_action", "early_action", "regular_action", "regular_decision"]);
let sequence = 0;

const flatten = values => values.flat(Infinity).filter(value => typeof value === "string" && value);

// Terms found in the given published wording, in a stable order and without repeats.
export function glossaryTerms(...values) {
  const text = flatten(values).join(" | ");
  const withoutRestrictive = text.replace(new RegExp(RESTRICTIVE.source, "g"), " ");
  return TERMS.filter(([term, matcher]) => matcher.test(term === "restrictive_early_action" ? text : withoutRestrictive)).map(([term]) => term);
}

/**
 * Keeps only the terms that belong to the path being read: a transfer path is not explained with first-year rounds, even
 * when a university-wide record (aid dates) names them.
 * @param {string[]} terms Terms found in the published wording.
 * @param {{applicant_route?: string}|null|undefined} route The selected application route.
 * @returns {string[]}
 */
export const termsForRoute = (terms, route) => route?.applicant_route && route.applicant_route !== "first_year"
  ? terms.filter(term => !FIRST_YEAR_ROUNDS.has(term)) : terms;

// A keyboard- and touch-operable term explanation built on the shared tooltip system.
export function renderTermHelp(term) {
  const title = t(`university.admissions.glossary.${term}.title`);
  const text = t(`university.admissions.glossary.${term}.text`);
  if (!title || !text) return "";
  sequence += 1;
  const id = `admissions-term-${term}-${sequence}`;
  return `<span class="ui-tooltip-wrap admissions-term" data-term="${escapeHtmlAttr(term)}">
    <button type="button" class="ui-tooltip-trigger admissions-term__trigger" aria-label="${escapeHtmlAttr(tFormat("university.admissions.glossary.what_is", { term: title }))}" aria-describedby="${id}" aria-expanded="false">${escapeHtml(title)}${heroIcon("information-circle", "ui-icon ui-icon--16", { "aria-hidden": "true" })}</button>
    <span id="${id}" class="ui-tooltip-bubble admissions-term__bubble" role="tooltip"><strong class="ui-tooltip-title">${escapeHtml(title)}</strong><span class="ui-tooltip-text">${escapeHtml(text)}</span></span>
  </span>`;
}

// Tooltips are positioned absolutely, so they sit beside content rather than inside clipping table wrappers.
// `shown` (optional) collects the terms already explained in the same block, so each term appears once per block.
export function renderTermList(terms, shown = null) {
  const fresh = shown ? terms.filter(term => !shown.has(term)) : terms;
  if (shown) fresh.forEach(term => shown.add(term));
  const items = fresh.map(renderTermHelp).filter(Boolean);
  return items.length ? `<p class="admissions-term-list">${items.join("")}</p>` : "";
}

export const renderTermsFor = (...values) => renderTermList(glossaryTerms(...values));

// The route fields that name how an applicant applies, in the university's own wording.
export const routeWording = route => [route?.title, route?.target, route?.destination, route?.classification];
