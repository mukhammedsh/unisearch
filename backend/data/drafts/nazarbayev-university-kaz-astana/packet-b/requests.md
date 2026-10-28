# Backend owner coordination

Updated: 2026-10-24. B owns this file. A and C can read it while retaining their own file ownership.

## To A

- Completing the existing packet B evidence. Keep original 31-card IDs and original review dates. The current first-pass source/fact metadata is not an acceptance claim; B will publish an updated ready_for_review handoff once ordinary collection is closed.
- Please retain native level/award distinctions and source-bound structured requirements where possible. NUET components use `NUET_MATH` and `NUET_CRITICAL_THINKING`; final exact evidence IDs follow backend-contract.md. No thresholds will be inferred from prose by the runtime reader.
- Shared master's policy IDs and per-program exceptions will be provided from packet B. Reuse their exact source scope, and preserve conflicting page/cycle facts.

## To C

- backend-contract.md publishes the existing HTTP and selection surface plus the target NUET component shape and expanded browsing levels. Evidence API errors will be explicit (400 standalone validation, 422 invalid profile evidence). Keep old total-only NUET results partial.
- Two confirmed shared scoring regressions are fixed with tests. Do not add a UI fallback that treats a missing IELTS section as passed or an invalid score as accepted.
- Please record proposed/actual frontend changes, contract requests, browser services and validation in your own requests/frontend-handoff files. B will coordinate stable API validation and final integration after evidence acceptance.

## Implemented contract update

- `/exams/config` now publishes NUET optional0–120 sections (`NUET_MATH`, `NUET_CRITICAL_THINKING`) and parent0–240 with `use_parent_score`. Old total-only and one-section reports validate; impossible totals/sections reject. Config also publishes ALEKS number1–100, `NURSING_NAT` components-only (`NAT_KNOWLEDGE`, `NAT_CLINICAL_SKILLS` percentages), and `IFOM_BSE`/`USMLE_STEP_1` flag report-presence fields. Flag1 records a report and must not be labelled a passing result;0 is absence.
- All seven canonical browsing levels are now accepted by context and study-option endpoints. Strict profile validators return422 for evidence rejected by exam/language validation. Valid saved SAT and NUET totals remain accepted without inferred components.
- Research packet B now has completed review checkpoints for17 of31 program contexts. Remaining groups are SSH/joint and NU SOM. Existing first-pass handoff is not yet a freeze request.

## Shared master's policy export for A

`research.json.shared_master_policy` exposes four reviewed policy facts: `nu-b-master-policy-scope`, `nu-b-master-policy-language-exceptions`, `nu-b-master-policy-funding-acceptance`, `nu-b-master-policy-enrollment`. The policy effective2026-03-05 explicitly excludes MD, MSc Nursing, NU–SOAS MA, EMBA and residency. Scope its shared export to A's actual engineering/Robotics master's only; don't transfer it to UG/progression or excluded routes.

- Policy permits waitlisted master applicants accepting paid offers to continue grant/scholarship competition when places are available. This differs from the UG offer rule.
- Earlier state-order/Bolashaq-funded master's degree excludes further state/other master grants under this policy.
- English-medium waiver needs degree proof or documented at least70% English subjects. NU alumni waiver excludes Bachelor Nursing/MSc Nursing/EMBA graduates. Policy explicitly accepts one IELTS One Skill Retake per original test in one section; preserve source edition conditions.
- OnlineMPA/AppliedAI/MBA/Finance are exceptions to ordinary direct-full-fee-category handling. Other applications need programMAR, school endorsement, quota and capacity; minimums do not guarantee admission.
- Guarantee fee amount/refund is internal/offer-specific; deferral doesn't retain funding; conditional-degree deadlines and orientation/final transcript verification stay explicit.

## Research frozen for A review —2026-10-25

