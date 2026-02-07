# UniSearch / UniFit / UniChance / UniMentor - 2.1.0 Beta (Infomatrix 2026)

## What this project is
UniSearch is a full-stack web app that helps applicants choose universities using:
- structured university data,
- profile-based filtering,
- UniFit ranking (AI-like scoring with prestige/budget/admission feasibility balance),
- UniChance probability (0-100 estimated admission chance),
- and UniMentor (AI chatbot consultant for university Q&A)

It is designed to reduce the need for expensive admission consulting by making requirements and fit scoring transparent.

## Version
- Current release: `2.1.0 Beta`

## Product logos (from `frontend/images`)

<p align="center">
  <img src="frontend/images/whitelogo.png" alt="UniSearch light logo" width="220" />
  <img src="frontend/images/darklogo.png" alt="UniSearch dark logo" width="220" />
</p>

`minilogo.png` is a compact fallback logo used when the primary logo file cannot be loaded.

## Architecture (v2.1.0, backend-first)

### High-level flow

```text
[User]
  -> interacts with UI pages
     [Frontend: HTML/CSS/JS]
       -> sends GET/POST JSON requests
          [FastAPI Backend: routers]
            -> calls service layer
               [Services: filtering/sorting/ranking/AI scoring]
                 -> reads canonical datasets
                    [backend/data/*.json]
                 <- returns computed results
            <- returns UI-ready JSON
       <- renders cards/map/details/charts/chat
  <- sees final results
```

### Responsibility split

#### Backend (FastAPI)
- Source of truth for business logic and data access.
- Reads and validates data from `backend/data/*.json` (or future DB).
- Performs filtering, search, sorting, ranking, pagination.
- Computes UniFit ordering, UniChance probability, ROI, gap coaching.
- Returns ready-to-render JSON for list, map, ranking, and detail pages.

#### Frontend
- Sends query/body parameters to backend endpoints.
- Renders cards, detail sections, map markers, tabs, and chatbot messages.
- Stores only local UI concerns:
  - form state,
  - debounce,
  - cache of already fetched UI data,
  - loading overlays/spinners.

### Why this architecture
- One decision engine for web and future mobile app.
- Smaller frontend complexity and fewer duplicated calculations.
- Easier testing and safer changes to ranking/chance logic.

---

## UniFit AI engine (important for judges)

UniFit is the core decision engine of UniSearch.  
It is not a simple sort-by-rank script. It is a multi-factor recommendation algorithm that evaluates each university against a real applicant profile.

### Inputs UniFit uses
- User profile:
  - academic exams (`SAT`, `ACT`, `GPA`, `UNT`, etc.)
  - language evidence (native / CEFR / language exam)
  - annual budget
  - user preference slider (**budget <-> prestige**)
- University data:
  - global rank, acceptance rate, tuition
  - admission tracks
  - track requirements + typical admitted scores
  - language requirements (mode `all` / `any`)
  - scholarships / aid

### UniFit logic pipeline
1. **Track-level evaluation**  
   For each university, UniFit evaluates every admission track separately.

2. **Requirement scoring (not binary only)**  
   For each required metric, UniFit compares user score vs:
   - minimum required score,
   - typical admitted score (`stats_avg`).
   This gives a graded fit score, not just pass/fail.

3. **Language requirement reasoning**  
   UniFit checks language requirements independently from academic scores:
   - supports `native`, `CEFR`, and exam evidence,
   - supports mode `all` (all language conditions) and `any` (one is enough),
   - supports exam direction where needed (for inverse scales like JLPT levels).

4. **Admission feasibility gate**  
   UniFit computes admission feasibility using requirement fit + acceptance context.  
   High prestige cannot fully dominate if the applicant is very unlikely to pass requirements.

5. **Affordability and aid modeling**  
   UniFit evaluates affordability against budget and adjusts score with scholarship/aid signals:
   - over-budget tracks are penalized,
   - aid-eligible tracks get reduced/removed budget penalty.

6. **Preference mixing (slider)**  
   Final score combines prestige and affordability according to user-selected priority.

7. **Best-track selection**  
   For each university, UniFit keeps the highest-scoring track and sorts universities by final score.

