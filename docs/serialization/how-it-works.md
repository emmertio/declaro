---
status: implemented
applies-to:
    - 'lib/core/src/schema/wrap-model.ts'
    - 'lib/core/src/shared/utils/schema-utils.ts'
    - 'lib/data/src/domain/services/base-model-service.ts'
    - 'lib/data/src/application/**'
    - 'lib/zod/src/fields.ts'
---

# How serialization and private fields work

A field marked `private: true` must never reach a client, and a client must never
be able to write to one. Declaro implements both halves without ever producing a
second copy of the record — the service layer keeps seeing every field, and the
stripping happens at the moment the record is turned into JSON.

For the step-by-step, read [`wiring-up.md`](./wiring-up.md). This document is the
why.

## The one thing to internalize

**`wrapModel` does not serialize, and neither do the controller's `serialize*`
methods.** They attach a `toJSON` implementation. Nothing is removed until
something calls `JSON.stringify`.

The class doc comment on `ReadOnlyModelController` says so explicitly
(`read-only-model-controller.ts:19-26`), and it is the source of most confusion
about this layer:

```typescript
const user = await controller.load({ id: 1 })

user.passwordHash        // still readable — the object is intact
JSON.stringify(user)     // '{"id":1,"name":"Ada"}' — stripped here
```

That is the design. Stripping eagerly would mean the service layer could not see
the fields it owns, and every internal caller would have to re-fetch. Deferring
to `toJSON` means one object serves both audiences: full inside the process,
stripped on the way out.

The cost is that **anything which does not go through `JSON.stringify` gets the
full record**. A handler that reshapes the record by hand, a transport that uses
a binary codec, a template that reads properties directly — none of them are
protected.

## Why a prototype, and not a wrapper object

`wrapModel` (`wrap-model.ts:203-218`) does this:

```typescript
return Object.assign(Object.create(prototype), unwrapModel(value))
```

The record's own properties are **copied onto a fresh object whose prototype
carries `toJSON`**. The alternative — returning `{ value, toJSON }` — would
change the shape callers see. This does not:

- `Object.keys(record)` returns the data keys, because the methods are on the
  prototype, not the instance.
- Spread, destructuring and equality behave exactly as for a plain object.
- The identifying symbol `WRAP_META` lives on the prototype too
  (`wrap-model.ts:13`, `:91-93`), so it never shows up in `Object.keys` or
  `JSON.stringify`.

Prototypes are cached per `(model, options)` pair in a `WeakMap`
(`wrap-model.ts:70`, `:131-147`), so wrapping ten thousand rows allocates ten
thousand plain objects and **one** prototype.

Wrapping is therefore cheap enough to apply at every layer that returns a
payload, which is exactly what happens: the service wraps
(`base-model-service.ts:87-89`) and the controller wraps again
(`read-only-model-controller.ts:90-96`). Re-wrapping replaces the previous
settings rather than nesting, because `wrapModel` unwraps its input first
(`wrap-model.ts:217`).

The controller's second wrap is not redundant. Its comment explains why
(`read-only-model-controller.ts:83-85`): a custom service or a `normalize` hook
may have rebuilt the record and dropped the prototype. Re-applying is the cheap
insurance.

## What `toJSON` actually does

`wrap-model.ts:96-109`:

```typescript
toJSON(this: object): unknown {
    const raw = unwrapModel(this)                                    // 1

    if (!options.validate) {
        return options.includePrivateFields ? raw : model.stripExcludedFields(raw)
    }

    const result = model.validateSync(raw, { includePrivateFields: true })   // 2
    const validated = 'value' in result ? result.value : raw
    return options.includePrivateFields ? validated : model.stripExcludedFields(validated)  // 3
}
```

1. **Unwrap first.** The comment says why (`wrap-model.ts:97-98`): the result must
   be a plain object, so the wrapper's own `toJSON` can never be carried back
   into `JSON.stringify` and recurse.
2. **Validate, with `includePrivateFields: true`.** Validation also *coerces*, so
   a validated payload serializes in its canonical form — a `Date` becomes an ISO
   string via the model's rules rather than by accident. Private fields are kept
   at this step because the model still needs to validate them; they are removed
   in step 3.
3. **Strip**, unless the consumer opted in.

Note that validation is **on by default** (`wrap-model.ts:209`). Every record on
every response is validated at serialization time. That is a real cost, and
`{ validate: false }` is the documented escape hatch for hot paths — it also
skips coercion, so what goes out is exactly what was in the record.

### `validateSync` is why `Model` has a synchronous path

`toJSON` cannot await. That is the entire reason `Model.validateSync` exists
(`lib/core/src/schema/model.ts:197-223`), and why it throws `SystemError` when the
underlying schema validates asynchronously:

```
Model "X" requires asynchronous validation and cannot be validated synchronously.
Serialize it with { validate: false } to skip validation.
```

A zod schema with an async `refine` will therefore fail at
**`JSON.stringify` time** — inside the framework serializing a response, far from
the model that caused it. The fix is in the error message.

## Two independent strippers

The private mark is honoured in two different places, against two different
things:

