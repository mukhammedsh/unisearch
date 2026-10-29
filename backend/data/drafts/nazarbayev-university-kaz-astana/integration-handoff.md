# Nazarbayev University integration

Status: verified at the local preflight on 2026-10-28. No version bump, commit, push, tag, GitHub Release or deployment had been performed at that checkpoint. The user subsequently authorized publication of version 10.0.0.

## Current release-candidate preflight (2026-10-28)

The assembled NU/profile candidate has658 passing frontend unit tests and823 passing backend tests from the final profile journey; their production domains did not change during this preflight. Those totals supersede the historical821/648 integration checkpoint below. The accepted catalog/assessments/universities/exams hashes remain identical to the profile report.

The first remaining overall Chromium gate ran457 scenarios once:440 passed,17 failed,0 skipped. All17 failures were traced to intentionally superseded category/count, calculator, disclosure/search, copy or control-selector assumptions. Eight E2E files were adapted without skips, timeout increases, removed scope/source assertions or baseline expansion. The focused17-case rerun passed; no production implementation or accepted data changed. No repeated whole E2E or test:all loop was used.

The initial ordinary ML probe found missing huggingface_hub and stale local packages, yielding explicit unavailable without lexical fallback. The 2026-10-28 restoration synchronized backend/.venv to the existing development lock on Python 3.12.10. The only dependency-file correction restores the official cross-platform coverage 7.16.1 hashes; no dependency pins changed. Installed sentence-transformers 6.1.0, transformers 5.17.0, huggingface-hub 1.32.0 and torch 2.14.0+cpu now load the actual cached intfloat/multilingual-e5-base model on CPU and embed all 50 universities. Runtime reports available true, mode semantic, semanticReady true and semanticDependencyAvailable true.

Nine real HTTP UniFit requests cover equivalent AI/robotics, medicine and humanities interests in English, Russian and Kazakh, with all other profile inputs held constant. Every result has mlApplied true, mlAvailable true, mlMode semantic, interestScope university and finite scores matching the direct model output; no ML warning remains. Canonical Kazakh response localization was also checked. Subject changes affect semantic relevance, without requiring any particular institution to lead the composite ranking. Chromium confirms ordinary profile entry/save, catalog reload and an AI-to-medicine interest update against the real API. 110 focused ML/scoring and 823 full backend tests pass; uv reports all 56 installed packages compatible. The model, weights, scoring calibration, accepted university data and frontend implementation are unchanged. Local semantic readiness is verified; CI/container/production inference remains unverified.

Local code/UI/API regression preparation is complete; CI, production, native browser zoom, a physical phone and independent human feedback remain unverified. Recommend10.0.0 (MAJOR), without applying it: NU's old category/finance API fields and unsupported saved/bookmarked choices are retired rather than remaining compatible. Profile-v2 data and other institutions' selections remain preserved through the explicit migration. Version9.2.0 is unchanged.

All managed preflight services ended; ports8000/5501/5510 had no remaining listeners at that checkpoint. Reports, logs, traces, initial failure evidence and the ordinary-runtime smoke are retained outside the repository in B's release-preflight artifact folder. No commit, push, tag, release or deployment occurred during the preflight. A main-branch merge triggers the existing Firebase Hosting workflow; release-artifact and container workflows start after publication.

The following detailed coverage is the historical2026-10-27 integration checkpoint, retained as provenance rather than current subsystem totals.

## Accepted data and implementation

Independent evidence acceptance is recorded in [the exact-hash manifest](packet-b/data-acceptance.json) and [source/scope review](packet-b/data-review.md). The active reviewed catalog now contains NU alongside MIT, Imperial College London and Stanford University. The prior three normalized institution records and all49 other common university rows are unchanged. NU's previous record and retired sync inputs remain complete inactive history.

NU has96 study options across seven canonical levels,46 route contexts,399 facts,161 sources and29 evidenced unknowns. The93 inventory entries and3 additional offerings do not imply open recruitment. All333 original facts, including superseded provenance, remain intact;66 source-linked section facets make compound program information readable. Academic/professional/medical/residency awards, actual shared forms, conditional statuses and no-route offerings retain their own structure.

