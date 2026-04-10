# Release Workflows

Declaro uses a two-track release system managed by GitHub Actions workflows.

## Overview

```
develop ──push──> Beta Release (automatic)
   │                 publishes X.Y.Z-beta.N with `beta` dist-tag
   │
   │  workflow_dispatch
   ├──────────────> release/X.Y.Z branch created
   │                 │
   │                 │  PR merged
   │                 └──────────> main ──push──> Stable Release (automatic)
   │                                              publishes X.Y.Z with `latest` dist-tag
   │                                              │
   │                                              │  creates backport PR
   │   cherry-pick version bumps                  │
   │◄─────────────── backport/X.Y.Z ◄────────────┘
   │
   │  merge backport PR
   ├◄──────────────── (develop back in sync)
```

**Beta Track** — Every push to `develop` publishes prerelease packages automatically.

**Stable Track** — Manual release creation, controlled publishing via `main`, automated backporting.

---

## Beta Track (Automatic)

**Workflow:** `release.yml`
**Trigger:** Push to `develop`

Every push to `develop` automatically:

1. Builds all packages
2. Runs typechecking
3. Runs tests
4. Publishes all `@declaro/*` packages to npm with the `beta` dist-tag

Version format: `X.Y.Z-beta.N` (e.g., `2.0.0-beta.142` -> `2.0.0-beta.143`)

The beta number auto-increments on each push. All packages are published in lock-step using `--force-publish`, ensuring every package always has the same version.

**No manual action is needed** for beta releases. They happen on every push to `develop`.

---

## Creating a Stable Release

**Workflow:** `release-create.yml`
**Trigger:** Manual (`workflow_dispatch`)

### Steps

1. Go to the **Actions** tab in GitHub
2. Select **"Create Release Branch"** from the left sidebar
3. Click **"Run workflow"**
4. Select the `develop` branch and click **"Run workflow"**

### What happens automatically

1. The workflow reads the current version from `lerna.json` and determines the next minor version
2. It checks existing `release/*` branches and git tags to prevent version collisions
3. A `release/X.Y.Z` branch is created from `develop`
4. All package versions are updated to `X.Y.Z` (clean, no prerelease suffix) using `lerna version --force-publish` to keep all packages in lock-step
5. A PR is opened from `release/X.Y.Z` into `main`
6. A **draft** GitHub Release is created for `vX.Y.Z`

### Version resolution logic

The next version is computed by:

1. Reading the base version from `lerna.json` (stripping any `-beta.N` suffix)
2. Scanning all existing `release/*` branches for their version numbers
3. Scanning all git tags for published versions
4. Taking the highest version found across all sources
5. Incrementing the minor version (e.g., `2.0.0` -> `2.1.0`, `2.1.0` -> `2.2.0`)

This means:
- If `release/2.1.0` already exists, the next release creates `release/2.2.0`
- Multiple release PRs can be in flight without version collisions

### Before merging the release PR

- Review the changes in the PR
- Optionally push additional commits to the `release/X.Y.Z` branch for last-minute fixes
- CI runs automatically on the PR (build, typecheck, tests)
- When ready, merge the PR into `main`

---

## Publishing a Stable Release

**Workflow:** `release-stable.yml`
**Trigger:** Push to `main`

When a PR is merged into `main`, the stable release workflow runs automatically.

### For release branch merges (minor releases)

When the merge comes from a `release/*` branch:

1. The version is already set in the package files from the release branch
2. All packages are built, typechecked, and tested
3. All `@declaro/*` packages are published to npm with the **`latest`** dist-tag
4. A git tag `vX.Y.Z` is created
5. The draft GitHub Release is finalized and published
6. A `backport/X.Y.Z` branch is created from `main`
7. A PR is opened from `backport/X.Y.Z` into `develop`

### For other merges (patch releases)

When any non-release branch is merged into `main` (e.g., a hotfix):

1. A patch version bump is applied to all packages in lock-step (`2.1.0` -> `2.1.1`)
2. The same build/test/publish/tag/release flow runs
3. A backport PR is created to flow changes back to `develop`

---

## Backporting

**Workflow:** `backport.yml`
**Trigger:** Push to `develop`

After a stable release, a `backport/X.Y.Z` PR exists from `main` into `develop`. This PR carries any changes from `main` (the stable release, hotfixes, etc.) back into `develop`.

### The version conflict problem

When a stable release publishes to `main`, the version numbers on `main` (e.g., `2.1.0`) conflict with develop's version numbers (e.g., `2.2.0-beta.5`). Meanwhile, `develop` continues to receive beta builds that auto-increment versions, so the backport branch falls further out of sync.

### How automated cherry-picking solves it

On every push to `develop`, the backport workflow:

1. Checks if any open `backport/*` PRs exist (skips if none)
2. Identifies automated version bump commits on `develop` (commits from `github-actions[bot]` with message matching `vX.Y.Z-beta.N`)
3. Cherry-picks only those version bump commits onto the backport branch, using `-X theirs` to accept develop's version numbers
4. Pushes the updated branch
5. Posts a comment on the backport PR noting which versions were cherry-picked

