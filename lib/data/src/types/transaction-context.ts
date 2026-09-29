import type { ITransactionAdapter } from '../domain/transaction/transaction-adapter-interface'

/**
 * Scope contributed to a Declaro {@link Context} by the transaction layer.
 *
 * Merged into `DataScope` so that data-layer code can reach the active transaction
 * through the ambient context instead of having it passed explicitly.
 */
export interface ITransactionScope {
    /** The adapter for the transaction bound to the current context. */
    transaction: Promise<ITransactionAdapter>
}
