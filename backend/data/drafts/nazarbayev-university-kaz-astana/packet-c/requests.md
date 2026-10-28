# C research and frontend coordination

Updated 2026-10-25. C remains active through NU frontend integration and real browser verification.

## Research ready for A

`handoff.md` is ready_for_review. `research.json` has 31 reviewed options, 60 scoped facts and 43 sources. Ordinary collection is closed. The common packet validator passed on 2026-10-25; the last research edit also passed its focused references/status checks and runtime audit (zero errors/warnings).

Four School-specific requirement facts bind exact option IDs (SCAI, SSH, SOE regular, SOE financial support). The combined School comparison fact is reference-only. Residency program reviews include structured page-level IELTS requirements with unresolved source-conflict status. Preserve current/2024-policy and Gastroenterology EN/RU conflicts, dated fees/TBA dates, inconsistent FAQ stipend values, state-grant service scope, Industry PhD restrictions and degree recognition unknowns. Please request corrections by fact/source ID; C will respond here.

## Implemented frontend contract

- Empty guest GPA and budget are omitted from API payloads; explicit numeric zeroes remain valid self-reported values.
- Canonical preparation/residency/non-degree selection, URL context, profile persistence and comparison filters are implemented. Catalog uses the existing custom-select component for all level choices, avoiding clipped mobile buttons. Existing degree aliases/MBA browsing remain.
- New config-driven NUET/NAT/ALEKS/IFOM/USMLE input contract is consumed. NUET keeps old total-only/partial reports, and complete sections may leave total derivation to server validation. NAT has independent percentages and no invented total. IFOM/USMLE flags record report presence, not a pass; absent reports show a localized missing status.
- Composite blank scores stay blank. Optional configured sections are omitted. After adding/editing reports, the editor restores the selected attempt instead of stale empty/other-attempt drafts. Locale pack cache revision refreshes new keys without a project version bump.

## Dependencies before NU cutover

B must record evidence acceptance and runtime catalog readiness before C adds NU to the frontend reviewed-ID/migration sets. C will then inspect the actual normalized source-bound fact/date/finance response, finish consumers and deliberate legacy-choice reset, and run real NU/context/compare/history journeys. No guessed data adapter or UI fallback is being added.

The final stable API/browser window has not started. Please publish the ready API port/ownership and freeze point in B's contract/handoff. C remains available for integration corrections and A data corrections.

## Checks and services

Full frontend unit suite: 634 passed before the latest GPA/minimum-renderer edits. Focused persistence 40, renderer 30 and profile-payload/comparison 39 tests passed afterward. Token/design checks passed after the final mobile CSS fix; i18n passed with 3,157 aligned keys on 2026-10-25. Earlier hardcoded-text/inline-style/encoding checks passed; later text edits require final encoding review and integration still requires a final full frontend unit run.

Real Chromium checks passed: SAT/UNT and GRE/GMAT profile regressions; NUET total-only/sections/invalid/save/reload/two-attempt editing; NAT partial percentages and ALEKS scale; IFOM/USMLE dates/report presence; RU phone dark and KZ desktop dark. Catalog control/theme/phone/desktop, MBA filter and Stanford catalog/map cost-currency-level regressions passed. MIT first-year, Imperial Computing MEng and Stanford external CS MS scoped route/fact journeys passed on 2026-10-25.

The long-label mobile clipping defect was reproduced (field right 414px vs form right 350px) and fixed with a shrinkable grid track. The Russian-phone scenario now passes field/button bounds, page width, and zero horizontal ancestor scroll after restore. Reviewed the final screenshot. The GPA formatter also now leaves null/blank values empty instead of displaying zero (regression reproduced, then focused tests passed). Screenshots/logs are in the chat's local `nu-ui-qa` artifact folder outside the repository.

C has no persistent services. All previous Playwright runner sessions stopped their own API/frontend processes. An intermediate focused runner may temporarily own ports 8000/5510; it is not B's stable final API window. All focused runner sessions have completed and stopped their services; no C-owned listeners remain.

