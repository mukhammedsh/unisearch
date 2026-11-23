import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectPython, loadProjectEnv } from "./lib/project-env.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const backendDir = path.resolve(rootDir, "backend");
const env = {
  ...loadProjectEnv({
    rootDir,
    files: [".env", "backend/.env"],
  }),
  MYPYPATH: backendDir,
};

const python = detectPython(rootDir, env);
const targets = ["backend/app"];

const args = [
  "--python",
  "3.12",
  "--from",
  "mypy==1.15.0",
  "mypy",
  "--no-incremental",
  "--cache-dir",
  "/dev/null",
  "--python-executable",
  python,
  "--config-file",
  "backend/pyproject.toml",
  ...targets,
];

console.log(`[typecheck:backend] using python: ${python}`);
const child = spawn("uvx", args, {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`[typecheck:backend] failed to start uvx: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
