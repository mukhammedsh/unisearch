# UniSearch Project Governance

This document details the governance structure, decision-making processes, roles, and continuity plans for the UniSearch project.

UniSearch is an open-source academic search and recommendation platform for transparent, source-backed university discovery across undergraduate, master's, doctoral, and professional study.

---

## 1. Governance Model

UniSearch is led jointly by its two co-founders, balanced by transparent public discussions, community pull request reviews, and documented design and architectural standards.

* **Open Discussions:** Feature proposals, scope expansions, and major refactors are discussed openly in GitHub Issues and Discussions.
* **Merit & Quality Focus:** Decisions are guided by the [admissions product model](docs/admissions-product-model.md), design system compliance (borderless Calm Academic Workspace), verified data accuracy, and automated test coverage thresholds.
* **Co-founder Decisions:** Major architectural, security, and release decisions are made jointly by the co-founders.

---

## 2. Roles and Responsibilities

| Role | Current Role Holders | Key Responsibilities | Access Level |
| --- | --- | --- | --- |
| **Co-founder & Lead Developer** | [Mukhammed Shabdaluly (@mukhammedsh)](https://github.com/mukhammedsh) | Core development, technical architecture, release signing, security disclosures, and repository administration. | GitHub repository Admin |
| **Co-founder & UI/UX Lead** | [Yerbolat Rashidov (@raiselx)](https://github.com/raiselx) | UI/UX design direction, Calm Academic Workspace specification (`docs/design-system.md`), frontend styling reviews, and design token integrity. | GitHub repository Write |
| **Core Contributors** | Named after nomination and approval | Code review, triage, subsystem maintenance (frontend, backend, data catalog), authoring tests. | Write only when separately granted |
| **Community Contributors** | Open to all participants | Bug reports, localized translation fixes, university data corrections, feature PRs. | Read / Fork & PR |

### Current Sensitive Access

The GitHub repository's collaborator list was reviewed on 2026-10-15:

| GitHub identity | Repository permission | Sensitive access |
| --- | --- | --- |
| [@mukhammedsh](https://github.com/mukhammedsh) | Admin (sole repository Admin) | Can manage repository settings, rulesets, and Actions secrets; primary security-report contact and release maintainer. |
| [@raiselx](https://github.com/raiselx) | Write | Trusted co-founder and code reviewer. Write access can use repository Actions secrets in workflows; it is therefore treated as sensitive access. |
| DCO GitHub App | Installed for this repository only | Read access to code, merge queues, metadata, and pull requests; write access to commit-check statuses. It verifies per-commit DCO sign-off. |

Community contributors use forks and pull requests and do not receive repository secrets through fork-triggered workflows. The current project policy designates the two co-founders above as custodians of the encrypted project vault holding production-hosting, DNS, and publishing credentials. Keep provider access aligned with this list and review it whenever a role changes. No credential values belong in this document.

Security reports go to the contacts in [SECURITY.md](SECURITY.md). The repository owner leads triage; the co-founder provides review and continuity. Repository role names do not imply that every role holder can administer GitHub settings or secrets.

### Access Review Before Escalating Permissions

Before granting a contributor write, maintain, admin, or secret access, the repository owner:

1. Reviews the contributor's relevant contribution and review history and confirms that fork-and-pull-request access is insufficient for the work.
2. Confirms the requested scope, checks that MFA is enabled for sensitive repository access, and selects the least-privileged GitHub role that supports the task.
3. Records the person's identity, permission, purpose, approver, and review date in this document; grants secret or production access separately only when needed.
4. Reviews access when the task ends, responsibilities change, or the person leaves the project, and removes access that is no longer needed.

### Becoming a Role Holder

* **Community Contributor:** Anyone who submits a pull request, opens an issue, or participates in discussions following [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
* **Core Contributor:**
  - Demonstrated track record of high-quality, focused contributions (minimum 5 merged PRs).
  - Strong adherence to engineering guidelines: zero hardcoded colors, strict adherence to `docs/design-system.md`, and maintaining >= 80% test coverage.
  - Active participation in reviewing peer pull requests.
  - Sponsoring and approval by a co-founder.
* **Co-founder roles:** Held by the project founders; any change to these roles requires their joint agreement.

### Stepping Down and Emeritus Status

* Role holders may step down voluntarily at any time by notifying the co-founders.
* Core Contributors who remain inactive for more than 6 months will be transitioned to **Emeritus** status, retaining public attribution while administrative write permissions are safely archived.
* A role holder may be removed immediately by joint co-founder decision for repeated violations of [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) or gross negligence regarding repository security.

---

## 3. Decision-Making & Dispute Resolution

### Day-to-Day Development
* Routine fixes, documentation edits, and small feature additions are proposed via Pull Requests.
* PRs require passing automated CI/CD checks (linting, encoding, token checks, unit and E2E suites); maintainer or core-contributor approval is optional.

### Major Architectural Changes (RFC Process)
* Non-trivial changes (e.g., PostgreSQL migration, Google Auth integration, new scoring algorithms) require an **RFC (Request for Comments)** issue.
* RFCs remain open for community discussion for a minimum of 7 calendar days before a decision is reached.

### Dispute Resolution
1. **Consensus Seeking:** Contributors strive to reach technical consensus by evaluating against existing design principles, verified fact requirements, and performance budgets.
2. **Design System & Architectural Tie-Breaker:** In case of disagreement, proposals adhering closest to [docs/design-system.md](docs/design-system.md) and [docs/architecture.md](docs/architecture.md) take precedence.
3. **Co-founder Ruling:** If consensus cannot be achieved, the co-founders make the final ruling with a written explanation on the PR or issue.

---

## 4. Continuity & Succession Plan (Bus Factor & Access Continuity)

To satisfy OpenSSF sustainability requirements (`bus_factor` and `access_continuity`), UniSearch implements clear measures to ensure uninterrupted project maintenance:

### Access Redundancy & Bus Factor
* **Bus Factor (>= 2):** Administrative and engineering continuity is distributed between [Mukhammed Shabdaluly (@mukhammedsh)](https://github.com/mukhammedsh), Co-founder & Lead Developer, and [Yerbolat Rashidov (@raiselx)](https://github.com/raiselx), Co-founder & UI/UX Lead. Both key members have write access and deep domain knowledge of their respective areas (Backend/Scoring and Frontend/UI/UX), ensuring the project maintains a verified bus factor of at least two.
* **Repository Administration:** GitHub currently lists @mukhammedsh as the sole repository Admin and @raiselx with Write access. The maintainer confirmed administrator MFA with security keys on 2026-10-15. The owner manages repository settings and Actions secrets; any new sensitive access must require MFA.
* **Credential & Secret Custody:** Production deployment keys, domain DNS management credentials, and publishing secrets are documented as residing in an encrypted project vault with emergency access delegation between the lead maintainers. Review the actual provider and vault access whenever responsibilities change.

### Unavailability / Succession Protocol (Within 7 Days)
* If either co-founder is unreachable or incapacitated for more than 30 consecutive days without prior handover notice:
  1. The other co-founder or organization trustee triggers emergency credential recovery if needed.
  2. Full triage, code review, and maintenance authority is consolidated.
  3. Essential administrative operations—such as closing issues, merging approved pull requests, security patching, and issuing maintenance releases—resume within 7 calendar days.

---

## 5. Community & Ethics

UniSearch values a welcoming, inclusive, and harassment-free environment. All participants, maintainers, and contributors are required to uphold the standards described in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Violations are enforced strictly according to the stepped enforcement guidelines.
