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
} from '../../frontend/javascript/pages/_shared.js';

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
