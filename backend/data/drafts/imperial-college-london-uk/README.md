# Imperial College London Stage 1 draft

Institution ID: `imperial-college-london-uk`. Research snapshot: 2026-10-01. This directory is outside active runtime inputs. No application reader, API, scoring, profile or frontend integration is authorized in this task.

## Inventory and relationships

The dated official course-search snapshot is an input, not an independent-program or application count. Search currently includes undergraduate and postgraduate taught courses. Doctoral/research degrees, restricted professional awards and options absent from search require separate official reconciliation. An integrated MEng/MSci is undergraduate entry even though its award is master's level. PGCert/PGDip exit awards and course variants do not establish independent applications without evidence.

Course metadata is captured from actual official pages; HTTP success alone is not content review. Temporary HTML/text captures live under `.tmp_test/imperial`. Accepted findings, provenance and gaps belong here. Reuse old runtime reviews with their original dates and identify them explicitly; import dates are not fresh source reviews.

## Draft conventions and serial ownership

Common concepts follow MIT's documented conventions: institution, source, dated inventory entry, study option, application procedure, applicant context, intake, fact group, publication/review/access states, explicit exceptions and unknowns. Imperial keeps its own course and school structure. A shared portal is not a shared eligibility or funding rule. Scopes intersect; shared references are conditional, not inherited defaults.

The institution owner edits canonical catalog/schema/example/coverage, shared rules and `todo.md`. Bounded workers own their named school research files only. Each fact needs an ID, paraphrased value, topic, option/route/level/applicant/cycle/fee-status scope, official source URL/title, original checked date, publication and review state, conditions/exceptions and a next step for researched unknowns. An unsearched group remains unfinished.

The collector uses Python standard library only and writes this draft and temporary captures. It never writes runtime inputs. Direct draft validation checks references and evidence structure; `npm run audit:data` checks the active runtime and cannot establish draft completeness.

## Linked draft contract

`catalog.json` is a derived index, not the fact-value store. Each indexed fact resolves by `id` in its `evidence_file`; retain its value, conditions, exceptions and original scope there. Canonical scope normalizes option IDs and postgraduate-taught levels while `original_scope` preserves every source-specific applicability dimension. Empty option scope means a conditional shared policy, never universal inheritance. Apply the documented level, degree, route, applicant, qualification, cycle and fee-status intersections before using a shared fact.

`study_options` includes search entries, selector variants, independently evidenced award entry points, internal progressions and research offerings. `parent_option_id` links a variant without claiming another application. `published_key_facts` describes that option only. In evidence profiles, scalar key facts describe the base option; `per_option_key_facts` supplies the named variants. Course-wide fee panels retain their exact award, mode and fee-status labels; a panel containing several amounts is not a single price.

`application_procedures` records application contexts, including unresolved or internal contexts. Its count is not a count of independent applications. Same UCAS code variants share the course context; named PGCert/PGDip entry points receive distinct contexts only when the reviewed course states separate entry. Exit awards have no direct application. Business MRes is the initial phase of the documented MRes-to-PhD application, not a no-test standalone master's default. Scheme recruitment, admission and funding remain distinct.

`sources.json` retains all differing original source records in `evidence_records` when dossiers share an ID. The exact Imperial–University of Cumbria joint medical school is permitted for its own programme evidence, supported by an Imperial source. Non-university sponsor material is retained separately as `external_references`, not accepted as a university-verified admission fact. Access success, publication and content review remain separate states. `evidence_fingerprints` detects an index older than any input dossier.

IDs are stable dossier identifiers, not names to be regenerated from titles. The index retains the dossier's publication/review status verbatim: `published`, `historical`, `unknown`, `verified`, `researched_unknown`, and more precise source-specific states occur. These are documented evidence states, not an exhaustive closed enum. An `access_status` reports the access check only; it never upgrades review status. Amounts carry currency, period, fee status, award/mode and cycle in their value or exact labelled panel. Unknown records need reviewed sources, the reason, applicable scope and an official next step; collection tasks remain separate.

## Concrete examples

- Computing MEng: `imperial-option-computing-meng`, undergraduate course selection through UCAS. Its MEng award does not create postgraduate entry; use its course-specific conditions and UCAS code.
- Digital Chemistry: `imperial-option-digital-chemistry` is MSc, one year; `imperial-option-digital-chemistry-variant-1` is PGCert, six months. Separate profile facts preserve MSc Home/Overseas tuition £16,400/£45,550 and PGCert £8,200/£22,775. Both selector panels publish the same course application round; the stray 18 June 2026 visa advice is retained as a dated conflict, not a 2027 deadline.
- External iBSc: `imperial_intercalated_bsc_external_uk_irish` uses its School-specific application and enrolled-student eligibility. It does not inherit UCAS fees or normal first-year requirements. The 16/17-pathway conflict remains explicit.
- MD(Res): `imperial-mdres-gmc-exception` is scoped only to the nine MD(Res) offerings; the GMC waiver for research without patient contact is visible, not inferred for PhD or taught study.

[`example.json`](example.json) is a filled Business MRes traversal: selected study option → integrated procedure → indexed fact → original doctoral entry evidence and sources. The explicit option/level bridge preserves tests, documents and deadlines for the initial MRes phase without making them a policy for other master's courses.

## Verification

Run `python backend/data/drafts/imperial-college-london-uk/assemble.py` after dossier changes, then `python backend/data/drafts/imperial-college-london-uk/validate.py` from the repository root using the existing virtual environment. Assembly reads runtime only to preserve historical provenance and writes this directory only. It does not refresh source reviews. The validator checks inventory relationships, references, complete fact indexing, original scope/provenance, evidence freshness and meaningful contrast cases. Follow with the repository data/encoding checks for the changed draft; runtime audit alone is not draft acceptance. See `coverage.md` for research limits and outstanding collection.