Packet B handoff is now `ready_for_review`:31 options/routes,192 facts (153 current,39 superseded),63 canonical exact-URL sources plus11 former-ID aliases,10 evidenced publication/conflict gaps. All31 ordinary programme collections are complete and `validate_research.py` passes. `npm run audit:data` passed0errors/0warnings after final fact/source edits; it is not a research completeness check.

The four exported master-policy scopes now explicitly include all10 A option IDs as requested. `research.json.shared_master_policy` and `nu-b-cross-master-policy-export-a` are stable. Old `nu-b-fact-*` references are superseded and disconnected from active route policy links; `first_pass_history` is provenance, not current evidence. Do not mistake historical collection-note strings inside it for open work.

Important current corrections: MD `award_kind: professional` with graduate entry; MSN6k own programme fee is a scoped undated reference alongside genericmaster16k; jointSOASApplyNow links aSOAS form, references optional under generalSOASguidance, IELTSOnline explicitly accepted, and31July is yearless. Current own SOMPhDregular tables3.00 differ from aid2.75/centralregular2.75. MBA own writing5.5 differs from central6.0; EMBA2027heading retains2026/27 date table. Preserve these as exact source differences.

B now continues source-bound academic/language alternatives and reviewed-storage integration; send concrete data corrections through A/C requests files.

## Assessment response for C —2026-10-25

New `academic_requirement` checks and extended `language_requirement` checks are implemented. `rule.alternatives` retains source total/section/count minima; `provided.minimum_checks` exposes each total/section atom's exam/minimum/provided/status. All constraints in one test report useAND; other accepted tests/academic qualifications useOR. Grade-count checks keep `{count, minimum, exam_ids?}` rather than substituting a summed grade total. Basic-profileGPA must use the same source scale and does not become mandatory whenSAT/another accepted alternative suffices. Keep failing/missing component explanation visible. Outer response/status/percentage fields remain unchanged.

Focused source-bound tests coverNUET failed/missing sections, IELTS same-report conjunction and no superscoring, SAT alternative withoutGPA, scale mismatch, A-levelA*CC versusBBB, IBthreeHL and NATindependent sections. Current config/levels are available; NUdataactivation is the remaining gate.

## Consolidated evidence review corrections for A —2026-10-25

B reviewed the first consolidated catalog and the NUET/FYP/UG/aid/mid-year contrasts. The content preserves important differences, but the current canonical handoff is not yet accepted for activation:

1. All81 A facts have null `review_status`. Please attest the actual content review on the fact records (verified/verified-source-conflict/appropriate explicit reviewed state), retaining original checked/source dates. Do not derive review from HTTP200. A sources may legitimately retain null original status if their explicit content-review metadata is present; this request concerns the facts' actual owner content-review state.
2. `nu-a-route-regular-foundation-undergraduate` still has null classification/target/destination despite recorded portal process. Populate these from the actual source: external shared procedure with the selected NUprogramme/FYP target and the official admissions portal; do not invent university-wide major-after-entry admission.
3. A option `fact_ids` are null in the catalog. Link each known programme's study/admission/price facts explicitly. In particular normalize `nu-a-fact-fyp-english`/`nu-a-fact-fyp-academic` to Foundation option/preparation scope, and `nu-a-fact-ug-english`/`nu-a-fact-ug-academic-alternatives` to the actual common undergraduate option set. Current route-only/extra-text scope is shared by FYP andUG and would let lower Foundation thresholds leak intoUG if consumed as normalized applicability. Preserve original scope text/provenance alongside resolvedIDs/levels.
4. Please regenerate from latestC (`study_levels`, explicit fact links, portal and verified unconditional/UMC-conditional branch metadata) and currentBcross refs before freeze. C's technical document checklist is not a B-wide policy; the Bcross ref explicitly excludes it.

B will independently check the corrected snapshot and record acceptance. Three additional offerings remain preserved; B will include NDS/NUZYP/microcredential in the runtime model with honest unresolved recruitment/route state, without turning the93 assigned cards into a completeness claim for currently open intake.

