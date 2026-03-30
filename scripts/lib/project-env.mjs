import fs from "node:fs";
import path from "node:path";

function parseEnvFile(content = "") {
  const values = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadProjectEnv({ rootDir, files = [] } = {}) {
  const resolvedRoot = path.resolve(rootDir || process.cwd());
  const loaded = {};

  for (const relPath of files) {
    const envPath = path.resolve(resolvedRoot, relPath);
    if (!fs.existsSync(envPath)) continue;
    Object.assign(loaded, parseEnvFile(fs.readFileSync(envPath, "utf8")));
  }

  return { ...loaded, ...process.env };
}

export function detectPython(rootDir, env = process.env) {
  const explicit = String(env.PYTHON_BIN || env.PYTHON || "").trim();
  if (explicit) return explicit;

  const resolvedRoot = path.resolve(rootDir || process.cwd());
  const candidates = [
    path.resolve(
      resolvedRoot,
      "backend",
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
    path.resolve(
      resolvedRoot,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found || "python";
}
