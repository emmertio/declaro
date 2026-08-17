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

A record must reach a client carrying only the fields its model describes — no
field marked `private: true`, and no field the model never declared — and a
client must never be able to write to a private field. Declaro does both without
producing a second copy: the service layer keeps seeing every field, and the
reduction happens at the moment the record becomes JSON.

For the step-by-step, read [`wiring-up.md`](./wiring-up.md). This document is the
why.

## The one thing to internalize

**`wrapModel` does not serialize, and neither do the controller's `serialize*`
methods.** They attach a `toJSON` implementation. Nothing is removed until
something calls `JSON.stringify`.

The class doc comment on `ReadOnlyModelController` says so explicitly
(`read-only-model-controller.ts:22`), and it is the source of most confusion
about this layer:

```typescript
const user = await controller.load({ id: 1 })

user.passwordHash        // still readable — the object is intact
JSON.stringify(user)     // '{"id":1,"name":"Ada"}' — reduced here
```

Stripping eagerly would mean the service layer could not see the fields it owns,
and every internal caller would have to re-fetch. Deferring to `toJSON` means one
object serves both audiences: full inside the process, reduced on the way out.

The cost is that **anything which does not go through `JSON.stringify` gets the
full record** — a handler that reshapes it by hand, a binary codec, a template
reading properties directly.

## What serializing always does, and what is optional

This is the part most likely to be misremembered, because the option is named
`validate` but does not control whether the model runs.

`toJSON` (`wrap-model.ts:150-163`) is two steps:

```typescript
const raw = unwrapModel(this)
const source = options.validate ? validatePayload(model, raw) : washPayload(model, raw)

// Stripping happens whether or not the payload satisfied its model.
return model.stripExcludedFields(source, { includePrivateFields: options.includePrivateFields })
```

**Always, regardless of any setting:**

- the payload is run through the model, so its **defaults, coercions and
  transforms** decide the form a client sees;
- the result is **reduced to the fields the model describes** — private fields
  go, and so do fields the model never declared.

**What `validate` controls** is only whether a payload the model *rejects* fails
to serialize (`wrap-model.ts:35`):

| `validate` | A rejecting payload |
|---|---|
| `false` (**default**) | serialized as it stands, then stripped |
| `true` | throws `ValidationError` |

The two paths differ only in strictness. `washPayload`
(`wrap-model.ts:109-119`) runs `validateSync(raw, { strict: false,
includePrivateFields: true })` inside a `try`/`catch` and falls back to the raw
payload; `validatePayload` (`wrap-model.ts:129-133`) runs the same call strictly
and lets it throw.

**The default is `false`** (`wrap-model.ts:265`). The reasoning is in
`BaseModelService.wrapOptions` (`base-model-service.ts:58-70`): a record a
service built is not a payload to be rejected, and a failure there surfaces as a
broken response rather than as a helpful error. Trimming beats failing. Set
`{ validate: true }` to assert that a service's records really do satisfy their
model.

### Async models are the exception

`toJSON` cannot await. That is why `Model.validateSync` exists
(`model.ts:233`) and why it throws `SystemError` when the underlying schema
validates asynchronously (`model.ts:230`).

For a model with an async `refine`, the two paths diverge sharply:

- **`validate: false`** — `washPayload` catches the `SystemError` and returns the
  raw payload. The record is **stripped but never normalized**: no defaults, no
  coercions. It serializes, quietly missing the model's transforms.
- **`validate: true`** — the `SystemError` propagates, at `JSON.stringify` time,
  far from the model that caused it.

Neither is a good outcome. Async validation and serialization do not mix.

## Reduction is to the schema, not just to the private mark

`Model.stripExcludedFields` (`model.ts:127-136`) delegates to `stripToSchema`
(`shared/utils/schema-utils.ts:345`), whose contract is broader than the name
"private fields" suggests:

> Recursively reduces a payload to the fields its schema describes, removing both
> the fields marked `private: true` and the fields the schema does not describe
> at all.

Two functions, two behaviours:

| Function | Removes | Where |
|---|---|---|
| `stripToSchema` | private **and** undeclared fields | `schema-utils.ts:345` |
| `stripPrivateValues` | private fields only | `schema-utils.ts:374` |

`stripPrivateValues` is now a thin wrapper — `stripToSchema(value, schema,
{ stripUnknownFields: false, root })`. Serialization uses the reducing form.

### Object schemas are closed by default

The rule that decides whether an undeclared field survives
(`schema-utils.ts:195` and the `stripToSchema` doc comment):

> An object schema that describes its properties and does not set
> `additionalProperties` is treated as closed, so a model whose generator omits
> the keyword still strips. Set `additionalProperties` to `true` or to a schema,
> as `z.looseObject` does, for a payload that carries fields the model does not
> name.

So `z.object({...})` is closed and drops extras; `z.looseObject({...})` keeps
them. A field added to a record by a `normalize` hook but not declared on the
model **will not serialize** — which is a change in behaviour that surprises
people who expected only private fields to be removed.

Other properties of the walk worth knowing:

- **Unions fail closed.** A field marked private in any
  `anyOf`/`oneOf`/`allOf` branch is private everywhere
  (`schema-utils.ts:92-127`).
- **`$ref` is followed**, including bare `#` self-references, which is how a
  recursive shape such as a category tree is handled (`schema-utils.ts:30-59`).
- **Untouched values are returned by reference**, so a payload that loses nothing
  costs a walk and no allocation.

Both walkers are depth-capped at 100 (`schema-utils.ts:7`, `wrap-model.ts:7`)
against self-referencing payloads.

## Why a prototype, and not a wrapper object

