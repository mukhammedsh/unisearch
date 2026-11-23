import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectPython, loadProjectEnv } from "./lib/project-env.mjs";

function detectUvx(env = process.env) {
  const explicit = String(env.UVX_BIN || "").trim();
  if (explicit) return explicit;

  const exe = process.platform === "win32" ? "uvx.exe" : "uvx";
  const pathDirs = String(env.PATH || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidates = [
    path.join(os.homedir(), ".local", "bin", exe),
    path.join(os.homedir(), ".cargo", "bin", exe),
    ...(process.platform === "win32"
      ? [
          ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, "uv", exe)] : []),
          ...(env.ProgramFiles ? [path.join(env.ProgramFiles, "uv", exe)] : []),
        ]
      : ["/usr/local/bin/uvx", "/usr/bin/uvx", "/opt/homebrew/bin/uvx"]),
    ...pathDirs.map((dir) => path.join(dir, exe)),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

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
const uvxPath = detectUvx(env);
if (!uvxPath) {
  console.error("[typecheck:backend] uvx executable not found; install uv or set UVX_BIN");
  process.exit(1);
}
const targets = ["backend/app"];

const args = [
  "--no-build",
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
const child = spawn(uvxPath, args, {
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
