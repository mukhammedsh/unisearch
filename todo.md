# UniSearch Decision Journey and Admissions TODO

This is the durable problem ledger and execution checklist for [the admissions product model](docs/admissions-product-model.md). Current priority: use the existing profile in one coherent decision journey, fix scoped facts and estimates, define scoring meaning, and review the MIT/Imperial/Stanford contrast cases with the user. Then complete MIT, the other four top-five institutions, and the remaining 45. Mark implementation tasks complete only after their behavior and evidence are reviewed; documenting a problem does not fix it.

## Completed foundation

- [x] Defined the admissions product model, scoped fact/provenance rules, applicant-facing implications, and official MIT/Oxford examples in `docs/admissions-product-model.md`.
- [x] Linked the model and delivery order from `AGENTS.md`, `docs/roadmap.md`, and `orchestrator.md` so future contributors have a consistent direction.

Any current release work is tracked separately from this migration checklist. Decide its scope and version under `AGENTS.md`; this file does not set a version.

## MIT pilot checkpoint (2026-09-24)

- The live catalog now shows 52 source-backed undergraduate degree-chart options: nine existing exact matches, three corrected course-number replacements, and 40 new discovery options. Three chart entries need a degree-status review before publication. Undergraduate first-year application remains institution-wide; the new options are not presented as separately selectable transfer targets.
- Nine previously researched graduate/professional options remain live. The draft records 52 graduate program families, including four internal MEng families, and 83 source-backed award options across 38 of those families. Fourteen families still need award-level review, and application targets and routes for the draft options remain unverified. The full MIT graduate/professional inventory and route mapping remain open.
- MIT routes, costs, deadlines, and UniChance now follow the selected program where reviewed. Unknown graduate/doctoral score evidence stays unknown. The live program list is a preview for applicant-experience review, not a claim that MIT is finished for every applicant.
- Most of the 40 new undergraduate discovery options initially contain only a title, study level and catalog source. This is a collection gap, not evidence that MIT publishes no further program information. Course 15-2 now includes a sourced curriculum summary; the other sparse summaries still need individual review.

## Working rules

- Before starting a task, read `AGENTS.md`, the relevant sections of `docs/admissions-product-model.md`, `docs/roadmap.md`, and `orchestrator.md`, plus the current Git status/diff and any relevant orchestration evidence.
- Use official university catalogs, admissions pages, and university-hosted documents. Record the source, scope, review state, and checked date for each significant fact.
- Keep discovery subjects, study options, actual application targets, routes, applicant categories, cycles/windows, requirements, deadlines, costs, and funding distinguishable.
- Preserve unresolved or unpublished facts as explicit unknowns with an official next step. Do not infer a universal policy or claim catalog completeness without checking the official catalog snapshot.
- Keep incompatible draft data outside the active runtime path until backend and frontend integration is ready. Do not require a permanent legacy reader.
- Preserve existing uncommitted work. Follow `AGENTS.md` for checks and Git operations; commits, pushes, and version changes require the user's explicit permission.
- Reuse the existing profile and its persistence/API mapping. Do not introduce another questionnaire for fields already populated. Confirm how each relevant field is consumed, not only that it is stored.
- Correct scope and factual errors before tuning ranking weights. Record open scoring decisions explicitly; neither official score inputs nor passing tests prove calibrated admission odds.

## Problem ledger (reviewed 2026-09-29)

The observations below record the migration baseline, including historical implementation paths. The first two batches address D1-D8 in the reviewed contrast paths; the scoring batch addresses S1-S5 pending final journey verification. U1 has a representative UX implementation checkpoint below; C1 and user acceptance remain open. This is not a full catalog audit or proof of behavior for every profile; recheck the current flow before editing.

