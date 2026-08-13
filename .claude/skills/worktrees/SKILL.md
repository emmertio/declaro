---
name: worktrees
description: Create, audit, and tear down git worktrees under .claude/worktrees/. Use when asked to start work in a worktree, spin up a branch for a task, clean up or prune worktrees, remove stale worktrees and their local branches, or figure out which worktrees belong to merged or closed PRs.
---

# Worktree Management

Worktrees let several branches be checked out at once, so parallel work does not
fight over one working directory. This skill covers the two halves of that:
creating one correctly, and tearing down the ones that have outlived their PR.

## Repository conventions

- Worktrees live in `.claude/worktrees/`, inside the repo, ignored by git.
- Directory name is the branch name with `/` replaced by `+`.
  `fix/serialize-validate-false` → `.claude/worktrees/fix+serialize-validate-false`.
- `develop` is the integration branch. Feature work branches from it and PRs
  target it.
- `main` and `release/*` are production branches. They get different teardown
  rules (see [Production branches](#production-branches)).

## Creating a worktree

**Branch name.** If a GitHub issue is in context, reference its number:
`feat/61-release-workflow`. Otherwise pick a name consistent with the other
branches off `develop` — `feat/`, `fix/`, `ci/`, or `chore/` plus a short
kebab-case description of the work.

**Base it on `develop`, not the default branch.** The harness `EnterWorktree`
tool defaults to branching from `origin/<default-branch>`, which is `main` here.
That gives you release commits you do not want and a PR full of noise. Create the
worktree explicitly, then enter it:

```bash
git fetch origin develop
git worktree add -b <branch> .claude/worktrees/<branch-with-plus> origin/develop
```

Then `EnterWorktree` with the `path` argument to switch the session into it.

`git worktree add` sets the new branch's upstream to `origin/develop`, which is
wrong for pushing. Fix it on the first push:

```bash
git push -u origin <branch>
```

## Auditing worktrees for cleanup

Enumerate worktrees, then gather three signals for each one before deciding
anything.

```bash
git worktree list
```

**Signal 1 — uncommitted work.** Run per worktree; empty output means clean.

```bash
git -C <worktree> status --short
```

**Signal 2 — commits not in `develop`.**

```bash
git -C <worktree> log --oneline develop..HEAD
git -C <worktree> diff develop...HEAD --stat
```

The `log` and the `diff` disagree after a squash merge: the commits still look
unmerged while the diff is empty. The empty diff is the one that tells you the
content already landed.

**Signal 3 — PR state.** This is the authority on whether work merged, because
squash and rebase merges destroy the commit identity that git would match on.

```bash
gh pr list --head <branch> --state all --json number,title,state,mergedAt,baseRefName
```

### Deciding what to do

| Worktree             | PR                | Action                                        |
| -------------------- | ----------------- | --------------------------------------------- |
| Clean                | Merged            | Tear down.                                    |
| Has local changes    | Merged            | **Call it out and ask.** Never discard silently. |
| Clean                | Closed, not merged| Tear down.                                    |
| Has local changes    | Closed, not merged| **Ask first.**                                |
| Clean, no diff vs `develop` | Open or none | **Ask** whether the work is still wanted. |
| Any commits or changes | Open or none    | Leave it alone.                               |

"Has local changes" means uncommitted files **or** commits that are not in
`develop`. Both are unrecoverable-ish once the worktree is gone, so both trigger
the ask.

A clean worktree with no diff against `develop` is ambiguous — it is either work
that already landed or work that was abandoned before it started. Ask which.
**In an autonomous session where nobody can answer, leave it alone** and say so
in your summary. An unremoved worktree costs disk; a wrongly removed one costs
work.

When you ask, ask once with everything: list every worktree needing a decision
and what is at stake for each, rather than interrupting per worktree.

## Teardown

For each worktree cleared for removal:

```bash
git worktree remove .claude/worktrees/<dir>
git branch -d <branch>
```

`git worktree remove` refuses to delete a dirty worktree. That refusal is a
safety check — if you hit it, you misclassified. Re-audit rather than reaching
for `--force`.

`git branch -d` likewise refuses to delete a branch that is not merged into the
current HEAD. After a squash merge this refusal is a false alarm: confirm the PR
is merged via `gh` and the diff against `develop` is empty, then use
`git branch -D`.

If a worktree directory was deleted by hand, git keeps stale bookkeeping until:

```bash
git worktree prune
```

### Production branches

Only delete a local `main` or `release/*` branch when **both** hold:

1. Its PR is merged, and
2. every one of its commits is already on `develop`:

```bash
git log --oneline develop..<branch>   # must be empty
```

Release branches often carry version bumps that reach `develop` through a
separate backport PR. Until that backport lands, the local branch is the only
copy of those commits. Leave it.

## Gotchas

- **Stashes are repo-wide, not per-worktree.** `git stash list` returns the same
  entries from inside every worktree. It is not a signal about the worktree
  you are standing in — do not use it to decide whether one has unsaved work.
- **`git worktree list` shows the main working copy first.** It is a worktree in
  git's accounting, but it is never a cleanup candidate.
- **A branch cannot be checked out in two worktrees.** If `git worktree add`
  fails with "already checked out", the branch is live somewhere else — find it
  in `git worktree list` before working around the error.
