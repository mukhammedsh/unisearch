import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert';

// Now import the function
import { setLanguage } from '../../frontend/javascript/i18n.js';
import {
  cleanDecoratedText,
  formatFundingOptionsCount,
  normalizeFundingPreference,
  normalizeUrl,
  renderAdmissionsOverview,
  renderProgramAdmissionsSignals,
  resolveUniversityCardPrice,
  splitPriceDisplay,
  safeUrl,
  uniThumbnailSrc,
} from '../../frontend/javascript/pages/_shared.js';
import fs from 'node:fs';

test('normalizeFundingPreference', async (t) => {
  await t.test('should return grant for grant', () => {
    assert.strictEqual(normalizeFundingPreference('grant'), 'grant');
  });

  await t.test('should return paid for paid', () => {
    assert.strictEqual(normalizeFundingPreference('paid'), 'paid');
  });

  await t.test('should handle case insensitivity', () => {
    assert.strictEqual(normalizeFundingPreference('GRANT'), 'grant');
    assert.strictEqual(normalizeFundingPreference('Paid'), 'paid');
  });

  await t.test('should handle whitespace', () => {
    assert.strictEqual(normalizeFundingPreference('  grant  '), 'grant');
  });

  await t.test('should return any for other values', () => {
    assert.strictEqual(normalizeFundingPreference('any'), 'any');
    assert.strictEqual(normalizeFundingPreference('random'), 'any');
    assert.strictEqual(normalizeFundingPreference(''), 'any');
    assert.strictEqual(normalizeFundingPreference(null), 'any');
    assert.strictEqual(normalizeFundingPreference(undefined), 'any');
  });
});

test('normalizeUrl', async (t) => {
  await t.test('returns empty string for empty or non-string values', () => {
    assert.strictEqual(normalizeUrl(''), '');
    assert.strictEqual(normalizeUrl(null), '');
    assert.strictEqual(normalizeUrl(undefined), '');
    assert.strictEqual(normalizeUrl(123), '');
    assert.strictEqual(normalizeUrl({}), '');
    assert.strictEqual(normalizeUrl('   '), '');
  });

  await t.test('keeps http and https URLs', () => {
    assert.strictEqual(normalizeUrl('http://example.com'), 'http://example.com');
    assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com');
    assert.strictEqual(normalizeUrl('  https://example.com  '), 'https://example.com');
    assert.strictEqual(normalizeUrl('HTTP://example.com'), 'HTTP://example.com');
  });

  await t.test('normalizes protocol-relative and www URLs', () => {
    assert.strictEqual(normalizeUrl('//example.com'), 'https://example.com');
    assert.strictEqual(normalizeUrl('www.example.com'), 'https://www.example.com');
    assert.strictEqual(normalizeUrl('WWW.example.com'), 'https://WWW.example.com');
  });

  await t.test('rejects unsupported URL forms', () => {
    assert.strictEqual(normalizeUrl('example.com'), '');
    assert.strictEqual(normalizeUrl('ftp://example.com'), '');
    assert.strictEqual(normalizeUrl('mailto:test@example.com'), '');
    assert.strictEqual(normalizeUrl('http//example.com'), '');
  });
});

