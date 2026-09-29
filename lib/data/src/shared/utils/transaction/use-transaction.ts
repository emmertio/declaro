import { useContext } from '@declaro/core'
import type { Context } from '@declaro/core'
import type { ITransactionScope } from '../../../types/transaction-context'
import type { ITransactionAdapter } from '../../../domain/transaction/transaction-adapter-interface'

/**
 * Gets the transaction bound to the current ambient context.
 *
 * Must be called inside a `withContext` callback (for example, one set up by
 * {@link wrapWithTransaction}).
 *
 * @returns The active {@link ITransactionAdapter} from the context's scope.
 * @throws {Error} If called outside of a Declaro context.
 */
export async function useTransaction() {
    const context = useContext<Context<ITransactionScope>>()

    if (!context) {
        throw new Error('No context available')
    }

    const transaction = await context.resolve('transaction')

    if (!transaction) {
        throw new Error(`No transaction adapter was found in the current context. Don't forget to register one`)
    }

    return transaction
}
