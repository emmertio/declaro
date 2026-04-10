# GitHub Actions Workflows

For comprehensive documentation of the release system, see [docs/release-workflows.md](../docs/release-workflows.md).

## Workflows

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| CI | `ci.yml` | PR/push to `develop` or `main` | Build, typecheck, test, integration |
| Beta Release | `release.yml` | Push to `develop` | Publish prerelease packages (`beta` dist-tag) |
| Create Release Branch | `release-create.yml` | Manual (workflow_dispatch) | Create `release/X.Y.Z` branch and PR to `main` |
| Stable Release | `release-stable.yml` | Push to `main` | Publish stable packages (`latest` dist-tag) |
| Backport Sync | `backport.yml` | Push to `develop` | Cherry-pick version bumps onto backport branches |

## Setup Requirements

Before workflows can run successfully, configure the following secrets in your GitHub repository:

1. **NPM_TOKEN**: A token for publishing to npm registry

    - Go to [npm.com](https://www.npmjs.com/) → Account → Access Tokens
    - Create a new "Automation" token
    - Add it as a repository secret named `NPM_TOKEN`

2. **GITHUB_TOKEN**: This is automatically provided by GitHub Actions (no setup needed)
