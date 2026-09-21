#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const cssDir = path.resolve(rootDir, "frontend", "css");
const baselinePath = path.resolve(scriptDir, "design-lint-baseline.json");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");
const updateBaseline = args.has("--update-baseline");
const verbose = args.has("--verbose") || args.has("-v");
const targetFile = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1];

// Allowed font sizes in px: 0, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64
const ALLOWED_FONT_SIZES = new Set([0, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64]);
// Allowed border-radii in px: 0, 1, 2, 4, 8, 10, 12, 16, 20
const ALLOWED_RADII = new Set([0, 1, 2, 4, 8, 10, 12, 16, 20]);
// Allowed raw z-indices (local pseudo/stacking context only): -1, 0, 1, 2
const ALLOWED_Z_INDICES = new Set([-1, 0, 1, 2]);
// Calm Academic Workspace uses a restrained three-step weight hierarchy.
const ALLOWED_FONT_WEIGHTS = new Set([400, 500, 600]);

function suggestFontToken(pxVal) {
  if (pxVal <= 11.5) return "var(--text-xs) (11px)";
  if (pxVal <= 13.5) return "var(--text-sm) (13px)";
  if (pxVal <= 15) return "var(--text-base) (14px)";
  if (pxVal <= 17) return "var(--text-md) (16px)";
  if (pxVal <= 19) return "var(--text-lg) (18px)";
  if (pxVal <= 22) return "var(--text-xl) (20px)";
  if (pxVal <= 26) return "var(--text-2xl) (24px)";
  return "var(--text-3xl) (28px)";
}

function suggestSpacingToken(pxVal) {
  const rounded = Math.round(pxVal / 4) * 4;
  if (rounded === 4) return "var(--space-1) (4px)";
  if (rounded === 8) return "var(--space-2) (8px)";
  if (rounded === 12) return "var(--space-3) (12px)";
  if (rounded === 16) return "var(--space-4) (16px)";
  if (rounded === 20) return "var(--space-5) (20px)";
  if (rounded === 24) return "var(--space-6) (24px)";
  if (rounded === 32) return "var(--space-8) (32px)";
  if (rounded === 48) return "var(--space-12) (48px)";
  if (rounded === 64) return "var(--space-16) (64px)";
  return `${rounded}px`;
}

function suggestRadiusToken(pxVal) {
  if (pxVal <= 5) return "var(--radius-xs) (4px)";
  if (pxVal <= 9) return "var(--radius-sm) (8px)";
  if (pxVal <= 11) return "var(--radius-md) (10px)";
  if (pxVal <= 13) return "var(--radius-base) (12px)";
  if (pxVal <= 17) return "var(--radius-lg) (16px)";
  return "var(--radius-xl) (20px)";
}

function suggestZIndexToken(num) {
  if (num >= 8000) return "var(--z-modal) (8000)";
  if (num >= 2000) return "var(--z-drawer) (2000)";
  if (num >= 1200) return "var(--z-dropdown) (1200)";
  if (num >= 1000) return "var(--z-nav) (1000)";
  if (num >= 40) return "var(--z-dropdown) (1200) or isolate parent stacking context";
  return "Local layer 0, 1, 2 or isolate stacking context";
}

function cssDeclarations(line) {
  return String(line || "")
    .split(";")
    .map((part) => {
      const separator = part.indexOf(":");
      if (separator < 0) return null;
      return {
        property: part.slice(0, separator).trim().toLowerCase(),
        value: part.slice(separator + 1).trim(),
      };
    })
    .filter(Boolean);
}

function declarationValue(line, predicate) {
  return cssDeclarations(line).find(({ property }) => predicate(property))?.value || null;
}

