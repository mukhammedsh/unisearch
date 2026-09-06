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

Use existing CSS variables instead of new hard-coded palettes:

- Fonts: `--font-sans` for body/UI and `--font-display` for headings and important labels.
- Accent: `--accent` (`#4f46e5`) and `--accent-strong`.
- Backgrounds: `--bg`, `--bg-soft`, `--surface`, `--surface-solid`, `--surface-soft`.
- Text: `--text`, `--text-muted`.
- Borders: `--line`, `--line-strong`.
- Motion: `--motion-fast`, `--motion-medium`, `--motion-ease-standard`, `--motion-ease-enter`, `--motion-ease-exit`.

When a page has older local tokens such as `--card`, `--muted`, or older purple accent values, map them back toward the shared tokens rather than expanding the local palette.

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

### 3. Spacing Scale
- `4px`: Micro-spacing (icon + label, pill internal spacing).
- `8px`: Compact element spacing (tag lists, badge groups, button icon gap).
- `12px`: Moderate spacing (subtitles, secondary metadata, compact form fields).
- `16px`: Standard grid gap, input row spacing, mobile card padding.
- `20px`: Default desktop card padding, standard vertical rhythm between distinct blocks.
- `24px`: Section gap, toolbar-to-grid spacing, major card padding.
- `32px`: Spacing between major independent page sections.
- `48px / 64px`: Page header top/bottom hero spacing on desktop.

### 4. Responsive Spacing
- On desktop, page container padding is `24px` to `32px`.
- On tablet/mobile (`<= 768px` and `<= 480px`), compress outer padding to `12px - 16px` and card padding to `12px - 16px`. Ensure layout paddings do not exceed 20% of total viewport width.

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

- Page title: `clamp(34px, 5vw, 58px)` for information pages, smaller `clamp(22px, 5vw, 38px)` for detail headers.
- Section heading: `24-34px`.
- Card title: `15-21px`, depending on density.
- Body: `14-18px`, with `1.55-1.75` line-height.
- Metadata and labels: `11-13px`, bold, often uppercase only for compact labels.

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
