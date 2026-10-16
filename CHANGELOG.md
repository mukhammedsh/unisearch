Warning: truncated output (original token count: 64545)
Total output lines: 2048

# Changelog

All notable project changes should be recorded here.

## Unreleased

## 9.0.0 (2026-10-16) - Firebase Hosting, University Filters and Security

### Breaking Changes
- Move the public frontend from `https://unisearch-frontend.onrender.com` to `https://unisearch.web.app`; the former address now returns 404, so existing bookmarks need updating.

### Added
- Allow filtering universities by city after selecting a country without requiring a state or region.
- Publish verified Sigstore provenance bundles with release ZIPs and document online and offline verification.

### Updated
- Deploy the frontend through Firebase Hosting with clean routes, a university-detail rewrite, and deploy-time runtime configuration.
- Set `Vary: Accept-Language` on localized university-detail responses, including 304 responses, so caches separate representations by language.
- Improve university overview facts and localized filter guidance, including map-logo and tag hover presentation.
- Speed up OpenAlex factor refreshes with concurrent candidate lookups while preserving candidate ordering and fallback behavior.

### Fixed
- Replace stale legacy detail-cache entries when loading reviewed admissions data.

### Security
- Require DCO and security, quality, and test checks for pull requests to `main`; dismiss stale approvals after new pushes.

### Quality
- Expand regression coverage for admissions, program rendering, translations, language indexes, configuration, finance, cache behavior, and language-exam validation boundaries.
- Refactor university listing and detail-page initialization, program and admission rendering, admissions scoring, exam breakdowns, profile setup, comparison, guide, and custom-select internals; split audit source URL generation while preserving existing contracts.

### Documentation
- Refresh the README, accessibility guidance, security and architecture assessments, dependency and testing guidance, governance, and contributor instructions; record the OSPS Baseline Level 2 self-attestation.

## 8.1.7 (2026-10-15) - Expanded Test Coverage

### Added
- Merge Chromium browser coverage with frontend unit coverage for Codecov uploads, and cover all frontend JavaScript sources.
- Add behavioral tests for offline recovery, service worker caching, admission evidence, exam breakdowns, language validation, ML availability, exam input modes, and official-source auditing.

### Updated
- Use two local Playwright workers after validating stable API-backed runs; keep one worker in CI.

### Fixed
- Wait for map marker movement to settle before asserting that repeated clicks do not recenter the map.

## 8.1.6 (2026-10-14) - Stable Checks and Exact Source Links

### Fixed
- Seed the spacing-token reduction and use explicit stable comparators to resolve SonarCloud reliability gate findings.
- Require exact `href` attributes in official-source assertions, addressing four CodeQL findings.
- Use a patch version because these fixes add no user-facing capability.

## 8.1.5 (2026-10-14) - Code Scanning and Validator Fixes

### Fixed
- Remove an admissions catalog import cycle while preserving localized study-option search.
- Replace regex-based script filtering in the Stanford directory snapshot tool with HTML parsing, and use indexed lookups in the Imperial validator.
- Correct parser bounds, URL assertions and unused test code reported by code scanning.
- Use a patch version because these internal fixes add no user-facing capability.

## 8.1.4 (2026-10-14) - Hardened Score Validation and Updated Dependencies

### Fixed
- Reject NaN and positive or negative infinity in language score validation.

### Updated
- Upgrade Playwright and pinned GitHub Actions dependencies used by tests and CI.
- Use a patch version for input validation hardening and CI maintenance without adding a user-facing capability.

## 8.1.3 (2026-10-14) - Stable Admissions Browser State

### Fixed
- Wait for the selected program's admissions context to finish before testing action states, and verify summary-action navigation separately from pressed-state contrast.
- Use a patch version because this corrects E2E synchronization without changing user-visible behavior.

## 8.1.2 (2026-10-14) - Stable University Interaction Checks

### Fixed
- Exercise reviewed university summary actions as real navigation clicks and wait for hover and pressed styles to paint before measuring contrast.
- Use a patch version because this stabilizes browser regression checks without changing user-visible behavior.

## 8.1.1 (2026-10-14) - Reference-First Browser Check Alignment

### Fixed
- Update university admissions browser checks to follow grouped fact disclosures and current localized copy, preventing stale expectations from failing the reviewed catalog journeys.
- Use a patch version because this corrects regression checks without changing user-visible behavior.

