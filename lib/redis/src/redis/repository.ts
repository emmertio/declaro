import { Redis } from 'ioredis'
import { serialize, unserialize } from './utils'

export enum RedisRepositoryEvent {
    SET = 'SET',
    GET = 'GET',
}

export type RepositoryEventHandler<T> = (event: RedisRepositoryEvent, id: string, item: T) => any

export class RedisRepository<T> {
    private readonly handlers = {
        [RedisRepositoryEvent.GET]: [] as RepositoryEventHandler<T>[],
        [RedisRepositoryEvent.SET]: [] as RepositoryEventHandler<T>[],
    }

    constructor(protected readonly redis: Redis) {}

    async set(id: string, item: T): Promise<'OK'> {
        const payload = serialize(item)

        const result = await this.redis.set(id, payload)

        await Promise.all(this.handlers.SET.map((handler) => handler(RedisRepositoryEvent.SET, id, item)))

        return result
    }

    async get(id: string): Promise<T> {
        const payload = await this.redis.get(id)

        const item = unserialize<T>(payload)

        await Promise.all(this.handlers.GET.map((handler) => handler(RedisRepositoryEvent.GET, id, item)))

        return item
    }

    on(event: RedisRepositoryEvent, handler: RepositoryEventHandler<T>) {
        this.handlers[event].push(handler)

        return () => {
            this.handlers[event] = this.handlers[event].filter((item) => item != handler)
        }
    }

    onSet(handler: RepositoryEventHandler<T>) {
        return this.on(RedisRepositoryEvent.SET, handler)
    }

    onGet(handler: RepositoryEventHandler<T>) {
        return this.on(RedisRepositoryEvent.GET, handler)
    }
}