### Follow-up after A corrections

The fact review states, regular target/portal and FYP-versusUGscopes are now corrected as requested. One remaining transfer defect: all15 A `unknowns` still have null sourceIDs, publication/review states and checkeddate (e.g. `nu-a-gap-midyear-conflict`, `nu-a-gap-support-coverage-documents`). Please link each surviving evidenced gap to the actual source record(s) and original checkeddate, with an explicit reviewed gap/conflict state. Move resolved collection summaries (`gap-card-detail`/completedprogramme collection) into history rather than exposing a resolved collection statement as an active unknown. Do not infer verification from reachability.

`nu-a-gap-policy-future-revision` currently says to recheck after2026-12-01 **before Stage2 activation**. A scheduled future revision date does not by itself invalidate the approved/effective current policy or require waiting untilDecember; retain the metadata and an eventual refresh step without making future time an activation prerequisite. B independently retrieved currentUGregular/aid pages on2026-10-25 and confirmed the distinct English/academic and post-offer categories; midyearportal returned404, while current centralregular page retains130/60/60 and2026/27 scope. Preserve source access separate from content evidence.

## Cost response for C —2026-10-25

`catalog_costs.tuition` retains native source prices and now includes `billing_period` (`academic_year`, `whole_program`, `per_credit`) and `annual_comparable`. Finance/MBA whole-program quotes must show their actual period; they are excluded from annual budget filtering/scoring (budget evidence `period_not_annual`). `annual_total` remains absent unless an actual annual all-cost quote exists; no monthly living estimate is added automatically. Source year, campus and fee-category references remain with the quote. Existing three institutions retain their current annual behavior. Focused cost suite passed13 tests. Please consume these period fields in cards/comparison/cost explanation where relevant; runtime NU readiness follows separately.

## Final editorial correction for A

The 14 active unknowns now retain source IDs and review dates, and the resolved collection summary is historical. Re-review passed this correction. The regenerated `nu-a-gap-policy-future-revision.official_next_step` still literally says "before Stage 2 activation". Please remove that prerequisite as requested above, retaining the scheduled December refresh. Current effective policy can be integrated now. B continues offline conversion and source-bound rules while this final metadata correction is made.

## Gap provenance/scope correction for C and regeneration for A

The inactive converter now validates gap provenance before use. C's five surviving gaps (`nu-c-gap-licensure`, `nu-c-gap-residency-cycle`, `nu-c-gap-funding`, `nu-c-gap-fee-cycle`, `nu-c-gap-industry-phd-terms`) have source IDs but no checked date/publication/review state, and only text scopes. Please attest actual review dates/state and add explicit option/route/level scope: licensure/cycle only residency; industry terms only Chemistry Industry PhD's actual option; funding/fee cycle actual doctoral/residency options. Retain original prose scope. Otherwise these unknowns leak onto undergraduate contexts. A must regenerate from corrected C input before B freezes acceptance.

Runtime C `program_details` now has source-linked section facets (`--study`, `--requirements`, `--deadlines`, `--costs`, `--funding`), preserving original full fact as a reference. Distinct residency IDs are `nu-residency-unconditional` and `nu-residency-conditional-umc`, one original shared form family. English conflict is not silently scored. New manual-minimum checks leave unscoped prior-degree GPA and source conflicts unassessed. Financial-support route returns no admission percentage (`funding_selection_separate`); its source checks remain visible. Please cover these statuses/localized explanations with the runtime consumer work.

## Deadline projection and offline contrast checks

Implemented `attributes.deadline_events` on the support fact, in C's requested shape: `date`, `deadline_type: test_date`, source label, null unpublished time/timezone, cycle2027/28, publication_status published, exam_id SAT/ACT and application_category financial_support. Original fact value/source IDs stay unchanged. These are latest test dates, not support application deadlines. Exact B past application/test records have `published_dated_reference` and keep2026/27; TBA, month-only, mid-year-conflicted and yearless joint dates have no synthesized events. For Astana times explicitly present, runtime timezone is Asia/Almaty.

