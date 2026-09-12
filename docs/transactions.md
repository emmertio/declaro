# Transactions

`@declaro/core` ships an ORM-agnostic transaction framework. The core knows how
to start, nest, commit and roll back transactions, and how to resolve the active
one from the current async context. Everything ORM-specific lives behind a small
adapter interface that the consuming application implements.

## Concepts

| Concept              | Responsibility                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| `TransactionAdapter` | ORM specifics: begin, commit, rollback and (optionally) savepoints.               |
| `TransactionManager` | Runs transactions for one adapter and tracks the active one per async branch.     |
| `TransactionScope`   | A single running transaction: its handle, its nesting, and its lifecycle hooks.   |
| `transaction`        | The ambient API used by application code, resolving the manager and active scope. |

## Implementing an adapter

An adapter maps the framework's lifecycle onto an ORM. `THandle` is whatever the
ORM uses to represent a running transaction — an entity manager fork, a
connection, a client. The framework never inspects it; it only stores it on the
active scope so application code can resolve it.

```ts
import type { TransactionAdapter } from '@declaro/core'
import type { EntityManager } from '@mikro-orm/core'

export function createMikroOrmAdapter(orm: MikroORM): TransactionAdapter<EntityManager> {
    return {
        name: 'mikro-orm',
        async begin({ isolationLevel } = {}) {
            const em = orm.em.fork()
            await em.begin({ isolationLevel })
            return em
        },
        commit: (em) => em.commit(),
        rollback: (em) => em.rollback(),
        createSavepoint: (em, name) => em.getConnection().execute(`SAVEPOINT ${name}`),
        releaseSavepoint: (em, name) => em.getConnection().execute(`RELEASE SAVEPOINT ${name}`),
        rollbackToSavepoint: (em, name) => em.getConnection().execute(`ROLLBACK TO SAVEPOINT ${name}`),
        // Optional: bind the handle to the ORM's own ambient context.
        run: (em, fn) => RequestContext.create(em, fn),
    }
}
```

The savepoint methods are optional. Implement all three to get nested
transactions that roll back independently; leave them out and nested
transactions join the transaction that encloses them instead.

Register the adapter once during startup:

```ts
import { configureTransactions } from '@declaro/core'

const manager = configureTransactions(createMikroOrmAdapter(orm))
```

`configureTransactions` registers the manager as the default used by the ambient
`transaction` API. Applications with several data sources can create additional
managers with `createTransactionManager(adapter)` and pass them explicitly:
`transaction(fn, { manager })`.

## Functional API

Pass a callback. It commits when the callback resolves and rolls back when it
throws.

```ts
import { transaction, useTransactionHandle } from '@declaro/core'

const order = await transaction(async () => {
    const order = await orders.create(input)
    await inventory.reserve(order) // throwing here discards the order too
    return order
})
```

Repositories resolve the active transaction from the async context instead of
receiving it as an argument:

```ts
class OrderRepository {
    async create(input: OrderInput) {
        const em = useTransactionHandle<EntityManager>()
        return em.persistAndFlush(new Order(input))
    }
}
```

## Manual API

When the transaction boundary cannot be expressed as a single callback, start
and settle it by hand. Both calls resolve the transaction for the current async
context, so nothing has to be threaded through.

```ts
await transaction.start()
try {
    await orders.create(input)
    await transaction.commit()
} catch (error) {
    await transaction.rollback(error)
    throw error
}
```

`transaction.current()` returns the active scope (or `null`),
`transaction.isActive()` reports whether one is running, and
`transaction.setRollbackOnly()` forces any later commit to roll back instead.

## Nested transactions

A transaction started while another is active nests inside it. The
`propagation` option decides how:

| Propagation    | Behavior                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `NESTED`       | Default. Uses a savepoint, so the inner transaction can roll back on its own.                  |
| `JOIN`         | Shares the enclosing transaction; an inner rollback marks the whole transaction rollback-only. |
| `REQUIRES_NEW` | Starts an independent transaction that commits even if the enclosing one rolls back.           |

```ts
await transaction(async () => {
    await orders.create(input)

    // Rolled back on failure without losing the order above.
    await transaction(() => analytics.record(input)).catch(() => undefined)

    // Written even if the outer transaction later rolls back.
    await transaction(() => auditLog.write(input), {
        propagation: TransactionPropagation.REQUIRES_NEW,
    })
})
```

`NESTED` falls back to `JOIN` when the adapter does not implement savepoints.
Committing a transaction that was marked rollback-only rolls it back and throws
a `TransactionRollbackError`.

## Wrapping requests

`withTransaction` wraps any entry point — a fetch handler, a route handler, a
queue consumer — so each call runs in its own transaction and a failure rolls
back everything that call wrote.

```ts
import { isSuccessfulResponse, withTransaction } from '@declaro/core'

const fetch = withTransaction(async (request: Request) => router.handle(request), {
    // Also roll back when the handler answers with an error status.
    shouldCommit: isSuccessfulResponse,
})

Bun.serve({ fetch })
```

`shouldCommit` inspects the handler's result: returning `false` rolls the
transaction back while the result is still returned to the caller, which is what
an HTTP handler answering `500` needs. Use `withTransactionScope` instead when
the handler wants the scope as its first argument.

## Deferring side effects until commit

Side effects that must not happen for work that gets rolled back — publishing
events, enqueuing reports, sending notifications — belong in a commit hook.
Hooks registered in a nested transaction move to the enclosing one when it
commits and are discarded when it rolls back, so they only ever fire for work
that really landed.

```ts
await transaction(async () => {
    const order = await orders.create(input)

    transaction.onCommit(() => reportingQueue.publish({ type: 'order.created', id: order.id }))
    transaction.onRollback((error) => metrics.increment('order.failed', { error }))
    transaction.onComplete((status) => logger.info('order transaction finished', { status }))
})
```

A hook that throws never fails the transaction it belongs to: the error goes to
the manager's `onError` reporter (which logs by default), so reporting stays
non-blocking.

## Testing

`useTransactionalTests` wraps every test in a transaction and rolls it back when
the test finishes, so an integration suite can share one database without
leaking state between tests. Nested transactions the test forgot to settle are
rolled back too.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { useTransactionalTests } from '@declaro/core'

describe('OrderService', () => {
    useTransactionalTests({ beforeEach, afterEach })

    it('creates an order', async () => {
        const order = await orders.create(input)
        expect(await orders.find(order.id)).toBeDefined()
    }) // rolled back here
})
```

For unit tests that need a transaction without a database, `MockTransactionAdapter`
implements the full contract in memory and records every call it receives.

```ts
import { MockTransactionAdapter, TransactionManager } from '@declaro/core'

const adapter = new MockTransactionAdapter()
const manager = new TransactionManager(adapter)

await manager.run((tx) => adapter.write(tx.handle, 'order'))

expect(adapter.store).toEqual(['order'])
expect(adapter.log).toEqual(['begin:1', 'write:1:order', 'commit:1'])
```

## Async context and the browser

The active transaction is tracked with `AsyncLocalStorage`, so it propagates
across `await` boundaries and stays isolated between concurrent requests. Browser
builds substitute the synchronous shim used by the rest of `@declaro/core`, where
propagation is limited to the synchronous call stack.

The manual API also works outside any `transaction(fn)` block — as in test hooks,
where each hook runs in its own async context — by falling back to a
process-level session. `resetTransactionState()` clears that session and the
default manager.
