import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert';

import {
  escapeHtml,
  escapeHtmlAttr,
  showToast,
  removeToast,
  nested,
  initials,
  moneyUSD,
  formatCurrency,
  formatPlural,
  bindImageFallbacks,
} from '../../frontend/javascript/utils/format.js';

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

  await t.test('removeToast removes on animationend', () => {
    let removed = false;
    let listener = null;
    const toast = {
      dataset: {},
      parentNode: {},
      remove: () => { removed = true; },
      classList: { add: () => {} },
      style: {},
      addEventListener: (evt, cb) => {
        if (evt === 'animationend') listener = cb;
      },
    };

    removeToast(toast);
    assert.strictEqual(removed, false);
    assert.strictEqual(toast.dataset.dismissing, '1');

    if (listener) listener();
    assert.strictEqual(removed, true);
  });

  await t.test('removeToast is idempotent and does not run twice', () => {
    let callCount = 0;
    let listener = null;
    const toast = {
      dataset: {},
      parentNode: {},
      remove: () => { callCount++; },
      classList: { add: () => {} },
      style: {},
      addEventListener: (evt, cb) => {
        if (evt === 'animationend') listener = cb;
      },
    };

    removeToast(toast);
    removeToast(toast);
    assert.strictEqual(toast.dataset.dismissing, '1');
    if (listener) listener();
    assert.strictEqual(callCount, 1);
  });

  await t.test('showToast deduplicates identical active toasts', () => {
    const toasts = [];
    const container = {
      appendChild: (node) => {
        node.parentNode = container;
        toasts.push(node);
      },
      querySelectorAll: (sel) => {
        if (sel.includes(':not(.is-leaving)')) {
          return toasts.filter((item) => {
            if (item.classList && typeof item.classList.contains === 'function') {
              return !item.classList.contains('is-leaving');
            }
            return !String(item.className || '').includes('is-leaving');
          });
        }
        return toasts;
      },
    };
    const origGetElementById = global.document.getElementById;
    global.document.getElementById = (id) => (id === 'toast-container' ? container : null);

    try {
      showToast('Step error 0.5', 'error');
      assert.strictEqual(toasts.length, 1);

      showToast('Step error 0.5', 'error');
      assert.strictEqual(toasts.length, 1, 'Duplicate toast should not be added');
    } finally {
      global.document.getElementById = origGetElementById;
    }
  });

  await t.test('showToast dismisses previous error toast when new error arrives', () => {
    const toasts = [];
    const container = {
      appendChild: (node) => {
        node.parentNode = container;
        toasts.push(node);
      },
      querySelectorAll: (sel) => {
        if (sel.includes(':not(.is-leaving)')) {
          return toasts.filter((item) => {
            if (item.classList && typeof item.classList.contains === 'function') {
              return !item.classList.contains('is-leaving');
            }
            return !String(item.className || '').includes('is-leaving');
          });
        }
        return toasts;
      },
    };
    const origGetElementById = global.document.getElementById;
    global.document.getElementById = (id) => (id === 'toast-container' ? container : null);

    try {
      showToast('First error', 'error');
      assert.strictEqual(toasts.length, 1);
      const firstToast = toasts[0];
      const isLeaving = (el) => {
        if (el.classList && typeof el.classList.contains === 'function') {
          return el.classList.contains('is-leaving');
        }
        return String(el.className || '').includes('is-leaving');
      };
      assert.strictEqual(isLeaving(firstToast), false);

      showToast('Second error', 'error');
      assert.strictEqual(toasts.length, 2);
      assert.strictEqual(isLeaving(firstToast), true, 'Previous error toast should be dismissed');
      const secondToast = toasts[1];
      assert.strictEqual(isLeaving(secondToast), false);
    } finally {
      global.document.getElementById = origGetElementById;
    }
  });
});

test('nested', async (t) => {
  const data = {
    user: {
      profile: {
        name: 'Alice',
        scores: [100, 95],
      },
    },
  };

  await t.test('retrieves nested properties safely', () => {
    assert.strictEqual(nested(data, ['user', 'profile', 'name']), 'Alice');
    assert.deepStrictEqual(nested(data, ['user', 'profile', 'scores']), [100, 95]);
  });

  await t.test('returns fallback for missing keys or non-objects', () => {
    assert.strictEqual(nested(data, ['user', 'missing', 'key'], 'default'), 'default');
    assert.strictEqual(nested(data, ['user', 'profile', 'name', 'too_deep'], null), null);
    assert.strictEqual(nested(null, ['user'], 'fallback'), 'fallback');
    assert.strictEqual(nested(undefined, ['user'], 42), 42);
  });
});

