# UniSearch Design System

UniSearch uses a calm academic product workspace style. The interface should feel like a practical admissions and university-selection tool: data-dense, quiet, trustworthy, and fast to scan.

Use this document as the source of truth for new UI work. Global tokens and shared stylesheets live in `frontend/css/shared/01-foundation.css` and its sibling modules (documented in `frontend/css/shared/README.md`), linked directly from HTML pages without CSS `@import` chains.

## Design Direction

- Build working screens first. Catalog, ranking, guide, profile, and university detail pages should solve the task immediately, not behave like decorative landing pages.
- Favor restrained academic/product UI over generic SaaS styling. Avoid plastic gradients, loud AI-style visuals, and one-off decorative effects.
- Reference archetypes: Align UI work with three core aesthetic archetypes (available as reference specifications in `awesome-design-md`):
  - **Linear (`linear.app`)** for data-dense productivity: catalog grids, search & filter toolbars, comparison matrices, metric indicators, and compact sorting controls. Emphasizes tight layout discipline, micro-elevation, and zero box borders.
  - **Notion (`notion`)** for structured academic content: university detail pages, study options, admission routes, policy condition lists, deadline schedules, and explanatory callouts. Emphasizes clean typographic hierarchy, comfortable reading rhythm, and distraction-free content blocks.
  - **Cal.com (`cal`)** for focused applicant workflows: applicant profile inputs (GPA, test scores, financial budgets), modal dialogs, and interactive selection sheets. Emphasizes clean borderless form fields, distinct focus outlines, and frictionless task completion.
- Borderless surface hierarchy: UniSearch intentionally avoids visible box borders. Cards, panels, inputs, chips, badges, and buttons are borderless in resting, hover, active, and selected states. Use semantic surface contrast (`var(--surface-soft)`, `var(--surface-solid)`), restrained micro-elevation (`var(--shadow-xs)`, `var(--shadow-micro)`), and disciplined whitespace instead. The main catalog search and filter bar is the visual reference for this modern, minimal clarity.
- Keep visual hierarchy clear and never let two adjacent visible components share an indistinguishable surface: page background -> solid working surfaces -> soft nested controls -> selectively raised controls or overlays.
- Use real university media where it helps identify a university. Do not use atmospheric imagery when the user needs to inspect a concrete university.
- Label study levels clearly wherever programs, admission requirements, deadlines, and funding policies differ. Do not imply that a fact for one level applies to another.
- Applicant card indicators use a short label and one concise, useful explanation. Do not expose internal normalized preference scales, ranking penalties, component weights or technical context dumps. A requirements-match percentage is a separate applicant result and must have a visible entry point; keep detailed evidence and source scope on the admissions page and price reference.

## Tokens

Use existing CSS variables instead of new hard-coded palettes. All colors in components and pages must reference these tokens:

- Fonts: `--font-sans` and `--font-display` both use `Inter` as a unified sans-serif family. Do not mix secondary geometric display fonts (`Plus Jakarta Sans`, etc.).
- Font weights: `--font-weight-regular` (`400`) for body copy, `--font-weight-medium` (`500`) for controls and compact labels, and `--font-weight-semibold` (`600`) for page headings and deliberately emphasized values. Product UI must not use weights above `600`.
- Type Scale: `--text-xs` (11px), `--text-sm` (13px), `--text-base` (14px), `--text-md` (16px), `--text-lg` (18px), `--text-xl` (20px), `--text-2xl` (24px), `--text-3xl` (28px).
- Line Heights: `--leading-tight` (1.25), `--leading-normal` (1.5), `--leading-loose` (1.7).
- Spacing uses shared `--space-*` primitives from 1px to 96px and semantic aliases (`--layout-page-gutter`, `--layout-section-gap`, `--component-card-padding`, `--component-card-gap`, and `--component-control-gap`) for repeated roles and responsive changes.
- Accent: `--accent` (`#4F46E5` light / `#5850EC` dark, reserved for solid fills and indicators), `--accent-text` (`#4338CA` light / `#A5B4FC` dark, for foreground text and icons), `--accent-strong`, `--accent-press`, `--accent-soft`, `--accent-faint`, `--accent-panel`, `--accent-active-surface`, `--accent-active-hover-surface`, `--accent-active-press-surface`. Browser chrome reads `--accent` through `theme-init.js`; external SVG logos mirror `#4F46E5` (`whitelogo.svg`, `minilogo.svg`) and `#818CF8` (`darklogo.svg`) because they do not inherit CSS custom properties.
- Interaction states: `--interaction-hover-text`, `--interaction-hover-surface`, `--interaction-press-surface`, `--interaction-active-text`, `--interaction-active-surface`, `--focus-ring`, and `--interaction-disabled-opacity`. Reusable links, tabs, buttons, and icon controls must use these tokens instead of choosing local hover, press, focus, or disabled values. Semantic danger, warning, and success controls keep their matching status tokens.
- Backgrounds & Surfaces: `--bg`, `--bg-soft`, `--surface-solid` (alias `--card`), `--surface`, `--surface-soft`, `--surface-raised`, `--surface-raised-hover`, `--surface-raised-press`, plus context-scoped `--control-bg`, `--control-shadow`, `--interaction-hover-surface`, and `--interaction-press-surface` (defaulting to `--surface-soft` / `--shadow-micro` on `--surface-solid` and flipping automatically to `--surface-raised` / `--shadow-xs` / `--surface-raised-hover` / `--surface-raised-press` inside soft containers).
- Text: `--text`, `--text-muted`.
- Lines & state rings: `--line`, `--line-strong`, `--line-faint`, `--line-accent`, `--line-grant`, `--line-warning`, `--line-danger`, `--line-info`. These tokens are reserved for focus outlines, separators, and non-box state rings; they must not reintroduce default card or control borders.
- Statuses:
  - Success: `--color-success`, `--color-success-muted`, `--color-success-bg`.
  - Warning: `--color-warning`, `--color-warning-bright`, `--color-warning-bg`.
  - Danger: `--color-danger`, `--color-danger-muted`, `--color-danger-bg`.
  - Info: `--color-info`, `--color-info-muted`, `--color-info-bg`.
