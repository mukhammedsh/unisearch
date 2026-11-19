#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { analyze } from "@projectwallace/css-analyzer";
import { PurgeCSS } from "purgecss";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const cssDir = path.resolve(frontendDir, "css");
const foundationPath = path.resolve(cssDir, "shared", "01-foundation.css");

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const strictMode = args.has("--strict");

const SIDES = ["top", "right", "bottom", "left"];
const SHORTHANDS = {
  padding: [...SIDES.map((s) => `padding-${s}`), "padding-inline", "padding-block", "padding-inline-start", "padding-inline-end", "padding-block-start", "padding-block-end"],
  "padding-inline": ["padding-left", "padding-right", "padding-inline-start", "padding-inline-end"],
  "padding-block": ["padding-top", "padding-bottom", "padding-block-start", "padding-block-end"],
  margin: [...SIDES.map((s) => `margin-${s}`), "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end"],
  "margin-inline": ["margin-left", "margin-right", "margin-inline-start", "margin-inline-end"],
  "margin-block": ["margin-top", "margin-bottom", "margin-block-start", "margin-block-end"],
  inset: [...SIDES, "inset-inline", "inset-block"],
  gap: ["row-gap", "column-gap", "grid-gap", "grid-row-gap", "grid-column-gap"],
  overflow: ["overflow-x", "overflow-y"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  background: ["background-color", "background-image", "background-position", "background-size", "background-repeat", "background-clip", "background-origin", "background-attachment"],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "grid-template": ["grid-template-rows", "grid-template-columns", "grid-template-areas"],
  "grid-area": ["grid-row-start", "grid-row-end", "grid-column-start", "grid-column-end", "grid-row", "grid-column"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  font: ["font-style", "font-variant", "font-weight", "font-stretch", "font-size", "line-height", "font-family"],
  border: [...SIDES.flatMap((s) => [`border-${s}`, `border-${s}-width`, `border-${s}-style`, `border-${s}-color`]), "border-width", "border-style", "border-color"],
  "border-width": SIDES.map((s) => `border-${s}-width`),
  "border-style": SIDES.map((s) => `border-${s}-style`),
  "border-color": SIDES.map((s) => `border-${s}-color`),
  outline: ["outline-width", "outline-style", "outline-color"],
  transition: ["transition-property", "transition-duration", "transition-timing-function", "transition-delay"],
  animation: ["animation-name", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction", "animation-fill-mode", "animation-play-state"],
  "text-decoration": ["text-decoration-line", "text-decoration-color", "text-decoration-style", "text-decoration-thickness"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
};
for (const side of SIDES) {
  SHORTHANDS[`border-${side}`] = [`border-${side}-width`, `border-${side}-style`, `border-${side}-color`];
}

const MAY_BE_UNSUPPORTED = /dvh|svh|lvh|dvw|color-mix|-webkit-|-moz-|env\(|anchor|light-dark|text-wrap|field-sizing|interpolate-size|calc-size/i;

function touchedLonghands(prop) {
  const out = new Set([prop]);
  const stack = [prop];
  while (stack.length) {
    for (const next of SHORTHANDS[stack.pop()] || []) {
      if (!out.has(next)) {
        out.add(next);
        stack.push(next);
      }
    }
  }
  return out;
}

function covers(later, earlier) {
  if (earlier.startsWith("--")) return later === earlier;
  const touched = touchedLonghands(later);
  for (const longhand of touchedLonghands(earlier)) {
    if (!touched.has(longhand)) return false;
  }
  return true;
}

function contextOf(node) {
  const parts = [];
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
    if (parent.type === "atrule") {
      parts.unshift(`@${parent.name} ${parent.params.replace(/\s+/g, " ").trim()}`);
    }
  }
  return parts;
}

const maxWidth = (context) => {
  const match = /^@media \(max-width: (\d+)px\)(?: and \(min-width: \d+px\))?$/.exec(context);
  return match ? Number(match[1]) : null;
};

function contextImplies(earlier, later) {
  if (later.length === 0) return true;
  if (later.some((p) => p.startsWith("@supports")) && JSON.stringify(earlier) !== JSON.stringify(later)) return false;
  if (earlier.length !== later.length) return false;
  return earlier.every((part, index) => {
    if (part === later[index]) return true;
    const earlierWidth = maxWidth(part);
    const laterWidth = /^@media \(max-width: \d+px\)$/.test(later[index]) ? maxWidth(later[index]) : null;
    return earlierWidth != null && laterWidth != null && laterWidth >= earlierWidth;
  });
}

const normalizeSelector = (selector) =>
  selector
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .sort()
    .join(", ");

export function normalizeAtRuleParams(params) {
  return String(params || "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

/**
 * Split a comma-separated CSS selector list on top-level commas only,
 * preserving commas inside pseudo-class functions (:is, :where, :has) and attributes.
 */
export function splitSelectorList(selector) {
  const parts = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = "";

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < selector.length) {
        current += selector[++i];
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === "(") {
      parenDepth++;
      current += ch;
    } else if (ch === ")" && parenDepth > 0) {
      parenDepth--;
      current += ch;
    } else if (ch === "[") {
      bracketDepth++;
      current += ch;
    } else if (ch === "]" && bracketDepth > 0) {
      bracketDepth--;
      current += ch;
    } else if (ch === "," && parenDepth === 0 && bracketDepth === 0) {
      const trimmed = current.replace(/\s+/g, " ").trim();
      if (trimmed) parts.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }

  const trimmed = current.replace(/\s+/g, " ").trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function stripAttributesAndStrings(selectorPart) {
  return selectorPart
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\[[^\]]*\]/g, "[]");
}

export function extractSelectorIds(selectorPart) {
  const stripped = stripAttributesAndStrings(selectorPart);
  return stripped.match(/#[a-zA-Z_-][a-zA-Z0-9_-]*/g) || [];
}

/**
 * Explicit allowlist of ID selectors keyed by `relFile::normalizedSelectorPart`.
 * Every entry must correspond to a genuine classless element, tab-scoped container,
 * or test/JS-pinned ID target; new ID specificity hacks are rejected by `--strict`.
 */
export const ALLOWED_ID_SELECTORS = new Map([
  [
    "frontend/css/profile/02-page.css::#profileBudgetUnit:focus-visible",
    "Explicitly targeted focus-visible selector for the currency unit toggle (verified by interaction-states E2E tests).",
  ],
  [
    "frontend/css/universities/01-shell-controls.css::.u-compare-mode-btn #compareModeLabel",
    "Classless compare-mode label span inside .u-compare-mode-btn (frontend/index.html).",
  ],
  [
    "frontend/css/universities/07-responsive.css::.u-filter-card #aiSliderContainer",
    "Responsive layout override targeting the AI weight slider field container (frontend/index.html).",
  ],
  [
    "frontend/css/universities/07-responsive.css::.u-compare-mode-btn #compareModeLabel",
    "Responsive label visibility rule for the classless #compareModeLabel span inside .u-compare-mode-btn.",
  ],
  [
    "frontend/css/university/03-admissions.css::#tab-admission .d-box",
    "Tab-scoped admissions layout spacing for .d-box panels inside #tab-admission (frontend/university.html).",
  ],
  [
    "frontend/css/university/03-admissions.css::#detailDeadlines",
    "Deadlines container styling scoped to the #detailDeadlines element (frontend/university.html).",
  ],
  [
    "frontend/css/university/03-admissions.css::#detailDeadlines > :is(.admission-empty-state, .deadlines-timeline-wrapper)",
    "Direct-child layout reset inside the #detailDeadlines container.",
  ],
  [
    "frontend/css/university/05-admissions-reviewed.css::#admissionsUniversityInfo",
    "Dynamically created classless section container for institution-level reviewed admissions info (admissions-controller.js).",
  ],
  [
    "frontend/css/university/05-admissions-reviewed.css::#admissionsUniversityInfo[hidden]",
    "Hidden state override for the classless #admissionsUniversityInfo container.",
  ],
  [
    "frontend/css/university/05-admissions-reviewed.css::#admissionsContextApply",
    "Classless submit button inside .admissions-context__actions (admissions-controller.js).",
  ],
  [
    "frontend/css/university/05-admissions-reviewed.css::#admissionsContextApply:hover:not(:disabled)",
    "Hover state for the classless #admissionsContextApply submit button.",
  ],
  [
    "frontend/css/university/05-admissions-reviewed.css::#admissionsContextApply:active:not(:disabled)",
    "Active state for the classless #admissionsContextApply submit button.",
  ],
]);

export function findDuplicateMediaBlocks(cssContent, relFile = "inline.css") {
  const root = postcss.parse(cssContent, { from: relFile });
  const seen = new Map();

  root.walkAtRules("media", (atRule) => {
    const query = `@media ${normalizeAtRuleParams(atRule.params)}`;
    const context = contextOf(atRule).join(" > ") || "top-level";
    const key = `${context}::${query}`;
    if (!seen.has(key)) {
      seen.set(key, { file: relFile, context, query, lines: [] });
    }
    seen.get(key).lines.push(atRule.source?.start?.line ?? 0);
  });

  return [...seen.values()]
    .filter((entry) => entry.lines.length > 1)
    .map((entry) => ({
      ...entry,
      occurrences: entry.lines.length,
    }));
}

export function analyzeDuplicateMediaBlocks(cssFiles) {
  const duplicates = [];
  for (const filePath of cssFiles) {
    const relFile = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");
    duplicates.push(...findDuplicateMediaBlocks(content, relFile));
  }
  return duplicates;
}

export function findIdSelectors(cssContent, relFile = "inline.css", allowlist = ALLOWED_ID_SELECTORS) {
  const root = postcss.parse(cssContent, { from: relFile });
  const matches = [];

  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const context = contextOf(rule).join(" > ") || "top-level";
    const line = rule.source?.start?.line ?? 0;

    for (const selectorPart of splitSelectorList(rule.selector)) {
      const ids = extractSelectorIds(selectorPart);
      if (ids.length === 0) continue;
      const key = `${relFile}::${selectorPart}`;
      const reason = allowlist.get(key) ?? null;
      matches.push({
        file: relFile,
        line,
        context,
        selector: selectorPart,
        ids,
        key,
        allowed: reason !== null,
        reason,
      });
    }
  });

  return matches;
}

export function analyzeIdSelectors(cssFiles, allowlist = ALLOWED_ID_SELECTORS) {
  const all = [];
  const matchedKeys = new Set();

  for (const filePath of cssFiles) {
    const relFile = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8");
    const found = findIdSelectors(content, relFile, allowlist);
    for (const entry of found) {
      all.push(entry);
      if (entry.allowed) matchedKeys.add(entry.key);
    }
  }

  const unexpected = all.filter((entry) => !entry.allowed);
  const staleAllowlistEntries = [...allowlist.entries()]
    .filter(([key]) => !matchedKeys.has(key))
    .map(([key, reason]) => ({ key, reason }));

  return {
    all,
    unexpected,
    staleAllowlistEntries,
  };
}

function listFiles(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, ext);
    return entry.isFile() && entry.name.endsWith(ext) ? [full] : [];
  });
}

