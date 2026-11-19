# OSPS Baseline Tracking

UniSearch tracks its security posture against the Open Source Project Security (OSPS) Baseline.
This document records a point-in-time self-assessment; it is not an independent audit or certification.

## Review status

The published badges are based on the full 2026-10-15 self-assessment; individual evidence below retains its verification date. Repository workflows and branch settings changed afterward, so older control statuses are a historical snapshot and must be rechecked before the next compliance statement. A targeted read-only check on 2026-11-19 verified the current `main` ruleset; it did not re-attest the other controls.

## Target

UniSearch has earned **OSPS Baseline Levels 1 and 2, version 2026.08.28**. The next
assessment target is **Level 3** of the same version. Level 3 has not been assessed or
submitted.

## Badge status

UniSearch already holds the Silver badge in the Metal series of [OpenSSF Best
Practices project 14732](https://www.bestpractices.dev/projects/14732). The OSPS
Baseline is a separate series in the same project entry. On 2026-10-15, UniSearch
earned the [OSPS Baseline Level 1 badge](https://www.bestpractices.dev/projects/14732/baseline-1)
and the [Level 2 badge](https://www.bestpractices.dev/projects/14732/baseline-2) for
version 2026.08.28. Level 3 has not been assessed.

## Level 1 assessment

| Control | Status | Evidence or next action |
| --- | --- | --- |
| OSPS-AC-01.01 MFA for sensitive actions | Met | The maintainer confirms all repository administrators have MFA enabled with security keys. Verified 2026-10-15. |
| OSPS-AC-02.01 Restrict collaborator permissions | Met | GitHub grants collaborator access to this personal repository only by an explicit owner invitation. General contributors use forks and pull requests; direct write access is reserved for trusted maintainers. Verified 2026-10-15. |
| OSPS-AC-03.01 Protect the primary branch from direct commits | Met | GitHub API verification on 2026-11-19 found an active `main` ruleset requiring pull requests and ten status checks, blocking deletion and non-fast-forward updates, with no bypass actors. It requires thread resolution but zero approving reviews; code-owner and last-push approval are disabled. |
| OSPS-AC-03.02 Protect the primary branch from deletion | Met | The active `main` ruleset blocks deletion. Verified 2026-11-19. |
| OSPS-BR-01.01 Sanitize untrusted CI metadata | Met | Workflow review found no unvalidated branch, pull-request, or manual inputs. Release tags are strictly validated before checkout or publication steps use them. |
| OSPS-BR-01.03 Isolate untrusted CI code | Met | Fork-origin pull requests receive a read-only token and no repository secrets. `CODECOV_TOKEN` is passed only to Codecov upload steps; published-release credentials are isolated to the release workflow. |
| OSPS-BR-03.01 Encrypt official project channels | Met | Public project and repository channels use HTTPS; plain HTTP references are limited to localhost development and the private Docker proxy upstream. |
| OSPS-BR-03.02 Authenticate distribution channels | Met | Official releases are distributed through GitHub Releases over HTTPS. |
| OSPS-BR-07.01 Prevent committed secrets | Met | GitHub secret scanning and push protection are enabled; repository guards and Trivy also scan tracked files. Verified 2026-10-15. |
| OSPS-DO-01.01 Document basic functionality | Met | [README](../README.md) documents setup, configuration, operation, and checks. |
| OSPS-DO-02.01 Provide defect-reporting guide | Met | GitHub issue templates provide bug reporting guidance. |
| OSPS-GV-02.01 Provide public discussion mechanisms | Met | [Governance](../GOVERNANCE.md) directs proposals and discussions to GitHub Issues and Discussions. |
| OSPS-GV-03.01 Explain contribution process | Met | [CONTRIBUTING.md](../CONTRIBUTING.md) explains the contribution process. |
| OSPS-LE-02.01 and OSPS-LE-03.01 Source license | Met | The source license is MIT and is present in [LICENSE](../LICENSE). |
| OSPS-LE-02.02 and OSPS-LE-03.02 Release-asset license | Met | The successful `v8.1.7` release workflow includes `LICENSE` in its frontend and backend ZIPs; the published frontend ZIP was checked and contains the root `LICENSE` file. Verified 2026-10-15. |
| OSPS-QA-01.01 and OSPS-QA-01.02 Public source and history | Met | The authoritative repository and its Git history are publicly readable. |
| OSPS-QA-02.01 Dependency list | Met | `package-lock.json` and Python requirements lock files record direct dependencies. |
| OSPS-QA-04.01 Multi-repository scope | N/A | UniSearch has one authoritative source repository; this control applies to projects with multiple repositories. |
| OSPS-QA-05.01 and OSPS-QA-05.02 No generated or unreviewable binaries in VCS | Met | The repository contains no tracked executable or compiled artifacts. Its binary files are source-controlled university media (PNG, JPG, WebP, and SVG) used by the application. |
| OSPS-VM-02.01 Security contacts | Met | [SECURITY.md](../SECURITY.md) lists private GitHub reporting and an email contact. |

## Level 2 assessment

The BadgeApp self-assessment recorded 18 controls as Met and OSPS-VM-04.01 as N/A
because there are no publicly disclosed UniSearch vulnerability advisories. See the
[public Level 2 record](https://www.bestpractices.dev/projects/14732/baseline-2) for
the control-by-control statuses and justifications. This point-in-time self-assessment
is not an independent audit or certification.

## Evidence and automation

- `security-insights.yml` is the machine-readable declaration used by OSPS-compatible tooling.
- GitHub Actions runs CodeQL, dependency auditing, Trivy, Scorecard, fuzzing, and the test suites.
- On 2026-11-19, the active `main` ruleset required these ten checks: `backend-tests`, `e2e-pr`, `hygiene`, `dependency-audit`, `repository-guards`, `CodeQL (python)`, `CodeQL (javascript-typescript)`, `Trivy (secrets and configuration)`, `SonarCloud Code Analysis`, and `DCO`.
- Contributor commits require DCO sign-off; the installed DCO App check is required by the ruleset.
- Release automation verifies and publishes GitHub build provenance bundles alongside all three ZIP artifacts and attests the container image.
- The OpenSSF Best Practices Badge application accepts human-reviewed OSPS Baseline self-assessments; its saved project record remains the source of the displayed badge status.

## Review cadence

Review this assessment after a material CI/CD, release, governance, or security-policy
change, and at least before each published compliance statement. Update the date in
`security-insights.yml` at the same time.
