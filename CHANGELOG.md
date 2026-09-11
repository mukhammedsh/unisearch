# Changelog

All notable project changes should be recorded here.

## 5.0.4 (2026-09-11) - 404 Page Design Token Alignment, Unified Empty States, and Dev CSP Polishing
- Redesigned the 404 error page according to Calm Academic Workspace standards (`frontend/404.html`, `frontend/css/error.css`):
  - Flattened layout structure by removing nested container boxes and double card layers on the canvas.
  - Standardized typography, spacing, and radiuses on design tokens (`var(--space-*)`, `var(--radius-*)`, `var(--text-*)`).
  - Removed redundant manual `:root[data-theme="dark"]` overrides in favor of semantic root theme CSS variables.
  - Added `#mainContent` anchor and `:focus-visible` focus outlines for keyboard navigation across cards and buttons.
- Unified empty state styling and filter reset UX across Catalog and Ranking views (`frontend/css/ranking.css`, `frontend/css/universities/01-shell-controls.css`, `frontend/javascript/pages/ranking.js`, `frontend/javascript/pages/universities.js`):
  - Replaced custom `.rank-empty` markup in Ranking with shared `.u-state-card.u-state-card--empty` component.
  - Removed duplicate in-card filter reset buttons in favor of the primary sidebar and toolbar reset control (`#resetFiltersBtn`).
  - Propagated contextual empty state text to `renderRankingList`, differentiating general zero results from empty favorites filter (`only_saved`).
  - Refined `.u-state-card__title` font-weight to `normal`.
- Updated frontend development server security headers (`scripts/frontend_dev_server.py`):
  - Expanded `img-src` in `Content-Security-Policy-Report-Only` with local origins, `unpkg.com`, and OpenStreetMap tile domains for local map and media asset development.
- Fixed mobile filter drawer styling and design lint compliance (`frontend/css/universities/07-responsive.css`):
  - Replaced negative margin bleed hack with child horizontal padding and standardized sticky filter title z-index to the layering scale (`z-index: 2`).
- Updated Playwright E2E regression tests (`tests/e2e/universities-tabs-compare.spec.js`):
  - Updated ranking tab filter reset verification to trigger via `#resetFiltersBtn`.
- Moved university rankings from a standalone tab into a catalog sort strategy (`frontend/index.html`, `frontend/javascript/pages/universities.js`, `frontend/javascript/pages/_shared.js`, `frontend/css/universities/02-catalog.css`):
  - Added "Global Rank" (`rank_asc`) option to the catalog `#sortSelect` dropdown with bidirectional URL query synchronization (`?sort=rank_asc`).
  - Added native browser verification tooltips to university card rank metrics (`.uni-metric--rank`) detailing source rank name, status, and verification date on hover.
  - Linked the card rank metric directly to the university detail view with responsive hover styling and accessible cursor feedback.
  - Removed the standalone Ranking tab button from `#universitiesSectionTabs`, leaving Catalog and Comparing as the two primary workspace modes.
- Cleaned up obsolete standalone ranking infrastructure (`frontend/index.html`, `frontend/404.html`, `frontend/javascript/main.js`, `frontend/javascript/routes.js`, `frontend/Localization/eng`, `frontend/Localization/ru`, `scripts/*-baseline.json`):
  - Deleted legacy page module `frontend/javascript/pages/ranking.js` and stylesheet `frontend/css/ranking.css`.
  - Removed `#universitiesRankingPane` markup, `routeRanking`, and `isRankingPath` routing helpers.
  - Purged unused `ranking.*` localization keys while preserving `ranking.source_tooltip` and `ranking.source_status.*` for card tooltips.
  - Updated token and design-lint baselines.
- Updated Playwright E2E and unit test suites (`tests/e2e/smoke-home.spec.js`, `tests/e2e/universities-tabs-compare.spec.js`, `tests/e2e/mobile-tablet-overflow.spec.js`, `tests/unit/routes.test.mjs`):
  - Updated tab navigation tests to reflect Catalog and Comparing tabs.
  - Added test coverage for sorting by global rank, card ranking reordering, and verification tooltips.
- Resolved all 29 CodeQL security-extended and security-and-quality alerts across backend, frontend, dev server, and test suites:
  - Eliminated Path Injection vulnerabilities in frontend development server (`scripts/frontend_dev_server.py`) by replacing untrusted path resolution with a safe whitelist lookup against pre-indexed files from `build_file_index`.
  - Fixed redundant comparison in GPA score normalization (`backend/app/services/ai_scoring.py`).
  - Replaced broad `except Exception:` with specific `(ValueError, TypeError)` in language CEFR indexing (`backend/app/services/languages.py`).
  - Switched `assertTrue(a >= b)` to `assertGreaterEqual` for clearer test failure diagnostics (`backend/tests/test_ai_scoring.py`).
  - Removed unused imports and dead private global aliases (`backend/app/core/settings.py`, `backend/app/services/exams.py`, `backend/app/main.py`, `backend/app/routers/root.py`).
  - Cleaned up unused variables, dead functions, and imports across frontend components and test suites (`frontend/javascript/pages/universities.js`, `frontend/javascript/components/shell.js`, `frontend/javascript/components/profile-ui.js`, `frontend/javascript/university-detail-helpers.js`, `frontend/javascript/university-translations.js`, `frontend/javascript/utils/persistence.js`, `tests/unit/*.test.mjs`, `tests/e2e/*.spec.js`).

## 5.0.3 (2026-09-11) - Global Navbar Search, Unified Workspace Architecture, and Integrated Section Toolbar
- Integrated Ranking view with backend filtering and unified memory cache (`universities.js`, `ranking.js`, `tests/e2e/universities-tabs-compare.spec.js`):
  - Routed Ranking view queries through the FastAPI backend (`/universities?sort=rank_asc&limit=200&...`), respecting all active sidebar and navbar filters (`q`, `country`, `region`, `city`, `study_level`, `funding_type`, `min_tuition`, `max_tuition`, `only_saved`).
  - Replaced single-slot fetch cache with bounded `universitiesFetchCache` (Map with 50-entry LRU limit and 30s TTL) shared across Catalog, Ranking, and Compare modes.
  - Refactored `ranking.js` into modular exportable functions (`buildNormalizedRankingItems`, `renderRankingList`, `setRankingLoading`, `renderRankingError`), removing standalone full-payload client-side fetches.
  - Connected global search input, clear button, and empty state reset button to trigger debounced ranking refetches and reset all filters cleanly.
  - Added Playwright E2E regression coverage for ranking sidebar filter changes, debounced search updates, and empty state reset flows.
- Refined mobile filter drawer mechanics, view mode toggles, and Profile header UX (`index.html`, `profile.html`, `universities.js`, `style.css`, `02-catalog.css`, `04-catalog-responsive.css`, `05-catalog-polish.css`, `07-responsive.css`, `profile.css`):
  - Fixed layer ordering where the comparison tray overlapped the active mobile filter drawer by lowering `--z-tray` below `--z-drawer` (1400 vs 2000).
  - Extended mobile filter drawer scroll clearance with safe-area padding so bottom sorting controls and dropdowns remain fully accessible.
  - Automatically hidden the mobile floating filter toggle button while the filter drawer is open.
  - Removed redundant `#mobileFilterSummary` component, unused chip markup, and associated CSS/JS helpers from mobile viewports.
  - Resolved range slider thumbs bleeding through the sticky filter header by elevating header z-index to 10, extending it edge-to-edge with matching top-rounded corners, and clipping horizontal overflow.
  - Corrected vertical centering of List / Map view mode icons (`.view-btn`) by removing obsolete `min-height: 42px` and `padding: 8px 0` overrides.
  - Polished Profile mobile header layout with a dedicated action button group and responsive alignment down to 340px.
- Completed a two-stage accessibility and responsive UX refinement of the Universities workspace (`index.html`, `components.js`, `main.js`, `universities.js`, `tour-modals.js`, related CSS, localization, and E2E tests):
  - Persisted first-visit tour dismissal and added keyboard-safe focus trapping and restoration for the tour and UniFit warning dialogs.
  - Added a localized skip-to-main-content link and keyboard section switching with Arrow, Home, and End keys, plus explicit active-section semantics.
  - Clarified bachelor-only scope copy, corrected the page heading hierarchy, hid empty mobile filter summaries, and compacted the scope banner on viewports up to 760px while preserving a 44px dismiss target and aligned 12px gutters.
  - Consolidated scope styling into its owning stylesheet, removed conflicting responsive overrides, and replaced hardcoded color and negative slider offsets with semantic tokens and transform-based positioning.
  - Added regression coverage for heading hierarchy, persisted tour dismissal, modal focus behavior, keyboard navigation, mobile filter-summary visibility, centered search, and horizontal overflow.
- Reduced repository overhead without changing product behavior by removing unused preview assets, dead frontend helpers, redundant route and layout-cache layers, and duplicate transitive dependency declarations.
- Improved the University Costs tab (`university.html`, `university.css`, `render-sections.js`, localization files):
  - Reworked annual cost summaries and funding-option cards for clearer hierarchy, responsive layouts, and honest grant estimates.
  - Added distinct semantic surfaces for paid and grant options, with theme-aware fills and borders that remain visible in light and dark themes.
  - Localized the updated costs content consistently in English and Russian.
- Polished shared navigation and ranking states (`main.js`, `components.js`, `ranking.css`, `style.css`, `01-shell-controls.css`):
  - Added dedicated light/dark ranking tokens for gold and bronze positions.
  - Fixed hidden view-toggle rendering and footer separator placement, and applied translations after dynamic footer links are inserted.
- Refined the About page (`about.html`, `about.css`):
  - Removed redundant eyebrow labels and the introductory mission copy to focus the page on the team, project evidence, and contact details.
  - Promoted the team label to a section heading and standardized the page's card gutters and vertical spacing on the shared design-token scale.
- Integrated Global University Search into Navbar (`style.css`, `index.html`, `main.js`, `universities.js`, `ranking.js`, `icons.js`):
  - Moved university search from catalog content area directly into the central header navbar (`#universitySearch`, `#qInput`), treating university discovery as the core global search context.
  - Aligned search input centered independently of side controls using CSS Grid on desktop viewports (>980px); responsively wrapped below brand identity on viewports <=980px; compact alignment on narrow mobile <=340px.
  - Disabled browser-native WebKit search cancellation pseudo-element (`::-webkit-search-cancel-button`) to eliminate duplicate 'x' clear buttons, preserving a single accessible SVG action (`#searchClearBtn`).
  - Standardized search placeholder across Catalog, Ranking, and Compare modes to unified key `universities.search_placeholder` ("Search university..." / "Поиск университета...").
  - Connected responsive autocomplete suggestions dropdown (`.navbar-search-suggestions`) with full keyboard navigation and blur handling.
  - Automatically hidden search bar on configure and results comparison stages and informational pages (Guide, About, Profile, Legal).
- Unified Single-Page Application (SPA) Workspace (`index.html`, `main.js`, `routes.js`, `404.html`, `sitemap.xml`):
  - Merged legacy standalone `universities.html` into root `index.html`, establishing the university workspace as the primary application entrypoint (`data-page="universities"`).
  - Deprecated and removed legacy landing stylesheet `frontend/css/index.css` and redundant HTML templates.
  - Introduced section tab navigation (`.u-section-tabs`: Catalog, Ranking, Comparing) within unified layout grid `#universitiesWorkspaceLayout`.
  - Relocated secondary informational links (Guide, About Us) to footer product navigation (`addFooterProductLinks`).
- Unified Filter Sidebar across Catalog, Comparison, and Ranking:
  - Extended `#uSidebar` into a shared filtering column across Catalog, Comparing, and Ranking views.
  - Removed duplicate country dropdown from Ranking table toolbar, routing country filtering directly through sidebar `#countrySelect`.
  - Automatically hid Sort Strategy dropdown and UniFit AI balance sliders in Ranking mode (`body.universities-ranking-mode`), preserving rank-ordered integrity.
  - Synchronized filter reset button (`#resetFiltersBtn`) to clear active ranking filters in addition to catalog filters.
- Compact Section Navigation and Integrated Meta Toolbar (`index.html`, `01-shell-controls.css`, `05-catalog-polish.css`, `07-responsive.css`, `universities.js`, `ranking.js`):
  - Relocated university counter (`#totalCount`) and view mode toggles (`#viewToggles`: List / Map) into the section tab bar header (`.u-section-bar`), removing the empty toolbar row above catalog and comparison grids and recovering 64px of vertical viewport.
  - Scaled down view switcher controls from bulky 48px square buttons to a compact 32px segmented control (`34x32px`, 16px icons, 8px radius) conforming to Calm Academic Workspace guidelines.
  - Aligned section tabs, sliding indicator, and right-aligned meta controls flush to the common bottom border (`border-bottom: 1px solid var(--line)`), eliminating legacy margin-bottom offsets from responsive stylesheets.
  - Automatically hidden map view toggles when viewing Ranking mode while preserving right-aligned dynamic results count synchronized with active ranking search and country filters.
- Test Suite and Tooling Upgrades:
  - Updated E2E Playwright test suites (`smoke-home.spec.js`, `universities-tabs-compare.spec.js`, `custom-select-i18n.spec.js`, etc.) for SPA routing, navbar search centering, and unified tab switching.
  - Updated dev server and audit tooling (`scripts/frontend_dev_server.py`, `scripts/performance-audit.mjs`).

## 5.0.2 (2026-09-10) - Design System Scale Standardization, Layering & Radius Tokenization, and Automated Design Lint Guard
- Modularized university catalog stylesheet architecture (`universities.css`, `frontend/css/universities/`, `scripts/check-tokens.mjs`, `scripts/check-design-lint.mjs`):
  - Refactored monolithic `universities.css` into seven ordered modules (`01-shell-controls.css` through `07-responsive.css`) with architectural documentation (`README.md`).
  - Integrated trailing high-specificity rules directly into component declarations, eliminating the final override layer with `!important`.
  - Extended CSS token guard and design linter scripts with recursive file traversal to validate all nested CSS modules against zero-violation standards.
- Improved interaction reliability and accessibility across the frontend:
  - Added consistent pressed, disabled, loading, focus-visible, and reduced-motion states; custom selects now support keyboard navigation and WAI-ARIA combobox semantics.
  - Added inline localized validation feedback for profile name, budget, and GPA fields, including `aria-invalid`, `aria-describedby`, focus return, and alert announcements.
  - Added reset actions to empty catalog and ranking states, stable disabled pagination controls, guarded retry actions, and race-free ranking suggestions.
  - Isolated every hover effect to fine-pointer devices and reduced obsolete CSS priority overrides without changing Leaflet, hidden-state, or reduced-motion safeguards.
