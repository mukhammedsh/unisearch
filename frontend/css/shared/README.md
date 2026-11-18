# Global CSS modules

HTML pages link these shared stylesheet modules directly in the cascade order below (avoiding CSS `@import` request chains) so pages keep the same specificity and responsive overrides.

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-foundation.css` | Design tokens, resets, base elements, scrollbars, loaders, modal scroll containment, Forced Colors Mode overrides, and global component baselines |
| 2 | `02-shell-settings-feedback.css` | Navigation shell, shared tooltips, settings dialog and controls, toast notifications, custom selects, and the footer |
| 3 | `06-motion-accessibility.css` | Shared responsive adjustments, motion tokens, transitions, reduced-motion rules, accessibility refinements, and initial/error/offline/connectivity runtime states |
| 4 | `08-device-responsive.css` | Narrow viewport hardening, surface alignment refinements, and global university search in the navigation shell |
| 5 | `10-admissions.css` | Admission and funding components included only on catalog, comparison, university detail, and profile pages |

## Ownership rules

- Keep semantic color and elevation tokens in `01-foundation.css`.
- Keep page-only rules in that page's stylesheets (`css/universities/*` for catalog/compare, `css/profile/*` for profile).
- Put a reusable component in the narrowest shared module that owns it.
- Do not reorder imports to fix specificity. Resolve the selector ownership
  instead.
- Treat the numbered order as temporary compatibility scaffolding. Consolidate
  duplicate selectors only as a separate, verified change.