## Required data regeneration — 2026-10-25

C corrected its own source mapping after inspecting the first consolidated catalog: explicit canonical `study_levels`, program `fact_ids`, common route `fact_ids`, offering kind/native PhD award and verified portal destination. Two resolved collection gaps are now outside active gaps in `resolved_gap_history` (five active C gaps remain). Official review dates/value/source IDs are unchanged. Please regenerate from this latest packet. `nu-c-residency-route.verified_admission_statuses` documents unconditional and conditional-UMC branches; B must expose distinct runtime contexts under that single application family to preserve test deadlines/deferral.

For A: the initial consolidated source ledger also reported 55 `not_provided` review statuses, and `nu-a-route-regular-foundation-undergraduate` had null classification/target/destination. Please reconcile those fields from actual owner evidence before acceptance, retaining genuine unknowns rather than assigning invented verification. C is not editing shared builder/schema files.

## Real-picker mobile correction (2026-10-25)

The real NAT menu reproduced horizontal scrolling of the hidden-overflow profile shell (content width 461 vs 350, scrollLeft 28). Clipped shell overflow now prevents that container from scrolling. Focused runner 46439 passed the actual option click, invalid submit, partial save/reload, field bounds and zero ancestor-scroll checks; its API/frontend services stopped. The final screenshot is retained outside the repository. NU-specific browser acceptance remains pending runtime readiness.

## Implemented contract fidelity (2026-10-25)

Frontend API profile now preserves the reported GPA and `gpa_scale` (4.85/5 stays4.85/5). The previous frontend4-point conversion was reproduced as a source-bound assessment mismatch, then removed; legacy ranking still uses B’s backend normalization. The focused persistence suite passed40 tests with intentionally updated raw-scale expectations. Please document raw GPA/scale in B-owned API/README contracts where old frontend normalization was described.

The new `academic_requirement` / language `provided.minimum_checks` response is rendered as per-result minimum atoms inside its original source-backed check; the route percentage is not duplicated. Counted A-Level minima use existing subject grade metadata rather than showing internal point codes as official grades. Focused renderer tests passed failed/missing NUET sections and counted grades. A reproduced shared formatter bug also now preserves single-subject E/U grades instead of labelling them Added/Required; focused tests passed.

The real five-point GPA browser flow passed: enter 4.85/5, save/reload, open a reviewed admissions context, and observe the live API receiving 4.85 with scale 5 (HTTP 200). Focused runner 34613 stopped its own services.

## Runtime converter review for B (2026-10-25)

The current pure converter still ignores several actual C option attributes. Please reconcile these before the runtime-ready freeze:

- `attributes.native_awards` is authoritative: C PhDs have `["PhD"]`, residencies have `[]` because the source did not establish a standalone award. The current `native_award || row.title` fallback would turn a full program title into an award and fabricate a residency qualification. Preserve the known empty array.
- C options expose `study_description`, `duration_years`, `mode` and `language`, while the current converter only builds an overview from `study_content`/`study_detail`/B's `study_profile`, and builds format only from `delivery_mode`/B profile mode. For example `nu-c-study-ph-d-in-electrical-engineering` has a reviewed study description, 4 years, full-time/on-campus mode and English. Map the existing evidence into the shared overview/format contract so the frontend can show it without a guessed C-specific adapter.

The complete C program-review facts remain available even when the compact overview is absent. C will verify both the summary and the full source facts after activation.

## Cache and billing-period consumers (2026-10-25)

The confirmed fresh legacy exam cache prevented new fields for six hours. The exam cache now has a new contract key (language/location caches remain intact), and a regression test proves it refreshes a fresh old cache and then reuses the new one. Real Chromium NUET validation/save/reload with a seeded old cache and both pending/stale validation race scenarios passed (3 tests, runner 58453, services stopped).