This ensures the backport branch's version numbers always match develop's latest, preventing merge conflicts on `lerna.json` and `package.json` files.

### What requires manual resolution

- Non-version merge conflicts (e.g., conflicting code changes in the same file)
- Manually edited version numbers on `develop` that don't match the automated pattern

### Merging the backport PR

After reviewing the backport PR:
1. Resolve any non-version merge conflicts
2. Merge the PR into `develop`
3. This triggers a beta release (as usual for any push to `develop`)

---

## Hotfixes / Patch Releases

To ship a hotfix to production:

1. Create a branch from `main` (e.g., `fix/critical-bug`)
2. Commit the fix
3. Open a PR into `main`
4. Merge the PR

The stable release workflow detects this is not from a `release/*` branch and automatically:
- Applies a patch version bump (e.g., `2.1.0` -> `2.1.1`)
- Publishes all packages with the `latest` dist-tag
- Creates a backport PR to flow the fix back to `develop`

---

## Major Version Bumps

Major version increments are handled manually:

1. On `develop`, manually update the version:
   ```bash
   bun lerna version major --no-push --yes --force-publish
   ```
2. Commit and push to `develop`
3. Use the **Create Release Branch** workflow to create the release
4. The release branch will have the correct major version

Alternatively, manually create a `release/X.0.0` branch and update versions by hand.

---

## Version Management

### Lock-step versioning

All `@declaro/*` packages always share the same version number. This is enforced by using `--force-publish` with every Lerna version/publish command:

| Operation | Command | Lock-step |
|---|---|---|
| Beta release | `lerna publish prerelease --force-publish` | All packages bumped |
| Release branch creation | `lerna version X.Y.Z --force-publish` | All packages set to exact version |
| Patch bump on main | `lerna version patch --force-publish` | All packages patched |
| Stable publish | `lerna publish from-package` | All differing packages published |

### Files updated during version changes

Every version operation updates these files:
- `lerna.json` (monorepo version)
- `lib/core/package.json`
- `lib/auth/package.json`
- `lib/data/package.json`
- `lib/redis/package.json`
- `lib/zod/package.json`
- `apps/framework/package.json`

### npm dist-tags

| Tag | Source | Example |
|---|---|---|
| `beta` | Pushes to `develop` | `2.0.0-beta.142` |
| `latest` | Merges to `main` | `2.1.0` |

Users install stable versions by default (`bun add @declaro/core`) and can opt into beta with `bun add @declaro/core@beta`.

---

## Workflow Files

| File | Trigger | Purpose |
|---|---|---|
| `release.yml` | Push to `develop` | Beta prerelease publish |
| `release-create.yml` | Manual (workflow_dispatch) | Create release branch + PR |
| `release-stable.yml` | Push to `main` | Stable release publish |
| `backport.yml` | Push to `develop` | Cherry-pick version bumps onto backport branches |
| `ci.yml` | PR/push to `develop` or `main` | Build, typecheck, test, integration |

---

## Setup Requirements

### GitHub Secrets

| Secret | Purpose | How to obtain |
|---|---|---|
| `NPM_TOKEN` | Publish packages to npm | [npmjs.com](https://www.npmjs.com/) -> Account -> Access Tokens -> Create "Automation" token |
| `GITHUB_TOKEN` | Git operations, PRs, releases | Automatically provided by GitHub Actions |

### Branch prerequisites

- The `develop` branch must exist (this is the primary development branch)
- The `main` branch is created automatically by `release-create.yml` on first run if it doesn't exist

---

## Troubleshooting

### "Release branch already exists"

The `release-create.yml` workflow failed because a `release/X.Y.Z` branch already exists. Either:
- Delete the stale branch if the release was abandoned
- Or the workflow will automatically skip to the next minor version

### Stable release publish failed mid-way

If `release-stable.yml` fails after some packages were published but before the tag was created:
1. The published packages are already on npm (this is fine - they're immutable)
2. Re-run the workflow from the failed step
3. `lerna publish from-package` is idempotent - it skips already-published versions

### Backport PR has merge conflicts

Non-version conflicts require manual resolution:
1. Checkout the backport branch locally
2. Merge or rebase against `develop` to resolve conflicts
3. Push the resolved branch
4. The backport workflow will continue cherry-picking version bumps on subsequent `develop` pushes

### Beta releases stopped working

The `release.yml` workflow is independent of the stable release system. If beta releases stop:
1. Check the Actions tab for error logs
2. Verify `NPM_TOKEN` is still valid
3. Verify `develop` branch protection rules allow `github-actions[bot]` to push

### Concurrent releases

Multiple `release/*` branches can coexist safely. The version resolution logic checks all existing branches and tags to compute the next version, preventing collisions.
