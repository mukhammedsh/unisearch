import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("locale packs refresh after an app update and reuse the current version's cache", async () => {
  const cache = new Map(["eng", "rus", "kaz"].flatMap(lang => [
    [`unisearch_i18n_pack_v3_${lang}`, "meta.code: old\nlegacy.label: Old label\n"],
    [`unisearch_i18n_pack_v4_8.1.7_${lang}`, "meta.code: old\nlegacy.label: Old label\n"],
    [`unisearch_i18n_pack_v5_8.1.7_${lang}`, "meta.code: old\nlegacy.label: Old label\n"],
  ]));
  window.sessionStorage = {
    getItem: key => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, value),
  };
  let requests = 0;
  const urls = [];
  global.fetch = async url => {
    requests += 1;
    urls.push(url);
    return { ok: true, text: async () => `meta.code: EN\nprogram.label: Programs for ${window.APP_VERSION}\n` };
  };
  window.APP_VERSION = "8.1.7";
  const current = await import("../../frontend/javascript/i18n.js?cache-current");
  await current.initI18n();
  assert.equal(current.t("program.label"), "Programs for 8.1.7");
  assert.equal(requests, 3);

  const reloaded = await import("../../frontend/javascript/i18n.js?cache-reload");
  await reloaded.initI18n();
  assert.equal(reloaded.t("program.label"), "Programs for 8.1.7");
  assert.equal(requests, 3);

  window.APP_VERSION = "8.1.8";
  const updated = await import("../../frontend/javascript/i18n.js?cache-updated");
  await updated.initI18n();
  assert.equal(updated.t("program.label"), "Programs for 8.1.8");
  assert.equal(requests, 6);
  assert.ok(urls.slice(0, 3).every(url => new URL(url, "https://example.test").searchParams.get("v") === "8.1.7"));
  assert.ok(urls.slice(3).every(url => new URL(url, "https://example.test").searchParams.get("v") === "8.1.8"));
  assert.ok(urls.every(url => new URL(url, "https://example.test").searchParams.has("r")));
});
