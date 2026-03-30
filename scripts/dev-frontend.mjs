import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFrontendEnvFile } from "../frontend/scripts/generate-env-js.mjs";
import { detectPython, loadProjectEnv } from "./lib/project-env.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frontendDir = path.resolve(rootDir, "frontend");
const env = loadProjectEnv({
  rootDir,
  files: [".env", "backend/.env", "frontend/.env"],
});

const python = detectPython(rootDir, env);
const host = String(env.FRONTEND_HOST || "127.0.0.1").trim() || "127.0.0.1";
const port = String(env.FRONTEND_PORT || "5501").trim() || "5501";
const envPath = generateFrontendEnvFile({ rootDir });

console.log(`[dev:frontend] using python: ${python}`);
console.log(`[dev:frontend] wrote runtime config: ${envPath}`);
console.log(`[dev:frontend] serving UI on http://${host}:${port}/index.html`);

const child = spawn(
  python,
  ["-m", "http.server", port, "--bind", host],
  {
    cwd: frontendDir,
    env,
    stdio: "inherit",
    shell: false,
  },
);

child.on("error", (error) => {
  console.error(`[dev:frontend] failed to start: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
