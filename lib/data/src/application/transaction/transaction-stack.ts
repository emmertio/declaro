import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'

/**
 * Options for the {@link TransactionStack} constructor.
 */
export interface TransactionStackOptions {
    /**
     * The stack of the context the new stack's flow is started from, such as the app context's stack for a request
     * context. If its current transaction is `Active`, the new stack starts nested under it: while the new stack is
     * empty, that transaction is its {@link TransactionStack.current | current} one, transactions begun on the new stack
     * nest in it (when they use the same adapter), and committing or rolling it back cascades into the transactions
     * still open on the new stack. Otherwise the new stack starts empty and unlinked, as if `outer` were not passed.
     */
    outer?: TransactionStack
}

/**
 * The ordered list of active transactions for one async flow, innermost last.
 *
 * `begin()` pushes a transaction onto the stack of its context, making it current; `commit()` and `rollback()` take
 * it off again, making whatever was current before it current again. `useTransaction()` returns the top of the stack.
 *
 * A stack belongs to one flow, and outside tests never to a shared app-level context:
 * - `transactionModule()` registers a new one on every request context, nested under the current transaction of the
 *   context the request is created from, if it has one (see {@link TransactionStackOptions.outer}).
 * - `Transaction.run()` and `transaction.run()` give each run its own, so concurrent runs stay isolated.
 * - Scripts can register one themselves.
 * - The test helpers (`rollbackEachTest()`, `withRollback()`) register one on the context they are given, for the
 *   length of a test.
 *
 * @example
 * ```ts
 * const context = new Context().extend(appContext)
 * context.registerValue('transactionStack', new TransactionStack())
 *
 * await withContext(context, async () => {
 *     const transaction = await Transaction.begin()
 *     // ...
 *     await transaction.commit()
 * })
 * ```
 */
export class TransactionStack {
    private readonly entries: ITransaction[] = []

    /**
     * The stack this one is nested under, when it was created with an `outer` stack whose current transaction was
     * `Active`.
     *
     * @internal Used to plan cascading commits and rollbacks.
     */
    readonly outer?: TransactionStack

    /**
     * The transaction this stack is nested under: the `outer` stack's current transaction when this stack was created.
     * It is never on this stack.
     *
     * @internal Used by `Transaction` to cascade into this stack.
     */
    readonly base?: ITransaction

    /**
     * Creates an empty stack.
     *
     * @param options - Optional. Pass `outer` to start the stack nested under that stack's current transaction.
     */
    constructor(options: TransactionStackOptions = {}) {
        const base = options.outer?.current
        if (base && base.status === TransactionStatus.Active) {
            this.outer = options.outer
            this.base = base
        }
    }

    /**
     * The current transaction: the top of the stack. When the stack is empty, the transaction it is nested under while
     * that one is `Active`, or else `undefined`.
     */
    get current(): ITransaction | undefined {
        const top = this.entries[this.entries.length - 1]
        if (top) {
            return top
        }

        return this.base?.status === TransactionStatus.Active ? this.base : undefined
    }

    /** How many transactions are on the stack. Does not count the transaction it is nested under. */
    get size(): number {
        return this.entries.length
    }

    /**
     * Checks whether `transaction` is on this stack.
     *
     * @param transaction - The transaction to look for.
     * @returns `true` if it is on the stack.
     */
    has(transaction: ITransaction): boolean {
        return this.entries.includes(transaction)
    }

    /**
     * Makes `transaction` current by putting it on top of the stack.
     *
     * @internal Called by `Transaction.begin()`.
     * @param transaction - The transaction that has just begun.
     */
    push(transaction: ITransaction): void {
        this.entries.push(transaction)
    }

    /**
     * Takes `transaction` off the stack. Does nothing if it is not on it.
     *
     * @internal Called by `Transaction.commit()` and `Transaction.rollback()`.
     * @param transaction - The transaction that has just finished.
     */
    remove(transaction: ITransaction): void {
        const index = this.entries.indexOf(transaction)

        if (index !== -1) {
            this.entries.splice(index, 1)
        }
    }

    /**
     * Gets every transaction on the stack, outermost first.
     *
     * @internal Used to plan cascading commits and rollbacks.
     * @returns A copy of the stack's entries.
     */
    all(): ITransaction[] {
        return [...this.entries]
    }

    /**
     * Gets the transactions begun after `transaction` on this stack and still open, outermost first.
     *
     * @internal Used to plan cascading commits and rollbacks.
     * @param transaction - A transaction on this stack.
     * @returns The transactions above it, or an empty array if it is on top or not on the stack.
     */
    above(transaction: ITransaction): ITransaction[] {
        const index = this.entries.indexOf(transaction)
        return index === -1 ? [] : this.entries.slice(index + 1)
    }
}
