import { useContext, type Context } from '@declaro/core'
import {
    TransactionStatus,
    type ITransactionAdapter,
    type TransactionCallback,
} from '../../domain/transaction/transaction-adapter-interface'
import type { ITransactionScope } from '../../types/transaction-context'
import { TransactionRunner } from './transaction-runner'

const runner = new TransactionRunner()

/**
 * Options for {@link withTransaction}.
 */
export interface WithTransactionOptions {
    /** The context to run in. Defaults to the ambient context. */
    context?: Context
}

/**
 * Runs `callback` in a transaction, committing on success and rolling back if it throws.
 *
 * Which transaction depends on the context's current one:
 *
 * - **Active**: `callback` runs in a transaction nested inside it.
 * - **Pending**, like a request's transaction before anything begins it: that transaction is begun and used.
 * - **None, or already finished**: a new top-level transaction is created with the context's `createTransaction`.
 *
 * @param callback - The work to run. `useTransaction()` resolves to the transaction it runs in.
 * @param options - Optional overrides.
 * @returns Whatever `callback` returns.
 * @throws {Error} If there is no context, or a new transaction is needed and no `createTransaction` is registered.
 *
 * @example
 * ```ts
 * const order = await withTransaction(async () => {
 *     const order = await orderService.create(input)
 *     await inventoryService.reserve(order.items) // rolls back the order too if this throws
 *     return order
 * })
 * ```
 */
export async function withTransaction<TResult, TTransaction extends ITransactionAdapter = ITransactionAdapter>(
    callback: TransactionCallback<TResult, TTransaction>,
    options?: WithTransactionOptions,
): Promise<TResult> {
    const context: Context<ITransactionScope> | null = options?.context ?? useContext()

    if (!context) {
        throw new Error('withTransaction() was called outside of an active context. Wrap your code with withContext().')
    }

    const current = await context.resolve('transaction')

    if (current?.status === TransactionStatus.Active || current?.status === TransactionStatus.Pending) {
        return await runner.run(current as TTransaction, callback, context)
    }

    const createTransaction = context.resolve('createTransaction')

    if (!createTransaction) {
        throw new Error(
            'No transaction factory was found in the current context. Register one with transactionModule().',
        )
    }

    const transaction = await createTransaction(context)

    return await runner.run(transaction as TTransaction, callback, context)
}

/**
 * Wraps `fn` so every call runs in a transaction, as if its body were passed to {@link withTransaction}.
 *
 * Use it to put route handlers, or a whole request pipeline, inside a transaction. Apply it inside the request's
 * `withContext` block so the transaction picks up the request's context.
 *
 * @param fn - The function to wrap.
 * @returns A function with the same parameters that returns a promise of `fn`'s result.
 *
 * @example
 * ```ts
 * const createOrder = wrapWithTransaction(async (input: OrderInput) => orderService.create(input))
 *
 * await withContext(requestContext, () => createOrder(input))
 * ```
 */
export function wrapWithTransaction<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => withTransaction(() => fn(...args))
}
