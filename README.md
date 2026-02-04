# UniSearch / UniFit - Beta v2.0 (Infomatrix 2026)

## What this project is
UniSearch is a full-stack web app that helps applicants choose universities using:
- structured university data,
- profile-based filtering,
- and UniFit ranking (AI-like scoring with prestige/budget/admission feasibility balance).

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

## Social impact (Infomatrix mission fit)

UniSearch addresses inequality in admissions guidance:
- **Access**: gives free, understandable recommendations without paid consultants.
- **Transparency**: shows why a university is recommended (requirements, cost, language fit, aid).
- **Financial awareness**: highlights affordability and scholarships early, reducing risky choices.
- **Inclusion**: supports non-English tracks and multiple proof formats (native, CEFR, exams).
- **Decision quality**: helps students choose realistic and high-opportunity paths based on data.

In short, UniFit converts complex admission data into actionable, explainable guidance for students from different economic backgrounds.

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
   - minimum vs typical admitted scores,
   - language requirements,
   - grants/scholarships and estimated yearly cost.

You can also open **Guide** page to understand terms like CEFR, admission tracks, and score types.

---

## What each page does

- `index.html` (Home): project overview and entry point.
- `universities.html` (Main search): filters + UniFit ranking + map/list view.
- `university.html` (Details): full information about one university and its tracks.
- `ranking.html` (Rankings): ranking-focused view.
- `guide.html` (Guide): explains admission terms, exams, and language proofs in simple words.

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
  - `frontend/javascript/languages.js` - language profile UI logic
  - `frontend/javascript/utils.js` - config/profile/helpers

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
- `GET /locations` - countries/states/cities
- `GET /exams/config` - full academic exam config (min/max/type/step/notes)
- `GET /exams/config/full` - full exam config (same source)
- `POST /exams/validate` - validate one academic exam score
- `GET /languages/config` - languages/CEFR/language exam config
- `POST /languages/validate` - validate one language evidence item

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

## How UniFit scoring works (high level)
For each university:
1. Evaluate each track against user profile (academic + language requirements).
2. Estimate admission feasibility from requirement fit + acceptance context.
3. Apply affordability scoring (budget, aid, scholarships).
4. Mix prestige vs budget preference using slider.
5. Keep the best track and sort by final UniFit score.

Important: high prestige does not fully override impossible admissions; feasibility still gates ranking.

---

## FAQ (simple)

### Why did a top university appear lower?
Because UniFit does not optimize only prestige. If admission chance is low or cost is too high for your profile, score is reduced.

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
  css/
    style.css
    universities.css
    university.css
    ranking.css
    guide.css
  javascript/
    main.js
    components.js
    pages.js
    algo.js
    languages.js
    utils.js
  images/
    logos/
    thumbnails/
```
