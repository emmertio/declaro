import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from './context'

const storage = new AsyncLocalStorage<Context>()

/**
 * Run `fn` with `context` bound as the active async context. Inside `fn` (and
 * any async work it triggers, including across `await` boundaries), calls to
 * `useContext()` will return this context.
 *
 * Nesting is fully supported: an inner `withContext` creates a child scope that
 * sees its own context; when it exits the parent scope is restored.
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
 *     withContext<MyContext, T>(context, fn)
 * ```
 */
export function withContext<C extends Context = Context, T = unknown>(context: C, fn: () => T): T {
    return storage.run(context, fn)
}

export interface UseContextOptions {
    strict?: boolean
}

/**
 * Return the `Context` currently active in async local storage, or `null` if
 * called outside any `withContext` block.
 *
 * Provide the generic type parameter `C` to narrow the return type to your
 * custom context subclass.
 *
 * @param options.strict - When `true`, throws instead of returning `null`.
 *
 * @example
 * ```ts
 * const context = useContext()         // Context | null
 * const context = useContext({ strict: true }) // Context (throws if missing)
 * ```
 *
 * @example Creating a context-specific helper
 * ```ts
 * // TypeScript 4.7+ instantiation expressions let you bind the generic once:
 * const useMyContext = useContext<MyContext>
 *
 * // Used together:
 * const withMyContext = <T>(context: MyContext, fn: () => T) =>
 *     withContext<MyContext, T>(context, fn)
 * const useMyContext = useContext<MyContext>
 *
 * // In a middleware:
 * withMyContext(ctx, async () => {
 *     const myCtx = useMyContext() // typed as MyContext | null
 * })
 * ```
 */
export function useContext<C extends Context = Context>(options?: { strict?: false }): C | null
export function useContext<C extends Context = Context>(options: { strict: true }): C
export function useContext<C extends Context = Context>(options?: UseContextOptions): C | null {
    const context = (storage.getStore() ?? null) as C | null
    if (!context && options?.strict) {
        throw new Error(
            'useContext() was called outside of an active context. Wrap your code with withContext().'
        )
    }
    return context
}
