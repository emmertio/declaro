# Declaro - Claude Code Instructions

Declaro ("To Declare") is a declarative business application framework. It's a monorepo using Lerna and Bun.

## Quick Reference

- **Package manager**: Bun
- **Test framework**: Bun native (`bun test`)
- **Monorepo tool**: Lerna
- **Language**: Strict TypeScript (ESNext, bundler module resolution)
- **Packages**: `lib/*` (libraries), `apps/*` (applications)

## Common Commands

```bash
bun test              # Run all tests
bun test --watch      # Run tests in watch mode
bun run build         # Build all packages
bun typecheck         # Type check all packages
bun dev               # Run all packages in dev mode
```

## Coding Standards

See [docs/coding-standards.md](docs/coding-standards.md) for the full coding standards.

## Project Structure

```
lib/core/    - @declaro/core: Events, Validation, DI, Context, Pipelines, Schema
lib/data/    - @declaro/data: ModelService, Repositories, Controllers, Events
lib/auth/    - @declaro/auth: Authentication & Authorization
lib/redis/   - @declaro/redis: Redis integration
lib/zod/     - @declaro/zod: Zod schema integration (ZodModel)
apps/        - Application implementations
examples/    - Example applications (movie-db-nuxt, movie-db-svelte)
docs/        - Shared AI-agnostic documentation
```

## Key Patterns

- **ModelSchema**: Builder pattern for defining entity schemas with read/search/write/entity mixins
- **ModelService**: Service layer with event-driven CRUD operations, extends ReadOnlyModelService
- **Repository pattern**: IRepository interface implemented by data stores
- **Event system**: EventManager with before/after events for all operations
- **Schema inference**: Type-safe inference via InferInput, InferDetail, InferLookup, etc.
- **StandardSchemaV1**: All models implement the standard schema spec for validation

## Testing Conventions

- Tests live next to implementation files (e.g., `model-service.test.ts` beside `model-service.ts`)
- Mock implementations in nearby `test/` directories
- Use `MockMemoryRepository` and `MockBookSchema` for data layer tests
- Use `EventManager` for testing event-driven behavior