function pixelValues(value) {
  const source = String(value || "");
  const values = [];
  for (let index = 0; index < source.length; index += 1) {
    const startsNegative = source[index] === "-" && source.charCodeAt(index + 1) >= 48 && source.charCodeAt(index + 1) <= 57;
    const startsDigit = source.charCodeAt(index) >= 48 && source.charCodeAt(index) <= 57;
    if (!startsNegative && !startsDigit) continue;
    const start = index;
    if (startsNegative) index += 1;
    while (source.charCodeAt(index) >= 48 && source.charCodeAt(index) <= 57) index += 1;
    if (source[index] === ".") {
      index += 1;
      while (source.charCodeAt(index) >= 48 && source.charCodeAt(index) <= 57) index += 1;
    }
    if (source.slice(index, index + 2).toLowerCase() !== "px") {
      continue;
    }
    values.push({ text: source.slice(start, index + 2), value: Number.parseFloat(source.slice(start, index)) });
    index += 1;
  }
  return values;
}

function listCssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
  });
}

function scanCssFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const isStyleCss = path.basename(filePath) === "style.css";

  // Mask multiline comments while preserving exact line positions
  const maskedContent = content.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " ")
  );

  const lines = maskedContent.split("\n");
  const rawLines = content.split("\n");
  const violations = [];

  let inRootBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawLine = rawLines[i];
    const trimmed = line.trim();

    if (isStyleCss) {
      if (trimmed.startsWith(":root")) inRootBlock = true;
      if (inRootBlock && trimmed.endsWith("}") && !trimmed.includes("{")) inRootBlock = false;
      if (inRootBlock && trimmed.startsWith("--")) continue;
    }

    // Ignore lines that are fully commented out or empty
    if (!trimmed || trimmed.startsWith("//")) continue;

    // 1. Check font-size
    const fontSizeValue = declarationValue(line, (property) => property === "font-size");
    if (fontSizeValue) {
      const valStr = fontSizeValue;
      // Check for fractional px (e.g. 11.5px, 12.5px, 13.5px)
      const fracMatch = valStr.match(/\b(\d+\.\d+)px\b/i);
      if (fracMatch) {
        const num = Number.parseFloat(fracMatch[1]);
        violations.push({
          line: i + 1,
          type: "typography-fractional",
          message: `Fractional font-size "${fracMatch[0]}" is forbidden`,
          code: rawLine.trim(),
          suggestion: suggestFontToken(num),
        });
      } else {
        // Check for non-scale integer px
        const intMatch = valStr.match(/\b(\d+)px\b/i);
        if (intMatch && !valStr.includes("clamp(") && !valStr.includes("calc(")) {
          const num = Number.parseInt(intMatch[1], 10);
          if (!ALLOWED_FONT_SIZES.has(num)) {
            violations.push({
              line: i + 1,
              type: "typography-non-scale",
              message: `Non-scale font-size "${intMatch[0]}"`,
              code: rawLine.trim(),
              suggestion: suggestFontToken(num),
            });
          }
        }
      }
    }

    // 2. Check font weight (avoid heavy, visually noisy typography)
    const fontWeightValue = declarationValue(line, (property) => property === "font-weight");
    if (fontWeightValue) {
      const valStr = fontWeightValue.toLowerCase();
      const keywordWeight = valStr === "normal" ? 400 : valStr === "bold" ? 700 : null;
      const numericWeight = keywordWeight ?? (/^\d+$/.test(valStr) ? Number.parseInt(valStr, 10) : null);

      if (numericWeight !== null && !ALLOWED_FONT_WEIGHTS.has(numericWeight)) {
        violations.push({
          line: i + 1,
          type: "typography-font-weight",
          message: `Font weight "${valStr}" is outside the 400/500/600 hierarchy`,
          code: rawLine.trim(),
          suggestion: numericWeight < 500 ? "400 for body copy" : "500 for controls or 600 for primary emphasis",
        });
      }
    }

    // 3. Check negative margins (anti-pattern: layout compensation hack)
    const marginVal = declarationValue(line, (property) => property === "margin" || property.startsWith("margin-"));
    if (marginVal) {
      // Allow browser engine workaround for webkit range slider thumb centering
      const isSliderThumb = rawLines.slice(Math.max(0, i - 20), i + 1).some((l) => l.includes("::-webkit-slider-thumb"));
      // Allow standard W3C visually-hidden / sr-only utility (clip: rect, 1px)
      const isVisuallyHidden = rawLines
        .slice(Math.max(0, i - 5), Math.min(rawLines.length, i + 6))
        .some((l) => l.includes("clip: rect") || l.includes("clip-path: inset"));

      if (pixelValues(marginVal).some(({ value }) => value < 0) && !isSliderThumb && !isVisuallyHidden) {
        violations.push({
          line: i + 1,
          type: "spacing-negative-margin",
          message: `Negative margin is forbidden (anti-pattern layout hack)`,
          code: rawLine.trim(),
          suggestion: "Remove negative margin; use parent display:flex/grid gap or align-items",
        });
      }
    }

    // 4. Check !important in margin / padding
    if (/\b(margin|padding)(-[a-z]+)?\s*:[^;]+!important/i.test(line)) {
      violations.push({
        line: i + 1,
        type: "spacing-important-hack",
        message: `!important on margin/padding is forbidden`,
        code: rawLine.trim(),
        suggestion: "Eliminate specificity conflict instead of using !important",
      });
    }

    // 5. Check odd/arbitrary spacing in margin, padding, gap (non 4/8px)
    const spacingDeclaration = cssDeclarations(line).find(({ property }) => ["margin", "padding", "gap", "row-gap", "column-gap"].includes(property));
    if (spacingDeclaration) {
      const prop = spacingDeclaration.property;
      const valStr = spacingDeclaration.value;
      if (!valStr.includes("calc(") && !valStr.includes("clamp(") && !valStr.includes("var(")) {
        // Find all px values in the declaration
        for (const { text, value: num } of pixelValues(valStr)) {
          const absNum = Math.abs(num);
          // Allow 0, 1px, 2px (for fine borders/dividers) and numbers divisible by 4
          if (absNum > 2 && absNum % 4 !== 0) {
            violations.push({
              line: i + 1,
              type: "spacing-non-4px-grid",
              message: `Arbitrary ${prop} value "${text}" violates 4/8px grid scale`,
              code: rawLine.trim(),
              suggestion: suggestSpacingToken(absNum),
            });
          }
        }
      }
    }

    // 6. Check z-index (prevent arbitrary layer escalation)
    const zIndexValue = declarationValue(line, (property) => property === "z-index");
    if (zIndexValue) {
      const valStr = zIndexValue;
      if (!valStr.includes("var(") && !valStr.includes("calc(") && !["auto", "inherit", "initial", "unset"].includes(valStr)) {
        const num = Number.parseInt(valStr, 10);
        if (Number.isNaN(num) || !ALLOWED_Z_INDICES.has(num)) {
          violations.push({
            line: i + 1,
            type: "layer-z-index-arbitrary",
            message: `Arbitrary z-index "${valStr}" violates layering scale`,
            code: rawLine.trim(),
            suggestion: suggestZIndexToken(num),
          });
        }
      }
    }

    // 7. Check border-radius (!important and non-scale radius)
    if (/\bborder(-[a-z]+)*-radius\s*:[^;]+!important/i.test(line)) {
      violations.push({
        line: i + 1,
        type: "radius-important-hack",
        message: `!important on border-radius is forbidden`,
        code: rawLine.trim(),
        suggestion: "Eliminate specificity conflict instead of using !important",
      });
    }

    const radiusValue = declarationValue(line, (property) => property.startsWith("border-") && property.endsWith("-radius"));
    if (radiusValue) {
      const valStr = radiusValue;
      if (!valStr.includes("calc(") && !valStr.includes("clamp(") && !valStr.includes("var(") && !valStr.includes("%") && !valStr.includes("999px") && !valStr.includes("9999px")) {
        for (const { text, value: num } of pixelValues(valStr)) {
          const absNum = Math.abs(num);
          if (!ALLOWED_RADII.has(absNum)) {
            violations.push({
              line: i + 1,
              type: "radius-non-scale",
              message: `Non-scale border-radius "${text}" violates radius scale`,
              code: rawLine.trim(),
              suggestion: suggestRadiusToken(absNum),
            });
          }
        }
      }
    }
  }

  return { relPath, violations };
}

