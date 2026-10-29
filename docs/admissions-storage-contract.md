# Prepared admissions storage contract

This contract prepares the accepted Massachusetts Institute of Technology, Imperial College London, Stanford University, and Nazarbayev University datasets for coordinated Stage 2 integration. It follows [the product model](admissions-product-model.md). The existing [runtime contract](admissions-runtime-contract.md) continues to describe the currently active application.

Preparation does not activate a catalog or migrate a saved selection. The accepted four-institution runtime reads the activated snapshot in `backend/data/admissions/catalog.json`, through the APIs and consumers documented in [the runtime contract](admissions-runtime-contract.md). The coordinated cutover removes their earlier policy fields from `universities.json`, preserves retired records outside runtime, and deliberately resets earlier selections with a visible explanation. Track remaining verification and later batches in [todo.md](../todo.md).

## Prepare and check the accepted batch

Run commands from the repository root using the existing backend environment. On Windows:

```powershell
.\backend\.venv\Scripts\python.exe -X utf8 backend/scripts/prepare_admissions_catalog.py
npm run test:backend -- test_admissions_catalog_preparation
```

On macOS/Linux, use `backend/.venv/bin/python` in place of the Windows interpreter. The preparation command is offline and checks the accepted batch without writing files by default. It reads only the four accepted draft directories and their explicitly linked evidence. It does not discover or activate other drafts.

To inspect a generated catalog, choose a new directory below `.tmp_test`:

```powershell
.\backend\.venv\Scripts\python.exe -X utf8 backend/scripts/prepare_admissions_catalog.py --output-dir .tmp_test/admissions-preparation
```

The command writes `admissions-catalog.json` only after validating the complete batch. An output outside `.tmp_test` or an existing output directory is rejected. Keep generated catalogs out of version control; the accepted drafts, preparation command, and input hashes reproduce them. Preparation never writes `universities.json`, official synchronization inputs, or application code.

The [JSON Schema](../backend/data/drafts/integration/schema.json) describes the prepared representation. The backend uses compact and context-selected projections of that representation; the complete storage envelope is not a default HTTP response. See [snapshot maintenance](../backend/data/admissions/README.md) for the reviewed refresh procedure.

## Shared representation

The envelope identifies the contract version and contains four institution records. Preparation explicitly emits `runtime_active: false`; the production loader requires `runtime_active: true` after the coordinated review and activation. The shared shape supports both states without changing evidence records. Each institution retains its catalog snapshot and an input manifest with repository-relative paths and SHA-256 hashes. Hashes identify the exact input bytes; they do not establish source freshness or research completeness.

| Entity | Shared fields and meaning |
| --- | --- |
| Institution | Stable institution ID and full official name; snapshot, coverage, and organization remain separately identified. |
| Study option | Stable catalog ID, title, browsing levels, awards, actual route links, parent option, fact/source links, and resolved option evidence. |
| Application route | Stable route/context ID, target/title, classification, destination, linked options/facts/sources, and explicitly established shared-policy references. |
| Fact | Stable ID, original topic, normalized scope, exact value, conditions and exceptions, sources, independent publication/review states, review dates, and provenance. |
| Source | Stable source ID, official URL/title, original checked date, and retained access/content-review metadata. |
| Unknown | Stable ID, researched reason, official next step, scope, sources, and whatever publication/review/date evidence was actually recorded. |

`attributes` retains institution-specific fields not represented by the shared fields. Linked index metadata that is not part of the original evidence is retained separately. These fields may contain significant curriculum, application-classification, fee-panel, phase, or source-review details; a later consumer must inspect them rather than discard them because they lack a numeric check. Original values, condition prose, labelled fee panels, and conflicts are not summarized or parsed into invented thresholds.

Resolved evidence remains traceable to its original record ID and evidence file. Catalog IDs are the authoritative cross-reference keys in the prepared representation. Local dossier IDs remain provenance, and Stanford's namespaced IDs remain namespaced. IDs are never regenerated from translated titles. Same-named routes, shared portals, and repeated dossier views are not deduplicated into one application.

Catalog inventory, subjects, families, variant relationships, and exclusions retain their institutional meaning. Supporting research files and historical runtime snapshots remain references with hashes where they are not current entity records. Historical runtime imports do not become freshly reviewed policies.

Option and route `fact_ids` combine existing catalog evidence links with facts that explicitly name that option or route in their normalized scope. These are traversal references, not proof that a fact applies universally to every applicant, option, or cycle on the route. Consumers must still intersect the complete scope and conditions. Shared-policy links are not expanded into inherited fact lists.

## Scope and levels

The shared scope exposes `option_ids`, `route_ids`, `levels`, `applicant_categories`, `cycle`, `fee_status`, and additional source-specific dimensions. The original evidence scope is retained separately. Normalization changes structural aliases and resolves documented IDs; it does not decide that a condition applies to an applicant.

Canonical browsing levels are `preparation`, `undergraduate`, `masters`, `doctoral`, `professional`, `residency`, and `non_degree`. MIT's `Bachelor`, `Master`, and `Doctorate` map to the corresponding browsing levels. The award stays separate: Imperial Computing MEng retains undergraduate entry and its MEng award. An award name does not determine the application route. Original level labels remain traceable in evidence.

Scope dimensions intersect. A fact specifying an option and a route belongs to that option within that route. Several IDs within one dimension may describe alternatives; the original condition can further restrict them. Empty arrays do not mean every option, every applicant, or every route. A shared policy requires its explicit remaining scope and conditions before a consumer may use it.

Retain dimensions such as qualification, degree, programme phase, fee panel, current-student status, and funding scheme. A registered PhD rule does not automatically govern a preceding MRes phase. An internal or coterminal route does not inherit an external graduate checklist. Family membership and a common application portal do not transfer policy.

