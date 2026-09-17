---
status: implemented
applies-to:
    - 'lib/core/src/events/**'
    - 'lib/data/src/domain/events/**'
---

# Subscribing to the lifecycle

How to listen for a Declaro event, what arrives in the envelope, and the full
list of names.

All paths are relative to the repository root.

---

## The name

```
<namespace>::<resource>.<action>[:<scope>]
```

Never write it by hand. Ask the service:

```typescript
const type = bookService.getDescriptor(ModelMutationAction.AfterCreate).toString()
// 'global::book.afterCreate'
```

`namespace` and `resource` are kebab-cased, `action` is not
(`lib/core/src/shared/utils/action-descriptor.ts:26-30`). For a service on
`ModelSchema.create('BookReview')` with the default namespace (verified):

```
global::book-review.beforeCreate
global::book-review.afterCreate
```

---

## The subscription

```typescript
import { ModelMutationAction } from '@declaro/data'

const off = emitter.on(
    bookService.getDescriptor(ModelMutationAction.AfterCreate).toString(),
    async (event) => {
        event.data   // the created record
        event.input  // the normalized input
        event.meta   // { existing?, args? }
    },
)

off()   // unsubscribe
```

`on` also accepts an array of event types (`event-manager.ts:38-43`), which is
the idiomatic way to cover create-and-update with one handler:

```typescript
emitter.on(
    [
        bookService.getDescriptor(ModelMutationAction.AfterCreate).toString(),
        bookService.getDescriptor(ModelMutationAction.AfterUpdate).toString(),
    ],
    handler,
)
```

### Always catch your own errors

`emitAsync` runs listeners sequentially with **no error isolation**
(`event-manager.ts:55-60`), and `ModelService` awaits it inline. A listener that
throws skips every listener after it and fails the mutation that triggered it
(verified).

That is correct for a `before*` listener vetoing an operation. For an `after*`
reactor it is almost never what you want — the write already landed:

```typescript
emitter.on(afterCreate, async (event) => {
    try {
        await reindex(event.data)
    } catch (error) {
        console.error('reindex failed for', event.eventId, error)
    }
})
```

The framework provides no wrapper for this. If you add reactors across several
entities, write one and reuse it.

---

## What is in the envelope

```typescript
interface IDomainEvent<T, M> {
    type: string              // 'global::book.afterCreate'
    eventId: string           // uuid, per emission
    timestamp: Date
    descriptor: ActionDescriptor
    data?: T                  // THE RESULT — set by .setResult()
    meta?: M                  // { existing?, args? }
    session?: IAuthSession    // never populated by @declaro/data
}
```

`RequestEvent` adds `input` (`request-event.ts:14`).

| You want | Read |
|---|---|
| the arguments the caller passed | `event.meta.args` |
| the input after `normalizeInput` | `event.input` |
| the record that came back | `event.data` |
| the record as it was before an update | `event.meta.existing` |
| which entity / operation | `event.descriptor.resource` / `.action` |

Three traps in that table:

- **`event.data` is the result, not the input.** `.setResult()` assigns to `data`
  (`request-event.ts:35-39`). There is no `event.result`.
- **`event.data` is undefined on every `before*` event.**
- **`event.meta.existing` is only populated on some paths.** `update` and
  `duplicate` set it; `upsert` and `bulkUpsert` construct their events without
  `.setMeta()` at all (`model-service.ts:363-366`, `:481-484`). A reactor that
  diffs against `meta.existing` silently no-ops on the upsert path.

---

## The full action list

From `lib/data/src/domain/events/event-types.ts`.

### Queries — `ModelQueryEvent`

| Member | Action string | Emitted by |
|---|---|---|
| `BeforeLoad` / `AfterLoad` | `beforeLoad` / `afterLoad` | `load` |
| `BeforeLoadMany` / `AfterLoadMany` | `beforeLoadMany` / `afterLoadMany` | `loadMany` |
| `BeforeSearch` / `AfterSearch` | `beforeSearch` / `afterSearch` | `search` |
| `BeforeCount` / `AfterCount` | `beforeCount` / `afterCount` | `count` |

Query events carry the lookup or filters in `input` and honour
`options.scope`, which becomes the descriptor's fourth segment
(`read-only-model-service.ts:117`). A listener on
`global::book.afterLoad` catches every scope; one on
`global::book.afterLoad:detail` catches only that scope.

### Mutations — `ModelMutationAction`

