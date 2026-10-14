# Admissions runtime data contract

This guide documents the reviewed admissions contract for Massachusetts Institute of Technology, Imperial College London and Stanford University, and the retained contract for the other 47 institutions. Published facts, applicant evidence and computed requirements fit remain separate. Unsupported source conditions stay visible and unassessed.

The accepted three-institution batch uses [the storage contract](admissions-storage-contract.md) and the APIs below throughout discovery, detail, ranking and comparison. Its earlier policy fields and reader-specific selections are retired. The legacy fields documented later remain active only for the 47 institutions awaiting their own detailed admissions review.

## Accepted catalog and selected-context APIs

The backend loads the activated `backend/data/admissions/catalog.json`, not research drafts. It requires `runtime_active: true` and exactly the accepted three institutions. Their `universities.json` rows retain common institution information and an `admissions_catalog_id` ownership reference. Ordinary payloads omit their previous program/category/finance policies and disclose `admissions_catalog` metadata: `availability: reviewed`, schema version, catalog revision, study-option count and canonical study levels. The other 47 disclose `availability: legacy_unreviewed` and retain their existing data; this status does not invalidate individual sourced facts or imply a completed new-format review.

- `GET /universities/{university_id}/study-options?search=computing&study_level=undergraduate&page=1&limit=30&lang=eng` returns compact option summaries, actual route IDs, declared application classifications and source references. `study_level` accepts `undergraduate`, `masters`, `doctoral`, or `professional`; `limit` is 1–100. Optional `lang` accepts the existing English, Russian and Kazakh language aliases (maximum 16 characters); otherwise `Accept-Language` supplies the hint. Search reuses token matching and the catalog's localized query aliases, including all canonical subjects that share a Kazakh translation. Official titles, IDs and source facts remain unchanged. The public ETag includes the catalog revision, query and normalized language; conditional GET supports 304 and both responses vary on `Accept-Language`.
- `POST /universities/{university_id}/admissions-context` accepts the existing validated profile and optional request-local context. It returns selected option/route summaries, routes linked to the option, exact candidate facts and unknowns, source records, fact-group references, applicability states, historical/excluded references, and an `assessment`. `history.facts` and `history.unknowns` retain source-backed historical records relevant to the selected option/route/level, without treating their older cycles as current. Historical reference-ID lists remain available. Applicant-specific responses are `private, no-store` and do not use profile values in URLs or ETags.

### University-page context

The three accepted detail pages open with the university overview. Study-option search and program information work without a completed profile or an application route. Choosing a program keeps the Programs tab open; the applicant can then open Admission to select a published route. The route is the primary control, while applicant category, entry cycle and self-reported fee status are in a collapsed Additional details disclosure. A route is never selected automatically from its presence in a program's linked routes. Undergraduate MEng options remain undergraduate; institutional first-year applications, external graduate applications and internal/coterm procedures retain their distinct source targets. Study/degree-completion information is separated from entry requirements. Before route selection, program information includes only facts explicitly scoped to that option with no route restriction; it does not display an applicant assessment. A manual URL with a route opens Admission, and one with only an option opens Programs. A plain university URL opens General, including when a saved choice exists.

Source records use official labels when available and short topic headings otherwise. Exact conditions and source links remain in each expandable fact; routine publication/scope/date metadata is a separate disclosure. Source conflicts and limited publication remain visible warnings. Individual requirement checks are optional, collapsed details and keep the existing non-probability scoring contract. A multi-domain fact is shown once per rendered section set without dropping its values or topics. Official source prose remains in its original language.

Manual context uses `admission_option`, `admission_application_route`, `admission_level`, `admission_route` (applicant category), `admission_cycle` and `admission_fee` URL parameters. Reload and Back/Forward restore that context. Unrelated query parameters and hashes are preserved. Missing URL fields use saved per-institution context first, then general profile defaults; an explicitly empty field clears that default. The request removes saved context defaults from a copy of the API profile before applying manual context, so clearing a selection cannot silently restore a previous program or cycle. Academic/language and institutional evidence remains in the request; no applicant scores are written into URLs. Manual changes stay local until the applicant explicitly saves the application choice. Saving stores the canonical option/route and context under that institution without rewriting general profile preferences; a storage failure is shown as a session-only result.

