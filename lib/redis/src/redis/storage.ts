import { serialize, unserialize } from './utils'
import { useRedis } from './redis-middleware'
import { Context } from '@declaro/core'

export async function set<T>(context: Context, id: string, item: T) {
    const conn = useRedis(context)

    const payload = serialize(item)

    return await conn.set(id, payload)
}

export async function get<T>(context: Context, id: string) {
    const conn = useRedis(context)

    const payload = await conn.get(id)

    const item = unserialize<T>(payload)

    return item
}
