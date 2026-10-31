## 2026-10-18 - Rate Limiter Endpoint Path Trailing Slash Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort/` and `/exams/validate/`) bypassed `_is_expensive_request` rate-limiting guards when requests included trailing slashes.
**Learning:** Checking strict string equality/membership on scope paths without normalizing trailing slashes creates route-matching mismatches between middleware rate limiters and FastAPI/Starlette router resolution.
**Prevention:** Always normalize request scope paths with `.rstrip("/") or "/"` before checking endpoint rate-limiter rules or exact path guards.

## 2026-10-31 - Expensive Rate Limiter Parameterized Route Bucketing
**Vulnerability:** Expensive POST endpoints taking path parameters (specifically `/universities/{university_id}/admissions-context`) were classified as expensive in `_is_expensive_request` but omitted from `_expensive_rate_limit_path` path-parameter normalization. As a result, requests to different university IDs received isolated rate-limit counters instead of sharing the `/universities/{id}/admissions-context` bucket, allowing attackers to bypass expensive rate limits by rotating university IDs.
**Learning:** Adding new parameterized endpoints to `_is_expensive_request` guards requires keeping `_expensive_rate_limit_path` template bucketing in sync; otherwise, per-path rate limiting keys diverge per resource ID.
**Prevention:** Whenever an expensive endpoint with path parameters is added, ensure its pattern is included in `_expensive_rate_limit_path` route normalization, and verify route key grouping in test suites.
