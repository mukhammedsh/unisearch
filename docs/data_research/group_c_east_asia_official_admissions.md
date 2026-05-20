# East Asia Official Admissions Research

Status date: 2026-03-25

Scope:
- National University of Singapore (NUS)
- The Chinese University of Hong Kong (CUHK)
- University of Tokyo
- Seoul National University (SNU)
- KAIST
- Tsinghua University
- Kyoto University

Interpretation:
- `official_rate` means the university publishes a direct acceptance rate or a clear applicants-to-admitted ratio.
- `official_counts` means the university publishes official applicant/admit/enrolment/places counts that can support selectivity analysis.
- `no_official_source` means no public official rate/counts were found in this pass.

## Findings

- NUS: university-wide `no_official_source`; program-level `official_counts`. NUS publishes indicative grade profiles and programme places on the official IGP page, and some programs have explicit applicant/place counts such as NUS College (`10,000` applications for `400` places) and programme intake tables. Sources: https://www.nus.edu.sg/oam/undergraduate-programmes/indicative-grade-profile-%28igp%29, https://news.nus.edu.sg/nus-college-receives-record-10000-applications-for-400-places/. Semantics: not a public university-wide admit rate, but programme places plus grade profiles. Recommendation: keep `academics.acceptance_rate_percent` null at university level; if we extend schema later, store `programme_places` / `entry_standard` instead of inventing a rate.

- CUHK: university-wide `no_official_source`; program-level `official_counts` for selected routes, but not a clean public university-wide admit rate. CUHK publishes programme-specific requirements, admission grades for JUPAS applicants, projected enrolment, and press releases with admitted-count figures for routes like JUPAS and SNDAS. Sources: https://admission.cuhk.edu.hk/application/jupas/programme-specific-requirements/, https://admission.cuhk.edu.hk/wp-content/uploads/2025/05/Admission-Grades-2025.pdf, https://admission.cuhk.edu.hk/wp-content/uploads/2024/02/Projected-Enrolment-2024.pdf, https://www.cpr.cuhk.edu.hk/en/press/cuhk-jupas-admission-2023/. Semantics: score profiles, projected enrolment, and admitted counts by route, not a public acceptance-rate table. Recommendation: keep acceptance rate null; later add `entry_standard` / `programme_places` style fields if needed.

- University of Tokyo: university-wide `official_counts`; program-level `official_counts`. UTokyo publishes applicants, successful applicants, and entrants by undergraduate division, and also has separate result pages for some graduate programs. Sources: https://www.u-tokyo.ac.jp/en/about/applications_admissions.html, https://www.u-tokyo.ac.jp/content/400019972.pdf, https://gsp.c.u-tokyo.ac.jp/files/Admissions_results_2025.pdf. Semantics: official applicants/successful-applicants/entrants counts by division and program; the university-wide admit rate can be derived from the official counts. Recommendation: populate `academics.acceptance_rate_percent` from the official counts, and keep program-level counts where the source gives them.

- Seoul National University: university-wide `no_official_source`; program-level `no_official_source` for acceptance counts in this pass. SNU's official guides explicitly state that the number of applicants and acceptance rate will not be disclosed, and admission decisions are holistic. Sources: https://en.snu.ac.kr/admission/undergraduate/application, https://en.snu.ac.kr/webdata/uploads/eng/file/2025/07/Admissions_for_Undergraduate_Spring_2026.pdf, https://en.snu.ac.kr/admission/overview/faq/admission. Semantics: only quota language and evaluation criteria are public; no public applicant/admit totals. Recommendation: keep acceptance rate null and avoid heuristics.

- KAIST: university-wide `official_counts` via applicant-route competition tables; program-level `no_official_source` because KAIST recruits without departments and students choose a major later. Official pages publish `quota / applicants / competition ratio` for each applicant route. Sources: https://admission.kaist.ac.kr/undergraduate/admission/rsub/2024, https://admission.kaist.ac.kr/undergraduate/admission/rsub/2025, https://admission.kaist.ac.kr/. Semantics: applicants-to-place ratios by applicant route, not major-level acceptance rates. Recommendation: do not force this into `acceptance_rate_percent`; if schema expands, store `competition_ratio` and route counts separately.

- Tsinghua University: university-wide `no_official_source`; program-level `official_counts` for selected schools/departments, but not a public university-wide admit-rate table. Official pages show divisional undergraduate recruitment, annual department intake, and some program-level admission ratios/counts. Sources: https://www.tsinghua.edu.cn/en/Admissions/International_Students1/Undergraduate_Programs.htm, https://www.cs.tsinghua.edu.cn/csen/Education1/Undergraduate_Programs_/Student_Admission.htm, https://www.me.tsinghua.edu.cn/en/Academic_and_Future_Students/Undergraduate_Program/Overview.htm, https://mis.sem.tsinghua.edu.cn/ueditor/jsp/upload/file/20191125/1574643097042078803.pdf. Semantics: annual intake counts and selective program notes, not a clean university-wide admit-rate feed. Recommendation: keep university-wide acceptance null; store program-level counts only when the source explicitly provides them.

- Kyoto University: university-wide `no_official_source`; program-level `official_counts` for specific graduate schools / programs. Kyoto publishes past-results tables with capacity, applicants, examinees, successful applicants, and enrollees for individual programs. Sources: https://www.ges.kyoto-u.ac.jp/en/admissions/past-results, https://www.t.kyoto-u.ac.jp/en/admissions/graduate/exam1/result, https://www.i.kyoto-u.ac.jp/en/admission/application/. Semantics: program-specific applicant/admit/enrolment counts, not a central university-wide acceptance-rate table. Recommendation: keep university-wide acceptance rate null; add program-level counts only where the source provides a full numerator/denominator.

## Bottom Line

- Strongest true acceptance-rate candidates in this group: `University of Tokyo`.
- Strongest count-based but not rate-based candidates: `NUS`, `CUHK`, `KAIST`, `Tsinghua`, `Kyoto`.
- Clear `verified-null` candidates for acceptance-rate fields: `SNU`.
- For the current UniSearch schema, do not convert score profiles, quotas, or intake tables into a fake `acceptance_rate_percent` unless the official source gives a real numerator and denominator.
