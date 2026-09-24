# Admissions-model migration runbook

## Purpose and scope

Read `AGENTS.md`, [the admissions product model](docs/admissions-product-model.md), and [the migration checklist](todo.md) before assigning work. The current delivery order is: define the canonical schema and inventory all degree-level study options at MIT, Imperial College London, Stanford, Harvard, and Oxford; then integrate the backend and frontend; then migrate and update the other 45 universities. The existing selected routes are a starting point, not the completeness boundary. Keep incompatible draft data outside the active runtime catalog until the application can read the new schema.

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

- The coordinator owns scope, assignments, shared-file ownership, acceptance, integrated review, and the user-facing report. Delegate bounded research, implementation, and validation work to GPT-6 Luna workers at high reasoning effort when requested and available.
- Keep assignments non-overlapping. Give each university a separate draft data owner where possible. Only one worker may edit a shared schema, template, or `backend/data/universities.json` at a time; make ownership and handoff explicit.
- Include the university, program or route IDs, applicant case, official-source requirement, owned and excluded files, focused checks, and report format in each assignment.
- Workers report changed files, the decision made, evidence path, exact commands and outcomes, and unresolved questions. The coordinator reviews each diff and evidence before accepting it.
- Preserve existing uncommitted work. Do not commit, push, tag, bump the version, or publish without explicit user authorization and the applicable `AGENTS.md` workflow.

## Data and product review

- Inventory the official degree-level study options for each top-five university. Distinguish options chosen after institutional admission from courses or programs that applicants apply to directly. Map each option to its real application target and applicant path; shared paths should remain shared.
- Keep application deadlines separate from scholarship, aid, or studentship deadlines. Include date, time, and timezone when officially available; retain cycle and source provenance on scoped facts.
- Keep tuition, mandatory fees, living estimates, potential aid, and officially granted aid distinct. Never show an old amount as the current cycle or turn missing data into zero, ineligibility, or a guaranteed award.
- During the data-first stage, keep the active runtime readable by storing breaking-schema work as drafts. During integration, review the full producer-to-applicant path: source data, backend projection/API, frontend rendering, localization, and saved identifiers or selections. The new canonical format does not need a permanent legacy reader.

## Verification and completion

- Run focused checks while implementing. For active `backend/data/` changes, run `npm run audit:data`; validate draft structure and official evidence directly when the runtime audit does not read the draft. Draft contributors need not run backend or UI tests for each new field; run those during integration. Check source URLs only for affected sources.
- During backend/frontend integration, exercise representative applicant journeys across institutional, course-specific, graduate, doctoral, and professional application targets, including relevant international qualification and funding cases. Wait for page readiness before browser interactions.
- The coordinator completes integrated checks after shared-file edits are finished, reviews the final diff and reports, and records any remaining limitation as an explicit unknown or follow-up.
- The top-five data stage is complete only when an official catalog inventory accounts for all in-scope study options at each university, each option has the correct application target or an explicit unresolved classification, and scoped facts have official evidence or a clear unknown and next action. Backend/frontend integration has its own later gate in the product model. A passing audit or test suite alone does not prove factual completeness.

## New-task starter

> Work in the existing UniSearch checkout. Read `AGENTS.md`, `docs/admissions-product-model.md`, `todo.md`, `orchestrator.md`, the current Git status and diff, and any relevant `.tmp_test` checkpoints. Coordinate bounded GPT-6 Luna High assignments. Complete the canonical top-five catalog and data first, integrate backend/frontend second, and migrate the other 45 universities last. Keep shared-file ownership serial and explicit, use only official university sources, retain applicant/program/cycle scope, and report evidence, changed files, exact checks, and unresolved facts. Preserve uncommitted changes. Do not perform Git release actions without my explicit authorization.

## Orchestration references

- [OpenAI multi-agent guide](https://developers.openai.com/api/docs/guides/agents-api/multi-agent)
- [OpenAI orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration)
- [OpenAI long-horizon Codex tasks](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)
- [OpenAI context compaction](https://developers.openai.com/api/docs/guides/compaction)
