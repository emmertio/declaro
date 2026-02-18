/**
 * Browser polyfill for Node's AsyncLocalStorage.
 *
 * ## How it works
 *
 * Each AsyncLocalStorage instance has a unique Symbol as its "column" ID.
 * The currently active state is a single `Map<symbol, unknown>` called a
 * _frame_, where each column holds the value for one ALS instance.
 *
 * `run()` creates a new frame (a shallow copy of the parent frame with this
 * instance's value set), makes it active for the duration of `fn`, then
 * restores the previous frame in a `finally` block.
 *
 * Multiple ALS instances are fully isolated from each other within the same
 * frame: `als1.run()` only writes to its own column and does not affect any
 * other instance's column.
 *
 * ## Browser limitation
 *
 * Because browsers have no native async-context hook, the frame is propagated
 * only within the synchronous call stack of `fn`. Any code that runs after an
 * `await` boundary cannot see the frame that was active when the `await` was
 * encountered. For true async propagation in the browser, use Zone.js or the
 * forthcoming `AsyncContext` TC39 API.
 */

// A frame maps ALS instance IDs → their stored values.
// All concurrently active ALS instances share one frame object.
type Frame = Map<symbol, unknown>

let _activeFrame: Frame | undefined = undefined

export class AsyncLocalStorage<T = any> {
    // Unique identity for this ALS instance within a frame.
    readonly #id: symbol = Symbol('AsyncLocalStorage')

    getStore(): T | undefined {
        return _activeFrame?.get(this.#id) as T | undefined
    }

    run<R>(store: T, fn: (...args: any[]) => R, ...args: any[]): R {
        const prev = _activeFrame
        _activeFrame = new Map(prev)
        _activeFrame.set(this.#id, store)
        try {
            return fn(...args)
        } finally {
            _activeFrame = prev
        }
    }

    exit<R>(fn: (...args: any[]) => R, ...args: any[]): R {
        const prev = _activeFrame
        _activeFrame = new Map(prev)
        _activeFrame.delete(this.#id)
        try {
            return fn(...args)
        } finally {
            _activeFrame = prev
        }
    }

    enterWith(store: T): void {
        const frame = new Map(_activeFrame)
        frame.set(this.#id, store)
        _activeFrame = frame
    }

    disable(): void {
        const frame = new Map(_activeFrame)
        frame.delete(this.#id)
        _activeFrame = frame
    }

    static bind<F extends (...args: any[]) => any>(fn: F): F {
        return fn
    }

    static snapshot(): <R>(fn: (...args: any[]) => R, ...args: any[]) => R {
        return (fn, ...args) => fn(...args)
    }
}
