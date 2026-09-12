import type { BeginTransactionOptions, TransactionAdapter } from '../transaction-adapter'

/**
 * Handle produced by the {@link MockTransactionAdapter}, standing in for an
 * ORM's transaction object.
 */
export interface MockTransactionHandle {
    /** Sequential identifier, unique per adapter instance. */
    id: number
    /** Writes that have not been committed yet. */
    pending: string[]
    /** Savepoint name to the length `pending` had when it was created. */
    savepoints: Map<string, number>
    /** Whether the transaction is still open. */
    isOpen: boolean
    /** Options the transaction was started with. */
    options?: BeginTransactionOptions
}

/**
 * Options controlling which parts of the adapter contract the mock implements.
 */
export interface MockTransactionAdapterOptions {
    /** Adapter name. Defaults to `'mock'`. */
    name?: string
    /** Implement the savepoint methods, enabling nested transactions. Defaults to `true`. */
    hasSavepoints?: boolean
    /** Implement the optional `run` hook that binds the handle while the callback runs. Defaults to `false`. */
    hasRunHook?: boolean
}

/**
 * In-memory {@link TransactionAdapter} for tests.
 *
 * It behaves like a tiny database: writes go to the handle's pending buffer,
 * a commit flushes them to {@link MockTransactionAdapter.store}, and a
 * rollback discards them. Every adapter call is recorded in
 * {@link MockTransactionAdapter.log} so tests can assert on the exact sequence
 * of operations.
 *
 * @example
 * ```ts
 * const adapter = new MockTransactionAdapter()
 * const manager = new TransactionManager(adapter)
 *
 * await manager.run((tx) => adapter.write(tx.handle, 'order'))
 * expect(adapter.store).toEqual(['order'])
 * ```
 */
export class MockTransactionAdapter implements TransactionAdapter<MockTransactionHandle> {
    /** Adapter name. */
    readonly name: string
    /** Values flushed by a successful commit. */
    readonly store: string[] = []
    /** Every adapter call, in order. */
    readonly log: string[] = []
    /** Every handle this adapter created. */
    readonly handles: MockTransactionHandle[] = []

    /** When `true`, the next {@link MockTransactionAdapter.begin} throws. */
    shouldFailBegin = false
    /** When `true`, the next {@link MockTransactionAdapter.commit} throws. */
    shouldFailCommit = false
    /** When `true`, the next {@link MockTransactionAdapter.rollback} throws. */
    shouldFailRollback = false

    /** Create a savepoint, present only when savepoints are enabled. */
    createSavepoint?: (handle: MockTransactionHandle, savepointName: string) => void
    /** Release a savepoint, present only when savepoints are enabled. */
    releaseSavepoint?: (handle: MockTransactionHandle, savepointName: string) => void
    /** Roll back to a savepoint, present only when savepoints are enabled. */
    rollbackToSavepoint?: (handle: MockTransactionHandle, savepointName: string) => void
    /** Bind the handle while the transaction callback runs, when enabled. */
    run?: <R>(handle: MockTransactionHandle, fn: () => R) => R

    #nextId = 1
    #boundHandles: MockTransactionHandle[] = []

    constructor(options: MockTransactionAdapterOptions = {}) {
        this.name = options.name ?? 'mock'

        if (options.hasSavepoints !== false) {
            this.createSavepoint = (handle, savepointName) => {
                this.log.push(`savepoint:${savepointName}`)
                handle.savepoints.set(savepointName, handle.pending.length)
            }

            this.releaseSavepoint = (handle, savepointName) => {
                this.log.push(`release:${savepointName}`)
                handle.savepoints.delete(savepointName)
            }

            this.rollbackToSavepoint = (handle, savepointName) => {
                this.log.push(`rollback-to:${savepointName}`)
                const length = handle.savepoints.get(savepointName) ?? 0
                handle.pending.splice(length)
                handle.savepoints.delete(savepointName)
            }
        }

        if (options.hasRunHook) {
            this.run = <R>(handle: MockTransactionHandle, fn: () => R): R => {
                this.log.push(`run:${handle.id}`)
                this.#boundHandles.push(handle)
                try {
                    return fn()
                } finally {
                    this.#boundHandles.pop()
                }
            }
        }
    }

    /**
     * Start a transaction.
     *
     * @param options - Options forwarded by the manager.
     * @returns A fresh handle.
     */
    begin(options?: BeginTransactionOptions): MockTransactionHandle {
        if (this.shouldFailBegin) {
            this.log.push('begin:failed')
            throw new Error('begin failed')
        }

        const handle: MockTransactionHandle = {
            id: this.#nextId++,
            pending: [],
            savepoints: new Map(),
            isOpen: true,
            options,
        }

        this.log.push(`begin:${handle.id}`)
        this.handles.push(handle)

        return handle
    }

    /**
     * Commit a transaction, flushing its pending writes to the store.
     *
     * @param handle - The transaction to commit.
     */
    commit(handle: MockTransactionHandle): void {
        if (this.shouldFailCommit) {
            this.log.push(`commit:${handle.id}:failed`)
            throw new Error('commit failed')
        }

        this.log.push(`commit:${handle.id}`)
        this.store.push(...handle.pending)
        handle.pending = []
        handle.isOpen = false
    }

    /**
     * Roll back a transaction, discarding its pending writes.
     *
     * @param handle - The transaction to roll back.
     */
    rollback(handle: MockTransactionHandle): void {
        if (this.shouldFailRollback) {
            this.log.push(`rollback:${handle.id}:failed`)
            throw new Error('rollback failed')
        }

        this.log.push(`rollback:${handle.id}`)
        handle.pending = []
        handle.isOpen = false
    }

    /**
     * Record a write inside a transaction.
     *
     * @param handle - The transaction to write to.
     * @param value - The value to write.
     */
    write(handle: MockTransactionHandle, value: string): void {
        if (!handle.isOpen) {
            throw new Error(`Cannot write to closed transaction ${handle.id}.`)
        }

        this.log.push(`write:${handle.id}:${value}`)
        handle.pending.push(value)
    }

    /** The handle bound by the optional `run` hook, when one is active. */
    get boundHandle(): MockTransactionHandle | null {
        return this.#boundHandles[this.#boundHandles.length - 1] ?? null
    }

    /** Handles that were never committed or rolled back. */
    get openHandles(): MockTransactionHandle[] {
        return this.handles.filter((handle) => handle.isOpen)
    }
}
