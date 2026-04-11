# @declaro/core

The foundation of the Declaro framework. Provides dependency injection, event management, validation, pipelines, the schema system, and permission validation.

## Installation

```bash
bun add @declaro/core
# or
npm install @declaro/core
```

## Table of Contents

- [Dependency Injection (Context)](#dependency-injection-context)
- [Event System](#event-system)
- [Schema System (ModelSchema)](#schema-system-modelschema)
- [Validation](#validation)
- [Pipelines](#pipelines)
- [Permission Validation](#permission-validation)
- [App Lifecycle](#app-lifecycle)
- [HTTP Utilities](#http-utilities)
- [Error Types](#error-types)
- [Type Utilities](#type-utilities)

---

## Dependency Injection (Context)

The `Context` class is a type-safe dependency injection container with support for values, factories, classes, async resolution, singletons, and circular dependency handling.

### Basic Registration

```typescript
import { Context } from '@declaro/core'

interface MyScope {
    config: { port: number; host: string }
    logger: Logger
    database: Database
    userService: UserService
}

const context = new Context<MyScope>()

// Register a plain value
context.registerValue('config', { port: 3000, host: 'localhost' })

// Register a factory — dependencies are injected by key
context.registerFactory(
    'database',
    (config) => new Database(config.host, config.port),
    ['config'],
)

// Resolve a dependency
const db = context.resolve('database')
```

### Factory Registration

Factories are functions that receive their dependencies as arguments. The `inject` array specifies which scope keys to resolve and pass in:

```typescript
context.registerFactory(
    'userService',
    (db, logger) => new UserService(db, logger),
    ['database', 'logger'],
)
```

### Class Registration

Register a class constructor directly. Dependencies are injected as constructor arguments:

```typescript
context.registerClass(
    'userService',
    UserService,       // class with constructor(db: Database, logger: Logger)
    ['database', 'logger'],
)
```

### Async Factories

For dependencies that require async initialization:

```typescript
interface MyScope {
    database: Promise<Database>
}

context.registerAsyncFactory(
    'database',
    async (config) => {
        const db = new Database(config.host, config.port)
        await db.connect()
        return db
    },
    ['config'],
)

// Resolution returns a Promise
const db = await context.resolve('database')
```

### Singletons and Eager Initialization

```typescript
// Singleton: resolved once, cached for subsequent resolves
context.registerFactory(
    'database',
    (config) => new Database(config),
    ['config'],
    { singleton: true },
)

// Eager: resolved immediately during initializeEagerDependencies()
context.registerFactory(
    'cache',
    () => new Cache(),
    [],
    { eager: true, singleton: true },
)

// Trigger eager initialization
await context.initializeEagerDependencies()
```

### Context Composition

Extend a context with dependencies from other contexts:

```typescript
const appContext = new Context<AppScope>()
appContext.registerValue('config', appConfig)

const requestContext = new Context<RequestScope>()
requestContext.extend(appContext)  // inherits all of appContext's registrations

// Use middleware for request-scoped setup
await requestContext.use(async (ctx) => {
    ctx.registerValue('user', await resolveUser(ctx))
})
```

### Async Context (AsyncLocalStorage)

Propagate context across async boundaries without passing it explicitly:

```typescript
import { withContext, useContext } from '@declaro/core'

// Wrap an async operation with a context
await withContext(myContext, async () => {
    // Anywhere within this async boundary:
    const ctx = useContext()
    const service = ctx.resolve('userService')
})

// Strict mode throws if no context is found
const ctx = useContext({ strict: true })
```

### Circular Dependency Handling

Context uses Proxy-based deferred resolution to handle circular dependencies:

```typescript
// ServiceA depends on ServiceB, ServiceB depends on ServiceA
context.registerFactory('serviceA', (b) => new ServiceA(b), ['serviceB'])
context.registerFactory('serviceB', (a) => new ServiceB(a), ['serviceA'])

// Both resolve successfully — proxies defer access until needed
const a = context.resolve('serviceA')
```

### Validation on Context

```typescript
const validation = context.validate(
    (ctx) => ctx.resolve('config').port > 0,
    (ctx) => ctx.resolve('database') !== null,
)

await validation.onInvalid(() => {
    throw new Error('Invalid context configuration')
})
```

---

## Event System

The `EventManager` provides pub/sub event handling with sync, async sequential, and async parallel execution modes.

### Basic Usage

```typescript
import { EventManager, type IEvent } from '@declaro/core'

const events = new EventManager()

// Subscribe to an event (returns an unsubscribe function)
const off = events.on('user:created', (event) => {
    console.log('User created:', event)
})

// Emit synchronously
events.emit({ type: 'user:created', data: { id: '123' } })

// Emit async (sequential — listeners run one after another)
await events.emitAsync({ type: 'user:created', data: { id: '123' } })

// Emit async (parallel — all listeners run concurrently)
await events.emitAll({ type: 'user:created', data: { id: '123' } })

// Unsubscribe
off()
```

### Wildcard Listeners

```typescript
// Listen to ALL events
events.on('*', (event) => {
    console.log(`[${event.type}]`, event)
})
```

### Subscribing to Multiple Events

```typescript
events.on(['user:created', 'user:updated'], (event) => {
    console.log('User changed:', event.type)
})
```

### Event Forwarding

Forward all events from one manager to another:

```typescript
const appEvents = new EventManager()
const moduleEvents = new EventManager()

// All events emitted on moduleEvents are also emitted on appEvents
const stopForwarding = moduleEvents.forwardTo(appEvents)

// Stop forwarding
stopForwarding()
```

### Extending Event Managers

Copy all listeners from one manager to another:

```typescript
const parentEvents = new EventManager()
const childEvents = new EventManager()

childEvents.extend(parentEvents)
```

---

## Schema System (ModelSchema)

`ModelSchema` uses a builder pattern to declare how an entity looks in different contexts — reading, searching, and writing. Each context is defined as a **mixin** containing one or more models.

### Creating a Schema

```typescript
import { ModelSchema } from '@declaro/core'
import { ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

const ProductSchema = ModelSchema.create('Product')
    .read({
        // Full entity returned when loading a single record
        detail: (h) => new ZodModel(h.name, z.object({
            id: z.number().int(),
            name: z.string(),
            description: z.string(),
            price: z.number(),
            createdAt: z.date(),
            updatedAt: z.date(),
        })),
        // Fields needed to look up a single record
        lookup: (h) => new ZodModel(h.name, z.object({
            id: z.number().int(),
        })),
    })
    .search({
        // Compact representation for lists
        summary: (h) => new ZodModel(h.name, z.object({
            id: z.number().int(),
            name: z.string(),
            price: z.number(),
        })),
        // Available search/filter fields
        filters: (h) => new ZodModel(h.name, z.object({
            name: z.string().optional(),
            minPrice: z.number().optional(),
            maxPrice: z.number().optional(),
        })),
        // Available sort fields
        sort: (h) => new ZodModel(h.name, z.object({
            name: z.enum(['asc', 'desc']).optional(),
            price: z.enum(['asc', 'desc']).optional(),
        })),
    })
    .write({
        // Fields accepted when creating or updating
        input: (h) => new ZodModel(h.name, z.object({
            name: z.string(),
            description: z.string(),
            price: z.number().positive(),
        })),
    })
    .entity({ primaryKey: 'id' })
```

### Understanding the Mixin Helper

Each mixin callback receives a helper `h` with context about the parent schema. The helper provides:

- `h.name` — A generated name for the sub-model (e.g., `"ProductDetail"`, `"ProductLookup"`)

This helps auto-generate meaningful names for JSON Schema, labels, and validation errors.

### Built-in Mixins

| Mixin | Models Created | Purpose |
|---|---|---|
| `.read()` | `detail`, `lookup` | Define single-record views |
| `.search()` | `summary`, `filters`, `sort` | Define list views and search criteria |
| `.write()` | `input` | Define create/update input shapes |
| `.entity()` | *(metadata)* | Set primary key and entity-level config |

### Custom Mixins

Add arbitrary models beyond the standard read/search/write:

```typescript
const schema = ModelSchema.create('Order')
    .read({ /* ... */ })
    .custom({
        invoice: (h) => new ZodModel(h.name, z.object({
            orderId: z.string(),
            total: z.number(),
            lineItems: z.array(z.object({
                product: z.string(),
                quantity: z.number(),
                price: z.number(),
            })),
        })),
    })
```

### Auto-Generated Labels

Every schema automatically generates labels from the model name:

```typescript
const schema = ModelSchema.create('ShoppingCart')

schema.labels
// {
//   singularLabel: 'Shopping Cart',
//   pluralLabel: 'Shopping Carts',
//   singularSlug: 'shopping-cart',
//   pluralSlug: 'shopping-carts',
//   singularParameter: 'shoppingCart',
//   pluralParameter: 'shoppingCarts',
//   singularEntityName: 'ShoppingCart',
//   pluralEntityName: 'ShoppingCarts',
//   singularSentence: 'shopping cart',
//   pluralSentence: 'shopping carts',
// }
```

### StandardSchemaV1 Compliance

All models implement the [Standard Schema](https://github.com/standard-schema/standard-schema) specification:

```typescript
const model = new ZodModel('User', z.object({ name: z.string() }))

// Validate via standard interface
const result = await model.validate({ name: 'Alice' })
if ('value' in result) {
    console.log(result.value) // { name: 'Alice' }
} else {
    console.log(result.issues) // validation errors
}

// Access the standard schema property
model['~standard'] // { version: 1, vendor: 'zod', validate: ... }
```

---

## Validation

General-purpose validation utilities that work with any data type.

### Basic Validation

```typescript
import { validate, validateAny, Validation } from '@declaro/core'

// All validators must pass
const result = validate(
    user,
    (u) => u.age >= 18,
    (u) => u.email.includes('@'),
)

await result.onValid((user) => {
    console.log('Valid user:', user)
})

await result.onInvalid((user) => {
    console.log('Invalid user:', user)
})
```

### Any-Of Validation

```typescript
// At least one validator must pass
const result = validateAny(
    user,
    (u) => u.role === 'admin',
    (u) => u.role === 'moderator',
)
```

### Async Validators

```typescript
const result = validate(
    order,
    async (o) => {
        const product = await db.findProduct(o.productId)
        return product.inStock
    },
)

const isValid = await result.valid  // Promise<boolean>
```

### Context Validation

```typescript
import { ContextValidator } from '@declaro/core'

const allValid = ContextValidator.all(
    (ctx) => ctx.resolve('config').port > 0,
    (ctx) => ctx.resolve('database') !== null,
)

const isReady = await allValid(context) // boolean
```

---

## Pipelines

Type-safe functional pipelines for chaining transformations with automatic Promise unwrapping.

### Basic Pipeline

```typescript
import { Pipeline } from '@declaro/core'

const processOrder = new Pipeline((input: string) => parseInt(input))
    .pipe((num) => num * 1.1)          // apply tax
    .pipe((total) => Math.round(total)) // round
    .pipe((total) => `$${total}`)       // format

const result = processOrder.execute('100') // "$110"
```

### Async Pipelines

Pipelines automatically handle async steps:

```typescript
const pipeline = new Pipeline(async (userId: string) => {
        return await db.findUser(userId)
    })
    .pipe(async (user) => {
        // user is unwrapped from the Promise automatically
        return await enrichUserProfile(user)
    })
    .pipe((profile) => formatForDisplay(profile))

const result = await pipeline.execute('user-123')
```

### Conditional Branching (Diverge)

```typescript
const pipeline = new Pipeline((input: number) => input)
    .diverge({
        decide: (num) => num > 100 ? 'high' : 'low',
        high: (num) => `High value: ${num}`,
        low: (num) => `Low value: ${num}`,
    })

pipeline.execute(150) // "High value: 150"
pipeline.execute(50)  // "Low value: 50"
```

### Composing Pipelines

Export a pipeline as a reusable action:

```typescript
const validate = new Pipeline((input: RawData) => parseInput(input))
    .pipe((parsed) => validateRules(parsed))

const transform = new Pipeline(validate.export())
    .pipe((validated) => enrichData(validated))
    .pipe((enriched) => formatOutput(enriched))
```

---

## Permission Validation

Composable permission rules with glob pattern matching.

### Basic Usage

```typescript
import { PermissionValidator } from '@declaro/core'

const validator = PermissionValidator.create()
    .allOf(['read:users', 'read:profiles'])    // must have ALL
    .someOf(['admin', 'moderator'])            // must have at LEAST ONE
    .noneOf(['banned', 'suspended'])           // must have NONE

// Throws on failure
validator.validate(['read:users', 'read:profiles', 'admin'])

// Returns result object (doesn't throw)
const result = validator.safeValidate(['read:users'])
// { valid: false, errorMessage: '...', errors: [...] }
```

### Glob Patterns

Permission strings support glob matching via [minimatch](https://github.com/isaacs/minimatch):

```typescript
const validator = PermissionValidator.create()
    .someOf(['admin:*'])  // matches admin:users, admin:settings, etc.

validator.validate(['admin:users']) // passes
```

### Composable Validators

Validators can be nested for complex permission logic:

```typescript
const readPermissions = PermissionValidator.create()
    .someOf(['read:*', 'admin'])

const writePermissions = PermissionValidator.create()
    .someOf(['write:*', 'admin'])

const fullAccess = PermissionValidator.create()
    .extend(readPermissions, writePermissions)
```

### Rule Types

| Rule | Behavior |
|---|---|
| `allOf(perms)` | User must have **every** listed permission |
| `someOf(perms)` | User must have **at least one** listed permission |
| `noneOf(perms)` | User must have **none** of the listed permissions |

---

## App Lifecycle

Manage application startup and shutdown with event-driven lifecycle hooks.

```typescript
import { App, Context } from '@declaro/core'

const context = new Context()
const app = new App(context)

// Register lifecycle listeners
app.onInit(async (ctx) => {
    console.log('Initializing...')
    // set up database connections, etc.
})

app.onStart(async (ctx) => {
    console.log('Starting...')
    // start listening for requests, etc.
})

app.onDestroy(async (ctx) => {
    console.log('Shutting down...')
    // close connections, flush buffers, etc.
})

// Run the lifecycle
await app.init()
await app.start()

// On shutdown:
await app.destroy()
```

### Lifecycle Events

| Event | Constant | When |
|---|---|---|
| Init | `App.Events.Init` (`declaro:init`) | Application setup and initialization |
| Start | `App.Events.Start` (`declaro:start`) | Application ready to serve requests |
| Destroy | `App.Events.Destroy` (`declaro:destroy`) | Application shutting down |

---

## HTTP Utilities

Helpers for working with HTTP requests within the Context system.

### Request Context

```typescript
import { createRequestContext, useDeclaro } from '@declaro/core'

// Set up the app context with Declaro middleware
const appContext = new Context()
await appContext.use(useDeclaro())

// Create a request-scoped context from an incoming request
const requestContext = await createRequestContext(appContext, incomingRequest)

// Access request data
const headers = requestContext.resolve('headers')
const getHeader = requestContext.resolve('header')
const authHeader = getHeader('authorization')
```

### Middleware Registration

```typescript
import { provideRequestMiddleware, provideNodeMiddleware } from '@declaro/core'

// Register request-scoped middleware (runs per request)
provideRequestMiddleware(appContext, async (ctx) => {
    ctx.registerFactory('currentUser', async () => {
        const token = ctx.resolve('header')('authorization')
        return await verifyToken(token)
    })
})

// Register Node.js middleware (Express/Connect-compatible)
provideNodeMiddleware(appContext, (req, res, next) => {
    // standard middleware
    next()
})
```

---

## Error Types

Built-in error classes with HTTP status codes and JSON serialization.

```typescript
import {
    SystemError,       // 500 — Internal server errors
    ValidationError,   // 400 — Input validation failures
    NotFoundError,     // 404 — Resource not found
    UnauthorizedError, // 401 — Authentication required
    ForbiddenError,    // 403 — Insufficient permissions
} from '@declaro/core'

// All errors support JSON serialization
throw new NotFoundError('User not found', { userId: '123' })

try {
    await model.validate(badInput)
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(error.code)    // 400
        console.log(error.meta)    // { result: { issues: [...] } }
        console.log(error.toJSON())
    }
}
```

---

## Type Utilities

Compile-time type helpers for building type-safe applications.

```typescript
import type {
    Merge,              // Deep merge two object types
    DeepPartial,        // Make all nested properties optional
    ShallowMerge,       // Merge at the top level only
    UnwrapPromise,      // Extract T from Promise<T>
    PromiseOrValue,     // T | Promise<T>
    Class,              // Constructor type: new (...args) => T
    SnakeCase,          // Compile-time camelCase to snake_case
} from '@declaro/core'

// Example: compile-time snake_case conversion
type Result = SnakeCase<'myVariableName'> // "my_variable_name"
```

---

## Scope Augmentation

Extend the built-in scope interfaces using TypeScript's declaration merging:

```typescript
// types/scope.d.ts
declare module '#scope' {
    interface AppScope {
        config: AppConfig
        database: Database
        logger: Logger
    }

    interface RequestScope {
        user: User
        session: Session
    }
}
```

Then import from `#scope` for the cleanest experience:

```typescript
import type { AppScope, RequestScope } from '#scope'
```

See [SCOPE.md](../../lib/core/SCOPE.md) for full details on scope configuration.
