# Admission tab clarity for reviewed universities

## Intent

A novice applicant who has only an IELTS and SAT result must be able to open a reviewed university's Admission tab (first case: Nazarbayev University) and see, in order, which admission path fits them, what it requires, when, at what cost, and where to apply. Today the NU tab opens on a rare mid-year path, hides the regular first-year path behind a program choice, lists a funding application as if it were an admission path, asks for an entry year before checking scores, and shows database wording ("Records: 2", "limited or unspecified scope").

## How admission relates to programs (verified 2026-11-21)

- MIT and Stanford first-year applicants apply to the university as a whole; the intended major is not binding and does not affect the decision (official MIT majors FAQ, Stanford application page).
- NU publishes one set of undergraduate minimums for all bachelor programs (IELTS 6.0 with writing 6.0, plus one academic alternative such as SAT 1240); Nursing and the joint BBA follow their own routes. NUFYP (Foundation) has lower, separate minimums.
- Imperial undergraduate, and master's/doctoral study almost everywhere, are applied to per program.

The runtime contract already distinguishes these cases: a route with `attributes.admission_scope = institution_wide_undergraduate` is read without a program; a program-specific route is reached through its study option. No new schema field is needed.

## Approaches

1. **Use the existing shared-route contract and fix NU data and wording (chosen).** Mark NU's regular and transfer routes as institution-wide, keep program-specific exceptions as their own routes, and simplify the tab's presentation. Small, reuses the MIT/Stanford path, fixes all four reviewed universities' wording at once.
2. Add a new `program_choice` field to routes and rebuild the tab as a level → program → situation stepper. Rejected for now: the existing contract already carries the needed distinction; a schema change would touch storage, validators and all four datasets.
3. NU-only special-case UI. Rejected: the shared controller serves all reviewed universities.

## Design

Data (NU converter `backend/scripts/prepare_nu_admissions.py`, then regenerate the runtime snapshot):
- Mark `nu-a-route-regular-foundation-undergraduate`, `nu-a-route-transfer` and the post-offer `nu-a-route-financial-support` as `institution_wide_undergraduate`, beside the existing mid-year route; a record listing every program of such a route at its levels is scoped to the route (its reviewed list is kept in `attributes.listed_option_ids`).
- Give the 21 first-pass graduate research records that have an empty scope their level (master's or doctoral) so they stop appearing as history on undergraduate paths.

Admission tab (shared frontend):
- Without a program, the shared paths come first with one-line explanations; for NU this includes regular admission, transfer and mid-year. The university's preparation-level (Foundation) programs appear as a separate entry. Program browsing stays below.
- A financial-support application is not offered as a path choice; the key facts keep naming it as the step after an offer.
- When the selected path publishes exactly one recognizable entry cycle and the reader has not chosen one, that cycle is used, so the minimums check runs without asking for a year. The cycle is visible in the selection summary and can be changed.
- Plain wording for the detail disclosures: no record-count badge; "limited scope" and "unknowns" labels rewritten for applicants; the optional fields disclosure named for what it holds.

## Non-goals

- No change to scoring rules, storage schema, or other universities' data.
- No new stepper component; the existing selection editor and summary remain.

## Left to the builder

Exact localized copy in English, Russian and Kazakh; regression tests in the existing NU and frontend unit suites.
