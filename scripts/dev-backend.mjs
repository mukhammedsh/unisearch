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
const probeHost = host === "0.0.0.0" ? "127.0.0.1" : (host === "::" ? "::1" : host);
const probeUrlHost = probeHost.includes(":") && !probeHost.startsWith("[") ? `[${probeHost}]` : probeHost;
const healthUrl = `http://${probeUrlHost}:${port}/health`;
const useReload = process.platform !== "win32";

console.log(`[dev:backend] using python: ${python}`);
console.log(`[dev:backend] serving API on http://${host}:${port}`);
if (!useReload) {
  console.log("[dev:backend] Windows detected: starting without --reload to keep the terminal attached.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendHealthy(timeoutMs = 1000) {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return Boolean(payload && payload.status === "ok");
  } catch {
    return false;
  }
}

async function waitForHealthyBackend({ attempts = 30, intervalMs = 1000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isBackendHealthy()) return true;
    await sleep(intervalMs);
  }
  return await isBackendHealthy();
}

async function main() {
  if (await isBackendHealthy()) {
    console.log(`[dev:backend] backend already running at ${healthUrl}`);
    return;
  }

  const child = spawn(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      host,
      "--port",
      port,
      ...(useReload ? ["--reload"] : []),
    ],
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

  const childExit = new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  // Poll readiness in the background for a friendlier first-start message,
  // but keep the parent process bound to the child lifecycle.
  void (async () => {
    if (await waitForHealthyBackend({ attempts: 60, intervalMs: 1000 })) {
      console.log(`[dev:backend] backend ready at ${healthUrl}`);
    } else if (child.exitCode === null) {
      console.log(`[dev:backend] backend is still starting; health endpoint not ready yet: ${healthUrl}`);
    }
  })();

  const { code, signal } = await childExit;
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
}

await main();
