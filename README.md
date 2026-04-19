# UniSearch / UniFit / UniChance

UniSearch is a full-stack web app for university discovery and decision support.
Current version: `3.4.7`

Core capabilities:
- structured university catalog with filters/search
- AI ranking (`UniFit`) with preference sliders
- admission probability estimate (`UniChance`)
- ROI estimate per university
- multilingual UI (`eng`, `ru`) with backend-driven localization

## Quick start
If you just want the project running locally:

Prerequisites:
- Python `3.12+`
- Node.js `20+`

1. Create your local backend config:
   ```bash
   cp backend/.env.example backend/.env
   ```
   PowerShell alternative:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
2. Start the backend:
   ```bash
   cd backend
   python -m venv .venv
   # Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   # macOS/Linux
   # source .venv/bin/activate
   pip install -r requirements.txt
   cd ..
   npm run dev:backend
   ```
3. Start the frontend in a second terminal:
   ```bash
   npm run dev:frontend
   ```
4. Open `http://127.0.0.1:5501/index.html`
5. If you changed curated official facts, sync and audit before committing:
   ```bash
   python backend/scripts/apply_official_facts.py --verified-at 2026-03-25
   python backend/scripts/audit_universities_data.py
   python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
   ```

## Read me by task
- First local launch: see [Run locally](#run-locally)
- Runtime and env vars: see [Environment configuration](#environment-configuration)
- Curated data workflow: see [Data maintenance and provenance](#data-maintenance-and-provenance)
- Tests and CI: see [Testing](#testing) and [CI policy](#ci-policy)
- Release history: see [CHANGELOG.md](CHANGELOG.md)

## Current highlights
- Backend-first architecture for business logic and data delivery.
- Users can manually choose an admission track per university, and bachelor-facing detail pages now keep those tracks scoped to applicable non-foundation majors.
- ROI now uses newly added official salary outcomes for supported universities and hides the ROI block when no official salary source exists yet.
- Universities-page country/region/city filters keep translated dropdown labels in sync after UI language changes.
- Backend startup warmup now runs in a background thread instead of delaying app boot.
- University translation packs are served by backend (`/universities/translations`).
- University media assets are stored in backend and served by API static routes.
- Media variant naming is standardized to `small` and full-size variants.
- Frontend static assets use root-absolute paths where needed to stay stable on pretty URLs like `/universities/:id`.
- Service worker is registered from `/sw.js` with root scope to avoid nested-route cache issues.
- Frontend image policy:
  - list/ranking cards use `small` assets by default
  - university detail page uses full-size assets

## Architecture
- Frontend: Vanilla JS + HTML/CSS in `frontend/`
- Backend: FastAPI in `backend/app/`
- Data: JSON datasets in `backend/data/*.json`
- University media: `backend/data/university_assets/*`

## University media assets
Storage:
- `backend/data/university_assets/logos/`
- `backend/data/university_assets/logos-small/`
- `backend/data/university_assets/thumbnails/`
- `backend/data/university_assets/thumbnails-small/`

Serving:
- backend mounts static files at `GET /universities/assets/{folder}/{filename}`

Example URLs:
- `/universities/assets/logos-small/mit-usa-cambridge.png`
- `/universities/assets/thumbnails/mit-usa-cambridge.jpg`

## API overview
General:
- `GET /`
- `GET /health`
- `GET /ready`
- `GET /metrics` when enabled and authorized

Operations:
- `GET /ops/runtime` (requires `OPS_ADMIN_TOKEN`)
- `POST /ops/warmup` (requires `OPS_ADMIN_TOKEN`)
- `GET /ops/translation-status` (requires `OPS_ADMIN_TOKEN`)
- `GET /translation-status` (public, sanitized)

Universities:
- `GET /universities`
- `POST /universities/ai-sort`
- `GET /universities/translations`
- `GET /universities/{id}`
- `POST /universities/{id}/uni-chance`
- `POST /universities/{id}/roi`
- `GET /universities/assets/{folder}/{filename}`

Reference data:
- `GET /locations`
- `GET /stats`
- `GET /exams/config`
- `GET /exams/config/full`
- `POST /exams/validate`
- `GET /languages/config`
- `POST /languages/validate`

## Run locally
### 1) Backend
Use Python `3.12.x` for the most predictable dependency behavior.

```bash
cd backend
python -m venv .venv
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
npm run dev:backend
```

Notes:
- `.venv/` is local per developer and ignored by Git.
- If the project path was moved or renamed and CLI launchers break, recreate the env from scratch.
- `npm run dev:backend` auto-detects `backend/.venv` when present and respects `BACKEND_HOST` / `BACKEND_PORT` from `.env`.
- `npm run dev:backend` probes `GET /health` to detect an already running local backend and prints a ready message once the new instance responds.
- Direct launch still works if you prefer it: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

### 2) Frontend
```bash
npm run dev:frontend
```

Open:
- `http://127.0.0.1:5501/index.html`
- `http://127.0.0.1:5501/universities.html`
- `http://127.0.0.1:5501/university.html`
- `http://127.0.0.1:5501/ranking.html`
- `http://127.0.0.1:5501/guide.html`
- `http://127.0.0.1:5501/about.html`

Notes:
- `npm run dev:frontend` regenerates `frontend/env.js` before startup.
- The frontend runtime config automatically follows your current host for local URLs, so `localhost`, `127.0.0.1`, and LAN IP launches stay aligned with the same machine.
- Change `FRONTEND_HOST` / `FRONTEND_PORT` in `backend/.env` if you want another static-server bind.

### 3) Full stack with Redis (Docker)
```bash
docker compose up --build
```

The backend image runs as a non-root user. Redis is available only on the internal Docker network by default; do not publish Redis to the internet. Set `OPS_ADMIN_TOKEN` in your shell or `.env` before exposing ops endpoints or metrics on a hosted deployment.

For VPS or Docker hosting behind a reverse proxy, see [deployment security notes](docs/deployment_security.md) for Caddy and Nginx examples.

## Optional translation service (LibreTranslate)
If `ML_INTEREST_TRANSLATION_ENABLED=1`, the backend expects:
- `LIBRETRANSLATE_URL=http://127.0.0.1:5000/translate`

Docker example:
```bash
docker run -d --name unisearch-libretranslate -p 5000:5000 libretranslate/libretranslate
```

Health check:
```bash
curl http://127.0.0.1:5000/languages
```

Disable translation in local development:
```env
ML_INTEREST_TRANSLATION_ENABLED=0
```

## Environment configuration
### Backend (`backend/.env`)
Infra/runtime:
```env
APP_VERSION=3.4.7
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=5501
FRONTEND_ORIGINS=http://127.0.0.1:5501
# Optional multi-origin override:
# FRONTEND_ORIGINS=http://127.0.0.1:5501,http://127.0.0.1:5510

REDIS_URL=redis://127.0.0.1:6379/0
REDIS_PREFIX=unisearch
REDIS_CACHE_TTL_SEC=60
AI_SORT_CACHE_TTL_SEC=300
REDIS_CONNECT_TIMEOUT_SEC=0.35
REDIS_OPERATION_TIMEOUT_SEC=0.35

AUTO_WARMUP_ON_STARTUP=1
METRICS_ENABLED=0
METRICS_PATH=/metrics
OPS_ADMIN_TOKEN=
OPS_ADMIN_HEADER=X-UniSearch-Ops-Token
REQUEST_BODY_MAX_BYTES=131072
RATE_LIMIT_ENABLED=1
GLOBAL_RATE_LIMIT_REQUESTS=600
GLOBAL_RATE_LIMIT_WINDOW_SEC=60
EXPENSIVE_RATE_LIMIT_REQUESTS=120
EXPENSIVE_RATE_LIMIT_WINDOW_SEC=60
TRUST_X_FORWARDED_FOR=0
TRUSTED_PROXY_IPS=
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.0
```

Local network example without committing your IPs:
```env
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_ORIGINS=http://127.0.0.1:5501,http://localhost:5501,http://<your-lan-ip>:5501
```

Notes:
- `backend/.env` is ignored by Git, so your LAN IP stays local.
- `FRONTEND_HOST` / `FRONTEND_PORT` are used by `npm run dev:frontend` only; backend CORS depends on `FRONTEND_ORIGINS`.
- CORS must contain the frontend origin, not the backend URL. For a page opened as `http://<your-lan-ip>:5501`, add exactly that origin.
- For another person in your LAN to open the site, start the backend with `--host 0.0.0.0` (or `BACKEND_HOST=0.0.0.0`) and start the frontend with `python -m http.server 5501 --bind 0.0.0.0`.
- If Windows Defender Firewall prompts, allow Python on Private networks or the other device still will not connect.
- Set a long random `OPS_ADMIN_TOKEN` before using `/ops/*`, `/metrics`, or `/health?warmup=1` outside local development.
- Keep `TRUST_X_FORWARDED_FOR=0` unless the backend is behind a known reverse proxy listed in `TRUSTED_PROXY_IPS`.
- Sentry is optional. When enabled, UniSearch filters profile, interests, exams, languages, auth headers, tokens, and secrets before sending events.

Translation pipeline:
```env
ML_INTEREST_TRANSLATION_ENABLED=1
ML_INTEREST_TRANSLATION_DEBUG=0
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

Semantic ML ranking:
```env
ML_SEMANTIC_EMBEDDINGS_ENABLED=1
ML_SEMANTIC_EMBEDDINGS_MODEL=intfloat/multilingual-e5-base
ML_SEMANTIC_EMBEDDINGS_DEVICE=cpu
ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE=32
# auto | on | off
ML_SEMANTIC_EMBEDDINGS_E5_PREFIX=auto
```

Semantic ranking behavior:
- Primary backend: sentence embeddings over university metadata.
- Fallback backend: TF-IDF cosine similarity if semantic mode is disabled or unavailable.
- Exposed runtime modes: `semantic`, `tfidf`, `unavailable`.
- In `/universities/ai-sort`, semantic signal participates in final UniFit score.
- On fresh deploys, first startup may be slower while model artifacts load or download.

### Frontend runtime env
Frontend reads runtime config from `frontend/env.js` generated at deploy time:

```env
UNISEARCH_API_BASE_URL=https://api.example.com
# or same-domain reverse-proxy
# UNISEARCH_API_BASE_URL=/api

# optional for local same-host dev when backend is not on 8000
UNISEARCH_API_PORT=8000

UNISEARCH_USE_PRETTY_URLS=true
```

Generate `frontend/env.js`:
```bash
npm run build:frontend-env
```

Local dev behavior:
- If `UNISEARCH_API_BASE_URL` is empty, the frontend uses the same host as the page and `UNISEARCH_API_PORT` (or `BACKEND_PORT`) for API calls.
- Example: frontend on `http://192.168.1.20:5600` and backend on `http://192.168.1.20:9000` works after setting `FRONTEND_PORT=5600`, `BACKEND_PORT=9000`, and matching `FRONTEND_ORIGINS`.

## Data maintenance and provenance
The project is intentionally conservative about university facts.

Rules:
- Use official university pages, official admissions pages, or official university-hosted PDFs/reports only.
- Do not fill missing facts from aggregators, marketing retellings, or inferred heuristics when an official institution-wide source is missing.
- `backend/data/official_facts.json` is the curated source of truth for verified optional facts added in recent cleanup passes.
- `backend/data/universities.json` should be updated from the catalog through the sync script, not hand-edited first for those curated facts.

Current curated workflow:
1. Add or update verified facts in `backend/data/official_facts.json`
2. Sync them into the dataset:
   ```bash
   python backend/scripts/apply_official_facts.py --verified-at 2026-03-25
   ```
3. Run dataset audit:
   ```bash
   python backend/scripts/audit_universities_data.py
   ```
4. Run HTTP source audit for touched URLs:
   ```bash
   python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
   ```

Useful references:
- current admissions cleanup note: `docs/official_admissions_cleanup_2026-03-25.md`
- previous official-facts cleanup note: `docs/official_facts_update_2026-03-12.md`
- canonical release history: [CHANGELOG.md](CHANGELOG.md)

## Testing
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

Run i18n checks:
```bash
npm run check:i18n
```

Run backend tests:
```bash
npm run test:backend
```

Run E2E (PR profile, Chromium):
```bash
npm run test:e2e:pr
```

Run full nightly browser matrix:
```bash
npm run test:e2e:nightly
```

Run full local test flow:
```bash
npm run test:all
```

## CI policy
Workflow: `.github/workflows/tests.yml`

- PR and push to `main`:
  - backend unit tests
  - E2E PR suite on Chromium
  - i18n consistency checks
- Nightly schedule:
  - full Playwright matrix on Chromium, Firefox, and WebKit

## Hosting notes
- Works with standard setups like VPS + reverse proxy, Docker hosts, or managed platforms.
- For non-local deployments, the frontend can use clean routes like `/`, `/universities`, `/universities/:id`, `/ranking`, `/guide`, and `/about` if rewrite rules are configured.
- Local `python -m http.server` does not provide rewrites, so `.html` routes are used in local development.

## Troubleshooting static asset 404 / MIME errors
If you see browser errors like:
- `Refused to apply style ... MIME type ('text/html' | 'text/plain')`
- `Refused to execute script ... MIME type ...`
- repeated `404` for `/css/*`, `/javascript/*`, `/images/*`, `/Localization/*`

Check the following:
- Run the frontend server from `frontend/`
- Use `python -m http.server 5501`
- Ensure pretty-URL rewrites map detail routes to `university.html`
- If needed, unregister the service worker, clear site data, and hard reload

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
      background_tasks.py
      exams.py
      languages.py
      ml_scoring.py
      search.py
      text_translation.py
      universities.py
  data/
    universities.json
    official_facts.json
    universities_translations.json
    exams.json
    languages.json
    cities.json
    university_assets/
      logos/
      logos-small/
      thumbnails/
      thumbnails-small/
  scripts/
    apply_official_facts.py
    audit_universities_data.py
    refresh_university_factors.py
  tests/
    fixtures/
    test_*.py

frontend/
  index.html
  universities.html
  university.html
  ranking.html
  guide.html
  about.html
  config.js
  env.js
  sw.js
  css/
  javascript/
  Localization/
  scripts/

docs/
  official_admissions_cleanup_2026-03-25.md
  official_facts_update_2026-03-12.md

scripts/
  i18n-check.mjs

tests/
  e2e/
    helpers/
    *.spec.js
```

## Notes
- Default fallback language remains English when an unsupported locale is detected.
- Backend API uses cache headers and ETag for efficient detail-page refresh behavior.
- The recent cleanup passes intentionally favored missing values over unverified admissions facts.

## Changelog
Canonical release history lives in [CHANGELOG.md](CHANGELOG.md).

Latest release:
- `3.4.7` on `2026-04-19`
- `3.4.6` on `2026-04-18`
- `3.4.5` on `2026-04-17`
- `3.4.4` on `2026-04-13`
- `3.4.2` on `2026-04-13`
- `3.4.1` on `2026-04-12`
- `3.4.0` on `2026-04-12`
- `3.3.1` on `2026-04-09`
- `3.3.0` on `2026-04-08`
- `3.2.1` on `2026-04-03`
- `3.1.0` on `2026-04-03`
- `3.0.0` on `2026-04-02`
- focus: full web-application design rework with refreshed comparison flows and release version sync
- status: current release
