# Motion Stage 2 — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The catalog stops jumping: dependent filters and the UniFit banner grow and shrink in height, list ↔ map switches with a short crossfade, a card removed from Saved fades before the grid re-lays out, the compare tray enters/leaves once and animates only the chip that changed, and the results count settles with a quiet fade.

**Architecture:** One small module `frontend/javascript/utils/motion-reveal.js` with three pure-ish helpers built on the Web Animations API (height reveal, fade-in, text update). Callers switch from `style.display`/`hidden` toggles to these helpers. `<details>` disclosures in the catalog opt into a CSS-only `::details-content` + `interpolate-size` enhancement. Existing `runtime.js` helpers (`animateElementOut`, `replayMotion`, `markMotionEnter`) cover removals and chip entries.

**Tech Stack:** Vanilla JS/CSS, `node:test` with the fake DOM in `tests/unit/setup.mjs`, Playwright (`playwright.local.config.js`, ports 8010/5510).

**Spec:** `docs/superpowers/specs/2026-11-25-motion-system-design.md` (stage 2). Stage 1 plan: `docs/superpowers/plans/2026-11-25-motion-stage-1.md`.

**Scope notes:** "Reset filters feedback" from the spec is covered by the pieces below (dependent fields collapse, count fade, existing colour press on the button); no separate reset animation is added, since animating every reset field at once would be the mass movement the anti-goals forbid.

## Global Constraints

- Everything from the stage 1 plan's Global Constraints still applies (tokens only, opacity/transform except the height pattern, reduced motion = instant final state, logical state immediate, no dependencies, commit rules).
- Only the element the user acted on and its immediate neighbours move. Never replay `motion-list-item-enter` on the whole grid as a side effect of a save/unsave, compare change or view switch.
- Height reveal: `--motion-fast` (160ms) to open with `--motion-ease-enter`, `--motion-snappy` (120ms) to close with `--motion-ease-exit`; content opacity 0 → 1 alongside. No translate.
- View crossfade: opacity only, `--motion-snappy`, no movement, no layout shift (the incoming container is already in its final layout when it fades).
- No animation on initial page render: helpers called during the first sync use `{ instant: true }`.

## Review Focus

1. Rapid toggling (country USA → Global → USA within 100ms): the state field ends visible with full height and no `motion-revealing` class left behind. Task 1 unit test (interrupt) + Task 2 E2E.
2. Collapsing content must not stay focusable or clickable while it shrinks: `inert` during the collapse, `hidden`/`display:none` at the end. Task 1.
3. Page load and back/forward restore: filters restored from the URL/state must appear in place without animating. Task 2 E2E (reload with `country=USA` in the query → no running animations on `#stateDiv`).
4. Unsave in Saved view while another refetch is in flight: the card must not reappear, and the grid must not replay its entrance. Task 4.
5. Compare tray when a card deselect happens from the grid (not the chip): the matching chip fades out; when the tray empties, the tray fades out once instead of the chip and tray both jumping. Task 5.

---

### Task 1: `motion-reveal.js` helpers

**Files:**
- Create: `frontend/javascript/utils/motion-reveal.js`
- Test: `tests/unit/motion-reveal.test.mjs`

**Interfaces:**
- Produces:
  - `setRevealed(node: HTMLElement, visible: boolean, options?: { mode?: "hidden" | "display", display?: string, instant?: boolean }): void` — `mode: "hidden"` (default) toggles the `hidden` attribute; `mode: "display"` sets `style.display` to `options.display` (default `""`) or `"none"`. No-op when already in the requested state and no animation is running. Showing: un-hide first, then animate `height` from the current rendered height (0 when it was hidden) to the measured target and `opacity` 0 → 1. Hiding: set `inert`, animate to `height: 0; opacity: 0`, then hide and remove `inert`. A new call cancels the running animation and starts from the current rendered height. While animating, the node carries the class `motion-revealing` (`overflow: clip`, defined in `06-motion-accessibility.css`); no static inline style writes, because `npm run check:inline-styles` rejects them. Instant path when `instant`, reduced motion (`prefersReducedMotion()` from `runtime.js`), or `typeof node.animate !== "function"`.
  - `fadeIn(node: HTMLElement, options?: { instant?: boolean }): void` — opacity 0 → 1 over `--motion-snappy`, cancels a previous fade on the same node.
  - `setTextWithFade(node: HTMLElement, text: string): void` — sets `textContent`; when it changed and motion is allowed, plays opacity 0.4 → 1 over `--motion-snappy`.
  - Durations are read from the CSS tokens via `getComputedStyle(document.documentElement)` with the token values as constants for the fake DOM (`REVEAL_ENTER_MS = 160`, `REVEAL_EXIT_MS = 120`, `FADE_MS = 120`).

