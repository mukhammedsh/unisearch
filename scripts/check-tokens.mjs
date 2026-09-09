#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const cssDir = path.resolve(rootDir, "frontend", "css");
const baselinePath = path.resolve(scriptDir, "tokens-baseline.json");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");
const updateBaseline = args.has("--update-baseline");
const verbose = args.has("--verbose") || args.has("-v");
const targetFile = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1];

const COLOR_REGEX = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;

function suggestToken(colorStr) {
  const c = colorStr.toLowerCase();
  if (c === "#ffffff" || c === "#fff") return "var(--surface-solid)";
  if (c === "#0c0d0e" || c === "#f4f5f7") return "var(--bg)";
  if (c === "#18191b") return "var(--surface-solid)";
  if (c === "#111827" || c === "#f3f4f6") return "var(--text)";
  if (c === "#64748b" || c === "#94a3b8") return "var(--text-muted)";
  if (c.includes("57, 21, 219") || c.includes("93, 23, 235") || c === "#5715db" || c === "#5d17eb" || c === "#9d5eff" || c === "#8b5cf6" || c === "#4f46e5") return "var(--accent)";
  if (c === "#16a34a" || c === "#15803d" || c === "#a7f3d0" || c.includes("16, 185, 129")) return "var(--color-success)";
  if (c === "#dc2626" || c === "#fca5a5" || c.includes("239, 68, 68")) return "var(--color-danger)";
  if (c === "#b45309" || c === "#fde68a" || c.includes("245, 158, 11")) return "var(--color-warning)";
  if (c === "#1d4ed8" || c === "#93c5fd" || c.includes("59, 130, 246")) return "var(--color-info)";
  return "var(--surface-solid) / var(--text) / var(--line)";
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
      if (trimmed.startsWith(":root")) {
        inRootBlock = true;
      }
      if (inRootBlock && trimmed.endsWith("}") && !trimmed.includes("{")) {
        inRootBlock = false;
      }
      // Inside :root of style.css, CSS variable declarations (--*) are permitted
      if (inRootBlock && trimmed.startsWith("--")) {
        continue;
      }
    }

    // Mask url(...) contents to avoid false positives on data SVGs
    const lineWithoutUrls = line.replace(/url\([^)]+\)/gi, 'url("")');

    const matches = lineWithoutUrls.match(COLOR_REGEX);
    if (matches) {
      for (const color of matches) {
        violations.push({
          line: i + 1,
          color,
          code: rawLine.trim(),
          suggestion: suggestToken(color),
        });
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
  console.log(`[check:tokens] Baseline successfully updated at ${path.relative(rootDir, baselinePath)}`);
}

function run() {
  if (!fs.existsSync(cssDir)) {
    console.error(`[check:tokens] CSS directory not found: ${cssDir}`);
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
        console.log(`  L${v.line}: "${v.color}" in \`${v.code}\` -> ${v.suggestion}`);
      });
    }

    if (strictMode) {
      if (count > 0) {
        regressionDetected = true;
        regressionDetails.push(`- ${relPath}: ${count} hardcoded color(s) found (strict mode requires 0).`);
      }
    } else if (count > allowedBaseline) {
      regressionDetected = true;
      regressionDetails.push(
        `- ${relPath}: ${count} violations found, which exceeds baseline (${allowedBaseline}) by +${count - allowedBaseline}.`
      );
      // Show first 5 violations in detail for fast fix
      violations.slice(0, 5).forEach((v) => {
        regressionDetails.push(
          `    L${v.line}: "${v.color}" in \`${v.code}\` -> Recommended: ${v.suggestion}`
        );
      });
      if (violations.length > 5) {
        regressionDetails.push(`    ... and ${violations.length - 5} more.`);
      }
    }
  }

  if (updateBaseline) {
    saveBaseline(newBaseline);
    console.log(`[check:tokens] Baseline recorded with total ${totalViolations} historical violations.`);
    process.exit(0);
  }

  console.log("=== UniSearch Design Tokens Guard ===");
  console.table(fileSummaries);
  console.log(`Total hardcoded colors found: ${totalViolations}`);

  if (regressionDetected) {
    console.error("\n[check:tokens] REGRESSION DETECTED!");
    console.error("New hardcoded colors were introduced against project rules:");
    console.error(regressionDetails.join("\n"));
    console.error(
      "\nRule: All colors must be CSS variables from frontend/css/style.css (e.g. var(--surface-solid))."
    );
    console.error("See docs/design-system.md for the token palette.");
    process.exit(1);
  }

  if (totalViolations === 0) {
    console.log("\n[check:tokens] PERFECT! Zero hardcoded colors found across all CSS files.");
  } else {
    console.log(
      `\n[check:tokens] PASS: Violations (${totalViolations}) do not exceed baseline. No regressions detected.`
    );
    const improved = fileSummaries.filter((f) => f.diff < 0);
    if (improved.length > 0) {
      console.log(
        `[check:tokens] Great job! You cleaned up ${improved.map((i) => `${i.file} (${i.diff})`).join(", ")}.`
      );
      console.log("[check:tokens] Run `node scripts/check-tokens.mjs --update-baseline` to lock in these improvements!");
    }
  }

  process.exit(0);
}

run();
