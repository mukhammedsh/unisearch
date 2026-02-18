# UniSearch / UniFit / UniChance - v2.5.0

## What this project is
UniSearch is a full-stack web app for university selection using:
- structured university data,
- profile-based filtering,
- `UniFit` ranking with 4 trade-off sliders:
  - Focus: `Career & Practice` <-> `Science & Research`
  - Atmosphere: `Social & Events` <-> `Hardcore Study`
  - Finance: `Budget & Grants` <-> `Prestige & Comfort`
  - Location: `Big City Life` <-> `Cozy Campus`
- `UniChance` probability (0-100 estimated admission chance).

## What's new in v2.5.0
- profile save flow was unified and stabilized:
  - one global `Save Profile` action for core profile fields
  - pressing `Enter` in profile input flow now saves consistently
  - username edits are persisted together with profile changes (regression fixed)
  - unsaved-changes close modal is active (`Close without saving`, `Cancel`, `Save and close`)
- profile persistence is more resilient:
  - if `localStorage` is blocked/unavailable, profile and filters keep working via in-memory fallback
- mobile/tablet UX pass completed for key pages (including `university.html`):
  - reduced horizontal overflow on 390px and 820px viewports
  - responsive improvements for university detail layout, tabs, and finance/ROI blocks
- routing and deploy stability upgrades:
  - clean URL routes for deployed frontend (`/`, `/universities`, `/universities/:id`, `/ranking`, `/guide`, `/about`)
  - backward compatibility kept for `.html` routes, `/index`, and `university.html?id=...`
  - runtime frontend config moved to deploy-time `frontend/env.js` (no hardcoded host domain)
  - root `<base href="/">` added on pages to prevent blank detail page on nested routes
- QA coverage increased with new Playwright checks:
  - `tests/e2e/mobile-tablet-overflow.spec.js`
  - `tests/e2e/profile-enter-save.spec.js`
  - `tests/e2e/profile-storage-fallback.spec.js`

## Planned
- Split backend architecture into microservices.
- Migrate data storage to PostgreSQL.
- Add Google-based authentication.
- Build a mobile frontend application.
- Improve and expand university data quality/coverage.
- Add per-aspect university rating with 5-star UI and half-star support (0 to 10 scale).
- Enforce one rating per university per account (user can update their rating later).
- Buy and configure a custom production domain.
- Add overall university reviews with star score + text review.
- Add university gallery (photos/media).

### UniFit ranking logic (current)
- `Finance` slider is a mode switch for admission probability:
  - left side (`Budget & Grants`) uses `GrantChance`
  - right side (`Prestige & Comfort`) uses `GeneralChance`
- `PreferenceMismatch` is calculated from Focus + Atmosphere + Location.
- `AdmissionRisk = 1 - SelectedChance`.
- Final ranking score:
  - `FinalScore = 0.6 * PreferenceMismatch + 0.4 * AdmissionRisk`
  - lower score means better rank.
- Missing exam data is treated as **conditional** (not auto-fail): ranking/chance use available evidence and keep such options visible.
- University card badges explain recommendation reasons with strict priority:
  - `Conditional / Exam Needed`
  - `Your Vibe` / `Top Match`
  - `Likely Grant` / `Paid Admission`
- Backend includes `matchData.uiBadgeHints` so card tag rendering stays deterministic across clients.

## Core architecture
- Frontend: Vanilla JS + HTML/CSS (`frontend/`)
- Backend: FastAPI (`backend/app/`) - **monolithic backend** (modular monolith, not microservices)
- Data: JSON datasets (`backend/data/*.json`)

## University Factor Data Provenance
UniFit slider factors in `backend/data/universities.json` are generated from traceable data, not manual estimates.

Current factor refresh pipeline:
- `OpenAlex Institutions API`:
  - `works_count`, `cited_by_count`, `h_index` -> research signal.
- `Open-Meteo Geocoding API`:
  - city population -> `city_vs_campus` signal.
- `Wikidata SPARQL` fallback:
  - city population when Open-Meteo has no population value.
