# Admissions runtime data contract

This guide explains how the current JSON catalog feeds admission-choice expansion, UniChance, ranking explanations, and the detail page. It documents the fields the runtime already reads; it does not claim that every source condition has a machine-readable gate or that the catalog has been migrated away from older fields.

## Keep one route context

An `admission_categories` row describes an application route. Keep its applicant route, study level, program IDs, and entry cycle with the facts collected for that route. Use official sources and retain `source_url` and `verified_at` on the category or requirement profile. Put conditions that are not represented by a structured field in `extra_requirements` as factual source notes; never apply them to another route by inference.

The runtime expands category and profile data into choices in `backend/app/services/university_tracks.py`. Profile-level `requirements`, `language_requirements`, `language_requirements_mode`, and `required_exam_alternatives` override their category-level counterparts. The scorer reads the expanded choice in `backend/app/services/ai_scoring.py`.

For a program-, course-, or department-specific route, an explicit empty `program_ids`/`program_names` mapping establishes no linked programs. The loader preserves that empty mapping; it must not infer all university programs or borrow their score data. Missing mapping fields in older records are distinct from an explicit empty mapping, and choice expansion must not create an empty source mapping by default. Use actual program IDs when publishing a verified route.

Current examples in `backend/data/universities.json`:

- MIT `mit_regular` is a Fall 2027 first-year route covering institution-wide undergraduate programs. Its category declares SAT or ACT evidence, while its SAT and ACT profiles keep `requirements` empty because MIT publishes no cutoff. The Common Data Set score ranges remain separate historical context, not minimums.
- MIT `mit_bcs_meng_admissions` applies only to the internal Course 6-9 MEng. It records Technical GPA 4.25 and Overall GPA 4.0 on MIT's 5.0 scale as `unassessed_published_minimums`; the generic profile GPA field cannot compare these scoped measures.
- MIT Sloan `mit_sloan_mba_admissions` and `mit_sloan_msms_admissions` each require GMAT Focus, GMAT, or GRE presence. The MSMS route also limits eligibility to partner or affiliate school applicants in `extra_requirements`; the current runtime does not convert that sentence into an applicant gate.
- MIT doctoral profiles such as `mit_aeroastro_doctoral_admissions` preserve the shared program IDs and source. Published English-test floors are recorded as unassessed when the runtime cannot safely apply their scale or applicant exemptions. A reviewed profile with an empty `requirements` map does not mean that the route has no requirements.

## Choosing the right requirement field

Use `requirements` only for a published numeric minimum whose input key exists in the relevant scoring configuration and whose scale matches the applicant evidence. These are numeric checks, not admitted-student percentiles, recommended scores, or a minimum inferred from an offer range.

```json
{
  "requirements": { "GPA": 3.5 }
}
```

Use `required_exam_alternatives` when a source requires evidence of one exam from each group but publishes no score cutoff. Each inner array is an OR group; separate groups are all required. The scorer records a presence check with `minimum: null`; it does not invent a score minimum or turn exam presence alone into a numeric UniChance percentage.

```json
{
  "required_exam_alternatives": [["SAT", "ACT"]]
}
```

This is the current MIT first-year pattern. MIT Sloan uses the same shape for `["GMAT_FOCUS", "GMAT", "GRE"]`. Use only configured exam IDs. A submitted composite exam counts as present only when its submission validates through the configured exam contract.

Use explicit TOEFL scale IDs for new facts; the existing generic TOEFL key is evaluated only when its published floor identifies one configured scale unambiguously.

Use `language_requirements` for supported language checks expressed in the existing language model: native evidence, CEFR, and/or configured test-score thresholds. `language_requirements_mode` is `all` or `any` across the language rules. An `any` result means one listed language option satisfies the route's language rule; individual unsubmitted alternatives can still appear as `missing` checks, so consumers must retain the rule mode when explaining them.

```json
{
  "language_requirements_mode": "any",
  "language_requirements": [
    {
      "code": "en",
      "requirements": { "IELTS": 7, "TOEFL_iBT_0_120": 100 }
    }
  ]
}
```

The scorer recognizes a language exam only when its canonical ID is configured for that language. Legacy `TOEFL` minima are resolved only when exactly one configured TOEFL total scale can contain the published floor. Other unknown IDs or nonnumeric floors appear as `unassessed` checks, and raw scores under those keys do not count as evidence. Prefer `unassessed_published_minimums` for a source fact the current language schema cannot represent cleanly, especially when the floor's scale or applicant-specific gate is unclear. Keep exceptions (international status, primary language, automatic exemption, or a department waiver) in source-backed route notes; this schema cannot infer them from `code: "en"` or `accept_native`.

