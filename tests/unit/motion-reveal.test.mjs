import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { enterNewRows, fadeIn, isRevealing, readRowKeys, setRevealed, setTextWithFade } from "../../frontend/javascript/utils/motion-reveal.js";

/** Minimal element double: records animate() calls and lets the test settle them. */
function createNode({ hidden = false, display = "", height = 40 } = {}) {
  const classes = new Set();
  const node = {
    hidden,
    inert: false,
    textContent: "",
    scrollHeight: height,
    style: { display },
    animations: [],
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    getBoundingClientRect() {
      const collapsed = node.hidden || node.style.display === "none";
      return { height: collapsed ? 0 : height };
    },
    getAnimations() {
      return node.animations.filter((animation) => !animation.done);
    },
    animate(keyframes, options) {
      let resolve;
      let reject;
      const animation = {
        keyframes,
        options,
        done: false,
        cancelled: false,
        finished: new Promise((res, rej) => { resolve = res; reject = rej; }),
        finish() { animation.done = true; resolve(animation); },
        cancel() {
          animation.done = true;
          animation.cancelled = true;
          const error = new Error("cancelled");
          error.name = "AbortError";
          reject(error);
        },
      };
      node.animations.push(animation);
      return animation;
    },
  };
  return node;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("motion-reveal", () => {
  beforeEach(() => {
    global.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  });

  it("hides after the collapse finishes and keeps content inert meanwhile", async () => {
    const node = createNode();
    setRevealed(node, false);
    assert.equal(node.inert, true);
    assert.equal(node.hidden, false);
    assert.equal(node.classList.contains("motion-revealing"), true);
    const [animation] = node.animations;
    assert.deepEqual(animation.keyframes.map((frame) => frame.height), ["40px", "0px"]);
    animation.finish();
    await settle();
    assert.equal(node.hidden, true);
    assert.equal(node.inert, false);
    assert.equal(node.classList.contains("motion-revealing"), false);
  });

  it("shows immediately and animates height from zero to the measured size", async () => {
    const node = createNode({ hidden: true, height: 56 });
    setRevealed(node, true);
    assert.equal(node.hidden, false);
    const [animation] = node.animations;
    assert.deepEqual(animation.keyframes.map((frame) => frame.height), ["0px", "56px"]);
    assert.deepEqual(animation.keyframes.map((frame) => frame.opacity), [0, 1]);
    animation.finish();
    await settle();
    assert.equal(node.classList.contains("motion-revealing"), false);
  });

  it("display mode toggles style.display", async () => {
    const node = createNode({ display: "none" });
    setRevealed(node, true, { mode: "display", display: "block" });
    assert.equal(node.style.display, "block");
    node.animations[0].finish();
    await settle();
    setRevealed(node, false, { mode: "display" });
    node.animations[1].finish();
    await settle();
    assert.equal(node.style.display, "none");
  });

  it("a new call cancels the running animation and ends in the latest state", async () => {
    const node = createNode();
    setRevealed(node, false);
    const first = node.animations[0];
    setRevealed(node, true);
    assert.equal(first.cancelled, true);
    await settle();
    assert.equal(node.hidden, false);
    assert.equal(node.inert, false);
    node.animations[1].finish();
    await settle();
    assert.equal(node.hidden, false);
    assert.equal(node.classList.contains("motion-revealing"), false);
  });

  it("retarget restarts a running reveal toward the new full size", () => {
    const node = createNode({ hidden: true, height: 40 });
    setRevealed(node, true);
    assert.equal(isRevealing(node), true);
    setRevealed(node, true);
    assert.equal(node.animations.length, 1);
    setRevealed(node, true, { retarget: true });
    assert.equal(node.animations[0].cancelled, true);
    assert.equal(node.animations.length, 2);
  });

  it("instant and reduced motion skip animate()", () => {
    const node = createNode();
    setRevealed(node, false, { instant: true });
    assert.equal(node.hidden, true);
    assert.equal(node.animations.length, 0);

    global.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    setRevealed(node, true);
    assert.equal(node.hidden, false);
    assert.equal(node.animations.length, 0);
  });

  it("is a no-op when already in the requested state", () => {
    const node = createNode();
    setRevealed(node, true);
    assert.equal(node.animations.length, 0);
  });

  it("fadeIn plays opacity only", () => {
    const node = createNode();
    fadeIn(node);
    assert.deepEqual(node.animations[0].keyframes.map((frame) => frame.opacity), [0, 1]);
    assert.ok(node.animations[0].keyframes.every((frame) => !("transform" in frame) && !("height" in frame)));
  });

  it("setTextWithFade animates only when the text changes", () => {
    const node = createNode();
    node.textContent = "12";
    setTextWithFade(node, "12");
    assert.equal(node.animations.length, 0);
    setTextWithFade(node, "7");
    assert.equal(node.textContent, "7");
    assert.equal(node.animations.length, 1);
    setTextWithFade(node, "9", { instant: true });
    assert.equal(node.textContent, "9");
    assert.equal(node.animations.length, 1);
  });

  it("onHidden runs after the collapse and at once on the instant path", async () => {
    const node = createNode();
    let calls = 0;
    setRevealed(node, false, { onHidden: () => { calls += 1; } });
    assert.equal(calls, 0);
    node.animations[0].finish();
    await settle();
    assert.equal(calls, 1);

    const instantNode = createNode();
    setRevealed(instantNode, false, { instant: true, onHidden: () => { calls += 1; } });
    assert.equal(calls, 2);
  });

  it("onHidden is skipped when a show interrupts the hide", async () => {
    const node = createNode();
    let calls = 0;
    setRevealed(node, false, { onHidden: () => { calls += 1; } });
    setRevealed(node, true);
    await settle();
    node.animations[1].finish();
    await settle();
    assert.equal(calls, 0);
  });

  it("enterNewRows animates only rows with unseen keys and nothing on the first render", () => {
    global.CSS = global.CSS || { escape: (value) => String(value) };
    const makeRow = (key) => Object.assign(new global.HTMLElement(), { dataset: { rowKey: key }, classList: createNode().classList, style: {}, addEventListener() {} });
    const rows = [makeRow("a"), makeRow("b")];
    const list = {
      dataset: {},
      querySelectorAll: (selector) => (selector.includes("data-row-key=") ? rows.filter((row) => selector.includes(`"${row.dataset.rowKey}"`)) : rows),
    };
    assert.equal(readRowKeys(list), null);
    enterNewRows(list, ".row", null);
    assert.equal(list.dataset.rowsRendered, "1");
    assert.ok(rows.every((row) => !row.classList.contains("motion-list-item-enter")));

    const previous = readRowKeys(list);
    assert.deepEqual([...previous], ["a", "b"]);
    rows.push(makeRow("c"));
    enterNewRows(list, ".row", previous);
    assert.deepEqual(rows.map((row) => row.classList.contains("motion-list-item-enter")), [false, false, true]);
  });
});
