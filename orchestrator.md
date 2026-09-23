# Top-five university pilot: orchestration runbook

This runbook is for a new Codex task whose coordinator uses GPT-6 Sol at high reasoning effort and delegates bounded work to GPT-6 Luna at high reasoning effort. The product scope and completion gate live in `.tmp_test/todo.md`; repository rules live in `AGENTS.md`. Read those files instead of copying their contents into agent prompts.

## Start from the actual local state

1. Work in the same local checkout that contains this file and `.tmp_test/todo.md`. The todo file is Git-ignored, and the previous task left an uncommitted cleanup. A fresh worktree will not contain either uncommitted state or ignored files unless they are explicitly transferred.
2. Read `AGENTS.md`, `.tmp_test/todo.md`, `git status --short`, the current diff, and the latest commit. Reconcile the todo's historical counts and completed items with the working tree before editing. Preserve existing changes and do not redo completed work.
3. State the next concrete applicant-facing outcome and its verification before delegating. Work through the todo's stages; do not treat its counts as evidence of factual completeness.
4. Do not commit, push, tag, bump the version, or publish without the user's explicit authorization under `AGENTS.md`.

## Coordinator and subagent responsibilities

- The Sol coordinator owns scope, assignments, conflict prevention, acceptance decisions, and the user-facing report. It reviews evidence, diffs, and check summaries. It should not routinely edit product code or run tests itself; assign those operations to Luna workers so the coordinator's context stays small.
- Use two or three Luna High workers at a time for substantial tasks. The available concurrency limit may be lower; inspect it and keep a slot for the coordinator. The workers research, edit their assigned files, run focused tests, repair failures, and report results. Prefer adding a small lookup to an existing worker brief over creating another agent.
- Group a worker's university assignment across its current routes, costs, and funding so the same official pages are not researched repeatedly. Let one Luna worker own the shared `backend/data/universities.json` at a time, for one university or bounded batch. Other Luna workers can research upcoming universities into separate ignored evidence files or edit genuinely disjoint frontend/backend/test files. Hand over shared-file ownership explicitly before the next worker edits it.
- Give each worker a narrow brief: university and route IDs, expected applicant outcome, official-source rule, files it owns, files it must not edit, focused checks to run, and a completion format. Pass only the relevant todo section and file pointers, not the entire conversation. When the tool requires a model override, request `gpt-6-luna` with `high` reasoning and a short or empty history fork.
- Each Luna implementation worker writes the applicable code, data, tests, and a short ignored evidence file under `.tmp_test/evidence/`. The coordinator reviews the resulting shared-worktree diff and either accepts it or sends a concrete correction back to a Luna worker. Do not use parallel writers for the same file, and do not ask Sol to rewrite a worker's patch as the normal integration step.
- Ask workers to return only changed files, a short decision summary, their evidence-file path, exact checks and results, and unresolved questions. The evidence file should cover: route/program and applicant scope; confirmed requirement and documents; admission steps/deadline; cost with currency, year, and fee status; relevant award eligibility, application process, separate deadline, coverage, renewal; official URL; checked date; unresolved point and next action. Group rules shared by several undergraduate majors.
- Assign final unit/backend, data, static, and browser verification to Luna workers with nonconflicting ownership; the Sol coordinator checks the reports and inspects relevant failures or diffs. If a Luna worker is unavailable or hits a usage limit, continue with available workers and report any blocked work. Do not silently switch models or claim an unrun check passed.

## Context and token discipline

- Keep `.tmp_test/todo.md` as the task list and create a small ignored `.tmp_test/orchestrator-state.md` for live state. After each milestone, record only: completed todo IDs, changed files, source-evidence paths, checks with outcomes, open decisions, and the next action. This state file is a checkpoint, not a transcript.
- Read targeted files and bounded ranges; search with `rg` before opening large files. Avoid sending large JSON, complete command logs, or copied web pages into the coordinator's context. Keep full source detail in evidence files and return concise summaries with links and file references.
- Batch independent research and read-only checks. Serialize edits to shared files and approval-sensitive actions. Do not repeatedly ask multiple agents to investigate the same page or issue.
- Workers run focused tests while changing one route or subsystem and broader checks at the todo's final gate. They must not rerun a passed check without a relevant subsequent change or concrete failure. Record exact commands and outcomes in the state file; the coordinator reads the concise result, not the complete log unless a failure needs diagnosis.
- If context is compacted or the task continues later, re-read the short state file, the relevant todo section, `git status`, and affected diff. Do not reconstruct progress from the full chat history.

## Product and evidence gates

- Finish the current selected routes for MIT, Imperial College London, Stanford, Harvard, and Oxford. Do not expand to their full degree catalogs, add country-specific duplicate programs, add UI languages, or rewrite architecture without a demonstrated applicant case.
- Use only official university pages and university-hosted admissions PDFs for university facts. Recheck dynamic dates, fees, and policies for the applicable cycle. Preserve exact program, level, applicant category, citizenship/residence or fee-status conditions, and source provenance.
- A missing fact is an explicit unknown with an official next action. A potential award is never a confirmed award or a net-price discount. A university-wide undergraduate policy must not become a graduate-program fact.
- For each meaningful route, verify the three applicant questions from the todo: eligibility; steps, documents, and separate deadlines; applicable costs and aid. Then verify that profile, program detail, finance, coverage, and application plan agree.
- The Sol coordinator reviews every integrated diff. Luna workers run the checks required by `AGENTS.md` and exercise representative browser journeys across all five universities and study levels. Mark a todo item complete only after its evidence and behavior are checked. Report unresolved facts honestly rather than claiming the five universities are complete based on data counts or passing tests alone.

## Starter prompt for a new local task

> Work in the existing local UniSearch checkout that contains `orchestrator.md` and `.tmp_test/todo.md`. Act as the GPT-6 Sol High coordinator. Read `AGENTS.md`, `orchestrator.md`, the todo, Git status, and the current diff before editing. Use GPT-6 Luna High subagents as the workers: assign them bounded university research, code and data edits, tests, repairs, and final browser verification. Keep your own work to task assignment, conflict management, diff/evidence review, acceptance, and a concise Russian report; do not routinely edit product files or run tests yourself. Only one Luna worker may edit the shared university JSON at a time. Keep full official-source evidence in separate ignored files and a concise checkpoint in `.tmp_test/orchestrator-state.md`. Execute the todo through its completion gate and preserve honest unknowns. Preserve all existing uncommitted changes. Do not commit, push, tag, bump the version, or publish without my explicit authorization.

## Sources for the orchestration approach

- [OpenAI: Multi-agent](https://developers.openai.com/api/docs/guides/agents-api/multi-agent) — independent bounded tasks, separate agent contexts, and coordination for shared files.
- [OpenAI: Orchestration and handoffs](https://developers.openai.com/api/docs/guides/agents/orchestration) — manager ownership and adding specialists only when they help.
- [OpenAI: Run long horizon tasks with Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) — durable specification, milestone checkpoints, validation, and externalized progress.
- [OpenAI: Compaction](https://developers.openai.com/api/docs/guides/compaction) — why long conversations need a compact state; the project checkpoint above is a human-readable complement, not an API configuration instruction.
