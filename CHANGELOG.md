# Changelog

All notable project changes should be recorded here.

## 2.6.1 (2026-03-30) - portable local-dev runtime and release alignment

Status:
- synchronized runtime/package version to `2.6.1` across frontend runtime config, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`, `backend/.env.example`, and README examples.
- improved local-development portability and clone-and-run ergonomics:
  - added `npm run dev:backend`, `npm run dev:frontend`, and `npm run test:backend` scripts that auto-detect local Python virtual environments instead of depending on manual activation.
  - added shared Node launch helpers for backend startup, frontend static serving, backend test execution, and project env loading.
  - frontend runtime config now derives the API base from the current host plus a configurable backend port instead of forcing `127.0.0.1:8000`, and generated `frontend/env.js` now includes `API_PORT`.
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
