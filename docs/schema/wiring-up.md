---
status: implemented
applies-to:
    - 'lib/core/src/schema/**'
    - 'lib/zod/src/**'
---

# Declaring an entity

How to build a `ModelSchema`, what each slot is for, and what breaks if you get
the order wrong.

All paths are relative to the repository root.

---

## The shape you are aiming for

`lib/data/src/test/mock/models/mock-book-models.ts` is the reference entity in
this repo. Copy it.

```typescript
import { ModelSchema } from '@declaro/core'
import { sortArray, ZodModel } from '@declaro/zod'
import { z } from 'zod/v4'

export const MockBookSchema = ModelSchema.create('Book')
    .read({
        detail: (h) => new ZodModel(h.name, z.object({
            id: z.number().int().positive(),
            title: z.string().min(2).max(100),
            author: z.string().min(2).max(100),
            publishedDate: z.coerce.date(),
        })),
        lookup: (h) => new ZodModel(h.name, z.object({
            id: z.number().int().positive(),
        })),
    })
    .search({
        filters: (h) => new ZodModel(h.name, z.object({ text: z.string().optional() })),
        summary: (h) => new ZodModel(h.name, z.object({ /* list shape */ })),
        sort:    (h) => new ZodModel(h.name, sortArray(['title', 'author'])),
    })
    .write({
        input: (h) => new ZodModel(h.name, z.object({
            id: z.number().int().positive().optional(),
            title: z.string().min(2).max(100),
            author: z.string().min(2).max(100),
            publishedDate: z.coerce.date(),
        })),
    })
    .entity({ primaryKey: 'id' })
```

Then export the inferred types beside it, so consumers never restate a shape:

```typescript
export type MockBookDetail  = InferDetail<typeof MockBookSchema>
export type MockBookInput   = InferInput<typeof MockBookSchema>
export type MockBookLookup  = InferLookup<typeof MockBookSchema>
export type MockBookSummary = InferSummary<typeof MockBookSchema>
```

---

## The slots

| Slot | Defined by | Used by | Inferred from |
|---|---|---|---|
| `detail` | `.read()` | `load`, `loadMany`, `create`, `update`, `upsert`, `duplicate` return values | model **output** |
| `lookup` | `.read()` | every method that addresses one record; validates `primaryKey` | model **input** |
| `summary` | `.search()` | `search` results, `remove`/`restore`/`permanentlyDelete` return values | model **output** |
| `filters` | `.search()` | `search`, `count`, `emptyTrash` arguments | model **input** |
| `sort` | `.search()` | `ISearchOptions.sort` | model **input** |
| `input` | `.write()` | `create`, `update`, `upsert`, `bulkUpsert` arguments | model **input** |

Read slots infer the **output** type, write slots the **input** type. With
`z.coerce.date()` that is the difference between a caller being allowed to send a
string and a reader being promised a `Date`.

### Naming is automatic

The factory receives a helper whose `name` the builder chose. Always use it:

```typescript
detail: (h) => new ZodModel(h.name, …)   // → "BookDetail"
```

`ModelSchema.create('Book')` produces `BookDetail`, `BookLookup`, `BookSummary`,
`BookFilters`, `BookSort`, `BookInput` (verified). Hand-writing a name breaks the
validation messages, which look the name up to say *which field* failed
(`lib/core/src/schema/model.ts:141-166`).

### `sort` needs the zod helpers

`sortArray(['title', 'author'])` builds
`z.array(z.object({ title: …, author: … }))` where each value is one of
`asc | desc | asc nulls first | asc nulls last | desc nulls first | desc nulls last`
(`lib/zod/src/sort.ts:3-26`). Use `sortObject` for the single-object form.

---

## Order matters

```
.read()  →  .search()  →  .write()  →  .entity()
                                       └── last, always
```

Two independent rules produce that ordering:

1. **`.entity()` reads the lookup model**, so `.read()` must come first
   (`model-schema.ts:173-176`). Before it, every `primaryKey` is invalid and is
   silently discarded.
