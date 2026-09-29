# Admissions-model migration runbook

## Purpose and scope

Read `AGENTS.md`, [the admissions product model](docs/admissions-product-model.md), and [the migration checklist](todo.md) before assigning work. `docs/admissions-product-model.md` holds the durable product contract and vision; `todo.md` is the issue ledger and progress checklist. Do not treat this runbook or a passing check as evidence that a catalog is complete.

The immediate goal is to connect the profile and existing admissions data to one selected applicant context, fix confirmed cross-context leakage, and validate the product against contrasting admissions systems before expanding catalog coverage. The context uses existing profile fields where available: study option/program, level, applicant route, intended entry cycle, country of education and credential, current residence, and self-reported fee-status context. Do not add a duplicate questionnaire. Citizenship, residence, or an unknown fee-status value does not establish Home/Overseas classification or aid applicability; preserve unknown when official rules and existing profile data do not establish applicability.

The delivery order is:

1. Connect existing profile fields to a single selected context that backend scoring, deadlines, costs/funding, and frontend sections all read consistently.
2. Fix evidenced leakage and selection restoration, including Stanford JD odds persisting after selecting undergraduate Computer Science, unrelated or zero-valued costs, Imperial Computing MEng inheriting shared faculty requirements, MIT cycle/deadline and applicant restrictions, and stale selections after navigation or context changes.
3. Define UniFit and UniChance semantics and the meaning of budget inputs and cost amounts before changing their ranking behavior.
4. Validate guest and profile journeys for MIT Course 6-3 first-year and transfer, Imperial Computing MEng through its course-specific UCAS application, and Stanford Computer Science through university-wide first-year and transfer routes. Have the user review the resulting UX before mass migration.
5. Keep MIT's complete all-level catalog inventory open; finish it after these contrasting cases are validated, then continue the remaining top-five institutions and the other 45 universities.

Do not block evaluation of the model on finishing MIT's full catalog first. Do not start mass migration before the representative journeys and user UX review. The current selected routes remain a starting point, not the completeness boundary. Keep incompatible draft data outside active runtime paths until their readers are ready.

For each study option and its real application path, keep facts specific to the relevant study level, applicant category, fee status, and admissions cycle. The product should help an applicant establish:

- whether the route and their qualification fit, including explicitly unknown eligibility details;
- the application portal, steps, documents, and dated or unpublished admissions and aid deadlines;
- applicable tuition and mandatory fees with currency, period, cycle, and Home/Overseas or other fee status;
- relevant funding, its eligibility and application process, separate deadline, coverage, and renewal conditions.

Use official university pages and university-hosted admissions documents. Preserve an honest unknown and an official next action when a fact is not published or cannot be confirmed. Do not infer a university-wide rule for a specific school, level, route, or applicant category.

## Start and checkpoint

1. Work in the existing checkout unless the coordinator explicitly transfers the required uncommitted and ignored state. Read `AGENTS.md`, `todo.md`, this runbook, `git status --short`, and the current diff before editing.
2. If `.tmp_test/evidence/` or `.tmp_test/orchestrator-state.md` exists in the current checkout, read the relevant checkpoint files. Reconcile them with the current tree and coordinator handoff before acting.
3. Keep source research and concise implementation evidence under `.tmp_test/evidence/`. Update `.tmp_test/orchestrator-state.md` after milestones with completed routes, changed files, evidence paths, exact check results, open questions, current shared-file owner, and next action. Do not use the state file as a transcript.
4. Do not carry temporary snapshot metadata or old test totals into durable guidance. Recalculate current state from the checkout and fresh check results.

## Coordination and ownership

- The coordinator owns scope, assignments, shared-file ownership, acceptance, integrated review, and the user-facing report. Delegate bounded research, implementation, and validation work to GPT-6 Luna workers at high reasoning effort when authorized and available.
- Keep assignments non-overlapping. Give each university a separate draft data owner where possible. Only one worker may edit a shared schema, template, or `backend/data/universities.json` at a time; make ownership and handoff explicit.
- Include the university, program or route IDs, applicant case, official-source requirement, owned and excluded files, focused checks, and report format in each assignment.
- Workers report changed files, the decision made, evidence path, exact commands and outcomes, and unresolved questions. The coordinator reviews each diff and evidence before accepting it.
- Preserve existing uncommitted work. Do not commit, push, tag, bump the version, or publish without explicit user authorization and the applicable `AGENTS.md` workflow.

## Data and product review

