# Release checklist

Use this checklist for release PRs or direct release commits.

1. Inspect the actual diff:
   ```bash
   git status --short
   git diff --stat
   git diff
   ```
2. Check for local-only or sensitive files:
   ```bash
   git status --short
   git ls-files -o --exclude-standard
   ```
3. Bump the version from the repository root:
   ```bash
   npm run bump:version -- patch
   ```
4. Update `CHANGELOG.md` from the actual diff.
5. Update `README.md` recent releases and any functional docs affected by the change.
6. Run minimum release checks:
   ```bash
   npm run fix:encoding
   npm run check:encoding
   npm run check:i18n
   npm run test:backend
   ```
7. Commit and push.
8. Create and push an annotated tag:
   ```bash
   git tag -a vX.Y.Z -m "UniSearch X.Y.Z"
   git push origin vX.Y.Z
   ```
9. Check GitHub Actions for the branch push and tag/release work before calling the release complete.
10. For a published GitHub Release, verify the release UI contract:
    ```bash
    gh release view vX.Y.Z --json assets,body,zipballUrl,tarballUrl
    ```
    - custom assets include `unisearch-full-vX.Y.Z.zip`, `unisearch-frontend-vX.Y.Z.zip`, and `unisearch-backend-vX.Y.Z.zip`
    - the release body contains the Download guide block
    - GitHub's automatic `Source code (zip)` and `Source code (tar.gz)` links are present and expected
