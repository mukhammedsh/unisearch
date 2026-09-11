import './setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initCustomSelect } from '../../frontend/javascript/utils/selects.js';

class ClassList {
  constructor() {
    this._set = new Set();
  }
  add(...classes) {
    classes.forEach((c) => this._set.add(c));
  }
  remove(...classes) {
    classes.forEach((c) => this._set.delete(c));
  }
  contains(cls) {
    return this._set.has(cls);
  }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this._set.add(cls);
      else this._set.delete(cls);
      return force;
    }
    if (this._set.has(cls)) {
      this._set.delete(cls);
      return false;
    }
    this._set.add(cls);
    return true;
  }
  has(cls) {
    return this._set.has(cls);
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.name = '';
    this.attributes = new Map();
    this.classList = new ClassList();
    this.children = [];
    this.parentNode = null;
    this.nextSibling = null;
    this._listeners = new Map();
    this.disabled = false;
    this.dataset = {};
    this._value = '';
    this._text = '';
    this._textContent = '';
    this._innerHTML = '';
    this.selectedIndex = 0;
  }

  get value() {
    if (this.tagName === 'SELECT') {
      const selected = this.options.find((o) => o.selected);
      return selected ? selected.value : (this.options[0]?.value || '');
    }
    return this._value;
  }

  set value(val) {
    this._value = String(val);
    if (this.tagName === 'SELECT') {
      this.options.forEach((opt, idx) => {
        opt.selected = String(opt.value) === String(val);
        if (opt.selected) this.selectedIndex = idx;
      });
    }
  }

  get text() {
    return this._text || this._textContent;
  }

  set text(val) {
    this._text = val;
    this._textContent = val;
  }

  get textContent() {
    if (this.children.length) {
      return this.children.map((c) => c.textContent).join(' ');
    }
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = val;
    this._text = val;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    if (val === '') {
      this.children = [];
    }
  }

  get options() {
    if (this.tagName !== 'SELECT') return [];
    const opts = [];
    const collect = (node) => {
      node.children.forEach((c) => {
        if (c.tagName === 'OPTION') opts.push(c);
        else if (c.tagName === 'OPTGROUP') collect(c);
      });
    };
    collect(this);
    return opts;
  }

  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name === 'id') this.id = String(val);
    if (name === 'class') {
      this.classList = new ClassList();
      String(val).split(' ').filter(Boolean).forEach((c) => this.classList.add(c));
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'label') return this.attributes.get('label') || null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  appendChild(child) {
    child.parentNode = this;
    const last = this.children[this.children.length - 1];
    if (last) last.nextSibling = child;
    child.nextSibling = null;
    this.children.push(child);
    return child;
  }

  insertBefore(newNode, refNode) {
    newNode.parentNode = this;
    const idx = this.children.indexOf(refNode);
    if (idx === -1) {
      return this.appendChild(newNode);
    }
    this.children.splice(idx, 0, newNode);
    newNode.nextSibling = refNode;
    return newNode;
  }

  addEventListener(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    const list = this._listeners.get(event) || [];
    this._listeners.set(event, list.filter((l) => l !== fn));
  }

  dispatchEvent(event) {
    const list = this._listeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const match = (el) => {
      if (selector.startsWith('.') && el.classList?.has(selector.slice(1))) return true;
      if (selector.startsWith('#') && el.id === selector.slice(1)) return true;
      if (selector === '.custom-option:not(.is-disabled)') {
        return el.classList?.has('custom-option') && !el.classList?.has('is-disabled');
      }
      if (selector === '.custom-option.selected') {
        return el.classList?.has('custom-option') && el.classList?.has('selected');
      }
      if (selector === '.custom-option.is-highlighted') {
        return el.classList?.has('custom-option') && el.classList?.has('is-highlighted');
      }
      if (selector === '.custom-option') return el.classList?.has('custom-option');
      if (selector === '.custom-optgroup-label') return el.classList?.has('custom-optgroup-label');
      if (selector === '.custom-select-trigger') return el.classList?.has('custom-select-trigger');
      if (selector === '.custom-options') return el.classList?.has('custom-options');
      return false;
    };

    const traverse = (node) => {
      node.children.forEach((child) => {
        if (match(child)) results.push(child);
        traverse(child);
      });
    };
    traverse(this);
    return results;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector.startsWith('.') && curr.classList?.has(selector.slice(1))) return curr;
      curr = curr.parentNode;
    }
    return null;
  }

  contains(node) {
    let curr = node;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  scrollIntoView() {}
}

function createSelectWithOptgroups() {
  const container = new MockElement('div');
  const select = new MockElement('select');
  select.id = 'currencyTestSelect';
  select.name = 'currency';
  container.appendChild(select);

  // Group 1: Central Asia & CIS
  const group1 = new MockElement('optgroup');
  group1.setAttribute('label', 'Central Asia & CIS');
  const optKzt = new MockElement('option');
  optKzt.value = 'KZT';
  optKzt.text = 'Kazakhstani Tenge (KZT, ₸)';
  const optRub = new MockElement('option');
  optRub.value = 'RUB';
  optRub.text = 'Russian Ruble (RUB, ₽)';
  const optUzs = new MockElement('option');
  optUzs.value = 'UZS';
  optUzs.text = 'Uzbekistani Som (UZS, soʻm)';
  group1.appendChild(optKzt);
  group1.appendChild(optRub);
  group1.appendChild(optUzs);
  select.appendChild(group1);

  // Group 2: Americas
  const group2 = new MockElement('optgroup');
  group2.setAttribute('label', 'Americas');
  const optUsd = new MockElement('option');
  optUsd.value = 'USD';
  optUsd.text = 'US Dollar (USD, $)';
  optUsd.selected = true;
  const optCad = new MockElement('option');
  optCad.value = 'CAD';
  optCad.text = 'Canadian Dollar (CAD, CA$)';
  group2.appendChild(optUsd);
  group2.appendChild(optCad);
  select.appendChild(group2);

  select.value = 'USD';
  return { container, select };
}

