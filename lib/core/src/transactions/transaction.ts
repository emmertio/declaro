import type { PromiseOrValue } from '../typescript'
import type { TransactionAdapter, TransactionOptions } from './transaction-adapter'
import { NoActiveTransactionError } from './transaction-errors'
import { TransactionManager, type TransactionManagerOptions } from './transaction-manager'
import type {
    TransactionCommitHook,
    TransactionCompleteHook,
    TransactionRollbackHook,
    TransactionScope,
} from './transaction-scope'
import { resolveTransactionManager, setDefaultTransactionManager } from './transaction-session'

/**
 * Options accepted by the ambient `transaction` API, which resolves its
 * manager from the active transaction or the registered default.
 */
export interface AmbientTransactionOptions extends TransactionOptions {
    /** Manager to act on, overriding the resolved one. */
    manager?: TransactionManager<any>
}

/**
 * Options for operations that only need to resolve a manager.
 */
export interface ManagerOptions {
    /** Manager to act on, overriding the resolved one. */
    manager?: TransactionManager<any>
}

/**
 * Create a transaction manager for an ORM adapter.
 *
 * @param adapter - Adapter implementing the ORM specifics.
 * @param options - Manager behavior overrides.
 * @returns The new manager.
 */
export function createTransactionManager<THandle>(
    adapter: TransactionAdapter<THandle>,
    options?: TransactionManagerOptions,
): TransactionManager<THandle> {
    return new TransactionManager<THandle>(adapter, options)
}

/**
 * Create a transaction manager and register it as the default used by the
 * ambient `transaction` API.
 *
 * @param adapter - Adapter implementing the ORM specifics.
 * @param options - Manager behavior overrides.
 * @returns The new manager.
 *
 * @example
 * ```ts
 * configureTransactions(myOrmAdapter)
 *
 * await transaction(async () => {
 *     await service.create(input) // rolled back automatically if this throws
 * })
 * ```
 */
export function configureTransactions<THandle>(
    adapter: TransactionAdapter<THandle>,
    options?: TransactionManagerOptions,
): TransactionManager<THandle> {
    const manager = createTransactionManager(adapter, options)
    setDefaultTransactionManager(manager)

    return manager
}

async function runTransaction<T>(
    fn: (scope: TransactionScope) => PromiseOrValue<T>,
    options?: AmbientTransactionOptions,
): Promise<T> {
    return resolveTransactionManager(options?.manager).run(fn, options)
}

/**
 * Resolve the transaction currently active in this async branch.
 *
 * @param options - Manager override.
 * @returns The active scope, or `null` when no transaction is active.
 */
export function useTransaction(options?: ManagerOptions): TransactionScope | null {
    try {
        return resolveTransactionManager(options?.manager).current()
    } catch (error) {
        if (error instanceof NoActiveTransactionError) return null
        throw error
    }
}

/**
 * Resolve the ORM handle of the active transaction.
 *
 * @param options - Manager override.
 * @returns The adapter handle for the active transaction.
 * @throws {NoActiveTransactionError} When no transaction is active.
 */
export function useTransactionHandle<THandle = any>(options?: ManagerOptions): THandle {
    const scope = useTransaction(options)

    if (!scope) {
        throw new NoActiveTransactionError()
    }

    return scope.handle as THandle
}

function requireScope(options?: ManagerOptions): TransactionScope {
    const scope = useTransaction(options)

    if (!scope) {
        throw new NoActiveTransactionError()
    }

    return scope
}

/**
 * The transaction API.
 *
 * Call it with a callback for the functional API, or use its methods for the
 * manual API. Both resolve the transaction for the current async context, so
 * application code never has to pass a transaction around.
 */
export interface TransactionApi {
    /**
     * Run `fn` inside a transaction, committing on success and rolling back
     * when it throws.
     *
     * @param fn - Callback receiving the transaction scope.
     * @param options - Propagation, isolation level and manager override.
     * @returns Whatever `fn` returns.
     */
    <T>(fn: (scope: TransactionScope) => PromiseOrValue<T>, options?: AmbientTransactionOptions): Promise<T>

    /**
     * Start a transaction that must be committed or rolled back manually.
     *
     * @param options - Propagation, isolation level and manager override.
     * @returns The scope that was started.
     */
    start(options?: AmbientTransactionOptions): Promise<TransactionScope>

    /**
     * Commit the transaction active in the current async context.
     *
     * @param options - Manager override.
     */
    commit(options?: ManagerOptions): Promise<void>

    /**
     * Roll back the transaction active in the current async context.
     *
     * @param error - Optional error handed to rollback hooks.
     * @param options - Manager override.
     */
    rollback(error?: unknown, options?: ManagerOptions): Promise<void>

    /**
     * Get the transaction active in the current async context.
     *
     * @param options - Manager override.
     * @returns The active scope, or `null`.
     */
    current(options?: ManagerOptions): TransactionScope | null

    /**
     * Whether a transaction is active in the current async context.
     *
     * @param options - Manager override.
     */
    isActive(options?: ManagerOptions): boolean

    /**
     * Mark the active transaction so any later commit rolls back instead.
     *
     * @param options - Manager override.
     */
    setRollbackOnly(options?: ManagerOptions): void

    /**
     * Defer a side effect until the outermost transaction commits.
     *
     * @param hook - Callback to run after commit.
     * @param options - Manager override.
     */
    onCommit(hook: TransactionCommitHook, options?: ManagerOptions): void

    /**
     * Run a callback when the active transaction's work is discarded.
     *
     * @param hook - Callback to run on rollback.
     * @param options - Manager override.
     */
    onRollback(hook: TransactionRollbackHook, options?: ManagerOptions): void

    /**
     * Run a callback once the active transaction settles, whatever the outcome.
     *
     * @param hook - Callback receiving the final status.
     * @param options - Manager override.
     */
    onComplete(hook: TransactionCompleteHook, options?: ManagerOptions): void
}

/**
 * Ambient transaction API, resolving the manager from the active transaction
 * or the default registered with {@link configureTransactions}.
 *
 * @example Functional API
 * ```ts
 * const order = await transaction(async () => {
 *     const order = await orders.create(input)
 *     await inventory.reserve(order) // throwing here rolls back the order too
 *     return order
 * })
 * ```
 *
 * @example Manual API
 * ```ts
 * await transaction.start()
 * try {
 *     await orders.create(input)
 *     await transaction.commit()
 * } catch (error) {
 *     await transaction.rollback(error)
 *     throw error
 * }
 * ```
 */
export const transaction: TransactionApi = Object.assign(runTransaction, {
    start: (options?: AmbientTransactionOptions) => resolveTransactionManager(options?.manager).start(options),
    commit: (options?: ManagerOptions) => resolveTransactionManager(options?.manager).commit(),
    rollback: (error?: unknown, options?: ManagerOptions) =>
        resolveTransactionManager(options?.manager).rollback(error),
    current: (options?: ManagerOptions) => useTransaction(options),
    isActive: (options?: ManagerOptions) => useTransaction(options) !== null,
    setRollbackOnly: (options?: ManagerOptions) => requireScope(options).setRollbackOnly(),
    onCommit: (hook: TransactionCommitHook, options?: ManagerOptions) => {
        requireScope(options).onCommit(hook)
    },
    onRollback: (hook: TransactionRollbackHook, options?: ManagerOptions) => {
        requireScope(options).onRollback(hook)
    },
    onComplete: (hook: TransactionCompleteHook, options?: ManagerOptions) => {
        requireScope(options).onComplete(hook)
    },
}) as TransactionApi