### Why this is AI-oriented (Infomatrix AI-programming relevance)
- Uses algorithmic multi-objective optimization (prestige, cost, feasibility).
- Uses structured knowledge representation (tracks, exams, language rules, scholarships).
- Uses profile personalization (same university ranks differently for different users).
- Uses explainable outputs (badges, track labels, min vs typical scores, language rule display).

---

## UniChance AI engine (0-100 probability)

UniChance is a second AI function that estimates your admission probability for a university from **0 to 100**.

### What UniChance solves
- UniFit tells you "what is best for me overall?"
- UniChance tells you "how likely am I to enter this university/track?"

Together they provide both ranking and probability.

### UniChance algorithm inputs
- user academic exams
- user language evidence (native/CEFR/exam)
- user budget
- track minimums and `stats_avg`
- language requirements (`all` / `any`)
- university selectivity (acceptance rate)
- aid/scholarship context

### UniChance pipeline
1. Evaluate each admission track independently.
2. Score each requirement against minimum and typical admitted values.
3. Evaluate language bundle rules with native/CEFR/exam alternatives.
4. Apply feasibility gate when hard minimums are not met.
5. Add selectivity and affordability context.
6. Return:
   - per-track chance,
   - overall university chance,
   - best track.

### Output interpretation
- **80-100**: high chance
- **60-79**: good chance
- **40-59**: moderate chance
- **0-39**: low chance

UniChance is rendered in the University -> Admission tab with a dedicated UI panel and track chips.

---

## UniMentor AI engine (smart chatbot consultant)

UniMentor is a chatbot assistant focused on university questions.

### What it does
- Answers questions about admission, language requirements, tuition, scholarships, rank, and location.
- Uses your own university database as primary source.
- Handles secondary university questions that are usually not stored in your DB (for example: "Who is the owner of this university?").
- Optionally augments answers with free online context.

### Methods supported
UniMentor supports 2 modes:
1. **Local free mode** (default):
   - Database retrieval + rule-based reasoning from `universities.json`
   - Profile-aware fallback analysis (best track, missing requirements, language and budget checks)
   - Quick follow-up options in chat (one-click suggested questions)
   - Improvement roadmap mode (prioritized steps to increase admission chance)
   - Track comparison mode (top tracks + blockers)
   - Optional free web enrichment (Wikipedia REST + DuckDuckGo Instant Answer)
2. **Gemini mode** (smarter LLM):
   - Uses Google Gemini API (recommended model: `gemini-2.0-flash`)
   - Can use Google Search grounding when enabled
   - Receives both user profile + selected university context before answering

Notes:
- Gemini has a free tier, but quotas/rate limits apply and may change over time.
- Keep fallback to local mode for reliability when quota/network fails.

### How to enable UniMentor

Frontend (`frontend/config.js`):
- `window.UNIMENTOR_CONFIG.enabled = true`
- `window.UNIMENTOR_CONFIG.online = true` (optional web context)
- `window.UNIMENTOR_CONFIG.mode = "auto"` (default mode in UI: `auto | gemini | fallback | local`)

Backend environment:
- `UNIMENTOR_ENABLE_ONLINE=1` to allow online enrichment
- `UNIMENTOR_ENABLE_ONLINE=0` for offline/database-only mode
- optional: `UNIMENTOR_NAME=UniMentor` and `UNIMENTOR_TIMEOUT=6`
- `UNIMENTOR_PROVIDER=local` (default) or `UNIMENTOR_PROVIDER=gemini`
- `GEMINI_API_KEY=...` (required for Gemini mode)
- optional: `UNIMENTOR_GEMINI_MODEL=gemini-2.0-flash`
- optional: `UNIMENTOR_GEMINI_FALLBACK_MODEL=gemini-2.0-flash-lite` (used automatically on quota 429)
- optional: `UNIMENTOR_GEMINI_ENABLE_WEB=1` (Google Search grounding)

Troubleshooting:
- After changing `backend/.env`, restart backend server (`uvicorn`).
- `provider` in `/mentor/ask` response shows which mode actually answered (`gemini` or `local`).
- If `provider_requested` starts with `gemini` but `provider=local`, check `warning` (most common: invalid key, quota, blocked network).
- In University → UniMentor tab, users can choose model mode and see current active mode badge (`Now: Gemini(...)` or `Now: Local fallback model`).

