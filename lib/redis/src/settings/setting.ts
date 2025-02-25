import { Context } from '@declaro/core'
import merge from 'deepmerge'
import { useRedis } from '../redis'

export const SETTINGS_KEY = 'DeclaroSettings'
export const SETTINGS_NAMESPACES = 'DeclaroSettingsNamespaces'

export class Config<T = any> {
    constructor(public readonly namespace: string, public readonly defaultValue?: T) {}

    private get namespaceKey() {
        return `${SETTINGS_KEY}:${this.namespace}`
    }

    async get(context: Context) {
        const redis = useRedis(context)

        const body = await redis.get(this.namespaceKey)

        if (!body) {
            return this.defaultValue
        }
        return JSON.parse(body) as T
    }

    async set(context: Context, value: Partial<T>) {
        const redis = useRedis(context)

        const existingValues = await this.get(context)
        const merged = merge.all([this.defaultValue, existingValues, value])
        const body = JSON.stringify(merged)
        await redis.set(this.namespaceKey, body)
    }
}

export class ConfigSet<T extends object> {
    constructor(public readonly namespace: string, public readonly defaultValues: T) {}

    private get namespaceKey() {
        return `${SETTINGS_KEY}:${this.namespace}`
    }

    async set(context: Context, key: string, values: Partial<T> = {}) {
        const redis = useRedis(context)

        const existingValues = await this.get(context, key)
        const mergedValues = merge.all([this.defaultValues, existingValues ?? {}, values])

        const serializedValues = JSON.stringify(mergedValues)

        await redis.hset(this.namespaceKey, {
            [key]: serializedValues,
        })
    }

    async getAll(context: Context) {
        const redis = useRedis(context)

        const results = await redis.hgetall(this.namespaceKey)
        const settings = Object.keys(results).reduce((map, key) => {
            const serialized = results[key]
            const value = serialized ? JSON.parse(serialized) : this.defaultValues

            return {
                ...map,
                [key]: value,
            }
        }, {} as { [key: string]: T })

        return settings
    }

    async get(context: Context, key: string): Promise<T> {
        const redis = useRedis(context)

        const body = await redis.hget(this.namespaceKey, key)

        if (!body) {
            return this.defaultValues
        }
        return JSON.parse(body) as T
    }
}
