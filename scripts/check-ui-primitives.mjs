#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const jsDir = path.resolve(frontendDir, "javascript");

const NON_TEXT_INPUT_TYPES = new Set(["hidden", "range", "radio", "checkbox", "submit", "reset", "button", "file", "image", "color"]);

const STRUCTURAL_BUTTON_CLASSES = new Set([
  "ui-segmented__item",
  "ui-tooltip-trigger",
  "d-tab-btn",
  "profile-section-tab",
  "u-saved-filter__btn",
  "programs-level-tab",
  "admissions-level-tab",
  "requirement-profile-tab",
  "u-info",
  "d-info",
  "profile-info",
  "uni-status-trigger",
  "uni-status-overflow-trigger",
  "program-card__toggle",
  "compare-picker__option",
  "compare-picker__level",
  "compare-reviewed__fee-option",
  "admission-program-option",
  "profile-inline-link",
  "admissions-key-facts__link",
  "admissions-catalog__record-link",
  "overview-summary__link",
  "profile-unit--toggle",
  "deadline-calendar__day",
  "deadline-calendar__jump",
  "d-gallery-preview",
  "d-gallery-button",
  "custom-select-trigger",
]);

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, ext);
    return entry.isFile() && entry.name.endsWith(ext) ? [full] : [];
  });
}

function readAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*`, "i");
  const match = re.exec(tag);
  if (!match) return null;
  let idx = match.index + match[0].length;
  const quote = tag[idx];
  if (quote !== '"' && quote !== "'" && quote !== "`") {
    const end = tag.slice(idx).search(/[\s>]/);
    return end < 0 ? tag.slice(idx) : tag.slice(idx, idx + end);
  }
  idx++;
  const start = idx;
  let exprDepth = 0;
  while (idx < tag.length) {
    const ch = tag[idx];
    if (ch === "\\" && idx + 1 < tag.length) {
      idx += 2;
      continue;
    }
    if (ch === "$" && tag[idx + 1] === "{") {
      exprDepth++;
      idx += 2;
      continue;
    }
    if (exprDepth > 0) {
      if (ch === "{") exprDepth++;
      else if (ch === "}") exprDepth--;
      idx++;
      continue;
    }
    if (ch === quote) break;
    idx++;
  }
  return tag.slice(start, idx);
}

