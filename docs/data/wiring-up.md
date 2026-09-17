---
status: implemented
applies-to:
    - 'lib/data/src/**'
---

# Wiring up an entity's data layer

From a `ModelSchema` to a working service, and optionally a permission-checked
controller.

All paths are relative to the repository root. Assumes the schema already exists
— see [`docs/schema/wiring-up.md`](../schema/wiring-up.md).

---

## What must be true first

| Requirement | Breaks how |
|---|---|
| `.entity({ primaryKey })` succeeded | `upsert` creates duplicates, `duplicate` copies the key — silently |
| The schema defines `detail` and `lookup` | `load` cannot be typed; `wrapDetail` is a no-op |
| The schema defines `input` | `create`/`update` cannot be typed; `parseInput` is a no-op |
| The schema defines `summary` | `search`, `remove` and `restore` return unwrapped records |
| An `EventManager` instance exists | constructor requires it, no default |
| The repository implements all 13 `IRepository` methods | runtime `TypeError` on the first call to a missing one |

Note the failure mode of the three schema rows: `wrapDetail` and `parseInput`
both no-op when the model is absent (`base-model-service.ts:80-82`,
`model-controller.ts:30-32`). Missing a model does not throw — it turns off
private-field stripping.

---

## Step 1 — implement the repository

`IRepository<TSchema>` (`domain/interfaces/repository.ts:13`) is the only
interface you must implement. Thirteen methods, all typed off the schema:

```typescript
import type { IRepository } from '@declaro/data'

export class BookRepository implements IRepository<typeof BookSchema> {
    async load(lookup: BookLookup, options?: ILoadOptions): Promise<BookDetail | null> { … }
    async loadMany(lookups: BookLookup[], options?: ILoadOptions): Promise<BookDetail[]> { … }
    async search(filters: BookFilters, options?: ISearchOptions<…>): Promise<BookSearchResults> { … }
    async count(filters: BookFilters, options?: ISearchOptions<…>): Promise<number> { … }

    async create(input: BookInput, options?: ICreateOptions): Promise<BookDetail> { … }
    async update(lookup: BookLookup, input: BookInput, options?: IUpdateOptions): Promise<BookDetail> { … }
    async upsert(input: BookInput, options?): Promise<BookDetail> { … }
    async bulkUpsert(inputs: BookInput[], options?): Promise<BookDetail[]> { … }

    async remove(lookup: BookLookup, options?: ILoadOptions): Promise<BookSummary> { … }
    async restore(lookup: BookLookup, options?: ILoadOptions): Promise<BookSummary> { … }
    async emptyTrash(filters?: BookFilters): Promise<number> { … }
    async permanentlyDeleteFromTrash(lookup: BookLookup): Promise<BookSummary> { … }
    async permanentlyDelete(lookup: BookLookup): Promise<BookSummary> { … }
}
```

Contract points the service depends on:

- **`remove` is soft.** `restore` must be able to bring the record back;
  `permanentlyDelete` must not. `MockMemoryRepository` models this as two maps,
  `data` and `trash` (`test/mock/repositories/mock-memory-repository.ts:24-25`).
- **`ILoadOptions.removedOnly` / `.includeRemoved`** select which of those the
  read hits (`read-only-model-service.ts:18-39`).
- **`search` returns `{ results, pagination }`** — the service spreads the
  envelope and replaces only `results` (`read-only-model-service.ts:206-211`), so
  pagination is entirely the repository's to compute.
- **`bulkUpsert` must return results positionally.** The service pairs
  `results[i]` with `inputInfos[i]` when emitting after-events
  (`model-service.ts:499-514`).
- **`options` may be undefined.** Every option is optional on every call.

Copy `MockMemoryRepository` for the semantics; it is the executable spec.

---

## Step 2 — construct the service

Plain construction. No container required:

```typescript
import { EventManager } from '@declaro/core'
import { ModelService } from '@declaro/data'

const emitter = new EventManager()

const bookService = new ModelService({
    schema: BookSchema,
    emitter,
    repository: new BookRepository(),
    namespace: 'catalog',      // optional, defaults to 'global'
})
```

