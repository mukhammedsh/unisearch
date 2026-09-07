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
  - Source SVG data is synced from the official `@heroicons/react` `24/outline` package
  - Used across navigation, filters, tabs, badges, toasts, and other interface controls
- Integration note:
  - Icons are embedded as inline SVG generated from the upstream Heroicons package and styled through `currentColor`
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

## 4. University Trademarks, Logos, and Campus Imagery

- Subject: University names, official emblems, logos, and campus photographs
- Assets location:
  - `backend/data/university_assets/logos/` (and `logos-small/`)
  - `backend/data/university_assets/thumbnails/` (and `thumbnails-medium/`, `thumbnails-small/`)
- Rights & Ownership:
  - University names, logos, crests, and emblems are registered or unregistered trademarks and intellectual property of their respective academic institutions.
  - Campus photographs are the intellectual property of their respective photographers, copyright holders, or academic institutions.
  - The root MIT License of this project does **NOT** apply to any third-party university trademarks, logos, or campus photographs.
- Permitted Usage in UniSearch:
  - Included solely for non-commercial educational, informational, and identification purposes (Nominative Fair Use) to assist prospective undergraduate students in recognizing institutions.
  - Use of these assets does not imply any official affiliation with, endorsement by, or sponsorship from the respective academic institutions.
- Notice & Takedown Policy:
  - If you are an authorized university representative, a photographer, or a copyright holder of any media asset and wish to request attribution credit, correction, or immediate removal, please contact us at **unisearch@inbox.ru** or open a GitHub Issue.
  - Requests are acknowledged and addressed within 48 hours.

## Summary

- Main UI icon pack: Heroicons (MIT)
- Country flags: flag-icons (MIT)
- Brand/social mark: GitHub logomark under GitHub brand usage rules
- University assets (logos and campus photos): Property of respective institutions and copyright holders; excluded from the MIT License; used under Nominative Fair Use with an active 48-hour Notice & Takedown procedure.
