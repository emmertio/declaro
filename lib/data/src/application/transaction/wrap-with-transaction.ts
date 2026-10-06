import type { ITransaction } from '../../domain/transaction/transaction-interface'
import { Transaction } from './transaction'

/**
 * Options for {@link wrapWithTransaction}.
 */
export interface WrapWithTransactionOptions {
    /**
     * The transaction every call nests in. By default each call nests in the current transaction if it is `Active` and
     * uses the same adapter, otherwise it is top-level. Pass `null` to force a top-level transaction.
     */
    parent?: ITransaction | null
}

/**
 * Wraps `fn` so every call runs in its own transaction, as if its body were passed to `Transaction.run()`.
 *
 * Use it for any async unit of work: request handlers, middleware chains, background tasks, queue consumers, cron
 * jobs. It establishes no context of its own: call the wrapped function inside `withContext(...)` on a context with a
 * transaction adapter registered (`transactionModule()`), such as the request's context in a handler, or the app
 * context in a background job. A call made while another transaction is current nests inside it.
 *
 * @param fn - The function to wrap.
 * @param options - Optional. `parent` is passed to `Transaction.run()` on every call.
 * @returns A function with the same parameters that returns a promise of `fn`'s result.
 * @throws {Error} From the wrapped function, if no transaction adapter can be found on the current context.
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
 * // A queue consumer: each message runs in the app context, in its own transaction.
 * const handleMessage = wrapWithTransaction(async (message: OrderMessage) => {
 *     await orderService.fulfil(message.orderId) // useTransaction() works in here
 * })
 *
 * queue.consume('orders', (message) => withContext(app, () => handleMessage(message)))
 * ```
 */
export function wrapWithTransaction<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult | Promise<TResult>,
    options?: WrapWithTransactionOptions,
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => Transaction.run(() => fn(...args), options)
}