function getHtmlBundles() {
  const htmlFiles = listFiles(frontendDir, ".html").sort();
  return htmlFiles.map((htmlPath) => {
    const html = fs.readFileSync(htmlPath, "utf8");
    const pageName = path.relative(frontendDir, htmlPath).replace(/\\/g, "/");
    const cssLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi)]
      .map((m) => m[1].replace(/\?.*$/, ""))
      .map((href) => path.resolve(frontendDir, href))
      .filter((p) => fs.existsSync(p));
    return { pageName, cssLinks };
  });
}

function analyzeCrossFileCascade(bundles) {
  const crossFileOverrides = [];
  const crossFileDuplicateSelectors = new Map();
  const seenOverrideKey = new Set();

  for (const { pageName, cssLinks } of bundles) {
    const bySelector = new Map();

    for (const cssPath of cssLinks) {
      const relFile = path.relative(rootDir, cssPath).replace(/\\/g, "/");
      const content = fs.readFileSync(cssPath, "utf8");
      const root = postcss.parse(content, { from: relFile });

      root.walkRules((rule) => {
        if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
        const key = normalizeSelector(rule.selector);
        if (!bySelector.has(key)) bySelector.set(key, []);
        bySelector.get(key).push({
          rule,
          relFile,
          context: contextOf(rule),
          line: rule.source?.start?.line ?? 0,
        });
      });
    }

    for (const [selector, list] of bySelector.entries()) {
      if (selector !== ":root") {
        const byContext = new Map();
        for (const item of list) {
          const ctxKey = item.context.join(" ") || "top-level";
          if (!byContext.has(ctxKey)) byContext.set(ctxKey, new Set());
          byContext.get(ctxKey).add(item.relFile);
        }
        for (const [ctxKey, filesSet] of byContext.entries()) {
          if (filesSet.size > 1) {
            const dupKey = ctxKey === "top-level" ? selector : `${selector} (${ctxKey})`;
            if (!crossFileDuplicateSelectors.has(dupKey)) {
              crossFileDuplicateSelectors.set(dupKey, new Set());
            }
            for (const f of filesSet) crossFileDuplicateSelectors.get(dupKey).add(f);
          }
        }
      }

      if (list.length < 2) continue;

      list.forEach((earlier, index) => {
        earlier.rule.each((decl) => {
          if (decl.type !== "decl") return;
          for (const later of list.slice(index + 1)) {
            if (earlier.relFile === later.relFile) continue; // Same-file is caught by Stylelint
            if (!contextImplies(earlier.context, later.context)) continue;
            const winner = later.rule.nodes.find(
              (other) =>
                other.type === "decl" &&
                covers(other.prop, decl.prop) &&
                (!decl.important || other.important) &&
                !MAY_BE_UNSUPPORTED.test(other.value) &&
                !MAY_BE_UNSUPPORTED.test(other.prop)
            );
            if (!winner) continue;

            const dedupeKey = `${earlier.relFile}:${decl.source?.start?.line}:${decl.prop}->${later.relFile}:${winner.source?.start?.line}`;
            if (!seenOverrideKey.has(dedupeKey)) {
              seenOverrideKey.add(dedupeKey);
              crossFileOverrides.push({
                page: pageName,
                selector,
                property: decl.prop,
                earlierFile: earlier.relFile,
                earlierLine: decl.source?.start?.line ?? earlier.line,
                earlierValue: decl.value,
                laterFile: later.relFile,
                laterLine: winner.source?.start?.line ?? later.line,
                laterProperty: winner.prop,
                laterValue: winner.value,
                context: earlier.context.join(" ") || "top-level",
              });
            }
            return;
          }
        });
      });
    }
  }

  return {
    crossFileOverrides,
    crossFileSelectors: [...crossFileDuplicateSelectors.entries()].map(([selector, filesSet]) => ({
      selector,
      files: [...filesSet],
    })),
  };
}