### Endpoint
- `POST /mentor/ask`
  - input: `question`, optional `university_id`, optional `online`, optional `profile`
  - output: `answer`, `sources`, `online_used`, `provider`

---

## Rename AI function names from config

All AI function names in UI are loaded from `frontend/config.js`:

```js
window.AI_FUNCTIONS = {
  fit: "UniFit",
  chance: "UniChance",
  mentor: "UniMentor",
};
```

Change these names once, and UI labels update across pages.

Feature flags are also loaded from `frontend/config.js`:

```js
window.FEATURE_FLAGS = {
};
```

---

## Social impact (Infomatrix mission fit)

UniSearch addresses inequality in admissions guidance:
- **Access**: gives free, understandable recommendations without paid consultants.
- **Transparency**: shows why a university is recommended (requirements, cost, language fit, aid, UniChance score) and lets users ask follow-up questions via UniMentor.
- **Financial awareness**: highlights affordability and scholarships early, reducing risky choices.
- **Inclusion**: supports non-English tracks and multiple proof formats (native, CEFR, exams).
- **Decision quality**: helps students choose realistic and high-opportunity paths based on data.

In short, UniFit + UniChance + UniMentor convert complex admission data into actionable, explainable guidance for students from different economic backgrounds.

---

## Quick start for non-technical users

If you are just using UniSearch (not developing it), this is the fastest flow:

1. Open **Universities** page.
2. Click **Profile** and add your:
   - budget,
   - exam scores (SAT/ACT/GPA/etc.),
   - language proof (native/CEFR/exam).
3. Set your preference slider (**Budget <-> Prestige**).
4. Browse ranked universities and open details.
5. On each university, check:
   - best-matching admission track,
   - UniChance probability (0-100),
   - minimum vs typical admitted scores,
   - language requirements,
   - grants/scholarships and estimated yearly cost,
   - ask UniMentor for extra context.

You can also open **Guide** page to understand terms like CEFR, admission tracks, and score types.

---

## What each page does

- `index.html` (Home): project overview and entry point.
- `universities.html` (Main search): filters + UniFit ranking + map/list view.
- `university.html` (Details): full information about one university and its tracks + UniChance panel in Admission + UniMentor chat tab.
- `ranking.html` (Rankings): ranking-focused view.
- `guide.html` (Guide): explains admission terms, exams, and language proofs in simple words.
- `about.html` (About Us): team introduction, contact blocks (mail/GitHub/social templates), and profile cards with PNG photo placeholders.

---

## How to read the profile fields

- **Budget (USD/year)**: your maximum comfortable yearly cost.
- **Exams**: academic exams (SAT, ACT, GPA, UNT, etc.).  
  The app validates format/range automatically.
- **Languages**:
  - **Native**: language is your native proficiency.
  - **CEFR**: level from A1 to C2.
  - **Exam**: certificate score (IELTS, TOEFL, TestDaF, etc.), validated by exam type/range/step.

Tip: language and academic exams are handled separately; both can affect matching.

---

## How to read results and badges

- **Requirements Met**: your profile passes minimum requirements for the selected track.
- **Below Requirements**: some minimum score(s) are not met.
- **Aid/Grant badges**: scholarships or aid are available/likely for your profile.
- **Over Budget**: estimated annual cost is above your budget (after applicable aid logic).

On university details page:
- **Minimum To Apply** = hard threshold.
- **Real Average (Admitted)** = typical admitted student scores.
- **Language Track Rules**:
  - `mode = all`: all listed language proofs are required.
  - `mode = any`: any one listed language option is enough.

---

## Main updates in this version

### 1) Backend-first decision logic
UniFit and UniChance calculations were moved from frontend modules to backend services/routes:
- `POST /universities/ai-sort` (server-side UniFit ranking + pagination)
- `POST /universities/{id}/uni-chance` (server-side UniChance output)
- `POST /universities/{id}/roi` (server-side ROI estimate for detail page)

This keeps business logic centralized for web + future mobile clients.

