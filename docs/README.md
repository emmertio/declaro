# Declaro documentation

Each subsystem has a pair of documents:

- **`how-it-works.md`** — the why. What the seam is for, what the design buys,
  and what fails quietly.
- **`wiring-up.md`** — the how. Step-by-step, with a checklist and the gotchas.

| Section | Covers |
|---|---|
| [`schema/`](./schema/how-it-works.md) | `Model`, `ModelSchema`, `ZodModel`, mixins, type inference |
| [`data/`](./data/how-it-works.md) | `IRepository`, `ModelService`, controllers, `normalize*` hooks |
| [`events/`](./events/how-it-works.md) | `EventManager`, `ActionDescriptor`, the domain-event envelope |
| [`context/`](./context/how-it-works.md) | the DI container, scopes, request lifecycle, `App` |
| [`auth/`](./auth/how-it-works.md) | sessions, claims, `PermissionValidator` |
| [`serialization/`](./serialization/how-it-works.md) | private fields, `wrapModel`, `toJSON` |

Reading order for a new entity: **schema → data → events**. Auth and
serialization are cross-cutting; context is optional and opt-in.

Also here:

- [`coding-standards.md`](./coding-standards.md)
- [`release-workflows.md`](./release-workflows.md)
- [`prompts/`](./prompts/)

Per-package usage docs live in each package's `README.md` (`lib/*/README.md`).
Those describe the API; these describe the mechanism.
