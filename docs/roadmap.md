# UniSearch Product Roadmap

This document outlines the planned direction, engineering tracks, and product milestones for UniSearch.
Items are ordered by strategic execution phases and dependencies rather than fixed calendar dates.

---

## Strategic Phases & Milestones

```
Phase 1: Stabilization & Refinement
  ├── [Core & Polish] Product Stabilization & UI Polish (In Progress)
  ├── [Features & UX] Percentage GPA Scale (0–100%)
  └── [Features & UX] Preferred Instruction Language & Program Warnings

Phase 2: Authentication & Persistence
  ├── [Backend & Infra] Google Accounts Sign-In & Cloud Profile Sync
  └── [Backend & Infra] Database Migration to PostgreSQL

Phase 3: Mobile Experience & Rich Media
  ├── [Mobile] Native Android App in Kotlin (Jetpack Compose)
  └── [Features & UX] Campus Media Gallery on University Detail Pages

Phase 4: Academic Expansion & Community
  ├── [Expansion] Multi-Degree Level Expansion (Master's & PhD)
  ├── [Features & UX] Student & Alumni Reviews and Community Ratings
  └── [Expansion] Global Catalog Scaling (100+ Institutions)
```

---

## Phase 1: Stabilization & Refinement

### 1. Product Stabilization, Bug Fixes, and UI Polish
* **Track:** Core & Polish
* **Priority:** P1 (High)
* **Status:** In Progress
* **Goal:** Complete the current stabilization cycle of the UniSearch web platform, eliminate accumulated edge-case issues, and establish a resilient engineering baseline.
* **Key Tasks:**
  - **Design & Typography:** Audit all screens against the Calm Academic Workspace specification (`frontend/css/style.css`, `docs/design-system.md`). Eliminate visual noise, unnecessary box borders, and align spacing to the 4/8-px grid.
  - **Static & Token Guards:** Ensure 100% pass rate across baseline health scripts (`npm run check:tokens`, `npm run check:i18n`, `npm run audit:data`).
  - **Catalog Verification:** Lock the current catalog scope (50 institutions) and verify all official admissions URLs and program links.
  - **Test Suite Depth:** Cover critical user journeys with Playwright E2E scenarios and maintain >= 80% statement and branch coverage across both frontend and backend.

### 2. Percentage GPA Scale Support (0–100%)
* **Track:** Features & UX
* **Priority:** P2 (Medium)
* **Status:** Planned
* **Goal:** Add academic performance input and evaluation using percentage scales (0–100%) to accommodate international applicants (CIS, Central Asia, Europe) whose secondary education does not use standard 4.0 GPA.
* **Key Tasks:**
  - **Frontend:** Add a scale selector (4.0 / 5.0 / 100%) in the catalog filters and UniChance profile drawer.
  - **Backend:** Implement robust score normalization in `backend/app/services/ai_scoring.py` for admission probability estimation.
  - **Validation:** Enforce bounds validation (0–100) and reject malformed inputs.
  - **Localization:** Provide English and Russian localization strings in `frontend/Localization/`.
* **Dependencies:** Follows completion of the UI stabilization cycle.

### 3. Preferred Instruction Language & Program Warning Badges
* **Track:** Features & UX
* **Priority:** P2 (Medium)
* **Status:** Planned
* **Goal:** Help prospective students identify degree programs taught in their target language (e.g. English, Kazakh, Russian, German) without completely hiding universities with mixed offerings.
* **Key Tasks:**
  - **Soft Filtering:** Add a "Preferred language" preference in catalog filters that deprioritizes rather than hard-excludes universities offering programs in other languages.
  - **Language Badges:** Display subtle, accessible indicators on catalog cards and detail pages when a program's primary language differs from the selected preference.
  - **Data Structure:** Audit and structure program instruction languages in `backend/data/`.
  - **Localization:** Add localized language labels and explanatory tooltips.
* **Dependencies:** Follows percentage GPA support, prior to major infrastructure migrations.

---

## Phase 2: Authentication & Persistence

### 4. Google Accounts Sign-In & Cloud Profile Sync
* **Track:** Backend & Infra
* **Priority:** P1 (High)
* **Status:** Planned
* **Goal:** Allow applicants to authenticate via Google, securely store their profile preferences, save shortlisted institutions, and seamlessly synchronize state across devices and the upcoming Android app.
* **Key Tasks:**
  - **Authentication:** Integrate Google OAuth2 / OpenID Connect on the backend (FastAPI) with secure, stateless JWT sessions and CSRF protection.
  - **User Interface:** Introduce an unobtrusive "Sign in with Google" control in the navbar aligned with the borderless design language.
  - **Cloud Synchronization:** Synchronize saved universities (bookmarks), exam scores (SAT/IELTS/GPA), and target majors between localStorage and cloud storage upon login.
  - **Cross-Platform Contracts:** Design API authentication endpoints to be directly consumable by both the web client and the Kotlin mobile application.
* **Dependencies:** Follows Phase 1 UI features; establishes the foundation for database migration and mobile sync.

