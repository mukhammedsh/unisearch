# Changelog

All notable project changes should be recorded here.

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