function loadBaseline() {
  if (fs.existsSync(baselinePath)) {
    try {
      return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveBaseline(baseline) {
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  console.log(`[check:design-lint] Baseline successfully updated at ${path.relative(rootDir, baselinePath)}`);
}

function run() {
  if (!fs.existsSync(cssDir)) {
    console.error(`[check:design-lint] CSS directory not found: ${cssDir}`);
    process.exit(1);
  }

  const cssFiles = listCssFiles(cssDir)
    .filter((filePath) => !targetFile || filePath.includes(targetFile))
    .sort();

  const scanResults = cssFiles.map(scanCssFile);
  const baseline = loadBaseline();
  const newBaseline = {};

  let totalViolations = 0;
  let regressionDetected = false;
  const regressionDetails = [];
  const fileSummaries = [];

  for (const { relPath, violations } of scanResults) {
    const count = violations.length;
    totalViolations += count;
    newBaseline[relPath] = count;

    const allowedBaseline = baseline[relPath] !== undefined ? baseline[relPath] : 0;

    fileSummaries.push({
      file: relPath,
      violations: count,
      baseline: allowedBaseline,
      diff: count - allowedBaseline,
    });

    if (verbose && count > 0) {
      console.log(`\n--- Violations in ${relPath} (${count}) ---`);
      violations.forEach((v) => {
        console.log(`  L${v.line} [${v.type}]: ${v.message} in \`${v.code}\` -> Suggestion: ${v.suggestion}`);
      });
    }

    if (strictMode) {
      if (count > 0) {
        regressionDetected = true;
        regressionDetails.push(`- ${relPath}: ${count} design lint violation(s) found (strict mode requires 0).`);
      }
    } else if (count > allowedBaseline) {
      regressionDetected = true;
      regressionDetails.push(
        `- ${relPath}: ${count} violations found, exceeding baseline (${allowedBaseline}) by +${count - allowedBaseline}.`
      );
      violations.slice(0, 5).forEach((v) => {
        regressionDetails.push(
          `    L${v.line} [${v.type}]: ${v.message} in \`${v.code}\` -> Recommended: ${v.suggestion}`
        );
      });
      if (violations.length > 5) {
        regressionDetails.push(`    ... and ${violations.length - 5} more.`);
      }
    }
  }

  if (updateBaseline) {
    saveBaseline(newBaseline);
    console.log(`[check:design-lint] Baseline recorded with total ${totalViolations} historical design lint violations.`);
    process.exit(0);
  }

  console.log("=== UniSearch Typography & Spacing Lint Guard ===");
  console.table(fileSummaries);
  console.log(`Total design lint violations found: ${totalViolations}`);

  if (regressionDetected) {
    console.error("\n[check:design-lint] REGRESSION DETECTED!");
    console.error("New design lint violations (font size/weight, negative margins, or non-4/8px spacing) were introduced:");
    console.error(regressionDetails.join("\n"));
    console.error("\nRule: Use the 400/500/600 weight hierarchy, standardized typography tokens (--text-*), and 4/8px spacing tokens (--space-*).");
    console.error("See docs/design-system.md for full specifications.");
    process.exit(1);
  }

  if (totalViolations === 0) {
    console.log("\n[check:design-lint] PERFECT! Zero design lint violations found across all CSS files.");
  } else {
    console.log(
      `\n[check:design-lint] PASS: Violations (${totalViolations}) do not exceed baseline. No regressions detected.`
    );
    const improved = fileSummaries.filter((f) => f.diff < 0);
    if (improved.length > 0) {
      console.log(
        `[check:design-lint] Great progress! You cleaned up ${improved.map((i) => `${i.file} (${i.diff})`).join(", ")}.`
      );
      console.log("[check:design-lint] Run `node scripts/check-design-lint.mjs --update-baseline` to lock in improvements!");
    }
  }

  process.exit(0);
}

run();
