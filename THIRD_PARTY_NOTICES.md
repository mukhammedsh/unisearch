# Third Party Notices

This project uses or references the following third-party icon and brand assets.

## 1. Heroicons

- Name: Heroicons
- Author / Publisher: Tailwind Labs
- Project: https://heroicons.com/
- Source repository: https://github.com/tailwindlabs/heroicons
- License: MIT
- License note: The Heroicons repository states that the library is MIT licensed.
- How this project uses it:
  - UI action icons and state icons rendered via `frontend/javascript/icons.js`
  - Used across navigation, filters, tabs, badges, toasts, and other interface controls
- Integration note:
  - Icons are embedded as inline SVG paths adapted from Heroicons and styled through `currentColor`
  - The project uses a unified `24/outline`-style visual language for UI icons

## 2. flag-icons

- Name: flag-icons
- Author / Publisher: Lipis
- Project site: https://flagicons.lipis.dev/
- Source repository: https://github.com/lipis/flag-icons
- License: MIT
- License note: The `lipis/flag-icons` repository is published under the MIT license.
- How this project uses it:
  - Country flag SVG assets stored under `frontend/images/flags`
  - Rendered through `frontend/javascript/utils.js` in `getFlagImg()`
- Integration note:
  - These assets are kept as a separate country-flag set and are not part of the main UI icon system
  - The local SVG files use the `flag-icons-*` identifier pattern that matches the upstream `flag-icons` project

## 3. GitHub Logomark / Invertocat

- Name: GitHub logomark / Invertocat
- Owner: GitHub, Inc.
- Brand guidelines: https://github.com/logos
- Additional brand guidance: https://brand.github.com/foundations/logo
- Usage policy note:
  - GitHub logos are brand assets governed by GitHub logo usage rules and trademark policy, not by the Heroicons MIT license used for the UI icon set
- How this project uses it:
  - Footer social link icon on several pages
  - Currently referenced via remote image URL in page footers
- Integration note:
  - The GitHub mark is used only to link to the project's GitHub page
  - It should remain visually secondary to the UniSearch brand and should not be used to represent the project itself

## Summary

- Main UI icon pack: Heroicons
- Country flags: flag-icons
- Brand/social mark: GitHub logomark under GitHub brand usage rules
