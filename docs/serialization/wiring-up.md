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
metadata and forces the field optional. It must be optional: stripping runs
*before* validation, so a required private field could never satisfy its own
model.

**Mark it on every model that carries it.** Read and input models are separate
and are stripped against their own schemas:

| Mark it on | Effect |
|---|---|
| `detail` / `summary` | never sent to a client |
| `input` | client cannot write it; the service still can |
| both | fully service-owned |

Marking only the input model still returns the field on reads. Marking only the
detail model still lets a client write it.

---

## Step 2 — nothing else, on the normal path

Once the field is marked, the pipeline handles it:

```
service.load()      → wrapDetail()      (base-model-service.ts:87-89)
controller.load()   → serializeDetail() (read-only-model-controller.ts:90-96)
route returns it    → framework JSON.stringify → field removed
```

Same for writes, in reverse: `parseInput` (`model-controller.ts:29-37`) validates
the payload through the input model, which strips first.

**Verify by stringifying, not by inspecting**:

```typescript
const user = await controller.load({ id: 1 })

user.passwordHash                     // still there — this is correct
JSON.parse(JSON.stringify(user))      // no passwordHash — assert this
```

A test that asserts `expect(user.passwordHash).toBeUndefined()` fails on
correctly-wrapped output. Assert the serialized form.

---

## Step 3 (optional) — change how a layer serializes

Both the service and the controller expose an overridable `wrapOptions`:

```typescript
export class BookService extends ModelService<typeof BookSchema> {
    protected get wrapOptions(): WrapModelOptions {
        return { validate: false }      // skip validation + coercion on a hot path
    }
}
```

`WrapModelOptions` (`lib/core/src/schema/wrap-model.ts:18-32`):

| Option | Default | Effect |
|---|---|---|
| `validate` | `true` | validate **and coerce** at serialization time |
| `includePrivateFields` | `false` | keep private fields in the output |

Override points:

- `BaseModelService.wrapOptions` (`base-model-service.ts:65-67`) — everything the
  service returns
- `ReadOnlyModelController.wrapOptions` (`read-only-model-controller.ts:41-43`) —
  everything the controller returns

**Turn `validate` off when:**

- the model validates asynchronously — otherwise `toJSON` throws `SystemError`
- the path is hot and the records are already canonical

Turning it off also skips coercion, so values serialize exactly as stored.

**`includePrivateFields: true` on a controller sends private fields to clients.**
It exists for trusted consumers — an internal cache, a queue — not for HTTP.

---

## Step 4 — getting the full record for a trusted consumer

Anything that calls `JSON.stringify` on a wrapped record gets the stripped form.
That includes a Redis `SET`, a queue push, and a `fetch` body. Two ways out:

```typescript
import { unwrapDeep, rewrapDeep, unwrapModel } from '@declaro/core'

// plain objects, nested values included — nothing will strip
await redis.set(key, JSON.stringify(unwrapDeep(record)))

// keep each value's model, change the settings
const forQueue = rewrapDeep(record, { includePrivateFields: true })

// single value, one level
const plain = unwrapModel(record)
```

`unwrapDeep` and `rewrapDeep` (`wrap-model.ts:303`, `:317`) walk nested objects
and arrays, applying each value's **own** model. `unwrapModel` is one level and
one value.

Inspection helpers, when you need to know what you are holding
(`wrap-model.ts:167-187`, `:45-65`):

```typescript
isWrapped(value)            // boolean
getWrappedModel(value)      // IAnyModel | undefined
getWrapOptions(value)       // the resolved options
record.getModelName()       // on a wrapped value
record.introspect()         // its JSON Schema, honouring includePrivateFields
```

---

## Step 5 — wrapping something the framework did not

```typescript
import { wrapModel } from '@declaro/core'

const wrapped = wrapModel(BookSchema.definition.detail, plainRecord, { validate: false })
```

Use this when a custom endpoint returns a record the service did not produce.
Re-wrapping is safe — `wrapModel` unwraps its input first (`wrap-model.ts:217`),
so settings are replaced rather than nested.

It is a no-op for primitives, `null` and `Date` (`wrap-model.ts:204-206`).

---

## Writing normalize hooks that do not break it

The service wraps **last**, after `normalizeDetail`
(`read-only-model-service.ts:135-136`). A hook that rebuilds the record is
therefore fine — it runs before wrapping.

The hazard is anything that rebuilds a record **after** it was wrapped:

```typescript
// ✗ drops the prototype — private fields will serialize
return { ...wrappedRecord, extra: 'x' }

// ✓ re-wrap after reshaping
return wrapModel(this.schema.definition.detail, { ...unwrapModel(wrappedRecord), extra: 'x' })
```

The controller's second `serializeDetail` is the safety net for exactly this
case (`read-only-model-controller.ts:83-85`) — but it only covers the controller
path.

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

it('does not accept a private field from a client', async () => {
    const created = await controller.create({ email: 'a@b.c', passwordHash: 'injected' } as any)
    expect(created.passwordHash).not.toBe('injected')
})

it('omits private fields from the published schema', () => {
    expect(UserDetail.toJSONSchema().properties).not.toHaveProperty('passwordHash')
})
```

The first two together are the pair that matters — one alone passes on a broken
implementation.

---

## Checklist

- [ ] `privateField` applied on **both** the read model and the input model
- [ ] Tests assert the **serialized** form, not property presence
- [ ] A test asserting the service layer still sees the field
- [ ] `{ validate: false }` set if any model validates asynchronously
- [ ] `unwrapDeep` before persisting or queueing a payload that must stay whole
- [ ] Custom endpoints wrap records the service did not produce
- [ ] `includePrivateFields: true` never set on a client-facing controller
- [ ] Nested models carry their own marks — stripping walks each value's own
      schema

---

## Gotchas

- **Nothing is stripped until `JSON.stringify` runs.** `wrapModel` and
  `serialize*` only attach `toJSON`.
- **Reading the property directly still works** — by design, not a bug.
- **A direct service call does not strip input.** Only `ModelController.parseInput`
  does.
- **An async schema throws `SystemError` at `JSON.stringify` time.** The fix is in
  the message: `{ validate: false }`.
- **Spreading a wrapped record drops the wrapper.** Re-wrap.
- **`hiddenField` still sends the value** (`lib/zod/src/fields.ts:30-34`).
- **A missing `detail`/`summary`/`input` model turns protection off silently**
  (`base-model-service.ts:75-77`, `model-controller.ts:30-32`).
- **`toJSONSchema()` builds a fresh copy every call** — memoisation is internal
  and `protected` (`lib/core/src/schema/model.ts:86-96`). Do not call it per
  record.
- **Redis, queues and non-JSON transports get the stripped form** unless you
  `unwrapDeep` first.

## See also

- [`how-it-works.md`](./how-it-works.md) — why stripping is deferred to `toJSON`
- [`docs/schema/wiring-up.md`](../schema/wiring-up.md) — declaring the models
  these marks live on
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — where wrapping sits in
  the pipeline
