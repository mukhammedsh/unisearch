# UniSearch / UniFit / UniChance

UniSearch is a full-stack web app for university discovery and decision support.

Core capabilities:
- structured university catalog with filters/search
- AI ranking (`UniFit`) with preference sliders
- admission probability estimate (`UniChance`)
- ROI estimate per university
- multilingual UI (`eng`, `ru`, `kz`) with backend-driven localization

## Current highlights
- Backend-first architecture for business logic and data delivery.
- University translation packs are served by backend (`/universities/translations`).
- University media assets (logos/backgrounds) are stored in backend and served by API static route.
- Media variant naming is standardized to `small` (reduced size) and full size.
- Frontend static assets (CSS/JS/images/localization packs) use root-absolute paths where needed to stay stable on pretty URLs (e.g. `/universities/:id`).
- Service worker is registered from `/sw.js` with root scope to avoid nested-route cache routing issues.
- Frontend image policy:
  - list/ranking cards: use `small` assets by default on all devices
  - university detail page: use full-size assets for better quality

## Architecture
- Frontend: Vanilla JS + HTML/CSS (`frontend/`)
- Backend: FastAPI (`backend/app/`)
- Data and static assets:
  - JSON datasets in `backend/data/*.json`
  - university media in `backend/data/university_assets/*`

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
- `GET /metrics` (if enabled)

Operations:
- `GET /ops/runtime`
- `POST /ops/warmup`
- `GET /ops/translation-status`

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
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
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
- `http://127.0.0.1:5501/about.html`

### 3) Full stack with Redis (Docker)
```bash
docker compose up --build
```

## Optional translation service (LibreTranslate)
If `ML_INTEREST_TRANSLATION_ENABLED=1`, backend expects:
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
APP_VERSION=2.5.3
FRONTEND_ORIGIN=http://127.0.0.1:5501
# Optional multi-origin override:
# FRONTEND_ORIGINS=http://127.0.0.1:5501,http://127.0.0.1:5510

REDIS_URL=redis://127.0.0.1:6379/0
REDIS_PREFIX=unisearch
REDIS_CACHE_TTL_SEC=60
AI_SORT_CACHE_TTL_SEC=300
REDIS_CONNECT_TIMEOUT_SEC=0.35
REDIS_OPERATION_TIMEOUT_SEC=0.35

AUTO_WARMUP_ON_STARTUP=1
METRICS_ENABLED=1
METRICS_PATH=/metrics
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.0
```

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

Semantic ranking runtime behavior:
- Primary backend: sentence embeddings (`sentence-transformers`) over university metadata.
- Fallback backend: TF-IDF cosine similarity if semantic backend is disabled or unavailable.
- Exposed runtime modes: `semantic`, `tfidf`, `unavailable`.
- In AI sort (`/universities/ai-sort`), semantic signal participates in final UniFit score:
  - ML available: `finalScore = 0.50*preferenceMismatch + 0.35*admissionRisk + 0.15*(1-mlScore)`
  - ML unavailable: `finalScore = 0.60*preferenceMismatch + 0.40*admissionRisk`

`ML_SEMANTIC_EMBEDDINGS_*` reference:
- `ML_SEMANTIC_EMBEDDINGS_ENABLED` (default `1`)
  - Enables semantic embeddings backend.
  - If `0`, service uses TF-IDF fallback only.
- `ML_SEMANTIC_EMBEDDINGS_MODEL` (default `intfloat/multilingual-e5-base`)
  - Hugging Face model id loaded by `SentenceTransformer`.
  - Change this to test a different semantic model.
- `ML_SEMANTIC_EMBEDDINGS_DEVICE` (default `cpu`)
  - Inference device passed to `SentenceTransformer`.
  - Typical values: `cpu`, `cuda` (if GPU runtime is available).
- `ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE` (default `32`)
  - Batch size for corpus embedding generation.
  - Larger values can improve throughput but increase RAM/VRAM usage.
- `ML_SEMANTIC_EMBEDDINGS_E5_PREFIX` (default `auto`)
  - Controls E5 query/passage prefix formatting:
    - `auto`: add prefixes only for E5-like models.
    - `on`: always add `query:` / `passage:`.
    - `off`: never add prefixes.

Render deployment notes for semantic ranking:
- First startup may need to load/download model artifacts; expect slower cold start than TF-IDF-only mode.
- If outbound access to model registry is restricted, semantic init can fail and service automatically falls back to TF-IDF.
- If you need the fastest startup and deterministic behavior, set `ML_SEMANTIC_EMBEDDINGS_ENABLED=0`.
- Keep backend memory budget aligned with selected embedding model size.

### Frontend runtime env
Frontend reads runtime config from `frontend/env.js` (generated at deploy time):

```env
UNISEARCH_API_BASE_URL=https://api.example.com
# or same-domain reverse-proxy
# UNISEARCH_API_BASE_URL=/api

