# Schema Recommendation For A Larger Official Admissions Dataset

Status date: 2026-03-25

## Goal
- keep the current repo shape backward compatible
- store official admissions data at both university and program level
- separate rates, raw counts, entry standards, and provenance
- avoid forcing non-comparable data into a single `acceptance_rate_percent` field

## Current Shape In The Repo
- university-level admission signal currently lives in `academics.acceptance_rate_percent`
- program-level values can live in `academics.programs[].acceptance_rate_percent`
- official provenance already exists in `academics.acceptance_rate_percent_meta` and `fact_provenance.facts`
- user-facing admissions requirements live separately in `admission_categories[].requirement_profiles[]`

## Recommended Minimal Schema

Keep the current fields for compatibility, and add one normalized admissions block:

```json
{
  "academics": {
    "acceptance_rate_percent": 4.56,
    "acceptance_rate_percent_meta": {},
    "admissions": {
      "university_wide": {
        "acceptance_rate_percent": 4.56,
        "competition_ratio": "1:22",
        "counts": {
          "applicants": 29281,
          "admitted": 1334,
          "enrolled": 1050,
          "offers": 1500,
          "places": 1200
        },
        "entry_standards": {
          "grades": [],
          "tests": [],
          "language": [],
          "notes": ""
        },
        "provenance": {}
      },
      "programs": [
        {
          "program_name": "Computer Science",
          "acceptance_rate_percent": 3.2,
          "competition_ratio": "1:31",
          "counts": {
            "applicants": 1000,
            "admitted": 32
          },
          "entry_standards": {
            "grades": [],
            "tests": [],
            "language": [],
            "notes": ""
          },
          "provenance": {}
        }
      ]
    }
  }
}
```

## Field Rules
- `acceptance_rate_percent` is the derived or published rate
- `competition_ratio` stores the raw applicant-to-place or applicant-to-offer ratio when that is the official metric
- `counts` stores raw official values so rates can be recomputed later
- `entry_standards` stores official grade/profile/test thresholds when no rate exists
- `provenance` stores `source`, `source_url`, `verified_at`, `status`, `confidence`, `method`, and optional `basis`

## Placement Rules
- use `academics.admissions.university_wide` for institution-wide official data
- use `academics.admissions.programs[]` for program-specific official data
- keep `academics.acceptance_rate_percent` as a compatibility mirror for the university-wide rate
- keep `academics.programs[].acceptance_rate_percent` only if the existing program card needs direct access
- keep `fact_provenance.facts` as the audit-friendly canonical provenance layer

## What To Store
- official university-wide acceptance rate
- official program-level acceptance rate
- official applicants/admitted/enrolled/offers/places counts
- official competition ratios when counts are not directly comparable to an acceptance rate
- official entry standards such as GPA bands, exam cutoffs, language thresholds, or grade profiles

## What Not To Force
- do not convert program-level minimum grades into acceptance rate
- do not derive a fake university-wide rate from marketing copy
- do not mix counts from different cycles in one rate without marking the cycle in provenance
- do not overwrite university-wide data with averaged program data unless the source truly only publishes program data

## Recommendation
- add a nested `academics.admissions` object as the long-term home for official admissions facts
- keep the existing flat fields as backward-compatible mirrors for the UI and API
- let the backend derive the flat fields from the normalized admissions block when possible
- store only official, source-backed values in this dataset and leave the rest `null`
