# UniSearch Admissions Product Model

## Purpose

UniSearch helps applicants discover relevant fields of study, identify the real application route that fits their situation, and make a decision using current, traceable admissions facts. The product is organized around the applicant's intended subject and route, rather than treating a university as if it had one universal set of requirements.

This document defines the target product and data model for the top-five migration: MIT, Imperial College London, Stanford, Harvard, and Oxford. The top-five inventory should cover the official catalog of degree-level study options across undergraduate, master's, doctoral, and professional study. It is a product contract and migration direction, not a claim that the current backend or frontend already implements it, or that the current catalog's records are complete.

## Applicant-facing model

The applicant moves through four connected concepts:

1. **Discovery subject** — a broad subject or specialty the applicant wants to explore, such as computer science, economics, or biomedical engineering. This is a search and discovery concept. It may map to multiple programs and does not itself imply an application route.
2. **Study option** — an institution's actual course, degree, major, or other study offering, with a level and mode such as undergraduate, master's, doctoral, or professional study. Use the institution's own course name and structure. Include institution-wide undergraduate majors as study options when they are part of the official catalog, while marking whether they are chosen before admission, after admission, or not applicable to the route.
3. **Application route** — the real admissions path for a person seeking that option: for example first-year undergraduate, transfer, taught master's, research doctorate, or a professional program. A route captures the application destination and process. One route can serve several study options where the institution officially says the application is shared; a study option can have a distinct route when the institution requires it.
4. **Applicant context and intake** — the facts that determine how a route applies: applicant category, intended entry term/year, cycle, and, where published, an application window. Examples of categories include first-year versus transfer and domestic versus international. Fee status (such as Home or Overseas) is a separate context and must not be inferred solely from nationality. [Imperial: fee status](https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/fee-status/).

The user should be able to discover by subject, then understand which study options and routes are relevant to them. A university card or profile may summarize the institution, but requirements and costs must be shown in the context of the selected route, study option, applicant category, fee status, and intake.

## Scope and relationships

Keep these entities distinct even when an institution uses overlapping terminology:

| Concept | What it represents | Example distinction |
| --- | --- | --- |
| Subject | Applicant's discovery intent | “Computer science” can lead to several courses and degree levels. |
| Study option | What the applicant would study | A named BSc, MSc, DPhil, or professional credential. |
| Application route | How an application is submitted and assessed | First-year admission may be university-wide; a graduate course may have its own application. |
| Applicant category | Which application rules apply to the person | First-year and transfer applicants can have different eligibility and forms. |
| Intake / admissions cycle | The entry period and applicable cycle of published rules | A course's 2027-28 entry information must not be presented as current for another cycle. |
| Application window | A published submission option within a route and cycle | Early Action and Regular Action can have different policies; an MBA may label its windows Round 1 and Round 2. A deadline is a dated event within a window, not the window itself. |

Model institutional relationships as the source describes them. Do not force every subject into exactly one program, every program into exactly one application form, or every university into one admissions route. Do not treat a suggested major, department, or interest as an application target unless the institution says it is one.

For catalog completeness, inventory official degree-awarding courses/programs and undergraduate majors or concentrations that determine what a student can study. Keep a track or concentration as a variant of its parent option when it has no separate degree or application process. Individual classes, minors, and general-interest topics are not degree-level study options. Record the official catalog page and inventory date for each university so that “all options” refers to a checkable catalog snapshot, not an unsupported completeness claim.

The applicant journey is discovery → identify the actual application target and applicable path → check eligibility and submit the required application or assessments → receive a decision or offer → meet any published conditions and enroll. These stages differ by institution and route; show only verified steps relevant to the selected context. Funding may be considered automatically or require a separate process before or after an admission decision. This is factual guidance, not a personal task tracker or application-plan feature.

## Facts and provenance

Requirements, application steps, deadlines, costs, and funding are separate fact groups. Do not combine them into a generic “admissions requirements” blob or a single cost figure.

