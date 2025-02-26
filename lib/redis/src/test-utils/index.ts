import { Context } from '@declaro/core'
import Redis from 'ioredis-mock'
import { REDIS_CLIENT_KEY, REDIS_OPTIONS_KEY, REDIS_PUB_KEY, REDIS_SUB_KEY } from '../redis'

// TODO: move this to core
export const mockRedisMiddleware = () => async (context: Context) => {
    const pub = new Redis()
    const sub = new Redis()
    const redis = new Redis()

    context.provide(REDIS_CLIENT_KEY, redis)
    context.provide(REDIS_PUB_KEY, pub)
    context.provide(REDIS_SUB_KEY, sub)
    context.provide(REDIS_OPTIONS_KEY, undefined)
}
