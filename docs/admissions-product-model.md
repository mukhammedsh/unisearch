# UniSearch Admissions Product Model

## Purpose

UniSearch helps applicants discover relevant fields of study, identify the real application route that fits their situation, and make a decision using current, traceable admissions facts. The product is organized around the applicant's intended subject and route, rather than treating a university as if it had one universal set of requirements.

This document defines the target product and data model for all 50 universities. Inventory official degree-level study options across undergraduate, master's, doctoral, and professional study wherever offered. MIT is the first example of research depth, provenance, and completeness; each later university keeps its own academic and admissions structure. Shared representations cover genuinely shared concepts, not assumed MIT policies. This is a product contract and delivery direction, not a claim that the current code or catalog already fulfills it.

## Applicant-facing model

### Decision outcome

The primary outcome is a useful shortlist that an applicant can explain: what they could study, which application path applies, which published requirements their evidence meets or leaves unresolved, what the applicable cost is, and why an option matches their preferences. Kazakhstan applicants are a key audience; citizenship, education system, and qualification must remain separate so that studying abroad or holding multiple citizenships does not select the wrong rules.

The intended journey is optional profile or manual context → relevant study options and a reasoned shortlist → actual application target and applicable route → scoped requirements, dates, costs, and funding. A university dossier supports that decision. Catalog size and coverage badges alone do not establish that the journey works.

Reuse verified facts and useful implementation already present in the checkout. During data collection, describe how each institution connects discovery, study options, and applications; review contrasting structures with draft records rather than implementing a new UI for every field. Backend/frontend integration and real journey verification follow acceptance of the active delivery batch: the first ten for the presentation milestone, then the remaining forty later. A full codebase rewrite is not a prerequisite.

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

- **Institution and study information:** retain applicant-relevant location/campus, teaching language, award, format/duration, study content/structure, housing/student support, and officially published career information. Distinguish curriculum and degree-completion requirements from admission prerequisites; scope program-specific information to the actual study option.
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

Retain significant exceptions, exemptions, alternatives, conditional requirements, and restrictions together with the condition, affected fact, applicable scope, and source. Extend or reorganize the draft schema when a real fact does not fit. Technical implementation difficulty is never a reason to omit it. Separate publication of a rule from automatic assessment of an applicant: a rule can be fully documented while its assessment remains unresolved. In the integrated product, show the exact condition, whether it applies to the selected program/applicant/cycle, and what profile evidence is missing; no hidden rejection checks are permitted.

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

The following JSON illustrates relationships and provenance, not a final storage file, exhaustive schema, or mandatory template for every university. Identifiers and cycle values are illustrative. This MIT example links a university-wide first-year application to a major chosen after admission; another institution can organize those relationships differently. Stage 1 develops the draft schema from researched facts and applicant questions without being limited by the existing runtime's fields.

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

The final schema may use different nesting or field names and institution-specific structures. It must preserve these distinctions and permit multiple official sources and multiple cycle-specific facts when reality requires them. Maintain documented common conventions for IDs, provenance, scope, statuses, and relationships so the application can read all institutions; do not impose one institutional layout or create 50 unrelated, undocumented formats. Add structures for demonstrated facts, without a speculative rule engine, unused fields, or permanent compatibility layers.

## Applicant interface implications

### Reuse the existing profile

The profile already collects and persists the following context, and `frontend/javascript/utils/persistence.js` sends it to the API. A field being accepted by the API does not prove that route filtering, scoring, or every detail section uses it.

| Existing input | Required use in the journey |
| --- | --- |
| Citizenship(s) | Review explicitly nationality-dependent route or aid rules; retain unknown applicability when other legal criteria are missing. |
| Country of education and credential/curriculum | Select matching qualification guidance and subject/grade rules; exam scores alone do not establish recognition of the qualification. |
| Applicant route (`first_year`, `transfer`, `graduate`) | Narrow the actual application paths, their requirements, and relevant dates. |
| Intended entry cycle | Select facts for that cycle; identify yearless, conflicting, or unavailable information explicitly. |
| Current country of residence | Use only where an official rule depends on residence. It does not establish immigration or permanent-resident status. |
| Self-reported fee status | Show the appropriate fee context where applicable, with its self-reported status; do not treat this global hint as a confirmed classification by every university. |
| Study level, subject, exams, languages, and GPA | Identify relevant options and compare evidence against scoped requirements. |
| Budget and preferences | Explain affordability and preference fit using the selected option's known costs; potential aid is separate from awarded aid. |

