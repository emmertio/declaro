# Transactions

`@declaro/data` provides an ORM-agnostic transaction framework. It handles the transaction lifecycle: beginning, committing, rolling back, nesting, and binding the current transaction to the ambient context. Talking to your database is left to an **adapter** that your app implements.

- [Building an adapter](#building-an-adapter)
- [Registering it](#registering-it)
- [Using transactions](#using-transactions)
  - [Callback: `withTransaction`](#callback-withtransaction)
  - [Wrapping requests: `wrapWithTransaction`](#wrapping-requests-wrapwithtransaction)
  - [Manual: `useTransaction`](#manual-usetransaction)
  - [Nesting](#nesting)
- [Reaching the ORM from repositories](#reaching-the-orm-from-repositories)
- [Testing](#testing)
- [Reference](#reference)

## Building an adapter

Extend the abstract `TransactionAdapter` class. It already provides the lifecycle state machine, the guards against invalid transitions, and `run()`. You implement four methods:

| Method           | Responsibility                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `onBegin()`      | Start the underlying transaction. When nested (`this.parent` is set), usually create a savepoint.                  |
| `onCommit()`     | Commit it, or release the savepoint when nested.                                                                   |
| `onRollback()`   | Roll it back, or roll back to the savepoint when nested.                                                           |
| `createNested()` | Return a new, pending adapter for a transaction nested in this one, with `this` as its parent.                     |

Only the transitions are yours to handle. The base class makes sure each hook is called in a valid state, and only moves to the next status after the hook resolves. If `onCommit()` throws, the transaction stays `Active` and gets rolled back.

### Example: a raw SQL adapter

```ts
import { TransactionAdapter } from '@declaro/data'

export class SqlTransactionAdapter extends TransactionAdapter {
    constructor(
        readonly connection: SqlConnection,
        parent?: SqlTransactionAdapter,
    ) {
        super(parent)
    }

    private get savepoint() {
        return `sp_${this.depth}`
    }

    protected async onBegin() {
        await this.connection.query(this.parent ? `SAVEPOINT ${this.savepoint}` : 'BEGIN')
    }

    protected async onCommit() {
        await this.connection.query(this.parent ? `RELEASE SAVEPOINT ${this.savepoint}` : 'COMMIT')
        if (!this.parent) this.connection.release()
    }

    protected async onRollback() {
        await this.connection.query(this.parent ? `ROLLBACK TO SAVEPOINT ${this.savepoint}` : 'ROLLBACK')
        if (!this.parent) this.connection.release()
    }

    protected createNested() {
        // Nested transactions share the parent's connection and use savepoints.
        return new SqlTransactionAdapter(this.connection, this)
    }
}
```

Whatever the rest of your code needs to reach, such as the connection, an entity manager, or a Knex `trx`, goes on the adapter as a public property. For ORMs with their own transaction objects, keep that object on the adapter as well. `createNested()` then hands the child whatever the ORM's nesting API returns, such as Knex's `trx.transaction()` or a MikroORM fork.

### ORMs that can't nest

Return a `NoopTransactionAdapter` from `createNested()`:

```ts
protected createNested() {
    return new NoopTransactionAdapter(this)
}
```

Nested work then joins the outer transaction. An error that escapes a nested callback still rolls back everything, because it propagates up to the outer transaction. An error that the outer callback catches, though, does **not** undo the nested work, since without savepoints there is nothing to roll back to.

## Registering it

Register `transactionModule` on the app context and give it a factory for top-level transactions:

```ts
import { Context, useDeclaro } from '@declaro/core'
import { transactionModule } from '@declaro/data'

const app = new Context()

await app.use(
    useDeclaro(),
    transactionModule({
        createTransaction: async () => new SqlTransactionAdapter(await pool.connect()),
    }),
)
```

This does two things:

1. Registers `createTransaction` in scope, so `withTransaction()` can start transactions anywhere, including background jobs and scripts that never touch a request.
2. Adds request middleware that gives each request context its own `transaction`. It is created lazily the first time something resolves it, and the same instance is returned for the rest of that request.

## Using transactions

### Callback: `withTransaction`

Everything in the callback runs in one transaction. It commits when the callback resolves and rolls back if the callback throws:

```ts
import { withTransaction } from '@declaro/data'

const order = await withTransaction(async () => {
    const order = await orderService.create(input)
    await inventoryService.reserve(order.items) // if this throws, the order is rolled back too
    return order
})
```

`withTransaction` needs an ambient context: call it inside `withContext(...)`, or pass `{ context }` explicitly. Which transaction it uses depends on the context's current one:

| Current transaction                                       | What `withTransaction` does                               |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Active                                                    | Runs the callback in a transaction nested inside it.      |
| Pending (e.g. a request's transaction nobody has begun)   | Begins that transaction and uses it.                      |
| None, or already committed or rolled back                 | Creates a new top-level one with `createTransaction`.     |

If the callback commits or rolls back the transaction itself, `withTransaction` leaves it alone.

### Wrapping requests: `wrapWithTransaction`

Declaro's request middleware runs while the request context is being built, not around the handler, so it can't commit or roll back by itself. Instead, wrap the handler where your server glue runs it inside the request context:

```ts
import { createRequestContext, withContext } from '@declaro/core'
import { wrapWithTransaction } from '@declaro/data'

async function handle(req: Request, handler: (req: Request) => Promise<Response>) {
    const requestContext = await createRequestContext(app, req)
    return withContext(requestContext, wrapWithTransaction(() => handler(req)))
}
```

`wrapWithTransaction(fn)` returns a function with the same parameters that runs each call through `withTransaction`. Inside a request, that begins the request's own transaction, so everything in the handler, including `useTransaction()` calls, shares it, and a thrown error rolls it all back.

The same approach works in a framework's middleware. For example, in Express:

```ts
app.use((req, res, next) => {
    const requestContext = res.locals.declaroContext // however your app attaches it
    withContext(requestContext, () =>
        withTransaction(
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

To wrap only some routes, apply `wrapWithTransaction` to just those handlers.

### Manual: `useTransaction`

`useTransaction()` returns the transaction bound to the current context. That is the request's transaction in a request, or the one the enclosing `withTransaction` callback runs in. Drive it yourself:

```ts
import { useTransaction } from '@declaro/data'

const transaction = await useTransaction()
await transaction.begin()

try {
    await doWork()
    await transaction.commit()
} catch (error) {
    await transaction.rollback()
    throw error
}
```

Each transaction has a `status` (`Pending`, `Active`, `Committed`, `RolledBack`). Calling a method in the wrong state throws. For example, you can't commit a pending transaction or begin one twice.

Manual control works on whatever transaction is already bound to the context, such as the request's. A transaction you create yourself doesn't become ambient just by beginning it. Code only sees it through `useTransaction()` inside `transaction.run(...)`.

### Nesting

Nesting happens automatically whenever a transaction is started inside an active one. That covers `withTransaction` inside `withTransaction`, `transaction.run(...)` on an active transaction, and a manually created `transaction.nested()`:

```ts
await withTransaction(async () => {
    await createOrder()

    try {
        await withTransaction(async () => {
            await chargeCard() // throws
        })
    } catch {
        // Only the nested transaction (the savepoint) was rolled back. The order is still there.
        await markOrderUnpaid()
    }
}) // commits the order and the "unpaid" flag
```

Inside a nested callback, `useTransaction()` returns the nested transaction. When the callback finishes, the outer transaction is ambient again. Concurrent `withTransaction` calls each get their own transaction.

## Reaching the ORM from repositories

Repositories and services should get the database handle from the current transaction, not from a global, so they automatically take part in whatever transaction is ambient:

```ts
class SqlOrderRepository {
    async create(order: OrderInput) {
        const { connection } = await useTransaction<SqlTransactionAdapter>()
        return connection.query('INSERT INTO orders ...', [order])
    }
}
```

`useTransaction()` throws if no transaction is bound, which catches code that should be transactional but isn't. If some code may run either inside or outside a transaction, resolve `transaction` from the context yourself and fall back to a non-transactional handle.

## Testing

`MockTransactionAdapter` is an in-memory adapter that supports nesting. It records every transition in an `operations` log shared by the whole transaction tree:

```ts
import { MockTransactionAdapter, transactionModule } from '@declaro/data'

await app.use(transactionModule({ createTransaction: () => new MockTransactionAdapter() }))

// ...

expect(transaction.operations.map((op) => `${op.operation}@${op.depth}`)).toEqual([
    'begin@0',
    'begin@1',
    'rollback@1',
    'commit@0',
])
```

Set `failures` (`{ begin?, commit?, rollback? }`) to make a transition throw, for testing error paths.

## Reference

| Export                      | Kind            | Purpose                                                                                     |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `ITransactionAdapter`       | interface       | The adapter contract.                                                                       |
| `TransactionStatus`         | enum            | `Pending`, `Active`, `Committed`, `RolledBack`.                                             |
| `TransactionAdapter`        | abstract class  | Base class for adapters. Implement `onBegin`, `onCommit`, `onRollback`, and `createNested`. |
| `NoopTransactionAdapter`    | class           | Adapter whose transitions do nothing. Use it for nesting on ORMs without savepoints.        |
| `TransactionRunner`         | class           | Begins a transaction, binds it to the context, runs a callback, then commits or rolls back. |
| `transactionModule`         | middleware      | Registers the factory and a transaction for each request.                                   |
| `withTransaction`           | function        | Callback API.                                                                               |
| `wrapWithTransaction`       | function        | Wraps a function so every call runs in a transaction.                                       |
| `useTransaction`            | function        | Gets the ambient transaction.                                                               |
| `MockTransactionAdapter`    | class           | In-memory adapter for tests.                                                                |
