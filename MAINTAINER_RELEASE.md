# Maintainer Release Guide

This file is for project maintainers and release owners.

## GitHub Release + Packages (GHCR)
This repository is configured to publish both release assets and a backend container image when a GitHub Release is published.

What happens automatically on release publish:
- uploads `unisearch-frontend-vX.Y.Z.zip` to the release
- uploads `unisearch-backend-vX.Y.Z.zip` to the release
- publishes backend image to:
  - `ghcr.io/<owner>/unisearch-backend:vX.Y.Z`
  - `ghcr.io/<owner>/unisearch-backend:X.Y.Z`
  - `ghcr.io/<owner>/unisearch-backend:latest`

How to trigger:
1. Push all changes to `main`.
2. Create and push a tag (example `v2.4.1`):
   ```bash
   git tag v2.4.1
   git push origin v2.4.1
   ```
3. In GitHub, open Releases and publish a release for that tag.
4. Wait for the workflow `Release Artifacts And Container` to finish.