function analyzeCustomPropertiesAndImportants(cssFiles) {
  const foundationTokens = new Set();
  const foundationCss = fs.readFileSync(foundationPath, "utf8");
  const foundationRoot = postcss.parse(foundationCss, { from: foundationPath });
  foundationRoot.walkDecls(/^--/, (decl) => {
    foundationTokens.add(decl.prop);
  });

  const nonFoundationTokens = [];
  const unknownTokenUsages = [];
  const rootBlocksOutsideFoundation = [];
  const darkThemeSelectorsOutsideFoundation = [];
  const importantUsages = [];

  // First collect all defined custom properties across all files
  const allDefinedTokens = new Set(foundationTokens);
  for (const filePath of cssFiles) {
    const relFile = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const root = postcss.parse(fs.readFileSync(filePath, "utf8"), { from: relFile });
    root.walkDecls(/^--/, (decl) => {
      allDefinedTokens.add(decl.prop);
      if (relFile !== "frontend/css/shared/01-foundation.css") {
        nonFoundationTokens.push({
          file: relFile,
          line: decl.source?.start?.line ?? 0,
          selector: decl.parent?.selector?.replace(/\s+/g, " ") || "",
          prop: decl.prop,
          value: decl.value,
        });
      }
    });
  }

  for (const filePath of cssFiles) {
    const relFile = path.relative(rootDir, filePath).replace(/\\/g, "/");
    const root = postcss.parse(fs.readFileSync(filePath, "utf8"), { from: relFile });

    root.walkRules((rule) => {
      if (relFile !== "frontend/css/shared/01-foundation.css" && /\b:root\b/.test(rule.selector)) {
        rootBlocksOutsideFoundation.push({
          file: relFile,
          line: rule.source?.start?.line ?? 0,
          selector: rule.selector.replace(/\s+/g, " "),
        });
      }
      if (relFile !== "frontend/css/shared/01-foundation.css" && /data-theme\s*=\s*["']?dark["']?/i.test(rule.selector)) {
        darkThemeSelectorsOutsideFoundation.push({
          file: relFile,
          line: rule.source?.start?.line ?? 0,
          selector: rule.selector.replace(/\s+/g, " "),
        });
      }
    });

    root.walkDecls((decl) => {
      if (decl.important) {
        const ctx = contextOf(decl).join(" ");
        const isA11yImportant = /prefers-reduced-motion|forced-colors/i.test(ctx) || /\.sr-only|\.visually-hidden|\[hidden\]/i.test(decl.parent?.selector || "");
        importantUsages.push({
          file: relFile,
          line: decl.source?.start?.line ?? 0,
          selector: decl.parent?.selector?.replace(/\s+/g, " ") || "",
          prop: decl.prop,
          value: decl.value,
          context: ctx || "top-level",
          isA11yException: isA11yImportant,
        });
      }

      for (const match of decl.value.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
        const varName = match[1];
        if (!allDefinedTokens.has(varName)) {
          unknownTokenUsages.push({
            file: relFile,
            line: decl.source?.start?.line ?? 0,
            prop: decl.prop,
            varName,
            value: decl.value,
          });
        }
      }
    });
  }

  return {
    foundationTokensCount: foundationTokens.size,
    nonFoundationTokens,
    unknownTokenUsages,
    rootBlocksOutsideFoundation,
    darkThemeSelectorsOutsideFoundation,
    importantUsages,
  };
}

async function analyzeDeadCssWithPurgeCss(cssFiles) {
  const contentFiles = [
    ...listFiles(frontendDir, ".html"),
    ...listFiles(frontendDir, ".js"),
  ];

  // Join all markup/JS once and extract whole tokens (including dynamic prefixes detected in JS)
  const rawContents = contentFiles.map((file) => ({
    raw: fs.readFileSync(file, "utf8"),
    extension: path.extname(file).slice(1),
  }));

  const cssInputs = cssFiles.map((file) => ({
    raw: fs.readFileSync(file, "utf8"),
    name: path.relative(rootDir, file).replace(/\\/g, "/"),
  }));

  const purgeResults = await new PurgeCSS().purge({
    content: rawContents,
    css: cssInputs,
    rejected: true,
    safelist: {
      standard: [
        /^leaflet-/,
        /^marker-/,
        /^h[1-6]$/,
        /^video$/,
        /^uni-status-trigger--/,
        /^compare-cell--/,
        /^compare-decision-status--/,
        /^qualification-guidance__status--/,
        /^finance-fee-status-badge--/,
        /^finance-aid-badge--/,
        /data-filled/,
      ],
    },
    defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) || [],
  });

  const rejectedByFile = purgeResults
    .map((res, index) => ({
      file: cssInputs[index].name,
      rejectedSelectors: (res.rejected || []).map((s) => s.replace(/\s+/g, " ").trim()),
    }))
    .filter((item) => item.rejectedSelectors.length > 0);

  return rejectedByFile;
}

