export type Listener = (...args: any[]) => any

export class EventManager {
    protected readonly listeners: {
        [key: string]: Listener[]
    } = {}

    getListeners(event: string) {
        this.listeners[event] = Array.isArray(this.listeners[event]) ? this.listeners[event] : []
        return this.listeners[event]
    }

    getEvents() {
        return Object.keys(this.listeners)
    }

    on(event: string | string[], listener: Listener) {
        if (Array.isArray(event)) {
            const removeListeners = event.map((e) => {
                this.getListeners(e).push(listener)
                return () => {
                    const index = this.getListeners(e).indexOf(listener)
                    if (index > -1) {
                        this.getListeners(e).splice(index, 1)
                    }
                }
            })
            return () => removeListeners.forEach((remove) => remove())
        }

        this.getListeners(event).push(listener)

        return () => {
            const index = this.getListeners(event).indexOf(listener)
            if (index > -1) {
                this.getListeners(event).splice(index, 1)
            }
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
        await Promise.all(this.getListeners(event).map((listener) => listener(...args)))
    }

    emit(event: string, ...args: any[]) {
        this.getListeners(event).forEach((listener) => listener(...args))
    }
}
