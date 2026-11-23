const EN_DASH = "\u2013";
// Hyphen, U+2010, non-breaking hyphen, figure dash and en dash all read as "dash" in source text.
const DASH = String.raw`[-\u2010-\u2013]`;
// A number must stand alone: a letter, digit, path or time separator before it means a code, URL or ISO fragment.
const NUMBER_START = String.raw`(?<![\p{L}\p{N}/.:-])`;
const MONTH_EN = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
// Month stems for Russian and Kazakh; the case ending that follows ("октября", "қазанда") is matched by \p{L}*.
const MONTH_RU_KK = String.raw`(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек|қаң|ақп|нау|сәу|мам|мау|шіл|там|қыр|қаз|жел)\p{L}*`;
const MONTH = String.raw`(?:(?:${MONTH_EN})(?!\p{L})|${MONTH_RU_KK})`;
const YEAR_RANGE = new RegExp(String.raw`${NUMBER_START}((?:19|20)\d{2})\s?${DASH}\s?((?:19|20)\d{2}|\d{2})(?![\p{N}-])`, "gu");
const DAYS_BEFORE_MONTH = new RegExp(String.raw`${NUMBER_START}(\d{1,2})\s?${DASH}\s?(\d{1,2})(?=\s+${MONTH})`, "giu");
const DAYS_AFTER_MONTH = new RegExp(String.raw`(${MONTH}\.?\s+)(\d{1,2})\s?${DASH}\s?(\d{1,2})(?![\p{N}:/-])`, "giu");
const ISO_DATE = /\d{4}-\d{2}-\d{2}(?![\d-])/y;

function isYearRange(left, right) {
  const start = Number(left);
  const end = Number(right);
  // "2026-27" counts as an academic year only when the two-digit end follows the start year within a decade.
  const distance = right.length === 4 ? end - start : (end - (start % 100) + 100) % 100;
  return distance >= 1 && distance <= 10;
}

function isDayRange(first, last) {
  const start = Number(first);
  return start >= 1 && start <= Number(last) && Number(last) <= 31;
}

/**
 * Writes year ranges ("2026-27", "2021 - 2025") and day ranges next to a month ("12-16 October", "March 1-31")
 * with an en dash and no spaces. ISO dates ("2027-01-15"), codes ("6-3"), times and URL paths are left unchanged.
 * Display only; call it on text that is about to be shown, never on stored values.
 * @param {string} text
 * @returns {string}
 */
export function typesetDateRanges(text) {
  return String(text ?? "")
    .replace(YEAR_RANGE, (match, left, right) => (isYearRange(left, right) ? `${left}${EN_DASH}${right}` : match))
    .replace(DAYS_BEFORE_MONTH, (match, first, last) => (isDayRange(first, last) ? `${first}${EN_DASH}${last}` : match))
    .replace(DAYS_AFTER_MONTH, (match, month, first, last) => (isDayRange(first, last) ? `${month}${first}${EN_DASH}${last}` : match));
}

export function stabilizeNumericRanges(text) {
  const source = typesetDateRanges(text || "");
  let output = "";
  let index = 0;
  while (index < source.length) {
    const startsNumber = source.charCodeAt(index) >= 48 && source.charCodeAt(index) <= 57;
    if (!startsNumber) {
      output += source[index++];
      continue;
    }
    // An ISO date keeps its plain hyphens: stabilizing only the first one would mix two hyphen characters.
    ISO_DATE.lastIndex = index;
    if (ISO_DATE.test(source)) {
      output += source.slice(index, index + 10);
      index += 10;
      continue;
    }
    const leftStart = index;
    while (index < source.length && "0123456789.,".includes(source[index])) index += 1;
    const leftEnd = index;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] !== "-") {
      output += source.slice(leftStart, index);
      continue;
    }
    index += 1;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    const rightStart = index;
    while (index < source.length && "0123456789.,".includes(source[index])) index += 1;
    if (rightStart === index) {
      output += source.slice(leftStart, index);
      continue;
    }
    output += `${source.slice(leftStart, leftEnd)}\u2011${source.slice(rightStart, index)}`;
  }
  return output;
}

export function normalizeTranslationKey(value) {
  const source = String(value || "").trim().toLowerCase();
  let key = "";
  let pendingSeparator = false;
  for (const character of source) {
    const code = character.charCodeAt(0);
    const isAlphaNumeric = (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
    if (isAlphaNumeric) {
      if (pendingSeparator && key) key += "_";
      key += character;
      pendingSeparator = false;
    } else if (key) {
      pendingSeparator = true;
    }
  }
  return key;
}

// Drops bracketed parts such as "(IELTS)" from a label and collapses the spaces left behind. A single linear pass
// keeps the cost proportional to the label even with unbalanced brackets, unlike a bracket regular expression.
export function withoutBracketedText(value) {
  let out = "";
  let depth = 0;
  for (const char of String(value ?? "")) {
    if (char === "(") depth += 1;
    else if (char === ")" && depth > 0) depth -= 1;
    else if (depth === 0) out += char;
  }
  return out.replace(/\s+/g, " ").trim();
}
