export interface IEvent {
    type: string
}

export type Listener<E extends IEvent> = (event: E) => any

export class EventManager<E extends IEvent = IEvent> {
    protected readonly listeners: {
        [key: string]: Listener<E>[]
    } = {}

    getListeners(event: string) {
        const eventListeners = this.getListenerArray(event)
        const globalListeners = this.listeners['*'] || []

        return [...new Set([...eventListeners, ...globalListeners])]
    }

    getEvents() {
        return Object.keys(this.listeners)
    }

    on(event: string | string[], listener: Listener<E>) {
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

    async emitAsync(event: E) {
        await this.getListeners(event.type)
            .reduce(async (promise, listener) => {
                await promise
                return await listener(event)
            }, Promise.resolve())
            .catch((e) => {
                console.error('Error in event listener', e)
            })
    }

    async emitAll(event: E) {
        await Promise.all(this.getListeners(event.type).map((listener) => listener(event)))
    }

    emit(event: E) {
        this.getListeners(event.type).forEach((listener) => listener(event))
    }

    protected getListenerArray(event: string) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }

        return this.listeners[event]
    }
}
