# UniSearch / UniFit / UniChance - 2.1.1 (Infomatrix 2026)

## What this project is
UniSearch is a full-stack web app for university selection using:
- structured university data,
- profile-based filtering,
- `UniFit` ranking (prestige/budget/admission-feasibility balance),
- `UniChance` probability (0-100 estimated admission chance).

## Core architecture
- Frontend: Vanilla JS + HTML/CSS (`frontend/`)
- Backend: FastAPI (`backend/app/`)
- Data: JSON datasets (`backend/data/*.json`)

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
4. Final hybrid score (if interests exist):
   - `final_score = 0.7 * hard_score + 0.3 * ml_score`

If translation is unavailable, backend safely falls back to raw text and still returns results.

### Translation safeguards
- in-memory cache (TTL + max items)
- per-client sliding-window rate limit
- provider failure backoff
- short request timeout

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

## Tests
```bash
cd backend
set PYTHONPATH=.
python -m unittest discover tests -v
```

## Repository layout
```text
backend/
  app/
    main.py
    core/
      env.py
      files.py
      paths.py
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
      languages.py
      ml_scoring.py
  data/
    universities.json
    exams.json
    languages.json
    cities.json
  tests/

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
```

## Notes
- Legacy chat assistant feature was removed from project architecture and UI.
- Admissions UI labels (`grant/paid`, aid types, and related badges) are localized for ENG/RUS/KZ.
- Default fallback language remains English when unsupported locale is detected.
