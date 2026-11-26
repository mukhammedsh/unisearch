# Motion Stage 3 — Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switching university tabs and comparison steps shows where the user went (a short fade with an 8px offset in the direction of travel), and opening a university from a catalog card carries the card photo into the page cover instead of a flat full-screen fade.

**Architecture:** Tab and step motion reuse `replayMotion` with two new directional keyframes. The cover handoff is a small module that remembers the clicked card image, names it `uni-cover` for the existing router View Transition, and inserts the same (already loaded) thumbnail into the empty `#detailCover` inside the transition callback; the gallery removes that stand-in once the full photo has loaded.

**Tech Stack:** Vanilla JS/CSS, same-document View Transitions (already used by `loadAppRoute` in `frontend/javascript/main.js`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-motion-system-design.md` (stage 3).

**Scope notes:**
- The profile has no tab switching: every section stays visible and the navigation scrolls to a section (see `tests/e2e/motion-interactions.spec.js` "profile category motion…"), so there is nothing to animate there in this stage.
- The spec allowed the cover handoff only with cached detail data, because the cover had to exist when the transition captured the new page. The handoff below does not need the data: it reuses the card thumbnail the browser already decoded and the `#detailCover` box that the static page HTML lays out by itself (`aspect-ratio`), so it never waits for the network. The "cached only" condition is replaced by "the clicked card has a loaded photo".

## Global Constraints

- Stage 1 and 2 constraints apply (tokens, opacity/transform, reduced motion = instant, logical state first, no dependencies, commit rules).
- Directional offset is exactly 8px (`calc(2 * var(--motion-offset-sm))`), `--motion-fast`, `--motion-ease-enter`; forward = from the right, back = from the left. In RTL the same visual rule applies (no RTL locale today; use physical direction).
- The cover handoff must not delay navigation, must not change layout (the stand-in sits absolutely inside the existing cover box), and is skipped when: no View Transition support, reduced motion, the click did not come from a catalog card with a loaded photo, or the destination is not that card's university page. Back navigation keeps the root fade.

## Review Focus

1. Fast double navigation (card click, then another link before the transition ends): no stray `uni-cover` name left on any element, no duplicate-name View Transition error in the console. Task 3.
2. University without a cover photo: no handoff; the page shows its slim photo-missing band as today. Task 3.
3. Full photo fails to load on the detail page: the stand-in is removed and the placeholder shows as today. Task 3.
4. Keyboard tab switching (ArrowLeft/Right, Home/End) gets the same direction as clicks. Task 1.
5. Reduced motion: tabs and steps switch instantly; navigation keeps today's instant swap. Tasks 1–3.

---

### Task 1: Directional university tabs

**Files:**
- Modify: `frontend/javascript/components.js` (`setupTabs` → `activateTab`, ~line 589)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (keyframes `motion-tab-forward` / `motion-tab-back`, classes `.motion-tab-forward` / `.motion-tab-back`, reduced-motion entries)
- Modify: `frontend/css/university/01-shell-hero.css` (replace `.d-tab-pane.active.motion-panel-enter` ~line 626)
- Test: `tests/e2e/motion-transitions.spec.js` (new)

**Interfaces:**
- Produces: classes `motion-tab-forward` and `motion-tab-back` (opacity 0 → 1 with `translateX(±8px)` → 0) usable by any panel switcher.

- [ ] **Step 1: Write failing E2E** `university tabs slide in from the side they come from`: open a university page, record `motion-*` classes (helper `installMotionRecorder`), click the second tab → `motion-tab-forward` seen; press `Home` on the tab list → `motion-tab-back` seen. Reduced-motion twin: neither class produces a running animation on the pane.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**: compute direction from the previous active button index; `replayMotion(targetPane, direction > 0 ? "motion-tab-forward" : "motion-tab-back", { timeoutMs: 320 })`.
- [ ] **Step 4: Run** spec + `tests/e2e/motion-interactions.spec.js` + `tests/e2e/university-detail-design.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: slide university tabs in from their direction`.

### Task 2: Directional comparison steps

**Files:**
- Modify: `frontend/javascript/pages/compare.js` (`replayMotion(container, "motion-panel-enter", …)` ~lines 278 and 345)
- Test: `tests/e2e/motion-transitions.spec.js`

**Interfaces:**
- Consumes: Task 1 classes. Configure → results is forward, results → configure is back; the first render of the page keeps `motion-panel-enter` as today.

- [ ] **Step 1: Write failing E2E** `comparison steps move in their direction`: open `/compare.html?ids=stanford-university-usa-ca,astana-it-university-kaz-astana&stage=configure` (earlier-format pair used in `admissions-cutover.spec.js`), go to results via its continue button → `motion-tab-forward` seen; go back to configure via its back control → `motion-tab-back` seen. If the pair no longer offers a configure step, the test asserts that and the task is dropped with a ledger ruling.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** a `stageMotionClass(fromStage, toStage)` helper in `compare.js`. **Step 4: Run** spec + `tests/e2e/admissions-cutover.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: move comparison steps in their direction`.

### Task 3: Card photo carries into the university cover

**Files:**
- Create: `frontend/javascript/components/cover-transition.js`
- Modify: `frontend/javascript/main.js` (document click handler ~line 758; `loadAppRoute` around `startViewTransition` ~line 683)
- Modify: `frontend/javascript/pages/university/gallery.js` (`renderPreview` ~line 269: remove the stand-in on load or unavailable)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (`.vt-uni-cover`, `::view-transition-group(uni-cover)`, old/new `object-fit: cover`, `.d-cover-handoff` absolute fill)
- Test: `tests/e2e/motion-transitions.spec.js`

**Interfaces:**
- Produces in `cover-transition.js`:
  - `rememberCoverSource(link: HTMLAnchorElement): void` — when `link` is inside `.uni-card` whose `img.uni-media-img` is `complete` with `naturalWidth > 0`, store `{ image, src: image.currentSrc || image.src, href: link.href }`; otherwise clear.
  - `takeCoverHandoff(url: URL): { markSource(): void, inject(): void, settle(): void } | null` — returns a handoff only for the stored card whose `href` equals `url.href`; always clears the stored source. `markSource` adds `vt-uni-cover` to the card image; `inject` (called inside the transition callback after `replaceRouteDom`) prepends `<img class="d-cover-handoff vt-uni-cover" alt="" src="…">` to `#detailCover` and removes the class from the old image; `settle` removes `vt-uni-cover` from the stand-in.
  - `removeCoverHandoff(cover: HTMLElement): void` — used by the gallery.

- [ ] **Step 1: Write failing E2E** `opening a university from its card carries the photo into the cover`: hook `document.startViewTransition` to store the `pseudoElement` names of `document.getAnimations()` after `transition.ready`; click a catalog card overlay link → names include `::view-transition-group(uni-cover)`; after navigation `#detailCover` height equals its height after the page settles (no CLS), and `.d-cover-handoff` is gone once `.d-gallery-preview img` has loaded; no element keeps `vt-uni-cover`. Second test: a card without a photo → no `uni-cover` group. Reduced-motion twin: no transition.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the module, the two `main.js` hooks and the gallery removal.
- [ ] **Step 4: Run** spec + `tests/e2e/university-cover-credit.spec.js`, `tests/e2e/smoke-home.spec.js`, `tests/e2e/motion-interactions.spec.js` ("university detail tabs stay clickable after client-side route") — PASS.
- [ ] **Step 5: Commit** `feat: carry the card photo into the university cover`.
- [ ] If any of the skip conditions or Review Focus items 1–3 cannot be met, revert this task's commit and keep the root fade; record the ruling.

### Task 4: Documentation, changelog and stage check

- [ ] **Step 1:** `docs/design-system.md` Motion section (directional panels, cover handoff rule) and the 10.8.1 CHANGELOG block.
- [ ] **Step 2: Run** `npm run test:unit`, all static checks (design-lint, stylelint, tokens, i18n, encoding, lint:frontend, hardcoded-text, inline-styles) and E2E `motion-transitions`, `motion-catalog`, `motion-layers`, `motion-interactions`, `university-cover-credit`, `university-detail-design`, `admissions-cutover`, `smoke-home` — PASS.
- [ ] **Step 3: Browser check** of tab switching and card → page navigation; note anything noisy.
- [ ] **Step 4: Commit** `docs: describe transition motion rules`.
