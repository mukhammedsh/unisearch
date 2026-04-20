# Contributing to UniSearch

UniSearch is primarily a solo-maintained project. External contributions are welcome when they are small, focused, and easy to review, but the project does not assume a large community-maintainer workflow.

## Before You Start
- Check the nearest existing implementation before adding a new pattern.
- Keep changes narrow. Avoid mixing feature work, refactors, formatting churn, and data updates in one PR.
- Do not expand product scope without discussion. UniSearch currently targets bachelor-level university discovery.
- Do not add dependencies unless they solve a clear problem and fit an open-source project.

## Local Setup
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
pip install -r backend/requirements.txt
npm run dev:backend
npm run dev:frontend
```

## Frontend Changes
- Keep user-facing strings localized in both `frontend/Localization/eng` and `frontend/Localization/ru`.
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
- Use official university pages, official admissions pages, or official university-hosted PDFs/reports only.
- Do not use aggregators, marketing summaries, or inferred facts for verified fields.
- Prefer empty fields over invented data.
- Keep display names as full university names; put abbreviations only in hidden search aliases.
- After curated data updates, run:
  ```bash
  python backend/scripts/apply_official_facts.py --verified-at YYYY-MM-DD
  python backend/scripts/apply_official_admissions.py
  python backend/scripts/audit_universities_data.py
  python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
  ```

## Checks
Run the smallest relevant check before a PR:

```bash
npm run check:i18n
npm run test:backend
npm run test:e2e:pr
npm run test:all
```

Use `npm run test:all` for broad behavior changes.

## PR Expectations
- Describe what changed and why.
- List the checks you ran.
- Mention any checks you could not run.
- Keep screenshots or short notes for visible UI changes.
- Do not include secrets, local paths, personal IPs, `.env` files, cookies, logs, or generated dumps.