- Standardized typography and spatial grid scale across all 10 CSS files according to Calm Academic Workspace specifications (`style.css`, `universities.css`, `university.css`, `ranking.css`, `profile.css`, `guide.css`, `about.css`, `legal.css`, `error.css`, `index.css`):
  - 100% eliminated fractional font-size declarations (35 -> 0), converting all arbitrary fractions (`11.5px`, `13.5px`, `14.5px`, `15.5px`, etc.) to semantic design tokens.
  - 100% eliminated non-scale font-size declarations across the entire codebase (33 -> 0), mapping all legacy pixel values (`15px`, `17px`, `19px`, `22px`, `26px`, `9px`) to unified scale tokens (`--text-xs` through `--text-3xl`).
  - 100% eliminated layout compensation hacks and negative margins across all stylesheets, replacing negative breakout offsets with clean component-level ownership and natural spacing.
  - Achieved zero violations (0 violations) across ALL 10 stylesheets, completely clearing the baseline from 885 violations to 0 (100% resolution).
- Expanded automated Design Lint Guard tool (`scripts/check-design-lint.mjs`, `scripts/design-lint-baseline.json`, `npm run check:design-lint`):
  - Added strict validation for `z-index`: prohibited arbitrary magic numbers (420, 80, 60, etc.) in favor of semantic `--z-*` tokens and micro-layers `[-1, 0, 1, 2]`.
  - Added strict validation for `border-radius`: prohibited non-scale pixel values (`14px`, `18px`, `6px`) and `!important` on radii, enforcing the unified scale.
  - Configured `--strict` mode by default in `package.json` for `npm run check:design-lint` and integrated into `"test:all"`.
- Standardized Layering, Z-Index, and Radius Architecture:
  - Eliminated all 42 legacy arbitrary `z-index` declarations across stylesheets, adopting semantic tokens (`--z-nav`, `--z-dropdown`, `--z-docked-control`, `--z-drawer`, `--z-tray`, `--z-modal`, `--z-toast`).
  - Standardized border radii on `--radius-xs` (4px), `--radius-sm` (8px), `--radius-base` (10px), `--radius-md` (12px), `--radius-lg` (16px), and `--radius-xl` (20px).
  - Normalized padding, margin, and gap to the strict 4/8px spatial scale and eliminated `!important` hacks on spacing.
  - Updated Design System specification (`docs/design-system.md`) with Border-Radius System, Z-Index Layering tables, and migration matrices.
- Repaired CSS Syntax & Resolved Interactive Component Bugs (`universities.css`, `university.css`):
  - Fixed syntax errors and bracket balance issues identified during AST audit, restoring desktop controls and mobile media queries.
  - Resolved click interception between `.uni-card-actions` and `.uni-card-link-overlay`.
  - Fixed UniFit filter tooltips (`.u-tooltip`): restored initial hidden state (`opacity: 0; visibility: hidden;`) and hover/click disclosure behavior; added automated E2E test in `tests/e2e/universities-ai-sort-flow.spec.js`.
  - Fixed list/map view mode toggle (`.view-toggles` / `.view-btn`): restored `display: inline-flex` and `overflow: hidden`, eliminating button gap whitespace and preventing purple active/hover background bleed over rounded container bounds.
- Redesigned University Catalog & Comparison Toolbar Architecture (`universities.html`, `universities.css`, `universities.js`, `Localization/ru`, `Localization/eng`, `icons.js`):
  - Completely eliminated the nested-box ("окно в окошке") card anti-pattern around the search toolbar (`.u-top`), removing artificial borders, background surfaces, and box padding across desktop, tablet, and mobile viewports.
  - Lifted the results counter (`.u-top-meta` / `.u-found`) to the top edge of the catalog content column, aligning with the sidebar filters header and eliminating wasted vertical whitespace.
  - Consolidated the search bar (`.u-search`) and list/map view switcher (`.view-toggles`) into a single horizontal row (`.u-search-row`), saving 40-50px of vertical space and elevating university cards higher in the viewport.
  - Added an interactive search clear action (`#searchClearBtn`) using Heroicons `x-mark`, dynamically displaying when query text is present and clearing the search state with refocus on click.
  - Aligned all search row component heights, border-radii, and spacing to the strict 4/8px spatial scale and semantic tokens.

## 5.0.1 (2026-09-09) - University Detail Layout Refinements, Admission Track Polish, and Complete Zero-Hardcode CSS Tokens Refactor
- Completed full CSS design system refactoring and zero-hardcoded-colors milestone (`style.css`, `universities.css`, `university.css`, `ranking.css`, `profile.css`, `guide.css`, `about.css`, `legal.css`, `error.css`, `index.css`):
  - Eliminated all 596 hardcoded HEX, RGB, and HSL color literals across all 10 project stylesheets down to exactly 0 violations.
  - Centralized palette inheritance: removed hundreds of brittle `:root[data-theme="dark"]` duplicate component selectors in favor of clean, automatic token switching at the root level.
  - Standardized the brand accent token to the official logo purple `#5D17EB` across both light and dark themes, deriving all accent variants (`--accent-strong`, `--accent-soft`, `--accent-faint`, `--accent-panel`, `--line-accent`, `--selection-bg`) dynamically via native CSS `color-mix()`.
  - Updated `<meta name="theme-color" content="#5D17EB" />` across all 9 HTML templates for consistent mobile and browser chrome presentation.
  - Added automated Design Tokens Guard tool (`scripts/check-tokens.mjs`, `scripts/tokens-baseline.json`, `npm run check:tokens`) and strict enforcement check to GitHub Actions workflow (`.github/workflows/repository-hygiene.yml`) to permanently prevent color token regression.
- Polished university detail page layout across General and Admission tabs (`university.html`, `university.css`, `page-controller.js`, `render-content.js`, `render-sections.js`):
  - Streamlined hero card by removing duplicate acceptance rate badge beneath location line.
  - Eliminated excessive whitespace in the General tab (`#tab-general`) between "About & Campus" and "Overview" sections, introducing a clean divider border (`1px solid var(--line)`) and harmonized 20px spacing rhythm.
  - Redesigned admission category major tags to display as clean bold typography with subtle divider styling, replacing heavy boxed pill tags.
  - Reorganized funding option cards by placing the selection action and estimated cost notice into the top right header (`.admission-funding-option-side`), removing excessive 360px vertical whitespace.
  - Aligned evaluation status text along the left X-axis with chance factor headings and score indicators.
  - Added visual divider between average and minimum score requirement categories in admission requirement profiles.
- Expanded localization and translations for admission tracks and major tags (`universities_translations.json`, `Localization/eng`, `Localization/ru`, `university-translations.js`, `_shared.js`, `university-detail-helpers.js`, `universities.py`).
- Added automated layout and spacing invariant tests for university detail cards in Playwright suite (`tests/e2e/university-track-majors.spec.js`).
- Refactored About page layout architecture to Calm Academic Workspace specifications (`about.html`, `about.css`):
  - Flattened nested container structure (`.about-shell` and `.about-shell-section`) into clean top-level semantic sections conforming to the `guide.css` and `legal.css` architectural pattern.
  - Redesigned Hero section with semantic eyebrow (`.about-eyebrow`), title (`.about-title`), and lead description (`.about-lead`).
  - Standardized cards (`.about-proof-card`, `.about-contact-card`, `.team-card`) with unified `var(--radius-lg)`, `var(--surface-solid)`, and `1px solid var(--line)` without artificial box shadows.
  - Added focus-visible accessibility outlines (`outline: 2px solid var(--accent); outline-offset: 2px;`) and smooth accent transitions on interactive links.
  - Refined responsive layout for tablet (<=980px), mobile (<=640px), and narrow viewports (<=480px) with adaptive typography and padding scale.
  - Added subtle entry motion (`motion-fade-lift-soft`) with staggered section delays and `prefers-reduced-motion: reduce` fallback.


## 5.0.0 (2026-09-08) - Calm Academic Workspace, Applicant Profile, and Architecture Modularization
- Implemented global sticky-footer architecture and resolved top-docked footer regressions (`style.css`, `universities.css`, `university.css`, `index.css`, `error.css`, `footer-sticky.spec.js`):
  - Configured full-height column flex context on `html` (`height: 100%`) and `body` (`min-height: 100%; min-height: 100dvh; display: flex; flex-direction: column;`), unlocking true sticky footer behavior via `margin-top: auto` on `.site-footer` across all 9 site pages.
  - Set `flex: 1 0 auto` and `width: 100%` on semantic `<main>`, ensuring content areas expand to claim available viewport height on short pages (e.g. `about.html`, `404.html`, empty search states) without floating the footer mid-screen.
  - Removed obsolete and rigid `min-height: calc(100vh - 70px)` workarounds from `.u-page` and `.d-page`, eliminating phantom 60px overscroll on pages with compact content.
  - Added comprehensive automated E2E test suite (`tests/e2e/footer-sticky.spec.js`) verifying bottom alignment on high-resolution viewports (1440x1080) and zero-content edge cases with 0px deviation.
- Overhauled navigation scrollspy, catalog pagination UI, and track slider calibration (`guide.js`, `legal.js`, `universities.js`, `universities.css`, `icons.js`, `scrollspy.test.mjs`):
  - Replaced error-prone height-and-distance scrollspy scoring with a deterministic top-anchor sequential probe relative to the sticky navbar, ensuring short intermediate sections are never skipped during scrolling.
  - Added programmatic scroll guards (`startProgrammaticScroll`, `stopProgrammaticScroll`) to prevent scroll listeners from fighting anchor and hash clicks.
  - Implemented automatic horizontal scroll centering (`scrollGuideNavIntoView`) for sticky subnavigation on mobile devices (<= 980px).
  - Added dedicated unit test suite (`tests/unit/scrollspy.test.mjs`) proving non-skipping section traversal and verifying regression against the legacy formula.
  - Redesigned catalog pagination controls with official Heroicons (`chevron-double-left`, `chevron-left`, `chevron-right`, `chevron-double-right`), `.page-btn__text` wrapper, and modernized 12px border radius.
  - Calibrated dual-range slider thumb position offset calculation (`fillTrack`), eliminating visual misalignment between 18px slider thumbs and highlighted track gradient bounds.
  - Added `chevron-right` icon definition in `icons.js`.
- Standardized site-wide footer metadata layout and streamlined home hero metrics (`index.html`, `index.css`, `style.css`, `legal.css`, all HTML templates):
  - Streamlined home page hero facts into a focused 2-column strip (universities and countries), removing redundant bachelor's mode badge and optimizing narrow mobile displays down to 340px.
  - Unified footer copyright and legal navigation across all pages (`index.html`, `about.html`, `universities.html`, `university.html`, `profile.html`, `guide.html`, `terms.html`, `privacy.html`, `404.html`) with `.footer-copy` and centered dot dividers.
  - Refined custom select triggers and navbar control buttons with SVG mask chevrons and coherent accent hover states.
- Codified Zero-Vibe Engineering Protocol in `AGENTS.md`:
  - Added section 8 establishing strict architectural engineering standards: root-cause analysis over band-aid fixes, prohibition of silent failures and zombie code, mandatory 4 UI states (Loading, Empty, Error, Disabled), and schema contract enforcement.
- Fixed CI and E2E test suite regressions from dual-scale GPA and score profile update (`university-detail-helpers.js`, `universities.css`, `universities-tabs-compare.spec.js`, `motion-interactions.spec.js`, `i18n-pages-smoke.spec.js`):
  - Ensured `.chance-percent-wrap` container is preserved in `renderUniChanceSummary` when applicant profile has missing evidence (`chanceRaw === null`), and kept localized active choice title.
  - Added explicit `z-index: 2` on `.u-recent__remove` to prevent chip link from intercepting click events, and added hover state before click in motion E2E test.
  - Updated comparison E2E tests to expect 4.0 canonical GPA values (`3.92` / `3.68`), decomposed Imperial College London track key (`imperial_sat`), and updated Russian abbreviation for SDU («СДУ»).
- Implemented dual-scale GPA (4.0 Intl / 5.0 KZ & CIS), calibrated AI scoring, and added official UNT score profiles (`profile.html`, `profile-ui.js`, `profile.css`, `ai_scoring.py`, `ml_scoring.py`, `universities.json`, `universities_translations.json`, `compare-specs.js`, `compare-helpers.js`, `university-detail-helpers.js`):
  - Overhauled GPA input across frontend and backend from legacy percentages (0–100%) to dual-scale grading: canonical 4.0 international scale (US, NIS standard) and 5.0 certificate scale (Kazakhstan and CIS), with interactive scale selector buttons (`#gpaScale4Btn`, `#gpaScale5Btn`), localized placeholders (`3.80` vs `4.75`), and units (`/ 4.0` vs `/ 5.0`).
  - Added robust GPA normalization in `persistence.js` and `ai_scoring.py` (`_normalize_gpa_score`), converting 5.0-scale GPAs to canonical 4.0 for API payloads and scoring while rejecting legacy percentage inputs (> 5.0).
  - Updated API schema validation in `payloads.py` and `exams.json` to enforce `gpa <= 5.0`, supporting optional `gpa_scale` field with validator aliases and float precision (0.01 step).
  - Enriched AI sorting and ML matching in `ai_scoring.py` and `ml_scoring.py`: incorporated `budget_vs_prestige` delta into preference mismatch, increased semantic similarity penalty weight to 0.35, added major penalty for low-relevance queries, and rescaled multilingual-e5 embeddings to expand contrast above baseline background noise.
  - Introduced `holistic_review_selectivity` factor with bilingual localization for highly selective universities (<10% acceptance rate), highlighting that standardized scores serve as a screening baseline while admissions depend on olympiads, essays, and extracurriculars.
  - Normalized GPA requirements across all 50 universities in `universities.json` to canonical 4.0 float values.
  - Decomposed international university admission tracks into explicit curriculum pathways with dedicated scholarships for Imperial College London (`_a_level`, `_ib`, `_sat`), University of Melbourne, University of Toronto, and University of Tokyo (PEAK).
  - Enriched all 12 Kazakhstani universities (KBTU, AITU, IITU, SDU, KazNU, ENU, Satbayev, KazNMU, AMU, Abai KazNPU, KIMEP, Narxoz) with verified UNT/ENT `score_profile` distributions (p25, median, p75) and calibrated minimum scores to activate the official score profile chance model.
  - Updated comparison specifications and university detail views (`compare-specs.js`, `compare-helpers.js`, `university-detail-helpers.js`) to format GPA and exam thresholds using `formatExamValue` with scale indicators.
  - Added comprehensive automated test suites (`test_intl_scoring_calibration.py`, `test_kazakhstan_unt_scoring.py`) and updated existing unit and E2E regression tests.
