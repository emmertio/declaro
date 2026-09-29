import { useContext } from '@declaro/core'
import type { Context } from '@declaro/core'
import type { ITransactionScope } from '../../../types/transaction-context'
import type { ITransactionAdapter } from '../../../domain/transaction/transaction-adapter-interface'

/**
 * Gets the transaction bound to the current ambient context. This is the manual API: call `begin()`, `commit()`,
 * and `rollback()` on the result yourself.
 *
 * Inside a `withTransaction()` callback, this is the transaction the callback runs in, including nested ones. In a
 * request context set up by `transactionModule()`, it is the request's own transaction, the same instance every
 * time it is called during that request.
 *
 * @typeParam TTransaction - Your adapter type, to reach ORM-specific members such as an entity manager.
 * @returns The transaction bound to the current context.
 * @throws {Error} If called outside of a Declaro context, or if the context has no transaction.
 *
 * @example
 * ```ts
 * const transaction = await useTransaction()
 * await transaction.begin()
 * try {
 *     await doWork()
 *     await transaction.commit()
 * } catch (error) {
 *     await transaction.rollback()
 *     throw error
 * }
 * ```
 */
export async function useTransaction<TTransaction extends ITransactionAdapter = ITransactionAdapter>(): Promise<TTransaction> {
    const context = useContext<Context<ITransactionScope>>()

    if (!context) {
        throw new Error('useTransaction() was called outside of an active context. Wrap your code with withContext().')
    }

    const transaction = await context.resolve('transaction')

    if (!transaction) {
        throw new Error(
            'No transaction was found in the current context. Register one with transactionModule(), or run inside withTransaction().',
        )
    }

    return transaction as TTransaction
}
