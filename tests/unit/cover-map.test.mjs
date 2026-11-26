import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  computeEdgePointer,
  nearestWrappedLng,
  parseCoverCoordinates,
} = await import("../../frontend/javascript/pages/university/cover-map.js");

test("parseCoverCoordinates parses valid numeric and string coordinates and rejects invalid inputs", () => {
  assert.deepEqual(parseCoverCoordinates({ lat: 42.3601, lon: -71.0942 }), [42.3601, -71.0942]);
  assert.deepEqual(parseCoverCoordinates({ lat: "51.4988", lon: "-0.1749" }), [51.4988, -0.1749]);
  assert.deepEqual(parseCoverCoordinates({ lat: 0, lon: 0 }), [0, 0]);

  assert.equal(parseCoverCoordinates(null), null);
  assert.equal(parseCoverCoordinates(undefined), null);
  assert.equal(parseCoverCoordinates({ lat: "", lon: 10 }), null);
  assert.equal(parseCoverCoordinates({ lat: 10, lon: "" }), null);
  assert.equal(parseCoverCoordinates({ lat: Number.NaN, lon: 10 }), null);
  assert.equal(parseCoverCoordinates({ lat: 90.1, lon: 10 }), null);
  assert.equal(parseCoverCoordinates({ lat: -90.1, lon: 10 }), null);
  assert.equal(parseCoverCoordinates({ lat: 10, lon: 180.1 }), null);
  assert.equal(parseCoverCoordinates({ lat: 10, lon: -180.1 }), null);
});

test("nearestWrappedLng picks the shortest horizontal world copy across the antimeridian", () => {
  assert.equal(nearestWrappedLng(10, 15), 10);
  assert.equal(nearestWrappedLng(170, -170), -190);
  assert.equal(nearestWrappedLng(-170, 170), 190);
  assert.equal(nearestWrappedLng(170, 530), 530);
});

test("computeEdgePointer returns null when marker is visible or inputs are invalid", () => {
  assert.equal(computeEdgePointer(null, 800, 400), null);
  assert.equal(computeEdgePointer({ x: Number.NaN, y: 100 }, 800, 400), null);
  assert.equal(computeEdgePointer({ x: 100, y: 100 }, 0, 400), null);
  assert.equal(computeEdgePointer({ x: 100, y: 100 }, 800, 0), null);

  assert.equal(computeEdgePointer({ x: 400, y: 200 }, 800, 400), null);
  assert.equal(computeEdgePointer({ x: -18, y: 200 }, 800, 400), null);
  assert.equal(computeEdgePointer({ x: 818, y: 418 }, 800, 400), null);
});

test("computeEdgePointer clamps off-screen markers to the cover edge and clears corner controls", () => {
  const right = computeEdgePointer({ x: 1200, y: 200 }, 800, 400);
  assert.ok(right);
  assert.equal(right.x, 770);
  assert.equal(right.y, 200);
  assert.equal(Math.round(right.angleDeg), 0);

  const topLeftCorner = computeEdgePointer({ x: -600, y: -600 }, 800, 400);
  assert.ok(topLeftCorner);
  assert.ok(topLeftCorner.x >= 30 && topLeftCorner.x <= 770);
  assert.ok(topLeftCorner.y >= 30 && topLeftCorner.y <= 370);
  assert.ok(!(topLeftCorner.x < 78 && topLeftCorner.y < 78));

  const bottomRightCorner = computeEdgePointer({ x: 1600, y: 1000 }, 800, 400);
  assert.ok(bottomRightCorner);
  assert.ok(!(bottomRightCorner.x > 722 && bottomRightCorner.y > 286));
});
