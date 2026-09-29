import { useContext } from '@declaro/core'
import type { Context } from '@declaro/core'
import type { ITransactionAdapter } from '../../../domain/transaction/transaction-interface'
import type { ITransactionScope } from '../../../types/transaction-context'

/**
 * Gets the transaction adapter registered on the current ambient context.
 *
 * Repositories use it to reach the ORM through the adapter's own typed accessor. `Transaction` uses it when no
 * adapter is passed.
 *
 * @typeParam TAdapter - The adapter's concrete type. This is an unchecked cast: the context only knows the adapter
 *   as an {@link ITransactionAdapter}, so pass the type of the adapter your app actually registers.
 * @returns The registered adapter.
 * @throws {Error} If called outside of a Declaro context, or if no adapter is registered.
 *
 * @example
 * ```ts
 * const client = useTransactionAdapter<SqlTransactionAdapter>().client()
 * ```
 */
export function useTransactionAdapter<TAdapter extends ITransactionAdapter = ITransactionAdapter>(): TAdapter {
    const context = useContext<Context<ITransactionScope>>()

    if (!context) {
        throw new Error(
            'useTransactionAdapter() was called outside of an active context. Wrap your code with withContext().',
        )
    }

    const adapter = context.resolve('transactionAdapter')

    if (!adapter) {
        throw new Error(
            "No transaction adapter was found in the current context. Register one with transactionModule() or context.registerValue('transactionAdapter', ...).",
        )
    }

    return adapter as TAdapter
}
