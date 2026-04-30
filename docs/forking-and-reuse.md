# Forking and reuse

UniSearch is licensed under the MIT License. You may copy, modify, redistribute, sublicense, and use the project commercially, as long as the original license and copyright notice are preserved.

This guide is for people who want to run their own version of the project.

## Before publishing a fork

Replace project-specific settings and public identity:

- public domain names and frontend/backend URLs;
- contact email addresses;
- deployment platform settings;
- analytics, monitoring, or error-reporting DSNs;
- branding, copy, and public demo links;
- GitHub repository badges and workflow links;
- `OPS_ADMIN_TOKEN`, `.env`, cookies, logs, and any local-only values.

Do not commit real secrets. Use `backend/.env.example` for placeholders and keep local values in ignored `.env` files.

## Runtime configuration

Frontend API routing is controlled by generated runtime config, not hardcoded source edits.

For same-domain hosting behind a reverse proxy:

```env
UNISEARCH_API_BASE_URL=/api
```

For split frontend/backend hosting:

```env
UNISEARCH_API_BASE_URL=https://api.example.com
```

Then regenerate the frontend runtime file:

```bash
npm run build:frontend-env
```

Backend CORS must allow the public frontend origin:

```env
FRONTEND_ORIGINS=https://example.com
```

## Data policy

Upstream UniSearch accepts verified university facts only from official university pages, official admissions pages, or university-hosted PDFs. Forks may choose another policy, but should document it clearly so users can understand the reliability of the data.

For upstream-compatible data changes:

```bash
python backend/scripts/apply_official_facts.py --verified-at YYYY-MM-DD
python backend/scripts/apply_official_admissions.py
python backend/scripts/audit_universities_data.py
```

## Local verification

Run the baseline checks before publishing a fork or opening a PR:

```bash
npm run fix:encoding
npm run check:encoding
npm run check:version
npm run check:i18n
npm run test:backend
```

For visible frontend changes, also run the local frontend/backend servers and check the affected pages in light and dark themes.
