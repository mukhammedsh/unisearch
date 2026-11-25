import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  applyTheme,
  getCurrentTheme,
  getThemePreference,
  initTheme,
  normalizeThemePreference,
  toggleTheme,
} from '../../frontend/javascript/utils/theme.js';

describe('theme.js', () => {
  let docAttributes;
  let docClasses;
  let styleColorScheme;
  let dispatchedEvents;
  let mockLocalStorage;

  beforeEach(() => {
    docAttributes = { 'data-theme': 'light' };
    docClasses = new Set();
    styleColorScheme = 'light';
    dispatchedEvents = [];
    mockLocalStorage = {};

    global.document.documentElement = {
      getAttribute: (name) => docAttributes[name] ?? null,
      setAttribute: (name, val) => {
        docAttributes[name] = String(val);
      },
      removeAttribute: (name) => {
        delete docAttributes[name];
      },
      style: {
        get colorScheme() {
          return styleColorScheme;
        },
        set colorScheme(val) {
          styleColorScheme = val;
        },
      },
      classList: {
        add: (cls) => docClasses.add(cls),
        remove: (cls) => docClasses.delete(cls),
        contains: (cls) => docClasses.has(cls),
      },
    };

    global.CustomEvent = class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail || null;
      }
    };

    global.window.dispatchEvent = (event) => {
      dispatchedEvents.push(event);
    };

    global.localStorage = {
      getItem: (key) => mockLocalStorage[key] ?? null,
      setItem: (key, value) => {
        mockLocalStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockLocalStorage[key];
      },
    };

    global.window.localStorage = global.localStorage;
  });

  test('getCurrentTheme returns theme from data-theme attribute', () => {
    docAttributes['data-theme'] = 'dark';
    assert.strictEqual(getCurrentTheme(), 'dark');

    docAttributes['data-theme'] = 'light';
    assert.strictEqual(getCurrentTheme(), 'light');
  });

  test('applyTheme switches data-theme and colorScheme immediately without theme-animating class', () => {
    const result = applyTheme('dark');
    assert.strictEqual(result, 'dark');
    assert.strictEqual(docAttributes['data-theme'], 'dark');
    assert.strictEqual(styleColorScheme, 'dark');
    assert.strictEqual(docClasses.has('theme-animating'), false);

    assert.strictEqual(dispatchedEvents.length, 1);
    assert.strictEqual(dispatchedEvents[0].type, 'themeChanged');
    assert.strictEqual(dispatchedEvents[0].detail.theme, 'dark');
  });

  test('applyTheme persists to localStorage only when persist option is true', () => {
    applyTheme('dark', { persist: false });
    assert.strictEqual(mockLocalStorage['unisearch_theme'], undefined);

    applyTheme('dark', { persist: true });
    assert.strictEqual(mockLocalStorage['unisearch_theme'], 'dark');
  });

  test('toggleTheme toggles theme immediately and persists', () => {
    docAttributes['data-theme'] = 'light';
    const next1 = toggleTheme();
    assert.strictEqual(next1, 'dark');
    assert.strictEqual(docAttributes['data-theme'], 'dark');
    assert.strictEqual(mockLocalStorage['unisearch_theme'], 'dark');
    assert.strictEqual(docClasses.has('theme-animating'), false);

    const next2 = toggleTheme();
    assert.strictEqual(next2, 'light');
    assert.strictEqual(docAttributes['data-theme'], 'light');
    assert.strictEqual(mockLocalStorage['unisearch_theme'], 'light');
    assert.strictEqual(docClasses.has('theme-animating'), false);
  });

  test('normalizeThemePreference maps known values and falls back to system', () => {
    assert.strictEqual(normalizeThemePreference('dark'), 'dark');
    assert.strictEqual(normalizeThemePreference('light'), 'light');
    assert.strictEqual(normalizeThemePreference('system'), 'system');
    assert.strictEqual(normalizeThemePreference(''), 'system');
    assert.strictEqual(normalizeThemePreference(null), 'system');
    assert.strictEqual(normalizeThemePreference('unknown-value'), 'system');
    assert.strictEqual(normalizeThemePreference('DARK'), 'dark');
  });

  test('getThemePreference defaults to system and preserves stored choices', () => {
    assert.strictEqual(getThemePreference(), 'system');

    mockLocalStorage['unisearch_theme'] = 'dark';
    assert.strictEqual(getThemePreference(), 'dark');

    mockLocalStorage['unisearch_theme'] = 'light';
    assert.strictEqual(getThemePreference(), 'light');

    mockLocalStorage['unisearch_theme'] = 'system';
    assert.strictEqual(getThemePreference(), 'system');

    mockLocalStorage['unisearch_theme'] = 'legacy-unknown';
    assert.strictEqual(getThemePreference(), 'system');
  });

  test('applyTheme with system preference resolves OS theme and persists preference', () => {
    const resolved = applyTheme('system', { persist: true });
    assert.strictEqual(resolved, 'light');
    assert.strictEqual(docAttributes['data-theme'], 'light');
    assert.strictEqual(mockLocalStorage['unisearch_theme'], 'system');
  });

  test('initTheme preserves an existing stored dark choice', () => {
    mockLocalStorage['unisearch_theme'] = 'dark';
    const resolved = initTheme();
    assert.strictEqual(resolved, 'dark');
    assert.strictEqual(docAttributes['data-theme'], 'dark');
    assert.strictEqual(mockLocalStorage['unisearch_theme'], 'dark');
  });

  test('interactive applyTheme toggles data-theme-switching without injecting style elements', () => {
    const frames = [];
    const origRaf = global.window.requestAnimationFrame;
    const origCreateElement = global.document.createElement;
    global.window.requestAnimationFrame = (cb) => {
      frames.push(cb);
      return frames.length;
    };
    global.document.createElement = () => {
      throw new Error('Unexpected element creation during theme switch');
    };

    try {
      applyTheme('dark', { persist: true });
      assert.strictEqual(docAttributes['data-theme-switching'], '1');
      assert.strictEqual(frames.length, 1);
      frames.shift()();
      assert.strictEqual(frames.length, 1);
      frames.shift()();
      assert.strictEqual(docAttributes['data-theme-switching'], undefined);

      // Initial hydration with animate: false does not toggle transition suppression.
      initTheme();
      assert.strictEqual(docAttributes['data-theme-switching'], undefined);
      assert.strictEqual(frames.length, 0);
    } finally {
      global.window.requestAnimationFrame = origRaf;
      global.document.createElement = origCreateElement;
    }
  });

  test('theme switching cancels a pending frame and clears itself without requestAnimationFrame', () => {
    const origRaf = global.window.requestAnimationFrame;
    const origCancel = global.window.cancelAnimationFrame;
    const cancelled = [];
    let nextFrame = 0;
    global.window.requestAnimationFrame = () => ++nextFrame;
    global.window.cancelAnimationFrame = (id) => cancelled.push(id);

    try {
      applyTheme('dark', { persist: true });
      applyTheme('light', { persist: true });
      assert.deepStrictEqual(cancelled, [1]);
      assert.strictEqual(docAttributes['data-theme-switching'], '1');

      global.window.requestAnimationFrame = undefined;
      applyTheme('dark', { persist: true });
      assert.strictEqual(docAttributes['data-theme-switching'], undefined);

      const bare = global.document.documentElement.removeAttribute;
      global.document.documentElement.removeAttribute = undefined;
      applyTheme('light', { persist: true });
      assert.strictEqual(docAttributes['data-theme-switching'], undefined);
      global.document.documentElement.removeAttribute = bare;
    } finally {
      global.window.requestAnimationFrame = origRaf;
      global.window.cancelAnimationFrame = origCancel;
    }
  });

  test('a pending theme animation cannot override a newer choice', async () => {
    let update;
    let finish;
    let skipped = false;
    global.document.startViewTransition = (callback) => {
      update = callback;
      return {
        finished: new Promise((resolve) => { finish = resolve; }),
        skipTransition() { skipped = true; },
      };
    };

    try {
      applyTheme('dark', { persist: true });
      assert.strictEqual(docAttributes['data-theme-switching'], 'fade');
      assert.strictEqual(mockLocalStorage['unisearch_theme'], 'dark');
      applyTheme('light', { persist: true });
      update();
      finish();
      await Promise.resolve();

      assert.strictEqual(skipped, true);
      assert.strictEqual(getCurrentTheme(), 'light');
      assert.strictEqual(mockLocalStorage['unisearch_theme'], 'light');
      assert.strictEqual(docAttributes['data-theme-switching'], undefined);
      assert.deepStrictEqual(dispatchedEvents.map((event) => event.detail.theme), ['light']);
    } finally {
      delete global.document.startViewTransition;
    }
  });
});
