## 2026-10-18 - Rate Limiter Endpoint Path Trailing Slash Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort/` and `/exams/validate/`) bypassed `_is_expensive_request` rate-limiting guards when requests included trailing slashes.
**Learning:** Checking strict string equality/membership on scope paths without normalizing trailing slashes creates route-matching mismatches between middleware rate limiters and FastAPI/Starlette router resolution.
**Prevention:** Always normalize request scope paths with `.rstrip("/") or "/"` before checking endpoint rate-limiter rules or exact path guards.

## 2026-11-02 - Unprotected Expensive Catalog Computation Endpoint
**Vulnerability:** The `/universities/profiled` POST endpoint performed heavy per-university profile evaluations, currency conversions, and admissions route resolutions across the full catalog, but was omitted from `_EXPENSIVE_POST_PATHS` and only bounded by the global rate limiter.
**Learning:** Adding new or refactored computational POST routes without registering them in the centralized expensive rate limiter set creates an asymmetric resource exhaustion/DoS vector.
**Prevention:** Maintain an audit check or explicit registration for all POST endpoints calculating catalog or profile fit in `_EXPENSIVE_POST_PATHS`.

## 2026-11-05 - Expensive Rate Limiter Subpath Bypass Under ASGI root_path
**Vulnerability:** When the application runs behind a reverse proxy prefixing requests (e.g. `/api`), ASGI `scope["path"]` contains the full prefix while FastAPI matches route handlers relative to `root_path`. Middleware path comparisons in `_is_expensive_request` failed to strip `root_path`, falling back to the 5x more permissive global rate limit instead of the expensive tier.
**Learning:** Unlike router handlers which operate on relative paths, Starlette middleware inspecting raw scope paths must explicitly strip `root_path` when comparing against absolute route patterns.
**Prevention:** Always use `request_scope_path(request, strip_root_path=True)` when matching request paths against defined application route sets in middleware.
