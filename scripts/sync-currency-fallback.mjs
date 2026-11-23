#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const BACKEND_PATH = path.resolve(rootDir, "backend/app/services/currency.py");
const FRONTEND_PATH = path.resolve(rootDir, "frontend/javascript/currency.js");
const API_URL = "https://open.er-api.com/v6/latest/USD";

const CURRENCY_CODE_RE = /^[A-Z]{3,5}$/;

function formatNumberLiteral(num) {
  if (!Number.isFinite(num)) {
    throw new Error(`Non-finite currency rate: ${num}`);
  }
  return Number.isInteger(num) ? num.toFixed(1) : String(num);
}

function parseUtcSnapshotTimestamp(rawTimestamp) {
  const parsed = new Date(String(rawTimestamp || "").trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid time_last_update_utc from ExchangeRate-API");
  }
  return {
    dateStr: parsed.toISOString().slice(0, 10),
    utcLabel: parsed.toUTCString(),
  };
}

function normalizeRatesMap(rawRates) {
  const entries = [];
  for (const [rawCode, rawValue] of Object.entries(rawRates || {})) {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!CURRENCY_CODE_RE.test(code)) continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0 || value >= 1e12) continue;
    entries.push([code, code === "USD" ? 1.0 : value]);
  }
  entries.sort(([left], [right]) => {
    if (left === "USD") return -1;
    if (right === "USD") return 1;
    return left.localeCompare(right);
  });
  return Object.fromEntries(entries);
}

export function extractFallbackFromPython(source) {
  const dateMatch = source.match(/FALLBACK_RATES_DATE(?:\s*:\s*str)?\s*=\s*["']([^"']+)["']/);
  const blockMatch = source.match(/FALLBACK_RATES(?:\s*:\s*(?:dict|Dict)\[[^\]]+\])?\s*=\s*\{([\s\S]*?)\n\}/);
  if (!dateMatch || !blockMatch) {
    throw new Error("Could not parse FALLBACK_RATES_DATE / FALLBACK_RATES in backend/app/services/currency.py");
  }
  const rates = {};
  for (const line of blockMatch[1].split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, "").trim();
    const m = /^["']([A-Z]{3,5})["']\s*:\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
    if (m) {
      rates[m[1]] = Number(m[2]);
    }
  }
  return { date: dateMatch[1], rates };
}

export function extractFallbackFromJavaScript(source) {
  const dateMatch = source.match(/export\s+const\s+FALLBACK_RATES_DATE\s*=\s*["']([^"']+)["']\s*;/);
  const blockMatch = source.match(/export\s+const\s+FALLBACK_RATES\s*=\s*\{([\s\S]*?)\n\}\s*;/);
  if (!dateMatch || !blockMatch) {
    throw new Error("Could not parse FALLBACK_RATES_DATE / FALLBACK_RATES in frontend/javascript/currency.js");
  }
  const rates = {};
  for (const line of blockMatch[1].split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, "").trim();
    const m = /^([A-Z]{3,5})\s*:\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
    if (m) {
      rates[m[1]] = Number(m[2]);
    }
  }
  return { date: dateMatch[1], rates };
}

