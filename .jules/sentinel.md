## 2026-10-06 - Redact API Keys in External Endpoint Logging
**Vulnerability:** External third-party API URLs (such as currency conversion endpoints) configured via environment variables can contain embedded API keys in path segments or query parameters. Logging raw endpoint URLs on fetch failure exposes sensitive API keys in application logs.
**Learning:** Standard URL parsing (`urlsplit`/`parse_qsl`) must be supplemented with path segment inspection to catch both query string secrets (`access_key`, `api_key`) and path-embedded tokens (e.g., `/v6/<key>/latest/USD`).
**Prevention:** Always filter URLs through a sanitization function (`_sanitize_url_for_logging`) before passing them to logger statements.