`IModelServiceArgs` is the whole surface (`domain/services/model-service-args.ts`):

| Arg | Required | Effect |
|---|---|---|
| `schema` | yes | drives types, event names, permission strings, wrapping |
| `emitter` | yes | the bus every `before*`/`after*` goes to |
| `repository` | yes | storage |
| `namespace` | no | first segment of every event and permission string; defaults to `'global'` |

**`namespace` is not cosmetic.** It is the first segment of every descriptor
(`base-model-service.ts:35-42`), so changing it renames every event listener key
and every permission string for that entity.

Use `ReadOnlyModelService` instead when the entity has no write path — it has no
`create`/`update`/`remove` at all, so the absence is enforced by the type system
rather than by a router that remembers to exclude the verbs.

---

## Step 3 — add business rules with `normalize*`

Subclass and override. Do not put rules in listeners; they belong here where they
run on every path.

```typescript
export class BookService extends ModelService<typeof BookSchema> {
    protected async normalizeInput(input: BookInput, args: INormalizeInputArgs<typeof BookSchema>) {
        return {
            ...input,
            title: input.title.trim(),
            // args.existing is set on update, undefined on create
            createdAt: args.existing ? args.existing.createdAt : new Date(),
        }
    }

    protected async normalizeLookup(lookup: BookLookup) {
        return { ...lookup, tenantId: currentTenantId() }
    }
}
```

| Hook | Signature location | Runs |
|---|---|---|
| `normalizeInput(input, { existing, descriptor })` | `model-service.ts:52` | before every write |
| `normalizeLookup(lookup)` | `read-only-model-service.ts:89` | before every addressed op |
| `normalizeSort(sort?)` | `read-only-model-service.ts:101` | before `search` |
| `normalizeDetail(detail)` | `read-only-model-service.ts:65` | on every returned detail |
| `normalizeSummary(summary)` | `read-only-model-service.ts:77` | on every returned summary |

- `args.descriptor.action` distinguishes `create` from `update` when
  `args.existing` is not enough (`model-service.ts:232-234`, `:277-280`).
- **`normalizeLookup` is the tenancy hook.** It covers `load`, `loadMany`,
  `update`, `remove`, `restore` and both permanent deletes at once. Filters are
  *not* routed through it — scope `search`/`count` separately.
- **Never query in `normalizeDetail`/`normalizeSummary`.** They run once per
  record, in parallel, on every list page. Batch in an overridden `search`.

---

## Step 4 — subscribe to the lifecycle

Event names are built by `getDescriptor` (`base-model-service.ts:35-42`) and
always take the form:

```
<namespace>::<resource>.<action>
```

with `namespace` and `resource` **kebab-cased** and `action` left as-is. Ask the
service rather than hand-writing the string:

```typescript
emitter.on(bookService.getDescriptor(ModelMutationAction.AfterCreate).toString(), async (event) => {
    event.data   // the created record
    event.input  // the normalized input
    event.meta   // { existing?, args? }
})
```

Full details, including the whole action list, are in
[`docs/events/wiring-up.md`](../events/wiring-up.md).

---

## Step 5 (optional) — add a controller

Only if the entity is exposed to untrusted callers.

```typescript
import { ModelController } from '@declaro/data'

const bookController = new ModelController(bookService, authValidator)
```

To tighten one operation, override its `*Permissions` method — not the operation:

```typescript
export class BookController extends ModelController<typeof BookSchema> {
    async removePermissions(lookup: BookLookup) {
        return PermissionValidator.create().allOf([
            this.service.getDescriptor('remove', '*').toString(),
            'catalog::book.archive:*',
        ])
    }
}
```

Default permission sets (`read-only-model-controller.ts`, `model-controller.ts`):