- Modernized page transitions and hardware-accelerated skeleton loading (`main.js`, `universities.js`, `style.css`, `universities.css`, `university.css`, `universities.html`):
  - Upgraded skeleton shimmer animation from CPU `background-position` to GPU-accelerated `transform: translate3d` via pseudo-elements with `will-change: transform`, eliminating render paint cycles and mobile frame drops.
  - Implemented anti-flicker delay (120ms) and `.u-catalog-stage` grid container with smooth fade-out (160ms) to prevent layout shifts (CLS = 0) and remove skeleton flashing on fast queries.
  - Integrated native View Transitions API (`document.startViewTransition`) with fixed navbar isolation, graceful `.page-exit` fallback, stylesheet load gating to prevent FOUC, and hover prefetching for instant page navigation.
- Fixed frontend initialization runtime ReferenceErrors and enforced uniform white background for university logos:
  - Restored missing imports and exports across `components.js`, `main.js`, `runtime.js`, `utils.js`, `universities.js`, and `_shared.js` (`setupSlidingIndicator`, `initCustomSelect`, `initLanguagesPanel`, `translateUnknownWord`, `routeGuide`, `$`, `moneyUSD`, `escapeHtmlAttr`, `tFormat`, `translateTemplate`, `PROFILE_RETURN_URL_KEY`), preventing startup exceptions from falsely triggering the offline/no-connection screen.
  - Enforced a uniform `#ffffff` background and high-contrast `#0f172a` fallback text for university logos and emblems across all themes, including dark mode, across catalog cards, ranking rows, detail view, comparison tables/cards/trays, and map result items (`universities.css`, `ranking.css`, `university.css`).
- Modularized large monolithic files and eliminated dead code across frontend and backend (`universities.js`, `universities.py`, `profile-ui.js`, `compare-specs.js`, `university_tracks.py`):
  - Decomposed `frontend/javascript/pages/universities.js` (-1,690 lines) by extracting tour/warning modals (`tour-modals.js`), comparison metrics and specifications (`compare-specs.js`), and choice helpers (`compare-helpers.js`).
  - Modularized `frontend/javascript/components/profile-ui.js` (-590 lines) by extracting exam breakdown parsing, subject combos, and special exam inputs into `profile/exam-breakdowns.js`.
  - Refactored `backend/app/services/universities.py` (-668 lines) by extracting admission track extraction, canonical major resolution, score profiles, and grant derivation into `university_tracks.py`.
  - Pruned dead code and unused helpers across `search.py` (`score_query`), `ai_scoring.py` (`_mode_value_from_map`, `_normalize_cost_key`), `university-detail-helpers.js`, and `universities.js`.
- Hardened legal compliance, transparency, and Safe Harbor notices (`LICENSE`, `THIRD_PARTY_NOTICES.md`, `privacy.html`, `terms.html`, `docs/forking-and-reuse.md`, `backend/data/university_assets/README.md`, `Localization/eng`, `Localization/ru`):
  - Updated operator disclosures to identify project creators (high school students Shabdaluly Mukhammed and Rashidov Yerbolat from Zhanaozen BIL, Kazakhstan) and contact email (`unisearch@inbox.ru`).
  - Explicitly excluded university trademarks, logos, and campus thumbnail photographs from the project's root MIT License, scoping the open-source software license strictly to original codebase and assets.
  - Formally established a Nominative Fair Use and Educational Media policy for university emblems and campus imagery in `THIRD_PARTY_NOTICES.md` and `backend/data/university_assets/README.md`.
  - Expanded the active Notice & Takedown procedure in terms of use and localization dictionaries to protect photographers and copyright holders, guaranteeing a 48-hour response window for attribution credit, adjustments, or removal requests.
  - Formally differentiated current local-first storage from future roadmap items by marking Google Sign-In as in-development.
  - Added full disclosure for third-party interactive map resources (OpenStreetMap tile requests and unpkg Leaflet CDN).
  - Added fork compliance guidelines in `docs/forking-and-reuse.md` regarding third-party institutional media assets.
- Enhanced API security, error resilience, and DDoS defense (`backend/app/core/security.py`, `backend/app/core/settings.py`, `backend/app/main.py`, `backend/app/routers/universities.py`, `backend/app/services/text_translation.py`, `backend/tests/test_api_ddos_hardening.py`, `deploy/nginx/unisearch.conf`):
  - Introduced `DOCS_ENABLED` setting to automatically hide interactive documentation (`/docs`, `/redoc`, `/openapi.json`) in production environments while keeping it active during local development.
  - Implemented centralized JSON 500 error handling in FastAPI middleware and exception handlers, ensuring unexpected internal errors return structured JSON (`{"detail": "Internal server error"}`) with security headers and `X-Request-Id` instead of plain text, eliminating frontend JSON parse crashes.
  - Added proxy-aware client IP resolution in `request_client_ip()` with explicit private network matching (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, loopback), prioritizing `CF-Connecting-IP` and `X-Forwarded-For` behind Render and Cloudflare proxies while safely ignoring spoofed headers from direct public connections.
  - Optimized in-memory `SlidingWindowRateLimiter` with `collections.OrderedDict` for O(1) key eviction on saturation, eliminating lock contention and CPU bottlenecks during distributed botnet floods.
  - Added `/universities/compare-profiles` to `_EXPENSIVE_POST_PATHS` (120 req/min rate limit) and implemented two-tier caching (Redis + in-memory LRU) with `X-Compare-Cache` headers to prevent repeated heavy batch evaluations.
  - Hardened AI-sort cache against cache thrashing attacks by expanding capacity to 512 entries, normalizing query text, and enabling Redis caching across all valid `/universities` catalog limits.
  - Integrated Circuit Breaker pattern in `text_translation.py` to immediately fail open on external translation outages and avoid thread pool exhaustion.
  - Enforced query string length guard rejecting requests exceeding 4096 bytes with HTTP 414 URI Too Long.
  - Added reference Nginx configuration template (`deploy/nginx/unisearch.conf`) with Slowloris protection, connection concurrency limits, and static asset caching.
- Implemented comprehensive SEO, indexing rules, and rich social preview cards (`robots.txt`, `sitemap.xml`, HTML templates, `frontend/images/`):
  - Added `frontend/robots.txt` disallowing internal paths (`/api/`, `/ops/`) and referencing the sitemap.
  - Added `frontend/sitemap.xml` defining priority rankings and change frequencies for all public routes.
  - Integrated high-resolution Open Graph (`og:*`) and Twitter Card (`summary_large_image`) meta tags, theme color (`#5715db`), and descriptive summaries across all HTML pages, backed by official preview cards (`unisearch-preview.png`). Added `noindex` protection to `404.html`.
- Cleaned up unimported orphan files from `frontend/javascript/pages/universities/`:
  - Removed 8 abandoned modular catalog files (`catalog-api.js`, `catalog-events.js`, `catalog-map.js`, `catalog-recent.js`, `catalog-render.js`, `catalog-state.js`, `catalog-states.js`, `catalog-tours.js`).
  - Validated and retained `compare-helpers.js`, which is actively utilized by comparison logic and unit tests.
- Expanded automated test coverage and CI reliability (`.github/workflows/tests.yml`, `backend/tests/`, `tests/unit/`, `tests/e2e/`):
  - Switched workflow dependency installation from `npm install` to deterministic `npm ci`.
  - Added 4 new modular frontend unit test suites (`tests/unit/locale.test.mjs`, `tests/unit/persistence.test.mjs`, `tests/unit/routes.test.mjs`, `tests/unit/runtime.test.mjs`).
  - Added backend contract and admissions unit tests for batch profile comparison and track-level funding option overrides (`test_admission_funding_options.py`, `test_universities_endpoints_contract.py`).
  - Hardened E2E test suites with resilient assertions and mocked AI sorting (`unichance-calculator-validation.spec.js`, `unifit-full-flow.spec.js`, `unifit-sliders-interaction.spec.js`, `universities-filter-i18n.spec.js`), removing brittle sleep delays.
- Standardized theme color palette and interactive accents (`style.css`, `universities.css`, `university.css`, `guide.css`, `legal.css`, `ranking.css`):
  - Eliminated unpredictable purple text styling and hardcoded dark/white text shades across titles, metric cards, pricing headers, and admission summaries by anchoring typography strictly to semantic tokens (`var(--text)` and `var(--text-muted)`).
  - Removed disruptive `:root:not([data-theme="dark"])` selector wrappers that stripped active tabs, scope indicators, interactive button hovers, and progress indicators when switching to dark mode, ensuring accent states (`var(--accent)`, `var(--line-accent)`, `var(--accent-panel)`) remain visually consistent across both light and dark themes.
  - Unified university detail section tabs into clean, transparent underline-tabs with an animated accent indicator in both themes, eliminating legacy solid purple pill buttons and glow shadows in dark mode.
  - Standardized `.center-loading-spinner`, info tooltips (`.u-info`, `.d-info`), navigation links, and back buttons with theme-resilient borders and hover states.
- Standardized design system tokens, refined catalog card density, and decluttered university detail view (`docs/design-system.md`, `style.css`, `universities.css`, `university.css`, `ranking.css`, `index.css`, `guide.css`, `legal.css`, `profile.css`, `error.css`, `university.html`, `index.html`, `catalog-render.js`, `page-controller.js`):
  - **Design tokens & borders:** formalized line tokens (`--line-accent`, `--line-grant`, `--line-warning`, `--line-danger`) and unified radius scale (`--radius-xs` to `--radius-circle`) in `docs/design-system.md` and `style.css`, replacing arbitrary inline radii and color literals across all stylesheets.
  - **Calm backgrounds:** eliminated synthetic vertical page gradients on body and main containers across home, about, guide, ranking, legal, and universities views in favor of solid `var(--bg)` and flat surface tokens per Calm Academic Workspace guidelines.
  - **Home hero typography:** removed artificial `.text-gradient` purple styling from the hero title in `index.html` and localization dictionaries (`Localization/eng`, `Localization/ru`).
  - **Catalog card density & skeletons:** added dynamic `.uni-card--compact` and `.uni-card--has-fit` classes with conditional separator rendering, reducing min-height from 388px to 304px for cards without fit badges to prevent empty whitespace, and aligned skeleton loading heights accordingly.
  - **University detail decluttering:** removed duplicate `#detailCompareBtn` from the university detail header to consolidate comparison actions into the catalog tray workflow, flattened `.d-card` and tab content wrappers by eliminating redundant nested card borders/radii, and removed multi-layer dark mode gradients on program and admission cards.
  - **Ranking view polish:** stripped heavy gradient overlays and glowing pseudo-elements from top podium cards (`.rank-1`, `.rank-2`, `.rank-3`), retaining clean accent borders.
- Synchronized university card and admission requirements styling on comparison configuration view with the university detail page (`style.css`, `university.css`, `universities.css`, `universities.js`):
  - Hoisted admission track requirements and score preview styles (`.track-stats-box`, `.track-stats-box--min`, `.track-stats-box--avg`, `.track-exam-group`, `.track-lang-rules`, `.track-cost-preview`, `.track-select-row`) into shared `style.css` so thresholds and exam criteria render with full visual fidelity on `universities.html?tab=compare&compare=configure`.
  - Refined additional requirements and funding difference lists (`.track-extra-req`, `.admission-funding-diff-list`) with custom accent dot bullets (`::before`), subtle border dividers, and calibrated 4/8px spacing across both comparison and university detail pages.
  - Added full university identity block (slot index, official logo, full university name, location, and selection status) to comparison column headers.
- Overhauled university comparison UI and workflow according to Calm Academic Workspace guidelines (`universities.js`, `universities.css`, `university.html`, `compare-helpers.js`, `_shared.js`, `university-translations.js`):
  - **Overview category verdicts:** replaced arbitrary 0-100 progress bars with clean category cards displaying explicit lead and parity badges, concrete metric-backed reasons with position deltas (e.g. rank position difference comparing both universities and annual tuition deltas), and participant status rows.
  - **Detail page compare action:** added an interactive compare button (`#detailCompareBtn`) in the university detail header with two-way selection sync across pages.
  - **Results enhancements:** introduced a compact 'Differences only' toggle switch to filter identical metrics, highlighted optimal values with `.compare-cell--best`, and integrated inline admission track selectors directly in comparison result cards.
  - **Table usability & mobile responsiveness:** implemented sticky headers and sticky metric columns with clean borders, strictly aligned margins and padding to the 4/8px grid, and adapted layout seamlessly for screens <=768px.
  - **Data clarity and localization:** resolved raw technical IDs in bachelor program listings into deduplicated localized program titles, localized dataset provenances and UK admission requirements, and calibrated comparative advantage badges into comparative degree forms.
