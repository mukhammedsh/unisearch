# Nazarbayev University consolidated data handoff

**Status: `ready_for_review`**

Updated: 2026-10-25. All three owners have closed ordinary packet research. This normalized catalog is ready for B's independent evidence review. It remains inactive and is not yet accepted for runtime use.

This handoff records the state on that date. The subsequent evidence acceptance is documented in [the review manifest](packet-b/data-acceptance.json).

## Consolidated files

- `research-catalog.json` — 93 assigned inventory entries, 93 study options, 44 application routes, 333 facts, 1,009 option-to-fact links, 161 sources, 29 active source-backed unknowns, 3 resolved-gap history records, 3 additional offerings and 6 cross-packet references. Every option has an explicit fact-ID list. The catalog fingerprints the assignment, each packet and each packet handoff.
- `research-catalog.schema.json` — normalized research record contract, including nullable review status for source formats that do not provide one.
- `research-catalog.example.json` — partial excerpt of the NUET support and mid-year routes; it demonstrates separate cycle-scoped thresholds and is not a complete catalog.
- `packet-a/`, `packet-b/`, `packet-c/` — retained owner research files; the catalog carries each record's original packet, evidence file, ID, scope and source references.

## Packet coverage

| Packet | Cards/options | Routes | Facts | Sources | Unknowns | Additional offerings | Research handoff |
|---|---:|---:|---:|---:|---:|---:|---|
| A | 31 / 31 | 11 | 81 | 55 | 14 | 3 | `ready_for_review` |
| B | 31 / 31 | 31 | 192 | 63 | 10 | 0 | `ready_for_review` |
| C | 31 / 31 | 2 | 60 | 43 | 5 | 0 | `ready_for_review` |

Packet B identifies 39 superseded first-pass facts within its 192 records; their `review_status` and provenance remain visible and they are not current policy. One resolved collection summary from A and two from C are kept in `resolved_gap_history`, not the active unknown list. A's 54 sources with a content-review date now carry an explicit content-review outcome (`reviewed`, indexed, historical or mismatched content); the direct Mid-Year URL that returned 404 remains without a content-review status. Access status and content-review date remain separate, and no status is inferred from HTTP reachability.

## Cross-packet reconciliation

- A's shared Master route resolves to B's four policy facts and source. Their current scopes include all ten A-owned engineering/Robotics master's options. The official policy's program exclusions and each option's own published exceptions remain separate.
- B's PhD process/funding reference resolves to C's `nu-c-phd-application`, `nu-c-phd-2027-28-cycle`, `nu-c-phd-fee-2025-26` and `nu-c-phd-scholarship` facts. B's own program rules remain controlling for its programs.
- C's three reverse PhD references retain their exact route/fact targets and applicant/program limitations.
- The 29 active unknowns are evidence-backed publication gaps, conflicts or next-cycle details. No broad assigned program-page collection remains unfinished.
- The 2026-12-01 policy revision date is recorded as a scheduled source refresh; the current policy is approved/effective and this date is not an activation prerequisite.

All facts retain their value, original scope, conditions, exceptions, publication status, source IDs and owner review status. A's 81 facts now carry 74 `verified` and 7 `verified_source_conflict` statuses. Foundation English/academic facts resolve only to the Foundation option and preparation level; undergraduate equivalents resolve to the 18 common undergraduate options. The builder links the published facts to each option through exact option scopes and shared route scopes, without exposing Foundation minima on undergraduate options. Monetary scope, period, currency, cycle and campus are kept with their own evidence.

The consolidated source-host audit found 159 NU-hosted source records and two official SOAS partner sources for the joint MA; no aggregator domains were present. This is a host review, not an HTTP reachability claim. Per-source access and content-review results remain in the catalog.

## Validation performed

- `python backend/data/drafts/nazarbayev-university-kaz-astana/validate_research_packets.py` — passed assignment reconciliation, unique IDs, packet references and cross-packet targets; all three handoffs are ready for review.
- `python backend/data/drafts/nazarbayev-university-kaz-astana/build_research_catalog.py` — passed catalog reference checks and produced `research_status: ready_for_review` with current input fingerprints.
- `research-catalog.json` and its partial example were checked against the draft schema shape.
- `npm run check:encoding` — passed.
- `npm run audit:data` — passed with 0 errors and 0 warnings. This audits active runtime data and does not establish acceptance of the draft catalog.

No runtime data is activated here. B's independent evidence review and implementation integration remain open; no backend/frontend/E2E acceptance is claimed by this data handoff.
