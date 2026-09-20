# Security Policy

## Supported Versions

We provide security updates for the following versions of UniSearch:

| Version | Supported          |
| ------- | ------------------ |
| 6.x     | :white_check_mark: |
| < 6.0.0 | :x:                |

## Reporting a Vulnerability

We take the security of UniSearch seriously. If you believe you have found a security vulnerability, please do NOT create a public issue. Instead, please report it through one of the following channels:

1. **GitHub Private Vulnerability Reporting:** Please use the [Private Vulnerability Reporting](https://github.com/mukhammedsh/unisearch/security/advisories/new) feature on GitHub. This is the preferred method as it allows us to discuss and fix the issue privately.
2. **Email:** You can also contact us at [info@unisearch.study](mailto:info@unisearch.study).

### Response Timeline SLAs
* **Initial Acknowledgment:** Within **48 hours** of report receipt.
* **Triage & Impact Assessment:** Within **7 calendar days**.
* **Remediation & Patch Release:** Hotfix release within **14 calendar days** for high and critical vulnerabilities (and within 30 calendar days for medium/low issues). A coordinated disclosure advisory will be published alongside the patch release.

## Researcher Credit & Security Hall of Fame

We believe in recognizing security researchers who help protect the UniSearch community. If you report a valid, previously unknown vulnerability, we will publicly credit you in our Security Hall of Fame, featured in [CHANGELOG.md](CHANGELOG.md), GitHub Security Advisories, and release notes (unless you explicitly request to remain anonymous).

## Security Practices

UniSearch follows defense-in-depth best practices for academic tools:
- **Input Validation & Schemas:** Strict Pydantic V2 model validation on all incoming request payloads.
- **Request Guards:** Sliding-window rate limiting, 128 KiB request payload caps, and trusted reverse proxy client IP resolution.
- **Defensive Headers:** Content-Security-Policy (CSP), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- **Automated Security Scanning:** Continuous SAST scanning with GitHub CodeQL, filesystem secret and misconfiguration scanning with Trivy, dependency auditing with npm audit and pip-audit, and fuzz testing with Google ClusterFuzzLite / Atheris.
- **Data Privacy:** Sensitive applicant profile data, secrets, and authorization tokens are never logged or stored on the server.

For the formal threat model, trust boundaries, and OpenSSF Silver claim justifications, see our [Security Assurance Case](docs/security-assurance.md).

