import type { PromiseOrValue } from '../typescript'
import type { TransactionAdapter } from './transaction-adapter'

/**
 * Lifecycle status of a single transaction scope.
 */
export enum TransactionStatus {
    /** The transaction is running and can still be committed or rolled back. */
    ACTIVE = 'ACTIVE',
    /** The transaction committed successfully. */
    COMMITTED = 'COMMITTED',
    /** The transaction was rolled back. */
    ROLLED_BACK = 'ROLLED_BACK',
    /** The adapter threw while committing, so the outcome is undefined. */
    FAILED = 'FAILED',
}

/**
 * How a scope relates to the transaction that encloses it.
 */
export enum TransactionKind {
    /** An independent transaction owning its adapter handle. */
    ROOT = 'ROOT',
    /** A scope sharing the handle of the transaction that encloses it. */
    JOINED = 'JOINED',
    /** A scope backed by a savepoint inside the transaction that encloses it. */
    SAVEPOINT = 'SAVEPOINT',
}

/** Callback invoked after the outermost transaction commits. */
export type TransactionCommitHook = () => PromiseOrValue<void>

/** Callback invoked when a transaction's work is discarded. */
export type TransactionRollbackHook = (error?: unknown) => PromiseOrValue<void>

/** Callback invoked once a transaction settles, whatever the outcome. */
export type TransactionCompleteHook = (status: TransactionStatus) => PromiseOrValue<void>

/**
 * Details passed to a hook error handler when a lifecycle hook throws.
 */
export interface TransactionHookErrorInfo {
    /** The hook phase that threw. */
    phase: 'commit' | 'rollback' | 'complete'
    /** The scope the hook was registered on. */
    scope: TransactionScope
}

/** Handler invoked when a lifecycle hook throws. */
export type TransactionHookErrorHandler = (error: unknown, info: TransactionHookErrorInfo) => void

/**
 * Construction arguments for a {@link TransactionScope}. Created by the
 * {@link TransactionManager}; applications never build scopes directly.
 */
export interface TransactionScopeOptions<THandle = any> {
    /** Adapter that owns the underlying transaction. */
    adapter: TransactionAdapter<THandle>
    /** ORM-specific handle for the running transaction. */
    handle: THandle
    /** How this scope relates to its parent. */
    kind: TransactionKind
    /** Enclosing scope, when this scope shares its handle. */
    parent?: TransactionScope<THandle> | null
    /** Savepoint name, for {@link TransactionKind.SAVEPOINT} scopes. */
    savepointName?: string | null
    /** Handler invoked when a lifecycle hook throws. */
    onHookError?: TransactionHookErrorHandler
}

let scopeCounter = 0

/**
 * A single running transaction — either an independent one or a scope nested
 * inside another. Application code resolves the active scope through
 * `transaction.current()` and reads {@link TransactionScope.handle} to talk to
 * the ORM.
 *
 * Scopes also carry lifecycle hooks, which let side effects (publishing
 * events, enqueuing reports, sending notifications) be deferred until the
 * outermost transaction has actually committed.
 *
 * @example Deferring a side effect until after commit
 * ```ts
 * await transaction(async (tx) => {
 *     await repository.save(order)
 *     tx.onCommit(() => reportingQueue.publish({ type: 'order.created', id: order.id }))
 * })
 * ```
 */
export class TransactionScope<THandle = any> {
    /** Unique, human readable identifier for this scope. */
    readonly id: string
    /** Adapter that owns the underlying transaction. */
    readonly adapter: TransactionAdapter<THandle>
    /** ORM-specific handle for the running transaction. */
    readonly handle: THandle
    /** How this scope relates to its parent. */
    readonly kind: TransactionKind
    /** Enclosing scope, or `null` for an independent transaction. */
    readonly parent: TransactionScope<THandle> | null
    /** Savepoint name, or `null` when this scope is not savepoint-backed. */
    readonly savepointName: string | null

    #status: TransactionStatus = TransactionStatus.ACTIVE
    #isRollbackOnly = false
    #commitHooks: TransactionCommitHook[] = []
    #rollbackHooks: TransactionRollbackHook[] = []
    #completeHooks: TransactionCompleteHook[] = []
    #onHookError?: TransactionHookErrorHandler