Eight offline conversion/contrast tests passed against a read-only preview built from the latest packet files (no acceptance/runtime activation): full source-value preservation,96options/7levels, stale acceptance rejection, FYP/UG/aid isolation, distinct conditional residency and IFOM presence, Finance/MSN/FYP cost scopes and honest deadlines. They exposed and fixed aid-NUET leakage and missing residency requirement indexing. The stored consolidated catalog still needs regeneration from C's corrected gap provenance and A's future-revision next step before the acceptance manifest can freeze it.

## Runtime available for C —2026-10-25

B reran A's existing generator from the latest owner files and independently accepted the exact catalog hash in `packet-b/data-acceptance.json`. `data-review.md` is accepted. NU is now in runtime storage/allowlists/ownership:96options,46routes,399facts (333 original plus66 section facets),161sources,29unknowns and49 source-bound assessment records. The prior three institutions are identical JSON records. Focused NU+HTTP suites passed22 tests; broader backend verification continues. C may now activate NU frontend/migration sets and exercise actual responses. Any further runtime-data/API-contract correction will be recorded here before its final window.

Residency native awards now preserve an explicitly empty `native_awards` array; a branch test asserts `selected_option.awards: []`. The runtime snapshot is regenerated with this correction. B has started no persistent services; ports8000/5510 observed during C's current runner belong to C. Reuse/run your normal managed Playwright services, and stop only your own. Backend contract/data are ready for NU inspection; B will publish any discovered correction before C's final acceptance rerun. The backend audit now checks accepted annual prices in the catalog, without demanding a retired legacy tuition-provenance field.

Producer correction complete: residency `format` now retains the reviewed duration/language/campus and presents `full_time_on_campus` as `Full time, on-campus`; explicit empty native awards remain empty. Regenerated runtime data atomically. A generic academic-year parser change was reverted after contrast tests showed it could make old MIT/Imperial fee-year labels look like entry cycles; only known NU admission-cycle aliases are resolved in NU's prepared facts/mappings. No global fee-year inference remains. Please restart your owned API before final browser checks to load these backend-code changes; this is B's last planned contract/data correction, with full backend verification underway. Further failures will be posted before any new correction.

## Integration corrections ready —2026-10-26

The flag parser now accepts canonical numeric0/1 after Pydantic's float round trip, while rejecting other/non-finite values. A regression reproduces the exact gpa4.85/5 + dated IFOM/USMLE profile and tests0/0.0/1/1.0, round-trip persistence and false-report absence. C's graduate reference-scope corrections and B's exact Finance/MBA/DBA ALEKS scope are regenerated and independently accepted under the new catalog hash. No source value/check date was refreshed.

Joint BBA has four native `catalog_costs.quotes`: NU15000/year (years1–2), HKUST31900/year (years3–4),93800 whole-program tuition and NU11250/year for2026 intake only. Each retains campus/study_years/billing_period/source_year; all have `reference_only:true` and are deliberately excluded from aggregate annual price/budget filters because the current stage/cycle is unconfirmed. Housing/application/deposit remain source details. Please show the normalized references and their stage/intake labels.

Please restart only your owned API once more for the flag-parser correction, then run the final conditional/save/history and joint-cost browser cases. Backend production code/data are frozen for C's final acceptance window; remaining B work is tests/docs/review/cleanup unless a concrete new failure is recorded. B owns no running web service.

The reviewed-scope regressions now assert that ALEKS does not enter regular UG or either residency context, and graduate guarantee references do not enter UG. The source/gap corrections and joint quotes are active; `npm run audit:data` passed0errors/0warnings and version9.2.0 remains synchronized. B's final full backend run is underway after updating retired-category fixtures and valid composite evidence fixtures; the earlier full run exposed those expected cutover assumptions plus the already-fixed cycle parser regression, and was not reported as passed.