export function checkFallbackParity() {
  const pySource = fs.readFileSync(BACKEND_PATH, "utf8");
  const jsSource = fs.readFileSync(FRONTEND_PATH, "utf8");

  const py = extractFallbackFromPython(pySource);
  const js = extractFallbackFromJavaScript(jsSource);

  const errors = [];
  if (py.date !== js.date) {
    errors.push(`FALLBACK_RATES_DATE mismatch: backend=${py.date} vs frontend=${js.date}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(py.date)) {
    errors.push(`FALLBACK_RATES_DATE must be YYYY-MM-DD, got: ${py.date}`);
  }

  const pyKeys = Object.keys(py.rates);
  const jsKeys = Object.keys(js.rates);
  const allKeys = Array.from(new Set([...pyKeys, ...jsKeys])).sort((a, b) => a.localeCompare(b));

  for (const code of allKeys) {
    if (!(code in py.rates)) {
      errors.push(`Missing currency in backend FALLBACK_RATES: ${code}`);
    } else if (!(code in js.rates)) {
      errors.push(`Missing currency in frontend FALLBACK_RATES: ${code}`);
    } else if (py.rates[code] !== js.rates[code]) {
      errors.push(`Rate mismatch for ${code}: backend=${py.rates[code]} vs frontend=${js.rates[code]}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    date: py.date,
    count: pyKeys.length,
  };
}

function renderPythonFallbackBlock(dateStr, utcLabel, rates) {
  const lines = Object.entries(rates).map(
    ([code, value]) => `    "${code}": ${formatNumberLiteral(value)},`,
  );
  return [
    `FALLBACK_RATES_DATE: str = "${dateStr}"  # ExchangeRate-API time_last_update_utc: ${utcLabel}`,
    "FALLBACK_RATES: dict[str, float] = {",
    ...lines,
    "}",
  ].join("\n");
}

function renderJsFallbackBlock(dateStr, utcLabel, rates) {
  const lines = Object.entries(rates).map(
    ([code, value]) => `  ${code}: ${formatNumberLiteral(value)},`,
  );
  return [
    `// Snapshot from ExchangeRate-API (time_last_update_utc: ${utcLabel})`,
    `export const FALLBACK_RATES_DATE = "${dateStr}";`,
    "export const FALLBACK_RATES = {",
    ...lines,
    "};",
  ].join("\n");
}

async function syncFromApi() {
  const res = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "UniSearch-FallbackSync/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`ExchangeRate-API responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || data.result !== "success" || !data.rates || typeof data.rates !== "object") {
    throw new Error(`Unexpected API response: ${JSON.stringify(data?.["error-type"] || "invalid payload")}`);
  }

  const { dateStr, utcLabel } = parseUtcSnapshotTimestamp(data.time_last_update_utc);
  const rates = normalizeRatesMap(data.rates);
  const count = Object.keys(rates).length;
  if (count < 100) {
    throw new Error(`Unexpectedly small currency count from API: ${count}`);
  }

  const pySource = fs.readFileSync(BACKEND_PATH, "utf8");
  const pyEol = pySource.includes("\r\n") ? "\r\n" : "\n";
  const pyPattern = /(?:FALLBACK_RATES_DATE[^\n]*\r?\n)?FALLBACK_RATES(?:\s*:\s*(?:dict|Dict)\[[^\]]+\])?\s*=\s*\{[\s\S]*?\r?\n\}/;
  if (!pyPattern.test(pySource)) {
    throw new Error("Could not locate FALLBACK_RATES block in backend/app/services/currency.py");
  }
  const pyReplacement = renderPythonFallbackBlock(dateStr, utcLabel, rates).replaceAll("\n", pyEol);
  fs.writeFileSync(BACKEND_PATH, pySource.replace(pyPattern, pyReplacement), "utf8");

  const jsSource = fs.readFileSync(FRONTEND_PATH, "utf8");
  const jsEol = jsSource.includes("\r\n") ? "\r\n" : "\n";
  const jsPattern = /(?:\/\/ Snapshot from ExchangeRate-API[^\n]*\r?\n)?(?:export\s+const\s+FALLBACK_RATES_DATE[^\n]*\r?\n)?export\s+const\s+FALLBACK_RATES\s*=\s*\{[\s\S]*?\r?\n\}\s*;/;
  if (!jsPattern.test(jsSource)) {
    throw new Error("Could not locate FALLBACK_RATES block in frontend/javascript/currency.js");
  }
  const jsReplacement = renderJsFallbackBlock(dateStr, utcLabel, rates).replaceAll("\n", jsEol);
  fs.writeFileSync(FRONTEND_PATH, jsSource.replace(jsPattern, jsReplacement), "utf8");

  console.log(`[sync-currency-fallback] Updated ${count} currencies (snapshot ${dateStr}, ${utcLabel})`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  if (args.has("--check")) {
    const result = checkFallbackParity();
    if (!result.ok) {
      for (const err of result.errors) {
        console.error(`[sync-currency-fallback] ${err}`);
      }
      process.exit(1);
    }
    console.log(`[sync-currency-fallback] OK: ${result.count} currencies and snapshot date ${result.date} match between backend and frontend.`);
  } else {
    syncFromApi()
      .then(() => {
        const result = checkFallbackParity();
        if (!result.ok) {
          throw new Error(result.errors.join("; "));
        }
      })
      .catch((err) => {
        console.error(`[sync-currency-fallback] ${err.message}`);
        process.exit(1);
      });
  }
}
