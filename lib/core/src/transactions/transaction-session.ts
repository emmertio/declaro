import { AsyncLocalStorage } from 'node:async_hooks'
import { NoActiveTransactionError } from './transaction-errors'
import type { TransactionManager } from './transaction-manager'
import type { TransactionScope } from './transaction-scope'

/**
 * The transactions a single manager is running in one async branch. The stack
 * holds the enclosing transactions, with the innermost one last.
 */
export interface TransactionSession {
    /** Manager that owns the transactions in this session. */
    readonly manager: TransactionManager<any>
    /** Enclosing transactions, innermost last. */
    stack: TransactionScope[]
}

/**
 * Everything the transaction framework tracks for one async branch: a session
 * per manager, plus the manager whose transaction is innermost.
 */
export interface TransactionStore {
    /** Sessions keyed by the manager that owns them. */
    sessions: Map<TransactionManager<any>, TransactionSession>
    /** Manager that started the innermost transaction, used to resolve the ambient API. */
    current: TransactionManager<any> | null
}

const storage = new AsyncLocalStorage<TransactionStore>()

/**
 * Fallback store used by the manual API when it runs outside any
 * `transaction(fn)` block — for example in test hooks, where each hook runs in
 * its own async context.
 */
let globalStore: TransactionStore | null = null

let defaultManager: TransactionManager<any> | null = null

/**
 * Create an empty transaction store.
 *
 * @returns A store with no sessions.
 */
export function createTransactionStore(): TransactionStore {
    return { sessions: new Map(), current: null }
}

/**
 * Resolve the store backing the current async branch, falling back to the
 * global store used outside of `transaction(fn)`.
 *
 * @returns The active store, or `null` when nothing has been started yet.
 */
export function getTransactionStore(): TransactionStore | null {
    return storage.getStore() ?? globalStore
}

/**
 * Resolve the store for the current async branch, creating the global fallback
 * store when the manual API is used outside of `transaction(fn)`.
 *
 * @returns A store that can be mutated by the manual API.
 */
export function getOrCreateTransactionStore(): TransactionStore {
    const store = getTransactionStore()
    if (store) return store

    globalStore = createTransactionStore()
    return globalStore
}

/**
 * Run `fn` with `store` bound to the current async branch.
 *
 * @param store - Store to bind.
 * @param fn - Callback to run.
 * @returns Whatever `fn` returns.
 */
export function runWithTransactionStore<T>(store: TransactionStore, fn: () => T): T {
    return storage.run(store, fn)
}

/**
 * Build a child store that isolates `session` from sibling async branches
 * while keeping every other manager's session reachable.
 *
 * @param manager - Manager the session belongs to.
 * @param session - Session to bind in the child store.
 * @returns The forked store.
 */
export function forkTransactionStore(manager: TransactionManager<any>, session: TransactionSession): TransactionStore {
    const parent = getTransactionStore()
    const sessions = new Map(parent?.sessions ?? [])
    sessions.set(manager, session)

    return { sessions, current: manager }
}

/**
 * Look up the session a manager is currently using.
 *
 * @param manager - Manager to look up.
 * @returns The session, or `undefined` when the manager has no active session.
 */
export function getTransactionSession(manager: TransactionManager<any>): TransactionSession | undefined {
    return getTransactionStore()?.sessions.get(manager)
}

/**
 * Look up a manager's session, creating one in the current store if needed.
 * Used by the manual API, which has no callback to scope a session to.
 *
 * @param manager - Manager to look up.
 * @returns An existing or freshly registered session.
 */
export function getOrCreateTransactionSession(manager: TransactionManager<any>): TransactionSession {
    const store = getOrCreateTransactionStore()
    const existing = store.sessions.get(manager)
    if (existing) return existing

    const session: TransactionSession = { manager, stack: [] }
    store.sessions.set(manager, session)
    store.current = manager

    return session
}

/**
 * Register the manager used by the ambient `transaction` API when no
 * transaction is active.
 *
 * @param manager - Manager to use by default, or `null` to clear it.
 */
export function setDefaultTransactionManager(manager: TransactionManager<any> | null): void {
    defaultManager = manager
}

/**
 * Get the manager used by the ambient `transaction` API when no transaction is
 * active.
 *
 * @returns The default manager, or `null` when none was registered.
 */
export function getDefaultTransactionManager(): TransactionManager<any> | null {
    return defaultManager
}

/**
 * Resolve the manager the ambient API should act on: an explicit manager, the
 * manager owning the innermost active transaction, or the default manager.
 *
 * @param manager - Optional explicit manager, which always wins.
 * @returns The resolved manager.
 * @throws {NoActiveTransactionError} When no manager can be resolved.
 */
export function resolveTransactionManager(manager?: TransactionManager<any>): TransactionManager<any> {
    const resolved = manager ?? getTransactionStore()?.current ?? defaultManager

    if (!resolved) {
        throw new NoActiveTransactionError(
            'No transaction manager is available. Register one with setDefaultTransactionManager() or pass one explicitly.',
        )
    }

    return resolved
}

/**
 * Point the store's `current` manager at the innermost manager that still has
 * an active transaction, so the ambient API keeps resolving a live transaction
 * after another manager's transaction settles.
 */
export function refreshCurrentTransactionManager(): void {
    const store = getTransactionStore()
    if (!store) return

    let current: TransactionManager<any> | null = null
    for (const [manager, session] of store.sessions) {
        if (session.stack.length > 0) {
            current = manager
        }
    }

    store.current = current
}

/**
 * Clear the global fallback store and the default manager. Intended for tests
 * that need a clean slate between suites.
 */
export function resetTransactionState(): void {
    globalStore = null
    defaultManager = null
}
