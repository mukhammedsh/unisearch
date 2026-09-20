import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectPython, loadProjectEnv } from "./lib/project-env.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const backendDir = path.resolve(rootDir, "backend");
const env = loadProjectEnv({
  rootDir,
  files: [".env", "backend/.env"],
});
const testEnv = {
  ...env,
  OPS_ADMIN_TOKEN: env.OPS_ADMIN_TOKEN || "test-ops-token",
  RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED || "0",
  ML_SEMANTIC_EMBEDDINGS_ENABLED: env.ML_SEMANTIC_EMBEDDINGS_ENABLED || "0",
};

const python = detectPython(rootDir, testEnv);

console.log(`[test:backend] using python: ${python}`);

function normalizeTestTarget(arg) {
  if (!arg || arg.startsWith("-")) return arg;
  let clean = arg.replaceAll("\\", "/").replace(/^\.\//, "");
  if (clean.startsWith("backend/")) clean = clean.slice("backend/".length);
  if (clean.startsWith("tests/")) clean = clean.slice("tests/".length);
  clean = clean.replace(/\.py(?=::|:|$)/, "");
  clean = clean.replaceAll("::", ".").replaceAll(":", ".");
  if (!clean.startsWith("tests.")) clean = `tests.${clean}`;
  return clean;
}

const rawArgs = process.argv.slice(2);
const positional = rawArgs.filter((a) => !a.startsWith("-"));
const flags = rawArgs.filter((a) => a.startsWith("-"));

let testArgs = [];
if (positional.length > 0) {
  const normalizedTargets = positional.map(normalizeTestTarget);
  testArgs = ["-m", "unittest", ...flags, ...normalizedTargets];
  console.log(`[test:backend] running target(s): ${normalizedTargets.join(", ")}`);
} else {
  const hasVerbosity = flags.some((f) => f === "-v" || f === "-q");
  testArgs = ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", ...(hasVerbosity ? flags : ["-v", ...flags])];
  console.log("[test:backend] running discovery across all backend tests");
}

const child = spawn(python, testArgs, {
  cwd: backendDir,
  env: testEnv,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`[test:backend] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
