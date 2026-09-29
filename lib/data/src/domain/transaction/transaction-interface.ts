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
 *
 * @typeParam TResult - What the callback returns.
 */
export type TransactionCallback<TResult> = (transaction: ITransaction) => TResult | Promise<TResult>

/**
 * A single transaction. One instance is one transaction, and it is used once: it moves from `Pending` to `Active`,
 * then to `Committed` or `RolledBack`.
 *
 * A transaction knows nothing about the ORM behind it. The adapter that runs it keeps its ORM state (a checked-out
 * client, a forked entity manager, ...) and exposes it through its own typed accessor.
 */
export interface ITransaction {
    /** The current lifecycle state. */
    readonly status: TransactionStatus
    /** The transaction this one is nested in, if any. Decided when the transaction begins. */
    readonly parent?: ITransaction
    /** How deeply this transaction is nested. `0` for a top-level transaction, and before it has begun. */
    readonly depth: number

    /** Starts the transaction and makes it the current one. Only valid while `Pending`. */
    begin(): Promise<void>
    /** Commits the transaction, after committing everything begun after it in the same flow. Only valid while `Active`. */
    commit(): Promise<void>
    /** Rolls the transaction back, after rolling back everything begun after it in the same flow. Only valid while `Active`. */
    rollback(): Promise<void>
    /**
     * Runs `callback` in a new transaction nested inside this one, committing the nested transaction on success and
     * rolling it back if `callback` throws. Only valid while `Active`.
     *
     * @param callback - The work to run. `useTransaction()` returns the nested transaction while it runs.
     * @returns Whatever `callback` returns.
     */
    run<TResult>(callback: TransactionCallback<TResult>): Promise<TResult>
}

/**
 * The seam where an app plugs in its ORM. This is the only transaction type apps implement.
 *
 * An adapter is long-lived (usually one per connection pool or ORM instance) and is registered in DI with
 * `transactionModule()`. The `Transaction` class owns the lifecycle state machine; the adapter owns the ORM state.
 * It keeps that state per transaction (typically in a `WeakMap<ITransaction, Handle>`), finds a nested transaction's
 * parent state through `transaction.parent`, deletes the state on commit and rollback, and exposes its own typed
 * accessor for repositories, such as `client(transaction = useTransaction())`, that throws for a transaction it has no
 * state for.
 *
 * @example
 * ```ts
 * class SqlTransactionAdapter implements ITransactionAdapter {
 *     private readonly clients = new WeakMap<ITransaction, PoolClient>()
 *
 *     constructor(private readonly pool: Pool) {}
 *
 *     client(transaction: ITransaction = useTransaction()): PoolClient {
 *         const client = this.clients.get(transaction)
 *         if (!client) {
 *             throw new Error('The transaction has no client. It has not begun, or it has already finished.')
 *         }
 *         return client
 *     }
 *
 *     async begin(transaction: ITransaction) {
 *         if (transaction.parent) {
 *             const client = this.client(transaction.parent)
 *             await client.query(`SAVEPOINT sp_${transaction.depth}`)
 *             this.clients.set(transaction, client)
 *             return
 *         }
 *
 *         const client = await this.pool.connect()
 *         await client.query('BEGIN')
 *         this.clients.set(transaction, client)
 *     }
 *
 *     async commit(transaction: ITransaction) {
 *         const client = this.client(transaction)
 *         if (transaction.parent) {
 *             await client.query(`RELEASE SAVEPOINT sp_${transaction.depth}`)
 *         } else {
 *             await client.query('COMMIT')
 *             client.release()
 *         }
 *         this.clients.delete(transaction)
 *     }
 *
 *     async rollback(transaction: ITransaction) {
 *         const client = this.client(transaction)
 *         if (transaction.parent) {
 *             await client.query(`ROLLBACK TO SAVEPOINT sp_${transaction.depth}`)
 *         } else {
 *             await client.query('ROLLBACK')
 *             client.release()
 *         }
 *         this.clients.delete(transaction)
 *     }
 * }
 * ```
 */
export interface ITransactionAdapter {
    /**
     * Starts the transaction. If `transaction.parent` is set, starts a nested one, usually a savepoint.
     *
     * Adapters that can't nest should reuse the parent's state and make nested commits and rollbacks no-ops. Nested
     * work then joins the outer transaction: an error that escapes it still rolls back everything, but an error caught
     * inside the outer callback does not undo the nested work.
     *
     * @param transaction - The transaction being begun. Its `parent` and `depth` are already set.
     */
    begin(transaction: ITransaction): Promise<void>

    /**
     * Commits the transaction, or releases its savepoint when nested.
     *
     * @param transaction - The transaction being committed.
     */
    commit(transaction: ITransaction): Promise<void>

    /**
     * Rolls the transaction back, or rolls back to its savepoint when nested.
     *
     * @param transaction - The transaction being rolled back.
     */
    rollback(transaction: ITransaction): Promise<void>
}
