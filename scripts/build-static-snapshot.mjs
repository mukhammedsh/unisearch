import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectPython, loadProjectEnv } from "./lib/project-env.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const env = loadProjectEnv({
  rootDir,
  files: [".env", "backend/.env"],
});

const python = detectPython(rootDir, env);
const scriptPath = path.resolve(rootDir, "backend", "scripts", "build_static_snapshot.py");
const args = process.argv.slice(2);

const child = spawn(python, ["-X", "utf8", scriptPath, ...args], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`[build:snapshot] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
