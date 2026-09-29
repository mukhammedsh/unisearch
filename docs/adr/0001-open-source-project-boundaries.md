# ADR 0001: Open-source project boundaries

Status: Accepted

## Context

UniSearch is published under the MIT License and can be copied, modified, redistributed, and used in private or commercial forks. The repository still needs clear project boundaries so external changes do not dilute the product scope or introduce unverifiable admissions data.

## Decision

- Cover undergraduate, master's, doctoral, and professional university discovery and decision support. Apply admissions facts only to the study options and applicant routes they describe, as defined in the [admissions product model](../admissions-product-model.md).
- Keep the frontend framework-free: Vanilla JS, HTML, and CSS variables.
- Keep the backend on FastAPI with explicit schemas and conservative JSON data sources.
- Accept only official university pages, official admissions pages, or university-hosted PDFs for verified university facts.
- Prefer missing values over invented data.
- Keep user-facing UI text localized in English and Russian.
- Keep release/version state centered on `package.json`.

## Consequences

- Forks may change the scope, stack, or data policy under the MIT License, but upstream UniSearch reviews changes against these boundaries.
- New contributors have a stable reference for why framework migrations and aggregator-sourced data are rejected by default, while degree-level scope remains open to verified university programs.
- Future architectural exceptions should be documented with another ADR instead of being hidden in implementation details.
