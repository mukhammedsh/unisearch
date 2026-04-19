# UniSearch UI Design Audit

Date: 2026-04-19

This audit records the current UI direction and the main areas to align with `docs/design-system.md`.

## Current Design Baseline

The strongest and most consistent direction is the `2026 Product Refresh` layer:

- `frontend/css/style.css` defines shared fonts, colors, surfaces, shadows, and motion tokens.
- `frontend/css/index.css` sets the calm homepage style.
- `frontend/css/universities.css` is the best working-screen reference: filters, toolbar, data cards, mobile drawer, and dark theme.
- `frontend/css/guide.css` and `frontend/css/about.css` are good references for information pages.

## Keep

- Shared fonts: Manrope for UI/body and IBM Plex Sans for headings.
- Accent direction: indigo `#4f46e5`, used functionally.
- Quiet surfaces: light gray page background, white cards, thin borders, minimal default shadows.
- Underlined navigation/tabs for primary page navigation.
- Real university thumbnails and logos in catalog/detail/ranking contexts.
- Short motion using project motion tokens.

## Avoid Copying

- Older local purple values such as `#5715db` when a new component can use `var(--accent)`.
- Heavy gradients on cards or panels.
- Filled pill tabs for primary page sections.
- Large default shadows on normal cards.
- Hard-coded dark theme colors when shared tokens work.
- Decorative UI that makes the app feel like a generic SaaS landing page.

## Alignment Targets

### `frontend/css/universities.css`

Status: strong reference for working screens.

Keep the final `2026 Catalog Polish` direction. Future cleanup can consolidate duplicated older definitions above the refresh layer, but do not do a broad rewrite unless the page is being actively changed.

### `frontend/css/university.css`

Status: partially aligned.

The page already has a `2026 University Refresh`, but later polish left the main detail shell too square and detached from the rest of the product. Align it with catalog/about by keeping the cover image, rounded detail shell, quiet tabs, and connected tab content.

Priority cleanup:

- Keep rounded main shell and cover corners.
- Avoid returning to filled pill tabs.
- Prefer token-based backgrounds/borders over old hard-coded purple panels.
- Keep admissions and finance repeated cards as data cards, not decorative nested panels.

### `frontend/css/ranking.css`

Status: mostly aligned after `2026 Ranking Refresh`.

Keep the data-list layout. Do not reintroduce background image overlays on ranking cards as a default. Ranking should stay fast to scan.

### `frontend/css/guide.css`

Status: aligned.

Guide should remain a documentation-style working screen with sticky navigation and section cards. Avoid turning it into a marketing page.

### `frontend/css/about.css`

Status: aligned.

About uses the right calm shell and proof-card language. Keep future sections simple and factual.

### `frontend/css/style.css`

Status: shared baseline with some legacy layers.

The final `2026 Product Refresh` tokens should be treated as source of truth. If adding shared UI, add it near the refresh layer or use existing shared classes rather than reviving earlier styles.

## Recommended Future Cleanup

1. Gradually replace old `#5715db` local accent usages with `var(--accent)` where the component is touched.
2. Consolidate repeated dark theme overrides after page-specific refresh sections.
3. Extract common button/input/card patterns only when duplication becomes a real maintenance cost.
4. Add small visual regression coverage for catalog and university detail once the detail page stabilizes.
