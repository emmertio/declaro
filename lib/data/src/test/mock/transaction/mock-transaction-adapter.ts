import { TransactionAdapter } from '../../../application/transaction/transaction-adapter'

/**
 * A lifecycle operation recorded by {@link MockTransactionAdapter}.
 */
export interface MockTransactionOperation {
    /** Which transition ran. */
    operation: 'begin' | 'commit' | 'rollback'
    /** The id of the transaction it ran on. */
    transactionId: number
    /** The nesting depth of that transaction. */
    depth: number
}

/**
 * Which transitions a {@link MockTransactionAdapter} should fail on, to exercise error paths.
 */
export interface MockTransactionFailures {
    /** Throw from `onBegin`. */
    begin?: boolean
    /** Throw from `onCommit`. */
    commit?: boolean
    /** Throw from `onRollback`. */
    rollback?: boolean
}

/**
 * An in-memory transaction adapter for tests. It supports nesting, and records every transition in an operation
 * log shared by the whole transaction tree, so tests can check what ran and in what order.
 *
 * @example
 * ```ts
 * const transaction = new MockTransactionAdapter()
 * await transaction.run(async () => {})
 * expect(transaction.operations.map((op) => op.operation)).toEqual(['begin', 'commit'])
 * ```
 */
export class MockTransactionAdapter extends TransactionAdapter {
    private static nextId = 1

    /** A unique id for this transaction, for telling transactions apart in the log. */
    readonly id = MockTransactionAdapter.nextId++

    /** Operations recorded by this transaction and every transaction nested in it. Shared across the tree. */
    readonly operations: MockTransactionOperation[]

    /** Transitions to fail on. Can be changed at any time. Nested transactions don't inherit it. */
    failures: MockTransactionFailures

    /**
     * @param options.parent - The transaction this one is nested in.
     * @param options.failures - Transitions to fail on.
     */
    constructor(options: { parent?: MockTransactionAdapter; failures?: MockTransactionFailures } = {}) {
        super(options.parent)
        this.operations = options.parent?.operations ?? []
        this.failures = options.failures ?? {}
    }

    /** Records `begin`, or throws if configured to fail. */
    protected async onBegin(): Promise<void> {
        this.record('begin')
    }

    /** Records `commit`, or throws if configured to fail. */
    protected async onCommit(): Promise<void> {
        this.record('commit')
    }

    /** Records `rollback`, or throws if configured to fail. */
    protected async onRollback(): Promise<void> {
        this.record('rollback')
    }

    /**
     * @returns A new mock nested in this one, sharing its operation log.
     */
    protected createNested(): MockTransactionAdapter {
        return new MockTransactionAdapter({ parent: this })
    }

    private record(operation: MockTransactionOperation['operation']) {
        if (this.failures[operation]) {
            throw new Error(`Mock ${operation} failure`)
        }

        this.operations.push({ operation, transactionId: this.id, depth: this.depth })
    }
}
