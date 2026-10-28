# Packet B research handoff

**Status: ready_for_review.** Updated2026-10-25. All31 assigned programme contexts have completed ordinary source collection. Evidence remains inactive until A consolidates and B independently reviews the complete NU catalog. B continues backend/final integration under work-plan.md.

## Files and counts

- `research.json`:31 inventory entries,31 study options,31 programme routes,192 facts (153 current-review and39 superseded first-pass references),63 source records,10 verified publication/conflict gaps,2 cross-packet references.
- `coverage.md`:all31 offerings, reviewed domains, representative distinctions and exact limitations.
- `validate_research.py`:reproducible standard-library structural and data-contrast validation. Run from root with the existing backend interpreter.
- `backend-contract.md` and `requests.md`:implementation surface and cross-owner coordination, separate from research acceptance.

## Transfer for A

Use current facts linked through option/route `fact_ids`, plus the explicit `shared_master_policy.fact_ids`.39 `nu-b-fact-*` first-pass references are now `review_status:superseded`, and old mixed narrative/collection notes are isolated in `first_pass_history`; preserve provenance but do not activate them as current policy. `source_aliases` maps11 former IDs after exact-URL coalescing. Original review dates are retained; substantive follow-up is dated2026-10-24 and access verification2026-10-25.

The four shared master policy facts now explicitly include the10 A-owned engineering/Robotics IDs in their scopes. Policy effective2026-03-05 excludes MD, MScNursing, NU-SOASMA, EMBA and residency. It separately excludes OnlineMPA/AppliedAI/MBA/Finance from ordinary full-fee-category treatment. A master waitlisted candidate accepting a paid offer may continue grant competition if places become available; do not inherit the undergraduate exclusion. State/Bolashaq repeat-degree restrictions, English70% proof/alumni exclusions, OneSkillRetake, guarantee/transcript/conditional/deferred terms remain visible.

The C reference names `nu-c-phd-application`, `nu-c-phd-2027-28-cycle`, `nu-c-phd-fee-2025-26` and `nu-c-phd-scholarship`. Its technical-school prerequisites/checklist do not govern B programmes. DBA/DPM retain professional-doctorate awards; MD is a professional graduate-entry award, not a master or research doctorate merely because the central A-Z/form labels use Master’s.

## Required fidelity cases

Finance whole-program costs and test waiver; MBA13k/16k whole-program prices and writing-source conflict; EMBA contact-only price/date-cycle mismatch; DBArolling2027 versus centralTBA; MPAonline fee-only and separate work/funding contexts; DPM200ECTS/online option and annual18k; Biomedicine umbrella/tracks; MSNprogramme6k versus genericmaster16k scoped references; MDscience/MCAT/resident-fee context; SOMregular3.00/aid2.75/central2.75; PhDEurasianIELTS7 and competitive/aidGPA distinction; SOASform/optionalreferences/OnlineIELTS/yearless31July and singleGBP fee.

The10 remaining gaps are supported official-publication differences or unknowns with next steps. No routine collection remains deferred. Do not turn an undated fee into2027 price, infer nationality=legal fee residence, manufacture missing dates, or use scholarship availability as net cost.

## Checks actually performed

- `validate_research.py` passed31-card reconciliation, unique IDs, source/local/cross-packet references and concrete Finance/MSN/MD/SOAS assertions.
-61 official sourceURLs returnedHTTP200 directly;2 direct-connection failures returned official page content through web retrieval. HTTP success is not content verification; content review scopes/dates are separate.
- Runtime `npm run audit:data` passed0errors/0warnings after final fact/source edits. It checks active data, not this draft’s factual completeness.
- New backend checks are in progress separately; no browser-verification claim is made from research. No Git publication/deployment is authorized.
