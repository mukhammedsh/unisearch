import "./setup.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bindInfoTooltips,
  computeViewportHorizontalShift,
  shouldConsumeCardTooltipClick,
  shouldPinTooltipOnClick,
} from "../../frontend/javascript/tooltip.js";

describe("shouldPinTooltipOnClick and shouldConsumeCardTooltipClick", () => {
  const desktopWin = { matchMedia: () => ({ matches: false }) };
  const coarseWin = { matchMedia: () => ({ matches: true }) };

  it("returns false for mouse clicks even if the device also reports a coarse primary pointer", () => {
    assert.equal(shouldPinTooltipOnClick({ pointerType: "mouse", detail: 1 }, "", desktopWin), false);
    assert.equal(shouldPinTooltipOnClick({ pointerType: "mouse", detail: 1 }, "touch", coarseWin), false);
    assert.equal(shouldPinTooltipOnClick({ detail: 1 }, "mouse", coarseWin), false);
    assert.equal(shouldConsumeCardTooltipClick({ pointerType: "mouse", detail: 1 }, "", desktopWin), false);
  });

  it("returns true for touch and stylus taps on both mobile and hybrid desktop devices", () => {
    assert.equal(shouldPinTooltipOnClick({ pointerType: "touch", detail: 1 }, "", desktopWin), true);
    assert.equal(shouldPinTooltipOnClick({ pointerType: "pen", detail: 1 }, "", desktopWin), true);
    assert.equal(shouldPinTooltipOnClick({ detail: 1 }, "touch", desktopWin), true);
    assert.equal(shouldConsumeCardTooltipClick({ pointerType: "touch", detail: 1 }, "", desktopWin), true);
  });

  it("keeps keyboard Enter/Space activation on the focused tooltip button without pinning .is-open", () => {
    assert.equal(shouldPinTooltipOnClick({ pointerType: "", detail: 0 }, "", desktopWin), false);
    assert.equal(shouldPinTooltipOnClick({ pointerType: "", detail: 0 }, "", coarseWin), false);
    assert.equal(shouldConsumeCardTooltipClick({ pointerType: "", detail: 0 }, "", desktopWin), true);
  });

  it("falls back to coarse/non-hover media queries only when click carries no pointerType", () => {
    assert.equal(shouldPinTooltipOnClick({ detail: 1 }, "", desktopWin), false);
    assert.equal(shouldPinTooltipOnClick({ detail: 1 }, "", coarseWin), true);
  });
});

describe("bindInfoTooltips pointer modality handling", () => {
  function createTooltipDom() {
    if (typeof globalThis.Node === "undefined") globalThis.Node = class {};
    if (typeof globalThis.Element === "undefined") {
      globalThis.Element = class extends globalThis.Node {};
    }
    if (!(globalThis.HTMLElement.prototype instanceof globalThis.Element)) {
      Object.setPrototypeOf(globalThis.HTMLElement.prototype, globalThis.Element.prototype);
    }
    const listeners = new Map();
    const wrapClasses = new Set();
    const attrs = new Map([["aria-expanded", "false"]]);
    let blurred = false;
    let focused = false;

    const bubble = Object.assign(Object.create(HTMLElement.prototype), {
      matches: (sel) => sel.includes(".test-bubble"),
      getBoundingClientRect: () => ({ left: 40, right: 200, width: 160 }),
      style: {
        setProperty() {},
        removeProperty() {},
      },
    });

    const btn = Object.assign(Object.create(Element.prototype), {
      matches: (sel) => sel.includes(".test-btn"),
      closest: (sel) => {
        if (sel.includes(".test-btn")) return btn;
        if (sel.includes(".test-wrap")) return wrap;
        return null;
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
      blur: () => { blurred = true; },
      focus: () => { focused = true; },
    });

    const wrap = Object.assign(Object.create(Element.prototype), {
      children: [btn, bubble],
      classList: {
        add: (c) => wrapClasses.add(c),
        remove: (c) => wrapClasses.delete(c),
        contains: (c) => wrapClasses.has(c),
      },
      closest: (sel) => (sel.includes(".test-wrap") ? wrap : null),
      contains: (node) => node === wrap || node === btn || node === bubble,
      querySelector: (sel) => (sel.includes(".test-btn") ? btn : null),
    });

    let hovered = false;
    const root = {
      addEventListener: (type, fn) => {
        const list = listeners.get(type) || [];
        list.push(fn);
        listeners.set(type, list);
      },
      querySelectorAll: (sel) => {
        if (sel.includes(":is(:hover, :focus-within)")) {
          return hovered && !wrapClasses.has("is-closed") ? [wrap] : [];
        }
        if (sel.includes("is-open") && wrapClasses.has("is-open")) return [wrap];
        if (sel.includes("is-closed") && wrapClasses.has("is-closed")) return [wrap];
        return [];
      },
    };

    const dispatch = (type, eventInit = {}) => {
      let defaultPrevented = false;
      const evt = {
        ...eventInit,
        preventDefault: () => { defaultPrevented = true; },
        stopPropagation: () => {},
        stopImmediatePropagation: () => {},
      };
      for (const fn of listeners.get(type) || []) {
        fn(evt);
      }
      return { defaultPrevented };
    };

    return {
      root,
      wrap,
      btn,
      attrs,
      dispatch,
      setHovered: (value) => { hovered = value; },
      wasBlurred: () => blurred,
      wasFocused: () => focused,
      resetFlags: () => {
        blurred = false;
        focused = false;
      },
    };
  }

  it("prevents button focus on mouse pointerdown, does not pin .is-open on mouse click, and toggles .is-open on touch tap", () => {
    const dom = createTooltipDom();
    bindInfoTooltips({
      root: dom.root,
      wrapSelector: ".test-wrap-modality",
      buttonSelector: ".test-btn-modality",
      bubbleSelector: ".test-bubble",
    });

    const down = dom.dispatch("pointerdown", { target: dom.btn, pointerType: "mouse" });
    assert.equal(down.defaultPrevented, true);

    dom.dispatch("click", { target: dom.btn, pointerType: "mouse", detail: 1 });
    assert.equal(dom.wrap.classList.contains("is-open"), false);
    assert.equal(dom.wrap.classList.contains("is-closed"), false);
    assert.equal(dom.attrs.get("aria-expanded"), "false");
    assert.equal(dom.wasBlurred(), true);

    dom.resetFlags();
    const touchDown = dom.dispatch("pointerdown", { target: dom.btn, pointerType: "touch" });
    assert.equal(touchDown.defaultPrevented, false);

    dom.dispatch("click", { target: dom.btn, pointerType: "touch", detail: 1 });
    assert.equal(dom.wrap.classList.contains("is-open"), true);
    assert.equal(dom.attrs.get("aria-expanded"), "true");

    dom.dispatch("click", { target: dom.btn, pointerType: "touch", detail: 1 });
    assert.equal(dom.wrap.classList.contains("is-open"), false);
    assert.equal(dom.wrap.classList.contains("is-closed"), true);
    assert.equal(dom.attrs.get("aria-expanded"), "false");

    dom.setHovered(true);
    dom.wrap.classList.remove("is-closed");
    dom.dispatch("keydown", { key: "Escape" });
    assert.equal(dom.wrap.classList.contains("is-closed"), true);
  });
});

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
