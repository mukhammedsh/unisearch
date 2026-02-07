# UniSearch / UniFit / UniChance / UniMentor - Beta v2.0 (Infomatrix 2026)

## What this project is
UniSearch is a full-stack web app that helps applicants choose universities using:
- structured university data,
- profile-based filtering,
- UniFit ranking (AI-like scoring with prestige/budget/admission feasibility balance),
- UniChance probability (0-100 estimated admission chance),
- Gap Coach (profile blockers + prioritized improvement actions),
- and UniMentor (AI chatbot consultant for university Q&A)

It is designed to reduce the need for expensive admission consulting by making requirements and fit scoring transparent.

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
  enable_gap_coach: true,
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
   - Gap Coach readiness score + blockers + priority action plan,
   - minimum vs typical admitted scores,
   - language requirements,
   - grants/scholarships and estimated yearly cost,
   - ask UniMentor for extra context.

You can also open **Guide** page to understand terms like CEFR, admission tracks, and score types.

---

## What each page does

- `index.html` (Home): project overview and entry point.
- `universities.html` (Main search): filters + UniFit ranking + map/list view.
- `university.html` (Details): full information about one university and its tracks + Gap Coach and UniChance panels in Admission + UniMentor chat tab.
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

### 1) Track-based admissions
Universities can have multiple admission tracks (`admission_tracks`), each with:
- its own exam minimums,
- typical admitted scores (`stats_avg`),
- scholarships and finance overrides.

UniFit evaluates tracks separately and chooses the best track for the user.

### 2) Dynamic exams and language exams
Exam limits/types are loaded from backend config, not hardcoded.
- Academic exams: `backend/data/exams.json`
- Language config + language exams: `backend/data/languages.json`

Frontend loads config from:
- `GET /exams/config`
- `GET /languages/config`

Validation happens server-side:
- `POST /exams/validate`
- `POST /languages/validate`

### 3) Language profile support
User can add language evidence in Profile:
- native,
- CEFR level,
- language exam score.

UniFit uses language requirements from track data (`language_requirements`) including:
- mode `all` / `any`,
- native acceptance,
- CEFR threshold,
- exam-specific minimums.

### 4) UX improvements
- Budget filter max set to `150000`.
- Country default option renamed to `🌍 Global`.
- URL query params now keep current filters/page/view correctly.
- New `Guide` page with glossary + exam explanations + dynamic exam references.
- New `About Us` page with:
  - contact cards (email, GitHub, presentation/social template links),
  - team member blocks and roles,
  - black human-icon placeholders for future transparent PNG photos.
- Global navbar updated with `About Us` link (via `components.js`) on all pages.

### 5) Gap Coach (Admission helper)
- New profile-based coach in University -> Admission tab.
- Shows:
  - readiness score (`0-100`) and status (`safe / borderline / at-risk`),
  - top blockers (academic/language/budget),
  - prioritized action plan with estimated chance gain.
- Automatically refreshes after profile update and supports manual re-check.
- Uses frontend stale-while-revalidate behavior:
  - render cached result immediately,
  - revalidate in background and update panel if data changed.

### 6) Performance and caching updates
- University details endpoint uses HTTP caching with `ETag` and `Cache-Control`.
- Gap Coach endpoint uses `ETag` + `Cache-Control: private, max-age=60, stale-while-revalidate=120`.
- Frontend localStorage caches:
  - details cache key: `unisearch_detail_cache_v1`,
  - gap coach cache key: `unisearch_gap_coach_cache_v1`.
- Mobile-optimized thumbnails/logos are preferred on smaller or slower devices.

---

## Tech stack

### Frontend
- Vanilla JS (ES modules)
- HTML/CSS pages
- Main modules:
  - `frontend/javascript/main.js` - app entry/router
  - `frontend/javascript/components.js` - navbar/profile modal
  - `frontend/javascript/pages.js` - page logic/rendering
  - `frontend/javascript/algo.js` - UniFit scoring logic
  - `frontend/javascript/ai/unichance.js` - UniChance probability engine
  - `frontend/javascript/ai/mentor.js` - UniMentor chat client
  - `frontend/javascript/ai/shared.js` - shared AI helpers
  - `frontend/javascript/languages.js` - language profile UI logic
  - `frontend/javascript/utils.js` - config/profile/helpers + AI name config reader

### Backend
- FastAPI (Python)
- Main app:
  - `backend/app/main.py`
- Data:
  - `backend/data/universities.json`
  - `backend/data/exams.json`
  - `backend/data/languages.json`
  - `backend/data/cities.json`

---

## API overview

- `GET /universities` - search/list with filters + pagination
- `GET /universities/{id}` - single university details
- `POST /universities/{id}/gap-coach` - profile gap analysis for best track + blockers + actions
- `GET /locations` - countries/states/cities
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

## Project structure

```text
backend/
  app/
    main.py
  data/
    universities.json
    exams.json
    languages.json
    cities.json
  requirements.txt

frontend/
  index.html
  universities.html
  university.html
  ranking.html
  guide.html
  about.html
  css/
    style.css
    universities.css
    university.css
    ranking.css
    guide.css
    about.css
  javascript/
    main.js
    components.js
    pages.js
    algo.js
    ai/
      shared.js
      unichance.js
      mentor.js
    languages.js
    utils.js
  images/
    logos/
    thumbnails/
```
