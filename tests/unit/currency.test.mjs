import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  convert,
  formatMoney,
  formatPrice,
  getCurrencyDisplayMode,
  getFilterLimits,
  getPreferredCurrency,
  loadRates,
  setCurrencyDisplayMode,
  setPreferredCurrency,
  CURRENCY_FORMAT_MAP,
  FALLBACK_RATES,
} from '../../frontend/javascript/currency.js';
import { SETTINGS_CACHE_KEY } from '../../frontend/javascript/settings.js';

describe('currency.js', () => {
  let mockLocalStorage;
  let mockSessionStorage;
  let dispatchedEvents;

  beforeEach(() => {
    mockLocalStorage = {};
    mockSessionStorage = {};
    dispatchedEvents = [];

    global.localStorage = {
      getItem: (key) => mockLocalStorage[key] || null,
      setItem: (key, value) => {
        mockLocalStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockLocalStorage[key];
      },
    };

    global.sessionStorage = {
      getItem: (key) => mockSessionStorage[key] || null,
      setItem: (key, value) => {
        mockSessionStorage[key] = String(value);
      },
      removeItem: (key) => {
        delete mockSessionStorage[key];
      },
    };

    global.window.localStorage = global.localStorage;
    global.window.sessionStorage = global.sessionStorage;

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

  test('getPreferredCurrency returns USD default and setPreferredCurrency updates and dispatches event', () => {
    assert.strictEqual(getPreferredCurrency(), 'USD');

    const result = setPreferredCurrency('KZT');
    assert.strictEqual(result, 'KZT');
    assert.strictEqual(getPreferredCurrency(), 'KZT');

    const currencyEvents = dispatchedEvents.filter((e) => e.type === 'currencyChanged');
    assert.ok(currencyEvents.length >= 1);
    assert.strictEqual(currencyEvents[currencyEvents.length - 1].detail.preferredCurrency, 'KZT');
  });

  test('getCurrencyDisplayMode returns preferred default and setCurrencyDisplayMode updates', () => {
    assert.strictEqual(getCurrencyDisplayMode(), 'preferred');

    const result = setCurrencyDisplayMode('both');
    assert.strictEqual(result, 'both');
    assert.strictEqual(getCurrencyDisplayMode(), 'both');

    const currencyEvents = dispatchedEvents.filter((e) => e.type === 'currencyChanged');
    assert.ok(currencyEvents.length >= 1);
    assert.strictEqual(currencyEvents[currencyEvents.length - 1].detail.displayMode, 'both');

    // Invalid mode defaults to preferred
    assert.strictEqual(setCurrencyDisplayMode('invalid_mode'), 'preferred');
  });

  test('convert performs correct conversions between currencies', () => {
    // Same currency
    assert.strictEqual(convert(1000, 'USD', 'USD'), 1000);
    assert.strictEqual(convert(5000, 'KZT', 'KZT'), 5000);

    // Non-finite
    assert.strictEqual(convert(NaN, 'USD', 'KZT'), 0);
    assert.strictEqual(convert(null, 'USD', 'KZT'), 0);

    // USD to KZT: 1 USD = 450 KZT (fallback rate)
    const usdToKzt = convert(100, 'USD', 'KZT');
    assert.strictEqual(usdToKzt, 45000);

    // KZT to USD: 45000 KZT = 100 USD
    const kztToUsd = convert(45000, 'KZT', 'USD');
    assert.strictEqual(kztToUsd, 100);

    // Cross-rate: CHF to KZT
    // 1 USD = 0.81 CHF, 1 USD = 450 KZT => 81 CHF = 45000 KZT
    const chfToKzt = convert(81, 'CHF', 'KZT');
    assert.strictEqual(Math.round(chfToKzt), 45000);
  });

  test('getFilterLimits returns specific or converted limits', () => {
    // Known currencies
    const usdLimits = getFilterLimits('USD');
    assert.strictEqual(usdLimits.min, 0);
    assert.strictEqual(usdLimits.max, 50000);
    assert.strictEqual(usdLimits.step, 100);

    const kztLimits = getFilterLimits('KZT');
    assert.strictEqual(kztLimits.min, 0);
    assert.strictEqual(kztLimits.max, 25000000);
    assert.strictEqual(kztLimits.step, 50000);

    const uzsLimits = getFilterLimits('UZS');
    assert.strictEqual(uzsLimits.min, 0);
    assert.strictEqual(uzsLimits.max, 600000000);
    assert.strictEqual(uzsLimits.step, 1000000);

    // Unlisted currency (converted from default USD limits 50000 / step 100)
    const unlistedLimits = getFilterLimits('XYZ');
    assert.strictEqual(unlistedLimits.min, 0);
    assert.strictEqual(unlistedLimits.max, 50000);
    assert.strictEqual(unlistedLimits.step, 100);
  });

  test('formatMoney formats amounts with correct symbol placement and grouping', () => {
    assert.strictEqual(formatMoney(50000, 'USD'), '$50,000');
    assert.strictEqual(formatMoney(22486500, 'KZT'), '22,486,500 ₸');
    assert.strictEqual(formatMoney(24600, 'CHF'), 'Fr. 24,600');
    assert.strictEqual(formatMoney(45000, 'EUR'), '€45,000');
    assert.strictEqual(formatMoney(40000, 'GBP'), '£40,000');
    assert.strictEqual(formatMoney(8000000, 'JPY'), '¥8,000,000');
    assert.strictEqual(formatMoney(70000000, 'KRW'), '₩70,000,000');
    assert.strictEqual(formatMoney(4500000, 'RUB'), '4,500,000 ₽');
    assert.strictEqual(formatMoney(70000, 'AUD'), 'A$70,000');
    assert.strictEqual(formatMoney(70000, 'CAD'), 'CA$70,000');
    assert.strictEqual(formatMoney(65000, 'SGD'), 'S$65,000');
    assert.strictEqual(formatMoney(400000, 'HKD'), 'HK$400,000');
    assert.strictEqual(formatMoney(1200000, 'UZS'), '1,200,000 soʻm');
    assert.strictEqual(formatMoney(5000, 'TRY'), '₺5,000');
    assert.strictEqual(formatMoney(1500, 'PLN'), '1,500 zł');
    assert.strictEqual(formatMoney(2500, 'AZN'), '2,500 ₼');
    assert.strictEqual(formatMoney(10000, 'AED'), '10,000 د.إ');

    // Non-finite
    assert.strictEqual(formatMoney(NaN, 'USD'), '—');
    assert.strictEqual(formatMoney(null, 'USD'), '—');
  });

  test('formatPrice respects preferred currency and display mode', () => {
    // Reset to default USD, preferred mode
    setPreferredCurrency('USD');
    setCurrencyDisplayMode('preferred');

    // Same currency: no ≈
    assert.strictEqual(formatPrice(50000, 'USD'), '$50,000');

    // Switch to KZT
    setPreferredCurrency('KZT');

    // Display mode: preferred
    setCurrencyDisplayMode('preferred');
    const prefResult = formatPrice(50000, 'USD');
    // 50000 USD * 450 = 22,500,000 ₸
    assert.strictEqual(prefResult, '≈ 22,500,000 ₸');

    // Display mode: original
    setCurrencyDisplayMode('original');
    const origResult = formatPrice(50000, 'USD');
    assert.strictEqual(origResult, '$50,000');

    // Display mode: both
    setCurrencyDisplayMode('both');
    const bothResult = formatPrice(50000, 'USD');
    assert.strictEqual(bothResult, '≈ 22,500,000 ₸ ($50,000)');

    // Non-finite
    assert.strictEqual(formatPrice(NaN, 'USD'), '—');
  });

  test('loadRates handles API fetch, caching, and fallback', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        rates: { USD: 1.0, EUR: 0.95, KZT: 460.0 },
        date: '2026-09-11',
        source: 'api',
        filter_limits: {
          default: { min: 0, max: 50000, step: 100 },
          USD: { min: 0, max: 50000, step: 100 },
          KZT: { min: 0, max: 23000000, step: 50000 },
        },
      }),
    });

    const ratesData = await loadRates();
    assert.strictEqual(ratesData.source, 'api');
    assert.strictEqual(ratesData.rates.KZT, 460.0);
    assert.strictEqual(ratesData.filter_limits.KZT.max, 23000000);

    // Verify sessionStorage was populated
    const cached = JSON.parse(mockSessionStorage['unisearch_currency_rates_cache_v1']);
    assert.strictEqual(cached.rates.KZT, 460.0);
  });
});
