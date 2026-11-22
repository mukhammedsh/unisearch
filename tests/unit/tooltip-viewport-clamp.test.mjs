import "./setup.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeViewportHorizontalShift } from "../../frontend/javascript/tooltip.js";

describe("computeViewportHorizontalShift", () => {
  it("returns 0 when the tooltip bubble already fits within the viewport", () => {
    const shift = computeViewportHorizontalShift(
      { left: 40, right: 200, width: 160 },
      503,
      12
    );
    assert.equal(shift, 0);
  });

  it("shifts left when the tooltip right edge overflows the viewport", () => {
    const shift = computeViewportHorizontalShift(
      { left: 236, right: 516, width: 280 },
      503,
      12
    );
    assert.equal(shift, -25);
  });

  it("shifts right when the tooltip left edge overflows past the left gutter", () => {
    const shift = computeViewportHorizontalShift(
      { left: -40, right: 240, width: 280 },
      503,
      12
    );
    assert.equal(shift, 52);
  });

  it("anchors overly wide bubbles to the left gutter rather than clipping their start off-screen", () => {
    const shift = computeViewportHorizontalShift(
      { left: 200, right: 700, width: 500 },
      360,
      12
    );
    assert.equal(shift, -188);
  });

  it("returns 0 for hidden, zero-width, or invalid inputs", () => {
    assert.equal(computeViewportHorizontalShift(null, 503), 0);
    assert.equal(computeViewportHorizontalShift({ left: 0, right: 0, width: 0 }, 503), 0);
    assert.equal(computeViewportHorizontalShift({ left: Number.NaN, right: 100, width: 100 }, 503), 0);
    assert.equal(computeViewportHorizontalShift({ left: 10, right: 200, width: 190 }, 0), 0);
  });

  it("respects custom horizontal gutter values", () => {
    const shift = computeViewportHorizontalShift(
      { left: 210, right: 495, width: 285 },
      500,
      20
    );
    assert.equal(shift, -15);
  });
});
