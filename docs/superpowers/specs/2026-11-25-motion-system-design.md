# Site-wide Motion System — Design

Date: 2026-11-25. Branch: `feat/motion-system`. Status: draft for approval.

## Intent

Most everyday actions in UniSearch (opening a dropdown, revealing a dependent
filter, closing the compare tray, removing a saved university, switching tabs)
happen as an instant jump. The interface feels unresponsive even when it is
fast. The goal is calm, responsive motion almost everywhere, so the eye keeps
context when state changes and every action visibly answers the user.

UniSearch is a working tool that applicants scan for many minutes. Motion
follows the "productive motion" model (IBM Carbon, Linear, Vercel), not the
expressive motion of promo sites.

## Goals

- Every opening/closing layer (dropdowns, search suggestions, tooltips,
  dialogs, popovers, banners, compare tray) enters and exits smoothly.
- Content that appears or disappears inside a column (dependent filters,
  disclosures, exam/language rows, warning banners) grows/shrinks in height
  instead of pushing neighbours with a jump.
- Removing one item fades it out. In single-column lists (compare chips, exam
  and language rows) the gap then closes in height. In the multi-column card
  grid (saved universities) the card fades in `--motion-fast` and the grid
  re-lays out instantly: no card travels to a new slot (user's choice).
- Catalog list ↔ map switch, tab switches and page routes get short, quiet
  transitions.
- One shared toolkit (tokens + a few helpers + CSS patterns) that new UI uses
  by default.

## Non-goals

- No animation libraries (GSAP, Motion One, etc.) and no new UI framework.
- No hover prefetch of university details to make transitions nicer: it adds
  backend and Redis traffic on the free-tier hosting.
- No reorder animation of the card grid on sort/filter changes.
- No rework of skeletons or the initial loader beyond token alignment.

## Anti-goals (a failure even if it technically works)

The user's own words about the old list/map morph removed in 6.8.6: all
university cards moved back and forth chaotically and the map rolled out; it
felt like watching an After Effects clip, not using a site. Therefore:

- Never move many elements at once. Only the element the user acted on and
  its immediate neighbours may move.
- Never slide whole views or pages in; no layout-shifting transitions (CLS).
- No springs, bounces, overshoot, press-scaling of buttons, or decorative
  hover lifts (already in `docs/design-system.md`).
- Motion never delays the user: no exit animation blocks the next click, and
  data rendering never waits for an animation.

## Motion rules

| Kind | Duration token | Easing | Movement |
|------|----------------|--------|----------|
| Hover / colour feedback | `--motion-instant` (80ms) | standard | none |
| Small layer enter (dropdown, tooltip, suggestions) | `--motion-snappy` (120ms)–`--motion-fast` (160ms) | `--motion-ease-enter` | opacity + 4px translate toward the trigger, optional `scale(0.98)` from the trigger edge (`transform-origin`) |
| Layer exit | ~70% of the enter duration | `--motion-ease-exit` | opacity (+ 2px) |
| Dialog / sheet enter | `--motion-medium` (240ms) | enter | existing modal/sheet keyframes |
| Height expand/collapse | `--motion-fast`–`--motion-medium` | standard | height only (+ opacity of content) |
| Item removal | `--motion-fast` | exit | fade; single-column lists close the gap in height, grids re-lay out instantly |
| View/route change | `--motion-snappy`–`--motion-fast` | standard | crossfade, at most 8px directional offset for tabs |

- Tokens live in `frontend/css/shared/06-motion-accessibility.css`; no raw
  durations or easings in component CSS. Hardcoded fallbacks such as
  `var(--motion-medium, 260ms)` are removed where they disagree with tokens.
- Tooltips open after a short intent delay (~150–250ms) on hover and
  immediately on keyboard focus; once one is open, neighbours open without
  delay.
- Interruptible: reopening during an exit reverses from the current state, no
  restart flash.
- `prefers-reduced-motion: reduce`: everything lands in its final state
  instantly; focus, `hidden`, `aria-*` and scroll positions are identical to
  the animated path.
- Unsupported browsers (no `@starting-style`, View Transitions,
  `interpolate-size`) get today's instant behaviour; fallbacks stay within
  the project's 20-line limit.

## Approaches considered

1. **Native platform toolkit (chosen).** CSS tokens + `@starting-style` and
   `transition-behavior: allow-discrete` for show/hide of layers, `grid-template-rows:
   0fr → 1fr` (with `interpolate-size` as progressive enhancement) for height,
   Web Animations API for interruptible JS-driven cases, View Transitions for
   route and view changes. Zero dependencies, fits vanilla JS, already partly
   present (`runtime.js` helpers, router `startViewTransition`).
2. **Animation library (GSAP / Motion One).** Richer sequencing, but adds a
   dependency and bundle weight for effects the product explicitly rejects.
3. **Per-component ad-hoc keyframes.** What exists today in places; leads to
   inconsistent timing and duplicated logic. Rejected.

For the two contentious transitions the user picked option **B**:

- **List ↔ Map:** a ~120ms crossfade in place. No card movement, no map
  slide. The existing assertions that no sliding indicator / view-motion layer
  exist on the view toggles stay valid unless a later stage deliberately
  changes them.
- **Catalog card → university page:** share only the cover image
  (`view-transition-name` on the clicked card image and the detail cover), and
  only when `getDetailCacheEntry()` already has fresh data for that university
  and language, so the new page's cover is in the DOM when the transition
  captures it. Otherwise the existing root fade is used. Back navigation uses
  the plain root fade (builder's call: a reverse morph needs per-card naming
  and viewport checks for little gain). This is the last item of stage 3 with
  its own commit and test; if it cannot meet the anti-goals (no CLS, no delay
  of rendering), it is dropped in favour of the root fade and reported.

## Stages

Each stage ends with its focused checks, a `reduced-motion` regression check,
a browser check of the changed screens, and a local commit.

1. **Core and floating layers.** Align tokens; extend `runtime.js` with a
   height expand/collapse helper and a "hide after exit" helper (or CSS-only
   equivalents) and route existing helpers through them. Apply to custom
   selects (`.custom-options`, incl. `.open-up`), navbar search suggestions
   and scrim, tooltips (`tooltip.js`), dialogs (`settings`, profile confirm,
   compare dialogs, tour, photo viewer), popovers (recently viewed, format.js
   popover), network banner, toasts.
2. **Catalog.** Dependent filters (state/region, price range, UniFit legend
   `<details>`, UniFit warning banner) expand in height; list/map crossfade;
   saved-tab removal with gap closing; compare tray exit and chip
   add/remove; results counter update; "reset filters" feedback.
3. **Transitions.** Card → detail cover shared transition (cached only);
   university detail tabs, profile sections and compare steps get a short
   directional offset (≤8px) + fade; existing sliding indicators keep working.
4. **Profile, compare, guide.** Exam/language rows add/remove with height;
   disclosure sections and program/route filters on the university page reuse
   the stage-1 helpers; guide page sections.

## Constraints

- Vanilla JS/HTML/CSS in `frontend/`; follow `docs/design-system.md` (tokens,
  no `transition: all`, no press scaling) and the `modern-web-guidance` skill.
- Do not grow already-large controllers (`universities.js`,
  `admissions-controller.js`); put new logic in small modules/helpers.
- Animate only `opacity` and `transform` except the explicit height pattern.
- Keep `hidden` / `inert` / ARIA state authoritative: an element is logically
  closed the moment the user closes it, even while its exit animation runs.
- E2E waits for readiness, not for animation timing; tests that need
  determinism use `reducedMotion: "reduce"`.

## Builder-check answers (builder's calls)

- **Browser support.** Base patterns must be Baseline: height uses
  `grid-template-rows: 0fr → 1fr` (works in Chromium, Firefox, Safari);
  `interpolate-size` is only an enhancement for `height: auto` cases. No JS
  height measuring unless a case cannot use the grid pattern. `@starting-style`
  and same-document View Transitions are used where supported; elsewhere the
  instant path.
- **Existing tests.** Assertions may be updated when behaviour changes on
  purpose, with the reason in the commit. Tab switches animate the panel
  content (fade + ≤8px offset); the sliding indicator stays on the tab bar, so
  they do not conflict.
- **Existing animations.** Stage 1 audits current keyframes and transitions
  (toasts, network banner, modal/sheet, tray, `motion-*` classes), merges
  duplicates into the shared file and removes dead ones.
- **Reduced-motion check.** One shared parameterised E2E spec that grows per
  stage, plus unit tests for helpers in `tests/unit/runtime.test.mjs`.
- **Version.** All four stages go into the in-progress 10.8.1 CHANGELOG block.

## Decided by the builder

- Exact helper names/APIs and whether a case uses CSS-only or WAAPI.
- Exact durations within the token ranges above.
- Which existing component-specific keyframes are merged into shared ones.
- Documentation updates to the Motion section of `docs/design-system.md` and
  the CHANGELOG entry (current in-progress 10.8.1 block).
- Commit boundaries inside a stage.
