# Third Party Notices

This project uses or references the following third-party icon, font, and brand assets.

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
  - The footer links to the project's GitHub repository with the text label "GitHub"; the logomark image is not currently shown
- Integration note:
  - If the mark is added, it should link only to the project's GitHub page, follow GitHub's logo rules, and stay visually secondary to the UniSearch brand

## 4. University Trademarks, Logos, and Campus Imagery

- Subject: University names, official emblems, logos, and campus photographs
- Assets location:
  - `backend/data/university_assets/logos/` (and `logos-small/`)
  - `backend/data/university_assets/thumbnails/` (and `thumbnails-medium/`, `thumbnails-small/`)
- Rights & Ownership:
  - University names, logos, crests, and emblems are registered or unregistered trademarks and intellectual property of their respective academic institutions.
  - Campus photographs are the intellectual property of their respective photographers, copyright holders, or academic institutions.
  - The root MIT License of this project does **NOT** apply to any third-party university trademarks, logos, or campus photographs.
- Use in UniSearch:
  - University names, logos, and crests are used only to identify the institution a catalog entry refers to (nominative use), in a non-commercial educational project.
  - Campus photographs are freely licensed files from Wikimedia Commons (CC0, public domain, CC BY or CC BY-SA), cropped and resized. Each photograph's author, license and Commons file page are listed in `backend/data/university_assets/credits.json` and shown as a credit on the university page cover; see `backend/data/university_assets/README.md`.
  - Use of these assets does not imply any official affiliation with, endorsement by, or sponsorship from the respective academic institutions.
- Notice & Takedown Policy:
  - If you are an authorized university representative, a photographer, or a copyright holder of any media asset and wish to request attribution credit, correction, or removal, please contact us at **unisearch.sup@gmail.com** or open a GitHub Issue.
  - We review each request and reply by email. A disputed asset is removed while the request is reviewed.

## 5. Inter

- Name: Inter
- Author / Publisher: The Inter Project Authors (Rasmus Andersson)
- Project: https://rsms.me/inter/
- Source repository: https://github.com/rsms/inter
- Distributed through: the `@fontsource-variable/inter` npm package, version 5.3.0
- License: SIL Open Font License 1.1 (OFL-1.1)
- License text: `frontend/fonts/inter/OFL.txt`
- How this project uses it:
  - Self-hosted variable font files stored under `frontend/fonts/inter/` (latin, latin-ext, cyrillic, cyrillic-ext subsets)
  - Declared with `@font-face` in `frontend/css/shared/01-foundation.css` and used through `--font-sans` and `--font-display`
- Integration note:
  - The font files are served unmodified, so the OFL license text and copyright notice must stay next to them
  - The OFL permits use and redistribution, including commercial use, but the font may not be sold on its own

## 6. Leaflet and Leaflet.markercluster

- Leaflet 1.9.4: https://github.com/Leaflet/Leaflet, BSD 2-Clause License, copyright Volodymyr Agafonkin and CloudMade
- Leaflet.markercluster 1.4.1: https://github.com/Leaflet/Leaflet.markercluster, MIT License
- How this project uses them:
  - The catalog map loads both libraries from unpkg with Subresource Integrity hashes in `frontend/javascript/pages/universities.js`
  - The distributed files keep their upstream license headers; the projects are not copied into this repository

## 7. OpenStreetMap map data and tiles

- Data: © OpenStreetMap contributors, Open Database License (ODbL): https://www.openstreetmap.org/copyright
- Tiles: the standard tile layer from `tile.openstreetmap.org`, used under the OpenStreetMap Foundation Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
- How this project uses it:
  - The catalog map shows the tiles with a visible "© OpenStreetMap contributors" attribution that links to the copyright page
  - Heavy or bulk tile use, prefetching, and offline tile download are not permitted by the tile policy; move to another tile provider if traffic grows

## 8. QS World University Rankings

- Publisher: QS Quacquarelli Symonds Ltd.
- Terms: https://www.topuniversities.com/terms-conditions
- Permission relied on: the terms allow reproducing, distributing and displaying QS World University Rankings data as displayed on topuniversities.com, provided that the original source attribution, the copyright notice and the phrase "With permission from QS Quacquarelli Symonds" appear alongside it, with hyperlinks retained. The data may not be reconfigured.
- How this project uses it:
  - `backend/data/universities.json` stores each university's published QS World University Rankings 2026 position (`rank`, `rank_meta`) unchanged; universities QS does not publish carry no position
  - The catalog, university and comparison pages show the position and name QS as the source, and their footer carries the notice "Source: QS Quacquarelli Symonds (www.qs.com). With permission from QS Quacquarelli Symonds. Copyright © QS Quacquarelli Symonds Ltd." with a link to www.qs.com
- Limits:
  - The permission covers this non-commercial use. Any commercial use of the rankings (advertising, paid features, selling data) needs written permission from QS via content@qs.com
  - Only the published position is shown; QS indicator scores and full ranking tables are not copied

## Summary

- Main UI icon pack: Heroicons (MIT)
- UI typeface: Inter (SIL OFL 1.1)
- Country flags: flag-icons (MIT)
- Map libraries: Leaflet (BSD 2-Clause) and Leaflet.markercluster (MIT)
- Map data and tiles: OpenStreetMap (ODbL, attribution required; Tile Usage Policy)
- Global ranks: QS World University Rankings, shown with QS's required source notice; commercial use needs QS's written permission
- GitHub: text link only; the logomark is governed by GitHub brand usage rules
- University assets (logos and campus photos): Property of respective institutions and copyright holders; excluded from the MIT License; logos used to identify institutions, photographs only from sources that permit reuse, with a Notice & Takedown procedure.