The complete path connects validated profile evidence, source-hash assessment, discovery/filtering, native prices, detail, comparison and saved context. Regular admission, financial support, internal progression, transfer and mid-year entry remain separate. Mid-year uses a shared institutional route without inventing program eligibility. Known older source cycles remain available as history; program-specific unknowns do not enter unrelated routes. Unsupported earlier NU choices reset visibly without losing profile evidence or other universities' choices. English source prose and official titles remain accessible beside localized interface/program labels.

NUET sections, independent Nursing NAT percentages, ALEKS and IFOM/USMLE presence reuse the existing profile validation. Invalid scores reject rather than re-entering as raw evidence. Overall and required language sections use AND within one attempt and accepted alternatives use OR. Missing GPA/budget/sections stay missing; reported GPA retains its scale. Manual prior-degree/conflict/waiver conditions stay explicit, and financial support has no admission percentage. Native whole-program and campus/study-year prices never become an unsupported annual total or assumed net cost.

See [backend contract](packet-b/backend-contract.md), [backend handoff](packet-b/backend-handoff.md), [frontend handoff](packet-c/frontend-handoff.md), [runtime API documentation](../../../../docs/admissions-runtime-contract.md), and [storage/refresh documentation](../../../../docs/admissions-storage-contract.md).

## Verification recorded

- Full backend:821 passed after the final Git LF/CRLF fingerprint correction. Real content changes still invalidate evidence acceptance. Focused tests first reproduced the confirmed failures and then passed the fixes.
- Full frontend unit suite:648 passed after the final native-grade renderer correction.
-15 unique NU Chromium scenarios passed across focused runs, including an8-step regular-qualification matrix. Three MIT/Imperial/Stanford contrast scenarios and the corrected6-institution MBA membership test also passed. The matrix covers guest/incomplete/invalid evidence, context changes, save/reload/Back/Forward, comparison, cache migration/retry, all seven levels, source/cycle/fee differences, desktop/phone, light/dark and EN/RU/KZ.
- The expanded-check title layout and native A-level presentation were reproduced, fixed and checked through actual geometry/screenshots. B independently reviewed the corrected desktop and Russian-phone captures; comparison captures show loaded content.
- CLI inactive preparation and49 NU assessment companion records reproduce active data. Every source-hash assessment is reachable in a compatible requirements context. Original source values, reviewed hashes, old NU history, three prior reviewed institutions and all49 other university rows are preserved.
- Data audit:0errors/0warnings. Version9.2.0 is unchanged. C's final i18n check has3219 aligned keys; token/design guards have0 violations; inline-style guards pass. Documentation local links and published changelog integrity pass. Final root encoding and diff checks passed after report preparation.

## Publication limits

The29 remaining gaps are sourced publication limits or conflicts, including future/TBA dates, undated/past fees, NUZYP/NDS recruitment, credential/language-source differences, degree recognition/licensing, discretionary waivers and actual funding allocations. Their source scope and official next steps remain visible. Minimum checks are not admission or aid probabilities; an unassessed rule is not a verified pass or failure. No routine research is left labelled unpublished merely to stop work.

## Local delivery and cleanup

A's evidence and C's frontend handoffs are accepted. No ordinary research, implementation or browser work remains. B started no persistent web services; C stopped its owned runner services, including the last API PID27256/runner97342. No listeners remain on8000/5501/5510. No other owner's service was stopped.

B's own temporary helpers, source cache, preparation output and logs are archived in local QA storage outside the repository. Tool policy rejected recursive deletion, so cleanup preserved the artifacts through verified native moves. No generated scratch source/log/bytecode remains among new repository files. Final diff review includes tracked, staged and untracked paths; no secrets, unrelated source edits or changed published changelog blocks were introduced. The code/data are local and uncommitted; production and release publication were not exercised.
