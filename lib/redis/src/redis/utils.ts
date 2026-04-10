/**
 * Serialize a payload into a JSON string
 * @param message A payload to serialize
 * @returns A JSON serialized string
 */
export function serialize<T = string>(message: T) {
    return JSON.stringify(message)
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
