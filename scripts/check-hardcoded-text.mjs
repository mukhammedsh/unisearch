#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose") || args.has("-v");

const ALLOWED_LITERALS = new Set([
  "UniSearch",
  "UniFit",
  "UniChance",
  "GitHub",
  "Telegram",
  "LinkedIn",
  "IELTS",
  "TOEFL",
  "SAT",
  "ACT",
  "GPA",
  "CEFR",
  "USD",
  "EUR",
  "KZT",
  "RUB",
  "UZS",
  "github.com/mukhammedsh/unisearch",
  "unisearch@inbox.ru",
  "&bull;",
  "&ndash;",
  "&mdash;",
  "&times;",
  "&copy;",
]);

function isAllowedText(text) {
  const t = text.trim();
  if (!t) return true;
  if (ALLOWED_LITERALS.has(t)) return true;
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return true;
  if (/^&[a-zA-Z0-9#]+;$/.test(t)) return true;
  // If there are no alphabetical letters (only numbers, dashes, punctuation, symbols)
  if (!/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(t)) return true;
  return false;
}

function scanHtmlFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const violations = [];

  let pos = 0;
  const bodyMatch = /<body\b[^>]*>/i.exec(content);
  if (bodyMatch) {
    pos = bodyMatch.index + bodyMatch[0].length;
  }

  const stack = [];

  function getLine(charIndex) {
    return content.slice(0, charIndex).split("\n").length;
  }

  while (pos < content.length) {
    const nextTag = content.indexOf("<", pos);
    if (nextTag === -1) {
      const remainingText = content.slice(pos);
      if (!isAllowedText(remainingText) && !stack.some((s) => s.hasI18n)) {
        violations.push({
          line: getLine(pos),
          tag: stack[stack.length - 1]?.tag || "body",
          text: remainingText.trim(),
        });
      }
      break;
    }

    const textBetween = content.slice(pos, nextTag);
    if (!isAllowedText(textBetween)) {
      const activeI18n = stack.some((s) => s.hasI18n);
      if (!activeI18n) {
        violations.push({
          line: getLine(pos),
          tag: stack[stack.length - 1]?.tag || "body",
          text: textBetween.trim(),
        });
      }
    }

    const tagEnd = content.indexOf(">", nextTag);
    if (tagEnd === -1) break;

    const rawTag = content.slice(nextTag, tagEnd + 1);
    pos = tagEnd + 1;

    // Skip comments
    if (rawTag.startsWith("<!--")) {
      const commentEnd = content.indexOf("-->", nextTag);
      pos = commentEnd !== -1 ? commentEnd + 3 : tagEnd + 1;
      continue;
    }

    // Closing tag
    if (rawTag.startsWith("</")) {
      const tagName = rawTag.slice(2, -1).trim().split(/\s+/)[0].toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }

    // Skip non-rendered or code blocks
    const openTagName = rawTag.slice(1, -1).trim().split(/[\s>/]/)[0].toLowerCase();
    if (openTagName === "script" || openTagName === "style" || openTagName === "svg" || openTagName === "template") {
      const closeTag = `</${openTagName}>`;
      const closeIdx = content.toLowerCase().indexOf(closeTag, tagEnd);
      pos = closeIdx !== -1 ? closeIdx + closeTag.length : tagEnd + 1;
      continue;
    }

    // Self-closing / void elements
    const isVoid = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(openTagName);
    const hasI18n =
      rawTag.includes("data-i18n") ||
      rawTag.includes("data-no-i18n") ||
      rawTag.includes("data-page");

    if (!isVoid && !rawTag.endsWith("/>")) {
      stack.push({ tag: openTagName, hasI18n, line: getLine(nextTag) });
    }
  }

  return { relPath, violations };
}

function run() {
  if (!fs.existsSync(frontendDir)) {
    console.error(`[check:hardcoded-text] Frontend directory not found: ${frontendDir}`);
    process.exit(1);
  }

  const htmlFiles = fs
    .readdirSync(frontendDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(frontendDir, f))
    .sort();

  let totalViolations = 0;
  const results = [];

  for (const filePath of htmlFiles) {
    const res = scanHtmlFile(filePath);
    results.push(res);
    totalViolations += res.violations.length;
  }

  console.log("\n=== UniSearch Hardcoded HTML Text Guard ===");
  for (const { relPath, violations } of results) {
    if (violations.length > 0) {
      console.log(`\n\x1b[31m[FAIL]\x1b[0m ${relPath} (${violations.length} violations):`);
      for (const v of violations) {
        console.log(`  Line ${v.line} <${v.tag}>: "${v.text}"`);
      }
    } else if (verbose) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${relPath}`);
    }
  }

  if (totalViolations > 0) {
    console.error(`\n\x1b[31m[check:hardcoded-text] FAILED: Found ${totalViolations} untranslated text nodes without data-i18n.\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[32m[check:hardcoded-text] PERFECT! All HTML text nodes are properly bound to data-i18n localization keys.\x1b[0m\n`);
}

run();