- Completed root-cause grant modeling migration from legacy boolean flags (`finance.financial_aid`) to dynamic track-based funding options (`funding_type === "grant"`): added real verified grant tracks and bilingual translations across 10 international universities (Oxford, Cambridge, UNSW, USyd, McGill, ANU, Edinburgh, Manchester, UBC, Waterloo) alongside Kazakhstani universities, updated university detail page to dynamically render available grants via `getGrantsFromCategories()` with clean empty states, updated the comparison view (`compare-helpers.js`, `universities.js`) to render localized names of available grants instead of flat placeholders and score aid by grant track count (`compareAidScore`), resolved catalog card badge evaluation (`catalog-render.js`, `universities.js`), and refined AI scoring in `ai_scoring.py` to calculate post-grant pricing by deducting tuition coverage from total costs and evaluate dynamic grant potential directly from student fit.
- Fixed profile data reset button and modal workflow (`profile.html`, `profile-ui.js`, `persistence.js`, `shell.js`, `languages.js`): moved confirmation modals `#profileResetModal` and `#profileUnsavedModal` inside `<main id="profilePage">` to preserve them across client-side router navigation, added `clearProfile()` to purge `unisearch_profile` from `localStorage`, wired `profileUpdated` event listeners to immediately clear the languages panel and re-sync custom selects on reset, and fixed empty score strings coercing to `0` in `clampWithConfig`.
- Added smooth enter and fly-out exit animations for toast notifications (`style.css`, `format.js`, `format.test.mjs`): toasts slide in from the right edge on appearance and smoothly fly off-screen to the right upon dismissal or auto-timeout before clean DOM removal with a 1s safety fallback.
- Fixed profile layout inconsistencies: aligned 'User' label visually with the edit button, removed redundant subtitle text from the hero block, disabled manual resizing for textareas, prevented the budget card from vertical stretching, fixed the 'Select Exam' form inputs shrinking to the right by using `align-items: stretch`, and eliminated the massive blank space below empty exam forms by hiding the empty error container (`profile.css`, `style.css`, `profile.html`).
- Added dedicated Applicant Profile page (`profile.html`, `profile.css`, `profile.js`) with responsive card layout, sticky toolbar, Heroicons action buttons, completion progress indicator, and client routing (`/profile`), refactoring profile modal markup out of global layout.
- Fixed scroll jumping and offset on university catalog reload (`universities.html`, `universities.css`, `universities.js`, `main.js`): switched to manual scroll restoration to prevent premature coordinate clamping before API cards load, suppressed skeleton layout shifts with `overflow-anchor: none` and early scope-notice class application, and implemented exact scroll coordinate persistence in session storage.
- Restored ranking card university thumbnail backgrounds with subtle theme-aware overlay gradients and enhanced gold, silver, and bronze podium card backdrops (`ranking.css`).
- Streamlined ranking tab layout and header density (`universities.html`, `ranking.css`): removed redundant subtitle and source note copy, reduced heading size to a calm academic scale (`clamp(20px, 2.2vw, 26px)`), integrated the title directly above the search input in the toolbar grid (`row-gap: 8px`) aligned with the country filter, and eliminated excess container padding to pull the interface closer to the mode navigation tabs.
- Switched theme toggling to instantaneous transitions: removed `.theme-animating` transition block from `style.css` and suppressed lingering color transitions during theme switches in `theme.js` to eliminate desynchronized color animation delay and reduce client rendering overhead.
- Overhauled `about.html` and `about.css` following Calm Academic Workspace and Apple-inspired density: expanded canvas to `1440px`, removed bloated hero headers in favor of a concise mission headline as H1, eliminated stacked gap duplication, tightened line-heights on wrapped text, and aligned card geometry to 12-16px radii.
- Redesigned home page (`index.html`, `index.css`): replaced single flat wrapper card with an open two-section layout — centered hero with enlarged title (`clamp(34px, 5vw, 52px)`), centered metric strip, and a separate features section with Heroicons (`funnel`, `banknotes`, `sparkles`) in accent-tinted icon wells; secondary button contrast corrected (`surface-solid` background); all responsive breakpoints (980px, 640px, 380px) updated accordingly; no new i18n keys added.
- Overhauled 404 error page (`404.html`, `error.css`) and expanded responsive test suite: restructured into a focused hero section and a symmetrical two-column grid with equal-height cards for quick recovery tips and popular section navigation with Heroicons; added initial site loader and dark mode/reduced motion support; added `error-404-density.spec.js` E2E suite across 5 viewports (375px to 2560px) and updated home responsive overflow checks in `smoke-home.spec.js`.
- Added dedicated Privacy Policy (`privacy.html`) and Terms of Use (`terms.html`) pages with full English and Russian localization (`Localization/eng`, `Localization/ru`), adhering to Calm Academic Workspace reading guidelines.
- Implemented modular legal stylesheets and client controller (`legal.css`, `legal.js`): sticky sidebar table of contents, scroll-spy with reading viewport intersection, top/bottom edge snapping, smooth scrolling, mobile horizontal navigation ribbon, callout banners, and dark mode styling.
- Integrated legal navigation links (`Privacy Policy`, `Terms of Use`) into `.site-footer` across all HTML templates (`404.html`, `about.html`, `guide.html`, `index.html`, `universities.html`, `university.html`) with responsive `.footer-meta` layout (`style.css`).
- Registered `/privacy` and `/terms` routes in client router (`routes.js`, `main.js`), bypassing client-side route interception for in-page anchors (`.legal-nav`, `.guide-nav`) and exempting static informational pages (`privacy`, `terms`, `about`, `error-404`) from backend connection error overlays.
- Improved scroll-spy boundary handling in `guide.js` to snap to top section when `scrollY <= 90px` and bottom section near page end.
- Added pretty routing and dynamic indexed file lookup fallback to `frontend_dev_server.py`.
- Consolidated base theme variables and design tokens (`--bg`, `--surface-solid`, `--surface-soft`, `--line`, `--grant-soft`) in `style.css` and removed redundant override blocks across stylesheets.
- Overhauled `guide.css` and `guide.html` typography and density following Calm Academic Workspace patterns, cleaning up hero header hierarchy and localization keys.
- Fixed guide section navigation in `guide.js` to scroll to top for `#guide-unifit` to preserve hero visibility, with manual scroll restoration on initial page load.
- Redesigned ranking podium cards (`.rank-1`, `.rank-2`, `.rank-3`) in `ranking.css` with distinct gold, silver, and bronze ambient borders and gradient backdrops.
- Polished catalog and comparison surfaces (`universities.css`, `university.css`, `about.css`), refining active compare buttons, selected card states, and grant track treatments.
- Cleaned up redundant code, ghost selectors, and dead CSS classes across all stylesheets (`about.css`, `error.css`, `guide.css`, `index.css`, `ranking.css`, `style.css`, `universities.css`, `university.css`), removing over 3,700 lines of unused styles and duplicate override passes while strictly maintaining responsiveness and design system fidelity.
- Cleaned up obsolete repository artifacts: pruned legacy ranking redirect stub (`frontend/ranking.html`), legacy one-off data research fragments and trackers (`docs/data_research/`), one-time sprint audit notes, unused prototype images, synthetic unit tests, and deprecated one-off database enrichment scripts.

