# Declaro

**Declarative business application framework for TypeScript.**

Declaro (Spanish: "To Declare") lets you define your entire data layer — schemas, services, validation, events, and permissions — through declarative composition rather than imperative wiring. Define *what* your entities look like and *what* should happen when they change. Declaro handles the rest.

```typescript
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { ModelService } from '@declaro/data'
import { z } from 'zod/v4'

// 1. Declare your schema
const BookSchema = ModelSchema.create('Book')
    .read({
        detail: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            title: z.string(),
            author: z.string(),
            publishedAt: z.date(),
        })),
        lookup: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
        })),
    })
    .search({
        summary: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            title: z.string(),
            author: z.string(),
        })),
        filters: (h) => new ZodModel(h.name, z.object({
            title: z.string().optional(),
            author: z.string().optional(),
        })),
        sort: (h) => new ZodModel(h.name, z.object({
            title: z.enum(['asc', 'desc']).optional(),
        })),
    })
    .write({
        input: (h) => new ZodModel(h.name, z.object({
            title: z.string(),
            author: z.string(),
            publishedAt: z.date(),
        })),
    })
    .entity({ primaryKey: 'id' })

// 2. Wire up a service with events
const bookService = new ModelService({
    schema: BookSchema,
    repository: myBookRepository,  // your IRepository implementation
    emitter: new EventManager(),
})

// 3. Use it
const book = await bookService.create({
    title: 'The Pragmatic Programmer',
    author: 'David Thomas & Andrew Hunt',
    publishedAt: new Date('1999-10-20'),
})

const results = await bookService.search(
    { author: 'David Thomas' },
    { pagination: { page: 1, pageSize: 10 } },
)
```

## Why Declaro?

Most backend frameworks make you wire things together imperatively: define a model *here*, write validation *there*, hook up events *somewhere else*, add authorization *in another file*. As your application grows, this scattering makes it increasingly hard to understand what a single entity actually *is* and *does*.

Declaro takes a different approach:

- **One schema, many shapes.** A single `ModelSchema` declares how an entity looks when read (detail vs. summary), searched (filters, sort), and written (input). Type inference flows automatically from these declarations — no manual type definitions to keep in sync.

- **Events are built in, not bolted on.** Every service operation emits typed before/after events. Need an audit log? Subscribe to `afterCreate`. Need to send a welcome email? Subscribe to `afterCreate` on your User service. No decorators, no magic — just an event manager.

