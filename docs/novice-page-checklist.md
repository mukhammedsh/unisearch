# Novice university page checklist

This checklist lists what a university page must answer for a school-leaver who has never used UniSearch. It is the Stage 3 acceptance check for each accepted institution (see step 5 of the research workflow and Stage 3 in [the admissions product model](admissions-product-model.md)). It came from a novice-applicant audit of MIT, Stanford University, Imperial College London and Nazarbayev University on 2026-11-23. Five simulated applicants from Kazakhstan took part, in English, Russian and Kazakh, on desktop and phone.

"Answered" means the answer is visible on the page without opening the collapsed "Sources" disclosure. It must be scoped to the reader's way in (route, applicant category, cycle) and phrased in plain words. If the university publishes nothing, the page says so and links the official page. A missing fact is never shown as zero, met or rejected.

## Questions

| # | Question | Answered when the page shows |
|---|---|---|
| 1 | Can I apply from Kazakhstan / as an international applicant? | the applicant categories the university admits, or that it publishes no ruling on Kazakhstan documents (not a rejection) |
| 2 | Where and how do I apply: to the university or to a program? | the application system or official link, and whether the target is the institution, a course or a program |
| 3 | Which ways in exist (first year, transfer, preparatory year, others), and which is mine? | each published way in with who it is for; the default way in opens first |
| 4 | What is the next deadline and what must I do first? | the next dated deadline, or the application period. If the university gives only a day and month, the page says the year is not stated. Earlier steps such as test booking appear first. |
| 5 | Which tests are required and which are only recommended? | required tests, their published alternatives, and recommendations kept separate from requirements |
| 6 | What English level is needed, including section minimums or an exemption? | the overall minimum and any section minimums next to it, or that no English test is required |
| 7 | Do my results meet the published minimums? | a per-minimum status from the profile: met, below the minimum, partly checked (what to add), or a recommendation. It is never a chance of admission. |
| 8 | Which documents do I need, including from a school in Kazakhstan? | the published document list, or an explicit "not published" with the official contact |
| 9 | Is there an application fee or a waiver? | the published fee and late fee, or "not published" |
| 10 | What does a year cost, and what is included? | tuition and the calculated total with its parts, the fee status when the university has fee classes, and how the cost compares with the profile budget |
| 11 | Is there financial aid for me, and how and when do I apply for it? | the aid that exists for the reader's category, the key award lines (type, coverage, deadline) and the separate application if there is one |
| 12 | Does asking for aid affect admission? | the published policy in one sentence (need-blind or need-aware), or "not stated" |
| 13 | Is my program offered, and does it have its own conditions? | the program in the study options and any program-specific requirement |
| 14 | How competitive is admission? | the admission rate as the share of all applicants, never as a personal chance |
| 15 | Will my previous university credits count? (transfer only) | the published credit rule, or the office to ask |
| 16 | Where can I ask or read the official page? | official links with checked dates |

The checklist deliberately leaves out "how much will I pay after aid" and "what are my chances". The product does not estimate either (see [UniFit scoring](admissions-product-model.md)).

## How to run the check

1. Write 4 or 5 personas, one per university and way in. Cover the three interface languages and a 375-390px phone. Each persona gets realistic profile data and 6-8 of the questions above in its own words.
2. Run each persona in its own isolated browser session against a local build. Personas use only the site: no source code, no data files, no official university pages. They record each answer, where they found it, their confidence, and exact quotes of anything unclear.
3. Check every answer against runtime data and the page. Classify it as correct, wrong because of the UI, present but hard to find, or missing from the data. Wrong answers caused by the UI come first.
4. Fix the verified problems in shared code paths, then run the same personas again and compare the results.
