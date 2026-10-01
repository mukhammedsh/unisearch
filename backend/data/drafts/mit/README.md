# MIT research draft contract

`catalog.json` and `schema.json` define draft version 2.0. They are outside active runtime inputs. The institution uses the existing `mit-usa-cambridge` identifier; record IDs retain local `mit-` prefixes. `template.json` is a filled contributor example, not a mandatory structure for other universities. MIT's organization is evidence, not a universal university model.

## Relationships

- **Subject** is a discovery label. It does not identify an application.
- **Program family** groups related MIT offerings. It can include more than one application target or award. No admission policy is inherited solely from membership.
- **Study option** identifies a degree/program/major choice, with its award, level, format, descriptions and application classification.
- **Catalog entry** retains an official school/college/interdisciplinary table label. `relationship` distinguishes majors, degree choices, doctoral research/thesis fields, partner variants, concentrations, internal thesis fields, combined groups and excluded Harvard awards. A field row is not another external application. The linked option and its application classification establish the actual target; a family name alone never establishes an award or policy.
- **Application route** identifies a real target/process. Shared first-year admission has multiple windows; undergraduate majors do not duplicate its requirements. Internal admission, external departmental entry and combined degrees remain distinct.
- **Fact** belongs to one primary domain group and carries scope, period, sources, independent publication/review status, origin, and conditions. `topics` indexes expressly present secondary topics in compound preserved evidence; it neither broadens applicability nor proves research completeness. `value` holds structured domain evidence or a bounded exact rule from earlier research. A condition states `when` and `effect`; optional `related_fact_ids` and `required_applicant_evidence` retain its relationship and implementation needs. This is data documentation, not an executable rule engine.

## Status and provenance

`publication_status` says whether the institution publishes a fact: `published`, `not_published`, `unknown`, or `conflicting`. `review_status` independently says whether our work verified it: `verified`, `carried_forward_review`, `needs_review`, `conflicting`, or `superseded`. A current HTTP check does not upgrade an earlier content review. `checked_at` remains the fact review date; `origin` identifies live review versus preserved checkpoint/research. Source `access` records reachability separately. Unknown/conflict records require reasons and an official next step; uncompleted collection stays in coverage and is never disguised as not published.

The dated candidate/evidence files are historical research inputs, not a second supported runtime schema. Their original dates and unresolved notes remain intact. New facts should be normalized into the main draft and cite the original review where reused. Do not edit an old date to make copied evidence look freshly verified.

`superseded_reason` and `related_fact_ids` retain resolved earlier statements without treating them as current policy. Imported `unassessed_published_minimums` and runtime funding-track metadata remain traceable inputs; evaluation readiness is distinct from university publication. Superseded paid/grant display tracks are not official alternative admissions. Editorial research assignments are historical notes, never current published university rules; retain their closure reason and links to the resolving policy or evidenced unknown. Shared application procedures require concrete facts with explicit applicable route/level scopes; a text reference to another program does not transfer its eligibility, GRE, funding or format. New contributions should use clear domain values and conditions, following the filled example and current facts rather than extending those historical UI fields.

Scope dimensions intersect: if both option and route IDs are supplied, the fact applies to that option within the route, not every option on the route. Multiple options/routes usually identify alternatives; the published condition specifies any prerequisite or combined sequence. Level-only institution facts have explicit boundaries and exceptions. In particular, DEDP's no-prior-degree policy overrides the ordinary graduate bachelor-equivalent requirement; non-standard tuition, internal awards, English-test exceptions and funded offers never inherit another programme's promise.

## Adding evidence

1. Read the actual official MIT page or MIT-hosted PDF. Add its exact URL/title and dated access result to `sources`; content review and HTTP success are separate.
2. Choose the correct option, route, level, applicant category and period. Empty option/route arrays mean scope is established by the other explicit dimensions, not all programs by default. Conditions and linked facts further narrow scope.
3. Store the published rule without inventing a cutoff, deadline, qualification decision or funding award. Keep SAT/ACT presence separate from no published cutoff; required exam alternatives separate from numeric minima; admitted distributions separate from prerequisites.
4. Save alternatives, waivers, exceptions, test age/scale/section evidence and applicant prerequisites. Explain what each changes. Preserve significant narrative policy even when applicant fields or assessment logic are missing.
5. Distinguish admissions preparation from curriculum/degree completion. Store costs with currency, charge type and billing period; estimates and one-time fees remain separate. Aid consideration is not a confirmed award. Future-cycle prices are not copied from old years.
6. For conflict/unavailable evidence, cite exactly what was reviewed and the next official step. Do not infer permanent residence, immigration category, domestic fee status or aid eligibility from citizenship/current residence.
7. Update coverage from evidence and run direct draft checks plus the required runtime audit. A passing validator cannot establish research completeness.

The [route coverage index](route-coverage.json) separates direct evidence, conditional common references and bounded public-checklist omissions. Its aggregate `mixed_published_and_unresolved` status requires both published and unresolved evidence; a cell containing only unknown facts remains `unknown`. It describes a group of multiple facts, not another atomic publication status. A bounded omission is an unknown with reviewed source and next step, never a promise that an interview cannot occur. The index date does not upgrade referenced content-review dates.

The filled [example](template.json) covers shared undergraduate entry, STS, BCS MEng, MSMS, unresolved Materials Engineer and DEDP's qualification exception. Preserve the actual relationships and conditions when adding facts, rather than copying every MIT field into another institution.

See [coverage.md](coverage.md) for inventory, sources, verification and Stage 2 handoff. From repository root on Windows run `backend/.venv/Scripts/python.exe -X utf8 backend/data/drafts/mit/validate.py` (use the corresponding environment interpreter elsewhere), then `npm run audit:data`. The focused validator checks this schema's actual keywords, references and reconciliation; it is not a generic schema package or a research-completeness test.