    constructor(options: TransactionScopeOptions<THandle>) {
        this.id = `tx-${++scopeCounter}`
        this.adapter = options.adapter
        this.handle = options.handle
        this.kind = options.kind
        this.parent = options.parent ?? null
        this.savepointName = options.savepointName ?? null
        this.#onHookError = options.onHookError
    }

    /** Current lifecycle status. */
    get status(): TransactionStatus {
        return this.#status
    }

    /** Whether the transaction can still be committed or rolled back. */
    get isActive(): boolean {
        return this.#status === TransactionStatus.ACTIVE
    }

    /** Whether a commit on this scope will be turned into a rollback. */
    get isRollbackOnly(): boolean {
        return this.#isRollbackOnly
    }

    /** Whether this scope owns its adapter handle. */
    get isRoot(): boolean {
        return this.parent === null
    }

    /** Nesting depth, where an independent transaction has depth `0`. */
    get depth(): number {
        return this.parent ? this.parent.depth + 1 : 0
    }

    /** The outermost scope sharing this scope's handle. */
    get root(): TransactionScope<THandle> {
        return this.parent ? this.parent.root : this
    }

    /**
     * Mark the transaction so that any later commit rolls back instead.
     *
     * Joined scopes share their parent's handle, so marking one also marks
     * every scope it shares that handle with.
     */
    setRollbackOnly(): void {
        this.#isRollbackOnly = true
        if (this.kind === TransactionKind.JOINED) {
            this.parent?.setRollbackOnly()
        }
    }

    /**
     * Register a callback that runs after the outermost enclosing transaction
     * commits. Hooks registered on a nested scope move to the parent when the
     * nested scope commits, and are discarded when it rolls back.
     *
     * @param hook - Callback to run after a successful commit.
     */
    onCommit(hook: TransactionCommitHook): this {
        this.#commitHooks.push(hook)
        return this
    }

    /**
     * Register a callback that runs when this transaction's work is discarded,
     * either because it rolled back or because an enclosing transaction did.
     *
     * @param hook - Callback to run on rollback, receiving the causing error when there is one.
     */
    onRollback(hook: TransactionRollbackHook): this {
        this.#rollbackHooks.push(hook)
        return this
    }

    /**
     * Register a callback that runs once the transaction settles, whatever the
     * outcome.
     *
     * @param hook - Callback receiving the final status.
     */
    onComplete(hook: TransactionCompleteHook): this {
        this.#completeHooks.push(hook)
        return this
    }

    /**
     * Settle the scope, running or forwarding its lifecycle hooks.
     *
     * @internal Called by {@link TransactionManager}; not part of the public API.
     */
    async settle(status: TransactionStatus, error?: unknown): Promise<void> {
        this.#status = status

        const isCommitted = status === TransactionStatus.COMMITTED
        const canForward = isCommitted && this.parent !== null

        if (canForward) {
            const parent = this.parent!
            for (const hook of this.#commitHooks) parent.onCommit(hook)
            for (const hook of this.#rollbackHooks) parent.onRollback(hook)
            for (const hook of this.#completeHooks) parent.onComplete(hook)
        } else if (isCommitted) {
            await this.#runHooks('commit', this.#commitHooks, [])
        } else {
            await this.#runHooks('rollback', this.#rollbackHooks, [error])
        }

        if (!canForward) {
            await this.#runHooks('complete', this.#completeHooks, [status])
        }

        this.#commitHooks = []
        this.#rollbackHooks = []
        this.#completeHooks = []
    }

    async #runHooks(
        phase: TransactionHookErrorInfo['phase'],
        hooks: ((...args: any[]) => PromiseOrValue<void>)[],
        args: any[],
    ): Promise<void> {
        for (const hook of hooks) {
            try {
                await hook(...args)
            } catch (error) {
                this.#reportHookError(error, phase)
            }
        }
    }

    #reportHookError(error: unknown, phase: TransactionHookErrorInfo['phase']): void {
        const info: TransactionHookErrorInfo = { phase, scope: this }
        if (this.#onHookError) {
            try {
                this.#onHookError(error, info)
            } catch {
                // A failing error handler must never break transaction settling.
            }
            return
        }
        console.error(`[declaro] A transaction ${phase} hook threw an error.`, error)
    }
}