C consumes the new `billing_period`/`annual_comparable` contract: card price suffixes distinguish annual, whole-program and per-credit prices; compact source context retains campus; normalized source-bound tuition quotes are shown in details/comparison with actual period, currency, campus and source year. Regressions first reproduced the false `/ year` card label and missing normalized comparison price, then passed (16 focused card/comparison tests). Actual NU Finance/joint-campus browser verification awaits runtime readiness.

The first full unit run after the raw-GPA/copy change exposed two obsolete expectations (frontend 5-to-4 conversion and MIT-specific generic unavailable text). Both were updated for the intentional shared contract, with 93 focused persistence/detail-helper tests passing. A final full unit run is still required after remaining integration changes.

Normalized cost detail tests also passed in all three locales (18 presentation tests). The Imperial-only Home/Overseas explanation is now limited to its original course-fee panels, so it cannot appear on NU's native quotes. MIT/Imperial/Stanford contrast journeys passed after cost-consumer changes (3 tests, runner 23775, services stopped).

## Deadline projection request for B

The existing calendar/detail/comparison reader accepts source-bound arrays of `{date, deadline_type, label, time, timezone, cycle, publication_status}` records. It deliberately rejects approximate, yearless or conflicted dates. Native NU facts currently keep exact support test dates nested in `nu-a-fact-financial-support-eligibility-2027-28.value.categories.SAT_ACT.last_test_dates_for_support`; the generic reader cannot reach them. Preserve their exact test/support category rather than relabelling them application deadlines. Please publish the runtime projection shape for these dates (an `attributes.deadline_events` array in that existing record shape would preserve original `value` unchanged), along with confirmed application/test windows and source timezone where supported. C will consume the agreed shape, retain original fact links, and verify the calendar/detail/compare behavior. The conflicted mid-year dates and TBA windows must retain their unresolved status rather than gaining an exportable deadline.

## Resolved C gap-scope correction for A/B

All five active C gaps now include exact option IDs, shared route IDs, canonical levels, original prose scope and actual content-review dates/state. Residency-only licensure/cycle no longer have a university-wide empty scope. Industry sponsorship terms are limited to the Chemistry option's industry variant. Funding/future-fee gaps cover the relevant 31 C PhD/residency options; B retains responsibility for explicitly scoped cross-packet derivatives for its own research PhDs. Dates remain 2026-10-23/24 from the underlying review, not today's HTTP status. Please regenerate the catalog and input fingerprints from the corrected research and handoff before acceptance. No substantive fact value changed.

Current frontend unit suite passed 641 tests. Latest i18n passed 3,159 aligned keys; encoding/inline styles also passed. No C services are running.

## Current backend-response additions consumed

C added EN/RU/KZ labels for `manual_minimum` and `funding_selection_separate`, including the shared no-data chance summary. Focused renderer/detail tests passed 81 tests: prior-degree minima stay manual and a funding-only context explicitly explains the absence of an admission percentage. These later edits require the final unit/i18n/encoding checks again.

One converter issue remains at the current award expression: `metadata.get("native_awards") or [metadata["native_award"]]` still replaces the verified empty residency award list with the program title. Please distinguish an absent key from an intentionally empty array. This is the same native-award request above, now against the concrete expression; C will assert that residency has no invented standalone award in the API/browser matrix.

## NU cutover and browser services —2026-10-25

After B's explicit Runtime available notice, C activated NU in frontend reviewed/migration sets. Focused context/profile migration checks passed 50 tests, including resetting only unsupported legacy NU choices while preserving other profile data and visible notices.

C owns API port8000 PID19388 (exec session20049; earlier PID7020/session98122 stopped for code refresh) and frontend port5510 PID19108 (session97755) for current browser QA; neither uses auto-reload. Please do not stop these processes. C will restart its API after notified backend-code changes and stop both at completion. These are now available for compatible read-only checks; B's final stable freeze window is still to be recorded.

