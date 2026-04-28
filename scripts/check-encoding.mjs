#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const shouldFix = args.has("--fix");
const verbose = args.has("--verbose");

const SKIP_DIRS = new Set([
  ".git",
  ".venv",
  "backend/.venv",
  "backend/venv",
  "node_modules",
  "test-results",
  "playwright-report",
]);

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".svg",
  ".txt",
  ".yml",
  ".yaml",
]);

const EXTENSIONLESS_TEXT_FILES = new Set([
  "frontend/Localization/eng",
  "frontend/Localization/ru",
  "LICENSE",
]);

const CP1251_DECODE = new Map([
  [0x80, 0x0402],
  [0x81, 0x0403],
  [0x82, 0x201a],
  [0x83, 0x0453],
  [0x84, 0x201e],
  [0x85, 0x2026],
  [0x86, 0x2020],
  [0x87, 0x2021],
  [0x88, 0x20ac],
  [0x89, 0x2030],
  [0x8a, 0x0409],
  [0x8b, 0x2039],
  [0x8c, 0x040a],
  [0x8d, 0x040c],
  [0x8e, 0x040b],
  [0x8f, 0x040f],
  [0x90, 0x0452],
  [0x91, 0x2018],
  [0x92, 0x2019],
  [0x93, 0x201c],
  [0x94, 0x201d],
  [0x95, 0x2022],
  [0x96, 0x2013],
  [0x97, 0x2014],
  [0x99, 0x2122],
  [0x9a, 0x0459],
  [0x9b, 0x203a],
  [0x9c, 0x045a],
  [0x9d, 0x045c],
  [0x9e, 0x045b],
  [0x9f, 0x045f],
  [0xa0, 0x00a0],
  [0xa1, 0x040e],
  [0xa2, 0x045e],
  [0xa3, 0x0408],
  [0xa4, 0x00a4],
  [0xa5, 0x0490],
  [0xa6, 0x00a6],
  [0xa7, 0x00a7],
  [0xa8, 0x0401],
  [0xa9, 0x00a9],
  [0xaa, 0x0404],
  [0xab, 0x00ab],
  [0xac, 0x00ac],
  [0xad, 0x00ad],
  [0xae, 0x00ae],
  [0xaf, 0x0407],
  [0xb0, 0x00b0],
  [0xb1, 0x00b1],
  [0xb2, 0x0406],
  [0xb3, 0x0456],
  [0xb4, 0x0491],
  [0xb5, 0x00b5],
  [0xb6, 0x00b6],
  [0xb7, 0x00b7],
  [0xb8, 0x0451],
  [0xb9, 0x2116],
  [0xba, 0x0454],
  [0xbb, 0x00bb],
  [0xbc, 0x0458],
  [0xbd, 0x0405],
  [0xbe, 0x0455],
  [0xbf, 0x0457],
]);

for (let i = 0xc0; i <= 0xff; i += 1) {
  CP1251_DECODE.set(i, 0x0410 + i - 0xc0);
}

const CP1251_ENCODE = new Map(
  [...CP1251_DECODE.entries()].map(([byte, codePoint]) => [codePoint, byte]),
);

const LATIN_MOJIBAKE_RE = /(?:[ÐÑ][\u0080-\uffff]|[ÂÃ][\u0080-\uffff]){2,}/u;
const CYRILLIC_MOJIBAKE_RE =
  /(?:Р[\u00a0-\uffff]|С[\u0400-\uffff]){2,}|Р(?:ђ|‚|ѓ|„|…|†|‡|€|‰|Љ|‹|Њ|Ќ|Ћ|Џ|‘|’|“|”|•|–|—|™|љ|›|њ|ќ|ћ|џ|Ё|І|Ї|є|ё|№)|С(?:Ђ|Ѓ|‚|ѓ|„|…|†|‡|€|‰|Љ|‹|Њ|Ќ|Ћ|Џ|‘|’|“|”|•|–|—|™|љ|›|њ|ќ|ћ|џ)/u;
const REPLACEMENT_RE = /\uFFFD/u;
const INTENTIONAL_MOJIBAKE_TEST_RE = /not\.toMatch\(.+(?:Ð|Ñ|Р|вЂ)/u;

function normalizeSlash(filePath) {
  return filePath.replaceAll("\\", "/");
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(normalizeSlash);
}

function shouldSkipFile(filePath) {
  if (!existsSync(filePath)) return true;
  if ([...SKIP_DIRS].some((dir) => filePath === dir || filePath.startsWith(`${dir}/`))) return true;
  if (EXTENSIONLESS_TEXT_FILES.has(filePath)) return false;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (!sample.length) return false;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte < 0x08 || (byte > 0x0d && byte < 0x20)) suspicious += 1;
  }
  return suspicious / sample.length > 0.02;
}

