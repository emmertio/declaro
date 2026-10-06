# @declaro/data

A data-mapper framework for managing application data across integrated systems.

## Guides

- [Transactions](docs/transactions.md): ORM-agnostic transactions, including how to build an adapter for your ORM.

## Development

`@declaro/data` imports the built output of its sibling packages. In a fresh checkout or worktree, run `bun install` at the repo root, then `bun run build` in `lib/core`, `lib/zod` and `lib/auth`, before running this package's tests or `bunx tsc --noEmit`.