- **Validation at the boundary.** Models implement the [Standard Schema](https://github.com/standard-schema/standard-schema) spec (`StandardSchemaV1`), giving you portable validation that works with any compatible library.

- **Authorization is composable.** Permission rules use glob matching and compose with `allOf`, `someOf`, and `noneOf`. Controllers layer permissions on top of services, keeping your business logic and auth concerns cleanly separated.

- **Dependency injection without the ceremony.** The `Context` container supports factories, singletons, async resolution, circular dependency handling via proxies, and request-scoped middleware — all with full type safety and no decorators or reflection.

## Packages

| Package | Description |
|---|---|
| [`@declaro/core`](./docs/packages/core.md) | Foundation: DI context, events, validation, pipelines, schema system, permissions |
| [`@declaro/data`](./docs/packages/data.md) | Data layer: ModelService, repositories, controllers, domain events |
| [`@declaro/zod`](./docs/packages/zod.md) | Zod integration: ZodModel for schema validation and JSON Schema generation |
| [`@declaro/auth`](./docs/packages/auth.md) | Authentication: JWT sessions, role/claim management, permission validation |
| [`@declaro/redis`](./docs/packages/redis.md) | Redis integration: pub/sub, message queues, key-value storage, configuration |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3+ (recommended) or Node.js 20+
- TypeScript 5.5+

### Installation

Install the packages you need:

```bash
# Core framework (required)
bun add @declaro/core

# Zod model support (recommended)
bun add @declaro/zod

# Data layer with services and repositories
bun add @declaro/data

# Authentication
bun add @declaro/auth

# Redis integration
bun add @declaro/redis
```

Or with npm/yarn:

```bash
npm install @declaro/core @declaro/zod @declaro/data
# or
yarn add @declaro/core @declaro/zod @declaro/data
```

### Quick Start

The typical flow is: **define a schema** -> **implement a repository** -> **create a service** -> **use it**.

#### 1. Define a Schema

Schemas use the builder pattern to declare how your entity looks in different contexts:

```typescript
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

const UserSchema = ModelSchema.create('User')
    .read({
        detail: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            createdAt: z.date(),
        })),
        lookup: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
        })),
    })
    .search({
        summary: (h) => new ZodModel(h.name, z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
        })),
        filters: (h) => new ZodModel(h.name, z.object({
            email: z.string().optional(),
            name: z.string().optional(),
        })),
        sort: (h) => new ZodModel(h.name, z.object({
            name: z.enum(['asc', 'desc']).optional(),
            createdAt: z.enum(['asc', 'desc']).optional(),
        })),
    })
    .write({
        input: (h) => new ZodModel(h.name, z.object({
            email: z.string().email(),
            name: z.string(),
        })),
    })
    .entity({ primaryKey: 'id' })
```

#### 2. Implement a Repository

Create a repository that fulfills the `IRepository` interface for your data store:

```typescript
import type { IRepository } from '@declaro/data'

class UserRepository implements IRepository<typeof UserSchema> {
    async load(lookup) { /* query your DB */ }
    async loadMany(lookups) { /* batch query */ }
    async search(filters, options) { /* filtered query with pagination */ }
    async create(input) { /* insert */ }
    async update(lookup, input) { /* update */ }
    async remove(lookup) { /* soft delete */ }
    async restore(lookup) { /* restore soft delete */ }
    async upsert(input) { /* create or update */ }
    async bulkUpsert(inputs) { /* batch upsert */ }
    async count(filters) { /* count query */ }
    async emptyTrash(filters) { /* permanent delete trashed */ }
    async permanentlyDeleteFromTrash(lookup) { /* permanent delete from trash */ }
    async permanentlyDelete(lookup) { /* permanent delete */ }
}
```

#### 3. Create a Service

Wire up the service with your schema, repository, and an event manager:

```typescript
import { ModelService } from '@declaro/data'
import { EventManager } from '@declaro/core'

const events = new EventManager()
const userService = new ModelService({
    schema: UserSchema,
    repository: new UserRepository(),
    emitter: events,
})

// Subscribe to events
events.on('global::user.afterCreate', (event) => {
    console.log('User created:', event.data)
})
```

#### 4. Set Up Dependency Injection (Optional)

For larger applications, use the `Context` container:

```typescript
import { Context, App } from '@declaro/core'

interface AppScope {
    userService: ModelService<typeof UserSchema>
    events: EventManager
}

const context = new Context<AppScope>()
context.registerValue('events', new EventManager())
context.registerFactory('userService', (events) =>
    new ModelService({
        schema: UserSchema,
        repository: new UserRepository(),
        emitter: events,
    }),
    ['events'],
)

const userService = context.resolve('userService')
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Your Application                  │
├─────────────────────────────────────────────────────┤
│  Controllers        (auth-protected API layer)       │
│    └─ ModelController / ReadOnlyModelController      │
├─────────────────────────────────────────────────────┤
│  Services           (business logic + events)        │
│    └─ ModelService / ReadOnlyModelService             │
├─────────────────────────────────────────────────────┤
│  Repositories       (data access)                    │
│    └─ IRepository interface                          │
├─────────────────────────────────────────────────────┤
│  Schemas            (entity definitions)             │
│    └─ ModelSchema + ZodModel                         │
├─────────────────────────────────────────────────────┤
│  Core Infrastructure                                 │
│    ├─ Context (DI)     ├─ EventManager               │
│    ├─ Validation       ├─ Pipeline                   │
│    └─ PermissionValidator                            │
└─────────────────────────────────────────────────────┘
```

## Documentation

- **[`@declaro/core`](./docs/packages/core.md)** — DI container, event system, validation, pipelines, schema builder, permissions
- **[`@declaro/data`](./docs/packages/data.md)** — ModelService, repositories, controllers, domain events, type inference
- **[`@declaro/zod`](./docs/packages/zod.md)** — ZodModel, field utilities, JSON Schema generation
- **[`@declaro/auth`](./docs/packages/auth.md)** — JWT authentication, session management, permission validation
- **[`@declaro/redis`](./docs/packages/redis.md)** — Redis pub/sub, message queues, storage, configuration management

## Development

This is a monorepo managed with [Lerna](https://lerna.js.org/) and [Bun](https://bun.sh).

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Type check all packages
bun typecheck

# Build all packages
bun run build

# Run all packages in dev mode
bun dev
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE.md](./LICENSE.md) for details.

Copyright (c) 2025 [Emmert Technology](https://emmert.io)