Use populated profile values without asking the same questions again. Let a visitor choose or override the context for an individual university without rewriting their general profile. Ask only for a missing detail that changes applicability; otherwise show the unresolved state and official next action. If a route depends on a legal status the profile does not hold, do not infer it from nationality or current residence.

One selected context must govern the program-to-admission transition, requirements, dates, finance, qualification guidance, and the estimate summary. Manual selection must be restorable after reload or opening a supported link, and a profile update must not leave a stale summary from another program or level. Keep fact groups distinguishable within that context; a particular tab count or page layout remains an implementation decision.

### Detail-page context contract

The field names and URL parameters below document the existing implementation as a starting point. Stage 2 may change them and their readers together when the reviewed draft model requires it; they do not constrain Stage 1 data collection. Avoid compatibility layers solely for unused early-development formats. Any actual retained profile or selection must be deliberately migrated or visibly reset rather than silently reinterpreted.

The detail page uses local URL overrides before a supported saved program selection and profile defaults. Selecting a program does not change the general profile. Supported query parameters are `admission_program` (a catalog program ID), `admission_level` (the applicable level key), `admission_route` (`first_year`, `transfer`, or `graduate`), and `admission_cycle` (the source cycle or an explicit entry year/term). Reload and browser history restore these overrides. Invalid identifiers must not create an application target or an estimate.

For example, `university.html?id=mit-usa-cambridge&admission_program=mit-course-6-3-bachelor&admission_level=bachelor&admission_route=first_year&admission_cycle=Fall%202027` opens the reviewed MIT undergraduate interest in its first-year context. The interest remains distinct from the institutional application target.

The request-local profile uses the existing `study_level`, `applicant_route`, `intended_entry_cycle`, and `selectedAdmissionChoices[university_id].programId` fields. A program-only selection is valid and does not require an invented `choiceKey`. Estimates and ranking exclude explicitly incompatible linked programs, levels, routes, and cycles. Missing scope metadata remains unresolved; it does not prove eligibility. An academic-year range does not automatically establish an entry cycle.

Costs from another explicitly dated academic year may be shown as source-labelled references, but must not appear as a confirmed current-cycle price. Missing amounts remain unknown; a published zero remains zero. This context integration does not calibrate admission probabilities or change ranking weights.

The interface should make the context legible before showing a fact:

1. Let the applicant search or browse by subject/specialty and narrow by study level and location as those filters become available.
2. Show study options with their actual award/course name and level. Make clear when a subject is an interest for discovery rather than a route the institution admits against.
3. Ask for or state the applicant category that determines the route. If the choice is not known, show the alternatives or mark applicability as unknown instead of selecting a default.
4. Show the route and application destination, followed by the intake/cycle and relevant application window. Keep official requirements, application deadlines, funding deadlines, costs, and funding in distinct sections. Show post-offer conditions only when published for this route.
5. For each key fact, make source and checked date available. Distinguish a published value, confirmed lack of publication, and review needed in plain language. Link to the specific official page or PDF.
6. Never imply a verified chance of admission or a guaranteed award from an estimate. Explain what evidence or applicant details would be needed for a more useful estimate.

The reviewed detail-page layout puts the selected program/route/cycle before requirement facts and provides the relevant official application link with deadline and cost actions. Catalog coverage and historical statistics remain expandable. When a numerical fit is available alongside textual conditions, explicitly state that subjects, grades, documents and other eligibility conditions need separate review. A localized program title must not replace its stable ID in saved selections or API requests.

