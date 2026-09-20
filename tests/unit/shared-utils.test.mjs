import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';

global.fetch = async (url) => {
  const target = String(url || '');
  if (target.endsWith('Localization/eng')) {
    return {
      ok: true,
      async text() {
        return readFile(new URL('../../frontend/Localization/eng', import.meta.url), 'utf8');
      },
    };
  }
  if (target.endsWith('Localization/ru')) {
    return {
      ok: true,
      async text() {
        return readFile(new URL('../../frontend/Localization/ru', import.meta.url), 'utf8');
      },
    };
  }
  return { ok: false, async text() { return ''; } };
};

const { initI18n, setLanguage } = await import('../../frontend/javascript/i18n.js');
const {
  cleanDecoratedText,
  formatFundingOptionsCount,
  localizeRoiLabel,
  modeAwareAnnualCost,
  modeAwareBreakdown,
  modeBreakdownFromFinance,
  modeTotalFromFinance,
  normalizeFundingPreference,
  normalizeUrl,
  renderAdmissionsOverview,
  renderProgramAdmissionsSignals,
  renderRoiBox,
  resolveUniversityCardPrice,
  splitPriceDisplay,
  safeUrl,
  uniThumbnailSrc,
} = await import('../../frontend/javascript/pages/_shared.js');

