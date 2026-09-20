# Global CSS modules

`../style.css` is the public global stylesheet entry point. It imports these
modules in their historical cascade order so existing pages keep the same
specificity and responsive overrides.

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-foundation.css` | Design tokens, resets, base elements, scrollbars, loaders, and global component baselines |
| 2 | `02-shell-tooltips.css` | Navigation shell and shared tooltips |
| 3 | `03-settings.css` | Settings dialog and controls |
| 4 | `04-feedback-footer.css` | Toasts, custom selects, and the footer |
| 5 | `05-base-responsive.css` | Earlier shared responsive overrides |
| 6 | `06-motion-accessibility.css` | Motion tokens, transitions, reduced-motion rules, and accessibility refinements |
| 7 | `07-runtime-states.css` | Initial loading, error, offline, and connectivity states |
| 8 | `08-device-responsive.css` | Narrow viewport and device-specific hardening |
| 9 | `09-component-polish.css` | Shared surface and control alignment refinements |
| 10 | `10-admissions.css` | Admission and funding components reused across catalog, detail, and comparison views |
| 11 | `11-navbar-search.css` | Global university search in the navigation shell |

## Ownership rules

- Keep semantic color and elevation tokens in `01-foundation.css`.
- Keep page-only rules in that page's stylesheet. The university catalog entry
  point remains `../universities.css`.
- Profile-only rules belong to `../profile.css`; catalog-only rules belong to
  `../universities.css`.
- Put a reusable component in the narrowest shared module that owns it.
- Do not reorder imports to fix specificity. Resolve the selector ownership
  instead.
- Treat the numbered order as temporary compatibility scaffolding. Consolidate
  duplicate selectors only as a separate, verified change.
