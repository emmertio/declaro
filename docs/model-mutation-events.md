# Model mutation events

`ModelService` announces every entity mutation twice: once before the repository writes and once after.
Each announcement is a `ModelMutationEvent`, and a `ModelMutationEvent` always carries an **array of
entries**, one per entity, whether the service method touched one record or a whole batch. Subscribers
therefore always iterate, which keeps them correct and cheap when a bulk operation runs.

## Which events

| Service method               | Before event                       | After event                       | Entry `input`     | Entry `result`  |
| ---------------------------- | ---------------------------------- | --------------------------------- | ----------------- | --------------- |
| `create`                     | `beforeCreate`                     | `afterCreate`                     | normalized input  | created detail  |
| `update`                     | `beforeUpdate`                     | `afterUpdate`                     | normalized input  | updated detail  |
| `upsert`                     | `beforeCreate` or `beforeUpdate`   | `afterCreate` or `afterUpdate`    | normalized input  | detail          |
| `bulkUpsert`                 | `beforeCreate` and `beforeUpdate`  | `afterCreate` and `afterUpdate`   | normalized inputs | details         |
| `duplicate`                  | `beforeDuplicate` (then create's)  | `afterDuplicate` (after create's) | input of the copy | the copy        |
| `remove`                     | `beforeRemove`                     | `afterRemove`                     | the lookup        | removed summary |
| `restore`                    | `beforeRestore`                    | `afterRestore`                    | the lookup        | summary         |
| `permanentlyDelete`          | `beforePermanentlyDelete`          | `afterPermanentlyDelete`          | the lookup        | summary         |
| `permanentlyDeleteFromTrash` | `beforePermanentlyDeleteFromTrash` | `afterPermanentlyDeleteFromTrash` | the lookup        | summary         |

`bulkUpsert` dispatches at most four events for the whole batch: one `beforeCreate` carrying every
entry that will be created, one `beforeUpdate` carrying every entry that will be updated, then the
matching `afterCreate` and `afterUpdate`. A group with no entries dispatches no event.

`emptyTrash` is the one mutation with no entities to name, only filters. Its `beforeEmptyTrash` and
`afterEmptyTrash` events stay plain `MutationEvent`s: the filters are `event.input` and the deleted
count is `event.data`.

Query events (`beforeLoad`, `afterSearch`, and so on) are unchanged. They are `QueryEvent`s.

## The entry

Everything the mutation knows about one entity lives on its entry, so nothing has to be lined up by
position:

```ts
interface IMutationEntry<TResult, TInput, TLookup> {
    key?: EntityKey // the primary key value, when known
    lookup?: TLookup // the lookup that identified the entity (update, duplicate, remove, ...)
    input: TInput // what the mutation runs with; before-event subscribers may change it
    existing?: TResult // the record before the write, when the service loaded it (update, duplicate)
    result?: TResult // the record after the write; after-events only
}
```

The key is always known after the write. Before a create it is known only when the input carries one.

## Reading an event

```ts
import { ModelMutationAction, type ModelUpdateEvent } from '@declaro/data'

emitter.on(
    service.getDescriptor(ModelMutationAction.AfterUpdate).toString(),
    async (event: ModelUpdateEvent<typeof BookSchema>) => {
        for (const entry of event.entries) {
            if (entry.existing?.author !== entry.result?.author) {
                await reindex(entry.result!)
            }
        }
    },
)
```

Accessors on the event:

- `entries`, `size` – the batch.
- `inputs`, `results`, `existing`, `lookups`, `keys` – one collection each, in entry order, skipping entries that lack the value.
- `get(key)`, `has(key)`, `getInput(key)`, `getResult(key)`, `getExisting(key)` – lookups by primary key.
- `meta.primaryKey` – the primary key field name, which is how the event reads keys off records.
- `meta.args.options` – the options the caller passed. `duplicate` also puts its `overrides` here.

Schema-typed aliases save spelling out the generics: `ModelCreateEvent<TSchema>`, `ModelUpdateEvent<TSchema>`,
`ModelDuplicateEvent<TSchema>`, `ModelRemoveEvent<TSchema>`, `ModelRestoreEvent<TSchema>`,
`ModelPermanentDeleteEvent<TSchema>`. The raw class is `ModelMutationEvent<TResult, TInput, TLookup, TMeta>`
for subscribers typed against plain interfaces.

## Changing what gets written or returned

A before-event subscriber may replace an entry's `input`, or mutate it in place. The service writes
whatever is on the entries once every subscriber has run:

```ts
emitter.on('files::file.beforeCreate', async (event: ModelCreateEvent<typeof FileSchema>) => {
    for (const entry of event.entries) {
        if (entry.input.stream) Object.assign(entry.input, await storage.upload(entry.input))
    }
})
```

An after-event subscriber may replace an entry's `result`, and the service returns the replacement
to its caller. The repository is not written again.

## Serialization

The entries are the event's `data`, so `JSON.stringify(event)` yields the usual `DomainEvent` shape
(`eventId`, `type`, `timestamp`, `meta`, `session`) with `data` as the array of entries. The
primary-key index is derived and never serialized.

## Migrating a subscriber from `MutationEvent`

Before this change `ModelService` dispatched a `MutationEvent` per record, and a subscriber read
`event.input`, `event.data`, `event.meta.existing` and `event.meta.args`. Those properties are not on a
`ModelMutationEvent`, and because `context.on<E>()` takes the event type on trust, **the mismatch is not
a compile error**: `event.data?.uuid` reads `undefined` and the subscriber silently does nothing.
Audit every subscriber of a lifecycle action.

| Before                              | After                                                            |
| ----------------------------------- | ---------------------------------------------------------------- |
| `event.input`                       | `entry.input` for each `entry` of `event.entries`                |
| `event.data`                        | `entry.result`                                                   |
| `event.meta.existing`               | `entry.existing`                                                 |
| `event.meta.args.lookup`            | `entry.lookup`                                                   |
| `event.meta.args.input`             | `entry.input`                                                    |
| `event.meta.args.options`           | `event.meta.args.options` (unchanged)                            |
| `event.meta.args.overrides`         | `event.meta.args.overrides` (unchanged)                          |
| `Object.assign(event.input, patch)` | `Object.assign(entry.input, patch)`                              |
| `event.data = enriched`             | `entry.result = enriched`                                        |
| `MutationEvent<IItem, IItemInput>`  | `ModelMutationEvent<IItem, IItemInput>` or `ModelUpdateEvent<S>` |

A subscriber that must stay per-record can wrap its old body in a loop over `event.entries`. A
subscriber that triggers a recalculation per parent should instead collect the parent keys from all
entries into a `Set` and recalculate each parent once; that is the point of the batch.

Custom events that `extend MutationEvent` and are dispatched by application code are not affected.
`MutationEvent`, `QueryEvent`, `RequestEvent` and `DomainEvent` are unchanged.
