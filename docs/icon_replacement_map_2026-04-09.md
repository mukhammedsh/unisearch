# Heroicons Replacement Map

Chosen pack: `Heroicons 24/outline`

Why this pack:
- Matches the site's existing thin outline UI better than a heavier or duotone set.
- Works cleanly in light and dark themes via `stroke="currentColor"`.
- Safe default from a licensing standpoint for project-wide use.

Keep as-is:
- Brand logos in `frontend/images/*.png`
- University logos from backend assets
- Country flags in `frontend/images/flags/*.svg`

Replace next:

1. Navigation and global UI
- `frontend/javascript/components.js`
- Menu button -> `Bars3`
- Theme button -> `Moon` and optionally `Sun` when toggled
- Edit profile name SVG -> normalize to Heroicons `PencilSquare`
- Profile close SVG -> normalize to Heroicons `XMark`

2. University list page
- `frontend/universities.html`
- Filter title SVG -> `Funnel`
- Search SVG -> `MagnifyingGlass`
- List view SVG -> `Bars3BottomLeft`
- Map view SVG -> `Map`
- Tooltip `i` buttons -> `InformationCircle`
- Optional for reset button text -> add `ArrowPath`

3. University detail page
- `frontend/university.html`
- Website link SVG -> `Link`
- Show on map SVG -> `MapPin`
- Tab emoji:
- General tab icon -> `DocumentText`
- Programs tab icon -> `AcademicCap`
- Admission tab icon -> `ClipboardDocumentList`
- Costs tab icon -> `Banknotes`
- Removed decorative location pin; location now relies on text + flag only.

4. Homepage
- `frontend/index.html`
- Feature emoji:
- AI feature icon -> `CpuChip` or `Sparkles`
- Finance feature icon -> `Banknotes`
- Comparison feature icon -> `RocketLaunch`

5. Ranking page
- `frontend/ranking.html`
- Title icon -> `Trophy`

6. Feedback and states
- `frontend/javascript/utils.js`
- Toast success -> `CheckCircle`
- Toast error -> `ExclamationTriangle`
- Toast close -> `XMark`
- `frontend/javascript/pages.js`
- UniFit warning `!` -> `ExclamationCircle` or `ExclamationTriangle`
- Scholarship state icons -> `CheckCircle` / `XCircle` / `QuestionMarkCircle`

7. Footer
- All static pages with footer GitHub icon
- Replace Wikimedia hotlink with a local `github.svg`
- This remains a brand icon, not part of Heroicons

Implementation rule:
- Use one visual system for UI actions and states: `Heroicons 24/outline`
- Do not mix Heroicons with emoji in the same UI layer
- Keep flags and brand marks as separate asset categories

