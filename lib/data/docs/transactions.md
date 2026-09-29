# Transactions

`@declaro/data` provides an ORM-agnostic transaction framework. Declaro handles the lifecycle: creating transactions, nesting them, making the current one available to your code, and committing or rolling back when the work finishes or fails. The actual database calls (`BEGIN`, `COMMIT`, savepoints, and so on) are left to a small **adapter** that your app implements once for its ORM.

- [Building an adapter](#building-an-adapter)
    - [ORMs that can't nest](#orms-that-cant-nest)
- [Registering it](#registering-it)
- [Using transactions](#using-transactions)
    - [`Transaction.run`](#transactionrun)
    - [Wrapping requests: `wrapWithTransaction`](#wrapping-requests-wrapwithtransaction)
    - [Manual lifecycle](#manual-lifecycle)
    - [Where the stack lives](#where-the-stack-lives)
    - [Nesting](#nesting)
- [Reaching the ORM from repositories](#reaching-the-orm-from-repositories)
- [Event subscribers](#event-subscribers)
- [Testing](#testing)
- [Reference](#reference)

## Building an adapter

The adapter is the only transaction code your app writes. It implements `ITransactionAdapter`:

```ts
interface ITransactionAdapter {
    begin(transaction: ITransaction): Promise<void>
    commit(transaction: ITransaction): Promise<void>
    rollback(transaction: ITransaction): Promise<void>
}
```

`ITransaction` knows nothing about your ORM. It only carries the lifecycle:

| Property             | Meaning                                                        |
| -------------------- | -------------------------------------------------------------- |
| `transaction.status` | `Pending`, `Active`, `Committed` or `RolledBack`.              |
| `transaction.parent` | The enclosing transaction, or `undefined` for a top-level one. |
| `transaction.depth`  | `0` for top level, `1` for the first nested level, and so on.  |

Whatever your ORM needs inside a transaction (a connection, a Knex `trx`, a MikroORM `EntityManager`) is the adapter's business. The adapter keeps it in its own per-transaction state, usually a `WeakMap<ITransaction, ...>`:

- `begin()` creates the state and stores it. For a nested transaction, it looks up the parent's state through `transaction.parent`, for example to create a savepoint on the same connection.
- `commit()` and `rollback()` read the state, finish the work, and delete it.
- The adapter exposes its own typed accessor, such as `client()` or `em()`, that returns the state for a transaction (the current one by default) and throws if it has none.

This split is deliberate. Domain code (services, event handlers) only ever sees the ORM-agnostic `ITransaction`, so it never depends on your ORM. ORM access goes through the adapter, which is infrastructure, just like the repositories that use it. Declaro's interface has no "get handle" method: each adapter decides what its accessor returns and what it is called.

An adapter is long-lived: you create one per connection pool or ORM instance and register it with the app. Declaro makes sure each method is only called in a valid state, finishes nested transactions before their parents (innermost first), and only updates `transaction.status` after your method resolves. If `commit()` throws, the transaction stays `Active` and is then rolled back (by `Transaction.run`, or by your own code), so your `rollback()` must still find its state.

Per-request ORM state belongs in `begin()` for a top-level transaction. For example, a MikroORM adapter calls `orm.em.fork()` there, so each transaction gets its own identity map.

### Example: a raw SQL adapter

This adapter uses [`pg`](https://node-postgres.com/). A top-level transaction checks out a connection and runs `BEGIN`. A nested one reuses its parent's connection and creates a savepoint. The connection goes back to the pool after the top-level transaction commits or rolls back.

```ts
import type { Pool, PoolClient } from 'pg'
import { useTransaction, type ITransaction, type ITransactionAdapter } from '@declaro/data'

interface PgTransactionState {
    connection: PoolClient
    savepoint?: string // only set for nested transactions
}

export class PgTransactionAdapter implements ITransactionAdapter {
    private readonly states = new WeakMap<ITransaction, PgTransactionState>()

    constructor(private readonly pool: Pool) {}

    /** The connection for a transaction, the current one by default. */
    client(transaction: ITransaction = useTransaction()): PoolClient {
        return this.state(transaction).connection
    }

    async begin(transaction: ITransaction): Promise<void> {
        if (transaction.parent) {
            const { connection } = this.state(transaction.parent)
            const savepoint = `sp_${transaction.depth}`
            await connection.query(`SAVEPOINT ${savepoint}`)
            this.states.set(transaction, { connection, savepoint })
            return
        }

        const connection = await this.pool.connect()
        try {
            await connection.query('BEGIN')
        } catch (error) {
            connection.release()
            throw error
        }
        this.states.set(transaction, { connection })
    }

    async commit(transaction: ITransaction): Promise<void> {
        const { connection, savepoint } = this.state(transaction)
        if (savepoint) {
            await connection.query(`RELEASE SAVEPOINT ${savepoint}`)
        } else {
            // If COMMIT throws, the state is kept: the transaction stays active and rollback() releases the connection.
            await connection.query('COMMIT')
            connection.release()
        }
        this.states.delete(transaction)
    }

    async rollback(transaction: ITransaction): Promise<void> {
        const { connection, savepoint } = this.state(transaction)
        if (savepoint) {
            await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
            this.states.delete(transaction)
            return
        }

        try {
            await connection.query('ROLLBACK')
        } finally {
            connection.release()
            this.states.delete(transaction)
        }
    }

    private state(transaction: ITransaction): PgTransactionState {
        const state = this.states.get(transaction)
        if (!state)
            throw new Error('This transaction has no open PostgreSQL connection. Was it begun with this adapter?')
        return state
    }
}
```

The state here is the connection plus the savepoint name. It can be anything your adapter needs.

### ORMs that can't nest

If your ORM has no savepoints, let nested transactions join the outer one. Give a nested transaction its parent's handle in `begin()`, and make nested `commit()` and `rollback()` only forget their state. With MikroORM, for example:

```ts
import type { EntityManager, MikroORM } from '@mikro-orm/core'
import { useTransaction, type ITransaction, type ITransactionAdapter } from '@declaro/data'

export class MikroOrmTransactionAdapter implements ITransactionAdapter {
    private readonly managers = new WeakMap<ITransaction, EntityManager>()

    constructor(private readonly orm: MikroORM) {}

    /** The EntityManager for a transaction, the current one by default. */
    em(transaction: ITransaction = useTransaction()): EntityManager {
        const em = this.managers.get(transaction)
        if (!em) throw new Error('This transaction has no open EntityManager. Was it begun with this adapter?')
        return em
    }

    async begin(transaction: ITransaction) {
        if (transaction.parent) {
            this.managers.set(transaction, this.em(transaction.parent)) // join the outer transaction
            return
        }

        const em = this.orm.em.fork()
        await em.begin()
        this.managers.set(transaction, em)
    }

    async commit(transaction: ITransaction) {
        if (!transaction.parent) await this.em(transaction).commit()
        this.managers.delete(transaction)
    }

    async rollback(transaction: ITransaction) {
        if (!transaction.parent) await this.em(transaction).rollback()
        this.managers.delete(transaction)
    }
}
```

The consequence: an error that escapes a nested callback still rolls back everything, because it propagates up and the outer transaction rolls back. But an error that the outer callback **catches** does not undo the nested work, since there is no savepoint to roll back to. The [nesting example](#nesting) below only behaves as described with an adapter that supports savepoints.

## Registering it

Register the adapter on the app context with `transactionModule`:

```ts
import { Pool } from 'pg'
import { Context, useDeclaro } from '@declaro/core'
import { transactionModule } from '@declaro/data'

const pool = new Pool()
const app = new Context()

await app.use(useDeclaro(), transactionModule({ adapter: new PgTransactionAdapter(pool) }))
```

`transactionModule` does two things:

- It registers the adapter on the app context under `transactionAdapter`. Request contexts extend the app context, so they see the same adapter, and `useTransactionAdapter()` returns it anywhere a context is active.
- It adds request middleware that registers a **new** `TransactionStack` on each request context under `transactionStack`. That stack tracks which transaction is current in the request (see [Where the stack lives](#where-the-stack-lives)). The stack is never shared: the app context doesn't get one.

## Using transactions

### `Transaction.run`

`Transaction.run` is the main API. Everything in the callback runs in one transaction, which the callback receives. It commits when the callback resolves, and rolls back and rethrows if the callback throws:

```ts
import { Transaction } from '@declaro/data'

const order = await Transaction.run(async (transaction) => {
    const order = await orderService.create(input)
    await inventoryService.reserve(order.items) // if this throws, the order is rolled back too
    return order
})
```

`Transaction.run(callback, options?)` takes the same options as the constructor (see [Manual lifecycle](#manual-lifecycle)). It needs an adapter: it uses `options.adapter`, or else the one registered on `options.context` or on the current context, so call it inside `withContext(...)`, or pass `{ context }` or `{ adapter }`. What it does:

- If a transaction is current and active, and uses the same adapter, it starts a transaction **nested** in that one. Otherwise it starts a top-level transaction. Pass `{ parent }` to choose the parent yourself (`null` forces top level).
- It runs the callback in a child context with its own `TransactionStack`, and the new transaction is the current one there, so `useTransaction()` returns it, including in anything the callback awaits. The run's adapter is registered on that child context too, so `useTransactionAdapter()` returns it, and transactions begun inside nest in the run's transaction, even when the adapter came from `options.adapter` rather than the context.
- If the callback commits or rolls back the transaction itself, `Transaction.run` leaves it alone. The same goes when something else finished it, such as an outer transaction committed or rolled back from inside the callback (see [Manual lifecycle](#manual-lifecycle)). The rest of the callback then runs with no current transaction, so `useTransaction()` throws there.
- If the callback returns while transactions it began are still open, the commit commits them too, innermost first, before the run's own transaction (see [Manual lifecycle](#manual-lifecycle)).
- If the callback throws, it rolls back and rethrows. If the commit fails, it rolls back and rethrows the commit error.
- If the rollback fails too, it throws an `AggregateError` (`Transaction failed, and so did its rollback`) holding both the original error and the rollback error.

`transaction.run(callback)` does the same with a transaction nested in `transaction`, using its adapter. It throws if `transaction` isn't `Active`.

- Concurrent `Transaction.run` calls each get their own transaction and their own stack, even inside the same request, so they can't disturb each other.

### Wrapping requests: `wrapWithTransaction`

`wrapWithTransaction(fn)` returns a function with the same parameters that runs each call through `Transaction.run`.

Declaro's request middleware runs while the request context is being built, not around the handler, so it can't commit or roll back a request by itself. Instead, wrap the handler where your server glue runs it inside the request context:

```ts
import { createRequestContext, withContext } from '@declaro/core'
import { wrapWithTransaction } from '@declaro/data'

async function handle(req: Request, handler: (req: Request) => Promise<Response>) {
    const requestContext = await createRequestContext(app, req)
    return withContext(requestContext, () => wrapWithTransaction(handler)(req))
}
```

Everything the handler does, including `useTransaction()` calls, shares one transaction, and a thrown error rolls it all back. To wrap only some routes, apply `wrapWithTransaction` to just those handlers.

The same approach works in a framework's middleware. As an illustration only, here is one way to do it in Express, where the handler doesn't return a promise, so the middleware waits for the response to finish:

```ts
import { withContext } from '@declaro/core'
import { Transaction } from '@declaro/data'

expressApp.use((req, res, next) => {
    const requestContext = res.locals.declaroContext // however your app attaches it
    withContext(requestContext, () =>
        Transaction.run(
            () =>
                new Promise<void>((resolve, reject) => {
                    res.on('finish', () => (res.statusCode >= 500 ? reject(new Error('Request failed')) : resolve()))
                    res.on('close', () => res.writableFinished || reject(new Error('Request aborted')))
                    next()
                }),
        ),
    ).catch(() => {}) // the response has already been sent; the rollback has already happened
})
```

Note that the commit happens after the response is sent, so a failed commit can't change the response. Adapt this to your framework rather than copying it as-is.

### Manual lifecycle

When a callback doesn't fit, drive a transaction yourself. `begin()` makes the transaction current, and `commit()` or `rollback()` makes whatever was current before it current again, like a stack. So between the two, `useTransaction()` (and every repository that uses it) sees your transaction:

```ts
import { Transaction } from '@declaro/data'

const transaction = await Transaction.begin() // now current

try {
    await orderService.create(input) // useTransaction() returns `transaction` in here
    await transaction.commit()
} catch (error) {
    await transaction.rollback() // still Active if commit() failed, so this works either way
    throw error
}
```

`Transaction.begin(options?)` is shorthand for `new Transaction(options)` followed by `begin()`, and returns the begun transaction. Constructing a transaction doesn't begin it or make it current:

```ts
await Transaction.run(async (tx1) => {
    // current: tx1
    const tx2 = await Transaction.begin() // current: tx2 (nested in tx1)
    const tx3 = new Transaction() // current: tx2 still
    await tx3.begin() // current: tx3 (nested in tx2)
    await tx3.commit() // current: tx2
    await tx2.rollback() // current: tx1
})
// tx1 auto-committed; no current transaction
```

Finishing a transaction also finishes everything begun after it that is still open:

```ts
await Transaction.run(async (tx1) => {
    const tx2 = await Transaction.begin() // current: tx2
    const tx3 = await Transaction.begin() // current: tx3
    await tx2.commit() // commits tx3, then tx2; current: tx1
    const tx4 = await Transaction.begin() // current: tx4
    await tx1.rollback() // rolls back tx4, then tx1; no current transaction
})
// tx1 already rolled back, so Transaction.run leaves it alone
```

The constructor and `Transaction.begin` take the same options:

| Option    | Default                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter` | The adapter registered on `context`, or on the current context. Resolved in the constructor, which throws if there is none.                        |
| `context` | The current context. `begin()` uses this context's transaction stack, and `run()` callbacks run in a child of it.                                  |
| `parent`  | Decided at `begin()` (see below). Pass a transaction to nest in it (it must be active when you begin), or `null` to force a top-level transaction. |

The parent is chosen when you call `begin()`, not when you construct the transaction: it is the transaction that is current at that moment, if it is active and uses the same adapter. Otherwise the transaction is top-level. So `parent` and `depth` only mean something after `begin()`; before it, `depth` is `0`. An explicit `parent` that isn't active makes `begin()` throw, for example `Cannot begin a transaction nested in a parent that is committed`. If the adapter's `begin()` fails, the transaction stays `Pending` with no parent, so a retried `begin()` decides the parent again from whatever is current then.

Each transaction has a `status` (`Pending`, `Active`, `Committed`, `RolledBack`) and is used once. Calling a method in the wrong state throws, for example `Cannot commit a transaction that is pending`: you can't commit a pending transaction, begin one twice, or reuse one that has finished. As with the adapter, the status only changes after the adapter call succeeds, so a transaction whose `commit()` failed is still `Active`, still current, and can be rolled back.

A few rules keep the stack consistent:

- **The parent takes precedence.** Committing or rolling back a transaction first commits or rolls back everything begun after it in the same flow and still open, innermost first, then the transaction itself. That includes transactions that aren't its children, such as one begun with `parent: null` or with a different adapter. Each one goes through its own `commit()` or `rollback()`, so your adapter is called once per transaction, innermost first. This matches the database: a top-level `COMMIT` saves any savepoints that haven't been released, and `RELEASE SAVEPOINT` and `ROLLBACK TO SAVEPOINT` act on every savepoint created after the named one. A commit freezes the state as it is, open inner work included. The trade-off: a nested transaction whose `commit()` you forgot is saved silently when its parent commits, rather than raising an error.
- **The cascade reaches into runs you're inside.** Each run has its own stack, so a transaction can have an open child on another stack, for example inside a `transaction.run()` or nested `Transaction.run()`. If you call `tx1.commit()` or `tx1.rollback()` from inside that run's callback (at any depth), the cascade finishes that run's open transactions first, innermost first, then its transaction, and so on outward to `tx1`. The runs whose transactions were finished this way leave them alone when their callbacks return.
- **It can't reach into a concurrent flow.** If the transaction, or anything the cascade would finish, has an open child in a flow you are _not_ inside, such as a sibling `Transaction.run()` still running under `Promise.all`, `commit()` and `rollback()` throw before touching anything, for example `Cannot commit a transaction with 1 open child transaction(s) in another async flow`. Wait for that work to finish first.
- **A failed step stops the cascade.** If one of the cascaded commits or rollbacks fails, the cascade stops there and throws that error. The transaction you called it on stays `Active` (so you can still roll it back), and the transactions already finished stay finished.
- **A `Transaction.run()` callback that leaves transactions open commits them.** When the callback returns, the run's commit cascades as above. If one of those commits fails, the run rolls back what's left and rethrows (see [`Transaction.run`](#transactionrun)).
- **One operation at a time per transaction.** Calling `begin()`, `commit()` or `rollback()` on a transaction while another of those calls on it is still in progress throws, for example `Cannot commit a transaction while another operation on it is in progress`.
- **Don't begin transactions manually in parallel within one flow.** Two `begin()`s racing in a `Promise.all` push onto the same stack, and each one's "current" becomes the other's. This is unsupported. For parallel work, use `Transaction.run()`, which gives each call its own stack, so `Promise.all([Transaction.run(a), Transaction.run(b)])` keeps the two apart. (Whether your database can run two transactions or savepoints on one connection at the same time is a separate question for your adapter.)

### Where the stack lives

The current transaction is tracked by a `TransactionStack`, registered on a context under `transactionStack`. There is never one on the shared app context:

- **Each request context gets its own**, from `transactionModule`'s request middleware.
- **Every run gets its own.** `Transaction.run()` and `transaction.run()` run their callback in a child context with a fresh stack, whose first entry is the run's transaction. That is what keeps concurrent runs isolated.
- **Scripts, jobs and tests outside both** either wrap their work in `Transaction.run()`, or register a stack on their own context:

```ts
import { Context, withContext } from '@declaro/core'
import { Transaction, TransactionStack, transactionModule } from '@declaro/data'

const context = new Context()
await context.use(transactionModule({ adapter }))
context.registerValue('transactionStack', new TransactionStack())

await withContext(context, async () => {
    const transaction = await Transaction.begin()
    // ...
    await transaction.commit()
})
```

Its public API is read-only: `current` (the top of the stack, or `undefined`), `size`, and `has(transaction)`. Only `Transaction` pushes and removes entries.

`begin()` without a stack throws: `No transaction stack was found in the current context. Use Transaction.run(), or begin transactions inside a request context set up by transactionModule().` `Transaction.run()` never needs one, since it brings its own.

### Nesting

Nesting happens automatically whenever a transaction begins while another one is current, active and uses the same adapter: `Transaction.run` inside `Transaction.run`, `wrapWithTransaction` functions called from inside a transaction, `transaction.run(...)`, and `Transaction.begin()` or `new Transaction().begin()` while one is current. With a savepoint adapter, a failed nested transaction only undoes its own work:

```ts
await Transaction.run(async () => {
    await createOrder()

    try {
        await Transaction.run(async () => {
            await chargeCard() // throws
        })
    } catch {
        // Only the nested transaction (the savepoint) was rolled back. The order is still there.
        await markOrderUnpaid()
    }
}) // commits the order and the "unpaid" flag
```

Inside a nested callback, `useTransaction()` returns the nested transaction. When the callback finishes, the outer transaction is current again. If the error isn't caught, it rolls back the nested transaction, then escapes the outer callback and rolls that back too.

## Reaching the ORM from repositories

Repositories get the database handle from the adapter, for the current transaction, not from a global, so they automatically take part in whatever transaction is running:

```ts
import { useTransactionAdapter } from '@declaro/data'
import type { PgTransactionAdapter } from './pg-transaction-adapter'

class PgOrderRepository {
    async create(order: OrderInput) {
        const connection = useTransactionAdapter<PgTransactionAdapter>().client()
        return connection.query('INSERT INTO orders (customer_id, total) VALUES ($1, $2) RETURNING *', [
            order.customerId,
            order.total,
        ])
    }
}
```

`useTransactionAdapter()` and `useTransaction()` are synchronous. The type parameter of `useTransactionAdapter<PgTransactionAdapter>()` is only a cast: nothing checks that the registered adapter really is a `PgTransactionAdapter`, so registering a different one fails at runtime, the first time `client()` is called. If you'd rather it fail earlier, inject the adapter instead, which the compiler checks and which fails when you wire the app:

```ts
class PgOrderRepository {
    constructor(private readonly transactions: PgTransactionAdapter) {}

    async create(order: OrderInput) {
        const connection = this.transactions.client()
        // ...
    }
}

const adapter = new PgTransactionAdapter(pool)
await app.use(useDeclaro(), transactionModule({ adapter }))
app.registerFactory('orderRepository', () => new PgOrderRepository(adapter))
```

Either way, `client()` defaults to `useTransaction()`, which returns the current transaction from the context's stack. It throws when no transaction is active: outside a context, where there's no stack, or when the stack is empty. That catches code that should be transactional but isn't. A fire-and-forget task that outlives the `run` that started it sees an empty stack, so it throws too.

## Event subscribers

`ModelService` emits its before and after events on the `EventManager` passed to it as `emitter`, with an awaited `emitAsync`. Event types are `<namespace>::<resource>.<action>`. When the operation runs inside `Transaction.run`, its listeners run inside the same transaction: `useTransaction()` works in a listener, and a `before*` listener that throws rolls the operation back:

```ts
emitter.on('shop::order.beforeCreate', async (event) => {
    const connection = useTransactionAdapter<PgTransactionAdapter>().client()
    await connection.query('INSERT INTO audit_log (event_type) VALUES ($1)', [event.type])
})
```

Two things to watch for:

- **Emitting through a stored context hides the transaction.** `context.emit()` runs listeners inside `context`. If `context` is an app or request context you kept a reference to, its stack is not the one carrying the current transaction (a run has its own), so listeners won't see it: `useTransaction()` throws, or returns a different transaction. Emit through `context.events.emitAsync(event)`, which keeps the current context, or through `useContext({ strict: true }).emit(event)`.
- **`after*` events fire before the transaction commits.** A listener that does something outside the database, such as publishing to Redis or sending an email, may announce data that later rolls back. For now, do that kind of work after your `Transaction.run` resolves. A post-commit hook is planned.

## Testing

`MockTransactionAdapter` is an in-memory adapter for tests. It gives each transaction a handle `{ id, depth }` (ids count up from 1 per adapter), and records every call in one `operations` log (`{ operation, transactionId, depth }`) across all the transactions it runs:

```ts
import { Context, withContext } from '@declaro/core'
import { MockTransactionAdapter, Transaction, transactionModule } from '@declaro/data'

const adapter = new MockTransactionAdapter()
const app = new Context()
await app.use(transactionModule({ adapter }))

await withContext(app, () =>
    Transaction.run(async () => {
        await Transaction.run(async () => {
            throw new Error('card declined')
        }).catch(() => {})
    }),
)

expect(adapter.operations.map((op) => `${op.operation}@${op.depth}`)).toEqual([
    'begin@0',
    'begin@1',
    'rollback@1',
    'commit@0',
])
```

`adapter.handle(transaction)` returns a transaction's handle, the current transaction's by default. It throws for a transaction that hasn't begun on this adapter, or that has committed or rolled back. Set `failures` (`{ begin?, commit?, rollback? }`) to make a call throw `Mock <operation> failure`, for testing error paths: pass it to the constructor, `new MockTransactionAdapter({ failures: { commit: true } })`, or change it at any time, for example `adapter.failures.commit = true`.

## Reference

| Export                   | Kind       | Purpose                                                                                                              |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `ITransactionAdapter`    | interface  | The adapter contract your app implements: `begin`, `commit`, `rollback`.                                             |
| `ITransaction`           | interface  | What an adapter receives: `status`, `parent`, `depth`. ORM-agnostic.                                                 |
| `Transaction`            | class      | One transaction. `new Transaction(options?)`; statics `begin`, `run`; instance `begin`, `commit`, `rollback`, `run`. |
| `TransactionStatus`      | enum       | `Pending`, `Active`, `Committed`, `RolledBack`.                                                                      |
| `TransactionStack`       | class      | The active transactions of one request or run: `current` (the top), `size`, `has()`. Register one for scripts.       |
| `transactionModule`      | middleware | Registers the adapter on the app context, and gives each request context its own `TransactionStack`.                 |
| `wrapWithTransaction`    | function   | Wraps a function so every call runs through `Transaction.run`.                                                       |
| `useTransaction`         | function   | Synchronously gets the current transaction. Throws when none is active.                                              |
| `useTransactionAdapter`  | function   | Synchronously gets the adapter registered in the current context. Its type parameter is a cast.                      |
| `MockTransactionAdapter` | class      | In-memory adapter for tests, with `handle()`, an `operations` log and configurable `failures`.                       |
