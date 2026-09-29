import type { Context } from '@declaro/core'

/**
 * Lifecycle state of a transaction.
 */
export enum TransactionStatus {
    /** Created, but `begin()` has not been called yet. */
    Pending = 'pending',
    /** Begun, and neither committed nor rolled back. */
    Active = 'active',
    /** Committed successfully. Terminal. */
    Committed = 'committed',
    /** Rolled back. Terminal. */
    RolledBack = 'rolled-back',
}

/**
 * Work to run inside a transaction. Receives the transaction it runs in.
 */
export type TransactionCallback<TResult, TTransaction extends ITransactionAdapter = ITransactionAdapter> = (
    transaction: TTransaction,
) => TResult | Promise<TResult>

/**
 * Creates a new top-level transaction. This is the project-specific seam where an app plugs in its ORM.
 *
 * @param context - The context the transaction is being created for.
 */
export type TransactionFactory<TTransaction extends ITransactionAdapter = ITransactionAdapter> = (
    context: Context,
) => TTransaction | Promise<TTransaction>

/**
 * Something that can run a callback inside a transaction.
 */
export interface ITransactionRunner {
    /**
     * Runs `callback` inside this transaction, committing on success and rolling back if it throws.
     *
     * @param callback - The work to run.
     * @returns Whatever `callback` returns.
     */
    run<TResult>(callback: TransactionCallback<TResult>): Promise<TResult>
}

/**
 * The contract an ORM-specific transaction adapter fulfills.
 *
 * Most implementations should extend the abstract `TransactionAdapter` class rather than implementing this directly,
 * since it provides the state machine and `run()` behavior.
 */
export interface ITransactionAdapter extends ITransactionRunner {
    /** The current lifecycle state. */
    readonly status: TransactionStatus
    /** The transaction this one is nested in, if any. */
    readonly parent?: ITransactionAdapter
    /** How deeply this transaction is nested. `0` for a top-level transaction. */
    readonly depth: number

    /** Starts the transaction. Only valid while `Pending`. */
    begin(): Promise<void>
    /** Commits the transaction. Only valid while `Active`. */
    commit(): Promise<void>
    /** Rolls the transaction back. Only valid while `Active`. */
    rollback(): Promise<void>
    /**
     * Creates a pending transaction nested inside this one. Only valid while `Active`.
     *
     * @returns The nested transaction. It has not been begun yet.
     */
    nested(): ITransactionAdapter
}
