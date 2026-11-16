## 2026-10-18 - Rate Limiter Endpoint Path Trailing Slash Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort/` and `/exams/validate/`) bypassed `_is_expensive_request` rate-limiting guards when requests included trailing slashes.
**Learning:** Checking strict string equality/membership on scope paths without normalizing trailing slashes creates route-matching mismatches between middleware rate limiters and FastAPI/Starlette router resolution.
**Prevention:** Always normalize request scope paths with `.rstrip("/") or "/"` before checking endpoint rate-limiter rules or exact path guards.

## 2026-11-02 - Unprotected Expensive Catalog Computation Endpoint
**Vulnerability:** The `/universities/profiled` POST endpoint performed heavy per-university profile evaluations, currency conversions, and admissions route resolutions across the full catalog, but was omitted from `_EXPENSIVE_POST_PATHS` and only bounded by the global rate limiter.
**Learning:** Adding new or refactored computational POST routes without registering them in the centralized expensive rate limiter set creates an asymmetric resource exhaustion/DoS vector.
**Prevention:** Maintain an audit check or explicit registration for all POST endpoints calculating catalog or profile fit in `_EXPENSIVE_POST_PATHS`.

## 2026-11-04 - Rate Limiter ASGI Root Path Prefix Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort`, `/universities/compare-profiles`, `/universities/profiled`, `/exams/validate`, `/languages/validate`, and `/ops/warmup`) bypassed `_is_expensive_request` rate-limiting guards when running behind an ASGI mount or reverse proxy with `root_path` configured (e.g. `/api`).
**Learning:** Middleware checking ASGI scope paths directly without stripping `scope["root_path"]` fails exact path membership checks (`_EXPENSIVE_POST_PATHS`), leaving compute-heavy endpoints unprotected against DoS.
**Prevention:** Always normalize request scope paths by stripping `root_path` before evaluating path-based rate-limiting rules and endpoint key buckets.
