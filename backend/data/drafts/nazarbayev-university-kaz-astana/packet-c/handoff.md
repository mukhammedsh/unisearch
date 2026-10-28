# Packet C research handoff

**Status: ready_for_review**

Updated 2026-10-24. Files: `research.json`, `coverage.md`. This is the data handoff to A; C continues frontend and real-browser QA under work-plan.md.

- 31/31 assigned cards substantively reviewed: 13 technical research PhDs, 18 medical residencies. 31 stable study options, two shared route families, 60 sourced/scoped facts, 43 source records. No ordinary unfinished page collection remains.
- Corrected the prior duration-key bug that defaulted some residencies to four years. Each now has its official 3–6-year duration and study description.
- Program-specific evidence retains School GPA differences, Chemistry Industry PhD, Mathematics/CS study conditions, actual supervisor structures, residency Internal-Medicine/surgical trunks and conditional routes. No separate application is invented for a track or continuation stage.
- Shared PhD references for B use explicit target IDs in `cross_packet_refs`. Technical School rules do not transfer to GSE/GSPP/GSB/NUSOM professional or research programs without their own scoped source.
- The 2024 residency PDF names six older specialties and conflicts with current pages on English thresholds. Current program pages and EN/RU Gastroenterology wording also differ. Retain conditions/source status and show unresolved assessment where a conflict affects a candidate.
- Funding is now sourced beyond the first pass: Abay coverage, citizenship-based partial awards, residency state/sponsor/self-funding sources, repeat-state-residency restriction, Kazakhstan state-grant service obligation and graduate guarantee deposit. Current awards/quotas and inconsistent yearless stipend amounts remain publication limits.
- Future PhD 2027/2028 deadlines are TBA. PhD/residency tuition remains labeled 2025/2026. No current-cycle price or next residency dates are invented.

## Integration requirements

Use separate preparation/degree/professional/residency browsing and native awards. Keep one selected program/route/applicant/cycle context across requirements, dates, money and comparison. IFOM BSE / USMLE Step 1 are report-presence alternatives with no NU-published numeric cutoff in reviewed sources; preserve date/conditional deferral and manual equivalency/waiver conditions. Do not convert ACGME-inspired curriculum into ACGME accreditation. Preserve license/foreign-qualification decisions as unassessed reference rules.

Program/source anomalies and exact remaining publication limits are listed in coverage.md and `gaps`. They do not require ordinary collection to continue or external emails before evidence review.

## Checks

Final JSON/unique-ID/all-31-inventory/option-route-fact-source/cross-packet-reference/status checks passed. `npm run audit:data` passed with 0 errors and 0 warnings on 2026-10-24. Earlier all-31 source reachability passed; current missing-page content fetch and official web page review are recorded separately. Frontend missing-GPA conversion fix is independently covered by 39 passing persistence unit tests; full frontend verification follows B’s actual contract.

No Git publication or deployment. C owns only packet C research plus frontend/test/localization changes.

## Scope fidelity correction (2026-10-25)

Canonical level aliases, exact program fact links and shared route fact links are now explicit in packet C. Research doctorate versus medical-residency offering kinds and the verified NU portal destination are retained. Residency is one application family with two verified admission statuses that need distinct selected runtime contexts. Two resolved collection gaps moved to `resolved_gap_history`; five active publication/interpretation gaps remain. Official content review dates and fact values were preserved. Regenerate the consolidated catalog from the latest packet before acceptance.

The five active gaps now also carry explicit option/route/level scope, original prose scope, publication/review state and their actual source-content review dates (2026-10-23 or 2026-10-24). Licensure and next residency cycle apply only to residency; Industry PhD terms only to the Chemistry option's industry variant; PhD/residency funding and future fees apply to the relevant 31 C options. The unrelated PhD aid source was removed from the licensure gap, retaining its previous source list for provenance. No undergraduate or master's scope is inferred.

Live-context review identified three graduate-reference scope aliases that needed an explicit canonical level boundary. The stipend conflict now has doctoral/residency levels; the graduate guarantee-fee and on-campus monthly-living references have graduate-degree/professional/residency levels and retain their original source scope and unconfirmed program applicability. They must not appear on undergraduate contexts. Source wording, dates and amounts are unchanged; regenerate the accepted snapshot before the final browser window. The general fee-discount reference remains institution-wide and conditional, never an automatic award.
