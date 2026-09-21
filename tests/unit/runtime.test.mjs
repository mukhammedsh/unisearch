import "./setup.mjs";
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  $,
  animateElementOut,
  aiName,
  closeMotionLayer,
  debounce,
  frontendStaticAsset,
  initGlobalApiLoadingIndicator,
  markMotionEnter,
  prefersReducedMotion,
  replayMotion,
  setUrlParams,
  trapFocus,
} from "../../frontend/javascript/utils/runtime.js";

class TestElement extends global.HTMLElement {
  constructor() {
    super();
    this.classes = new Set();
    this.listeners = new Map();
    this.style = {};
    this.offsetWidth = 10;
    this.offsetHeight = 10;
  }

  classList = {
    add: (...names) => names.forEach((name) => this.classes.add(name)),
    remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    contains: (name) => this.classes.has(name),
  };

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  removeEventListener(type, handler) {
    if (this.listeners.get(type) === handler) this.listeners.delete(type);
  }

  emit(type, event = {}) {
    this.listeners.get(type)?.(event);
  }
}

describe("runtime.js", () => {
  beforeEach(() => {
    window.location = {
      protocol: "http:",
      hostname: "localhost",
      pathname: "/",
    };
  });

  describe("aiName", () => {
    it("resolves default AI names correctly", () => {
      assert.equal(aiName("fit"), "UniFit");
      assert.equal(aiName("chance"), "UniChance");
      assert.equal(aiName("  FIT  "), "UniFit");
      assert.equal(aiName("CHANCE"), "UniChance");
    });

    it("falls back to generic label for unknown keys", () => {
      assert.equal(aiName("unknown"), "AI Function");
      assert.equal(aiName(""), "AI Function");
      assert.equal(aiName(null), "AI Function");
    });
  });

  describe("frontendStaticAsset", () => {
    it("returns clean path when served from root", () => {
      window.location.pathname = "/index.html";
      assert.equal(frontendStaticAsset("images/logo.png"), "/images/logo.png");
      assert.equal(frontendStaticAsset("/images/logo.png"), "/images/logo.png");
      assert.equal(frontendStaticAsset("///images///logo.png"), "/images/logo.png");
    });

    it("prepends /frontend prefix when app is running under /frontend subpath", () => {
      window.location.pathname = "/frontend/index.html";
      assert.equal(frontendStaticAsset("images/logo.png"), "/frontend/images/logo.png");
      assert.equal(frontendStaticAsset("/css/style.css"), "/frontend/css/style.css");
    });
  });

  describe("prefersReducedMotion", () => {
    it("returns false when matchMedia does not match", () => {
      window.matchMedia = () => ({ matches: false });
      assert.equal(prefersReducedMotion(), false);
    });

    it("returns true when matchMedia matches reduced motion", () => {
      window.matchMedia = (query) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
      });
      assert.equal(prefersReducedMotion(), true);
    });
  });

  it("$ delegates element lookup to the document", () => {
    const original = document.getElementById;
    const expected = { id: "target" };
    document.getElementById = (id) => (id === "target" ? expected : null);
    try {
      assert.equal($("target"), expected);
      assert.equal($("missing"), null);
    } finally {
      document.getElementById = original;
    }
  });

  it("replays motion and cleans the class on animation end", () => {
    window.matchMedia = () => ({ matches: false });
    const originalTimeout = window.setTimeout;
    const timeouts = [];
    window.setTimeout = (callback, delay) => {
      timeouts.push({ callback, delay });
      return timeouts.length;
    };
    const node = new TestElement();
    node.classList.add("pulse");
    try {
      replayMotion(node, "pulse", { timeoutMs: 90 });
      assert.equal(node.classList.contains("pulse"), true);
      assert.equal(timeouts[0].delay, 90);
      node.emit("animationend");
      assert.equal(node.classList.contains("pulse"), false);
      timeouts[0].callback();
      assert.equal(node.classList.contains("pulse"), false);
    } finally {
      window.setTimeout = originalTimeout;
    }
  });

  it("skips replay and list motion for missing nodes or reduced motion", () => {
    window.matchMedia = () => ({ matches: true });
    assert.doesNotThrow(() => replayMotion(null, "pulse"));
    const node = new TestElement();
    replayMotion(node, "pulse");
    assert.equal(node.classList.contains("pulse"), false);
    assert.doesNotThrow(() => markMotionEnter(null));
    markMotionEnter({ querySelectorAll: () => [node] }, ".row");
    assert.equal(node.classList.contains("motion-list-item-enter"), false);
  });

  it("marks eligible list items with bounded stagger and restores their styles", () => {
    window.matchMedia = () => ({ matches: false });
    const originalTimeout = window.setTimeout;
    const timeouts = [];
    window.setTimeout = (callback, delay) => {
      timeouts.push({ callback, delay });
      return timeouts.length;
    };
    const nodes = Array.from({ length: 4 }, () => new TestElement());
    const ineligible = { classList: nodes[0].classList, style: {}, offsetWidth: 10 };
    const root = { querySelectorAll: () => [...nodes, ineligible] };
    try {
      markMotionEnter(root, ".row", { className: "enter", staggerMs: 100, limit: 5 });
      assert.deepEqual(nodes.map((node) => node.style.animationDelay), ["0ms", "100ms", "180ms", "180ms"]);
      assert.equal(nodes.every((node) => node.classList.contains("enter")), true);
      assert.equal(timeouts.length, 4);
      nodes[1].emit("animationend");
      assert.equal(nodes[1].classList.contains("enter"), false);
      assert.equal(nodes[1].style.animationDelay, "");
      timeouts[0].callback();
      assert.equal(nodes[0].classList.contains("enter"), false);
    } finally {
      window.setTimeout = originalTimeout;
    }
  });

  it("supports direct-root list motion and zero as an unlimited limit", () => {
    window.matchMedia = () => ({ matches: false });
    const originalTimeout = window.setTimeout;
    window.setTimeout = () => 1;
    const node = new TestElement();
    try {
      markMotionEnter(node, "", { limit: 0, staggerMs: -5 });
      assert.equal(node.classList.contains("motion-list-item-enter"), true);
      assert.equal(node.style.animationDelay, "0ms");
    } finally {
      window.setTimeout = originalTimeout;
    }
  });

  it("animateElementOut completes exactly once and honors reduced motion", () => {
    window.matchMedia = () => ({ matches: false });
    const originalTimeout = window.setTimeout;
    let timeoutCallback;
    window.setTimeout = (callback) => {
      timeoutCallback = callback;
      return 1;
    };
    const node = new TestElement();
    let completions = 0;
    try {
      animateElementOut(node, () => { completions += 1; }, { className: "exit" });
      assert.equal(node.classList.contains("exit"), true);
      node.emit("animationend");
      timeoutCallback();
      assert.equal(completions, 1);
      assert.equal(node.classList.contains("exit"), false);

      window.matchMedia = () => ({ matches: true });
      animateElementOut(node, () => { completions += 1; });
      animateElementOut(null, () => { completions += 1; });
      assert.equal(completions, 3);
    } finally {
      window.setTimeout = originalTimeout;
    }
  });

  it("closeMotionLayer animates open layers and immediately closes other states", () => {
    window.matchMedia = () => ({ matches: false });
    const originalTimeout = window.setTimeout;
    let finishTimeout;
    window.setTimeout = (callback, delay) => {
      finishTimeout = { callback, delay };
      return 1;
    };
    const node = new TestElement();
    node.classList.add("is-open");
    let calls = 0;
    try {
      closeMotionLayer(node, () => { calls += 1; }, { className: "closing", timeoutMs: 75 });
      assert.equal(node.classList.contains("closing"), true);
      assert.equal(finishTimeout.delay, 75);
      finishTimeout.callback();
      finishTimeout.callback();
      assert.equal(calls, 1);
      assert.equal(node.classList.contains("closing"), false);

      closeMotionLayer(new TestElement(), () => { calls += 1; });
      closeMotionLayer(null, () => { calls += 1; });
      assert.equal(calls, 3);
    } finally {
      window.setTimeout = originalTimeout;
    }
  });

  it("debounce keeps only the latest call", async () => {
    const calls = [];
    const debounced = debounce((...args) => calls.push(args), 5);
    debounced("first");
    debounced("second", 2);
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.deepEqual(calls, [["second", 2]]);
  });

  it("setUrlParams preserves the URL while replacing its query", () => {
    window.location = { href: "https://example.test/catalog?old=1#results" };
    let replacement = "";
    window.history = { replaceState: (_state, _title, value) => { replacement = value; } };
    setUrlParams(new URLSearchParams({ q: "data science", page: "2" }));
    assert.equal(replacement, "https://example.test/catalog?q=data+science&page=2#results");
  });

  it("trapFocus cycles visible controls and can be detached", () => {
    const first = new TestElement();
    const hidden = new TestElement();
    hidden.offsetWidth = 0;
    hidden.offsetHeight = 0;
    hidden.getClientRects = () => [];
    const last = new TestElement();
    first.getClientRects = last.getClientRects = () => [{}];
    let focused = "";
    first.focus = () => { focused = "first"; };
    last.focus = () => { focused = "last"; };
    const container = new TestElement();
    container.querySelectorAll = () => [first, hidden, last];
    container.contains = (node) => [first, hidden, last].includes(node);
    const originalActive = document.activeElement;
    const detach = trapFocus(container);
    try {
      document.activeElement = last;
      let prevented = false;
      container.emit("keydown", { key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      assert.equal(focused, "first");

      document.activeElement = first;
      container.emit("keydown", { key: "Tab", shiftKey: true, preventDefault() {} });
      assert.equal(focused, "last");

      container.emit("keydown", { key: "Enter", preventDefault() { throw new Error("unexpected"); } });
      detach();
      assert.equal(container.listeners.has("keydown"), false);
      assert.equal(typeof trapFocus(null), "function");
    } finally {
      document.activeElement = originalActive;
    }
  });

  it("trapFocus prevents Tab when a layer has no visible controls", () => {
    const container = new TestElement();
    container.querySelectorAll = () => [];
    let prevented = false;
    trapFocus(container);
    container.emit("keydown", { key: "Tab", preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  });

  it("tracks only backend requests in the global loading indicator", async () => {
    const originalDocument = global.document;
    const originalFetch = window.fetch;
    const originalTimeout = window.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const timers = new Map();
    let timerId = 0;
    const overlay = new TestElement();
    overlay.setAttribute = (name, value) => { overlay[name] = value; };
    const body = { appendChild: (node) => { body.child = node; } };
    global.document = {
      readyState: "complete",
      body,
      getElementById: () => body.child || null,
      createElement: () => overlay,
    };
    window.setTimeout = (callback, delay) => {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    };
    global.clearTimeout = (id) => timers.delete(id);
    window.fetch = async (input) => ({ ok: true, input });
    try {
      initGlobalApiLoadingIndicator();
      assert.equal(body.child, overlay);
      const backendPromise = window.fetch("http://localhost:8000/universities");
      const show = [...timers.values()].find((entry) => entry.delay === 120);
      assert.ok(show);
      show.callback();
      assert.equal(overlay.classList.contains("is-visible"), true);
      await backendPromise;
      const hide = [...timers.values()].find((entry) => entry.delay <= 220 && entry !== show);
      assert.ok(hide);
      hide.callback();
      assert.equal(overlay.classList.contains("is-visible"), false);

      const timerCount = timers.size;
      await window.fetch("https://cdn.example.test/file.json");
      assert.equal(timers.size, timerCount);
      initGlobalApiLoadingIndicator();
    } finally {
      global.document = originalDocument;
      window.fetch = originalFetch;
      window.setTimeout = originalTimeout;
      global.clearTimeout = originalClearTimeout;
    }
  });
});
