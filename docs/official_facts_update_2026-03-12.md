# Official Facts Update (2026-03-25)

Scope:
- `backend/data/official_facts.json`
- `backend/data/universities.json`
- `backend/scripts/apply_official_facts.py`

What changed in this cleanup pass:
- promoted `official_facts.json` to the single curated catalog for verified optional facts added in this sprint:
  - `student_count`,
  - `academics.acceptance_rate_percent`,
  - `description`,
  - `tags`,
  - targeted `verified_sources` replacements / removals.
- re-verified MIT institutional acceptance rate against MIT Admissions statistics for the Class of 2029 and synchronized catalog + dataset to `4.56%`.
- replaced the broken Imperial student-count URL with the live official Imperial student statistics page.
- replaced the broken ETH local-exam requirements URL with the live official Swiss matriculation requirements page.
- repaired AITU source hygiene:
  - `description_source` now points to the live official `about-aitu` page,
  - broken `english_language_policy` source was removed,
  - `extra_requirements`, `programs`, and `formats` now point to the live official bachelor's page.
- filled missing `description` and `tags` fields for the 11 remaining universities using only official university pages or official university-hosted PDFs.
- filled TU Delft `student_count` with an explicitly marked official approximate value derived from the live "26.000+ students" figure on the official About TU Delft page.

Implementation notes:
- `backend/scripts/apply_official_facts.py` now syncs numeric facts, `description`, `tags`, and targeted `verified_sources` topic overrides from the catalog into `universities.json`.
- `backend/tests/test_official_facts_sync.py` adds:
  - an idempotence test for `apply_official_facts`,
  - a sync regression test that compares catalog payloads with `universities.json`.
- `backend/tests/test_exams_api.py` now asserts the newer exam keys exposed by `/exams/config`.

Primary source types used:
- official university about / profile pages,
- official admissions statistics pages,
- official university-hosted reports and PDFs,
- official admissions or program-structure pages.

Notes:
- The AITU enrolment split was rechecked against the official AITU strategy materials during the 2026-03-25 pass, but the direct strategy PDF URL currently returns `410` in automated checks. The dataset now keeps a live official landing page in `verified_sources` and marks the provenance entry as curated from official materials.
- HTTP audit after cleanup shows no `404/410` errors for the touched URLs; remaining HTTP warnings are primarily `403` anti-bot responses on otherwise official pages.