| Operation | Accepts |
|---|---|
| `load` / `loadMany` / `search` / `count` | that action, **or** `read` |
| `create` / `update` / `remove` / `restore` | that action, **or** `write` |
| `upsert` / `bulkUpsert` | (`create` **and** `update`), **or** `write` |
| `permanentlyDeleteFromTrash` | `permanently-delete-from-trash`, `permanently-delete`, or `empty-trash` |
| `permanentlyDelete` | `permanently-delete` |
| `emptyTrash` | `empty-trash` |

All are scoped `:*`. **Action segments in permission strings are written in
kebab-case** (`permanently-delete-from-trash`) while the *event* for the same
operation is camelCase (`permanentlyDeleteFromTrash`) — the descriptor
kebab-cases namespace, resource and scope but never the action
(`lib/core/src/shared/utils/action-descriptor.ts:26-30`).

To expose `duplicate`, write it yourself — the controller has no such method:

```typescript
async duplicatePermissions(lookup: BookLookup) {
    return PermissionValidator.create().someOf([
        this.service.getDescriptor('create', '*').toString(),
        this.service.getDescriptor('write', '*').toString(),
    ])
}

async duplicate(lookup: BookLookup, overrides?: Partial<BookInput>) {
    this.authValidator.validatePermissions((v) => v.extend(await this.duplicatePermissions(lookup)))
    return this.serializeDetail(await this.service.duplicate(lookup, overrides))
}
```

---

## Testing it

```typescript
import { EventManager } from '@declaro/core'
import { ModelService, MockMemoryRepository, MockBookSchema } from '@declaro/data'

const emitter = new EventManager()
const service = new ModelService({
    schema: MockBookSchema,
    emitter,
    repository: new MockMemoryRepository({ schema: MockBookSchema }),
})

const seen: string[] = []
emitter.on('*', (event) => seen.push(event.type))

await service.create({ title: 'Dune', author: 'Herbert', publishedDate: new Date() })
// seen === ['global::book.beforeCreate', 'global::book.afterCreate']
```

`'*'` is a real wildcard listener key on `EventManager`
(`lib/core/src/events/event-manager.ts:14`) and is the fastest way to see what an
operation actually emits.

---

## Checklist

- [ ] `Schema.getEntityMetadata()?.primaryKey` asserted in a test
- [ ] Repository implements all 13 methods; `remove` is soft, `permanentlyDelete`
      is not
- [ ] `search` computes `pagination`; `bulkUpsert` returns positionally
- [ ] Service constructed with `{ schema, emitter, repository }`
- [ ] `namespace` chosen deliberately (it is in every event and permission string)
- [ ] `ReadOnlyModelService` used where there is no write path
- [ ] Business rules in `normalize*`, not in listeners
- [ ] No queries in `normalizeDetail` / `normalizeSummary`
- [ ] Controller added only if callers are untrusted
- [ ] Test asserting the emitted event types, not just the returned row

---

## Gotchas

- **`doNotDispatchEvents` is ignored by `remove`, `restore`, `emptyTrash`,
  `permanentlyDelete` and `permanentlyDeleteFromTrash`** (verified). If a
  listener must not run for those, gate inside the listener.
- **`upsert`/`bulkUpsert` events carry empty `meta`** — no `existing`, no `args`.
  A listener that diffs against `meta.existing` no-ops on that path.
- **`bulkUpsert` fires before-events via `Promise.all`** — concurrent, unordered.
- **`load` can return `null`** despite its non-nullable signature.
- **Missing schema models silently disable protection.** No `input` model → no
  `parseInput` stripping. No `detail` model → no wrapping.
- **No transactions.** A throwing after-listener fails the caller with the write
  already committed.
- **`@declaro/data`'s index exports the mocks.** `MockMemoryRepository`,
  `MockBookSchema` and friends are importable from the package root — convenient
  in tests, a hazard in a production bundle.

## See also

- [`how-it-works.md`](./how-it-works.md) — why the layers are split this way
- [`docs/events/wiring-up.md`](../events/wiring-up.md) — subscribing to the
  lifecycle
- [`docs/auth/wiring-up.md`](../auth/wiring-up.md) — supplying the
  `AuthValidator` a controller needs
