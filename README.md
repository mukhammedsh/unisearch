# UniSearch

[![Tests](https://github.com/mukhammedsh/unisearch/actions/workflows/tests.yml/badge.svg)](https://github.com/mukhammedsh/unisearch/actions/workflows/tests.yml)
[![Codecov](https://codecov.io/github/mukhammedsh/unisearch/graph/badge.svg)](https://app.codecov.io/github/mukhammedsh/unisearch)
[![SonarCloud Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=mukhammedsh_unisearch&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=mukhammedsh_unisearch)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/14732/badge)](https://www.bestpractices.dev/projects/14732)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/mukhammedsh/unisearch/badge)](https://securityscorecards.dev/viewer/?uri=github.com/mukhammedsh/unisearch)
[![Version](https://img.shields.io/github/package-json/v/mukhammedsh/unisearch?filename=package.json)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

UniSearch helps applicants discover and compare universities across study levels, exploring programs, admissions requirements, costs, and funding options based on their profile. Coverage varies by university and program; time-sensitive facts include official sources and verification dates.

[Open the website](https://unisearch-frontend.onrender.com/) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

## Features

- **Catalog on the homepage:** search, location and cost filters, sorting, favorites, and list or clustered map views with progressively loaded map results.
- **Applicant profile:** GPA and grading scale, exams, languages, budget, optional annual family income, intended major, interests, study mode, funding preferences, education background, study level, entry cycle, and multiple citizenships selected from a searchable country list. Family income is stored on the device and used only to show context against published aid thresholds.
- **UniFit:** personalized catalog sorting based on the profile and preference sliders, with explanatory tags, including a clear program-not-offered warning when a catalog alternative does not match the intended major. It is a sorting mode within the catalog.
- **University comparison:** select universities and admission options to compare requirements, finances, and personalized estimates.
- **Application plan:** organize a selected admission route with its requirements, deadlines, documents, and funding next steps.
- **University details:** programs with search, collapsed detail accordions, and profile-major highlighting, plus admission options, requirements, costs, funding, and student life information where data is available. Selected routes at MIT, Imperial College London, Stanford, Harvard, and Oxford have expanded program-level coverage; this is a pilot, not a complete catalog of each university. The deadlines tab includes a month calendar for exact dated events; approximate and yearless deadlines remain in the timeline and list.
- **UniChance:** admission estimates for individual admission options using the applicant's profile and available admissions data.
- **ROI:** an approximate ratio of annual graduate salary to annual study cost, using major-specific data where available.
- **Guide:** a structured reference explaining admission requirements, exams, UniFit, UniChance, and comparison workflows, with section-to-section navigation.

The interface supports English and Russian, multi-currency conversion (60+ currencies), and system, light, and dark themes. Profiles and favorites are stored in the browser; account login and cross-device synchronization are not currently available. Profile data is sent to the API for personalized calculations.

### Understanding the estimates

UniFit measures preference fit and may use the profile budget when ranking options. UniChance estimates admission chances independently of the budget and grant preferences. It uses admitted-student score statistics (`score_profile`) when available; otherwise, it may return a low-confidence estimate or a no-data state. These calculations do not guarantee admission.

Published family-income thresholds are policy context only. A profile income comparison does not determine financial-aid eligibility or an award amount. Funding details describe published conditions and application steps; they do not guarantee an award, and possible aid is not deducted from displayed costs.

ROI is a simplified ratio, not the payback period for an entire degree or a forecast of personal earnings. If salary data for the chosen major is missing, the calculation may use general university salary data.

Verified facts and requirements come from official sources. Catalog coverage is incomplete: missing values are preferred over invented facts. Some UniFit factors use proxy estimates and should not be treated as verified university statistics.

University detail pages include a study-level data coverage summary for programs, admission requirements, deadline precision, costs, and aid. “Not catalogued” means UniSearch has no matching data listed; it does not indicate whether the university offers that program or policy. Coverage describes catalog presence and does not itself verify a fact.

## Run locally

The CI baseline is **Python 3.12 and Node.js 20**. Run the commands below from the repository root.

1. Install Node dependencies and create a Python environment:

   ```sh
   npm ci
   python -m venv backend/.venv
   ```

2. Copy the configuration and activate the environment.

   **Windows / PowerShell:**

   ```powershell
   Copy-Item backend/.env.example backend/.env
   .\backend\.venv\Scripts\Activate.ps1
   ```

   **macOS / Linux:**

   ```sh
   cp backend/.env.example backend/.env
   source backend/.venv/bin/activate
   ```

   If `backend/.env` already exists, keep your settings instead of copying over it.

3. Install backend dependencies:

   ```sh
   python -m pip install --require-hashes --only-binary=:all: -r backend/requirements.lock
   ```

4. In `backend/.env`, disable interest translation unless you run a separate LibreTranslate service:

   ```env
   ML_INTEREST_TRANSLATION_ENABLED=0
   ```

   Semantic ranking uses `intfloat/multilingual-e5-base` by default; the first startup may download the model. To run without downloading it, add `ML_SEMANTIC_EMBEDDINGS_ENABLED=0` (ML scoring will report `unavailable` mode). Redis is optional for a basic local setup.

5. Start the backend:

   ```sh
   npm run dev:backend
   ```

6. In a second terminal, start the frontend from the repository root:

   ```sh
   npm run dev:frontend
   ```

Open the [catalog](http://127.0.0.1:5501/index.html). The backend defaults to `http://127.0.0.1:8000`; check its status at [health](http://127.0.0.1:8000/health).

The development scripts automatically detect `backend/.venv`. The frontend script regenerates `frontend/env.js` and starts a server supporting routes such as `/profile`, `/guide`, `/about`, and `/universities/:id`. On Windows, the backend runs without automatic reload: restart it after changing Python code. Stop each server with `Ctrl+C` in its terminal.

## Configuration and hosting

Set local options in `backend/.env`. Start with [backend/.env.example](backend/.env.example); the full set of backend settings and defaults is in [settings.py](backend/app/core/settings.py).

| Setting | Purpose |
| --- | --- |
| `BACKEND_HOST`, `BACKEND_PORT` | API bind address and port; defaults to `127.0.0.1:8000` |
| `FRONTEND_HOST`, `FRONTEND_PORT` | Local frontend bind address and port; defaults to `127.0.0.1:5501` |
| `FRONTEND_ORIGINS` | Allowed **frontend** origins for CORS, separated by commas |
| `UNISEARCH_API_BASE_URL` | Frontend API address: a separate domain or `/api` behind a reverse proxy |
| `UNISEARCH_API_PORT` | API port for same-host requests; falls back to `BACKEND_PORT` |
| `UNISEARCH_USE_PRETTY_URLS` | Enables routes without `.html`; the server must support the corresponding rewrites |
| `DOCS_ENABLED` | Set to `1` to enable `/docs`, `/redoc`, and `/openapi.json`; disabled in the example `.env` |

When `UNISEARCH_API_BASE_URL` is empty, the frontend uses the same hostname as the page for API requests. After changing frontend settings, restart `dev:frontend` or run `npm run build:frontend-env`. The runtime version comes from `package.json`.

Hosting requires a static frontend and a FastAPI backend. Docker Compose starts the backend and Redis; run the frontend separately:

```sh
docker compose --env-file backend/.env up --build
# Stop the containers:
docker compose --env-file backend/.env down
```

See [deployment and API security](docs/deployment_security.md) and [forking and reuse](docs/forking-and-reuse.md). Keep local `.env` files out of Git and secrets out of the public `frontend/env.js` file.

## Project structure

| Path | Contents |
| --- | --- |
| `frontend/` | HTML, CSS, and Vanilla JS without a UI framework |
| `frontend/Localization/` | English and Russian interface strings |
| `backend/app/routers/`, `backend/app/schemas/` | FastAPI routes and Pydantic contracts |
| `backend/app/services/` | Catalog, search, UniFit, UniChance, ROI, and ML ranking |
| `backend/data/` | JSON catalogs and official data; media in `university_assets/` |
| `scripts/`, `backend/scripts/` | Development, verification, and data maintenance scripts |
| `tests/unit/`, `tests/e2e/`, `backend/tests/` | JS unit tests, Playwright E2E, and Python unittest |

Main endpoints: `GET /universities`, `GET /universities/{id}`, `GET /currency/rates`, `POST /universities/ai-sort`, `POST /universities/compare-profiles`, `POST /universities/{id}/uni-chance`, and `POST /universities/{id}/roi`. Full request schemas are available at `/docs` when `DOCS_ENABLED` is enabled.

Update verified facts in `backend/data/official_facts.json` and `backend/data/official_admissions.json`, then use the sync scripts to update `universities.json`. Follow the [data contribution workflow](CONTRIBUTING.md#university-data-changes). Run `npm run audit:data` after data changes and `npm run audit:images` after media changes.

## Checks and tests

Quick repository checks (activate the Python environment for `audit:data`):

```sh
npm run check:version
npm run check:encoding
npm run check:tokens
npm run check:i18n
npm run audit:data
```

For tests, install the additional dependencies in the active Python environment and the Playwright browser:

```sh
python -m pip install --require-hashes --only-binary=:all: -r backend/requirements-dev.lock
npx playwright install chromium
npm run test:fast               # fast combined unit + backend tests
npm run test:backend            # all backend tests (or: npm run test:backend -- <test_name>)
npm run test:unit               # all unit tests (or: npm run test:unit -- <filter>)
npm run test:unit:coverage      # unit tests plus an LCOV report for Codecov
npm run test:smoke              # unit tests + home smoke E2E
npm run test:e2e:pr             # Playwright E2E suite
```

`test:e2e:pr` starts the API on port `8000` and a test frontend on `5510`. If an API is already running, it must allow CORS for `http://127.0.0.1:5510`. `npm run test:all` combines version, encoding, token, and design-lint checks with the three test suites; run i18n and data audits separately.

For the full browser matrix, install Chromium, Firefox, and WebKit with `npx playwright install`, then run `npm run test:e2e:nightly`. Automated checks are configured in [.github/workflows/](.github/workflows/).

Architecture: [docs/architecture.md](docs/architecture.md). Roadmap: [docs/roadmap.md](docs/roadmap.md). Governance: [GOVERNANCE.md](GOVERNANCE.md). Security baseline tracking: [docs/security-baseline.md](docs/security-baseline.md). Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Interface rules: [design system](docs/design-system.md). Version history: [CHANGELOG.md](CHANGELOG.md).

Source code is distributed under the [MIT License](LICENSE). University logos, names, and photographs belong to their respective owners and are not covered by the code license; see `LICENSE` for details.
