# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UniSearch is a full-stack university discovery and decision support platform. The product helps students find universities, estimate admission chances (UniChance), and rank options by fit (UniFit). Current scope: bachelor-level programs only.

**Tech stack:**
- Backend: FastAPI (Python 3.12+), Redis caching, semantic ML embeddings
- Frontend: Vanilla JavaScript (no frameworks), HTML/CSS with theme support
- Data: JSON datasets with curated university facts from official sources only
- Languages: English and Russian (full localization)

**Version source:** `package.json` → `version` field is canonical. Backend reads it at runtime, frontend receives it via generated `frontend/env.js`.

## Development Commands

### Initial Setup
```bash
npm install
cp backend/.env.example backend/.env
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### Running Locally
```bash
# Terminal 1 - Backend (auto-detects .venv)
npm run dev:backend

# Terminal 2 - Frontend (regenerates env.js first)
npm run dev:frontend

# Open http://127.0.0.1:5501/index.html
```

Direct backend launch (if needed):
```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Testing
```bash
# Localization consistency
npm run check:i18n

# Backend unit tests (pytest)
npm run test:backend

# E2E tests (Chromium only, for PRs)
npm run test:e2e:pr

# Full E2E matrix (Chromium, Firefox, WebKit)
npm run test:e2e:nightly

# All checks (version sync + backend + E2E PR)
npm run test:all
```

Run single backend test:
```bash
cd backend
pytest tests/test_ai_scoring.py::TestAiScoring::test_ai_sort_prefers_distance_match_even_when_ml_scores_disagree -v
```

### Version Management
```bash
# Bump version (updates package.json, package-lock.json, frontend/env.js)
npm run bump:version -- patch
npm run bump:version -- minor
npm run bump:version -- major
npm run bump:version -- 3.5.7

# Verify version sync
npm run check:version
```

### Data Maintenance
After updating `backend/data/official_facts.json` or `backend/data/official_admissions.json`:
```bash
python backend/scripts/apply_official_facts.py --verified-at 2026-04-23
python backend/scripts/apply_official_admissions.py
python backend/scripts/audit_universities_data.py
python backend/scripts/audit_universities_data.py --check-http --http-timeout 10
```

### Other Utilities
```bash
# Regenerate frontend/env.js
npm run build:frontend-env

# Sync Heroicons (only when icon sources need refreshing)
npm run sync:heroicons
```

## Architecture

### Backend Structure
```
backend/
  app/
    main.py              # FastAPI app, CORS, rate limiting, lifespan
    routers/             # API endpoints (root, universities, exams, languages)
    services/            # Business logic layer
      ai_scoring.py      # UniFit ranking, UniChance estimation, ROI
      universities.py    # University filtering, search, projections
      search.py          # Text search with hidden aliases
      exams.py           # Exam normalization and validation
      languages.py       # Language proficiency validation
      ml_scoring.py      # Semantic embeddings (E5 model) + TF-IDF fallback
      text_translation.py # LibreTranslate integration for interests
      finance_modes.py   # Study mode and cost extraction
      exam_support.py    # Exam support utilities
    schemas/
      payloads.py        # Pydantic models for profile, exams, languages
    core/
      settings.py        # Environment config (reads backend/.env)
      security.py        # Rate limiting, ops auth, client IP
      redis_store.py     # Redis cache helpers
      observability.py   # Sentry, metrics (Prometheus)
  data/
    universities.json           # Main dataset (sync target)
    official_facts.json         # Curated optional facts (source of truth)
    official_admissions.json    # Curated admissions data (source of truth)
    universities_translations.json  # Russian translations
    exams.json, languages.json, cities.json
    university_assets/          # Logos, thumbnails (small variants for lists)
  scripts/
    apply_official_facts.py     # Sync official_facts → universities.json
    apply_official_admissions.py # Sync official_admissions → universities.json
    audit_universities_data.py  # Validate dataset integrity
  tests/                        # Pytest unit tests
```

### Frontend Structure
```
frontend/
  javascript/
    main.js              # Entry point, page routing, i18n init
    components.js        # Reusable UI (navbar, profile panel, cards)
    utils.js             # API helpers, theme, config, image fallbacks
    i18n.js              # Localization engine
    routes.js            # Client-side routing logic
    icons.js             # Heroicons registry
    university-translations.js  # Russian university names
    pages/
      universities.js    # Catalog list + tabs (catalog/ranking/compare)
      university.js      # University detail page
      ranking.js         # Ranking page (legacy, redirects to universities?tab=ranking)
      guide.js           # Guide page
      _shared.js         # Shared page helpers
    components/          # (new modular structure in progress)
    utils/               # (new modular structure in progress)
  css/
    style.css            # Global tokens, reset, layout
    universities.css, university.css, ranking.css, guide.css, about.css, index.css
  Localization/
    eng/                 # English translations (JSON)
    ru/                  # Russian translations (JSON)
  *.html                 # Page templates
  env.js                 # Generated runtime config (API base URL, version)
  config.js              # Frontend config loader
```