### 2) Frontend simplified to UI/rendering
Frontend now focuses on:
- collecting filters/profile input,
- calling backend endpoints,
- rendering returned JSON,
- local UI state/caching/debounce.

Old client-side scoring modules were removed from active architecture.

### 3) Loading animation improvements
Loading visuals now cover backend wait states in major user flows:
- Universities page: centered large white spinner + dimmed content area while loading list/map.
- University details page: centered large white spinner overlay while details/chance/ROI are fetched.

### 4) Ranking and sort consistency
- Ranking page now requests backend-sorted ranking (`sort=rank_asc`) instead of client-side re-sorting.
- UniFit slider visibility state on page load was fixed when sort is restored from saved filters.

### 5) Existing data/config flow remains server-validated
- Academic exams config: `backend/data/exams.json` via `GET /exams/config`
- Language config: `backend/data/languages.json` via `GET /languages/config`
- Validation endpoints:
  - `POST /exams/validate`
  - `POST /languages/validate`

---

## Tech stack

### Frontend
- Vanilla JS (ES modules)
- HTML/CSS pages
- Main modules:
  - `frontend/javascript/main.js` - app entry/router
  - `frontend/javascript/components.js` - navbar/profile modal
  - `frontend/javascript/pages.js` - page logic/rendering + backend API integration
  - `frontend/javascript/ai/mentor.js` - UniMentor chat client
  - `frontend/javascript/languages.js` - language profile UI logic
  - `frontend/javascript/utils.js` - config/profile/helpers + AI name config reader

### Backend
- FastAPI (Python)
- Main app:
  - `backend/app/main.py`
  - `backend/app/services/ai_scoring.py` - UniFit/UniChance/ROI scoring service
- Data:
  - `backend/data/universities.json`
  - `backend/data/exams.json`
  - `backend/data/languages.json`
  - `backend/data/cities.json`

---

## API overview

- `GET /universities` - search/list with filters + pagination
- `POST /universities/ai-sort` - backend UniFit ranking for list page
- `GET /universities/{id}` - single university details
- `POST /universities/{id}/uni-chance` - backend UniChance probability response
- `POST /universities/{id}/roi` - backend ROI estimation for profile + university
- `POST /universities/{id}/gap-coach` - profile gap analysis/actions
- `GET /locations` - countries/states/cities
- `GET /stats` - homepage aggregate stats
- `GET /exams/config` - full academic exam config (min/max/type/step/notes)
- `GET /exams/config/full` - full exam config (same source)
- `POST /exams/validate` - validate one academic exam score
- `GET /languages/config` - languages/CEFR/language exam config
- `POST /languages/validate` - validate one language evidence item
- `POST /mentor/ask` - UniMentor chatbot endpoint (DB answer + optional free web context)

Backend default local URL: `http://127.0.0.1:8000`

---

## Run locally

## 1) Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional UniMentor backend env:
```bash
set UNIMENTOR_ENABLE_ONLINE=1
set UNIMENTOR_NAME=UniMentor
set UNIMENTOR_PROVIDER=gemini
set GEMINI_API_KEY=your_api_key_here
set UNIMENTOR_GEMINI_MODEL=gemini-2.0-flash
set UNIMENTOR_GEMINI_FALLBACK_MODEL=gemini-2.0-flash-lite
set UNIMENTOR_GEMINI_ENABLE_WEB=1
```

## 2) Frontend
Use any local HTTP server (do not use `file://`).

Example:
```bash
cd frontend
python -m http.server 5501
```

Open:
- `http://127.0.0.1:5501/index.html`
- `http://127.0.0.1:5501/universities.html`
- `http://127.0.0.1:5501/guide.html`
- `http://127.0.0.1:5501/about.html`

Note: backend CORS default origin is `http://127.0.0.1:5501`.

---

## Data model notes

## Universities
Each university can include:
- general metadata,
- finance block,
- outcomes block,
- multiple admission tracks.

Track can include:
- `requirements`
- `stats_avg`
- `language_requirements`
- `language_requirements_mode` (`all` or `any`)
- `scholarships`
- `finance_override`

## Exams
`exams.json` stores exam rules (`min`, `max`, `type`, `step`, optional notes).