- Inventory the official degree-level study options for each top-five university. Distinguish options chosen after institutional admission from courses or programs that applicants apply to directly. Map each option to its real application target and applicant path; shared paths should remain shared.
- Treat the selected applicant context as one input to every relevant consumer. On program, level, applicant-route, or cycle changes, recompute or clear choices and estimates that no longer apply; restore a saved selection only when it still matches the current context. Do not let professional or graduate choices supply undergraduate scores, or one program supply another program's requirements or costs.
- Keep a course-specific application target distinct from its shared application system. Imperial's Computing MEng is an undergraduate-entry course applied to through UCAS; the UCAS portal or deadline can be shared while the course's own requirements and mandatory test remain specific to Computing.
- Keep Stanford undergraduate majors as study options under university-wide first-year and transfer routes. A selected major must not create a major-specific admissions probability, and first-year and transfer applicant contexts remain distinct.
- Apply the same context contract to MIT. Dates, windows, eligibility, and restrictions must follow the selected entry cycle and applicant route; deadline-specific applicant restrictions must survive projection, context changes, and saved-state restoration.
- Keep application deadlines separate from scholarship, aid, or studentship deadlines. Include date, time, and timezone when officially available; retain cycle and source provenance on scoped facts.
- Keep tuition, mandatory fees, living estimates, potential aid, and officially granted aid distinct. Never show an old amount as the current cycle or turn missing data into zero, ineligibility, or a guaranteed award.
- Specify the semantics of UniFit, UniChance, and budget-aware ranking before changing score formulas. Keep preference fit, evidence-supported admission estimates, gross costs, applicant budget, and aid as distinct signals; do not imply that an unsupported estimate is a verified probability or rank unlike cost periods and scopes as though they were comparable.
- During the data-first stage, keep the active runtime readable by storing breaking-schema work as drafts. During integration, review the full producer-to-applicant path: source data, backend projection/API, frontend rendering, localization, and saved identifiers or selections. The new canonical format does not need a permanent legacy reader.

## Verification and completion

- Run focused checks while implementing. For active `backend/data/` changes, run `npm run audit:data`; validate draft structure and official evidence directly when the runtime audit does not read the draft. Draft contributors need not run backend or UI tests for each new field; run those during integration. Check source URLs only for affected sources.
- During backend/frontend integration, exercise representative applicant journeys across institutional, course-specific, graduate, doctoral, and professional application targets, including relevant international qualification and funding cases. Wait for page readiness before browser interactions.
- The coordinator completes integrated checks after shared-file edits are finished, reviews the final diff and reports, and records any remaining limitation as an explicit unknown or follow-up.
- Before mass migration, the three representative journeys above must preserve the selected program, level, applicant route, cycle, applicability, and self-reported fee scope from profile or manual guest selection through API/scoring and every applicant-facing section. Unknown applicability remains visibly unknown.
- MIT's full catalog is a separate completion gate: every in-scope degree-level option needs an official inventory record, a correct application target or explicit unresolved classification, and scoped facts with sources or an honest unknown and next action. Apply the same evidence standard to each later institution. A passing audit or test suite alone does not prove factual completeness.
- User UX review of the representative journeys is required before mass migration. Do not claim that review or any browser verification occurred unless it was actually completed.

## New-task starter

> Work in the existing UniSearch checkout. Read `AGENTS.md`, `docs/admissions-product-model.md`, `todo.md`, `orchestrator.md`, the current Git status and diff, and any relevant `.tmp_test` checkpoints. First connect the existing profile fields to one selected context and fix confirmed context leakage. Define UniFit, UniChance, and budget-ranking semantics, then validate guest/profile journeys for MIT Course 6-3 first-year and transfer, Imperial Computing MEng UCAS, and Stanford Computer Science university-wide first-year and transfer. Ask the user to review this UX before mass migration. MIT's complete all-level inventory remains open and need not block those contrasting-case checks; finish it before calling MIT complete, then continue the other top-five universities and remaining 45. Keep shared-file ownership serial, use only official sources, preserve unknown applicability, and report evidence, changed files, exact checks, and unresolved facts. Preserve uncommitted changes. Do not perform Git release actions without explicit authorization.

## Orchestration references

- [OpenAI multi-agent guide](https://developers.openai.com/api/docs/guides/agents-api/multi-agent)
- [OpenAI orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI long-horizon Codex tasks](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)
- [OpenAI context compaction](https://developers.openai.com/api/docs/guides/compaction)
