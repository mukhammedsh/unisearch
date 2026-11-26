# Motion Stage 4 — Profile Rows, Page Disclosures and Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the profile only the exam or language row that changed moves (a new row enters, a removed row fades and closes its gap); native disclosures on the university, profile and guide pages open smoothly; guide sections come in from the direction of travel instead of a ring pulse.

**Architecture:** Reuse stage 2 (`setRevealed`, `.motion-disclosure`) and stage 3 (`.motion-tab-forward/back`). Add two row helpers and an `onHidden` callback to `frontend/javascript/utils/motion-reveal.js`.

**Tech Stack:** Vanilla JS/CSS, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-motion-system-design.md` (stage 4).

**Scope notes:**
- Program cards and route options on the university page already grow and shrink with their own Web Animations code (`admissions-controller.js` ~line 843, `programs-section.js` ~line 323); rewriting them onto `setRevealed` changes no visible behaviour and is left out.
- Comparison: steps were done in stage 3; the "differences only" toggle hides table rows, and animating table row height is not reliable across browsers, so it stays instant.

## Global Constraints

- Stage 1–3 constraints apply (tokens, opacity/transform except the height pattern, reduced motion = instant, logical state first, no dependencies, commit rules).
- A list re-render must not animate rows that were already there; the first render after page load animates nothing.
- `.motion-disclosure` is only added to `<details>` that have no JS-driven animation of their own.

## Review Focus

1. Editing an exam or language re-renders its row as "new" (key changed) — acceptable, but no other row may move. Task 1.
2. Deleting two rows quickly: both collapse, the profile array ends with the right entries removed (indices must be resolved at click time, not after the animation). Task 1.
3. Reduced motion: rows appear/disappear instantly; deletion still updates the profile. Task 1.
4. Guide: jumping from section 1 to section 4 via the side navigation slides forward; using browser back slides back. Task 3.
5. Disclosures inside content re-rendered on language change start closed or keep their state as today. Task 2.

---

### Task 1: Profile exam and language rows

**Files:**
- Modify: `frontend/javascript/utils/motion-reveal.js` (`setRevealed` option `onHidden`; new `readRowKeys`, `enterNewRows`)
- Modify: `frontend/javascript/components/profile/profile-exam-editor.js` (`renderProfileData` ~line 279; delete handler ~line 505)
- Modify: `frontend/javascript/languages.js` (`renderList` ~line 226; delete handler ~line 774)
- Test: `tests/unit/motion-reveal.test.mjs`, `tests/e2e/motion-profile.spec.js` (new)

**Interfaces:**
- `setRevealed(node, visible, { …, onHidden?: () => void })` — `onHidden` runs once after a hide completes (immediately on the instant path); not called when the hide is interrupted by a show.
- `readRowKeys(list: HTMLElement): Set<string> | null` — `null` before the list's first render (`data-rows-rendered` absent), else the `data-row-key` values of its rows.
- `enterNewRows(list: HTMLElement, rowSelector: string, previousKeys: Set<string> | null): void` — sets `data-rows-rendered="1"`; when `previousKeys` is a set, plays `motion-list-item-enter` on rows whose key is not in it (via `markMotionEnter`).
- Row keys: exams `JSON.stringify([ex.exam, formatted value, ex.taken_on])`, languages `JSON.stringify(entry)`.
- Delete: capture the entry index at click time, then `setRevealed(row, false, { onHidden })`; `onHidden` splices by the captured entry identity (not by a stale index) and re-renders.

- [ ] **Step 1: Failing unit tests**: `onHidden runs after the collapse and at once on the instant path`, `onHidden is skipped when a show interrupts the hide`, `enterNewRows animates only rows with unseen keys and nothing on the first render`.
- [ ] **Step 2: Run** `node --test tests/unit/motion-reveal.test.mjs` — FAIL.
- [ ] **Step 3: Implement** helpers.
- [ ] **Step 4: Failing E2E** `motion-profile.spec.js`: on `/profile.html` add ACT 33 then SAT 1400 (pattern from `profile-completion.spec.js`) with the motion recorder → after the second add exactly one `.profile-exam-item.motion-list-item-enter`; delete the first row → the row's animation keyframes include `height` and the list ends with one row containing SAT. Same for languages if the language flow can be driven with the existing selectors; reduced-motion twin for exams.
- [ ] **Step 5: Run** — FAIL. **Step 6: Implement** renderer and delete changes. **Step 7: Run** unit + E2E + `profile-completion`, `profile-composite-exams`, `profile-admission-evidence` specs — PASS.
- [ ] **Step 8: Commit** `feat: animate only the profile row that changed`.

### Task 2: Native disclosures on content pages

**Files:**
- Modify: templates that render `<details>` without their own animation: `frontend/javascript/pages/university/*.js` (classes `admissions-catalog__fact`, `admissions-catalog__evidence`, `admissions-reading__references`, `admissions-programs__references`, `university-coverage-section`, `overview-summary__sources`, `finance-award-details`, `d-facts-sources`, `admissions-special-routes`, `admissions-programs__restricted`, `admissions-context__advanced`, `admissions-catalog__qualification`, `admissions-catalog__assessment-detail`, `mit-admission-analysis`, `track-collapsible-details`), `frontend/javascript/pages/guide.js` (`guide-formula-details`), profile (`profile-admission-evidence`).
- Test: `tests/e2e/motion-profile.spec.js` (or `motion-transitions.spec.js`)

- [ ] **Step 1: Failing E2E** `university disclosures grow open`: on a reviewed university page open one rendered `details.motion-disclosure` (pick the first visible one) and sample `::details-content` block size like `motion-catalog.spec.js` ("catalog disclosures grow open") — early < final. Also assert every `details` on that page (and on `/guide.html`) has the class, except ones listed as excluded.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** by adding the class in each template. **Step 4: Run** spec + `university-detail-design`, `university-admissions-catalog`, `guide` specs that exist — PASS.
- [ ] **Step 5: Commit** `feat: open page disclosures smoothly`.

### Task 3: Guide sections slide in their direction

**Files:**
- Modify: `frontend/javascript/pages/guide.js` (~line 323: replace `motion-state-pulse` with `motion-tab-forward` / `motion-tab-back` by section order)
- Test: `tests/e2e/motion-transitions.spec.js`

- [ ] **Step 1: Failing E2E** `guide sections come in from their direction`: open `/guide.html`, click the next-section button → `motion-tab-forward` seen and no `motion-state-pulse`; previous button → `motion-tab-back`. **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** spec + existing guide specs — PASS.
- [ ] **Step 5: Commit** `feat: slide guide sections in their direction`.

### Task 4: Documentation, changelog, checks

- [ ] Update `docs/design-system.md` Motion section (row rules, disclosure opt-in) and the CHANGELOG 10.8.1 block; run unit tests, all static checks and the motion E2E specs plus the touched page specs; commit `docs: describe profile and page motion rules`.
