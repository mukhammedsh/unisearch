import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert';

import { escapeHtml, escapeHtmlAttr, showToast, removeToast } from '../../frontend/javascript/utils/format.js';

test('escapeHtml', async (t) => {
  await t.test('escapes standard HTML characters', () => {
    assert.strictEqual(
      escapeHtml('<div class="test">Hello & \'world\'</div>'),
      '&lt;div class=&quot;test&quot;&gt;Hello &amp; &#039;world&#039;&lt;/div&gt;'
    );
  });

  await t.test('handles null and undefined', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
  });

  await t.test('handles non-string types', () => {
    assert.strictEqual(escapeHtml(123), '123');
    assert.strictEqual(escapeHtml(true), 'true');
    assert.strictEqual(escapeHtml(false), 'false');
  });

  await t.test('stabilizes numeric ranges before escaping', () => {
    assert.strictEqual(escapeHtml('10 - 20'), '10\u201120');
    assert.strictEqual(escapeHtml('1.5 - 2.5'), '1.5\u20112.5');
  });

  await t.test('handles empty string', () => {
    assert.strictEqual(escapeHtml(''), '');
  });
});

test('escapeHtmlAttr', async (t) => {
  await t.test('escapes basic HTML characters', () => {
    assert.strictEqual(escapeHtmlAttr('&'), '&amp;');
    assert.strictEqual(escapeHtmlAttr('<'), '&lt;');
    assert.strictEqual(escapeHtmlAttr('>'), '&gt;');
    assert.strictEqual(escapeHtmlAttr('"'), '&quot;');
    assert.strictEqual(escapeHtmlAttr("'"), '&#039;');
  });

  await t.test('escapes multiple characters', () => {
    assert.strictEqual(
      escapeHtmlAttr('<div class="test" id=\'1\'>&</div>'),
      '&lt;div class=&quot;test&quot; id=&#039;1&#039;&gt;&amp;&lt;/div&gt;'
    );
  });

  await t.test('handles null and undefined', () => {
    assert.strictEqual(escapeHtmlAttr(null), '');
    assert.strictEqual(escapeHtmlAttr(undefined), '');
  });

  await t.test('handles empty strings', () => {
    assert.strictEqual(escapeHtmlAttr(''), '');
  });

  await t.test('leaves normal text unchanged', () => {
    assert.strictEqual(escapeHtmlAttr('hello world'), 'hello world');
    assert.strictEqual(escapeHtmlAttr('12345'), '12345');
  });

  await t.test('handles non-string types by converting to string', () => {
    assert.strictEqual(escapeHtmlAttr(123), '123');
    assert.strictEqual(escapeHtmlAttr(true), 'true');
    assert.strictEqual(escapeHtmlAttr(false), 'false');
  });
});

test('showToast and removeToast', async (t) => {
  await t.test('does not throw when toast-container is missing', () => {
    assert.doesNotThrow(() => showToast('Missing container'));
  });

  await t.test('creates toast and removes it on dismiss', () => {
    const toasts = [];
    const container = {
      appendChild: (node) => toasts.push(node),
    };
    const origGetElementById = global.document.getElementById;
    global.document.getElementById = (id) => (id === 'toast-container' ? container : null);

    try {
      showToast('Action successful', 'success');
      assert.strictEqual(toasts.length, 1);
      const toast = toasts[0];
      assert.strictEqual(toast.className, 'toast success');

      toast.parentNode = container;
      toast.remove = () => {
        const idx = toasts.indexOf(toast);
        if (idx !== -1) toasts.splice(idx, 1);
      };

      removeToast(toast);
    } finally {
      global.document.getElementById = origGetElementById;
    }
  });

  await t.test('removeToast removes immediately when prefers-reduced-motion is active', () => {
    let removed = false;
    const toast = {
      dataset: {},
      parentNode: {},
      remove: () => { removed = true; },
      classList: { add: () => {} },
      style: {},
      addEventListener: () => {},
    };

    const origMatchMedia = global.window.matchMedia;
    global.window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    try {
      removeToast(toast);
      assert.strictEqual(removed, true);
      assert.strictEqual(toast.dataset.dismissing, '1');
    } finally {
      global.window.matchMedia = origMatchMedia;
    }
  });

  await t.test('removeToast is idempotent and does not run twice', () => {
    let callCount = 0;
    const toast = {
      dataset: {},
      parentNode: {},
      remove: () => { callCount++; },
      classList: { add: () => {} },
      style: {},
      addEventListener: () => {},
    };

    const origMatchMedia = global.window.matchMedia;
    global.window.matchMedia = (query) => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });

    try {
      removeToast(toast);
      removeToast(toast);
      assert.strictEqual(callCount, 1);
    } finally {
      global.window.matchMedia = origMatchMedia;
    }
  });
});