| Member | Action string | Emitted by |
|---|---|---|
| `BeforeCreate` / `AfterCreate` | `beforeCreate` / `afterCreate` | `create`, `upsert`, `bulkUpsert`, `duplicate` |
| `BeforeUpdate` / `AfterUpdate` | `beforeUpdate` / `afterUpdate` | `update`, `upsert`, `bulkUpsert` |
| `BeforeDuplicate` / `AfterDuplicate` | `beforeDuplicate` / `afterDuplicate` | `duplicate` |
| `BeforeRemove` / `AfterRemove` | `beforeRemove` / `afterRemove` | `remove` |
| `BeforeRestore` / `AfterRestore` | `beforeRestore` / `afterRestore` | `restore` |
| `BeforeEmptyTrash` / `AfterEmptyTrash` | `beforeEmptyTrash` / `afterEmptyTrash` | `emptyTrash` |
| `BeforePermanentlyDeleteFromTrash` / `After…` | `beforePermanentlyDeleteFromTrash` / … | `permanentlyDeleteFromTrash` |
| `BeforePermanentlyDelete` / `After…` | `beforePermanentlyDelete` / … | `permanentlyDelete` |

The bare members (`Create`, `Update`, `Remove`, …) are **not emitted**. They are
used as the `descriptor` handed to `normalizeInput` so a hook can tell which
operation it is running under (`model-service.ts:232-234`).

**There is no `beforeUpsert`.** `upsert` resolves to a create or an update first
and emits that pair (`model-service.ts:329-353`), which is the point: subscribe
to the operation and every entry path is covered.

---

## Discovering what an operation emits

```typescript
const seen: string[] = []
emitter.on('*', (event) => seen.push(event.type))

await service.create({ title: 'Dune', author: 'Herbert', publishedDate: new Date() })
// ['global::book.beforeCreate', 'global::book.afterCreate']
```

`'*'` is merged into every event's listener list (`event-manager.ts:12-17`). Do
this first when a listener is not firing — it is faster than reasoning about the
casing.

---

## Bridging two managers

```typescript
const cancel = childEmitter.forwardTo(parentEmitter)   // live forwarding via '*'
parentEmitter.extend(childEmitter)                     // one-time copy of listeners
```

`forwardTo` (`event-manager.ts:30-36`) registers a `'*'` listener that re-emits
into the target — ongoing. `extend` (`:23-28`) copies the listener arrays once;
later subscriptions on the child do not propagate.

For cross-process, `RedisEventAdapter`
(`lib/redis/src/redis/redis-event-adapter.ts`) mirrors every event over Redis.
Remote events are re-emitted with `emit` (synchronous, unawaited) and anything
not JSON-serializable is dropped with a `console.error`.

---

## Checklist

- [ ] Name obtained from `getDescriptor(action).toString()`, never typed by hand
- [ ] Handler wrapped in `try`/`catch` if it is an `after*` reactor
- [ ] Reading `event.data` for the result, not `event.result`
- [ ] Not relying on `event.meta.existing` if `upsert`/`bulkUpsert` can reach it
- [ ] Subscribed once — duplicate registration breaks unsubscribe
- [ ] Test asserts the emitted types (via a `'*'` listener) as well as the rows
- [ ] Listener registered against the **same** `EventManager` instance the
      service was constructed with

---

## Gotchas

- **A mistyped name is silence.** Nothing validates subscription keys.
- **Resource is kebab-cased, action is not.** `global::book-review.afterCreate`.
- **A throwing listener kills the rest of the chain and the mutation.**
- **`remove`, `restore`, `emptyTrash` and both permanent deletes ignore
  `doNotDispatchEvents`** (verified) — those events always fire.
- **Duplicate subscriptions fire once and unsubscribe removes the wrong
  entry** (`event-manager.ts:45-52`, verified).
- **`event.session` is never set** by `@declaro/data`.
- **`toJSON` drops `descriptor`** — parse `type` on the receiving side.
- **`Context` has its own emitter** (`Context.on` / `Context.emit`) which is not
  the one a service was constructed with. Registering there does not catch model
  events.

## See also

- [`how-it-works.md`](./how-it-works.md) — why the bus behaves this way
- [`docs/data/wiring-up.md`](../data/wiring-up.md) — the service that emits these
- [`docs/context/wiring-up.md`](../context/wiring-up.md) — the app-lifecycle
  events (`declaro:init`, `declaro:start`, `declaro:destroy`)
