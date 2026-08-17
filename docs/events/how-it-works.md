---
status: implemented
applies-to:
    - 'lib/core/src/events/**'
    - 'lib/core/src/shared/utils/action-descriptor.ts'
    - 'lib/data/src/domain/events/**'
    - 'lib/redis/src/redis/redis-event-adapter.ts'
---

# How the event system works

Every read and write in `@declaro/data` is bracketed by a `before*` and an
`after*` event. That is the framework's extension seam: a cross-cutting concern —
audit log, cache invalidation, notification, search index — subscribes to those
events instead of being called from each mutation site.

For the step-by-step of subscribing, read [`wiring-up.md`](./wiring-up.md). This
document is the why.

## Three pieces

| Piece | Responsibility | Where |
|---|---|---|
| `EventManager` | the bus — subscribe, emit | `lib/core/src/events/event-manager.ts:7` |
| `ActionDescriptor` | builds the event's **name** | `lib/core/src/shared/utils/action-descriptor.ts:17` |
| `DomainEvent` and subclasses | the **envelope** | `lib/data/src/domain/events/domain-event.ts:33` |

The split is what keeps the bus generic. `EventManager` knows only
`{ type: string }` (`event-manager.ts:1-3`); everything Declaro-specific lives in
the descriptor and the envelope.

## The name is the contract

There is no registry of event types. Subscription is by string, and the string is
built by `ActionDescriptor.toString()`
(`action-descriptor.ts:50-52`):

```
<namespace>::<resource>.<action>[:<scope>]
```

`ModelService.getDescriptor` fills it from the service's own configuration
(`lib/data/src/domain/services/base-model-service.ts:35-42`): `namespace` from
the constructor (default `'global'`), `resource` from `schema.name`, `action`
from the operation.

The transformation applied to each segment is not uniform.
`parameterize` kebab-cases namespace, resource and scope — and **not** action
(`action-descriptor.ts:26-30`, `:96-101`). Verified, for
`ModelSchema.create('BookReview')`:

```
getDescriptor('beforeCreate')  →  global::book-review.beforeCreate
getDescriptor('create', '*')   →  global::book-review.create:*
```

So the resource is kebab, the action is camel. That asymmetry is why permission
strings — which are written by hand in the controllers — use
`permanently-delete-from-trash` while the event for the same operation is
`permanentlyDeleteFromTrash`. Both are correct; they are different segments under
different rules.

Two consequences worth holding onto:

- **Renaming an entity renames every event and every permission string.**
  `schema.name` is the resource segment. A rename is a breaking change to every
  listener and every granted claim.
- **`namespace` is part of the name.** Constructing the same schema's service
  with a different `namespace` produces an entirely disjoint set of event names.

## Why you should never hand-write the string

`getDescriptor(action).toString()` is the only reliable way to produce it,
because the kebab-casing is applied by the descriptor and not by you. A listener
registered against a hand-typed `global::bookReview.afterCreate` is not an error
— it is a listener that never fires, on a bus that never warns about unmatched
keys.

Nothing validates a subscription key. `EventManager.on` creates the array for any
string you give it (`event-manager.ts:70-76`). A typo is silence.

## Sequential, awaited, and not isolated

`emitAsync` is the method the data layer uses, and its semantics are the single
most important thing to understand about the bus (`event-manager.ts:55-60`):

```typescript
async emitAsync(event: E) {
    await this.getListeners(event.type).reduce(async (promise, listener) => {
        await promise
        return await listener(event)
    }, Promise.resolve())
}
```

Listeners run **one at a time, in registration order, each awaited before the
next**. And there is no `try`/`catch` anywhere in it.

Verified: with two listeners on the same event where the first throws, the second
never runs and `emitAsync` rejects.

Because `ModelService` awaits `emitAsync` inline before returning
(`model-service.ts:246`, `:262`), the chain is:

```
one listener throws  →  remaining listeners skipped  →  emitAsync rejects
                     →  the mutation that triggered it fails
```

For a `before*` listener that is exactly right — that is how a listener vetoes an
operation. For an `after*` listener it usually is not: the write has already
landed, so the caller gets an error for an operation that succeeded, and the
other reactors never ran.

**Nothing in the framework prevents this.** A reactor that must not break its
producer has to catch its own errors. That is a decision every subscriber makes
for itself, and the framework offers no default.

Three emit methods exist, and only the first is used by the data layer:

| Method | Semantics | Errors |
|---|---|---|
| `emitAsync` | sequential, awaited | reject, and abort the rest |
| `emitAll` | concurrent via `Promise.all` (`:62-64`) | reject, siblings still run |
| `emit` | synchronous `forEach` (`:66-68`) | throw, abort the rest |

## The wildcard, and the deduping that comes with it

`getListeners` merges the event's own listeners with everything registered on
`'*'`, then dedupes (`event-manager.ts:12-17`):

```typescript
return [...new Set([...eventListeners, ...globalListeners])]
```

`'*'` is a genuine catch-all — it is how `forwardTo` bridges two managers
(`:30-36`) and how `RedisEventAdapter` mirrors every event onto a Redis channel
(`lib/redis/src/redis/redis-event-adapter.ts:9`). It is also the fastest way to
find out what an operation actually emits.

