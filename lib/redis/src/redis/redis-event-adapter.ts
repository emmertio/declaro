import type { EventManager, IEvent } from '@declaro/core'
import type Redis from 'ioredis'

export class RedisEventAdapter {
    constructor(
        protected readonly eventManager: EventManager,
        protected readonly publisher: Redis,
        protected readonly subscriber: Redis,
    ) {
        eventManager.on('*', async (event) => {
            try {
                if ((event as any).__fromRedis) {
                    // Ignore events that are coming from Redis to avoid circular calls
                    return
                }

                const payload = JSON.stringify(event)
                await publisher.publish(event.type, payload)
            } catch (e) {
                console.error('Unserializable event:', event)
                console.error(`There was an error serializing event ${event.type}`, e)
            }
        })

        subscriber.psubscribe('*')

        subscriber.on('pmessage', this.onMessage)
    }

    protected onMessage = (pattern: string, channel: string, message: string) => {
        try {
            const event = JSON.parse(message) as IEvent
            ;(event as any).__fromRedis = true

            if (typeof event.type !== 'string') {
                throw new Error(`Event payload for ${channel} does not have a type property, and cannot be processed`)
            }

            this.eventManager.emit(event)
        } catch (e) {
            console.error('Unparsable event:', message)
            console.error(`There was an error deserializing event ${channel}`, e)
        }
    }

    unsubscribe() {
        this.publisher.unsubscribe()
        this.subscriber.unsubscribe()
    }
}