- [ ] **Step 1: Write failing unit tests** in `tests/unit/motion-reveal.test.mjs` using a fake element whose `animate()` records keyframes and returns `{ finished: Promise, cancel() }`:
  - `hides after the collapse finishes and keeps content inert meanwhile` — `setRevealed(node, false)`: `inert` true, `hidden` false until `finished` resolves, then `hidden` true and `inert` false.
  - `shows immediately and animates height from zero` — first keyframe `height: "0px"`, last equals measured `scrollHeight` px, `hidden` false synchronously.
  - `display mode toggles style.display` — `{ mode: "display", display: "block" }` ends with `style.display === "block"` / `"none"`.
  - `a new call cancels the running animation` — second call calls `cancel()` on the first.
  - `instant and reduced motion skip animate()` — `animate` never called; final state applied synchronously.
  - `no-op when already in the requested state` and `setTextWithFade animates only on change`.
- [ ] **Step 2: Run** `node --test tests/unit/motion-reveal.test.mjs` — FAIL (module missing).
- [ ] **Step 3: Implement** the module. Remove `motion-revealing` after each animation (`finished.then`, ignoring `AbortError` from `cancel()` explicitly).
- [ ] **Step 4: Run** the unit test — PASS. Run `npm run lint:frontend`.
- [ ] **Step 5: Commit** `feat: add height reveal and fade helpers for catalog motion`.

### Task 2: Dependent filters, UniFit banner and catalog disclosures

**Files:**
- Modify: `frontend/javascript/pages/universities/filter-controls.js` (`updateLocationLogic` ~line 303 for `#stateDiv`; `updateSliderVisibility` ~line 241 for `sortAiTagsHint`, `unifitPrefsPanel`, `sliderContainer`)
- Modify: `frontend/javascript/pages/universities/unifit-banner.js` (banner show/hide ~lines 60–110, legend disclosure ~line 48)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (`.motion-disclosure` block + reduced-motion entry)
- Modify: `frontend/index.html` (add `motion-disclosure` class to `.catalog-cost-help`, `#unifitPreferencesPanel`, `#unifitLegendDetails`)
- Test: `tests/e2e/motion-catalog.spec.js` (new)

**Interfaces:**
- Consumes: `setRevealed` from Task 1. The first sync after page load (`applyToForm`, initial banner render) passes `{ instant: true }`; user-driven changes do not.
- Produces: `.motion-disclosure` CSS class: `interpolate-size: allow-keywords` on the `<details>`, `::details-content` transitions `block-size` and `content-visibility` (`allow-discrete`) with enter/exit timing, wrapped in `@supports selector(::details-content)`.

- [ ] **Step 1: Write failing E2E** in `tests/e2e/motion-catalog.spec.js` (copy the `openCatalog`/`expectInstant`/`expectAnimating` helpers from `motion-layers.spec.js` into a shared `tests/e2e/helpers/motion.cjs` and import it in both specs):
  - `choosing a country with states reveals the state field in height`: select `USA` in `#countrySelect` via the custom select → `expectAnimating(#stateDiv)`; then it ends visible without the `motion-revealing` class.
  - `choosing a country without states collapses the state field`: from USA select `Global` → `#stateDiv` still painted right after (`display` not `none`), `display: none` within 500ms.
  - `filters restored on load appear without animation`: `goto("/index.html?country=USA")` → `#stateDiv` visible and `getAnimations().length === 0`.
  - Reduced-motion twin of the first test with `expectInstant`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the caller changes and `.motion-disclosure` CSS; keep `aria-hidden` handling of `sortStrategyInfoWrap` as is (an inline icon, not a block).
- [ ] **Step 4: Run** the new spec plus `tests/e2e/catalog-unifit-explanation.spec.js`, `tests/e2e/universities-ai-sort-flow.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: reveal dependent catalog filters and UniFit notice in height`.

### Task 3: List ↔ map crossfade

**Files:**
- Modify: `frontend/javascript/pages/universities/map-controller.js` (`applyViewVisibility` ~line 894 and its call in `switchView`)
- Test: `tests/e2e/motion-catalog.spec.js`

**Interfaces:**
- Consumes: `fadeIn` from Task 1. `applyViewVisibility(mode, { animate = false })`; `switchView` passes `animate: true` only for a user-initiated switch (not the initial `switchView(state.viewMode, false)` in `universities.js` ~line 750).

- [ ] **Step 1: Write failing E2E** `switching to map crossfades without movement`: click `#viewMapBtn` → `#mapStage` has a running opacity animation and its bounding box `y` equals the value read after the animation finished (no movement); switching back fades `#universitiesList` the same way. Reduced-motion twin: no animations. Keep the existing assertions in `motion-interactions.spec.js` ("view mode toggle changes views without a content transition": no `.u-view-motion-layer`, no sliding indicator) green.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `tests/e2e/motion-interactions.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: crossfade catalog list and map views`.

### Task 4: Saved-view removal fades the card, then re-lays out instantly