## Languages
`languages.json` stores:
- supported language codes,
- CEFR mapping,
- proof kinds (`native`, `cefr`, `exam`),
- `language_exams` grouped by language code.

---

## How UniFit + UniChance + UniMentor work (high level)
For each university:
1. Evaluate each track against user profile (academic + language requirements).
2. Estimate admission feasibility from requirement fit + acceptance context.
3. Apply affordability scoring (budget, aid, scholarships).
4. Mix prestige vs budget preference using slider.
5. Keep the best track and sort by final UniFit score.
6. Compute UniChance (0-100) for each track and overall university probability.
7. Use UniMentor to ask natural-language questions about the selected university; answer comes from DB and optional free web sources.

Note: in `2.1.0 Beta`, UniFit and UniChance computation is backend-side; frontend only sends parameters and renders responses.

Important: high prestige does not fully override impossible admissions; feasibility still gates ranking.

---

## FAQ (simple)

### Why did a top university appear lower?
Because UniFit does not optimize only prestige. If admission chance is low or cost is too high for your profile, score is reduced.

### What is the difference between UniFit and UniChance?
UniFit is a ranking score for comparing many universities at once.  
UniChance is a probability score (0-100) for one university/track based on your profile.

### What is UniMentor?
UniMentor is a chatbot consultant. It explains university details from your dataset and is especially useful for side questions beyond DB fields (for example: "Who is the owner of this university?") using optional online references when enabled.

### Why can I add some decimal scores but not others?
Each exam has its own type and step rules from config.  
Example: IELTS allows `0.5` steps, many other exams allow only integers.

### Why does one university show multiple admission options?
Because one university can have many tracks (direct, foundation, scholarship path, etc.), each with different requirements and costs.

### Why can language requirement be "not met" even if my academic exams are high?
Academic and language requirements are independent in many tracks. Strong SAT/GPA does not automatically satisfy language proof.

---

## Known limitations
- University dataset is still curated JSON, not a live official API feed.
- Some country-specific admission rules are simplified.
- Salary/ROI proxies are estimates and may be missing for some majors/tracks.

---

## Recommended next steps
- Migrate JSON data to a database (PostgreSQL/MongoDB).
- Add admin ingestion/update tools for university + track data.
- Add authentication and cloud profile storage.
- Add tests for ranking edge cases and language requirement scenarios.

---

## Image assets contract (`frontend/images`)

All university media files are resolved by `university.id`, so naming must match exactly.

Example:
- University id: `mit-usa-cambridge`
- Required files:
  - `frontend/images/logos/mit-usa-cambridge.png`
  - `frontend/images/logos-mobile/mit-usa-cambridge.png`
  - `frontend/images/thumbnails/mit-usa-cambridge.jpg`
  - `frontend/images/thumbnails-mobile/mit-usa-cambridge.jpg`

### What each images folder contains
- `frontend/images/whitelogo.png`: main app logo for light backgrounds/navigation.
- `frontend/images/darklogo.png`: main app logo for dark backgrounds/navigation.
- `frontend/images/minilogo.png`: fallback logo if primary logo is missing.
- `frontend/images/logos/`: desktop university logos (`.png`), used in cards/map/details.
- `frontend/images/logos-mobile/`: optimized mobile logos (`.png`) for small screens/slow networks.
- `frontend/images/thumbnails/`: desktop hero/card photos (`.jpg`).
- `frontend/images/thumbnails-mobile/`: optimized mobile photos (`.jpg`).

### Recommended asset specs
- Logo format: transparent `.png`, square, clear at `44x44` and `96x96`.
- Thumbnail format: `.jpg`, landscape ratio (recommended `16:9`).
- Keep desktop/mobile pairs visually consistent (same university, same composition).
- Avoid spaces in filenames; use the exact `university.id` slug.

---

## File and folder meaning

### Backend
- `backend/app/main.py`: FastAPI app bootstrap, CORS, router registration.
- `backend/app/routers/`: HTTP endpoints (universities, exams, languages, mentor, root).
- `backend/app/services/`: core logic (search/filter/sort, AI scoring, validation, mentor logic).
- `backend/app/core/`: shared backend infrastructure (settings, env, paths, security helpers).
- `backend/data/`: canonical datasets (`universities.json`, `exams.json`, `languages.json`, `cities.json`).
- `backend/requirements.txt`: Python dependencies.