function encodeCp1251(text) {
  const bytes = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (CP1251_ENCODE.has(codePoint)) {
      bytes.push(CP1251_ENCODE.get(codePoint));
    } else {
      bytes.push(0x3f);
    }
  }
  return Buffer.from(bytes);
}

function decodeCp1251Utf8(text) {
  return encodeCp1251(text).toString("utf8");
}

function decodeLatin1Utf8(text) {
  return Buffer.from(text, "latin1").toString("utf8");
}

function suspiciousScore(text) {
  const relevantText = splitLinesPreservingEndings(text)
    .filter((line) => !INTENTIONAL_MOJIBAKE_TEST_RE.test(line))
    .join("");
  text = relevantText;
  const latin = text.match(new RegExp(LATIN_MOJIBAKE_RE, "gu"))?.length ?? 0;
  const cyrillic = text.match(new RegExp(CYRILLIC_MOJIBAKE_RE, "gu"))?.length ?? 0;
  const replacements = text.match(new RegExp(REPLACEMENT_RE, "gu"))?.length ?? 0;
  return latin * 3 + cyrillic * 3 + replacements * 5;
}

function cyrillicLetterCount(text) {
  return text.match(/[А-Яа-яЁё]/gu)?.length ?? 0;
}

function fixLine(line) {
  if (!LATIN_MOJIBAKE_RE.test(line) && !CYRILLIC_MOJIBAKE_RE.test(line)) return line;

  const originalScore = suspiciousScore(line);
  const candidates = [decodeLatin1Utf8(line), decodeCp1251Utf8(line)];
  let best = line;
  let bestScore = originalScore;
  let bestCyrillic = cyrillicLetterCount(line);

  for (const candidate of candidates) {
    const score = suspiciousScore(candidate);
    const cyrillic = cyrillicLetterCount(candidate);
    const replacementPenalty = (candidate.match(new RegExp(REPLACEMENT_RE, "gu"))?.length ?? 0) * 10;
    const adjustedScore = score + replacementPenalty;
    if (adjustedScore < bestScore || (adjustedScore === bestScore && cyrillic > bestCyrillic)) {
      best = candidate;
      bestScore = adjustedScore;
      bestCyrillic = cyrillic;
    }
  }

  return bestScore < originalScore ? best : line;
}

function splitLinesPreservingEndings(text) {
  return text.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter((part) => part.length > 0) ?? [];
}

function fixText(text) {
  const hadBom = text.charCodeAt(0) === 0xfeff;
  const source = hadBom ? text.slice(1) : text;
  const fixed = splitLinesPreservingEndings(source).map(fixLine).join("");
  return { text: fixed, hadBom };
}

function analyzeFile(filePath) {
  const buffer = readFileSync(filePath);
  if (isProbablyBinary(buffer)) return null;

  const text = buffer.toString("utf8");
  const invalidUtf8 = REPLACEMENT_RE.test(text);
  const { text: fixedText, hadBom } = fixText(text);
  const hasMojibake = suspiciousScore(fixedText) < suspiciousScore(text);
  const stillSuspicious = suspiciousScore(fixedText) > 0;

  return {
    filePath,
    buffer,
    text,
    fixedText,
    hadBom,
    invalidUtf8,
    hasMojibake,
    stillSuspicious,
    changed: hadBom || hasMojibake,
  };
}

const results = [];
for (const filePath of listTrackedFiles()) {
  if (!shouldSkipFile(filePath)) continue;
  const result = analyzeFile(filePath);
  if (result && (result.changed || result.invalidUtf8 || result.stillSuspicious || verbose)) {
    results.push(result);
  }
}

const blockers = results.filter((result) => result.invalidUtf8 || result.stillSuspicious);
const fixable = results.filter((result) => result.changed);

if (shouldFix) {
  for (const result of fixable) {
    writeFileSync(result.filePath, result.fixedText, "utf8");
  }
}

for (const result of results) {
  const flags = [
    result.hadBom ? "bom" : null,
    result.hasMojibake ? "mojibake" : null,
    result.invalidUtf8 ? "invalid-utf8" : null,
    result.stillSuspicious ? "needs-review" : null,
  ].filter(Boolean);
  console.log(`${shouldFix && result.changed ? "fixed" : "found"} ${result.filePath} [${flags.join(", ")}]`);
}

if (blockers.length > 0) {
  console.error(
    `Encoding check found ${blockers.length} file(s) with suspicious text that need manual review.`,
  );
  process.exitCode = 1;
} else if (!shouldFix && fixable.length > 0) {
  console.error(`Encoding check found ${fixable.length} fixable file(s). Run: npm run fix:encoding`);
  process.exitCode = 1;
} else {
  console.log(shouldFix ? "Encoding fix completed." : "Encoding check passed.");
}