test('safeUrl', async (t) => {
  await t.test('allows only http and https URLs after normalization', () => {
    assert.strictEqual(safeUrl('https://example.com/path'), 'https://example.com/path');
    assert.strictEqual(safeUrl('www.example.com/source'), 'https://www.example.com/source');
    assert.strictEqual(safeUrl('javascript:alert(1)'), '');
    assert.strictEqual(safeUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.strictEqual(safeUrl('ftp://example.com/file'), '');
  });
});

test('admissions verified-null UI names the missing data and exposes source context', () => {
  setLanguage('eng', { persist: false, emit: false });
  const admissions = {
    status_date: '2026-04-04',
    university_wide: {
      status: 'no_official_source',
      acceptance_rate_percent: null,
      sources: [{ url: 'https://example.edu/admissions', label: 'Undergraduate admissions overview' }],
    },
    program_level: {
      status: 'verified_null_only',
      kind: 'institution_wide_only',
      sources: [{ url: 'https://example.edu/apply', label: 'How undergraduate admission works' }],
    },
    programs: [{
      program_name: 'Computer Science',
      data_type: 'verified-null',
      sources: [{ url: 'https://example.edu/apply', label: 'How undergraduate admission works' }],
    }],
  };

  const overview = renderAdmissionsOverview(admissions);
  assert.match(overview, /No separate admissions data/);
  assert.match(overview, /Applicants are considered at university level/);
  assert.match(overview, /How undergraduate admission works/);
  assert.match(overview, /Why this data is unavailable/);
  assert.doesNotMatch(overview, />—</);

  const programs = renderProgramAdmissionsSignals(admissions);
  assert.match(programs, /No program-specific admissions data/);
  assert.match(programs, /Applicants are considered at university level/);
  assert.match(programs, /How undergraduate admission works/);
  assert.doesNotMatch(programs, /Not separately published/);
});

test('map CDN assets are pinned with SRI', () => {
  const source = fs.readFileSync(new URL('../../frontend/javascript/pages/universities.js', import.meta.url), 'utf8');
  assert.match(source, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(source, /leaflet\.markercluster@1\.4\.1\/dist\/leaflet\.markercluster\.js/);
  assert.match(source, /integrity: "sha384-/);
  assert.match(source, /script\.integrity = asset\.integrity/);
});

test('cleanDecoratedText', async (t) => {
  await t.test('removes leading symbols and emoji', () => {
    assert.strictEqual(cleanDecoratedText('🔥 Hot program'), 'Hot program');
    assert.strictEqual(cleanDecoratedText('• Strong CS'), 'Strong CS');
    assert.strictEqual(cleanDecoratedText('  — Scholarship'), 'Scholarship');
  });

  await t.test('keeps meaningful middle and trailing decorators', () => {
    assert.strictEqual(cleanDecoratedText('Data + AI ⭐'), 'Data + AI ⭐');
    assert.strictEqual(cleanDecoratedText('A* requirement'), 'A* requirement');
  });

  await t.test('returns raw text when only decorations remain', () => {
    assert.strictEqual(cleanDecoratedText('***'), '***');
    assert.strictEqual(cleanDecoratedText(''), '');
    assert.strictEqual(cleanDecoratedText(null), '');
  });
});

test('formatFundingOptionsCount', async (t) => {
  await t.test('formats English plurals', () => {
    setLanguage('eng', { persist: false, emit: false });
    assert.strictEqual(formatFundingOptionsCount(0), '0 funding options');
    assert.strictEqual(formatFundingOptionsCount(1), '1 funding option');
    assert.strictEqual(formatFundingOptionsCount(2), '2 funding options');
    assert.strictEqual(formatFundingOptionsCount(null), '0 funding options');
    assert.strictEqual(formatFundingOptionsCount('invalid'), '0 funding options');
  });

  await t.test('formats Russian plurals', () => {
    setLanguage('rus', { persist: false, emit: false });
    assert.strictEqual(formatFundingOptionsCount(0), '0 вариантов финансирования');
    assert.strictEqual(formatFundingOptionsCount(1), '1 вариант финансирования');
    assert.strictEqual(formatFundingOptionsCount(2), '2 варианта финансирования');
    assert.strictEqual(formatFundingOptionsCount(4), '4 варианта финансирования');
    assert.strictEqual(formatFundingOptionsCount(5), '5 вариантов финансирования');
    assert.strictEqual(formatFundingOptionsCount(11), '11 вариантов финансирования');
    setLanguage('eng', { persist: false, emit: false });
  });
});

test('uniThumbnailSrc', async (t) => {
  await t.test('uses WebP thumbnails by default', () => {
    assert.strictEqual(
      uniThumbnailSrc('mit-usa-cambridge'),
      'http://localhost:8000/universities/assets/thumbnails-small/mit-usa-cambridge.webp',
    );
    assert.strictEqual(
      uniThumbnailSrc('mit-usa-cambridge', { size: 'medium' }),
      'http://localhost:8000/universities/assets/thumbnails-medium/mit-usa-cambridge.webp',
    );
    assert.strictEqual(
      uniThumbnailSrc('mit-usa-cambridge', { forceFull: true }),
      'http://localhost:8000/universities/assets/thumbnails/mit-usa-cambridge.webp',
    );
  });

  await t.test('keeps explicit JPG fallback paths available', () => {
    assert.strictEqual(
      uniThumbnailSrc('mit-usa-cambridge', { forceFull: true, format: 'jpg' }),
      'http://localhost:8000/universities/assets/thumbnails/mit-usa-cambridge.jpg',
    );
  });
});

test('resolveUniversityCardPrice', async (t) => {
  await t.test('resolves non-AI card in native currency (KZT)', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 1995000);
    assert.strictEqual(res.currency, 'KZT');
    assert.ok(res.amountUSD > 4000 && res.amountUSD < 5000, `amountUSD should be ~$4,433, got ${res.amountUSD}`);
  });

  await t.test('resolves non-AI card in native currency (CAD)', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 60000,
        currency: 'CAD',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 60000);
    assert.strictEqual(res.currency, 'CAD');
    assert.ok(res.amountUSD > 40000 && res.amountUSD < 50000, `amountUSD should be ~$44,400, got ${res.amountUSD}`);
  });

  await t.test('resolves legacy backend response where finalPrice is in USD without match.currency', () => {
    // When legacy backend returned finalPrice in USD, it never sent match.currency.
    // In this case, it must NOT fall back to finance.currency ("KZT"), which would divide 4424 / 450 into $9.83!
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        finalPrice: 4424,
        costYearUSD: 4424,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 4424);
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.amountUSD, 4424);
  });

  await t.test('resolves new backend response with explicit native finalPrice and currency', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        finalPrice: 1335000,
        currency: 'KZT',
        finalPriceUSD: 2967,
        costYearNative: 1995000,
        costYearUSD: 4433,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 1335000);
    assert.strictEqual(res.currency, 'KZT');
    assert.strictEqual(res.amountUSD, 2967);
  });

  await t.test('handles full grant / zero tuition correctly without falling back to base cost', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        finalPrice: 0,
        currency: 'KZT',
        finalPriceUSD: 0,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 0);
    assert.strictEqual(res.currency, 'KZT');
    assert.strictEqual(res.amountUSD, 0);
  });

  await t.test('handles legacy costWithAmountUSD field', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        costWithAmountUSD: 3500,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 3500);
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.amountUSD, 3500);
  });

  await t.test('handles missing or invalid university data gracefully', () => {
    assert.deepStrictEqual(resolveUniversityCardPrice(null), { amount: null, currency: 'USD', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({}), { amount: null, currency: 'USD', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({ finance: {} }), { amount: null, currency: 'USD', amountUSD: null });
  });
});

test('splitPriceDisplay', async (t) => {
  await t.test('separates converted and original currency values', () => {
    assert.deepStrictEqual(
      splitPriceDisplay('≈ $58,400 (£43,200)'),
      { primary: '≈ $58,400', secondary: '(£43,200)' },
    );
  });

  await t.test('keeps one-currency values on a single line', () => {
    assert.deepStrictEqual(
      splitPriceDisplay('$95,134'),
      { primary: '$95,134', secondary: '' },
    );
  });
});