## 8.1.0 (2026-10-14) - Reference-First University Browsing

### Added
- Let guests browse reviewed MIT, Imperial College London and Stanford University programs and published application routes before choosing optional applicant context; retain each institution's selected program and route.
- Show grouped admissions facts with clearer scope, periods, conditions, source labels and qualification tables.
- Add a CI guard for undefined CSS custom properties and static JavaScript styling writes, plus visual regression coverage for the reviewed university journeys.

### Changed
- Align interface, accessibility and source-label copy across English, Russian and Kazakh; localize unknown values and raw application-route labels.
- Refine shared design tokens, responsive layouts, light and dark theme contrast, and the brand preview.
- Use a minor version because guests gain a browsing capability while existing saved state and API contracts remain compatible.

## 8.0.0 (2026-10-14) - Reviewed Admissions Catalog and Kazakh Workspace

### Added
- Activate the reviewed MIT, Imperial College London and Stanford University catalog with official study options, actual application routes, scoped source facts, explicit unknowns and separate history.
- Add paginated study-option search and request-local admissions-context APIs; support Kazakh search aliases while retaining official program names and source prose.
- Add Kazakh interface and university localization alongside English and Russian, including the reviewed catalog, profile evidence, localized search and readable application dates.
- Support six additional admissions exams, dated test attempts and typed education, language, enrollment, GPA and credential evidence; assess only reviewed source-bound checks.

### Changed
- Start the three reviewed university pages with the institution overview and program browsing; move application controls to Admission and make additional applicant settings and detailed checks optional disclosures.
- Use the activated catalog in discovery, UniFit, saved choices and comparison without borrowing retired thresholds, unrelated costs or funding outcomes; label the other 47 institutions as awaiting review.
- Refresh the About page, founder/contact layout, profile header and responsive catalog controls.
- Establish a catalog-first research-before-update workflow for each university; preserve paused research outside runtime.
- Use a major version because the three institutions replace their previous persisted catalog/API policy fields and reset old application and comparison pointers with a visible explanation. Preserve profile evidence and other institutions' choices.

### Fixed
- Honor intentionally cleared program, route and cycle fields instead of restoring saved defaults, and prevent superseded context/detail requests from overwriting newer navigation.
- Accept valid saved SAT totals as self-reported test presence without inventing missing sections; keep unsupported or uncertain minimum checks unassessed.
- Keep per-institution saved application contexts separate from general profile preferences, distinguish unavailable scores from verified failures, and retain exact source conditions, periods, currencies and links.
- Preserve all canonical Kazakh subject aliases that share one translation, and align the new interface labels across all three languages.

## 7.2.4 (2026-10-08) - Validation and Reliability Fixes

### Changed
- Set the first ten universities in local catalog order as the admissions presentation batch and defer the remaining forty to a later delivery cycle.

### Fixed
- Reject exam submission scores outside the same 0–10,000 range used by saved profiles before exam-specific validation.
- Resolve client IPs through duplicate trusted proxy headers while rejecting malformed IP port and bracket syntax.
- Handle non-ASCII operations credentials as unauthorized input without raising a server error.
- Keep configured currency API URLs out of fetch-failure logs so embedded credentials are not exposed.
- Remove mixed-case script blocks from Stanford program-directory captures.
- Stabilize JavaScript sorting and normalization, preserve nested parenthetical program labels and flexible exam-alternative whitespace, add screen-reader labels to optional profile fields, and clip university logos to their frame.
- Use a patch increment because these validation, reliability, and accessibility fixes add no new user capability.

## 7.2.3 (2026-10-04) - Imperial and Stanford Research Recheck

### Changed
- Record comprehensive official-source content and applicability rechecks for the Imperial College London and Stanford University Stage 1 drafts, with dated evidence ledgers and reviewed coverage outside active runtime data.
- Normalize draft evidence fingerprints so Windows and Unix line-ending conversion does not invalidate unchanged source files.

### Fixed
- Restore Imperial award-specific curriculum selectors, classify internal Medicine PhD progression correctly, and scope research phases, joint-program sources, costs, and funding terms to their actual contexts.
- Restore complete Stanford applicant-condition prose and preserve route-specific rules across external, coterm, internal, hybrid, joint, and professional study contexts.
- Use a patch increment because this research recheck changes draft evidence only and adds no runtime capability.

