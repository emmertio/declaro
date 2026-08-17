---
status: implemented
applies-to:
    - 'lib/core/src/schema/**'
    - 'lib/core/src/shared/utils/schema-utils.ts'
    - 'lib/zod/src/**'
---

# How the schema layer works

A `ModelSchema` is Declaro's declaration of an entity: what a record looks like
when you read one, when you list one, when you look one up, and when you write
one. Everything downstream — the service, the repository, the controller, the
event names, the permission strings, the inferred TypeScript types — is derived
from it.

For the step-by-step of declaring a new entity, read
[`wiring-up.md`](./wiring-up.md). This document is the why.

## Two objects, not one

The layer is deliberately split in two, and confusing them is the most common
source of "why won't this type-check".

| Object | What it is | Where |
|---|---|---|
| `Model` | **One shape**, plus validation and JSON Schema for it | `lib/core/src/schema/model.ts:47` |
| `ModelSchema` | **A named set** of those shapes, keyed by role | `lib/core/src/schema/model-schema.ts:73` |

A `Model` is a single validated shape — `BookDetail`, `BookInput`. A
`ModelSchema` is the entity `Book`, which *has* a detail model, an input model, a
lookup model, and so on. Services take a `ModelSchema`; validation happens
against the individual `Model`s inside it.

## Why `Model` is abstract, and zod is not in core

`Model` is an abstract class implementing `StandardSchemaV1`
(`model.ts:47-50`). Its constructor rejects anything that does not carry a
version-1 `~standard` property (`model.ts:69-71`). Validation always goes through
that property:

```typescript
const result = await this.schema['~standard'].validate(...)
```

Only one concrete implementation ships — `ZodModel` in `@declaro/zod`
(`lib/zod/src/zod-model.ts:11`) — and its entire job is `toJSONSchema`, the one
abstract method. Everything else is inherited.

The point of that split is that **the data layer never sees zod**. `ModelService`,
`IRepository` and the controllers are typed against `Model`, so a schema built on
Valibot or ArkType would flow through the whole pipeline unchanged, provided it
implements `toJSONSchema`.

That is the design. The reality is narrower, and worth knowing before you plan
around it:

- `@declaro/core` imports `zod/v4` directly in `model-schema.ts:16`, for a
  block of dead sample code at the bottom of the file
  (`model-schema.ts:191-197`). `zod` is **not** declared in core's dependencies;
  it resolves through monorepo hoisting.
- `@declaro/data` hard-wires zod in `domain/models/pagination.ts:1-2`, which
  imports both `zod/v4` and `ZodModel`. Pagination is in every search result, so
  the data package is not zod-free either.

So the abstraction is real at the type level and leaky at the packaging level.
A non-zod `Model` works; a zod-free install does not.

## The builder, and why each call returns a new schema

`ModelSchema` is an immutable fluent builder. Every one of `.read()`,
`.search()`, `.write()`, `.custom()` and `.entity()` returns a **new**
`ModelSchema` rather than mutating (`model-schema.ts:126`, `:142`, `:158`,
`:110`, `:177`). A schema can therefore be shared as a base and specialised
without the specialisations interfering.

```typescript
export const MockBookSchema = ModelSchema.create('Book')
    .read({ detail: (h) => new ZodModel(h.name, …), lookup: (h) => new ZodModel(h.name, …) })
    .search({ filters: …, summary: …, sort: … })
    .write({ input: … })
    .entity({ primaryKey: 'id' })
```

Each group is a **mixin** (`schema/schema-mixin.ts`). A mixin declares the model
slots it contributes and the *name* each one should get; you supply a factory per
slot and the builder calls it with a helper carrying that name
(`schema-mixin.ts:23-37`):

| Call | Slots it defines | Name each model receives |
|---|---|---|
| `.read()` | `detail`, `lookup` | `<Name>Detail`, `<Name>Lookup` |
| `.search()` | `summary`, `filters`, `sort` | `<Name>Summary`, `<Name>Filters`, `<Name>Sort` |
| `.write()` | `input` | `<Name>Input` |
| `.custom()` | whatever you pass | the bare `<Name>` for every slot |

