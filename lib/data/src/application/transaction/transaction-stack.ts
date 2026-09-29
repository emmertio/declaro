import type { ITransaction } from '../../domain/transaction/transaction-interface'

/**
 * The ordered list of active transactions for one async flow, innermost last.
 *
 * `begin()` pushes a transaction onto the stack of its context, making it current; `commit()` and `rollback()` take
 * it off again, making whatever was current before it current again. `useTransaction()` returns the top of the stack.
 *
 * A stack belongs to one flow, never to a shared app-level context:
 * - `transactionModule()` registers a new one on every request context.
 * - `Transaction.run()` and `transaction.run()` give each run its own, so concurrent runs stay isolated.
 * - Scripts can register one themselves.
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

    /** The current transaction: the top of the stack, or `undefined` when the stack is empty. */
    get current(): ITransaction | undefined {
        return this.entries[this.entries.length - 1]
    }

    /** How many transactions are on the stack. */
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
