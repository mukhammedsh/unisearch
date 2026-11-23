#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const jsDir = path.resolve(frontendDir, "javascript");

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
  "GBP",
  "CAD",
  "AUD",
  "MIT",
  "UCAS",
  "MBA",
  "PhD",
  "JD",
  "MD",
  "LLM",
  "N/A",
  "OK",
  "github.com/mukhammedsh/unisearch",
  "unisearch.sup@gmail.com",
  "&bull;",
  "&ndash;",
  "&mdash;",
  "&times;",
  "&copy;",
]);

const DOM_TEXT_PROPERTIES = new Set(["textContent", "placeholder", "title", "innerText"]);
const UI_TEXT_ATTRIBUTES = new Set(["aria-label", "title", "placeholder"]);
const SKIP_JS_REL_PATHS = new Set([
  "frontend/javascript/data/region-currency.js",
  "frontend/javascript/sw-worker.js",
]);
const EXPR_MARKER = "__EXPR__";

function isAllowedText(text) {
  const t = text.trim();
  if (!t) return true;
  if (ALLOWED_LITERALS.has(t)) return true;
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return true;
  const withoutEntities = t.replace(/&[a-zA-Z0-9#]+;/g, " ").trim();
  if (!withoutEntities) return true;
  // If there are no alphabetical letters (only numbers, dashes, punctuation, symbols)
  if (!/[a-zA-Zа-яА-ЯёЁ]{2,}/.test(withoutEntities)) return true;
  return false;
}

function isSuspiciousJsText(raw) {
  const s = String(raw || "").replaceAll(EXPR_MARKER, " ").replace(/\s+/g, " ").trim();
  if (!s || s.length < 3) return false;
  if (isAllowedText(s)) return false;
  const withoutEntities = s.replace(/&[a-zA-Z0-9#]+;/g, " ").trim();
  // Technical tokens: snake_case identifiers, kebab-case selectors/IDs, dotted i18n keys, MIME types/routes
  if (/^[a-z0-9_-]+(?:_[a-z0-9_-]+)+$/i.test(withoutEntities)) return false;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(withoutEntities)) return false;
  if (/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/i.test(withoutEntities)) return false;
  if (/^[a-z0-9_-]+\/[a-z0-9_.+-]+$/i.test(withoutEntities)) return false;
  if (/^(?:https?:\/\/|mailto:|#|\/|\.)/.test(withoutEntities)) return false;
  if (!/[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]{3,}/.test(withoutEntities)) return false;
  return true;
}

function getLine(content, charIndex) {
  let line = 1;
  const max = Math.min(charIndex, content.length);
  for (let i = 0; i < max; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function hasI18nIgnore(lines, lineNumber) {
  const current = lines[lineNumber - 1] || "";
  const prev = lines[lineNumber - 2] || "";
  return current.includes("i18n-ignore") || prev.includes("i18n-ignore");
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

  while (pos < content.length) {
    const nextTag = content.indexOf("<", pos);
    if (nextTag === -1) {
      const remainingText = content.slice(pos);
      if (!isAllowedText(remainingText) && !stack.some((s) => s.hasI18n)) {
        violations.push({
          line: getLine(content, pos),
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
          line: getLine(content, pos),
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
      stack.push({ tag: openTagName, hasI18n, line: getLine(content, nextTag) });
    }
  }

  return { relPath, violations };
}

function buildTemplateJoinedMap(quasis) {
  let text = "";
  const ranges = [];
  quasis.forEach((q, idx) => {
    const raw = q.value?.raw || "";
    const joinedStart = text.length;
    text += raw;
    ranges.push({ joinedStart, joinedEnd: text.length, srcStart: q.start });
    if (idx < quasis.length - 1) text += EXPR_MARKER;
  });
  return { text, ranges };
}

function joinedOffsetToSrcLine(content, ranges, joinedOffset) {
  for (const r of ranges) {
    if (joinedOffset <= r.joinedEnd) {
      const clamped = Math.max(0, joinedOffset - r.joinedStart);
      return getLine(content, r.srcStart + clamped);
    }
  }
  const last = ranges[ranges.length - 1];
  return getLine(content, last ? last.srcStart : 0);
}

function scanHtmlTemplateLiteral(node, content, lines, relPath, violations) {
  const quasis = Array.isArray(node.quasis) ? node.quasis : [];
  if (!quasis.length) return;
  const { text: joined, ranges } = buildTemplateJoinedMap(quasis);
  if (!joined.includes("<") || !joined.includes(">")) return;

  for (const m of joined.matchAll(/>([^<>]+)</g)) {
    const cleaned = m[1].replaceAll(EXPR_MARKER, " ").replace(/\s+/g, " ").trim();
    if (!isSuspiciousJsText(cleaned)) continue;
    const before = joined.slice(0, m.index + 1);
    const openTagStart = before.lastIndexOf("<");
    const openTag = openTagStart >= 0 ? before.slice(openTagStart) : "";
    if (/data-(?:i18n|no-i18n)|<(?:script|style|svg)\b/i.test(openTag)) continue;
    if (relPath === "frontend/javascript/components.js" && /^<option\s+value="[A-Z]{3}"/i.test(openTag)) continue;
    const line = joinedOffsetToSrcLine(content, ranges, m.index);
    if (hasI18nIgnore(lines, line)) continue;
    violations.push({ line, tag: "template-html", text: cleaned.slice(0, 80) });
  }

  for (const m of joined.matchAll(/\b(aria-label|title|placeholder)\s*=\s*"([^"]*)"/gi)) {
    const attr = m[1].toLowerCase();
    const rawVal = m[2];
    if (rawVal.includes(EXPR_MARKER)) continue;
    const val = rawVal.trim();
    if (!isSuspiciousJsText(val)) continue;
    const tagStart = joined.lastIndexOf("<", m.index);
    const tagEnd = joined.indexOf(">", m.index);
    const tag = tagStart >= 0 ? joined.slice(tagStart, tagEnd >= 0 ? tagEnd + 1 : joined.length) : "";
    if (new RegExp(`data-i18n-${attr}|data-no-i18n`, "i").test(tag)) continue;
    const line = joinedOffsetToSrcLine(content, ranges, m.index);
    if (hasI18nIgnore(lines, line)) continue;
    violations.push({ line, tag: `template-${attr}`, text: val.slice(0, 80) });
  }
}

function scanJsFile(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  if (SKIP_JS_REL_PATHS.has(relPath)) return { relPath, violations: [] };
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const { program } = parseSync(filePath, content);
  const violations = [];

  function record(offset, tag, text) {
    const line = getLine(content, offset);
    if (hasI18nIgnore(lines, line)) return;
    violations.push({ line, tag, text: String(text).slice(0, 80) });
  }

  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "AssignmentExpression" &&
      node.left?.type === "MemberExpression" &&
      node.left.property?.type === "Identifier" &&
      DOM_TEXT_PROPERTIES.has(node.left.property.name) &&
      node.right?.type === "Literal" &&
      typeof node.right.value === "string" &&
      isSuspiciousJsText(node.right.value)
    ) {
      record(node.start, node.left.property.name, node.right.value);
    }

    if (
      node.type === "CallExpression" &&
      node.callee?.type === "MemberExpression" &&
      node.callee.property?.type === "Identifier" &&
      node.callee.property.name === "setAttribute" &&
      node.arguments?.length >= 2 &&
      node.arguments[0]?.type === "Literal" &&
      typeof node.arguments[0].value === "string" &&
      UI_TEXT_ATTRIBUTES.has(node.arguments[0].value.toLowerCase()) &&
      node.arguments[1]?.type === "Literal" &&
      typeof node.arguments[1].value === "string" &&
      isSuspiciousJsText(node.arguments[1].value)
    ) {
      record(node.start, `setAttribute(${node.arguments[0].value})`, node.arguments[1].value);
    }

    if (node.type === "TemplateLiteral") {
      scanHtmlTemplateLiteral(node, content, lines, relPath, violations);
    }

    for (const key of Object.keys(node)) {
      if (key === "start" || key === "end" || key === "type") continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }

  visit(program);
  return { relPath, violations };
}

function collectJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(absPath, out);
    else if (entry.name.endsWith(".js")) out.push(absPath);
  }
  return out.sort();
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
  const jsFiles = collectJsFiles(jsDir);

  let totalViolations = 0;
  const results = [];

  for (const filePath of htmlFiles) {
    const res = scanHtmlFile(filePath);
    results.push(res);
    totalViolations += res.violations.length;
  }
  for (const filePath of jsFiles) {
    const res = scanJsFile(filePath);
    results.push(res);
    totalViolations += res.violations.length;
  }

  console.log(`\n=== UniSearch Hardcoded HTML & JS Text Guard (${htmlFiles.length} HTML, ${jsFiles.length} JS) ===`);
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
    console.error(`\n\x1b[31m[check:hardcoded-text] FAILED: Found ${totalViolations} untranslated UI strings.\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[32m[check:hardcoded-text] PERFECT! All HTML & JS UI strings are localized.\x1b[0m\n`);
}

run();