Every tab consumes the same resolved response. Facts retain source values, periods, conditions, publication/review states and official links. Original-language source summaries are disclosed; interface labels are English/Russian. When a route has no title, its published classification or application destination identifies it without inventing a target. Applicability that cannot be determined stays conditional, and unsupported requirements stay unassessed beside the source rule and submitted evidence. Historical source records appear separately. An unavailable catalog or request failure shows a retry state; an empty search or absent selection does not borrow legacy policy. Superseded requests are aborted and cannot overwrite a newer selection or navigation; replaced controls release their global subscriptions and observers.

Costs retain their published periods and fee panels; a comparable annual total and ROI are unavailable until their scoped projections are supported. Funding opportunities are not awarded aid and are not deducted. Old `admission_program` links are not interpreted as canonical selections. Earlier accepted-institution choices and comparison pointers are cleared with a visible explanation; profile evidence, other preferences and selections for the other 47 are preserved. Existing canonical IDs remain readable, including invalid IDs that produce an explicit unresolved context instead of a fallback route. The other 47 pages continue their existing presentation with the review-pending disclosure.

```json
{
  "profile": {},
  "context": {
    "study_option_id": "imperial-option-computing-meng",
    "application_route_id": "procedure-computing-meng",
    "study_level": "undergraduate",
    "applicant_route": "first_year",
    "intended_entry_cycle": "2027 entry",
    "fee_status_context": "self_reported_international_overseas"
  }
}
```

Explicit context values override profile defaults without changing the saved profile. Omitted fields retain saved defaults; explicitly null fields clear them. Empty option, route, level and cycle strings normalize to null rather than restoring earlier values. Existing degree-level aliases are accepted by the context model; MBA resolves through the selected option's source level rather than its award label. A fee-status hint is self-reported, not an official classification. `available_routes` means routes linked to this option, not confirmed applicant eligibility. No route is selected automatically.

Reviewed deadline panels expose scoped source dates, windows, timezone and applicant restrictions. They currently provide source details and official links, without the earlier calendar navigation or ICS export. A yearless window is not converted into an exact dated event. The other 47 retain their existing calendar presentation where dated facts are available.

Each returned fact's applicability identifies `option`, `route`, `level`, `applicant`, `cycle`, `fee_status`, and `conditions`. Status is `matched`, `conditional`, or `mismatched`; unresolved source dimensions remain unknown. Exact structured IDs and supported explicit cycle labels can establish a match or mismatch. Prose, empty source dimensions, waivers, phase/qualification restrictions, and legal status are not interpreted by a text rule engine. Known incompatible facts are excluded, current conditional facts remain visible, and historical records remain separate. Invalid or unrelated selected IDs produce no active fallback fact set. Shared-policy links establish candidates, not inherited eligibility.

`fact_groups` indexes presentation domains and preserves original topics and values. Compound topics may appear in several groups; topic classification never establishes a requirement or applicability. Degree-completion and declaration rules remain distinct from admissions minimum checks. All source/condition text remains available on facts and assessment checks.

`reference_labels` supplies official titles for canonical option/route IDs and unambiguous source aliases declared in their evidence profiles. The page uses these labels inside program-keyed policy and deadline tables, without dropping the named membership or inferring eligibility from a label. Ambiguous aliases are not resolved automatically.

Reviewed, source-bound assessment records now support selected published checks. They are keyed to exact fact IDs and content hashes in `backend/data/admissions/assessments.json`; changed facts invalidate the corresponding mapping. Required-exam presence, module requirements, published sitting windows, scoped academic metrics and credentials are checked only in their reviewed context. Numeric UniChance counts assessable published academic/language minimum checks; presence, funding and nonnumeric conditions do not enter its denominator. Missing required evidence, uncertain numeric applicability or an unsupported published numeric minimum produces no percentage. Nonnumeric conditions remain visible alongside a limited numeric fit.

An existing saved SAT total with no section details can establish self-reported exam presence after validation against the configured total scale. It does not reconstruct Math/EBRW scores or establish section requirements. Partial or invalid breakdowns cannot use this path; attempt dates retain validation. New exam submissions still require the configured section breakdown through `/exams/validate`.

For `uni-chance`, `ai-sort`, and `compare-profiles`, save canonical fields and their per-institution context:

```json
{
  "selectedAdmissionChoices": {
    "stanford-university-usa-ca": {
      "studyOptionId": "stanford-option-cs-bs",
      "applicationRouteId": "undergraduate-shared-evidence:stanford-transfer",
      "studyLevel": "undergraduate",
      "applicantRoute": "transfer",
      "intendedEntryCycle": "Fall 2027",
      "feeStatusContext": "unknown"
    }
  },
  "study_level": "Bachelor",
  "applicant_route": "transfer",
  "intended_entry_cycle": "Fall 2027"
}
```

