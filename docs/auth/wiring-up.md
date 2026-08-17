---
status: implemented
applies-to:
    - 'lib/auth/src/**'
    - 'lib/core/src/auth/permission-validator.ts'
---

# Wiring up auth

Registering the module, minting sessions, granting claims that actually match,
and gating an operation.

All paths are relative to the repository root.

---

## What must be true first

| Requirement | Breaks how |
|---|---|
| A `redis` key is registered in the context | `authService` factory cannot resolve — `authModule` injects it (`application/module.ts:19`) |
| `useDeclaro()` ran before `authModule()` | no `requestMiddleware` array, no `header()` helper |
| `APP_SECRET` (or `authConfig.signingSecret`) is set | falls back to `'shhhhh'` outside production; throws in production |
| The caller sends `Authorization: Bearer <jwt>` | `authSession` resolves to `null`, every check 401s |
| The caller sends `x-team: <teamId>` for team-scoped claims | membership claims are omitted from `getActiveClaims()` |

---

## Step 1 — register the module

```typescript
import { useDeclaro } from '@declaro/core'
import { authModule } from '@declaro/auth'

await context.use(
    useDeclaro(),                       // must be first
    redisModule({ host, port }),        // provides 'redis'
    authModule({ authTimeout: 3600, signingSecret: process.env.APP_SECRET }),
)
```

`authModule` (`application/module.ts:10`) registers five keys:

| Key | Level | Value |
|---|---|---|
| `authConfig` | app | the config you passed |
| `authService` | app | `RedisAuthService(authConfig, redis)` |
| `authSession` | app → request | `null` at app level; resolved from the `Authorization` header per request |
| `authMembership` | app → request | `null` at app level; resolved from the `x-team` header per request |
| `authValidator` | request only | `new AuthValidator(authSession, authMembership?.team, authService)` |

The app-level `authSession` and `authMembership` are deliberate null cases
(`application/module.ts:22-24`) so that resolving them outside a request does not
throw. The request middleware re-registers the same keys with the real factories
(`:27-77`).

**`authValidator` is registered only inside request middleware.** Resolving it on
the app context returns `undefined`, and non-strict resolution means you find out
downstream. Background jobs and seeders need to construct one by hand.

---

## Step 2 — mint a session at login

```typescript
const authService = context.resolve('authService')

const session = await authService.createSession({
    jwt: signedToken,
    claims: ['global::book.read:*', 'global::book.write:*'],
    roles: ['editor'],
    memberships: [
        { id: 'm1', team: { id: 't1', name: 'Acme' }, claims: ['global::invoice.write:*'] },
    ],
})
```

`createSession` (`domain/services/auth-service.ts:13-29`) decodes the JWT
(**does not verify it** — `:18`), computes `expires` from `authConfig.authTimeout`
seconds, saves to Redis with a matching TTL
(`infrastructure/impl/redis-auth-service.ts:13-29`) and reads it back to confirm.

The session id must be recoverable from the token: the request path looks up
`authService.getSession(payload.sid)` (`application/module.ts:35`). So the JWT's
`sid` claim has to equal the session id. Pass `id` to `createSession` to control
it, or read the generated one back off the returned session before signing.

---

## Step 3 — grant claims that will actually match

This is where most auth bugs live. **The required permission is the glob pattern;
the user's claims are matched against it** (`permission-validator.ts:86-94`).
Wildcards in a claim do nothing.

Verified:

| Claim you grant | Required `global::book.create:*` |
|---|---|
| `global::book.create:*` | ✅ |
| `global::book.create:detail` | ✅ |
| `global::book.create` | ❌ no scope segment |
| `global::book.*` | ❌ |
| `global::*` | ❌ |
| `*` | ❌ |

Rules that follow:

- **Grant the literal string, including the `:*` scope.**
- **There is no admin wildcard.** A superuser needs every claim enumerated.
- **Build the string from the service, never by hand:**

```typescript
const claims = [
    bookService.getDescriptor('read', '*').toString(),   // 'global::book.read:*'
    bookService.getDescriptor('write', '*').toString(),
]
```

The controllers accept a coarse claim for most operations, so `read` and `write`
cover the common cases — see the table in
[`docs/data/wiring-up.md`](../data/wiring-up.md).

If you genuinely want role-style wildcards, the change is on the **required**
side: override the controller's `*Permissions` method to also accept a broad
literal such as `'admin'`, and grant that literal.

---

## Step 4 — gate an operation

### Via a controller (the default)

`ModelController` already checks. To tighten, override the `*Permissions` method:

