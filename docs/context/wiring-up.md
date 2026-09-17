---
status: implemented
applies-to:
    - 'lib/core/src/context/**'
    - 'lib/core/src/application/**'
    - 'lib/core/src/http/request-context.ts'
    - 'lib/core/src/scope/**'
---

# Wiring up the context

Registering dependencies, scoping them per request, and typing the scope so the
compiler helps.

All paths are relative to the repository root.

---

## First: do you need it?

`Context` is opt-in. `ModelService`, `ModelController`, `EventManager` and every
repository take plain constructor arguments.

| Use the container | Wire by hand |
|---|---|
| Per-request dependencies (auth session, tenant, request-scoped repo) | Everything else |
| A module that must register itself into someone else's app | A service you construct once at boot |
| Circular dependencies you cannot break | Anything you could `new` in one line |

Plain construction is compiler-checked and greppable. Container registration is
neither. Prefer it where you have the choice.

---

## Step 1 — declare the scope

Without this, every key is `string` and nothing is checked. Augment the `#scope`
module (`lib/core/src/scope/index.ts:1-19`):

```typescript
// types/scope.d.ts
declare module '#scope' {
    interface AppScope {
        config: MyAppConfig
        emitter: EventManager
        bookService: BookService
    }

    interface RequestScope {
        currentUser: User | null
    }
}
```

`RequestScope extends AppScope` (`scope/index.ts:33`), so a request context sees
both. Import from `#scope`, not from `@declaro/core` — the re-exports there are
`@deprecated` (`lib/core/src/index.ts:1-18`).

Then type the context: `Context<AppScope>`. Now `resolve('bookServce')` is a
compile error instead of `undefined` at runtime.

---

## Step 2 — register dependencies

Four registration methods, plus async variants:

```typescript
// A literal
context.registerValue('config', myConfig)

// A factory with injected args
context.registerFactory(
    'bookService',
    (schema, emitter, repo) => new BookService({ schema, emitter, repository: repo }),
    ['bookSchema', 'emitter', 'bookRepository'],
    { singleton: true },
)

// A class, constructor args injected
context.registerClass('bookRepository', BookRepository, ['db'], { singleton: true })

// Async — the factory and its dependencies may be promises
context.registerAsyncFactory('db', async (config) => connect(config), ['config'])
```

The third argument is the **`inject` array**: keys resolved in order and passed
positionally (`context.ts:419-423`, `:492`). Get the order wrong and arguments
are silently swapped — the types are too loose to catch it.

### Resolve options

```typescript
{ singleton?: boolean, eager?: boolean, strict?: boolean }
```

| Option | Default | Set it when |
|---|---|---|
| `singleton` | **`false`** | the value holds state or a connection — which is most of the time |
| `eager` | `false` | construction has a side effect that must happen at boot |
| `strict` | `false` | a missing value should throw rather than be `undefined` |

**`singleton: false` is the default and it is rarely what you want.** Verified:
`registerClass('thing', Thing)` with no options yields a new instance on every
`resolve` and every `scope.thing` access.

`eager: true` requires someone to call `initializeEagerDependencies()`
(`context.ts:308-316`). `App.init()` does; `createRequestContext` does
(`create-request-context.ts:16`). A bare `new Context()` does not.

**Do not register a singleton whose value is falsy.** The cache check is a
truthiness test (`context.ts:767`), so `0`, `''`, `false` and `null` are
re-created on every resolve (verified). Box it: `{ value: 0 }`.

---

## Step 3 — group registrations into a module

A module is a function returning a `ContextMiddleware`. `authModule`
(`lib/auth/src/application/module.ts:10`) is the reference:

```typescript
export function bookModule(config: BookConfig) {
    return (context: Context<BookScope>) => {
        context.registerValue('bookConfig', config)

        context.registerFactory(
            'bookRepository',
            (db: Db) => new BookRepository(db),
            ['db'],
            { singleton: true },
        )
    }
}

// at boot
await context.use(useDeclaro(), bookModule(config), authModule(authConfig))
```

`use` runs middleware **sequentially, awaited** (`context.ts:906-917`), so
ordering is registration order. A module that resolves another module's key at
wire time must be registered after it.

Registering the same key twice is allowed and the last wins — `register`
invalidates the cached values of everything that injected the old one
(`context.ts:347-359`). That is deliberate, and it is how request scoping works.

---

## Step 4 — request-scoped dependencies

Register the key **twice**: once on the app context as the null case, once inside
request middleware as the real thing.

