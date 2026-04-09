# Rank Truth Update 2026-04-09

## Summary

- Audited all `40` universities against the official QS World University Rankings 2026 publication on `2026-04-09`.
- Removed the leftover top-level `rank` normalization drift for `13` universities where `rank` no longer matched `fact_provenance.facts.rank.value`.
- Standardized rank provenance so `rank`, `rank_meta`, and `fact_provenance.facts.rank` now agree.
- Current status split:
  - `36` universities have an official published QS WUR 2026 position.
  - `4` universities have no published QS WUR 2026 position in the official table and therefore keep `rank: null`.

## Sources

- Official QS WUR 2026 table: https://www.topuniversities.com/qs-top-uni-wur
- QS WUR 2026 release summary: https://www.topuniversities.com/rankings-release-summaries/world-university-rankings-2026-release-summary

## Catalog Status

| University | ID | rank | status | source |
| --- | --- | ---: | --- | --- |
| Massachusetts Institute of Technology | mit-usa-cambridge | 1 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Imperial College London | imperial-college-london-uk | 2 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Stanford University | stanford-university-usa-ca | 3 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Harvard University | harvard-usa-cambridge | 5 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Oxford | university-of-oxford-uk-oxford | 4 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Swiss Federal Institute of Technology Zurich | eth-zurich-ch-zurich | 7 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| National University of Singapore | national-university-of-singapore-sg-singapore | 8 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Cambridge | university-of-cambridge-uk-cambridge | 6 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Tsinghua University | tsinghua-university-cn-beijing | 17 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Melbourne | university-of-melbourne-au-melbourne | 19 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Technical University of Munich | technical-university-of-munich-de-munich | 22 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Swiss Federal Institute of Technology Lausanne | epfl-ch-lausanne | 22 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| California Institute of Technology | caltech-usa-pasadena | 10 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Toronto | university-of-toronto-ca-toronto | 29 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| The Chinese University of Hong Kong | cuhk-hk-shatin | 32 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Tokyo | university-of-tokyo-jp-tokyo | 36 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Chicago | university-of-chicago-usa-chicago | 13 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Seoul National University | seoul-national-university-kr-seoul | 38 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Delft University of Technology | delft-university-of-technology-nl-delft | 47 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Pennsylvania | university-of-pennsylvania-usa-philadelphia | 15 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Kyoto University | kyoto-university-jp-kyoto | 57 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Cornell University | cornell-university-usa-ithaca | 16 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of California, Berkeley | uc-berkeley-usa-berkeley | 17 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of New South Wales | unsw-sydney-au-sydney | 20 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Yale University | yale-university-usa-new-haven | 21 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Princeton University | princeton-university-usa-princeton | 25 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Sydney | university-of-sydney-au-sydney | 25 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| McGill University | mcgill-university-ca-montreal | 27 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Johns Hopkins University | johns-hopkins-university-usa-baltimore | 24 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Australian National University | australian-national-university-au-canberra | 32 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Edinburgh | university-of-edinburgh-uk-edinburgh | 34 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Manchester | university-of-manchester-uk-manchester | 35 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Columbia University | columbia-university-usa-new-york | 38 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of British Columbia | university-of-british-columbia-ca-vancouver | 40 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of California, Los Angeles | ucla-usa-los-angeles | 46 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| University of Waterloo | university-of-waterloo-ca-waterloo | 119 | official | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Korea Advanced Institute of Science and Technology | kaist-kr-daejeon | null | not_published | [QS WUR 2026 release summary](https://www.topuniversities.com/rankings-release-summaries/world-university-rankings-2026-release-summary) |
| Nazarbayev University | nazarbayev-university-kaz-astana | null | not_published | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Suleyman Demirel University | suleyman-demirel-university-kaz-kaskelen | null | not_published | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
| Astana IT University | astana-it-university-kaz-astana | null | not_published | [QS WUR 2026 official table](https://www.topuniversities.com/qs-top-uni-wur) |
