export type Listener = (...args: any[]) => any

export class EventManager<T> {
    protected readonly listeners: {
        [key: string]: Listener[]
    } = {}

    getListeners(event: string) {
        this.listeners[event] = Array.isArray(this.listeners[event])
            ? this.listeners[event]
            : []
        return this.listeners[event]
    }

    on(event: string, listener: Listener) {
        this.getListeners(event).push(listener)

        return () => {
            const index = this.getListeners(event).indexOf(listener)
            const willRemove = index > -1

            if (willRemove) {
                this.getListeners(event).splice(index, 1)
            }

            return willRemove
        }
    }

    async emitAsync(event: string, ...args: any[]) {
        await this.getListeners(event)
            .reduce(async (promise, listener) => {
                await promise
                return await listener(...args)
            }, Promise.resolve())
            .catch((e) => {
                console.error('Error in event listener', e)
            })
    }

    async emitAll(event: string, ...args: any[]) {
        await Promise.all(
            this.getListeners(event).map((listener) => listener(...args)),
        )
    }

    emit(event: string, ...args: any[]) {
        this.getListeners(event).forEach((listener) => listener(...args))
    }
}
