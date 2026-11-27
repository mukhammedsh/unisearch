# Changelog

All notable changes to UniSearch are documented here.

## 10.10.2 (2026-11-27) - Profile overview, section editors, and a mobile Guide

The profile now uses focused section editors on phones and a side-by-side layout on wider screens. Profile dates and university deadlines share the same calendar design. On phones and tablets the Guide opens as a list of topics.

### Added
- Preview a linked Guide article by pointing at the link or moving keyboard focus to it on a computer.
- Link Guide text to specific parts of an article, such as how UniFit uses your budget. The profile's budget, grades, and language sections and the university requirements check now link to the matching Guide articles.
- Add quick filters for Kazakhstan, bachelor's programs, and verified universities above the catalog on phones and tablets.

### Changed
- Show saved answers in the profile overview. Open one section at a time on phones or edit alongside the overview on wider screens. Save appears after an edit, and switching sections prompts you to keep, discard, or save your changes.
- Move the UniFit guide next to UniFit sorting in the university catalog.
- Open the Guide on phones and tablets as a list of topics. Each topic has a header that stays visible while you scroll, the contents open in a sheet from the bottom of the screen, and the Previous and Next links are larger. The phone's Back button and the list button in the header return to the list, even after you follow links between topics.
- On wide screens, stack the Guide's getting-started steps in one column and align the Guide's contents list. The minimum requirements match is now explained with an example instead of a formula, and the remaining formulas sit directly inside their expandable blocks.
- Use the same calendar layout, navigation controls, and selected-day style for profile dates and university deadlines.
- Use the standard month selector in the profile and mark deadline dates with a dot.
- Show the saved funding preference and the number of additional exam results in the profile overview.
- Group digits in the catalog price fields, such as 46 000 000, and rename the filter options to "All countries" and "Only verified universities".

### Fixed
- Remove the Guide's mention of an icon legend above the catalog, which no longer exists.
- Put the Guide's Previous and Next links in the same order as its contents.
- Keep profile actions reachable in landscape and allow confirmation dialogs to scroll on short screens.
- Keep keyboard focus outlines visible at the edge of the profile form.
- Protect profile drafts when navigating back and restore catalog filters when returning to the results.
- Remove the browser's step buttons from the calendar year field while keeping keyboard entry.
- Center a one-line photo credit on phones instead of leaving empty space below it.
- Load universities in the map view on the hosted site instead of sometimes showing "0 universities found".
- Show the university name in the browser tab title on university pages.

### Maintenance
- Document the requirement to reuse existing UniSearch components, helpers, and design tokens before adding new ones.

## 10.10.1 (2026-11-26) - Tooltip interactions, preferred-currency defaults, lighter admissions tabs, Kazakh-first locale, and UniFit fixes

### Changed
- Simplify reviewed university Admission, Dates, and Costs tabs across English, Russian, and Kazakh by removing defensive disclaimers, repeated deadline and budget notes, and inline source numbers, sizing the official application button compactly beside neighboring actions, and tightening MIT admissions summaries.
- Keep desktop mouse tooltips transient on hover and keyboard focus without press states or click-to-pin behavior, let mouse clicks on university card price, rank, and status tooltips open the university normally, and preserve tap-to-open tooltips on touch and stylus screens.
- Default price display to the visitor's preferred currency in every region so cards and comparisons stay compact, while keeping the exact original-currency price available inside catalog price tooltips and university cost details whenever a price is converted.

### Fixed
- Separate the top key-facts summary from the budget breakdown and detailed sections on reviewed university Costs and Dates tabs using the standard section spacing.
- Hide the redundant UniFit toolbar profile link once ranking inputs are filled, keep the setup link visible when ranking inputs are missing, and lay out the narrow UniFit status row in a grid so touch targets do not stretch wrapped line spacing.
- Align single-line university card prices flush with the details link at the bottom of mobile cards while preserving the touch tap area.
- Open UniSearch in Kazakh on a visitor's first visit from Kazakhstan while honoring any saved language choice or `?lang=` link parameter, negotiating against the full ordered browser language list elsewhere, and keeping automatic defaults out of persistent storage until the visitor switches languages manually.
- Load the cached UniFit interest-matching model locally before contacting Hugging Face so startup does not stall on network or SSL checks when the model is already present.

## 10.10.0 (2026-11-26) - Comparison PDF export, spotlight tour, profile calendar, and mobile refinements

Minor release: add comparison PDF export, a live four-step catalog spotlight tour, a localized profile date calendar, editable per-university program subject filtering, and bidirectional cover transitions. Streamline reviewed admissions reading, profile navigation and spacing, inline UniFit toolbar controls, and narrow-viewport responsiveness.

### Added
- Add a profile back button beside the title, above the window on narrow screens.
- Morph the university cover photo smoothly back into its catalog card when returning via the back button or browser history while both images are visible on screen.
- Export reviewed university comparisons to PDF with the selected programs, deadlines, requirements, costs, aid, and official sources.
- Add a relaunch action in the Getting Started guide to open the interactive catalog tour at any time.

### Changed
- Replace the six-slide text-only first-visit modal tutorial with a compact four-step spotlight tour anchored to live search, profile, university card, and comparison controls, skipping deep-linked filtered URLs.
- Activate UniFit catalog sorting automatically when a visitor saves a profile with a subject, budget, GPA, study level, or interests even before adding exam scores.
- Replace the profile date picker with a localized calendar featuring Clear and Save actions, stable month layout, smooth closing transitions, and clean month-picker controls.
- Keep the profile header and actions visible while scrolling independently, show additional profile details directly, simplify field descriptions, and use a single GPA scale selector.
- Move the profile's UniFit matching summary to a guide link in section navigation, simplify actions to Save and Back, place the GPA help button beside the scale label, clarify the English-background prompt, and show MIT evidence options immediately.
- Lead reviewed university comparisons with deadlines, actionable requirement checklist notes, and costs, showing route, intake cycle, and selected program in headers and adding an inline program picker in dependent cells.
- Preserve active catalog search, filters, and scroll position when returning via the university cover back button, and mount cached university pages directly without flashing the loading skeleton.
- Clarify optional English-test recommendations (`minimum` vs `recommended`), shorten the Russian `IELTS` label to `IELTS Academic`, show met or below-minimum status when a score exists, and simplify missing-score prompts.
- Remove duplicate test, condition, and tab-intro text on reviewed university Admission, Dates, and Costs tabs while shortening heavy admissions labels across all three languages and keeping official sources intact.
- Simplify legacy university Admission cards by hiding empty average-admitted boxes, single-profile count badges, technical category kickers, and boilerplate funding notes.
- Shorten catalog filter, sort, UniFit, and card-tooltip copy into plain applicant-friendly wording across English, Russian, and Kazakh.
- Replace the catalog's UniFit notice card, duplicate Preferences button, and second-row badge legend with a compact inline toolbar status row and info tooltip while keeping the grid aligned with the sidebar.
- Display UniFit preference slider strength from the centre (`0–100%`) alongside qualitative strength tiers (`slight`, `moderate`, `strong`) and a centre-origin active track fill.
- Replace temporary profile-suggestion chips on reviewed university Programs tabs with an editable Subject filter alongside Study level, pre-filled from the applicant profile and saved per university.
- Make the university cover map's campus marker interactive so clicking or activating it centers and zooms the map to the campus like the off-screen recenter button.

### Fixed
- Fix profile field grouping, spacing, and alignment across additional details, yearly budget, expanded exam breakdowns, language section scores, back button, and mobile action bar, refresh notification styling, and keep profile notifications clear of the bottom action bar.
- Fix cover transition ghosting, corner clipping, and map popup corner radius.
- Collapse identical rounded converted price-range endpoints, link missing exam checklist prompts to the profile, show shared route names in comparisons, keep official fee-status links after selection, and clarify the Russian "Both" label.
- Unify the comparison tray badge, university chips, and equal-width Clear/Continue buttons on one consistent height, spacing rhythm, and corner radius while keeping chip remove buttons compact.
- Remove inconsistent drop shadows on flat-card subtle buttons and restore transparent ghost styling for the "Browse all official options" button beside program filter chips.
- Fix mobile and narrow-tablet catalog toolbar wrapping, keep controls on one row down to 320px viewports, wrap inline comparison program-picker buttons without horizontal overflow, keep the Filter button visible while the drawer is open, center wrapped two-row navbars on ultra-narrow screens, and stack card details links below prices.
- Refine the responsive footer on tablets and phones with a compact left-aligned grid keeping GitHub beside the copyright, inline dot separators, and single-line links.

## 10.9.0 (2026-11-26) - Static snapshot delivery, campus cover maps, site-wide motion, and UI unification

Minor release: split admissions storage for lazy loading, add a deploy-time static snapshot so public pages run without waking the backend, introduce interactive campus cover maps with a Photo/Map switcher, and streamline university pages and the Guide. Unify UI controls, surfaces, floating layers, and calm site-wide motion across both themes.

### Added
- Add a deploy-time static snapshot pipeline (`npm run build:snapshot`) exporting catalog lists, map metadata, localized details (`eng`, `rus`, `kaz`), translations, reference configs, and campus photos for Firebase Hosting.
- Serve public catalog, map, search, university detail, and comparison reads from the static snapshot with service-worker caching, keeping profile-based UniFit, cost, and admissions assessments on FastAPI.
- Add an interactive campus location map inside the university cover area when coordinates exist and no photo is available, with zoom controls, an off-screen recenter button, dark-theme tiles, and a link to the full map.
- Add a lazy-loaded `Photo | Map` segmented switcher on university detail covers that have both a campus photo and coordinates.
- Add calm enter and exit motion for native dialogs and popovers, unfolding select panels, and hover-delayed tooltips while opening keyboard-focused and neighboring tooltips immediately.
- Add smooth catalog transitions for dependent filters, the UniFit notice and preferences panel, list/map crossfades, single-chip compare tray updates, and quiet result count fades while keeping restores instant.
- Add directional slide transitions for university tabs, comparison steps, and Guide sections, and morph catalog card photos into university page covers during navigation.
- Add smooth entrance and collapse transitions when adding or removing profile exam or language rows, plus smooth disclosure animations on university, profile, and Guide pages.

### Changed
- Split the monolithic admissions catalog (`16.5 MB`) into a compact index (`~391 KB`) and per-institution files loaded lazily via an LRU cache (`MAX_LOADED_INSTITUTIONS = 6`) with SHA-256 verification.
- Serve startup metadata, catalog lists, map points, university detail contracts, subject matching, reference costs, ML program names, and unselected UniFit evaluations directly from the compact index.
- Fail explicitly on checksum or index drift between the admissions index and per-institution files.
- Remove the redundant disclaimer footnote and raw institutional info dump from university Overview tabs, keeping "About the university" directly above "Key admission facts".
- Sync the Overview admissions summary with the active selected program or shared first-year route across all reviewed universities, and hide the admissions reference summary bar on Overview and Programs tabs.
- Tighten desktop padding on the admissions reference summary bar while preserving 44px touch targets on mobile.
- Remove the redundant program tab strip and Deadlines/Costs jump buttons from the legacy Admission tab while keeping the comparison program selector.
- Replace "Campus photo unavailable" error text on catalog cards with a calm icon-only placeholder.
- Rewrite the Guide in English, Russian, and Kazakh in plain language covering catalog browsing, UniFit, admissions requirements, comparisons, and exams.
- Organize the UniFit Guide article with subheadings, place the formula after the explanation, and add cross-links from catalog badges and related articles.
- Improve Guide readability with a sticky sidebar, narrower article column, clearer active-article indicator, softer body text, and matching Previous/Next and Back link styles.
- Align university header actions with the top of the title and adapt the cover back button to the active theme.
- Align university section tabs with the page title and content column on desktop and remove the empty left scroll-arrow gutter when tabs overflow on narrow screens.
- Simplify the catalog filter sidebar by removing the AI-tags hint, price-filter disclosure, and outdated Sort tooltip, hiding City until a country is chosen, and showing Relevance sort only during active search.
- Remove the legacy "Data coverage in UniSearch" disclosure from university Overview tabs.
- Omit empty overview facts, missing global ranks, empty descriptions, missing website buttons, and decorative focus-tag chips on university detail pages.
- Combine university descriptions and key facts into one top "About the university" section with a compact single-fact layout, and render empty comparison cells as `—` instead of "N/A".
- Standardize control heights, corner radii, and segmented controls across catalog, guide, profile, and 404 pages, and drop conflicting hardcoded fallback durations from motion stylesheets.
- Use consistent 240 ms crossfades for navigation, theme changes, and campus photo switches while honoring reduced motion, and add visible hover and press feedback on interactive controls.
- Remove 1px outline rings from cards and counters so nested controls inside soft cards elevate cleanly in dark mode without borders.
- Unify button hover, press, and focus-visible states across all pages, keeping neutral presses and open triggers neutral while reserving Indigo for primary CTAs and persistent selected controls.
- Align page-background buttons and toolbar shells with dark-mode navigation and sidebar controls across catalog, map, comparison, and mobile guide toggles.
- Unify floating menus and popovers on shared dropdown styling, removing the duplicate heading inside the Recently Viewed popover and moving "Clear all" to its bottom footer.
- Unify all instant toggle switches across catalog, settings, and comparison on a `36×20px` switch layout with clickable settings labels and synchronized row hover feedback.
- Standardize text, search, numeric, date, and textarea fields, dropdown triggers, and action buttons on shared size, corner-radius, hover, focus, invalid, and disabled states across all pages, including custom dropdown styling for comparison track and admissions context selectors.

### Fixed
- Restore stacked flex layout, header separation, cost-label wrapping, and tag spacing on legacy admission funding cards across university detail and comparison views.
- Keep navbar search suggestions populated while fading out, and keep upward-opening select panels collapsing toward their trigger instead of jumping below it.
- Stop the compare tray from replaying its entrance animation on every selection change.
- Match the university loading skeleton cover height to the real cover at every breakpoint, and stop re-animating all comparison columns on each track choice.
- Stop re-animating every profile exam and language row when a single row changes.
- Restore browser-history navigation from the Guide and fall back to the homepage when a Guide article is opened directly.
- Preserve open dropdown trigger surfaces and keep custom select menus visibly elevated above card backgrounds in both themes.
- Open a selected university's map card after the map settles at its location.
- Fix hover and active surface feedback on catalog filter reset buttons and program search clear controls.
- Keep the navigation search icon clear of the placeholder text.
- Keep long admissions and comparison actions inside narrow phone layouts.
- Fix the dark-theme focus outline on the comparison picker search field and remove unused design tokens.

### Maintenance
- Add a design lint rule flagging raw transition durations and easings alongside an automated UI primitives guard, dev component showcase, unit tests, and E2E tests for static snapshots, lazy admissions loading, motion layers, and cross-page interaction states.
- Stabilize admissions retry coverage so background context refreshes do not alter the selected program's failure state.
- Capture view-mode crossfades before they finish so motion coverage remains reliable on fast workers.

## 10.8.0 (2026-11-24) - Frontend redesign and applicant UX improvements

Minor release: redesign the surface ladder and Indigo palette, refine compact UniFit card badges and collapsible preferences, and upgrade reviewed university pages. Improve initial map framing, add a 3-step Guide overview and comparison university switcher, and enforce automated layout and accessibility checks.

### Added
- Add an automated Playwright geometric layout and Axe WCAG accessibility audit (`npm run audit:layout`).
- Add a `Detailed admissions data` filter in the catalog and map views.
- Add a 3-step "Getting started" overview section with direct catalog and profile links in the Guide.
- Add in-place searchable "Change university" picker dialogs on both reviewed and legacy comparison column headers.
- Add live debounced program search on reviewed university pages, study-level labels on profile quick-pick chips, and a quick-jump deadline strip above a compact calendar.
- Add a server wake-up notice on API-backed pages that probes `GET /health` at low priority, explains delays over 3.5 seconds while the free host wakes, and refetches data after recovery.
- Add a 7-day browser cache for up to four catalog list requests (including UniFit-sorted lists) to show saved results when fresh requests take over 1.5 seconds, documented on the privacy page.

### Changed
- Exclude unpublished research drafts from Docker images and record the hosting, data-delivery, and catalog memory-limit plan in project documentation.
- Move the network status banner below the navigation bar so it never covers the search field.
- Refine the 4-tier neutral surface ladder, Indigo accent palette (`#4F46E5` light / `#5850EC` dark), WCAG AA status contrast, text wrapping defaults, and brand logos.
- Add frosted backdrop blur to the navbar and profile sticky action dock, inline mobile filter triggers, tabular numbers on pricing and tables, and readable map card scrims.
- Keep catalog card grids uniform with up to four compact semantic status icon badges (including study-level budget guidance), a collapsible UniFit icon legend, and a collapsible preferences panel.
- Upgrade reviewed university pages to jump straight to Admission when picking a program, strip duplicate prefixes on program cards, support camelCase study levels, and toggle the selection editor cleanly.
- Redesign university Overview key facts as a single borderless stat strip with one collapsed Sources disclosure, and flatten the Overview admissions grid so dates and costs sit side by side.
- Fix initial Leaflet map framing (`[-58, 83]` latitude clamp excluding Antarctica), collapse Guide formulas inside disclosures, and remove 3-line truncation on comparison checklists.
- Resolve layout overlaps, 3-track scrollable university tabs, mobile touch target compliance (`<= 768px`), and keyboard focus across 72 page loads and 288 viewport checks.
- Toggle conditional language form fields consistently in the profile, explain overall versus section language exam scores, and tighten section-score group spacing.
- Replace native checkboxes and radios on the `Detailed admissions data` filter, comparison `Differences only` toggle, and profile GPA scale with custom borderless switches and radios.
- Switch the README header logo to theme-aware SVGs and link the OpenSSF Scorecard badge directly.

### Fixed
- Exempt plain `GET /health` liveness probes from the global rate limiter so uptime checks do not exhaust the 500,000-command monthly Redis quota, while keeping warmup queries protected.
- Cache cross-origin production API responses in the service worker (versioned per release while excluding `POST` profile requests) so offline notices match real cached data.
- Fix Russian mobile and tablet legal footer link wrapping so long labels wrap into two balanced lines without breaking words.
- Keep a single browser history entry when selecting a study option switches directly to the Admission tab.
- Pan expanded Leaflet map marker popups back into the viewport after loading full university cards to prevent top-edge clipping.

## 10.7.2 (2026-11-23) - Frontend code quality and modularization

Patch release: add frontend JavaScript static analysis tooling, remove dead code and duplicates, and modularize large frontend page controllers.

### Maintenance
- Configure frontend JavaScript linting, dead-code detection, and clone checks using Oxlint, Knip, and jscpd alongside CI checks.
- Fix all frontend Oxlint errors, empty catch blocks, unused exports, duplicate settings constants, and cross-file clones while enabling global undefined-variable checks.
- Decompose the catalog, university detail, profile, and language JavaScript controllers into smaller focused, acyclic modules.
- Break the runtime/i18n import cycle, scan frontend JavaScript for hardcoded copy via AST parsing (localizing navbar options), and remove 396 unused localization keys across English, Russian, and Kazakh.
- Remove all 14 remaining inline style attributes across frontend markup and add JSDoc annotations and unit tests for catalog query state and API caching.

## 10.7.1 (2026-11-23) - Security hardening and dependency maintenance

Patch release: harden API rate-limiting and error-response security headers, optimize search and scoring caches, and update backend and CI dependencies.

### Changed
- Precompile regex patterns, cache stems, precompute deduplicated search tables with branch-and-bound pruning, and add a 3-row DP array with an `O(n)` fast path for edit-distance `<= 1` in search.
- Add identity-validated lookup caches for expanded admission choices, language exam metadata, admission translations, and localized search aliases.

### Removed
- Retire unused backend API routes (`POST /universities/{id}/uni-chance`, `POST /universities/{id}/roi`, `POST /universities/compare-profiles`, `GET /stats`, `GET /currency/status`), filter parameters (`min_acceptance`, `max_acceptance`, `size`), and legacy ROI/UniChance UI code.