await initI18n();

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
  await t.test('resolves non-AI card in native currency via finance.total_cost_year_usd (KZT)', () => {
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

  await t.test('resolves non-AI card in native currency via finance.total_cost_year_usd (CAD)', () => {
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

  await t.test('resolves card with canonical matchData contract (finalPrice + currency)', () => {
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

  await t.test('resolves canonical contract and converts to USD when finalPriceUSD is absent', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 10000,
        currency: 'USD',
      },
      matchData: {
        finalPrice: 10000,
        currency: 'USD',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 10000);
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.amountUSD, 10000);
  });

  await t.test('resolves card with explicit finalPriceUSD', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        finalPriceUSD: 5000,
        currency: 'USD',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 5000);
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.amountUSD, 5000);
  });

  await t.test('resolves card using matchData costYearNative with currency fallback', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        costYearNative: 1500000,
        costYearUSD: 3333,
        currency: 'KZT',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 1500000);
    assert.strictEqual(res.currency, 'KZT');
    assert.strictEqual(res.amountUSD, 3333);
  });

  await t.test('resolves card using matchData costYearUSD fallback', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        costYearUSD: 4424,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 4424);
    assert.strictEqual(res.currency, 'USD');
    assert.strictEqual(res.amountUSD, 4424);
  });

  await t.test('does not use removed legacy costWithAmountUSD field and falls back to finance or null', () => {
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
    assert.strictEqual(res.amount, 1995000);
    assert.strictEqual(res.currency, 'KZT');
    assert.ok(res.amountUSD > 4000 && res.amountUSD < 5000);

    const uniNoFinance = {
      matchData: {
        costWithAmountUSD: 3500,
      },
    };
    assert.deepStrictEqual(resolveUniversityCardPrice(uniNoFinance), {
      amount: null,
      currency: 'USD',
      amountUSD: null,
    });
  });

  await t.test('does not use removed legacy contract of finalPrice without currency, falling back to finance or null', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 1995000,
        currency: 'KZT',
      },
      matchData: {
        finalPrice: 4424,
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 1995000);
    assert.strictEqual(res.currency, 'KZT');
    assert.ok(res.amountUSD > 4000 && res.amountUSD < 5000);

    const uniNoFinance = {
      matchData: {
        finalPrice: 4424,
      },
    };
    assert.deepStrictEqual(resolveUniversityCardPrice(uniNoFinance), {
      amount: null,
      currency: 'USD',
      amountUSD: null,
    });
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

  await t.test('handles zero base cost in finance correctly', () => {
    const uni = {
      finance: {
        total_cost_year_usd: 0,
        currency: 'EUR',
      },
    };
    const res = resolveUniversityCardPrice(uni);
    assert.strictEqual(res.amount, 0);
    assert.strictEqual(res.currency, 'EUR');
    assert.strictEqual(res.amountUSD, 0);
  });

  await t.test('handles missing or invalid university data gracefully', () => {
    assert.deepStrictEqual(resolveUniversityCardPrice(null), { amount: null, currency: 'USD', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({}), { amount: null, currency: 'USD', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({ finance: {} }), { amount: null, currency: 'USD', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({ finance: { total_cost_year_usd: null, currency: 'EUR' } }), { amount: null, currency: 'EUR', amountUSD: null });
    assert.deepStrictEqual(resolveUniversityCardPrice({ finance: { total_cost_year_usd: '', currency: 'KZT' } }), { amount: null, currency: 'KZT', amountUSD: null });
  });
});

test('splitPriceDisplay', async (t) => {
  await t.test('separates converted and original currency values', () => {
    assert.deepStrictEqual(
      splitPriceDisplay('≈ $58,400 (£43,200)'),
      { primary: '≈ $58,400', secondary: '(£43,200)' },
    );
  });

  await t.test('preserves parentheses in the primary price label', () => {
    assert.deepStrictEqual(
      splitPriceDisplay('Cost (estimated) ($500)'),
      { primary: 'Cost (estimated)', secondary: '($500)' },
    );
  });

  await t.test('keeps one-currency values on a single line', () => {
    assert.deepStrictEqual(
      splitPriceDisplay('$95,134'),
      { primary: '$95,134', secondary: '' },
    );
  });
});

test('localizeRoiLabel', async (t) => {
  await t.test('formats English ROI labels', () => {
    setLanguage('eng', { persist: false, emit: false });
    assert.strictEqual(localizeRoiLabel('Excellent Return', 'excellent'), 'Excellent Return');
    assert.strictEqual(localizeRoiLabel('Positive Return', 'good'), 'Positive Return');
    assert.strictEqual(localizeRoiLabel('High Investment', 'warn'), 'High Investment');
    assert.strictEqual(localizeRoiLabel('No Data', 'neutral'), 'Insufficient Data');
    assert.strictEqual(localizeRoiLabel('Insufficient Data', 'neutral'), 'Insufficient Data');
    assert.strictEqual(localizeRoiLabel('', 'neutral'), 'Insufficient Data');
    assert.strictEqual(localizeRoiLabel(null), 'Insufficient Data');
  });

  await t.test('formats Russian ROI labels', () => {
    setLanguage('rus', { persist: false, emit: false });
    assert.strictEqual(localizeRoiLabel('Excellent Return', 'excellent'), 'Отличная отдача');
    assert.strictEqual(localizeRoiLabel('Positive Return', 'good'), 'Положительная отдача');
    assert.strictEqual(localizeRoiLabel('High Investment', 'warn'), 'Большие вложения');
    assert.strictEqual(localizeRoiLabel('No Data', 'neutral'), 'Недостаточно данных');
    assert.strictEqual(localizeRoiLabel('Недостаточно данных', 'neutral'), 'Недостаточно данных');
    assert.strictEqual(localizeRoiLabel('', 'neutral'), 'Недостаточно данных');
    setLanguage('eng', { persist: false, emit: false });
  });
});

test('renderRoiBox', async (t) => {
  await t.test('returns empty string when ROI is missing or invalid', () => {
    assert.strictEqual(renderRoiBox(null), '');
    assert.strictEqual(renderRoiBox(undefined), '');
    assert.strictEqual(renderRoiBox({}), '');
  });

  await t.test('hides ROI markup in English when salary data is missing', () => {
    setLanguage('eng', { persist: false, emit: false });
    const markup = renderRoiBox({
      context_type: 'no_salary_data',
      salary_used_usd: null,
      roi_value: null,
      annual_cost_usd: 35000,
      roi_label: 'No Data',
      roi_tone: 'neutral',
    });

    assert.strictEqual(markup, '');
  });

  await t.test('hides ROI markup in Russian when salary data is missing', () => {
    setLanguage('rus', { persist: false, emit: false });
    const markup = renderRoiBox({
      context_type: 'no_salary_data',
      salary_used_usd: null,
      roi_value: null,
      annual_cost_usd: 25000,
      roi_label: 'No Data',
      roi_tone: 'neutral',
    });

    assert.strictEqual(markup, '');
    setLanguage('eng', { persist: false, emit: false });
  });

  await t.test('renders ROI markup when valid salary data is provided', () => {
    setLanguage('eng', { persist: false, emit: false });
    const markup = renderRoiBox({
      context_type: 'default',
      salary_used_usd: 95000,
      annual_cost_usd: 40000,
      roi_value: 2.375,
      roi_label: 'Excellent Return',
      roi_tone: 'excellent',
    });

    assert.ok(markup.includes('roi-box'), 'Should contain roi-box section');
    assert.ok(markup.includes('2.4x'), 'Should contain formatted ROI score (2.4x)');
    assert.ok(markup.includes('$95,000'), 'Should contain salary');
    assert.ok(markup.includes('$40,000'), 'Should contain annual cost');
    assert.ok(markup.includes('roi-tone-positive'), 'Should contain positive tone class');
    assert.ok(markup.includes('Excellent Return'), 'Should contain localized label');
  });
});

test('modeBreakdownFromFinance', async (t) => {
  await t.test('returns breakdown for canonical key', () => {
    const finance = {
      costs_breakdown_year_usd_by_mode: {
        online: { Tuition: 12000 },
        'on-campus': { Tuition: 12000, Housing_Dorm: 10000 },
      },
    };
    assert.deepStrictEqual(modeBreakdownFromFinance(finance, 'online'), { Tuition: 12000 });
  });

  await t.test('returns null when canonical key missing', () => {
    assert.strictEqual(modeBreakdownFromFinance({ total_cost_year_usd: 30000 }, 'online'), null);
  });

  await t.test('returns null for null/undefined input', () => {
    assert.strictEqual(modeBreakdownFromFinance(null, 'online'), null);
    assert.strictEqual(modeBreakdownFromFinance(undefined, 'online'), null);
  });

  await t.test('returns null when mode not in map', () => {
    const finance = {
      costs_breakdown_year_usd_by_mode: { 'on-campus': { Tuition: 12000 } },
    };
    assert.strictEqual(modeBreakdownFromFinance(finance, 'online'), null);
  });

  await t.test('does not resolve removed key costs_breakdown_by_mode_year_usd', () => {
    const finance = {
      costs_breakdown_by_mode_year_usd: { online: { Tuition: 9000 } },
    };
    assert.strictEqual(modeBreakdownFromFinance(finance, 'online'), null);
  });

  await t.test('does not resolve removed key mode_costs_breakdown_year_usd', () => {
    const finance = {
      mode_costs_breakdown_year_usd: { online: { Tuition: 9000 } },
    };
    assert.strictEqual(modeBreakdownFromFinance(finance, 'online'), null);
  });
});

test('modeTotalFromFinance', async (t) => {
  await t.test('returns total for canonical key', () => {
    const finance = { total_cost_year_usd_by_mode: { online: 17000 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'online'), 17000);
  });

  await t.test('returns null when canonical key missing', () => {
    assert.strictEqual(modeTotalFromFinance({ total_cost_year_usd: 30000 }, 'online'), null);
  });

  await t.test('returns null for null/undefined input', () => {
    assert.strictEqual(modeTotalFromFinance(null, 'online'), null);
    assert.strictEqual(modeTotalFromFinance(undefined, 'online'), null);
  });

  await t.test('returns null for negative amount', () => {
    const finance = { total_cost_year_usd_by_mode: { online: -5000 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'online'), null);
  });

  await t.test('returns 0 for zero amount', () => {
    const finance = { total_cost_year_usd_by_mode: { online: 0 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'online'), 0);
  });

  await t.test('does not resolve removed key total_cost_by_mode_year_usd', () => {
    const finance = { total_cost_by_mode_year_usd: { online: 17000 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'online'), null);
  });

  await t.test('does not resolve removed key mode_total_cost_year_usd', () => {
    const finance = { mode_total_cost_year_usd: { online: 17000 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'online'), null);
  });

  await t.test('normalizes study mode synonyms', () => {
    const finance = { total_cost_year_usd_by_mode: { Online: 17000 } };
    assert.strictEqual(modeTotalFromFinance(finance, 'distance'), 17000);
  });
});

test('modeAwareAnnualCost', async (t) => {
  await t.test('uses canonical exact mode breakdown tuition for online mode', () => {
    const finance = {
      total_cost_year_usd: 35000,
      costs_breakdown_year_usd: { Tuition: 15000, Housing_Dorm: 12000 },
      costs_breakdown_year_usd_by_mode: { online: { Tuition: 8000 } },
    };
    assert.strictEqual(modeAwareAnnualCost(finance, 'online'), 8000);
  });

  await t.test('uses canonical exact mode total when tuition missing in breakdown for online mode', () => {
    const finance = {
      total_cost_year_usd: 35000,
      costs_breakdown_year_usd: { Housing_Dorm: 12000 },
      total_cost_year_usd_by_mode: { online: 9500 },
    };
    assert.strictEqual(modeAwareAnnualCost(finance, 'online'), 9500);
  });

  await t.test('does not use removed alternative mode keys, falling back to general tuition', () => {
    const finance = {
      total_cost_year_usd: 35000,
      costs_breakdown_year_usd: { Tuition: 15000, Housing_Dorm: 12000 },
      costs_breakdown_by_mode_year_usd: { online: { Tuition: 8000 } },
      total_cost_by_mode_year_usd: { online: 9500 },
      mode_costs_breakdown_year_usd: { online: { Tuition: 7000 } },
      mode_total_cost_year_usd: { online: 7500 },
    };
    assert.strictEqual(modeAwareAnnualCost(finance, 'online'), 15000);
  });

  await t.test('returns total cost for on-campus mode', () => {
    const finance = {
      total_cost_year_usd: 35000,
      total_cost_year_usd_by_mode: { online: 9500 },
    };
    assert.strictEqual(modeAwareAnnualCost(finance, 'on-campus'), 35000);
  });

  await t.test('returns 0 when online data completely missing', () => {
    assert.strictEqual(modeAwareAnnualCost({}, 'online'), 0);
  });
});

test('modeAwareBreakdown', async (t) => {
  await t.test('uses canonical exact mode breakdown for online mode', () => {
    const finance = {
      costs_breakdown_year_usd: { Tuition: 15000, Housing_Dorm: 12000 },
      costs_breakdown_year_usd_by_mode: { online: { Tuition: 8000 } },
    };
    assert.deepStrictEqual(modeAwareBreakdown(finance, 'online'), { Tuition: 8000 });
  });

  await t.test('does not use removed alternative mode breakdown keys', () => {
    const finance = {
      costs_breakdown_year_usd: { Tuition: 15000, Housing_Dorm: 12000 },
      costs_breakdown_by_mode_year_usd: { online: { Tuition: 8000 } },
    };
    assert.deepStrictEqual(modeAwareBreakdown(finance, 'online'), { Tuition: 15000 });
  });

  await t.test('returns full fallback breakdown for on-campus mode', () => {
    const finance = {
      costs_breakdown_year_usd: { Tuition: 15000, Housing_Dorm: 12000 },
      costs_breakdown_year_usd_by_mode: { online: { Tuition: 8000 } },
    };
    assert.deepStrictEqual(modeAwareBreakdown(finance, 'on-campus'), { Tuition: 15000, Housing_Dorm: 12000 });
  });
});

