import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  getSettingValue,
  readSettingsArray,
  setSettingValue,
  SETTINGS_CACHE_KEY,
  SETTING_DISABLE_RECENT_UNIVERSITIES,
  SETTING_OPEN_UNIVERSITIES_NEW_TAB,
  SETTING_PREFERRED_CURRENCY,
  SETTING_CURRENCY_DISPLAY,
  getPreferredCurrencySetting,
  getCurrencyDisplayModeSetting,
  shouldOpenUniversitiesInNewTab,
  shouldStoreRecentUniversities,
  writeSettingsArray,
} from '../../frontend/javascript/settings.js';

describe('settings.js', () => {
  let mockStorage;
  let dispatchedEvents;

  beforeEach(() => {
    mockStorage = {};
    dispatchedEvents = [];
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockStorage[key];
      },
    };
    global.window.dispatchEvent = (event) => {
      dispatchedEvents.push(event);
    };
    global.CustomEvent = class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail || null;
      }
    };
  });

  test('readSettingsArray returns defaults when storage is empty or invalid', () => {
    let settings = readSettingsArray();
    assert.strictEqual(settings.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, false);
    assert.strictEqual(settings.find((row) => row.key === SETTING_OPEN_UNIVERSITIES_NEW_TAB).value, false);
    assert.strictEqual(settings.find((row) => row.key === SETTING_PREFERRED_CURRENCY).value, 'USD');
    assert.strictEqual(settings.find((row) => row.key === SETTING_CURRENCY_DISPLAY).value, 'preferred');

    mockStorage[SETTINGS_CACHE_KEY] = 'invalid json';
    settings = readSettingsArray();
    assert.strictEqual(settings.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, false);
    assert.strictEqual(settings.find((row) => row.key === SETTING_PREFERRED_CURRENCY).value, 'USD');

    mockStorage[SETTINGS_CACHE_KEY] = JSON.stringify({ key: SETTING_DISABLE_RECENT_UNIVERSITIES, value: true });
    settings = readSettingsArray();
    assert.strictEqual(settings.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, false);
    assert.strictEqual(settings.find((row) => row.key === SETTING_PREFERRED_CURRENCY).value, 'USD');
  });

  test('readSettingsArray merges stored values with definitions', () => {
    mockStorage[SETTINGS_CACHE_KEY] = JSON.stringify([
      { key: SETTING_DISABLE_RECENT_UNIVERSITIES, value: true },
      { key: SETTING_PREFERRED_CURRENCY, value: 'KZT' },
    ]);

    const settings = readSettingsArray();
    assert.strictEqual(settings.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, true);
    assert.strictEqual(settings.find((row) => row.key === SETTING_OPEN_UNIVERSITIES_NEW_TAB).value, false);
    assert.strictEqual(settings.find((row) => row.key === SETTING_PREFERRED_CURRENCY).value, 'KZT');
    assert.strictEqual(settings.find((row) => row.key === SETTING_CURRENCY_DISPLAY).value, 'preferred');
  });

  test('writeSettingsArray normalizes and persists defined settings only', () => {
    const saved = writeSettingsArray([
      { key: SETTING_DISABLE_RECENT_UNIVERSITIES, value: 'true' },
      { key: SETTING_OPEN_UNIVERSITIES_NEW_TAB, value: true },
      { key: SETTING_PREFERRED_CURRENCY, value: 'EUR' },
      { key: SETTING_CURRENCY_DISPLAY, value: 'invalid_mode' },
      { key: 'unknown', value: true },
    ]);

    assert.strictEqual(saved.length, 4);
    assert.strictEqual(saved.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, false);
    assert.strictEqual(saved.find((row) => row.key === SETTING_OPEN_UNIVERSITIES_NEW_TAB).value, true);
    assert.strictEqual(saved.find((row) => row.key === SETTING_PREFERRED_CURRENCY).value, 'EUR');
    assert.strictEqual(saved.find((row) => row.key === SETTING_CURRENCY_DISPLAY).value, 'preferred');

    const stored = JSON.parse(mockStorage[SETTINGS_CACHE_KEY]);
    assert.deepStrictEqual(stored, saved);
  });

  test('getSettingValue and helper predicates read stored settings', () => {
    mockStorage[SETTINGS_CACHE_KEY] = JSON.stringify([
      { key: SETTING_DISABLE_RECENT_UNIVERSITIES, value: true },
      { key: SETTING_OPEN_UNIVERSITIES_NEW_TAB, value: true },
      { key: SETTING_PREFERRED_CURRENCY, value: 'GBP' },
      { key: SETTING_CURRENCY_DISPLAY, value: 'both' },
    ]);

    assert.strictEqual(getSettingValue(SETTING_DISABLE_RECENT_UNIVERSITIES), true);
    assert.strictEqual(getSettingValue(SETTING_OPEN_UNIVERSITIES_NEW_TAB), true);
    assert.strictEqual(getSettingValue(SETTING_PREFERRED_CURRENCY), 'GBP');
    assert.strictEqual(getSettingValue(SETTING_CURRENCY_DISPLAY), 'both');
    assert.strictEqual(getSettingValue('unknown'), undefined);
    assert.strictEqual(shouldStoreRecentUniversities(), false);
    assert.strictEqual(shouldOpenUniversitiesInNewTab(), true);
    assert.strictEqual(getPreferredCurrencySetting(), 'GBP');
    assert.strictEqual(getCurrencyDisplayModeSetting(), 'both');
  });

  test('setSettingValue persists changes and dispatches settingsChanged', () => {
    setSettingValue(SETTING_DISABLE_RECENT_UNIVERSITIES, true);

    const stored = JSON.parse(mockStorage[SETTINGS_CACHE_KEY]);
    assert.strictEqual(stored.find((row) => row.key === SETTING_DISABLE_RECENT_UNIVERSITIES).value, true);
    assert.strictEqual(dispatchedEvents.length, 1);
    assert.strictEqual(dispatchedEvents[0].type, 'settingsChanged');
    assert.strictEqual(dispatchedEvents[0].detail.key, SETTING_DISABLE_RECENT_UNIVERSITIES);
    assert.strictEqual(dispatchedEvents[0].detail.value, true);
    assert.ok(Array.isArray(dispatchedEvents[0].detail.settings));

    setSettingValue(SETTING_PREFERRED_CURRENCY, 'KZT');
    assert.strictEqual(getPreferredCurrencySetting(), 'KZT');
    assert.strictEqual(dispatchedEvents.length, 2);
    assert.strictEqual(dispatchedEvents[1].detail.key, SETTING_PREFERRED_CURRENCY);
    assert.strictEqual(dispatchedEvents[1].detail.value, 'KZT');
  });

  test('setSettingValue ignores dispatch errors after saving', () => {
    global.window.dispatchEvent = () => {
      throw new Error('dispatch failed');
    };

    assert.doesNotThrow(() => setSettingValue(SETTING_DISABLE_RECENT_UNIVERSITIES, true));
    assert.strictEqual(getSettingValue(SETTING_DISABLE_RECENT_UNIVERSITIES), true);
  });
});
