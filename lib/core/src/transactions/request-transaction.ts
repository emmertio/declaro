import type { PromiseOrValue } from '../typescript'
import { transaction, type AmbientTransactionOptions } from './transaction'
import type { TransactionScope } from './transaction-scope'

/**
 * Internal signal used to roll a transaction back while still returning the
 * handler's result to the caller.
 */
class RollbackSignal<TResult> {
    constructor(readonly result: TResult) {}
}

/**
 * Options for wrapping a handler in a transaction.
 */
export interface TransactionalHandlerOptions<TResult> extends AmbientTransactionOptions {
    /**
     * Decide whether the transaction should commit based on what the handler
     * returned. Returning `false` rolls the transaction back while the result
     * is still returned to the caller — the way an HTTP handler that answers
     * `500` should discard its writes without throwing.
     */
    shouldCommit?: (result: TResult) => PromiseOrValue<boolean>
}

/**
 * Wrap a handler so every call runs inside its own transaction: the
 * transaction commits when the handler resolves and rolls back when it throws,
 * discarding everything the request wrote.
 *
 * The wrapper is transport-agnostic. Apply it to a fetch-style handler, a
 * route handler, a queue consumer, or any other entry point.
 *
 * @param handler - The handler to wrap.
 * @param options - Propagation, manager override and commit policy.
 * @returns A handler with the same signature that runs transactionally.
 *
 * @example Wrapping a fetch-style server
 * ```ts
 * const handler = withTransaction(async (request: Request) => router.handle(request), {
 *     shouldCommit: (response) => isSuccessfulResponse(response),
 * })
 *
 * Bun.serve({ fetch: handler })
 * ```
 */
export function withTransaction<TArgs extends any[], TResult>(
    handler: (...args: TArgs) => PromiseOrValue<TResult>,
    options?: TransactionalHandlerOptions<TResult>,
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        try {
            return await transaction(async () => {
                const result = await handler(...args)

                if (options?.shouldCommit) {
                    const isCommitted = await options.shouldCommit(result)
                    if (!isCommitted) {
                        throw new RollbackSignal(result)
                    }
                }

                return result
            }, options)
        } catch (error) {
            if (error instanceof RollbackSignal) {
                return error.result as TResult
            }
            throw error
        }
    }
}

/**
 * Wrap a handler so it runs inside a transaction and receives the transaction
 * scope as its first argument.
 *
 * @param handler - The handler to wrap, taking the scope first.
 * @param options - Propagation, manager override and commit policy.
 * @returns A handler with the remaining arguments that runs transactionally.
 *
 * @example
 * ```ts
 * const handler = withTransactionScope(async (scope, request: Request) => {
 *     return router.handle(request, scope.handle)
 * })
 * ```
 */
export function withTransactionScope<TArgs extends any[], TResult>(
    handler: (scope: TransactionScope, ...args: TArgs) => PromiseOrValue<TResult>,
    options?: TransactionalHandlerOptions<TResult>,
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        try {
            return await transaction(async (scope) => {
                const result = await handler(scope, ...args)

                if (options?.shouldCommit) {
                    const isCommitted = await options.shouldCommit(result)
                    if (!isCommitted) {
                        throw new RollbackSignal(result)
                    }
                }

                return result
            }, options)
        } catch (error) {
            if (error instanceof RollbackSignal) {
                return error.result as TResult
            }
            throw error
        }
    }
}

/**
 * Commit policy for HTTP style results: commit for any status below 400.
 *
 * @param result - Anything carrying a numeric `status` or `statusCode`.
 * @returns `true` when the response represents success.
 */
export function isSuccessfulResponse(result: unknown): boolean {
    const status = (result as { status?: unknown; statusCode?: unknown } | null | undefined)?.status

    const statusCode =
        typeof status === 'number' ? status : (result as { statusCode?: unknown } | null | undefined)?.statusCode

    if (typeof statusCode !== 'number') return true

    return statusCode < 400
}
