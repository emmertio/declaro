import type { PromiseOrValue } from '../typescript'
import {
    hasSavepointSupport,
    TransactionPropagation,
    type BeginTransactionOptions,
    type TransactionAdapter,
    type TransactionOptions,
} from './transaction-adapter'
import { InactiveTransactionError, NoActiveTransactionError, TransactionRollbackError } from './transaction-errors'
import {
    forkTransactionStore,
    getOrCreateTransactionSession,
    getOrCreateTransactionStore,
    getTransactionSession,
    refreshCurrentTransactionManager,
    runWithTransactionStore,
    type TransactionSession,
} from './transaction-session'
import { TransactionKind, TransactionScope, TransactionStatus } from './transaction-scope'

/**
 * Where an error surfaced while the framework was settling a transaction.
 */
export interface TransactionErrorInfo {
    /** The operation that threw. */
    phase: 'commit-hook' | 'rollback-hook' | 'complete-hook' | 'rollback'
    /** The scope being settled. */
    scope: TransactionScope
}

/**
 * Handler for errors the framework cannot surface to the caller, such as a
 * lifecycle hook throwing after a successful commit.
 */
export type TransactionErrorReporter = (error: unknown, info: TransactionErrorInfo) => void

/**
 * Options controlling how a {@link TransactionManager} behaves.
 */
export interface TransactionManagerOptions {
    /** Propagation used when none is given per transaction. Defaults to {@link TransactionPropagation.NESTED}. */
    defaultPropagation?: TransactionPropagation
    /** Handler for errors that cannot be surfaced to the caller. Defaults to logging. */
    onError?: TransactionErrorReporter
}

/**
 * Runs transactions against a single {@link TransactionAdapter}, tracking the
 * active transaction per async branch so nested calls compose correctly.
 *
 * Most applications create one manager per data source and either register it
 * as the default (`setDefaultTransactionManager`) or resolve it from the
 * context, then use the ambient `transaction` API.
 *
 * @example
 * ```ts
 * const manager = new TransactionManager(myOrmAdapter)
 *
 * await manager.run(async (tx) => {
 *     await orm.save(tx.handle, order)
 * }) // committed, or rolled back if the callback throws
 * ```
 */
export class TransactionManager<THandle = any> {
    readonly #adapter: TransactionAdapter<THandle>
    readonly #defaultPropagation: TransactionPropagation
    readonly #onError: TransactionErrorReporter
    #savepointCounter = 0

    constructor(adapter: TransactionAdapter<THandle>, options: TransactionManagerOptions = {}) {
        this.#adapter = adapter
        this.#defaultPropagation = options.defaultPropagation ?? TransactionPropagation.NESTED
        this.#onError =
            options.onError ??
            ((error, info) => {
                console.error(`[declaro] Transaction ${info.phase} failed for ${info.scope.id}.`, error)
            })
    }

    /** The adapter this manager runs transactions against. */
    get adapter(): TransactionAdapter<THandle> {
        return this.#adapter
    }

    /** Propagation applied when a transaction does not specify one. */
    get defaultPropagation(): TransactionPropagation {
        return this.#defaultPropagation
    }

    /**
     * Run `fn` inside a transaction, committing when it resolves and rolling
     * back when it throws.
     *
     * Calls made while another transaction of this manager is active nest
     * according to the resolved {@link TransactionPropagation}.
     *
     * @param fn - Callback receiving the transaction scope.
     * @param options - Propagation, isolation level and adapter-specific options.
     * @returns Whatever `fn` returns.
     */
    async run<T>(
        fn: (scope: TransactionScope<THandle>) => PromiseOrValue<T>,
        options?: TransactionOptions,
    ): Promise<T> {
        const parentSession = getTransactionSession(this)
        const session: TransactionSession = {
            manager: this,
            stack: parentSession ? [...parentSession.stack] : [],
        }
        const store = forkTransactionStore(this, session)

        return runWithTransactionStore(store, async () => {
            const scope = await this.#begin(session, options)
            session.stack.push(scope)

            let result: T
            try {
                result = await this.#invoke(scope, fn)
            } catch (error) {
                await this.#unwindTo(session, scope)
                if (scope.isActive) {
                    await this.#rollbackSafely(session, scope, error)
                }
                throw error
            }

            await this.#unwindTo(session, scope)

            // The callback may have committed or rolled the transaction back
            // itself through the manual API.
            if (!scope.isActive) {
                return result
            }

            if (scope.isRollbackOnly) {
                await this.#rollbackSafely(session, scope)
                throw new TransactionRollbackError(
                    `Transaction ${scope.id} was marked rollback-only and could not be committed.`,
                )
            }

            await this.commitScope(session, scope)

            return result
        })
    }

