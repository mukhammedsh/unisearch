# MIT draft coverage and handoff

**Acceptance status: complete after focused review corrections, 2026-10-01.** The earlier completion statement was withdrawn when review found three semantic defects. This checkpoint closes those defects through explicit policies/unknowns, scoped links, individual historical reconciliation and focused data assertions; it does not claim that counts or structural validation alone prove completeness.

Research snapshot: **2026-10-01**, official catalog **2026-2027**. Scope: Stage 1 task 1.1, MIT data/schema only. Drafts remain outside active runtime inputs.

## Inventory and application reconciliation

[catalog.json](catalog.json) contains **191 study options**: 55 undergraduate, 70 master's, 58 doctoral and 8 professional under the draft's existing level classification. **391 official school/college/interdisciplinary degree-table rows** map to options, research/thesis fields, partner variants, concentrations, combined degrees or Harvard-award exclusions. The [raw snapshot](catalog-degree-table-rows-2026-09-30.json) preserves source URLs and original labels. Counts are evidence, not target counts or independent application counts.

The [undergraduate chart index](https://catalog.mit.edu/degree-charts/) supplies 55 unique charts. School tables repeat some majors and omit some charts. Individual subjects/minors are excluded. Archaeology and Materials offers an SB; Humanities requires special arrangement/SHASS approval; STS is a second major with primary-major approval conditions. Every undergraduate major links to shared first-year/transfer admission.

There are **73 application/selection procedures**, including departmental, institutional, restricted and internal entry. MITILI terminal Linguistics SM uses the Linguistics application procedure and is not restricted to existing MIT students. Economics special SM approval is internal, without a separate public portal/checklist. Intermediate/Engineer awards and combined degrees do not automatically establish external applications.

Every option has a sourced classification. Earlier actual reviews remain carried_forward_review with original dates; final semantic reconciliation does not falsely upgrade content-review dates. Nine awards remain evidenced_unresolved: Civil Engineer, Engineer in Aeronautics and Astronautics, Environmental Engineer, Engineer in Materials Science, Toxicology SM, thesis Chemical Engineering SM, HASTS SM, BCS SM and Nuclear Engineer. Their records cite reviewed catalog/department/OGE evidence and identify the next official confirmation. No external application or rejection is invented.

Relationships also distinguish internal EECS/BCS/BE MEng, EAPS/Mathematics fifth-year study, secondary CSE SM, EECS predoc progression, Sloan Management Research SM, MAS PhD progression, WHOI Naval SM, CSE home-department selection, PPSM/IDPS selection, Advanced Urbanism, Business Economics and independently admitted dual degrees. Harvard-awarded HST MD is excluded. Current MEMP PhD guidance and older ScD catalog field labels remain explicitly distinguished.

## Coverage and provenance

[route-coverage.json](route-coverage.json) indexes **73 procedures × 15 domains**, separating direct facts from conditional common references and indexing nine unresolved awards. It is an editorial evidence index, not policy inheritance or completeness inferred from keywords. **35 portfolio/interview cells are bounded public-checklist omissions**: unknown with reviewed source and next step, never a promise that a department cannot interview.

| Domain | Coverage and boundary |
| --- | --- |
| Institution/support | Cambridge address; WHOI Woods Hole/transport; English instruction; advising, disability/mental-health support, distinct UG/graduate support and housing eligibility/capacity/selection/rent. |
| Study/completion | Bounded description for every option; curriculum/degree charts, research/thesis/residency structure; published duration/format. Minimum residence does not establish a fixed duration or every option's schedule; unknown is not zero. |
| Qualifications/preparation | Secondary/matriculation categories; department-assessed acceptable graduate equivalent; research/experience, subject and internal GPA/category conditions; DEDP exception and remediation. No universal credential recognition/GPA inferred. |
| Tests | Presence versus numerical minima; accepted/rejected alternatives; scales, age/verification, exemptions/waivers and source conflicts. Admitted distributions are not cutoffs. |
| Documents/interview | Program checklists/limits/references/translations/videos/portfolios; official-evidence stage, invitation/mode/expenses where published. Internal/protected details remain evidenced unknown. |
| Process/windows | Real targets/destinations/categories/intakes/rounds; application/test/reference/waiver/funding dates and published time/timezone. Yearless dates remain recurring; cohorts remain separate. |
| Costs/funding | Standard/non-standard tuition; separate application/student-life/insurance/living charges; deposits/installments; conditional aid/appointments/fellowships/loans/family grants/renewal. Consideration is not a confirmed award. |
| Offer/enrollment | Official records/scores, replies/deferrals/discrepancies, registration/payment/EET and returning-student conditions, including unfunded-offer conflicts. |
| Career | MIT 2025 outcome/support resources and SFS salary data note; reviewed program career descriptions. Institution-wide results are not program-specific salary/job promises. |

There are **913 facts**: 558 retained reviews, 233 verified, 29 conflicting and 93 superseded historical statements. Active publication states: 736 published, 52 unknown, 29 conflicting and 3 not published. Superseded facts retain reasons/links. Option and route scopes intersect. Significant narrative conditions remain stored even where the current application cannot evaluate them.

Dated candidate files and preserved [doctoral](doctoral-evidence-2026-09-30.json), [professional](professional-evidence-2026-09-30.json), [master's](masters-evidence-2026-09-30.json) and [route](route-evidence-2026-09-29.md) evidence retain original research dates. Importing is not a fresh web review. They are historical inputs, not supported legacy runtime formats.

## Important cases and evidenced unknowns

- First-year graduation/GED is not formally required; college matriculation has a specific alternate-calendar exception. Transfer has different school/term/spring-category restrictions. One entry-year application and other schools' binding early agreements matter.
- DEDP requires MicroMasters, **not a prior bachelor/master**, and rejects GRE/GMAT. Next published cohort is Spring 2028, while its cost table is explicitly 2027. Lemann consideration requires Brazil birth **or** residence, admission and need; no award is presumed.
- SCM starts on MASc; MEng approval follows arrival. Department/OGE dates and three-versus-five-year credential validity differ; blended entry-year ambiguity is retained.
- BCS MEng has mandatory GPA/category/research conditions; EECS contextual GPA norms are not identical minima. EECS closing-event wording conflicts. Internal retesting/checklist/windows remain unknown where reviewed public/protected instructions do not establish them.
- Physics typical scores are expressly **not minima**, unlike OGE. HST recommendations/waivers, Biology's older scores/exemption wording and CSB TOEFL 110/new 5.5 versus OGE 100 conflict. EAPS AY2027 GRE is required without cutoff except MIT fifth-year SM; letter/ELP instructions conflict internally.
- Biology/Microbiology require in-person interviews and earlier official records; BE, Chemistry, Mathematics and AeroAstro retain different invitation/mode/record stages. General OGE interview discretion cannot replace those specifics.
- Architecture ended MArch advanced placement despite older catalog wording; ELP timing conflicts. DUSP distinguishes MCP/SM/PhD tests/funding, one target per year, no deferral and independent sequential dual admission.
- MBA/MSMS fee inclusion, MFin12 tuition, internship percentages, application fees and unfunded-offer replies have official-source conflicts. Current prices do not quote future cohorts. EMBA Class2028 installments are not Class2029 tuition; individual support and renewal require their own evidence.
- Science Writing's linked funding page is unavailable via CLI/web. Music Technology linked SM/MASc pages are unavailable and OGE's SM test/2025 restriction is contradictory. These are investigated limitations, not invented missing publications.
- Nine award classifications and internal/protected procedures require their identified departmental/current-portal confirmation. No office was contacted.

**Uncompleted collection in this bounded task: none.** Evidenced unresolved facts stay explicit in the matrix/main draft with official next steps. Future publications are not awaited indefinitely. Scope is degree choice and real admission, not every course, research paper, news item or external scholarship.

## Focused review correction acceptance checkpoint (2026-10-01)

Three confirmed review defects were corrected without repeating the complete MIT collection:

1. BCS MEng: `mit-course-6-9p-meng-description` no longer has an academic-tests topic. `bcs-meng-academic-tests-unestablished` records the reviewed public criteria, the missing separate test checklist and the current-application/academic-office next step. Catalog, contributor example and matrix retain unknown; public silence/internal classification does not establish no exam.
2. MITILI: `linguistics-shared-application-documents` and `linguistics-shared-application-window-and-fee` explicitly apply to both Linguistics PhD and MITILI SM, using MITILI's published shared-procedure instruction plus the actual application page. `linguistics-current-tests-and-oge-conflict` now preserves the shared department English-test/waiver procedure, while explicitly identifying the lower OGE listing as PhD-only conflicting reference evidence. `mitili-shared-linguistics-application-boundary` links these concrete facts. Deadline is recurring December 15 for following September, with unpublished year/time/timezone left null. `linguistics-doctoral-gre-policy` and `linguistics-doctoral-entry-format-and-funding` stay doctoral-only; `mitili-academic-tests-unestablished` preserves GRE uncertainty. The old compound `linguistics-documents-offer-and-funding` is superseded, not copied into MITILI.
3. All thirteen `reviewed-mit_<stem>_doctoral_admissions-gaps` records below are historical editorial/research notes with independent closure reasons and explicit related facts. Thirteen runtime `*-extra-requirements` summaries that duplicated those notes and the old AeroAstro funding collection note are also superseded. Original values/source dates remain available as history; no editorial assignment stays a current published fact.

| Historical gap stem | Preserved current policy or unresolved result |
| --- | --- |
| aeroastro | `aeroastro-affiliated-procedures-boundary`, `aeroastro-doctoral-entry`, `aeroastro-support`: distinct affiliates and actual departmental support. |
| biological_engineering | `biological-engineering-lgo-supplemental-documents` is LGO-only; `be-visit-poster-preparation-and-support` retains support transition; `be-doctoral-fixed-duration-renewal-unestablished` retains missing fixed duration/renewal evidence. |
| biology | `biology-no-supplemental-materials` preserves the exclusion under Biology PhD only, alongside its current interview/evidence fact. |
| brain_and_cognitive_sciences | `bcs-doctoral-oge-copy-reference-conflict` retains the Mechanical Engineering copy-reference ambiguity; no automatic transfer of that department's rules. |
| chemical_engineering | `cep-single-application-joint-review-and-transfer` and `oge-funding-chemical` preserve CEP distinctions and explicitly conditional program support. |
| chemistry | `chemistry-2027-interview-statements-and-records` establishes initial uploads versus post-admission official records. |
| civil_and_environmental_engineering | `cee-scd-funding-scope-unestablished` remains unknown. Published SM/PhD support is narrowed to PhD, not automatically extended to ScD; CEE and CSE test procedures remain separate. |
| computational_and_systems_biology | `csb-2027-interviews-documents-and-score-conflict` and common ELP references preserve reviewed current department policy; earlier failed-link/collection notes are historical. |
| computational_science_and_engineering | `cse-doctoral-application-choice`, `cse-computer-science-target-boundary`, `oge-funding-cse`: reconciled standalone/joint mappings, CS target and home-department support. |
| earth_atmospheric_and_planetary_sciences | `eaps-ay2027-gre-and-fifth-year-exception`, `eaps-elp-and-document-timing-conflicts` and original dated window retain WHOI separation and dated verification. |
| eecs | `eecs-prior-phd-and-entry-boundaries`, `eecs-engineer-and-doctoral-progression`, `mit-eecs-phd-course-6-description`: both PhD/ScD present and intermediate master distinguished. |
| hst_memp | `hst-department-elp-score-and-waiver-conflict` resolves waiver extraction; `hst-cambridge-test-age-unestablished` preserves direct-score age uncertainty; current MEMP award scope remains separate. |
| hasts | `oge-funding-hasts` and the preserved application-window/ELP-exception facts retain yearless dates, explicit 2027 verification and conditional nine-month sixth-year support. Earlier departmental-link failure is historical; no new departmental content review is claimed. |

Five added evidenced unknowns remain: BCS MEng academic tests, MITILI academic/GRE treatment, BE fixed support duration/renewal, CEE ScD support scope and HST Cambridge-result age. The BCS doctoral copy-reference ambiguity is an added conflict. Each identifies reviewed official evidence and the next official step; these are not unfinished collection disguised as missing publication.

Focused correction verification: seventeen affected official URLs returned HTTP 200; individual source `access.review_correction_http_*` fields retain the result without upgrading original content-review dates. The validator checks actual BCS test data, explicit MITILI scopes/links/concrete values and all thirteen gap histories/duplicate summaries. Current coverage excludes superseded facts. A cell containing only an unknown test policy is unknown, not mixed published/unresolved.

## Sources and verification

**286 referenced official MIT sources**: 256 checked September 30 and 30 October 1. **273 CLI HTTP200**, **7 successful web HTML/PDF checks**, **3 CLI failures with successful actual web fallback**, and **3 unavailable links** (Music Technology SM/MASc and Science Writing). Registry records preserve exact URL/title/date/result. HTTP success alone did not verify content. All 38 affected OGE application links were retrieved from their actual pages. Actual Microbiology/CSB HTTP200 pages naming 2027 override stale 2026 search extracts.

The focused validator checks this schema's actual assertion keywords, JSON, IDs/references, scope/status/period/provenance/unknown reasons, reverse route indexes, descriptions/discovery labels, exact 391-row reconciliation and coverage matrix. [template.json](template.json) demonstrates six options/17 facts/five routes: shared UG, STS, BCS MEng, MSMS, unresolved Materials Engineer and DEDP qualification exception. It is not a mandatory layout for other institutions.

From repository root, use the backend environment interpreter with -X utf8 and backend/data/drafts/mit/validate.py, followed by npm run audit:data. Direct validation: **15 JSON, 0 structural/reference errors**, 391 reconciled rows, 73×15 domains and nine unresolved awards. Runtime audit does not establish draft completeness.

Final checks on October 1:

| Command | Result |
| --- | --- |
| Direct draft validator | Exit 0; results above; complete snapshot and filled example validated. |
| npm run audit:data | Exit 0; active runtime dataset 0 errors, 0 warnings. |
| npm run check:version | Exit 0; version 7.2.1 synchronized. |
| npm run check:tokens | Exit 0; 0 hardcoded colors. |
| npm run check:i18n | Exit 0; eng2331, ru2331, used1197. |
| npm run check:encoding | Exit 0; encoding check passed after final documentation edits. |

Documentation-relative links and the final allowed-file diff are reviewed before delivery. No backend/E2E/browser verification is claimed for this data-only change.

Saved-checkpoint [CI36747039224](https://github.com/mukhammedsh/unisearch/actions/runs/36747039224) failed: backend/frontend units passed; E2E199 passed/2 failed. Reported failures: funding note expectation at university-track-majors.spec.js:279 and narrow dark MIT context bounding box at :767/:781. No comparison supports a pre-existing/regression attribution. This task did not investigate application code or rerun full E2E; carry into Stage2/3.

## Stage 2 handoff

Intersect selected option/route/applicant/cycle scopes. Discovery/family membership never grants policy inheritance. Preserve independent dual entry, internal selection, post-arrival award choice, unresolved classification, history and visible conflicts/unknowns.

Required applicant evidence includes education/matriculation/term history, credentials/MicroMasters, internal category, GPA scale/course set, research/advisor/experience timing, home/education language/country/date, actual immigration/aid category, test edition/sections/date/verification, household/dependents, offers/appointments and registration status. Reuse current profile/exams and add only demonstrated missing evidence. Do not infer immigration/aid from residence/citizenship or turn missing evidence into rejection/zero.

Show mandatory exam presence without fabricated cutoff, alternative/waiver applicability, unsupported rules as readable/unassessed, separate costs from consideration/confirmed support and current from future prices. No API/scoring/profile/frontend/runtime sync or format activation was implemented in 1.1.
