## 2026-10-18 - Rate Limiter Endpoint Path Trailing Slash Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort/` and `/exams/validate/`) bypassed `_is_expensive_request` rate-limiting guards when requests included trailing slashes.
**Learning:** Checking strict string equality/membership on scope paths without normalizing trailing slashes creates route-matching mismatches between middleware rate limiters and FastAPI/Starlette router resolution.
**Prevention:** Always normalize request scope paths with `.rstrip("/") or "/"` before checking endpoint rate-limiter rules or exact path guards.

## 2026-10-23 - Rate Limiter Key Path Parameterization and Trailing Slash Bypass
**Vulnerability:** Rate limit bucket keys for expensive endpoints remained un-normalized for trailing slashes in `_expensive_rate_limit_path` (e.g., `/universities/ai-sort/`), creating separate rate-limit counters and double limits, and `/admissions-context` omitted `{id}` parameterization allowing rate limit bypass across university IDs.
**Learning:** Normalizing route matching in middleware rate classification alone (`_is_expensive_request`) is insufficient if the rate-limiter bucket key generator (`_expensive_rate_limit_path`) preserves raw request trailing slashes and omits route parameter abstractions.
**Prevention:** Ensure both rate-limiting classification and key generation apply identical path normalization (`.rstrip("/") or "/"`) and parameterized route abstractions for resource-intensive path components.