Program summaries must distinguish a collected catalog entry from a researched study description. A title and study level alone do not establish that curriculum or program facts are unavailable from the university. Show the official program source and identify an incomplete summary when details have not been collected. Keep curriculum and degree-completion requirements separate from applicant admission requirements; institution-wide admission remains shared even when the study option has a detailed curriculum.

Funding records can declare `applicant_routes` when their verified applicability is route-specific. Filter a record only for a known incompatible route; absent route metadata does not establish ineligibility. If no award is catalogued for the selection, say so without implying that the applicant cannot receive aid and use the applicable category's `funding_source_url` for an official next step where available.

Browsing and manual selection must work without an account or completed profile. A visitor can choose a study option, applicant category, route, and intake to read applicable official facts. A profile may narrow choices and improve estimates, but missing profile fields must leave applicability or UniChance unknown/low-confidence rather than silently choose an applicant category, exam, or funding status.

An exam is evidence used by a route, not necessarily a separate application route. A university may accept SAT or ACT through the same first-year application; another program may require a distinct assessment or application. Funding is a related decision after the applicable admission path is known. A grant, assistantship, or self-funded outcome may add its own eligibility, documents, dates, or costs, and should become a separate admission route only when the institution actually uses a separate admission process.

UniFit should compare preferences, subject fit, affordability, and applicable routes. Any academic estimate used by ranking must belong to that context and have a disclosed evidence basis. It must not maximize over routes the applicant cannot use, treat a funding outcome as a second admission chance, or turn an estimate without matching evidence into a verified probability. A guest can still compare official program and route facts manually.

### Scoring meaning and unresolved decisions

- **UniFit:** personalized suitability ranking. Compare the profile's annual USD budget with the selected route's applicable annual USD cost. A known price above budget lowers the recommendation without hiding it. An unknown price remains unknown, and a possible grant is not subtracted before an award is confirmed. The finance-versus-prestige preference is a separate input. A dated price from another entry cycle cannot establish current affordability; a published zero remains a known zero.
- **UniChance direction:** retain a 0–100 percentage, provisionally under the UniChance name, for the share of evaluable published academic and language minimum checks the applicant meets on the selected admission path. This is a requirements match, not a probability of admission, a share of all holistic admission criteria, or a funding prediction. Missing required evidence, a route whose minima have not been reviewed, or a route with no measurable published minimums produces no percentage; the last two states must have distinct explanations. Published minima that the profile cannot assess, such as MIT Course 6-9P's separate technical and overall GPA thresholds, also produce no percentage. An unmet known minimum can produce a real zero. Admitted-score distributions and acceptance rates remain separately labelled context; neither generates or adjusts this percentage. A probability claim requires calibration against real application outcomes in the same scope.
- **Unknown evidence:** preserve no-data states in the API, presentation, and ranking. If a route has no requirements-match percentage, omit that component from its ranking score and normalize the remaining available components; disclose that academic evidence did not inform the order. Never substitute a neutral 50%, treat missing evidence as a pass or fail, or display it as zero.
- **Funding:** review affordability and award applicability separately from admission. A paid or grant outcome is not another admission chance unless a genuinely different admissions process exists.
- **Interest matching:** the current semantic ranking is university-level. Do not claim that it recommends or estimates a particular course until the selected course and its applicable route are used end to end.

UniFit uses a lower-is-better score. Preference mismatch and requirements gap have weights 0.60 and 0.40 when semantic matching is unavailable; with university-level semantic matching they have weights 0.35 and 0.30, with semantic gap at 0.35. When both a positive annual budget and applicable annual cost are known, affordability gap is `max(0, 1 - budget / cost)` with weight 0.20; a known cost within budget, including published zero, has gap zero. Missing requirements or cost omits that component, and the weighted sum is divided by the sum of available weights. Published cost ranges contribute only when the whole range is within budget or its minimum is above budget; otherwise affordability is unresolved. Existing missing-program and negligible-semantic-match penalties remain. The score is a ranking aid, not a probability or a guarantee that an applicant qualifies or receives aid.

