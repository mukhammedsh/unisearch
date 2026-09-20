# Profile CSS modules

`../profile.css` is the applicant profile stylesheet entry point.

| Order | Module | Responsibility |
| --- | --- | --- |
| 1 | `01-shared-foundation.css` | Profile controls and responsive rules extracted from the global stylesheet |
| 2 | `02-page.css` | Profile page layout and later visual refinements |

Keep profile-only selectors here instead of adding them to the global
`../style.css` chain.