- Skeletons: `--skeleton-base`, `--skeleton-highlight`.
- Selection: `--selection-bg`, `--selection-text`.
- Radius: `--radius-xs` (4px), `--radius-sm` (8px), `--radius-md` (10px), `--radius-base` (12px), `--radius-lg` (16px), `--radius-xl` (20px), `--radius-full` (999px for progress/switches), `--radius-circle` (50%).
- Motion: `--motion-fast`, `--motion-medium`, `--motion-ease-standard`, `--motion-ease-enter`, `--motion-ease-exit`.

### Palette Contract (Light vs Dark)

| Semantic Token | Light (`:root`) | Dark (`:root[data-theme="dark"]`) | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg` | `#F5F6F8` | `#0B0C0E` | Page body background |
| `--bg-soft` | `#ECEEF3` | `#111317` | Toolbar, filter bar, secondary background |
| `--surface-solid` (`--card`) | `#FFFFFF` | `#15181D` | Main cards, modals, lists |
| `--dropdown-surface` | `var(--surface-solid)` | `var(--surface-soft)` | Open select triggers and dropdown panels (with `--shadow-dropdown-trigger` / `--shadow-dropdown` so they stay separated from cards) |
| `--surface` | `rgba(255, 255, 255, 0.90)` | `rgba(21, 24, 29, 0.88)` | Translucent header, floating docked bars |
| `--surface-soft` | `#ECEFF4` | `#20242B` | Form inputs, chip/tag pills, nested controls |
| `--surface-raised` | `var(--surface-solid)` | `#2B303A` | Nested controls and pills elevated above `--surface-soft` |
| `--surface-raised-hover` | `var(--interaction-hover-surface)` | `#343A46` | Hover fill for `--surface-raised` controls inside soft containers |
| `--surface-raised-press` | `var(--interaction-press-surface)` | `#252A33` | Press (`:active`) fill for `--surface-raised` controls inside soft containers |
| `--surface-control-on-bg` | `var(--surface-solid)` | `var(--surface-soft)` | Neutral interactive buttons and segmented shells sitting directly on `--bg` |
| `--control-badge-bg` | `var(--surface-soft)` | `var(--surface-raised)` | Count badges inside `--surface-control-on-bg` controls at rest |
| `--control-badge-hover-bg` | `var(--surface-solid)` | `var(--surface-raised-hover)` | Count badges inside `--surface-control-on-bg` controls on hover or open |
| `--dropdown-surface` | `var(--surface-solid)` | `var(--surface-soft)` | Floating menu surface shared by `.custom-options`, `.u-recent-popover`, `.navbar-search-suggestions`, and `.uni-status-overflow-popover` |
| `--dropdown-radius` | `var(--radius-base)` | `var(--radius-base)` | Shared corner radius for floating menus and select triggers (`12px`) |
| `--dropdown-row-height` | `36px` (`44px` coarse) | `36px` (`44px` coarse) | Shared minimum row block-size inside dropdowns and floating menus |
| `--text` | `#111827` | `#F3F4F6` | Primary high-contrast typography |
| `--text-muted` | `#525D70` | `#9AA4B4` | Secondary labels, descriptions, captions |
| `--interaction-hover-surface` | `#E6E9F0` | `#282C34` | Neutral hover fill and open menu/popover trigger fill |
| `--interaction-press-surface` | `#DCE0E9` | `#1B1E24` | Neutral deeper press (`:active`) fill |
| `--line` | `rgba(15, 23, 42, 0.16)` | `rgba(255, 255, 255, 0.16)` | Focus ring or structural separator, never a default component box |
| `--line-strong` | `rgba(15, 23, 42, 0.28)` | `rgba(255, 255, 255, 0.28)` | Prominent structural separator or non-box state ring |
| `--line-faint` | `rgba(15, 23, 42, 0.08)` | `rgba(255, 255, 255, 0.08)` | Subtle separator where whitespace alone cannot express structure |
| `--accent` | `#4F46E5` | `#5850EC` | Primary action button fill, active indicator |
| `--accent-text` | `#4338CA` | `#A5B4FC` | Accent foreground text and icons on light or dark surfaces |
| `--accent-press` | `#312E81` | `#4338CA` | Primary CTA `:active` press fill |
| `--accent-soft` | `color-mix(in oklab, var(--accent) 12%, transparent)` | `color-mix(in oklab, var(--accent) 22%, transparent)` | Active row highlight, soft badge background |
| `--accent-active-surface` | `color-mix(in oklab, var(--accent) 16%, var(--surface-solid))` | `color-mix(in oklab, var(--accent) 26%, var(--surface-solid))` | Persistent selected control fill (toggles, active radio segments) |
| `--accent-active-hover-surface` | `color-mix(in oklab, var(--accent) 22%, var(--surface-solid))` | `color-mix(in oklab, var(--accent) 33%, var(--surface-solid))` | Hover fill for interactive selected toggles |
| `--accent-active-press-surface` | `color-mix(in oklab, var(--accent) 28%, var(--surface-solid))` | `color-mix(in oklab, var(--accent) 18%, var(--surface-solid))` | Deeper press (`:active`) fill for interactive selected toggles |
| `--focus-ring` | `var(--accent)` | `var(--text)` | Keyboard `:focus-visible` outline color (kept distinct in dark theme) |
| `--color-success` | `#166534` | `#a7f3d0` | Positive trend, grant available, verified state (WCAG AA >= 6.1:1 on light soft/subtle surfaces) |
| `--color-success-bg` | `#f0fdf4` | `rgba(16, 185, 129, 0.14)` | Success badge/banner background |
| `--color-warning` | `#92400e` | `#fde68a` | Alert note, partial match, impending deadline (WCAG AA >= 6.1:1 on light soft/subtle surfaces) |
| `--color-warning-bg` | `#fff7ed` | `rgba(245, 158, 11, 0.12)` | Warning badge/banner background |
| `--color-danger` | `#B91C1C` | `#fca5a5` | Critical error, missing requirement, closed (WCAG AA >= 5.6:1 on light soft/danger surfaces) |
| `--color-danger-bg` | `#fef2f2` | `rgba(239, 68, 68, 0.14)` | Error badge/banner background |
| `--color-info` | `#1d4ed8` | `#93c5fd` | Informational note, exam group badge |
| `--color-info-bg` | `#eff6ff` | `rgba(59, 130, 246, 0.14)` | Info badge/banner background |
| `--skeleton-base` | `#e5e7eb` | `#222427` | Base layer of loading placeholder |
| `--skeleton-highlight` | `rgba(255, 255, 255, 0.65)` | `rgba(255, 255, 255, 0.08)` | Shimmer wave of loading placeholder |
| `--selection-bg` | `color-mix(var(--accent) 16%)` | `color-mix(var(--accent) 35%)` | User mouse text selection background |
| `--selection-text` | `#111827` | `#ffffff` | User mouse text selection color |

