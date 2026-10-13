# Contributing to UniSearch

UniSearch is primarily a maintainer-led project with community contributions. External contributions are welcome when they are small, focused, and easy to review. For decision-making procedures, contributor roles, and project sustainability, see [GOVERNANCE.md](GOVERNANCE.md). All participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start
- Check the nearest existing implementation before adding a new pattern.
- Keep changes narrow. Avoid mixing feature work, refactors, formatting churn, and data updates in one PR.
- Follow the [admissions product model](docs/admissions-product-model.md): cover undergraduate, master's, doctoral, and professional study, and keep facts scoped to the relevant program and applicant route.
- Do not add dependencies unless they solve a clear problem and fit an open-source project.

## Local Setup
Install [uv](https://docs.astral.sh/uv/getting-started/installation/) before setting up the Python environment.

```bash
npm install
cp backend/.env.example backend/.env
cd backend
python -m venv .venv
cd ..
```

PowerShell activation:
```powershell
.\backend\.venv\Scripts\Activate.ps1
```

macOS/Linux activation:
```bash
source backend/.venv/bin/activate
```

Then install backend dependencies and start both servers:
```bash
uv pip install --require-hashes --only-binary=:all: -r backend/requirements.lock
npm run dev:backend
npm run dev:frontend
```

## Frontend Changes
- Keep user-facing strings localized in `frontend/Localization/eng`, `frontend/Localization/ru` and `frontend/Localization/kaz`.
- Keep light and dark themes working.
- Use Heroicons through `frontend/javascript/icons.js`.
- Do not hardcode backend URLs; use the existing runtime config flow through `frontend/env.js` and `frontend/config.js`.
- Preserve keyboard-friendly behavior and accessible labels for interactive controls.

## Backend and API Changes
- Keep API contracts explicit in `backend/app/schemas/`.
- Update frontend callers when an API contract changes.
- Add or update focused backend tests for changed behavior.
- Do not expose raw technical errors to users through frontend flows.

## University Data Changes
- Follow the stages in [todo.md](todo.md): research durable drafts, integrate the accepted delivery batch, then verify its applicant UI/UX. MIT, Imperial College London and Stanford University are the current activated batch. Oxford, Harvard and Cambridge drafts remain paused and inactive; later institutions follow the same evidence standard. Model each institution's own structure and retain sourced exceptions even when the current runtime cannot express them.
- Use official university pages, official admissions pages, or official university-hosted PDFs/reports only.
- Do not use aggregators, marketing summaries, or inferred facts for verified fields.
- Prefer empty fields over invented data.
- Keep display names as full university names; put abbreviations only in hidden search aliases.
- During draft collection, validate draft structure, relationships, coverage, and affected official sources directly. The runtime audit does not prove completeness or validate drafts it does not read. Do not apply drafts through the runtime synchronization scripts before Stage 2 integration.
- For common institution facts and the retained admissions contract of the other 47, the synchronization commands are:
  ```bash
  python backend/scripts/apply_official_facts.py --verified-at YYYY-MM-DD
  python backend/scripts/apply_official_admissions.py
  npm run audit:data
  python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
  ```
- Rows with `admissions_catalog_id` are owned by the activated admissions snapshot. Legacy synchronization must not recreate their program, category, academic acceptance-rate or finance policy fields. Maintain reviewed study/admissions facts through [snapshot preparation and activation](backend/data/admissions/README.md), preserve source periods and conditions, and rerun the affected assessment mappings when source content changes. The [retired history](backend/data/history/README.md) is not a runtime input.

## Checks
Run the smallest relevant check before a PR:

```bash
npm run fix:encoding
npm run check:encoding
npm run check:i18n
npm run audit:data
npm run test:backend
npm run test:e2e:pr
npm run test:all
```

Use `npm run test:all` for broad behavior changes.

For visible UI changes, include screenshots or notes for the relevant desktop and mobile widths, and mention whether light and dark themes were checked.

## PR Expectations
- Describe what changed and why.
- List the checks you ran.
- Mention any checks you could not run.
- Keep screenshots or short notes for visible UI changes.
- Do not include secrets, local paths, personal IPs, `.env` files, cookies, logs, or generated dumps.
