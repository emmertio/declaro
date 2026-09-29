import { Transaction, type TransactionOptions } from './transaction'

/**
 * Wraps `fn` so every call runs in its own transaction, as if its body were passed to `Transaction.run()`.
 *
 * Use it for any async unit of work: request handlers, middleware chains, background tasks, queue consumers, cron
 * jobs. Inside a request, call the wrapped function inside the request's `withContext` block so the transaction
 * picks up the request's context. A call made while another transaction is current nests inside it. Outside any
 * Declaro context, pass `{ adapter }` or `{ context }` so the transaction can find its adapter.
 *
 * @param fn - The function to wrap.
 * @param options - Passed to `Transaction.run()` on every call: `adapter`, `parent` and `context`.
 * @returns A function with the same parameters that returns a promise of `fn`'s result.
 *
 * @example
 * ```ts
 * // A request handler, called inside the request context.
 * const createOrder = wrapWithTransaction(async (input: OrderInput) => orderService.create(input))
 *
 * await withContext(requestContext, () => createOrder(input))
 * ```
 *
 * @example
 * ```ts
 * // A queue consumer that runs outside any Declaro context.
 * const handleMessage = wrapWithTransaction(
 *     async (message: OrderMessage) => {
 *         await orderService.fulfil(message.orderId) // useTransaction() works in here
 *     },
 *     { adapter },
 * )
 *
 * queue.consume('orders', handleMessage)
 * ```
 */
export function wrapWithTransaction<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
    options?: TransactionOptions,
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => Transaction.run(() => fn(...args), options)
}
