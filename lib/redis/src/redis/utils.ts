import { unwrapDeep } from '@declaro/core'

/**
 * Serialize a payload into a JSON string for storage.
 *
 * Values wrapped by a model are unwrapped first, because a wrapped value serializes without its
 * private fields. Writing that stripped form would lose those fields permanently, so anything
 * being persisted is stored complete.
 *
 * Transport paths such as `publish` and `enqueue` deliberately do not use this, so payloads
 * leaving the process keep their private fields hidden.
 *
 * @param message A payload to serialize
 * @returns A JSON serialized string
 */
export function serialize<T = string>(message: T) {
    return JSON.stringify(unwrapDeep(message))
}

/**
 * Extract a payload from a serialized string.
 * @param message A JSON string to unserialize
 * @returns
 */
export function unserialize<T = string>(message?: string | null): T | null | undefined {
    if (!message) {
        return null as any
    }
    return JSON.parse(message)
}

export type MessageHandler<T = string> = (message?: T) => any
