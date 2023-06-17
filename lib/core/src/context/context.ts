import { validate, validateAny, Validator } from '../validation'
import { EventManager } from '../events/event-manager'
import { ContextConsumer } from './context-consumer'
import { merge } from '../dataflow'

export type ContextMiddleware = (context: Context) => any | Promise<any>
export type ContextState = Record<
    PropertyKey,
    ContextAttribute<StateValue<any>>
>

export type ContextResolver<T> = (context: Context) => StateValue<T>

export type StateValue<T> = T

export type ContextAttribute<T> = {
    key: PropertyKey
    value?: T
}

export type ContextListener = (context: Context, ...args: any[]) => any

export class Context {
    private readonly state: ContextState = {}
    private readonly emitter = new EventManager()

    /**
     * Set a value in context, to be injected later.
     *
     * @param key
     * @param payload
     */
    provide<T>(key: PropertyKey, payload: StateValue<T>) {
        let value: T | undefined = payload

        const attribute: ContextAttribute<T> = {
            value,
            key,
        }

        this.state[key as any] = attribute
    }

    /**
     * Extract a value from context.
     *
     * @param key
     * @returns
     */
    inject<T = any>(key: PropertyKey): T | undefined {
        const attribute = this.state[key as any]

        if (!attribute) {
            return undefined
        }

        return attribute.value
    }

    /**
     * Ensure that only one copy of this instance exists in this context. Provides the instance if it doesn't exist yet, otherwise inject the cached instance.
     *
     * @param key
     * @param instance
     */
    singleton<T = any>(key: PropertyKey, instance: T) {
        const existing = this.inject<T>(key)
        if (!existing) {
            this.provide(key, instance)
            return instance
        } else {
            return existing
        }
    }

    /**
     * Instantiate a ContextConsumer class
     *
     * @param Consumer
     * @returns
     */
    hydrate<T extends ContextConsumer<this, any[]>, A extends any[]>(
        Consumer: new (context: this, ...args: A) => T,
        ...args: A
    ): T {
        return new Consumer(this, ...args)
    }

    /**
     * Create a new context from other instance(s) of Context
     *
     * @param contexts
     * @returns
     */
    extend(...contexts: Context[]) {
        return contexts.reduce((workingState, context) => {
            return merge(workingState, context.state)
        }, this.state)
    }

    /**
     * Modify context with middleware
     *
     * @param middleware
     * @returns
     */
    async use(...middleware: ContextMiddleware[]) {
        return middleware.reduce(async (promise, middleware) => {
            await promise
            await middleware(this)
        }, Promise.resolve(undefined))
    }

    /**
     * Validate context ensuring all validators are valid.
     *
     * @param validators
     * @returns
     */
    validate(...validators: Validator<Context>[]) {
        return validate(this, ...validators)
    }

    /**
     * Validate context ensuring at least one validator is valid
     * @param validators
     * @returns
     */
    validateAny(...validators: Validator<Context>[]) {
        return validateAny(this, ...validators)
    }

    /**
     * Add a callback to listen for an event in this context.
     *
     * @param event
     * @param listener
     * @returns
     */
    on(event: string, listener: ContextListener) {
        return this.emitter.on(event, listener)
    }

    /**
     * Emit an event in this context
     *
     * @param event
     * @param args
     * @returns
     */
    async emit(event: string, ...args: any[]) {
        return await this.emitter.emitAsync(event, this, ...args)
    }
}
