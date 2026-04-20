import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const versionArg = String(process.argv[2] || "").trim();
const semverPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const increments = new Set(["patch", "minor", "major"]);

function fail(message) {
  console.error(`[bump:version] ${message}`);
  console.error("[bump:version] usage: npm run bump:version -- patch | minor | major | X.Y.Z");
  process.exit(1);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.resolve(rootDir, relPath), "utf8"));
}

function writeJson(relPath, payload) {
  fs.writeFileSync(
    path.resolve(rootDir, relPath),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

function bumpVersion(currentVersion, kind) {
  const match = currentVersion.match(semverPattern);
  if (!match) fail(`current package.json version is not valid semver: ${currentVersion}`);

  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (kind === "major") return `${parts[0] + 1}.0.0`;
  if (kind === "minor") return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function run(command, args) {
  const bin = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(bin, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!versionArg) fail("missing target version");
if (!increments.has(versionArg) && !semverPattern.test(versionArg)) {
  fail(`unsupported target version: ${versionArg}`);
}

const packageJson = readJson("package.json");
const currentVersion = String(packageJson.version || "").trim();
const nextVersion = increments.has(versionArg) ? bumpVersion(currentVersion, versionArg) : versionArg;

if (nextVersion === currentVersion) {
  fail(`package.json already uses ${nextVersion}`);
}

packageJson.version = nextVersion;
writeJson("package.json", packageJson);

const packageLock = readJson("package-lock.json");
packageLock.version = nextVersion;
if (packageLock.packages && packageLock.packages[""]) {
  packageLock.packages[""].version = nextVersion;
}
writeJson("package-lock.json", packageLock);

console.log(`[bump:version] ${currentVersion} -> ${nextVersion}`);
run(process.execPath, ["frontend/scripts/generate-env-js.mjs"]);
run(process.execPath, ["scripts/check-version-sync.mjs"]);
