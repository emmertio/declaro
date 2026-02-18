import { AsyncLocalStorage } from 'async_hooks'
import type { Context } from './context'

const storage = new AsyncLocalStorage<Context>()

/**
 * Run `fn` with `context` bound as the active async context.
 * Inside `fn` (and any async work it triggers), `useContext()` will return this context.
 */
export function withContext<T>(context: Context, fn: () => T): T {
    return storage.run(context, fn)
}

export interface UseContextOptions {
    strict?: boolean
}

export function useContext(options?: { strict?: false }): Context | null
export function useContext(options: { strict: true }): Context
export function useContext(options?: UseContextOptions): Context | null {
    const context = storage.getStore() ?? null
    if (!context && options?.strict) {
        throw new Error(
            'useContext() was called outside of an active context. Wrap your code with withContext().'
        )
    }
    return context
}
