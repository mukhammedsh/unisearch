# Light admissions dossier standard

This standard bounds how much is researched and stored for one university. It applies to every institution added or converted after the four accepted deep datasets (Massachusetts Institute of Technology, Imperial College London, Stanford University, Nazarbayev University), which remain valid as collected. It follows [the product model](admissions-product-model.md) and expands into the existing [storage contract](admissions-storage-contract.md), so the runtime keeps one reader.

Status: the standard and its research rule are adopted (2026-11-12). The authoring format below was verified in an offline feasibility run over all 46 earlier-format institutions; the expander and the runtime changes listed under [Runtime prerequisites](#runtime-prerequisites) are not implemented yet, and no light dossier is active.

## Purpose

An applicant uses UniSearch to find universities worth considering, understand in a few minutes whether one is realistic for them, and continue on the official site. A dossier therefore answers: what can I study, how do I apply, what do I need, when, how much, what funding exists, and where do I go next. It is not a copy of the university's website.

## What a dossier contains

| Part | Content | Typical size |
| --- | --- | --- |
| Sources | Official pages and university-hosted documents, each with its real title and checked date | 5–15 |
| Programs | Official title, level, award, duration, teaching language, mode and the program page as its source | the catalog list |
| Routes | The real application paths: first-year, transfer, graduate, preparation or professional, with the official application link and the programs they serve | 1–5 |
| Facts | One applicant-ready statement per topic and route, with optional structured data and its sources | 10–15 per route |
| Unknowns | A plain sentence saying what was not found and the official next step | as needed |

A fact has a closed topic: `eligibility`, `academic_tests`, `language_tests`, `documents`, `application_process`, `application_windows`, `tuition`, `costs`, `funding`, `offer_enrollment`, or `admitted_profile` for published statistics about admitted students.

Each fact carries a short summary written for an applicant in English, Russian and Kazakh (about 400 characters), the sources it rests on, its publication state from the closed vocabulary, and the cycle or period it was published for. Measurable content also goes into one of three closed structures so the site can compute with it:

- `minimums` — published minimum scores, with alternatives and component minimums, using the exam identifiers in `backend/data/exams.json`. Qualification alternatives (for example a national grade average, IB or A-levels) are alternatives of one requirement on one route, never separate routes. A GPA entry states its scale.
- `windows` — named application windows with ISO date, time and timezone where published.
- `quotes` — costs with currency, period, level, fee status and what the amount includes.

## What a dossier leaves out

- Curriculum, course lists and degree-completion rules: the program's official page is linked instead.
- Rare exceptions and individual circumstances beyond the fact budget: one sentence and a link to the official page that governs them.
- Program-specific facts where the university admits to the institution as a whole, or where a program's requirement equals the route's. Add a program-specific fact only when the university admits by program and the published requirement differs; group programs that share it.
- Research process notes, provenance bookkeeping and repeated boilerplate. The expander writes the storage fields that carry no authored meaning.

A bounded dossier must never be presented as exhaustive: the page keeps the official links and says where the full rules are.

## Rules that do not change

- Only official university sources and university-hosted documents. Missing data is better than invented data.
- A published typical or admitted score is `admitted_profile`, never a minimum. Do not turn "competitive applicants usually have…" into a pass/fail threshold.
- Every amount has a currency, period and scope; every dated value keeps its cycle. A value from another cycle is labelled, not presented as current.
- Fee status, residency and aid eligibility are never inferred from nationality.
- Unknown stays unknown: no zero, no guessed date, no presumed ineligibility.
- A converted earlier-format record that was not rechecked against its sources is marked `carried_forward` and shown to applicants as not yet rechecked.

## Converting the earlier-format institutions

The feasibility run produced a median dossier of 9 programs, 1 route, 13 facts and about 8 KB (27 stored records after expansion), against 731–2,998 records and 1.4–10 MB for each deep dataset. It also exposed problems that a mechanical conversion would carry over, so each conversion includes a recheck of its facts against the official pages:

- 15 of 81 requirement profiles store a typical admitted score as a minimum;
- 23% of converted facts have a source matched only by topic, and 16 have none;
- 23 institutions have no cycle on any fact;
- 35 institutions hold a local-currency amount in a field named for US dollars;
- generated "paid" funding options and templated grant descriptions are not facts and are dropped.

## Runtime prerequisites

These are required before the first light dossier is activated and are not yet implemented:

1. Derive the set of catalog-owned institutions from the catalog instead of the fixed four-institution list in `backend/app/services/admissions_catalog.py`, and lift the same limit in `backend/data/drafts/integration/schema.json`.
2. Let the requirements match read `minimums` directly, so a light fact needs no hand-reviewed mapping in `backend/data/admissions/assessments.json`.
3. Show a fact's summary in the reader's language from the dossier itself rather than from the exact-text translation registry.
4. Cut each converted institution over to the reviewed page and scoring path together, as was done for the four accepted institutions; an institution is never served by both paths.