    /**
     * Start a transaction without a callback. The caller is responsible for
     * calling {@link TransactionManager.commit} or
     * {@link TransactionManager.rollback}.
     *
     * @param options - Propagation, isolation level and adapter-specific options.
     * @returns The scope that was started.
     */
    async start(options?: TransactionOptions): Promise<TransactionScope<THandle>> {
        const session = getOrCreateTransactionSession(this)
        const scope = await this.#begin(session, options)
        session.stack.push(scope)
        getOrCreateTransactionStore().current = this

        return scope
    }

    /**
     * Commit the innermost transaction this manager is running in the current
     * async branch.
     *
     * @throws {NoActiveTransactionError} When no transaction is active.
     * @throws {TransactionRollbackError} When the transaction was marked rollback-only.
     */
    async commit(): Promise<void> {
        const { session, scope } = this.#requireCurrent('commit')

        if (scope.isRollbackOnly) {
            await this.#rollbackSafely(session, scope)
            throw new TransactionRollbackError(
                `Transaction ${scope.id} was marked rollback-only and could not be committed.`,
            )
        }

        await this.commitScope(session, scope)
    }

    /**
     * Roll back the innermost transaction this manager is running in the
     * current async branch.
     *
     * @param error - Optional error handed to rollback hooks.
     * @throws {NoActiveTransactionError} When no transaction is active.
     */
    async rollback(error?: unknown): Promise<void> {
        const { session, scope } = this.#requireCurrent('rollback')
        await this.rollbackScope(session, scope, error)
    }

    /**
     * Get the innermost transaction this manager is running in the current
     * async branch.
     *
     * @returns The active scope, or `null` when no transaction is active.
     */
    current(): TransactionScope<THandle> | null {
        const session = getTransactionSession(this)
        const scope = session?.stack[session.stack.length - 1]

        return (scope as TransactionScope<THandle> | undefined) ?? null
    }

    /**
     * Whether this manager has an active transaction in the current async branch.
     *
     * @returns `true` when a transaction is active.
     */
    isActive(): boolean {
        return this.current() !== null
    }

    /**
     * Commit a specific scope, releasing its savepoint when it is nested.
     *
     * @internal Used by the manager and its request/test helpers.
     */
    async commitScope(session: TransactionSession, scope: TransactionScope<THandle>): Promise<void> {
        this.#assertActive(scope, 'commit')

        try {
            if (scope.kind === TransactionKind.ROOT) {
                await this.#adapter.commit(scope.handle)
            } else if (scope.kind === TransactionKind.SAVEPOINT) {
                await this.#adapter.releaseSavepoint!(scope.handle, scope.savepointName!)
            }
        } catch (error) {
            this.#pop(session, scope)
            await scope.settle(TransactionStatus.FAILED, error)
            throw error
        }

        this.#pop(session, scope)
        await scope.settle(TransactionStatus.COMMITTED)
    }

    /**
     * Roll back a specific scope, rolling back to its savepoint when it is
     * nested, or marking the shared transaction rollback-only when it joined.
     *
     * @internal Used by the manager and its request/test helpers.
     */
    async rollbackScope(session: TransactionSession, scope: TransactionScope<THandle>, error?: unknown): Promise<void> {
        this.#assertActive(scope, 'rollback')

        try {
            if (scope.kind === TransactionKind.ROOT) {
                await this.#adapter.rollback(scope.handle)
            } else if (scope.kind === TransactionKind.SAVEPOINT) {
                await this.#adapter.rollbackToSavepoint!(scope.handle, scope.savepointName!)
            } else {
                scope.setRollbackOnly()
            }
        } catch (rollbackError) {
            this.#pop(session, scope)
            await scope.settle(TransactionStatus.FAILED, rollbackError)
            throw rollbackError
        }

        this.#pop(session, scope)
        await scope.settle(TransactionStatus.ROLLED_BACK, error)
    }