UNISEARCH_USE_PRETTY_URLS=true
```

Generate `frontend/env.js`:
```bash
npm run build:frontend-env
```

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

- PR/push (`main`):
  - backend unit tests
  - E2E PR suite (Chromium)
  - i18n consistency checks
- Nightly schedule:
  - full Playwright matrix (Chromium + Firefox + WebKit)

## Hosting notes
- Works with any standard setup: VPS + reverse proxy, Docker hosts, or managed platforms.
- For non-local deployments, frontend can use clean routes (`/`, `/universities`, `/universities/:id`, `/ranking`, `/guide`, `/about`) if host rewrite rules are configured.
- Local `python -m http.server` does not provide rewrite support, so `.html` routes are used in local dev.

## Troubleshooting static asset 404 / MIME errors
If you see browser errors like:
- `Refused to apply style ... MIME type ('text/html' | 'text/plain')`
- `Refused to execute script ... MIME type ...`
- repeated `404` for `/css/*`, `/javascript/*`, `/images/*`, `/Localization/*`

check the following:
- Local dev root:
  - run frontend server from `frontend/` directory
  - command: `python -m http.server 5501`
- Route rewrites:
  - ensure pretty URL rewrites map detail route to `university.html`
- Browser cache:
  - unregister service worker for the site
  - clear site data/cache
  - hard reload (`Ctrl+Shift+R`)

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

scripts/
  i18n-check.mjs

tests/
  e2e/
    helpers/
    *.spec.js
```

## Notes
- Default fallback language remains English when unsupported locale is detected.
- Backend API uses cache headers and ETag for efficient detail-page refresh behavior.

## Changelog
### 2.5.4 (2026-02-25) - loading UX fix
- Fixed white loading spinner behavior on universities page while waiting for delayed `UniFit` response.
- During list loading, the list/state/pagination are hidden until loading finishes (same "full loading" feel as initial load).
- During map loading, existing markers/popups are cleared, top counter is reset to `0`, and only the dimmed loading state is visible.
- University detail header alignment fix: website/map quick-action buttons are now aligned to the title row (not visually dropped lower on desktop).
- Ranking card UX update: removed visible rank-source meta pill for end users and moved rank provenance to hover tooltip (`title`) from `rank_meta`.
- Guide typography cleanup: removed paragraph spacing in narrative sections (kept spacing behavior for Academic Exams, Language Exams, and Glossary blocks).
- Profile budget UX:
  - budget validation now allows `0` (range `0..1,000,000`);
  - added a subtle dismissible hint when budget is below `$1000`, with quick action to switch funding preference to `Grant only`.
- Grant track visuals: made grant pills in Admissions/Costs noticeably greener for clearer finance context.
- About page copy corrected in `eng`/`ru`/`kz`: updated team roles so responsibilities do not overlap (`text documentation` vs `video documentation`).
- Fixed profile i18n refresh on runtime language switch: profile modal labels/selects now retranslate without cache clear or hard reload.

### 2.5.3 (2026-02-24) - bugfix release
- Standardized project runtime/package version to `2.5.3` (`frontend/config.js`, backend settings default, `package.json`, `package-lock.json`, `docker-compose.yml`).
- Unified universities page loading UX:
  - removed duplicate top-right purple global API loader on universities list page;
  - kept central white loading spinner visible until delayed `UniFit` response is applied (fallback -> late AI update flow).
- Improved RU user-facing copy in university badges/tooltips (financial aid phrasing and consistent `вы` tone).
- Reworked university card badge sizing logic to count-based scenarios (`0..6` supported by CSS classes):
  - `uni-badge--count-1` ... `uni-badge--count-6`
  - more tags now use compact presets instead of aggressive global text shrinking.
- Added robust i18n badge layout validation for `eng`, `rus`, `kz` to ensure badges stay inside the badge container.
- Added/updated E2E coverage for badge priority, count-based classes (`0..5`), and multilingual layout behavior.
- Changed repeating study emoji
- Ranking page UX cleanup: removed `Source / Type / Checked` meta line and tooltip from ranking cards for end users (metadata remains in backend data).
- Data truth pass (universities dataset): updated rank facts to QS WUR 2026 where officially published, added explicit `rank_meta` statuses (`official` / `excluded` / `not_listed`), and refreshed rank provenance for auditability.
- Upgraded ML relevance layer:
  - sentence-embeddings semantic matching (multilingual E5) is now primary with TF-IDF fallback;
  - university semantic corpus now includes richer metadata (including admission track labels/descriptions/modes/extra requirements);
  - runtime ML status now reports backend mode/reason/model (`semantic` / `tfidf` / `unavailable`);
  - UniFit `matchData` now includes `mlMode`, `mlSemanticScore`, `mlLexicalScore`, and `semanticSignalWeight`;
  - semantic signal now contributes to final UniFit ranking score.

### 2.5.2 (2026-02-24) - non-breaking UI/UX + stability
- Fixed profile modal draft persistence when switching language (draft is preserved, modal closes cleanly).
- Restored expected universities default sort behavior: AI sort is used by default when profile evidence exists.
- Improved keyboard accessibility with clear `:focus-visible` states on key interactive controls.
- Improved long-text wrapping in ranking/university cards and tooltips to avoid layout breaks on narrow viewports.
- Updated minor EN/RU copy consistency.
- Validation: `npm run test:e2e:pr` passes (18/18).

### 2.5.1 (2026-02-21)
- Added ranking source transparency: each ranking card can now show source, source type, and verification date.
- Added localized ranking source UX for `eng`, `ru`, and `kz`.
- Improved university dataset quality for ranking/admission fields and added fact provenance metadata.
- Added data maintenance tooling:
  - `backend/scripts/audit_universities_data.py`
  - `backend/scripts/refresh_fact_provenance.py`
