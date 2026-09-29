import { Transaction } from './transaction'

/**
 * Wraps `fn` so every call runs in its own transaction, as if its body were passed to `Transaction.run()`.
 *
 * Use it to put route handlers, or a whole request pipeline, inside a transaction. Call the wrapped function inside
 * the request's `withContext` block so the transaction picks up the request's context. A call made while another
 * transaction is current nests inside it.
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
    return (...args: TArgs) => Transaction.run(() => fn(...args))
}
