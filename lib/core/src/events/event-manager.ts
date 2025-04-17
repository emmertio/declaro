export type Listener = (...args: any[]) => any

export class EventManager {
    protected readonly listeners: {
        [key: string]: Listener[]
    } = {}

    getListeners(event: string) {
        const eventListeners = this.getListenerArray(event)
        const globalListeners = this.listeners['*'] || []

        return [...new Set([...eventListeners, ...globalListeners])]
    }

    getEvents() {
        return Object.keys(this.listeners)
    }

    on(event: string | string[], listener: Listener) {
        const events = Array.isArray(event) ? event : [event]

        events.forEach((e) => {
            this.getListenerArray(e).push(listener)
        })

        return () => {
            events.forEach((e) => {
                const index = this.getListeners(e).indexOf(listener)
                if (index > -1) {
                    this.getListenerArray(e).splice(index, 1)
                }
            })
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

    protected getListenerArray(event: string) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }

        return this.listeners[event]
    }
}
