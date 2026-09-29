import {
    TransactionStatus,
    type ITransactionAdapter,
    type TransactionCallback,
} from '../../domain/transaction/transaction-adapter-interface'
import { TransactionRunner } from './transaction-runner'

const runner = new TransactionRunner()

/**
 * Base class for ORM-specific transaction adapters.
 *
 * It owns the lifecycle state machine, guards against invalid transitions, and provides `run()`. Subclasses only
 * translate each transition into their ORM's calls:
 *
 * - {@link onBegin}, {@link onCommit}, {@link onRollback}: start, commit, or roll back the underlying transaction.
 *   For a nested transaction (`this.parent` is set), this is usually a savepoint.
 * - {@link createNested}: create the adapter for a transaction nested in this one. Return a
 *   `NoopTransactionAdapter` if the ORM can't nest.
 *
 * The status only changes after a hook resolves, so a hook that throws leaves the transaction where it was. For
 * example, a failed commit leaves it `Active`, so it can still be rolled back.
 *
 * @example
 * ```ts
 * class SqlTransactionAdapter extends TransactionAdapter {
 *     constructor(private readonly connection: SqlConnection, parent?: SqlTransactionAdapter) {
 *         super(parent)
 *     }
 *
 *     private get savepoint() {
 *         return `sp_${this.depth}`
 *     }
 *
 *     protected async onBegin() {
 *         await this.connection.query(this.parent ? `SAVEPOINT ${this.savepoint}` : 'BEGIN')
 *     }
 *
 *     protected async onCommit() {
 *         await this.connection.query(this.parent ? `RELEASE SAVEPOINT ${this.savepoint}` : 'COMMIT')
 *     }
 *
 *     protected async onRollback() {
 *         await this.connection.query(this.parent ? `ROLLBACK TO SAVEPOINT ${this.savepoint}` : 'ROLLBACK')
 *     }
 *
 *     protected createNested() {
 *         return new SqlTransactionAdapter(this.connection, this)
 *     }
 * }
 * ```
 */
export abstract class TransactionAdapter implements ITransactionAdapter {
    private currentStatus = TransactionStatus.Pending

    /**
     * @param parent - The transaction this one is nested in. Omit for a top-level transaction.
     */
    constructor(public readonly parent?: TransactionAdapter) {}

    /** The current lifecycle state. */
    get status(): TransactionStatus {
        return this.currentStatus
    }

    /** How deeply this transaction is nested. `0` for a top-level transaction. */
    get depth(): number {
        return this.parent ? this.parent.depth + 1 : 0
    }

    /**
     * Starts the transaction.
     *
     * @throws {Error} If the transaction is not `Pending`.
     */
    async begin(): Promise<void> {
        this.assertStatus(TransactionStatus.Pending, 'begin')
        await this.onBegin()
        this.currentStatus = TransactionStatus.Active
    }

    /**
     * Commits the transaction.
     *
     * @throws {Error} If the transaction is not `Active`.
     */
    async commit(): Promise<void> {
        this.assertStatus(TransactionStatus.Active, 'commit')
        await this.onCommit()
        this.currentStatus = TransactionStatus.Committed
    }

    /**
     * Rolls the transaction back.
     *
     * @throws {Error} If the transaction is not `Active`.
     */
    async rollback(): Promise<void> {
        this.assertStatus(TransactionStatus.Active, 'rollback')
        await this.onRollback()
        this.currentStatus = TransactionStatus.RolledBack
    }

    /**
     * Creates a pending transaction nested inside this one.
     *
     * @returns The nested transaction. It has not been begun yet.
     * @throws {Error} If this transaction is not `Active`.
     */
    nested(): TransactionAdapter {
        this.assertStatus(TransactionStatus.Active, 'nest a transaction in')
        return this.createNested()
    }

    /**
     * Runs `callback` inside this transaction, committing on success and rolling back if it throws. If this
     * transaction is already active, `callback` runs in a new transaction nested inside it.
     *
     * @param callback - The work to run. `useTransaction()` resolves to the transaction it runs in.
     * @returns Whatever `callback` returns.
     */
    run<TResult>(callback: TransactionCallback<TResult, this>): Promise<TResult> {
        return runner.run(this, callback)
    }

    /** Starts the underlying transaction, or a savepoint when nested. */
    protected abstract onBegin(): Promise<void>

    /** Commits the underlying transaction, or releases the savepoint when nested. */
    protected abstract onCommit(): Promise<void>

    /** Rolls back the underlying transaction, or rolls back to the savepoint when nested. */
    protected abstract onRollback(): Promise<void>

    /**
     * Creates the adapter for a transaction nested in this one. Pass `this` as the new adapter's `parent`.
     *
     * @returns A new, pending adapter.
     */
    protected abstract createNested(): TransactionAdapter

    private assertStatus(expected: TransactionStatus, action: string) {
        if (this.currentStatus !== expected) {
            throw new Error(`Cannot ${action} a transaction that is ${this.currentStatus}`)
        }
    }
}