**Files:**
- Modify: `frontend/javascript/pages/universities/compare-controller.js` (save branch ~line 300–322)
- Modify: `frontend/javascript/pages/universities.js` (`onRefetch` wiring ~line 356; confirm `scheduleRefetch` forwards options to `fetchAndRender`)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (`.motion-card-remove`: opacity → 0 over `--motion-fast`, `--motion-ease-exit`, `pointer-events: none`, no transform; add to reduced-motion list)
- Test: `tests/e2e/motion-catalog.spec.js`

**Interfaces:**
- Consumes: `animateElementOut(node, callback, { className, timeoutMs })` from `runtime.js`.
- Produces: `onRefetch(options?: { animateResults?: boolean })`; the unsave-in-Saved path calls it with `{ animateResults: false }` after the card fade.

- [ ] **Step 1: Write failing E2E** `unsaving in Saved fades only that card and does not replay the grid entrance`: seed two saved ids (`unisearch_saved_university_ids_v1`), open `index.html?only_saved=1`, install the motion recorder from `motion-interactions.spec.js` (move it into `helpers/motion.cjs`), unsave the first card → `motion-card-remove` seen; after the grid shows one card, `motion-list-item-enter` not seen.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; the saved id set and storage update immediately (logical state first), only the refetch waits for the fade.
- [ ] **Step 4: Run** spec + `tests/e2e/universities-tabs-compare.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: fade a card out of the saved list before it re-lays out`.

### Task 5: Compare tray enters and leaves once; chips animate individually

**Files:**
- Modify: `frontend/javascript/pages/universities/compare-controller.js` (`renderCompareTray` ~line 166, tray click handler ~line 400)
- Modify: `frontend/css/universities/03-comparison.css` (`.compare-tray.motion-tray-exit` using a new `@keyframes motion-anchored-tray-exit` in the shared file: opacity → 0, `translateX(-50%) translateY(var(--motion-offset-sm))`, `--motion-snappy`, exit easing)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (keyframes + reduced-motion entry)
- Test: `tests/e2e/motion-catalog.spec.js`

**Interfaces:**
- Produces: module-local `previousTrayIds: string[]`. `renderCompareTray()` replays `motion-panel-enter` only when the tray goes from hidden to visible; chips whose id is new get `motion-list-item-enter` via `markMotionEnter`; when ids become empty the tray plays `motion-tray-exit` through `animateElementOut` and is hidden afterwards. A chip removed by id (chip button or card deselect) plays `motion-chip-remove` before the re-render when it is still in the DOM.

- [ ] **Step 1: Write failing E2E** `compare tray animates only what changed`: enter compare mode, select card A → `motion-panel-enter` seen once; reset recorder; select card B → `motion-panel-enter` not seen, `motion-list-item-enter` seen on exactly one chip; deselect B from the grid → `motion-chip-remove` seen; clear → `motion-tray-exit` seen, then `#compareTray` hidden. Reduced-motion twin: tray visible/hidden synchronously.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** spec + `tests/e2e/motion-interactions.spec.js`, `tests/e2e/universities-tabs-compare.spec.js`, `tests/e2e/reviewed-personalized-journeys.spec.js` — PASS.
- [ ] **Step 5: Commit** `feat: animate compare tray changes per chip`.

### Task 6: Results count settles with a fade

**Files:**
- Modify: `frontend/javascript/pages/universities.js` (`el.total.textContent = …` at ~lines 444, 971, 1006, 1040)
- Modify: `frontend/javascript/pages/universities/map-controller.js` (~lines 465, 947)
- Test: `tests/e2e/motion-catalog.spec.js`

**Interfaces:**
- Consumes: `setTextWithFade` from Task 1. The first count paint after load stays instant (the helper only animates on change and the initial text is `0`, so pass through `textContent` for the first render).

- [ ] **Step 1: Write failing E2E** `results count fades when filters change`: after load, choose a country → `#totalCount` has a running opacity animation and its text changed; reduced-motion twin has none.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: fade the catalog results count on change`.

### Task 7: Documentation, changelog and stage check

- [ ] **Step 1:** Update `docs/design-system.md` Motion section (height reveal helper and when to use it, `.motion-disclosure`, view crossfade, tray/chip rules) and the 10.8.1 CHANGELOG block.
- [ ] **Step 2: Run** `npm run test:unit`, `npm run check:design-lint`, `npm run check:stylelint`, `npm run check:tokens`, `npm run check:i18n`, `npm run check:encoding`, `npm run lint:frontend`, `npm run check:hardcoded-text`, `npm run check:inline-styles`, and the E2E specs `motion-catalog`, `motion-layers`, `motion-interactions`, `universities-tabs-compare`, `catalog-unifit-explanation`, `universities-ai-sort-flow`, `reviewed-personalized-journeys`, `smoke-home` — all PASS.
- [ ] **Step 3: Browser check** (built-in browser, light and dark): country → state field, UniFit sort → preferences panel, list ↔ map, Saved unsave, compare tray add/remove/clear, results count. Note anything that reads as noisy.
- [ ] **Step 4: Commit** `docs: describe catalog motion rules`.