    async #begin(session: TransactionSession, options?: TransactionOptions): Promise<TransactionScope<THandle>> {
        const parent = (session.stack[session.stack.length - 1] as TransactionScope<THandle> | undefined) ?? null
        const propagation = options?.propagation ?? this.#defaultPropagation
        const onHookError = (
            error: unknown,
            info: { phase: 'commit' | 'rollback' | 'complete'; scope: TransactionScope },
        ) => this.#onError(error, { phase: `${info.phase}-hook`, scope: info.scope })

        if (!parent || propagation === TransactionPropagation.REQUIRES_NEW) {
            const beginOptions: BeginTransactionOptions = {
                isolationLevel: options?.isolationLevel,
                isReadOnly: options?.isReadOnly,
                meta: options?.meta,
            }
            const handle = await this.#adapter.begin(beginOptions)

            return new TransactionScope<THandle>({
                adapter: this.#adapter,
                handle,
                kind: TransactionKind.ROOT,
                parent: null,
                onHookError,
            })
        }

        if (propagation === TransactionPropagation.NESTED && hasSavepointSupport(this.#adapter)) {
            const savepointName = `declaro_sp_${++this.#savepointCounter}`
            await this.#adapter.createSavepoint!(parent.handle, savepointName)

            return new TransactionScope<THandle>({
                adapter: this.#adapter,
                handle: parent.handle,
                kind: TransactionKind.SAVEPOINT,
                parent,
                savepointName,
                onHookError,
            })
        }

        return new TransactionScope<THandle>({
            adapter: this.#adapter,
            handle: parent.handle,
            kind: TransactionKind.JOINED,
            parent,
            onHookError,
        })
    }

    async #invoke<T>(
        scope: TransactionScope<THandle>,
        fn: (scope: TransactionScope<THandle>) => PromiseOrValue<T>,
    ): Promise<T> {
        if (typeof this.#adapter.run === 'function') {
            return await this.#adapter.run<PromiseOrValue<T>>(scope.handle, () => fn(scope))
        }

        return await fn(scope)
    }

    /**
     * Roll back everything the callback started manually and left open, so the
     * stack is back to `scope` before it settles.
     */
    async #unwindTo(session: TransactionSession, scope: TransactionScope<THandle>): Promise<void> {
        const index = session.stack.indexOf(scope)
        if (index === -1) return

        while (session.stack.length > index + 1) {
            const dangling = session.stack[session.stack.length - 1] as TransactionScope<THandle>
            if (!dangling.isActive) {
                session.stack.pop()
                continue
            }
            await this.#rollbackSafely(session, dangling)
        }
    }

    /**
     * Roll back while unwinding from an error. A failing rollback must not
     * replace the error that caused it, so it is reported instead of thrown.
     */
    async #rollbackSafely(
        session: TransactionSession,
        scope: TransactionScope<THandle>,
        error?: unknown,
    ): Promise<void> {
        try {
            await this.rollbackScope(session, scope, error)
        } catch (rollbackError) {
            this.#onError(rollbackError, { phase: 'rollback', scope })
        }
    }

    #requireCurrent(operation: string): { session: TransactionSession; scope: TransactionScope<THandle> } {
        const session = getTransactionSession(this)
        const scope = session?.stack[session.stack.length - 1] as TransactionScope<THandle> | undefined

        if (!session || !scope) {
            throw new NoActiveTransactionError(
                `Cannot ${operation} because no transaction is active. Start one with transaction.start() first.`,
            )
        }

        return { session, scope }
    }

    #assertActive(scope: TransactionScope<THandle>, operation: string): void {
        if (!scope.isActive) {
            throw new InactiveTransactionError(
                `Cannot ${operation} transaction ${scope.id} because it already settled with status ${scope.status}.`,
            )
        }
    }

    #pop(session: TransactionSession, scope: TransactionScope<THandle>): void {
        const index = session.stack.indexOf(scope)
        if (index === -1) return

        session.stack.splice(index)
        refreshCurrentTransactionManager()
    }
}
