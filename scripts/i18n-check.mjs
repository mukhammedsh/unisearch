#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const ROOT = process.cwd();
const FRONTEND_DIR = path.join(ROOT, "frontend");
const LOCALIZATION_DIR = path.join(FRONTEND_DIR, "Localization");
const LANG_FILES = {
  eng: path.join(LOCALIZATION_DIR, "eng"),
  rus: path.join(LOCALIZATION_DIR, "ru"),
  kaz: path.join(LOCALIZATION_DIR, "kaz"),
};
const ALLOWED_EXTRA_KEY_PREFIXES = ["university.description."];
const KAZ_UNIVERSITY_BUNDLE = path.join(LOCALIZATION_DIR, "universities-kaz.json");
const BACKEND_UNIVERSITY_BUNDLE = path.join(ROOT, "backend", "data", "universities_translations.json");

function checkKazakhUniversityBundle() {
  if (!fs.existsSync(KAZ_UNIVERSITY_BUNDLE)) return "Missing frontend Kazakh university translation bundle";
  try {
    const frontendPack = JSON.parse(fs.readFileSync(KAZ_UNIVERSITY_BUNDLE, "utf8"));
    const backendPack = JSON.parse(fs.readFileSync(BACKEND_UNIVERSITY_BUNDLE, "utf8")).languages?.kaz;
    return isDeepStrictEqual(frontendPack, backendPack)
      ? ""
      : "Frontend Kazakh university translations differ from backend data";
  } catch (error) {
    return `Cannot read Kazakh university translation bundles: ${error.message}`;
  }
}

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
  const values = new Map();
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
    values.set(key, line.slice(colon + 1).trim());
  });

  return { keys, values, duplicates };
}

function findPlaceholderMismatches(source, translated, language) {
  const issues = [];
  const placeholders = (value) => [...String(value || "").matchAll(/\{[a-zA-Z0-9_]+\}/g)]
    .map((match) => match[0])
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  for (const [key, sourceValue] of source.values) {
    const translatedValue = translated.values.get(key);
    if (translatedValue === undefined) continue;
    if (!isDeepStrictEqual(placeholders(sourceValue), placeholders(translatedValue))) {
      issues.push(`${language}: ${key}`);
    }
  }
  return issues;
}

function extractUsedI18nKeys() {
  const used = new Set();
  const files = walkFiles(
    FRONTEND_DIR,
    (absPath) => absPath.endsWith(".html") || absPath.endsWith(".js")
  );

  const patterns = [
    /data-i18n(?:-(?:html|placeholder|title|aria-label|label))?\s*=\s*"([^"]+)"/g,
    /data-i18n(?:-(?:html|placeholder|title|aria-label|label))?\s*=\s*'([^']+)'/g,
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
  return [...baseSet].filter((key) => !compareSet.has(key)).sort((a, b) => a.localeCompare(b));
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
    localization[lang] = parsed;
    for (const dup of parsed.duplicates) {
      allDuplicates.push(`${path.relative(ROOT, filePath)}:${dup.line} (${dup.key})`);
    }
  }

  const engKeys = localization.eng.keys;
  const missingInRu = sortedDiff(engKeys, localization.rus.keys);
  const extraInRu = sortedDiff(localization.rus.keys, engKeys).filter((key) => !isAllowedExtraKey(key));
  const missingInKaz = sortedDiff(engKeys, localization.kaz.keys);
  const extraInKaz = sortedDiff(localization.kaz.keys, engKeys).filter((key) => !isAllowedExtraKey(key));
  const placeholderIssues = [
    ...findPlaceholderMismatches(localization.eng, localization.rus, "rus"),
    ...findPlaceholderMismatches(localization.eng, localization.kaz, "kaz"),
  ];
  const usedKeys = extractUsedI18nKeys();
  const missingUsedInEng = sortedDiff(usedKeys, engKeys);
  const toastIssues = findHardcodedToastIssues();
  const universityBundleIssue = checkKazakhUniversityBundle();

  const hasIssues =
    allDuplicates.length > 0 ||
    missingInRu.length > 0 ||
    extraInRu.length > 0 ||
    missingInKaz.length > 0 ||
    extraInKaz.length > 0 ||
    missingUsedInEng.length > 0 ||
    placeholderIssues.length > 0 ||
    toastIssues.length > 0 ||
    Boolean(universityBundleIssue);

  if (hasIssues) {
    printList("Duplicate localization keys:", allDuplicates);
    printList("Missing keys in ru (vs eng):", missingInRu);
    printList("Extra keys in ru (not in eng):", extraInRu);
    printList("Missing keys in kaz (vs eng):", missingInKaz);
    printList("Extra keys in kaz (not in eng):", extraInKaz);
    printList("Used i18n keys missing in eng localization:", missingUsedInEng);
    printList("Translation placeholder mismatches:", placeholderIssues);
    printList("Hardcoded/non-localized toast usages:", toastIssues);
    if (universityBundleIssue) console.error(universityBundleIssue);
    process.exit(1);
  }

  console.log(
    `i18n-check passed: eng=${engKeys.size}, ru=${localization.rus.keys.size}, kk=${localization.kaz.keys.size}, used=${usedKeys.size}`
  );
}

main();