### Key Data Flow

**University List/Search:**
1. Frontend → `GET /universities?search=...&country=...&budget_max=...`
2. Backend `universities.py` filters dataset by location, cost, exams, languages
3. Backend `search.py` matches query against names, aliases, cities, countries
4. Returns projected cards with `id`, `name`, `location`, `cost_summary`, `logo_url`

**UniFit Ranking (AI Sort):**
1. Frontend → `POST /universities/ai-sort` with profile (interests, exams, GPA, budget)
2. Backend `ai_scoring.py` → `ml_scoring.py` generates semantic embeddings or TF-IDF
3. Combines ML similarity + hard filters (budget, exams, languages) → UniFit score
4. Returns ranked list with `unifit_score`, `unifit_badge`, `match_reasons`

**UniChance Estimation:**
1. Frontend → `POST /universities/{id}/uni-chance` with profile + selected track
2. Backend `ai_scoring.py` compares user exams/GPA against track score profiles
3. Returns `chance_pct`, `confidence`, `missing_requirements`, `track_context`

**Translations:**
- University names: `GET /universities/translations` returns Russian names
- UI strings: Frontend loads `Localization/{eng,ru}/*.json` on init
- User interests: Backend translates to English via LibreTranslate for ML embeddings

## Critical Rules

### Data Integrity
- **Official sources only:** Use official university pages, admissions pages, or university-hosted PDFs. Never use aggregators, marketing sites, or inferred data.
- **Prefer missing over invented:** Empty fields are better than guesses.
- **Sync workflow:** Edit `official_facts.json` or `official_admissions.json`, then run sync scripts. Do not hand-edit `universities.json` for curated facts.
- **Display names:** Full university names only. Put abbreviations in `hidden_search_aliases` (see `universities.py`).

### Frontend
- **Localization:** Keep `frontend/Localization/eng` and `frontend/Localization/ru` in sync. Use `data-i18n` attributes.
- **Themes:** Maintain light and dark mode support. Use CSS variables from `style.css`.
- **No hardcoded URLs:** Use `API_BASE` from `frontend/config.js` (reads `env.js`).
- **Icons:** Use Heroicons via `frontend/javascript/icons.js`. Run `npm run sync:heroicons` only when icon sources change.
- **Design system:** Follow `docs/design-system.md` (Calm Academic Workspace style). Avoid decorative gradients, heavy shadows, plastic SaaS styling.

### Backend
- **API contracts:** Define schemas in `backend/app/schemas/payloads.py` (Pydantic).
- **Rate limiting:** Expensive endpoints (`/universities/ai-sort`, `/uni-chance`, `/roi`) have separate rate limits.
- **Caching:** Redis for university lists, AI sort results (TTL configurable via `.env`).
- **Security:** Validate all inputs. Never expose raw errors to frontend. Use `OPS_ADMIN_TOKEN` for `/ops/*` and `/metrics`.
- **ML runtime:** Semantic embeddings mode (`intfloat/multilingual-e5-base`) with TF-IDF fallback. First startup may be slow (model download).

### Testing
- **Backend:** Write focused unit tests in `backend/tests/`. Use pytest fixtures from `_fixture_utils.py`.
- **E2E:** Playwright tests in `tests/e2e/`. PR profile runs Chromium only, nightly runs full matrix.
- **i18n checks:** `npm run check:i18n` validates localization key parity between `eng` and `ru`.

### Version Control
- **Changelog:** Update `CHANGELOG.md` for visible features, API changes, data updates, or UI changes.
- **No secrets:** Never commit `.env`, tokens, local IPs, cookies, logs, or generated dumps.
- **Git hooks:** Do not skip hooks (`--no-verify`) unless explicitly required.

## Common Patterns

### Adding a New Filter
1. Update `backend/app/services/universities.py` filter logic
2. Add query parameter to `backend/app/routers/universities.py`
3. Update frontend filter UI in `frontend/javascript/pages/universities.js`
4. Add localization keys to `frontend/Localization/eng/*.json` and `ru/*.json`
5. Add backend test in `backend/tests/test_university_*.py`