The `Set` is not free. Two behaviours fall out of it, and both are verified:

- **Registering the same function twice for one event fires it once.** Two `on`
  calls with the same reference, one invocation.
- **Unsubscribing is unreliable when a listener was registered more than once.**
  The unsubscribe closure takes `indexOf` on the *deduped* array and splices that
  index out of the *raw* array (`event-manager.ts:45-52`). With `[a, a, b]` the
  deduped array is `[a, b]`, so removing `b` computes index 1 and splices the
  second `a`. Verified: after unsubscribing, `b` still fires.

For a listener registered once — the normal case — unsubscribe works. The bug
only bites when a subscription is repeated, which is exactly what happens when a
module is wired twice.

## The envelope

`DomainEvent` (`lib/data/src/domain/events/domain-event.ts:33`) carries a uuid, a
timestamp, the descriptor, an optional `IAuthSession`, and `meta`. Two subclasses
specialise it:

```
DomainEvent
└── RequestEvent    adds `input`, plus setInput/setMeta/setResult
    ├── QueryEvent      reads
    └── MutationEvent   writes, meta typed per operation
```

`RequestEvent` (`request-event.ts:10`) is where the fluent setters live, and the
naming is worth reading carefully because it is not obvious:

| Property | Holds | Set by |
|---|---|---|
| `event.input` | the arguments — normalized input, lookup, or filters | constructor |
| `event.data` | the **result** | `.setResult()` (`request-event.ts:35-39`) |
| `event.meta` | `existing`, and the original call `args` | `.setMeta()` (`:30-33`) |

`.setResult()` writes to `data`, not to a field called `result`. On a `before*`
event `data` is undefined; on an `after*` event it is the record the repository
returned.

`meta` is where the before-state lives. `MutationEvent`'s meta types
(`mutation-event.ts:4-43`) declare `existing` plus the operation's own arguments,
which is what lets a reactor diff old against new without re-querying. Not every
path populates it — see the data-layer docs for which.

`session` is declared on the envelope (`domain-event.ts:11`) but nothing in
`@declaro/data` ever sets it. `ModelService` constructs its events with only a
descriptor and an input. Auth context does not ride the event bus; it comes from
the request context.

### Serialization is lossy

`DomainEvent.toJSON` (`domain-event.ts:59-68`) drops the descriptor entirely and
reduces the session to `{ id }`. `RequestEvent.toJSON` adds `input` back
(`request-event.ts:41-46`). So an event that crosses a process boundary arrives
with `type`, `data`, `meta`, `input`, `eventId`, `timestamp` and a stub session —
and a listener that reads `event.descriptor` gets `undefined`. Parse `type`
instead.

## Crossing processes

`EventManager` is in-process. There is no broker seam.

`RedisEventAdapter` (`lib/redis/src/redis/redis-event-adapter.ts`) is the one
bridge: it subscribes to `'*'`, `JSON.stringify`s every event onto a Redis
channel named after `event.type`, and re-emits inbound messages locally. The loop
guard is a `__fromRedis` flag stamped on the deserialized event and checked on
the way out (`redis-event-adapter.ts:11-14`, `:34`).

Three limits follow directly from that implementation:

- **Re-emission uses `emit`, not `emitAsync`** (`:38`), so remote events run
  synchronously and are not awaited.
- **Anything not JSON-serializable is dropped**, logged as `Unserializable
  event` and swallowed (`:16-22`). A `Date` survives as a string; a class
  instance arrives as a plain object.
- **The `__fromRedis` flag is set on the object, so it is not re-published** —
  but it *is* visible to local listeners.

## Where everything lives

| Piece | Path |
|---|---|
| The bus | `lib/core/src/events/event-manager.ts` |
| Name building | `lib/core/src/shared/utils/action-descriptor.ts` |
| Base envelope | `lib/data/src/domain/events/domain-event.ts` |
| Fluent setters | `lib/data/src/domain/events/request-event.ts` |
| Read events | `lib/data/src/domain/events/query-event.ts` |
| Write events + meta types | `lib/data/src/domain/events/mutation-event.ts` |
| The action list | `lib/data/src/domain/events/event-types.ts` |
| Cross-process bridge | `lib/redis/src/redis/redis-event-adapter.ts` |
| Bus tests | `lib/core/src/events/event-manager.spec.ts` |

## Gotchas

- **A throwing listener aborts the remaining listeners and fails the mutation.**
  Catch in your own listener if that is not what you want.
- **A mistyped event name is silence**, not an error.
- **Hand-writing the string gets the casing wrong.** Resource is kebab, action is
  not. Use `getDescriptor(...).toString()`.
- **Duplicate subscriptions fire once and unsubscribe wrongly.**
- **`.setResult()` writes to `event.data`.** There is no `event.result`.
- **`event.session` is never populated** by the data layer.
- **`toJSON` drops the descriptor.**
- **`emitAll` and `emit` exist but the data layer never calls them** — do not
  assume concurrency.

## See also

- [`wiring-up.md`](./wiring-up.md) — subscribing, with the full action list
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — which operation emits
  what, and where `doNotDispatchEvents` is ignored
- [`docs/context/how-it-works.md`](../context/how-it-works.md) — `Context.on` /
  `Context.emit`, a separate bus with async-context binding