2. **`.search()` and `.write()` erase the entity-metadata type.** Their return
   types omit the third type parameter (`model-schema.ts:138`, `:154`) where
   `.read()` (`:122`) and `.custom()` (`:102`) preserve it.

Rule 2 fails at the type level only. The runtime value survives — all four
methods pass `this.entityMetadata` through — so a codebase that casts through
`any` will not notice until `upsert` starts creating duplicates.

Verified:

```
.entity() before .write()  →  InferEntityMetadata<…> = undefined
                              metadata.primaryKey → "possibly 'undefined'"
.entity() last             →  type-checks
```

---

## Private and hidden fields

```typescript
import { privateField, hiddenField } from '@declaro/zod'

const UserDetail = new ZodModel(h.name, z.object({
    id: z.string(),
    email: z.string(),
    passwordHash: privateField(z.string()),   // never leaves the service
    internalRank: hiddenField(z.number()),    // sent, just not rendered
}))
```

| | Sent to clients | Writable by clients | In published JSON Schema | In generated UI |
|---|---|---|---|---|
| normal | yes | yes | yes | yes |
| `hiddenField` | yes | yes | yes | no |
| `privateField` | no | no | no | no |

`privateField` forces the field optional (`lib/zod/src/fields.ts:16`) because
stripping happens *before* validation — a required private field could never
satisfy its own model.

Mark the field on **both** the read model and the input model if you want it
neither readable nor writable. They are separate models and each is stripped
against its own schema.

See [`docs/serialization/wiring-up.md`](../serialization/wiring-up.md) for where
the stripping actually happens and how to opt a trusted consumer back in.

---

## `.custom()`, for things that are not entities

```typescript
export const PaginationSchema = ModelSchema.create('Pagination').custom({
    input: () => PaginationInput,
    output: () => PaginationOutput,
})
```

`.custom()` defines arbitrary slots but **does not apply the naming convention** —
every slot receives the schema's bare name (`model-schema.ts:103-107`). Use it
for value objects and envelopes (`PaginationSchema`, `AuthSessionSchema`), not
for anything a `ModelService` will be built on.

---

## Checklist

- [ ] `ModelSchema.create('<PascalCaseSingular>')` — the name drives event
      strings, permission strings and labels
- [ ] `.read({ detail, lookup })` first
- [ ] Every factory uses `h.name`
- [ ] `.search({ filters, summary, sort })` if the entity is listable
- [ ] `.write({ input })` if the entity is writable
- [ ] `.entity({ primaryKey })` **last**, with a key that exists in `lookup`
- [ ] A test asserting `Schema.getEntityMetadata()?.primaryKey` is what you meant
- [ ] Inferred types exported beside the schema
- [ ] `privateField` on anything the service owns, on **both** read and input
      models

---

## Gotchas

- **A wrong `primaryKey` throws nothing.** `.entity()` stores `undefined`
  (`model-schema.ts:180`). This is the single highest-value assertion to write.
- **`.entity()` after `.search()`/`.write()`** or the type is erased.
- **The name is kebab-cased downstream.** `ModelSchema.create('BookReview')`
  yields events named `global::book-review.beforeCreate` and permissions named
  `global::book-review.create:*` (verified). Renaming an entity renames every
  permission string granted against it.
- **`pluralize` runs on the name.** `getLabels` (`schema/labels.ts:17-29`) drives
  slugs and labels off it, so `Series`, `Data` and `Status` produce surprising
  results. Check `Schema.labels` if a route or label looks wrong.
- **Import from `@declaro/zod`, not `zod`, for `privateField`/`sortArray`.**
- **Prefer deep imports over the `@declaro/core` root.** Its index exports
  `schema/test/mock-model` (`lib/core/src/index.ts:48`).

## See also

- [`how-it-works.md`](./how-it-works.md) — why the layer is split into `Model`
  and `ModelSchema`, and what `.entity()` is really for
- [`docs/data/wiring-up.md`](../data/wiring-up.md) — turning the schema into a
  service
