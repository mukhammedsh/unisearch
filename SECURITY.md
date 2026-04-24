# Security Policy

## Supported Versions

We provide security updates for the following versions of UniSearch:

| Version | Supported          |
| ------- | ------------------ |
| 3.7.x   | :white_check_mark: |
| < 3.7.0 | :x:                |

## Reporting a Vulnerability

We take the security of UniSearch seriously. If you believe you have found a security vulnerability, please do NOT create a public issue. Instead, please report it through one of the following channels:

1.  **GitHub Private Vulnerability Reporting:** Please use the [Private Vulnerability Reporting](https://github.com/Muxlex/unisearch/security/advisories/new) feature on GitHub. This is the preferred method as it allows us to discuss and fix the issue privately.
2.  **Email:** You can also contact us at [info@unisearch.study](mailto:info@unisearch.study). We aim to provide an initial response within 48 hours and a more detailed update within one week.

Please include as much detail as possible in your report, including steps to reproduce the vulnerability and potential impact.

## Security Practices

UniSearch follows best practices for academic tools:
- We use SHA-256 for integrity checks and caching.
- All HTML output is sanitized using standard browser DOM APIs to prevent XSS.
- Sensitive data is never logged to the console or server logs in production environments.
