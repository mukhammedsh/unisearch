# Official Admissions / Selectivity Research

Scope: University of Melbourne, Nazarbayev University, Suleyman Demirel University, Astana IT University.

Rule used here: official university/admissions pages and official university PDFs only. No third-party aggregators, rankings sites, or inferred rates.

## Summary

| University | University-wide status | Program-level status | Recommended UniSearch handling |
| --- | --- | --- | --- |
| University of Melbourne | `no_official_source` | `no_official_source` | Keep `academics.acceptance_rate_percent = null`; preserve entry-threshold fields separately if schema expands. |
| Nazarbayev University | `official_rate` | `no_official_source` for undergraduate programs | Fill the university-wide rate only; do not invent program-level rates for undergraduate programs. |
| Suleyman Demirel University | `no_official_source` | `no_official_source` | Keep `acceptance_rate_percent = null`; capture admission thresholds/exam rules instead of a fake rate. |
| Astana IT University | `no_official_source` | `no_official_source` | Keep `acceptance_rate_percent = null`; capture entrance-test thresholds / program-group requirements instead. |

## University of Melbourne

- University-wide status: `no_official_source`
- Program-level status: `no_official_source`
- Strongest official URLs:
  - [ATAR guarantees](https://study.unimelb.edu.au/study-with-us/undergraduate-courses/change-of-preference/atar-guarantees)
  - [Bachelor of Science entry requirements](https://study.unimelb.edu.au/find/courses/undergraduate/bachelor-of-science/entry-requirements/)
  - [Domestic mid-year applications](https://study.unimelb.edu.au/how-to-apply/undergraduate-study/domestic-applications/applications/domestic-mid-year-applications)
- Metric semantics:
  - Melbourne publishes course-specific entry standards such as guaranteed ATARs, lowest selection ranks, prerequisite subjects, and special entry pathways.
  - The official pages do not publish a university-wide applicant/admit ratio or course-level applicant/admit counts in the `acceptance_rate_percent` sense.
  - Course pages may show cohort profiles for enrolled students, but that is not the same as acceptance rate.
- UniSearch recommendation:
  - Leave `academics.acceptance_rate_percent` null.
  - If the schema is extended later, store `guaranteed_atar`, `lowest_selection_rank`, and other entry-threshold signals separately.

## Nazarbayev University

- University-wide status: `official_rate`
- Program-level status: `no_official_source` for undergraduate programs
- Strongest official URLs:
  - [Admissions statistics on Nazarbayev University](https://nu.edu.kz/wp-content/uploads/2026/01/eng_ug_upd.pdf)
  - [Regular Admissions](https://nu.edu.kz/admissions/how-to-apply/foundation-undergraduate/regular-admissions/)
  - [Admissions / general information](https://nu.edu.kz/en/admissions/admissions)
- Metric semantics:
  - NU publishes a direct undergraduate admission rate in its official statistics PDF.
  - The 2025 undergraduate figure is `1480 admitted / 6911 applied = 21%`.
  - The PDF notes that since 2024 there is a single application for NUFYP and undergraduate programs, so the rate reflects that combined admissions flow.
  - I did not find a public undergraduate program-by-program applicant/admit table on the official admissions pages.
- UniSearch recommendation:
  - Fill `academics.acceptance_rate_percent` with the university-wide rate.
  - Keep undergraduate program-level rate fields null unless NU later publishes a public per-program applicants/admitted table.

## Suleyman Demirel University

- University-wide status: `no_official_source`
- Program-level status: `no_official_source`
- Strongest official URLs:
  - [Admission - SDU University](https://sdu.edu.kz/en/admission-3-2/)
  - [SDU admission page](https://sdu.edu.kz/ru/admission/)
  - [Transfer and re-admission regulations](https://my.sdu.edu.kz/common/download/REGULATION-ON-TRANSFERRING-AND-RE-ADMISSION-OF-STUDENTS-AT-SULEYMAN-DEMIREL-UNIVERSITY.pdf)
- Metric semantics:
  - SDU publishes admission rules based on UNT scores, interviews, special exams, and grant competition.
  - The official pages expose threshold scores and process rules, but not a public university-wide applicant/admit total.
  - I did not find a public course-level applicant/admit table suitable for `acceptance_rate_percent`.
- UniSearch recommendation:
  - Keep `academics.acceptance_rate_percent` null.
  - If we expand the schema later, store admission thresholds and exam/interview requirements instead of a synthetic rate.

## Astana IT University

- University-wide status: `no_official_source`
- Program-level status: `no_official_source`
- Strongest official URLs:
  - [How to apply](https://astanait.edu.kz/en/how-to-apply/)
  - [Bachelor's Degree Programs](https://astanait.edu.kz/en/bachelor/)
  - [AITU Excellence Test](https://astanait.edu.kz/en/aitu-excellence-test/)
  - [Internal quality assurance system PDF](https://astanait.edu.kz/wp-content/uploads/2023/04/Internal-quality-assurance-system.pdf)
- Metric semantics:
  - AITU publishes an application flow with preliminary approval, original-document submission, and entrance testing.
  - Its bachelor pages publish program-group subject requirements and minimum scores.
  - The official materials do not publish public applicant/admit totals at university or program level.
  - That means there is no reliable official `acceptance_rate_percent` to normalize into the dataset.
- UniSearch recommendation:
  - Keep `academics.acceptance_rate_percent` null.
  - If schema expands later, store program-group thresholds and entrance-test requirements as separate selectivity fields.

## Notes

- I did not classify any of these universities as `blocked-by-anti-bot`.
- For Melbourne, SDU, and AITU, the official sources are useful for entry requirements, but they are not enough to backfill a true acceptance-rate field.
- For NU, the official undergraduate rate is strong enough to keep in the dataset, but I did not find a clean public undergraduate program-level applicants/admitted source.
