import { Context } from '@declaro/core'
import { createRedis, useRedis } from './redis-middleware'
import { type MessageHandler, unserialize } from './utils'

/**
 * Push a message to a queue to be resolved by only one client.
 * NOTE: This uses LPUSH under the hood, not PUBLISH. For PUBLISH functionality, use `sendMessage`
 *
 * @param context
 * @param channel The channel to send the message on
 * @param payload The payload to send
 * @returns
 */
export async function pushMessage<T = string>(context: Context, channel: string | string[], payload: T) {
    const conn = useRedis(context)
    const channels = Array.isArray(channel) ? channel : [channel]

    const message = JSON.stringify(payload)

    return await Promise.all(channels.map((channel) => conn.lpush(channel, message)))
}

/**
 * Fulfills messages pushed to a list (LPUSH), and pops them from the list to ensure they are only processed once.
 * NOTE: If the handler fails, the message will be pushed back to the queue and an error message will be logged.
 *
 * @param context
 * @param channel The channel to receive messages on
 */
export async function onFulfillMessage<T>(context: Context, channel: string, handler: MessageHandler<T>) {
    const conn = createRedis(context)

    let shouldContinue = true

    while (shouldContinue) {
        const [msgChannel, message] = await conn.brpop(channel, 1000)

        try {
            const payload = unserialize<T>(message)
            await handler(payload)
        } catch (e) {
            pushMessage(context, channel, message)
        }
    }

    return () => (shouldContinue = false)
}
