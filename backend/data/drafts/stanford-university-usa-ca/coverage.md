# Stanford Stage 1 research coverage

Inventory snapshot: 2026-10-02. Comprehensive source/content recheck: 2026-10-03. Collection and scoped source review are accepted with researched unknowns. Original source dates remain unchanged. No runtime integration or Git release actions.

The recheck added department-specific coterm preparation, internal and intermediate degree procedures, HCP study/status restrictions, conditional charges, degree-specific medical MS completion requirements and undergraduate declaration gates. The authoritative dossiers preserve the actual values and scope. `recheck-owner.json` links 12 Engineering application families, all 73 undergraduate inventory rows, 18 Doerr awards and central policy reviews. `recheck-hs-gse.json` groups 84 canonical degree families into manually interpreted route contexts; repeated dossier/directory views are not independent forms. `recheck-medicine-professional.json` records 57 reviewed Medicine/professional targets, including the actual MS Bulletin completion pages. These ledgers are source-review evidence, not a guarantee that every possible fact is public.

## Inventory checkpoint

The current 2026-27 official Bulletin displays 355 programme rows: 235 with degree designations and 120 non-degree rows (71 undergraduate minors, 41 PhD minors, eight interdisciplinary honours). All rows remain in `inventory-snapshot.json`; non-degree rows are excluded from independent degree/application counts, not deleted. The 235 degree rows include 73 undergraduate award/subplan rows and 162 graduate/professional award rows. Parent programmes, subplans, intermediate awards, coterminal opportunities and restricted legacy offerings require relationship review; none of these counts equals independent external applications.

The live nonprofessional application directory has 113 named programme entries and the coterminal directory has 48. Every directory's linked Bulletin code exists in the inventory snapshot. Full-time and Honors Cooperative modes, entry terms and programme-specific testing remain separately labelled within preserved tables. Professional school applications are separately researched; directory absence alone does not establish that an award has no external route.

Undergraduate majors use shared institutional first-year/transfer admission; curriculum and declaration conditions are post-admission information. Engineering BS subplans retain their parent degree. Architectural Design (`ENGRBS17`) is present in the current Bulletin but the School of Engineering handbook restricts it to matriculation before Fall 2023 and directs later students to Sustainable Architecture and Engineering. Its legacy history remains visible; it is not offered as a new first-year or transfer degree choice. Economics BA and BS both appear in the current Bulletin.

## Current evidence ownership

| Dossier | Scope | Current boundary |
| --- | --- | --- |
| `undergraduate-study-evidence.json` | All undergraduate award/subplan study content, declaration and degree completion conditions | Institutional applicant admission evidence is separate; legacy availability condition retained. |
| `undergraduate-shared-evidence.json` | First-year/transfer, central nonprofessional graduate policy, costs/aid, housing/support and Knight-Hennessy | Reviewed; future-cycle and individual-case unknowns retain evidence and next steps. |
| `directory-evidence.json` | Exact external/coterm programme table contexts | Tables are published route facts; they do not establish all departmental prerequisites or funding. |
| `coterm-central-evidence.json` | Actual common coterm eligibility, process, fee, billing, degree/course transfer conditions | Applies to current Stanford undergraduate coterm applicants only. |
| `engineering-doerr-evidence.json` | Engineering and Doerr graduate awards and actual admissions | 27 Engineering contexts reviewed; 18 Doerr contexts completed in the separate dossier below. |
| `doerr-completion-evidence.json` | 18 Doerr graduate awards, actual external/current-student/joint procedures | Reviewed with option-level fact/source/unknown references. |
| `humanities-education-medicine-evidence.json` | H&S/GSE inventory; Humanities, arts and GSE specific applications | Quantitative/social and Medicine collection have separately owned dossiers below. |
| `hs-social-science-evidence.json` | Quantitative/social H&S programmes and departmental exceptions | Reviewed; Biology/Biophysics PhD explicitly cite the shared Biosciences source. |
| `medicine-graduate-evidence.json` | Nonprofessional Medicine and Biosciences research homes | 33 option-level research groups complete; 12 Medicine-owned Biosciences homes remain distinct from H&S Biology/Biophysics. |
| `professional-evidence.json` | GSB, Law and Medicine professional/restricted programmes | Reviewed, including current GSB PhD deadline, English exemptions and conditional funding. |

## Final review checkpoint