## 7.2.2 (2026-10-03) - Imperial and Stanford Research Drafts

### Added
- Add reviewed Stage 1 admissions research drafts for Imperial College London and Stanford University, retaining institution-specific study options, application contexts, official-source evidence, and scoped unknowns outside active runtime data.

### Fixed
- Restore thirteen omitted Imperial Overseas fee amounts and record Stanford's MSPA deadline with its 2026-27 application-cycle scope, published time zone, and CASPA status requirement.
- Use a patch increment because the research drafts and fee corrections do not add a runtime capability.

## 7.2.1 (2026-09-30) - Operations and Telemetry Hardening

### Fixed
- Require operations authorization for every supported true health-warmup value and for protected routes served under an ASGI root path.
- Filter credential headers, session fields, and the configured operations header from both Sentry error events and transactions; disable stack-frame local capture to avoid retaining raw request copies.
- Keep ClusterFuzzLite compilation unprivileged, install a hash-locked schema dependency set, and bundle backend imports and catalog data into both fuzz targets.
- Measure the MIT program title and badge in the same animation frame to prevent false E2E alignment failures without relaxing the layout assertion.

### Changed
- Add same-origin opener isolation and disable legacy cross-domain policies on API responses.
- Update Uvicorn, Sentence Transformers, and Sentry SDK with synchronized runtime and development locks; refresh pinned CodeQL, setup-uv, and Codecov actions.
- Use a patch increment because these changes harden existing behavior and maintenance workflows without adding a product capability.

## 7.2.0 (2026-09-30) - Admissions Context and MIT Catalog

### Added
- Add sourced English and Russian study summaries, localized department labels, and direct MIT degree-chart links for all active MIT undergraduate options.
- Add internal EECS MEng study options for MIT Courses 6-7P and 6-14P, linked to their shared application route and official degree charts.
- Add the MIT Sloan MSMS partner-school application route with its 2027 deadline and a separately dated 2026-27 tuition-and-fee reference.
- Expand MIT's runtime catalog with sourced master's, doctoral, and advanced professional degree options and their verified program or department application targets.
- Add the internal MIT Course 6-9P MEng route with published technical and overall GPA minima, its recurring application window, and explicit funding uncertainty.
- Add source-backed master's and doctoral study descriptions with Russian translations for the new MIT catalog options.

### Changed
- Correct the EECS MEng application closing description to the last day of finals, as published by MIT EECS.
- Use profile defaults and restorable detail-page program, study-level, applicant-route, and entry-cycle selections across admissions, qualification guidance, deadlines, costs, and academic estimates. Scope UniFit and ROI inputs to compatible catalogued choices.
- Define UniChance's percentage as the share of evaluable published academic and language minimums met, with no score when evidence or measurable minimums are missing. Show historical admitted or enrolled score ranges and acceptance rates as separate facts instead of treating them as an admission probability.
- Include the applicant's annual budget and applicable pre-award annual cost in UniFit ranking when both are known. Omit missing academic and cost components instead of substituting a neutral percentage; keep funding outcomes separate from admission assessment.
- Keep UniChance unscored when a route's published minima have not been reviewed or cannot be checked from the existing profile, with a distinct explanation for each state.

### Fixed
- Restore readable university titles and prevent horizontal overflow on mobile after the shared detail-header update; make the no-exact-deadline calendar guidance accurate for collapsed MIT timelines.
- Add a sourced undergraduate Business Analytics (Course 15-2) curriculum summary and direct MIT catalog and Sloan curriculum links; distinguish degree requirements from admission prerequisites.
- Group program metadata beside its labels, show study descriptions as readable paragraphs, and expose official program sources and the shared MIT first-year application context. Identify summaries that have not yet been collected, and use a badge instead of a full-card accent fill for the selected major.
- Keep single-option route and cycle controls visible, distinguish absent published minimums from missing applicant evidence, and make historical score ranges expandable in admission details.
- Put selected program, route, cycle and official course conditions before optional catalog coverage and historical statistics. Clarify that numerical requirements fit does not assess separate textual conditions.
- Preserve Russian program selections across admissions and costs, localize reviewed route/deadline/cost text and save-button accessibility labels, and keep Stanford first-year aid deadlines out of transfer funding views with an official transfer next step.
- Keep Stanford undergraduate Computer Science separate from professional admission summaries and give Imperial Computing BEng/MEng its own officially sourced 2027 requirements.
- Preserve MIT Spring transfer applicant restrictions beside deadlines and in calendar exports. Keep missing costs distinct from published zero amounts and prevent undergraduate costs from substituting for graduate costs.
- Remove grant-odds and paid-admission badges that inferred outcomes from the academic fit score.
- Correct MIT's Common Data Set ACT percentiles and remove unsupported Early Action SAT Composite statistics and mislabeled score averages.
- Remove an unsupported separate MIT City Planning SM listing and identify the Transportation master's award and application path as MST.
- Show restricted MIT graduate eligibility in the selected-program admission context and remove an unverified external route for two EECS Engineer awards.

