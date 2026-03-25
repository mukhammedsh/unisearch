# Official Admissions Research Tracker

Status date: 2026-03-25

Purpose:
- collect parallel sub-agent findings for official admissions/selectivity data
- keep university-wide and program-level outcomes separate
- decide whether UniSearch should store `acceptance_rate_percent`, another official selectivity signal, or `verified-null`

Statuses:
- `official_rate`: the university publishes a direct official rate
- `official_counts`: the university publishes official applicant/admit counts that allow a rate to be calculated
- `competition_ratio_only`: the university publishes applicants-to-places or another ratio that is not a clean admit rate
- `entry_standard_only`: the university publishes grade/score thresholds or profiles, but not acceptance counts/rates
- `no_official_source`: no suitable official public source was found in this pass

| University | Worker | University-Wide | Program-Level | Recommended UniSearch Field | Notes |
| --- | --- | --- | --- | --- | --- |
| MIT | A | official_rate | no_official_source | acceptance_rate_percent | Undergrad admission is institute-wide, not by major. |
| Imperial College London | A | official_rate | official_rate | acceptance_rate_percent + program_counts | Strongest candidate for course-level official selectivity. |
| Stanford University | A | official_counts | no_official_source | acceptance_rate_percent | Undergrad admission is university-wide, not by major. |
| Harvard University | A | official_rate | no_official_source | acceptance_rate_percent | Concentrations are declared after admission, so no undergrad program rate. |
| ETH Zurich | B | no_official_source | no_official_source | keep_null | Official materials describe routes and rules, not a clean public admit rate. |
| EPFL | B | official_counts | official_counts | program_counts_only | Public reports can support richer counts, but semantics must stay explicit. |
| TUM | B | official_counts | official_counts | competition_ratio_only | Some official docs expose applicant/place or offer-acceptance style metrics, not a clean admit rate. |
| TU Delft | B | no_official_source | no_official_source | keep_null | Better model numerus-fixus / selection cap later than invent an admit rate. |
| University of Toronto | B | official_counts | official_counts | acceptance_rate_percent + program_counts | Official counts exist, but are split across university-wide and faculty-level documents. |
| NUS | C | no_official_source | official_counts | entry_standard_only | Best official signals are IGP and programme places, not a clean admit rate. |
| CUHK | C | no_official_source | official_counts | entry_standard_only | Programme grades, projected enrolment, and route-specific counts are available. |
| University of Tokyo | C | official_counts | official_counts | acceptance_rate_percent + program_counts | Strongest East Asia candidate for both university-wide and division-level counts. |
| Seoul National University | C | no_official_source | no_official_source | keep_null | Official guides say applicant counts and acceptance rate are not disclosed. |
| KAIST | C | official_counts | no_official_source | competition_ratio_only | Official track competition tables exist, but admission is not by department. |
| Tsinghua University | C | no_official_source | official_counts | program_counts_only | Selected departments publish intake/selectivity counts, not a central university-wide rate. |
| Kyoto University | C | no_official_source | official_counts | program_counts_only | Useful program-level applicant/success counts exist, but not a central university-wide rate. |
| University of Melbourne | D | no_official_source | no_official_source | entry_standard_only | Official materials expose ATAR/select-rank thresholds, not applicant/admit rates. |
| Nazarbayev University | D | official_rate | no_official_source | acceptance_rate_percent | Keep official university-wide undergraduate rate only. |
| Suleyman Demirel University | D | no_official_source | no_official_source | entry_standard_only | Official materials expose thresholds and process rules, not public rate/counts. |
| Astana IT University | D | no_official_source | no_official_source | entry_standard_only | Official materials expose test/program-group requirements, not public rate/counts. |

Parallel outputs:
- `docs/data_research/group_a_us_uk_official_admissions.md`
- `docs/data_research/group_b_europe_canada_official_admissions.md`
- `docs/data_research/group_c_east_asia_official_admissions.md`
- `docs/data_research/group_d_au_kz_official_admissions.md`
- `docs/data_research/schema_recommendations_for_large_admissions_dataset.md`