## 4.9.10 (2026-09-02) - Dependency Updates and CI Toolchain Upgrades
- Upgraded GitHub Actions workflows to `@v7` (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`) across all workflows (PR #58).
- Updated backend production and development dependencies (`fastapi 0.139.0`, `starlette 1.3.1`, `uvicorn 0.50.0`, `typing-extensions 4.16.0`, `scikit-learn 1.9.0`, `torch 2.12.1+cpu`, `sentence-transformers 5.6.0`, `redis 8.0.1`, `prometheus-fastapi-instrumentator 8.0.2`, `sentry-sdk 2.64.0`, `Pillow 12.3.0`) (PR #56).
- Upgraded test suite runner `@playwright/test` to `1.61.0` (PR #52).

## 4.9.9 (2026-06-19) - Compare Admission and Badges Rework
- Reworked the university comparison view to allow selecting admission choices directly within the comparison interface, supporting a new compact mode.
- Unified and centered all project badges (UniChance, Low confidence, Paid, etc.) across the site, applying consistent borders and clean theme variables.
- Refactored `renderAdmissionSection` to handle inline choice selection without side-effects on university detail storage.
- Restored admitted score context and funding-specific requirements in comparison table rows.

## 4.9.8 (2026-06-18)
- Added new calibration unit tests for UniChance admission scoring logic (`test_persona_scoring_calibration.py`) using 6 diverse student personas (Alexey, Maria, Dias, Adil, Lisa, and Anonymous) mapped against real-world university data (MIT, TUM, Nazarbayev University) to ensure scoring and eligibility calculations remain accurate and stable.

## 4.9.7 (2026-06-18) - Merge updates for performance and docs
- Merged PR #50: `perf: hoist localized university names loading out of metadata building loop` to improve performance by loading translations once.
- Merged PR #51: `docs: clarify intentional card alignment in finance grid` to clarify CSS intent for finance cards.
## 4.9.6 (2026-06-18) - Performance, Security, and Testing Improvements
- Added unit tests for `safe-storage.js` to ensure reliable storage functionality (PR #49).
- Fixed an XSS vulnerability in suggestion rendering by replacing unescaped `innerHTML` with secure DOM APIs (PR #48).
- Optimized university metadata building by hoisting translation loading out of the per-university loop to improve performance (PR #47).
## 4.9.5 (2026-06-18) - Compare Bar Persistent Visibility and Typography Hotfix
- Fixed persistent visibility of the floating comparison bar (`compare-tray`) by hiding and clearing it when navigating away from the universities catalog page through the client router.
- Cleaned up comparison bar typography and reduced heavy font-weight settings (800) to semibold (600) for text-helpers and action buttons.
- Replaced the `<strong>` element with `<span>` in the comparison slot name markup to prevent browser-default double bolding of university names.

## 4.9.4 (2026-06-18) - University Detail Grant and Funding Differences Layout
- Fixed dark-mode grant option and estimated cost styling by replacing hardcoded, muddy black-green gradients and background colors with proper system variables (`--grant-soft` and `--grant-soft-strong`).
- Added soft green backgrounds to grant options in both light and dark themes to make them visually distinct and high-contrast, ensuring selected grant states remain clean and brand-consistent.
- Resolved confusion around the "Funding-specific differences" (Отличия финансирования) section by separating CSS rules for the kicker and sub-pane titles, changing the section title to standard Sentence case and a normal weight to establish a clear visual hierarchy.
- Optimized typography hierarchy across the workspace by reducing excessively heavy font-weights (800 and 900) to semibold (600), medium (500), or standard bold (700) across all stylesheets (`style.css`, `index.css`, `about.css`, `guide.css`, `error.css`, `ranking.css`, `universities.css`, `university.css`) to align with Calm Academic Workspace standards.

## 4.9.3 (2026-06-18) - Hover and Interactive Styles Consolidation
- Fixed a CSS syntax bug (unmatched closing bracket) at the end of `universities.css`.
- Replaced basic purple fills and flat hover styling for normal and compared/selected university cards (`.uni-card`) with consolidated, height-stable transition rules.
- Designed premium hover states for normal cards using subtle accent mixes to background (`var(--surface-soft)`) and border colors.
- Built interactive states for compared cards (`.compare-uni-card`), highlighting detail links (`.compare-uni-card__link`) on hover.
- Created responsive hover transitions for map-result cards (`.u-map-result-card`) across normal, active, and selected states.
- Restored university thumbnail background images on ranking cards with appropriate theme-specific opacity and gradient overlays.
- Aligned dark-mode university catalog cards with shared surface tokens so list cards no longer appear warmer than the surrounding workspace panels.
- Optimized font-weight hierarchy across the project to align with Calm Academic Workspace standards by reducing excessively heavy font-weights (800/900) to semibold (600) or medium (500) for university cards, comparisons, and profile elements.
- Swapped the non-standard country filter input in ranking views with a standard dropdown layout using `globe-alt` and `.u-select`.
- Maintained deliberate bold hierarchy (700) only for main H1 titles, textual placeholders, and remove actions to keep UI structured but calm.
- Removed the legacy comparison modal (`openCompareModal`, `closeCompareModal`) and completely integrated the comparison configuration and results layouts into the inline workspace view (`#compareResultsPane`).
- Standardized the comparison UI components (configure columns, result headers, trait cards) to use flat `var(--card)` surfaces with `var(--line)` borders and uniform `10px` border radii, removing heavy, outdated drop shadows.
- Fixed Y-axis alignment in the comparison configuration header so that the UniChance badge, funding track label, and recommendation status align perfectly on the same horizontal center.
- Expanded the "Additional Requirements" (ДОП. ТРЕБОВАНИЯ) block in the comparison view to display the complete list of requirements instead of truncating them with a `+N` count.
- Performed extensive font-weight optimizations in the Comparison component, reducing remaining heavy font weights (ranging from `950`, `900`, `850`, `800`, to `750`) down to `600` (semibold) or `500` (medium) for config columns, cost previews, stat boxes, option titles, and traits.
- Normalized the height, padding, line-height, and vertical alignment of the UniChance badge (`.chance-track-chip`, `.compare-track-chance`) on both the university details page and the comparison page to ensure perfect visual consistency with neighboring badges.

## 4.9.2 (2026-06-18) - Guide Scroll and Workspace Navigation Fixes
- Fixed guide page scroll restoration and active section sync by updating the URL hash on scroll and forcing viewport alignment to the active section hash after dynamic configuration loads.
- Centralized the "Bachelor's only" notice dismissal on the university detail page, aligning it with the main catalog view and storing the dismissed state in local storage.
- Saved and restored the last active university list tab (Catalog / Comparing / Map) across page reloads and back-navigation through saved filter state.
- Added a full-project release archive alongside the frontend and backend deploy archives, and updated release notes to explain which asset to download.
- Rebuilt release archive generation around tracked Git contents and included `package.json` in the backend archive so runtime version metadata stays available.

## 4.9.1 (2026-06-17)
- Aligned university detail action buttons so Back to list, save, compare, and share sit as one consistent control group with Back to list on the right.
- Matched map-result cards to list cards by using the muted View details link style with an arrow indicator.
- Fixed map result logos and map markers so full university logos render without horizontal cropping.
- Rounded the map-results horizontal scrollbar to match the surrounding panel radius.
- Fixed recently viewed chips so the pill width stays stable while only the inner text area shrinks when the remove button appears.
- Synchronized runtime/package version to `4.9.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.9.0 (2026-06-17)
- Rebuilt the frontend motion system around shared duration, easing, page, panel, sheet, list, icon, state, and skeleton motion contracts.
- Centralized repeated CSS keyframes and motion classes in the global style layer while reducing page-specific animation duplication.
- Reworked save, compare, remove, settings, dropdown, sheet, modal, and list interactions to use restrained opacity/transform feedback instead of passive card hover lifts or layout-affecting transitions.
- Added practical motion rules to the design system documentation, including reduced-motion behavior and banned hardcoded transition patterns.
- Expanded Playwright motion coverage for icon microinteractions, dropdowns, mobile sheets, reduced motion, cleanup behavior, and compare tab stability.
- Synchronized runtime/package version to `4.9.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.8.0 (2026-06-01)
- Reworked university comparison admission choices so configure cards show academic minimums, admitted-score context, language proof, extra requirements, and funding-specific differences before students continue to results.
- Preserved `score_profile` and funding-specific requirements through frontend admission-choice flattening so SAT/UNT/GPA context and grant-vs-paid cutoffs appear in comparison.
- Split comparison results admission rows into decision-grade groups for selected route, academic minimums, admitted score context, language proof, documents/interviews/portfolio, funding, and unique exam requirements.
- Fixed direct compare links so URL `ids` and `choices` override stale saved comparison state, and fixed Russian bachelor-program counts for localized `Бакалавриат` values.
- Removed unused duplicate comparison modules and expanded unit/E2E coverage for admission flattening, configure cards, results rows, deep links, and Russian comparison text.
- Fixed the selected comparison-card outline so the purple selection ring is consistent over both the image and body sections.
- Synchronized runtime/package version to `4.8.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.7.2 (2026-05-31)
- Fixed layered catalog view-toggle animation by removing the extra sliding indicator, press pop, and state pulse from the list/map switch while keeping one stable active state.
- Standardized modal and tour close animations through a shared closing helper so settings, compare, tour, and UniFit warning layers exit cleanly before being hidden.
- Replaced ad hoc high `z-index` values in shared UI and universities surfaces with named z-layer variables.
- Added Playwright motion regression coverage for modal exits and the list/map view toggle.
- Synchronized runtime/package version to `4.7.2` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.7.1 (2026-05-31)
- Restored the admission requirement-profile tab structure and rendered UniChance badges/factors as compact calm UI signals using Heroicons and localization keys.
- Added English and Russian UI localization for all known UniChance factor keys, with backend factor labels/messages kept as fallback text for unknown keys.
- Removed mixed English/Russian badge wording in the Russian UI for foundation, need-aware, and need-blind admission signals.
- Added frontend unit coverage for localized UniChance factor rendering and badge fallback behavior.
- Synchronized runtime/package version to `4.7.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.7.0 (2026-05-31)
- Added `POST /api/universities/compare-profiles` to return UniChance and ROI results for multiple universities in one request, including id normalization, unknown-id null rows, and private short-lived cache headers.
- Reworked UniChance explanation output to use stable machine-readable `factors` and verified `badges` without artificial country-level penalties or exact `impact_pct` claims.
- Updated compare loading to use the batch endpoint with a fallback to the previous per-university UniChance and ROI requests.
- Added backend contract coverage for the batch endpoint and UniChance factor shape, plus frontend unit coverage for compare batch/fallback behavior.
- Synchronized runtime/package version to `4.7.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.6.1 (2026-05-31)
- Removed the local Graphify ignore/instruction exceptions so generated Graphify artifacts are treated by the standard repository hygiene rules.
- Synchronized runtime/package version to `4.6.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.6.0 (2026-05-30)
- Fixed security scan findings across ops-route guarding, request body limiting, Redis rate limiting, frontend source links, translation debug logs, and manual HTTP data auditing.
- Upgraded Starlette to `1.2.0` and `prometheus-fastapi-instrumentator` to `8.0.0` to remove the audited Starlette advisory while keeping metrics support compatible.
- Enforced CSP headers and pinned Leaflet/markercluster CDN assets with SRI for the universities map.
- Removed leftover root-level Narxoz scratch files and temporary test artifacts from the repository.
- Synchronized runtime/package version to `4.6.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`.

## 4.5.2 (2026-05-26)
- Switched university thumbnails to WebP-first delivery while preserving explicit JPG fallback paths.
- Updated university detail covers to use WebP/JPG `image-set` backgrounds for full-size hero images.
- Added WebP visual similarity auditing to catch distorted or corrupted generated variants.
- Refreshed full, medium, and small JPG/WebP cover variants for selected Kazakhstan universities with weaker full-screen image quality.

## 4.5.1 (2026-05-25)
- Added test data for Narxoz University and expanded university data testing scripts.
- Updated `universities.json` and `universities_translations.json` to include detailed descriptions for newly added universities and the new `fields_of_study` translation.
- Modified frontend programs section rendering to use `fields_of_study` for localized program tags.

## 4.5.0 (2026-05-24)
- Fixed CI test `test_university_detail_contains_only_bachelor_exams_and_levels` by strictly sanitizing internal data to guarantee `Master` references are completely eliminated from bachelor `study_levels`.
- Refactored frontend and backend logic to support enhanced product scope constraints, ensuring only bachelor levels are shown and processed.
- Updated E2E test suites to validate strict bachelor constraints and track major tracking functionality.

## 4.4.0 (2026-05-24)
- Expanded Playwright E2E testing suite with tests for dynamic i18n translation, responsive layout overflow, UniChance calculator validation, and UniFit sliders interaction.

## 4.3.0 (2026-05-24)
- Enhanced backend infrastructure scripts with database enrichment and deep audit capabilities.
- Added extensive backend test coverage including concurrency stress testing, bachelor contract enforcement, infrastructure hygiene, and multilingual ML scoring regression.

## 4.2.0 (2026-05-24)
- Added automated scripts to generate small thumbnails for university assets and audited image integrity.
- Generated small WEBP variants for all existing university thumbnails.

## 4.1.0 (2026-05-20) - PR Intake and Dependency Refresh

Status:
- synchronized runtime/package version to `4.1.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- updated the Playwright test runner to `@playwright/test` `1.60.0`;
- updated backend runtime dependencies: Uvicorn `0.47.0`, Pydantic `2.13.4`, torch `2.12.0+cpu`, sentence-transformers `5.5.0`, and Sentry SDK `2.60.0`;
- added frontend unit coverage for `escapeHtml` and `escapeHtmlAttr`, including null/undefined handling, non-string values, HTML entities, and numeric range stabilization;
- cached university detail tab buttons and panes during tab setup so tab clicks do not repeat DOM-wide queries;
- made the university factor refresh script request delay configurable through `UNISEARCH_FACTOR_REFRESH_REQUEST_DELAY_SEC` while keeping a conservative default delay for public APIs;
- sanitized College Scorecard API keys in public university source URLs during catalog loading so private keys cannot leak through API/UI payloads if a data refresh writes one into source metadata.

## 4.0.0 (2026-05-20) - Admission Choices and Light Theme Refresh

Status:
- synchronized runtime/package version to `4.0.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- replaced the flat `admission_tracks` model with structured `admission_categories`, `requirement_profiles`, and `funding_options` so programs, requirements, and funding routes can be represented separately;
- migrated profile and API selection payloads from `selectedAdmissionTracks` to `selectedAdmissionChoices`, preserving explicit program, category, requirement profile, funding option, and choice keys;
- updated UniChance, UniFit scoring, university list filtering/search, ML text matching, compare mode, and detail pages to score and display the selected admission choice instead of the old track-only contract;
- refreshed university detail admission and finance sections with category/profile/funding option cards, compact funding badges, choice-aware chance values, and selection persistence;
- applied a broad light-theme refresh across Home, Universities, Ranking, Guide, About, global navigation, profile/settings surfaces, comparison, and university detail pages while keeping the flat dark-theme structure;
- updated English and Russian localization for the admission-choice model, funding-option labels, compare rows, guide text, and related empty/fallback states;
- replaced old admission-track compatibility tests with category/funding-option coverage and updated backend and Playwright regressions for the new choice-based contract.

## 3.9.2 (2026-05-14) - Light Theme and Admissions UI Polish

Status:
- synchronized runtime/package version to `3.9.2` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- improved the light theme across Home, Universities, Ranking, Guide, About, shared navigation, profile/settings modals, comparison, and university detail pages with stronger surface separation, clearer borders, and visible purple active/selected states while preserving the flat dark-theme style;
- tightened layout density and mobile behavior for About, Guide, Ranking, Universities catalog/compare, profile/settings modals, and university detail admission/finance sections;
- refined compare and university detail admission-track cards by shortening funding program/source labels, moving full values into tooltips, removing duplicated selected/fallback method text from compact chance chips, and keeping selected-track emphasis purple;
- reworked the university detail finance scholarship card structure and height synchronization so scholarship and total-cost summary cards align reliably;
- updated visible copy and localization for About lead text, Ranking global filter wording, location tradeoff labels/help text, and new admission funding label shortcuts in English and Russian;
- removed the decorative globe prefix from the Universities country filter fallback;
- refreshed full and small thumbnail assets for Astana IT University, International Information Technology University, Kazakhstan-British Technical University, and KIMEP University.

## 3.9.1 (2026-05-13) - University Detail Route Fix

Status:
- synchronized runtime/package version to `3.9.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- fixed university detail tabs after client-side navigation by binding tab handlers to the current `.d-tabs` DOM node instead of a stale module-level flag;
- completed Russian localization for visible Kazakhstan program fields by translating Kazakh-language labels and program major tags in localized university detail responses;
- removed duplicate summary pills from university program cards because the same duration, format, and level data already appears in the program detail rows;
- added Playwright regression coverage for opening a university from the catalog through the client router and switching detail tabs without refreshing the page.

## 3.9.0 (2026-05-13) - Kazakhstan Catalog Expansion

Status:
- synchronized runtime/package version to `3.9.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- added 10 Kazakhstan bachelor-level universities: Astana Medical University, International Information Technology University, Satbayev University, Kazakhstan-British Technical University, Al-Farabi Kazakh National University, L.N. Gumilyov Eurasian National University, Narxoz University, KIMEP University, Asfendiyarov Kazakh National Medical University, and Abai Kazakh National Pedagogical University;
- added official-source admissions and fact provenance for the new Kazakhstan universities, including verified-null admissions/selectivity records where official applicant/admit totals are not published;
- added official tuition-derived annual cost entries, corrected Kazakhstan UNT admission thresholds, removed unsupported GPA pseudo-requirements, and clarified that state-grant values are eligibility thresholds rather than guaranteed grant cutoffs;
- added Almaty to supported Kazakhstan locations and added hidden search aliases, Russian city/major/tag translations, university descriptions, track labels, program names, and admission text for the new universities;
- added curated logo and campus thumbnail assets, including full and small variants, for the 10 new Kazakhstan universities;
- updated service-worker behavior so university media assets use a network-first strategy, service-worker registration bypasses cache for updates, and the service-worker entry file has an explicit version bump;
- documented optional local Graphify usage in `AGENTS.md` and `CLAUDE.md` without making Graphify a project requirement.

## 3.8.2 (2026-05-01) - Backend Dependency Refresh

Status:
- synchronized runtime/package version to `3.8.2` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- updated backend runtime dependencies: FastAPI `0.136.1`, Uvicorn `0.46.0`, Pydantic `2.13.3`, scikit-learn `1.8.0`, sentence-transformers `5.4.1`, Redis client `7.4.0`, and Sentry SDK `2.58.0`;
- stabilized the language-switching E2E helper so tests wait for the asynchronous language selector state before asserting translated navigation labels.

## 3.8.1 (2026-05-01) - Release Workflow and Maintenance

Status:
- synchronized runtime/package version to `3.8.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- improved Settings persistence lookups by using map-based key access while preserving the existing stored settings contract;
- updated the Playwright test runner to `1.59.1` and moved GitHub Actions workflow dependencies to current Node 24-compatible major versions;
- cleaned the official admissions sync script formatting after removing an unused future import;
- changed release artifact publishing to run only from published GitHub Releases, and added a release-time changelog validation gate before artifact/container publishing.

## 3.8.0 (2026-04-30) - UniChance Fallback Calibration

Status:
- synchronized runtime/package version to `3.8.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- calibrated estimated UniChance fallback scoring against official `score_profile` tracks by deriving a low-confidence proxy profile from comparable admission requirements and average stats;
- preserved conservative fallback behavior for below-minimum exams, missing mandatory language evidence, and tracks without comparable score evidence;
- added backend regression coverage that fills template profiles across all score-profile universities/tracks at `p25`, `median`, and `p75`, then compares exact UniChance with the same track using fallback scoring;
- documented release-permission and release-note aggregation rules in `AGENTS.md` and `CLAUDE.md`.

## 3.7.9 (2026-04-30) - Docker Runtime Hardening

Status:
- synchronized runtime/package version to `3.7.9` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- hardened Docker Compose with Redis/backend healthchecks, `restart: unless-stopped`, and backend startup waiting for healthy Redis;
- reduced Docker build context by excluding local env files, virtualenvs, frontend/docs/tests/scripts, and transient test artifacts;
- changed backend Docker dependencies to use the CPU-only PyTorch wheel, reducing the local backend image from `8.52GB` to `2.02GB`;
- added CI coverage for backend Docker image builds and enabled container artifact publishing from pushed `v*` tags;
- documented that the Docker compose setup runs backend + Redis while the static frontend is served separately.

## 3.7.8 (2026-04-30) - Open-source Repository Hygiene

Status:
- synchronized runtime/package version to `3.7.8` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- added GitHub PR and issue templates, CODEOWNERS, Dependabot configuration, and EditorConfig for clearer external contribution flow;
- added a Repository Hygiene workflow for version sync, encoding, localization parity, and university data audit checks;
- added practical fork/reuse and release checklist documentation, plus an ADR for upstream project boundaries;
- added `npm run audit:data` and aligned the university data audit with truthful `rank: null` records that have explicit non-published rank metadata;
- documented the new repo-hygiene and public-docs rules in `AGENTS.md`, `CLAUDE.md`, README, and CONTRIBUTING.

## 3.7.7 (2026-04-29) - CodeQL Alert Fixes

Status:
- synchronized runtime/package version to `3.7.7` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- fixed the modular university comparison renderer so fallback metric calculation uses `compareMetrics` instead of calling a shadowed local variable;
- hardened frontend/backend dev launchers by removing environment-derived URL/path logging and replacing HTTP readiness probes with validated TCP port checks;
- changed the frontend dev server to serve only files from an indexed frontend directory, avoiding request-path based filesystem access;
- cleaned remaining CodeQL warning patterns in comparison labels, catalog filter persistence, sort handling, and UniChance/ROI scoring assignments.

## 3.7.6 (2026-04-29) - UI Loading and Footer Fixes

Status:
- synchronized runtime/package version to `3.7.6` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- fixed the global top loading bar animation so it travels across the full viewport instead of stopping around the middle of wide screens;
- restored the shared footer on the Guide page and added a visible GitHub icon to footer social links across frontend pages;
- changed the selected university card outline to an inset border effect so rounded corners do not break the purple outline;
- added a dedicated map-mode loading skeleton with horizontal result-card placeholders and a shimmer map overlay;
- prevented duplicate Leaflet map initialization when the Universities page opens directly in map mode.

## 3.7.5 (2026-04-28) - Performance Optimizations

Status:
- synchronized runtime/package version to `3.7.5` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- lazy-loaded route modules, profile UI, integrated Ranking assets, and Leaflet map assets so first-page loads avoid unused page code and external map libraries;
- removed external Google Fonts and Wikimedia GitHub icon requests from frontend pages, relying on local/system assets instead;
- added local cached loading for exams, languages, and locations config endpoints with stale fallback when the backend is temporarily unavailable;
- made startup ML warmup opt-in through `WARMUP_ML_ON_STARTUP` while preserving manual and ops warmup behavior;
- added `npm run audit:performance` for lightweight frontend request and payload audits.

## 3.7.4 (2026-04-28) - UI Fixes and Encoding Fixer Improvements

Status:
- synchronized runtime/package version to `3.7.4` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- changed Universities map mode to show map results as a horizontal list above a wider rectangular map in both Catalog and Comparing;
- improved mobile map-result cards with compact horizontal scrolling, hidden mobile scrollbars, clearer next-card peek, tighter typography, and stable row actions;
- expanded map popups so university cards are shown without Leaflet height clipping and changed university map markers from circular logos to rounded-square logos;
- updated visible catalog coverage to `40` universities across `13` countries and added the Render web demo link to README;
- added `scripts/check-encoding.mjs` with `npm run fix:encoding` and `npm run check:encoding` commands for BOM/mojibake/UTF-8 checks;
- documented the encoding guard in `AGENTS.md` and `CLAUDE.md`, and included encoding checks in the minimum release/test workflow;
- repaired mojibake in shared frontend comments and the Russian language option, plus aligned comparison localization keys for category titles and fallback labels.

## 3.7.2 (2026-04-24) - Security Hardening and Repository Hygiene

Status:
- hardened `ops_request_is_authorized` in `backend/app/core/security.py` using `hmac.compare_digest` to prevent timing attacks;
- performed a full project hygiene check: removed residual log files and temporary artifacts;
- verified file encoding consistency (UTF-8) across the entire codebase.

## 3.7.1 (2026-04-24) - Security Hardening and Repository Hygiene

Status:
- synchronized runtime/package version to `3.7.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- upgraded ETag hashing algorithm from `SHA1` to `SHA256` in `backend/app/services/universities.py` to address security advisories;
- refactored HTML sanitization in `frontend/javascript/pages/universities.js` to use `DOMParser` instead of unsafe regular expressions, mitigating XSS risks;
- disabled insecure clear-text logging of data objects in the `logTranslationDebug` function to prevent sensitive information leakage;
- added `SECURITY.md` with vulnerability reporting guidelines and security practices;
- added `CODE_OF_CONDUCT.md` and `SUPPORT.md` to formalize community standards and help channels.

## 3.7.0 (2026-04-24) - AI Sorting E2E Stability and Mocking

Status:
- synchronized runtime/package version to `3.7.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- implemented a centralized E2E network mocking system in `tests/e2e/helpers/mocks.js` covering `/universities/ai-sort`, `/universities`, `/exams/validate`, and `/languages/validate` to eliminate 429 Rate Limit errors and flakiness in CI;
- refactored `resolveAiSortResult` in `compare-helpers.js` to properly manage AI resolution state, preventing race conditions and redundant renders when fallback and AI data arrive concurrently;
- hardened the profile seeding helper to clear filters between tests, preventing state leakage and ensuring deterministic sort-mode selection;
- disabled backend rate-limiting and semantic embeddings in `playwright.config.js` for CI environments to further stabilize the test suite.

## 3.6.1 (2026-04-24) - Fix Module Resolution Errors

Status:
- synchronized runtime/package version to `3.6.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- removed invalid ranking-related imports from `frontend/javascript/pages/universities.js` to fix ES module load failures.

## 3.6.0 (2026-04-24) - Codebase Refactor

Status:
- synchronized runtime/package version to `3.6.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- split frontend utility responsibilities into focused modules for safe storage, runtime UI helpers, theme, config loading, formatting, custom selects, and persistence while keeping `frontend/javascript/utils.js` as a compatibility facade;
- split global frontend shell code by moving settings, profile UI, layout-cache, navbar-logo, translation-status, and profile-draft logic out of `frontend/javascript/components.js`;
- decomposed the universities workspace by extracting compare detail loading, UniChance loading, AI-sort fallback orchestration, and shared detail-cache/history helpers into dedicated modules;
- decomposed the university detail page into a thin entrypoint, a page controller, and separate overview, extra-info, programs, admission, and finance render modules;
- centralized backend finance/study-mode helpers in `backend/app/services/finance_modes.py` and reused them from university listing/detail and AI scoring services;
- centralized low-level exam config, coercion, grade, level, and breakdown helpers in `backend/app/services/exam_support.py` while preserving public exam-service behavior;
- simplified request metrics middleware and search scoring/edit-distance helpers, including focused unit coverage for fuzzy matching behavior.

## 3.5.6 (2026-04-23) - Calm Academic Workspace Redesign

Status:
- removed decorative AI-style gradients (`linear-gradient`, `radial-gradient`) from university page scope blocks (`.u-page-scope__inner`, `.d-page-scope`) and replaced them with flat `var(--card)` backgrounds and `1px solid var(--line)` borders;
- removed heavy drop shadows from scope panels (`box-shadow: 0 12–18px …`) and standardized them to `none` or `var(--shadow-md)`;
- updated global `--shadow-md` CSS variable in both light and dark modes to reduce blur radius from `60px` to `24px` for a cleaner, flatter visual feel;
- replaced pill-shaped mobile filter button (`border-radius: 999px`) with a rounded rectangle (`border-radius: 12px`) matching the Calm Academic Workspace standard;
- moved comparison UI breakpoint from `680px` to `820px` so tablets (iPad) display the configure panel in a single column instead of squeezing two;
- enabled horizontal scrolling for comparison tables on narrow screens by setting `min-width: 500px` inside the scrollable wrapper;
- fixed comparison tray floating panel (`compare-tray`) incorrectly shifting off-screen on mobile due to a conflicting `transform: translateX(-50%)` — added `transform: none` override for narrow viewports;
- standardized comparison tray floating shadow to `var(--shadow-md)` instead of a hardcoded heavy value;
- updated `AGENTS.md` with strict UI/UX guidelines linking to `docs/design-system.md` for the Calm Academic Workspace design protocol.

## 3.5.2 (2026-04-23) - Jules PR Optimizations

Status:
- synchronized runtime/package version to `3.5.2` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- merged PR #7 to narrow `backend/app/services/exams.py` exception handling to expected file, JSON, and numeric conversion errors instead of broad `Exception` catches;
- merged PR #8 to optimize university tuition filtering by evaluating effective university cost once per candidate while applying min/max bounds in one pass;
- merged PR #9 to optimize university region, country, and city filtering by applying location filters together instead of repeatedly rebuilding intermediate lists;
- merged PR #10 to add backend coverage for text-translation source-language hint normalization and `auto` fallback behavior;
- merged PR #13 to add Node frontend unit tests for funding preference normalization, run them in CI, and use `npx playwright` for E2E scripts.

## 3.5.1 (2026-04-22) - Compare Workflow Fixes

Status:
- synchronized runtime/package version to `3.5.1` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- changed university comparison to an exact two-university pair with a persistent bottom tray, fixed pair replacement behavior, and restored selected compare cards after client-side navigation;
- added a required comparison setup step for choosing admission track and funding option per university before opening results, including persisted `tracks` URL state and per-track UniChance context;
- rebuilt comparison result cards, metrics, best-cell highlighting, key-difference text, and mobile/tablet layouts around the selected track/funding data instead of generic university-level defaults;
- preserved comparison route/query parameters through route-link normalization and added explicit compare route helpers;
- exposed hidden university search aliases on card projections so queries such as `AITU` can match the full university record;
- refined English/Russian comparison, financial-aid, funding, and UniChance fallback copy, plus related university translation labels;
- updated backend and Playwright coverage for hidden-alias search, compare setup/results flow, responsive comparison tables, and localStorage-backed UniFit filter state.

## 3.5.0 (2026-04-22) - Consolidated University Workspace

Status:
- synchronized runtime/package version to `3.5.0` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- consolidated Ranking, Compare, and Universities catalog into a unified tabbed interface inside the `universities.html` page;
- redirected the legacy `ranking.html` page to the new unified catalog ranking tab via route mappings and immediate client-side redirection;
- updated English and Russian localizations to support the new unified comparison and ranking layout structure;
- refined UI logic inside `universities.js`, `components.js`, and `routes.js` to implement section-tab switching and URL query state (`?tab=catalog|ranking|compare`);
- adjusted UI styling related to guide, ranking, and universities to visually support the tabbed integration;
- improved backend logic inside `ml_scoring.py` to align with the latest platform interactions;
- updated test coverage, modifying the responsive E2E test and introducing a new spec for tab switching and compare results.

## 3.4.12 (2026-04-21) - UI/UX Workspace Polish

Status:
- synchronized runtime/package version to `3.4.12` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- added a localized settings dialog for local interface preferences, including recently opened university storage and opening university detail pages in new tabs;
- added client-side app route navigation for core frontend pages so internal page changes keep the workspace state smoother and show route-loading feedback;
- moved Ranking into the Universities workspace as an internal tab and added a Comparing tab with card/map-only selection, URL-addressable comparison results, generated key differences, category scores, and metric-table highlights;
- improved universities catalog skeletons with responsive counts, shared shimmer tokens, and reduced-motion coverage;
- refined the catalog recent-universities bar with clear-all and per-item removal controls, dark-mode styling, and localized labels;
- updated navbar/profile tab indicators, mobile navbar sizing, hover states, and accent tokens for calmer interaction behavior;
- improved university detail save-button active styling and preserved localized major labels on initial Russian profile loads;
- updated Russian localization wording to prefer full "университет" terminology and refined "N/A"/unknown fallbacks for ranking and empty data states;
- added Playwright coverage for localized profile major options on initial Russian load.

## 3.4.11 (2026-04-21) - UI Animation and Interaction Refinements

Status:
- synchronized runtime/package version to `3.4.11` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- implemented sliding tab animations for the main navigation, profile sections, university detail tabs, and universities list scope toggles;
- mapped the "Not published" university ranking status explicitly to a localized "N/A" fallback across the catalog;
- removed the redundant, context-free placeholder cost from the university-detail quick stats row to prioritize the explicit finance tab breakdown;
- preserved the `style.css` baseline variable `--accent` and verified global color-token parity for dark-mode components;
- added an interactive "Add to Favorites" button inside the university detail page with persisted local storage and active styling;
- updated the `eng` and `ru` localization sources with key mappings for the new university detail save interactions;
- updated `AGENTS.md` guidelines with explicit boundaries for sliding animations, prohibiting global transitions, and specifying maintenance protocols.

## 3.4.10 (2026-04-21) - UI Bug Fixes and UX Refinements

Status:
- synchronized runtime/package version to `3.4.10` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- replaced the catalog favorites-only switch with an underlined All/Favorites scope control, including localized labels and correct `aria-pressed` states;
- defaulted empty/no-evidence profiles to regular name sorting instead of automatic UniFit requests, while keeping UniFit available when profile evidence exists;
- made the bachelor's-scope notice on the universities page dismissible and persisted the dismissal locally;
- improved universities and ranking search suggestions so they return matching university names from localized names, aliases, acronyms, cities, and countries without noisy duplicate type labels;
- kept recently viewed universities visible and human-readable through cached detail names, including after favoriting or comparing items;
- localized homepage coverage plural labels and university-detail placeholders so English fallback text does not leak into the Russian UI during initial loading;
- refined ranking country-filter styling, language selector alignment, about-page proof layout, finance summary spacing, dark-mode recent chips, and global error-button shadows;
- removed the volatile repository layout tree from `README.md` so adding files no longer requires README maintenance;
- updated Playwright motion coverage for the revised favorites/recently-viewed behavior.

## 3.4.9 (2026-04-21) - Architecture and Frontend Code Modularization

Status:
- synchronized runtime/package version to `3.4.9` across `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- modularized the monolithic `frontend/javascript/pages.js` file (almost 5,000 lines) into smaller, maintainable modules:
  - extracted shared helper functions and UI variables into `pages/_shared.js`;
  - extracted the catalog list initialization into `pages/universities.js`;
  - extracted the university detail initialization into `pages/university.js`;
- updated `frontend/javascript/main.js` to import page logic directly from the new modules, bypassing and fully removing `pages.js`;
- completed global loading spinner CSS cleanup by eliminating legacy, redundant purple spinners from `universities.css` and unifying it to the global white spinner;
- upgraded FastAPI backend application lifecycle events from legacy `@app.on_event("startup")` hooks to the modern ASGI asynchronous `lifespan` pattern;
- centralized repeated backend dictionary utilities and helpers into `backend/app/core/utils.py`;
- updated E2E testing configurations to accurately capture and report failures related to UI component modifications.

## 3.4.8 (2026-04-20) - Version Source Cleanup and Documentation Refresh

Status:
- synchronized runtime/package version to `3.4.8` through the new package-based version flow, including `package.json`, `package-lock.json`, and generated `frontend/env.js`;
- made `package.json` the canonical application version source for backend, frontend, Docker, and release tooling instead of keeping hardcoded semver values in runtime config, backend settings, Compose, or deployment examples;
- added backend runtime version loading from `package.json` and copied `package.json` into the backend Docker image so API metadata, health, ready, and ops runtime responses use the same release version;
- added `npm run bump:version` and `npm run check:version`, and made `npm run test:all` verify version synchronization before backend and E2E checks;
- refreshed README onboarding with badges, fresh-clone setup steps, stable project snapshot/guardrails, updated data-maintenance workflow for official facts and admissions, repository layout updates, and recent release references;
- added `CONTRIBUTING.md` with lightweight solo-maintainer contribution guidance, setup notes, data-source rules, PR expectations, and relevant checks for occasional external fixes;
- updated project agent release instructions to use the new version bump/check workflow.

## 3.4.7 (2026-04-19) - Mobile UX and Product Workspace Refresh

Status:
- synchronized runtime/package version to `3.4.7` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, README release references, and deployment examples;
- stabilized saved-university removal on the universities page so cards keep their viewport position when the favorites shortlist shrinks or disappears;
- added ROI guidance to the user guide in English and Russian, including guide navigation and generated guide content support;
- documented the UniSearch design system and UI audit direction for the 2026 calm academic product workspace refresh;
- aligned the university detail page with the 2026 product UI direction, including the connected cover/header/tabs shell, quieter underlined tabs, token-based surfaces, and consistent light/dark detail styling;
- made the university-detail `Admission` and `Costs` tab panels visually match `General` and `Programs` by removing the extra rounded outer panel treatment while keeping inner data cards readable;
- refined UniChance accuracy presentation so low-accuracy labels sit below the percentage on wider layouts and move beside the percentage only on constrained mobile layouts;
- fixed the compact language selector so its dropdown arrow stays anchored on the right when switching between EN/RU;
- improved phone and tablet UX across the shared navbar, profile modal, homepage, universities catalog, university detail page, ranking, and guide layouts;
- converted the profile modal into a more phone-friendly bottom sheet on small screens, with horizontally scrollable section tabs and safer touch targets;
- improved catalog mobile filtering with a tablet drawer, phone bottom sheet, safe-area-aware floating filter button, stronger toolbar wrapping, and no horizontal overflow on narrow devices;
- made guide mobile navigation full-width on phones instead of appearing as a narrow inset panel;
- removed negative letter spacing from touched UI areas to improve Russian text readability and reduce mobile text compression;
- expanded Playwright responsive coverage for home, universities, ranking, guide, university detail, navbar menu, catalog filters, profile modal, UniChance layout, and detail tab panel design invariants across narrow, mobile, tablet, light, and dark viewports.
- bumped the service-worker cache version so clients refresh the `3.4.7` frontend assets immediately after deployment.

## 3.4.6 (2026-04-18) - Security Hardening and Narrow Viewport Stability

Status:
- synchronized runtime/package version to `3.4.6` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, README release references, and deployment examples;
- protected `/ops/*`, `/metrics`, and `/health?warmup=1` with `OPS_ADMIN_TOKEN`, added a sanitized public `/translation-status` endpoint, and moved frontend translation-status checks away from private ops routes;
- added global and expensive-request rate limits, request body size limits, stricter CORS methods/headers, opt-in trusted-proxy IP handling, and baseline security headers for backend and frontend dev-server responses;
- disabled metrics by default, documented ops/security environment variables, added deployment security notes for Caddy/Nginx hosting, and kept Docker Redis private on the compose network;
- hardened backend observability by disabling default Sentry PII and scrubbing profile, exam, language, auth, token, and secret fields before events are sent;
- hardened Docker and repository security with a non-root backend container user, expanded `.dockerignore`, a GitHub security workflow for CodeQL/audits/repository guards, and `rel="noopener noreferrer"` on external GitHub links;
- replaced inline image `onerror` handlers with a shared `bindImageFallbacks` handler, including logo/thumbnail/map-marker fallback flows across navigation, university cards, ranking cards, comparison cards, maps, and detail pages;
- improved 320px and narrow mobile layout stability for navbar controls, language selector, profile modal tabs/actions, university catalog cards, skeleton grids, map result cards, university-detail cover/tabs, admissions, and finance sections;
- restored the university-detail ROI block in the finance tab when verified salary data is available, while keeping it hidden for universities without salary data;
- stabilized GitHub Actions by configuring backend test environment variables and updating E2E tests for the profile tab UI, skeleton cards, UniFit badges, ROI rendering, and local API rate limits;
- updated backend tests for ops authorization, sanitized translation status, security headers, oversized body rejection, and Sentry scrubbing, and expanded Playwright overflow coverage for 320px, navbar controls, finance tabs, and profile modal overflow;
- bumped the service-worker cache version so clients refresh the `3.4.6` frontend assets immediately after deployment.

## 3.4.5 (2026-04-17) - Saved Universities, Comparison, Profile Redesign, and Motion

Status:
- synchronized runtime/package version to `3.4.5` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README release references;
- redesigned the profile modal into section tabs for basics, scores, languages, and preferences, with profile completion progress, interest chips, smoother save/reset/unsaved-change flows, and better reduced-motion behavior;
- added shared frontend motion helpers for press, panel-enter, list-enter, row-exit, state-pulse, theme, toast, profile, detail-tab, universities-list, and map/result interactions, while respecting `prefers-reduced-motion`;
- added saved-university storage with favorite buttons, saved-only filtering, a favorites shortlist bar, recently viewed universities, persisted compare selection, and pressed/active states across list and map cards;
- added a university comparison tray and modal with overview, programs, admissions, finance, and context sections, including highlighted best-rank, lowest-cost, accessibility, aid, salary/outcome, requirements, source, and data-quality signals;
- rebuilt universities-page search and mobile filtering UX with active-filter chips, mobile filter sheet controls, search suggestions for universities/cities/countries, saved empty states, stronger card metrics, and refreshed map result cards;
- improved ranking UX with search, country filter, suggestions, source notes, empty states, skeleton handling, dynamic badge fitting, and localized ranking tool labels;
- refreshed homepage preview, detail-page action labels, detail tab switching, guide/ranking/list styling, and shared icon usage to match the updated interaction model;
- expanded English and Russian localization for profile sections, ranking tools, saved universities, comparison tables, shortlist/recent bars, empty states, action labels, and tour controls;
- refined university coordinates, campus-size localization, and translation data used by frontend rendering and backend endpoint contract tests;
- added Playwright coverage for profile/category motion, saved/compare pressed states, and detail-tab switching, and updated the language-validation flow regression test to target the new profile tabs;
- bumped the service-worker cache version so clients refresh the `3.4.5` frontend assets immediately after deployment.

## 3.4.4 (2026-04-14) - Skeleton Loaders and Error States

Status:
- synchronized runtime/package version to `3.4.4` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README release references;
- added skeleton loading states across main pages (universities, university detail, ranking, about) to improve perceived performance during initial data fetch;
- added localization strings for "No Internet Connection" error states;
- bumped the service-worker cache version so clients refresh the `3.4.4` frontend assets immediately after deployment.

## 3.4.3 (2026-04-13) - Design Refinement And Mobile Responsiveness

Status:
- synchronized runtime/package version to `3.4.3` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README release references;
- improved mobile responsiveness and layout stability across universities, university-detail, ranking, guide, and about pages;
- refined frontend visual system including button styling, navigation alignment, and interactive hover/active states;
- updated university-detail admissions and finance presentation for better density and readability on smaller screens;
- improved backend logic for exam-score normalization and admission-track majored processing;
- synchronized curated data catalogs for official facts and admissions, and updated related unit/E2E regression tests;
- bumped the service-worker cache version so clients refresh the `3.4.3` frontend assets immediately after deployment.

## 3.4.2 (2026-04-13) - Composite Exam Scores And Truthful Track Data

Status:
- synchronized runtime/package version to `3.4.2` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README release references;
- added composite exam validation/storage for subject and section breakdowns, so profile inputs and validation APIs can keep separate scores per subject while still calculating the parent total where applicable;
- expanded academic exam coverage for breakdown-based submissions, including subject-level SAT, A-Level, AP, HKDSE, and similar exam structures, with stronger payload validation and API test coverage;
- expanded language-exam handling for composite submissions such as IELTS section scores, preserving overall score plus detailed component results for frontend rendering and downstream AI/profile flows;
- updated profile exam/language UI, localized messages, and success/error toasts so users can enter per-subject or per-section scores directly instead of flattening everything into one raw number;
- updated university admission rendering to group composite requirement/average entries more clearly and to keep funding-option `stats_avg` scoped only to the exams actually required by that variant;
- tightened finance data presentation so visible yearly cost breakdowns stay truthful to official mandatory or tuition-and-fee-only sources instead of exposing discretionary categories as verified line items;
- bumped the service-worker cache version so clients refresh the `3.4.2` frontend assets immediately after deployment.

## 3.4.1 (2026-04-12) - Encoding And Admission Option Fixes

Status:
- synchronized runtime/package version to `3.4.1` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README release references;
- fixed broken text encoding and punctuation artifacts in frontend localization/runtime strings:
  - removed stray BOM artifacts from the English and Russian localization packs;
  - restored proper Cyrillic rendering and normalized several broken dash/bullet glyphs in shared frontend text;
- updated the navbar profile entry from a text button to a compact user icon button, including responsive sizing and shared icon registration;
- fixed university-detail admissions rendering so funding-option cards keep showing both paid and grant variants even when the profile funding preference is set to grant-only;
- added Playwright regression coverage for the funding-option visibility fix on the Tsinghua University detail page;
- bumped the service-worker cache version so clients refresh the patched frontend assets immediately after deployment.

## 3.4.0 (2026-04-12) - Full Web App Design Rework

Status:
- synchronized runtime/package version to `3.4.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples;
- completed a full rework of the UniSearch web-application design:
  - redesigned the homepage around a clearer catalog-first hero, stronger CTA structure, refreshed typography, and a more focused product preview;
  - rebuilt the universities, ranking, guide, about, error, and university-detail experiences into a more cohesive visual system with denser comparison surfaces and better desktop/mobile responsiveness;
  - improved practical decision-making flows with map-side result panels, university quick stats, cleaner detail summaries, and more consistent icon-driven UI patterns across the frontend;
  - expanded English and Russian localization coverage to support the new product framing, copy, and redesigned page sections;
- added Heroicons sync tooling and refreshed third-party notices to support the updated icon pipeline used by the redesigned frontend;
- bumped the service-worker cache version so clients refresh the redesigned frontend assets immediately after deployment.

## 3.3.1 (2026-04-09) - Rank Truth And Icon System Cleanup

Status:
- synchronized runtime/package version to `3.3.1` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples;
- audited and normalized current ranking/provenance data for the 40-university catalog:
  - aligned university `rank`, `rank_meta`, and `fact_provenance.facts.rank` so official QS WUR 2026 positions and `not_published` states are consistent across the dataset;
  - updated rank provenance handling so non-published universities keep explicit `not_published` metadata instead of falling back to legacy internal wording;
  - documented the current ranking audit in `docs/rank_truth_update_2026-04-09.md`;
  - clarified University of Toronto count-based admissions methodology wording in official fact/admissions catalogs;
  - normalized UNSW naming to `University of New South Wales` in search aliases, official facts/admissions, and translations.
- refreshed student-facing scope and detail messaging:
  - added bachelor-only scope callouts to the homepage, universities list page, and university detail page;
  - expanded English and Russian localization coverage for the new scope copy and related UI wording;
  - added the missing `cost_item_housing_college` localization key in backend-driven translations.
- unified frontend UI icons around a single Heroicons-based system:
  - replaced mixed emoji/inline icon usage in navigation, filters, search/view controls, homepage feature cards, ranking title, university-detail tabs, toast states, and card badges;
  - added shared icon helpers in `frontend/javascript/icons.js` and wired hydration/cleanup into frontend page initialization;
  - removed decorative location pins from list/ranking/detail location strings and fixed long location wrapping while keeping country flags intact;
  - adjusted detail-page action icons so website uses a globe icon and map uses a map-pin icon;
  - documented third-party icon/brand usage in `THIRD_PARTY_NOTICES.md` and added `docs/icon_replacement_map_2026-04-09.md`.
- polished related UI behavior and styling:
  - improved universities-page empty/warning state cards and tooltip icon styling;
  - refined profile confirmation-button sizing and destructive button states;
  - improved scholarship-line, badge, toast, and ranking-location layout behavior for both light and dark themes;
  - enabled clickable links inside detail-page tooltips and preserved proper icon sizing through shared CSS utilities.
- extended regression coverage:
  - updated the i18n smoke test to assert that the university-detail location keeps rendering a flag after language switches.

## 3.3.0 (2026-04-08) - +20 Universities

Status:
- synchronized runtime/package version to `3.3.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples;
- expanded the university catalog with 20 new institutions:
  - University of Oxford
  - University of Cambridge
  - California Institute of Technology
  - University of Chicago
  - University of Pennsylvania
  - Cornell University
  - University of California, Berkeley
  - UNSW Sydney
  - Yale University
  - Princeton University
  - University of Sydney
  - McGill University
  - Johns Hopkins University
  - Australian National University
  - University of Edinburgh
  - University of Manchester
  - Columbia University
  - University of British Columbia
  - University of California, Los Angeles
  - University of Waterloo;
- removed temporary university-import artifacts and stray generated assets that were not part of the finalized catalog update.

## 3.2.1 (2026-04-03) - Tag Label And Rule Cleanup

Status:
- synchronized runtime/package version to `3.2.1` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples;
- clarified UniFit university-card tag wording:
  - renamed `Top Match` to `Good Match` in English UI copy;
  - renamed `Лучшее совпадение` to `Хорошее совпадение` in Russian UI copy;
  - adjusted supporting explanation text so the second-tier preference tag reads clearly as weaker than `Your Vibe` / `Ваш формат`.
- documented university-card tag behavior in a dedicated UniFit tag-rules reference:
  - defined tag groups, display priority, and mutual-exclusion rules for preference, finance, requirements, and budget/aid states;
  - explicitly recorded that `your_vibe` and `top_match` are a single preference-match group and must never render together on one card.
- refreshed guide and regression coverage for the updated tag wording and preference-match behavior.
- bumped the service-worker cache version so clients refresh the updated tag copy promptly after release.

## 3.2.0 (2026-04-03) - Smarter Admissions

Status:
- synchronized runtime/package version to `3.2.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples.
- upgraded exam input handling across backend and frontend:
  - `/exams/validate`, profile payload schemas, and profile serialization now accept richer exam submissions with `raw_value`, `display_value`, and structured `details` alongside numeric scores;
  - A-Level input now supports real grade combinations such as `A*A*A`, converts the best 3 grades into an internal score, and enables normalization from actual user-entered grades instead of a certificate-only flag;
  - HKDSE level inputs now use explicit band selection, while certificate-style exams such as Swiss Maturity, Abitur, and OSSD work as binary presence flags end-to-end;
  - the profile UI gained dedicated non-numeric exam controls, guidance text, localized status labels, and consistent formatting of raw exam values in requirements and profile displays.
- tightened UniChance / admission scoring behavior:
  - profile exam evidence is now normalized through the shared exam-submission coercion path before chance scoring;
  - fallback chance estimation is more conservative and now returns `0%` when required exam or language evidence is missing, when hard minimums are not met, or when only conditional evidence is available;
  - Russian no-data / missing-evidence messaging was rewritten to talk about concrete admission options more clearly.
- expanded and cleaned university dataset quality:
  - admissions data now includes localized track and funding-option descriptions across the catalog;
  - finance blocks were enriched with official detailed annual cost breakdowns, source URLs, notes, and `costs_breakdown_status` coverage;
  - student-life size labels and reviewed UniFit slider factors were added or recalibrated, with supporting metadata updated to the new manual review version;
  - translation payloads were extended for the new descriptions, ranking-status wording, cost-item labels, and humanized placeholder text.
- improved frontend presentation and safety around the richer data:
  - ranking-source statuses now render with localized human-readable fallbacks, and external admission source links escape attribute values safely;
  - guide text and detail-page exam formatting now explain A-Level / HKDSE inputs correctly and display non-numeric requirement values cleanly.
- strengthened regression and data-audit coverage:
  - backend tests now cover raw A-Level grade validation, grade-based normalization, stricter fallback chance outcomes, localized track descriptions, detailed finance breakdown consistency, campus-size presence, slider-factor completeness, and breakdown-status exposure;
  - the data audit script now checks additional provenance URLs and rejects non-ASCII source URLs before HTTP validation.

## 3.1.0 (2026-04-03) - UI Fixes

Status:
- synchronized runtime/package version to `3.1.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples.
- switched frontend flag rendering from external `flagcdn.com` assets to bundled local SVG files under `frontend/images/flags`, so country flags now load from the app itself instead of a third-party CDN;
- updated frontend flag asset resolution to work correctly both from the site root and `/frontend/...` paths, and bumped the service-worker cache version so clients refresh the new local flag assets immediately;
- expanded Russian localization coverage for admission details:
  - added missing strings for `Academic requirements`, `Academic average`, and `Language average` in both frontend and backend-driven translation dictionaries;
  - added explicit Russian mappings for grant-related admissions labels such as `Abay Kunanbayev`, `State Grant`, `merit`, and `state`.
- normalized several English university names to full official forms in both catalog and translation payloads:
  - `ETH Zurich` -> `Swiss Federal Institute of Technology Zurich`;
  - `EPFL` -> `Swiss Federal Institute of Technology Lausanne`;
  - `KAIST` -> `Korea Advanced Institute of Science and Technology`;
  - backend contract coverage now asserts the full-form names in both translations and detail responses.
- improved local development launch scripts:
  - `npm run dev:backend` now detects an already healthy local backend through `GET /health` and prints a friendlier ready state;
  - frontend/backend dev helpers were tightened around local runtime startup flow and ready-state messaging.
- added localized error-page support:
  - new 404 page strings were added for both English and Russian;
  - related frontend static-serving support files remain part of this release set.
- polished related UI presentation:
  - reworked the `About Us` page from multiple separate groups into one shared container with internal section dividers;
  - stabilized language-switcher labels so `English (US)` and `Русский` no longer rename themselves when the UI language changes;
  - fixed budget number inputs in filters so text stays centered and spinner controls clip correctly inside rounded fields;
  - hid university-card acceptance-rate pills when no verified data exists;
  - fixed `Average admitted` language rendering so bare language codes like `EN` / `KO` no longer appear when no verified language-average scores are published, and the card now falls back to the no-data message instead;
  - restored intended rounding where the previous UI fixes over-flattened controls, including detail-page tabs and budget fields;
  - kept grant funding cards green on hover in the light theme instead of falling back to the default blue highlight;
  - tightened funding-option spacing in admission/finance cards, aligned track cost breakdown cards, and reduced oversized cost legend rows;
  - moved track language requirements into the `Minimum to apply` and `Average admitted` sections so each box now contains academic and language subsections instead of a separate language block below;
  - increased inline flag display height for custom selects and country labels to better fit the new local SVG assets;
  - slightly increased spacing above funding-option sections on the university detail page for cleaner track-card layout.

## 3.0.0 (2026-04-02) - compact funding-option tracks, alias-aware search, and detail-page admissions redesign

Status:
- synchronized runtime/package version to `3.0.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples.
- reworked admission-track data around compact tracks with nested funding options:
  - backend normalization now keeps canonical admission tracks compact while still deriving majors and score profiles for nested `funding_options`;
  - new `expand_admission_track_variants()` compatibility handling now feeds AI sorting, chance estimation, aid detection, and funding filters where flattened variants are still required.
- improved searchability, localization, and catalog data quality:
  - university search now scores hidden aliases such as `MIT`, `NUS`, `TUM`, `CUHK`, `KAIST`, `NU`, and Cyrillic equivalents without reintroducing abbreviations into primary display names;
  - nested funding-option content now localizes correctly across labels, descriptions, funding program/source text, extra requirements, language requirements, and scholarship names;
  - catalog/translations were cleaned up to use fuller primary university names, refine Nazarbayev University and SDU descriptions, and add an inferred low-confidence SAT `score_profile` for Nazarbayev University direct admission.
- updated `UniFit` / `UniChance` behavior for compact tracks and missing exam evidence:
  - AI sorting and chance estimation now flatten compact funding options before scoring, so grant and paid variants remain compatible with ranking and detail-page selection flows;
  - `meetMinRequirements` is no longer surfaced when required exam evidence is missing, and the no-data chance state now explicitly tells users that exam data is needed for that track in English and Russian.
- redesigned the university detail admissions and finance experience:
  - admission tracks now render grouped funding-option cards with per-option badges, selection controls, cost previews, average-admitted blocks, extra requirements, and localized major tags;
  - the finance tab now mirrors that grouping with track-level sections, per-option breakdown cards, and clearer paid-vs-grant styling in both light and dark themes;
  - loading states for ranking, guide, universities, and university detail were simplified from blocking overlay spinners to inline status notes.
- added regression coverage for the new behavior:
  - backend tests now cover compact funding-option schema retention, alias search, conditional requirement handling, and flattened chance-scoring compatibility;
  - Playwright coverage now checks badge-priority conflicts, localized track-major chips, and Nazarbayev University compact funding-option rendering.

## 2.8.0 (2026-03-31) - score-profile chance modeling, exam normalization, and finance UI polish

Status:
- synchronized runtime/package version to `2.8.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples.
- upgraded `UniChance` from a single heuristic estimate to a two-mode model:
  - official `score_profile` chance computation now uses normalized admitted-score bands where official percentile-style data exists for a track;
  - estimated fallback mode now keeps `UniChance` available for the wider catalog when admitted-score profiles are unavailable, with lower-confidence labeling in the UI instead of fake precision.
- expanded admissions-score normalization and score-profile data:
  - added shared exam normalization support for ENT / EGE / SAT / IB / NUET and route-specific HKDSE weighted totals;
  - added or derived score-profile support for covered admission tracks in the universities dataset, including Nazarbayev University and CUHK route handling.
- improved university detail UX around admission probability and finance summary cards:
  - no-data admission states now render explicitly instead of collapsing to `0%`;
  - fallback chances are labeled as low confidence in the detail UI and per-track chips;
  - finance summary cards, price presentation, and localization handling were tightened to better match the updated detail layout.
  - finance track total badges now use consistent full-width styling between paid and grant variants, while preserving grant-specific green visuals;
  - admission track cards now have clearer spacing between entries in the detail page.
- added backend and frontend regression coverage for the new behavior:
  - backend tests now cover score normalization, score-profile wiring, no-data handling, and updated `UniChance` responses;
  - frontend helper/config changes were aligned with the new exams and chance-model metadata.

## 2.7.0 (2026-03-31) - admission-track scope cleanup, ROI salary signals, and i18n polish

Status:
- synchronized runtime/package version to `2.7.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples.
- tightened frontend-origin configuration around `FRONTEND_ORIGINS` only:
  - removed legacy `FRONTEND_ORIGIN` fallback/export from backend settings and local runtime examples;
  - aligned Docker and Playwright configs with the multi-origin env shape used by current local-dev and E2E flows;
  - corrected README environment examples and notes so they document the current CORS/runtime contract consistently.
- made startup warmup non-blocking:
  - backend startup now schedules warmup in a background thread instead of waiting synchronously during app boot;
  - added backend coverage to confirm the warmup thread is started only when startup warmup is enabled.
- cleaned up university detail product scope for admission tracks and majors:
  - backend now derives `applicable_majors` for admission tracks, localizes those labels, and includes them in the university detail payload;
  - foundation-only programs, majors, study levels, and admissions rows are filtered out from the bachelor-facing product scope when mixed with regular undergraduate data;
  - Nazarbayev University data now exposes separate NUET undergraduate tracks, adds the supporting policy source, and includes Russian translations for the new labels/descriptions.
- expanded ROI salary coverage using official outcomes data:
  - added official outcomes-based salary signals for MIT, NUS, CUHK, and University of Toronto in `backend/data/universities.json`;
  - ROI API contract coverage now checks that supported universities no longer fall back to `no_salary_data`;
  - the finance tab now hides the ROI block when no official salary data exists instead of showing an empty placeholder state.
- polished university detail and filter UX:
  - finance cards now use a roomier responsive layout and a simpler stacked header/legend arrangement;
  - the university detail cache version was bumped so clients refresh derived admission-track scope changes immediately;
  - custom selects now rebuild themselves when option text changes, which keeps translated dropdown labels in sync after a language switch;
  - universities-page country/region/city filters now refresh localized option labels in place after UI language changes.
- added regression coverage for the new behavior:
  - backend tests cover derived track majors, foundation-track filtering, localized NUET text, startup warmup threading, and ROI salary-backed responses;
  - Playwright coverage now includes custom-select i18n sync, localized universities filters, admission-track major chips, and the ROI-hidden-without-salary case.

## 2.6.1 (2026-03-30) - portable local-dev runtime and release alignment

Status:
- synchronized runtime/package version to `2.6.1` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples.
- improved local-development portability and clone-and-run ergonomics:
  - added `npm run dev:backend`, `npm run dev:frontend`, and `npm run test:backend` scripts that auto-detect local Python virtual environments instead of depending on manual activation.
  - added shared Node launch helpers for backend startup, frontend static serving, backend test execution, and project env loading.
  - frontend runtime config now derives the API base from the current host plus a configurable backend port instead of forcing `127.0.0.1:8000`, and generated `frontend/env.js` now includes `API_PORT`.
  - frontend route handling now also disables pretty URLs for plain static LAN/dev hosts on ports `5501` and `5510`, so routes like `/universities` do not break when the site is opened from another device over the local network.
  - Docker local runtime now respects overridable `BACKEND_PORT`, `REDIS_PORT`, and frontend-origin env values without requiring code edits.
  - README and local env examples now document the new cross-platform startup flow plus `FRONTEND_HOST` / `FRONTEND_PORT` overrides for custom ports, LAN IPs, and non-Windows machines.

## 2.6.0 (2026-03-30) - manual admission-track selection

Status:
- synchronized runtime/package version to `2.6.0` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples.
- added manual admission-track selection in the university detail page:
  - users can click `Select` on a specific admission track and keep that choice in local cached profile state per university;
  - `UniChance` now uses the selected track for the displayed university-level chance summary instead of always forcing the auto-best chance track;
  - `UniFit` now uses the selected track override for that university when computing ranking-facing chance and selected match data;
  - the auto-recommended track stays visible as `Recommended`, so users can clear the override by returning to the recommended track.
- added backend/profile support for `selectedAdmissionTracks`, including API payload normalization and rule-based scoring coverage for the new override behavior.

## 2.5.8 (2026-03-25, work in progress / tester build) - official facts stabilization and admissions-source cleanup

Status:
- not finalized yet; this version is being used as an intermediate tester build while current UX and data cleanup work continues.
- Synchronized runtime/package version to `2.5.8` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, and README examples.
- Stabilized curated official-facts workflow:
  - `backend/data/official_facts.json` is now the source of truth for verified optional facts added in the recent cleanup passes.
  - `backend/scripts/apply_official_facts.py` remains the canonical sync path from the catalog into `backend/data/universities.json`.
- Completed the official-facts stabilization pass:
  - restored `frontend/env.js` to an empty deploy-safe generated template;
  - re-verified MIT institutional acceptance against MIT Admissions for the Class of 2029 and synchronized the dataset to `4.56%`;
  - replaced broken official source URLs for Imperial and ETH with live official pages;
  - repaired AITU source hygiene and removed broken official-source references from touched topics;
  - filled missing `description` and `tags` fields for the remaining universities using only official university pages or official university-hosted PDFs;
  - filled TU Delft `student_count` from the official university figure with explicit provenance.
- Completed the official admissions cleanup pass for the current 20-university catalog:
  - backfilled University of Toronto acceptance into `official_facts.json` so the catalog fully covers every dataset row that exposes `academics.acceptance_rate_percent`;
  - added official institutional acceptance facts for:
    - Imperial College London: `9.89%` from official applications and new-admissions totals;
    - University of Tokyo: `31.83%` from official undergraduate applicants and successful-applicants totals;
    - Nazarbayev University: `21.0%` from the official undergraduate admissions statistics PDF;
  - left the remaining universities with `acceptance_rate_percent = null` where no official institution-wide source was found, rather than filling heuristics or aggregator values.
- Added a structured official admissions catalog and sync path:
  - introduced `backend/data/official_admissions.json` as a richer admissions/selectivity catalog for all 20 universities;
  - introduced `backend/scripts/apply_official_admissions.py` to populate `academics.admissions` in `backend/data/universities.json`;
  - added `academics.admissions.university_wide`, `academics.admissions.program_level`, and `academics.admissions.programs` without breaking the existing flat acceptance-rate fields.
- Filled the first official program-level admissions batch:
  - Imperial College London now includes official Faculty of Engineering and department-level undergraduate rows, including `Computing (BEng/MEng)` at `5.04%`;
  - University of Tokyo now includes official `PEAK` rows and undergraduate division rows with applicants/successful-applicants counts and derived rates;
  - University of Toronto now includes official Arts & Science Computer Science admission-category metadata and Faculty of Engineering first-year selectivity rows using the faculty's own `offers / applicants` semantics;
  - Kyoto University now includes the official `Kyoto iUP Undergraduate Program` row at `4.65%`;
  - Tsinghua University now includes a conservative official `Computer Science and Technology` capacity row, while broken or unstable program sources were excluded.
- Filled the next official program-level signals batch without inventing acceptance rates:
  - EPFL `Computer Science` now stores the official first-year bachelor capacity signal of `3000 places` as the safest published admissions-control metric;
  - TUM `Informatics` now stores the official aptitude-assessment cutoff of `84` points for direct admission at stage 1;
  - NUS `Computer Science (BComp)` now stores the official `Common Computer Science Programmes` grade profile plus the official intake figure of `893` places;
  - CUHK `Computer Science and Engineering` now stores the official JUPAS admission-grade profile and projected enrolment of `113` places;
  - KAIST `Computer Science` and `Mechanical Engineering` now store `verified-null` program rows because KAIST admits undergraduates undeclared and does not publish program-specific applicant/admit counts.
- Completed the final admissions coverage pass for the 20-university catalog:
  - every university now has an explicit `academics.admissions.programs` state, either with official program rows or official `verified-null` placeholders where the university does not publish program-level admissions metrics;
  - added final verified-null coverage for institution-wide-only systems and non-disclosing universities, including MIT, Stanford, Harvard, ETH Zurich, TU Delft, Seoul National University, University of Melbourne, Nazarbayev University, SDU, and AITU;
  - kept the catalog strict about semantics by preserving official `counts`, `capacity`, `grade profile`, `cutoff`, or `verified-null` rows instead of backfilling guessed acceptance rates.
- Removed Kazakh UI/runtime support from the project:
  - deleted the `frontend/Localization/kz` pack and removed Kazakh from frontend language loading, selection, fallback, and formatting logic;
  - removed Kazakh locale handling from backend translation/search normalization and from generated translation payloads;
  - removed Kazakh locale fixtures and e2e/runtime contract checks so the supported UI languages are now only `eng` and `ru`;
  - kept Kazakhstan country data, university entries, and country-flag mappings intact because they are content data rather than UI locale support.
- Surfaced the new admissions layer in the university detail UI:
  - the Admission tab now shows a compact official-admissions summary for university-wide and program-level data availability;
  - the Programs tab now renders official program-level admissions signals as user-facing cards instead of leaving the structured catalog invisible;
  - users can now see whether a metric is an official rate, counts-based signal, capacity, cutoff, grade profile, or an explicit official `verified-null` state.
- Polished the final Russian admissions wording pass:
  - removed the remaining mixed English/Russian labels in the new admissions UI;
  - replaced leftover technical placeholders such as `Applicants / offers`, `competition ratio`, and `verified-null` with clearer Russian user-facing phrasing;
  - kept standard exam names like `A-Level` as domain terms while translating the surrounding admissions language.
- Improved regression coverage for data integrity:
  - `backend/tests/test_official_facts_sync.py` now checks both catalog-to-dataset sync and the reverse condition that every dataset acceptance rate is catalog-backed with complete provenance metadata.
  - `backend/tests/test_official_admissions_sync.py` now verifies catalog-to-dataset sync and flat/nested acceptance-rate consistency for the new admissions layer.
  - `backend/tests/test_exams_api.py` was previously expanded to cover the newer exam keys exposed by `/exams/config`.
- Validation status for the recent cleanup passes:
  - `python backend/scripts/audit_universities_data.py` passes without errors;
  - HTTP audit shows no `404/410` errors on the newly touched official source URLs;
  - `node scripts/i18n-check.mjs` passes;
  - backend regression tests pass via `unittest` in the project virtual environment.
- Ongoing UX wording pass:
  - clarified that GPA percent is a UniSearch-only normalized estimate;
  - made the interests field and guide wording less technical for first-time student users.
  - removed the duplicate GPA helper line under the input and disabled the native browser tooltip so only the custom tooltip remains.
- Improved local LAN development ergonomics:
  - backend local startup now supports `BACKEND_HOST` and `BACKEND_PORT` from `backend/.env` instead of forcing `127.0.0.1`;
  - README and `backend/.env.example` now document how to allow another device on the same local network without committing a real LAN IP to Git.
