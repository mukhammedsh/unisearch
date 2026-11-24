# Admissions work tracker

This file contains current scope, open decisions, and unfinished work. Completed implementation and verification history belongs in `CHANGELOG.md` and Git; source evidence belongs in the relevant university draft. Do not treat removed checkpoints or old test totals as current verification.

## Current scope and decisions

- The catalog plan covers the first ten universities in local catalog order, then the forty after them. The reviewed runtime batch is Massachusetts Institute of Technology, Imperial College London, Stanford University, and Nazarbayev University. NU is outside the first-ten ordering and was accepted separately.
- Seven first-ten institutions remain: Oxford, Harvard, and Cambridge research is paused; ETH Zurich, National University of Singapore, California Institute of Technology, and the University of Chicago are the next research batch after a bounded handoff.
- Forty institutions follow the first-ten cohort; NU is already accepted within that later cohort. In total, 46 catalog institutions still use the earlier admissions presentation.
- Keep unaccepted data outside runtime. Resume Oxford, Harvard, or Cambridge only after an explicit user request. Do not force MIT's structure onto another university.
- Use the [light dossier standard](docs/admissions-light-dossier.md) for future research. Follow the [per-university workflow](docs/admissions-product-model.md#per-university-research-and-update-workflow) and stop at the assigned stage boundary.
- The catalog study-level filter is an optional browsing preference. Do not infer a user's next education level.

## Current applicant-work follow-up

- Restore calendar navigation and ICS export for reviewed admissions contexts using only dated source facts, their published time zones, and applicant restrictions. Keep yearless windows yearless.
- Check that a Russian-speaking novice can choose among source-language program and route names and understand the next action; translated generic labels alone do not prove comprehension.
- Ask novice applicants to use the four reviewed detail pages, record concrete confusion or missed information, and fix confirmed issues before extending the presentation to another batch. Automated checks do not replace this feedback.
- Before a release that changes admissions wording, have a fluent Kazakh reviewer check terminology and policy nuance.

## Open data quality work

- Eight Kazakhstan universities lack a verifiable student count for UniFit's research-focus indicator: Astana Medical University, International Information Technology University, Satbayev University, Kazakh-British Technical University, Al-Farabi Kazakh National University, L.N. Gumilyov Eurasian National University, Narxoz University, and KIMEP University. Official pages are missing, blocked, conflicting, or undated; keep the indicator unknown until evidence is resolved.
- Twelve earlier-format Kazakhstan acceptance rates are rounded estimates sourced only to a generic note. Recheck them against official university sources before presenting them as verified facts.
- For future conversions, move typical admitted-student scores (for example, Yale's admitted-student GPA) out of minimum requirements and into `admitted_profile`.

## Work waiting for a user decision

- **Imperial requirement detail:** some tests and documents are published as course prose. NU now fills its checklist from assessed minimums; Imperial's per-course overview still links to Admission. Decide whether to structure key examples, such as TMUA for Imperial Computing, during a later light-dossier conversion.
- **Legal and history follow-up (2026-11-15):** founders' surnames and previously used unlicensed campus photos remain in Git history. Removing them requires a history rewrite and force-push affecting later commits and tags; the old copies would remain in forks and caches. Recommendation: leave history unchanged. QS ranking data carries the source's non-commercial-use notice; commercial use needs written permission. Confirm with QS whether catalog sorting by position is allowed if that use is planned.
- **Campus photography (2026-11-17):** Astana IT University, Nazarbayev University, and KIMEP University still need reusable exterior images with documented image/building rights. KIMEP's available Commons photos are small; the higher-resolution photos found so far lack a verified license. The current NU and AITU covers are interiors. Decide whether to request original photos from [AITU Communications and Marketing](https://astanait.edu.kz/en/marketing-department), the [NU Press Office](https://nu.edu.kz/about/contacts/), and [KIMEP Marketing and Public Relations](https://www.kimep.kz/files/news/catalog/PArt_VIII.pdf). Seoul National University's current cover depicts the historic Daehan Hospital building on its medical campus.

## Hosting and data delivery (2026-11-24)

- Static public snapshot: implemented on 2026-11-24 — `.github/workflows/firebase-hosting.yml` builds `frontend/snapshot/` at deploy time with `backend/scripts/build_static_snapshot.py --include-assets` (pure Python stdlib, reusing backend projection logic) and enables `APP_STATIC_SNAPSHOT=1` via `scripts/build-firebase-env.mjs`. Public catalog cards, map points, per-university detail JSONs (`eng`/`rus`/`kaz`), translation packs, reference configs, reviewed `study-options`, and credited campus photos are served from Firebase Hosting without waking Render; UniFit, profile-scoped catalog costs, reviewed admissions-context assessments, exam/language validation, and live exchange rates remain on the FastAPI backend with profile data kept out of static files and shared caches.
- Memory limit: resolved for runtime storage on 2026-11-24 — the reviewed admissions catalog is now split into a compact `backend/data/admissions/index.json` (~391 KB) and per-institution files under `backend/data/admissions/institutions/<id>.json` loaded lazily into a bounded LRU cache (`MAX_LOADED_INSTITUTIONS = 6`), keeping startup, listing, map, detail, and unselected UniFit reads off full institution payloads as more institutions are converted.
- `backend/data/drafts/` stays in place: the per-institution admissions files under `backend/data/admissions/institutions/` record provenance paths and hashes into it, and the paused Oxford, Harvard, and Cambridge work lives there untracked. Splitting `universities_translations.json` by language would save about 7 MB and 50 ms, so it is not worth doing.

## Later catalog batches

- After the paused research is explicitly resumed and accepted, finish the next four first-ten institutions: ETH Zurich, National University of Singapore, California Institute of Technology, and the University of Chicago. Track source snapshots, coverage, unique structures, evidence-backed gaps, and draft paths in their university folders.
- After the first-ten handoff, convert the remaining earlier-format institutions in reviewed batches using the same light dossier standard. Preserve institutional differences, provenance, conditions, and unknowns; do not start an all-catalog rewrite or activate unreviewed drafts.

## References

- [Admissions product model](docs/admissions-product-model.md)
- [Light dossier standard](docs/admissions-light-dossier.md)
- [Admissions work runbook](orchestrator.md)
- [Roadmap](docs/roadmap.md)