Naming is why the factory signature is `(h) => new ZodModel(h.name, …)` rather
than a bare model. The builder owns the name so that a schema called `Book`
always produces a model called `BookDetail`, no matter who wrote the factory.
Those names are not decorative: `Model.formatIssues` uses the JSON Schema `title`
and the field label to turn a raw zod issue into `Validation failed for field
"Title": …` (`model.ts:117-142`).

`.custom()` is the escape hatch, and it does **not** apply the naming convention
— it hands every slot the schema's own helper (`model-schema.ts:103-107`), so
every model gets the same bare name. `AuthSessionSchema`
(`lib/auth/src/domain/models/auth-session.ts:97`) and `PaginationSchema`
(`lib/data/src/domain/models/pagination.ts:25`) both use it, because neither is a
CRUD entity.

## `.entity()` is the part that fails quietly

`.entity({ primaryKey })` is what makes a schema addressable — it is what
`getPrimaryKeyValue`, `upsert`, `bulkUpsert` and `duplicate` all read
(`lib/data/src/domain/services/base-model-service.ts:44-51`).

It validates the primary key **at runtime, against the lookup model's JSON Schema
keys** (`model-schema.ts:173-176`):

```typescript
const lookupKeys = Object.keys(lookupMeta?.properties ?? {})
const metaIsValid = meta && typeof meta.primaryKey === 'string' && lookupKeys.includes(meta.primaryKey)
```

And if it is not valid, it **stores `undefined` and returns normally**
(`model-schema.ts:180`). There is no throw and no warning. Verified:

```
.entity({ primaryKey: 'nope' })  →  getEntityMetadata()  →  undefined
```

The failure surfaces much later and somewhere else: `getPrimaryKeyValue` returns
`undefined` (`base-model-service.ts:47-49`), so `upsert` decides every record is
a create, and `bulkUpsert` never loads existing rows. Nothing throws; you just
get duplicates.

Two things follow, and both are load-bearing:

- **`.entity()` must come after `.read()`**, because it reads the lookup model
  that `.read()` defines. Before it, `lookupKeys` is empty and every key is
  invalid.
- **`.entity()` should be the last call in the chain.** `.search()` and
  `.write()` drop the entity-metadata type parameter from their return type
  (`model-schema.ts:138`, `:154` — compare `.read()` at `:122` and `.custom()` at
  `:102`, which both keep it). The runtime value survives, because all four pass
  `this.entityMetadata` to the new instance. The *type* does not. Verified: with
  `.entity()` before `.write()`, `InferEntityMetadata<typeof schema>` resolves to
  `undefined` and `metadata.primaryKey` errors with `'b' is possibly 'undefined'`;
  with `.entity()` last, it type-checks.

That asymmetry means the ordering bug shows up as a confusing type error on an
unrelated line, or — if the code casts through `any` — not at all.

## Types are inferred, never written

The whole point of declaring the shapes once is that nothing downstream restates
them. `lib/data/src/shared/utils/schema-inference.ts` projects a schema into
every type the layer needs:

```typescript
export type InferDetail<TSchema> = InferModelOutput<TSchema['definition']['detail']>
export type InferInput<TSchema>  = InferModelInput<TSchema['definition']['input']>
export type InferLookup<TSchema> = InferModelInput<TSchema['definition']['lookup']>
```

Note which side each one takes. **Detail and summary infer the schema's *output*;
input, lookup, filters and sort infer its *input*.** That is deliberate: a
`z.coerce.date()` field is a `string | Date` going in and a `Date` coming out, and
a read model should promise the coerced form while a write model must accept the
raw one.

`InferPrimaryKeyType` is the one that composes them
(`schema-inference.ts:17-18`): it indexes the lookup type by the entity
metadata's `primaryKey`. When `.entity()` silently failed, this is a lookup into
`undefined` — which is the type error you actually see.

## Private fields are a schema concern

A field marked private is removed whenever a payload crosses a boundary. The mark
itself is one line of zod metadata (`lib/zod/src/fields.ts:15-19`):

