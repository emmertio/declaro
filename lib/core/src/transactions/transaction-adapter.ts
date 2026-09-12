import type { PromiseOrValue } from '../typescript'

/**
 * Standard SQL isolation levels an adapter may support.
 *
 * Adapters are free to ignore levels their underlying store does not
 * implement, but they should never silently downgrade to a weaker level
 * without documenting it.
 */
export enum TransactionIsolationLevel {
    /** Reads may see uncommitted changes from other transactions. */
    READ_UNCOMMITTED = 'READ UNCOMMITTED',
    /** Reads only see committed changes. */
    READ_COMMITTED = 'READ COMMITTED',
    /** Repeated reads of the same row return the same values. */
    REPEATABLE_READ = 'REPEATABLE READ',
    /** Transactions behave as if they ran one after another. */
    SERIALIZABLE = 'SERIALIZABLE',
}

/**
 * Controls what happens when a transaction is started while another
 * transaction is already active on the same manager.
 */
export enum TransactionPropagation {
    /**
     * Reuse the active transaction. The inner transaction commits as a no-op,
     * and an inner rollback marks the whole transaction rollback-only.
     */
    JOIN = 'JOIN',
    /**
     * Nest inside the active transaction using a savepoint, so the inner
     * transaction can roll back independently of its parent. Falls back to
     * {@link TransactionPropagation.JOIN} when the adapter does not implement
     * savepoints.
     */
    NESTED = 'NESTED',
    /**
     * Suspend the active transaction and start a fully independent one that
     * commits or rolls back on its own.
     */
    REQUIRES_NEW = 'REQUIRES_NEW',
}

/**
 * Options accepted when starting a transaction.
 */
export interface TransactionOptions {
    /** How to behave when a transaction is already active. */
    propagation?: TransactionPropagation
    /** Isolation level requested from the adapter. */
    isolationLevel?: TransactionIsolationLevel
    /** Hint to the adapter that the transaction performs no writes. */
    isReadOnly?: boolean
    /** Adapter-specific options passed through untouched. */
    meta?: Record<string, any>
}

/**
 * Options handed to {@link TransactionAdapter.begin}. Propagation is resolved
 * by the manager before the adapter is called, so it is not included here.
 */
export type BeginTransactionOptions = Omit<TransactionOptions, 'propagation'>

/**
 * Contract an ORM integration must implement to plug into the framework.
 *
 * `THandle` is whatever the ORM uses to represent a running transaction (an
 * entity manager fork, a connection, a client, …). The framework never
 * inspects it — it only stores it on the active {@link TransactionScope} so
 * application code can resolve it.
 *
 * Savepoint methods are optional. Implement all three to support nested
 * transactions that roll back independently; otherwise nested transactions
 * degrade to joining the outer transaction.
 *
 * @example A minimal adapter
 * ```ts
 * const adapter: TransactionAdapter<Connection> = {
 *     name: 'my-orm',
 *     begin: () => pool.connect().then(async (c) => (await c.query('BEGIN'), c)),
 *     commit: async (c) => { await c.query('COMMIT'); c.release() },
 *     rollback: async (c) => { await c.query('ROLLBACK'); c.release() },
 * }
 * ```
 */
export interface TransactionAdapter<THandle = any> {
    /** Human readable adapter name, used in error messages and debugging. */
    readonly name?: string

    /**
     * Start a new transaction and return the handle representing it.
     */
    begin(options?: BeginTransactionOptions): PromiseOrValue<THandle>

    /**
     * Commit the transaction identified by `handle`.
     */
    commit(handle: THandle): PromiseOrValue<void>

    /**
     * Roll back the transaction identified by `handle`.
     */
    rollback(handle: THandle): PromiseOrValue<void>

    /**
     * Create a savepoint inside the transaction identified by `handle`.
     */
    createSavepoint?(handle: THandle, name: string): PromiseOrValue<void>

    /**
     * Release (keep the changes of) a previously created savepoint.
     */
    releaseSavepoint?(handle: THandle, name: string): PromiseOrValue<void>

    /**
     * Roll back to a previously created savepoint, discarding everything that
     * happened after it while keeping the outer transaction alive.
     */
    rollbackToSavepoint?(handle: THandle, name: string): PromiseOrValue<void>

    /**
     * Optional hook letting the adapter bind `handle` to the ORM's own ambient
     * context (for example MikroORM's `RequestContext`) while the transaction
     * callback runs.
     */
    run?<R>(handle: THandle, fn: () => R): R
}

/**
 * Determine whether an adapter implements the full savepoint contract, which
 * is required for nested transactions that roll back independently.
 *
 * @param adapter - The adapter to inspect.
 * @returns `true` when create, release and rollback-to savepoint are all implemented.
 */
export function hasSavepointSupport<THandle>(
    adapter: TransactionAdapter<THandle>,
): adapter is TransactionAdapter<THandle> &
    Required<Pick<TransactionAdapter<THandle>, 'createSavepoint' | 'releaseSavepoint' | 'rollbackToSavepoint'>> {
    return (
        typeof adapter.createSavepoint === 'function' &&
        typeof adapter.releaseSavepoint === 'function' &&
        typeof adapter.rollbackToSavepoint === 'function'
    )
}