function classTokens(rawClass) {
  if (!rawClass) return [];
  return String(rawClass)
    .replace(/\$\{[^}]*\}/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function maskComments(source, isJs) {
  const out = [];
  let idx = 0;
  let quote = "";
  while (idx < source.length) {
    const ch = source[idx];
    const next = source[idx + 1];
    if (!isJs) {
      if (source.startsWith("<!--", idx)) {
        const end = source.indexOf("-->", idx + 4);
        const stop = end < 0 ? source.length : end + 3;
        out.push(source.slice(idx, stop).replace(/[^\n]/g, " "));
        idx = stop;
        continue;
      }
      out.push(ch);
      idx++;
      continue;
    }
    if (quote) {
      out.push(ch);
      if (ch === "\\" && idx + 1 < source.length) {
        out.push(next);
        idx += 2;
        continue;
      }
      if (ch === quote) quote = "";
      idx++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out.push(ch);
      idx++;
      continue;
    }
    if (ch === "/" && next === "/") {
      const nl = source.indexOf("\n", idx);
      const stop = nl < 0 ? source.length : nl;
      out.push(" ".repeat(stop - idx));
      idx = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", idx + 2);
      const stop = end < 0 ? source.length : end + 2;
      out.push(source.slice(idx, stop).replace(/[^\n]/g, " "));
      idx = stop;
      continue;
    }
    out.push(ch);
    idx++;
  }
  return out.join("");
}

/**
 * Extract `<input>`, `<textarea>`, `<select>`, and `<button>` start tags while ignoring comments and `>` inside quotes or `${...}`.
 * @param {string} content
 * @param {string} [relPath]
 * @returns {Array<{ tag: string, line: number, raw: string }>}
 */
export function extractMarkupTags(content, relPath = "") {
  const tags = [];
  const isJs = relPath.endsWith(".js");
  const source = maskComments(String(content || ""), isJs);
  const startRe = /<(input|textarea|select|button)(?=[\s>/])/gi;
  let match;

  while ((match = startRe.exec(source)) !== null) {
    const tagName = match[1].toLowerCase();
    let idx = match.index + match[0].length;
    let quote = "";
    let exprDepth = 0;

    while (idx < source.length) {
      const ch = source[idx];
      if (quote) {
        if (ch === "\\" && idx + 1 < source.length) {
          idx += 2;
          continue;
        }
        if (quote === "`" && ch === "$" && source[idx + 1] === "{") {
          exprDepth++;
          idx += 2;
          continue;
        }
        if (ch === quote && exprDepth === 0) {
          quote = "";
        }
      } else if (exprDepth > 0) {
        if (ch === "{") exprDepth++;
        else if (ch === "}") exprDepth--;
      } else {
        if (ch === "$" && source[idx + 1] === "{") {
          exprDepth++;
          idx += 2;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          quote = ch;
        } else if (ch === ">") {
          idx++;
          break;
        }
      }
      idx++;
    }

    const line = source.slice(0, match.index).split(/\r?\n/).length;
    const raw = source.slice(match.index, idx).replace(/\s+/g, " ").trim();
    tags.push({ tag: tagName, line, raw });
  }

  return tags;
}

function isStructuralButton(rawTag, classes) {
  const role = (readAttr(rawTag, "role") || "").trim().toLowerCase();
  if (role === "tab" || role === "option") return true;
  if (/\bdata-tabs-(?:previous|next)\b/i.test(rawTag)) return true;
  return classes.some((cls) => STRUCTURAL_BUTTON_CLASSES.has(cls));
}

/**
 * Inspect HTML or JS source text for UI primitive compliance.
 * @param {string} content
 * @param {string} relPath
 */
export function inspectMarkupFile(content, relPath) {
  const tags = extractMarkupTags(content, relPath);
  const violations = [];
  const counts = {
    inputs: { total: 0, adopted: 0 },
    switches: { total: 0, adopted: 0 },
    selects: { total: 0, adopted: 0 },
    buttons: { total: 0, adopted: 0, structuralExcluded: 0 },
  };

  for (const { tag, line, raw } of tags) {
    const classes = classTokens(readAttr(raw, "class"));

    if (tag === "input") {
      const typeAttr = readAttr(raw, "type");
      const roleAttr = (readAttr(raw, "role") || "").trim().toLowerCase();
      if (typeAttr === null) {
        counts.inputs.total++;
        violations.push({ file: relPath, line, tag, reason: "Missing explicit type attribute on <input>", snippet: raw });
        continue;
      }
      const normalizedType = typeAttr.trim().toLowerCase();
      if (roleAttr === "switch") {
        counts.switches.total++;
        if (classes.includes("ui-switch")) counts.switches.adopted++;
        else violations.push({ file: relPath, line, tag, reason: "Switch <input role=\"switch\"> must use .ui-switch", snippet: raw });
        continue;
      }
      if (NON_TEXT_INPUT_TYPES.has(normalizedType)) continue;
      counts.inputs.total++;
      if (classes.includes("ui-input")) counts.inputs.adopted++;
      else violations.push({ file: relPath, line, tag, reason: `<input type="${normalizedType}"> must use .ui-input`, snippet: raw });
      continue;
    }

    if (tag === "textarea") {
      counts.inputs.total++;
      if (classes.includes("ui-input")) counts.inputs.adopted++;
      else violations.push({ file: relPath, line, tag, reason: "<textarea> must use .ui-input", snippet: raw });
      continue;
    }

    if (tag === "select") {
      counts.selects.total++;
      if (classes.includes("ui-select")) counts.selects.adopted++;
      else violations.push({ file: relPath, line, tag, reason: "<select> must use .ui-select", snippet: raw });
      continue;
    }

    if (tag === "button") {
      if (isStructuralButton(raw, classes)) {
        counts.buttons.structuralExcluded++;
        continue;
      }
      counts.buttons.total++;
      if (classes.includes("ui-btn")) counts.buttons.adopted++;
      else violations.push({ file: relPath, line, tag, reason: "Action <button> must use .ui-btn", snippet: raw });
    }
  }

  return { counts, violations };
}

export function runUiPrimitivesAudit(files = [...listFiles(frontendDir, ".html"), ...listFiles(jsDir, ".js")].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
  const totals = {
    inputs: { total: 0, adopted: 0 },
    switches: { total: 0, adopted: 0 },
    selects: { total: 0, adopted: 0 },
    buttons: { total: 0, adopted: 0, structuralExcluded: 0 },
  };
  const violations = [];

  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");
    const res = inspectMarkupFile(content, relPath);
    for (const key of ["inputs", "switches", "selects"]) {
      totals[key].total += res.counts[key].total;
      totals[key].adopted += res.counts[key].adopted;
    }
    totals.buttons.total += res.counts.buttons.total;
    totals.buttons.adopted += res.counts.buttons.adopted;
    totals.buttons.structuralExcluded += res.counts.buttons.structuralExcluded;
    violations.push(...res.violations);
  }

  return { filesCount: files.length, totals, violations };
}

function pct(adopted, total) {
  return total === 0 ? "100.0%" : `${((adopted / total) * 100).toFixed(1)}%`;
}

function main() {
  const strictMode = new Set(process.argv.slice(2)).has("--strict");
  const { filesCount, totals, violations } = runUiPrimitivesAudit();

  console.log("=== UniSearch UI Primitives Adoption Guard ===");
  console.log(`Scanned ${filesCount} HTML & JS files:`);
  console.table([
    { primitive: ".ui-input (text/number/search/date/textarea)", adopted: totals.inputs.adopted, total: totals.inputs.total, coverage: pct(totals.inputs.adopted, totals.inputs.total) },
    { primitive: ".ui-switch (role=\"switch\")", adopted: totals.switches.adopted, total: totals.switches.total, coverage: pct(totals.switches.adopted, totals.switches.total) },
    { primitive: ".ui-select (<select>)", adopted: totals.selects.adopted, total: totals.selects.total, coverage: pct(totals.selects.adopted, totals.selects.total) },
    { primitive: ".ui-btn (action <button>, excl. structural)", adopted: totals.buttons.adopted, total: totals.buttons.total, coverage: pct(totals.buttons.adopted, totals.buttons.total) },
  ]);
  console.log(`Structural non-action buttons excluded: ${totals.buttons.structuralExcluded}`);

  if (violations.length > 0) {
    console.error(`\n[check:ui-primitives] Found ${violations.length} primitive violation(s):`);
    violations.forEach((v) => {
      console.error(`  ${v.file}:${v.line} -> ${v.reason}\n    ${v.snippet.slice(0, 140)}`);
    });
    if (strictMode) process.exit(1);
  } else {
    console.log("\n[check:ui-primitives] PERFECT! 100% UI primitive compliance across all controls.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
