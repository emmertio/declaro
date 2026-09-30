# Transactions

`@declaro/data` provides an ORM-agnostic transaction framework. Declaro handles the lifecycle: creating transactions, nesting them, making the current one available to your code, and committing or rolling back when the work finishes or fails. The actual database calls (`BEGIN`, `COMMIT`, savepoints, and so on) are left to a small **adapter** that your app implements once for its ORM.

- [Building an adapter](#building-an-adapter)
    - [ORMs that can't nest](#orms-that-cant-nest)
- [Registering it](#registering-it)
- [Using transactions](#using-transactions)
    - [`Transaction.run`](#transactionrun)
    - [Wrapping requests, background tasks and other async work](#wrapping-requests-background-tasks-and-other-async-work)
        - [Framework middleware](#framework-middleware)
    - [Manual lifecycle](#manual-lifecycle)
    - [Where the stack lives](#where-the-stack-lives)
    - [Nesting](#nesting)
        - [What a nested commit means](#what-a-nested-commit-means)
- [Running code after the commit](#running-code-after-the-commit)
- [Reaching the ORM from repositories](#reaching-the-orm-from-repositories)
- [Event subscribers](#event-subscribers)
- [Lifecycle events](#lifecycle-events)
    - [Where they are emitted](#where-they-are-emitted)
    - [How listeners affect the transaction](#how-listeners-affect-the-transaction)
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

| Property             | Meaning                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `transaction.id`     | A stable, unique string id, assigned when the transaction is created. |
| `transaction.status` | `Pending`, `Active`, `Committed` or `RolledBack`.                     |
| `transaction.parent` | The enclosing transaction, or `undefined` for a top-level one.        |
| `transaction.depth`  | `0` for top level, `1` for the first nested level, and so on.         |

It also has the lifecycle methods `begin()`, `commit()`, `rollback()`, `run(callback)` and [`afterCommit(callback)`](#running-code-after-the-commit). Your adapter shouldn't call them: Declaro calls the adapter, not the other way round.

Whatever your ORM needs inside a transaction (a connection, a Knex `trx`, a MikroORM `EntityManager`) is the adapter's business. The adapter keeps it in its own per-transaction state, usually a `WeakMap<ITransaction, ...>`:

- `begin()` creates the state and stores it. For a nested transaction, it looks up the parent's state through `transaction.parent`, for example to create a savepoint on the same connection.
- `commit()` and `rollback()` read the state, finish the work, and delete it.
- The adapter exposes its own typed accessor, such as `client()` or `em()`, that returns the state for a transaction (the current one by default) and throws if it has none.

This split is deliberate. Domain code (services, event handlers) only ever sees the ORM-agnostic `ITransaction`, so it never depends on your ORM. ORM access goes through the adapter, which is infrastructure, just like the repositories that use it. Declaro's interface has no "get handle" method: each adapter decides what its accessor returns and what it is called.

An adapter is long-lived: you create one per connection pool or ORM instance and register it with the app. Declaro makes sure each method is only called in a valid state, finishes nested transactions before their parents (innermost first), and only updates `transaction.status` after your method resolves. If `commit()` throws, the transaction stays `Active` and is then rolled back (by `Transaction.run`, or by your own code), so your `rollback()` must still find its state.

Per-request ORM state belongs in `begin()` for a top-level transaction. For example, a MikroORM adapter forks an `EntityManager` there, so each transaction gets its own identity map (see [the MikroORM example](#orms-that-cant-nest)). Adapter methods don't receive the context as a parameter: they get it implicitly, since the adapter's `begin()`, `commit()` and `rollback()` are called in the caller's ambient context, so `useContext()` inside them reaches the current request's state. When a transaction is given an explicit `{ context }` (through `new Transaction()`, `Transaction.begin()` or `Transaction.run()`), they are called in that context instead.

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
import { useContext, type Context } from '@declaro/core'
import { useTransaction, type ITransaction, type ITransactionAdapter } from '@declaro/data'

// Whatever per-request state your app registers on its request contexts, if any.
type RequestScope = { em?: EntityManager }

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

        // Top level: fork per-request state. begin() runs in the caller's context, so useContext() finds the request.
        const requestEm = useContext<Context<RequestScope>>()?.resolve('em')
        const em = (requestEm ?? this.orm.em).fork()
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
- If the callback throws, it rolls back and rethrows. If the commit fails, it rolls back and rethrows the commit error. The exception is a failing [`afterCommit` callback](#running-code-after-the-commit): the data is already saved by then, so the run rethrows that error without rolling back. The same goes for a throwing [`afterCommit` event listener](#lifecycle-events).
- If an [`afterBegin` listener](#lifecycle-events) throws, the run rolls back and rethrows without running the callback.
- If the rollback fails too, it throws an `AggregateError` (`Transaction failed, and so did its rollback`) holding both the original error and the rollback error.

`transaction.run(callback)` does the same with a transaction nested in `transaction`, using its adapter. It throws if `transaction` isn't `Active`.

- Concurrent `Transaction.run` calls each get their own transaction and their own stack, even inside the same request. Concurrent runs that would nest under the same parent are the exception: see [the rules below](#manual-lifecycle) on parallel work.

### Wrapping requests, background tasks and other async work

`wrapWithTransaction(fn, options?)` returns a function with the same parameters that runs each call through `Transaction.run`, passing `options` along (`adapter`, `parent`, `context`, the same as `Transaction.run`). It wraps any async unit of work: a request handler, a whole middleware chain, a background task, a queue consumer, a cron job. Everything the function does, including `useTransaction()` calls, shares one transaction; it commits when the function resolves, and a thrown error rolls it all back.

Inside a request, call the wrapped function in the request's `withContext` block so the transaction picks up the request context:

```ts
import { createRequestContext, withContext } from '@declaro/core'
import { wrapWithTransaction } from '@declaro/data'

const createOrder = wrapWithTransaction(async (input: OrderInput) => orderService.create(input))

const requestContext = await createRequestContext(app, req)
await withContext(requestContext, () => createOrder(input))
```

To wrap only some routes, apply `wrapWithTransaction` to just those handlers.

Work that runs outside any Declaro context, such as a background job or a queue consumer, has no ambient context to find the adapter in. Pass `{ adapter }`, or `{ context }` to use the adapter registered on that context (the app context, for example):

```ts
import { wrapWithTransaction } from '@declaro/data'

const handleMessage = wrapWithTransaction(
    async (message: OrderMessage) => {
        await orderService.fulfil(message.orderId) // useTransaction() and useTransactionAdapter() work in here
    },
    { adapter }, // or { context: app }
)

queue.consume('orders', handleMessage)
```

Each call gets its own top-level transaction and its own stack, so messages handled concurrently stay apart.

#### Framework middleware

Declaro's request middleware runs while the request context is being built, not around the handler, so it can't commit or roll back a request by itself. Put the transaction in your framework's middleware instead. The two recipes below are starting points to adapt to your app, not drop-in code. They are exercised by simulated middleware chains in Declaro's tests, not against the real frameworks. How the Declaro request context gets attached to the framework's request is app-specific.

**Hono** (and other frameworks whose `next()` returns a promise of the rest of the chain): wrap `next()` in `Transaction.run`. The middleware awaits the handler, so a resolved chain commits and a thrown error rolls back, with nothing else to do:

```ts
import { withContext } from '@declaro/core'
import { Transaction } from '@declaro/data'

app.use(async (c, next) => {
    const requestContext = c.get('declaroContext') // however your app attaches it
    await withContext(requestContext, () => Transaction.run(() => next()))
})
```

**Express**: `next()` returns nothing, and the handler finishes whenever it sends the response, so the middleware can't await the handler and `Transaction.run` would commit too early. Use the manual form instead: `Transaction.begin()` before `next()`, then commit when the response finishes, or roll back on a 5xx, on an error passed to `next()` (Express turns it into a 5xx), or when the connection closes before the response finished:

```ts
import { withContext } from '@declaro/core'
import { Transaction } from '@declaro/data'

expressApp.use((req, res, next) => {
    const requestContext = res.locals.declaroContext // however your app attaches it
    withContext(requestContext, async () => {
        const transaction = await Transaction.begin()
        let isSettled = false
        const settle = (shouldCommit: boolean) => {
            if (isSettled) return
            isSettled = true
            const done = shouldCommit
                ? transaction.commit().catch(() => transaction.rollback())
                : transaction.rollback()
            done.catch((error) => console.error('Request transaction failed', error))
        }

        res.on('finish', () => settle(res.statusCode < 500))
        res.on('close', () => {
            if (!res.writableFinished) settle(false)
        })
        next() // called inside withContext, so the handler sees the request context and the transaction
    }).catch(next)
})
```

In both recipes the transaction lives on the request context's own stack (from `transactionModule`), so the handler and everything it calls see it through `useTransaction()`. With Express, the commit happens after the response is sent, so a failed commit can't change the response; if that matters, commit in the handler before responding.

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

| Option    | Default                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter` | The adapter registered on `context`, or on the current context. Resolved in the constructor, which throws if there is none.                                    |
| `context` | The current context. `begin()` uses this context's transaction stack, and `run()` callbacks run in a child of it.                                              |
| `parent`  | Decided at `begin()` (see below). Pass a transaction to nest in it (it must be active when you begin), or `null` to force a top-level transaction.             |
| `emitter` | The `events` of the context the transaction begins in (see [Lifecycle events](#lifecycle-events)). Applies only to this transaction, not to ones nested in it. |

The parent is chosen when you call `begin()`, not when you construct the transaction: it is the transaction that is current at that moment, if it is active and uses the same adapter. Otherwise the transaction is top-level. So `parent` and `depth` only mean something after `begin()`; before it, `depth` is `0`. An explicit `parent` that isn't active makes `begin()` throw, for example `Cannot begin a transaction nested in a parent that is committed`. If the adapter's `begin()` fails, the transaction stays `Pending` with no parent, so a retried `begin()` decides the parent again from whatever is current then.

Each transaction has a `status` (`Pending`, `Active`, `Committed`, `RolledBack`) and is used once. Calling a method in the wrong state throws, for example `Cannot commit a transaction that is pending`: you can't commit a pending transaction, begin one twice, or reuse one that has finished. As with the adapter, the status only changes after the adapter call succeeds, so a transaction whose `commit()` failed is still `Active`, still current, and can be rolled back.

A few rules keep the stack consistent:

- **The parent takes precedence.** Committing or rolling back a transaction first commits or rolls back everything begun after it in the same flow and still open, innermost first, then the transaction itself. That includes transactions that aren't its children, such as one begun with `parent: null` or with a different adapter. Each one goes through its own `commit()` or `rollback()`, so your adapter is called once per transaction, innermost first. This matches the database: a top-level `COMMIT` saves any savepoints that haven't been released, and `RELEASE SAVEPOINT` and `ROLLBACK TO SAVEPOINT` act on every savepoint created after the named one. A commit freezes the state as it is, open inner work included. The trade-off: a nested transaction whose `commit()` you forgot is saved silently when its parent commits, rather than raising an error.
- **The cascade reaches into runs you're inside.** Each run has its own stack, so a transaction can have an open child on another stack, for example inside a `transaction.run()` or nested `Transaction.run()`. If you call `tx1.commit()` or `tx1.rollback()` from inside that run's callback (at any depth), the cascade finishes that run's open transactions first, innermost first, then its transaction, and so on outward to `tx1`. The runs whose transactions were finished this way leave them alone when their callbacks return.
- **It can't reach into a concurrent flow.** If the transaction, or anything the cascade would finish, has an open child in a flow you are _not_ inside, such as a sibling `Transaction.run()` still running under `Promise.all`, `commit()` and `rollback()` throw before touching anything, for example `Cannot commit a transaction with 1 open child transaction(s) in another async flow`. Wait for that work to finish first.
- **A failed step stops the cascade.** If one of the cascaded commits or rollbacks fails, the cascade stops there and throws that error. The transaction you called it on stays `Active` (so you can still roll it back), and the transactions already finished stay finished.
- **A `Transaction.run()` callback that leaves transactions open commits them.** When the callback returns, the run's commit cascades as above. If one of those commits fails, the run rolls back what's left and rethrows (see [`Transaction.run`](#transactionrun)).
- **One operation at a time per transaction.** Calling `begin()`, `commit()` or `rollback()` on a transaction while another of those calls on it is still in progress throws, for example `Cannot commit a transaction while another operation on it is in progress`.
- **Don't begin transactions manually in parallel within one flow.** Two `begin()`s racing in a `Promise.all` push onto the same stack, and each one's "current" becomes the other's. This is unsupported.
- **Nested runs can't run in parallel under the same parent.** A nested transaction shares its parent's connection, and the savepoints on that connection form a stack, so two children of one parent can't be open at the same time. Beginning a second child while another child of the same parent is still open in a concurrent flow (for example `Promise.all([Transaction.run(a), Transaction.run(b)])` inside a transaction) throws. For parallel work, use top-level runs, `Transaction.run(callback, { parent: null })` (or `wrapWithTransaction(fn, { parent: null })`): each gets its own transaction, its own stack and, with a typical adapter, its own connection. Each one commits or rolls back on its own, independently of the transaction you started them from.

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

#### What a nested commit means

"Committed" doesn't mean "saved" for a nested transaction. Committing a nested transaction saves its work **into its parent**. Only the top-level commit makes anything permanent. So if the parent rolls back later, for example because code after the nested commit throws, the nested work is undone too, even though its transaction says `Committed`:

```ts
await Transaction.run(async () => {
    await Transaction.run(async () => {
        await createOrder()
    }) // nested commit: the order is saved into the outer transaction, not yet to the database

    await sendInvoice() // throws
}) // the outer transaction rolls back, and the order with it
```

This is the all-or-nothing guarantee every database and ORM gives: a top-level transaction either saves everything done inside it, nested transactions included, or nothing. When you want something else, say so explicitly:

- **To undo only some later work, wrap that work in its own nested transaction.** If it fails, it rolls back to its savepoint, and the earlier nested work survives as long as the parent commits:

    ```ts
    await Transaction.run(async () => {
        await Transaction.run(() => createOrder())

        try {
            await Transaction.run(() => sendInvoice()) // throws: only this nested transaction rolls back
        } catch {
            await markInvoicePending()
        }
    }) // commits the order and the "pending" flag
    ```

- **To keep work whatever the parent does, run it as its own top-level transaction** with `parent: null`. It commits for real when its callback resolves, and a later rollback of the transaction you started it from doesn't touch it:

    ```ts
    await Transaction.run(async () => {
        await Transaction.run(() => recordLoginAttempt(), { parent: null }) // permanent once this resolves
        await signIn() // if this throws, the login attempt is still recorded
    })
    ```

    A top-level transaction usually means its own connection, so it doesn't see the outer transaction's uncommitted writes, and it can block on rows the outer transaction has locked.

## Running code after the commit

Some side effects must only happen once the data is permanently saved: publishing to Redis, sending an email, calling a webhook. Register them with `transaction.afterCommit(callback)`:

```ts
import { Transaction } from '@declaro/data'

await Transaction.run(async (transaction) => {
    const order = await orderService.create(input)
    transaction.afterCommit(() => redis.publish('orders', JSON.stringify({ id: order.id })))
})
// the order is saved, then published
```

`afterCommit` is part of `ITransaction`, so it works on whatever `useTransaction()` returns. It can only be called while the transaction is `Active`; otherwise it throws. The callback is an `AfterCommitCallback`, `() => unknown | Promise<unknown>`: it takes no arguments and can return a promise. Callbacks follow the data:

- **Nested transactions pass them up.** A nested commit isn't final (see [What a nested commit means](#what-a-nested-commit-means)), so it moves its callbacks to its parent, after the ones the parent already has. They only run after the **top-level** commit. That includes nested transactions committed by a [cascade](#manual-lifecycle).
- **A rollback drops them.** When a transaction rolls back, directly or through a cascade, its callbacks never run. So do the callbacks its committed children passed up to it.
- **The top-level commit runs them in the order they were registered**, one after another, each awaited, once the adapter's commit has succeeded and the status is `Committed`. They run outside any transaction: in a child of the transaction's context (or of the ambient one) with a new, empty transaction stack. `useContext()` still resolves the app and request dependencies, but `useTransaction()` throws, even when an unrelated transaction is still open in the flow that called `commit()`. A transaction begun in a callback, such as with `Transaction.run`, is a new top-level transaction.
- **The first failure stops them.** If a callback throws, the remaining callbacks don't run and `commit()` rejects with that error. The data is already saved, so the transaction stays `Committed` and there is nothing to roll back. Inside `Transaction.run`, the run rethrows the error without trying to roll back. If you need every callback to run whatever happens, catch errors inside each one.

This matches the default behavior of Django's `transaction.on_commit`.

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
- **`after*` events fire before the transaction commits.** A listener that does something outside the database, such as publishing to Redis or sending an email, may announce data that later rolls back. Defer that work with [`afterCommit`](#running-code-after-the-commit), so it only happens once the data is saved, and never if it rolls back:

    ```ts
    emitter.on('shop::order.afterCreate', async (event) => {
        useTransaction().afterCommit(() => redis.publish('orders', JSON.stringify(event.data)))
    })
    ```

    `useTransaction()` throws when no transaction is active, so a listener that can also run outside a transaction should check for one first or publish directly.

## Lifecycle events

Every transaction, top-level or nested, emits an event before and after each step:

| `TransactionEvent` | Type string                           |
| ------------------ | ------------------------------------- |
| `BeforeBegin`      | `declaro::transaction.beforeBegin`    |
| `AfterBegin`       | `declaro::transaction.afterBegin`     |
| `BeforeCommit`     | `declaro::transaction.beforeCommit`   |
| `AfterCommit`      | `declaro::transaction.afterCommit`    |
| `BeforeRollback`   | `declaro::transaction.beforeRollback` |
| `AfterRollback`    | `declaro::transaction.afterRollback`  |

The `TransactionEvent` enum holds the actions. The type strings follow the same `<namespace>::<resource>.<action>` convention as `ModelService` events, and `TransactionLifecycleEvent.getType(action)` builds them for you (`TransactionLifecycleEvent.getDescriptor(action)` returns the `ActionDescriptor`). These two are equivalent:

```ts
import { TransactionEvent, TransactionLifecycleEvent } from '@declaro/data'

app.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), listener)
app.on('declaro::transaction.afterCommit', listener)
```

Each event is a `TransactionLifecycleEvent`, a `DomainEvent` whose `data` is an `ITransactionEventData`: a plain summary, `{ id, depth, status, parentId? }`, taken when the event was emitted. It survives `JSON.stringify`, so it can go through adapters that forward events elsewhere, such as Redis. For in-process listeners, `event.transaction` is the live `ITransaction`. It is non-enumerable, so it is left out of serialization and spreads.

Use them for cross-cutting concerns such as metrics and logging. `app.on` listeners receive the context and the event; `app.events.on` listeners receive only the event:

```ts
import { TransactionEvent, TransactionLifecycleEvent } from '@declaro/data'

app.on(TransactionLifecycleEvent.getType(TransactionEvent.AfterCommit), (context, event: TransactionLifecycleEvent) => {
    metrics.increment('transactions.committed', { depth: event.data?.depth })
})

app.events.on('declaro::transaction.afterRollback', (event: TransactionLifecycleEvent) => {
    logger.warn('Transaction rolled back', event.data)
})
```

### Where they are emitted

Events are emitted with an awaited `emitAsync` on the `events` of the context the transaction begins in: the `context` option if you passed one, or else the ambient context. The emitter is captured by `begin()` and reused for that transaction's commit or rollback. With no context and no `emitter` option, nothing is emitted.

Listeners registered on the app context still reach transactions begun in requests and runs, because `Context.extend` copies the parent's listeners into a request context, and into each run's child context, when that context is created. The copy is a snapshot: a listener added to the app after a request or run context was created isn't seen by that context. Register lifecycle listeners at startup.

Pass the `emitter` option to send a transaction's events somewhere else. It applies only to that transaction (for `Transaction.run`, the run's own transaction), not to transactions nested in it, which use their own context's `events`.

### How listeners affect the transaction

- **A `before*` listener that throws stops that step.** The adapter isn't called and the status doesn't change, and the error reaches the caller. Inside `Transaction.run`, a throwing `beforeCommit` listener therefore makes the run roll back.
- **An `after*` listener that throws reaches the caller too, but the step has already happened**: the transaction is already begun, committed or rolled back. If an `afterBegin` listener throws inside `Transaction.run`, the run rolls back and rethrows without running the callback. The static `Transaction.begin()` also rolls back and rethrows, since the caller never gets the transaction. An instance's `transaction.begin()` leaves it `Active` and current: you hold it, so roll it back yourself.
- **Type-specific listeners run before `'*'` listeners**, one after another. So when a `before*` listener throws, `'*'` listeners (such as an event forwarder) never see that event.
- **In a cascade, each transaction emits its own events as it is finished**, innermost first. The target's own `beforeCommit` or `beforeRollback` fires after the cascade, just before its adapter call. If that listener throws, the target stays `Active`, and the inner transactions the cascade already finished stay finished.
- **A top-level commit runs in this order:** the adapter's commit, the status changes to `Committed`, the [`afterCommit` callbacks](#running-code-after-the-commit) run, then the `afterCommit` event is emitted. A failure at any point stops the sequence, so a failing callback also means no `afterCommit` event. A nested commit moves its callbacks to its parent instead of running them, then emits its `afterCommit` event.

A nested transaction's `afterCommit` event doesn't mean its data is saved (see [What a nested commit means](#what-a-nested-commit-means)), and the events fire for every transaction in the app. For a side effect that belongs to one piece of work, register an [`afterCommit` callback](#running-code-after-the-commit) on its transaction rather than listening for the event.

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

| Export                      | Kind       | Purpose                                                                                                                                     |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ITransactionAdapter`       | interface  | The adapter contract your app implements: `begin`, `commit`, `rollback`.                                                                    |
| `ITransaction`              | interface  | One transaction, ORM-agnostic: `id`, `status`, `parent`, `depth`, and `begin`, `commit`, `rollback`, `run`, `afterCommit`.                  |
| `Transaction`               | class      | Implements `ITransaction`. `new Transaction(options?)`; statics `begin(options?)` and `run(callback, options?)`.                            |
| `TransactionOptions`        | interface  | `adapter`, `context`, `parent`, `emitter`. Taken by the constructor, `Transaction.begin`, `Transaction.run` and `wrapWithTransaction`.      |
| `TransactionCallback`       | type       | `(transaction: ITransaction) => TResult \| Promise<TResult>`, the work passed to `run`.                                                     |
| `AfterCommitCallback`       | type       | `() => unknown \| Promise<unknown>`, the work passed to `afterCommit`.                                                                      |
| `TransactionStatus`         | enum       | `Pending`, `Active`, `Committed`, `RolledBack`.                                                                                             |
| `TransactionEvent`          | enum       | The six lifecycle actions, `BeforeBegin` to `AfterRollback`. Event types are `declaro::transaction.<action>`.                               |
| `TransactionLifecycleEvent` | class      | The lifecycle event: `data` (`ITransactionEventData`), non-enumerable `transaction`; statics `getType(action)` and `getDescriptor(action)`. |
| `ITransactionEventData`     | interface  | The serializable event data: `id`, `depth`, `status`, `parentId?`.                                                                          |
| `TransactionStack`          | class      | The active transactions of one request or run: `current` (the top), `size`, `has()`. Register one for scripts.                              |
| `transactionModule`         | middleware | Registers the adapter on the app context, and gives each request context its own `TransactionStack`.                                        |
| `wrapWithTransaction`       | function   | Wraps any async work so every call runs through `Transaction.run`, with the same options.                                                   |
| `useTransaction`            | function   | Synchronously gets the current transaction. Throws when none is active.                                                                     |
| `useTransactionAdapter`     | function   | Synchronously gets the adapter registered in the current context. Its type parameter is a cast.                                             |
| `MockTransactionAdapter`    | class      | In-memory adapter for tests, with `handle()`, an `operations` log and configurable `failures`.                                              |