The final UniChance name, whether a probability can later be supported by outcome data, and future calibration of the ranking weights remain open product decisions. Before changing weights, check representative cases: a known price just above budget must rank lower than the same option within budget; missing cost must not become zero or a grant-adjusted price; a missing academic match must not become an invented 50%; and paid/grant funding on one application path must not create different admission assessments. Do not select new weights solely to produce attractive percentages.

Follow the established Calm Academic Workspace and localization rules in `AGENTS.md` when these implications are implemented. This document defines product meaning, not a new visual system.

## Delivery sequence

This sequence replaces the previous journey-first/top-five integration gates. Existing implementation and research are inputs to reuse, not work to repeat. Complete the agreed task's stage and report its handoff; do not automatically start the next stage.

### Stage 1 — data and schema for the first-ten milestone

**1.1 MIT:** reconcile existing research, drafts, and runtime facts, then complete the dated official degree-level inventory and applicant-relevant fact groups. Include institutional information, study descriptions/structure, real application targets, applicant categories, qualifications, tests, exemptions, prerequisites, documents, process, dates/windows, costs, funding, and published decision/enrollment conditions. Capture all significant found conditions and exceptions with their scope and provenance. Revise the draft schema and MIT example as needed; keep them outside active runtime data. No backend/frontend integration or browser/user UX gate belongs in this task.

Completion means the official catalog snapshot is reconciled, each option has a verified application classification or an evidenced unresolved classification, and each applicable fact group has researched facts or a documented gap/status and official next step. Unsupported fields in the current runtime must not limit collection. The scope is information needed to understand the university, choose a degree, and apply; it is not every class, news item, or page on the institution's website. Missing future-cycle publications or contradictory official sources can remain explicit unknowns after documented research. Unsearched groups remain collection tasks.

**1.2 Other institutions:** research each institution independently to the same evidence and coverage standard. Complete the first ten universities in the project's local catalog ordering, regardless of gaps in published rank numbers, before their Stage 2 integration and Stage 3 presentation milestone. Research the remaining forty in a later delivery cycle. Review each institution's own catalog, applications, conditions, exceptions, costs, and funding. Change its draft structure and the shared conventions where real differences require it; do not force an MIT schema or copy MIT policies. Record coverage and unresolved facts per institution. All ten datasets in the presentation batch must pass the Stage 1 evidence/structure review before its Stage 2 starts.

During Stage 1, design the relationships and intended applicant answers alongside the data. Use concrete draft examples to check that shared applications, course-specific targets, internal degrees, integrated master's entry, and program-specific exceptions can be represented. This is data/model review, not implementation. Lightweight draft validation may check IDs, references, status/scope, and schema consistency; the runtime audit alone does not validate draft files it does not read. Keep authoritative research in durable draft files rather than only temporary local notes.

### Stage 2 — coordinated backend and frontend integration

1. Establish the reviewed storage/API contract from the first ten draft datasets. Update loaders, schemas, projections, search, profile evidence, scoring, and frontend consumers together; reuse working components wherever they fulfill the contract. Extend the contract for verified institutional differences when integrating the remaining forty later.
2. Support required exams across selection, input validation, persistence, API, assessment, and explanations. Represent sourced alternatives, waivers, and other conditions explicitly. Collecting a difficult rule in Stage 1 does not require inventing a numeric automated check: when evidence cannot establish it, show the rule and the unresolved assessment with missing evidence and the official next step.
3. Use one selected program/target/route/applicant/cycle context across facts, recommendations, deadlines, costs, and funding. Every applied ranking or restriction condition must be explainable from that context and the applicant's evidence. Keep non-numeric conditions visible alongside the limited UniChance minimum-check percentage.
4. Switch the reviewed first-ten batch to the new runtime format in one coordinated cutover after its readers and consumers are ready. Do not claim reviewed new-format coverage for the remaining forty; determine and verify their interim presentation before cutover. Remove obsolete format readers and unnecessary institution-specific branches when their consumers are retired; no permanent dual-format support is required. Handle retained profile/selection state deliberately.
5. Verify the integrated contracts and representative journeys, including MIT first-year/transfer/internal MEng/professional/doctoral routes, Imperial Computing undergraduate-entry UCAS, and Stanford CS institutional admission. Include unknown, incompatible, incomplete-profile, and source-conflict cases. Fix contract failures before handing the product to Stage 3.

