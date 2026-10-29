# NU backend and frontend contract

Updated: 2026-10-24. Status: implementation in progress. B owns this contract and the shared storage/API schema. The existing reviewed APIs remain the integration surface. NU activation follows A's data handoff and B's source-scope review. Read this file and B's requests.md for subsequent confirmed changes.

## Selection and HTTP surface

- `GET /universities/{id}/study-options?study_level=preparation&page=1&limit=30` returns the existing paginated option shape. Omit the level to browse all options. NU ID is `nazarbayev-university-kaz-astana`.
- `POST /universities/{id}/admissions-context` retains `{profile, context}`. Context fields are `study_option_id`, `application_route_id`, `study_level`, `applicant_route`, `intended_entry_cycle`, `fee_status_context`. Existing response keys, fact groups, sources, applicability and assessment are retained.
- Profile-persisted selection stays `selectedAdmissionChoices[id]` with `studyOptionId`, `applicationRouteId`, `studyLevel`, `applicantRoute`, `intendedEntryCycle`, `feeStatusContext`. URL/local overrides remain ahead of profile defaults. The study-option and route IDs must come from the accepted catalog, not translated names or legacy funding choice keys.
- Unsupported legacy NU category/profile/funding pointers resolve to a visible selection reset through the established reviewed-catalog state. Preserve other profile fields and saved university IDs.
- Canonical browsing levels will be `preparation`, `undergraduate`, `masters`, `doctoral`, `professional`, `residency`, `non_degree`. Foundation is preparation; MD is professional with graduate entry; DBA/DPM retain professional-doctorate awards and can belong to doctoral and professional browsing; residency is distinct. Awards and route restrictions remain separate from browsing levels. Existing bachelor/master/doctorate aliases remain accepted.
- Applicant route values remain `first_year`, `transfer`, `graduate`; preparation/non-degree and internal progression meaning is carried by actual application route/classification and facts, not inferred from education or the award name.

## Evidence payload

`GET /exams/config` is authoritative for supported IDs, ranges, input modes and component definitions. `POST /exams/validate` retains the canonical response. Store its canonical result as the existing profile exam row; preserve `taken_on` where supplied. Profile endpoints will validate evidence using the same coercion path; invalid scores will return 422 instead of becoming raw scoring evidence. The standalone exam-validation endpoint retains 400 for invalid exam submissions.

NUET will use the existing `subject_breakdown` shape. Confirmed target IDs are `NUET`, `NUET_MATH`, `NUET_CRITICAL_THINKING`. The parent remains 0–240; sections will retain their official 0–120 scales. Old total-only results remain valid partial evidence and never acquire inferred section scores.

```json
{
  "id": "NUET",
  "score": 120,
  "details": {
    "components": [
      {"exam": "NUET_MATH", "score": 70},
      {"exam": "NUET_CRITICAL_THINKING", "score": 50}
    ]
  }
}
```

Existing IELTS evidence remains in `profile.languages`, using parent overall plus `details.components`. A required overall and required sections are conjunctive within that test. A complete accepted alternative test can satisfy the language group. Missing required sections remain missing; a discretionary English waiver remains an unassessed condition unless the documented evidence actually establishes it.

GRE, GMAT/GMAT_FOCUS, MCAT, UNT, IB_Diploma and A_LEVEL_CERT retain existing IDs. The following additions are now in `/exams/config`:

| ID | Input | Meaning |
| --- | --- | --- |
| `NUET` | `subject_breakdown`, `use_parent_score`, optional fixed components, `auto_total_strategy: sum` | Parent0–240; `NUET_MATH` and `NUET_CRITICAL_THINKING`0–120. Parent is retained for old/partial results; when both sections are known their sum must match it. Both sections without parent can derive total. |
| `ALEKS` | number1–100 | NU's university-hosted graduate guide documents the reporting scale. This is not a program cutoff. |
| `NURSING_NAT` | `subject_breakdown`, `components_only` | Optional `NAT_KNOWLEDGE` and `NAT_CLINICAL_SKILLS`, each0–100 percent. No parent total. Missing section stays missing. |
| `IFOM_BSE` | `flag`, score0/1 | Official report recorded. Not an asserted pass or invented cutoff.0 means absent and does not satisfy presence. |
| `USMLE_STEP_1` | `flag`, score0/1 | Official report recorded. Not an asserted pass or invented cutoff.0 means absent and does not satisfy presence. |

Standalone validation and profile evidence use these same definitions. `taken_on` remains optional self-reported date; a route's validity/time condition can keep a report unassessed if no applicable date boundary is published.

## Source-bound assessment response

The existing `assessment` response keeps `overallChance`, `chanceAvailable`, `scoreMeaning`, `reason`, `checks`, `missing_evidence`, `sources`, and the choice projection. The percentage is the share of measurable published minima met; it is never an admission/aid probability. No measurable minima or insufficient evidence yields null. A verified failure may yield zero.

Each new numeric/alternative interpretation is bound to a reviewed fact ID and content hash in `assessments.json`. Numeric exam total/section minima will be checked per attempt, preserving valid partial records and avoiding combining sections from different test dates. One accepted academic alternative satisfies its group; overall and required sections within an alternative use AND. Presence-only tests do not invent numeric minima. Waivers, qualification recognition, experience, institutional decisions and other unsupported conditions retain an explicit explanation and assessment state.

The implemented new check kind is `academic_requirement`. Its `rule.alternatives` can contain `{exam_id, minimum}`, `component_minimums: {component_id: minimum}`, `components_at_least: {count, minimum, exam_ids?}`, or `{profile_field: "gpa", minimum, scale}`. Fields within an alternative are conjunctive; alternatives are OR. A source-specific basic-profileGPA check compares only the same declared scale; no4↔5 conversion. The existing `language_requirement` kind also accepts `component_minimums` and evaluates each complete language report separately.

For these checks `provided` preserves the chosen canonical attempt and adds `minimum_checks`, a list of `{exam, minimum, provided, status}` atoms. A counted-grade atom retains its required count/each minimum and reported/meeting-minimum counts. The outer check remains `met`, `unmet`, `missing`, or `unassessed`; a failed section cannot be hidden by a passing total. C should present the failing/missing atom with its source-backed group, without duplicating the route's academic percentage.

Funding creates another application context only where the official process distinguishes it. It does not create repeated academic percentages for paid/grant variants. Costs retain source period, currency, amount period, fee category, campus and cycle; a whole-program Finance or joint MA fee cannot become annual tuition. Unknown or conflicting amounts remain null or source-labelled references.

## Current implementation checkpoint

NU research is independently accepted and active as the fourth reviewed institution. The runtime snapshot has96 options,46 routes,399 facts,161 sources and29 evidenced unknowns;49 source-bound assessment mappings retain exact fact hashes. The original three institution records remain unchanged. Mid-year entry is a shared undergraduate context without invented program eligibility. Known older mid-year facts stay readable as dated history under a later entry cycle. Transfer, progression, NDS and joint references reach their proper reading domains; original topics and source scope remain traceable.

IFOM/USMLE numeric0/1 survives profile/JSON round trips. Program-specific unknowns are bounded to actual option/route/level IDs. Whole-program and reference-only campus prices remain separate from annual affordability. The current backend/frontend verification and service ownership are recorded in backend-handoff.md and requests.md; final integration is not complete until real browser acceptance and cleanup are recorded.
