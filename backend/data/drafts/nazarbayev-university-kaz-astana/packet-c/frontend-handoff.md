# NU frontend handoff

**Status: ready_for_integration**

Updated2026-10-27. Verification completed2026-10-26; the relevant frontend source files remain unchanged at this final review. NU was activated only after B recorded evidence acceptance and runtime readiness. No ordinary frontend implementation or verification work remains.

## Delivered contracts

- Seven native browsing levels across catalog/profile/detail/comparison, with one persisted program/route/applicant/cycle context. The catalog uses the established select rather than clipped level buttons.
- Visible, deliberate reset of unsupported legacy NU choices; other choices/profile evidence remain. Fresh legacy detail caches cannot bypass the reviewed catalog. Save/reload/Back/Forward and comparison detail links retain the chosen scope.
- Reported GPA keeps its scale; missing GPA/budget/sections stay missing and explicit zero remains zero. NUET partial reports, independent NAT percentages, ALEKS and IFOM/USMLE presence reuse authoritative config/validation. Editor state no longer mixes attempts. Cache contract keys refresh old exam/locale definitions.
- Academic/language checks show their original source group and each required/missing/failed result. A-level grades use the existing native formatter rather than internal grade points. App-only rule classifiers/comparison strategies are not presented as reported evidence. Manual prior-degree, waiver/conflict and funding-selection states remain explicit; funding does not produce an admission percentage.
- Native annual/whole-program/per-credit tuition, actual source period or explicit absence, campus/study years and conditional references are preserved in detail/comparison/cards. Joint-campus prices and2026-intake exceptions do not become an unsupported annual total or assumed net cost.
- Source-bound deadlines distinguish last test dates, result-submission, funding and application. TBA/yearless/conflicted information remains a reference; older exact dates retain their source cycle. Mid-year2026/27 and2027/28, transfer and NUFYP progression keep separate facts/checks.
- EN/RU/KZ UI keys align. All96 NU program names and46 route UI labels are localized while official source prose/titles/awards remain unchanged. B merged program-labels.json into its shared pack; C updated the93 missing Kazakh fallback labels.
- The expanded-check layout now uses normal details flow: a readable summary above its body. Desktop/phone geometry and visual review cover the prior vertical-title failure. Comparison captures wait for the global loader to disappear before reviewing real content.

## Verification completed

- Full frontend unit suite:648 passed after the final renderer correction. Focused regressions first reproduced missing-value, editor/cache, GPA-scale, native-grade and presentation failures, then passed their fixes.
-15 unique NU Chromium scenarios passed across focused runs. The14-scenario run passed39.7s; later affected Foundation/phone/comparison/qualification cases passed4/4 in25.3s. The extra qualification scenario covers all8 steps:4/5 GPA met;4/4 unassessed; ACT26; UNT85 with five qualifying sections; IB27 with three HL4; missing HL evidence; BBB; A*CC rejected despite an equal summed total.
- The matrix includes Foundation/progression, regular/support separation, failed/missing NUET sections, mid-year current/history, transfer waiver/manual review, Nursing NAT/prior qualification, UMP/MD/DBA, Finance/ALEKS/undated whole-program fee, joint-campus/study-year references, conditional/unconditional residency, Chemistry Industry PhD scope, legacy-cache/choice migration, retry, all seven level menus/NDS reading, and independent NU/MIT comparison/save/history.
- MIT first-year, Imperial Computing MEng and Stanford CS MS contrast scenarios passed3/3 after producer corrections. The MBA filter regression now returns the original five plus NU; the reviewed reader recognizes the full native MBA award without reclassifying research PhD/DBA.
- Existing profile SAT/UNT, GRE/GMAT, NUET/NAT/ALEKS/clinical report, invalid-submit, save/reload and pending/stale-response scenarios passed. Desktop/phone, light/dark and EN/RU/KZ were exercised.
- i18n:3219 aligned keys. Token/design guards:0 violations after the final CSS fix. Encoding and inline-style guards passed;16 existing inline-style baseline,0 undefined properties,0 static JS design writes. Final diff check passed. No test:all or whole E2E suite was run.

## Visual evidence and services

Screenshots/logs remain in this chat's local nu-ui-qa artifact folder outside the repository. The fixed Foundation image replaces the old vertical-title capture; final-layout-results and phone-layout-final retain the final desktop/phone checks. The comparison image now shows loaded content. Joint-campus, residency, Finance and profile screenshots were also reviewed.

The prior persistent C PIDs19388/19108 ended before the2026-10-26 continuation. Managed Playwright runs started/stopped their own fresh services. Runner32638 used API PID22696 for the final layout/qualification window; the last phone run97342 used API PID27256 and passed after the final rule-label edit. Both runners completed. No listeners remain on8000/5501/5510 at the2026-10-27 cleanup review; no other owner's service was stopped. No C-owned temporary source files remain.

No commit, push, version bump, tag, release or deployment was performed. Future/TBA/conflicting data, licensing/equivalence and actual award decisions remain source-labelled limitations, not unfinished collection or automated guarantees. B owns the final technical integration report.
