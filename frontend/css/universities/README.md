# University catalog CSS modules

Catalog and comparison HTML pages link these modules directly in the cascade order below.

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-shell-controls.css` | Shared catalog/comparison foundation rules, page shell, filters, search, view controls, UniFit warning banner, and section navigation |
| 2 | `02-catalog.css` | Skeletons, result cards, card status badges, pagination, saved state, and the comparison tray (catalog page only) |
| 3 | `03-comparison.css` | Comparison setup, analysis, tables, cards, and their states |
| 4 | `06-map.css` | Map results panel, map markers, map popups, map card states, and responsive behavior (catalog page only) |
| 5 | `07-responsive.css` | Compact behavior for shared catalog/comparison components and narrow screens |
| 6 | `08-onboarding.css` | First-visit catalog tour and onboarding states (catalog page only) |
| 7 | `09-reviewed-comparison.css` | Reviewed admissions comparison matrix and picker dialog |

Do not reorder imports to fix specificity. Add a base rule to the narrowest
owning module, and add an override only when changing the earlier rule would
alter an established state.