```typescript
export function currentUserModule() {
    return (context: Context<AppScope>) => {
        // App level: resolving outside a request must not explode
        context.registerAsyncFactory('currentUser', async () => null)

        provideRequestMiddleware(context, async (context: Context<RequestScope>) => {
            context.registerAsyncFactory(
                'currentUser',
                async (authSession: IAuthSession | null) => {
                    return authSession ? loadUser(authSession.jwtPayload.id) : null
                },
                ['authSession'],
            )
        })
    }
}
```

This is exactly the shape `authModule` uses for `authSession`, `authMembership`
and `authValidator` (`lib/auth/src/application/module.ts:22-24`, `:26-78`).

`provideRequestMiddleware` (`http/request-context.ts:18-29`) appends to the
`requestMiddleware` array and re-registers it. `useDeclaro()` must have run first
— it seeds the array (`application/use-declaro.ts:7-8`).

### What a request actually does

`createRequestContext` (`application/create-request-context.ts:4-19`):

```
new Context()
  → extend(appContext)                    // copy every attribute
  → provideRequest(context, request)
  → use(...appContext.scope.requestMiddleware)   // re-register the scoped keys
  → initializeEagerDependencies()
```

Header access is set up by `useDeclaro()` (`use-declaro.ts:13-24`), which is why
`context.scope.header('authorization')` works inside request middleware.

---

## Step 5 — reaching the context from deep code

Thread it explicitly where you can. Where you cannot — a `normalizeLookup` hook,
an event listener — use the async context:

```typescript
import { withContext, useContext } from '@declaro/core'

await withContext(requestContext, async () => {
    await handler()      // anything in here can call useContext()
})

// deep inside
const context = useContext()               // Context | null
const context = useContext({ strict: true })  // throws if absent
```

`Context.emit` already wraps its emission in `withContext`
(`context.ts:958-962`), and `Context.on` hands the listener the ambient context
if there is one (`context.ts:946-950`). So a listener registered on the app
context sees the request context when fired during a request.

**Always handle the `null` case** unless you pass `{ strict: true }`. Code reached
from a seeder, a background job or a test has no ambient context.

---

## App lifecycle

```typescript
const app = new App(context)

app.onInit(async (context) => { … })    // fires on init()
app.onStart(async (context) => { … })   // fires on start()

await app.init()    // initializeEagerDependencies() + emit 'declaro:init'
await app.start()   // emit 'declaro:start'
```

**`app.destroy()` emits `declaro:start`, not `declaro:destroy`**
(`lib/core/src/app/app.ts:41`). `onDestroy` listeners never fire and `onStart`
listeners fire a second time. Do not put shutdown logic behind it — call your
teardown directly, or fix `app.ts` first.

`onStart` also returns `undefined` instead of `this` (`app.ts:37`), so it cannot
be chained the way `onInit` can.

---

## Checklist

- [ ] `AppScope` / `RequestScope` augmented in `types/scope.d.ts`, imported from
      `#scope`
- [ ] Contexts typed `Context<AppScope>`, not bare `Context`
- [ ] `{ singleton: true }` on anything stateful — it is **not** the default
- [ ] No falsy singletons (box them)
- [ ] `inject` arrays in the same order as the constructor/factory parameters
- [ ] Request-scoped keys registered at **both** app and request level
- [ ] `useDeclaro()` used before any `provideRequestMiddleware`
- [ ] Module registration order matches wire-time dependencies
- [ ] `useContext()` null case handled, or `{ strict: true }`
- [ ] The wiring map written into the PR description — string keys included

---

## Gotchas

- **Typos type-check and resolve to `undefined`** (verified). Grep the exact
  string before adding a key.
- **`singleton: false` is the default** (verified: 3 resolves → 3 instances).
- **A falsy singleton is never cached** (verified).
- **`context.scope.foo` resolves every access.** It is not a cache.
- **`extend` copies `cachedValue`**, and copies listeners once — later app-level
  listeners do not reach an existing request context.
- **`Context.on` is not the model-event bus.** Register model listeners on the
  `EventManager` the service was constructed with.
- **`App.destroy()` emits the wrong event.**
- **Deprecated, do not use:** `provide`, `inject`, `singleton()`,
  `ContextConsumer`, `useRequestMiddleware`, and the `AppScope`/`RequestScope`
  re-exports from `@declaro/core`.
- **The browser shim does not propagate across parallel async tasks**
  (`context/async-context.ts:50-54`).

## See also

- [`how-it-works.md`](./how-it-works.md) — why resolution behaves this way, and
  the circular-dependency proxy
- [`docs/auth/wiring-up.md`](../auth/wiring-up.md) — `authModule` as a worked
  example of everything above