```typescript
export class BookController extends ModelController<typeof BookSchema> {
    async removePermissions(lookup: BookLookup) {
        return PermissionValidator.create().allOf([
            this.service.getDescriptor('remove', '*').toString(),
            'global::book.archive:*',
        ])
    }
}
```

### Via the decorator (hand-written controllers)

```typescript
import { ValidatePermissions, AuthValidator } from '@declaro/auth'

class ReportController {
    constructor(protected readonly authValidator: AuthValidator) {}

    @ValidatePermissions((v) => v.someOf(['global::report.read:*', 'global::report.write:*']))
    async generate() { … }
}
```

The property **must** be named `authValidator`
(`shared/utils/auth-validator.ts:20-27`) — the decorator looks it up by that
exact name and throws a descriptive error otherwise. It is a TC39 stage-3
decorator (`ClassMethodDecoratorContext`), so modern decorators must be enabled.

### Directly

```typescript
// enforce — throws PermissionError / UnauthorizedError
authValidator.validatePermissions((v) => v.someOf(['global::book.read:*']))

// ask — returns boolean, for UI affordances
const canEdit = authValidator.validatePermissions((v) => v.someOf(['global::book.write:*']), false)

// a specific team, using only that membership's claims
authValidator.validateTeamPermissions('t1', (v) => v.allOf(['global::invoice.write:*']))
```

| Method | Claims used |
|---|---|
| `validatePermissions` | session global claims **+** active membership claims |
| `validateTeamPermissions(teamId, …)` | **only** that team's membership claims |

Picking the wrong one over- or under-grants. `validateTeamPermissions` exists to
check a team other than the active one.

---

## Composing rules

```typescript
PermissionValidator.create()
    .allOf(['a', 'b'])      // every one
    .someOf(['c', 'd'])     // at least one
    .noneOf(['banned'])     // none
```

Rules are ANDed — all must pass. For OR-of-ANDs, nest a validator
(`permission-validator.ts:9`, `:91-93`):

```typescript
const createAndUpdate = PermissionValidator.create().allOf([createPerm, updatePerm])

PermissionValidator.create().someOf([createAndUpdate, writePerm])
```

That is exactly how `upsert` is gated (`model-controller.ts:112-126`).

---

## Testing

```typescript
import { MockAuthService } from '@declaro/auth/test/mock/auth-service'
import { getMockAuthSession } from '@declaro/auth/test/mock/auth-session'
import { AuthValidator } from '@declaro/auth'

const authService = new MockAuthService({ authTimeout: 3600 })
const validator = new AuthValidator(
    getMockAuthSession({ claims: ['global::book.read:*'] }),
    null,
    authService,
)
```

Assert both directions. A test that only asserts the granted case passes on a
validator that grants everything:

```typescript
expect(() => controller.remove({ id: 1 })).toThrow(PermissionError)
```

See `shared/decorators/validate-permissions.test.ts` for the pattern.

---

## Checklist

- [ ] `useDeclaro()` before `authModule()`; a `redis` key registered
- [ ] `APP_SECRET` set in every non-production environment too
- [ ] JWT `sid` equals the session id
- [ ] Claims granted as **literal strings including `:*`** — no wildcards
- [ ] Claim strings built with `getDescriptor(action, '*').toString()`
- [ ] `authValidator` resolved per request, not from the app context
- [ ] Team-scoped checks use `validateTeamPermissions`, global ones don't
- [ ] Hand-written controllers expose a property named exactly `authValidator`
- [ ] A negative test asserting `PermissionError` is thrown
- [ ] `duplicate` gated by hand if it is exposed

---

## Gotchas

- **Wildcard claims grant nothing** (verified). `*`, `global::*` and
  `global::book.*` all fail.
- **A claim without `:*` does not match a `:*` requirement** (verified).
- **`APP_SECRET` silently falls back to `'shhhhh'`** outside production
  (`auth-service.ts:61-70`).
- **`createSession` does not verify the JWT.**
- **`validateSession` compares payloads with `JSON.stringify` equality**
  (`auth-validator.ts:44`) — key order matters.
- **A bad `x-team` header throws `ForbiddenError` during resolution**, not at the
  permission check.
- **`roles` is never consulted.**
- **`authValidator` does not exist on the app context.** Construct one by hand
  in seeders and background jobs.
- **Permission actions are kebab-case** (`permanently-delete-from-trash`) even
  though the event action for the same operation is camelCase.
- **Renaming an entity invalidates every claim granted against it.**

## See also

- [`how-it-works.md`](./how-it-works.md) — why the glob is on the required side,
  and what a controller call really checks
- [`docs/data/wiring-up.md`](../data/wiring-up.md) — the per-operation permission
  table
- [`docs/context/wiring-up.md`](../context/wiring-up.md) — the request scoping
  this depends on
