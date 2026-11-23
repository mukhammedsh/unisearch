import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Cached locale packs are keyed by I18N_PACK_REVISION. A localization change that keeps the old revision leaves
// readers with a stale cache, so new keys render as empty text until the browser tab is closed.
test("the locale pack revision matches the localization files", async () => {
  const hash = createHash("sha256");
  for (const file of ["eng", "ru", "kaz"]) {
    const text = await readFile(new URL(`../../frontend/Localization/${file}`, import.meta.url), "utf8");
    hash.update(text.replace(/\r\n/g, "\n"));
  }
  const expected = hash.digest("hex").slice(0, 8);
  const source = await readFile(new URL("../../frontend/javascript/i18n.js", import.meta.url), "utf8");
  const revision = source.match(/const I18N_PACK_REVISION = "([^"]+)"/)?.[1];
  assert.equal(revision, expected, `Localization files changed: run "npm run fix:i18n" (sets I18N_PACK_REVISION to "${expected}").`);
});
