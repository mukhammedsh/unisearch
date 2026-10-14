#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const baselinePath = path.resolve(scriptDir, "inline-styles-baseline.json");
const args = new Set(process.argv.slice(2));
const updateBaseline = args.has("--update-baseline");
const verbose = args.has("--verbose") || args.has("-v");

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(absPath, predicate, out);
    else if (entry.isFile() && predicate(absPath, entry.name)) out.push(absPath);
  }
  return out;
}

function maskCommentsAndStrings(source, { keepStrings = false } = {}) {
  const chars = [...source];
  let quote = "";
  let templateDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (quote) {
      if (char === "\\") { i++; continue; }
      if (quote === "`" && char === "$" && next === "{") { templateDepth++; i++; continue; }
      if (quote === "`" && char === "}" && templateDepth) { templateDepth--; continue; }
      if (char === quote && !templateDepth) quote = "";
      if (!keepStrings && char !== "\n") chars[i] = " ";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; if (!keepStrings) chars[i] = " "; continue; }
    if (char === "/" && next === "*") {
      chars[i] = chars[i + 1] = " "; i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) { if (source[i] !== "\n") chars[i] = " "; i++; }
      if (i < source.length) { chars[i] = chars[i + 1] = " "; i++; }
    } else if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") chars[i++] = " "; i--;
    }
  }
  return chars.join("");
}

function cssDeclarations(source) {
  const clean = maskCommentsAndStrings(source);
  const declarations = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i <= clean.length; i++) {
    const char = clean[i] ?? ";";
    if (quote) { if (char === "\\") i++; else if (char === quote) quote = ""; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (depth === 0 && (char === ";" || char === "{" || char === "}")) {
      const segment = clean.slice(start, i).trim();
      const colon = segment.indexOf(":");
      if (colon > 0) {
        const property = segment.slice(0, colon).trim();
        if (/^--[\w-]+$/.test(property)) declarations.push(property);
      }
      start = i + 1;
    }
  }
  return declarations;
}

export function undefinedCssVariables(files, runtimeDeclarations = []) {
  const globalDeclarations = new Set([...runtimeDeclarations, ...files.flatMap(({ content }) => rootCssDeclarations(content))]);
  const violations = [];
  for (const { relPath, content } of files) {
    // shortcut: non-root declarations are stylesheet-local, not selector-scoped; upgrade if selector-aware cascade analysis is needed.
    const declarations = new Set([...globalDeclarations, ...cssDeclarations(content)]);
    const source = maskCommentsAndStrings(content);
    for (let i = 0; i < source.length; i++) {
      if (source.slice(i, i + 4).toLowerCase() !== "var(") continue;
      let cursor = i + 4;
      while (/\s/.test(source[cursor] ?? "")) cursor++;
      const match = source.slice(cursor).match(/^--[\w-]+/);
      let end = cursor + (match?.[0].length ?? 0);
      let depth = 0;
      let hasFallback = false;
      for (; end < source.length; end++) {
        if (source[end] === "(") depth++;
        else if (source[end] === ")") {
          if (depth === 0) break;
          depth--;
        } else if (source[end] === "," && depth === 0) hasFallback = true;
      }
      if (match && !hasFallback && !declarations.has(match[0])) {
        const line = source.slice(0, i).split("\n").length;
        violations.push({ file: relPath, line, variable: match[0] });
      }
    }
  }
  return violations;
}

function rootCssDeclarations(source) {
  const clean = maskCommentsAndStrings(source);
  const declarations = [];
  for (const match of clean.matchAll(/:root\b[^{}]*\{/gi)) {
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < clean.length && depth > 0; end++) {
      if (clean[end] === "{") depth++;
      else if (clean[end] === "}") depth--;
    }
    declarations.push(...cssDeclarations(source.slice(match.index + match[0].length, end - 1)));
  }
  return declarations;
}

export function customPropertiesSetByJavaScript(source) {
  const tokens = jsTokens(source);
  const properties = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === "style" && tokens[i + 1]?.value === "." && tokens[i + 2]?.value === "setProperty"
        && tokens[i + 3]?.value === "(" && tokens[i + 4]?.type === "string" && tokens[i + 4].value.startsWith("--")) {
      properties.push(tokens[i + 4].value);
    }
    if (tokens[i].value === "style" && tokens[i + 1]?.value === "." && tokens[i + 2]?.value === "cssText"
        && tokens[i + 3]?.value === "=" && tokens[i + 4]?.type === "string") {
      properties.push(...customPropertiesInCssText(tokens[i + 4].value));
    }
    if (tokens[i]?.type === "string") properties.push(...customPropertiesInStyleAttributes(tokens[i].value));
  }
  return properties;
}