When a page has older local tokens or arbitrary HEX/RGB values, map them back toward the shared tokens rather than expanding the local palette. Hardcoding colors in page-specific CSS files is strictly prohibited.

## Layout Patterns

### Working Pages

Use this structure for catalog-like or data-heavy pages:

1. Optional scope/status banner.
2. Toolbar with search, filters, counts, and view controls.
3. Main results or detail content.
4. Loading, empty, and error states inside the same layout.

Good references:

- `frontend/css/universities/*` catalog toolbar, filters, and university cards.
- `frontend/css/ranking.css` ranking list.
- `frontend/css/guide.css` guide sidebar and content sections.

Guide articles use a constrained reading column and mark the current contents link with a selected surface and a stronger font weight. Underline links to related articles in the body text so they remain identifiable without color.

### Information Pages

Use a large title, muted lead copy, and clean sections. Keep sections full-width within the page shell. Avoid stacked card-in-card layouts unless the cards are repeated items.

Good references:

- `frontend/css/about.css`
- `frontend/css/guide.css`

### Detail Pages

Use one main detail shell with a real cover image, header metadata, tabs, and tab content. Tabs should be quiet underlined controls, not filled pills. The content should feel connected to the main detail shell.

Good reference:

- `frontend/css/university/`, especially the detail shell, overview/programs, admissions, and finance modules.

## Spacing and Grid System

UniSearch uses a shared spacing scale with compact 2px and 6px steps, a regular 4px/8px rhythm, and larger page-level steps. Use semantic aliases for repeated roles so responsive values can be changed centrally:

| Token | Value | Intended use |
| --- | ---: | --- |
| `--space-0-25` | 1px | Optical alignment only |
| `--space-0-5` | 2px | Fine component spacing |
| `--space-1` / `--space-1-5` | 4px / 6px | Compact component spacing |
| `--space-2` / `--space-3` | 8px / 12px | Controls, metadata, and small groups |
| `--space-4` / `--space-5` | 16px / 20px | Cards and repeated content |
| `--space-6` / `--space-8` | 24px / 32px | Page sections and content groups |
| `--space-10` / `--space-12` | 40px / 48px | Major page-level separation |
| `--space-16` / `--space-20` / `--space-24` | 64px / 80px / 96px | Rare top-level breathing room |

Use `--layout-page-gutter`, `--layout-section-gap`, `--component-card-padding`, `--component-card-gap`, and `--component-control-gap` for repeated layout roles. Their mobile overrides live in the shared foundation stylesheet.

