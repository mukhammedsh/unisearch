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
const probeHost = host === "0.0.0.0" ? "127.0.0.1" : (host === "::" ? "::1" : host);
const probeUrlHost = probeHost.includes(":") && !probeHost.startsWith("[") ? `[${probeHost}]` : probeHost;
const indexUrl = `http://${probeUrlHost}:${port}/index.html`;
const envPath = generateFrontendEnvFile({ rootDir });

console.log(`[dev:frontend] using python: ${python}`);
console.log(`[dev:frontend] wrote runtime config: ${envPath}`);
console.log(`[dev:frontend] serving UI on http://${host}:${port}/index.html`);

async function isFrontendServing(timeoutMs = 1000) {
  try {
    const response = await fetch(indexUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    return contentType.includes("text/html");
  } catch {
    return false;
  }
}

if (await isFrontendServing()) {
  console.log(`[dev:frontend] frontend already running at ${indexUrl}`);
  process.exit(0);
}

const child = spawn(
  python,
  [
    path.resolve(scriptDir, "frontend_dev_server.py"),
    "--host",
    host,
    "--port",
    port,
    "--directory",
    frontendDir,
  ],
  {
    cwd: rootDir,
    env,
    stdio: "inherit",
    shell: false,
  },
);

child.on("error", (error) => {
  console.error(`[dev:frontend] failed to start: ${error.message}`);
  process.exit(1);
});

const childExit = new Promise((resolve) => {
  child.on("exit", (code, signal) => {
    resolve({ code, signal });
  });
});

const { code, signal } = await childExit;
if (signal) process.kill(process.pid, signal);
process.exit(code ?? 0);
