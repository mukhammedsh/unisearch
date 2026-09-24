# Admissions Model Migration TODO

This checklist tracks the approved delivery order in [the admissions product model](docs/admissions-product-model.md): complete the top-five data model and inventory first, integrate the backend and frontend second, then update the remaining 45 universities. Keep this file current as work is accepted; mark a task complete only when its evidence and gate are reviewed.

## Completed foundation

- [x] Defined the admissions product model, scoped fact/provenance rules, applicant-facing implications, and official MIT/Oxford examples in `docs/admissions-product-model.md`.
- [x] Linked the model and delivery order from `AGENTS.md`, `docs/roadmap.md`, and `orchestrator.md` so future contributors have a consistent direction.

Any current release work is tracked separately from this migration checklist. Decide its scope and version under `AGENTS.md`; this file does not set a version.

## Working rules

- Before starting a task, read `AGENTS.md`, the relevant sections of `docs/admissions-product-model.md`, `docs/roadmap.md`, and `orchestrator.md`, plus the current Git status/diff and any relevant orchestration evidence.
- Use official university catalogs, admissions pages, and university-hosted documents. Record the source, scope, review state, and checked date for each significant fact.
- Keep discovery subjects, study options, actual application targets, routes, applicant categories, cycles/windows, requirements, deadlines, costs, and funding distinguishable.
- Preserve unresolved or unpublished facts as explicit unknowns with an official next step. Do not infer a universal policy or claim catalog completeness without checking the official catalog snapshot.
- Keep incompatible draft data outside the active runtime path until backend and frontend integration is ready. Do not require a permanent legacy reader.
- Preserve existing uncommitted work. Follow `AGENTS.md` for checks and Git operations; commits, pushes, and version changes require the user's explicit permission.

## Immediate next steps

- [ ] Inspect the current university data, validation/audit scripts, API/frontend readers, and relevant orchestration checkpoints. Record which files are runtime inputs and identify a suitable draft location.
- [ ] Choose and document the canonical draft location using repository conventions; do not change the active runtime data path. The example path in the product model is illustrative.
- [ ] Start source-backed catalog inventories for MIT, Imperial College London, Stanford, Harvard, and Oxford. Record catalog pages, check dates, scope, coverage gaps, and unresolved option-to-route classifications before claiming completeness.

## Phase 1 — canonical schema, template, and complete top-five inventory

### Canonical schema and contributor template

- [ ] Define a canonical, legacy-free data schema and a small contributor template based on real top-five cases. Keep the contract as small as the verified cases allow.
- [ ] Represent discovery subjects separately from study options and actual application targets. Include undergraduate majors or concentrations as study options when officially listed, and record when they are selected after institutional admission.
- [ ] Represent shared and course-specific application routes, applicant categories, fee status where relevant, entry cycle, and application windows without assuming every institution uses the same structure.
- [ ] Keep requirements, application process, decision/enrollment conditions, application and funding deadlines, costs, and funding as separately scoped facts.
- [ ] Preserve source URL/title, official publication status, review status, checked date, and cycle or effective period where applicable. Distinguish confirmed unpublished facts from uncollected or unverified facts.
- [ ] When a real official fact requires a schema field, add or consolidate the field in the canonical draft schema and document its scope with a representative example. Do not add speculative fields or a generic rule engine.
- [ ] Review the schema against MIT university-wide undergraduate admission, Stanford university-wide undergraduate admission, Oxford course-specific undergraduate and graduate paths, Imperial's integrated MEng example, and a professional program with application rounds.

### Official top-five catalog inventory and fact drafts

- [ ] Inventory **all official degree-level study options** at MIT across undergraduate, master's, doctoral, and professional study. Include catalog-listed undergraduate majors as post-admission options when applicable; map each to its actual application target or explicitly unresolved classification.
- [ ] Inventory all official degree-level study options at Imperial College London across the same levels and categories. Distinguish integrated degrees from postgraduate routes based on the official application process, not the award label alone.
- [ ] Inventory all official degree-level study options at Stanford across the same levels and categories. Distinguish university-wide admission from a course or program that is the actual application target.
- [ ] Inventory all official degree-level study options at Harvard across the same levels and categories, including relevant professional programs and their route-specific application windows.
- [ ] Inventory all official degree-level study options at Oxford across the same levels and categories. Capture course-specific undergraduate applications and graduate courses with distinct routes or deadlines.
- [ ] For every university, record the official catalog page(s), catalog snapshot/check date, inventoried categories, and any excluded non-degree offerings so that the completeness claim has a defined boundary.
- [ ] For each inventoried option, link its discovery subjects, level, actual application target, route, applicant categories, and relevant cycle/window where the official sources establish them.
- [ ] Research route-scoped requirements, process, deadlines, costs, and funding from official sources. Record unknowns and conflicts with a useful official next action; do not fill them by inference.
- [ ] Keep the canonical top-five draft outside runtime data whenever the current application readers cannot safely consume its schema.

