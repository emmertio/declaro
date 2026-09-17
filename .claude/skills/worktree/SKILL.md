---
name: worktree
description: Set up and tear down the git worktrees this repo uses for feature work — branch a new worktree from the latest active release branch, and retire worktrees whose PR has merged. Use when starting any new unit of work, and after a PR merges to clean up its worktree.
---

# Worktrees

Feature work happens in worktrees under `worktrees/` (gitignored); the parent
checkout stays on `develop` and stays clean. A worktree exists exactly as
long as its branch has unfinished business.

## Repository conventions

- Worktrees live in `worktrees/` at the repo root, ignored by git, and
  enumerable via `git worktree list`.
- The directory name is the branch name without its type prefix:
  `fix/serialize-validate-false` → `worktrees/serialize-validate-false`.
- `develop` is the **active release branch** (named in CLAUDE.md → Git
  workflow). Feature work branches from it and PRs target it. Every push to
  `develop` publishes a beta release.
- `main` and `release/*` are production branches, managed by the release
  workflows (see `docs/release-workflows.md`). They get different teardown
  rules (see [Production branches](#production-branches)).
- Branch names follow the pattern already on `develop`: `feat/`, `fix/`, `ci/`,
  `docs/`, or `chore/` plus a short kebab-case description. If a GitHub issue
  is in context, reference its number: `feat/61-release-workflow`.

## Setting up a new worktree

1. **Sweep for retired worktrees first** (see below) — setup time is when
   stale ones get noticed.
2. **Fetch, and branch from `origin/develop`, never a local ref.** The parent
   checkout's local ref is a trap: a dirty parent (even one modified file)
   makes `git pull` abort, and when the output is trimmed (`| tail`) the abort
   is invisible — the worktree then silently branches from a stale tip and the
   mistake surfaces later as CI-only failures against code the branch has
   never seen. Branching from the remote-tracking ref sidesteps the parent's
   state entirely:

   ```bash
   git fetch origin
   git worktree add worktrees/<name> -b <branch> origin/develop
   ```

   After creating, confirm: `git -C worktrees/<name> rev-parse HEAD` must
   equal `git rev-parse origin/develop`. If the parent checkout is dirty,
   also say so — its changes belong to someone; never stash or discard them to
   make a pull work.

   **Do not let the harness `EnterWorktree` tool create the worktree.** It
   branches from `origin/<default-branch>`, which is `main` here — that gives
   you release commits you do not want and a PR full of noise — and it puts
   the worktree under `.claude/worktrees/`, not `worktrees/`. Create the
   worktree explicitly as above, then `EnterWorktree` with the `path` argument
   to switch the session into it.

   `git worktree add` sets the new branch's upstream to `origin/develop`, which
   is wrong for pushing. Fix it on the first push:

   ```bash
   git push -u origin <branch>
   ```

   **Told to branch from something other than `develop` — a stacking
   instruction — check first whether that branch has already merged.** Such an
   instruction ("branch from `<other>`, open a stacked PR against it, its
   commits exist nowhere else") describes the state at the moment it was
   written, and that state changes while the instruction waits to be acted on.
   Once the named branch merges, its commits are in `develop`, the reason for
   stacking has evaporated, and a stacked PR targets a base that is about to
   disappear:

   ```bash
   gh pr list --head <named-branch> --state all
   git merge-base --is-ancestor <named-branch> origin/develop
   ```

   A merged PR, or an exit status of `0` from the ancestor check, means branch
   from `develop` instead — and say in the report that the stacking
   instruction was overtaken, rather than following it silently.

3. **Install dependencies in the worktree** — `node_modules` is per-checkout,
   so nothing runs until `bun install` has happened there. Run it from the
   worktree root; it installs every workspace package in one pass.

4. **If the work comes from a GitHub issue, say so where it will be found** —
   the issue number in the branch name, and `Closes #<n>` in the PR body so
   the merge closes it.

If `develop` moves while the work is in flight (a PR merges), rebase the
worktree branch onto the new tip sooner rather than later.

## Tearing down a retired worktree

A worktree is **retired** when all three hold:

- its branch has a PR (`gh pr list --head <branch> --state all`),
- that PR is merged, and
- the worktree has no local changes — nothing staged, modified, or
  untracked-and-unignored (`git -C worktrees/<name> status --porcelain`;
  gitignored artifacts like `node_modules/` or `dist/` don't count as
  changes).

Retired worktrees are torn down — but **ask the user before removing any
worktree you did not create in the current session**; removal deletes the
directory and the local branch:

```bash
git worktree remove worktrees/<name>          # --force if only ignored artifacts remain
git branch -D <branch>
```

`-D` (not `-d`) because squash-merged branches never look merged to git — the
merged PR, verified above, is the authority. A worktree with an **open** PR or
local changes is never a teardown candidate, no matter how old.

A worktree whose PR was **closed without merging** and that has no local
changes is also a teardown candidate — but its commits are not on `develop`,
and survive only on the remote branch if it was pushed. Name what would be
lost when you ask.

When a PR merges during a session, tear its worktree down as part of wrapping
up rather than leaving it for the next sweep.

### Production branches

Only delete a local `main` or `release/*` branch when **both** hold:

1. its PR is merged, and
2. every one of its commits is already on `develop`:

   ```bash
   git log --oneline develop..<branch>   # must be empty
   ```

Release branches carry version bumps that reach `develop` through a separate
backport PR (`backport/X.Y.Z`). Until that backport lands, the local branch may
be the only copy of those commits. Leave it.

## Gotchas

- **Stashes are repo-wide, not per-worktree.** `git stash list` returns the
  same entries from inside every worktree. It is not a signal about the
  worktree you are standing in — do not use it to decide whether one has
  unsaved work.
- **`git worktree list` shows the parent checkout first.** It is a worktree in
  git's accounting, but it is never a teardown candidate.
- **A branch cannot be checked out in two worktrees.** If `git worktree add`
  fails with "already checked out", the branch is live somewhere else — find
  it in `git worktree list` before working around the error.
- **A worktree directory deleted by hand leaves stale bookkeeping** until
  `git worktree prune`.