function analyzeWithProjectWallace(cssFiles) {
  const combinedCss = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const stats = analyze(combinedCss);

  const perFileStats = cssFiles.map((f) => {
    const relFile = path.relative(rootDir, f).replace(/\\/g, "/");
    const content = fs.readFileSync(f, "utf8");
    const s = analyze(content);
    return {
      file: relFile,
      lines: content.split("\n").length,
      rules: s.rules.total,
      selectors: s.selectors.total,
      uniqueSelectors: s.selectors.totalUnique,
      duplicateSelectorsRatio: s.selectors.total > 0 ? Number(((1 - s.selectors.totalUnique / s.selectors.total) * 100).toFixed(1)) : 0,
      maxSpecificity: s.selectors.specificity.max.join(","),
      importants: s.declarations.importants.total,
      uniqueColors: s.values.colors.totalUnique,
    };
  });

  return {
    overall: {
      totalLines: combinedCss.split("\n").length,
      totalRules: stats.rules.total,
      totalSelectors: stats.selectors.total,
      uniqueSelectors: stats.selectors.totalUnique,
      totalDeclarations: stats.declarations.total,
      uniqueDeclarations: stats.declarations.totalUnique,
      importants: stats.declarations.importants.total,
      maxSpecificity: stats.selectors.specificity.max,
    },
    perFileStats,
  };
}