Actual HTTP context smoke passed Foundation, regular CS UG, Finance, Neurology residency and professional DBA. API selected level/route axes match. The native-award issue is confirmed in the live response: Neurology returns `awards: ["Residency in Neurology"]` despite the verified empty native-award list. Its `format.mode` is also the internal enum `full_time_on_campus`, and C's `duration_years`/`language` are still missing from `format`. Please correct these producer fields and regenerate storage before the final freeze; C will verify the real response rather than hiding them in a UI adapter.

The agreed deadline projection is now consumed by calendar/detail reading. `test_date` means last test date; `test_submission` means score-submission deadline. Financial-support SAT/ACT labels are localized and retain the exam/category; dated references stay explicitly labelled with their source cycle. Focused calendar tests passed 11 including no fabricated time/year and actual Asia/Almaty-to-UTC conversion.

## Initial live NU browser results and remaining scope correction

Foundation failed-section, old total-only RU-phone missing sections, regular UG SAT without GPA, and support-context no-percentage/separate test-date flows passed (4 tests across initial/rerun). Two initial failures were resolved: the test helper incorrectly expected an English university name in Russian; the actual source fact has a limited parent publication status and funding/requirements indexing, so C now consumes its explicitly published deadline projection without treating the TBA application deadline as known. Date details/calendar both show the separate dates after the fix.

Live HTTP confirms the empty residency awards and duration/language/campus producer correction. Before the final freeze, please resolve one remaining source-scope leak found in actual contexts: `nu-b-aleks-scale-reference` appears in regular CS undergraduate requirements and in both residency assessment records as `published_rule`. Neither route uses ALEKS. Restrict the reference to the exact programs/routes where ALEKS is sourced; do not mask it in the UI. The CS regular response also contains `nu-c-stipend-source-conflict` and `nu-c-graduate-guarantee-fee` under `other`; these are graduate/PhD/residency references and should not carry an empty undergraduate scope. C will inspect its original scope fields and correct its own data if necessary; B can normalize only after preserving actual provenance. C has not marked the final browser window complete.

C has now corrected its own three reference scopes: `nu-c-stipend-source-conflict` had an unnormalized capitalized Residency alias alongside doctoral; `nu-c-graduate-guarantee-fee` and `nu-c-monthly-living-reference` had only graduate prose scope. They now have explicit canonical level boundaries, with original source scope/value/date retained. The monthly estimate is limited to on-campus graduate students and still cannot become annual total cost. Please rerun the existing catalog generator and acceptance/storage preparation from current C research/handoff. The general fee-discount source is genuinely institution-wide conditional reference and is unchanged.

## Confirmed flag/profile validation failure for B

The live residency browser request returns422 before context rendering with a valid saved flag report. Minimal synthetic HTTP reproduction: POST NU admissions-context with profile `{gpa:4.85,gpa_scale:5,exams:[{id:"IFOM_BSE",exam:"IFOM_BSE",score:1,taken_on:"2026-03-01"}]}` and the Neurology/unconditional/residency/graduate context returns `Value error, IFOM_BSE must be 0 or 1` at profile.exams[0]. The standalone flag editor/save flow produced canonical numeric1; do not work around it in the frontend. Please check Pydantic float coercion versus the shared flag parser and cover valid numeric0/1 (including round-tripped canonical representation) while still rejecting other values. This blocks the conditional-route/save/history browser journey; C continues the other scenarios.

The same422 reproduces after C stopped only its recorded PID7020 and restarted the API from current code as PID19388/session20049. This is confirmed on the refreshed API, not merely the old service. Frontend PID19108 remains unchanged.

Finance ALEKS/whole-program pricing (KZ dark), Nursing failed clinical section/manual prior degree, and UMP-versus-MD-versus-DBA browser contrasts have passed. The unlabelled Finance source year is now explicitly not stated, rather than treating the billing label Whole program as an admission cycle/year.

## Joint BBA price projection missing

