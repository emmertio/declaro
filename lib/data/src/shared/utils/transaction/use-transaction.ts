import { useContext } from '@declaro/core'
import type { Context } from '@declaro/core'
import type { ITransaction } from '../../../domain/transaction/transaction-interface'
import type { ITransactionScope } from '../../../types/transaction-context'

/**
 * Gets the current transaction: the top of the current context's transaction stack. That is the one whose
 * `run()` callback is executing, or the one most recently begun with `begin()` and not yet finished.
 *
 * Use it to pass the current transaction to an adapter's accessor, such as `adapter.client(useTransaction())`, from
 * code that runs inside a transaction without having the transaction passed to it.
 *
 * @returns The current transaction. It is always `Active`.
 * @throws {Error} If called outside of a Declaro context, or if no transaction is active in it (including from work a
 *   run started but didn't await, once the run has finished).
 *
 * @example
 * ```ts
 * await Transaction.run(async () => {
 *     const transaction = useTransaction()
 *     await orderService.create(input)
 * })
 * ```
 */
export function useTransaction(): ITransaction {
    const context = useContext<Context<ITransactionScope>>()

    if (!context) {
        throw new Error('useTransaction() was called outside of an active context. Wrap your code with withContext().')
    }

    const transaction = context.resolve('transactionStack')?.current

    if (!transaction) {
        throw new Error(
            'No transaction is active in the current context. Run your code inside Transaction.run(), or begin one with Transaction.begin().',
        )
    }

    return transaction
}
