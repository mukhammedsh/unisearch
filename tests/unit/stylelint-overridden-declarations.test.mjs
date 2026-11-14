import test from "node:test";
import assert from "node:assert/strict";
import stylelint from "stylelint";

const config = {
  plugins: ["./scripts/stylelint/no-overridden-declarations.mjs"],
  rules: { "unisearch/no-overridden-declarations": true },
};

async function warnings(code) {
  const { results } = await stylelint.lint({ code, config, configBasedir: process.cwd() });
  return results[0].warnings.map((warning) => `${warning.line}:${warning.text.split(" is ")[0]}`);
}

test("reports a declaration that a later rule for the same selector always overrides", async () => {
  assert.deepEqual(await warnings(".a { padding: 4px; color: red; }\n.a { padding: 8px; }"), ['1:"padding"']);
});

test("a later shorthand overrides an earlier longhand, but not the other way round", async () => {
  assert.deepEqual(await warnings(".a { padding-top: 4px; }\n.a { padding: 8px; }"), ['1:"padding-top"']);
  assert.deepEqual(await warnings(".a { padding: 4px; }\n.a { padding-top: 8px; }"), []);
});

test("a later top-level rule or wider max-width query overrides an earlier narrower one", async () => {
  assert.deepEqual(await warnings("@media (max-width: 480px) { .a { gap: 4px; } }\n.a { gap: 8px; }"), ['1:"gap"']);
  assert.deepEqual(await warnings("@media (max-width: 480px) { .a { gap: 4px; } }\n@media (max-width: 768px) { .a { gap: 8px; } }"), ['1:"gap"']);
});

test("keeps declarations that apply where the later rule does not", async () => {
  assert.deepEqual(await warnings(".a { gap: 4px; }\n@media (max-width: 768px) { .a { gap: 8px; } }"), []);
  assert.deepEqual(await warnings("@media (max-width: 768px) { .a { gap: 4px; } }\n@media (max-width: 480px) { .a { gap: 8px; } }"), []);
  assert.deepEqual(await warnings(".a { color: red !important; }\n.a { color: blue; }"), []);
  assert.deepEqual(await warnings(".a { height: 100vh; }\n.a { height: 100dvh; }"), []);
  assert.deepEqual(await warnings(".a { gap: 4px; }\n.a .b { gap: 8px; }"), []);
});
