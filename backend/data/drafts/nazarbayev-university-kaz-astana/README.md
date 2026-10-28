# Nazarbayev University rework

The user authorized Nazarbayev University's rework on 2026-10-23, including necessary exams and model extensions. On 2026-10-24, the user assigned the entire remaining research, implementation and verification to the three owner chats and requested stronger model/reasoning settings. Follow [the complete work plan](work-plan.md); it replaces the earlier instruction to stop at a first Stage 1 handoff. Paused Oxford, Harvard and Cambridge research remains paused. Research completion, evidence review and runtime activation remain separate verified milestones.

## Scope and ownership

[assignment.json](assignment.json) records the live official A-Z inventory snapshot: 93 cards, partitioned into three disjoint packets of 31. A card is an inventory reference, not proof of open recruitment, one external application or exactly one degree. Reconcile school catalogs and record additions, removals and variants with their evidence. Keep the assigned packet IDs; record newly discovered offerings in that packet's coverage without silently altering the shared assignment.

| Packet | Owned inventory and shared policies | Owned directory |
| --- | --- | --- |
| A | Foundation and all undergraduate cards; SOE master's and Robotics master's. Foundation/UG admission, funding consideration, transfer, mid-year, progression; institution overview and UG living/fee references. | `packet-a/` |
| B | Other master's cards, including graduate-entry MD; business, education, public-policy and health/social-science doctorates. Central master's policy and financial support; program-specific exceptions. | `packet-b/` |
| C | Technical research doctorate cards and all residency cards. Central PhD/residency admission, funding and fee policies. | `packet-c/` |

Each owner completes its original packet, then its implementation role in work-plan.md. A owns consolidated research and its draft contract; B owns backend/runtime integration, shared storage/API contracts, the checklist and final integration; C owns frontend, localization and browser verification. The file boundaries and staged transfer in work-plan.md replace the earlier packet-only editing restriction. Cross-packet shared policy references must identify their owner and exact applicability; they do not inherit all the owner's conditions. Do not duplicate a shared application for every degree. B activates NU only after reviewing A's complete, reconciled evidence and after consumers are ready.

## Deliverables per packet

- `research.json`: `schema_version`, `university_id`, `packet_id`, `runtime_active: false`, `inventory_entries`, `study_options`, `application_routes`, `facts`, `sources`, `gaps` and `cross_packet_refs`. Use documented institution-specific attributes where a significant fact needs them; do not discard facts to fit these headings.
- `coverage.md`: every assigned card reconciled to real offerings/routes, domain coverage, source-backed unknowns/conflicts, unfinished collection, additional offerings/variants, and checks actually run.
- `handoff.md`: research status, paths, counts, representative cases, concrete model/exam/UI extensions, and unresolved integration dependencies. Ordinary unfinished collection means continue working, not end the assignment with `needs_research`. Source-backed unpublished facts and conflicts may remain explicit without inventing a value. Record implementation and final verification milestones separately as specified in work-plan.md.

Use stable IDs prefixed `nu-a-`, `nu-b-` or `nu-c-` for packet-owned records. Source records retain exact URL/title and separate access/content-review dates and outcomes; a missing content-review status stays null. Facts retain their value, source IDs, checked date, independent publication/review status, program/route/applicant/cycle/fee scope, and significant conditions/exceptions. Scope dimensions intersect. Unknowns need evidence, reason and an official next step; unsearched material remains unfinished collection. Program descriptions and curriculum stay distinct from admission requirements. Keep monetary currency, billing period, source year, campus, tuition/fees/living estimates and funding coverage distinct.

Reuse existing reviewed draft conventions, examples and retained facts. Read AGENTS.md, docs/admissions-product-model.md, orchestrator.md and todo.md first. The existing three-institution integration schema is an analogue, not a constraint on NU evidence. Official source prose and program names retain their original language; repository documentation and identifiers are English. Discuss progress with the user in Russian.

## Stage 1 checks

Check JSON parsing, unique IDs, local references and all 31 assigned cards; resolve cross-packet references in the consolidated draft. Reuse existing validation tools where applicable. Record affected official URL reachability separately from substantive content review. Run audit:data after final draft changes and state that runtime auditing does not validate draft completeness. Research-only changes need no backend/UI suites; implementation and final verification follow AGENTS.md and work-plan.md. No commit, push, version bump, tag, release, deployment or additional chat/agent creation.

Run `python backend/data/drafts/nazarbayev-university-kaz-astana/validate_research_packets.py` from an activated `backend/.venv` to check packet assignment and references. The validator reports owner handoff statuses separately; an in-progress packet is not a structural failure.

## Consolidated research

`research-catalog.json` is the normalized, inactive catalog assembled from the three packet files. `research-catalog.schema.json` defines its record shape, and `research-catalog.example.json` shows a generated partial route/fact excerpt. From the repository root with `backend/.venv` active, run `python backend/data/drafts/nazarbayev-university-kaz-astana/build_research_catalog.py` to rebuild both files. The catalog fingerprints the assignment, each packet and each packet handoff. It keeps `research_status: in_progress` until all packet handoffs are ready and every linked record resolves; `ready_for_review` still means B's evidence review is pending, not runtime acceptance. See `data-handoff.md` for the current coverage and review state.