Use `unassessed_published_minimums` for a published threshold or condition that the current fields cannot compare safely, such as a discipline-specific GPA scale or a language floor that has an unmodeled exemption gate. Preserve the source wording, scale, and scope in each entry. Keep the profile's `requirements_review_status` as `reviewed` only after checking the route's published conditions; use `not_reviewed` when that review has not happened.

```json
{
  "requirements": {},
  "requirements_review_status": "reviewed",
  "unassessed_published_minimums": [
    {
      "id": "mit_course_6_9_technical_gpa",
      "label": "Technical GPA",
      "minimum": 4.25,
      "scale": "MIT 5.0 scale; Course 6-9 subjects",
      "publication_status": "published"
    }
  ],
  "source_url": "https://bcs.mit.edu/academic-program/course-6-9-computation-and-cognition/master-engineering-computation-and-cognition",
  "verified_at": "2026-09-30"
}
```

An unassessed published minimum suppresses the numeric fit. Do not omit it just because another measurable check passed. If required information or applicant applicability is unknown, preserve that status instead of filling the gap with zero, an assumed waiver, or an unrelated route's policy.

## API and explanation contract

`POST /universities/{university_id}/uni-chance` accepts the existing profile payload and returns an overall fit plus per-choice results. A scored percentage is the share of evaluable published academic and language minimum checks met. It is not an admission probability, an aid estimate, or a measure of how far a score exceeds a minimum.

Each choice can include:

```json
{
  "reason": "unassessed_minimums",
  "applicability": { "route": "matched", "cycle": "not_selected", "program": "matched" },
  "details": {
    "checks": [
      { "exam": "IELTS Academic overall band", "examId": "IELTS", "minimum": 7, "provided": 7.5, "status": "unassessed", "condition": "0–9 overall band; applicants whose primary language is not English" },
      { "exam": "SAT or ACT", "minimum": null, "provided": "ACT", "status": "met" }
    ]
  },
  "missingEvidence": []
}
```

Check statuses are `met`, `unmet`, `missing`, or `unassessed`. A `provided` value on an unassessed published minimum is observed evidence only; it does not claim that the applicant meets the minimum or that its applicant condition applies. `condition` carries the source scale or applicability wording, and `examId` identifies a configured language exam when the source minimum names one. If route, program, or cycle applicability is unknown, source checks remain visible but assessable statuses are changed to `unassessed`; provided values and conditions are preserved, while `missingEvidence` is empty because the requirement's applicability is unconfirmed. A verified below-minimum result can produce 0%; missing required evidence, no measurable published minimum, an unreviewed route, or unknown applicability produces no percentage and has a reason code. The API preserves these as distinct states. `missingEvidence` on a choice is a list; the legacy top-level field with the same name is a boolean summary.

An explicit selected program ID that no longer exists in the university catalog is preserved as selected context and reported with `applicability.program: "unknown"`; it does not fall back to institution-wide or unrelated program thresholds. An absent program selection remains `not_selected`.

The AI-ranked universities endpoint also returns `matchData` on each card. It uses the active choice's `requirementsReason`, `requirementChecks`, exact-list `missingEvidence`, and `applicability`. `missingRequiredEvidence` remains a separate legacy boolean. Rank explanations must use the selected route checks rather than reconstructing a generic threshold from `requirementsFitPercent`.

Ranking affordability compares the profile's annual budget with the selected route's applicable gross annual cost. Potential aid can be surfaced separately, but it is never subtracted from cost or treated as a guaranteed award. Unknown or cycle-incompatible cost remains unknown; a verified zero remains a real zero.

## Source review and verification

Keep facts tied to the route, selected programs, applicant scope, and cycle named by the source. A yearless recurring deadline is not a verified future-cycle deadline. When a page names only some accepted tests or does not state waiver criteria, record only what it states and leave the rest unknown.

After changing admission data, run `npm run audit:data`. For scorer or API changes, run a focused backend regression test and then the backend suite before completing the change. Useful checks include `npm run test:backend -- test_ai_scoring`, `npm run test:backend -- test_university_coverage`, and `npm run test:backend`.