### 1. Layout Ownership Principle
- Reusable components (cards, badges, list items, buttons) must have zero external margins (`margin: 0`).
- The parent container is solely responsible for positioning and spacing child elements via `display: flex` / `display: grid` and `gap`.
- The only acceptable margin on flex/grid children is auto-alignment (`margin-left: auto` or `margin-top: auto`).

### 2. Preventing Double Spacing (Spacing Stacks)
- **One owner for sibling spacing:** A flex/grid parent uses `gap`; direct children have zero margin on that same axis. Do not combine `gap` with child margins. When a title and its body need different spacing, group them in a wrapper and give that wrapper one `gap` value.
- **Zero margins at container boundaries:** Inside any container that has `padding`, the first child must have `margin-top: 0` and the last child must have `margin-bottom: 0` (e.g., `:first-child { margin-top: 0; }` and `:last-child { margin-bottom: 0; }`).
- **Single-layer padding responsibility:** Do not stack identical padding across nested wrapper divs (e.g. section padding + container padding + inner card padding). Allocate padding only to the visual surface boundary.
- **No phantom slots:** An empty element still takes a flex/grid gap slot and keeps its own padding and margins. Hide empty hosts (`:empty { display: none; }`, or `:has()` for a wrapper around an empty list); keep an empty `aria-live` region rendered but out of the gap flow with `position: absolute`.
- **No negative margin compensation:** Never use negative margins (`margin-top: -Npx`) to counteract unwanted gaps or line-height offsets. Eliminate the source margin or align the typography instead.

Use shared `var(--space-*)` or semantic aliases in margin, padding, gap, and scroll-spacing declarations. `npm run check:design-lint` rejects raw nonzero pixel values, including values inside `calc()` and `clamp()`; a necessary optical or platform workaround needs a same-line `/* spacing-exception: reason */` comment. Browser E2E checks scan active catalog, profile, admissions, and finance layouts for margins stacked on a flex/grid gap axis; add the check when introducing another layout state.

### Cascade and token checks

