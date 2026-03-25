#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FRONTEND_DIR = path.join(ROOT, "frontend");
const LOCALIZATION_DIR = path.join(FRONTEND_DIR, "Localization");
const LANG_FILES = {
  eng: path.join(LOCALIZATION_DIR, "eng"),
  rus: path.join(LOCALIZATION_DIR, "ru"),
};
const ALLOWED_EXTRA_KEY_PREFIXES = ["university.description."];

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, predicate, out);
      continue;
    }
    if (predicate(absPath, entry)) out.push(absPath);
  }
  return out;
}

function parseLocalizationFile(filePath) {
  const keys = new Set();
  const duplicates = [];
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = String(raw || "").trim();
    if (!line || line.startsWith("#")) return;
    const colon = line.indexOf(":");
    if (colon <= 0) return;
    const key = line.slice(0, colon).trim();
    if (!key) return;
    if (keys.has(key)) duplicates.push({ key, line: idx + 1 });
    keys.add(key);
  });

  return { keys, duplicates };
}

function extractUsedI18nKeys() {
  const used = new Set();
  const files = walkFiles(
    FRONTEND_DIR,
    (absPath) => absPath.endsWith(".html") || absPath.endsWith(".js")
  );

  const patterns = [
    /data-i18n(?:-html|-placeholder|-title|-aria-label)\s*=\s*"([^"]+)"/g,
    /data-i18n(?:-html|-placeholder|-title|-aria-label)\s*=\s*'([^']+)'/g,
    /\b(?:t|tFormat)\(\s*"([^"]+)"/g,
    /\b(?:t|tFormat)\(\s*'([^']+)'/g,
  ];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const regex of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const key = String(match[1] || "").trim();
        if (key) used.add(key);
      }
    }
  }

  return used;
}

function findHardcodedToastIssues() {
  const issues = [];
  const jsDir = path.join(FRONTEND_DIR, "javascript");
  const files = walkFiles(jsDir, (absPath) => absPath.endsWith(".js"));

  for (const filePath of files) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      if (/showToast\(\s*["'`]/.test(line)) {
        issues.push(
          `${relPath}:${lineNo} hardcoded toast literal; use t()/tFormat()`
        );
      }
      if (/showToast\(\s*(?:e|err|error)\.message\b/.test(line)) {
        issues.push(
          `${relPath}:${lineNo} raw backend error toast; map to localized message`
        );
      }
    });
  }

  return issues;
}

function sortedDiff(baseSet, compareSet) {
  return [...baseSet].filter((key) => !compareSet.has(key)).sort();
}

function isAllowedExtraKey(key) {
  return ALLOWED_EXTRA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function printList(title, list) {
  if (!list.length) return;
  console.error(title);
  for (const item of list) {
    console.error(`  - ${item}`);
  }
}

function main() {
  const localization = {};
  const allDuplicates = [];

  for (const [lang, filePath] of Object.entries(LANG_FILES)) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing localization file: ${path.relative(ROOT, filePath)}`);
      process.exit(1);
    }
    const parsed = parseLocalizationFile(filePath);
    localization[lang] = parsed.keys;
    for (const dup of parsed.duplicates) {
      allDuplicates.push(`${path.relative(ROOT, filePath)}:${dup.line} (${dup.key})`);
    }
  }

  const engKeys = localization.eng;
  const missingInRu = sortedDiff(engKeys, localization.rus);
  const extraInRu = sortedDiff(localization.rus, engKeys).filter((key) => !isAllowedExtraKey(key));
  const usedKeys = extractUsedI18nKeys();
  const missingUsedInEng = sortedDiff(usedKeys, engKeys);
  const toastIssues = findHardcodedToastIssues();

  const hasIssues =
    allDuplicates.length > 0 ||
    missingInRu.length > 0 ||
    extraInRu.length > 0 ||
    missingUsedInEng.length > 0 ||
    toastIssues.length > 0;

  if (hasIssues) {
    printList("Duplicate localization keys:", allDuplicates);
    printList("Missing keys in ru (vs eng):", missingInRu);
    printList("Extra keys in ru (not in eng):", extraInRu);
    printList("Used i18n keys missing in eng localization:", missingUsedInEng);
    printList("Hardcoded/non-localized toast usages:", toastIssues);
    process.exit(1);
  }

  console.log(
    `i18n-check passed: eng=${engKeys.size}, ru=${localization.rus.size}, used=${usedKeys.size}`
  );
}

main();