### Phase 1 acceptance gate

- [ ] The canonical schema/template has been reviewed against real examples and contains no required legacy compatibility shape.
- [ ] Each of the five official catalogs has a dated inventory covering the stated degree-level scope, with coverage gaps and unresolved option-to-route classifications explicitly listed.
- [ ] Every accepted top-five fact has official provenance and the appropriate scope/status; unknowns are explicit rather than silently omitted or converted to values.
- [ ] The product-model distinctions are represented without treating MIT or Stanford intended majors as first-year admission targets, without treating every Oxford graduate course as one route, and without confusing an integrated award label with the application level.
- [ ] The top-five dataset is reviewable as a draft and the existing app remains readable throughout this phase.

## Phase 2 — backend and frontend integration

- [ ] Map the canonical fields to backend loading, validation, API responses, and all affected search/scoring consumers. Identify persisted identifiers and saved selections that depend on current records.
- [ ] Implement the new runtime contract and migrate the reviewed top-five records as one coordinated backend/frontend change. Do not switch active data while the current readers cannot parse it.
- [ ] Render subject discovery separately from actual study options and application targets. Show route, applicant context, cycle/window, and scoped facts where they help the applicant decide.
- [ ] Keep requirements, application deadlines, funding deadlines, tuition/fees, living estimates, and funding distinct in the applicant view. Expose official source and checked date for significant facts.
- [ ] Preserve explicit unknown, not-published, and needs-review states; never display missing facts as zero, ineligibility, guaranteed funding, or verified admission odds.
- [ ] Remove obsolete data paths/readers after the new runtime contract is established and no longer needs them. A permanent legacy compatibility reader is not a requirement.
- [ ] Run the repository checks required by `AGENTS.md` for the changed data, backend, API, and frontend paths. Audit runtime university data and affected official URLs.
- [ ] Verify representative applicant journeys for institutional and course-specific targets; undergraduate, graduate, doctoral, and professional routes; relevant international and fee-status cases; separate funding deadlines; post-offer conditions where applicable; and explicit unknowns.

### Phase 2 acceptance gate

- [ ] Each displayed option resolves to its correct application target and route, including post-admission majors where applicable.
- [ ] No scoped fact leaks to an unrelated option, applicant category, fee status, cycle, or application window.
- [ ] API and frontend preserve the canonical fact status and provenance and keep costs and funding meanings clear.
- [ ] The coordinated migration works in the current application, representative journeys pass, and relevant checks pass. Record any remaining factual unknowns rather than blocking on facts an institution has not published.

## Phase 3 — remaining 45 universities

- [ ] Use the accepted top-five contract and contributor template to inventory each remaining university's official degree-level study options.
- [ ] For each university, record official catalog sources, checked date, degree-level coverage, and gaps before calling its inventory complete.
- [ ] Map each option to its actual target and route; verify whether requirements or applications are shared or program-specific.
- [ ] Refresh facts from official sources. Do not carry forward old values as current or copy policies from the top five or another institution.
- [ ] Keep new records as drafts until inventory coverage, route mapping, and fact provenance have been reviewed.
- [ ] Consolidate accepted draft facts and integrate them into the backend and frontend in a reviewed batch. Run the data audit, affected source checks, contract checks, and representative journeys for the combined change.

### Phase 3 acceptance gate

- [ ] Every remaining university has a reviewed official catalog inventory and an explicit account of gaps or unresolved classifications.
- [ ] Every published fact is source-backed, scoped, and cycle-aware; unverified or unpublished items remain visibly unknown.
- [ ] Integrated data passes the applicable repository audits and its representative user journeys without cross-route or cross-cycle fact leakage.

## Project completion

- [ ] All 50 universities have been migrated and their facts refreshed under the approved model, with source-backed inventory coverage or explicit unresolved gaps.
- [ ] Backend and frontend consistently present subject discovery, real application targets, relevant routes, and properly scoped admissions facts.
- [ ] Final diff, documentation links, checks, unresolved facts, and remaining limitations have been reviewed and reported. Do not commit, push, or change the version without explicit user permission.