- local objective fields:
  - average acceptance rate from program entries,
  - total yearly cost (`finance.total_cost_year_usd`).

Each university now includes:
- `factors`: normalized values used by sliders (`0.0..1.0`),
- `factors_meta`: source query URLs, raw metrics, derived normalized signals, and `computed_at`.

To refresh factors from internet sources:
```bash
python backend/scripts/refresh_university_factors.py
```

Business logic is backend-first:
- `POST /universities/ai-sort`
- `POST /universities/{id}/uni-chance`
- `POST /universities/{id}/roi`

## ML personalization and translation
UniFit supports optional free-text interests from profile (`profile.interests`).

Pipeline:
1. User writes interests in any supported UI language.
2. Backend detects locale/source and translates to English via self-hosted LibreTranslate.
3. Backend computes TF-IDF + cosine similarity against university metadata.
4. UniFit ranking combines slider mismatch + admission risk (`FinalScore = 0.6 * PreferenceMismatch + 0.4 * AdmissionRisk`); ML is attached as an additional relevance signal in `matchData.mlScore` and diagnostics.

If translation is unavailable, backend safely falls back to raw text and still returns results.

### Translation safeguards
- Redis-backed cache (with in-memory fallback)
- Redis-backed sliding-window rate limit (with in-memory fallback)
- provider failure backoff
- short request timeout

## Performance services (v2.5.0)
- Redis for API/cache and shared rate-limit state
- Observability: Prometheus metrics (`/metrics`) + optional Sentry

### Backend translation env (`backend/.env`)
```env
ML_INTEREST_TRANSLATION_ENABLED=1
ML_INTEREST_TRANSLATION_PROVIDER=libretranslate
ML_INTEREST_TRANSLATION_TARGET=en
ML_INTEREST_TRANSLATION_SOURCE=auto
LIBRETRANSLATE_URL=http://127.0.0.1:5000/translate
LIBRETRANSLATE_API_KEY=
ML_INTEREST_TRANSLATION_TIMEOUT_SEC=1.2
ML_INTEREST_TRANSLATION_CACHE_TTL_SEC=86400
ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS=2000
ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS=40
ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC=60
ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC=20
```

### Backend infra env (`backend/.env`)
```env
APP_VERSION=2.5.0
FRONTEND_ORIGIN=http://127.0.0.1:5501
# Optional multi-origin override (comma-separated):
# FRONTEND_ORIGINS=http://127.0.0.1:5501,http://127.0.0.1:5510
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_PREFIX=unisearch
REDIS_CACHE_TTL_SEC=60
AI_SORT_CACHE_TTL_SEC=300
AUTO_WARMUP_ON_STARTUP=1
METRICS_ENABLED=1
METRICS_PATH=/metrics
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.0
```

## API overview
- `GET /universities`
- `POST /universities/ai-sort`
- `GET /universities/{id}`
- `POST /universities/{id}/uni-chance`
- `POST /universities/{id}/roi`
- `GET /locations`
- `GET /stats`
- `GET /exams/config`
- `GET /exams/config/full`
- `POST /exams/validate`
- `GET /languages/config`
- `POST /languages/validate`
- `GET /health`
- `GET /ready`
- `GET /ops/runtime`
- `POST /ops/warmup`
- `GET /metrics`

## Run locally
### 1) Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 1.5) Optional: run LibreTranslate (for profile interests translation)
If `ML_INTEREST_TRANSLATION_ENABLED=1`, backend expects a running translation service at:
`LIBRETRANSLATE_URL=http://127.0.0.1:5000/translate`

Option A (recommended, Docker):
```bash
docker run -d --name unisearch-libretranslate -p 5000:5000 libretranslate/libretranslate
```

Health check:
```bash
curl http://127.0.0.1:5000/languages
```

If Docker is not installed, install Docker Desktop first (Windows), then run the command above.

Option B (disable translation in local dev):
```env
ML_INTEREST_TRANSLATION_ENABLED=0
```

### 2) Frontend
```bash
cd frontend
python -m http.server 5501
```

