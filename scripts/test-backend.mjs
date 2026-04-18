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
};

const python = detectPython(rootDir, testEnv);

console.log(`[test:backend] using python: ${python}`);

const child = spawn(
  python,
  ["-m", "unittest", "discover", "tests", "-v"],
  {
    cwd: backendDir,
    env: testEnv,
    stdio: "inherit",
    shell: false,
  },
);

child.on("error", (error) => {
  console.error(`[test:backend] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
