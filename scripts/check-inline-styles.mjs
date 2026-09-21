#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const baselinePath = path.resolve(scriptDir, "inline-styles-baseline.json");

const args = new Set(process.argv.slice(2));
const strictMode = args.has("--strict");
const updateBaseline = args.has("--update-baseline");
const verbose = args.has("--verbose") || args.has("-v");

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, predicate, out);
    } else if (entry.isFile() && predicate(absPath, entry.name)) {
      out.push(absPath);
    }
  }
  return out;
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
  console.log(`[check:inline-styles] Baseline successfully saved to ${path.relative(rootDir, baselinePath)}`);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ignore comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

    // Check for inline style="..." or style='...'
    const styleMatch = line.match(/\bstyle\s*=\s*(["'])(.*?)\1/i);
    if (styleMatch) {
      violations.push({
        line: i + 1,
        code: trimmed,
        styleContent: styleMatch[2],
      });
    }
  }

  return { relPath, violations };
}

function run() {
  if (!fs.existsSync(frontendDir)) {
    console.error(`[check:inline-styles] Frontend directory not found: ${frontendDir}`);
    process.exit(1);
  }

  const files = [
    ...walkFiles(frontendDir, (_, name) => name.endsWith(".html")),
    ...walkFiles(path.join(frontendDir, "javascript"), (_, name) => name.endsWith(".js")),
  ].sort();

  const scanResults = files.map(scanFile);
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

    if (count > allowedBaseline) {
      regressionDetected = true;
      regressionDetails.push({
        file: relPath,
        newViolations: count - allowedBaseline,
        total: count,
        baseline: allowedBaseline,
        items: violations.slice(allowedBaseline),
      });
    }
  }

  if (updateBaseline) {
    saveBaseline(newBaseline);
    return;
  }

  console.log("\n=== UniSearch Inline Styles Guard ===");
  if (verbose || regressionDetected) {
    console.table(fileSummaries.filter((s) => s.violations > 0 || s.diff > 0));
  }

  console.log(`Total inline styles found: ${totalViolations}`);

  if (regressionDetected) {
    console.error("\n\x1b[31m[check:inline-styles] REGRESSION DETECTED: New inline styles introduced!\x1b[0m\n");
    for (const reg of regressionDetails) {
      console.error(`  \x1b[33m${reg.file}\x1b[0m: +${reg.newViolations} new inline styles (total: ${reg.total}, baseline: ${reg.baseline})`);
      for (const item of reg.items) {
        console.error(`    Line ${item.line}: ${item.code}`);
      }
    }
    console.error("\nStyles must be declared in CSS files using design tokens. Do not use inline style attributes.");
    process.exit(1);
  }

  if (totalViolations === 0) {
    console.log("\n\x1b[32m[check:inline-styles] PERFECT! Zero inline styles found across all HTML and JS files.\x1b[0m\n");
  } else {
    console.log(`\n\x1b[32m[check:inline-styles] PASSED within baseline limit (<= ${totalViolations} legacy occurrences).\x1b[0m\n`);
  }
}

run();
