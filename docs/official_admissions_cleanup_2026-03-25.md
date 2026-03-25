# Official Admissions Cleanup (2026-03-25)

Scope:
- `backend/data/official_facts.json`
- `backend/data/universities.json`
- `backend/tests/test_official_facts_sync.py`

Catalog sync fix:
- backfilled the existing official University of Toronto acceptance fact into `official_facts.json` so the catalog is now the source of truth for every dataset row that already exposes `academics.acceptance_rate_percent`.

Admissions inventory for the 16 previously missing universities:
- `added / official_counts`: `imperial-college-london-uk` via the official Imperial `24-25 Statistics Guide` (`31,533` applications, `3,119` new admissions).
- `verified-null / no_official_institutional_source`: `eth-zurich-ch-zurich` because this pass did not locate an official institution-wide applicants/admitted source on ETH admissions pages or annual-report materials.
- `verified-null / no_official_institutional_source`: `national-university-of-singapore-sg-singapore` because this pass did not locate an official institution-wide applicants/admitted source on official NUS admissions materials.
- `verified-null / no_official_institutional_source`: `epfl-ch-lausanne` because this pass did not locate an official institution-wide applicants/admitted source on official EPFL admissions materials.
- `verified-null / no_official_institutional_source`: `technical-university-of-munich-de-munich` because this pass did not locate an official institution-wide applicants/admitted source on official TUM admissions materials.
- `verified-null / no_official_institutional_source`: `cuhk-hk-shatin` because this pass did not locate an official institution-wide applicants/admitted source across official CUHK admissions routes.
- `added / official_counts`: `university-of-tokyo-jp-tokyo` via UTokyo's official applications and admissions page (`9,688` applicants, `3,084` successful applicants).
- `verified-null / no_official_institutional_source`: `seoul-national-university-kr-seoul` because this pass did not locate an official institution-wide applicants/admitted source on official SNU admissions materials.
- `verified-null / no_official_institutional_source`: `delft-university-of-technology-nl-delft` because this pass did not locate an official institution-wide applicants/admitted source on official TU Delft admissions materials.
- `verified-null / no_official_institutional_source`: `kaist-kr-daejeon` because the official materials reviewed exposed competitive ratios and intake planning, but not a stable institution-wide applicants/admitted source suitable for `acceptance_rate_percent`.
- `verified-null / no_official_institutional_source`: `tsinghua-university-cn-beijing` because this pass did not locate an official institution-wide applicants/admitted source on official Tsinghua admissions materials.
- `added / official_rate`: `nazarbayev-university-kaz-astana` via the official NU undergraduate statistics PDF, which reports a `21%` undergraduate admission rate for 2025 and notes the shared NUFYP/UG application form since 2024.
- `verified-null / no_official_institutional_source`: `kyoto-university-jp-kyoto` because this pass did not locate an official institution-wide applicants/admitted source on official Kyoto University admissions materials.
- `verified-null / no_official_institutional_source`: `university-of-melbourne-au-melbourne` because this pass did not locate an official institution-wide applicants/admitted source on official University of Melbourne admissions materials.
- `verified-null / no_official_institutional_source`: `suleyman-demirel-university-kaz-kaskelen` because this pass did not locate an official institution-wide applicants/admitted source on official SDU admissions materials.
- `verified-null / no_official_institutional_source`: `astana-it-university-kaz-astana` because this pass did not locate an official institution-wide applicants/admitted source on official AITU admissions materials.

Notes:
- no universities in this pass were classified as `blocked-by-anti-bot`.
- Imperial was recorded from official applications/new-admissions totals, not from offer-volume tables.
- NU was recorded from the university's own published undergraduate-rate figure rather than re-deriving a more granular percentage from the shared post-2024 application pool.