### Stage 3 — complete UI/UX and final verification

Make the integrated information understandable and usable across discovery, programs, applications, requirements, dates, costs, and funding. Refine layout, navigation, explanations, sources, and loading/empty/error states using the existing design system. Implement a coherent applicant journey rather than disconnected program and admissions views; a full redesign or a particular tab count is not required.

Exercise real guest, populated-profile, and incomplete-profile journeys; context changes, profile updates, reload/back navigation, and saved selection; English/Russian, desktop/mobile, light/dark. Include representative institutions beyond the first five and institution-specific exception cases. Review concrete usability findings with the user, complete applicable checks, and report factual unknowns separately from unfinished implementation. User UX review happens here and does not block Stage 1 research.

Track acceptance, progress, and the first-ten presentation milestone in [todo.md](../todo.md). [orchestrator.md](../orchestrator.md) defines task boundaries and handoffs. The remaining forty follow in a later delivery cycle with the same quality standard. A future feature, new scoring name, probability model, authentication, or database-engine migration is not a prerequisite for this work.

## Acceptance criteria

The first-ten presentation milestone applies these criteria to its reviewed batch; the eventual fifty-university product must meet them across the full catalog:

- a user can understand that subject search is for discovery and can lead to more than one actual study option or application route;
- all 50 institutions have dated official degree-level inventories across their offered study levels, with researched coverage and remaining factual gaps explicitly identified;
- MIT's official undergraduate majors can be inventoried as post-admission study options without pretending an intended major is the first-year admission target;
- Oxford undergraduate course-specific selection and Oxford graduate course/deadline variation can be represented without a university-wide default;
- the model separates study option, application route, applicant category, intake/cycle, and deadline round where the official process distinguishes them;
- requirements, application deadlines, funding deadlines, costs, and funding remain distinguishable and properly scoped;
- significant exceptions and conditional rules are retained and displayed; an applicant can see the condition, its applicability, and the missing evidence instead of encountering an unexplained restriction;
- every verified fact can be traced to an official source and checked date, while not-published and needs-review states remain explicit;
- cycle-specific values cannot silently appear as current for a different cycle, and amounts are not detached from currency, period, or applicable fee status;
- each institution's actual structure is preserved within documented storage conventions; MIT's structure is not imposed on other institutions;
- each delivery batch is reviewed outside active runtime data before its coordinated integration, without backend/frontend work for every collected field;
- the coordinated backend/frontend cutover supports all 50 institutions and removes obsolete runtime readers without requiring permanent legacy compatibility;
- representative real journeys verify usable, localized explanations and consistent context, rather than relying on catalog counts or test totals as proof of completeness.

## Official references

- [MIT Admissions — Do students apply to a specific major?](https://mitadmissions.org/help/faq/majors/)
- [MIT Admissions — Majors & minors](https://mitadmissions.org/discover/the-mit-education/majors-minors/)
- [Stanford Undergraduate Admission — Application and Essays](https://admission.stanford.edu/apply/first-year/apply.html)
- [Oxford — UCAS application](https://www.ox.ac.uk/admissions/undergraduate/applying/guide-for-applicants/ucas-application)
- [Oxford — When to apply and deadlines](https://www.ox.ac.uk/admissions/graduate/application-guide/starting-your-application/when-to-apply)
- [Imperial — Computing MEng](https://www.imperial.ac.uk/study/courses/undergraduate/computing-meng/)
- [Imperial — Fee status](https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/fee-status/)
- [Harvard Business School — MBA application dates](https://www.hbs.edu/mba/admissions/application-dates)