The four optional child fields override general profile context when present. Empty `studyLevel`, `applicantRoute` or `intendedEntryCycle` means unknown; absence uses the general default. The API validates canonical levels, applicant/fee enums and bounded cycle text. Accepted institutions always use reviewed assessment, even for guests or obsolete selections; `programId`/`choiceKey` cannot restore their former thresholds. Other institutions continue using their existing selections. UniChance and ranking explanations echo the context and catalog revision. UniFit omits unavailable academic/affordability components and retains its weight normalization; no neutral 50%, legacy price or legacy salary produces a substitute. Comparison evaluates each institution's context independently and exposes selected source facts rather than choosing a route automatically.

### Migration and cache behavior

Browser profile version 2 remains readable. `admissionChoiceResetNotices` is a bounded browser-only list of the three institutions whose earlier choices were reset; it is not forwarded to the API. Complete canonical saves clear the respective notice. Future-version profiles are not overwritten. The old comparison-pointer store retains only legacy-institution selections; reviewed selections use the shared profile contract.

Backend list, map, ranking, comparison and statistics caches include the catalog revision, and assessment-dependent responses include the mapping revision even when the applicant has not selected a route. Detail ETags are derived from the exact representation returned, preventing a concurrent snapshot update from attaching a new ETag to an older body. Browser detail cache version 4 discards the previous derived cache and revalidates reviewed entries with conditional GET. An unavailable reviewed catalog produces an error/retry, not a silently successful stale representation. Legacy-institution cache behavior remains unchanged.

The [inactive history archive](../backend/data/history/README.md) preserves the previous three complete records. It is not read by the application. Legacy synchronization respects `admissions_catalog_id`; neutral institution facts can still be updated without recreating retired academic/financial policy fields.

Malformed requests return 422; institutions outside the accepted batch return 404 on the new resources. Missing or invalid normalized storage returns an explicit 503, with no silently successful empty catalog. Update the snapshot through [the maintenance procedure](../backend/data/admissions/README.md).

## Applicant evidence and test attempts

The profile has optional, additive evidence fields. The selection reset described above preserves those fields and does not change the profile version. Academic and language exam rows can include `taken_on` as a past-or-present ISO date (`YYYY-MM-DD`); native/CEFR language rows cannot include a test date. Validation endpoints retain a supplied date in their normalized result. Dated attempts are retained separately by exam and date; undated legacy attempts keep their existing best-score deduplication. Editing or deleting one attempt does not remove other dated attempts.

The exam configuration now includes:

| Exam ID | Input contract |
| --- | --- |
| `TMUA` | One overall 1.0–9.0 score, to one decimal place; no paper scores or inferred cutoff. |
| `ESAT` | Separate 1.0–9.0 module scores; no combined score. The selected course determines required modules. |
| `UCAT` | Current three cognitive subtests, summed to 900–2700; Situational Judgement remains a separate band. A dated result before the 2025 format start is rejected for this configured edition. |
| `GAMSAT` | Provider-reported overall score with optional section results; the overall value is not recomputed from rounded sections. |
| `LSAT` | The reported 120–180 scaled score; writing and unscored sections do not become numeric admission checks. |
| `MCAT` | Four 118–132 section scores, summed to 472–528. Sitting-window applicability remains separate from score validation. |

Provider URLs and checked dates are stored in `backend/data/exams.json`. Input scales are not admission cutoffs or percentile models. Existing distinct GMAT and TOEFL scale IDs stay distinct; the backend does not convert one edition into another from its date or score magnitude.

`language_evidence` accepts at most 10 self-reported primary-language, education or employment records. Education/work claims retain language, country, qualification level, interval dates, completion state, and an optional `entirely_in_language` boolean. Unknown language-medium evidence is omitted, not stored as false. Country, citizenship, native-language entries and residence do not automatically establish a waiver or recognized qualification.

`institutional_evidence` accepts at most 20 typed records, scoped by institution and, where applicable, program:

