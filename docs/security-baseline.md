# OSPS Baseline Tracking

UniSearch tracks its security posture against the Open Source Project Security (OSPS) Baseline.
This document is a point-in-time self-assessment, not a claim of certification or compliance.

## Target

The current target is **OSPS Baseline Level 1, version 2026.08.28**. Level 1 is the
baseline intended for projects of any size. The project will only publish a compliance
statement after every control is verified, including controls that depend on GitHub
settings rather than repository files.

## Level 1 assessment

| Control | Status | Evidence or next action |
| --- | --- | --- |
| OSPS-AC-01.01 MFA for sensitive actions | Needs maintainer confirmation | Confirm that every administrator of the authoritative GitHub repository has MFA or a passkey enabled. |
| OSPS-AC-02.01 Restrict collaborator permissions | Needs maintainer confirmation | Review collaborator and organization defaults; grant elevated access deliberately. |
| OSPS-AC-03.01 Protect the primary branch from direct commits | Needs GitHub configuration | Require pull requests for `main` and enforce the rule for administrators. The current rule does not enforce for administrators. |
| OSPS-AC-03.02 Protect the primary branch from deletion | Met | The protected `main` branch disallows deletion. |
| OSPS-BR-01.01 Sanitize untrusted CI metadata | Met | Workflow review found no unvalidated branch, pull-request, or manual inputs. Release tags are strictly validated before checkout or publication steps use them. |
| OSPS-BR-01.03 Isolate untrusted CI code | Met | Pull-request workflows use no repository secrets and default to `contents: read`; privileged release credentials run only for published releases. |
| OSPS-BR-03.01 Encrypt official project channels | Met | Published project channels use HTTPS. |
| OSPS-BR-03.02 Authenticate distribution channels | Met | Official releases are distributed through GitHub Releases over HTTPS. |
| OSPS-BR-07.01 Prevent committed secrets | Met | Repository guards and Trivy scan tracked files; GitHub secret scanning has no open alerts. |
| OSPS-DO-01.01 Document basic functionality | Met | [README](../README.md) documents setup, configuration, operation, and checks. |
| OSPS-DO-02.01 Provide defect-reporting guide | Met | GitHub issue templates provide bug reporting guidance. |
| OSPS-GV-02.01 Provide public discussion mechanisms | Met | [Governance](../GOVERNANCE.md) directs proposals and discussions to GitHub Issues and Discussions. |
| OSPS-GV-03.01 Explain contribution process | Met | [CONTRIBUTING.md](../CONTRIBUTING.md) explains the contribution process. |
| OSPS-LE-02.01 and OSPS-LE-03.01 Source license | Met | The source license is MIT and is present in [LICENSE](../LICENSE). |
| OSPS-LE-02.02 and OSPS-LE-03.02 Release-asset license | Pending next release | Release automation now includes `LICENSE` in all custom ZIP assets; verify the next published assets. |
| OSPS-QA-01.01 and OSPS-QA-01.02 Public source and history | Met | The authoritative repository and its Git history are publicly readable. |
| OSPS-QA-02.01 Dependency list | Met | `package-lock.json` and Python requirements lock files record direct dependencies. |
| OSPS-QA-04.01 Multi-repository scope | Met | UniSearch has one authoritative source repository. |
| OSPS-QA-05.01 and OSPS-QA-05.02 No generated or unreviewable binaries in VCS | Met | The repository contains no tracked executable or compiled artifacts. Its binary files are source-controlled university media (PNG, JPG, WebP, and SVG) used by the application. |
| OSPS-VM-02.01 Security contacts | Met | [SECURITY.md](../SECURITY.md) lists private GitHub reporting and an email contact. |

## Evidence and automation

- `security-insights.yml` is the machine-readable declaration used by OSPS-compatible tooling.
- GitHub Actions runs CodeQL, dependency auditing, Trivy, Scorecard, fuzzing, and the test suites.
- Release automation produces GitHub build provenance attestations.

## Review cadence

Review this assessment after a material CI/CD, release, governance, or security-policy
change, and at least before each published compliance statement. Update the date in
`security-insights.yml` at the same time.
