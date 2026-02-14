# UniSearch / UniFit / UniChance - 2.2.2 (Infomatrix 2026)

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

## What's new in 2.2.2
- language fixes across `eng/rus/kz` UI texts
- `AI` naming normalized in RU/KZ (`ИИ` / `ЖИ`)
- search updated to language-adaptive mode (`eng`/`rus`/`kz`) instead of auto-translation
- search scoring expanded to include university `description` and `tags`

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

## Performance services (2.2.2)
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
ML_INTEREST_TRANSLATION_TIMEOUT_SEC=2.5
ML_INTEREST_TRANSLATION_CACHE_TTL_SEC=86400
ML_INTEREST_TRANSLATION_CACHE_MAX_ITEMS=2000
ML_INTEREST_TRANSLATION_RATE_LIMIT_REQUESTS=40
ML_INTEREST_TRANSLATION_RATE_LIMIT_WINDOW_SEC=60
ML_INTEREST_TRANSLATION_FAILURE_BACKOFF_SEC=20
```

### Backend infra env (`backend/.env`)
```env
APP_VERSION=2.2.2
FRONTEND_ORIGIN=http://127.0.0.1:5501
# Optional multi-origin override (comma-separated):
# FRONTEND_ORIGINS=http://127.0.0.1:5501,http://127.0.0.1:5510
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_PREFIX=unisearch
REDIS_CACHE_TTL_SEC=60
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

### 3) Full stack with Redis (Docker)
```bash
docker compose up --build
```

## Render: where to host translation service
For production on Render, run LibreTranslate as a separate web service (recommended), then point backend to it.

1. Create a new Render Web Service from Docker image `libretranslate/libretranslate`.
2. Deploy it and copy its public URL.
3. In backend service env, set:
```env
ML_INTEREST_TRANSLATION_ENABLED=1
LIBRETRANSLATE_URL=https://<your-libretranslate-service>.onrender.com/translate
```
4. Redeploy backend.

Notes:
- Keep backend and translator as separate services.
- If you do not want to maintain translator infra on Render, set `ML_INTEREST_TRANSLATION_ENABLED=0`.

## Render deployment notes
- `Cron Job` on Render is not Redis. It only runs commands on schedule.
- For this architecture in Render use:
1. `Key Value` service (Valkey/Redis-compatible) for `REDIS_URL`.
2. `Web Service` for backend API.
3. Optional `Cron Job` to call `POST /ops/warmup` periodically.

Recommended env for backend:
```env
REDIS_URL=<render-key-value-internal-url>
AUTO_WARMUP_ON_STARTUP=1
```

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

## GitHub Release + Packages (GHCR)
This repository is configured to publish both release assets and a backend container image when a GitHub Release is published.

What happens automatically on release publish:
- uploads `unisearch-frontend-vX.Y.Z.zip` to the release
- uploads `unisearch-backend-vX.Y.Z.zip` to the release
- publishes backend image to:
  - `ghcr.io/<owner>/unisearch-backend:vX.Y.Z`
  - `ghcr.io/<owner>/unisearch-backend:X.Y.Z`
  - `ghcr.io/<owner>/unisearch-backend:latest`

How to trigger:
1. Push all changes to `main`.
2. Create and push a tag (example `v2.2.2`):
   ```bash
   git tag v2.2.2
   git push origin v2.2.2
   ```
3. In GitHub, open Releases and publish a release for that tag.
4. Wait for the workflow `Release Artifacts And Container` to finish.

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