### 5. Database Migration to PostgreSQL
* **Track:** Backend & Infra
* **Priority:** P1 (High)
* **Status:** Planned
* **Goal:** Transition persistence from flat JSON files to a relational database (PostgreSQL) for ACID compliance, user profile storage, session management, and scalable concurrent reads.
* **Key Tasks:**
  - **Schema Architecture:** Define relational models using SQLAlchemy 2.0 (`users`, `user_favorites`, `universities`, `programs`, `admission_criteria`).
  - **Database Migrations:** Configure Alembic for declarative schema versioning and zero-downtime migrations.
  - **Data Migration:** Build and verify a lossless migration script exporting all 50 existing institutions into PostgreSQL with Pydantic validation.
  - **Query Performance:** Add indexing for full-text search, filter combinations, and geographic bounding queries.
  - **Contract Preservation:** Keep existing REST API endpoint contracts unchanged to ensure uninterrupted frontend compatibility.
* **Dependencies:** Depends on Google Auth integration; must complete before mobile app launch and user reviews.

---

## Phase 3: Mobile Experience & Rich Media

### 6. Native Android App in Kotlin (Jetpack Compose)
* **Track:** Mobile
* **Priority:** P1 (High)
* **Status:** Planned
* **Goal:** Build a native Android application using Kotlin and Jetpack Compose to expand accessibility for students across mobile-first regions.
* **Key Tasks:**
  - **Modern Mobile UI:** Implement a Material 3 / Calm Academic UI in Jetpack Compose adhering to the web design system tokens.
  - **API Integration:** Connect to the FastAPI REST endpoints (catalog search, detailed university sheets, comparison tray).
  - **Algorithms:** Support personalized UniFit recommendations and UniChance admissions calculation.
  - **Authentication & Sync:** Google Sign-In with profile synchronization shared with the web app.
  - **Offline Resilience:** Local Room caching of previously viewed institutions and saved favorites.
* **Dependencies:** Depends on REST API stability, Google Auth, and PostgreSQL backend.

### 7. Campus Media Gallery on University Detail Pages
* **Track:** Features & UX
* **Priority:** P2 (Medium)
* **Status:** Planned
* **Goal:** Enhance visual discovery by introducing a dedicated "Gallery" tab on university detail pages featuring high-resolution campus photography.
* **Key Tasks:**
  - **Gallery UI:** Implement an accessible gallery tab with sliding indicator, responsive thumbnail grid, and keyboard-navigable lightbox.
  - **Content Acquisition:** Gather and verify official photography (campuses, lecture halls, libraries, dormitories, sports facilities) for all 50 catalog institutions.
  - **Asset Optimization:** Convert media to modern WebP format, generate responsive `srcset` thumbnails, and enforce lazy loading.
  - **Media Storage:** Organize asset directories in `backend/data/university_assets/gallery/` with CDN caching rules.
* **Dependencies:** Executed on the initial 50 universities before catalog expansion to maintain quality control.

---

## Phase 4: Academic Expansion & Community

### 8. Multi-Degree Level Expansion (Master's & PhD)
* **Track:** Expansion
* **Priority:** P2 (Medium)
* **Status:** Planned
* **Goal:** Expand product scope beyond Bachelor's degrees to support Master's and Doctoral (PhD) programs.
* **Key Tasks:**
  - **Scope Revision:** Formally update `AGENTS.md` and data models to support multi-level degree admissions.
  - **Program Schema:** Add `degree_level` (Bachelor, Master, PhD) and advanced criteria (GRE/GMAT, research publications, portfolio requirements, work experience).
  - **Algorithm Calibration:** Tune UniFit and UniChance scoring heuristics to account for graduate admissions selectivity.
  - **UI Controls:** Add degree-level switchers across catalog search, comparison trays, and profile settings.
* **Dependencies:** Built on top of PostgreSQL and verified mobile client; precedes catalog expansion.

### 9. Student & Alumni Reviews and Community Ratings
* **Track:** Features & UX
* **Priority:** P3 (Low)
* **Status:** Planned
* **Goal:** Enable verified students and alumni to share authentic academic and campus experiences to guide prospective applicants.
* **Key Tasks:**
  - **Authenticated Reviews:** Restrict reviews to authenticated Google accounts with anti-spam protections.
  - **Evaluation Criteria:** Multi-dimensional rating scales (academics, housing, campus life, career support, community culture).
  - **Catalog Integration:** Sort and filter catalog results by student ratings and review counts.
  - **Moderation:** Implement administrative moderation tooling and community reporting workflows.
* **Dependencies:** Requires Google Auth, PostgreSQL persistence, and degree-level expansion.

### 10. Global Catalog Scaling (100+ Institutions)
* **Track:** Expansion
* **Priority:** P3 (Low)
* **Status:** Planned
* **Goal:** Double catalog coverage from 50 to 100+ institutions across Europe, North America, Asia, and Central Asia.
* **Key Tasks:**
  - **Official Data Ingestion:** Collect verified admissions data strictly following Section 5 of `AGENTS.md` (official university admissions pages and official PDFs; aggregators prohibited).
  - **Institution Media:** Collect verified square logos (1:1 PNG), 16:9 covers, and gallery assets.
  - **Scoring Re-calibration:** Validate multilingual-e5 embeddings and UniFit distribution across the expanded catalog.
  - **Data Auditing:** Run `npm run audit:data` to verify 100% schema and link validity.
* **Dependencies:** Final expansion milestone executed once platform architecture, mobile apps, and community features are fully mature.
