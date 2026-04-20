import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readProjectVersion } from "./lib/project-version.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const expectedVersion = readProjectVersion(rootDir);
const errors = [];

function readJson(relPath) {
  const target = path.resolve(rootDir, relPath);
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

const lock = readJson("package-lock.json");
if (String(lock.version || "") !== expectedVersion) {
  errors.push(`package-lock.json version is ${lock.version || "<missing>"}, expected ${expectedVersion}`);
}

const rootPackage = lock.packages && lock.packages[""];
if (!rootPackage || String(rootPackage.version || "") !== expectedVersion) {
  errors.push(
    `package-lock.json packages[\"\"].version is ${rootPackage?.version || "<missing>"}, expected ${expectedVersion}`,
  );
}

const envPath = path.resolve(rootDir, "frontend", "env.js");
const envText = fs.readFileSync(envPath, "utf8");
const envMatch = envText.match(/"APP_VERSION"\s*:\s*"([^"]+)"/);
if (!envMatch || envMatch[1] !== expectedVersion) {
  errors.push(`frontend/env.js APP_VERSION is ${envMatch?.[1] || "<missing>"}, expected ${expectedVersion}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`[check:version] version ${expectedVersion} is synchronized`);
