import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const unitDir = path.resolve(rootDir, "tests", "unit");

const allTestFiles = fs
  .readdirSync(unitDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("-"));
const flags = rawArgs.filter((a) => a.startsWith("-"));

let targetFiles = [];

if (positional.length > 0) {
  for (const pos of positional) {
    const clean = pos
      .replaceAll("\\", "/")
      .replace(/^tests\/unit\//, "")
      .toLowerCase();

    const matched = allTestFiles.filter((file) => {
      const lower = file.toLowerCase();
      return lower === clean || lower === `${clean}.test.mjs` || lower.includes(clean);
    });

    if (matched.length > 0) {
      for (const m of matched) {
        if (!targetFiles.includes(m)) targetFiles.push(m);
      }
    } else {
      console.warn(`[test:unit] no test file matched pattern: "${pos}"`);
    }
  }

  if (targetFiles.length === 0) {
    console.error(`[test:unit] available unit test files:\n  ${allTestFiles.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`[test:unit] running ${targetFiles.length} file(s): ${targetFiles.join(", ")}`);
} else {
  targetFiles = allTestFiles;
  console.log(`[test:unit] running all ${allTestFiles.length} unit test files`);
}

const filePaths = targetFiles.map((f) => path.join("tests", "unit", f));
const child = spawn(process.execPath, ["--test", ...flags, ...filePaths], {
  cwd: rootDir,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`[test:unit] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
