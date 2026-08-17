---
status: implemented
applies-to:
    - 'lib/core/src/schema/wrap-model.ts'
    - 'lib/data/src/domain/services/base-model-service.ts'
    - 'lib/data/src/application/**'
    - 'lib/zod/src/fields.ts'
---

# Wiring up private fields and serialization

Marking a field private, controlling how a layer serializes, and getting the full
record back when a trusted consumer needs it.

All paths are relative to the repository root.

---

## Step 1 — mark the field

```typescript
import { privateField } from '@declaro/zod'

const UserDetail = new ZodModel(h.name, z.object({
    id: z.string(),
    email: z.string(),
    passwordHash: privateField(z.string()),
}))
```

`privateField` (`lib/zod/src/fields.ts:15-19`) attaches `{ private: true }`
metadata and forces the field optional. It must be optional: reduction runs
*before* validation, so a required private field could never satisfy its own
model.

**Mark it on every model that carries it.** Read and input models are separate
and are reduced against their own schemas:

| Mark it on | Effect |
|---|---|
| `detail` / `summary` | never sent to a client |
| `input` | client cannot write it; the service still can |
| both | fully service-owned |

Marking only the input model still returns the field on reads. Marking only the
detail model still lets a client write it.

---

## Step 2 — declare every field you want to keep

Serializing reduces a record to the fields its model **describes**, not merely to
the non-private ones (`lib/core/src/shared/utils/schema-utils.ts:345`). An
undeclared field does not survive.

```typescript
// Model declares id and title only
const record = { id: 1, title: 'Dune', computedLabel: 'Dune (1965)' }

JSON.stringify(wrapModel(BookDetail, record))
// '{"id":1,"title":"Dune"}'  — computedLabel is gone
```

Two ways to keep it:

```typescript
// Preferred — declare it
z.object({ id: z.number(), title: z.string(), computedLabel: z.string().optional() })

// Or open the model
z.looseObject({ id: z.number(), title: z.string() })
```

`z.object` emits no `additionalProperties`, and a schema that describes its
properties without that keyword is treated as **closed**. `z.looseObject` sets
it, and the extras survive.

This is the most common surprise when a `normalize` hook enriches a record: the
enrichment vanishes at the boundary unless the model names it.

---

## Step 3 — nothing else, on the normal path

Once the fields are declared and marked, the pipeline handles it:

```
service.load()      → wrapDetail()      (base-model-service.ts:92)
controller.load()   → serializeDetail() (read-only-model-controller.ts:96)
route returns it    → framework JSON.stringify → record reduced
```

Same for writes, in reverse: `parseInput` (`model-controller.ts:29-37`) validates
the payload through the input model, which reduces first.

**Verify by stringifying, not by inspecting:**

```typescript
const user = await controller.load({ id: 1 })

user.passwordHash                     // still there — this is correct
JSON.parse(JSON.stringify(user))      // no passwordHash — assert this
```

A test asserting `expect(user.passwordHash).toBeUndefined()` fails on correctly
wrapped output. Assert the serialized form.

---

## Step 4 (optional) — change how a layer serializes

Both the service and the controller expose an overridable `wrapOptions`:

```typescript
export class BookService extends ModelService<typeof BookSchema> {
    protected get wrapOptions(): WrapModelOptions {
        return { validate: true }   // assert our records satisfy their model
    }
}
```

`WrapModelOptions` (`lib/core/src/schema/wrap-model.ts:18-43`):

| Option | Default | Controls |
|---|---|---|
| `validate` | **`false`** | whether a payload the model *rejects* throws |
| `includePrivateFields` | `false` | whether private fields stay in the output |

**`validate` does not control whether the model runs.** Defaults, coercions and
transforms are applied either way, and the record is reduced to its declared
fields either way. `validate: true` only turns a rejecting payload from
"serialize it as it stands" into a `ValidationError`.

Override points:

- `BaseModelService.wrapOptions` (`base-model-service.ts:70-72`) — everything the
  service returns
- `ReadOnlyModelController.wrapOptions` (`read-only-model-controller.ts:47-49`) —
  everything the controller returns

**Set `validate: true` when** you want a broken record to fail loudly in a test
or a staging environment rather than go out trimmed.

**Leave it `false` when** the records are service-built — which is the default
reasoning: a failure here is a broken response, not a helpful error.

**`includePrivateFields: true` on a client-facing controller sends private fields
to clients.** It is for trusted consumers — an internal cache, a queue — not for
HTTP.

### Async models

A model with an async `refine` cannot be run by `toJSON`, which cannot await:

| Setting | Result |
|---|---|
| `validate: false` (default) | payload is **stripped but not normalized** — defaults and coercions silently skipped |
| `validate: true` | `SystemError` thrown at `JSON.stringify` time |

Neither is good. Keep serialized models synchronous; do async checks in the
service.

---

## Step 5 — getting the full record for a trusted consumer

Anything calling `JSON.stringify` on a wrapped record gets the reduced form —
including a Redis `SET`, a queue push, and a `fetch` body. Two ways out:

