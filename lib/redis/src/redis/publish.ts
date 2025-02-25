import { Context } from '@declaro/core'
import { createRedis, useRedis } from './redis-middleware'
import { type MessageHandler } from './utils'
/**
 * Send a message to a channel in Redis
 *
 * @param context Application context from which to inject dependencies
 * @param channel The channel on which to publish the event
 * @param message The payload to send (could be a string or JSON-serialized object)
 * @returns The number of subscribers that received the message
 */
export async function sendMessage<T = string>(context: Context, channel: string, message: T): Promise<number> {
    const payload = JSON.stringify(message)
    const conn = useRedis(context)

    const result = await conn.publish(channel, payload)

    return result
}

/**
 * Subscribe to messages on a channel
 * NOTE: Creates a dedicated Redis connection
 *
 * @param context
 * @param channel The channel to subscribe to
 * @param messageHandler A function to run whenever messages are received
 * @returns A dedicated connection to handle the subscription on. NOTE: Close this connection to unsubscribe.
 */
export function onMessage<T = string>(context: Context, channel: string | string[], messageHandler: MessageHandler<T>) {
    const conn = createRedis(context)
    const channels = Array.isArray(channel) ? channel : [channel]

    conn.psubscribe(...channels)

    conn.on('pmessage', (pattern, msgChannel, message) => {
        const payload: T = JSON.parse(message)

        messageHandler(payload)
    })

    return conn
}
