export function stabilizeNumericRanges(text) {
  const source = String(text || "");
  let output = "";
  let index = 0;
  while (index < source.length) {
    const startsNumber = source.charCodeAt(index) >= 48 && source.charCodeAt(index) <= 57;
    if (!startsNumber) {
      output += source[index++];
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
