# UniFit Tag Rules

This document defines the product rules for university-card tags used in UniFit sorting.

## Goals

- Keep tag meaning stable across backend hints, frontend rendering, and tests.
- Avoid contradictory tags appearing together.
- Preserve a clear priority when the card is dense.

## Rule Model

Each tag belongs to a rule group.

- `preference_match`
- `admission_state`
- `finance_route`
- `requirements_state`
- `budget_aid_state`

Within a group, only one tag may be shown unless the group explicitly allows stacking.

## Preference Match Group

This group represents the same underlying signal: how well the university matches the user's preference sliders.

Visible tags:

- `your_vibe`
- `top_match` (UI label: `Good Match`)

Rules:

1. `your_vibe` and `top_match` are mutually exclusive.
2. `your_vibe` is the higher tier.
3. `top_match` may appear only if the card does not qualify for `your_vibe`.
4. The explanatory `why` text for this group must come from the single visible tag in the group.

Thresholds:

- `your_vibe`: `preferenceMismatch <= 0.14`
- `top_match`: `0.14 < preferenceMismatch <= 0.22`

UI labels:

- Russian: `Ваш формат`, `Хорошее совпадение`
- English: `Your Vibe`, `Good Match`

## Admission State Group

Visible tag:

- `conditional_exam_needed`

Rules:

1. Show when the result is conditional because required exam evidence is incomplete.
2. This tag has the highest explanatory priority for `why` text.
3. This state suppresses `requirements_met`.

## Finance Route Group

Visible tags:

- `likely_grant`
- `paid_admission`

Rules:

1. These tags are mutually exclusive.
2. Show only the route that matches the selected or inferred chance mode.
3. `likely_grant` is used for the grant path.
4. `paid_admission` is used for the paid/general path.

## Requirements State Group

Visible tags:

- `below_requirements`
- `requirements_met`

Rules:

1. These tags are mutually exclusive.
2. `below_requirements` wins over `requirements_met`.
3. `requirements_met` must not be shown when the card is conditional.

## Budget and Aid State Group

Visible tags:

- `over_budget`
- `over_budget_aid`
- `aid_available`

Rules:

1. `over_budget` and `over_budget_aid` are mutually exclusive.
2. If the university is over budget and aid is available, prefer `over_budget_aid`.
3. If the university is over budget and no aid is available, use `over_budget`.
4. `aid_available` may appear only when the card is not over budget.

## Default Display Priority

When multiple groups produce tags, render them in this order:

1. `conditional_exam_needed`
2. `your_vibe` or `top_match`
3. `likely_grant` or `paid_admission`
4. `below_requirements` or `requirements_met`
5. `over_budget` or `over_budget_aid` or `aid_available`

## Implementation Notes

- Backend hints should remain the primary source when available.
- Frontend fallback logic must preserve the same exclusivity and priority rules.
- Tests must cover contradictory combinations, especially:
  - `your_vibe` + `top_match`
  - `conditional_exam_needed` + `requirements_met`
  - `likely_grant` + `paid_admission`
  - `over_budget` + `aid_available`
