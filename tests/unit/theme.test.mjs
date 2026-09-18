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
});
