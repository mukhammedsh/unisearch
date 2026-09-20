import './setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUniversitySearchResults,
  generateOfflineNoticeHtml,
  generateSuggestionsHtml,
  highlightMatchText,
  isGlobalSearchDisabledWorkspace,
  isMobileSearchViewport,
  isMobileSearchOpen,
  renderGlobalSearchOfflineNotice,
  renderGlobalSearchSuggestions,
  hideGlobalSearchSuggestions,
  openMobileSearch,
  closeMobileSearch,
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

  it('highlightMatchText wraps matching case-insensitive text in mark tag', () => {
    assert.equal(highlightMatchText('Harvard University', 'harv'), '<mark class="navbar-search-highlight">Harv</mark>ard University');
    assert.equal(highlightMatchText('Cambridge, USA', 'USA'), 'Cambridge, <mark class="navbar-search-highlight">USA</mark>');
    assert.equal(highlightMatchText('Stanford', ''), 'Stanford');
  });

  it('generateSuggestionsHtml with query highlights match and shows alias badge', () => {
    const items = [
      {
        id: 'mit-usa-cambridge',
        name: 'Massachusetts Institute of Technology',
        search_aliases: ['mit', 'мит'],
        location: { city: 'Cambridge', country: 'USA' },
      },
    ];

    const html = generateSuggestionsHtml(items, 0, 'MIT');
    assert.ok(html.includes('navbar-search-suggestion__badge'));
    assert.ok(html.includes('MIT</span>'));
  });

  it('isMobileSearchViewport checks window.matchMedia', () => {
    const origMatchMedia = global.window.matchMedia;
    try {
      global.window.matchMedia = (query) => ({
        matches: query.includes('1024px'),
      });
      assert.equal(isMobileSearchViewport(), true);

      global.window.matchMedia = () => ({ matches: false });
      assert.equal(isMobileSearchViewport(), false);
    } finally {
      global.window.matchMedia = origMatchMedia;
    }
  });

  it('isMobileSearchOpen detects search open class on navbar', () => {
    const origQuerySelector = global.document.querySelector;
    try {
      global.document.querySelector = (sel) => {
        if (sel === '.navbar.is-search-open') return null;
        return null;
      };
      assert.equal(isMobileSearchOpen(), false);

      global.document.querySelector = (sel) => {
        if (sel === '.navbar.is-search-open') return {};
        return null;
      };
      assert.equal(isMobileSearchOpen(), true);
    } finally {
      global.document.querySelector = origQuerySelector;
    }
  });

  it('renderGlobalSearchOfflineNotice and renderGlobalSearchSuggestions manipulate DOM container', () => {
    const origQuerySelector = global.document.querySelector;
    const classes = new Set();
    const container = {
      className: 'navbar-search-suggestions',
      innerHTML: '',
      classList: {
        add: (cls) => classes.add(cls),
        remove: (cls) => classes.delete(cls),
        contains: (cls) => classes.has(cls),
      },
      querySelectorAll: () => [],
      setAttribute: () => {},
    };

    const host = {
      querySelector: (sel) => (sel === '.navbar-search-suggestions' ? container : null),
      appendChild: () => {},
    };

    global.document.querySelector = (sel) => {
      if (sel === '.navbar-search-suggestions') return container;
      return null;
    };

    try {
      renderGlobalSearchOfflineNotice(host);
      assert.ok(container.classList.contains('is-open'));
      assert.ok(container.innerHTML.includes('offline_notice'));

      const mockItems = [
        { id: 'mit-usa-cambridge', name: 'MIT', location: { city: 'Cambridge', country: 'USA' } },
      ];
      renderGlobalSearchSuggestions(host, mockItems, 'mit');
      assert.ok(container.classList.contains('is-open'));
      assert.ok(container.innerHTML.includes('mit-usa-cambridge'));

      hideGlobalSearchSuggestions();
      assert.equal(container.classList.contains('is-open'), false);
      assert.equal(container.innerHTML, '');
    } finally {
      global.document.querySelector = origQuerySelector;
    }
  });

  it('openMobileSearch and closeMobileSearch toggle mobile state', () => {
    const origMatchMedia = global.window.matchMedia;
    const origGetElementById = global.document.getElementById;
    const origQuerySelector = global.document.querySelector;
    const origSetTimeout = global.window.setTimeout;

    global.window.matchMedia = () => ({ matches: true });
    global.window.setTimeout = (cb) => { cb(); return 1; };

    const navClasses = new Set();
    const navbar = {
      classList: {
        add: (cls) => navClasses.add(cls),
        remove: (cls) => navClasses.delete(cls),
        contains: (cls) => navClasses.has(cls),
      },
    };
    const host = {};
    let focused = false;
    let blurred = false;
    const qInput = {
      focus: () => { focused = true; },
      blur: () => { blurred = true; },
    };
    const backBtn = { hidden: true };
    const toggle = {
      setAttribute: (k, v) => {},
      focus: () => {},
      hidden: false,
    };
    const scrim = {
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      hidden: true,
    };

    const elements = {
      universitySearch: host,
      qInput: qInput,
      navbarSearchBack: backBtn,
      navbarSearchToggle: toggle,
      navbarSearchScrim: scrim,
    };

    global.document.getElementById = (id) => elements[id] || null;
    global.document.querySelector = (sel) => {
      if (sel === '.navbar') return navbar;
      return null;
    };

    try {
      const opened = openMobileSearch();
      assert.equal(opened, true);
      assert.equal(navClasses.has('is-search-open'), true);
      assert.equal(backBtn.hidden, false);
      assert.equal(focused, true);

      // Re-opening when already open just focuses input
      focused = false;
      const reOpened = openMobileSearch();
      assert.equal(reOpened, true);
      assert.equal(focused, true);

      // Closing mobile search
      const closed = closeMobileSearch();
      assert.equal(closed, true);
      assert.equal(navClasses.has('is-search-open'), false);
      assert.equal(backBtn.hidden, true);

      // Closing when not open returns false
      assert.equal(closeMobileSearch(), false);
    } finally {
      global.window.matchMedia = origMatchMedia;
      global.document.getElementById = origGetElementById;
      global.document.querySelector = origQuerySelector;
      global.window.setTimeout = origSetTimeout;
    }
  });
});


