# Motion Stage 1 — Core and Floating Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every floating layer (custom selects, navbar search suggestions, tooltips, native dialogs and popovers) opens and closes with short, calm motion, on one shared token set, with reduced motion and old browsers falling back to today's instant behaviour.

**Architecture:** CSS-first. Layers that toggle `display` use `@starting-style` + `transition-behavior: allow-discrete`; top-layer elements also transition `overlay`. Enter timing lives on the open-state rule, exit timing on the closed-state rule, so exits are faster without JS. JS changes only where JS currently destroys state before the exit can play (select direction class, search suggestions content).

**Tech Stack:** Vanilla CSS/JS, `node:test` unit tests (`tests/unit`, fake DOM in `setup.mjs`), Playwright E2E (`playwright.local.config.js`, ports 8010/5510).

**Spec:** `docs/superpowers/specs/2026-11-25-motion-system-design.md` (stage 1). Later stages get their own plans.

**Scope notes:** toasts, the network banner and the settings/profile/tour modals already animate in and out; here they only get the token cleanup from Task 1. The height expand/collapse helper from spec stage 1 moves to the stage 2 plan, where its first users (dependent catalog filters) live, so it is built against real cases.

## Global Constraints

- Only `opacity` and `transform`/`translate`/`scale` animate (plus discrete `display`, `overlay`, `visibility`). Never `transition: all`.
- Durations/easings only via tokens from `frontend/css/shared/06-motion-accessibility.css`: enter `--motion-snappy` (120ms) or `--motion-fast` (160ms) with `--motion-ease-enter`; exit one step shorter (`--motion-instant` 80ms / `--motion-snappy` 120ms) with `--motion-ease-exit`.
- Movement ≤ 4px (`--motion-offset-sm`), optional `scale(0.98)` from the trigger edge via `transform-origin`. No springs, no overshoot.
- `prefers-reduced-motion: reduce`: no transition/animation on any layer touched here; open/closed state identical to the animated path.
- Logical state is immediate: `aria-expanded`, `dialog.open`, `:popover-open`, `.open`, `.is-open` change at the moment of the user action; only the visual exit lingers.
- Browsers without `@starting-style`/`allow-discrete`/`overlay` keep instant show/hide; no polyfills, any fallback ≤ 20 lines.
- No new dependencies. Commit messages in English, `git commit -s`, no bot attribution; before each commit `npm run fix:encoding` then `npm run check:encoding`.

## Review Focus

1. Rapid toggle (open → close → open within 100ms) on a select or the search box: the layer must end open, visible and filled, with no stale content flash. Covered in Task 3 and Task 4 tests.
2. A select that opens upward and is closed: the exit must leave toward the trigger (upward), not jump below the trigger. Task 3.
3. Keyboard users: tooltips on focus open with zero delay; Escape on a dialog closes it and focus returns as today. Task 5 and Task 2.
4. Reduced motion: every touched layer is fully visible immediately after opening and gone immediately after closing. Shared spec, extended in each task.
5. Navbar search on mobile (scrim + full-width suggestions): closing must not leave an invisible layer catching taps. Task 4 (`pointer-events: none` on closed state, asserted).

---

### Task 1: Token cleanup, lint guard and shared reduced-motion spec

**Files:**
- Modify: `frontend/css/shared/06-motion-accessibility.css` (token block ~line 57)
- Modify: all CSS files containing `var(--motion-…, <fallback>)` (35 occurrences; find with `rg "var\(--motion-[a-z-]+, " frontend/css`)
- Modify: `scripts/check-design-lint.mjs` (next to rule 8 "transition: all", ~line 350)
- Test: `tests/unit/design-lint.test.mjs`
- Create: `tests/e2e/motion-layers.spec.js`

**Interfaces:**
- Produces: tokens `--motion-offset-sm: 4px`, `--motion-tooltip-delay: 200ms`. Lint rule type `animation-raw-timing`. E2E helpers in `motion-layers.spec.js`: `expectInstant(locator)` (asserts `el.getAnimations().length === 0` and computed opacity `"1"`), `expectAnimating(locator)` (asserts `getAnimations().length > 0` right after the action).

- [ ] **Step 1: Write failing lint test** `flags raw durations in transition and animation outside motion tokens`: a fixture CSS line `transition: opacity 150ms ease;` in a non-token file yields one finding of type `animation-raw-timing`; `transition-delay: 0s;` and `transition: opacity var(--motion-fast) var(--motion-ease-enter);` yield none; any line in `06-motion-accessibility.css` or `01-foundation.css` is exempt.
- [ ] **Step 2: Run** `node --test tests/unit/design-lint.test.mjs` — expected FAIL (rule missing).
- [ ] **Step 3: Implement** the rule in `check-design-lint.mjs`: for `transition*`/`animation*` declarations, flag a number with `ms`/`s` unit other than `0s`/`0ms`, and named or `cubic-bezier(` easings, outside the two exempt files.
- [ ] **Step 4: Remove all motion-token fallbacks** (`var(--motion-medium, 260ms)` → `var(--motion-medium)`) and add the three new tokens. Run `npm run check:design-lint` — expected 0 `animation-raw-timing` findings; fix any it reports by switching to tokens.
- [ ] **Step 5: Create `tests/e2e/motion-layers.spec.js`** with the two helpers and one smoke test `tokens are defined on :root` (reads `--motion-offset-sm` = `4px`, `--motion-tooltip-delay` = `200ms`).
- [ ] **Step 6: Run** `node --test tests/unit/design-lint.test.mjs`, `npm run check:stylelint`, `npx playwright test tests/e2e/motion-layers.spec.js --config=playwright.local.config.js` — all PASS.
- [ ] **Step 7: Commit** `refactor: unify motion tokens and lint raw animation timing`.

