# Admissions data and integration runbook

## Contract and stage boundaries

Read `AGENTS.md`, [the admissions product model](docs/admissions-product-model.md), [todo.md](todo.md), and the current Git status/diff before work. The model defines product meaning; the checklist defines active tasks and acceptance. Historical checkpoints are reusable evidence, not a reason to repeat implementation or a claim that new drafts are complete.

The delivery order is:

1. **Stage 1: data and schema for all 50.** Task **1.1 MIT** completes MIT research and a coherent draft representation. Task **1.2 other 49** researches each institution independently, adapting structure and shared conventions to verified differences. MIT is the quality example, not the institutional template. No backend/frontend integration or browser/user UX approval is required here.
2. **Stage 2: integration.** After all 50 datasets pass data review, update storage readers, API, profile/exams, scoring, and frontend together. Activate all 50 in the new format after consumers are ready, then remove old readers. Permanent compatibility with unused early-development formats is not required.
3. **Stage 3: UI/UX.** Refine and exercise the connected applicant journey on desktop/mobile, English/Russian, light/dark, including applicable conditions, missing evidence, official sources, and uncertainty. Incorporate concrete user feedback.

Stop after the assigned task's handoff. Completing 1.1 is not authorization to start 1.2 or integration. Do not impose the former journey-first or user-review-before-collection gates.

## Starting task 1.1 MIT

- Inspect existing MIT work before collecting it again: `backend/data/drafts/mit/` contains `catalog.json`, `schema.json`, `template.json`, master's/doctoral candidates, and study-description drafts. Compare these with current runtime MIT facts, provenance, translations, and the dated checkpoints in `todo.md`. Reuse reviewed facts; investigate real gaps or stale/conflicting sources.
- Record a dated official degree-level catalog snapshot and its scope. Cover undergraduate, master's, doctoral, and professional offerings wherever present; distinguish internal/combined awards, post-admission majors, and directly applied-to programs. Do not invent a separate application because a degree exists.
- Organize significant applicant-relevant facts: university information, study content/structure, application destinations, eligibility/qualifications, tests and alternatives, exemptions, documents/process, windows/deadlines, costs, funding, and published decision/enrollment conditions. Keep shared rules once where officially shared and link their actual scope.
- For every important fact, record official source/title, checked date, publication/review status, affected option/route/applicant/cycle, and conditions/exceptions. Add or reorganize draft fields when the source requires it. Current backend support and implementation difficulty must not cause data loss.
- Design how facts answer applicant questions alongside collection; review concrete draft examples for linked programs and applications. Do not implement application readers, API fields, scoring, or UI for each newly collected fact.
- Keep authoritative drafts and research/coverage notes under `backend/data/drafts/<institution_id>/`, starting with the existing MIT files. Use relative paths and the real existing institution identifier where applicable. Document shared storage conventions and institution-specific differences with the draft. Temporary browser captures/test logs may live under `.tmp_test`, but significant research must not exist only there.
- Keep drafts out of active `universities.json`, official runtime sync inputs, and their sync scripts until Stage 2. Do not modify backend/frontend behavior in 1.1. Lightweight draft validation is allowed; reuse existing validation tooling rather than building an ingestion platform.
- Completion requires a reconciled inventory, consistent IDs/references, sourced and scoped fact groups, a usable example/schema, and a coverage report separating unfinished collection from researched unknowns/conflicts. Record official next steps for unresolved facts. An unsearched group cannot be closed as unpublished; unavailable future-cycle facts do not require endless waiting or unsolicited messages to admissions offices.

## Task 1.2 and shared ownership

Apply the same quality standard to the other 49 institutions, not the same academic/admissions layout. Imperial College London, Stanford, Harvard, and Oxford may form the first batch, followed by the remaining 45, all within Stage 1. Track each institution's draft path, catalog snapshot, coverage, distinctive structures, and evidence-backed gaps in the checklist or linked durable draft coverage notes. Preserve significant exceptions throughout schema reconciliation.

When parallel agent work is authorized, assign separate institution/draft owners and use GPT-6 Luna with high reasoning for bounded tasks if requested. Keep shared-schema edits serial. Assign owned/excluded files, official-source rules, completion criteria, and focused checks. Do not spawn workers merely because slots are available.

Preserve all existing uncommitted work. New shared conventions must express real common concepts; institution-specific structures remain documented. Avoid 50 unrelated undocumented formats, a forced MIT layout, a speculative rule engine, or a permanent old/new reader pair. Track implementation needs for Stage 2 without implementing them during collection.

## Integration and verification

- Stage 1: validate each draft's structure, IDs, references, scope/status, inventory coverage, and affected official URLs. Run the required data audit after draft changes, but distinguish what it actually checks from direct draft review. Do not run backend/UI suites for every researched field.
- Stage 2: trace every accepted field from data through loaders, API, profile evidence, assessment/ranking, and frontend. Reuse working code and extend tests for actual new contracts. Support required exams throughout input, validation, persistence, API, assessment, and explanations. Difficult rules remain visible with an explicit unresolved assessment when evidence is insufficient; never silently fail an applicant.
- Keep program, target, route, level, applicant category, and cycle consistent across selection, requirements, dates, finance, and recommendations. Reuse profile inputs; residence/citizenship alone cannot establish legal residency, fee status, qualification recognition, or aid eligibility. Show the condition that affected each result and missing evidence.
- Stage 2 verifies MIT first-year/transfer/internal MEng/professional/doctoral, Imperial Computing UCAS, Stanford CS institutional first-year/transfer, and additional structures found in the other 45. Switch all 50 runtime datasets after consumers are ready; deliberately migrate or visibly reset affected retained selections instead of misreading old state.
- Stage 3 verifies real guest/populated/incomplete-profile flows, context changes, reload/back, sources and exceptions, localization, desktop/mobile, and both themes. Wait for page readiness before browser interactions. Apply the existing design system and loading/empty/error contracts. User review belongs here.
- Follow focused checks and completion checks in `AGENTS.md`. Reopen completed work only for concrete new evidence or a reproduced failure; no repeated passed checks without relevant changes. Report exact results, factual unknowns, unfinished work, and next task. No commit, push, version bump, tag, or release without explicit authorization.

## Time target and handoff

Target one week for the complete three-stage effort; this is a planning budget, not a verified duration. Use the provisional milestones in `todo.md`. After 1.1, estimate the remaining collection from actual coverage and pace. If the target is at risk, report the specific remaining scope and estimate instead of silently dropping exceptions, declaring unsearched facts unavailable, or expanding unrelated work.

Each handoff states the completed task, draft/contract paths, coverage and meaningful gaps, checks actually performed, and the next bounded task. Update `todo.md` from evidence; old test totals do not establish new-stage acceptance.

## New-chat starter: task 1.1 MIT only

> Complete task 1.1 MIT from todo.md in the existing UniSearch checkout. First read AGENTS.md, docs/admissions-product-model.md, todo.md, orchestrator.md, Git status/diff, and the existing MIT drafts and runtime facts. Reuse verified work. Research official university sources and complete MIT's dated degree-level inventory and applicant-relevant information, including all significant conditions and exceptions. Revise the MIT draft schema/example and organize scoped facts with provenance, status, cycle, and evidenced unknowns. MIT is a quality example, not a structure to force onto other universities. Keep authoritative research in durable draft files outside the active runtime. Do not implement backend/frontend support, activate new runtime data, start the other 49 institutions, or perform Git release actions. Validate drafts and affected sources, update todo.md, and finish with a coverage/checks/gaps report and a handoff for task 1.2.