- `enrollment`: reported status, total degree `units`, separately reported `major_units` and `completed_major_subjects`, and optional expected completion date.
- `gpa`: `overall`, `technical` or `major` metric, its original value and scale, and optional `as_of_term`. Generic profile GPA does not substitute for an internal technical/major metric.
- `credential`: credential ID, reported completion state/date and optional `score_percent`, used by the SC0x profile field. A self-reported credential is not an institution-confirmed record.

```json
{
  "exams": [{"exam": "TMUA", "score": 6.4, "taken_on": "2026-10-10"}],
  "institutional_evidence": [
    {"kind": "enrollment", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "status": "enrolled", "major_units": 102},
    {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "technical", "value": 4.25, "scale": 5},
    {"kind": "gpa", "university_id": "mit-usa-cambridge", "program_id": "mit-bs-6-9", "metric": "overall", "value": 4.0, "scale": 5}
  ]
}
```

For MIT BCS MEng, the reviewed academic checks use current Course 6-9 enrollment, the two distinct MIT-scale GPA minima, and nine major subjects **or** 102 major units. Total degree units do not establish major-course completion. Remaining research, advisor, project and end-of-applying-term conditions remain visible and are not claimed satisfied by a percentage. Duplicate source references do not duplicate the minimum-check denominator.

Assessment checks include the original rule, source IDs, reported evidence, status and mapping identifiers. `reportedEvidence` retains the applicant's typed claims even when they cannot be assessed. `assessmentRevision` identifies the mappings used and participates in canonical ranking/comparison cache keys. A possible education-language exemption remains unassessed pending its exact conditions; a requested waiver is not an approval. Test age is not inferred against a future submission date. SCM source conflicts and Stanford MCAT cycle ambiguity remain explicit, even when a result or credential has been entered.

## Retained route representation for the other 47 institutions

The following field contracts apply to the retained category/profile reader, not to the activated three-institution catalog. Retired MIT examples are historical illustrations stored in the inactive archive; they must not be restored to active data or used to infer new selections.

An `admission_categories` row describes an application route. Keep its applicant route, study level, program IDs, and entry cycle with the facts collected for that route. Use official sources and retain `source_url` and `verified_at` on the category or requirement profile. Put conditions that are not represented by a structured field in `extra_requirements` as factual source notes; never apply them to another route by inference.

The runtime expands category and profile data into choices in `backend/app/services/university_tracks.py`. Profile-level `requirements`, `language_requirements`, `language_requirements_mode`, and `required_exam_alternatives` override their category-level counterparts. The scorer reads the expanded choice in `backend/app/services/ai_scoring.py`.

For a program-, course-, or department-specific route, an explicit empty `program_ids`/`program_names` mapping establishes no linked programs. The loader preserves that empty mapping; it must not infer all university programs or borrow their score data. Missing mapping fields in older records are distinct from an explicit empty mapping, and choice expansion must not create an empty source mapping by default. Use actual program IDs when publishing a verified route.

Historical examples in `backend/data/history/admissions-cutover-2026-10-13.json`:

- MIT `mit_regular` is a Fall 2027 first-year route covering institution-wide undergraduate programs. Its category declares SAT or ACT evidence, while its SAT and ACT profiles keep `requirements` empty because MIT publishes no cutoff. The Common Data Set score ranges remain separate historical context, not minimums.
- MIT `mit_bcs_meng_admissions` applies only to the internal Course 6-9 MEng. It records Technical GPA 4.25 and Overall GPA 4.0 on MIT's 5.0 scale as `unassessed_published_minimums`; the generic profile GPA field cannot compare these scoped measures.
- MIT Sloan `mit_sloan_mba_admissions` and `mit_sloan_msms_admissions` each require GMAT Focus, GMAT, or GRE presence. The MSMS route also limits eligibility to partner or affiliate school applicants in `extra_requirements`; the current runtime does not convert that sentence into an applicant gate.
- MIT doctoral profiles such as `mit_aeroastro_doctoral_admissions` preserve the shared program IDs and source. Published English-test floors are recorded as unassessed when the runtime cannot safely apply their scale or applicant exemptions. A reviewed profile with an empty `requirements` map does not mean that the route has no requirements.

### Choosing the right legacy requirement field

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

This was the retired MIT first-year representation; its Sloan records used the same shape for `["GMAT_FOCUS", "GMAT", "GRE"]`. For retained data, use only configured exam IDs. A submitted composite exam counts as present only when it validates through the configured exam contract. Activated assessments express exam alternatives in source-bound mappings instead of these former category profiles.

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

### Legacy API and explanation fields

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
