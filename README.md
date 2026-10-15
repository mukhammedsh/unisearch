<h1 align="center">
  <a href="https://unisearch-frontend.onrender.com/">
    <img src="frontend/images/whitelogo-readme.svg" alt="UniSearch" width="360">
  </a>
</h1>

<p align="center">
  <a href="https://github.com/mukhammedsh/unisearch/actions/workflows/tests.yml"><img src="https://github.com/mukhammedsh/unisearch/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="https://app.codecov.io/github/mukhammedsh/unisearch"><img src="https://codecov.io/github/mukhammedsh/unisearch/graph/badge.svg" alt="Codecov"></a>
  <a href="https://www.bestpractices.dev/projects/14732"><img src="https://www.bestpractices.dev/projects/14732/badge" alt="OpenSSF Best Practices"></a>
  <a href="https://www.bestpractices.dev/projects/14732"><img src="https://www.bestpractices.dev/projects/14732/baseline" alt="OpenSSF Baseline"></a>
  <a href="https://securityscorecards.dev/viewer/?uri=github.com/mukhammedsh/unisearch"><img src="https://api.securityscorecards.dev/projects/github.com/mukhammedsh/unisearch/badge" alt="OpenSSF Scorecard"></a>
  <a href="package.json"><img src="https://img.shields.io/github/package-json/v/mukhammedsh/unisearch?filename=package.json" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
</p>

UniSearch is an open-source university discovery catalog for applicants. Browse without a profile, then optionally use your preferences to sort and compare universities. University pages bring study options, admissions requirements, costs, and funding information together with their official sources.

Facts can vary by program, applicant category, and entry cycle. UniSearch keeps those scopes visible where the source data supports them; catalog coverage varies by institution.

<p align="center">
  <a href="https://unisearch-frontend.onrender.com/"><strong>Open the live catalog →</strong></a>
  &nbsp; · &nbsp;
  <a href="#run-locally">Run locally</a>
  &nbsp; · &nbsp;
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

## Contents