The linked index currently has 254 study options, including 235 displayed Bulletin award/subplan rows plus independently evidenced degree configurations and named variants. This is not a count of independent externally available degrees or applications. Additional relationships include BAS/concurrent BA+BS, GSB MSx (the direct `GSB-MSM` Bulletin page is omitted by the public list display filter), GSE specializations/joint degrees, four LLM specializations, and the MD-PhD combination.

Engineering degree-completion review covers 27 awards and Doerr review covers 18; separate `coverage_assessments` retain actual fact/source/unknown references. Medicine has 33 option-level completed research records. Professional, central undergraduate, Humanities/GSE and H&S social-science reviews are frozen. `coverage-index.json` links direct option facts, actual procedure facts and conditional shared facts; reference presence does not prove every domain is complete.

Current linked totals are 254 study options, 465 sourced application/progression contexts, 1,394 fact records and 750 source records (665 distinct URLs). The procedure views include duplicate dossier contexts, internal progression and directory rows; they are not 465 independent application forms. The additional CEE Hybrid Sustainable Engineered Systems option is a sourced configuration of the existing CEE MS. There are 88 current researched unknown records and seven superseded historical collection notes. All 47 retained collection-task records are completed or explicitly superseded by reviewed evidence. Counts describe the dataset and cannot establish completeness or applicant eligibility.

Significant distinctions preserved in the evidence include external CS MS versus CS PhD versus coterm, Symbolic Systems external three recommendations versus coterm two, Oceans MS for current doctoral students, restricted Neurosciences MS combined with another doctoral/professional programme, uncertain Immunology MS internal eligibility, E-IPER joint/dual entry distinctions, programme-specific language/test exemptions, and professional-school application/aid rules. GSB PhD's Fall 2027 deadline is December 1, 2026 at 5 p.m. Pacific; its 2026-27 incoming stipend is a separately dated annual funding reference, not a future-cycle promise.

Researched unknowns include unpublished future tuition/aid/checklist/health dates, applicant-specific awards and offer terms, official source conflicts, and restricted internal procedures absent from public instructions. Unknown costs remain unknown. Historical editorial collection notes superseded by completed department reviews are explicitly marked and must not be counted as current factual uncertainty. The final acceptance check must still reject any unsearched collection group.

MSPA's official 2026-27 application timeline leads to August 2027 entry; it is separate from the 2026-27 tuition reference year. The July 15, 2026 deadline retains 11:59 p.m. Eastern Time and the required CASPA Complete status, with no alternative proof accepted. Its timeline source was rechecked on October 3, 2026; unrelated source review dates remain unchanged.

`runtime-provenance.json` preserves the prior runtime record and official admissions input with their original source dates. Its preservation date is not a source re-review. No pre-existing award/ID suffix establishes the current catalogue award.

## Verification and acceptance

All 235 displayed degree rows are reconciled with sourced option profiles; additional variants and degree configurations remain linked. Source review distinguishes external admission, coterm, joint/restricted admission, current-student progression and degree completion. In-program grade or thesis requirements are not initial admission minimums. Internal awards do not inherit external application fees, checklists, interviews or funding promises.

The direct structural validator passes with 254 options, 1,394 facts and zero errors. It checks schema, faithful indexing/fingerprints, references, option/procedure/level intersections, retained condition prose, exact external/coterm directory tables and the significant degree/route contrasts. `test_fact_update.py` and `test_recheck_integrity.py` passed during this recheck. The latter rejects fragmented one-character condition arrays while accepting complete prose and structured conditional statements. Final `validate.py --acceptance` passed with zero errors after regeneration. Institution source/scope review is accepted. The collection gate does not replace source review.

Future-cycle tuition and private internal instructions remain explicitly unknown after bounded official-source review. Conflicting published requirements remain visible with source-specific scopes and a next official step. No zero fee, guaranteed award, invented future deadline or inferred external route fills those gaps. Runtime data audit does not read this draft; direct draft validation and source-backed content review are separate checks.

Final combined repository checks passed on 2026-10-03: `check:version` confirms unchanged 7.2.2; `check:encoding`, `check:tokens` (zero violations), and `check:i18n` (2,331 keys in each language, 1,197 used) passed. `audit:data` reports zero errors and warnings for active runtime data only, not draft completeness. Final diff whitespace, strict JSON parsing, source fingerprints and documentation links were checked. This Stage 1 recheck did not integrate runtime data or require browser verification; no Git or release action was performed.