### Task 2: Native dialogs and popovers enter/exit

**Files:**
- Modify: `frontend/css/shared/06-motion-accessibility.css` (new "Top-layer motion" block + reduced-motion block ~line 308)
- Modify: `frontend/css/universities/09-reviewed-comparison.css` (`.compare-picker`, ~line 529–560: replace `animation: motion-modal-in` with the shared pattern)
- Modify: `frontend/css/university/01-shell-hero.css` (`.d-photo-viewer`, ~line 240–275)
- Modify: `frontend/css/universities/02-catalog.css` (`.u-recent-popover`, ~line 724)
- Test: `tests/e2e/motion-layers.spec.js`

**Interfaces:**
- Consumes: Task 1 tokens and helpers.
- Produces: utility class `.motion-top-layer` (opt-in on any `<dialog>`/`[popover]`): opacity + `translate: 0 var(--motion-offset-sm)` + `scale: 0.98` → identity on `[open]`/`:popover-open`, `transition` list includes `display` and `overlay` with `allow-discrete`, backdrop fades in parallel. Settings, profile-confirm and tour modals keep their existing `is-open`/`is-closing` JS motion and do NOT get this class.

- [ ] **Step 1: Write failing E2E** `photo viewer dialog fades out after close`: on a university page with a gallery, open the viewer, call close via Escape; assert `dialog.open === false` immediately and computed `display !== "none"` within the first frame (exit running), and `display === "none"` after 300ms. Add the reduced-motion twin using `expectInstant`.
- [ ] **Step 2: Run it** — expected FAIL (display is `none` immediately).
- [ ] **Step 3: Implement** `.motion-top-layer` in the shared file and add the class in markup: `gallery.js` dialog template (~line 236), compare picker dialogs in `compare-reviewed.js` (~lines 573, 780 — the element creation), recently-viewed popover in `recently-viewed.js` (~line 90). Remove the old `motion-modal-in` usage from `.compare-picker`. `.u-recent-popover` keeps its `transform-origin: top right`.
- [ ] **Step 4: Run** the spec plus `tests/e2e/motion-interactions.spec.js` ("floating motion layers close cleanly…") — PASS.
- [ ] **Step 5: Commit** `feat: animate native dialogs and popovers in and out`.

### Task 3: Custom select panel enter/exit

**Files:**
- Modify: `frontend/javascript/utils/selects.js` (close paths at ~lines 15, 409, 424)
- Modify: `frontend/css/shared/02-shell-settings-feedback.css` (`.custom-options` ~lines 1092–1130)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (reduced-motion block already lists `.custom-options`; keep)
- Test: `tests/unit/custom-select-typeahead.test.mjs`, `tests/e2e/motion-layers.spec.js`

**Interfaces:**
- Produces: `closeCustomSelectWrapper(wrapper: HTMLElement): void` (module-internal in `selects.js`) — removes `open`, sets trigger `aria-expanded="false"`, clears `.is-highlighted`; keeps `open-up` (recomputed by `openSelect` via `openAndPositionSelectPanel`). All three close paths call it.

- [ ] **Step 1: Write failing unit test** `closing an upward select keeps its direction class until the next open`: open a select whose positioning returns `true` (upward), close it, assert `wrapper.classList.contains("open") === false`, `contains("open-up") === true`, trigger `aria-expanded === "false"`.
- [ ] **Step 2: Run** `node --test tests/unit/custom-select-typeahead.test.mjs` — FAIL.
- [ ] **Step 3: Implement** `closeCustomSelectWrapper` and route the global-click, `closeSelect` and "close others" paths through it.
- [ ] **Step 4: CSS:** `.custom-options` closed state = `display: none; opacity: 0; translate: 0 calc(-1 * var(--motion-offset-sm))` with exit transition (`--motion-instant`, `--motion-ease-exit`, `display` allow-discrete); `.open .custom-options` = `display: block; opacity: 1; translate: 0 0` with enter transition (`--motion-snappy`, `--motion-ease-enter`) and `@starting-style` equal to the closed values. `.open-up` flips the offset sign (panel rises from the trigger) in both the closed state and `@starting-style`.
- [ ] **Step 5: Write E2E** `catalog select opens with motion and closes toward its trigger`: open a catalog filter select → `expectAnimating(panel)`; rapid open/close/open → panel ends visible with opacity `1` and options present; reduced-motion twin with `expectInstant`.
- [ ] **Step 6: Run** unit + E2E specs, plus `tests/e2e/motion-interactions.spec.js` — PASS.
- [ ] **Step 7: Commit** `feat: animate custom select panels from their trigger edge`.