describe('custom-select-typeahead and optgroups', () => {
  let docElements;

  beforeEach(() => {
    docElements = new Map();
    global.document.createElement = (tag) => new MockElement(tag);
    global.document.createDocumentFragment = () => new MockElement('fragment');
    global.document.getElementById = (id) => docElements.get(id) || null;
    global.document.querySelectorAll = () => [];
  });

  it('renders optgroup presentation labels that cannot be selected', () => {
    const { container, select } = createSelectWithOptgroups();
    docElements.set(select.id, select);

    initCustomSelect(select.id);

    const wrapper = select.parentNode;
    assert.ok(wrapper.classList.has('custom-select-wrapper'));

    const customOptions = wrapper.querySelector('.custom-options');
    assert.ok(customOptions);

    const optgroupLabels = customOptions.querySelectorAll('.custom-optgroup-label');
    assert.equal(optgroupLabels.length, 2);
    assert.equal(optgroupLabels[0].textContent, 'Central Asia & CIS');
    assert.equal(optgroupLabels[0].getAttribute('role'), 'presentation');
    assert.equal(optgroupLabels[1].textContent, 'Americas');

    const options = customOptions.querySelectorAll('.custom-option');
    assert.equal(options.length, 5);

    // Clicking an optgroup label does not change selection
    optgroupLabels[0].dispatchEvent({ type: 'click', target: optgroupLabels[0] });
    assert.equal(select.value, 'USD');
  });

  it('navigates with single character typeahead when closed and updates select.value', async () => {
    const { container, select } = createSelectWithOptgroups();
    docElements.set(select.id, select);

    initCustomSelect(select.id);

    const wrapper = select.parentNode;
    const trigger = wrapper.querySelector('.custom-select-trigger');
    assert.equal(select.value, 'USD');

    // Press 'k' -> matches 'Kazakhstani Tenge'
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'k',
      preventDefault: () => {},
    });

    assert.equal(select.value, 'KZT');

    // Wait for buffer to clear before pressing 'r'
    await new Promise((resolve) => setTimeout(resolve, 850));

    // Press 'r' -> matches 'Russian Ruble'
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'r',
      preventDefault: () => {},
    });

    assert.equal(select.value, 'RUB');
  });

  it('cycles through matches when pressing the same key repeatedly', () => {
    const { container, select } = createSelectWithOptgroups();
    docElements.set(select.id, select);

    initCustomSelect(select.id);

    const wrapper = select.parentNode;
    const trigger = wrapper.querySelector('.custom-select-trigger');
    assert.equal(select.value, 'USD');

    // First 'u' -> jumps from USD forward: wraps or next starts with 'u' (UZS or USD)
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'u',
      preventDefault: () => {},
    });
    const firstVal = select.value;
    assert.ok(firstVal === 'UZS' || firstVal === 'USD');

    // Second 'u' -> cycles to the other 'u' currency
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'u',
      preventDefault: () => {},
    });
    const secondVal = select.value;
    assert.notEqual(firstVal, secondVal);
    assert.ok(secondVal === 'UZS' || secondVal === 'USD');

    // Third 'u' -> wraps back to firstVal
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'u',
      preventDefault: () => {},
    });
    assert.equal(select.value, firstVal);
  });

  it('matches multi-character buffer within typing interval', () => {
    const { container, select } = createSelectWithOptgroups();
    docElements.set(select.id, select);

    initCustomSelect(select.id);

    const wrapper = select.parentNode;
    const trigger = wrapper.querySelector('.custom-select-trigger');

    // Type 'c', then 'a' -> matches 'Canadian Dollar'
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'c',
      preventDefault: () => {},
    });
    assert.equal(select.value, 'CAD');

    trigger.dispatchEvent({
      type: 'keydown',
      key: 'a',
      preventDefault: () => {},
    });
    assert.equal(select.value, 'CAD');
  });

  it('highlights matching option when open without immediately committing value', () => {
    const { container, select } = createSelectWithOptgroups();
    docElements.set(select.id, select);

    initCustomSelect(select.id);

    const wrapper = select.parentNode;
    const trigger = wrapper.querySelector('.custom-select-trigger');
    const customOptions = wrapper.querySelector('.custom-options');

    // Open dropdown via click
    trigger.dispatchEvent({
      type: 'click',
      stopPropagation: () => {},
    });
    assert.ok(wrapper.classList.has('open'));

    // Press 'k' when open
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'k',
      preventDefault: () => {},
    });

    // Option for KZT is highlighted
    const highlighted = customOptions.querySelector('.custom-option.is-highlighted');
    assert.ok(highlighted);
    assert.equal(highlighted.getAttribute('data-value'), 'KZT');

    // select.value has NOT changed yet (still USD until Enter/click)
    assert.equal(select.value, 'USD');

    // Press Enter to commit selection
    trigger.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      preventDefault: () => {},
    });
    assert.equal(select.value, 'KZT');
    assert.ok(!wrapper.classList.has('open'));
  });
});
