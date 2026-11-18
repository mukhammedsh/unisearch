import "./setup.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

class MockClassList {
  constructor(initial = []) {
    this._set = new Set(initial);
  }
  add(...names) {
    names.forEach((name) => this._set.add(name));
  }
  remove(...names) {
    names.forEach((name) => this._set.delete(name));
  }
  toggle(name, force) {
    if (force !== undefined) {
      if (force) this._set.add(name);
      else this._set.delete(name);
      return force;
    }
    if (this._set.has(name)) {
      this._set.delete(name);
      return false;
    }
    this._set.add(name);
    return true;
  }
  contains(name) {
    return this._set.has(name);
  }
}

class MockTabNode extends global.HTMLElement {
  constructor(tagName = "DIV", { id = "", classes = [], attrs = {} } = {}) {
    super();
    this.tagName = tagName;
    this.id = id;
    this.classList = new MockClassList(classes);
    this.attrs = { ...attrs };
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.offsetLeft = 0;
    this.offsetWidth = 80;
    this.listeners = new Map();
    this.focusCalls = 0;
    this.clickCalls = 0;
  }

  getAttribute(name) {
    return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  emit(type, event = {}) {
    const payload = { target: this, preventDefault() {}, ...event };
    for (const handler of this.listeners.get(type) || []) {
      handler(payload);
    }
  }

  closest(selector) {
    if (selector === ".d-tab-btn" && this.classList.contains("d-tab-btn")) return this;
    return null;
  }

  contains(node) {
    return node === this || this.children.includes(node);
  }

  querySelector(selector) {
    if (selector === ".sliding-indicator") {
      return this.children.find((node) => node.classList.contains("sliding-indicator")) || null;
    }
    if (selector.includes(".active")) {
      return this.children.find((node) => node.classList.contains("active")) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === ".d-tab-btn") {
      return this.children.filter((node) => node.classList.contains("d-tab-btn"));
    }
    return [];
  }

  focus() {
    this.focusCalls += 1;
  }

  click() {
    this.clickCalls += 1;
    this.emit("click", { target: this });
  }
}

test("setupTabs manages WAI-ARIA tab states, panel hidden flags, and keyboard navigation", async () => {
  const originalDocument = global.document;
  const originalElement = global.Element;
  const originalGetComputedStyle = global.getComputedStyle;
  const originalRaf = global.requestAnimationFrame;
  const originalWindowTimeout = window.setTimeout;

  const tabsRoot = new MockTabNode("DIV", { classes: ["d-tabs"] });
  const tabs = [
    new MockTabNode("BUTTON", { id: "tab-btn-general", classes: ["d-tab-btn", "active"], attrs: { "data-tab": "tab-general", role: "tab" } }),
    new MockTabNode("BUTTON", { id: "tab-btn-programs", classes: ["d-tab-btn"], attrs: { "data-tab": "tab-programs", role: "tab" } }),
    new MockTabNode("BUTTON", { id: "tab-btn-finance", classes: ["d-tab-btn"], attrs: { "data-tab": "tab-finance", role: "tab" } }),
  ];
  tabs.forEach((tab, index) => {
    tab.offsetLeft = index * 100;
    tabsRoot.appendChild(tab);
  });

  const panes = [
    new MockTabNode("DIV", { id: "tab-general", classes: ["d-tab-pane", "active"] }),
    new MockTabNode("DIV", { id: "tab-programs", classes: ["d-tab-pane"] }),
    new MockTabNode("DIV", { id: "tab-finance", classes: ["d-tab-pane"] }),
  ];

  global.Element = MockTabNode;
  global.getComputedStyle = () => ({ getPropertyValue: () => "0px" });
  global.requestAnimationFrame = (cb) => {
    cb();
    return 1;
  };
  window.setTimeout = () => 1;
  global.document = {
    ...originalDocument,
    querySelector: (selector) => (selector === ".d-tabs" ? tabsRoot : null),
    querySelectorAll: (selector) => (selector === ".d-tab-pane" ? panes : []),
    getElementById: (id) => panes.find((pane) => pane.id === id) || null,
    createElement: (tag) => {
      const node = new MockTabNode(tag.toUpperCase());
      node.setAttribute("class", "");
      return node;
    },
  };

  try {
    const { setupTabs } = await import("../../frontend/javascript/components.js");
    setupTabs();

    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(tabs[0].getAttribute("tabindex"), "0");
    assert.equal(tabs[1].getAttribute("aria-selected"), "false");
    assert.equal(tabs[1].getAttribute("tabindex"), "-1");
    assert.equal(panes[0].hidden, false);
    assert.equal(panes[1].hidden, true);
    assert.equal(panes[2].hidden, true);

    tabsRoot.emit("keydown", { key: "ArrowRight", target: tabs[0] });
    assert.equal(tabs[1].focusCalls, 1);
    assert.equal(tabs[1].getAttribute("aria-selected"), "true");
    assert.equal(tabs[1].getAttribute("tabindex"), "0");
    assert.equal(tabs[0].getAttribute("aria-selected"), "false");
    assert.equal(tabs[0].getAttribute("tabindex"), "-1");
    assert.equal(panes[1].hidden, false);
    assert.equal(panes[0].hidden, true);

    tabsRoot.emit("keydown", { key: "End", target: tabs[1] });
    assert.equal(tabs[2].focusCalls, 1);
    assert.equal(tabs[2].getAttribute("aria-selected"), "true");
    assert.equal(panes[2].hidden, false);

    tabsRoot.emit("keydown", { key: "ArrowRight", target: tabs[2] });
    assert.equal(tabs[0].focusCalls, 1);
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(panes[0].hidden, false);

    tabsRoot.emit("keydown", { key: "ArrowLeft", target: tabs[0] });
    assert.equal(tabs[2].focusCalls, 2);
    assert.equal(tabs[2].getAttribute("aria-selected"), "true");
    assert.equal(panes[2].hidden, false);

    tabsRoot.emit("keydown", { key: "Home", target: tabs[2] });
    assert.equal(tabs[0].focusCalls, 2);
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(panes[0].hidden, false);
  } finally {
    global.document = originalDocument;
    global.Element = originalElement;
    global.getComputedStyle = originalGetComputedStyle;
    global.requestAnimationFrame = originalRaf;
    window.setTimeout = originalWindowTimeout;
  }
});