| Function | Strips | Used by |
|---|---|---|
| `stripPrivateValues` | a **payload**, against a schema | `Model.stripExcludedFields` (`model.ts:108-110`) |
| `stripPrivateFieldsFromSchema` | the **schema itself** | `ZodModel.toJSONSchema` (`zod-model.ts:29-31`) |

The second exists so a published JSON Schema does not reveal that the fields
exist at all. Both live in `shared/utils/schema-utils.ts`.

`stripPrivateValues` (`schema-utils.ts:199`) walks the payload against the
JSON Schema, and three of its properties are worth knowing:

- **Unions fail closed.** A field marked private in *any* `anyOf`/`oneOf`/`allOf`
  branch is private everywhere (`schema-utils.ts:92-127`, `:154`). A branch that
  forgets the mark cannot leak it.
- **`$ref` is followed**, including bare `#` self-references, which is how a
  recursive shape like a category tree is handled (`schema-utils.ts:30-59`).
- **Untouched values are returned by reference** (`:238`, `:259`). A payload with
  no private fields costs a walk and no allocation.

Both walkers are depth-capped at 100 (`schema-utils.ts:7`, `wrap-model.ts:7`)
against self-referencing payloads.

## The write half

Reading is only half the guarantee. The other half is that a client cannot *set*
a private field, and it works because **`Model.validate` strips before it
validates** (`model.ts:150-155`, `:188-195`).

```
input from client  →  stripExcludedFields  →  ~standard.validate  →  service
```

The value is gone before the schema ever sees it. That is also why `privateField`
forces the field optional (`lib/zod/src/fields.ts:16`) — a required private field
would be stripped and then fail its own required check.

On the HTTP path this runs in `ModelController.parseInput`
(`model-controller.ts:29-37`). **A direct service call does not parse input**, so
a private field passed to `service.create(...)` is written. That asymmetry is
intentional: the service owns those fields, so the service is allowed to set
them.

## Two levels of caching

Building a JSON Schema is the expensive part of all of this, and it would
otherwise happen per record per response. `Model` memoises two copies — with and
without private fields — keyed by that boolean (`model.ts:66`, `:86-96`).

The cached schemas are explicitly **not** handed to callers
(`model.ts:60-65`): `toJSONSchema` builds a fresh one every call, because
consumers are free to mutate what they receive, and `stripPrivateFieldsFromSchema`
mutates in place (`schema-utils.ts:271-274`). `getInternalJSONSchema` is the
memoised path, and it is `protected`.

So: `toJSONSchema()` is a fresh, mutable copy and costs a build. Internal
stripping uses the shared cached one and costs nothing.

## Deep helpers, for transports that are not HTTP

```typescript
unwrapDeep(payload)                                    // plain objects, everywhere
rewrapDeep(payload, { includePrivateFields: true })    // re-wrap, keeping each model
```

Both walk nested objects and arrays, re-wrapping or unwrapping each value with
**its own** model (`wrap-model.ts:255-319`).

`unwrapDeep` is the one to reach for before persisting or queueing a payload that
must keep its private fields — anything that calls `JSON.stringify` on a wrapped
value receives the stripped form, and a cache or a job queue usually wants the
full record. `rewrapDeep` is the alternative: keep the models, change the
settings.

## Where everything lives

| Piece | Path |
|---|---|
| Wrapping + deep helpers | `lib/core/src/schema/wrap-model.ts` |
| Payload and schema stripping | `lib/core/src/shared/utils/schema-utils.ts` |
| Validate-then-strip | `lib/core/src/schema/model.ts` |
| Service-side wrapping | `lib/data/src/domain/services/base-model-service.ts:57-116` |
| Controller-side wrapping | `lib/data/src/application/read-only-model-controller.ts:41-144` |
| Input parsing | `lib/data/src/application/model-controller.ts:29-46` |
| The mark | `lib/zod/src/fields.ts` |
| Schema-level stripping | `lib/zod/src/zod-model.ts:29-31` |

## Gotchas

- **Nothing is stripped until `JSON.stringify` runs.** Reshaping a record by hand
  bypasses the whole mechanism.
- **A `normalize` hook that spreads the record drops the wrapper.** The service
  wraps last for exactly this reason (`read-only-model-service.ts:135-136`) —
  preserve that ordering in overrides.
- **Direct service calls do not strip input.** Only the controller parses.
- **An async schema breaks `toJSON`** with a `SystemError` at serialization time.
  Use `{ validate: false }`.
- **Validation runs on every serialized record** by default.
- **Read and input models are stripped separately.** Mark the field on both.
- **`hiddenField` is not `privateField`** — hidden fields are still sent
  (`lib/zod/src/fields.ts:30-34`).
- **A missing model turns protection off silently.** `wrapWith` returns the value
  unchanged when the schema has no `detail`/`summary` model
  (`base-model-service.ts:75-77`), and `parseInput` returns the input unchanged
  when there is no `input` model (`model-controller.ts:30-32`).
- **Non-objects are never wrapped.** `wrapModel` returns primitives, `null` and
  `Date` untouched (`wrap-model.ts:204-206`).

## See also

- [`wiring-up.md`](./wiring-up.md) — marking fields and choosing wrap options
- [`docs/schema/how-it-works.md`](../schema/how-it-works.md) — where the private
  mark is declared
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — where wrapping sits in
  the pipeline
