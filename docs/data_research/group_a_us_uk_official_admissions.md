# Group A Research: Official Admissions Selectivity

Scope: MIT, Stanford, Harvard, Imperial. Sources below are official university or admissions-office pages only.

## MIT
- University-wide status: `official_rate`.
- Program-level status: `no_official_source` for undergraduate majors; MIT states applicants apply to MIT as a whole, not to a particular major, department, or school.
- Strongest official sources:
  - https://facts.mit.edu/undergraduate-admissions/
  - https://mitadmissions.org/help/faq/admission-statistics/
  - https://mitadmissions.org/apply/process/
- Exact metric semantics: MIT Facts publishes `Applications for first-year admission`, `Offers of admission (4.5%)`, and `First-year students enrolled` for the Class of 2028. MIT Admissions also publishes the detailed first-year statistics page and the breakdown by Early Action / Regular Action / U.S. / international / wait list.
- UniSearch recommendation: keep only `academics.acceptance_rate_percent` at university level. Do not invent `programs[].acceptance_rate_percent` for MIT undergrad.

## Stanford
- University-wide status: `official_counts`.
- Program-level status: `no_official_source` for undergraduate majors, because Stanford says you apply to the university as a whole, not to a particular major, department, or school. Graduate doctoral programs do have separate IRDS program dashboards, but those are not undergrad-major selectivity.
- Strongest official sources:
  - https://irds.stanford.edu/data-findings/undergraduate-admission
  - https://irds.stanford.edu/sites/g/files/sbiybj23826/files/media/file/undergraduate-admissions-1950-2023.pdf
  - https://admission.stanford.edu/apply/first-year/apply.html
- Exact metric semantics: Stanford IRDS reports applicant, admit, and matriculant trends for first-time first-year admission; the Common Data Set page publishes applicants, admitted, and enrolled counts for first-year admission.
- UniSearch recommendation: keep only university-level acceptance rate for Stanford undergrad. If Stanford graduate program data is ever modeled, treat it as separate graduate-program entities.

## Harvard
- University-wide status: `official_rate`.
- Program-level status: `no_official_source` for undergraduate concentrations. Harvard says students do not officially declare concentrations until sophomore fall, so there is no undergraduate admission-by-major selectivity to publish.
- Strongest official sources:
  - https://college.harvard.edu/admissions/admissions-statistics
  - https://oira.harvard.edu/2023-24-fact-book/2023-24-fact-book-college-admissions/
  - https://college.harvard.edu/about/news/exploring-sophomore-concentration-declaration
- Exact metric semantics: Harvard publishes `Applicants`, `Admitted`, `Admit Rate`, and `Yield Rate` in the Fact Book, and the admissions statistics page shows the class-by-class applicant and admitted counts. Students declare concentrations only after admission.
- UniSearch recommendation: keep `academics.acceptance_rate_percent` only at university level. Do not add program-level acceptance for Harvard undergrad; concentration data is post-admit and not selectivity.

## Imperial
- University-wide status: `official_rate`.
- Program-level status: `official_counts` and `official_rate` at course/faculty level for undergraduate admissions. Imperial's transparency workbook covers the last five completed UCAS cycles and includes admissions rates, applicants, offers made, places confirmed, BMAT scores, and admissions rate by nationality.
- Strongest official sources:
  - https://www.imperial.ac.uk/admin-services/strategic-planning/statistics/transparency-information/
  - https://www.imperial.ac.uk/media/imperial-college/administration-and-support-services/planning/public/statistics-guides/24-25-Statistics-Guide.pdf
  - https://www.imperial.ac.uk/about/introducing-imperial/facts-and-figures/college-data-and-statistics-catalogue/students-and-alumni/
- Exact metric semantics: the university-wide figure is derived from official undergraduate `applications received` and `new admissions` totals. Course-level tables in the statistics guide use `applications received`, `new admissions`, and `applications: admissions ratio`, with separate counts by home/overseas and additional breakdowns such as nationality and entry qualifications.
- UniSearch recommendation: Imperial is the best candidate in this group for both university-level and program-level selectivity fields. Store the denominator explicitly in provenance so `applications / new admissions` is not conflated with `offers made` or `places confirmed`.

## Bottom Line
- MIT, Stanford, and Harvard: undergraduate selectivity is university-wide, not program-by-program.
- Imperial: official undergraduate course-level selectivity data exists and is worth modeling.
- For UniSearch, program-level acceptance should stay null unless the official source explicitly publishes course/program applicant and admit counts or an explicit admissions ratio.
