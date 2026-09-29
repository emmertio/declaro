import type { TransactionStack } from '../application/transaction/transaction-stack'
import type { ITransactionAdapter } from '../domain/transaction/transaction-interface'

/**
 * Scope contributed to a Declaro {@link Context} by the transaction layer.
 *
 * Merged into `DataScope` so that data-layer code can reach the adapter and the current transaction through the
 * ambient context instead of having them passed explicitly.
 */
export interface ITransactionScope {
    /**
     * The app's long-lived transaction adapter. Registered on the app context by `transactionModule()`, and on the
     * child context of each `Transaction.run()` and `transaction.run()` as the adapter that run uses.
     */
    transactionAdapter: ITransactionAdapter
    /**
     * The active transactions of the current async flow. Never registered on a shared app-level context:
     * `transactionModule()` registers a new one on every request context, each `Transaction.run()` and
     * `transaction.run()` registers its own on the child context its callback runs in, and scripts can register one
     * themselves.
     */
    transactionStack: TransactionStack
}
