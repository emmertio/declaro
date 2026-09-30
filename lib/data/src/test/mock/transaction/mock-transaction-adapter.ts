import type { ITransaction, ITransactionAdapter } from '../../../domain/transaction/transaction-interface'
import type { MockMemoryRepository } from '../repositories/mock-memory-repository'
import { useTransaction } from '../../../shared/utils/transaction/use-transaction'

/**
 * The per-transaction state {@link MockTransactionAdapter} keeps while a transaction is active.
 */
export interface MockTransactionHandle {
    /** A unique id for the transaction, per adapter instance, starting at 1. */
    id: number
    /** The nesting depth of the transaction. */
    depth: number
}

/**
 * A lifecycle operation recorded by {@link MockTransactionAdapter}.
 */
export interface MockTransactionOperation {
    /** Which adapter call ran. */
    operation: 'begin' | 'commit' | 'rollback'
    /** The id of the transaction it ran on. */
    transactionId: number
    /** The nesting depth of that transaction. */
    depth: number
}

/**
 * Which calls a {@link MockTransactionAdapter} should fail on, to exercise error paths.
 */
export interface MockTransactionFailures {
    /** Throw `Mock begin failure` from `begin()`. */
    begin?: boolean
    /** Throw `Mock commit failure` from `commit()`. */
    commit?: boolean
    /** Throw `Mock rollback failure` from `rollback()`. */
    rollback?: boolean
}

/**
 * A store whose state {@link MockTransactionAdapter} can snapshot and restore, so a rollback undoes its writes.
 * {@link MockMemoryRepository} implements it.
 */
export interface MockTransactionParticipant {
    /** Takes a deep copy of the store's state. */
    snapshot(): unknown
    /** Puts the store back to the state in a snapshot it took. */
    restoreSnapshot(snapshot: any): void
}

/**
 * Options for {@link MockTransactionAdapter}.
 */
export interface MockTransactionAdapterOptions {
    /** Calls to fail on. */
    failures?: MockTransactionFailures
    /** Stores to roll back with each transaction. See {@link MockTransactionAdapter.track}. */
    repositories?: MockTransactionParticipant[]
}

/**
 * An in-memory transaction adapter for tests. It supports nesting, and records every call in a single operation log,
 * so tests can check what ran and in what order.
 *
 * Like a real adapter it is long-lived (one instance serves every transaction in a test), keeps its own state per
 * transaction, drops that state when the transaction finishes, and exposes it through its own accessor,
 * {@link MockTransactionAdapter.handle}.
 *
 * @example
 * ```ts
 * const adapter = new MockTransactionAdapter()
 * await Transaction.run(async () => {
 *     expect(adapter.handle().depth).toBe(0)
 * }, { adapter })
 * expect(adapter.operations.map((op) => op.operation)).toEqual(['begin', 'commit'])
 * ```
 */
export class MockTransactionAdapter implements ITransactionAdapter {
    private nextId = 1
    private readonly handles = new WeakMap<ITransaction, MockTransactionHandle>()
    private readonly repositories = new Set<MockTransactionParticipant>()
    private readonly snapshots = new WeakMap<ITransaction, Map<MockTransactionParticipant, unknown>>()

    /** Every call made on this adapter, in order, across all of its transactions. */
    readonly operations: MockTransactionOperation[] = []

    /** Calls to fail on. Can be changed at any time. */
    failures: MockTransactionFailures

    /**
     * @param options.failures - Calls to fail on.
     * @param options.repositories - Stores to roll back with each transaction.
     */
    constructor(options: MockTransactionAdapterOptions = {}) {
        this.failures = options.failures ?? {}
        this.track(...(options.repositories ?? []))
    }

    /**
     * Makes stores take part in transactions, so a rollback undoes their writes. Every transaction (top-level or
     * nested) snapshots each tracked store when it begins; `commit` discards that snapshot and `rollback` restores
     * it. So a nested rollback undoes only the nested writes, and a parent rollback undoes a committed nested
     * transaction's writes too. A store tracked while a transaction is active is only covered by transactions that
     * begin after.
     *
     * Transactions writing to one tracked store must be sequential: two concurrent top-level transactions would
     * clobber each other's writes on rollback, since each restores the whole store.
     *
     * @param repositories - The stores to track, such as {@link MockMemoryRepository} instances.
     * @returns This adapter.
     */
    track(...repositories: MockTransactionParticipant[]): this {
        for (const repository of repositories) {
            this.repositories.add(repository)
        }
        return this
    }

    /**
     * Gets the state this adapter keeps for a transaction, the way a real adapter exposes its ORM handle.
     *
     * @param transaction - The transaction. Defaults to the current one.
     * @returns The transaction's handle.
     * @throws {Error} If the transaction has not begun on this adapter, or has already finished.
     */
    handle(transaction: ITransaction = useTransaction()): MockTransactionHandle {
        const handle = this.handles.get(transaction)

        if (!handle) {
            throw new Error(
                'The mock transaction adapter has no handle for this transaction. It has not begun on this adapter, or it has already finished.',
            )
        }

        return handle
    }

    /**
     * Records `begin` and creates the transaction's handle, or throws if configured to fail.
     *
     * @param transaction - The transaction being begun.
     */
    async begin(transaction: ITransaction): Promise<void> {
        this.assertSucceeds('begin')
        const handle = { id: this.nextId++, depth: transaction.depth }
        this.handles.set(transaction, handle)
        this.snapshots.set(
            transaction,
            new Map(Array.from(this.repositories, (repository) => [repository, repository.snapshot()])),
        )
        this.operations.push({ operation: 'begin', transactionId: handle.id, depth: handle.depth })
    }

    /**
     * Records `commit` and drops the transaction's handle and repository snapshots, or throws if configured to fail.
     *
     * @param transaction - The transaction being committed.
     */
    async commit(transaction: ITransaction): Promise<void> {
        this.finish('commit', transaction)
    }

    /**
     * Records `rollback`, restores tracked repositories to their state when the transaction began, and drops the
     * transaction's handle and snapshots, or throws if configured to fail.
     *
     * @param transaction - The transaction being rolled back.
     */
    async rollback(transaction: ITransaction): Promise<void> {
        this.finish('rollback', transaction)
    }

    /**
     * Records `commit` or `rollback` (restoring snapshots on rollback) and drops the handle and snapshots, or throws if configured to fail.
     */
    private finish(operation: 'commit' | 'rollback', transaction: ITransaction) {
        this.assertSucceeds(operation)
        const handle = this.handle(transaction)
        if (operation === 'rollback') {
            for (const [repository, snapshot] of this.snapshots.get(transaction) ?? []) {
                repository.restoreSnapshot(snapshot)
            }
        }
        this.operations.push({ operation, transactionId: handle.id, depth: handle.depth })
        this.handles.delete(transaction)
        this.snapshots.delete(transaction)
    }

    /**
     * Throws `Mock <operation> failure` if the operation is configured to fail.
     */
    private assertSucceeds(operation: MockTransactionOperation['operation']) {
        if (this.failures[operation]) {
            throw new Error(`Mock ${operation} failure`)
        }
    }
}