### Frontend
- `frontend/index.html`: landing/stats entry page.
- `frontend/universities.html`: main search/list/map page.
- `frontend/university.html`: university detail page (overview/admission/ROI/mentor).
- `frontend/ranking.html`: rank-focused page.
- `frontend/guide.html`: user guide/tutorial page.
- `frontend/about.html`: project/about page.
- `frontend/javascript/main.js`: app startup and per-page initialization.
- `frontend/javascript/pages.js`: page orchestration, backend API calls, rendering logic.
- `frontend/javascript/components.js`: shared UI components (navbar/tabs/modal behaviors).
- `frontend/javascript/utils.js`: helpers, config readers, profile/local storage utilities.
- `frontend/javascript/ai/mentor.js`: UniMentor chat UI client.
- `frontend/css/`: page-specific and shared styles.
- `frontend/images/`: brand assets, university logos, and thumbnails.
- `frontend/config.js`: frontend runtime config (API base URL, feature flags, AI names, app version).
- `frontend/sw.js`: service worker for caching/offline support.

### Root
- `README.md`: architecture, setup, API, and data model documentation.
- `LICENSE`: project license.
- `.gitignore`: ignored files/directories for git.

---

## Project structure

```text
backend/
  app/
    main.py                       # FastAPI app entrypoint + router mounting + CORS
    core/                         # shared backend infra
      env.py                      # env variable parsing helpers
      files.py                    # safe file read/write utilities
      paths.py                    # central project/data paths
      security.py                 # security-related helpers
      settings.py                 # runtime settings object
    routers/                      # HTTP endpoints layer
      root.py                     # health/version endpoints
      universities.py             # list/detail/ai-sort/chance/roi/gap-coach endpoints
      exams.py                    # exam config + validation endpoints
      languages.py                # language config + validation endpoints
      mentor.py                   # UniMentor ask endpoint
    services/                     # business logic layer (no UI)
      universities.py             # filtering/search/sort/pagination/location stats logic
      ai_scoring.py               # UniFit/UniChance/ROI calculations
      gap_coach.py                # profile gap analysis/recommendations
      exams.py                    # exam validation logic
      languages.py                # language validation logic
      mentor.py                   # mentor answer generation/orchestration
  data/                           # source data (replaceable by DB in future)
    universities.json             # universities + tracks + requirements + finance/outcomes
    exams.json                    # academic exam constraints (min/max/type/step)
    languages.json                # language/CEFR/exam requirement config
    cities.json                   # country/state/city reference
  requirements.txt                # backend dependencies

frontend/
  index.html                      # landing page
  universities.html               # search/list/map page
  university.html                 # single university details page
  ranking.html                    # ranking-focused page
  guide.html                      # user tutorial/guide
  about.html                      # about/contact page
  config.js                       # frontend runtime config (API URL, flags, names, version)
  sw.js                           # service worker (cache/offline behavior)
  theme-init.js                   # early theme bootstrap
  css/
    style.css                     # shared global styles
    universities.css              # list/map page styles + loading overlays
    university.css                # details page styles + loading overlays
    ranking.css                   # ranking page styles
    guide.css                     # guide page styles
    about.css                     # about page styles
    index.css                     # landing page styles
  javascript/
    main.js                       # page routing + app bootstrap
    pages.js                      # page logic, backend calls, rendering
    components.js                 # reusable UI components
    languages.js                  # profile language UI logic
    utils.js                      # common helpers/config/profile/localStorage
    ai/
      mentor.js                   # UniMentor frontend chat client
  images/
    whitelogo.png                 # app logo for light contexts
    darklogo.png                  # app logo for dark contexts
    minilogo.png                  # fallback compact logo
    logos/                        # desktop university logos: PNG, 1:1, filename = university.id
                                  # example: mit-usa-cambridge.png
    logos-mobile/                 # optimized mobile version of logos/ (same filename rule)
    thumbnails/                   # desktop university photos: JPG, recommended 16:9
                                  # example: mit-usa-cambridge.jpg
    thumbnails-mobile/            # optimized mobile version of thumbnails/ (same filename rule)
```
