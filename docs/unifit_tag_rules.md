# UniFit card indicators

Card indicators explain the data behind a UniFit recommendation. They help the reader notice a subject mismatch, an unmet minimum or a cost that needs attention. They do not predict admission or a funding award.

The frontend renders them in `frontend/javascript/pages/universities.js`. Reviewed universities use `reviewedCardIndicators`; the other institutions retain their existing indicators until their detailed admissions review is complete. Both paths use localized text and shared tooltip controls.

## Reviewed universities

Massachusetts Institute of Technology, Imperial College London, Stanford University and Nazarbayev University use the reviewed catalog. Their indicators read `matchData.subjectMatch`, `requirementsFitPercent`, `requirementChecks`, `budgetAssessment` and `costQuote`.

### Subject

A subject indicator describes the current study level and, where selected, the saved program.

- A match means the current catalog selection includes a program in the profile's subject.
- Without a saved program, a mismatch means no matching option was found in the catalog for the requested level.
- With a saved program, a mismatch means that program differs from the profile's subject. It does not mean the university lacks that subject.
- An unresolved or invalid selection stays unknown. Do not turn it into a claim that a program is not offered.

### Preferences

Show at most one positive preference indicator:

| Indicator | Preference mismatch |
| --- | --- |
| `your_vibe` | At most 0.14 |
| `top_match` | Above 0.14 and at most 0.22 |

These compare the profile's study preferences with university-level indicators. They do not establish that a particular course suits the applicant or that its admission conditions are met. A larger mismatch does not produce a positive preference indicator.

### Minimum requirements match

Show the percentage only when the API supplies a finite numeric result and measurable checks. The tooltip states how many checks were met and explains that other admission conditions still need review.

An unmet measured minimum receives warning priority. A missing result stays unavailable; it is not displayed as zero or replaced by a positive badge. Required-exam presence, funding and nonnumeric conditions do not enter the percentage. The university page explains missing evidence and rules that cannot be checked automatically.

Use **Minimum requirements match** as the English display name and translate the descriptive label in the existing Russian and Kazakh packs. Existing API fields such as `chancePercent` keep their identifiers.

### Budget

A budget indicator needs a positive profile budget, a cost quote and a supported comparison status: within budget, above budget or an uncertain price range.

The explanation must retain the price basis. Tuition alone excludes living and other costs; a dated reference does not confirm the price for a later intake. An uncertain range asks the reader to check the selected program's cost. Unknown prices and fee applicability do not establish affordability. Potential aid is not deducted.

### Order and overflow

Reviewed indicators use this priority:

1. A subject mismatch or an unmet measured minimum.
2. A cost above budget.
3. Other supported subject, requirements or cost information.
4. A positive preference match.

The reviewed card has up to three indicator positions. When more indicators apply, the last position opens the remaining items. Warnings appear before positive preference information.

## Institutions awaiting detailed review

The other 46 institutions use backend `uiBadgeHints` with the existing frontend fallback rules. Their review-pending status remains visible on the university page.

- `your_vibe` and `top_match` are mutually exclusive and use the thresholds above.
- `conditional_exam_needed` explains missing required exam evidence and suppresses `requirements_met`.
- `below_requirements` and `requirements_met` are mutually exclusive. They describe measured minima, not all admission conditions.
- `over_budget`, `over_budget_aid` and `aid_available` are mutually exclusive. An aid opportunity does not establish the applicant's eligibility or an award.
- These cards retain up to four indicator positions, including overflow when needed.

`likely_grant` and `paid_admission` are not current card indicators. Do not restore the former rule that inferred admission or funding outcomes from a chance mode.

## UniFit notice

The catalog still has a dismissible information note. It can appear in UniFit mode when exam or language evidence is absent, or a listed result needs more evidence. The note explains that ranking uses the available profile data. It must not describe missing information as a failed requirement or a conditional admission offer.

This note does not block sorting. The former confirmation dialog for profiles without exam results has been removed. Keep the notice separate from the checks for a particular application path, where the reader can see exactly what is missing or cannot be assessed.

## Access and verification

An indicator's meaning must be available through keyboard focus and click as well as hover. Keep its accessible name, visible explanation and translated wording consistent. Color alone must not carry the result.

Focused tests should cover unknown versus failed minima, subject mismatches with and without a saved program, price scope, warning order and overflow. Check the rendered tooltip on desktop and narrow screens when changing labels or layout.
