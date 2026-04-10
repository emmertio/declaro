import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from './context'

/**
 * Minimal interface for the storage backing `withContext` / `useContext`.
 * Satisfied by Node's native `AsyncLocalStorage` and by the browser shim.
 */
export interface AsyncContextStorage<C extends Context = Context> {
    run<R>(store: C, fn: (...args: any[]) => R, ...args: any[]): R
    getStore(): C | undefined
}

export interface UseContextOptions {
    strict?: boolean
}

/**
 * Create a `withContext` / `useContext` pair backed by the given storage.
 *
 * The generic type parameter `C` fixes the context type enforced by both
 * functions, keeping the pair consistent. If no storage is provided, a new
 * `AsyncLocalStorage<C>` is created automatically — in browser builds this
 * resolves to the synchronous shim, so callers don't need to think about it.
 *
 * Pass a custom storage explicitly when you need an alternative
 * implementation (e.g. a test spy or the browser shim in a test environment):
 *
 * @example Default (auto-polyfilled in browser builds)
 * ```ts
 * const { withContext, useContext } = createContextAPI<MyContext>()
 * ```
 *
 * @example Custom storage (for testing or advanced use)
 * ```ts
 * import { AsyncLocalStorage } from '../shims/async-local-storage'
 * const { withContext, useContext } = createContextAPI<MyContext>(new AsyncLocalStorage())
 * ```
 */
export function createContextAPI<C extends Context = Context>(storage?: AsyncContextStorage<C>) {
    const _storage: AsyncContextStorage<C> = storage ?? new AsyncLocalStorage<C>()

    /**
     * Run `fn` with `context` bound as the active async context. Inside `fn`
     * (and any async work it triggers, including across `await` boundaries),
     * calls to `useContext()` will return this context.
     *
     * Nesting is fully supported: an inner `withContext` creates a child scope
     * that sees its own context; when it exits the parent scope is restored.
     *
     * Internally uses `AsyncLocalStorage` from `node:async_hooks`. In browser
     * environments, a synchronous shim is substituted at build time — context
     * propagates correctly across sequential async flows (event listeners,
     * middleware chains) but not across concurrent async tasks running in
     * parallel.
     *
     * @param context - The context to make active for the duration of `fn`.
     * @param fn - Arbitrary sync or async callback to run inside the context.
     * @returns Whatever `fn` returns.
     *
     * @example Basic usage
     * ```ts
     * await withContext(requestContext, async () => {
     *     await eventEmitter.emitAsync(event) // listeners can call useContext()
     * })
     * ```
     *
     * @example Forking the context for an event
     * ```ts
     * await withContext(requestContext, async () => {
     *     const eventContext = requestContext.extend()
     *     await withContext(eventContext, () => emitter.emitAsync(event))
     *     // useContext() here still returns requestContext
     * })
     * ```
     *
     * @example Creating a context-specific helper (recommended pattern)
     * ```ts
     * // For withContext, define a typed wrapper since TypeScript cannot partially
     * // apply the return-type parameter via an instantiation expression:
     * const withMyContext = <T>(context: MyContext, fn: () => T) =>
     *     withContext<T>(context, fn)
     * ```
     */
    function withContext<T = unknown>(context: C, fn: () => T): T {
        return _storage.run(context, fn)
    }

    /**
     * Return the `Context` currently active in async local storage, or `null`
     * if called outside any `withContext` block.
     *
     * The optional generic parameter `U` narrows the return type to a subclass
     * of `C` when you know the active context is more specific.
     *
     * Backed by `AsyncLocalStorage` on Node/Bun and a synchronous shim in
     * browser builds. See `withContext` for details on browser limitations.
     *
     * @param options.strict - When `true`, throws instead of returning `null`.
     *
     * @example
     * ```ts
     * const context = useContext()               // C | null
     * const context = useContext({ strict: true }) // C (throws if missing)
     * ```
     *
     * @example Narrowing to a subtype
     * ```ts
     * const useMyContext = useContext<MyContext>
     * ```
     */
    function useContext<U extends C = C>(options?: { strict?: false }): U | null
    function useContext<U extends C = C>(options: { strict: true }): U
    function useContext<U extends C = C>(options?: UseContextOptions): U | null {
        const context = (_storage.getStore() ?? null) as U | null
        if (!context && options?.strict) {
            throw new Error(
                'useContext() was called outside of an active context. Wrap your code with withContext().'
            )
        }
        return context
    }

    return { withContext, useContext }
}

// Module-level pair backed by the default AsyncLocalStorage.
// In browser builds the import of node:async_hooks is swapped for the
// synchronous shim at build time, so this works without any extra config.
export const { withContext, useContext } = createContextAPI<Context>()
