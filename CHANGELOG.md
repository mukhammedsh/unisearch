# Changelog

All notable project changes should be recorded here.

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