### Task 4: Navbar search suggestions keep content during exit

**Files:**
- Modify: `frontend/javascript/components/navbar-search.js` (`hideGlobalSearchSuggestions` ~line 51, renders ~lines 176–188)
- Modify: `frontend/css/shared/08-device-responsive.css` (`.navbar-search-suggestions` ~lines 224–250: split enter/exit timing per Global Constraints; translate becomes `--motion-offset-sm`)
- Test: `tests/unit/navbar-search.test.mjs`, `tests/e2e/motion-layers.spec.js`

**Interfaces:**
- Produces: `SUGGESTIONS_EXIT_MS = 120` (matches `--motion-snappy`) module constant; a pending-clear timer cancelled by both render functions.

- [ ] **Step 1: Write failing unit tests**: `hiding suggestions keeps items until the exit finishes` (after hide: no `is-open`, children still present; after advancing timers by 120ms: no children) and `re-rendering cancels a pending clear` (hide, render new items at 50ms, advance 200ms → new items present, `is-open` set).
- [ ] **Step 2: Run** `node --test tests/unit/navbar-search.test.mjs` — FAIL.
- [ ] **Step 3: Implement** the deferred `replaceChildren()` with the cancellable timer; `highlightedIndex` still resets immediately.
- [ ] **Step 4: E2E** `closed search suggestions do not catch taps`: on mobile viewport open then close suggestions; assert computed `pointer-events` is `none` and a tap at the former suggestion position reaches the page underneath. Reduced-motion twin.
- [ ] **Step 5: Run** unit + E2E — PASS.
- [ ] **Step 6: Commit** `fix: keep search suggestions visible while they fade out`.

### Task 5: Tooltips enter/exit with hover intent

**Files:**
- Modify: `frontend/css/shared/02-shell-settings-feedback.css` (tooltip bubbles ~lines 345–392 and hover rule ~line 1405)
- Modify: `frontend/javascript/tooltip.js` (warm state)
- Modify: `frontend/css/shared/06-motion-accessibility.css` (add tooltip bubble selectors to the reduced-motion transition list)
- Test: `tests/e2e/motion-layers.spec.js`

**Interfaces:**
- Produces: root class `tooltips-warm` on `document.documentElement`, set on `pointerout` from any tooltip wrap and removed after 400ms (`TOOLTIP_WARM_MS` constant in `tooltip.js`); while present, hover opens with zero delay.

- [ ] **Step 1: Write failing E2E** `tooltip hover waits for intent, focus opens at once`: hover a catalog card tooltip trigger → bubble computed `transition-delay` starts with `0.2s`; keyboard-focus a trigger → `0s`; move pointer from one trigger to another within 400ms → second bubble delay `0s`. Reduced-motion twin: bubble visible with opacity `1` immediately on focus.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: CSS:** bubbles transition `opacity`, `translate` and `display` (allow-discrete); enter timing + `transition-delay: var(--motion-tooltip-delay)` on the `:hover` open rule only; `0s` on `.is-open`/`:focus-within` and under `:root.tooltips-warm`; `@starting-style` for the open rules; `.is-closed` remains instant hide (explicit user dismissal). Keep `--tooltip-shift-x` translate behaviour by moving the vertical offset into `transform` as today.
- [ ] **Step 4: JS:** delegated `pointerout` listener in `tooltip.js` sets/refreshes the warm class with one timer.
- [ ] **Step 5: Run** spec + `tests/e2e/university-detail-design.spec.js` (tooltip layout) — PASS.
- [ ] **Step 6: Commit** `feat: animate tooltips with hover intent delay`.

### Task 6: Documentation, changelog and stage check

**Files:**
- Modify: `docs/design-system.md` (Motion section ~line 315: enter/exit timing rule, `.motion-top-layer`, tooltip intent delay, lint rule)
- Modify: `CHANGELOG.md` (current 10.8.1 block)

- [ ] **Step 1:** Update docs and a factual CHANGELOG entry listing the user-visible changes and touched files.
- [ ] **Step 2: Run** `npm run test:unit`, `npm run check:design-lint`, `npm run check:stylelint`, `npm run check:tokens`, `npm run check:i18n`, `npm run check:encoding`, `npx playwright test tests/e2e/motion-layers.spec.js tests/e2e/motion-interactions.spec.js --config=playwright.local.config.js` — all PASS.
- [ ] **Step 3: Browser check** in the built-in browser: catalog select, search suggestions, tooltip, recent popover, photo viewer, in light and dark; note anything that reads as noisy.
- [ ] **Step 4: Commit** `docs: describe floating-layer motion rules`.