export async function buildAuditReport(cssFiles = listFiles(cssDir, ".css").sort()) {
  const bundles = getHtmlBundles();

  const wallace = analyzeWithProjectWallace(cssFiles);
  const cascade = analyzeCrossFileCascade(bundles);
  const tokensAndImportants = analyzeCustomPropertiesAndImportants(cssFiles);
  const deadCss = await analyzeDeadCssWithPurgeCss(cssFiles);
  const duplicateMediaBlocks = analyzeDuplicateMediaBlocks(cssFiles);
  const idSelectors = analyzeIdSelectors(cssFiles);

  const totalDeadSelectors = deadCss.reduce((acc, f) => acc + f.rejectedSelectors.length, 0);
  const nonA11yImportants = tokensAndImportants.importantUsages.filter((i) => !i.isA11yException);

  return {
    cssFiles,
    totalDeadSelectors,
    nonA11yImportants,
    report: {
      overall: wallace.overall,
      perFileStats: wallace.perFileStats,
      summary: {
        crossFileOverridesCount: cascade.crossFileOverrides.length,
        crossFileSelectorsCount: cascade.crossFileSelectors.length,
        deadSelectorsCount: totalDeadSelectors,
        nonA11yImportantsCount: nonA11yImportants.length,
        totalImportantsCount: tokensAndImportants.importantUsages.length,
        nonFoundationCustomPropsCount: tokensAndImportants.nonFoundationTokens.length,
        rootBlocksOutsideFoundationCount: tokensAndImportants.rootBlocksOutsideFoundation.length,
        darkThemeSelectorsOutsideFoundationCount: tokensAndImportants.darkThemeSelectorsOutsideFoundation.length,
        unknownTokenUsagesCount: tokensAndImportants.unknownTokenUsages.length,
        duplicateMediaBlocksCount: duplicateMediaBlocks.length,
        idSelectorsCount: idSelectors.all.length,
        unexpectedIdSelectorsCount: idSelectors.unexpected.length,
      },
      cascade,
      tokensAndImportants,
      deadCss,
      duplicateMediaBlocks,
      idSelectors,
    },
  };
}

