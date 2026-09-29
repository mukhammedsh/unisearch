## 2026-09-26 - Operator Config vs Untrusted Input for SSRF Boundaries
**Vulnerability:** Attempted SSRF prevention check on operator-configured API URLs (`CURRENCY_RATES_API_URL`).
**Learning:** Preliminary DNS checks on internal config URLs introduce an incomplete security boundary (susceptible to TOCTOU/rebinding/redirects) while breaking legitimate operator-configured internal currency providers or mock environments. Base codes are strictly validated via regex, preventing request-controlled path injection.
**Prevention:** Focus SSRF defenses on request-controlled input parameters and user-supplied URLs rather than trusted environment configuration.
