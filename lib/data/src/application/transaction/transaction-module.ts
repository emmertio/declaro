import { provideRequestMiddleware, type Context, type DeclaroScope } from '@declaro/core'
import type { ITransactionAdapter } from '../../domain/transaction/transaction-interface'
import type { ITransactionScope } from '../../types/transaction-context'
import { TransactionStack, type TransactionStackOptions } from './transaction-stack'

/**
 * Options for {@link transactionModule}.
 */
export interface TransactionModuleOptions {
    /**
     * The app's long-lived transaction adapter, usually one per connection pool or ORM instance. This is where the
     * app plugs in its ORM.
     */
    adapter: ITransactionAdapter
}

/**
 * Context middleware that sets up transactions for an app:
 *
 * - Registers the app's transaction adapter as `transactionAdapter`, so `Transaction.run()` and friends can find it
 *   anywhere in the app, including request contexts derived from the app context.
 * - Adds request middleware that registers a new {@link TransactionStack} as `transactionStack` on each request
 *   context, so every request tracks its own transactions and `Transaction.begin()` works inside it.
 *
 * If the context the request is created from has a transaction stack whose current transaction is `Active`, the
 * request's stack starts nested under that transaction (see {@link TransactionStackOptions.outer}): `useTransaction()`
 * in the request returns it until the request begins its own, transactions the request begins nest in it, and
 * committing or rolling it back cascades into whatever the request left open. App contexts have no stack outside
 * tests, so in production every request starts with an empty stack. Either way, each request gets a stack of its own.
 *
 * It registers no stack on the app context itself, and begins no transaction.
 *
 * @param options - Module configuration.
 * @returns Middleware to pass to `context.use()`.
 *
 * @example
 * ```ts
 * await appContext.use(useDeclaro(), transactionModule({ adapter: new SqlTransactionAdapter(pool) }))
 * ```
 */
export function transactionModule(options: TransactionModuleOptions) {
    return (context: Context<DeclaroScope & ITransactionScope>) => {
        context.registerValue('transactionAdapter', options.adapter)

        provideRequestMiddleware(context, (requestContext) => {
            const scoped = requestContext as Context<ITransactionScope>
            // Copied from the context the request was created from, if it had one.
            const outer = scoped.resolve('transactionStack')
            scoped.registerValue('transactionStack', new TransactionStack({ outer }))
        })
    }
}
