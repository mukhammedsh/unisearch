import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectEnv } from "../../scripts/lib/project-env.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const defaultRootDir = path.resolve(scriptDir, "..", "..");

export function generateFrontendEnvFile({ rootDir = defaultRootDir } = {}) {
  const env = loadProjectEnv({
    rootDir,
    files: [".env", "backend/.env", "frontend/.env"],
  });

  const apiBase = String(env.UNISEARCH_API_BASE_URL || "").trim();
  const apiPort = String(env.UNISEARCH_API_PORT || env.BACKEND_PORT || "8000").trim() || "8000";
  const prettyRaw = String(env.UNISEARCH_USE_PRETTY_URLS || "").trim();
  const debugRaw = String(env.UNISEARCH_APP_DEBUG || "").trim();

  const payload = {
    API_BASE_URL: apiBase,
    API_PORT: apiPort,
    APP_USE_PRETTY_URLS: prettyRaw,
    APP_DEBUG: debugRaw,
  };

  const target = path.resolve(rootDir, "frontend", "env.js");
  const content = `// Auto-generated at deploy time\nwindow.__UNISEARCH_ENV__ = ${JSON.stringify(payload, null, 2)};\n`;

  fs.writeFileSync(target, content, "utf8");
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const target = generateFrontendEnvFile();
  console.log(`[generate-env-js] wrote ${target}`);
}
