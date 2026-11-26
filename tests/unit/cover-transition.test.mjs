import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = globalThis.window || {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  setTimeout,
  clearTimeout,
};
globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {} },
};
if (!globalThis.navigator?.languages) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { languages: ["en-US"], language: "en-US" },
  });
}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
};

const { computeCoveredImageBox } = await import("../../frontend/javascript/components/cover-transition.js");

test("computeCoveredImageBox preserves natural aspect ratio and vertical focal offset across card and cover", () => {
  const cardBox = computeCoveredImageBox(
    { left: 500, top: 200, width: 426, height: 160 },
    1600,
    900,
    "50% 60%",
  );
  // Wide card clamps by width (1600 -> 426, height = 239.625); overflow is 160 - 239.625 = -79.625.
  assert.ok(Math.abs(cardBox.width - 426) < 1e-6);
  assert.ok(Math.abs(cardBox.height - 239.625) < 1e-6);
  assert.ok(Math.abs(cardBox.width / cardBox.height - 1600 / 900) < 1e-6);
  assert.ok(Math.abs(cardBox.left - 500) < 1e-6);
  assert.ok(Math.abs(cardBox.top - (200 - 79.625 * 0.6)) < 1e-6);

  const coverBox = computeCoveredImageBox(
    { left: 74, top: 90, width: 1132, height: 382 },
    1600,
    900,
    "50% 50%",
  );
  assert.ok(Math.abs(coverBox.width - 1132) < 1e-6);
  assert.ok(Math.abs(coverBox.height - 636.75) < 1e-6);
  assert.ok(Math.abs(coverBox.width / coverBox.height - 1600 / 900) < 1e-6);
  assert.ok(Math.abs(coverBox.left - 74) < 1e-6);
  assert.ok(Math.abs(coverBox.top - (90 - 254.75 * 0.5)) < 1e-6);
});

test("computeCoveredImageBox centers horizontally when container is narrower than image aspect", () => {
  const rect = { left: 20, top: 40, width: 260, height: 160 };
  const box = computeCoveredImageBox(rect, 1600, 900, "50% 60%");
  const expectedWidth = 160 * (1600 / 900);
  assert.ok(Math.abs(box.height - 160) < 1e-6);
  assert.ok(Math.abs(box.width - expectedWidth) < 1e-6);
  assert.ok(Math.abs(box.top - 40) < 1e-6);
  assert.ok(Math.abs(box.left - (20 + (260 - expectedWidth) * 0.5)) < 1e-6);
});

test("computeCoveredImageBox handles pixel offsets and always covers the full container rect", () => {
  const rect = { left: 100, top: 80, width: 400, height: 150 };
  const box = computeCoveredImageBox(rect, 1200, 900, "left -12px");
  assert.ok(Math.abs(box.left - 100) < 1e-6);
  assert.ok(Math.abs(box.top - 68) < 1e-6);
  assert.ok(box.left <= rect.left);
  assert.ok(box.top <= rect.top);
  assert.ok(box.left + box.width >= rect.left + rect.width);
  assert.ok(box.top + box.height >= rect.top + rect.height);
});