- [Explore the catalog](#explore-the-catalog)
- [How to read estimates](#how-to-read-estimates)
- [Privacy and profile data](#privacy-and-profile-data)
- [Run locally](#run-locally)
- [Configuration and deployment](#configuration-and-deployment)
- [Project structure and API](#project-structure-and-api)
- [Checks and tests](#checks-and-tests)
- [University data contributions](#university-data-contributions)
- [Policies and license](#policies-and-license)

## Explore the catalog

- **Discover:** Search and filter universities by location, cost, and other preferences. Browse in a list or on a map, and sort with optional profile-based UniFit recommendations.
- **Compare:** Save universities and compare study options, requirements, costs, and funding information. Cost displays support multiple currencies.
- **Review admissions:** Read published study options and application paths, then select a program, applicant route, or entry cycle when those choices affect the facts shown.
- **Make it yours:** Choose English, Russian, or Kazakh, and use the system, light, or dark theme. University source material stays in its original language.
- **Learn the terms:** The [Guide](frontend/guide.html) explains admissions requirements, exams, UniFit, UniChance, and comparisons.

You do not need to complete a profile to browse the catalog or read university pages.

## How to read estimates

- **UniFit** sorts the catalog using profile preferences and available university data. Some factors are estimates; unknown costs and possible aid are not treated as zero cost or a guaranteed discount.
- **UniChance** shows the share of measurable, published academic and language minimums met for the selected admission path. Missing evidence or a path with no measurable minimums produces no score. It is not an admission probability or a funding prediction.
- **ROI** is a simplified ratio of annual graduate salary to annual study cost. It is not a degree payback period or a forecast of personal earnings. If major-specific salary data is unavailable, the estimate may use general university salary data.

Admission checks show the published requirement alongside available profile evidence. A missing value means UniSearch has no applicable catalog fact; it does not mean the university has no such program, requirement, deadline, cost, or funding option. Historical admitted-score ranges and acceptance rates are separate facts, not predictions.

## Privacy and profile data

Profiles, favorites, and saved choices are stored in your browser. Profile data is sent to the API when needed for personalized calculations. UniSearch currently has no account login or cross-device profile sync. Read the [Privacy Policy](frontend/privacy.html) for details.

## Run locally

The CI baseline is **Python 3.12** and **Node.js 20**. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) before installing the backend dependencies. Run commands from the repository root.

### 1. Install dependencies

Install Node dependencies:

    npm ci

Create and activate a Python virtual environment:

**Windows / PowerShell**

    py -3.12 -m venv backend/.venv
    .\backend\.venv\Scripts\Activate.ps1

**macOS / Linux**

    python3.12 -m venv backend/.venv
    source backend/.venv/bin/activate

Install the locked backend dependencies:

    uv pip install --require-hashes --only-binary=:all: -r backend/requirements.lock

### 2. Configure the backend

Copy the example environment file, then set local options in backend/.env. If that file already exists, keep your settings instead of replacing it.

**Windows / PowerShell**

    Copy-Item backend/.env.example backend/.env

**macOS / Linux**

    cp backend/.env.example backend/.env

Unless you run a separate LibreTranslate service, set **ML_INTEREST_TRANSLATION_ENABLED=0** in backend/.env. Semantic ranking downloads the intfloat/multilingual-e5-base model on first startup; for an offline setup, set **ML_SEMANTIC_EMBEDDINGS_ENABLED=0** to disable it.

### 3. Start the app

Start the backend in one terminal and the frontend in another:

    npm run dev:backend
    npm run dev:frontend

Open the [local catalog](http://127.0.0.1:5501/index.html). The API defaults to http://127.0.0.1:8000. Set DOCS_ENABLED=1 in backend/.env to enable API documentation at http://127.0.0.1:8000/docs.

The development scripts detect backend/.venv automatically. On Windows, the backend does not use automatic reload; restart it after changing Python code. Stop each server with Ctrl+C in its terminal.

## Configuration and deployment

Set backend options in backend/.env. Start with [backend/.env.example](backend/.env.example); defaults and supported settings are defined in [settings.py](backend/app/core/settings.py). Frontend API URLs come from the existing runtime configuration, not hard-coded page addresses.

Docker Compose starts the backend and Redis; serve the static frontend separately. See [deployment and API security](docs/deployment_security.md) for hosting, reverse-proxy, CORS, and secret-handling guidance. Redis is optional for a basic local setup.

## Project structure and API

| Path | Purpose |
| --- | --- |
| [frontend/](frontend/) | Vanilla JavaScript, HTML, CSS, and localized interface |
| [backend/app/](backend/app/) | FastAPI routes, Pydantic schemas, and application services |
| [backend/data/](backend/data/) | JSON catalog, admissions data, and university media |
| [scripts/](scripts/) and [backend/scripts/](backend/scripts/) | Development, validation, and data-maintenance tools |
| [tests/](tests/) and [backend/tests/](backend/tests/) | Frontend unit tests, Playwright scenarios, and backend tests |

Core API routes include:

- GET /universities and GET /universities/{id} for catalog and university details
- POST /universities/ai-sort for personalized ordering
- POST /universities/compare-profiles for comparison
- POST /universities/{id}/uni-chance and POST /universities/{id}/roi for estimates
- GET /currency/rates for currency conversion rates

Enable DOCS_ENABLED=1 locally to inspect request and response schemas at /docs. For architecture and admissions contracts, see [the architecture overview](docs/architecture.md), [the admissions product model](docs/admissions-product-model.md), and [the runtime API contract](docs/admissions-runtime-contract.md).

## Checks and tests

Run the quick repository checks from the root. Activate backend/.venv before running the data audit.

    npm run check:version
    npm run check:encoding
    npm run check:tokens
    npm run check:i18n
    npm run audit:data

For tests, install the development dependencies and the required Playwright browser:

    uv pip install --require-hashes --only-binary=:all: -r backend/requirements-dev.lock
    npx playwright install chromium

    npm run test:fast
    npm run test:backend -- test_name
    npm run test:unit -- filter
    npm run test:smoke
    npm run test:e2e:pr

The fast command runs frontend unit and backend tests. The smoke command adds the home-page browser check; the pull-request E2E command runs the Chromium browser suite. Install the full browser matrix with npx playwright install, then run npm run test:e2e:nightly. See [.github/workflows/](.github/workflows/) for CI jobs.

The pull-request E2E command uses API port 8000 and frontend port 5510. If an API is already running, it must allow CORS from http://127.0.0.1:5510.

## University data contributions

Verified university facts must come from official university websites, official admissions pages, or university-hosted documents. Keep facts tied to the relevant program, applicant category, and admissions cycle, and retain source links and verification dates. Missing data is better than an unsupported assumption.

Start with [the university data workflow](CONTRIBUTING.md#university-data-changes). After changing runtime data, run npm run audit:data; after changing media, run npm run audit:images. The [admissions snapshot guide](backend/data/admissions/README.md) explains how the accepted catalog data is prepared and maintained.

## Policies and license

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Governance](GOVERNANCE.md)
- [Security Policy](SECURITY.md)
- [Forking and reuse](docs/forking-and-reuse.md)
- [Privacy Policy](frontend/privacy.html)
- [Changelog](CHANGELOG.md)

The project source code is distributed under the [MIT License](LICENSE). University names, logos, and photographs belong to their respective owners and are not covered by the code license.
