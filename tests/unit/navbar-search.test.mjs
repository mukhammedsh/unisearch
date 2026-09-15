import './setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUniversitySearchResults,
  generateOfflineNoticeHtml,
  generateSuggestionsHtml,
  isGlobalSearchDisabledWorkspace,
} from '../../frontend/javascript/components/navbar-search.js';

describe('Global Navbar Search Component', () => {
  it('fetchUniversitySearchResults returns empty array for empty query', async () => {
    const results = await fetchUniversitySearchResults('');
    assert.deepEqual(results, []);
  });

  it('fetchUniversitySearchResults calls API and limits to 5 items', async () => {
    const originalFetch = global.fetch;
    const mockItems = [
      { id: 'mit-usa-cambridge', name: 'MIT', location: { city: 'Cambridge', country: 'USA' } },
      { id: 'stanford-usa-ca', name: 'Stanford University', location: { city: 'Stanford', country: 'USA' } },
      { id: 'harvard-usa-cambridge', name: 'Harvard University', location: { city: 'Cambridge', country: 'USA' } },
      { id: 'oxford-uk-oxford', name: 'University of Oxford', location: { city: 'Oxford', country: 'UK' } },
      { id: 'cambridge-uk-cambridge', name: 'University of Cambridge', location: { city: 'Cambridge', country: 'UK' } },
      { id: 'extra-uni', name: 'Extra Uni', location: { city: 'City', country: 'Country' } },
    ];

    let calledUrl = '';
    global.fetch = async (url) => {
      calledUrl = String(url);
      return {
        ok: true,
        json: async () => ({ items: mockItems }),
      };
    };

    try {
      const results = await fetchUniversitySearchResults('univ');
      assert.ok(calledUrl.includes('/universities?q=univ&limit=5&fields=card'));
      assert.equal(results.length, 5);
      assert.equal(results[0].name, 'MIT');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('generateSuggestionsHtml generates university logo, name and location', () => {
    const items = [
      { id: 'mit-usa-cambridge', name: 'Massachusetts Institute of Technology', location: { city: 'Cambridge', country: 'USA' } },
      { id: 'nu-kaz-astana', name: 'Nazarbayev University', location: { city: 'Astana', country: 'Kazakhstan' } },
    ];

    const html = generateSuggestionsHtml(items, 0);

    // Verify both items rendered
    assert.ok(html.includes('data-uni-id="mit-usa-cambridge"'));
    assert.ok(html.includes('data-uni-id="nu-kaz-astana"'));

    // Verify logo and fallback initials
    assert.ok(html.includes('navbar-search-suggestion__logo'));
    assert.ok(html.includes('mit-usa-cambridge.png'));
    assert.ok(html.includes('data-fallback-text="MI"'));
    assert.ok(html.includes('data-fallback-text="NU"'));

    // Verify names
    assert.ok(html.includes('navbar-search-suggestion__name">Massachusetts Institute of Technology</span>'));
    assert.ok(html.includes('navbar-search-suggestion__name">Nazarbayev University</span>'));

    // Verify locations
    assert.ok(html.includes('Cambridge, USA'));
    assert.ok(html.includes('Astana, Kazakhstan'));

    // Verify first item is highlighted
    assert.ok(html.includes('is-highlighted'));
  });

  it('generateSuggestionsHtml renders empty state when items list is empty', () => {
    const html = generateSuggestionsHtml([]);
    assert.ok(html.includes('navbar-search-empty'));
  });

  it('generateOfflineNoticeHtml generates offline notice banner', () => {
    const html = generateOfflineNoticeHtml();
    assert.ok(html.includes('navbar-search-empty--offline'));
    assert.ok(html.includes('navbar.search.offline_notice'));
  });

  it('disables global suggestions only in compare workspace', () => {
    const originalDataset = document.body.dataset;
    try {
      document.body.dataset = { page: 'universities' };
      assert.equal(isGlobalSearchDisabledWorkspace(), false);

      document.body.dataset = { page: 'compare' };
      assert.equal(isGlobalSearchDisabledWorkspace(), true);

      document.body.dataset = { page: 'guide' };
      assert.equal(isGlobalSearchDisabledWorkspace(), false);

      document.body.dataset = { page: 'profile' };
      assert.equal(isGlobalSearchDisabledWorkspace(), false);
    } finally {
      document.body.dataset = originalDataset;
    }
  });
});