## 7.1.0 (2026-09-24) - Cover Back Button and Steadier Map Interactions

### Added
- Added a circular back button overlaid on the university detail cover, replacing the previous "Back to list" link in the header actions; the label is shortened to "Back" in English and Russian.
- Showed the Total Students and Study Formats rows in the university overview section instead of the extra section.

### Fixed
- Hardened map "fly, then open the card" flights: concurrent flights are serialized so rapid clicks can no longer reopen a stale card, a repeat click on the focused marker keeps the focus, and the card opens only after the flight actually arrives, never after the user takes over the map.
- Kept the catalog filter sidebar stable while scrolling by deriving its height from the sticky top offset instead of the live scroll position.
- Stabilized profile and catalog metric tooltip stacking across open, closed, and closing states.

### Changed
- Moved the low-budget grant hint from the budget block to the funding-preferences block on the profile page.

## 7.0.0 (2026-09-24) - Scoped Admissions Facts and Product Direction

### Added
- Expanded selected MIT, Imperial College London, Stanford, Harvard, and Oxford records with more program- and route-scoped admissions, deadline, price, and funding facts, including official sources, applicable cycles, fee statuses, and publication states.
- Showed unpublished or conflicting course deadlines and fees with their scope, official source, and a useful next action instead of presenting an unsupported date or amount.
- Established the [admissions product model](docs/admissions-product-model.md) and [migration checklist](todo.md) for the next stages: complete top-five catalog and schema drafts, coordinated backend/frontend integration, then the remaining 45 universities. This documents planned work; the new model is not yet the runtime format.

### Fixed
- Kept Oxford test-booking dates out of course-application deadline coverage and preserved separate dated, undated, and conflicting deadline states.
- Corrected selected top-five coverage for historical versus unpublished fees, program-specific costs, and shared versus program-specific application routes.

### Removed
- Removed the application planning workspace and its saved checklist interface. Admissions and funding information remains available in university details. This removal changes the previously committed `6.14.0` workflow, so this release uses a major version.

## 6.14.0 (2026-09-24) - Applicant Planning and University Coverage

### Added
- Expanded applicant profiles with citizenship, education background, target study level, entry cycle, route context, and optional annual family income saved locally.
- Added program-scoped admissions, deadline, cost, and funding coverage, qualification guidance, structured award details, and an applicant planning workspace.
- Added dated deadline calendar views and English/Russian guidance for missing program facts.
- Added official-source data for selected undergraduate, master's, doctoral, and professional routes at MIT, Imperial College London, Stanford, Harvard, and Oxford; coverage remains limited to catalogued routes.

### Changed
- Refined UniFit and applicant profile handling for broader study-level and route context.
- Kept UniChance independent of budget and grant preferences, and displayed family-income comparisons with published aid thresholds as context rather than an eligibility or award decision.
- Clarified funding conditions, application steps, and deadlines; potential awards are not treated as guaranteed or deducted from published costs.

## 6.13.0 (2026-09-23) - Seamless Localization and Calm Interactions

### Added
- Made the profile save state permanently visible next to the back button with distinct saved and unsaved coloring.

### Changed
- Switched navbar and favicon logos from PNG to theme-aware SVG.
- Removed the map "Show the whole world" overview control; world navigation remains available through the zoom controls.
- Standardized section tabs on a 2px pill sliding indicator with matching fallback underlines across catalog, detail, admissions, and profile pages.
- Replaced press-shift active effects with surface-color active states backed by a shared accent active-surface token.
- Restyled segmented view toggles, the settings switch, and filter reset controls for consistent surfaces and alignment.

