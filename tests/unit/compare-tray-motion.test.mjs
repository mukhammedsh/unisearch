import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createCompareTrayMotion } from "../../frontend/javascript/pages/universities/compare-tray-motion.js";

function createClassList() {
  const classes = new Set();
  return { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) };
}

function createChip() {
  return { classList: createClassList(), style: {}, addEventListener() {}, remove() { this.removed = true; } };
}

describe("compare tray motion", () => {
  it("dispose cancels a re-render that a chip fade scheduled", () => {
    global.CSS = global.CSS || { escape: (value) => String(value) };
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const chip = createChip();
      const tray = {
        hidden: false,
        classList: createClassList(),
        style: {},
        addEventListener() {},
        replaceChildren() {},
        querySelector: () => chip,
        querySelectorAll: () => [],
      };
      const motion = createCompareTrayMotion(tray);
      motion.show(["a", "b"], () => {});
      let rerenders = 0;
      assert.equal(motion.deferForRemovedChips(["a"], () => { rerenders += 1; }), true);
      motion.dispose();
      mock.timers.tick(500);
      assert.equal(rerenders, 0);
    } finally {
      mock.timers.reset();
    }
  });
});
