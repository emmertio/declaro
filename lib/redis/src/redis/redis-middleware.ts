import { Context, App } from '@declaro/core'
import Redis, { Redis as RedisInstance, type RedisOptions } from 'ioredis'
import { RedisRepository } from './repository'

export const RedisEvents = {
    Connect: 'redis:connect',
    Destroy: 'redis:destroy',
}

export const REDIS_CLIENT_KEY = Symbol()
export const REDIS_PUB_KEY = Symbol()
export const REDIS_SUB_KEY = Symbol()
export const REDIS_OPTIONS_KEY = Symbol()

export const redisMiddleware = (options?: RedisOptions) => async (context: Context) => {
    context.provide(REDIS_OPTIONS_KEY, options)

    context.on(App.Events.Init, async (context) => {
        const redis = new Redis(options)

        context.provide(REDIS_CLIENT_KEY, redis)
        await context.emit(RedisEvents.Connect, redis)
    })

    context.on(App.Events.Destroy, async (context) => {
        const redis = useRedis(context)
        await context.emit(RedisEvents.Destroy, redis)
    })

    context.on(RedisEvents.Destroy, async (context, redis: RedisInstance) => {
        await redis.quit()
    })
}

/**
 * Get the centralized redis connection
 * NOTE: Do not use this connection to subscribe to events. Create your own instead with createRedis.
 * @param context
 * @returns
 */
export function useRedis(context: Context): RedisInstance {
    const conn = context.inject<RedisInstance>(REDIS_CLIENT_KEY)

    if (!conn) {
        throw new Error('No Redis connection was found. Did you forget to provide one with `redisMiddleware`?')
    }

    return conn
}

/**
 * Get the redis options that were provided
 *
 * @param context
 * @returns The redis options that were provided in the given context
 */
export function useRedisOptions(context: Context): RedisOptions {
    const options = context.inject<RedisOptions>(REDIS_OPTIONS_KEY)

    return options
}

/**
 * Create a Redis connection
 *
 * @param context The context in which to create the Redis instance
 */
export function createRedis(context: Context): RedisInstance {
    const options = useRedisOptions(context)

    const conn = new Redis(options)

    context.on(App.Events.Destroy, async () => {
        await conn.quit()
    })

    return conn
}

export function useRedisRepository<T = string>(context: Context): RedisRepository<T> {
    const conn = useRedis(context)

    const repository = new RedisRepository<T>(conn)

    return repository
}