- **Requirements and eligibility:** retain the qualification, subject prerequisite, score, document, test, interview, portfolio, or other condition and the population or route to which it applies. State when a requirement is minimum eligibility versus competitive guidance.
- **Application process:** retain the application destination, steps, required documents, and any route-specific process notes.
- **Decision and enrollment:** retain published offer types, response and condition deadlines, deposits, and enrollment steps where they apply. Do not infer one country's post-offer process for another institution or route.
- **Deadlines:** distinguish application completion, test, portfolio, financial-aid, scholarship, and studentship deadlines. Preserve application window, date, time, and timezone where the official source provides them. Record whether a deadline is published, explicitly not applicable, or not found.
- **Costs:** distinguish tuition, mandatory fees, living-cost estimates, and one-time charges. Every amount needs currency, amount period, study option or route scope, intake/cycle, and applicable fee status where relevant. Do not treat cost of attendance and tuition as interchangeable.
- **Funding:** distinguish scholarships, grants, assistantships, studentships, and loans. Capture eligibility, application route (automatic consideration or separate application), coverage, relevant deadline, and renewal conditions when published. Potential funding is not an award granted to an applicant.
- **Computed values:** UniFit and UniChance outputs remain derived product estimates. They must not be represented as official facts, guaranteed admission probabilities, verified eligibility, or awarded funding.

Every significant fact needs provenance, publication status, and a review state. At minimum, store:

- the official source URL (university page or university-hosted admissions document);
- the source title or document name when available;
- whether its value is officially published, explicitly not yet published, not applicable, or unknown because collection or sources are incomplete;
- whether the source and scope have been checked or still need review;
- the date it was checked (`checked_at`), and cycle/effective period when applicable.

Publication and review are independent: an official statement that a date is not yet published can be verified, while a published value may need rechecking for a new cycle. Do not label an unsearched or unconfirmed value “not published.” Do not fill an unknown with zero, a guessed deadline, a presumed ineligibility, or a university-wide default. When a critical value is unavailable, show the uncertainty and the official next step, such as contacting the named admissions office or checking the route page.

Only use official university sources and university-hosted admissions PDFs, in line with `AGENTS.md`. If an official source contradicts another official source, record the ambiguity and seek a route-specific resolution; do not silently choose the more convenient value.

## Why institution-wide assumptions fail

These official examples illustrate why discovery intent, study option, application route, and cycle must not be collapsed:

- **MIT undergraduate admission:** MIT says first-year applicants apply for general admission to the university, list a course/field of interest that does not affect admission decisions, and choose a major after the first year. MIT's official majors still belong in its study-option inventory, but they are post-admission study options rather than separate first-year application targets. [MIT Admissions: Do students apply to a specific major?](https://mitadmissions.org/help/faq/majors/) and [MIT Admissions: Majors & minors](https://mitadmissions.org/discover/the-mit-education/majors-minors/).
- **Stanford undergraduate admission:** Stanford also evaluates first-year applicants for the university as a whole, not a particular major, school, or department; a prospective major on the application is not binding. [Stanford: Application and Essays](https://admission.stanford.edu/apply/first-year/apply.html).
- **Oxford undergraduate admission:** Oxford's application guidance says applicants apply through UCAS, can apply to only one Oxford course, and must submit by the published undergraduate deadline. Here the chosen course is a real application target, and its course-specific requirements must not be reduced to an institution-wide rule. [Oxford: UCAS application](https://www.ox.ac.uk/admissions/undergraduate/applying/guide-for-applicants/ucas-application).
- **Oxford graduate admission:** Oxford says graduate deadlines vary by course; multiple deadlines can represent separate consideration stages, and some courses use a separate application process. The relevant course page determines the route's current deadlines and application status. [Oxford: When to apply and deadlines](https://www.ox.ac.uk/admissions/graduate/application-guide/starting-your-application/when-to-apply).
- **Imperial integrated master's:** Imperial lists Computing MEng as an undergraduate course with a UCAS code. The qualification label “MEng” alone does not make its application a postgraduate route. [Imperial: Computing MEng](https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/).
- **Professional-program rounds:** Harvard Business School names Round 1 and Round 2 application dates for its MBA. A round is a published application window, not a separate field of study or a universal admissions concept. [HBS: MBA application dates](https://www.hbs.edu/mba/admissions/application-dates).

These examples are structural counterexamples, not a complete or permanent policy record. For live applicant guidance, verify the current official route page and applicable cycle.

## Illustrative data contract

The following JSON shows the relationships and provenance expected in the target model. It is intentionally a compact contract example, not a proposed final storage file, exhaustive schema, or statement that these records already exist. Identifiers and cycle values are illustrative. The MIT record demonstrates a university-wide first-year application target linked to a major chosen after admission. Implement the smallest shape that the inspected code and pilot data require.

```json
{
  "institution_id": "mit",
  "subjects": [
    {
      "id": "computer-science",
      "name": "Computer science"
    }
  ],
  "study_options": [
    {
      "id": "mit-course-6-3",
      "name": "Computer Science and Engineering",
      "level": "undergraduate",
      "selection_timing": "after_institutional_admission",
      "subject_ids": ["computer-science"]
    }
  ],
  "application_routes": [
    {
      "id": "mit-first-year",
      "study_option_ids": ["mit-course-6-3"],
      "applicant_categories": ["first_year"],
      "application_target": { "kind": "institution", "id": "mit" },
      "application_destination": "MIT undergraduate application",
      "intakes": [
        {
          "cycle": "illustrative-2027-entry",
          "entry_term": "fall",
          "application_windows": [
            {
              "id": "regular_action",
              "name": "Regular Action",
              "deadline_fact_ids": ["mit-regular-application"]
            }
          ]
        }
      ]
    }
  ],
  "facts": [
    {
      "id": "mit-regular-application",
      "kind": "application_deadline",
      "scope": {
        "application_route_id": "mit-first-year",
        "application_window_id": "regular_action",
        "cycle": "illustrative-2027-entry"
      },
      "publication_status": "unknown",
      "review_status": "needs_review",
      "value": null,
      "next_action": "Check the official deadline page for this entry cycle",
      "source": {
        "url": "https://mitadmissions.org/apply/firstyear/deadlines-requirements/",
        "title": "Deadlines & requirements"
      },
      "checked_at": null
    }
  ]
}
```

For a course-specific route, `application_target` refers to the actual course/program and its application destination. Funding opportunities are separate records linked to their applicable routes and study options, because their process and deadlines can differ from admission. A fact record should carry enough context to answer: **which route or option, which applicant category, which fee status if relevant, which cycle/window, what value or status, and which official source was checked when?** Do not duplicate institution-level facts into each course where the source defines one shared route; represent the shared scope once and link the applicable options.

The final schema may use a different nesting or field names. It must preserve these distinctions and permit multiple official sources and multiple cycle-specific facts when reality requires them. Avoid adding a generic rule engine, speculative compatibility layers, or unused optional fields before the top-five cases demonstrate a need.

## Applicant interface implications

The interface should make the context legible before showing a fact:

1. Let the applicant search or browse by subject/specialty and narrow by study level and location as those filters become available.
2. Show study options with their actual award/course name and level. Make clear when a subject is an interest for discovery rather than a route the institution admits against.
3. Ask for or state the applicant category that determines the route. If the choice is not known, show the alternatives or mark applicability as unknown instead of selecting a default.
4. Show the route and application destination, followed by the intake/cycle and relevant application window. Keep official requirements, application deadlines, funding deadlines, costs, and funding in distinct sections. Show post-offer conditions only when published for this route.
5. For each key fact, make source and checked date available. Distinguish a published value, confirmed lack of publication, and review needed in plain language. Link to the specific official page or PDF.
6. Never imply a verified chance of admission or a guaranteed award from an estimate. Explain what evidence or applicant details would be needed for a more useful estimate.

Follow the established Calm Academic Workspace and localization rules in `AGENTS.md` when these implications are implemented. This document defines product meaning, not a new visual system.

## Delivery sequence

Keep product direction and execution order explicit:

### Phase 1 — top-five data and schema

1. Build the top-five university inventories first: MIT, Imperial College London, Stanford, Harvard, and Oxford.
2. Inventory all degree-level study options in each university's official catalog across undergraduate, master's, doctoral, and professional study. Map their subjects, application targets, routes, applicant categories, cycles/rounds, and fact scopes from official sources. Record when an option is post-admission or is not itself an application target. Do not present the currently represented records as a complete inventory without checking each official catalog.
3. Draft and review the target data contract against real cases before building broad abstractions. Mark missing or conflicting official facts honestly.
4. Publish a canonical, legacy-free schema and example template for data contributors. Agents may add or consolidate fields in the draft schema as real official facts require, documenting their scope and an example. Existing API or frontend compatibility must not block draft data entry; integration checks belong to Phase 2.
5. If the target representation is incompatible with the live `backend/data/universities.json` readers, keep the canonical top-five draft outside the active runtime data path until the backend and frontend migration is ready. An illustrative location such as `docs/data-drafts/top-five-admissions.json` is not an established repository path; inspect current conventions and choose the actual draft location during implementation.
6. Do not partially replace active records in a way that makes the current app misread them. The draft can be authoritative for the planned model without becoming runtime input prematurely.

### Phase 2 — backend and frontend

After the top-five model and records have been reviewed, migrate backend loading, API contracts, frontend rendering, and any affected search/scoring consumers together. Present the route and scoped facts accurately in applicant journeys. Compatibility is a migration choice, not a permanent requirement: no legacy compatibility reader is required long term. Avoid breaking the current app midway; switch runtime data and consumers as a coordinated change, then remove obsolete paths once no longer needed.

Verify that the API and UI resolve each selected study option to the correct application target, do not leak a fact across routes or cycles, distinguish admission from funding deadlines, and preserve unknown states. Test representative institutional, course-specific, graduate, doctoral, professional, and post-offer cases before the top-five data becomes public runtime guidance.

### Phase 3 — remaining 45 universities

Once the top-five implementation provides a proven pattern, migrate the other 45 institutions to the new model while refreshing their facts from official sources. Treat these as drafts until each route and scoped fact is reviewed; do not copy top-five assumptions, old unverified values, or institution-wide defaults across the catalog. Prioritize accurate route coverage and source freshness over filling every field.

Contributors may extend and reconcile the canonical template during this draft collection without updating the backend or running UI tests for each new field. Before publication, integrate every accepted field into the API and UI, audit links and fact scopes, and run the relevant contract and applicant-journey checks once for the combined change.

The sequence is data/schema first for the top five, application integration second, then the remaining 45 data migrations with fact refresh. Backend and frontend rework follows the top-five model rather than leading it.

## Acceptance criteria

The direction is ready to implement when:

- a user can understand that subject search is for discovery and can lead to more than one actual study option or application route;
- the top-five records inventory degree-level study options across undergraduate, master's, doctoral, and professional study based on official catalogs, with coverage gaps explicitly identified;
- MIT's official undergraduate majors can be inventoried as post-admission study options without pretending an intended major is the first-year admission target;
- Oxford undergraduate course-specific selection and Oxford graduate course/deadline variation can be represented without a university-wide default;
- the model separates study option, application route, applicant category, intake/cycle, and deadline round where the official process distinguishes them;
- requirements, application deadlines, funding deadlines, costs, and funding remain distinguishable and properly scoped;
- every verified fact can be traced to an official source and checked date, while not-published and needs-review states remain explicit;
- cycle-specific values cannot silently appear as current for a different cycle, and amounts are not detached from currency, period, or applicable fee status;
- the top-five target data can be reviewed outside active runtime data if the current readers cannot yet consume it safely;
- the coordinated backend/frontend migration has a clear point at which the new top-five model becomes runtime data, without requiring a permanent legacy reader;
- the later 45-university migration is treated as a fact refresh and scope review, not only a mechanical shape conversion.

## Official references

- [MIT Admissions — Do students apply to a specific major?](https://mitadmissions.org/help/faq/majors/)
- [MIT Admissions — Majors & minors](https://mitadmissions.org/discover/the-mit-education/majors-minors/)
- [Stanford Undergraduate Admission — Application and Essays](https://admission.stanford.edu/apply/first-year/apply.html)
- [Oxford — UCAS application](https://www.ox.ac.uk/admissions/undergraduate/applying/guide-for-applicants/ucas-application)
- [Oxford — When to apply and deadlines](https://www.ox.ac.uk/admissions/graduate/application-guide/starting-your-application/when-to-apply)
- [Imperial — Computing MEng](https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/)
- [Imperial — Fee status](https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/fee-status/)
- [Harvard Business School — MBA application dates](https://www.hbs.edu/mba/admissions/application-dates)