Open:
- `http://127.0.0.1:5501/index.html`
- `http://127.0.0.1:5501/universities.html`
- `http://127.0.0.1:5501/university.html`
- `http://127.0.0.1:5501/ranking.html`
- `http://127.0.0.1:5501/guide.html`

Notes for local frontend:
- local `python -m http.server` does not support rewrites, so `.html` routes are expected in local dev
- production/demo hosts can use clean routes (`/`, `/universities`, `/ranking`, `/universities/:id`) with rewrite rules
- clean route mode is controlled by runtime env (`window.__UNISEARCH_ENV__.APP_USE_PRETTY_URLS`) and auto-enabled outside localhost

### 3) Full stack with Redis (Docker)
```bash
docker compose up --build
```

## Hosting compatibility (any platform)
UniSearch is not tied to Render and can be deployed on any hosting:
- VPS + Nginx/Caddy
- Docker host
- Render, Railway, Fly.io
- split frontend/static host + backend/API host

## Frontend runtime env (no hardcoded domain)
Frontend reads runtime config from `frontend/env.js` (loaded before `config.js`).

Set host environment variables:
```env
UNISEARCH_API_BASE_URL=https://api.example.com
# or use reverse proxy on same domain:
# UNISEARCH_API_BASE_URL=/api

UNISEARCH_USE_PRETTY_URLS=true
```

Generate deploy-time env file:
```bash
npm run build:frontend-env
```

This writes `frontend/env.js` with `window.__UNISEARCH_ENV__`, so you can switch backend/frontend domains only through hosting env settings without editing source files.

## Pretty URL rewrites (any static host)
Target clean routes:
- `/` (home)
- `/universities`
- `/universities/:id`
- `/ranking`
- `/guide`
- `/about`

Rewrite rules:
1. Source: `/` -> Destination: `/index.html`
2. Source: `/universities` -> Destination: `/universities.html`
3. Source: `/universities/:id` -> Destination: `/university.html`
4. Source: `/ranking` -> Destination: `/ranking.html`
5. Source: `/guide` -> Destination: `/guide.html`
6. Source: `/about` -> Destination: `/about.html`
7. Optional legacy support: `/index` -> `/index.html`

Verification after deploy:
1. Open `https://<your-domain>/universities`
2. Open a detail page `https://<your-domain>/universities/<uuid>`
3. Ensure navbar links show clean paths (`/`, `/ranking`, `/guide`, `/about`) without `.html`

Important:
- rewrites are configured on hosting/web server side
- local `python -m http.server` does not support rewrites
- app keeps `.html` compatibility for local/dev and legacy links

## Render example (optional)
Render is just one deployment option.

For backend + Redis on Render:
1. `Key Value` service for `REDIS_URL`.
2. `Web Service` for backend API.
3. Optional `Cron Job` to call `POST /ops/warmup`.

For frontend on Render Static Site:
- configure the rewrite rules from the previous section in `Static Site -> Redirects/Rewrites`.

For translation service on Render (optional):
1. Deploy `libretranslate/libretranslate` as separate Web Service.
2. Set backend env:
```env
ML_INTEREST_TRANSLATION_ENABLED=1
LIBRETRANSLATE_URL=https://<your-libretranslate-service>.onrender.com/translate
```
3. If translation service is not used, set `ML_INTEREST_TRANSLATION_ENABLED=0`.

## Testing Strategy
The test stack is split into two deterministic layers:

1. Backend `unittest` suites for API contracts, validation, algorithms, and regression invariants.
2. Frontend Playwright E2E suites for realistic user journeys using natural, human-like input patterns.

Coverage target for this phase is **Critical + Algo**:
- critical API routes and UI flows,
- UniFit / UniChance / ROI algorithm invariants,
- profile, language, and exam validation behavior,
- multi-user smoke for scoring endpoints.

## Test Suites
- Backend unit/integration (`backend/tests/`):
  - existing algorithm and search tests,
  - new API contract tests (`/health`, `/ready`, `/ops/*`, `/universities*`, `/exams/*`, `/languages/*`),
  - persona-based regression (`fixtures/personas.json`),
  - extended payload validation and concurrency smoke.