Cycles and periods remain source-labelled. Do not extract an entry year from a review date, an academic-year price, or a recurring deadline. Exact date/time/timezone and window labels remain in their original values. A later API consumer must distinguish a known incompatible cycle from unconfirmed applicability.

## Publication, review, history, and missing evidence

Publication state, content review, HTTP access, and applicant assessment are separate concepts. Preparation preserves the source status vocabulary verbatim, including specific reviewed-selector states, partial publication, conflicting evidence, and not-yet-published values. It does not collapse them into a verified/unverified boolean.

Absent status or review-date fields remain `null` in their shared slots. A separate content-review or recheck date does not replace the original checked date. An unknown, unavailable amount, or unpublished future deadline does not become zero, an empty successful response, or personal ineligibility.

Superseded records retain their reason and related-fact links as history. They must not be presented or scored as current policy. Researched unknowns retain their evidence and official next step. Open collection tasks remain distinct and prevent preparation of an accepted batch; resolved historical collection notes remain historical.

Conditions and exceptions remain independent fields where the evidence records them independently. Preserve exam alternatives, waivers, test age/edition/section details, internal GPA scales, prerequisite credentials, and missing applicant evidence. Preparation does not infer legal residence, fee status, recognition of a qualification, or aid eligibility from citizenship or current residence.

## NU acceptance and source projections

The NU converter requires B's independent acceptance manifest to match the exact consolidated research catalog and each source packet/handoff fingerprint. It preserves all 333 original facts and 29 evidenced unknowns, and adds 66 source-linked section facets for compound program-page records. The 96 runtime options include three explicitly documented additional offerings; unknown current recruitment remains unknown. Two residency status contexts share the original application family rather than inventing separate forms.

The offline NU evidence gate accepts Git-equivalent LF/CRLF representations of the reviewed UTF-8 text. It still rejects any other catalog, packet or handoff content change. This keeps the original review fingerprints useful across Windows/macOS/Linux checkouts without treating a line-ending conversion as new research; it does not permit arbitrary JSON reformatting or changed facts.

Original source values/statuses/dates and scope prose remain intact. Runtime scope resolution limits ALEKS to its Finance/MBA/DBA programs, financial-support minima to their own route, and graduate references to their actual levels. Unsupported source level labels remain in additional dimensions. The source's future policy-review date is a refresh step, not a prerequisite to using its currently effective policy.

The preparation output includes `nu-assessments.json`, generated from the same prepared facts and their content hashes. Update only NU's records in the active assessment file after reviewing changes; keep other institutions' mappings. `attributes.catalog_costs.quotes` and `attributes.deadline_events` are bounded source projections, with billing/campus/year and date-kind limitations described in the runtime contract. These fields expose verified source structure without replacing original evidence or interpreting unsupported prose.

## Institutional contrasts

- MIT undergraduate majors retain university-wide first-year and transfer links and post-admission selection. BCS MEng retains its separate technical/overall GPA measures and internal eligibility. DEDP retains its MicroMasters prerequisite and exception to the ordinary prior-degree rule. An evidenced unresolved award retains no invented external application.
- Imperial Computing MEng retains its undergraduate UCAS context and course-specific conditions. Same-page award selectors keep their own curricula and labelled fees. Business MRes retains the integrated doctoral procedure and phase restrictions. Exit awards and internal progression are not converted into external application targets.
- Stanford retains institutional first-year/transfer admission, distinct external MS/PhD and coterm contexts, and restricted/joint/current-student procedures. Explicit shared-policy bridges remain links rather than permission to copy every central condition. Repeated procedure views are not additional independent application forms.

These are converter fidelity cases drawn from the accepted drafts, not fresh policy verification or applicant eligibility decisions.

## Validation and the next integration boundary

Preparation checks the fixed batch, source/dossier freshness fingerprints, unique IDs, resolved references, complete evidence indexing, retained scopes/statuses/conditions, and the absence of open collection. Focused tests exercise the real datasets and rejection of broken references and unsafe output paths. These checks establish structural fidelity; they do not reread official sources or certify the application UI.

Backend integration provides paginated program search, explicit option/route context, fact groups and sources, canonical selection support and [typed evidence checks](admissions-runtime-contract.md#applicant-evidence-and-test-attempts). Reviewed assessment mappings preserve source fact IDs/hashes and remaining conditions; unsupported rules stay unassessed. Personalized annual gross-cost and outcome projections are not established by the current heterogeneous values; canonical ranking omits affordability and ROI rather than borrowing a legacy price. Catalog cards may expose separately labelled published reference prices through the [runtime price contract](admissions-runtime-contract.md#catalog-reference-prices). A structured `attributes.catalog_costs` projection can retain an original prose fact while exposing its reviewed academic year, native tuition/total and excluded items; it does not establish personal or future-cycle applicability.

The accepted cutover connects fact groups to the detail and comparison consumers, keeps study/degree-completion facts separate from admissions, resets earlier selection pointers, and coordinates cache revisions. Saved canonical selections include their per-institution applicant/cycle/fee context instead of rewriting general profile preferences. No route is inferred from a legacy choice or a common portal.

Remaining verification must cover the product model's UniFit/UniChance meaning, unknown-versus-zero behavior, scoped costs/funding, and representative journeys before Stage 3. Add an annual-cost or outcome projection only when the reviewed period, cycle and applicant scope establish a comparable value; source price panels remain available without an invented total.

The other 46 institutions are not reviewed new-format datasets by virtue of this preparation. Paused drafts remain outside runtime. No permanent second runtime reader is introduced by this offline command.