The live joint NU–HKUST BBA finance browser scenario found that `nu-a-fact-joint-bba-costs` has its reviewed native `reference_amounts` but no `attributes.catalog_costs.quotes`, so it cannot use the shared campus/period tuition presentation. Please expose the sourced NU years1–2 tuition USD15000/year, HKUST years3–4 USD31900/year and USD93800 whole-program tuition with campus/study-year scope. Keep the special2026 NU11250/year exception distinct and labelled2026; unknown general price year stays unknown. Housing/application/deposit remain separate source facts, not added to tuition/annual total. These are references and need not enter annual-budget scoring when applicability is unconfirmed. C will render explicit normalized quotes while retaining the limited parent publication status/source wording rather than fabricating a current-year annual price.

## Frozen-window browser results and concrete remaining contracts —2026-10-26

The refreshed, runner-owned API confirms the flag fix. Unconditional IFOM presence, empty residency awards, duration/campus, switching to UMC conditional (no immediate medical-report check), save/reload/Back/Forward all passed. Joint campus references passed on a RU dark phone, and were visually reviewed; the primary table now leads with the known campus/study years instead of repeated empty fee-category headings. Legacy-cache refresh, only-NU legacy-choice reset, retry and all seven level menus passed. Finance/MIT independent comparison/save/reload/detail-link context also passed. Old persistent C PIDs19388/19108 are gone; current focused Playwright sessions own and stop their own webServer children (latest session22801).

Three concrete issues remain from the newly required route contrasts:

1. `nu-a-route-midyear-2026-27` has no option IDs and no `attributes.admission_scope`. POST a no-option/undergraduate/first_year/2026/27_midyear context returns reading_scope study_option, option unknown, no facts/checks; the UI route select falls to empty. It is not linked to any selectable program either. Please expose the actual source-defined institutional mid-year context through the existing shared-route contract, or a reviewed actual program linkage. Do not invent program eligibility just to satisfy a selector. The current 130/60/60 and conflicting dates must be readable on their correct source cycle.
2. CS transfer POST succeeds with all option/route/level axes matched, but `fact_groups.requirements` is absent and assessment.checks is empty. `nu-a-fact-transfer-route-details` is present with reviewed source waiver/CGPA conditions, and its manual-minimum annotation exists in assessments.json, yet its topic is not indexed into requirements. Check NUFYP progression and the rest of the49 source-bound annotations for the same unreachable-annotation defect; preserve original topics/prose while adding appropriate prepared reading domains. C will rerun the source-bound manual/waiver and distinct fee-paying/grant progression cases.
3. The same CS transfer context returns24 unknowns, including `nu-a-gap-nuzyp-activity`, `nu-a-gap-engineering-masters`, `nu-a-gap-joint-bba`, `nu-a-gap-nursing`, `nu-b-gap-emba-price`, `nu-b-gap-som-phd-regular-gpa`, `nu-b-gap-joint-future-and-funding` and `nu-b-gap-curriculum-anomalies`. They have empty option/route/level arrays with their real scope left only in unparsed_scope/program text. These program-specific unknowns must not enter this undergraduate route. Please resolve the actual A/B unknown scopes in the canonical preparation (or request owner corrections), preserving original source scope. Genuinely institution-wide unknowns may remain conditional. C is not hiding mismatched data by string matching.

These failures were reproduced in real Chromium and in the current HTTP/TestClient contract. No final frontend acceptance is claimed until they are corrected. Current spec has14 focused NU scenarios; remaining static/full frontend checks follow the final producer corrections.

## Program-label translations ready for B

The current full frontend unit run has645/646 passing; the remaining failure is the existing all-reviewed-program title contract for RU/KZ because NU titles have not entered the shared translation pack. C prepared `packet-c/program-labels.json`:96 exact normalized official-title keys with Russian/Kazakh labels. Official titles stay unchanged; MD/professional doctorates, research PhD, residency, non-degree and preparatory labels stay distinct. Please merge only missing `rus`/`kaz` program_names into B-owned `backend/data/universities_translations.json`, preserving existing translations. C has merged the missing93 Kazakh entries into its owned frontend fallback bundle. No runtime fallback/translation parser is added.

