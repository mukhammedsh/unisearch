# University detail CSS modules

The university detail HTML page (`frontend/university.html`) links these modules directly in the cascade order below. Comparison (`frontend/compare.html`) also links `05-admissions-reviewed.css`.

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-shell-hero.css` | Detail page shell, container, loading/error states, cover photo gallery and lightbox viewer, header and quick actions, section boxes, key-value rows, tooltips, and section tabs |
| 2 | `02-overview-programs.css` | Overview tab (`.uni-description*`, `.uni-tag*`, `.overview-summary*`, `.legacy-data-notice*`, `.d-campus-area*`, `.university-coverage*`) and Programs tab (`#tab-programs*`, `.program-*`, `.programs-level-*`) |
| 3 | `03-admissions.css` | Admissions tab (`#tab-admission*`, `#detailDeadlines*`, `.admissions-*`, `.admission-*`, `.chance-*`, `.track-*`, `.mit-admission-*`, `.deadlines-timeline*`, `.deadline-calendar*`, `.deadline-guidance*`) |
| 4 | `04-finance-aid.css` | Finance and costs tab (`#tab-finance*`, `.finance-*`, `.scholarship-*`, `.total-price-card`, `.price-*`, `.cost-*`, `.roi-*`) |
| 5 | `05-admissions-reviewed.css` | Reviewed admissions workspace, study-option and route selectors, requirement check cards, funding drawers, and official sources (shared with comparison) |
| 6 | `06-qualification-guidance.css` | Qualification and exam recognition guidance cards and status badges |

Do not reorder imports to fix specificity. Add a base rule to the narrowest
owning module, and add an override only when changing the earlier rule would
alter an established state.