| ID | Baseline problem and evidence | Required outcome |
| --- | --- | --- |
| D1 | Profile fields exist and reach the API, but application route/cycle are used in qualification guidance without consistently selecting the admissions/scoring/deadline/finance context. See `frontend/profile.html`, `frontend/javascript/utils/persistence.js`, `backend/app/schemas/payloads.py`, `backend/app/services/ai_scoring.py`, and `frontend/javascript/pages/university/render-content.js`. | A populated profile narrows applicable paths and facts across all sections. Incomplete input leaves applicability unknown; the visitor can choose a local context without overwriting their general profile. |
| D2 | Stanford CS selection left a JD recommendation in the UniChance summary above undergraduate paths in the checked browser journey. `render-sections.js` scopes `contextChance` by visible program categories only for MIT. | Summary, active/recommended choice, details, and ranking use the same applicable program/level/route context. No unrelated professional or graduate estimate appears in an undergraduate view. |
| D3 | MIT Course 6-3 shows first-year windows and transfer together. The spring transfer date appears without its US citizen/permanent-resident restriction adjacent to the deadline. Structured applicant scope is lost in the deadline projection/rendering in `render-sections.js`. | First-year and transfer remain distinct; each deadline retains applicant eligibility, cycle, window, and source. Citizenship/current residence must not imply an unrecorded immigration status. Verify affected dates against the [official transfer page](https://mitadmissions.org/apply/transfer/deadlines/). |
| D4 | Imperial Computing MEng correctly uses undergraduate entry, UCAS, and TMUA, but its requirement profiles come from the broad Engineering & Computing category in `backend/data/universities.json`. Course-level subject/grade conditions are not faithfully represented by that shared category. | Verify [Computing MEng](https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/) for the selected cycle and represent its exact requirements; do not apply the correction to unrelated Engineering courses. |
| D5 | Imperial funding cards displayed approximate cost of $0 when the applicable amount was unavailable. `page-controller.js` uses `modeAwareAnnualCost` for these cards. | Unknown tuition/total stays unknown across detail cards, comparison, and ranking. A verified zero remains distinguishable from missing information. |
| D6 | Selected program and level drive finance/deadline context through MIT-only branches; other institutions can retain general/profile-level facts. See `renderFinanceSection` and `renderDeadlinesTabSection` in `render-sections.js`. | Applicable facts follow manual context at every institution. Graduate/professional selections never inherit undergraduate costs, dates, or acceptance data. |
| D7 | Manual program selection is held in module Maps and the MIT program transition does not serialize it into a supported link or persistent selection. See `selectAdmissionProgram` and `page-controller.js`. | Define context precedence and restore selections after reload/back navigation/deep links. Profile updates and local overrides cannot leave stale sections. Preserve supported saved identifiers. |
| D8 | Significant shared behavior is gated by literal MIT identifiers in the controller and renderers. Copying those exceptions would create more institution-specific flows. | Express demonstrated differences through application target, selection timing, route, and fact scope; reuse a common rendering/selection path. Avoid a speculative rule engine or full rewrite prerequisite. |
| S1 | Current score-profile UniChance uses a distribution percentile and an acceptance multiplier, rather than an outcome-calibrated model. The proxy also appears with probability wording. See `_compute_score_profile_chance` in `ai_scoring.py` and localization. | Decide the estimate's name and presentation. Score position/requirements fit must not be advertised as validated admission odds. Define evidence/calibration gates for any future probability claim. |
| S2 | Actual budget amount is used for affordability details/status, but not directly in UniFit's `final_score`; the finance-versus-prestige slider is a separate input. | Decide and implement explainable affordability behavior in recommendation/ranking, including currency/period, known cost, unknown cost, and potential aid. Keep unsupported budget claims out of copy. |
| S3 | UniFit substitutes an internal neutral 50% when an admission estimate is missing. This can influence ordering without matching evidence. See `sort_universities_ai`. | Define and test a missing-evidence ranking policy. Preserve no-data/confidence; do not present the neutral input as a calculated chance or award evidence-poor options unexplained advantages. |
| S4 | Admission choices combine category, exam/requirement profile, and paid/grant outcome. MIT UI states that aid is separate from admission while backend choices can repeat admission evidence for funding outcomes. | Separate admissions applicability/assessment from funding eligibility and affordability. Funding creates another admission route only when an official separate process exists. |
| S5 | Semantic interest matching and major penalties currently operate at university granularity, while the journey selects actual courses and application targets. | Describe the current granularity honestly and define course-aware relevance where explicitly selected. No unverified claim of a course-specific probability or recommendation. |
| U1 | The original first screens prioritized catalog coverage and estimates before applicable answers, with mixed Russian/English text. The representative UX checkpoint below addresses those findings. | Keep the selected context and official requirements first, with accessible sources, costs, deadlines and optional history. User review of the decision summary and wider catalog localization remain open. |
| C1 | MIT inventory and route mapping are incomplete, especially graduate/professional drafts and undergraduate transfer links. Coverage marked catalogued can rely on a shared category and does not prove a complete program-specific answer. See the dated checkpoint above and remaining tasks below. | Preserve explicit gaps and official next actions. Distinguish catalog presence, reviewed applicability, and factual completeness. Do not claim complete MIT or top-five coverage from counts/badges. |

### Foundations to preserve

- MIT correctly explains university-wide first-year admission and post-admission major choice, and its program-to-admission transition carries context between sections.
- Reviewed official sources, scoped dates/costs, explicit unknowns, and separate funding guidance are useful existing work.
- Qualification guidance already matches several education/context fields and can return `needs_review`; preserve that honest boundary rather than inventing country-wide acceptance or rejection.
- Existing guest browsing, profile persistence, saved identifiers, localization, and all supported study levels remain part of the acceptance contract.

### Open product decisions

- [x] Present UniChance as the percentage of evaluable published minimum requirements met, never as a validated admission probability. Do not show a percentage where the route has no measurable minimum or required applicant evidence is missing. Keep admitted and enrolled score ranges as separately scoped, sourced historical facts.
- [ ] Decide the eventual product name and whether to rename legacy API fields such as `overallChance`; their current numeric meaning is explicitly identified by `scoreMeaning`.
- [x] Use known gross annual route cost and the profile budget in UniFit; show over-budget and unknown-cost states separately. Potential aid never silently reduces the price. Review the weighting with the user after the representative journeys.
- [x] Omit missing academic fit from ranking components and renormalize the known components; do not inject a neutral 50% or treat missing evidence as zero.
- [x] Define context precedence among profile defaults, local manual overrides, restored links, and saved selections. Do not silently rewrite a general profile from a detail-page choice. See the detail-page context contract in `docs/admissions-product-model.md`.
- [ ] Review a compact decision summary and access to its supporting sections with the user. A new tab structure, schema shape, or full code rewrite is not yet mandated.

## Immediate next steps

- [x] First implementation batch: trace the existing profile-to-API-to-selection flow and connect the relevant fields to one shared program/level/applicant/route/cycle context (D1, D2, D6, D7).
- [x] Correct affected course requirements, deadline applicability, and unknown-cost rendering using official sources and shared helpers (D3, D4, D5).
- [x] Define and implement coherent scoring semantics, budget behavior, missing-evidence treatment, and separate funding assessment (S1-S5); update all affected copy/contracts together.
- [ ] Validate the contrast cases below and let the user review the working journey before mass migration. Keep the full MIT inventory open as the next completeness gate.

### First two batches: implementation checkpoint (2026-09-29)

- Detail-page program, level, applicant route, and entry-cycle overrides now use one request-local context over the existing profile. Supported URL selections restore after reload and browser history; selecting a detail-page program does not rewrite the saved general profile. The selected context narrows admission categories, estimate choices, qualification guidance, deadlines, and finance in the reviewed paths.
- MIT first-year and transfer deadlines remain separate. Spring transfer application and test-score dates display the published U.S. citizen/permanent-resident restriction beside each date and retain it in calendar export. Stanford Computer Science keeps the first-year context separate from transfer and JD. Imperial Computing BEng/MEng use their own sourced 2027 requirement profile, including TMUA, instead of the broader Engineering profile.
- Missing or cycle-incompatible prices remain unknown in summaries and comparisons; a published zero remains distinct. Doctoral/professional contexts do not borrow institution-wide undergraduate costs or broad salary outcomes. Published fees from another period are labeled as references where shown.
- Focused source/data, backend, frontend unit, and browser checks covered the contrast paths and a delayed-response/profile-restore scenario. The full MIT inventory, scoring semantics S1-S5, the U1 layout/localization review, and user acceptance remain open. This checkpoint does not certify every university or applicant category.

### Scoring implementation checkpoint (2026-09-29)

- UniChance now reports the share of measurable published minimum checks met for the selected requirement profile. Missing evidence or absent measurable minimums produces no percentage. Admission outcomes, score distributions, acceptance rates, and funding do not enter that number; the legacy API field names remain until a reviewed compatibility change.
- UniFit uses the same requirement assessment once per profile. Missing fit contributes no hidden neutral score. The actual annual budget affects ranking only against an applicable known gross cost; unknown costs and uncertain ranges remain distinct, and potential aid is not assumed to pay the difference. Interest matching remains at university granularity and is labeled accordingly.
- Funding options remain visible as funding paths without duplicating an academic assessment in the applicant view. MIT's 2024 Common Data Set SAT/ACT percentiles describe enrolled first-year students; the Class of 2029 admissions page gives an ACT Composite range for all first-year admits, not an Early Action-specific range or a SAT Composite range. These references remain separate from UniChance and are never minimums or probabilities.
- Verification: all 531 backend tests passed after the scoring and MIT source corrections. The frontend unit suite passed 449 tests. Focused browser checks covered MIT first-year/transfer and Physics PhD, Imperial Computing BEng/MEng, Stanford first-year/transfer, and comparison; the final MIT first-year check used a 390px Russian dark-theme viewport. A manual desktop Russian light-theme review confirmed the separate range block and corrected guest no-data message. This does not establish the entire guest/populated/incomplete-profile matrix or user acceptance below.
- Still open: U1 decision-summary/layout review, the full representative profile/theme matrix, user review of ranking weights and wording, final UniChance naming, and MIT inventory completeness. Do not start mass migration from test totals alone.

### Representative UX implementation checkpoint (2026-09-29)

- General coverage is an expandable section. Admissions starts with the selected program, route and cycle, then course conditions and the official application step. Deadline/cost actions remain available; requirements fit and historical statistics are separately expandable. Textual grades, subjects and documents are not represented as already checked by a numeric percentage.
- Russian selection preserves distinct program names and the stable program ID. Route labels, annual deadline caveats, selected-course conditions, save-button accessibility text and reviewed cost items use localized text.
- Stanford's catalogued first-year international aid record is explicitly first-year scoped. Transfer does not inherit its REA/RD deadlines; the empty transfer funding state does not imply ineligibility and links to the official aid application index, which lists separate transfer checklists. Transfer award details remain to be catalogued.
- Actual browser verification covered 35 combinations: seven selected journeys (MIT Course 6-3 first-year/transfer and Physics PhD, Imperial Computing BEng/MEng, Stanford CS first-year/transfer), each as a guest, populated synthetic profile, incomplete synthetic profile, Russian dark/mobile and English light/desktop. All retained their selected-program context and expected categories; no API HTTP errors or horizontal overflow occurred. This is a representative matrix, not every possible profile/theme combination.
- Additional interactions covered Russian mobile route/program changes, reload/back and the transfer financial-aid source; English desktop MIT program change to Physics PhD, reload, retained profile defaults and opening coverage. Existing focused E2E covered delayed responses/profile restore. Final wording corrections were separately checked in the two affected Russian mobile journeys.
- Verification: 453 frontend unit tests, seven focused contrast-case E2E tests, token/design/i18n/encoding/version checks and data audit. Browser screenshots are local verification artifacts, not catalog completeness evidence. User acceptance, a further compact decision-summary iteration, final UniChance naming, complete MIT inventory and broader localization remain open.

## Phase 0 — shared journey and contrast-case review

### Program-card and route follow-up (2026-09-29)

- Course 15-2 now has a sourced study description, a direct degree-chart link and MIT Sloan's Fall 2026 curriculum link. Its degree requirements are explicitly separate from admission prerequisites.
- Program cards group metadata beside its labels, show descriptions as paragraphs and expose official sources. Summaries without collected descriptions say so; MIT undergraduate cards explain the shared first-year application before the admission action. A selected major uses a badge instead of a full-card accent fill.
- The admission view keeps route and cycle visible when only one catalogued option exists, with the existing unknown selection available. A missing published minimum produces one precise explanation instead of repeated profile-data warnings. Historical score references remain available in an expandable section.
- Actual browser checks covered Course 15-2 at desktop and mobile widths in light and dark themes, the program-to-admission transition and restored program context after reload. Additional focused checks covered a sparse undergraduate summary, a graduate description and opening historical range evidence. User acceptance and the full MIT inventory remain open.

### Implementation and focused verification

- [ ] Keep one applicable context across program browsing, admissions requirements, qualification guidance, deadline projection, costs/funding, and the estimate summary.
- [ ] Use existing profile values automatically; when missing, offer relevant alternatives or an explicit unknown without requiring an account or a full questionnaire.
- [ ] Filter known-inapplicable paths without guessing missing eligibility, legal residency, qualification recognition, or university-assessed fee status.
- [ ] Resolve D1-D8 and S1-S5 with focused regression coverage for scope changes, unknown evidence, unknown versus real zero cost, and persistence/restore behavior.
- [x] Resolve U1 in the reviewed journey; avoid raw developer-facing fields and do not treat a coverage badge as proof of factual completeness.
- [ ] Keep guest/profile behavior and existing saved state working; review the changed producer, API, frontend consumer, persisted representation, and tests together.

### Representative journeys

| Case | What must be demonstrated |
| --- | --- |
| MIT Course 6-3, first-year | The study interest resolves to institutional admission. SAT/ACT are evidence alternatives, EA/RA are application windows, and aid is separate. A Kazakhstan education/profile case has no unrelated transfer dates presented as applicable. |
| MIT undergraduate transfer | Review term eligibility and published applicant restrictions separately from first-year requirements. Unknown permanent-resident status remains unresolved. |
| Imperial Computing MEng | Undergraduate-entry course is the actual UCAS target. Specific grade/subject/test conditions, cycle, and fee context govern the answer; unrelated Engineering requirements do not substitute. |
| Stanford undergraduate Computer Science | Major is an interest under shared first-year admission; transfer is a distinct route. No JD/MS/professional summary or cost leaks into the selected context. |
| Reviewed MIT graduate/doctoral option, such as Physics PhD | Requirements, dates, fees/funding, and academic evidence use the selected program. Undergraduate acceptance/budget never substitutes for missing graduate data. |

- [x] Exercise each applicable case with a guest, a populated synthetic profile, and an incomplete synthetic profile; do not use or log personal applicant data for evidence.
- [ ] Verify program/route/cycle changes, profile updates, reload, back navigation, and restored selection; wait for page readiness before interactions.
- [x] Run the focused checks required by `AGENTS.md` and the actual desktop/mobile English/Russian light/dark journeys. Record exact results and unavailable checks without carrying forward old totals.
- [ ] Invite user review and incorporate concrete findings. Record accepted behavior and remaining open decisions.

### Phase 0 acceptance gate

- [ ] The applicant can explain what they would study, where/how they apply, which requirements are met/missing/unknown, what cost is known, and why the option is relevant.
- [ ] Facts and estimates share the selected context at all three contrast institutions, with no known cross-program/level/route/cycle leakage.
- [ ] Budget and academic estimates have defined, explainable semantics; unknowns and potential awards are not fabricated values or probabilities.
- [ ] Guest and profile journeys are verified, selection is restorable, and the user has reviewed the UX.
- [ ] The gate is recorded as a representative journey result, not as full MIT/Imperial/Stanford catalog completion.

## Phase 1 — complete MIT pilot

- [x] Complete the remaining sparse MIT undergraduate summaries with program-specific official sources and useful study descriptions. All 52 active Bachelor options now have a study description, Russian translation, and direct MIT degree-chart link. Keep degree requirements separate from admission conditions; a shared first-year route does not make the study description complete.

### MIT catalog checkpoint (2026-09-29)

- The runtime MIT catalog now includes Course 6-7P and Course 6-14P as internal EECS MEng options for the corresponding MIT undergraduates; Course 6-P uses the same internal route. These are not external graduate application targets. The program cards link both the degree chart and the EECS application guidance.
- Sloan MSMS now has its own partner-school-only application route, February 18, 2027 deadline, and a separately dated 2026-27 tuition-and-mandatory-fee reference. Its 2027 entry price remains unknown. Eligibility depends on Sloan's current partner/affiliate list and any school-specific restriction.
- Course 6-9P is now a separate internal BCS MEng route for current MIT Course 6-9 majors. BCS publishes technical (4.25/5) and overall (4.0/5) GPA minima. UniChance shows these as unassessed and returns no percentage because the profile cannot check both. The recurring November/April application window is shown without an invented cycle-specific date.
- The runtime MIT catalog now has 176 study options: 52 Bachelor, 60 Master, 56 Doctorate, and 8 Professional. The graduate inventory is reconciled against 2026-27 MIT catalog and OGE program pages in `backend/data/drafts/mit/masters-candidates-2026-09-29.json` and `doctoral-candidates-2026-09-29.json`. The unsupported separate City Planning SM has been removed; Transportation is named MST and linked to its official application target. New grouped routes are linked only where an official target was verified. New route minimums that have not been reviewed return no UniChance percentage and are labelled as unreviewed, not absent.
- Verified master's and doctoral study descriptions now replace generic placeholders where source detail is available, with Russian copy for the program and route text. Program-specific eligibility now identifies the DEDP MicroMasters prerequisite, mid-career Sustainability SM, and MITILI Linguistics SM. The two EECS Engineer awards no longer imply an external application route: EECS only confirms the doctoral application. Twenty graduate/professional options still lack a verified direct application route, including internal-only and post-admission dual-degree options. Verify their application path before presenting one. Continue cycle-specific deadlines, academic/language requirements, costs, funding, post-offer terms, and transfer mapping. Catalog presence does not establish complete MIT coverage.

Complete the remaining inventory and integration after the Phase 0 journey review. Do not block the contrast-case UX check on collecting every MIT degree option, and do not mark the full MIT pilot complete merely because those cases pass.

### Canonical schema and contributor template

- [ ] Define a canonical, legacy-free data schema and a small contributor template based on real MIT cases. Keep the contract as small as the verified cases allow.
- [ ] Represent discovery subjects separately from study options and actual application targets. Include undergraduate majors or concentrations as study options when officially listed, and record when they are selected after institutional admission.
- [ ] Represent shared and course-specific application routes, applicant categories, fee status where relevant, entry cycle, and application windows without assuming every institution uses the same structure.
- [ ] Keep requirements, application process, decision/enrollment conditions, application and funding deadlines, costs, and funding as separately scoped facts.
- [ ] Preserve source URL/title, official publication status, review status, checked date, and cycle or effective period where applicable. Distinguish confirmed unpublished facts from uncollected or unverified facts.
- [ ] When a real official fact requires a schema field, add or consolidate the field in the canonical draft schema and document its scope with a representative example. Do not add speculative fields or a generic rule engine.
- [ ] Review the schema against MIT university-wide first-year and transfer admission, internal MEng, Sloan professional programs, and department-specific doctoral routes.

### Official MIT catalog inventory and fact drafts

- [ ] Inventory **all official degree-level study options** at MIT across undergraduate, master's, doctoral, and professional study. Include catalog-listed undergraduate majors as post-admission options when applicable; map each to its actual application target or explicitly unresolved classification.
- [x] Record MIT's official catalog page(s), snapshot/check date, inventoried categories, and excluded non-degree offerings so the completeness claim has a defined boundary.
- [ ] For each inventoried option, link its discovery subjects, level, actual application target, route, applicant categories, and relevant cycle/window where the official sources establish them.
- [ ] Research route-scoped requirements, process, deadlines, costs, and funding from official sources. Record unknowns and conflicts with a useful official next action; do not fill them by inference.
- [x] Keep the canonical MIT draft outside runtime data whenever the current application readers cannot safely consume its schema.

### MIT runtime and applicant experience

- [ ] Map accepted MIT fields to the backend loader, API, search/scoring, frontend, and any saved identifiers that depend on current records.
- [ ] Show every inventoried MIT degree option in the catalog; for unverified route or fact details, show an explicit unknown and the official next step.
- [ ] Keep first-year university-wide admission, transfer, internal MEng, Sloan applications, and department-specific doctoral applications distinct.
- [ ] Separate application requirements/deadlines, tuition and fees, living estimates, funding eligibility/coverage/deadlines, and published post-offer conditions.
- [x] Verify that undergraduate acceptance data never affects graduate or doctoral UniChance, and that missing applicant evidence does not become a verified probability.
- [ ] Verify guest browsing and manual route selection, profile-assisted narrowing, and desktop/mobile English/Russian journeys.
- [ ] Review the MIT UI/UX with the user and incorporate concrete feedback before treating it as the pattern for other universities.

### Phase 1 acceptance gate

- [ ] The canonical schema/template has been reviewed against real examples and contains no required legacy compatibility shape.
- [ ] MIT has a dated official catalog inventory covering the stated degree-level scope, with gaps and unresolved classifications explicitly listed.
- [ ] Every accepted MIT fact has official provenance and the appropriate scope/status; unknowns are explicit rather than silently omitted or converted to values.
- [ ] MIT's intended undergraduate majors are not presented as separate first-year admission targets; graduate paths use their own program or department rules.
- [ ] The integrated MIT app remains readable, scoped applicant journeys pass, and the user can review the resulting experience.

## Phase 2 — Imperial College London, Stanford, Harvard, and Oxford

- [ ] Inventory all official degree-level study options at Imperial College London. Distinguish integrated degrees from postgraduate routes by the official application process.
- [ ] Inventory all official degree-level study options at Stanford, including university-wide undergraduate admission and program-specific graduate targets.
- [ ] Inventory all official degree-level study options at Harvard, including professional programs and their application windows.
- [ ] Inventory all official degree-level study options at Oxford, including course-specific undergraduate and graduate paths.
- [ ] Record a dated official catalog snapshot, in-scope and excluded offerings, coverage gaps, and unresolved route classifications for each university.
- [ ] Extend the MIT template only for real cases it cannot express, then map accepted fields to backend/API/frontend/search/scoring and saved selections.
- [ ] Integrate reviewed university batches without switching active data before the relevant readers can parse it.
- [ ] Render subject discovery separately from actual study options and application targets. Show route, applicant context, cycle/window, and scoped facts where they help the applicant decide.
- [ ] Keep requirements, application deadlines, funding deadlines, tuition/fees, living estimates, and funding distinct in the applicant view. Expose official source and checked date for significant facts.
- [ ] Preserve explicit unknown, not-published, and needs-review states; never display missing facts as zero, ineligibility, guaranteed funding, or verified admission odds.
- [ ] Remove obsolete data paths/readers after each new runtime contract is established and no longer needs them. A permanent legacy compatibility reader is not a requirement.
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
