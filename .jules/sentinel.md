## 2026-10-18 - Rate Limiter Endpoint Path Trailing Slash Bypass
**Vulnerability:** Expensive POST endpoints (such as `/universities/ai-sort/` and `/exams/validate/`) bypassed `_is_expensive_request` rate-limiting guards when requests included trailing slashes.
**Learning:** Checking strict string equality/membership on scope paths without normalizing trailing slashes creates route-matching mismatches between middleware rate limiters and FastAPI/Starlette router resolution.
**Prevention:** Always normalize request scope paths with `.rstrip("/") or "/"` before checking endpoint rate-limiter rules or exact path guards.