function customPropertiesInCssText(value) {
  return [...value.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
}

function customPropertiesInStyleAttributes(value) {
  const properties = [];
  for (const match of value.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gi)) properties.push(...customPropertiesInCssText(match[2]));
  return properties;
}

function customPropertiesInHtmlStyleAttributes(source) {
  const properties = [];
  for (const match of source.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gi)) properties.push(...customPropertiesInCssText(match[2]));
  return properties;
}

const DESIGN_PROPERTIES = new Set([
  "background", "backgroundColor", "backgroundImage", "border", "borderColor", "borderRadius", "borderWidth",
  "bottom", "boxShadow", "color", "cssText", "flex", "font", "fontFamily", "fontSize", "fontWeight",
  "gap", "gridTemplateColumns", "height", "left", "letterSpacing", "lineHeight", "margin", "maxHeight",
  "maxWidth", "minHeight", "minWidth", "padding", "position", "right", "rowGap", "columnGap", "top",
  "transform", "width",
]);
const BEHAVIOR_PROPERTIES = new Set(["display", "visibility", "overflow", "overflowX", "overflowY", "colorScheme", "animation", "animationDelay", "transition", "opacity"]);

function jsTokens(source) {
  const masked = maskRegexLiterals(maskCommentsAndStrings(source, { keepStrings: true }));
  const tokens = [];
  const lineBreaks = [...source.matchAll(/\n/g)].map((match) => match.index);
  const lineAt = (offset) => {
    let low = 0;
    let high = lineBreaks.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (lineBreaks[middle] < offset) low = middle + 1;
      else high = middle;
    }
    return low + 1;
  };
  const tokenPattern = /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|==|!=|\?\.|\?\?|&&|\|\||\+=|-=|\*=|\/=|[{}()[\].,;:=+*/!?<>-]/g;
  for (const match of masked.matchAll(tokenPattern)) {
    const text = match[0];
    const original = source.slice(match.index, match.index + text.length);
    const line = lineAt(match.index);
    if (/^["'`]/.test(text)) tokens.push({ type: "string", value: original.slice(1, -1), dynamic: text[0] === "`" && original.includes("${"), text: original, line });
    else tokens.push({ type: "token", value: text, line });
  }
  return tokens;
}

function maskRegexLiterals(source) {
  const chars = [...source];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "'" || source[i] === '"' || source[i] === "`") {
      const quote = source[i++];
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i++] === quote) break;
      }
      i--;
      continue;
    }
    if (source[i] !== "/") continue;
    let previous = i - 1;
    while (previous >= 0 && /\s/.test(source[previous])) previous--;
    const prefix = source.slice(0, i);
    const followsExpressionPrefix = /(?:^|[;{}]\s*|\b)(?:return|throw|case|yield|await)\s*$/.test(prefix)
      || /=>\s*$/.test(prefix);
    const canStartRegex = followsExpressionPrefix || previous < 0 || /[=(:,;!?[{&|]/.test(source[previous]);
    if (!canStartRegex || source[i + 1] === "/" || source[i + 1] === "*") continue;
    let cursor = i + 1;
    let inClass = false;
    for (; cursor < source.length && source[cursor] !== "\n"; cursor++) {
      if (source[cursor] === "\\") { cursor++; continue; }
      if (source[cursor] === "[") inClass = true;
      else if (source[cursor] === "]") inClass = false;
      else if (source[cursor] === "/" && !inClass) break;
    }
    if (cursor >= source.length || source[cursor] !== "/") continue;
    while (/[A-Za-z]/.test(source[cursor + 1] ?? "")) cursor++;
    for (let index = i; index <= cursor; index++) if (source[index] !== "\n") chars[index] = " ";
    i = cursor;
  }
  return chars.join("");
}

export function javascriptStyleViolations(source) {
  const tokens = jsTokens(source);
  const violations = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value !== "style") continue;
    if (tokens[i + 1]?.value === "[" && tokens[i + 2]?.type === "string" && tokens[i + 3]?.value === "]"
        && tokens[i + 4]?.value === "=" && DESIGN_PROPERTIES.has(tokens[i + 2].value) && !BEHAVIOR_PROPERTIES.has(tokens[i + 2].value)) {
      const value = tokens[i + 5];
      if (value?.type === "string" && !value.dynamic) violations.push({ property: tokens[i + 2].value, value: value.value, line: tokens[i].line });
      continue;
    }
    const dot = tokens[i + 1]?.value === "." ? i + 1 : -1;
    if (dot < 0) continue;
    const member = tokens[dot + 1];
    if (!member) continue;
    if (member.value === "setProperty" && tokens[dot + 2]?.value === "(") {
      const property = tokens[dot + 3];
      const value = tokens[dot + 5];
      if (property?.type === "string" && value?.type === "string" && !value.dynamic) {
        violations.push({ property: property.value, value: value.value, line: tokens[i].line });
      }
    } else if (DESIGN_PROPERTIES.has(member.value) && !BEHAVIOR_PROPERTIES.has(member.value) && tokens[dot + 2]?.value === "=") {
      const value = tokens[dot + 3];
      if (value?.type === "string" && !value.dynamic) violations.push({ property: member.value, value: value.value, line: tokens[i].line });
    }
  }
  return violations;
}

