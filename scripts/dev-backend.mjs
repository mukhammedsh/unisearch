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

const python = detectPython(rootDir, env);
const host = String(env.BACKEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
const port = String(env.BACKEND_PORT || "8000").trim() || "8000";

console.log(`[dev:backend] using python: ${python}`);
console.log(`[dev:backend] serving API on http://${host}:${port}`);

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--reload", "--host", host, "--port", port],
  {
    cwd: backendDir,
    env,
    stdio: "inherit",
    shell: false,
  },
);

child.on("error", (error) => {
  console.error(`[dev:backend] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