```typescript
import { unwrapDeep, rewrapDeep, unwrapModel } from '@declaro/core'

// plain objects, nested values included — nothing will reduce
await redis.set(key, JSON.stringify(unwrapDeep(record)))

// keep each value's model, change the settings
const forQueue = rewrapDeep(record, { includePrivateFields: true })

// single value, one level
const plain = unwrapModel(record)
```

`unwrapDeep` and `rewrapDeep` (`wrap-model.ts:359`, `:373`) walk nested objects
and arrays, applying each value's **own** model.

Note that `rewrapDeep(..., { includePrivateFields: true })` restores private
fields but **not** undeclared ones — those were never on the model. Use
`unwrapDeep` when the payload must survive intact.

Inspection helpers:

```typescript
isWrapped(value)            // boolean
getWrappedModel(value)      // IAnyModel | undefined
getWrapOptions(value)       // the resolved options
record.getModelName()       // on a wrapped value
record.introspect()         // its JSON Schema, honouring includePrivateFields
```

---

## Step 6 — wrapping something the framework did not

```typescript
import { wrapModel } from '@declaro/core'

const wrapped = wrapModel(BookSchema.definition.detail, plainRecord)
```

Use this when a custom endpoint returns a record the service did not produce.
Re-wrapping is safe — `wrapModel` unwraps its input first, so settings are
replaced rather than nested. It is a no-op for primitives, `null` and `Date`
(`wrap-model.ts:259-262`).

---

## Writing normalize hooks that do not break it

The service wraps **last**, after `normalizeDetail`
(`read-only-model-service.ts:135-136`), so a hook that rebuilds the record is
fine — it runs before wrapping.

Two hazards remain:

```typescript
// ✗ drops the prototype — the record will serialize unreduced
return { ...wrappedRecord, extra: 'x' }

// ✓ re-wrap after reshaping
return wrapModel(this.schema.definition.detail, { ...unwrapModel(wrappedRecord), extra: 'x' })
```

```typescript
// ✗ `extra` is not on the model — it will not serialize at all
return { ...record, extra: computeExtra(record) }
// ✓ declare `extra` on the detail model first
```

The controller's second `serializeDetail` is the safety net for the first case
only, and only on the controller path.

---

## Testing

```typescript
it('does not serialize private fields', async () => {
    const record = await service.load({ id: 1 })
    expect(JSON.parse(JSON.stringify(record))).not.toHaveProperty('passwordHash')
})

it('still exposes them to the service layer', async () => {
    const record = await service.load({ id: 1 })
    expect(record.passwordHash).toBeDefined()
})

it('does not serialize undeclared fields', async () => {
    const wrapped = wrapModel(BookDetail, { id: 1, title: 'Dune', stray: 'x' })
    expect(JSON.parse(JSON.stringify(wrapped))).not.toHaveProperty('stray')
})

it('does not accept a private field from a client', async () => {
    const created = await controller.create({ email: 'a@b.c', passwordHash: 'injected' } as any)
    expect(created.passwordHash).not.toBe('injected')
})

it('omits private fields from the published schema', () => {
    expect(UserDetail.toJSONSchema().properties).not.toHaveProperty('passwordHash')
})
```

The first two together are the pair that matters — either alone passes on a
broken implementation.

---

## Checklist

- [ ] `privateField` applied on **both** the read model and the input model
- [ ] Every field that must reach a client is **declared on the model**
- [ ] `z.looseObject` used deliberately if extras must survive
- [ ] Tests assert the **serialized** form, not property presence
- [ ] A test asserting the service layer still sees the private field
- [ ] Serialized models are synchronous — no async `refine`
- [ ] `unwrapDeep` before persisting or queueing a payload that must stay whole
- [ ] Custom endpoints wrap records the service did not produce
- [ ] `includePrivateFields: true` never set on a client-facing controller

---

## Gotchas

- **Nothing is reduced until `JSON.stringify` runs.** `wrapModel` and
  `serialize*` only attach `toJSON`.
- **Reading the property directly still works** — by design, not a bug.
- **Undeclared fields are dropped.** `z.object` is closed; use `z.looseObject` or
  declare the field.
- **`validate` defaults to `false` and does not gate the model run** — it only
  decides whether a rejecting payload throws.
- **An async model skips normalization silently** by default, or throws
  `SystemError` at `JSON.stringify` time with `validate: true`.
- **Spreading a wrapped record drops the wrapper.** Re-wrap.
- **`rewrapDeep` restores private fields, not undeclared ones.**
- **A direct service call does not reduce input.** Only
  `ModelController.parseInput` does.
- **`hiddenField` still sends the value** (`lib/zod/src/fields.ts:30-34`).
- **A missing `detail`/`summary`/`input` model turns protection off silently**
  (`base-model-service.ts:80-82`, `model-controller.ts:30-32`).
- **`toJSONSchema()` builds a fresh copy every call** — memoisation is internal
  and `protected` (`lib/core/src/schema/model.ts:99-108`). Do not call it per
  record.

## See also

- [`how-it-works.md`](./how-it-works.md) — why reduction is deferred to `toJSON`,
  and what `validate` really controls
- [`docs/schema/wiring-up.md`](../schema/wiring-up.md) — declaring the models
  these marks live on
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — where wrapping sits in
  the pipeline
