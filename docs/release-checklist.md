# Release checklist

Use this checklist to prepare a version. Follow `AGENTS.md` for versioning, branch, DCO, and local-commit rules. Preparing or committing a release does not authorize a push, tag, or publication.

## Prepare the version

1. Review `git status --short`, `git diff --stat`, the full diff, and untracked files. Check for unrelated files and secrets.
2. Compare `package.json` with the latest version tag. If the package is ahead, continue that version. If it matches the latest tag, bump the smallest SemVer level justified by the change, for example `npm run bump:version -- patch`.
3. Add a distinct, factual block to `CHANGELOG.md` for the current version. Update functional documentation affected by the changes; keep version history out of `README.md`.
4. Run the required checks from the repository root:

   ```bash
   npm run fix:encoding
   npm run check:encoding
   npm run check:version
   npm run check:tokens
   npm run check:i18n
   npm run audit:data
   npm run test:backend
   ```

   Activate `backend/.venv` before `npm run audit:data`. Run focused tests required by the changed behavior. Reserve broad suites for final pre-release validation.

5. Review the staged diff. Make a local signed-off commit on a non-default branch only; follow `AGENTS.md` for the exact commit rules.

## Publish after explicit permission

1. Push the branch and create the annotated final-version tag only after the user explicitly authorizes those actions:

   ```bash
   git push origin your-branch-name
   git tag -a vX.Y.Z -m "UniSearch X.Y.Z"
   git push origin vX.Y.Z
   ```

2. Check all required GitHub Actions runs through a final success or failure state and report their links. Do not describe a pending run as complete.
3. Creating a GitHub Release requires separate explicit permission. Before publication, inspect the latest published release and include all changes from every newer version or tag, including tags without their own release.
4. After an authorized release, verify its public page and assets:

   ```bash
   gh release view vX.Y.Z --json assets,body,zipballUrl,tarballUrl
   ```

   Confirm the custom assets `unisearch-full-vX.Y.Z.zip`, `unisearch-frontend-vX.Y.Z.zip`, and `unisearch-backend-vX.Y.Z.zip`; each custom ZIP must contain `LICENSE`. Confirm the release body has the Download guide block and GitHub's source archive links are present.