### Fixed
- Fixed English text flashing when navigating client-side with Russian selected by hydrating localizations from session cache and translating the destination page before display.
- Kept the dismissed Bachelor's scope notice hidden across SPA navigation without flicker.
- Showed the shared "No data" label instead of field-name placeholders for missing university facts.
- Corrected Russian save-state and availability copy.

## 6.12.0 (2026-09-21) - Major-Aware UniFit Catalog

### Added
- Kept universities without the selected study program in UniFit results, lowered their fit ranking, and marked them with a localized "Program Not Offered" status so applicants can compare alternatives transparently.
- Added an accessible overflow control for extra catalog-card status indicators, including outside-click and Escape-key dismissal.
- Standardized hover, active, focus, and disabled control states through shared interaction tokens and composite input surfaces.

### Fixed
- Rejected fractional annual budgets in profile API payloads to keep the integer budget contract consistent across clients.

## 6.11.0 (2026-09-21) - Interactive University Programs

### Added
- Reworked the university Programs tab into collapsed-by-default detail accordions with per-program admissions data and single-open behavior.
- Added live program search with result filtering, a clear control, an empty state, and a persisted query per university.
- Added profile-major matching that pins matching programs first with a "Your major" badge and localized field tags.
- Re-rendered the Programs tab when the applicant profile changes so major matching stays in sync.
- Added English and Russian strings for program detail toggles, search controls, and the major badge.

### Fixed
- Kept every program card collapsed when entering the Programs tab instead of auto-expanding the first program.

## 6.10.3 (2026-09-21) - Map Results Lifecycle Test Completion

### Fixed
- Covered map result-rail creation on demand after both initial load and a list-view reload, completing the scalable map release regression coverage.

## 6.10.2 (2026-09-21) - Map Results Lifecycle Fix

### Fixed
- Updated map-view interaction coverage for on-demand result-rail rendering, preventing a stale preloading assertion from failing the release test suite.

## 6.10.1 (2026-09-21) - Map Catalog Isolation Fix

### Fixed
- Prevented hidden map-result cards from duplicating catalog cards in the list DOM before the map is opened.

## 6.10.0 (2026-09-21) - Scalable Interactive University Map

### Added
- Added a compact, bounds-aware university map-points API for client-side Leaflet clustering, avoiding full catalog card payloads for map markers.
- Added progressive loading to the map result rail in pages of 100 universities, with automatic continuation and an accessible manual retry/load-more control.
- Added complete university-card hydration when opening a map marker, plus clear map zoom controls and a return-to-world action.

### Fixed
- Kept Leaflet university markers visible when the map wraps horizontally and prevented blank map areas beyond the north and south limits of the Web Mercator projection.
- Matched map popup pointers to their university cards in light and dark themes and removed vertical card movement on map hover.

## 6.9.1 (2026-09-21) - Anti-Vibe Coding Guardrails and Code Quality Hardening

### Added
- Added automated…52545 tokens truncated…und the richer data:
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

## Earlier unversioned admissions changes

### Added
- Support GRE General Test section scores without inventing a total, alongside distinct current and legacy GMAT scales, throughout profile validation, persistence, and admissions evidence checks.
- Add Cambridge C2 Proficiency as a distinct language certificate and validate the reported C1/C2 score ranges.
- Show published requirement checks with the applicant's evidence, missing information, and assessment status in admission routes and UniFit card explanations.

### Fixed
- Preserve unknown program, route, and cycle applicability instead of applying unrelated minimums or cost defaults; keep unsupported language checks and unassessed source conditions visible.
- Preserve explicit empty program mappings during catalog loading so unlinked routes do not borrow other programs or their score data.
- Distinguish unknown academic fit from a verified failure, scope funding badges to the selected route, and explain the actual annual cost, budget, and preference indicators used by recommendations.
- Display published funding coverage instead of replacing every grant with a generic competitive-award claim.
- Review MIT graduate and professional route policies against official sources, retain exceptions and conflicting or yearless facts explicitly, and extend the shared transfer mapping to all undergraduate study options.
