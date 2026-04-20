import fs from "node:fs";
import path from "node:path";

export function readProjectVersion(rootDir = process.cwd()) {
  const packagePath = path.resolve(rootDir, "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const payload = JSON.parse(raw);
  const version = String(payload.version || "").trim();

  if (!version) {
    throw new Error(`Missing package.json version in ${packagePath}`);
  }

  return version;
}