### Adding a New University
1. Add entry to `backend/data/universities.json` with required fields: `id`, `name`, `location`, `url`
2. Add Russian translation to `backend/data/universities_translations.json`
3. Add hidden search aliases to `backend/app/services/universities.py` → `_HIDDEN_SEARCH_ALIASES_BY_UNIVERSITY_ID`
4. Add logo/thumbnail to `backend/data/university_assets/logos/` and `logos-small/`
5. Run audit: `python backend/scripts/audit_universities_data.py`

### Updating Official Facts
1. Edit `backend/data/official_facts.json` with verified data and source URL
2. Run sync: `python backend/scripts/apply_official_facts.py --verified-at 2026-04-23`
3. Run audit: `python backend/scripts/audit_universities_data.py`
4. Commit both `official_facts.json` and updated `universities.json`

### Adding a Localization Key
1. Add key to `frontend/Localization/eng/common.json` (or relevant file)
2. Add matching key to `frontend/Localization/ru/common.json`
3. Use in HTML: `<span data-i18n="common.key">Fallback</span>`
4. Or in JS: `t("common.key")`
5. Run check: `npm run check:i18n`

## Environment Configuration

### Backend `.env` (key settings)
```env
# CORS (must match frontend origin)
FRONTEND_ORIGINS=http://127.0.0.1:5501

# Redis
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_CACHE_TTL_SEC=60
AI_SORT_CACHE_TTL_SEC=300

# ML
ML_SEMANTIC_EMBEDDINGS_ENABLED=1
ML_SEMANTIC_EMBEDDINGS_MODEL=intfloat/multilingual-e5-base
ML_INTEREST_TRANSLATION_ENABLED=1
LIBRETRANSLATE_URL=http://127.0.0.1:5000/translate

# Security
OPS_ADMIN_TOKEN=<long-random-token>
RATE_LIMIT_ENABLED=1
TRUST_X_FORWARDED_FOR=0  # Set to 1 only behind trusted reverse proxy
```

### Frontend `env.js` (generated)
```env
UNISEARCH_API_BASE_URL=https://api.example.com  # or /api for same-domain
UNISEARCH_USE_PRETTY_URLS=true  # for production with rewrites
```

Generate: `npm run build:frontend-env`

## Troubleshooting

**Backend won't start:**
- Check Python version: `python --version` (need 3.12+)
- Recreate venv if path changed: `rm -rf backend/.venv && python -m venv backend/.venv`
- Check Redis connection if `REDIS_URL` is set

**Frontend 404 / MIME errors:**
- Run frontend server from `frontend/` directory
- Use `python -m http.server 5501` (not `npm run dev:frontend` if that fails)
- Check `frontend/env.js` exists (run `npm run build:frontend-env`)

**Tests failing:**
- Backend: `pip install -r backend/requirements-dev.txt`
- E2E: `npx playwright install chromium`
- Check version sync: `npm run check:version`

**ML embeddings slow/unavailable:**
- First startup downloads model (~500MB)
- Set `ML_SEMANTIC_EMBEDDINGS_ENABLED=0` to use TF-IDF fallback
- Check device: `ML_SEMANTIC_EMBEDDINGS_DEVICE=cpu` (or `cuda` if GPU available)

**Translation not working:**
- Start LibreTranslate: `docker run -d -p 5000:5000 libretranslate/libretranslate`
- Or disable: `ML_INTEREST_TRANSLATION_ENABLED=0`
- Check health: `curl http://127.0.0.1:5000/languages`

## Project Scope

- **In scope:** Bachelor-level university discovery, admissions estimation, cost comparison, UniFit ranking, UniChance estimation.
- **Out of scope:** Master's/PhD programs, application management, document uploads, payment processing.
- **Data philosophy:** Conservative. Official sources only. Missing data preferred over guesses.
- **UI philosophy:** Calm Academic Workspace. Data-dense, trustworthy, fast to scan. Avoid decorative AI-style gradients and plastic SaaS styling.

## Language and Communication

- **Default language:** Russian (unless user requests otherwise)
- **Commit messages:** Meaningful, from user perspective (not bot-like)
- **Code comments:** Minimal, only for non-obvious logic
- **Documentation:** Update `CHANGELOG.md` for behavior/API changes, not for trivial fixes

## UI/UX Design System (Calm Academic Workspace)

**Full specification:** See `docs/design-system.md` for detailed typography, spacing, and component rules.

**Style principles:**
- Native-like productivity tool (Notion/Linear aesthetic), not SaaS/AI landing page
- Data-dense, quiet, trustworthy, fast to scan
- Build working screens first, not decorative landing pages
- Use real university media for identification, not atmospheric imagery