export function baselineUpdateBlocked({ missingVariables, staticStyleWrites }) {
  return missingVariables.length > 0 || staticStyleWrites.length > 0;
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) return {};
  try { return JSON.parse(fs.readFileSync(baselinePath, "utf8")); } catch { return {}; }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const violations = [];
  for (const [index, line] of content.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    const styleMatch = line.match(/\bstyle\s*=\s*(["'])(.*?)\1/i);
    if (styleMatch) violations.push({ line: index + 1, code: trimmed, styleContent: styleMatch[2] });
  }
  return { relPath, violations };
}

function run() {
  if (!fs.existsSync(frontendDir)) { console.error(`[check:inline-styles] Frontend directory not found: ${frontendDir}`); process.exit(1); }
  const htmlFiles = walkFiles(frontendDir, (_, name) => name.endsWith(".html"));
  const jsFiles = walkFiles(path.join(frontendDir, "javascript"), (_, name) => name.endsWith(".js"));
  const cssFiles = walkFiles(path.join(frontendDir, "css"), (_, name) => name.endsWith(".css"));
  const baseline = loadBaseline();
  const scans = [...htmlFiles, ...jsFiles].sort().map(scanFile);
  const newBaseline = Object.fromEntries(scans.map(({ relPath, violations }) => [relPath, violations.length]));
  const regressions = scans.flatMap(({ relPath, violations }) => {
    const excess = violations.slice(baseline[relPath] ?? 0);
    return excess.map((item) => `${relPath}:${item.line}: inline style attribute ${item.code}`);
  });
  const cssInputs = cssFiles.map((filePath) => ({ relPath: path.relative(rootDir, filePath).replace(/\\/g, "/"), content: fs.readFileSync(filePath, "utf8") }));
  const runtimeDeclarations = [
    ...jsFiles.flatMap((filePath) => customPropertiesSetByJavaScript(fs.readFileSync(filePath, "utf8"))),
    ...htmlFiles.flatMap((filePath) => customPropertiesInHtmlStyleAttributes(fs.readFileSync(filePath, "utf8"))),
  ];
  const missingVars = undefinedCssVariables(cssInputs, runtimeDeclarations);
  const styleWrites = jsFiles.flatMap((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
    return javascriptStyleViolations(content).map(({ property, value, line }) => `${relPath}:${line}: inline style assignment ${property}: ${value}`);
  });
  console.log(`Legacy inline style attributes: ${scans.reduce((sum, scan) => sum + scan.violations.length, 0)} (existing baseline enforced)`);
  console.log(`Undefined CSS custom properties: ${missingVars.length}`);
  console.log(`Static JavaScript design style writes: ${styleWrites.length}`);
  if (updateBaseline && baselineUpdateBlocked({ missingVariables: missingVars, staticStyleWrites: styleWrites })) {
    for (const { file, line, variable } of missingVars) console.error(`[check:inline-styles] ${file}:${line}: undefined CSS custom property ${variable}`);
    for (const item of styleWrites) console.error(`[check:inline-styles] ${item}`);
    process.exitCode = 1;
    return;
  }
  if (updateBaseline) {
    fs.writeFileSync(baselinePath, `${JSON.stringify(newBaseline, null, 2)}\n`, "utf8");
    console.log(`[check:inline-styles] Baseline successfully saved to ${path.relative(rootDir, baselinePath)}`);
    return;
  }
  if (verbose) {
    for (const { relPath, violations } of scans) {
      for (const item of violations) console.log(`${relPath}:${item.line}: ${item.code}`);
    }
  }
  if (missingVars.length || styleWrites.length || regressions.length) {
    for (const item of regressions) console.error(`[check:inline-styles] ${item}`);
    for (const { file, line, variable } of missingVars) console.error(`[check:inline-styles] ${file}:${line}: undefined CSS custom property ${variable}`);
    for (const item of styleWrites) console.error(`[check:inline-styles] ${item}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
