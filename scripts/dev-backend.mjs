import { spawn } from "node:child_process";
import net from "node:net";
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
const host = normalizeHost(env.BACKEND_HOST, "127.0.0.1");
const port = normalizePort(env.BACKEND_PORT, 8000);
const portArg = String(port);
const probeHost = host === "0.0.0.0" ? "127.0.0.1" : (host === "::" ? "::1" : host);
const useReload = process.platform !== "win32";

console.log("[dev:backend] using configured Python runtime.");
console.log("[dev:backend] serving API with configured host and port.");
if (!useReload) {
  console.log("[dev:backend] Windows detected: starting without --reload to keep the terminal attached.");
}

function normalizeHost(value, fallback) {
  const hostValue = String(value || fallback).trim() || fallback;
  const unwrapped = hostValue.startsWith("[") && hostValue.endsWith("]") ? hostValue.slice(1, -1) : hostValue;
  if (net.isIP(unwrapped)) return unwrapped;
  if (/^[a-zA-Z0-9.-]+$/.test(unwrapped)) return unwrapped;
  return fallback;
}

function normalizePort(value, fallback) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) return parsed;
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect({ host: connectHost, port: connectPort, timeoutMs = 1000 }) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({
      host: connectHost,
      port: connectPort,
    });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function isBackendReachable(timeoutMs = 1000) {
  return await canConnect({ host: probeHost, port, timeoutMs });
}

async function waitForHealthyBackend({ attempts = 30, intervalMs = 1000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isBackendReachable()) return true;
    await sleep(intervalMs);
  }
  return await isBackendReachable();
}

async function main() {
  if (await isBackendReachable()) {
    console.log("[dev:backend] backend already running.");
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
      portArg,
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
      console.log("[dev:backend] backend port is reachable.");
    } else if (child.exitCode === null) {
      console.log("[dev:backend] backend is still starting; port is not reachable yet.");
    }
  })();

  const { code, signal } = await childExit;
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
}

await main();
