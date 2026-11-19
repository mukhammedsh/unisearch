# Admissions work runbook

Use this runbook only for admissions-data or applicant-journey work. For the current status, read the [scope and decisions](todo.md#current-scope-and-decisions), the [unfinished applicant work](todo.md#current-applicant-work-follow-up), and only the relevant open items. Do not reread completed checkpoint history; implementation history is in `CHANGELOG.md` and Git, while source evidence lives in each university's draft folder.

## Before work

1. Read `AGENTS.md`, the relevant sections of the [admissions product model](docs/admissions-product-model.md), and the [light dossier standard](docs/admissions-light-dossier.md) when researching or converting a university.
2. Check `git status --short` and the existing diff. Reuse accepted evidence and inspect the current runtime and consumers before editing.
3. Confirm the authorized institution and stage in `todo.md`. Do not resume paused Oxford, Harvard, or Cambridge research without a new user request.

## Stage boundaries

1. **Research:** use official university sources, record scope, provenance, cycle, conditions, and evidenced unknowns in durable drafts. Do not activate data or implement application support for unaccepted facts.
2. **Integration:** implement only the reviewed delivery batch. Trace each accepted fact through storage, API, profile/evidence, scoring, and the applicant interface; keep other institutions' coverage honest.
3. **Applicant verification:** exercise the assigned real journeys across relevant languages, desktop/mobile layouts, themes, saved choices, missing evidence, and source links. Fix concrete usability failures and stop at the agreed handoff.

MIT is a reviewed example, not a universal schema. Stage 1 does not require implementing every new fact or approving the final UI. Keep rare exceptions and curriculum detail linked to the official source when they do not need a runtime assessment.

## Handoff

Update `todo.md` only when scope, a decision, or unfinished work changes. Add release-relevant changes to the in-progress `CHANGELOG.md` block and follow `AGENTS.md` for verification and local commits. Push, tags, and releases require explicit user permission.

### New-chat starter

> Continue the next authorized admissions task in the existing checkout. Read `AGENTS.md`, the relevant admissions product-model section, `todo.md#current-scope-and-decisions`, the applicable unfinished-work section, this runbook, and Git status/diff. Reuse accepted evidence; do not reopen completed work or paused Oxford/Harvard/Cambridge research. Use the light dossier standard for new research. Stop at the assigned stage boundary, update only current scope or unfinished work, and report exact changes, checks, unknowns, and the next task. Follow `AGENTS.md` for version and local-commit workflow; do not push, tag, or release without explicit permission.
