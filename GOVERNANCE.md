# UniSearch Project Governance

This document details the governance structure, decision-making processes, roles, and continuity plans for the UniSearch project.

UniSearch is an open-source academic search and recommendation platform dedicated to transparent, verified bachelor-level admissions discovery.

---

## 1. Governance Model

UniSearch is led jointly by its two co-founders, balanced by transparent public discussions, community pull request reviews, and documented design and architectural standards.

* **Open Discussions:** Feature proposals, scope expansions, and major refactors are discussed openly in GitHub Issues and Discussions.
* **Merit & Quality Focus:** Decisions are guided by product mission (bachelor-level focus), design system compliance (borderless Calm Academic Workspace), verified data accuracy, and automated test coverage thresholds.
* **Co-founder Decisions:** Major architectural, security, and release decisions are made jointly by the co-founders.

---

## 2. Roles and Responsibilities

| Role | Current Role Holders | Key Responsibilities | Access Level |
| --- | --- | --- | --- |
| **Co-founder & Lead Developer** | [Mukhammed Shabdaluly (@mukhammedsh)](https://github.com/mukhammedsh) | Core development, technical architecture, release signing, security disclosures, and repository administration. | Owner / Full Admin |
| **Co-founder & UI/UX Lead** | [Yerbolat Rashidov (@raiselx)](https://github.com/raiselx) | UI/UX design direction, Calm Academic Workspace specification (`docs/design-system.md`), frontend styling reviews, and design token integrity. | Maintain / Write |
| **Core Contributors** | Appointed upon nomination | Code review, triage, subsystem maintenance (frontend, backend, data catalog), authoring tests. | Write (Branch & PR access) |
| **Community Contributors** | Open to all participants | Bug reports, localized translation fixes, university data corrections, feature PRs. | Read / Fork & PR |
| **Security Response Team** | Co-founders + Designated Security Officer | Triage vulnerabilities reported via `SECURITY.md`, CVE coordination, patch release. | Admin / Secret Access |

### Becoming a Role Holder

* **Community Contributor:** Anyone who submits a pull request, opens an issue, or participates in discussions following [CONTRIBUTING.md](file:///c:/my%20projects/unisearch/CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](file:///c:/my%20projects/unisearch/CODE_OF_CONDUCT.md).
* **Core Contributor:**
  - Demonstrated track record of high-quality, focused contributions (minimum 5 merged PRs).
  - Strong adherence to engineering guidelines: zero hardcoded colors, strict adherence to `docs/design-system.md`, and maintaining >= 80% test coverage.
  - Active participation in reviewing peer pull requests.
  - Sponsoring and approval by a co-founder.
* **Co-founder roles:** Held by the project founders; any change to these roles requires their joint agreement.

### Stepping Down and Emeritus Status

* Role holders may step down voluntarily at any time by notifying the co-founders.
* Core Contributors who remain inactive for more than 6 months will be transitioned to **Emeritus** status, retaining public attribution while administrative write permissions are safely archived.
* A role holder may be removed immediately by joint co-founder decision for repeated violations of [CODE_OF_CONDUCT.md](file:///c:/my%20projects/unisearch/CODE_OF_CONDUCT.md) or gross negligence regarding repository security.

---

## 3. Decision-Making & Dispute Resolution

### Day-to-Day Development
* Routine fixes, documentation edits, and small feature additions are proposed via Pull Requests.
* PRs require passing automated CI/CD checks (linting, encoding, token checks, unit and E2E suites) and approval from at least one maintainer or core contributor.

### Major Architectural Changes (RFC Process)
* Non-trivial changes (e.g., PostgreSQL migration, Google Auth integration, new scoring algorithms) require an **RFC (Request for Comments)** issue.
* RFCs remain open for community discussion for a minimum of 7 calendar days before a decision is reached.

### Dispute Resolution
1. **Consensus Seeking:** Contributors strive to reach technical consensus by evaluating against existing design principles, verified fact requirements, and performance budgets.
2. **Design System & Architectural Tie-Breaker:** In case of disagreement, proposals adhering closest to [docs/design-system.md](file:///c:/my%20projects/unisearch/docs/design-system.md) and [docs/architecture.md](file:///c:/my%20projects/unisearch/docs/architecture.md) take precedence.
3. **Co-founder Ruling:** If consensus cannot be achieved, the co-founders make the final ruling with a written explanation on the PR or issue.

---

## 4. Continuity & Succession Plan (Bus Factor & Access Continuity)

To satisfy OpenSSF sustainability requirements (`bus_factor` and `access_continuity`), UniSearch implements clear measures to ensure uninterrupted project maintenance:

### Access Redundancy & Bus Factor
* **Bus Factor (>= 2):** Administrative and engineering continuity is distributed between [Mukhammed Shabdaluly (@mukhammedsh)](https://github.com/mukhammedsh), Co-founder & Lead Developer, and [Yerbolat Rashidov (@raiselx)](https://github.com/raiselx), Co-founder & UI/UX Lead. Both key members have write access and deep domain knowledge of their respective areas (Backend/Scoring and Frontend/UI/UX), ensuring the project maintains a verified bus factor of at least two.
* **Repository Administration:** Administrative control of the GitHub repository and GitHub Container Registry (GHCR) is backed by both maintainers with hardware or authenticator 2FA enabled.
* **Credential & Secret Custody:** Production deployment keys, domain DNS management credentials, and publishing secrets are securely archived in an encrypted organizational credential vault with emergency access delegation configured between the lead maintainers.

### Unavailability / Succession Protocol (Within 7 Days)
* If either co-founder is unreachable or incapacitated for more than 30 consecutive days without prior handover notice:
  1. The other co-founder or organization trustee triggers emergency credential recovery if needed.
  2. Full triage, code review, and maintenance authority is consolidated.
  3. Essential administrative operations—such as closing issues, merging approved pull requests, security patching, and issuing maintenance releases—resume within 7 calendar days.

---

## 5. Community & Ethics

UniSearch values a welcoming, inclusive, and harassment-free environment. All participants, maintainers, and contributors are required to uphold the standards described in [CODE_OF_CONDUCT.md](file:///c:/my%20projects/unisearch/CODE_OF_CONDUCT.md). Violations are enforced strictly according to the stepped enforcement guidelines.