**Forbidden patterns (anti-patterns):**
- Nested cards (use dividing lines instead)
- Pill tabs (use underline tabs only)
- Hardcoded colors (use CSS variables only)
- Heavy/blurred box-shadows (use `var(--shadow-md)` or none)
- Decorative gradients and AI-style glows
- `transition: all` (specify properties)
- Circular pill buttons (use 10-16px border-radius)

**Component standards:**
- Cards: `border: 1px solid var(--line)`, `background: var(--surface-solid)`, radius 16-20px, no shadow by default
- Buttons Primary: `var(--accent)` background, white text, no border
- Buttons Secondary: `var(--surface-soft)` background, `1px solid var(--line)`
- Focus states: `outline: 2px solid var(--accent); outline-offset: 2px;`
- Hover: Change background (`var(--surface-soft)`) or border color, no size increase
- Animations: Only `opacity` and `transform`, spring-style easing
- Tab switching: Use sliding indicator effect

**Required states:**
- Loading: Use `.center-loading-spinner` component
- Empty: Localized empty state message
- Error: Localized error message (never expose raw API errors)

**Icons:**
- Heroicons only via `frontend/javascript/icons.js`
- Always centered with text via flexbox
- Always include `aria-label` for icon-only buttons

## Release Workflow

1. **Check status:** `git status` and `git diff` (verify no secrets, hardcoded text, stray files)
2. **Bump version:** `npm run bump:version -- [patch|minor|major|X.Y.Z]`
3. **Update CHANGELOG.md:** Add changes from current diff to new version block (be concise, focus on behavior/API changes)
4. **Run tests:** `npm run check:i18n && npm run test:backend` (minimum)
5. **Commit and push:** `git add -A && git commit -m "chore(release): X.Y.Z" && git push`
6. **Tag release:** `git tag -a vX.Y.Z -m "UniSearch X.Y.Z" && git push origin vX.Y.Z`
7. **Monitor CI:** Check GitHub Actions for test results

**CHANGELOG.md and AGENTS.md updates:**
- Update only when there are meaningful changes (behavior, API, important patterns)
- Be concise, no fluff
- Skip trivial fixes and internal refactors

## Cross-Platform Compatibility

- **Paths:** Use forward slashes, avoid absolute paths
- **Scripts:** Ensure npm scripts work on Windows, macOS, Linux
- **Line endings:** Git handles CRLF/LF automatically
- **Secrets:** Never commit `.env`, tokens, API keys, local IPs, cookies, logs

## Key Service Logic

**UniFit (AI Ranking):**
- Located in `backend/app/services/ai_scoring.py`
- Combines ML similarity (semantic embeddings or TF-IDF) with hard filters
- Preference sliders weight different factors (cost, location, academics, etc.)
- Returns ranked list with `unifit_score`, `unifit_badge`, `match_reasons`

**UniChance (Admission Probability):**
- Located in `backend/app/services/ai_scoring.py`
- Requires track `score_profile` (percentile data) for accurate estimation
- Falls back to binary requirement matching if no score profile
- Returns `chance_pct`, `confidence`, `missing_requirements`

**ML Scoring:**
- Located in `backend/app/services/ml_scoring.py`
- Primary: Semantic embeddings via `intfloat/multilingual-e5-base`
- Fallback: TF-IDF cosine similarity
- Runtime mode exposed: `semantic`, `tfidf`, `unavailable`

**Search:**
- Located in `backend/app/services/search.py`
- Matches against university names, aliases, cities, countries
- Supports transliteration (e.g., "MIT" matches "МИТ")
- Hidden aliases defined in `universities.py` → `_HIDDEN_SEARCH_ALIASES_BY_UNIVERSITY_ID`

## University Data Rules

**Sources:**
- Official university websites only
- Official admissions pages and PDFs
- University-hosted reports
- **Never:** Aggregators, marketing sites, third-party rankings, inferred data

**Naming:**
- Display names: Full university names only
- Abbreviations: Put in `hidden_search_aliases` (e.g., "MIT" for Massachusetts Institute of Technology)
- Translations: Add to `universities_translations.json` for Russian

**Media:**
- Logos: 1:1 aspect ratio, PNG format
- Thumbnails: 16:9 aspect ratio, JPG format
- Small variants: For list views (logos-small, thumbnails-small)
- University must be recognizable from media

**Curated workflow:**
1. Edit `official_facts.json` or `official_admissions.json` with verified data
2. Run sync scripts to update `universities.json`
3. Run audit to validate integrity
4. Commit both source and target files

## References

- Design system: `docs/design-system.md`
- Contributing guide: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`
- Deployment security: `docs/deployment_security.md`
- UniFit tag rules: `docs/unifit_tag_rules.md`