`npm run check:stylelint` runs [Stylelint](https://stylelint.io/) with `stylelint.config.mjs`; editors with the Stylelint extension show the same findings while typing. It reports:

- `no-duplicate-selectors`: a selector defined twice in the same at-rule context. Merge the rules; a breakpoint variant belongs in its own `@media` block.
- `unisearch/no-overridden-declarations` (`scripts/stylelint/no-overridden-declarations.mjs`): a declaration that a later rule for the same selector always overrides, in the same context, a wider `max-width` query or the top level. Delete it, or move the later value into the first rule.
- `declaration-block-no-duplicate-properties` and `declaration-block-no-shorthand-property-overrides`: a property repeated in one block, or a shorthand that resets a longhand above it. An intentional fallback (for example `100vh` before `100dvh`) carries a `stylelint-disable-next-line ... -- reason` comment.
- `scale-unlimited/declaration-strict-value`: colors, `font-size`, `font-weight` and radii must use a token, a function or a keyword; raw values live only in `shared/01-foundation.css`.

### 3. Responsive Spacing
- On desktop, page container padding uses `var(--layout-page-gutter)`; it resolves to 24px.
- At `<= 768px`, the page gutter and card padding resolve to 16px. At `<= 480px`, the page gutter resolves to 12px. Keep responsive overrides in semantic aliases rather than page-specific pixel values.

### 4. Responsive Breakpoint Contract

Use these shared viewport boundaries for product-wide layout changes:

| Boundary | Role |
| --- | --- |
| `<= 480px` | Compact phone: hide nonessential labels and reduce control density. |
| `<= 640px` | Phone: stack content that needs a single-column reading flow. |
| `<= 768px` | Tablet portrait: stack toolbars, page sections, and form layouts. |
| `<= 1024px` | Compact/tablet: replace persistent sidebars and inline navigation search with compact controls. |
| `<= 1280px` | Wide desktop: reduce grid density only when the minimum card width requires it. |

Breakpoints must describe available content space, not a device name. Keep a nonstandard boundary only when a specific component has a documented intrinsic-width constraint (for example, the map's `1180px` split layout or a smallest-phone hardening rule). Pair inclusive boundaries exactly: `max-width: 768px` with `min-width: 769px`, and `max-width: 1024px` with `min-width: 1025px`. Do not add a one-off width merely to compensate for an avoidable layout constraint; prefer wrapping, flexible grids, and progressive disclosure.

## Components

### Buttons

- Shared primitives & control scale (defined globally in `frontend/css/shared/01-foundation.css`):
  - Scale tokens: `--control-height-sm` (`32px` / `--control-radius-sm` `8px`), `--control-height-md` (`40px` / `--control-radius-md` `12px`), and `--control-height-lg` (`44px` / `--control-radius-md` `12px`).
  - Use `.ui-btn` (with optional `.ui-btn--sm` / `.ui-btn--lg` and `.ui-btn--primary`, `.ui-btn--on-bg`, or `.ui-btn--ghost`) for standard buttons/CTAs and `.ui-segmented` + `.ui-segmented__item` for connected segmented toggles; page classes only supply local layout or page-specific rules without redefining the base primitive in page stylesheets.
- Primary: filled accent (`--accent`), `--text-inverse`, `var(--control-height-lg)` (`44px`) for standalone/footer CTAs or `var(--control-height-md)` (`40px`) in compact toolbars, `var(--control-radius-md)` (`12px`), medium/semibold label.
- Secondary: `var(--control-bg)` (`--surface-soft`, or `--surface-control-on-bg` when sitting directly on `--bg`), no border, text color `var(--text)`. Add `var(--shadow-xs)` or `var(--shadow-micro)` only when its parent surface would otherwise make the control disappear.
- Subtle / utility: no border, `background: var(--surface-soft)`, and restrained micro-elevation where necessary. Avoid heavy outlines where soft surface contrast and micro-shadow already define the element cleanly.
- Icon-only: square `34-40px`, Heroicons only, always with `aria-label`.
- Hover should be subtle: surface, text/icon-color, or restrained shadow change, gated with `:not(:active)` inside `@media (hover: hover)` so hover never overrides `:active`. Never use `border-color` as a state cue on a borderless component.
- Hover text and surfaces use `--interaction-hover-text` and `--interaction-hover-surface`; open dropdown and popover triggers (`aria-expanded="true"` / `.open`) stay neutral on `--interaction-hover-surface` with `var(--text)`. Persistent selected controls (mode toggles, active radio segments, selected options, active tabs) use `--interaction-active-text` and `--accent-active-surface` (or `--interaction-active-surface` on transparent/tab-like surfaces). Interactive selected toggles lift slightly on hover (`--accent-active-hover-surface`) and sink deeper on press (`--accent-active-press-surface`); already-selected single-choice radio segments (such as the active view mode or route choice) set `cursor: default`.
- Active press: neutral controls sink slightly deeper (`--interaction-press-surface`, or `--surface-raised-press` inside soft cards, keeping `var(--text)`) and primary CTA buttons sink to `--accent-press`, without physical depression or movement. Never use downward translation (translate/translateY), bouncy cartoonish depression (`scale(0.95)`), or spring recoil.
- Disabled controls use `--interaction-disabled-opacity`, a `not-allowed` cursor, and no pointer interaction. Native `disabled`, `aria-disabled="true"`, and `.is-disabled` states must render consistently.
- Focus rings use `outline: 2px solid var(--focus-ring); outline-offset: 2px;` on `:focus-visible` so light and dark themes (plus Forced Colors Mode) remain high-contrast without `outline: none` + `box-shadow` workarounds on standalone controls.

### Inputs and Selects

- Use `var(--surface-soft)` background and no border. If the input sits inside `var(--surface-soft)`, return it to `var(--surface-solid)` and add `var(--shadow-xs)` or `var(--shadow-micro)`.
- Radius: `12-14px`.
- Focus: accent outline or soft focus ring; do not add a border only for focus.
- Never show raw API/network errors in visible form messages.
- Composite fields with an embedded icon, unit, clear button, reveal button, or similar action use one `.ui-input-composite` surface. The container owns hover, focus-within, invalid, and disabled states; its input remains transparent. Hovering or focusing an embedded action must preserve the state of the full field, while the action may use `--interaction-active-surface` as a local cue.

### Switches

- Use `.ui-switch` on `<input type="checkbox" role="switch">` exclusively for binary controls whose effect applies immediately without a save or submit step. Never place switches inside deferred submission forms.
- Geometry and states are standardized globally in `frontend/css/shared/01-foundation.css` (`36×20px` pill track, `16×16px` `--text-inverse` thumb with `--shadow-xs`, `--line-strong` resting track, `--accent` checked track, global `--focus-ring` on `:focus-visible`, and `forced-colors` outlines).
- Always keep the label on the left and the `.ui-switch` on the right, wrapped in a single `<label>` so the entire label or row is clickable.
- When a switch is wrapped inside a full-width surface pill (such as `.u-reviewed-toggle`), the checked surface uses `--accent-active-surface` / `--accent-active-hover-surface` / `--accent-active-press-surface` with `--interaction-active-text`.
- In flat settings lists (`.settings-switch`), rows stay transparent at rest without a persistent checked fill and use `--interaction-hover-surface` on hover and `--interaction-press-surface` on `:active` alongside synchronized `.ui-switch` track feedback.

### Cards and Sections

- Default data card: `background: var(--surface-solid)`, no border, `16-20px` radius, and no default shadow unless the card is raised above a similarly colored context.
- Hover card: a subtle surface, text/icon-color, or optional shadow change only when it is clickable. Do not use a border or a `border-color` transition.
- Repeated item cards are allowed. Avoid wrapping a page section in a card and then placing another unrelated card shell inside it.

### Borderless Surface Hierarchy

- Visible box borders are prohibited for cards, panels, inputs, selects, chips, badges, buttons, and their hover, active, or selected states. Standard cards (`--shadow-card`, `--shadow-card-hover`) and nested controls (`--shadow-micro`) use pure soft shadows without `0 0 0 1px` rings; 1px hairlines are reserved strictly for floating overlays (`--shadow-dropdown`, `--shadow-dropdown-trigger`) that cross card boundaries. `border-color` cannot be used as an interaction cue when `border: none` is the base state.
- The only permitted visible lines are focus outlines, active-tab underlines, table/list separators, range/thumb edges, and a non-box status ring when semantic background, icon, and text cannot make the state clear. Prefer `outline`, `box-shadow`, or a pseudo-element over a component box border.
- On `var(--bg)` or `var(--bg-soft)`, use `var(--surface-solid)` for a working surface. Inside `var(--surface-solid)`, use `var(--surface-soft)` for nested controls and grouped data. Inside `var(--surface-soft)`, step compact controls up to `var(--surface-raised)` (with `var(--surface-raised-hover)` on hover) and give them `var(--shadow-xs)` or `var(--shadow-micro)` — prefer `var(--control-bg)` and `var(--control-shadow)` (scoped in `shared/01-foundation.css`) over one-off `.parent .child` overrides.
- Do not place a child with the same background token beside or inside its visible parent. Change its surface, give the raised item restrained elevation, or remove the unnecessary wrapper. This rule is mandatory in light and dark themes.
- Status components use the matching semantic background token (`--color-*-bg` or `--accent-panel`) plus text/icon color for compact badges and status banners only. Large data cards, funding option cards (`.admission-funding-option`), and exam/stat groups must use neutral surfaces (`var(--surface-solid)` or `var(--surface-soft)`) with micro-elevation (`var(--shadow-micro)` / `var(--shadow-xs)`), never full-card pastel washes.
- Documentary source links (`.program-card__source`, `.qualification-guidance__source`, `.admissions-source-link`) use `color: var(--text); text-decoration: underline; text-underline-offset: var(--space-1)` rather than SaaS button or loud accent link styling.
- Semantic icons: Never use the AI `sparkles` icon for sorting, filter labels, hints, or comparison sections; use domain-specific Heroicons (`bars-3-bottom-left`, `information-circle`, `adjustments-horizontal`, `building-library`) in `var(--text-muted)`.

### Tabs

- Prefer underlined tabs for primary page sections.
- Keep tabs horizontally scrollable on mobile.
- Active state: accent text and a 2px pill-rounded accent underline (`height: 2px`, `border-radius: var(--radius-full)`, `background: var(--accent)`, `bottom: 0`).
- Sliding indicator: interactive tab bars use `setupSlidingIndicator` to smoothly transition the 2px pill indicator between hovered and active tabs. Fallback `::after` underlines match this exact 2px pill specification.
- Avoid filled pill tabs for major page navigation unless the local pattern already requires it.

### Tooltips and Floating UI

- Tooltips use dark neutral surfaces with compact text.
- Modals and drawers are floating layers: they may use stronger shadows and backdrop blur.
- Floating UI must remain keyboard accessible and respect `prefers-reduced-motion`.

## Type Scale

Use standardized typography tokens instead of arbitrary pixel values:

| Semantic Token | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `--text-xs` | `11px` | `--leading-tight` (1.25) | Badges, counters, compact metadata labels |
| `--text-sm` | `13px` | `--leading-normal` (1.5) | Secondary descriptions, card hints, filter options |
| `--text-base` | `14px` | `--leading-normal` (1.5) | Primary interface body text, buttons, inputs |
| `--text-md` | `16px` | `--leading-normal` (1.5) | Lead paragraphs, group subheadings |
| `--text-lg` | `18px` | `--leading-tight` (1.25) | Card titles, modal titles |
| `--text-xl` | `20px` | `--leading-tight` (1.25) | Section titles, drawer headers |
| `--text-2xl` | `24px` | `--leading-tight` (1.25) | Page section titles, hero subheadings |
| `--text-3xl` | `28px` | `--leading-tight` (1.25) | Primary page headings |

Fluid display headings may use `clamp(34px, 5vw, 58px)` for information pages or `clamp(22px, 5vw, 38px)` for detail headers. Fractional font sizes (`11.5px`, `12.5px`, `13.5px`) and non-scale sizes are strictly forbidden and guarded by `npm run check:design-lint`.

### Migration Matrix (Legacy to Tokens)

When cleaning up legacy or vibe-coded CSS, map values according to this standard dictionary:

| Legacy / Arbitrary Value | Target Token / Replacement | Rationale |
| :--- | :--- | :--- |
| `11.5px` | `var(--text-xs)` (`11px`) | Eliminate fractional pixel blur, WCAG readable |
| `12.5px`, `13px`, `13.5px` | `var(--text-sm)` (`13px`) | Standardize secondary/caption scale |
| `15px` | `var(--text-base)` (`14px`) or `var(--text-md)` (`16px`) | Map to nearest even baseline |
| `17px` | `var(--text-md)` (`16px`) or `var(--text-lg)` (`18px`) | Standardize subheading hierarchy |
| `19px` | `var(--text-lg)` (`18px`) | Align card headings to 18px standard |
| `22px` | `var(--text-xl)` (`20px`) | Standardize section title step |
| `margin: -Npx` | `margin: 0` + container `gap` / `align-items` | Eliminate negative compensation hacks |
| `margin: 6px` / `padding: 6px` | `var(--space-2)` (`8px`) | Snap to 8pt/4pt spatial grid |
| `margin: 10px` / `gap: 10px` | `var(--space-3)` (`12px`) | Snap to 4px half-step scale |
| `margin: 14px` / `padding: 14px`| `var(--space-4)` (`16px`) or `var(--space-3)` (`12px`) | Snap to nearest 4px grid step |
| `margin: 18px` / `padding: 18px`| `var(--space-5)` (`20px`) or `var(--space-4)` (`16px`) | Snap to standard card rhythm |
| `padding: 22px` / `padding: 26px`| `var(--space-6)` (`24px`) | Standardize major surface padding |
| `padding: 30px` / `gap: 30px` | `var(--space-8)` (`32px`) | Snap macro spacing to 32px |
| `margin: 0 !important` | Remove `!important`, fix cascade | Clean specificity conflicts |
| `border-radius: 14px` | `var(--radius-base)` (12px) or `var(--radius-lg)` (16px) | Snap arbitrary radius to design token |
| `border-radius: 6px` | `var(--radius-sm)` (8px) | Snap arbitrary chip/badge radius to token |
| `z-index: 60` / `80` / `100` | `var(--z-dropdown)` or local stacking context | Eliminate layer escalation race |

Use tight negative letter spacing (`-0.01em` to `-0.025em`) only for large headings. Body text and compact labels must keep `letter-spacing: normal` (or `0`). `text-transform: uppercase`, positive `letter-spacing` (`> 0`), `font-style: italic`, and font sizes below `11px` (`--text-xs`) are strictly forbidden and guarded by `npm run check:design-lint`.

### Weight hierarchy

- Use `400` for paragraphs, descriptions, table content, metadata, and supporting copy.
- Use `500` for buttons, navigation, form labels, card titles, and active controls.
- Reserve `600` for page and section headings, important totals, and rare status emphasis.
- Do not use `700–1000` in product styles. Create hierarchy with size, spacing, color, and placement before adding weight.

## Border-Radius System

UniSearch uses unified border-radii tokens to avoid visual clutter and haphazard corner curves:

| Token | Value | Target Components |
| :--- | :--- | :--- |
| `--radius-xs` | `4px` | Micro-elements, progress bar tracks, small status pips |
| `--radius-sm` | `8px` | Badges, filter chips, compact tags, tooltips |
| `--radius-md` | `10px` | Small dropdown items, inner control groups |
| `--radius-base` | `12px` | Search inputs, filter dropdown menus, action buttons |
| `--radius-lg` | `16px` | Standard data cards, secondary layout containers |
| `--radius-xl` | `20px` | Hero sections, modals, major page shells |
| `--radius-full` | `999px` | Circular counter badges, pill status indicators |

Arbitrary pixel values (`6px`, `7px`, `9px`, `14px`, `18px`) and `!important` on border-radius are strictly prohibited and enforced by `npm run check:design-lint`.

## Layering and Z-Index System

To eliminate the "Z-Index escalation race" (`z-index: 15`, `60`, `80`, `100`, `420`), UniSearch enforces strict stacking context discipline:

1. **Stacking Context Isolation:** Complex widgets with internal layers (maps, sticky data tables) must create their own stacking context via `isolation: isolate`.
2. **Local Layers:** Within an isolated context, only micro-layers (`-1`, `0`, `1`, `2`) are permitted for pseudo-elements and sticky columns/headers.
3. **Global Semantic Layers:** Cross-component layering must use the standard tokens declared in `frontend/css/shared/01-foundation.css`:
   - `--z-nav` (`1000`): Sticky page header and primary navigation bar.
   - `--z-dropdown` (`1200`): Search suggestions, autocomplete popups, custom select menus, and tooltips (`calc(var(--z-dropdown) + 1)` for active tooltip wrappers).
   - `--z-docked-control` (`1300`): Floating action buttons, docked bottom comparison bar.
   - `--z-drawer` (`2000`): Slide-over filter drawers on tablet/mobile.
   - `--z-tray` (`2200`): Sticky bottom sheet notifications.
   - `--z-modal` (`8000`): Modal dialogs and dark backdrops.
   - `--z-modal-raised` (`8200`): Secondary nested dialogs or confirm prompts.
   - `--z-toast` (`9000`): Global toast alerts and notification banners.
   - `--z-loading-bar` (`9400`): Top progress bar during page navigation.
   - `--z-initial-loader` (`10000`): First-paint loading splash screen.

Raw numeric z-indices outside `[-1, 0, 1, 2]` are strictly forbidden and guarded by `npm run check:design-lint`.

## Color and Theme Rules

- Light theme should be bright but not pure-white everywhere: `var(--bg)` and `var(--bg-soft)` create the page base.
- Dark theme should use true dark neutral surfaces, not inverted light styles.
- Accent is functional, not decorative. Use it for active states, focus, primary actions, and small progress/status cues.
- Gradients are reserved for rare brand emphasis. Do not use gradients as the default card background.
- Grant/success states may use green tokens, but keep them subdued.

## Motion

- Use the shared tokens in `frontend/css/shared/06-motion-accessibility.css`: `--motion-instant`, `--motion-snappy`, `--motion-fast`, `--motion-medium`, `--motion-slow`, and the shared easing variables.
- Use global motion classes before adding component-specific keyframes: `.motion-panel-enter`, `.motion-list-item-enter`, `.motion-row-exit`, `.motion-chip-remove`, `.motion-card-remove`, `.motion-icon-*`, and `.motion-state-pulse`.
- Page and panel motion should be short fade/lift transitions. Lists may use limited stagger for the first visible items only. Save, compare, remove, and switch feedback should target the icon, thumb, or removed node.
- Use the shared 240 ms crossfade for page navigation and theme changes. Initialize each route as soon as its markup is replaced. Keep the navbar steady during navigation and include it in the palette change when switching themes.
- Use the shared panel entrance for the changed content when a user navigates the deadline calendar or switches steps or study levels in the comparison picker. Keep the trigger focus visible during updates.
- Check that hover changes the actual computed surface, text, or decoration in both themes. Use pointer hover only on devices with a fine hovering pointer, and give touch and keyboard users their own press and focus feedback.
- Calm academic motion over "video game" playfulness: Strictly avoid gratuitous, exaggerated, or gamified animations (no bouncy springs, cartoon squashes like `scale(0.95)`, wobbly button presses, or playful bobbing). Transitions must remain smooth, understated, and functional—focusing on opacity, subtle background color changes, and precise translate enters/exits.
- Do not use `transition-all`, hardcoded duration/easing values, decorative hover lifts on scanning surfaces, or animated `box-shadow` pulses. Use opacity/transform ring motion for state confirmation.
- Always include or preserve `prefers-reduced-motion` fallbacks; reduced motion must leave final UI state visible and usable.
- Move only what the user acted on and its immediate neighbours. Never animate many cards at once, slide whole views in, or shift layout; see `docs/superpowers/specs/2026-11-25-motion-system-design.md`.
- Floating layers keep enter timing on the open rule and exit timing on the closed rule: enter with `--motion-snappy`/`--motion-fast` and `--motion-ease-enter`, exit one step shorter with `--motion-ease-exit`, offset `--motion-offset-sm` (4px). Show/hide through `display` uses `@starting-style` and `transition-behavior: allow-discrete`; the closed state sets `pointer-events: none`.
- Native `<dialog>` and `[popover]` layers opt into `.motion-top-layer` (add `.motion-top-layer--fade` for full-screen layers); it also transitions `overlay` so the layer stays painted while it fades out.
- Custom select panels unfold from the edge they are attached to (`scale: 1 0.96` with `transform-origin` on that edge); `open-up` stays on a closed panel until the next open recalculates it.
- Tooltips opened by hover wait `--motion-tooltip-delay` (200ms); keyboard focus, clicks and a pointer arriving from a neighbouring tooltip (`html.tooltips-warm`) open at once; explicit dismissal (`.is-closed`) hides instantly.
- Elements that JS shows or hides inside a column (dependent filters, notices) use `setRevealed()` from `frontend/javascript/utils/motion-reveal.js`: height and opacity grow or shrink, collapsing content is `inert`, and restores on page load pass `{ instant: true }`. `<details>` disclosures opt into `.motion-disclosure` (`::details-content` with `interpolate-size`; other browsers open instantly).
- View switches (catalog list ↔ map) crossfade the incoming view in place with `fadeIn()`; nothing moves. Changing counts use `setTextWithFade()`.
- In multi-item containers move only what changed: the compare tray enters and leaves once, a new chip enters on its own, a removed chip fades before the re-render. Card grids never replay their entrance as a side effect.
- Panel switchers (university tabs, comparison steps) use `.motion-tab-forward` / `.motion-tab-back`: a fade with an 8px offset from the side the user moved toward. Re-rendering the same panel (a choice changed) plays no motion.
- Opening a university from a catalog card names the card photo and a stand-in in the loading cover `uni-cover` for the router View Transition (`frontend/javascript/components/cover-transition.js`); the gallery replaces the stand-in when the full photo loads. The loading skeleton cover mirrors the real cover box so the swap never changes height. Back navigation keeps the plain fade.
- Re-rendered lists give rows a `data-row-key` and use `readRowKeys()` / `enterNewRows()` so only new or changed rows enter; a removed row collapses with `setRevealed(row, false, { onHidden })` before the data changes. The first render after load is still.
- Content `<details>` opt into `.motion-disclosure`. Leave it off disclosures inside containers that animate their own height (program cards) and off route/context controls that code opens and reads at once.
- Guide sections switch with the directional panel classes; the section shown on load is still.
- `npm run check:design-lint` reports raw durations and easings in `transition`/`animation` declarations (`animation-raw-timing`), including fallbacks such as `var(--motion-fast, 160ms)`.

## Responsive Rules

- Check desktop, tablet, mobile, and narrow mobile around 320-380px.
- Toolbars should wrap into clear rows instead of shrinking text until it overlaps.
- Fixed-format UI such as tabs, cards, icon buttons, and filter controls need stable dimensions.
- Long university names, city names, program names, and translated Russian text must wrap cleanly.

## Implementation Checklist

Before finishing UI work:

- New visible text is localized in English and Russian.
- Light and dark themes are checked.
- Icons come from `frontend/javascript/icons.js`.
- Hover, active, and focus-visible states are present.
- Loading, empty, and error states still fit the layout.
- Mobile and narrow viewport text does not overlap.
- The change follows the nearest existing page/component pattern.
- Relevant i18n and visual/manual checks are run.
