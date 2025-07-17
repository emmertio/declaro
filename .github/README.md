# GitHub Actions Workflows

## Release Workflow

The `release.yml` workflow automatically creates pre-releases on every push to the `develop` branch.

### Setup Requirements

Before this workflow can run successfully, you need to configure the following secrets in your GitHub repository:

1. **NPM_TOKEN**: A token for publishing to npm registry

    - Go to [npm.com](https://www.npmjs.com/) → Account → Access Tokens
    - Create a new "Automation" token
    - Add it as a repository secret named `NPM_TOKEN`

2. **GITHUB_TOKEN**: This is automatically provided by GitHub Actions (no setup needed)

### Workflow Behavior

When you push to the `develop` branch, the workflow will:

1. ✅ Run type checking (`bun typecheck`)
2. ✅ Run tests (`bun test`)
3. ✅ Build all packages (`bun run build`)
4. 🚀 Publish pre-release versions with:
    - **Beta increment only**: Automatically increments the beta number only
    - **Pre-release identifier**: `beta` (e.g., `1.2.3-beta.12`)
    - **Manual version changes**: Base version (1.2.3) requires manual intervention
    - **Force publish**: All packages are published even if unchanged

### Pre-release Versioning

The workflow automatically increments **beta numbers only**:

-   All commits → beta increment (e.g., `1.2.3-beta.11` → `1.2.3-beta.12`)
-   Base version changes (1.2.3 → 1.2.4) must be done manually
-   For version control, use: `bun lerna version --conventional-commits`

Example version progression:

-   `1.2.3-beta.11` → `1.2.3-beta.12` (automatic beta increment)
-   `1.2.3-beta.12` → `1.2.3-beta.13` (subsequent pushes)

### Manual Version Control

For base version changes, run manually:

```bash
# For patch version change (1.2.3 → 1.2.4)
bun lerna version patch --conventional-commits

# For minor version change (1.2.3 → 1.3.0)
bun lerna version minor --conventional-commits

# For major version change (1.2.3 → 2.0.0)
bun lerna version major --conventional-commits
```