async function run() {
  const { cssFiles, totalDeadSelectors, nonA11yImportants, report } = await buildAuditReport();
  const { cascade, tokensAndImportants, deadCss, duplicateMediaBlocks, idSelectors } = report;

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("=== UniSearch Deep CSS Architecture & Cascade Audit ===");
  console.log(
    `Files: ${cssFiles.length} | Lines: ${report.overall.totalLines} | Rules: ${report.overall.totalRules} | Selectors: ${report.overall.totalSelectors} (${report.overall.uniqueSelectors} unique)`
  );
  console.log("\n--- Per-File Complexity (@projectwallace/css-analyzer) ---");
  console.table(report.perFileStats);

  console.log("\n--- Key Structural Issues Summary ---");
  console.table(report.summary);

  if (cascade.crossFileOverrides.length > 0) {
    const byPair = new Map();
    for (const o of cascade.crossFileOverrides) {
      const pairKey = `${o.earlierFile.replace("frontend/css/", "")} -> ${o.laterFile.replace("frontend/css/", "")}`;
      byPair.set(pairKey, (byPair.get(pairKey) || 0) + 1);
    }
    console.log("\n--- Top Cross-File Override Pairs (Earlier File -> Overridden By Later File) ---");
    console.table(
      [...byPair.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([filePair, overriddenDeclarations]) => ({ filePair, overriddenDeclarations }))
    );
  }

  if (cascade.crossFileOverrides.length > 0) {
    console.log(`\n--- Cross-File Property Overrides (${cascade.crossFileOverrides.length} dead declarations overridden by later files) ---`);
    cascade.crossFileOverrides.slice(0, 30).forEach((o) => {
      console.log(
        `  [${o.page}] "${o.selector}" (${o.context}): ${o.property}: ${o.earlierValue} in ${o.earlierFile}:${o.earlierLine} -> OVERRIDDEN by ${o.laterProperty}: ${o.laterValue} in ${o.laterFile}:${o.laterLine}`
      );
    });
    if (cascade.crossFileOverrides.length > 30) {
      console.log(`  ... and ${cascade.crossFileOverrides.length - 30} more cross-file overrides.`);
    }
  }

  if (tokensAndImportants.rootBlocksOutsideFoundation.length > 0) {
    console.log(`\n--- :root Blocks Outside 01-foundation.css (${tokensAndImportants.rootBlocksOutsideFoundation.length}) ---`);
    tokensAndImportants.rootBlocksOutsideFoundation.forEach((r) => {
      console.log(`  ${r.file}:${r.line} -> ${r.selector}`);
    });
  }

  if (tokensAndImportants.darkThemeSelectorsOutsideFoundation.length > 0) {
    console.log(`\n--- [data-theme="dark"] Selectors Outside 01-foundation.css (${tokensAndImportants.darkThemeSelectorsOutsideFoundation.length}) ---`);
    tokensAndImportants.darkThemeSelectorsOutsideFoundation.forEach((d) => {
      console.log(`  ${d.file}:${d.line} -> ${d.selector}`);
    });
  }

  if (cascade.crossFileSelectors.length > 0) {
    console.log(`\n--- Same-Context Cross-File Duplicate Selectors (${cascade.crossFileSelectors.length}) ---`);
    cascade.crossFileSelectors.forEach((s) => {
      console.log(`  "${s.selector}" in ${s.files.join(", ")}`);
    });
  }

  if (tokensAndImportants.unknownTokenUsages.length > 0) {
    console.log(`\n--- Unknown CSS Custom Properties (${tokensAndImportants.unknownTokenUsages.length}) ---`);
    tokensAndImportants.unknownTokenUsages.forEach((u) => {
      console.log(`  ${u.file}:${u.line} -> ${u.prop}: ${u.value} (unknown: ${u.varName})`);
    });
  }

  if (nonA11yImportants.length > 0) {
    console.log(`\n--- Non-A11y !important Hacks (${nonA11yImportants.length}) ---`);
    nonA11yImportants.slice(0, 25).forEach((imp) => {
      console.log(`  ${imp.file}:${imp.line} [${imp.selector}] -> ${imp.prop}: ${imp.value} !important`);
    });
    if (nonA11yImportants.length > 25) {
      console.log(`  ... and ${nonA11yImportants.length - 25} more.`);
    }
  }

  if (duplicateMediaBlocks.length > 0) {
    console.log(`\n--- Fragmented Duplicate @media Blocks (${duplicateMediaBlocks.length}) ---`);
    duplicateMediaBlocks.forEach((dup) => {
      console.log(`  ${dup.file} (${dup.context}): ${dup.query} at lines ${dup.lines.join(", ")}`);
    });
  }

  if (idSelectors.unexpected.length > 0) {
    console.log(`\n--- Unexpected ID Selectors (${idSelectors.unexpected.length}) ---`);
    idSelectors.unexpected.forEach((entry) => {
      console.log(`  ${entry.file}:${entry.line} (${entry.context}) -> ${entry.selector} [ids: ${entry.ids.join(", ")}]`);
    });
  }

  if (idSelectors.staleAllowlistEntries.length > 0) {
    console.log(`\n--- Stale ALLOWED_ID_SELECTORS Entries (${idSelectors.staleAllowlistEntries.length}) ---`);
    idSelectors.staleAllowlistEntries.forEach((entry) => {
      console.log(`  ${entry.key} (${entry.reason})`);
    });
  }

  if (deadCss.length > 0) {
    console.log(`\n--- Unused CSS Selectors via PurgeCSS (${totalDeadSelectors} total across ${deadCss.length} files) ---`);
    deadCss.forEach((d) => {
      console.log(`  ${d.file} (${d.rejectedSelectors.length}): ${d.rejectedSelectors.slice(0, 8).join(" | ")}${d.rejectedSelectors.length > 8 ? " ..." : ""}`);
    });
  }

  if (
    strictMode &&
    (cascade.crossFileOverrides.length > 0 ||
      cascade.crossFileSelectors.length > 0 ||
      tokensAndImportants.unknownTokenUsages.length > 0 ||
      tokensAndImportants.rootBlocksOutsideFoundation.length > 0 ||
      tokensAndImportants.darkThemeSelectorsOutsideFoundation.length > 0 ||
      totalDeadSelectors > 0 ||
      nonA11yImportants.length > 0 ||
      duplicateMediaBlocks.length > 0 ||
      idSelectors.unexpected.length > 0)
  ) {
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