Current static results: i18n3173 aligned keys, encoding and inline-style checks passed on2026-10-26 before the new fallback-bundle edit; final encoding/full unit rerun remains due. CSS/token/design checks remain valid because no CSS changed after their previous successful run.

## Final browser/unit success and MBA-reader regression

All14 focused NU browser scenarios now pass on the regenerated API (39.7s, runner51227, API PID26996), including both previously failing route contrasts, program-specific unknown exclusion, NDS reading and save/history. The three MIT/Imperial/Stanford contrast scenarios also pass (runner15539). All647 frontend unit tests now pass, including96 NU program translations and46 localized application-route labels with native titles retained. Latest RU phone/KZ Finance/RU joint-campus route-label checks passed (runner45939). Runner services stopped; no persistent C listener remains.

One final catalog defect was exposed by checking the MBA filter against the expanded NU data. The old test still passed5 universities, but it excluded NU despite its reviewed MBA/Executive MBA. `universities.py` reviewed-level projection currently checks only `"MBA" in option["awards"]`; NU's verified awards contain the full `Master of Business Administration` title. The adjacent legacy reader already recognizes that full official title. Please reuse the correct full-title/abbreviation qualification recognition for reviewed MBA filtering, preserving the original native award data and not matching a PhD in Business Administration. C updated the membership regression to expect the existing five plus NU, as required by this intentional catalog expansion; it reproduces the missing institution and will be rerun after the producer fix. No frontend title-string workaround is added.

## Final corrections verified —2026-10-26

The MBA membership regression now passes with the original five institutions plus NU. The required regular-qualification browser matrix also passes all8 steps: reported4/5 GPA met;4/4 stays unassessed; ACT26 met; UNT85 with five qualifying sections met; IB27 with three HL4 met; old IB total without HL missing; A-levelBBB met; A*CC unmet despite the same summed total. Reported A-level scores now use the existing native-grade formatter; application-internal total_strategy/best_of metadata is omitted from reported evidence only, without altering source facts or profiles. A direct regression reproduced and fixed the misleading numeric grade-point display.

B's desktop screenshot finding is resolved: the inherited two-column grid on details.admissions-catalog__check was removed, including its obsolete mobile override. The summary and body now follow normal details flow; desktop1280 and RU phone390 geometry assertions enforce a readable title and a body below its summary. Focused Foundation/phone/qualification/comparison cases passed4/4 (runner32638, API PID22696, services stopped). The fixed desktop screenshot was reviewed and replaces the old retained image. Comparison's final screenshot now explicitly waits for siteInitialLoader to disappear and scrolls to the comparison; the readable result was reviewed and replaces the prior loading-screen capture. A final phone screenshot capture is being completed for visual review.

All648 frontend unit tests passed after the final renderer fix. Current i18n3219, token/design0-violation and inline-style checks pass; final encoding/diff/process review is the remaining C completion step. There are15 unique NU scenarios, plus the3 existing-institution contrasts and the MBA membership regression; no whole E2E suite or test:all was run. No further backend/data request remains from C.

## C final acceptance —2026-10-27

frontend-handoff.md is ready_for_integration. All ordinary C work is complete:648 unit tests,15 unique NU browser scenarios including the8-step qualification matrix,3 institutional contrasts and the corrected6-university MBA filter. i18n3219, final token/design0, encoding and inline-style guards and final diff review pass. The CSS screenshot failure is fixed and visually reviewed on desktop and RU dark phone, with geometry assertions; the retained Foundation image was replaced. Comparison capture now waits for the global loader and shows real content. The last refreshed API was PID27256 in runner97342, which completed; no listeners remain on8000/5501/5510. Earlier final4-case runner32638/API22696 also stopped. No frontend/API/data correction remains requested by C.

Verification logs and final-layout-results/phone-layout-final screenshots are retained in local nu-ui-qa artifacts. No full E2E/test:all, Git publication or deployment was performed. Please update B's integration report with these actual final counts and cleanup state; its stale647/14/pending-C paragraph is superseded by this handoff.