```typescript
export function privateField<TField extends ZodType>(field: TField) {
    return field.optional().meta({ private: true })
}
```

It is forced optional on purpose: the field is stripped *before* validation runs
(`model.ts:150-155`), so a required private field could never satisfy its own
model.

From there the mark travels through JSON Schema, not through zod, which is what
keeps the mechanism generic. `ZodModel.toJSONSchema` emits it and then strips it
unless asked not to (`zod-model.ts:29-31`), and `Model` keeps two memoised copies
— one with private fields, one without (`model.ts:66`, `:86-96`) — because
building a JSON Schema is the expensive part and it would otherwise be repeated
per record on every response.

`stripPrivateValues` (`shared/utils/schema-utils.ts:199`) walks the payload
against that schema. Two of its properties matter downstream:

- **Unions fail closed.** A field marked private in *any* `anyOf`/`oneOf`/`allOf`
  branch is treated as private (`schema-utils.ts:92-127`, `:154`). A branch that
  forgets the mark cannot leak the field.
- **Nothing is copied unless something changed.** Objects and arrays with no
  private fields are returned by reference (`schema-utils.ts:238`, `:259`), so
  the common case costs a walk and no allocation.

How the stripped payload actually reaches a client is the serialization layer's
job — see [`docs/serialization/`](../serialization/how-it-works.md).

## What a validation call actually does

`Model.validate` is three steps, in this order (`model.ts:188-195`):

1. **Strip private fields** unless `includePrivateFields: true`.
2. **Validate** through `~standard`.
3. **Throw or return** — `ValidationError` by default, issues if
   `strict: false`.

Step 1 before step 2 is the reason a client cannot write to a private field: the
value is gone before the schema ever sees it. It is also why `strict: false`
exists — the `~standard` implementation must *return* issues rather than throw,
because the spec says so, so it calls itself with `{ strict: false }`
(`model.ts:243`).

`validateSync` is the same path without the await, and it throws `SystemError` if
the underlying schema is asynchronous (`model.ts:215-220`). It exists solely
because `toJSON` cannot await — see the serialization docs.

## Where everything lives

| Piece | Path |
|---|---|
| Validation seam | `lib/core/src/schema/model.ts` |
| Entity builder | `lib/core/src/schema/model-schema.ts` |
| Mixin machinery | `lib/core/src/schema/schema-mixin.ts` |
| Label/pluralisation helper | `lib/core/src/schema/labels.ts` |
| JSON Schema types | `lib/core/src/schema/json-schema.ts` |
| Private-field walking | `lib/core/src/shared/utils/schema-utils.ts` |
| Serialization wrapper | `lib/core/src/schema/wrap-model.ts` |
| Zod implementation | `lib/zod/src/zod-model.ts` |
| `privateField` / `hiddenField` | `lib/zod/src/fields.ts` |
| Sort helpers | `lib/zod/src/sort.ts` |
| Type inference | `lib/data/src/shared/utils/schema-inference.ts` |
| Reference entity | `lib/data/src/test/mock/models/mock-book-models.ts` |

## Gotchas

- **A bad `primaryKey` is silent.** `.entity()` stores `undefined` rather than
  throwing. Assert `getEntityMetadata()` in a test.
- **`.entity()` last.** `.search()` and `.write()` erase its type.
- **`@declaro/core`'s index re-exports the test mock.** `schema/test/mock-model`
  is exported from `lib/core/src/index.ts:48`, so a root import can pull mocks
  and zod into a production bundle. Prefer deep imports.
- **`hiddenField` is not `privateField`.** Hidden fields are still sent and still
  validated (`lib/zod/src/fields.ts:30-34`); only the generated UI omits them.
- **Labels are pluralisation-driven.** `getLabels` runs the model name through
  `pluralize` (`labels.ts:17-29`), so an entity named `Series` or `Data` gets
  labels you did not intend.

## See also

- [`wiring-up.md`](./wiring-up.md) — declaring a new entity, step by step
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — what the service does
  with the schema
- [`docs/serialization/how-it-works.md`](../serialization/how-it-works.md) — how
  private fields actually get removed from a response
