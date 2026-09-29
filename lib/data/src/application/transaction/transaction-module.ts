import { provideRequestMiddleware, type Context, type DeclaroScope } from '@declaro/core'
import type { TransactionFactory } from '../../domain/transaction/transaction-adapter-interface'
import type { ITransactionScope } from '../../types/transaction-context'

/**
 * Options for {@link transactionModule}.
 */
export interface TransactionModuleOptions {
    /**
     * Creates a new top-level transaction adapter. This is where the app plugs in its ORM, for example by forking an
     * entity manager or checking out a connection.
     */
    createTransaction: TransactionFactory
}

/**
 * Context middleware that sets up transactions for an app.
 *
 * - Registers `createTransaction`, so `withTransaction()` can start top-level transactions anywhere in the app.
 * - Adds request middleware that gives each request context its own `transaction`. It is created the first time it
 *   is resolved, and the same instance is returned for the rest of the request. This is what lets code in a request
 *   share one transaction through `useTransaction()` and control it manually.
 *
 * Request middleware runs while the request context is being built, not around the handler, so it can't commit on
 * its own. To wrap each request, run the handler with `wrapWithTransaction()` or `withTransaction()` inside the
 * request's `withContext` block.
 *
 * @param options - Module configuration.
 * @returns Middleware to pass to `context.use()`.
 *
 * @example
 * ```ts
 * await appContext.use(
 *     useDeclaro(),
 *     transactionModule({
 *         createTransaction: () => new SqlTransactionAdapter(pool.connect()),
 *     }),
 * )
 * ```
 */
export function transactionModule(options: TransactionModuleOptions) {
    return (context: Context<DeclaroScope & ITransactionScope>) => {
        context.registerValue('createTransaction', options.createTransaction)

        provideRequestMiddleware(context, (requestContext: Context<ITransactionScope>) => {
            requestContext.registerAsyncFactory(
                'transaction',
                async () => await options.createTransaction(requestContext),
                [],
                { singleton: true },
            )
        })
    }
}
