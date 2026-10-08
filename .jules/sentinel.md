# Sentinel Security Journal

## 2026-10-08 - Multi-Encoded Null Byte Injection Bypass
**Vulnerability:** Single-pass checking for `\x00` and `%00` in URL paths and query strings failed to detect double-encoded or multi-encoded null bytes (e.g., `%2500`).
**Learning:** Middleware guard checks relying on static string substring searches can be bypassed if raw URI components are decoded later by web servers, frameworks, or application parsers.
**Prevention:** Iteratively unquote URI components using `urllib.parse.unquote` up to a small bounded recursion limit before checking for null bytes or control characters.