test('initials', async (t) => {
  await t.test('generates 2-letter uppercase initials', () => {
    assert.strictEqual(initials('Nazarbayev University'), 'NU');
    assert.strictEqual(initials('Massachusetts Institute of Technology'), 'MI');
    assert.strictEqual(initials('Harvard'), 'H');
  });

  await t.test('handles empty or whitespace strings', () => {
    assert.strictEqual(initials(''), 'U');
    assert.strictEqual(initials('   '), 'U');
    assert.strictEqual(initials(null), 'U');
  });
});

test('moneyUSD and formatCurrency', async (t) => {
  await t.test('moneyUSD formats numbers with dollar sign', () => {
    assert.strictEqual(moneyUSD(50000), '$50,000');
    assert.strictEqual(moneyUSD('12000'), '$12,000');
    assert.strictEqual(moneyUSD(0), '$0');
    assert.strictEqual(moneyUSD('not-a-number'), '—');
    assert.strictEqual(moneyUSD(undefined), '—');
  });

  await t.test('formatCurrency formats with specified currency code', () => {
    const formatted = formatCurrency(25000, 'USD', { locale: 'en-US' });
    assert.ok(formatted.includes('25,000'));
    assert.strictEqual(formatCurrency(NaN), '—');
  });

  await t.test('formatCurrency falls back to simple formatting when currency is invalid', () => {
    const formatted = formatCurrency(25000, 'INVALID_CURRENCY');
    assert.ok(formatted.includes('INVALID_CURRENCY'));
    assert.ok(formatted.includes('25,000'));
  });
});

test('formatPlural', async (t) => {
  await t.test('formats English plurals', () => {
    const forms = ['university', 'universities'];
    assert.strictEqual(formatPlural(1, forms, 'eng'), 'university');
    assert.strictEqual(formatPlural(2, forms, 'eng'), 'universities');
    assert.strictEqual(formatPlural(0, forms, 'eng'), 'universities');
  });

  await t.test('formats Russian plurals according to grammatical rules', () => {
    const forms = ['университет', 'университета', 'университетов'];
    assert.strictEqual(formatPlural(1, forms, 'rus'), 'университет');
    assert.strictEqual(formatPlural(21, forms, 'rus'), 'университет');
    assert.strictEqual(formatPlural(2, forms, 'rus'), 'университета');
    assert.strictEqual(formatPlural(4, forms, 'rus'), 'университета');
    assert.strictEqual(formatPlural(5, forms, 'rus'), 'университетов');
    assert.strictEqual(formatPlural(11, forms, 'rus'), 'университетов');
    assert.strictEqual(formatPlural(19, forms, 'rus'), 'университетов');
  });
});

test('bindImageFallbacks', async (t) => {
  await t.test('handles image load error and triggers fallback cascade', () => {
    let errorHandler = null;
    const targetRoot = {
      addEventListener: (type, handler) => {
        if (type === 'error') errorHandler = handler;
      },
    };

    bindImageFallbacks(targetRoot);
    assert.ok(errorHandler, 'error handler registered');

    // Test stage 0 -> 1 fallbackSrc
    const img1 = new HTMLImageElement();
    img1.dataset = { fallbackSrc: 'https://example.com/fallback.png', fallbackStage: '0' };
    img1.removeAttribute = () => {};
    errorHandler({ target: img1 });
    assert.strictEqual(img1.dataset.fallbackStage, '1');
    assert.strictEqual(img1.src, 'https://example.com/fallback.png');

    // Test stage 1 -> 2 finalSrc
    img1.dataset.finalSrc = 'https://example.com/final.png';
    errorHandler({ target: img1 });
    assert.strictEqual(img1.dataset.fallbackStage, '2');
    assert.strictEqual(img1.src, 'https://example.com/final.png');

    // Test fallbackText
    const parentNode = { textContent: '' };
    const img2 = new HTMLImageElement();
    img2.dataset = { fallbackText: 'MIT', fallbackStage: '2' };
    img2.style = {};
    img2.parentNode = parentNode;
    errorHandler({ target: img2 });
    assert.strictEqual(parentNode.textContent, 'MIT');
    assert.strictEqual(img2.style.display, 'none');

    // Test removeOnError
    let removed = false;
    const img3 = new HTMLImageElement();
    img3.dataset = { removeOnError: '1', fallbackStage: '2' };
    img3.remove = () => { removed = true; };
    errorHandler({ target: img3 });
    assert.strictEqual(removed, true);
  });
});


