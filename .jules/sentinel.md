## 2026-10-14 - Custom Exception Handler Missing Security Headers
**Vulnerability:** Custom FastAPI exception handlers returning direct `JSONResponse` objects bypassed the global `_apply_security_headers` helper.
**Learning:** Exception handlers registered via `@app.exception_handler` return early before outer response finalization, causing 404/503 catalog error responses to omit security headers (e.g., CSP, X-Frame-Options, X-Content-Type-Options).
**Prevention:** Always wrap direct `JSONResponse` returns inside `@app.exception_handler` callables with `_apply_security_headers(...)`.
