# Profile CSS modules

`profile.html` links these modules directly in cascade order:

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-shared-foundation.css` | Profile controls and responsive rules extracted from the global stylesheet |
| 2 | `02-page.css` | Guided single-page layout (outline, sections, summary, sticky action bar) and later visual refinements |

Keep profile-only selectors here instead of adding them to `shared/*`.
