// Keeps I18N_PACK_REVISION in frontend/javascript/i18n.js equal to a hash of the localization files.
// Browsers cache locale packs by this revision, so a stale value leaves new keys blank for returning readers.
// Usage: node scripts/i18n-pack-revision.mjs [--fix]
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../frontend/", import.meta.url);
const hash = createHash("sha256");
for (const file of ["eng", "ru", "kaz"]) {
  const text = await readFile(new URL(`Localization/${file}`, root), "utf8");
  hash.update(text.replace(/\r\n/g, "\n"));
}
const expected = hash.digest("hex").slice(0, 8);
const sourceUrl = new URL("javascript/i18n.js", root);
const source = await readFile(sourceUrl, "utf8");
const pattern = /const I18N_PACK_REVISION = "([^"]*)"/;
const current = source.match(pattern)?.[1];
if (current === undefined) {
  console.error("I18N_PACK_REVISION is missing from frontend/javascript/i18n.js.");
  process.exit(1);
}
if (current === expected) {
  console.log(`Locale pack revision is current (${expected}).`);
} else if (process.argv.includes("--fix")) {
  await writeFile(sourceUrl, source.replace(pattern, `const I18N_PACK_REVISION = "${expected}"`), "utf8");
  console.log(`Locale pack revision updated: ${current} -> ${expected}.`);
} else {
  console.error(`Localization files changed: run "npm run fix:i18n" to set I18N_PACK_REVISION to "${expected}".`);
  process.exit(1);
}
