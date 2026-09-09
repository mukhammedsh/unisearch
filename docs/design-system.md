# UniSearch Design System

UniSearch uses a calm academic product workspace style. The interface should feel like a practical admissions and university-selection tool: data-dense, quiet, trustworthy, and fast to scan.

Use this document as the source of truth for new UI work. The current baseline is the `2026 Product Refresh` layer in `frontend/css/style.css`.

## Design Direction

- Build working screens first. Catalog, ranking, guide, profile, and university detail pages should solve the task immediately, not behave like decorative landing pages.
- Favor restrained academic/product UI over generic SaaS styling. Avoid plastic gradients, loud AI-style visuals, and one-off decorative effects.
- Keep visual hierarchy clear: page background -> solid surfaces -> repeated cards -> floating overlays.
- Use real university media where it helps identify a university. Do not use atmospheric imagery when the user needs to inspect a concrete university.
- Keep bachelor-only product scope visible where relevant. Do not imply other study levels unless the product scope changes.

## Tokens

Use existing CSS variables instead of new hard-coded palettes. All colors in components and pages must reference these tokens:

- Fonts: `--font-sans` for body/UI and `--font-display` for headings and important labels.
- Type Scale: `--text-xs` (11px), `--text-sm` (13px), `--text-base` (14px), `--text-md` (16px), `--text-lg` (18px), `--text-xl` (20px), `--text-2xl` (24px), `--text-3xl` (28px).
- Line Heights: `--leading-tight` (1.25), `--leading-normal` (1.5), `--leading-loose` (1.7).
- Spacing (8pt / 4pt grid): `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px), `--space-12` (48px), `--space-16` (64px).
- Accent: `--accent` (`#5D17EB` both light and dark), `--accent-strong`, `--accent-soft`, `--accent-faint`, `--accent-panel` (all automatically derived via `color-mix(in srgb, var(--accent) ...)`).
- Backgrounds & Surfaces: `--bg`, `--bg-soft`, `--surface-solid` (alias `--card`), `--surface`, `--surface-soft`.
- Text: `--text`, `--text-muted`.
- Borders & Lines: `--line`, `--line-strong`, `--line-faint`, `--line-accent`, `--line-grant`, `--line-warning`, `--line-danger`, `--line-info`.
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
| `--bg` | `#f4f5f7` | `#0c0d0e` | Page body background |
| `--bg-soft` | `#edf0f4` | `#141517` | Toolbar, filter bar, secondary background |
| `--surface-solid` (`--card`) | `#ffffff` | `#18191b` | Main cards, modals, lists, dropdown panels |
| `--surface` | `rgba(255, 255, 255, 0.88)` | `rgba(24, 25, 27, 0.88)` | Translucent header, floating docked bars |
| `--surface-soft` | `#f1f3f7` | `#222427` | Form inputs, chip/tag pills, table row hover |
| `--text` | `#111827` | `#f3f4f6` | Primary high-contrast typography |
| `--text-muted` | `#64748b` | `#94a3b8` | Secondary labels, descriptions, captions |
| `--line` | `rgba(15, 23, 42, 0.20)` | `rgba(255, 255, 255, 0.20)` | Standard component border |
| `--line-strong` | `rgba(15, 23, 42, 0.30)` | `rgba(255, 255, 255, 0.30)` | Active, hover, or prominent divider border |
| `--line-faint` | `rgba(15, 23, 42, 0.10)` | `rgba(255, 255, 255, 0.10)` | Subtle separator line |
| `--accent` | `#5D17EB` | `#5D17EB` | Primary action button, active indicator, focus ring (exact logo brand purple) |
| `--accent-soft` | `color-mix(var(--accent) 12%)` | `color-mix(var(--accent) 18%)` | Active row highlight, soft badge background |
| `--color-success` | `#15803d` | `#a7f3d0` | Positive trend, grant available, verified state (WCAG AA 5.02:1) |
| `--color-success-bg` | `#f0fdf4` | `rgba(16, 185, 129, 0.14)` | Success badge/banner background |
| `--color-warning` | `#b45309` | `#fde68a` | Alert note, partial match, impending deadline |
| `--color-warning-bg` | `#fff7ed` | `rgba(245, 158, 11, 0.12)` | Warning badge/banner background |
| `--color-danger` | `#dc2626` | `#fca5a5` | Critical error, missing requirement, closed |
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

- `frontend/css/universities.css` catalog toolbar, filters, and university cards.
- `frontend/css/ranking.css` ranking list.
- `frontend/css/guide.css` guide sidebar and content sections.

### Information Pages

Use a large title, muted lead copy, and clean sections. Keep sections full-width within the page shell. Avoid stacked card-in-card layouts unless the cards are repeated items.

Good references:

- `frontend/css/about.css`
- `frontend/css/guide.css`

### Detail Pages

Use one main detail shell with a real cover image, header metadata, tabs, and tab content. Tabs should be quiet underlined controls, not filled pills. The content should feel connected to the main detail shell.

Good reference:

- `frontend/css/university.css`, especially the final `2026 University Refresh` and later polish overrides.

## Spacing and Grid System

UniSearch uses a strict 8-point spatial system (with 4px half-steps for compact UI). Follow these rules to prevent layout drift, double margins, and responsive collapse:

