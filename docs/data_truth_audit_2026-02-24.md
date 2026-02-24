# UniSearch Data Truth Audit (2026-02-24)

Scope: `backend/data/universities.json` (20 universities).

## 1) Integrity checks

Executed:

- `python backend/scripts/audit_universities_data.py`
- `python backend/scripts/audit_universities_data.py --check-http --http-timeout 10`

Result:

- Structural/data consistency errors: `0`
- HTTP warnings during deep source check: `13` (`403` only, typical anti-bot/country restrictions; no `404`)

## 2) Ranking truth update applied

### What changed

- Dataset `rank` was moved from internal contiguous order (`1..20`) to QS WUR 2026-aligned values where officially published.
- Added `rank_meta` for every university with transparent status:
  - `official` (direct QS 2026 value),
  - `excluded` (KAIST case),
  - `not_listed` (not present in published QS WUR 2026 table).
- Updated `fact_provenance.facts.rank` accordingly (`is_official_external_rank`, `status`, `method`, `verified_at=2026-02-24`).
- For `excluded/not_listed`, internal sorting fallback rank `1001` is used.

### Current rank status summary

- `official`: 16 universities
- `excluded`: 1 university (`kaist-kr-daejeon`)
- `not_listed`: 3 universities (`nazarbayev-university-kaz-astana`, `suleyman-demirel-university-kaz-kaskelen`, `astana-it-university-kaz-astana`)

## 3) Tuition and acceptance truth notes

- `finance.total_cost_year_usd` behaves as total annual cost (not tuition-only) and is plausible for top institutions (MIT/Harvard/Stanford checks).
- Acceptance rate is mixed in nature:
  - partially official for some institutions,
  - frequently modeled/derived for institutions that do not publish a unified institution-wide rate.

## 4) Script hardening applied

Updated `backend/scripts/refresh_fact_provenance.py` so future refreshes preserve truthfulness state from `rank_meta`:

- keeps `official` as official fact,
- keeps `excluded/not_listed` as non-official fact with explicit status,
- no longer forces all ranks into `derived_prestige_order`.

Also updated default script verification date to `2026-02-24`.

## 5) Remaining data-policy risks

- `total_cost_year_usd` component split is still implicit (tuition vs housing/living/other).
- Acceptance methodology metadata is still coarse for some universities.

Recommended next non-breaking schema enrichment:

- `finance.total_cost_year_usd_meta.components` (tuition/housing/living/insurance/other),
- `academics.acceptance_rate_percent_meta` (official vs derived + source confidence).

## Sources

- QS WUR 2026 official table: https://www.topuniversities.com/world-university-rankings
- QS statement on KAIST exclusion: https://www.qs.com/rankings-by-subject-to-halt-due-to-manipulation-by-kaist/
- MIT cost of attendance (2025-2026): https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/annual-student-budget/
- Harvard affordability/cost (2025-26): https://college.harvard.edu/admissions/why-harvard/affordability
- Stanford undergraduate aid/cost context: https://financialaid.stanford.edu/undergrad/how/works.html
- University of Toronto fees schedules: https://future.utoronto.ca/finances/tuition-fees/
- Nazarbayev University undergraduate fees: https://nu.edu.kz/admissions/undergraduate-admissions/fees-and-funding
- Astana IT University admissions (bachelor): https://www.aitu.edu.kz/en/admission/admission-to-bachelor-programs/
- MIT admissions by the numbers (acceptance): https://mitadmissions.org/apply/process/stats/
