export class AsyncLocalStorage<T = any> {
    #store: T | undefined

    getStore(): T | undefined {
        return this.#store
    }

    run<R>(store: T, fn: (...args: any[]) => R, ...args: any[]): R {
        const prev = this.#store
        this.#store = store
        try {
            return fn(...args)
        } finally {
            this.#store = prev
        }
    }

    exit<R>(fn: (...args: any[]) => R, ...args: any[]): R {
        const prev = this.#store
        this.#store = undefined
        try {
            return fn(...args)
        } finally {
            this.#store = prev
        }
    }

    enterWith(store: T): void {
        this.#store = store
    }

    disable(): void {
        this.#store = undefined
    }

    static bind<F extends (...args: any[]) => any>(fn: F): F {
        return fn
    }

    static snapshot(): <R>(fn: (...args: any[]) => R, ...args: any[]) => R {
        return (fn, ...args) => fn(...args)
    }
}
