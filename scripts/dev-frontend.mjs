import { spawn } from "node:child_process";
import net from "node:net";
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
const host = normalizeHost(env.FRONTEND_HOST, "127.0.0.1");
const port = normalizePort(env.FRONTEND_PORT, 5501);
const portArg = String(port);
const probeHost = host === "0.0.0.0" ? "127.0.0.1" : (host === "::" ? "::1" : host);
generateFrontendEnvFile({ rootDir });

console.log("[dev:frontend] using configured Python runtime.");
console.log("[dev:frontend] wrote runtime config.");
console.log("[dev:frontend] serving UI with configured host and port.");

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

async function isFrontendServing(timeoutMs = 1000) {
  return await canConnect({ host: probeHost, port, timeoutMs });
}

if (await isFrontendServing()) {
  console.log("[dev:frontend] frontend already running.");
  process.exit(0);
}

const child = spawn(
  python,
  [
    path.resolve(scriptDir, "frontend_dev_server.py"),
    "--host",
    host,
    "--port",
    portArg,
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