### Security
- Strip ASGI `root_path` prefixes before classifying expensive POST endpoints and building rate-limit keys, closing a rate-limiter bypass under path prefixes (PR #183).
- Apply standard API security headers to admissions catalog 404 and 503 error responses (PR #184).

### Maintenance
- Update backend Python dependencies and GitHub Actions workflow versions (PR #191, PR #210).
- Configure Ruff linting (`npm run lint:backend`) and `mypy` static type checking (`npm run typecheck:backend`) across the backend, resolving type-narrowing and Redis/Sentry typing issues.
- Deduplicate backend router parameters and HTTP cache helpers, standardize Python 3.12+ syntax, reduce `Any` annotations, and narrow broad exception catches.
- Decompose `ai_scoring`, `universities`, `university_coverage`, and `university_tracks` services into focused modules and sync architecture and admissions documentation.

## 10.7.0 (2026-11-21) - Name universities on the map and search every name

Minor release: map markers now identify each university by name, search matches every name across English, Russian, and Kazakh, and reviewed university pages default to plain-language checklists and active first-year paths.

### Added
- Label each university map marker with a short name or established abbreviation (such as MIT, KBTU, or Kazakh ҚБТУ) next to a graduation-cap icon, returning `map_label` from the map-point API.
- Label merged map groups after the highest-ranked university in the active sort (such as "MIT +11" or "КазНУ +12"), updating labels on sort changes and widening merge radius to avoid overlaps.
- Store official names, main abbreviations, short names, and alternative transliterations in English, Russian, and Kazakh in `backend/data/university_name_variants.json`, citing official pages for Kazakh forms.

### Changed
- Match university search across official names, abbreviations, and alternative names in all three languages regardless of interface language, support single-word Russian program queries, and badge only true abbreviations.
- Show university campus photos as faded backdrops in map-mode result cards, matching university comparison cards.
- Move the study-level selector into the catalog filter sidebar, turn Recently Viewed into a compact toolbar popover with Clear all, and size the desktop filter panel to the viewport with scroll fades.
- Unify catalog toolbar heights, corner radii, icon sizing, wrapping on `320px` screens, and exclusive `aria-pressed` List/Map states across desktop, tablet, and mobile.
- Flatten intermediate nested card wrappers across admissions, finance, comparison, and profile sections with hairline dividers, add accessible dark-mode accent text tokens, and tidy About page dividers.
- Open MIT, Stanford, and Nazarbayev University Admission, Dates, and Costs tabs on their shared first-year path by default, keeping Imperial program-first with up to three subject-matched one-click program picks.
- Open Nazarbayev University's regular first-year, Foundation Year, transfer, and mid-year paths without requiring a program first, and list program-specific paths ahead of shared paths.
- Stop listing post-offer funding applications as entry paths, link directly to grant conditions with a return button, and rename "Select program" on Programs to "See admission for this program".
- Show published academic and language minimums—including IELTS and UNT section minimums, MIT's recommended English test (when non-native), and Kazakhstan document guidance where no ruling exists—as a key-facts checklist.
- Mark met overall scores with missing section breakdowns as "Partly checked", list recommendations separately from required prep, and keep check details behind one closed Sources disclosure.
- Count entered SAT or ACT scores as provided for Stanford first-year and transfer admission, show "Apply through UCAS" for Imperial, and add a button to open Imperial's fee-status field.
- Show entry-year fields only when a path has multiple intakes or needs one, show fee status only where fee classes exist (UK Home/Overseas), and list IELTS, TOEFL iBT, Duolingo, and PTE shortcuts in the profile exam editor.
- State calculated yearly costs as explicit tuition-plus-living breakdowns (`Tuition $15,000 + living ≈ $3,600`), add NU application/late fees (`10,000 ₸`, late `30,000 ₸`), and show up to five funding lines in key facts.
- State MIT's need-blind and Stanford's need-aware full-need international financial aid policies in one sentence across English, Russian, and Kazakh.
- Replace technical and research jargon across English, Russian, and Kazakh admission pages, name rounds in the interface language with official terms in brackets, and note when recurring deadlines omit the year.
- Explain under the Overview admission rate that it is the share of all applicants rather than personal probability, and open Dates and Costs tabs with plain answers.
- Offer explicit `4.0` and `5.0` GPA scale choices in the profile with automatic switch hints for grades between 4 and 5, place English section scores directly below overall scores, and keep typed budget amounts unchanged when changing currency.
- Pick the default display currency from the device time zone or browser language (generated from Unicode CLDR and IANA tz data) until changed, format numbers and A-level grades (`A*A*A`) by language, and use en dashes for ranges.
- Make catalog card price and rank tooltips concise, name active filters with "Reset filters" and "Show universities above my budget" on empty results, preserve sort and sliders on reset, and let Esc close the onboarding tour.
- Keep university tabs on one scrollable row with 48px edge arrows that avoid covering tab labels on phones, and shrink missing-photo university hero areas to a 96px band.

### Fixed
- Hide closed custom-select menus cleanly to eliminate ~150px of phantom scroll space below the catalog filter card, and clamp open tooltip bubbles within the viewport so hidden tooltips do not widen the page.
- Stop offering "Remember this path" or entry prompts for NU's separate grant application, limit NU's state-grant work obligation to master's, doctoral, and residency paths, and hide graduate notes on NU undergraduate paths.
- Keep NU's shared undergraduate path selected when picking a bachelor's program, evaluate NU in comparison with its single published entry cycle, and show the applicant's GPA beside met GPA alternatives.
- Head MIT's English-score column "Minimum if you take it", show a single `≈` on converted calculated costs, translate approximate dates such as "early April", fix Russian/Kazakh currency decimal formatting, and report Admission render errors.
- Replace an edited language test row when its date changes instead of duplicating it, report partly typed test dates, and mark an English test below minimum whenever a known section fails even if its date is missing.
- Fix low-contrast dark-theme colors and surface blending across nested cards, tooltips, badges, and buttons, and isolate desktop sticky sidebar rules from tablet drawers and mobile bottom sheets.
- Let single-column catalog cards (`<= 640px`) fill their grid track, fix legacy funding card stacking below `768px`, remove asymmetric navbar language trigger padding, and compact intermediate catalog toolbars via container queries.
- Stop requesting missing campus images for Astana Medical University and KIMEP by marking image availability in catalog and map payloads.

### Maintenance
- Add a novice university page checklist from a five-persona audit of MIT, Stanford, Imperial, and NU as the Stage 3 acceptance check.
- Add unit, backend, and E2E tests covering minimums checklists, locale number formatting, GPA scale switching, tooltip clamping, responsive layout matrices (`320px–1280px`), and multilingual search-name coverage.

## 10.6.7 (2026-11-21) - Cite reviewed study formats

### Changed
- Show university study formats only when official source metadata is linked, hiding modes that lack a displayable source and adding scoped MIT sources for undergraduate and graduate on-campus formats.
- Collapse each overview fact's source scope under its source link and check date, fold study-format sources into one "Sources" disclosure, and rename the overview facts heading to "Key facts".
- Style study-format and campus-area values in primary text color to match other overview facts with a small, muted "Sources" toggle.
- Limit study-format rows in university comparison to institutions with a linked official source and show that source and check date beside the value.

## 10.6.6 (2026-11-20) - Show sources for university overview facts

### Changed
- Make ranking sources clickable, display student-count provenance, link tagged study-format sources, and show available check dates beside university facts while exposing missing check dates, carried-forward reviews, and cycle scope.
- Expose conflict reasons and official next steps through the narrow public projection.
- Update MIT and Oxford enrollment figures, align Oxford's international shares and accommodation guarantee with current publications, and recalculate both universities' research-focus factors.
- Limit campus areas and study formats to official evidence with clear campus or program scope, removing disputed areas and unsupported formats.
- Add source scope, check dates, and approximate-area labels to university comparison rows.

## 10.6.4 (2026-11-20) - Update Nazarbayev University Zero Year information

Patch release: refreshes the graduate-preparatory offering's official name and source-backed description without changing admissions routes or assessment behavior.

### Changed
- Update the graduate-preparatory offering to Zero Year of Graduate Programs (ZYGP) while retaining NUZYP as a search alias, localizing its School-recommendation description, and including it in admissions and program views.
- Keep current-cycle availability, general entry terms, tuition, and funding unconfirmed where NU's public applicant pages do not publish them.
- Improve catalog and Guide accessibility semantics, name the map-results landmark, restore keyboard focus after failed-photo retries, remove unused bindings, and route toast exit motion through shared tokens.

### Fixed
- Add exact Russian and Kazakh translations for NU ZYGP source gaps, next steps, historical notes, and program scope while removing obsolete NUZYP rules and translation entries.

### Maintenance
- Wait for the admissions-selection edit button to become actionable after history navigation in E2E tests.

## 10.6.3 (2026-11-19) - Align documentation with the reviewed admissions model

Patch release: documentation and Guide copy corrections with no API or storage contract changes.

### Changed
- Document the reviewed study-options and admissions-context endpoints in the README and align English, Russian, and Kazakh Guide copy with study options, application routes, and applicant context.
- Reconcile the four-institution batch, remaining 46 legacy institutions, and first-ten expansion boundary across project roadmap, architecture, and storage docs while condensing active instructions.
- Remove the unapproved Google-auth state-sync proposal, add Support and Accessibility links to the README, and fix Support's program-coverage wording.
- Align the release checklist with explicit push, tag, and release permissions, date the OSPS assessment, and refresh verified branch ruleset facts.

## 10.6.2 (2026-11-19) - Fix university page styles on hosted pretty-URL SPA navigation

Patch release: fixes missing university stylesheets during client-side navigation to nested pretty URLs (`/universities/<id>`) and prevents the service worker from caching HTML pages as API responses.

### Fixed
- Resolve client-side routed stylesheets against the application root and sync `<base href>` so SPA navigation from `/` to `/universities/<id>` loads university stylesheets cleanly without 404 paths.
- Increase the client router stylesheet load wait timeout from `150 ms` to `1500 ms` to avoid brief flashes of unstyled content on cold-cache transitions.
- Exclude HTML navigation requests and `text/html` responses from service-worker API caching and bump the worker version (`2026-11-19-1`) to purge previously cached HTML pages.

### Maintenance
- Add unit and E2E regression tests for app-root stylesheet resolution, service-worker HTML pass-through, and SPA navigation to `/universities/<id>`.

## 10.6.1 (2026-11-19) - CSS cascade cleanup, university stylesheet modularization, and strict CSS audit

Patch release: internal CSS architecture refactoring and tooling with no user-visible feature or API changes.

### Added
- Add a strict CSS audit script (`npm run audit:css`) powered by css-analyzer, PurgeCSS, and PostCSS to enforce zero cross-file property overrides, duplicate selectors, unknown custom properties, non-accessibility `!important` rules, or unused selectors.

### Changed
- Consolidate 763 overridden CSS declarations and split selectors across stylesheets, modularize university and catalog CSS into focused modules, and reduce total CSS volume by ~3,350 lines.
- Remove all 21 component-level dark-theme overrides, 42 non-accessibility `!important` declarations, and 151 unused selectors while unifying shared tooltip, info-button, and underlined-tab primitives across 23 remaining stylesheets.
- Eliminate ID specificity overrides and collapse fragmented media queries into descending breakpoint order while updating university cover visual snapshots.

### Fixed
- Restore the accent color on the center loading spinner where a responsive border rule previously overwrote it.
- Restore the missing navbar language dropdown chevron and prevent stray checkmarks from leaking out of closed custom select menus.

## 10.6.0 (2026-11-19) - Currency fallback snapshot sync and rate update status

Minor release: synchronizes static offline exchange rates across backend and frontend with an explicit snapshot date and displays localized currency rate freshness or offline snapshot status in Settings.

### Added
- Add an explicit `2026-11-18` offline fallback exchange-rate date alongside a sync script to refresh rates from ExchangeRate-API and check backend/frontend parity.
- Display localized currency rate freshness or offline snapshot status in Settings, updating reactively on modal open, background rate arrival, and language switches with UTC-safe date formatting.

### Changed
- Update offline fallback exchange rates across backend and frontend to the `2026-11-18` ExchangeRate-API USD snapshot (166 currencies) and return the snapshot date instead of `"fallback"` without persisting fallback responses to session storage.

### Maintenance
- Add backend and frontend unit tests for fallback-rate parity, timezone-aware timestamp formatting, and reactive Settings rate-status updates.

## 10.5.0 (2026-11-18) - Broader annual cost ranges and campus photo fallback

Backward-compatible minor version update for catalog cost references and missing campus-photo states.

### Added
- Calculate annual reference cost ranges from compatible published tuition and living-cost facts while retaining program scope, source periods, exclusions, and living-cost provenance.
- Show a localized campus-photo placeholder when a university has no reusable cover image.

### Changed
- Remove the unreviewed-data notice from catalog cards while keeping review status on university pages and in comparison guidance.
- Explain that catalog price ranges narrow as study level, fee status, and program details are set, and label tuition-plus-living calculations as references across summaries and comparison.
- Rename Russian university favorites filter labels to saved wording.

### Fixed
- Keep each priced program variant on its latest published period instead of mixing prices across different entry years.

### Maintenance
- Add tests covering scoped annual budget ranges, living-cost provenance, localized price explanations, missing campus-photo states, and theme surface consistency on the level selector.

## 10.4.4 (2026-11-18) - University media policy wording

Patch release: university media guidance and interface refinements with no breaking API or storage changes.

### Changed
- Clarify that UniSearch identifies institutions by name and campus photography rather than logos, aligning the third-party notice, photo contribution guide, architecture diagram, and expansion roadmap.
- Simplify the campus photo gallery with a clickable cover, translucent photo count and credits, side arrows, and a back arrow in the full-size viewer.

### Fixed
- Unify dropdown spacing, panel styling, and selection feedback across catalog filters, profile, settings, and university pages, and set the catalog study-level filter button to the solid surface color.
- Standardize website, map, and save action typography and stable localized save-state widths across all university pages.

## 10.4.3 (2026-11-18) - Modern web platform baseline, accessibility, and security hardening

Patch release with no new user-visible capability: adopts Baseline Widely available JS/CSS APIs, converts overlays to native `<dialog>` elements, upgrades WAI-ARIA tabs/tables/selects/toasts and Forced Colors support, removes CSS `@import` waterfalls, and tightens static security headers.

### Changed
- Adopt Baseline Widely available JavaScript and CSS primitives (`replaceChildren()`, `structuredClone()`, `toSorted()`, `AbortSignal.timeout()`, `100dvh` fallbacks, `:user-invalid`, and `content-visibility: auto`) with flicker-free theme transitions.
- Migrate Settings, profile confirmation, onboarding tour, and comparison program picker overlays to native modal `<dialog>` elements, and isolate background content with `inert` when the mobile navigation drawer opens.
- Upgrade WAI-ARIA `tablist`/`tab`/`tabpanel` navigation, High Contrast (`forced-colors`) fallbacks, native button triggers for custom selects, `<search>` landmarks, accessible table scopes, popover status toasts, and post-transition focus routing.
- Flatten CSS `@import` chains into direct stylesheet links with `<meta name="color-scheme" content="light dark">` and font preloads, and add Content Security Policy and security headers across hosting, Apache, and backend configurations.

### Fixed
- Guard Enter key submission against active IME composition, restore profile validation focus after closing the unsaved-changes dialog, eliminate per-item layout reflows during entrance motion, and escape error and network-status messages.

### Maintenance
- Add unit, backend, and E2E tests for WAI-ARIA tabs, native dialogs, accessible toasts, IME composition guards, theme transitions, error escaping, and CSP headers.

## 10.4.2 (2026-11-18) - Campus photos and viewer fixes

Patch release: UI and asset refinements with no new user-facing capability or breaking API/storage change.

### Changed
- Remove university logo placeholders throughout UniSearch, using dots and counts on the map and credited campus photos in comparison headers.
- Align comparison university cards and values in two equal columns with guidance above the cards and metric labels above each value pair.
- Show a themed campus photo placeholder when a catalog card has no usable image.
- Limit the CI Node dependency audit to runtime packages (`npm audit --omit=dev`) because frontend assets ship without a bundler.

### Fixed
- Close the campus photo viewer when clicking or tapping outside the photograph while ignoring drags, swipes, and pinches and keeping zoom cursors on the photograph only.

### Maintenance
- Scope reload and context waiters in admissions E2E tests to the active application route so background responses cannot drop during navigation.

## 10.4.1 (2026-11-17) - CodeQL test fixes

### Fixed
- Verify the full MIT Admissions URL in comparison tests and remove unused imports from responsive layout and profile language tests.

## 10.4.0 (2026-11-17) - Campus photo galleries

### Added
- Open campus covers in a full-size viewer and browse credited alternate photos with arrows, indicators, keyboard controls, or swipe gestures.
- Zoom and pan campus photos in the viewer using mouse, touch gestures, or keyboard controls.

### Changed
- Retain former cover images and alternate campus views with per-photo credits in the gallery.

### Fixed
- Keep campus photos clear on narrow screens by placing gallery controls and attribution below the image, and keep touch controls responsive immediately after swiping.
- Render the university page as soon as core content is ready while programs and admissions show independent loading states.
- Update campus exterior photos for Australian National University, Delft University of Technology, National University of Singapore, Tsinghua University, and University of Melbourne, and replace Seoul National University's panorama with a street-level Daehan Hospital photo.

## 10.3.3 (2026-11-16) - Modern web platform rule for agents

Patch release: documentation-only change with no application, API or data change.

### Changed
- Require agents in `AGENTS.md` to consult the `modern-web-guidance` skill before editing HTML, CSS, or client-side JavaScript, preferring Baseline Widely available features and capping fallbacks for Newly available features at 20 lines with no external dependencies.

## 10.3.2 (2026-11-16) - Faster pull-request E2E checks

Patch release: CI-only change with no application, API or data change. A pull-request Tests run takes about 6.5 minutes instead of about 25.

### Changed
- Split the pull-request E2E job into six single-worker parallel runners while keeping a unified required `e2e-pr` check, cutting PR test time from ~25 minutes to ~6.5 minutes, and auto-cancel superseded PR runs without affecting `main` or scheduled builds.

### Maintenance
- Read admissions-context E2E response bodies immediately upon arrival to prevent dropped-response errors during reloads or re-renders.

## 10.3.1 (2026-11-16) - Smaller admissions snapshot and steady university pages under late exchange rates

Patch release with no new capability: the reviewed admissions data keeps the same content in a smaller, leaner stored form, and exchange rates that arrive late no longer reset a university page.

### Added
- Document the "Check the cost" tag, compact card icons with the catalog banner legend, and profile answers used by UniFit in the Guide.

### Changed
- Compact the reviewed admissions catalog into one line per record (cutting it from `25.4 MB` to `18.2 MB`), move maintainer-only research blocks (`~650 KB`) into `research.json`, and store evidence references instead of inline copies (`16.4 MB` final snapshot) with re-hashed assessment mappings.

### Fixed
- Prevent late-arriving exchange rates from rebuilding an open university page and closing the program/route editor; redraw only catalog cards in place and apply updated rates elsewhere on the next view.
- Update the Guide with current UniFit slider names (Focus, Selectivity, Cost vs Prestige, Location), explain centered sliders and Your Vibe tags, remove the dropped non-English offset from the interests formula (`clip((sim - 0.55) / 0.35, 0, 1)`), and update the comparison and glossary sections.

### Maintenance
- Add E2E tests holding exchange-rate responses to verify open admissions editors stay intact and catalog card prices redraw late, and check slow-rate event order instead of wall-clock timing in unit tests.

## 10.3.0 (2026-11-13) - Simplified profile and admission pages

### Added
- Show a Wikimedia Commons photo credit link ("Photo: author, license (cropped)") on university page covers as required by photo licenses.
- Add `applicant_route` (`first_year`, `transfer`, `graduate`, or `null`) to application route summaries in admissions API responses.
- Add a live "How UniFit will use your profile" summary on the profile page showing used vs. unused answer groups, entered values, and what to add.
- Add a "Save and show matches" profile action that opens the catalog sorted by UniFit with the profile study level selected and skips the first-visit tour.
- Show a UniFit catalog banner naming active profile inputs, linking to the profile, and displaying a status-icon legend with specific exam and budget tooltips.
- Open reviewed university Overview tabs with key admission facts: deadline countdown, annual cost before aid with aid policy, profile-checked requirements, and student body.
- Answer key admission facts from shared first-year routes without a selected program and link directly to Dates, Costs, and Admission tabs without saving.
- Add sourced `admission_statistics` for MIT, Stanford, Imperial College London, and Nazarbayev University to drive only the UniFit selectivity slider.
- Show an overview card with study-level shortcuts into the program list for universities that admit by program.
- Display a quiet accuracy notice on unreviewed university pages and cards, linking to the official website when application dates are missing.
- Show "Exam result needed" and "Check the cost" icons on reviewed cards when a route requires an unlisted test or depends on an unset fee status.
- Compare two reviewed universities directly without a setup step, showing dates, requirements, costs against budget, financial aid, and sourced figures.
- Add a searchable, level-filtered program picker per comparison column that shares the university page's saved selection and switches Home/Overseas fee cells.
- Restrict comparison pairs to the same data group, marking incompatible universities in the tray and explaining mixed-pair links with links to both pages.

### Changed
- Replace Noto Sans with the self-hosted Inter typeface (SIL OFL 1.1) and document its license in `THIRD_PARTY_NOTICES.md`.
- Derive the applicant category from the selected application route and remove the separate applicant selector and legacy URL parameter handling.
- Read single-route programs directly without saving an explicit route selection.
- Show the requirements-match summary once in the Admission tab's key facts instead of repeating it in study details.
- Group source references into one numbered list per tab with full source records behind a single disclosure.
- Move card price qualifiers above the amount so prices stay aligned on the bottom row beside the details link.
- Omit internal provenance, index attributes, related-fact IDs, review timestamps, and repeated values from admissions API responses without changing stored records.
- Keep funding facts for reviewed institutions in the admissions catalog so grant and paid filters exclude only institutions known to lack them.
- Show published qualification guidance to all visitors as reference.
- Precompute major-taxonomy normalization to speed up the initial admissions request.
- Apply the bounded light dossier standard to newly added institutions while keeping the four accepted deep datasets unchanged.
- Replace the four-tab profile layout with one guided page organized by impact on results, featuring a section outline and sticky action bar.
- Align exam and language edit/delete rows, unify add-form layouts, and use styled selects in the university-specific profile form.
- Apply profile funding preferences in UniFit sort the same way as other sorts, hiding only universities known to lack that funding option.
- Limit new university-specific language entries to English while keeping existing entries in other languages visible and removable.
- Simplify profile copy by translating preparation levels, removing field-code phrasing, and shortening the unfinished-report notice.
- Display entry cycles, academic years, or "year not stated" in Admission tabs instead of English research notes about source periods.
- Consolidate university page stylesheets by removing overridden declarations, unused rules, and split duplicates without changing computed styles.
- Display campus, hybrid, or online study formats on university overviews instead of individual program schedule wording.
- Omit outcome earnings figures from reviewed university overviews, matching the comparison view.
- Clarify wording for the selection strip, annual dates, and selectivity across English, Russian, and Kazakh.
- Keep the existing comparison layout for unreviewed university pairs and remove unused chooser, source-panel, and budget-signal strings.
- Standardize reviewed university tab alignment, heading hierarchy, key-fact typography, and "choose first" prompt layouts across desktop and mobile.
- Label source markers as "Source N", place route notes beside their buttons, and show an empty deadline calendar as a quiet note.
- Replace "small / medium / large" campus sizes on overviews with sourced campus area in hectares, football-pitch comparisons, and localized student counts.
- Base the catalog `size` filter on student-count bands (under 10,000, 10,000–30,000, over 30,000) while keeping universities without published counts visible.
- Stop offering to apply general profile entry cycles or fee statuses on university pages and comparisons since both are chosen per institution.
- Shorten catalog card status tooltips to one or two plain sentences and change the preference icon to a heart.
- Rework UniFit preference sliders so centered sliders are neutral, "Study style" becomes "Selectivity", and research and OECD urban-area metrics use fixed log scales.
- Keep missing UniFit factor metrics as `null` so unstated values score as typical rather than producing artificial perfect matches.
- Update urban-area populations (including Hong Kong mid-2026 and Astana 1.6M), OpenAlex metrics, and official student counts across 25 universities, and switch cost-versus-prestige to fixed scales.

### Removed
- Remove citizenship, residence country, family income, education country, education credential, and general applicant route from profile inputs, stripping saved values on load.
- Remove intended entry cycle and fee status from the general profile while preserving per-institution selections.
- Remove institution-evidence options for Imperial College London and Stanford University and the "major" metric while keeping MIT Course 6-9 and MITx checks.
- Remove `citizenshipStatus` from minimum-requirements API responses along with the retired citizenship service and country list helper.

### Fixed
- Replace campus photos lacking known sources with freely licensed Wikimedia Commons images (CC0, public domain, CC BY, CC BY-SA) for 48 universities, and show logo badges for Astana Medical University and KIMEP University.
- Add the required QS World University Rankings attribution notice and link to www.qs.com in catalog, university, and comparison footers.
- Display the required "© OpenStreetMap contributors" attribution on the catalog map and load tiles from `tile.openstreetmap.org`.
- Update the Terms of Use and Privacy Policy (November 15, 2026) with hosting providers, Kazakhstan governing law, under-18 guidance, student-team operator wording, and licensed photo terms.
- Remove personal names from the About page and identify maintainers by GitHub handle only in `GOVERNANCE.md`.
- Standardize the contact address to `unisearch.sup@gmail.com` across all pages, license notices, and takedown notices.
- Update `THIRD_PARTY_NOTICES.md` with Leaflet, Leaflet.markercluster, and OpenStreetMap notices, drop the 48-hour takedown promise, and document photo sourcing rules.
- Convert reviewed university prices on Overview, Costs, Admission, and Comparison pages using active currency settings while keeping table amounts exact and the user's budget unrounded.
- Format price ranges with a single approximation sign and one bracketed original range across reviewed and unreviewed comparisons.
- Show prices in unsupported currencies as published instead of mislabeling unconverted amounts with the preferred currency symbol.
- Convert earlier-format earnings figures on the Overview tab to match the selected currency settings.
- Load live exchange rates on startup across all pages so direct visits to university, comparison, and profile pages convert prices accurately.
- Preserve the profile budget's entered amount and currency across display-currency switches to prevent rounding drift.
- Keep tuition-only reviewed universities (Imperial College London, Nazarbayev University) in price-range results as partial matches while still requiring full annual costs for budget filtering.
- Label the top of the catalog price slider "$100,000+" (announced as "and above" to screen readers) when no upper limit applies.
- Fix excessive bottom padding, stacked section gaps, and extra paragraph margins across university, catalog, profile, and guide pages.
- Fix the "Total per year" cost row on earlier-format university pages so the label and amount share one row cleanly.
- Align off-scale typography across badges, labels, headings, and table cells to the design type scale.
- Exclude admissions contexts whose applicant category contradicts the selected route from requirements checks.
- Report unverified grant, paid, and aid options as unknown rather than absent for reviewed institutions so catalog filters keep them visible.
- Distinguish identically titled official source pages at different URLs using a URL-path hint in source lists.
- Remove a restated research sentence about a Kazakhstan diploma from Stanford's school-education requirement text in English, Russian, and Kazakh.
- Normalize Stanford first-year applicant category variants to `first_year` so they match first-year routes instead of showing as transfer conditions.
- Keep reviewed institutions with unknown `format` or acceptance-rate values visible under those catalog filters.
- Serve stale cached exchange rates immediately while refreshing them in the background so page requests do not block on slow rate providers.
- Flag a 5-point GPA entered on the 4.0 scale while typing and direct IELTS and TOEFL entries to the Languages section.
- Fix mobile placement of the profile reset action and keep the sticky profile action bar above open dropdowns.
- Fix text contrast on the UniFit banner link in dark mode.
- Align the catalog study-level filter beside the result count in a single desktop toolbar row.
- Stop describing MIT as an evening school on its overview because of a single professional program's schedule.
- Prevent the selection strip from reporting a route needs clarification while program paths are still loading.
- Localize the empty Dates tab placeholder on earlier-format university pages.
- Remove Nazarbayev University's campus area figure because the linked official page does not state it.
- Fingerprint localization files for the locale-pack cache revision so browser tabs never render empty strings for newly added keys.
- Format the comparison page's campus-area row in hectares instead of raw square metres.
- Align horizontal indentation on the Dates tab of reviewed universities with the other tabs.
- Open the requested tab directly when visiting a tab link on earlier-format university pages.
- Show shared undergraduate application paths directly on the Dates, Costs, and Admission tabs for MIT and Stanford without requiring a major selection first.
- Deduplicate repeated program names in applicable-major lists on earlier-format admission routes.
- Fix key admission fact cards so they size independently in two columns, use plain bullets for checklist items, and remove status icons from the unreviewed-data note.
- Align the leftmost catalog card status tooltip inside the card so it does not clip off-screen on two-column layouts.

### Maintenance
- Update `npm run fix:i18n` to refresh the locale-pack cache revision automatically and make `npm run check:i18n` fail when it is stale.
- Add a per-institution conversion checklist in `docs/admissions-light-dossier.md` for moving remaining universities to reviewed data.
- Regenerate the admissions catalog with route-level applicant categories and closed vocabulary overrides.
- Run Playwright browser tests against a dedicated API server on port 8010 via `--api-port` so parallel workers avoid development server rate limits on port 8000.
- Enforce `npm run check:stylelint` in CI and `test:all`, clean up duplicate and overridden CSS rules, and disallow off-scale 12px and 32px+ font sizes in design lint.
- Update `npm run audit:images` and image-variant generation to require Wikimedia Commons credits, free licenses, and WebP sizes smaller than JPG fallbacks.
- Update the comparison browser test to assert currency conversion across both columns.

## 10.2.0 (2026-11-11) - Admissions key facts and plain-language translations

### Added
- Add a key-facts summary to the Admission tab showing requirements match, nearest action deadline, published annual price against profile budget, and funding route status.
- Add `selected_costs` with USD annual ranges to admissions-context API responses for client-side budget comparison.
- Add an `entry_cycle_required` check and assessment reason for cycle-scoped minimums, offering recognized profile cycles or opening the entry-cycle selector.
- Recognize plain seasonal entry cycles in Russian and Kazakh, such as "осень 2027" and "2027 күз".
- Add hover, keyboard, and touch explanations for UCAS, TMUA, Foundation/NUFYP, early/regular rounds, CSS Profile, and Home/Overseas fees on reviewed pages.
- Explain Home and Overseas fee status next to fee-dependent prices with a link to the official fee-status page without inferring applicant status.
- Display each university's published financial-need policy for the selected route in key facts, clearly labeled as policy rather than an award.
- Allow saving SAT, UNT, and IELTS with overall scores only, leaving unreported section minimums unassessed.
- Prompt users to choose a program or route in empty comparison rows and auto-apply the sole compatible route after a program selection.
- Name missing test evidence (such as SAT test dates or IELTS section scores) and already-satisfied overall scores in the key-facts requirements row.
- Show whether yearless annual deadlines (such as MIT's first-year rounds) have passed and count down to the next occurrence as an annual date to confirm.
- Lead key facts with the main application deadline, place earlier test registration dates on a second line, and skip dates for unchosen alternative exams.
- Pre-fill comparison suggestions from profile subject, level, entry cycle, and budget, compare annual prices against budget, and show published timelines and requirements.
- Translate applicant-facing admissions and program text into Russian and Kazakh for all Imperial College London courses and Stanford University Bulletin entries, keeping official titles and qualification tables in English.
- Add structured annual countdowns for Stanford first-year (Restrictive Early Action, Regular Decision), transfer, and standing CHPR and Neurosciences MS deadlines.

### Changed
- Enforce a closed admissions-status vocabulary and label internal-only or restricted-group routes explicitly.
- Reject unmapped research status labels during admissions data preparation.
- Rewrite gap explanations and next steps for MIT, Imperial College London, Stanford University, and Nazarbayev University into plain applicant guidance across English, Russian, and Kazakh.

### Fixed
- Strip maintainer research notes from applicant-facing admissions text and translations while keeping source records intact.
- Show untranslated admissions text whole in its source language instead of displaying half-translated Russian or Kazakh sentences.
- Allow saving the profile when selecting an already-saved exam with a prefilled score.
- Distinguish the US high school diploma from national school certificates in the qualification list.
- Keep a chosen comparison program or route active when continuing without pressing the separate apply button.
- Condense the Admission tab by linking checks to unique source records, merging duplicate conditions, and hiding internal selector and evidence fields.
- Localize Imperial's UCAS date labels and fix missing spaces in entry-cycle labels.
- Invalidate cached study-option lists when applicant-facing wording rules change and memoize text rewriting to keep responses fast.
- Rewrite about 150 remaining research-voice sentences and scope notes into plain guidance across English, Russian, and Kazakh.
- Format internal status codes like `round_1` and `tuition_and_mandatory_fee` as readable labels in all three languages, and render Stanford Bulletin metadata cleanly.
- Remove superseded research notes from Stanford's historical records.
- Preserve the NUFYP regular-entry NUET minimum of 120/50/50 in the Nazarbayev University next step after removing maintainer notes.

## 10.1.0 (2026-11-05) - Reviewed admissions requirements match

### Changed
- Rename the applicant-facing UniChance indicator to "minimum requirements match" while preserving existing API and saved-state identifiers.
- Explain reviewed application paths and saved choices, and expose scoped minimum-check summaries with remaining conditions.
- Restore explainable UniFit indicators for reviewed universities, covering subject availability, requirements evidence, and scoped budget comparisons.
- Simplify card explanations and expose valid requirements percentages directly.
- Allow UniFit discovery without an exam-data confirmation dialog while retaining a dismissible evidence explanation.
- Separate MIT Sloan's deferred MBA Early application from regular MBA admission with its own eligibility, checklist, and deadline.

### Fixed
- Show scoped tuition ranges on reviewed cards when a comparable study and living budget is unavailable.
- Align UniFit subject matching and cost projections with each university's saved study context, including explicitly cleared values.
- Preserve full official source titles when no exact translation exists and align mobile disclosure controls with their headings.
- Keep the selected application context visible across route changes and prevent mobile language-selector labels from overlapping controls.
- Fix application links, Stanford CS deadline scopes, MBA/coterm calendar projections, and known unpublished Nazarbayev University dates.
- Remove applicant-visible research notes and unrelated gaps, clarify Imperial deadline types, and deduplicate repeated source guidance.
- Align saved-choice status with tab history and distinguish missing profile evidence from requirements that cannot be compared automatically.
- Prevent scrolled page text from showing through fixed navigation and remove duplicate retry controls and stale route instructions.
- Replace remaining applicant-visible UniChance wording in the MIT academic-record fact and its Russian and Kazakh translations.

### Maintenance
- Update contributor, architecture, roadmap, and card-indicator documentation for the four-institution rollout and minimum requirements match.
- Exclude the Git-ignored local scratch directory from the absolute-path hygiene test.

## 10.0.4 (2026-11-03) - Security and dependency updates

### Security
- Protect operational endpoints against trailing-slash authorization bypasses.
- Apply expensive-request rate limits to profiled university searches and unify rate-limit buckets across trailing slashes and university IDs.

### Maintenance
- Update backend dependencies and pin GitHub Actions versions.

## 10.0.3 (2026-11-02) - Security hardening and CodeQL alert remediation

### Fixed
- Escape formatted price values in university detail section rendering.

### Security
- Sanitize translated HTML snippets with a strict allowlist DOM sanitizer to eliminate DOM XSS risks.

### Maintenance
- Replace URL-matching regexes in admissions unit tests with substring checks and add DOM sanitization unit tests.
- Remove unused imports, dead variables, and obsolete application-classification helpers across scoring, admissions, and E2E code.

## 10.0.2 (2026-11-01) - Calm Academic Workspace design polish and lint guards

### Changed
- Standardize interface and display typography on Inter and remove 10px font sizes, uppercase transforms, positive letter-spacing, and italic styles across stylesheets.
- Replace pastel card washes on funding, track-stats, and exam-group panels with neutral surface hierarchy and subtle elevation.
- Replace generic sparkles icons in catalog filters, profile hints, comparison headers, and university sections with semantic Heroicons.
- Automatically deploy the frontend to Firebase Hosting on pushes to `main` using the configured service-account secret.

### Fixed
- Remove residual box borders, dead border-color rules, hover bounce animations, and redundant backdrop filters across catalog, comparison, profile, 404, and university pages.
- Standardize documentary source link styling and balance header alignment on the profile page.
- Remove an unawaited navigation race in the Nazarbayev University admissions browser suite.

### Security
- Set `X-XSS-Protection: 0` to disable legacy browser XSS filtering alongside the active Content-Security-Policy.
- Override vulnerable transitive `glob` and `minimatch` development dependencies to resolve audit advisories.

### Maintenance
- Expand design-lint checks, unit tests, `docs/design-system.md`, and `AGENTS.md` to enforce typography, hover-bounce, and borderless component rules.

## 10.0.1 (2026-10-30) - Nazarbayev University translations

### Changed
- Localize reviewed Nazarbayev University program and admissions information in Russian and Kazakh while preserving official names and source context.

### Fixed
- Display structured academic alternatives in reviewed admissions records while keeping internal route metadata hidden.

## 10.0.0 (2026-10-28) - Nazarbayev University admissions and profile

### Breaking Changes
- Replace legacy Nazarbayev University admissions and finance fields with the reviewed catalog, resetting unsupported old NU choices while keeping profile evidence and other university selections.

### Added
- Add the reviewed Nazarbayev University catalog covering Foundation, degree, professional, residency, and non-degree offerings with source-bound routes, fees, funding links, and publication gaps.
- Support NUET sections, Nursing NAT percentages, ALEKS, and IFOM/USMLE scores in profile and admissions checks while separating conditional residency, financial support, and ordinary admission.

### Fixed
- Restore cross-platform artifact hashes for the locked `coverage` dependency so hash-verified development installs work on Windows and Linux.
- Preserve unadded exam score drafts across language switches, submit reports consistently with Enter, and block profile saving until unfinished reports are added or cleared.
- Keep display-currency changes separate from unsaved profile fields, preserve choices saved in other tabs, accept grouped numbers, and make reset accessible on mobile.
- Prevent retired search handlers from overwriting university URLs, hide inactive specialist fields, and keep saved preparatory, residency, and non-degree contexts working across pages.
- Scope displayed tuition to the selected program in detail and comparison views, retain official program links, and clear expanded selections on new searches.
- Clarify academic, language, and NAT headings, explain separate NU application and funding paths, and identify invalid exam sections with accessible error feedback.
- Keep comparison language switches on the current step, expose university-wide entry paths from program selections, and retain dated micro-credential references without inventing calendar events.
- Require overall language scores alongside required sections, reject invalid exam evidence, and keep missing GPA, budget, and composite scores distinct from zero.
- Preserve whole-program and campus-specific billing periods, native awards, and source cycles, and reset unsupported old NU choices without discarding profile evidence.
- Keep expanded requirement headings readable on desktop and mobile, show native A-level grades, include full-title MBA awards in discovery, and normalize line endings in reviewed input fingerprints.
- Run the full browser matrix against the project frontend server so nested university URLs and the `/frontend` mount resolve reliably.

## 9.3.0 (2026-10-26) - Program browsing and scoped catalog prices

### Added
- Add a profile-aware university listing API and scope catalog price ranges by selected program, study level, and fee status, matching tariff variants and living-cost intervals.
- Show compact, expandable program cards across unreviewed catalog institutions using available stored details without implying reviewed admissions data.

### Changed
- Restore program selections across reloads and language changes while keeping card expansion separate from explicit selection.
- Leave the application route unselected after choosing a program until the applicant confirms a route or provides context that resolves it.
- Refine reviewed program summaries, source disclosures, and handling of scoped price ranges and unknown costs.

### Security
- Update backend lock files to patched `filelock` 4.2.1 and `setuptools` 84.1.0 releases.

## 9.2.0 (2026-10-22) - Catalog pricing and applicant context

### Added
- Filter university and map results by fee status and intended entry cycle, and filter reviewed program catalogs by canonical subject.
- Display selected tuition or annual-budget prices on catalog cards with optional dual-currency output and clear source-period, fee-scope, exclusion, and unknown-price notes.
- Let visitors browse, compare, and read shared MIT and Stanford undergraduate routes without picking a major, keeping profile-based suggestions optional.
- Auto-select the sole compatible application route after a deliberate program choice while keeping multi-route choices explicit.

### Changed
- Keep UniFit, comparison, admission summaries, and deadline calendars aligned with the selected study and applicant context while preserving restrictions and unresolved costs.
- Display integrated BEng and MEng qualification labels beside course names while retaining their undergraduate entry level.

## 9.1.3 (2026-10-21) - Russian admissions summaries

### Fixed
- Add Russian translations for MIT and Imperial College London program and application summaries while preserving official program names and source wording.

## 9.1.2 (2026-10-21) - Security dependency updates

### Security
- Upgrade development Pillow to 13.0.0 and Certifi to 2026.10.19 to resolve nine Pillow advisories and the Certifi CA advisory.

## 9.1.1 (2026-10-20) - Code Scanning fixes

### Fixed
- Replace URL substring regular expressions in admissions tests with literal checks and strict university-host assertions.
- Remove unused imports flagged by CodeQL.

## 9.1.0 (2026-10-20) - Program Comparison and Deadline Calendar

### Added
- Add a concise sourced table to compare selected reviewed programs, preserving context in detail links and keeping full records expandable.
- Share the deadline calendar across reviewed and unreviewed university pages, exporting exact times, time zones, and separate scholarship vs. award deadlines.
- Complete study overviews for all 360 Imperial College London options in English, Russian, and Kazakh, noting limited publication details and restricted recruitment.
- Add source-linked study overviews for all 254 Stanford options, including 16 medical and bioscience records, with scoped route and cycle guidance.
- Add 168 Imperial course-overview translations alongside visible award labels and source-bound requirement, date, and funding summaries.
- Localize all 73 MIT application-path labels into Russian and Kazakh while keeping official titles in source records.
- Translate reviewed program names, study essentials, and available MIT program overviews into Russian and Kazakh with expandable originals, and support searching displayed names.

### Changed
- Complete the six remaining MIT study overviews, localize route guidance and transfer restrictions, and explain options lacking a standalone application.
- Include published MIT deadline arrays in the calendar and date summaries, separating regular Sloan MBA rounds from deferred MBA Early with source scopes and time zones.
- Recheck Imperial College London gaps, adding published 2027 tuition and the Medical Science and Innovation English band while preserving remaining uncertainties with dated sources.
- Reflect the joint RCA application and first-year-only tuition for Innovation Design Engineering, Imperial Inspires course exclusions, and separate undergraduate/postgraduate rules.
- Update Stanford transfer fees, CS MS eligibility and English exemptions, and 2027–28 domestic aid checklists while retaining resolved gaps in history.
- Surface collected curriculum records and study essentials, separating Biomedical Research project examples from compulsory modules and updating HealthBRIDGE status.
- Reassemble Imperial College London evidence after catalog cutover without altering the accepted historical program snapshot.
- Separate Imperial tuition, dated living references, and application charges while preserving fee-category conditions and distinct UCAS, MSc, PhD, and scholarship timelines.
- Apply the expandable program-card layout to MIT, Imperial College London, and Stanford University with concise overviews and separate full records.
- Keep program details anchored beside the selected card across searches and link Dates and Costs prompts to the required program or route.
- Version localization caches and requests so returning visitors receive updated labels while reusing valid packs and retrying failed loads.
- Show scoped exam summaries, readable dates, and dated reference budgets alongside full source records and applicability notes.
- Recognize Russian and Kazakh entry-cycle examples, match program search to full subjects, and preserve search state across language switches.
- Expose official application links and mobile tab controls within the existing university-page layout.
- Format deadline month names reliably even when browser Kazakh locale data is incomplete.
- Show tuition and study/living reference budgets on catalog and map cards with a persisted price-basis filter and scoped source periods.
- Filter published tariffs strictly by fee category without treating unknown costs or potential aid as affordable prices.
- Highlight undergraduate aid documents and international instructions in MIT summaries, explain empty deadline sections, and keep the unawarded-aid notice visible.
- Localize summary source periods and reduce repeated applicability badges while preserving each record's conditions and source metadata.

### Fixed
- Prevent stale exam validation and canceled SPA navigation from clearing newer profile edits, and keep reopened confirmation dialogs visible.
- Return HTTP 503 when required university, exam, or language data is unavailable instead of silently serving empty fallbacks.
- Load university detail resources properly when served under the `/frontend` mount.
- Convert tuition using its declared currency before computing university factors and retain official population fallback provenance.
- Remove the query-language semantic score bonus and key AI-sort results by the resolved search language.

### Security
- Share expensive-request rate limits across university IDs and apply the configured Redis prefix to rate-limit keys.

## 9.0.0 (2026-10-16) - Firebase Hosting, University Filters and Security

### Breaking Changes
- Move the public frontend from `https://unisearch-frontend.onrender.com` to `https://unisearch.web.app`; the old URL now returns 404.

### Added
- Allow filtering universities by city immediately after selecting a country without requiring a state or region.
- Publish verified Sigstore provenance bundles with release ZIPs and document online and offline verification.

### Changed
- Deploy the frontend on Firebase Hosting with clean routes, a university-detail rewrite, and deploy-time runtime configuration.
- Set `Vary: Accept-Language` on localized university-detail responses, including 304 responses, so caches separate languages properly.
- Improve university overview facts, localized filter guidance, and map-logo and tag hover presentation.
- Speed up OpenAlex factor refreshes with concurrent candidate lookups while preserving candidate ordering and fallback behavior.

### Fixed
- Replace stale legacy detail-cache entries when loading reviewed admissions data.

### Security
- Require DCO sign-offs and passing security, quality, and test checks on pull requests to `main`, dismissing stale approvals after new pushes.

### Maintenance
- Expand regression tests for admissions, rendering, localization, finance, caching, and language-exam validation boundaries.
- Refactor catalog, university detail, scoring, exam, profile, comparison, guide, and audit helpers while preserving existing contracts.
- Refresh README, architecture, security, accessibility, testing, and governance docs, and record the OSPS Baseline Level 2 self-attestation.

## 8.1.7 (2026-10-15) - Expanded Test Coverage

### Fixed
- Wait for map marker movement to settle before asserting that repeated clicks do not recenter the map.

### Maintenance
- Merge Chromium browser coverage with frontend unit coverage for Codecov across all frontend JavaScript sources.
- Add behavioral tests for offline recovery, service worker caching, admission evidence, exam breakdowns, language validation, ML availability, and source auditing.
- Run two local Playwright workers for faster API-backed checks while keeping one worker in CI.

## 8.1.6 (2026-10-14) - Stable Checks and Exact Source Links

### Fixed
- Seed the spacing-token reduction and use explicit stable comparators to resolve SonarCloud reliability findings.
- Require exact `href` attributes in official-source assertions to resolve four CodeQL findings.

## 8.1.5 (2026-10-14) - Code Scanning and Validator Fixes

### Fixed
- Remove an admissions catalog import cycle while preserving localized study-option search.
- Replace regex-based script filtering in the Stanford directory snapshot tool with HTML parsing and use indexed lookups in the Imperial validator.
- Fix parser bounds, URL assertions, and unused test code flagged by code scanning.

## 8.1.4 (2026-10-14) - Hardened Score Validation and Updated Dependencies

### Fixed
- Reject `NaN` and positive or negative infinity in language score validation.

### Maintenance
- Upgrade Playwright and pinned GitHub Actions dependencies used by tests and CI.

## 8.1.3 (2026-10-14) - Stable Admissions Browser State

### Maintenance
- Wait for the selected program's admissions context to finish loading before checking action states and pressed-state contrast in browser tests.

## 8.1.2 (2026-10-14) - Stable University Interaction Checks

### Maintenance
- Exercise reviewed university summary actions as real navigation clicks and wait for hover and pressed styles to paint before measuring contrast.

## 8.1.1 (2026-10-14) - Reference-First Browser Check Alignment

### Maintenance
- Update university admissions browser checks to follow grouped fact disclosures and current localized copy.

## 8.1.0 (2026-10-14) - Reference-First University Browsing

### Added
- Let guests browse reviewed MIT, Imperial College London, and Stanford University programs and routes before entering applicant context, retaining per-institution selections.
- Display grouped admissions facts with clearer scope, periods, conditions, source labels, and qualification tables.

### Changed
- Align interface, accessibility, and source-label copy across English, Russian, and Kazakh, including localized unknowns and application-route labels.
- Refine shared design tokens, responsive layouts, light and dark theme contrast, and the brand preview.

### Maintenance
- Add a CI guard for undefined CSS custom properties and static JavaScript style writes, plus visual regression checks for reviewed university journeys.

## 8.0.0 (2026-10-14) - Reviewed Admissions Catalog and Kazakh Workspace

### Breaking Changes
- Activate the reviewed MIT, Imperial College London, and Stanford University catalog, replacing previous persisted policy fields and resetting old application and comparison selections with a visible explanation while keeping profile evidence and other institutions' choices.

### Added
- Add official study options, actual application routes, scoped source facts, explicit unknowns, and separate history for MIT, Imperial College London, and Stanford University.
- Add paginated study-option search and request-local admissions-context APIs, supporting Kazakh search aliases while preserving official names and source prose.
- Add Kazakh interface and university localization alongside English and Russian, covering the reviewed catalog, profile evidence, localized search, and readable dates.
- Support six additional admissions exams, dated test attempts, and typed education, language, enrollment, GPA, and credential evidence assessed only against reviewed checks.

### Changed
- Start reviewed university pages with an institution overview and program browsing, moving application controls to Admission and placing extra settings behind optional disclosures.
- Use the activated catalog across discovery, UniFit, saved choices, and comparison without borrowing retired thresholds or costs, labeling the other 47 institutions as awaiting review.
- Refresh the About page, founder/contact layout, profile header, and responsive catalog controls.
- Adopt a catalog-first research-before-update workflow for each university while preserving paused research outside runtime.

### Fixed
- Honor explicitly cleared program, route, and cycle fields instead of restoring defaults, and prevent superseded requests from overwriting newer navigation.
- Accept valid saved SAT totals as self-reported presence without inventing missing sections, leaving unsupported or uncertain minimum checks unassessed.
- Isolate per-institution saved contexts from general preferences, separate unavailable scores from verified failures, and preserve source conditions, periods, currencies, and links.
- Preserve all canonical Kazakh subject aliases that share a translation and align new interface labels across all three languages.

## 7.2.4 (2026-10-08) - Validation and Reliability Fixes

### Changed
- Set the first ten universities in local catalog order as the admissions presentation batch and defer the remaining forty to a later cycle.

### Fixed
- Reject submitted exam scores outside the 0–10,000 range used by saved profiles before exam-specific validation.
- Resolve client IPs through duplicate trusted proxy headers while rejecting malformed IP port and bracket syntax.
- Treat non-ASCII operations credentials as unauthorized input without raising a server error.
- Omit configured currency API URLs from fetch-failure logs so embedded credentials are never exposed.
- Remove mixed-case script blocks from Stanford program-directory captures.
- Fix JavaScript sorting and normalization, keep nested parenthetical program labels and flexible exam whitespace, add screen-reader labels to optional profile fields, and clip university logos to their frame.

## 7.2.3 (2026-10-04) - Imperial and Stanford Research Recheck

### Changed
- Record official-source content and applicability rechecks for the Imperial College London and Stanford University admissions research drafts outside active runtime data.

### Fixed
- Restore Imperial award-specific curriculum selectors, classify internal Medicine PhD progression, and scope research phases, joint-program sources, costs, and funding terms.
- Restore complete Stanford applicant-condition prose and preserve route-specific rules across external, coterm, internal, hybrid, joint, and professional contexts.

### Maintenance
- Normalize draft evidence fingerprints across Windows and Unix line endings so unchanged source files stay valid.

## 7.2.2 (2026-10-03) - Imperial and Stanford Research Drafts

### Added
- Add reviewed admissions research drafts for Imperial College London and Stanford University outside active runtime data, retaining study options, application contexts, official sources, and scoped unknowns.

### Fixed
- Restore 13 omitted Imperial Overseas fee amounts and record Stanford's MSPA deadline with its 2026–27 cycle scope, time zone, and CASPA status requirement.

## 7.2.1 (2026-09-30) - Operations and Telemetry Hardening

### Fixed
- Require operations authorization for all accepted truthy health-warmup values and protected routes under an ASGI root path.
- Measure the MIT program title and badge in the same animation frame to prevent false layout-alignment failures.

### Security
- Filter credential headers, session fields, and the configured operations header from Sentry error events and transactions, and disable stack-frame local capture.
- Add same-origin opener isolation and disable legacy cross-domain policies on API responses.
- Keep ClusterFuzzLite builds unprivileged with hash-locked schema dependencies and bundled backend imports and catalog data in both fuzz targets.

### Maintenance
- Update Uvicorn, Sentence Transformers, and Sentry SDK in runtime and development locks, and refresh pinned CodeQL, setup-uv, and Codecov actions.

## 7.2.0 (2026-09-30) - Admissions Context and MIT Catalog

### Added
- Add sourced English and Russian study summaries, localized department labels, and direct degree-chart links for all active MIT undergraduate options.
- Add internal MIT EECS MEng study options for Courses 6-7P and 6-14P, linked to their shared application route and official degree charts.
- Add the internal MIT Course 6-9P MEng route with published technical and overall GPA minimums, recurring application window, and explicit funding uncertainty.
- Add the MIT Sloan MSMS partner-school application route with its 2027 deadline and a separately dated 2026-27 tuition-and-fee reference.
- Expand MIT's runtime catalog with sourced master's, doctoral, and advanced professional options, verified application targets, and English/Russian descriptions.
- Add a sourced undergraduate Business Analytics (Course 15-2) curriculum summary with direct MIT catalog and Sloan links, distinguishing degree requirements from admission prerequisites.

### Changed
- Use profile defaults and restorable detail-page program, study-level, route, and cycle choices across admissions, guidance, deadlines, costs, UniFit, and ROI.
- Score UniChance strictly as the share of evaluable published minimums met, returning no score when applicant evidence or measurable minimums are missing.
- Show historical admitted or enrolled score ranges and acceptance rates separately instead of treating them as admission probabilities.
- Include the applicant's annual budget and applicable pre-award annual cost in UniFit ranking when both are known, omitting missing components instead of substituting neutral values.
- Keep UniChance unscored with a distinct explanation when a route's published minimums are unreviewed or cannot be evaluated from the profile.
- Group program metadata beside labels, display descriptions as paragraphs, expose official sources and shared MIT first-year context, and mark the selected major with a badge.
- Order selected program, route, cycle, and official conditions ahead of optional catalog coverage and historical statistics in admission details.

### Removed
- Remove grant-odds and paid-admission badges that inferred funding outcomes from the academic fit score.
- Remove unsupported MIT Early Action SAT Composite stats, mislabeled score averages, a separate City Planning SM listing, and an unverified route for two EECS Engineer awards.

### Fixed
- Correct the MIT EECS MEng application closing description to the last day of finals.
- Correct MIT's Common Data Set ACT percentiles.
- Identify the MIT Transportation master's award and application path as MST, and show restricted MIT graduate eligibility in the selected-program admission context.
- Restore readable mobile university titles without horizontal overflow.
- Make no-exact-deadline calendar guidance accurate for collapsed MIT timelines.
- Keep single-option route and cycle controls visible, clarify that numeric requirements fit excludes separate textual conditions, and make historical score ranges expandable.
- Preserve Russian program selections across admissions and costs, and localize reviewed route, deadline, cost, and save-button accessibility labels.
- Keep Stanford first-year aid deadlines out of transfer funding views and show an official transfer next step.
- Keep Stanford undergraduate Computer Science separate from professional admission summaries.
- Give Imperial Computing BEng/MEng its own officially sourced 2027 requirements.
- Preserve MIT Spring transfer applicant restrictions beside deadlines and in calendar exports.
- Keep missing costs distinct from published zero amounts and prevent undergraduate costs from substituting for graduate costs.

## 7.1.0 (2026-09-24) - Cover Back Button and Steadier Map Interactions

### Added
- Add a circular "Back" button over the university detail cover, replacing the previous "Back to list" header action.

### Changed
- Move the Total Students and Study Formats rows into the university overview section.
- Move the low-budget grant hint from the budget block to the funding-preferences block on the profile page.

### Fixed
- Serialize map marker flights so rapid clicks cannot reopen stale cards, repeat clicks keep marker focus, and cards open only after uninterrupted arrival.
- Derive the catalog filter sidebar height from its sticky top offset instead of live scroll position to keep it stable while scrolling.
- Stabilize profile and catalog metric tooltip stacking across open, closed, and closing states.

## 7.0.0 (2026-09-24) - Scoped Admissions Facts and Product Direction

### Breaking Changes
- Remove the application planning workspace and its saved checklist interface; admissions and funding information remains available in university details.

### Added
- Expand selected MIT, Imperial College London, Stanford, Harvard, and Oxford records with program- and route-scoped admissions, deadline, price, and funding facts.
- Show unpublished or conflicting course deadlines and fees with their scope, official source, and a useful next action instead of unsupported dates or amounts.
- Establish the [admissions product model](docs/admissions-product-model.md) and [migration checklist](todo.md) documenting planned catalog architecture not yet used at runtime.

### Fixed
- Exclude Oxford test-booking dates from course-application deadline coverage while preserving separate dated, undated, and conflicting states.
- Correct top-five university records for historical versus unpublished fees, program-specific costs, and shared versus program-specific application routes.

## 6.14.0 (2026-09-24) - Applicant Planning and University Coverage

### Added
- Expand applicant profiles with citizenship, education background, target study level, entry cycle, route context, and optional locally saved annual family income.
- Add program-scoped admissions, deadlines, costs, funding coverage, qualification guidance, structured awards, and an applicant planning workspace.
- Add dated deadline calendar views and English/Russian guidance when program facts are missing.
- Add official-source data for selected undergraduate, master's, doctoral, and professional routes at MIT, Imperial College London, Stanford, Harvard, and Oxford.

### Changed
- Refine UniFit and applicant profile handling for broader study-level and route context.
- Keep UniChance independent of budget and grants, showing family-income comparisons with published aid thresholds as context rather than an eligibility decision.
- Clarify funding conditions, application steps, and deadlines without treating potential awards as guaranteed or deducting them from published costs.

## 6.13.0 (2026-09-23) - Seamless Localization and Calm Interactions

### Added
- Show the profile save state continuously next to the back button with distinct saved and unsaved styling.

### Changed
- Switch navbar and favicon logos from PNG to theme-aware SVG.
- Standardize section tabs on a 2px pill sliding indicator with matching underlines across catalog, detail, admissions, and profile pages.
- Replace press-shift active effects and restyle segmented toggles, settings switches, and filter resets with consistent surface states.

### Removed
- Remove the map "Show the whole world" overview control; world navigation remains available through zoom controls.

### Fixed
- Prevent English text flashes during client-side navigation in Russian by hydrating cached localizations before rendering the destination page.
- Keep the dismissed Bachelor's scope notice hidden across SPA navigation without flicker.
- Show the shared "No data" label instead of field-name placeholders for missing university facts.
- Fix Russian save-state and availability copy.

## 6.12.0 (2026-09-21) - Major-Aware UniFit Catalog

### Added
- Keep universities without the selected study program in UniFit results at a lower fit rank, marked with a localized "Program Not Offered" status.
- Add an accessible overflow control for extra catalog-card status indicators with outside-click and Escape-key dismissal.

### Changed
- Standardize hover, active, focus, and disabled control states across shared interaction surfaces.

### Fixed
- Reject fractional annual budgets in profile API payloads to keep the integer budget contract consistent across clients.

## 6.11.0 (2026-09-21) - Interactive University Programs

### Added
- Rework the university Programs tab into collapsed-by-default, single-open detail accordions with per-program admissions data.
- Add live program search with filtering, a clear control, an empty state, and a persisted query per university.
- Pin programs matching the profile major first with a "Your major" badge and localized field tags, syncing when the profile changes.
- Add English and Russian strings for program detail toggles, search controls, and the major badge.

### Fixed
- Keep every program card collapsed when entering the Programs tab instead of auto-expanding the first program.

## 6.10.3 (2026-09-21) - Map Results Lifecycle Test Completion

### Maintenance
- Cover on-demand map result-rail creation after both initial load and list-view reload in regression tests.

## 6.10.2 (2026-09-21) - Map Results Lifecycle Fix

### Maintenance
- Update map-view interaction tests for on-demand result-rail rendering, removing a stale preloading assertion.

## 6.10.1 (2026-09-21) - Map Catalog Isolation Fix

### Fixed
- Prevent hidden map-result cards from duplicating catalog cards in the list view before the map is opened.

## 6.10.0 (2026-09-21) - Scalable Interactive University Map

### Added
- Add a compact, bounds-aware university map-points API for client-side Leaflet clustering, avoiding full catalog payloads for map markers.
- Add progressive loading to the map results rail in pages of 100 universities with automatic continuation and an accessible manual retry/load-more control.
- Hydrate full university card details when opening a map marker, and add clear map zoom and return-to-world controls.

### Fixed
- Keep Leaflet markers visible when the map wraps horizontally and prevent blank areas beyond north and south Web Mercator limits.
- Match map popup pointers to university cards in light and dark themes and remove vertical card movement on hover.

## 6.9.1 (2026-09-21) - Anti-Vibe Coding Guardrails and Code Quality Hardening

### Maintenance
- Add `npm run check:hardcoded-text` to catch raw HTML text nodes missing localization bindings.
- Add `npm run check:inline-styles` with baseline tracking to prevent unapproved inline styles in HTML and JavaScript.
- Add Python AST hygiene tests enforcing explicit exception handling rules in backend code.
- Extend the design system linter to enforce borderless components and forbid `transition: all`, integrating all new checks into `test:all`.

## 6.9.0 (2026-09-21) - Seamless Language Switching and Coverage Expansion

### Added
- Keep university catalog cards and detail media visible while localized content refreshes, showing accessible text-only placeholders and a pending language state.

### Fixed
- Prevent missing admission rates and costs from being interpreted as zero during university comparisons.

### Maintenance
- Add frontend coverage reporting to unit tests and expand regression coverage for cache revalidation, runtime helpers, settings, translations, details, and comparisons.

## 6.8.20 (2026-09-21) - University Detail Language Switch Fix

### Fixed
- Preserve the selected university when switching interface language from a detail page, preventing missing-ID errors and endless loading after refresh.

## 6.8.19 (2026-09-21) - Co-founder Role Attribution

### Changed
- Update governance, About, and legal disclosures in English and Russian to attribute Mukhammed Shabdaluly (@mukhammedsh) as Co-founder & Lead Developer and Yerbolat Rashidov (@raiselx) as Co-founder & UI/UX Lead.

## 6.8.18 (2026-09-21) - OSPS Baseline Security Hygiene

### Security
- Add a machine-readable Security Insights declaration and an OSPS Baseline Level 1 assessment tracking security practices and repository settings.
- Validate release tags before checkout and publication so unexpected release metadata cannot reach privileged release automation.
- Include the MIT `LICENSE` in every custom release ZIP archive and add a release checklist verification step.

## 6.8.17 (2026-09-21) - SonarCloud Quality Gate and Fuzzing Isolation

### Fixed
- Restore catalog rendering after map warmup and resolve static-analysis findings across frontend normalization, accessibility, encoding, icon, and lint utilities.

### Security
- Harden trusted-proxy validation, maintenance-script repository boundaries, dependency installation, and build inputs identified by static analysis.
- Run ClusterFuzzLite builds as an unprivileged user while keeping copied source files immutable during fuzzing.
- Refresh hash-locked Python dependencies and keep CPU-only PyTorch resolution isolated from the public package index.

### Maintenance
- Add the SonarCloud Quality Gate badge to `README.md` after passing with zero open issues.

## 6.8.16 (2026-09-21) - SonarCloud Remediation and Security Hardening

### Fixed
- Fix price-display parsing with nested primary-label parentheses and add regression coverage.
- Improve form accessibility labels, deterministic sorting, numeric comparisons, and static-analysis compliance.

### Security
- Restrict trusted reverse proxies to explicit private network ranges so documentation and benchmark address blocks are not trusted.
- Make the Python dependency audit blocking in the security workflow and document scanning coverage.
- Add repository-boundary validation to data maintenance scripts and upgrade cache-key hashing to SHA-256.

### Maintenance
- Add SonarCloud configuration scanning application code, scripts, workflows, Dockerfiles, and fuzzing setup while excluding generated assets and catalog data.

## 6.8.15 (2026-09-21) - OpenSSF Silver Governance and Architecture Documentation

### Added
- Publish system architecture documentation in `docs/architecture.md` covering platform layers, security pipeline, UniFit/UniChance scoring, `multilingual-e5` embeddings, and Redis caching.
- Publish the four-phase engineering roadmap in `docs/roadmap.md` covering Stabilization, Authentication & Persistence, Mobile Experience, and Academic Expansion.
- Establish project governance in `GOVERNANCE.md` with maintainer decision-making, RFC processes, contributor roles, and Bus Factor (>= 2) continuity with @mukhammedsh and @raiselx.
- Complete Contributor Covenant 2.1 compliance in `CODE_OF_CONDUCT.md` with four-level stepped enforcement (Correction, Warning, Temporary Ban, Permanent Ban).
- Update `SECURITY.md` with version 6.x support, response SLAs (48h acknowledgment, 7d triage, 14–30d fix), and researcher credit attribution.
- Cross-reference architecture, roadmap, governance, and conduct documents from `README.md` and `CONTRIBUTING.md`.

### Security
- Author a formal Security Assurance Case in `docs/security-assurance.md` detailing the threat model, trust boundaries, secure design principles, and OWASP Top 10 countermeasures for OpenSSF Silver.
- Integrate GitHub Sigstore build provenance attestations into release workflows with verification instructions for release archives and Docker images.

## 6.8.14 (2026-09-20) - Test Coverage Expansion for OpenSSF Silver

### Maintenance
- Expand backend tests for Redis storage and background tasks to 100% line coverage, raising overall backend coverage to 85%.
- Expand frontend unit tests for image fallbacks, invalid currency formatting, mobile search controls, and offline notices, reaching 80.15% frontend coverage.
- Add standard DOM query stubs to the frontend unit-test mock setup.

## 6.8.13 (2026-09-20) - Security Hardening And Supply Chain Pinning

### Security
- Pin all GitHub Actions across CI, security, hygiene, release, and fuzzing workflows to full immutable commit SHAs.
- Restrict `GITHUB_TOKEN` permissions with least privilege, defaulting tests to read-only contents and scoping write access to release publishing.
- Pin the backend Dockerfile base image to multi-arch digest `python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9` and lock the pip version.
- Integrate ClusterFuzzLite continuous fuzzing with Atheris covering AI scoring, UniChance, ROI calculations, and Pydantic request models.

### Maintenance
- Remove an unused motion import in catalog page code identified by CodeQL.

## 6.8.12 (2026-09-20) - Responsive Breakpoint Consolidation

### Changed
- Standardize responsive breakpoints around 480px, 640px, 768px, 1024px, and 1280px across catalog, profile, admissions, and detail layouts.
- Remove conflicting legacy navbar rules and consolidate narrow-screen behavior in the shared responsive layer.

## 6.8.11 (2026-09-20) - Mobile Footer Layout Fixes

### Fixed
- Keep the mobile Filters control above the footer while scrolling through the catalog.
- Center mobile footer separators, group footer navigation into stable rows, and wrap Russian legal links cleanly across phone and tablet widths.

## 6.8.10 (2026-09-20) - ROI Visibility Test Coverage

### Maintenance
- Update unit tests so missing verified salary data hides the ROI panel in every supported interface language.

## 6.8.9 (2026-09-20) - Finance Cost Presentation Refinements

### Changed
- Hide the ROI panel when verified graduate salary data is unavailable instead of rendering an incomplete calculation.
- Unify paid and grant funding-card surfaces using compact elevated badges rather than a grant-card fill or badge outline.
- Align finance metadata labels and values on their text baselines for clearer scanning.

## 6.8.8 (2026-09-20) - Scorecard Action Registry Migration

### Security
- Update OpenSSF Scorecard Action to v2.4.4 so scheduled security scans use its GitHub Container Registry image instead of the unavailable Google Container Registry image.

## 6.8.7 (2026-09-20) - Borderless Surface Hierarchy Refinement

### Changed
- Establish borderless surfaces as the default component treatment in `docs/design-system.md`, reserving lines for focus outlines, active tabs, separators, and compact state rings.
- Define surface contrast and subtle elevation as hierarchy cues for adjacent interactive controls in light and dark themes.
- Rework profile forms, university detail cards, and catalog hover, comparison, and status states to use semantic surfaces and shadows instead of borders.

### Maintenance
- Exclude locally generated visual-audit outputs from version control.

## 6.8.6 (2026-09-20) - Direct View Switching and Security Checks

### Changed
- Replace the shared-card list/map transition with an immediate view switch, keeping active control feedback while eliminating layout-shifting motion.

### Security
- Add Trivy filesystem scanning for exposed secrets and insecure configuration with GitHub code-scanning uploads.
- Add scheduled OpenSSF Scorecard security checks with SARIF reporting.

## 6.8.5 (2026-09-20) - Catalog Error Layout Fix

### Fixed
- Span catalog error screens across the full results grid so loading failures center over the catalog area rather than the first column.

## 6.8.4 (2026-09-20) - Secure Audit Diagnostics and Code Quality Cleanup

### Security
- Prevent university-data audit diagnostics from printing raw salary figures, major names, provenance labels, or unknown keys, reporting only the affected field.

### Maintenance
- Add a regression test ensuring sentinel private values never appear in salary or outcome audit diagnostics.
- Remove unused imports, locals, and an unreachable sorting helper flagged by CodeQL without changing behavior.

## 6.8.3 (2026-09-20) - Desktop Filter Viewport Sizing and Calm Surface Polish

### Changed
- Size the desktop filter sidebar dynamically to fit remaining viewport height and allow full vertical scrolling to top controls like sort strategy.
- Replace saved-filter pill buttons with clean underlined section tabs and accent indicators.
- Restyle utility controls, onboarding actions, and UniFit warning buttons with soft token surfaces and subtle elevation without harsh borders.

### Maintenance
- Add browser coverage for desktop filter viewport clamping and updated university detail control backgrounds.

## 6.8.2 (2026-09-20) - Restrained Font-Weight Hierarchy and Border Cleanup

### Changed
- Introduce a three-step font-weight hierarchy (400, 500, 600) and replace heavier weights across stylesheets with restrained typography.
- Remove decorative borders from cards, chips, badges, tags, funding options, exam groups, and stat boxes in favor of surface contrast and shadows, documenting the rules in `docs/design-system.md`.

### Maintenance
- Extend the design linter to reject font weights outside 400, 500, and 600.
- Update comparison layout tests for borderless funding cards.

## 6.8.1 (2026-09-20) - Stylesheet Ownership Refactor

### Changed
- Split the monolithic global stylesheet into ordered shared modules and page-owned stylesheets for profile and university catalog views, removing duplicate rules.
- Document stylesheet module ownership in `docs/design-system.md` and restrict palette literals in the token checker to the shared foundation module.

## 6.8.0 (2026-09-20) - Wiki-Style Guide Section Navigation

### Changed
- Replace the guide's end-of-article pull gesture with persistent previous and next section controls showing destination titles and preserving direct section links.
- Size the guide reading surface to its article content instead of stretching to sidebar height, and localize navigation labels in English and Russian.

## 6.7.0 (2026-09-20) - Focused Guide Navigation

### Added
- Add a compact mobile Contents disclosure on the guide page that tracks the active article and closes on selection or Escape.
- Add a reduced-motion-aware pull gesture at the end of guide articles to advance to the next section, canceling when direction reverses.

### Changed
- Replace the guide's in-article table of contents with focused sidebar navigation under "Discovery & comparison" and localize all new controls in English and Russian.

## 6.6.0 (2026-09-20) - Seamless Catalog and Map Switching

### Added
- Prepare map results and Leaflet initialization right after the first catalog paint, keeping view controls disabled until both modes are ready.

### Changed
- Add a reduced-motion-aware transition between catalog list and map modes, preserving visible results during refreshes.
- Refine the map results rail with balanced panel padding, vertically stacked status badges, and unified thin themed scrollbars.

## 6.5.0 (2026-09-20) - Recurring Tuition and One-Time Costs

### Added
- Keep annual tuition distinct from verified one-time enrollment fees for Kyoto University, Johns Hopkins University, and SDU University.
- Add a localized one-time payments section to university finance details showing enrollment timing and whether fees apply to grant holders.

### Fixed
- Retain the published sticker price in UniChance when a grant route lacks a verified net-price override instead of implying zero tuition.

### Maintenance
- Validate official source URLs for one-time fees in the data audit.
- Add backend contract and browser tests confirming SDU's enrollment fee remains outside annual tuition.

## 6.4.1 (2026-09-19) - Guide Diamond Bullets Alignment Fix

### Fixed
- Fix vertical alignment and left-edge clipping of rotated diamond list markers in the guide sidebar and table of contents.

## 6.4.0 (2026-09-19) - Guide Rewrite: Plain-Language Articles With Scoring Formulas

### Changed
- Rewrite all guide articles in plain-language English and Russian covering UniFit, Interests, UniChance, ROI, comparison, admission choices, exams, tags, and glossary.
- Add formula blocks showing UniFit weights, ML cosine rescaling, layered UniChance math with uncertainty ranges, ROI math, and real thresholds (0.14, 0.22, 65+, 45+, and 80/60/40 bands).
- Tighten guide typography and spacing, limit the table of contents to "In this chapter" siblings, and remove redundant blurbs and comparison flow cards.

### Maintenance
- Add browser tests covering guide tab switching, table-of-contents rebuilds, deep links, and the contents toggle.

## 6.3.0 (2026-09-19) - Map Mode Cards Unification & Full-Height Map

### Changed
- Display full catalog university cards (without cover photos and with inline logos) in the map results rail, including badges, Global Rank, yearly price, and details links.
- Fly the map to a university's marker and highlight its card when clicked in the rail, keeping details links functional for navigation or comparison.
- Stretch the map stage to fill viewport height (minimum 560px on desktop; 52dvh with 320px minimum at <= 1180px) and refit Leaflet tiles on resize.

## 6.2.0 (2026-09-18) - Mobile Search Overlay, System Theme Settings & Profile Polish

### Added
- Add a full-screen mobile search overlay on viewports <= 1024px with auto-focus, Escape and back-button closing, focus return, and resize syncing.
- Add an Appearance section in Settings supporting OS `system`, `light`, and `dark` color schemes.

### Changed
- Move theme selection from the navbar into the Settings modal.
- Replace the standalone GPA scale buttons with an interactive `/ 4.0` / `/ 5.0` toggle inside the GPA input, moving its scale hint beside the field.
- Simplify profile footer controls to text-only "Back" and "Save" buttons, add a sliding indicator to mobile profile tabs, and use natural Russian terminology in interest hints.

### Removed
- Remove the standalone navbar theme toggle button.
- Remove the profile nickname input and strip legacy `name` fields during profile storage migration.

### Maintenance
- Add unit and browser tests for theme normalization, comma-decimal GPA parsing, legacy field removal, and mobile profile layout.

## 6.1.2 (2026-09-18) - Profile Nickname Editor Relocation & Focus Polish

### Changed
- Move the profile nickname editor into a full-width header row sized to its 16-character limit with standard keyboard focus outlines.

### Fixed
- Commit nickname edits on Enter or outside click, cancel and restore on Escape, and return focus to the edit trigger.

## 6.1.1 (2026-09-18) - Compact University Comparison Tray Rework

### Changed
- Redesign the floating university comparison tray into a compact single-row bar with chip items, adaptive flex-wrapping, and mobile entry motion.

### Fixed
- Restore slot label styling in comparison overview cards.

## 6.1.0 (2026-09-18) - Search Engine Overhaul & Unified Tooltip System

### Added
- Add `sort=relevance` support to the universities API, surfacing exact alias and name matches (score >= 200) ahead of secondary sorting.
- Add Cyrillic-Latin transliteration and keyboard-layout correction to university search (for example, "cnfyajhl" -> Stanford and "vbn" -> МИТ).
- Auto-switch catalog sorting to relevance while typing a query, highlight matched terms with alias badges in navbar suggestions, and add English and Russian relevance labels.

### Changed
- Rewrite backend search scoring with Damerau-Levenshtein typo tolerance (1 edit for 4–6 chars, 2 for 7+), stem-prefix matching for Russian/English, and >= 5-char substring matching.
- Filter stop words, normalize domain synonyms, boost exact aliases (+220) and full names (+200), restrict alias prefix matching, and block noise-only queries.
- Replace native browser tooltips across catalog cards, Global Rank rows, admission chance badges, and factor chips with accessible hover, focus, click, and Escape tooltips.

### Fixed
- Prevent tooltip button clicks from triggering the underlying university card navigation link.

### Maintenance
- Add backend, unit, and E2E tests for transliteration, typo tolerance, relevance sorting, suggestion highlighting, and accessible tooltip interactions.

## 6.0.3 (2026-09-18) - Catalog Card Layout and Responsive Breakpoints

### Changed
- Cap catalog university card width at 550px and use flexible `minmax(280px, 1fr)` grid tracks so single or sparse results do not stretch across wide screens.
- Align mobile and tablet responsive breakpoints at 1024px across pages and navigation handlers to eliminate layout jitter below desktop width.

### Fixed
- Scope the mobile filter toggle to the catalog page and clear open drawer and scroll-lock states on route changes so filters do not leak onto other pages.
- Keep the navigation logo left-aligned on compact mobile screens below 560px.

### Maintenance
- Add end-to-end responsive layout tests for card width capping, tablet columns, mobile filter isolation, and mobile logo alignment.

## 6.0.2 (2026-09-17) - Applicant Profile Initial Render Polish

### Fixed
- Hide inactive profile tabs and conditional language exam containers in initial markup to prevent layout flicker before scripts initialize.
- Wait for route page initialization to complete before dismissing the initial loading overlay so the workspace appears fully styled.

## 6.0.1 (2026-09-17) - Full-Width Catalog Layout and Control Scaling

### Changed
- Expand the desktop universities workspace to full width with 28px outer gutters matching the top navigation bar.
- Scale up desktop sidebar columns (296–328px), 28px grid gaps, filter cards, 44px-tall inputs, 36px mode toggles, result counters, and 160px card thumbnails.

### Fixed
- Scope compact responsive overrides below 1180px so desktop displays do not downsize controls prematurely.

## 6.0.0 (2026-09-17) - Canonical API Contracts and Profile Storage v2

### Breaking Changes
- Decommission the deprecated `/exams/config/full` API endpoint in favor of canonical `/exams/config`.
- Remove deprecated field aliases (`rawValue`, `displayValue`, `lang`, `examId`, `gpaScale`, and snake_case admission choice keys) from exam, language, and profile API schemas.
- Standardize university financial models on `costs_breakdown_year_usd_by_mode` and `total_cost_year_usd_by_mode`, removing legacy non-mode fallbacks.

### Changed
- Deduplicate location factors across all 50 universities by removing `city_vs_outside_city` and standardizing on `city_vs_campus`.
- Simplify catalog card pricing resolution to read strictly from canonical currency-aware structures without legacy fallback branches.
- Upgrade applicant profile persistence to version 2, migrating legacy GPA and admission choice fields automatically while sending only canonical 4.0-scale GPA fields to the API.
- Preserve unrecognized profile fields, protect future schema versions (v3+) from overwriting `localStorage`, and fall back to in-memory storage with a status notice when browser storage fails.

### Maintenance
- Add regression tests for finance mode calculations, location factors, schema standardization, and profile migration resilience.

## 5.10.0 (2026-09-17) - Applicant Profile Completion Tracking and Onboarding Polish

### Added
- Add deterministic applicant profile completion tracking across budget, study mode, funding preference, GPA, standardized exams, languages, and target major.
- Display a live profile completion progress bar with percentage, item count, and accessible progressbar attributes in the profile workspace.

### Changed
- Refine profile workspace height, section navigation, and scrollbar suppression, and clarify English and Russian section headers ("General" / "Общее") and exam guidance.
- Polish onboarding tour skip and step navigation controls.

### Maintenance
- Add unit and end-to-end tests verifying profile completion calculations and real-time progress bar updates from 29% to 100%.
- Add PowerShell execution policy bypass support to the `start-dev.bat` local launcher.

## 5.9.0 (2026-09-17) - GPA Sorting, Proxy IP Hardening, and Outcomes Provenance

### Changed
- Restore descending GPA catalog sorting (`sort=gpa_desc`) by evaluating representative minimum GPA thresholds across direct requirements and admission profiles.
- Return a structured neutral ROI status (`"No Data"`) when graduate salary data is missing, showing localized notices instead of fallback estimates.
- Update comparison tables to handle missing salary values cleanly and display verified salary provenance notes.
- Retain `/exams/config/full` as a deprecated alias to `/exams/config` with identical responses and caching headers.

### Fixed
- Remove unverified salary statistics for Stanford University and Technical University of Munich, and correct CUHK program-specific HKDSE reporting from an average to a median.
- Sync university tags and graduate salary provenance with `official_facts.json` and enforce outcomes provenance checks in `npm run audit:data`.

### Security
- Harden reverse-proxy client IP resolution against header spoofing with strict IP validation, CIDR subnet support for `TRUSTED_PROXY_IPS`, right-to-left `X-Forwarded-For` traversal, and `CF-Connecting-IP` validation.
- Add regression tests for request body size capping (`REQUEST_BODY_MAX_BYTES`).

## 5.8.1 (2026-09-16) - Codebase Comments and Documentation Audit

### Maintenance
- Audit comments and docstrings across backend services, frontend scripts, stylesheets, and tests to remove outdated notes and standardize on English repository comments.
- Clarify static fallback exchange rate documentation for supported world currencies.

## 5.8.0 (2026-09-16) - Multi-Currency Profile Budget and API Normalization

### Added
- Support the user's preferred currency in the `/profile` budget input with dynamic unit labels, localized range hints, placeholders, validation limits, and low-budget grant hints (e.g., `$1,000` or `500 000 ₸`).

### Changed
- Automatically convert saved profile budgets when the preferred currency changes and normalize them to USD (clamped to 0–1,000,000) before dispatching API requests.

### Maintenance
- Add unit and end-to-end tests for multi-currency profile persistence, API payload normalization, currency switching, and dynamic validation limits.

## 5.7.2 (2026-09-15) - Search Indexing and Scoring Cache Isolation

### Changed
- Add an O(1) exact token weight lookup before falling back to fuzzy Levenshtein matching in university search.
- Precompute numeric metadata (mode-specific USD costs, acceptance rate, rank, grant/paid/aid flags) and localized search metadata at dataset load instead of inside filter loops.
- Generate catalog card payloads on demand only for the requested pagination slice (~20 items) and move factor and admission choice caches out of university dictionaries into module caches.

## 5.7.1 (2026-09-15) - Granular Test Runners and Suite Speedups

### Maintenance
- Add targeted filtering to `npm run test:backend` and create a filtered `npm run test:unit` wrapper alongside `test:fast` and `test:smoke` scripts in `package.json`.
- Add a cross-platform `npm run audit:data` wrapper script.
- Mock external `open.er-api.com` requests in currency API tests, establish deterministic test defaults, and configure local Playwright tests to reuse the multi-threaded in-memory dev server.
- Update contributor testing instructions to run targeted checks first and skip redundant full-suite reruns.

## 5.7.0 (2026-09-15) - UniChance Calibration and Multi-Exam Best Score

### Changed
- Evaluate all compatible standardized exams for an admission track and select the applicant's highest normalized score instead of stopping on the first match.
- Compute the UniChance confidence interval (`rangeLowPercent` to `rangeHighPercent`) after context modulation and feasibility clamping so the estimated chance stays within bounds.
- Integrate GPA percentile conversion into exam scoring for GPA-based tracks and enable merit scholarship boosts on grant tracks for top academic and language scores.
- Apply statistical requirement proxy scoring when empirical average statistics exist, routing minimum-only tracks to holistic estimation.

### Maintenance
- Add unit tests covering multi-exam resolution, confidence interval containment, GPA percentile conversion, and missing evidence preservation without defaulting to 0%.

## 5.6.1 (2026-09-15) - Static Analysis Hardening and Error Handling Fix

### Fixed
- Fix a `ReferenceError` in catalog error handling caused by reading classified error state before initialization during network failures.
- Align comparison toggle calls across catalog cards, overlays, and map results to use the single-parameter signature.

### Maintenance
- Remove unused search tokenization helpers, stale currency error state, unused router parameters, and dead imports across frontend and backend modules.

## 5.6.0 (2026-09-15) - UniFit Pipeline Optimization and Complete Badge Hints

### Changed
- Construct user preference and language contexts once per UniFit request instead of per university, and synchronize track selection between UniFit and UniChance.
- Refine prestige weighting with smooth logarithmic decay and expand multilingual keyword and tag heuristics for practice vs. science orientation.
- Generate all five badge hint categories (`vibe`, `admission_state`, `finance`, `requirements`, `budgetAid`) on the backend and consume them directly in catalog status badges.

### Removed
- Remove unused translation metadata fields, legacy signal artifacts, and deprecated translation key arguments from scoring pipelines.

### Maintenance
- Add regression tests verifying context reuse, track synchronization, clean payloads, and full badge hint coverage.

## 5.5.1 (2026-09-15) - Instant Compare Toggling and Card Tooltip Formatting

### Fixed
- Sync catalog card action states directly in the DOM when toggling compare mode instead of refetching data, resetting pagination, or losing scroll position.
- Split university card status tooltip titles and descriptions into separate elements with accessible colons in English and Russian.

### Maintenance
- Add end-to-end tests confirming zero network fetches on compare mode toggles and verifying structured badge tooltip elements.

## 5.5.0 (2026-09-15) - Active Connectivity Probing and Resilient Offline Mode

### Added
- Probe the backend `/health` endpoint with short-term caching and timeouts to detect captive portals and dead Wi-Fi connections.
- Display a localized offline notice inside the global navbar search dropdown instead of closing suggestions abruptly when offline.

### Fixed
- Preserve already-rendered catalog cards with a localized warning toast when a refresh attempt fails offline instead of clearing the view.

### Maintenance
- Add unit tests for active connectivity probing, error response simulation, and offline search notice rendering.

## 5.4.0 (2026-09-15) - Error Classification and Automatic Reconnection

### Added
- Classify frontend failures into `offline`, `5xx` server errors, `404` missing resources, and generic runtime errors so backend or client bugs do not show "No Internet Connection".
- Add a global network status banner and trigger silent data reloads across catalog, comparison, and detail views upon reconnection.
- Add semantic offline, server error, and generic error screen components with synced icons and English/Russian localization.

### Fixed
- Keep existing catalog cards visible with a non-intrusive status toast when transitioning offline while cached items are available.

### Maintenance
- Add unit tests for error classification, online detection, and error component rendering.

## 5.3.0 (2026-09-15) - Neural-Only ML Interests Scoring and Smart Tag Guidance

### Changed
- Remove the lexical TF-IDF fallback from ML interest scoring so recommendations rely exclusively on `multilingual-e5-base` embeddings and report `unavailable` status to the UI when offline.
- Reframe the profile interests field around comma-separated smart tags in English and Russian interfaces, replacing budget and city clutter in placeholders and quick chips with AI & Data Science examples.

### Removed
- Remove the unused `scikit-learn` dependency from backend requirements.

### Maintenance
- Update ML scoring and persona regression tests for neural-only scoring, unavailability flags, and multilingual ranking.

## 5.2.2 (2026-09-15) - Backend Input Validation and URI Hardening

### Security
- Reject null bytes (`\x00`, `%00`) in request paths and query strings with HTTP 400, cap URI paths at 2048 characters with HTTP 414, and ensure security headers appear on 413 responses.
- Enforce key length (128 chars), value length (2048 chars), and scalar type limits on profile `details`, slug patterns on `university_ids`, bounds on exam/language validation scores, and `1 <= page <= 10,000` on AI sort requests.
- Validate `GET /universities` text queries, numeric filters (tuition/budget <= 1,000,000, acceptance <= 100, page <= 10,000), sort keys, and `university_id` path slugs (`^[a-zA-Z0-9_-]+$`, max 128 chars).

### Maintenance
- Add regression tests covering query bounds, path slug checks, null-byte rejection, and schema boundaries.

## 5.2.1 (2026-09-15) - Mobile Catalog Drawer and Counter Fixes

### Changed
- Redesign the mobile recently viewed section as a horizontally scrollable row of compact chips with truncation and accessible close targets.
- Switch the compare mode button below 480px to a compact icon control with localized tooltips so found-results counts display in full without truncation.
- Streamline mobile filter drawers by hiding duplicate header reset buttons, adding spacing above sticky action footers, and formalizing flat surface and restrained motion guidelines.

### Fixed
- Fix mobile filter drawer scrolling on Android devices by removing `translateY` from main page entry animations that created a broken containing block for fixed sheets.

## 5.2.0 (2026-09-14) - Legal Disclosures, Workspace Refinement, and Privacy Cleanup

### Changed
- Update the Privacy Policy and Terms of Use to cover guest-only operation, API processing, caches, browser storage, third-party services, the MIT license, and email-based takedowns, adding visible last-updated dates.
- Stop sending applicant profile names to the backend API and remove the unused name field from profile request schemas.
- Rebuild the 404, Privacy, and Terms pages with responsive layouts, refine shared workspace spacing and tokens, update Settings currency copy, and refresh compact logo SVG/PNG assets.

### Maintenance
- Update unit and end-to-end tests for anonymous API payloads, last-updated dates, 404 density, currency settings, and localized `Compare mode` labels.

## 5.1.0 (2026-09-14) - Dedicated Comparison Route, Multi-Currency Engine, and Admissions Enrichment

### Added
- Extract university comparison into a standalone `/compare` route with deep-linked pair IDs, choices, and stages (`/compare?ids=...&choices=...&stage=...`) plus redirects from legacy `/?tab=compare` URLs.
- Add `GET /currency/rates` and `GET /currency/status` endpoints supporting 160+ ISO fiat currencies via in-memory cache, Redis, ExchangeRate-API with backoff, and 62-currency static offline fallback rates.
- Add a searchable Currency selector in Settings with English/Russian currency names, browser persistence, and instant price re-rendering across catalog, filters, comparison, and detail views.
- Add automatic composite scoring for language exams (`average` rounded to 0.5 for IELTS, `sum` for TOEFL iBT) and require all section scores when an overall score is omitted.
- Add active toast deduplication and automatic dismissal of prior error toasts when a new error appears.
- Add official comparison metadata for Oxford Computer Science and Harvard College, plus search aliases for University of Waterloo ("UWaterloo") and Satbayev University ("Политех").

### Changed
- Rework university comparison into a decision aid replacing a single winner score with paired admissions, cost and aid, academic-model, and outcomes signals (advantage, trade-off, parity, incomparable, or missing data).
- Separate published admission statistics from personal UniChance in comparisons (showing unavailable rather than `0%` on missing evidence) and align cost comparisons by year, fee status, and scope with source links and verification dates.
- Expand verified programs, tuition (including KZT/KRW), living costs, and need-based aid across 25+ global institutions (MIT, Stanford, Harvard, Oxford, Cambridge, Imperial, ETH Zurich, NUS, Tsinghua, Waterloo, KAIST, and others).
- Update tuition schedules, UNT thresholds, psychometric profiles, and 110+ Russian admissions translations across 13 Kazakhstani universities (Nazarbayev University, KBTU, KazNU, ENU, SDU, Satbayev, KIMEP, Narxoz, IITU, AITU, AMU, KazNMU, Abai KazNPU).
- Rework the first-visit catalog tutorial into a required-or-skipped six-step workspace that opens `/profile` from the profile step and resumes after saving.
- Split approximate catalog card tuition (significant-figure rounding) from exact detail and comparison values while raising the default USD tuition slider cap from $50,000 to $100,000 with adaptive 1-2-5 slider steps.
- Unify profile display names and fields into one atomic draft/save flow with `beforeunload` warnings on unsaved edits, keyboard focus trapping in modals, and a truthful device/session persistence status.
- Clarify `institution_wide_only` admissions states, synchronize pre-selected choices with active requirement tabs, and upgrade admissions source links into structured cards.
- Complete Russian display labels for SAT, AP, IB, A-Level, and HKDSE subjects plus IELTS and TOEFL sections, and flatten comparison admission configuration into selectable list rows.
- Enable navbar university search on the root catalog (disabled only in the compare workspace), rework mobile filters with transactional apply/reset actions, and update CPU PyTorch to `2.13.0`.

### Fixed
- Fix composite A-Level exam validation by sending clean `raw_value` strings without nested `details`, raising `MAX_DETAILS_DEPTH` from 4 to 5, and stripping `[object Object]` and `Value error, ` from validation toasts.
- Fix Oxford PPE & Humanities undergraduate admission scope to `"program"`, fix navbar grid alignment in search mode, and fix card badge hover borders (`#111827`) and repeated-tap tooltip closing.
- Fix mobile slider thumb jitter, add filter drawer scroll locking and safe-area padding, prevent narrow-screen wrapping in profile name editing, and restrict the ML unavailable banner to `uni_ai` sorting.
- Guard composite language forms against duplicate event bindings and submissions, hide manual overall score inputs for composite language exams, and bump configuration storage cache to `unisearch_config_cache_v2`.

### Maintenance
- Add unit, backend, and end-to-end tests covering `/compare` routing, currency rates and sliders, toast deduplication, A-Level and IELTS validation, unsaved-change prompts, Russian exam labels, and badge layout.

## 5.0.5 (2026-09-11) - Global Multi-Currency Support and Expanded University Fact Base

### Added
- Add multi-currency conversion and display across catalog, filters, comparison, and university details using cached live and offline exchange rates, currency-specific tuition slider limits, and a Settings selector.

### Changed
- Expand verified tuition, living-cost, academic-program, and track-based admission data with standardized Russian descriptions across 15 institutions.

### Maintenance
- Add English and Russian currency localization alongside backend, unit, and Playwright coverage for rate handling, sliders, settings persistence, and catalog price updates.

## 5.0.4 (2026-09-11) - Global Rank Sort, 404 Redesign, and CodeQL Security Fixes

### Changed
- Move university rankings from a standalone tab into a catalog sort strategy (`?sort=rank_asc`), leaving Catalog and Comparing as the primary workspace modes and adding verification tooltips to card rank metrics.
- Redesign the 404 error page with flat semantic tokens, keyboard focus outlines, and a skip-to-main-content anchor.
- Unify empty-state messaging across views to distinguish zero results from empty saved-only filters and remove duplicate in-card reset buttons.
- Rewrite the README and contributor guidelines in English around current catalog, comparison, profile, UniFit, UniChance, ROI, and verification workflows while keeping release history in `CHANGELOG.md`.

### Removed
- Remove the standalone Ranking tab, legacy ranking page/stylesheet, and unused `ranking.*` localization keys while retaining rank source and status keys for card tooltips.

### Fixed
- Fix mobile filter drawer padding and sticky header layering, and clean up redundant GPA normalization comparisons and dead frontend/backend code.

### Security
- Resolve 29 CodeQL alerts, including eliminating path injection in the frontend dev server via pre-indexed file allowlist lookups and narrowing exception handling in language CEFR indexing.
- Expand `Content-Security-Policy-Report-Only` `img-src` rules in the frontend dev server for local origins, `unpkg.com`, and OpenStreetMap tiles.

### Maintenance
- Update unit, Playwright E2E, and token/design-lint baselines for global rank sorting and the streamlined workspace tabs.

## 5.0.3 (2026-09-11) - Unified Workspace, Global Navbar Search, and Accessibility Polish

### Changed
- Merge the standalone universities view into the root `index.html` SPA workspace with Catalog, Ranking, and Comparing tabs, a shared filter sidebar, and footer links for Guide and About Us.
- Move university search into the central navbar with keyboard-navigable autocomplete suggestions, unified placeholder copy, and automatic hiding on comparison stages and informational pages.
- Relocate the results counter and compact List/Map view toggles into the section tab bar, recovering 64px of vertical viewport space, and route Ranking queries through `/universities?sort=rank_asc` with a shared 50-entry/30s LRU cache.
- Rework the University Costs tab with distinct paid and grant surfaces, clarify bachelor-only scope copy, simplify the About page around team and evidence, and add light/dark ranking tokens.
- Persist first-visit tour dismissal, add keyboard focus trapping to tour and UniFit warning dialogs, add a skip-to-main-content link, and support Arrow/Home/End keyboard navigation across section tabs.

### Removed
- Remove the legacy landing stylesheet, unused preview assets, dead frontend helpers, redundant cache layers, duplicate transitive dependencies, and the redundant mobile filter summary bar.

### Fixed
- Fix mobile filter drawer layering below the comparison tray, slider thumbs bleeding through sticky filter headers, view toggle icon centering, mobile profile header alignment, and hidden view-toggle/footer separator rendering.

### Maintenance
- Update E2E suites, frontend dev server, and performance audit tooling for SPA routing and unified tab switching.

## 5.0.2 (2026-09-10) - Design System Scale, Borderless Toolbar, and Design Lint Guard

### Changed
- Modularize the catalog stylesheet into seven ordered modules and standardize typography, 4/8px spacing, z-index tokens, and border radii across all 10 stylesheets, clearing all 885 design-lint violations.
- Remove the nested card box around the catalog search toolbar, align the results counter with the filter header, and combine the search bar with a clear button and view switcher into one row.
- Add consistent pressed, disabled, loading, focus-visible, and reduced-motion states, WAI-ARIA combobox keyboard navigation for custom selects, inline localized profile validation feedback, and fine-pointer hover isolation.
- Enable strict `z-index` and `border-radius` checks in `npm run check:design-lint` by default and include it in `npm run test:all`.

### Fixed
- Fix CSS syntax bracket errors, card overlay click interception, initially visible UniFit tooltips, and active background bleed inside the list/map view toggle.

## 5.0.1 (2026-09-09) - Zero-Hardcoded CSS Tokens and Detail Page Refinements

### Changed
- Eliminate all 596 hardcoded HEX, RGB, and HSL color literals across all 10 stylesheets, standardizing on `#5D17EB` accent color-mixing and root theme switching across all 9 HTML pages.
- Streamline the university detail page by removing duplicate acceptance badges, tightening General tab spacing, styling admission major tags as clean bold text, and moving funding selection actions into card headers.
- Flatten the About page layout, add focus-visible outlines and reduced-motion-safe entry transitions, and expand English/Russian translations for admission tracks and major tags.

### Maintenance
- Add `npm run check:tokens` and enforce color token checks in GitHub Actions, plus Playwright tests for university detail card layout and spacing.

## 5.0.0 (2026-09-08) - Academic Workspace Redesign, Dual-Scale GPA, and Security Hardening

### Added
- Add a dedicated `/profile` page with responsive cards, sticky toolbar, completion progress indicator, and client routing.
- Add Privacy Policy (`/privacy`) and Terms of Use (`/terms`) pages in English and Russian with sticky table of contents, scrollspy navigation, and footer links across all pages.
- Add official UNT/ENT score distributions (p25, median, p75) and calibrated minimums for 12 Kazakhstani universities (KBTU, AITU, IITU, SDU, KazNU, ENU, Satbayev, KazNMU, AMU, Abai KazNPU, KIMEP, Narxoz).
- Add decomposed curriculum tracks and scholarships for Imperial College London, University of Melbourne, University of Toronto, and University of Tokyo (PEAK).
- Add holistic review selectivity guidance for universities under 10% acceptance rate.
- Implement dynamic track-based grant modeling (`funding_type === "grant"`) across 10 international universities (Oxford, Cambridge, UNSW, USyd, McGill, ANU, Edinburgh, Manchester, UBC, Waterloo) and Kazakhstani universities.
- Add `robots.txt`, `sitemap.xml`, `noindex` on 404, Open Graph/Twitter preview cards, and a reference Nginx configuration with Slowloris and connection concurrency limits.

### Changed
- Overhaul GPA inputs and schemas from percentages (0–100%) to dual-scale 4.0 international and 5.0 KZ/CIS grading, normalizing GPA requirements across all 50 universities to 4.0 floats.
- Calibrate AI and ML scoring to factor budget-vs-prestige deltas, 0.35 semantic similarity penalty weight, low-relevance major penalties, rescaled `multilingual-e5` contrast, and post-grant net cost deductions.
- Upgrade page transitions with the native View Transitions API, hover prefetching, 120ms anti-flicker GPU-accelerated skeletons, instantaneous theme toggling, and deterministic top-anchor scrollspy navigation.
- Overhaul comparison overview verdicts to replace 0–100 progress bars with metric-backed lead and parity reasons.
- Add a 'Differences only' toggle, best-cell highlights, sticky table headers and columns, and inline track selectors in comparison results.
- Redesign the home, About, Guide, and 404 pages around flat solid backgrounds, unified semantic tokens, sticky footers across all 9 pages, uniform `#ffffff` university logo backgrounds, and right-sliding toast animations.
- Modularize large catalog, profile, and backend university track modules, removing over 3,700 lines of unused CSS.

### Removed
- Remove 8 unimported orphan catalog scripts, the legacy `frontend/ranking.html` redirect, deprecated `docs/data_research/` fragments, unused prototype images, synthetic tests, and one-off enrichment scripts.

### Fixed
- Fix startup `ReferenceError` bugs that falsely triggered offline screens, scroll jumping on catalog reload, profile reset/discard modal persistence across client navigation, and empty score coercion to `0`.
- Fix E2E regressions for missing-evidence UniChance rendering, recent-chip remove click interception, 4.0 GPA values, Imperial SAT track keys, and SDU's Russian abbreviation.

### Security
- Add `DOCS_ENABLED` to hide `/docs`, `/redoc`, and `/openapi.json` in production and return structured JSON 500 responses with `X-Request-Id`.
- Harden proxy IP resolution (`CF-Connecting-IP` / `X-Forwarded-For`) and enforce a 4096-byte query string cap (HTTP 414).
- Optimize the rate limiter with an O(1) `OrderedDict`, rate-limit `/universities/compare-profiles` (120 req/min) with Redis and LRU caching, harden AI-sort caches to 512 entries, and add a circuit breaker to text translation.
- Update `LICENSE`, `THIRD_PARTY_NOTICES.md`, legal pages, and fork docs to identify project creators (`unisearch@inbox.ru`) and exclude third-party trademarks and photos from the MIT license.
- Establish Nominative Fair Use media rules with a 48-hour takedown SLA, mark Google Sign-In as in-development, and disclose OpenStreetMap/Leaflet usage.

### Maintenance
- Add contributor engineering standards in `AGENTS.md`, switch CI to `npm ci`, and expand backend, unit, and E2E test suites across scoring, funding options, scrollspy, toasts, sticky footers, and 404 density.

## 4.9.10 (2026-09-02) - Dependency Updates and CI Toolchain Upgrades

### Maintenance
- Update GitHub Actions workflows to v7 across checkout, Node, and Python setup actions.
- Update backend web and ML dependencies to FastAPI 0.139.0, Starlette 1.3.1, Uvicorn 0.50.0, scikit-learn 1.9.0, PyTorch 2.12.1+cpu, and sentence-transformers 5.6.0.
- Update runtime and observability packages to typing-extensions 4.16.0, Redis 8.0.1, prometheus-fastapi-instrumentator 8.0.2, Sentry SDK 2.64.0, and Pillow 12.3.0.
- Upgrade the Playwright test runner (@playwright/test) to 1.61.0.

## 4.9.9 (2026-06-19) - Compare Admission and Badges Rework

### Changed
- Allow selecting admission choices directly inside the university comparison view, including a new compact mode.
- Unify and center status badges such as UniChance, Low confidence, and Paid across the site with consistent borders and theme colors.
- Isolate inline admission choice selection in the comparison view so it no longer alters saved university detail state.

### Fixed
- Restore admitted score context and funding-specific requirements in comparison table rows.

## 4.9.8 (2026-06-18) - UniChance Scoring Calibration Tests

### Maintenance
- Add UniChance scoring calibration unit tests across 6 student personas (Alexey, Maria, Dias, Adil, Lisa, and Anonymous) against MIT, TUM, and Nazarbayev University data.

## 4.9.7 (2026-06-18) - Metadata Performance and Finance Layout Docs

### Changed
- Load localized university names once outside the metadata-building loop to improve catalog processing performance.

### Maintenance
- Document intentional card alignment behavior in the finance grid styles.

## 4.9.6 (2026-06-18) - Performance, Security, and Testing Improvements

### Changed
- Hoist translation loading out of the per-university metadata loop to speed up catalog metadata generation.

### Security
- Fix an XSS vulnerability in search suggestion rendering by replacing raw HTML injection with safe DOM element creation.

### Maintenance
- Add unit tests for client-side safe storage helpers.

## 4.9.5 (2026-06-18) - Compare Bar Visibility and Typography Hotfix

### Changed
- Reduce comparison bar helper text and action button weights from extra-bold (800) to semibold (600) and remove double-bolding on university slot names.

### Fixed
- Hide and clear the floating comparison tray when navigating away from the universities catalog via client-side routing.

## 4.9.4 (2026-06-18) - University Detail Grant and Funding Layout

### Changed
- Add distinct soft green backgrounds to grant options across light and dark themes while keeping selected grant states clear.
- Format the "Funding-specific differences" section title in sentence case with normal weight so sub-pane headings stand out clearly.
- Reduce overly heavy 800-900 font weights to 500-700 across all page stylesheets to align with the Calm Academic Workspace typography hierarchy.

### Fixed
- Replace hardcoded dark-green gradients on dark-mode grant options and estimated cost blocks with consistent theme surface colors.

## 4.9.3 (2026-06-18) - Hover, Comparison Workspace, and Typography Consolidation

### Changed
- Consolidate hover and active transitions on catalog, comparison, and map-result cards with height-stable styles and subtle accent highlights.
- Replace the non-standard country filter input in ranking views with a standard dropdown select control.
- Move university comparison configuration and results inline into the workspace view, replacing heavy drop shadows with flat bordered 10px-radius cards.
- Show the full list of "Additional Requirements" in the comparison view instead of truncating items behind a +N counter.
- Reduce heavy 750-950 font weights to medium (500) and semibold (600) across cards, profile controls, and comparison views, keeping bold (700) for main headings, placeholders, and remove actions.

### Removed
- Remove the legacy comparison modal now that comparison setup and results live inline in the workspace.

### Fixed
- Fix an unmatched closing bracket syntax error in the universities catalog stylesheet.
- Restore university thumbnail background images with theme-aware overlays on ranking cards.
- Align dark-mode catalog card backgrounds with surrounding workspace surface colors.
- Center-align the UniChance badge, funding track label, and recommendation status in the comparison configuration header, and normalize UniChance badge sizing across detail and comparison pages.

## 4.9.2 (2026-06-18) - Guide Scroll and Workspace Navigation Fixes

### Added
- Include a full-project archive alongside frontend and backend deploy archives in releases, with guidance on choosing the right asset.

### Changed
- Persist and restore the last active universities tab (Catalog, Comparing, or Map) across reloads and back-navigation.
- Share "Bachelor's only" notice dismissal state via local storage across both the catalog and university detail pages.
- Build release archives from tracked Git files and include package metadata in the backend archive so runtime version info remains available.

### Fixed
- Keep the Guide page URL hash synchronized on scroll and restore scroll alignment to the active section after dynamic configuration loads.

## 4.9.1 (2026-06-17) - Detail Actions and Map Card Alignment

### Changed
- Group university detail actions (save, compare, share, and "Back to list" on the right) into one aligned control bar.
- Style map-result card links to match catalog cards with a muted "View details" label and arrow indicator, and round the map-results scrollbar.

### Fixed
- Prevent horizontal cropping on university logos inside map markers and map-result cards.
- Keep recently viewed chip widths stable when the remove button appears by shrinking only the inner text label.

## 4.9.0 (2026-06-17) - Motion System Refactor

### Changed
- Rebuild the frontend motion system around shared duration, easing, page, panel, sheet, list, icon, state, and skeleton rules while removing duplicated page animations.
- Replace passive card hover lifts and layout-shifting transitions with restrained opacity and transform feedback across buttons, dropdowns, sheets, modals, and lists.

### Maintenance
- Document motion rules, reduced-motion behavior, and disallowed transition patterns in the design system guide.
- Expand Playwright motion tests covering icon microinteractions, dropdowns, mobile sheets, reduced motion, cleanup behavior, and compare tab stability.

## 4.8.0 (2026-06-01) - Admission-Choice Comparison Overhaul

### Changed
- Show academic minimums, SAT/UNT/GPA admitted-score context, language proof, extra requirements, and grant-vs-paid funding differences on comparison setup cards.
- Group comparison results into decision-focused rows for selected route, minimums, admitted scores, language proof, documents/interviews/portfolio, funding, and unique exams.

### Removed
- Remove unused duplicate comparison helper modules.

### Fixed
- Ensure direct comparison URL parameters (ids and choices) override stale saved comparison state.
- Fix Russian bachelor-program counts when matching localized "Бакалавриат" labels.
- Render a continuous purple selection outline across both the image and body of selected comparison cards.

### Maintenance
- Expand unit and E2E tests for admission-choice flattening, comparison cards and rows, deep links, and Russian comparison copy.

## 4.7.2 (2026-05-31) - Modal Transitions and Catalog View Toggle Polish

### Changed
- Standardize modal and tour exit animations so settings, comparison, onboarding tour, and UniFit warning dialogs fade out cleanly before hiding.
- Replace ad hoc z-index stacking values across shared UI and university views with structured layering tiers.

### Fixed
- Simplify the catalog list/map toggle by removing extra sliding, press-pop, and pulse animations that caused layered visual artifacts.

### Maintenance
- Add Playwright motion regression tests for modal closing transitions and the list/map view toggle.

## 4.7.1 (2026-05-31) - Localized UniChance Factors and Badges

### Added
- Add English and Russian localizations for all known UniChance explanation factors, falling back to backend text for unrecognized keys.

### Fixed
- Restore the admission requirement-profile tab layout and render UniChance badges and factors as compact icon-backed signals.
- Replace mixed English/Russian labels on foundation, need-aware, and need-blind admission badges in the Russian UI.

### Maintenance
- Add frontend unit tests for localized UniChance factor rendering and badge fallback behavior.

## 4.7.0 (2026-05-31) - Batch Compare Endpoint and UniChance Signals

### Added
- Add POST /api/universities/compare-profiles to fetch UniChance and ROI metrics for multiple universities in one request with ID normalization, null rows for unknown IDs, and private short-lived cache headers.

### Changed
- Emit stable machine-readable UniChance factors and verified badges instead of artificial country-level penalties or exact percentage-impact claims.
- Load comparison metrics via the batch compare endpoint with automatic fallback to per-university UniChance and ROI requests.

### Maintenance
- Add backend contract tests for the batch compare endpoint and UniChance factor schema, plus frontend unit tests for batch fallback.

## 4.6.1 (2026-05-31) - Graphify Repository Hygiene Rules

### Removed
- Remove local Graphify ignore and instruction exceptions so generated Graphify artifacts follow standard repository hygiene rules.

## 4.6.0 (2026-05-30) - Security Hardening and Dependency Upgrades

### Removed
- Remove leftover root-level Narxoz scratch files and temporary test artifacts.

### Security
- Harden ops-route guards, request body size limits, Redis rate limiting, frontend source link validation, translation debug logs, and manual HTTP data auditing.
- Upgrade Starlette to 1.2.0 and prometheus-fastapi-instrumentator to 8.0.0 to resolve a Starlette security advisory while preserving metrics.
- Enforce Content Security Policy (CSP) headers and pin Leaflet and markercluster CDN assets with Subresource Integrity (SRI) hashes.

## 4.5.2 (2026-05-26) - WebP Thumbnails and Kazakhstan Media Refresh

### Changed
- Deliver university thumbnails as WebP-first with explicit JPG fallbacks and use responsive WebP/JPG image sets for detail hero covers.
- Refresh full, medium, and small JPG/WebP cover images for selected Kazakhstan universities with low full-screen image quality.

### Maintenance
- Add WebP visual similarity auditing to detect distorted or corrupted generated image variants.

## 4.5.1 (2026-05-25) - Narxoz Test Data and Localized Program Tags

### Added
- Add detailed descriptions and localized fields-of-study tags in university catalog and translation datasets, plus Narxoz University test data.

### Changed
- Render university program tags from localized fields-of-study data.

### Maintenance
- Expand university data validation scripts.

## 4.5.0 (2026-05-24) - Bachelor-Only Scope Enforcement

### Changed
- Enforce bachelor-only product scope across frontend and backend processing so only bachelor-level programs are displayed and scored.

### Fixed
- Sanitize catalog study-level data to remove leftover Master-level references from bachelor entries.

### Maintenance
- Update E2E tests to verify strict bachelor-only constraints and major-tracking behavior.

## 4.4.0 (2026-05-24) - Expanded E2E Coverage

### Maintenance
- Expand Playwright E2E tests for dynamic localization switching, responsive layout overflow, UniChance calculator validation, and UniFit slider interactions.

## 4.3.0 (2026-05-24) - Data Auditing and Scoring Regression Tests

### Maintenance
- Expand backend data scripts with catalog enrichment and deep-audit capabilities.
- Add backend tests for concurrency stress, bachelor-scope contracts, infrastructure hygiene, and multilingual ML scoring regressions.

## 4.2.0 (2026-05-24) - Small Thumbnail Generation and Auditing

### Added
- Generate small WebP thumbnail variants for all existing university images.

### Maintenance
- Add automated scripts to generate small university thumbnails and audit image integrity.

## 4.1.0 (2026-05-20) - Dependency Refresh and Security Fixes

### Changed
- Cache university detail tab buttons and panes during setup so tab switches avoid repeated full-DOM queries.
- Make the university factor refresh script delay configurable via UNISEARCH_FACTOR_REFRESH_REQUEST_DELAY_SEC with a conservative default.

### Security
- Strip College Scorecard API keys from university source URLs during catalog loading so private keys cannot leak into API or UI payloads.

### Maintenance
- Upgrade @playwright/test to 1.60.0 and backend dependencies to Uvicorn 0.47.0, Pydantic 2.13.4, PyTorch 2.12.0+cpu, sentence-transformers 5.5.0, and Sentry SDK 2.60.0.
- Add frontend unit tests for HTML and attribute escaping edge cases and numeric range clamping.

## 4.0.0 (2026-05-20) - Admission Choices and Light Theme Refresh

### Breaking Changes
- Replace the flat admission-track data model with structured admission categories, requirement profiles, and funding options so programs, requirements, and funding routes are modeled separately.
- Migrate profile and API selection payloads from selectedAdmissionTracks to selectedAdmissionChoices with explicit program, category, requirement profile, funding option, and choice keys.

### Changed
- Update UniChance, UniFit scoring, catalog filtering and search, ML text matching, comparison, and detail pages to score and display the selected admission choice.
- Redesign university detail admission and finance sections with category, requirement, and funding cards, compact funding badges, choice-aware chance estimates, and persisted selections.
- Refresh the light theme across all core pages, navigation, profile/settings dialogs, comparison, and university detail views while keeping the flat dark-theme structure.
- Update English and Russian localization for admission choices, funding options, comparison rows, guide copy, and empty states.

### Maintenance
- Replace legacy admission-track compatibility tests with backend and Playwright regression suites covering admission categories, funding options, and choice-based contracts.

## 3.9.2 (2026-05-14) - Light Theme and Admissions UI Polish

### Changed
- Sharpen light-theme surface separation, borders, and purple active/selected states across all core pages, navigation, modals, comparison, and university details.
- Tighten layout density and mobile responsiveness across core pages, modals, comparison, and university detail admission and finance sections.
- Shorten funding labels on admission cards with full text in tooltips, remove duplicate method labels from compact chance chips, and keep selected tracks highlighted in purple.
- Rework scholarship and total-cost summary card alignment on university detail pages so paired cards match heights reliably.
- Update English and Russian copy for the About lead, Ranking global filter, location tradeoff labels, and short funding labels, and refresh cover thumbnails for Astana IT University, IITU, KBTU, and KIMEP.

### Removed
- Remove the decorative globe icon prefix from the Universities country filter fallback.

## 3.9.1 (2026-05-13) - University Detail Route Fix

### Changed
- Translate Kazakh-language program labels and major tags in Russian-localized university detail responses.

### Removed
- Remove redundant duration, format, and level summary pills from program cards where detail rows already display those values.

### Fixed
- Fix university detail tabs becoming unresponsive after client-side navigation by binding handlers to the newly rendered tab container.

### Maintenance
- Add Playwright regression coverage for opening a university via client-side routing and switching detail tabs without a page reload.

## 3.9.0 (2026-05-13) - Kazakhstan Catalog Expansion

### Added
- Add 5 Kazakhstan bachelor-level universities: Astana Medical University, International Information Technology University, Satbayev University, Kazakhstan-British Technical University, and Al-Farabi Kazakh National University.
- Add 5 Kazakhstan bachelor-level universities: L.N. Gumilyov Eurasian National University, Narxoz University, KIMEP University, Asfendiyarov Kazakh National Medical University, and Abai Kazakh National Pedagogical University.
- Add official-source fact provenance, verified-null selectivity records where totals are unpublished, tuition-derived costs, and curated logos and thumbnails for the 10 new universities.
- Add Almaty to supported Kazakhstan locations along with search aliases, descriptions, and Russian translations for the new universities and programs.

### Changed
- Update Kazakhstan UNT admission thresholds, clarify that state-grant scores represent eligibility thresholds rather than guaranteed cutoffs, and remove unsupported GPA pseudo-requirements.
- Switch university media assets in the service worker to network-first caching and bypass HTTP cache when checking for service worker updates.

### Maintenance
- Document optional local Graphify usage in AGENTS.md and CLAUDE.md without making it a dependency.

## 3.8.2 (2026-05-01) - Backend Dependency Refresh

### Maintenance
- Update backend dependencies to FastAPI 0.136.1, Uvicorn 0.46.0, Pydantic 2.13.3, scikit-learn 1.8.0, sentence-transformers 5.4.1, Redis client 7.4.0, and Sentry SDK 2.58.0.
- Stabilize the E2E language-switching helper by waiting for asynchronous language selector updates before asserting translated navigation labels.

## 3.8.1 (2026-05-01) - Release Workflow and Maintenance

### Changed
- Use map-based key lookups for Settings persistence while preserving the stored settings format.
- Trigger release artifact publishing only from published GitHub Releases and enforce a changelog validation gate before publishing.

### Maintenance
- Upgrade @playwright/test to 1.59.1, update GitHub Actions dependencies to Node 24-compatible versions, and clean up the official admissions sync script.

## 3.8.0 (2026-04-30) - UniChance Fallback Calibration

### Changed
- Calibrate estimated UniChance fallback scoring against official score-profile tracks using a low-confidence proxy profile from comparable requirements and average stats.
- Preserve conservative fallback behavior for below-minimum exam scores, missing mandatory language evidence, and tracks lacking comparable score data.

### Maintenance
- Add backend regression tests comparing exact and fallback UniChance across all score-profile tracks at p25, median, and p75 percentiles.
- Document release-permission and changelog aggregation rules in AGENTS.md and CLAUDE.md.

## 3.7.9 (2026-04-30) - Docker Runtime Hardening

### Changed
- Harden Docker Compose with Redis and backend healthchecks, automatic restart policies, and backend startup dependency on a healthy Redis service.
- Shrink the Docker build context and switch to CPU-only PyTorch wheels, reducing the backend image size from 8.52GB to 2.02GB.

### Maintenance
- Add CI checks for backend Docker builds, publish container images from pushed v* tags, and document that Docker Compose runs backend and Redis separately from the static frontend.

## 3.7.8 (2026-04-30) - Open-Source Repository Hygiene

### Added
- Add GitHub PR/issue templates, CODEOWNERS, Dependabot, EditorConfig, fork/reuse docs, a release checklist, and an ADR defining upstream boundaries.
- Add a Repository Hygiene CI workflow and the npm run audit:data command to verify version sync, encoding, localization parity, and university data.

### Changed
- Align university data auditing with truthful unranked (rank: null) entries that carry explicit non-published rank metadata.

### Maintenance
- Document repository hygiene and public documentation standards across README, CONTRIBUTING, AGENTS.md, and CLAUDE.md.

## 3.7.7 (2026-04-29) - CodeQL Alert Fixes

### Fixed
- Fix fallback metric calculation in the university comparison renderer where a shadowed local variable prevented metric evaluation.

### Security
- Harden local dev launchers by removing environment-derived URL/path logging, using validated TCP readiness checks, and restricting the frontend dev server to indexed files.
- Resolve remaining CodeQL static-analysis warnings across comparison labels, catalog filter persistence, sort handling, and UniChance/ROI scoring.

## 3.7.6 (2026-04-29) - UI Loading and Footer Fixes

### Added
- Add a dedicated map-mode loading skeleton with horizontal result-card placeholders and a shimmer map overlay.

### Changed
- Use an inset border effect for selected university cards so rounded corners stay clean without breaking the purple outline.

### Fixed
- Fix the global top loading bar animation to span the full viewport width on wide screens.
- Restore the shared footer on the Guide page and display a GitHub icon in footer social links across all pages.
- Prevent duplicate Leaflet map initialization when opening the Universities page directly in map mode.

## 3.7.5 (2026-04-28) - Performance Optimizations

### Changed
- Lazy-load route modules, profile UI, Ranking assets, and Leaflet map libraries so initial page loads skip unused code and map assets.
- Cache exams, languages, and locations configuration locally with stale-data fallback when the backend is temporarily unreachable.
- Make ML model warmup at backend startup opt-in via WARMUP_ML_ON_STARTUP while preserving manual and ops warmup triggers.

### Removed
- Remove external Google Fonts and Wikimedia GitHub icon requests in favor of local and system assets.

### Maintenance
- Add npm run audit:performance for lightweight frontend network request and payload audits.

## 3.7.4 (2026-04-28) - UI Fixes and Encoding Guard

### Added
- Add npm run fix:encoding and npm run check:encoding commands to detect and repair BOM, mojibake, and invalid UTF-8 across the repository.

### Changed
- Rearrange Universities map mode in Catalog and Comparing to place a horizontal results strip above a wider rectangular map, with rounded-square logo markers and unclipped popups.
- Refine mobile map-result cards with compact horizontal scrolling, clearer next-card peek, tighter typography, and stable action rows.
- Update documented catalog coverage to 40 universities across 13 countries and add the Render web demo link to the README.

### Fixed
- Repair mojibake in shared frontend comments and the Russian language selector option, and align comparison localization keys for category titles and fallback labels.

### Maintenance
- Document encoding checks in AGENTS.md and CLAUDE.md and include them in the minimum release and test workflow.

## 3.7.2 (2026-04-24) - Security Hardening and Repository Hygiene

### Security
- Use constant-time token comparison for ops-route authorization to prevent timing attacks.

### Maintenance
- Remove residual log files and temporary artifacts and verify UTF-8 encoding consistency across the repository.

## 3.7.1 (2026-04-24) - Security Hardening and Community Policies

### Added
- Add SECURITY.md, CODE_OF_CONDUCT.md, and SUPPORT.md to formalize vulnerability reporting, community standards, and support channels.

### Security
- Upgrade university catalog ETag hashing from SHA-1 to SHA-256.
- Replace regex-based HTML sanitization on the universities page with DOMParser to mitigate XSS risks.
- Disable clear-text object logging in translation debug output to prevent sensitive data exposure.

## 3.7.0 (2026-04-24) - AI Sorting E2E Stability and Mocking

### Fixed
- Fix race conditions and redundant renders in AI sort resolution when fallback and AI responses arrive concurrently.

### Maintenance
- Add centralized E2E API mocking for /universities/ai-sort, /universities, /exams/validate, and /languages/validate to avoid 429 rate limits in CI.
- Reset filters between E2E profile-seeding runs and disable backend rate-limiting and semantic embeddings in CI Playwright runs for deterministic results.

## 3.6.1 (2026-04-24) - Module Resolution Fix

### Fixed
- Remove stale ranking module imports from the universities page script to fix ES module load failures.

## 3.6.0 (2026-04-24) - Frontend and Backend Modularization

### Changed
- Split frontend utilities and global shell code into focused modules for storage, theme, config loading, formatting, custom selects, settings, profile UI, and layout caching while preserving the existing utility facade.
- Decompose the universities workspace and detail page into dedicated controllers and render modules for overview, programs, admission, finance, comparison, UniChance, and AI-sort fallback.
- Centralize backend finance/study-mode helpers and low-level exam validation/grade helpers for shared use across catalog, detail, and AI scoring services.
- Simplify request metrics middleware and fuzzy search scoring helpers while preserving public behavior.

### Maintenance
- Add focused unit tests covering fuzzy search edit-distance matching.

## 3.5.6 (2026-04-23) - Calm Academic Workspace Redesign

### Changed
- Replace decorative gradients and heavy drop shadows on university scope panels and the comparison tray with flat bordered card surfaces and softer 24px-blur shadows.
- Change the mobile filter button from a pill shape to a 12px rounded rectangle to match the Calm Academic Workspace design.
- Raise the comparison layout breakpoint from 680px to 820px for single-column tablet configuration and enable horizontal scrolling for narrow-screen comparison tables.

### Fixed
- Fix the floating comparison tray shifting off-screen on narrow mobile viewports.

### Maintenance
- Update AGENTS.md with Calm Academic Workspace UI guidelines linking to the design system reference.

## 3.5.2 (2026-04-23) - Filtering Optimizations and Test Coverage

### Changed
- Narrow backend exam-service exception handling to expected file, JSON, and numeric conversion errors instead of broad exception catches.
- Optimize tuition filtering by evaluating effective university cost once per candidate and checking min/max bounds in a single pass.
- Combine region, country, and city filters in a single pass to avoid repeatedly rebuilding intermediate university lists.

### Maintenance
- Add backend tests for translation source-language hint normalization and auto-detection fallback.
- Add Node frontend unit tests for funding preference normalization in CI and standardize E2E execution on npx playwright.

## 3.5.1 (2026-04-22) - Compare Workflow Fixes

### Added
- Require selecting an admission track and funding option per university before viewing comparison results, with persisted URL track state and per-track UniChance context.
- Expose hidden university search aliases on catalog cards so queries like "AITU" match the full university record.

### Changed
- Restrict comparison to an exact two-university pair with a persistent bottom tray, clean pair replacement, and restored selection state after client-side navigation.
- Base comparison result cards, metrics, best-cell highlights, key differences, and responsive layouts on the selected track and funding option.
- Refine English and Russian comparison, financial-aid, funding, UniChance fallback, and university translation copy.

### Fixed
- Preserve comparison query parameters across client-side route-link normalization.

### Maintenance
- Update backend and Playwright tests for hidden-alias search, comparison setup and results, responsive comparison tables, and persisted UniFit filter state.

## 3.5.0 (2026-04-22) - Consolidated University Workspace

### Changed
- Consolidate Catalog, Ranking, and Comparing into a unified tabbed Universities workspace driven by URL query state (?tab=catalog|ranking|compare).
- Redirect the legacy ranking page directly to the unified Universities ranking tab.
- Update English and Russian localizations, workspace styling, and backend ML scoring behavior to support the tabbed workspace.

### Maintenance
- Update responsive E2E tests and add coverage for workspace tab switching and comparison results.

## 3.4.12 (2026-04-21) - UI/UX Workspace Polish

### Added
- Add a localized settings dialog for interface preferences, including recently viewed university history and opening detail pages in new tabs.
- Add client-side routing across core frontend pages with route-loading feedback and smoother workspace state retention.
- Add a Comparing tab alongside an integrated Ranking tab in the Universities workspace with card/map selection, shareable result URLs, key differences, category scores, and metric highlights.

### Changed
- Refine catalog loading skeletons with responsive card counts and reduced-motion support, and add clear-all and per-item removal controls to the recent-universities bar.
- Polish navbar and profile tab indicators, mobile navbar sizing, detail save-button active states, and accent interaction tokens.
- Prefer full "университет" wording in Russian localization and refine unknown/N/A fallbacks for ranking and empty states.

### Fixed
- Preserve localized major labels when loading the user profile initially in Russian.

### Maintenance
- Add Playwright test coverage for localized profile major options on initial Russian page load.

## 3.4.11 (2026-04-21) - UI Animation and Interaction Refinements

### Added
- Add an interactive "Add to Favorites" button on the university detail page with persisted local storage and English and Russian labels.
- Add sliding tab animations for the main navigation, profile sections, university detail tabs, and catalog scope toggles.

### Changed
- Map unpublished university rankings explicitly to a localized "N/A" fallback across the catalog.

### Removed
- Remove the context-free placeholder cost from the university detail quick stats row so visitors rely on the finance breakdown tab.

### Maintenance
- Verify dark-mode color-token parity across shared UI components and update agent guidelines with explicit boundaries for sliding animations.

## 3.4.10 (2026-04-21) - UI Bug Fixes and UX Refinements

### Changed
- Replace the catalog favorites-only switch with an underlined All/Favorites scope control featuring localized labels and accessible pressed states.
- Default empty profiles without evidence to regular name sorting instead of automatic UniFit requests while keeping UniFit active when evidence exists.
- Make the bachelor's-scope notice on the universities page dismissible and persist the dismissal locally.
- Refine ranking country-filter styling, language selector alignment, about-page layout, finance summary spacing, dark-mode recent chips, and error-button styling.

### Fixed
- Improve universities and ranking search suggestions to match localized names, aliases, acronyms, cities, and countries without duplicate type labels.
- Keep recently viewed university names readable through cached detail names even after favoriting or comparing items.
- Localize homepage coverage plural labels and university detail placeholders so English fallback text does not leak into the Russian UI during initial load.

### Maintenance
- Remove the volatile directory layout tree from `README.md` and update Playwright motion coverage for favorites and recently viewed behavior.

## 3.4.9 (2026-04-21) - Architecture and Frontend Code Modularization

### Changed
- Split the monolithic ~5,000-line frontend page controller into focused shared, catalog list, and university detail modules.
- Unify catalog loading indicators around the global white spinner instead of legacy purple spinners.
- Migrate FastAPI startup hooks to the ASGI asynchronous lifespan pattern.

### Maintenance
- Centralize repeated backend dictionary utilities into a shared core module and update E2E test configuration to capture UI component failures accurately.

## 3.4.8 (2026-04-20) - Version Source Cleanup and Documentation Refresh

### Added
- Add `npm run bump:version` and `npm run check:version` scripts, and enforce version synchronization at the start of `npm run test:all`.
- Add `CONTRIBUTING.md` with setup notes, official data-source rules, PR expectations, and validation checks for external contributors.

### Changed
- Make `package.json` the canonical version source for backend metadata, health, ready, and ops endpoints, Docker builds, frontend config, and release tooling.

### Maintenance
- Refresh `README.md` with fresh-clone setup steps, project guardrails, official data-maintenance workflows, and updated release references.
- Update project agent release instructions to use the new version bump and verification workflow.

## 3.4.7 (2026-04-19) - Mobile UX and Product Workspace Refresh

### Added
- Add ROI guidance and navigation support to the English and Russian user guides.

### Changed
- Align the university detail shell with a connected cover, header, and quieter underlined tabs, and unify `Admission` and `Costs` panel styling with `General` and `Programs`.
- Convert the profile modal into a bottom sheet on small screens with horizontally scrollable section tabs and larger touch targets.
- Add a tablet filter drawer, phone bottom sheet, and safe-area-aware floating filter button to the catalog to prevent horizontal overflow on narrow devices.
- Make guide mobile navigation full-width on phones and improve mobile and tablet layouts across the navbar, homepage, catalog, ranking, and detail views.
- Position UniChance low-accuracy labels below the percentage on wide layouts and beside the percentage only on constrained mobile layouts.
- Remove negative letter spacing across updated UI components to improve Russian text readability on mobile screens.
- Bump the service-worker cache version so clients refresh `3.4.7` assets immediately after deployment.

### Fixed
- Preserve viewport scroll position when removing saved universities from the favorites shortlist on the catalog page.
- Keep the compact language selector dropdown arrow anchored on the right when switching between English and Russian.

### Maintenance
- Document the 2026 academic workspace design system and expand Playwright responsive coverage across narrow, mobile, tablet, light, and dark viewports.

## 3.4.6 (2026-04-18) - Security Hardening and Narrow Viewport Stability

### Added
- Add a sanitized public `/translation-status` endpoint and move frontend translation-status checks away from private ops routes.

### Changed
- Improve layout stability on 320px and narrow mobile viewports across navbar controls, language selector, profile modal, catalog cards, skeletons, maps, and detail tabs.
- Bump the service-worker cache version so clients refresh `3.4.6` assets immediately after deployment.

### Fixed
- Restore the university detail ROI block in the finance tab when verified salary data exists while keeping it hidden otherwise.

### Security
- Protect `/ops/*`, `/metrics`, and `/health?warmup=1` with `OPS_ADMIN_TOKEN` and disable metrics exposure by default.
- Enforce global and heavy-request rate limits, request body size limits, stricter CORS methods/headers, opt-in trusted-proxy IP handling, and baseline security headers.
- Disable default Sentry PII collection and scrub profile, exam, language, auth, token, and secret fields before events are sent.
- Run the backend container as a non-root user, keep Docker Redis private on the compose network, add Caddy/Nginx security notes, and add `rel="noopener noreferrer"` on external GitHub links.
- Replace inline image `onerror` handlers with a shared fallback binder across cards, maps, and detail pages, and add a GitHub workflow for CodeQL and security audits.

### Maintenance
- Stabilize GitHub Actions test environments and update backend and Playwright tests for ops authorization, security headers, Sentry scrubbing, and 320px viewport overflow.

## 3.4.5 (2026-04-17) - Saved Universities, Comparison, Profile Redesign, and Motion

### Added
- Add persistent saved universities with favorite buttons, saved-only filtering, a favorites shortlist bar, and a recently viewed universities bar.
- Add a persistent university comparison tray and modal comparing overview, programs, admissions, finance, and outcome signals with highlighted best values.
- Add search, country filtering, autocomplete suggestions, source notes, and empty states to the ranking page.
- Add shared frontend motion transitions across panels, lists, toasts, and cards while respecting `prefers-reduced-motion`.

### Changed
- Redesign the profile modal with tabbed sections for basics, scores, languages, and preferences, completion progress, interest chips, and smoother unsaved-change flows.
- Rebuild catalog search and filtering with active-filter chips, mobile filter sheets, university/city/country suggestions, and refreshed map result cards.
- Refresh the homepage preview, detail-page action labels, ranking badge fitting, and English and Russian localization across all new controls.
- Refine university coordinates, campus-size localization, and translation data, and bump the service-worker cache version for `3.4.5`.

### Maintenance
- Add Playwright tests for profile and detail motion, saved and compare pressed states, and updated language-validation flows.

## 3.4.4 (2026-04-14) - Skeleton Loaders and Error States

### Added
- Add skeleton loading states across the universities, university detail, ranking, and about pages during initial data fetches.
- Add localized "No Internet Connection" error state strings.

### Changed
- Bump the service-worker cache version so clients refresh `3.4.4` assets immediately after deployment.

## 3.4.3 (2026-04-13) - Design Refinement And Mobile Responsiveness

### Changed
- Improve mobile responsiveness and layout stability across the universities, university detail, ranking, guide, and about pages.
- Refine button styling, navigation alignment, interactive hover/active states, and small-screen density for admissions and finance views.
- Improve backend exam-score normalization and admission-track major processing.
- Synchronize curated official facts and admissions catalogs and bump the service-worker cache version for `3.4.3`.

### Maintenance
- Update unit and E2E regression tests for the updated scoring and catalog behavior.

## 3.4.2 (2026-04-13) - Composite Exam Scores And Truthful Track Data

### Added
- Add composite exam validation and storage for subject and section breakdowns across SAT, A-Level, AP, HKDSE, and IELTS submissions while computing parent totals where applicable.
- Add per-subject and per-section score inputs with localized messages and toasts in the profile UI.

### Changed
- Group composite exam requirements and averages more clearly on university detail pages, scoping funding-option average scores to exams actually required by each variant.
- Keep visible yearly finance breakdowns truthful to official mandatory or tuition-and-fee sources instead of exposing discretionary expenses as verified items.
- Bump the service-worker cache version so clients refresh `3.4.2` assets immediately after deployment.

## 3.4.1 (2026-04-12) - Encoding And Admission Option Fixes

### Changed
- Replace the navbar profile text button with a compact responsive user icon button.
- Bump the service-worker cache version so clients refresh patched `3.4.1` assets immediately after deployment.

### Fixed
- Remove stray BOM artifacts from English and Russian localization packs and repair broken Cyrillic rendering and dash/bullet glyphs in shared frontend text.
- Keep both paid and grant funding-option cards visible on university detail pages even when the profile funding preference is set to grant-only.

### Maintenance
- Add Playwright regression coverage for funding-option visibility on the Tsinghua University detail page.

## 3.4.0 (2026-04-12) - Full Web App Design Rework

### Added
- Add Heroicons sync tooling and update third-party notices for the redesigned icon pipeline.

### Changed
- Redesign the homepage around a catalog-first hero, stronger calls to action, refreshed typography, and a focused product preview.
- Rebuild the universities, ranking, guide, about, error, and university detail pages with unified comparison surfaces, map-side result panels, quick stats, and desktop/mobile responsiveness.
- Expand English and Russian localization copy for the redesigned product framing and page sections.
- Bump the service-worker cache version so clients refresh `3.4.0` assets immediately after deployment.

## 3.3.1 (2026-04-09) - Rank Truth And Icon System Cleanup

### Added
- Add bachelor-only scope callouts to the homepage, universities catalog, and university detail page in English and Russian.
- Unify frontend icons around a shared Heroicons helper module, replacing mixed emojis and inline SVGs across navigation, filters, cards, tabs, and toasts.

### Changed
- Audit and align QS WUR 2026 rankings and `not_published` provenance metadata across the 40-university catalog.
- Normalize UNSW naming to `University of New South Wales` in aliases, facts, and translations, and clarify University of Toronto count-based admissions wording.
- Remove decorative pins from location strings, assign globe and map-pin icons to detail website/map actions, and enable clickable links inside detail tooltips.
- Polish empty/warning state cards, profile confirmation buttons, scholarship lines, badges, and ranking-location styling in light and dark themes.

### Fixed
- Add the missing `cost_item_housing_college` localization key in backend-driven translations and fix long location wrapping without breaking country flags.

### Maintenance
- Document the ranking audit and icon replacement map, update `THIRD_PARTY_NOTICES.md`, and extend the i18n smoke test for location flags after language switches.

## 3.3.0 (2026-04-08) - +20 Universities

### Added
- Add UK institutions to the catalog: University of Oxford, University of Cambridge, University of Edinburgh, and University of Manchester.
- Add US institutions to the catalog: California Institute of Technology, University of Chicago, University of Pennsylvania, Cornell University, University of California, Berkeley, and Yale University.
- Add additional US institutions to the catalog: Princeton University, Johns Hopkins University, Columbia University, and University of California, Los Angeles.
- Add Australian and Canadian institutions to the catalog: UNSW Sydney, University of Sydney, Australian National University, McGill University, University of British Columbia, and University of Waterloo.

### Removed
- Remove temporary university-import artifacts and stray generated assets left over from catalog expansion.

## 3.2.1 (2026-04-03) - Tag Label And Rule Cleanup

### Changed
- Rename the second-tier UniFit card tag from `Top Match` (`Лучшее совпадение`) to `Good Match` (`Хорошее совпадение`) and clarify its wording relative to `Your Vibe` (`Ваш формат`).
- Refresh the user guide for the updated tag wording and bump the service-worker cache version.

### Maintenance
- Document UniFit card tag groups, priorities, and mutual-exclusion rules (ensuring `your_vibe` and `top_match` never render together) and update regression coverage.

## 3.2.0 (2026-04-03) - Smarter Admissions

### Added
- Add structured exam submissions (`raw_value`, `display_value`, and `details`) to `/exams/validate` and profile schemas.
- Support real A-Level grade combinations such as `A*A*A` (converting the best 3 grades into an internal score), explicit HKDSE band selection, and binary flags for Swiss Maturity, Abitur, and OSSD.
- Add dedicated non-numeric exam controls, guidance text, and localized status labels in the profile UI and guide.
- Add localized track and funding-option descriptions, official detailed annual cost breakdowns, campus-size labels, and recalibrated UniFit slider factors across the catalog.

### Changed
- Make fallback UniChance estimation more conservative by returning `0%` when required exam or language evidence is missing, minimums fail, or only conditional evidence exists.
- Rewrite Russian missing-evidence messages to describe concrete admission options clearly, and localize ranking-status fallbacks and cost-item labels.

### Security
- Escape attribute values on external admission source links rendered in the university detail view.

### Maintenance
- Reject non-ASCII source URLs and check additional provenance URLs in the data audit script, and expand backend tests for A-Level normalization, fallback chance rules, and catalog completeness.

## 3.1.0 (2026-04-03) - UI Fixes

### Added
- Add localized English and Russian strings for the 404 error page.
- Add missing Russian strings for `Academic requirements`, `Academic average`, `Language average`, `Abay Kunanbayev`, `State Grant`, `merit`, and `state`.

### Changed
- Bundle country flag SVG files locally instead of loading them from `flagcdn.com`, fix asset path resolution, and bump the service-worker cache version.
- Normalize English names to official full forms: `ETH Zurich` to `Swiss Federal Institute of Technology Zurich`, `EPFL` to `Swiss Federal Institute of Technology Lausanne`, and `KAIST` to `Korea Advanced Institute of Science and Technology`.
- Update `npm run dev:backend` to detect an already healthy local backend via `GET /health` and report ready status cleanly.
- Consolidate About Us into one shared container with dividers, move track language requirements inside `Minimum to apply` and `Average admitted` boxes, and refine card and flag spacing.

### Fixed
- Keep `English (US)` and `Русский` language-switcher labels unchanged when switching the interface language.
- Hide acceptance-rate pills when unverified and show the no-data fallback instead of bare `EN` or `KO` codes when no language averages are published.
- Fix centered text and spinner clipping in rounded budget inputs, restore intended corner rounding on tabs and fields, and keep light-theme grant cards green on hover.

### Maintenance
- Add backend contract assertions verifying full official university names in translation and detail responses.

## 3.0.0 (2026-04-02) - compact funding-option tracks, alias-aware search, and detail-page admissions redesign

### Changed
- Rework admission-track data around compact tracks with nested funding options while expanding variants internally for AI sorting, chance estimation, aid detection, and funding filters.
- Score hidden search aliases (`MIT`, `NUS`, `TUM`, `CUHK`, `KAIST`, `NU`, and Cyrillic equivalents) without introducing abbreviations into primary display names.
- Localize nested funding-option labels, descriptions, extra requirements, language requirements, and scholarship names across the catalog.
- Refine Nazarbayev University and SDU descriptions and add an inferred low-confidence SAT score profile for Nazarbayev University direct admission.
- Redesign university detail admissions and finance tabs around grouped funding-option cards with selection controls, cost previews, localized major tags, and paid-vs-grant styling.
- Simplify loading states on ranking, guide, universities, and detail pages from blocking overlay spinners to inline status notes.

### Fixed
- Stop surfacing `meetMinRequirements` when required exam evidence is missing, and explicitly state in English and Russian that exam data is needed for that track.

### Maintenance
- Add backend and Playwright regression tests for compact funding-option schemas, alias search, badge priorities, and Nazarbayev University track rendering.

## 2.8.0 (2026-03-31) - score-profile chance modeling, exam normalization, and finance UI polish

### Added
- Upgrade `UniChance` to a two-mode model using official percentile-style score profiles where available and a lower-confidence fallback estimate elsewhere.
- Add shared exam normalization for ENT, EGE, SAT, IB, NUET, and route-specific HKDSE weighted totals, plus score-profile data for Nazarbayev University and CUHK routes.

### Changed
- Display explicit no-data states instead of `0%` when admission evidence is absent, and label fallback chances as low confidence in detail cards and track chips.
- Standardize full-width total badges across paid and grant finance tracks and improve spacing on admission track cards and finance summary layouts.

### Maintenance
- Expand backend tests for score normalization, score-profile wiring, and no-data `UniChance` responses.

## 2.7.0 (2026-03-31) - admission-track scope cleanup, ROI salary signals, and i18n polish

### Breaking Changes
- Remove the legacy `FRONTEND_ORIGIN` fallback and standardize CORS configuration exclusively on `FRONTEND_ORIGINS` across backend settings, Docker, Playwright, and docs.

### Added
- Add official outcomes-based salary signals for MIT, NUS, CUHK, and University of Toronto to power ROI calculations.
- Derive and localize applicable majors per admission track in university detail responses, and expose separate NUET undergraduate tracks with policy sources for Nazarbayev University.

### Changed
- Schedule backend startup warmup asynchronously in a background thread instead of blocking application boot.
- Filter foundation-only programs, majors, study levels, and admissions rows out of the bachelor-facing catalog scope when mixed with regular undergraduate tracks.
- Hide the ROI block on the finance tab when no official salary data exists, improve finance card layout, and bump the detail cache version.

### Fixed
- Rebuild custom selects and refresh catalog location filter labels in place when switching UI languages.

### Maintenance
- Add backend and Playwright regression tests for derived track majors, foundation filtering, startup warmup threading, ROI visibility, and localized filter sync.

## 2.6.1 (2026-03-30) - portable local-dev runtime and release alignment

### Added
- Add `npm run dev:backend`, `npm run dev:frontend`, and `npm run test:backend` scripts with automatic Python virtual environment detection and shared Node launch helpers.
- Support overridable `BACKEND_PORT`, `REDIS_PORT`, `FRONTEND_HOST`, and `FRONTEND_PORT` settings for local Docker and cross-platform LAN development.

### Changed
- Derive the frontend API base URL dynamically from the current host and `API_PORT` instead of hardcoding `127.0.0.1:8000`.
- Disable pretty URL rewrites on plain static dev hosts at ports `5501` and `5510` so `/universities` routes work when opened over a local network.

### Maintenance
- Document the cross-platform startup workflow and LAN environment overrides in `README.md` and `backend/.env.example`.

## 2.6.0 (2026-03-30) - manual admission-track selection

### Added
- Add manual admission-track selection (`Select`) on university detail pages, persisting per-university overrides in local cached profile state.
- Update `UniChance`, `UniFit` ranking, and profile API payloads to apply `selectedAdmissionTracks` overrides while keeping the `Recommended` track available to clear overrides.

## 2.5.8 (2026-03-25, work in progress / tester build) - official facts stabilization and admissions-source cleanup

### Added
- Add a structured official admissions catalog and sync script populating university-wide, program-level, and per-program data alongside existing acceptance fields.
- Add official institutional acceptance rates for Imperial College London (`9.89%`), University of Tokyo (`31.83%`), and Nazarbayev University (`21.0%`), leaving unverified institutions null.
- Add official program-level admissions rows for Imperial `Computing (BEng/MEng)` (`5.04%`), Kyoto `Kyoto iUP Undergraduate Program` (`4.65%`), University of Tokyo `PEAK`/divisions, University of Toronto Engineering/CS, and Tsinghua `Computer Science and Technology`.
- Add official non-rate program admissions signals for EPFL `Computer Science` (`3000 places`), TUM `Informatics` (`84` points stage-1 cutoff), NUS `Computer Science (BComp)` (`893` places), and CUHK `Computer Science and Engineering` (`113` places).
- Add explicit `verified-null` program coverage for KAIST (`Computer Science`, `Mechanical Engineering`) and institutions without program-level metrics across the 20-university catalog, including MIT, Stanford, Harvard, ETH Zurich, TU Delft, Seoul National University, University of Melbourne, Nazarbayev University, SDU, and AITU.
- Surface university-wide and program-level official admissions summaries and signal cards in the university detail Admission and Programs tabs.
- Support `BACKEND_HOST` and `BACKEND_PORT` overrides in `backend/.env` for local LAN testing and document setup in `README.md` and `backend/.env.example`.

### Changed
- Re-verify MIT institutional acceptance for the Class of 2029 at `4.56%`, fill missing official descriptions and tags across remaining universities, and add TU Delft official student counts.
- Clarify that GPA percent is a UniSearch-only normalized estimate, simplify interests field and guide wording, and polish Russian admissions labels while keeping exam terms like `A-Level`.
- Establish `official_facts.json` as the single source of truth for verified optional facts and backfill University of Toronto acceptance coverage.

### Removed
- Remove the Kazakh UI locale pack and Kazakh runtime language handling from frontend, backend, and tests, leaving English and Russian UI languages while retaining Kazakhstan country and flag data.
- Remove the duplicate GPA helper line and native browser tooltip so only the custom tooltip remains.

### Fixed
- Restore `frontend/env.js` to an empty deploy-safe template and replace broken official source URLs for Imperial, ETH Zurich, and AITU.

### Maintenance
- Expand backend test coverage for official facts sync, official admissions consistency, and newly exposed exam configuration keys.

## Earlier unversioned admissions changes

### Added
- Support GRE General Test section scores without inventing a total, alongside distinct current and legacy GMAT scales, in profile validation, persistence, and admissions evidence checks.
- Add Cambridge C2 Proficiency as a distinct language certificate and validate reported C1 and C2 score ranges.
- Show published requirement checks with applicant evidence, missing information, and assessment status in admission routes and UniFit card explanations.

### Fixed
- Preserve unknown program, route, and cycle applicability instead of applying unrelated minimums or cost defaults; keep unsupported language checks and unassessed source conditions visible.
- Preserve explicit empty program mappings during catalog loading so unlinked routes do not borrow other programs or their score data.
- Distinguish unknown academic fit from verified failures, scope funding badges to the selected route, and explain actual annual cost, budget, and preference indicators used by recommendations.
- Display published funding coverage instead of replacing every grant with a generic competitive-award claim.
- Review MIT graduate and professional route policies against official sources, retain exceptions and conflicting or yearless facts explicitly, and extend shared transfer mappings to all undergraduate options.
