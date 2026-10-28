# Packet A handoff

**Status: `ready_for_review`**

Updated: 2026-10-25. Packet A's assigned research collection is complete and stable for review. This is a research handoff, not acceptance or runtime activation; `research.json` remains inactive.

## Files and coverage

- `research.json` — 31 assigned inventory records mapped one-to-one to 31 study options; 11 application routes; 81 scoped facts (74 verified, 7 verified_source_conflict); 55 official-source records; 14 active source-backed gaps; and 3 additional offerings (NDS, NUZYP and the Mining Engineering micro-credential).
- `coverage.md` — all 31 assigned program reviews, route distinctions, source-access anomalies, conflicts and unpublished cycle details.

All 21 preparation/undergraduate cards and all 10 master cards received program research. Their official program pages were reviewed directly except for Geosciences, whose live card URL renders an unrelated BSc Robotics page; the official indexed MSc content and current School of Mining and Geosciences listing are retained as evidence. Packet B's ready_for_review handoff publishes four shared Master policy facts with all ten A master option IDs in scope; the normalized catalog links them for B's independent evidence review.

## Representative route cases for review

1. **Regular UG, NUET and support:** Keep the 2027/28 credential-source conflict explicit. NUFYP regular entry and the formal NUET applicant category publish 120/50/50; financial support uses that score for 2027/28 state-grant eligibility after an offer; 2026/27 mid-year admission is fee-paying at 130/60/60. The visible 2027/28 UG academic table omits NUET, so do not promote 120/50/50 to a universal UG minimum.
2. **Offer versus financial support:** The applicant receives an offer, then either accepts it and pays the guarantee fee or submits a separate support application. Acceptance excludes support consideration. Dates remain TBA; category scope, evidence and published support terms are source-linked.
3. **Nursing and medicine:** Nursing is a Russian-language, two-year professional completion route with prior qualification/licensure/experience and separate NAT knowledge and clinical thresholds. UMP is six-year direct-entry medicine and remains separate from packet B's graduate-entry Doctor of Medicine.
4. **Joint BBA:** NU–HKUST is a four-year 2+2 joint degree, excluded from common NUFYP/UG policy and using its own requirements, campus split and costs.
5. **Additional study:** NDS is fee-paying undergraduate non-degree study; NUZYP's instructions are current but its intake is not confirmed; the Mining Engineering micro-credential is a separate professional non-degree offering with only a past 2026 intake.

## Open source-backed details

These are explicit conflicts or source publication gaps, not unreviewed assigned research: the NUFYP/UG policy carries a scheduled 2026-12-01 review date while remaining the currently approved/effective copy; 2027/28 IB/A-level values conflict across current pages; exact application, English-test and support deadlines remain TBA by applicant category; the Mid-Year portal direct URL and Geosciences card URL have access/content anomalies; present NUZYP recruitment is unconfirmed; Nursing/UMP/joint-BBA next-cycle terms and some fee/funding details remain unpublished; packet B has marked its research handoff `ready_for_review`; its four shared Master facts include A’s ten engineering/Robotics options. The join is resolved for consolidated review, while B’s independent evidence acceptance remains the activation gate. Details and official next steps are listed in `coverage.md` and individual gap records.

## Validation and implementation boundary

The draft is checked for valid JSON, unique IDs, resolvable source/fact/route references, complete assignment mapping and an official source for each study option. `npm run audit:data` checks active runtime data only; it does not establish draft completeness. This packet changes no active catalog, shared schema, backend or frontend code. Backend/UI/E2E checks are outside this research-only handoff. No source conflict is silently resolved, and no acceptance or runtime activation is claimed.