Before marking frontend ready, include the work-plan's explicit progression,2026/27mid-year-versus2027/28 and transfer-waiver browser contrasts, in addition to the current11 NU scenarios; record whether each was exercised. Final handoff should include its actual full unit/static totals, the restarted API PID/session and cleanup status. No extra whole E2E suite is requested.

Final backend verification passed816 tests in263.627seconds. The expanded9-test NU scope/campus suite passed afterward, and data audit/version checks passed. `backend-handoff.md` is ready_for_integration. No backend production/data changes followed the frozen flag/reference/campus correction; please finish C's refreshed-API browser window and unit/static handoff. Overall integration remains pending those actual results and final process cleanup.

## Route-matrix corrections active —2026-10-26

The additional browser matrix found and now fixes three producer defects. Mid-year is exposed through the established institution-wide undergraduate shared-route contract, without adding invented eligible programs;2026/27mid-year facts remain active for that context and become dated history for2027/28. Transfer and joint BBA source topics gain a requirements reading domain while their original topics/prose remain intact. A new test traverses all49 assessment records and asserts their facts/checks are reachable in an actual compatible context; it also found and fixed missing reciprocal links for the officially sourced NDS/microcredential routes.

All24 A/B unknowns now resolve to actual program/route/level IDs in canonical preparation. Original source scope survives in provenance; no runtime string matching is used. A transfer regression excludes the unrelated NUZYP, engineering, Nursing, joint, EMBA and SOM PhD gaps. All12 NU converter/context tests passed; general catalog contrast tests passed except the NDS linkage regression, which is now corrected and rechecked. Runtime storage has been regenerated; counts remain96/46/399/161/29.

C's program-label file was merged only for missing RU/KZ backend program-name keys, preserving all existing translations and official English titles. Please restart your owned API for the shared-history/reading-domain correction, then rerun the failed mid-year/transfer/unknown-scope cases, remaining program-title unit check and final frontend verification. The earlier816-test full backend pass preceded these newly reproduced producer changes; B will rerun the affected checks and final backend suite before completion. No unchanged whole E2E rerun is needed.

## MBA qualification projection fixed

The missing NU MBA membership was reproduced by a backend regression. Reviewed and retained metadata now reuse the existing MBA qualification regex for abbreviated and full native Master/Executive Master of Business Administration awards. Research PhD/DBA titles do not qualify, and native awards are unchanged. The focused MBA/qualification regression and university-search module passed after the fix. Please start/restart your owned API for the one changed metadata projection and rerun only the failed MBA membership browser case; the14 NU journeys and three institutional contrasts need no repeat for this filter-only correction. B is doing the final full backend check again because production code changed.

## Visual correction found during B's final screenshot review

The retained `nu-foundation-section-failure.png` shows the expanded Academic qualification check title shrinking into a one-letter-wide vertical column beside its body on the1280px desktop, extending hundreds of pixels. The body starts alongside the heading instead of below it; the other closed headings remain readable. Please reproduce that expanded check in the current UI, correct its layout ownership using the existing styles, and review its desktop/phone rendering. This is a concrete screenshot defect, not a request for redesign or a full new E2E run. The RU joint-campus phone screenshot is readable and correctly separates annual campus references and whole-program tuition. B has not edited C-owned CSS/markup.


## Final integration verified —2026-10-27

C's ready_for_integration handoff is accepted. Final backend821, frontend648,15 NU browser scenarios, three institution contrasts and MBA membership pass. B independently reviewed the corrected desktop/phone screenshots. Git LF/CRLF portability was reproduced and fixed in the offline evidence gate while content tampering remains rejected; no runtime applicant/data behavior changed after C's final checks. Data audit, encoding, version and diff checks pass. B scratch artifacts are archived outside the checkout; no owned web service or listener remains. integration-handoff.md is verified. No publication, version bump or Git mutation was performed.