- Frontend E2E (`tests/e2e/`):
  - smoke home page / layout,
  - realistic profile editing and persistence,
  - AI sort flow on universities list,
  - university detail flow (UniChance + ROI recomputation),
  - language validation UI flow,
  - i18n switching for `eng/rus/kz`.

## Run Tests Locally
Prerequisites:
- Python 3.12+
- Node.js 20+

Install dependencies:
```bash
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
npm install
npx playwright install chromium
```

Run backend tests:
```bash
npm run test:backend
```

Run E2E PR suite (Chromium only):
```bash
npm run test:e2e:pr
```

Run full nightly browser matrix locally:
```bash
npm run test:e2e:nightly
```

Run Chromium E2E on isolated local test port (`5510`) with deterministic local stack:
```bash
npx playwright test --project=chromium --config=playwright.local.config.js
```

Run backend + PR E2E together:
```bash
npm run test:all
```

## CI Test Policy
Workflow: `.github/workflows/tests.yml`

- PR / push (`main`):
  - `backend-tests`
  - `e2e-pr` (Chromium only)
- Nightly (`cron`):
  - `nightly-full` (Chromium + Firefox + WebKit)

Playwright reports/artifacts are uploaded from CI jobs.

## Synthetic User Personas
Persona fixtures live in:
- `backend/tests/fixtures/personas.json`
- `backend/tests/fixtures/persona_inputs_natural_text.json`

These fixtures model realistic input:
- multilingual text (`eng/rus/kz`) and mixed-language phrases,
- abbreviations and colloquial wording (`ict`, `gamedev`, `ui/ux`, etc.),
- noisy inputs and minor typos,
- mixed numeric formats and partial profile evidence.

No personal user data is used in automated tests.

## Troubleshooting Tests
- If E2E cannot connect to backend:
  - verify backend starts at `http://127.0.0.1:8000/health`.
  - if frontend runs on non-default test port, allow it via `FRONTEND_ORIGINS` (e.g. include `http://127.0.0.1:5510`).
- If E2E cannot open frontend:
  - verify static server is available at `http://127.0.0.1:5501/index.html`.
- If browser binaries are missing:
  - run `npx playwright install chromium` (or full browser set for nightly).
- If translation provider/network is unavailable in tests:
  - E2E runs are configured with `ML_INTEREST_TRANSLATION_ENABLED=0` for deterministic behavior.

## Repository layout
```text
backend/
  app/
    main.py
    core/
      env.py
      files.py
      observability.py
      paths.py
      redis_store.py
      security.py
      settings.py
    routers/
      root.py
      universities.py
      exams.py
      languages.py
    schemas/
      payloads.py
    services/
      ai_scoring.py
      text_translation.py
      universities.py
      exams.py
      background_tasks.py
      languages.py
      ml_scoring.py
  data/
    universities.json
    exams.json
    languages.json
    cities.json
  tests/
    fixtures/
      personas.json
      persona_inputs_natural_text.json

frontend/
  index.html
  universities.html
  university.html
  ranking.html
  guide.html
  about.html
  config.js
  sw.js
  javascript/
    main.js
    pages.js
    components.js
    routes.js
    utils.js
    i18n.js
    university-translations.js
    languages.js
  Localization/
    eng
    ru
    kz

docker-compose.yml
playwright.config.js
package.json
tests/
  e2e/
    helpers/
      personas.js
      selectors.js
    smoke-home.spec.js
    profile-natural-input.spec.js
    universities-ai-sort-flow.spec.js
    university-detail-chance-roi.spec.js
    languages-validation-flow.spec.js
    i18n-switching.spec.js
```

## Notes
- Legacy chat assistant feature was removed from project architecture and UI.
- Admissions UI labels (`grant/paid`, aid types, and related badges) are localized for ENG/RUS/KZ.
- Default fallback language remains English when unsupported locale is detected.