### 1. Layout Ownership Principle
- Reusable components (cards, badges, list items, buttons) must have zero external margins (`margin: 0`).
- The parent container is solely responsible for positioning and spacing child elements via `display: flex` / `display: grid` and `gap`.
- The only acceptable margin on flex/grid children is auto-alignment (`margin-left: auto` or `margin-top: auto`).

### 2. Preventing Double Spacing (Spacing Stacks)
- **Never mix `gap` and child `margin`:** If a flex/grid container has `gap: 16px`, child elements must not have `margin-bottom` or `margin-right`.
- **Zero margins at container boundaries:** Inside any container that has `padding`, the first child must have `margin-top: 0` and the last child must have `margin-bottom: 0` (e.g., `:first-child { margin-top: 0; }` and `:last-child { margin-bottom: 0; }`).
- **Single-layer padding responsibility:** Do not stack identical padding across nested wrapper divs (e.g. section padding + container padding + inner card padding). Allocate padding only to the visual surface boundary.
- **No negative margin compensation:** Never use negative margins (`margin-top: -Npx`) to counteract unwanted gaps or line-height offsets. Eliminate the source margin or align the typography instead.

### 3. Spacing Scale (Tokens)
- `--space-1` (`4px`): Micro-spacing (icon + label, pill internal spacing).
- `--space-2` (`8px`): Compact element spacing (tag lists, badge groups, button icon gap).
- `--space-3` (`12px`): Moderate spacing (subtitles, secondary metadata, compact form fields).
- `--space-4` (`16px`): Standard grid gap, input row spacing, mobile card padding.
- `--space-5` (`20px`): Default desktop card padding, standard vertical rhythm between distinct blocks.
- `--space-6` (`24px`): Section gap, toolbar-to-grid spacing, major card padding.
- `--space-8` (`32px`): Spacing between major independent page sections.
- `--space-12` (`48px`) / `--space-16` (`64px`): Page header top/bottom hero spacing on desktop.

Arbitrary pixel spacing (`3px`, `6px`, `10px`, `14px`, `18px`, `22px`, `26px`, `30px`) is strictly prohibited and guarded by `npm run check:design-lint`.

### 4. Responsive Spacing
- On desktop, page container padding is `24px` to `32px` (`var(--space-6)` to `var(--space-8)`).
- On tablet/mobile (`<= 768px` and `<= 480px`), compress outer padding to `12px - 16px` (`var(--space-3)` - `var(--space-4)`) and card padding to `12px - 16px`. Ensure layout paddings do not exceed 20% of total viewport width.

## Components

### Buttons

- Primary: filled accent, white text, 48-50px minimum height, `10-14px` radius, bold label.
- Secondary: transparent or `var(--surface-soft)`, `1px solid var(--line)`, text color `var(--text)`.
- Icon-only: square `34-40px`, Heroicons only, always with `aria-label`.
- Hover should be subtle: border/accent change, surface change, or `translateY(-1px/-2px)`.
- Active press may use the shared motion helpers from `frontend/javascript/utils.js`.

### Inputs and Selects

- Use `var(--surface-solid)` background and `var(--line)` border.
- Radius: `12-14px`.
- Focus: accent border plus soft focus ring.
- Never show raw API/network errors in visible form messages.

### Cards and Sections

- Default data card: `background: var(--surface-solid)`, `border: 1px solid var(--line)`, radius `16-20px`, no default shadow.
- Hover card: slight accent border and optional `var(--shadow)` only when the card is clickable.
- Repeated item cards are allowed. Avoid wrapping a page section in a card and then placing another unrelated card shell inside it.

### Tabs

- Prefer underlined tabs for primary page sections.
- Keep tabs horizontally scrollable on mobile.
- Active state: accent text and a small accent underline.
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

Use tight letter spacing only for large headings. Body text should keep normal readability.

## Color and Theme Rules

- Light theme should be bright but not pure-white everywhere: `var(--bg)` and `var(--bg-soft)` create the page base.
- Dark theme should use true dark neutral surfaces, not inverted light styles.
- Accent is functional, not decorative. Use it for active states, focus, primary actions, and small progress/status cues.
- Gradients are reserved for rare brand emphasis. Do not use gradients as the default card background.
- Grant/success states may use green tokens, but keep them subdued.

## Motion

- Use the shared tokens in `frontend/css/style.css`: `--motion-instant`, `--motion-snappy`, `--motion-fast`, `--motion-medium`, `--motion-slow`, and the shared easing variables.
- Use global motion classes before adding component-specific keyframes: `.motion-panel-enter`, `.motion-list-item-enter`, `.motion-row-exit`, `.motion-chip-remove`, `.motion-card-remove`, `.motion-icon-*`, and `.motion-state-pulse`.
- Page and panel motion should be short fade/lift transitions. Lists may use limited stagger for the first visible items only. Save, compare, remove, and switch feedback should target the icon, thumb, or removed node.
- Do not use `transition-all`, hardcoded duration/easing values, decorative hover lifts on scanning surfaces, or animated `box-shadow` pulses. Use opacity/transform ring motion for state confirmation.
- Always include or preserve `prefers-reduced-motion` fallbacks; reduced motion must leave final UI state visible and usable.

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
