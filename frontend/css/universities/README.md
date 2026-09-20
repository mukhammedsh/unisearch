# University catalog CSS modules

`../universities.css` is the catalog stylesheet entry point. It imports the
modules below in cascade order.

| Order | Module | Responsibility |
| --- | --- | --- |
| 0 | `00-shared-foundation.css` | Catalog-only motion, typography, and tooltip rules extracted from the global stylesheet |
| 1 | `01-shell-controls.css` | Page shell, filters, search, view controls, and section navigation |
| 2 | `02-catalog.css` | Skeletons, result cards, saved state, and the comparison tray |
| 3 | `03-comparison.css` | Comparison setup, analysis, tables, cards, and their states |
| 4 | `04-catalog-responsive.css` | Catalog controls, warning dialog, pagination, map markers, and medium-width behavior |
| 5 | `05-catalog-polish.css` | Current catalog geometry, card states, and sidebar refinements |
| 6 | `06-map.css` | Map results panel, map card states, and responsive behavior |
| 7 | `07-responsive.css` | Compact behavior for shared catalog components and narrow screens |
| 8 | `08-onboarding.css` | First-visit catalog tour and onboarding states |

Do not reorder imports to fix specificity. Add a base rule to the narrowest
owning module, and add an override only when changing the earlier rule would
alter an established state.