`wrapModel` (`wrap-model.ts:259-274`):

```typescript
return Object.assign(Object.create(prototype), unwrapModel(value))
```

The record's own properties are copied onto a fresh object whose **prototype**
carries `toJSON`. Returning `{ value, toJSON }` would change the shape callers
see; this does not:

- `Object.keys(record)` returns the data keys — the methods are on the prototype.
- Spread, destructuring and equality behave as for a plain object.
- The identifying symbol `WRAP_META` lives on the prototype too
  (`wrap-model.ts:13`), so it never appears in `Object.keys` or `JSON.stringify`.

Prototypes are cached per `(model, options)` pair in a `WeakMap`
(`wrap-model.ts:82`, `:181`), so wrapping ten thousand rows allocates ten
thousand plain objects and **one** prototype.

Wrapping is therefore cheap enough to apply at every layer that returns a
payload, which is what happens: the service wraps
(`base-model-service.ts:92`) and the controller wraps again
(`read-only-model-controller.ts:96`). Re-wrapping replaces the previous settings
rather than nesting, because `wrapModel` unwraps its input first.

The controller's second wrap is not redundant — a custom service or a `normalize`
hook may have rebuilt the record and dropped the prototype. Re-applying is cheap
insurance.

## The write half

Reading is only half the guarantee. The other half is that a client cannot *set*
a private field, and it works because **`Model.validate` reduces before it
validates** (`model.ts:174-179`, `:212-218`):

```
input from client  →  stripExcludedFields  →  ~standard.validate  →  service
```

The value is gone before the schema ever sees it. That is also why
`privateField` forces the field optional (`lib/zod/src/fields.ts:16`) — a
required private field would be stripped and then fail its own required check.

On the HTTP path this runs in `ModelController.parseInput`
(`model-controller.ts:29-37`). **A direct service call does not parse input**, so
a private field passed to `service.create(...)` is written. That asymmetry is
intentional: the service owns those fields, so the service may set them.

## Two levels of caching

Building a JSON Schema is the expensive part, and it would otherwise happen per
record per response. `Model` memoises two copies — with and without private
fields — keyed by that boolean (`model.ts:79`, `:99-108`).

The cached schemas are explicitly **not** handed to callers
(`model.ts:73-78`): `toJSONSchema` builds a fresh one every call, because
consumers are free to mutate what they receive and `stripPrivateFieldsFromSchema`
mutates in place (`schema-utils.ts:456`). `getInternalJSONSchema` is the memoised
path, and it is `protected`.

So `toJSONSchema()` is a fresh mutable copy and costs a build; internal stripping
uses the shared cached one and costs nothing.

## Deep helpers, for transports that are not HTTP

```typescript
unwrapDeep(payload)                                    // plain objects, everywhere
rewrapDeep(payload, { includePrivateFields: true })    // re-wrap, keeping each model
```

Both walk nested objects and arrays, applying **each value's own** model
(`wrap-model.ts:359`, `:373`).

`unwrapDeep` is what to reach for before persisting or queueing a payload that
must keep every field — anything calling `JSON.stringify` on a wrapped value gets
the reduced form, and a cache or job queue usually wants the whole record.
`rewrapDeep` is the alternative: keep the models, change the settings.

## Where everything lives

| Piece | Path |
|---|---|
| Wrapping, `toJSON`, deep helpers | `lib/core/src/schema/wrap-model.ts` |
| Payload and schema reduction | `lib/core/src/shared/utils/schema-utils.ts` |
| Reduce-then-validate | `lib/core/src/schema/model.ts` |
| Service-side wrapping | `lib/data/src/domain/services/base-model-service.ts:58-122` |
| Controller-side wrapping | `lib/data/src/application/read-only-model-controller.ts:47-150` |
| Input parsing | `lib/data/src/application/model-controller.ts:29-46` |
| The mark | `lib/zod/src/fields.ts` |
| Schema-level stripping | `lib/zod/src/zod-model.ts:29-31` |

## Gotchas

- **Nothing is reduced until `JSON.stringify` runs.** Reshaping a record by hand
  bypasses the whole mechanism.
- **`validate` does not control whether the model runs.** It runs either way;
  `validate` only decides whether a rejecting payload throws. Default `false`.
- **Undeclared fields are removed.** A field a `normalize` hook added but the
  model does not declare will not serialize. Declare it, or use `z.looseObject`.
- **An async model silently skips normalization** under the default
  `validate: false`, and throws `SystemError` at `JSON.stringify` time under
  `validate: true`.
- **A `normalize` hook that spreads the record drops the wrapper.** The service
  wraps last for exactly this reason
  (`read-only-model-service.ts:135-136`) — preserve that ordering in overrides.
- **Direct service calls do not strip input.** Only the controller parses.
- **Read and input models are reduced separately.** Mark the field on both.
- **`hiddenField` is not `privateField`** — hidden fields are still sent
  (`lib/zod/src/fields.ts:30-34`).
- **A missing model turns protection off silently.** `wrapWith` returns the value
  unchanged when the schema has no `detail`/`summary` model
  (`base-model-service.ts:80-82`), and `parseInput` returns the input unchanged
  when there is no `input` model (`model-controller.ts:30-32`).
- **Non-objects are never wrapped** — primitives, `null` and `Date` pass through
  (`wrap-model.ts:259-262`).

## See also

- [`wiring-up.md`](./wiring-up.md) — marking fields and choosing wrap options
- [`docs/schema/how-it-works.md`](../schema/how-it-works.md) — where the private
  mark is declared
- [`docs/data/how-it-works.md`](../data/how-it-works.md) — where wrapping sits in
  the pipeline
