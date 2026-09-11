import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  convert,
  getFilterLimits,
  getPreferredCurrency,
  setPreferredCurrency,
  formatMoney,
  FALLBACK_RATES,
} from '../../frontend/javascript/currency.js';
import { applyTokenSubstitutions } from '../../frontend/javascript/i18n.js';

describe('Currency-Aware Filter Sliders Logic', () => {
  let mockLocalStorage;
  let dispatchedEvents;

  beforeEach(() => {
    mockLocalStorage = {};
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

    global.window.localStorage = global.localStorage;
    global.window.dispatchEvent = (event) => {
      dispatchedEvents.push(event);
    };
  });

  test('getFilterLimits returns default limits or converts for currencies', () => {
    const usdLimits = getFilterLimits('USD');
    assert.strictEqual(usdLimits.min, 0);
    assert.strictEqual(usdLimits.max, 100000);
    assert.strictEqual(usdLimits.step, 100);

    const kztLimits = getFilterLimits('KZT');
    assert.strictEqual(kztLimits.min, 0);
    assert.strictEqual(kztLimits.max, 45000000);
    assert.strictEqual(kztLimits.step, 50000);

    const eurLimits = getFilterLimits('EUR');
    assert.strictEqual(eurLimits.min, 0);
    assert.strictEqual(eurLimits.max, 86000);
    assert.strictEqual(eurLimits.step, 100);
  });

  test('getFilterLimits converts default limits for unknown currencies', () => {
    const inrLimits = getFilterLimits('INR');
    assert.strictEqual(inrLimits.min, 0);
    assert.ok(inrLimits.max > 100000, 'INR max should be greater than 100000 USD default');
    assert.ok(inrLimits.step >= 100, 'INR step should be at least 100');
  });

  test('tuition params conversion to USD with tolerance', () => {
    function computeApiTuitionParams(minVal, maxVal, prefCurrency, limits) {
      const result = {};
      if (Number.isFinite(minVal) && minVal > limits.min) {
        const usdMin = convert(minVal, prefCurrency, 'USD');
        result.min_tuition = Math.max(0, Math.floor(usdMin) - 1);
      }
      if (Number.isFinite(maxVal) && maxVal < limits.max) {
        const usdMax = convert(maxVal, prefCurrency, 'USD');
        result.max_tuition = Math.ceil(usdMax) + 1;
      }
      return result;
    }

    const kztLimits = getFilterLimits('KZT');
    
    // Middle values in KZT (e.g. 10,000,000 KZT)
    // 10,000,000 / 450 = 22222.222... USD
    const params = computeApiTuitionParams(450000, 10000000, 'KZT', kztLimits);
    // min: 450000 KZT = 1000 USD -> floor(1000) - 1 = 999 USD
    assert.strictEqual(params.min_tuition, 999);
    // max: 10,000,000 KZT = 22222.22 USD -> ceil(22222.22) + 1 = 22224 USD
    assert.strictEqual(params.max_tuition, 22224);
  });

  test('boundary saturation omits parameters at limits', () => {
    function computeApiTuitionParams(minVal, maxVal, prefCurrency, limits) {
      const result = {};
      if (Number.isFinite(minVal) && minVal > limits.min) {
        const usdMin = convert(minVal, prefCurrency, 'USD');
        result.min_tuition = Math.max(0, Math.floor(usdMin) - 1);
      }
      if (Number.isFinite(maxVal) && maxVal < limits.max) {
        const usdMax = convert(maxVal, prefCurrency, 'USD');
        result.max_tuition = Math.ceil(usdMax) + 1;
      }
      return result;
    }

    const usdLimits = getFilterLimits('USD');
    // At boundaries: 0 and 100000
    const unboundedParams = computeApiTuitionParams(0, 100000, 'USD', usdLimits);
    assert.strictEqual(unboundedParams.min_tuition, undefined);
    assert.strictEqual(unboundedParams.max_tuition, undefined);

    const kztLimits = getFilterLimits('KZT');
    // At boundaries in KZT: 0 and 45000000
    const kztUnbounded = computeApiTuitionParams(0, 45000000, 'KZT', kztLimits);
    assert.strictEqual(kztUnbounded.min_tuition, undefined);
    assert.strictEqual(kztUnbounded.max_tuition, undefined);
  });

  test('slider positions convert cleanly across currencies while preserving bounds saturation', () => {
    const oldLimits = getFilterLimits('USD');
    const newLimits = getFilterLimits('KZT');

    // Case 1: Was at maximum boundary
    const oldMaxAtLimit = oldLimits.max;
    const wasAtMax = oldMaxAtLimit >= oldLimits.max;
    const newMaxFromLimit = wasAtMax ? newLimits.max : Math.round(convert(convert(oldMaxAtLimit, 'USD', 'USD'), 'USD', 'KZT') / newLimits.step) * newLimits.step;
    assert.strictEqual(newMaxFromLimit, 45000000);

    // Case 2: Intermediate value (e.g. 20,000 USD)
    const oldMidVal = 20000;
    const usdMid = convert(oldMidVal, 'USD', 'USD');
    const kztMid = convert(usdMid, 'USD', 'KZT');
    const steppedKzt = Math.round(kztMid / newLimits.step) * newLimits.step;
    // 20000 * 450 = 9,000,000 KZT
    assert.strictEqual(steppedKzt, 9000000);
  });

  test('applyTokenSubstitutions replaces {currency} token with preferred currency', () => {
    setPreferredCurrency('USD');
    const textUsd = applyTokenSubstitutions('{currency} / year');
    assert.strictEqual(textUsd, 'USD / year');

    setPreferredCurrency('KZT');
    const textKzt = applyTokenSubstitutions('{currency} / год');
    assert.strictEqual(textKzt, 'KZT / год');
  });

  test('formatMoney displays currency symbol according to CURRENCY_FORMAT_MAP', () => {
    assert.strictEqual(formatMoney(50000, 'USD'), '$50,000');
    assert.strictEqual(formatMoney(25000000, 'KZT'), '25,000,000 ₸');
    assert.strictEqual(formatMoney(45000, 'EUR'), '€45,000');
    assert.strictEqual(formatMoney(40000, 'GBP'), '£40,000');
  });
});
