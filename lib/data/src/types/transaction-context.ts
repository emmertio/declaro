import type { ITransactionAdapter, TransactionFactory } from '../domain/transaction/transaction-adapter-interface'

/**
 * Scope contributed to a Declaro {@link Context} by the transaction layer.
 *
 * Merged into `DataScope` so that data-layer code can reach the active transaction
 * through the ambient context instead of having it passed explicitly.
 */
export interface ITransactionScope {
    /**
     * The transaction bound to the current context. Request contexts get their own (see `transactionModule`), and
     * `withTransaction` binds each transaction it runs, including nested ones, to a child context.
     */
    transaction: Promise<ITransactionAdapter>
    /** Creates new top-level transactions. Registered by `transactionModule`. */
    createTransaction: TransactionFactory
}
