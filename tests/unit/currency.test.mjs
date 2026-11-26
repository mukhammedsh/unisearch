import './setup.mjs';
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert';
import {
  FALLBACK_RATES,
  FALLBACK_RATES_DATE,
  convert,
  formatMoney,
  formatPrice,
  formatPriceRange,
  formatRatesTimestamp,
  getCurrencyDisplayMode,
  getFilterLimits,
  getPreferredCurrency,
  getRatesMetadata,
  loadRates,
  setCurrencyDisplayMode,
  setPreferredCurrency,
  startRatesLoading,
  niceStep,
  niceMax,
} from '../../frontend/javascript/currency.js';
import { checkFallbackParity } from '../../scripts/sync-currency-fallback.mjs';

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

  test('FALLBACK_RATES and FALLBACK_RATES_DATE match backend/app/services/currency.py', () => {
    const parity = checkFallbackParity();
    assert.strictEqual(parity.ok, true, parity.errors.join('\n'));
    assert.match(FALLBACK_RATES_DATE, /^\d{4}-\d{2}-\d{2}$/);
    assert.strictEqual(parity.date, FALLBACK_RATES_DATE);
  });

  test('convert performs correct conversions between currencies', () => {
    // Same currency
    assert.strictEqual(convert(1000, 'USD', 'USD'), 1000);
    assert.strictEqual(convert(5000, 'KZT', 'KZT'), 5000);

    // Non-finite
    assert.strictEqual(convert(NaN, 'USD', 'KZT'), 0);
    assert.strictEqual(convert(null, 'USD', 'KZT'), 0);

    const kztRate = FALLBACK_RATES.KZT;
    const chfRate = FALLBACK_RATES.CHF;

    // USD to KZT
    const usdToKzt = convert(100, 'USD', 'KZT');
    assert.ok(Math.abs(usdToKzt - 100 * kztRate) < 1e-6);

    // KZT to USD
    const kztToUsd = convert(100 * kztRate, 'KZT', 'USD');
    assert.ok(Math.abs(kztToUsd - 100) < 1e-6);

    // Cross-rate: CHF to KZT
    const chfToKzt = convert(100 * chfRate, 'CHF', 'KZT');
    assert.ok(Math.abs(chfToKzt - 100 * kztRate) < 1e-6);
  });

  test('getFilterLimits returns specific or converted limits', () => {
    // Known currencies
    const usdLimits = getFilterLimits('USD');
    assert.strictEqual(usdLimits.min, 0);
    assert.strictEqual(usdLimits.max, 100000);
    assert.strictEqual(usdLimits.step, 100);

    // KZT: 45000 raw step rounds up to nice 50,000
    const kztLimits = getFilterLimits('KZT');
    assert.strictEqual(kztLimits.min, 0);
    assert.strictEqual(kztLimits.max, 45000000);
    assert.strictEqual(kztLimits.step, 50000);

    // UZS: 1179297 raw step rounds to nice 1,000,000; max rounds to 1,200,000,000
    const uzsLimits = getFilterLimits('UZS');
    assert.strictEqual(uzsLimits.min, 0);
    assert.strictEqual(uzsLimits.max, 1200000000);
    assert.strictEqual(uzsLimits.step, 1000000);

    // Unlisted currency (converted from default USD limits 100000 / step 100)
    const unlistedLimits = getFilterLimits('XYZ');
    assert.strictEqual(unlistedLimits.min, 0);
    assert.strictEqual(unlistedLimits.max, 100000);
    assert.strictEqual(unlistedLimits.step, 100);
  });

  test('niceStep and niceMax implement adaptive 1-2-5 scale rounding', () => {
    assert.strictEqual(niceStep(0.5), 1);
    assert.strictEqual(niceStep(1), 1);
    assert.strictEqual(niceStep(1.4), 1);
    assert.strictEqual(niceStep(1.5), 2);
    assert.strictEqual(niceStep(3.1), 2);
    assert.strictEqual(niceStep(3.5), 5);
    assert.strictEqual(niceStep(7.0), 5);
    assert.strictEqual(niceStep(7.5), 10);
    assert.strictEqual(niceStep(31), 20);
    assert.strictEqual(niceStep(86), 100);
    assert.strictEqual(niceStep(45000), 50000);
    assert.strictEqual(niceStep(1179297), 1000000);

    assert.strictEqual(niceMax(100000, 100), 100000);
    assert.strictEqual(niceMax(86000, 100), 86000);
    assert.strictEqual(niceMax(45000000, 50000), 45000000);
    assert.strictEqual(niceMax(31000, 20), 31000);
    assert.strictEqual(niceMax(1179297000, 1000000), 1200000000);
    assert.strictEqual(1200000000 % 1000000, 0);

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
    assert.strictEqual(formatMoney(123.45, 'BHD'), '123.45 BD');

    // Non-finite
    assert.strictEqual(formatMoney(NaN, 'USD'), '—');
    assert.strictEqual(formatMoney(null, 'USD'), '—');
  });

  test('formatPrice respects preferred currency and display mode', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        rates: { USD: 1.0, KZT: 450.0 },
        date: '2026-11-18',
        source: 'api',
      }),
    });
    await loadRates();

    // Reset to default USD, preferred mode
    setPreferredCurrency('USD');
    setCurrencyDisplayMode('preferred');

    // Same currency: no ≈ and no summary rounding
    assert.strictEqual(formatPrice(50000, 'USD'), '$50,000');
    assert.strictEqual(formatPrice(8760, 'USD'), '$8,760');

    // Exact is the default for decision-making surfaces.
    // 3,942,000 KZT / 450 = 8,760 USD.
    assert.strictEqual(formatPrice(3942000, 'KZT'), '≈ $8,760');

    // Catalog summaries retain a clearly approximate, two-significant-figure value.
    assert.strictEqual(formatPrice(3942000, 'KZT', { presentation: 'summary' }), '≈ $8,800');
    assert.strictEqual(formatPrice(67950, 'KZT', { presentation: 'summary' }), '≈ $150');

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

    setPreferredCurrency('USD');
    setCurrencyDisplayMode('both');
    assert.strictEqual(
      formatPrice(3942000, 'KZT', { presentation: 'summary' }),
      '≈ $8,800 (3,942,000 ₸)',
    );
    assert.strictEqual(formatPrice(3942000, 'KZT'), '≈ $8,760 (3,942,000 ₸)');

    setCurrencyDisplayMode('original');
    assert.strictEqual(
      formatPrice(3942000, 'KZT', { presentation: 'summary' }),
      '3,942,000 ₸',
    );

    // Non-finite
    assert.strictEqual(formatPrice(NaN, 'USD'), '—');
  });

  test('formatPriceRange writes one approximation sign and keeps the published range in "both" mode', async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        rates: { USD: 1.0, KZT: 450.0 },
        date: '2026-11-18',
        source: 'api',
      }),
    });
    await loadRates();

    setPreferredCurrency('USD');
    setCurrencyDisplayMode('preferred');
    assert.strictEqual(formatPriceRange(10000, 20000, 'USD'), '$10,000 – $20,000');
    assert.strictEqual(formatPriceRange(15000, 15000, 'USD'), '$15,000');
    assert.strictEqual(formatPriceRange(4500000, 9000000, 'KZT'), '≈ $10,000 – $20,000');

    setPreferredCurrency('KZT');
    setCurrencyDisplayMode('both');
    assert.strictEqual(formatPriceRange(10000, 20000, 'USD'), '≈ 4,500,000 ₸ – 9,000,000 ₸ ($10,000 – $20,000)');
    // Summaries write millions compactly in the interface language; the published dollars stay exact.
    assert.strictEqual(
      formatPriceRange(10000, 20000, 'USD', { presentation: 'summary', locale: 'en-US' }),
      '≈ ₸4.5M – ₸9M ($10,000 – $20,000)',
    );
    assert.match(formatPrice(66720, 'USD', { presentation: 'summary', locale: 'ru-RU' }), /^≈ 30\s+млн\s+₸ \(\$66,720\)$/);

    setCurrencyDisplayMode('original');
    assert.strictEqual(formatPriceRange(10000, 20000, 'USD'), '$10,000 – $20,000');
    assert.strictEqual(formatPriceRange(null, 20000, 'USD'), '—');
  });

  test('a price in a currency without a rate is shown as published instead of mislabeled', () => {
    setPreferredCurrency('KZT');
    setCurrencyDisplayMode('preferred');
    assert.strictEqual(formatPrice(1200, 'XYZ'), formatMoney(1200, 'XYZ'));
    assert.doesNotMatch(formatPrice(1200, 'XYZ'), /₸/);
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

    // Verify fallback path sets date to FALLBACK_RATES_DATE and source to "fallback"
    mockSessionStorage = {};
    global.fetch = async () => { throw new Error('Network offline'); };
    const fallbackData = await loadRates();
    assert.strictEqual(fallbackData.source, 'fallback');
    assert.strictEqual(fallbackData.date, FALLBACK_RATES_DATE);
    assert.deepStrictEqual(getRatesMetadata(), { date: FALLBACK_RATES_DATE, source: 'fallback' });

    // Backend fallback payload with legacy "fallback" date also normalizes to FALLBACK_RATES_DATE
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        rates: { USD: 1.0, KZT: FALLBACK_RATES.KZT },
        date: 'fallback',
        source: 'fallback',
      }),
    });
    const normalizedFallback = await loadRates();
    assert.strictEqual(normalizedFallback.source, 'fallback');
    assert.strictEqual(normalizedFallback.date, FALLBACK_RATES_DATE);
  });

  test('formatRatesTimestamp respects user timezone for UTC timestamps and prevents day shift on YYYY-MM-DD', () => {
    const utcTimestamp = 'Wed, 18 Nov 2026 00:02:31 +0000';

    // In UTC-5 (America/New_York), 00:02 UTC on Nov 18 is Nov 17 at 7:02 PM.
    const nyFormattedEn = formatRatesTimestamp(utcTimestamp, 'eng', { timeZone: 'America/New_York' });
    assert.match(nyFormattedEn, /Nov 17, 2026/);
    assert.match(nyFormattedEn, /7:02/);

    // In UTC+5 (Asia/Almaty), 00:02 UTC on Nov 18 is Nov 18 at 05:02.
    const almatyFormattedRu = formatRatesTimestamp(utcTimestamp, 'rus', { timeZone: 'Asia/Almaty' });
    assert.match(almatyFormattedRu, /18/);
    assert.match(almatyFormattedRu, /2026/);
    assert.match(almatyFormattedRu, /05:02/);

    const almatyFormattedKaz = formatRatesTimestamp(utcTimestamp, 'kaz', { timeZone: 'Asia/Almaty' });
    assert.match(almatyFormattedKaz, /18/);
    assert.match(almatyFormattedKaz, /2026/);
    assert.match(almatyFormattedKaz, /05:02/);

    // Calendar-only YYYY-MM-DD must NOT shift to Nov 17 even in negative UTC offsets.
    const calendarNyEn = formatRatesTimestamp('2026-11-18', 'eng', { timeZone: 'America/New_York' });
    assert.strictEqual(calendarNyEn, 'Nov 18, 2026');

    const calendarNyRu = formatRatesTimestamp('2026-11-18', 'rus', { timeZone: 'America/New_York' });
    assert.match(calendarNyRu, /18/);
    assert.match(calendarNyRu, /2026/);

    // Invalid or placeholder dates return empty string.
    assert.strictEqual(formatRatesTimestamp('', 'eng'), '');
    assert.strictEqual(formatRatesTimestamp('fallback', 'eng'), '');
    assert.strictEqual(formatRatesTimestamp('2026-02-30', 'eng'), '');
    assert.strictEqual(formatRatesTimestamp('not-a-date', 'eng'), '');
  });

  test('startRatesLoading stops waiting for slow rates and announces them when they change prices', async () => {
    // The rates response is held until the test releases it, so no assertion depends on wall-clock timing.
    let releaseRates;
    const response = new Promise((resolve) => { releaseRates = resolve; });
    global.fetch = () => response;
    // Resolving while the response is still held proves the first render does not wait for slow rates.
    await startRatesLoading(5);
    assert.strictEqual(dispatchedEvents.filter((e) => e.type === 'currencyRatesUpdated').length, 0);
    assert.notStrictEqual(convert(1, 'USD', 'KZT'), 512.0);
    releaseRates({ ok: true, json: async () => ({ rates: { USD: 1.0, KZT: 512.0 }, date: '2026-11-15', source: 'api' }) });
    for (let tick = 0; tick < 50 && !dispatchedEvents.some((e) => e.type === 'currencyRatesUpdated'); tick += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.strictEqual(dispatchedEvents.filter((e) => e.type === 'currencyRatesUpdated').length, 1);
    // Late rates never pose as a currency change, which would rebuild pages the reader is working in.
    assert.strictEqual(dispatchedEvents.filter((e) => e.type === 'currencyChanged').length, 0);
    assert.strictEqual(convert(1, 'USD', 'KZT'), 512.0);

    // Rates that arrive in time are used by the first render without a redraw.
    mockSessionStorage = {};
    global.fetch = async () => ({ ok: true, json: async () => ({ rates: { USD: 1.0, KZT: 515.0 }, date: '2026-11-15', source: 'api' }) });
    await startRatesLoading(1000);
    assert.strictEqual(convert(1, 'USD', 'KZT'), 515.0);
    assert.strictEqual(dispatchedEvents.filter((e) => e.type === 'currencyRatesUpdated').length, 1);
  });

  test('formatPriceRange collapses equal rounded converted ends while keeping the original range', () => {
    setPreferredCurrency('USD');
    setCurrencyDisplayMode('both');
    const rendered = formatPriceRange(26442, 26800, 'GBP', { presentation: 'summary' });
    assert.match(rendered, /^≈ \$35,000 \(£26,442 – £26,800\)$/);
    assert.doesNotMatch(rendered, /\$[\d,]+ – \$[\d,]+/);
  });
});
