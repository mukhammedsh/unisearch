# Changelog

All notable project changes should be recorded here.

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
