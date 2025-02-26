import { validate, validateAny, type Validator } from '../validation'
import { EventManager } from '../events/event-manager'
import { ContextConsumer } from './context-consumer'
import { merge } from '../dataflow'
import type { Class, PromiseOrValue, UnwrapPromise } from '../typescript'

export type AppScope = {}
export type RequestScope = {}
export type AppContext = Context<AppScope>
export type RequestContext = Context<RequestScope>

export type ContextMiddleware = (context: Context) => any | Promise<any>
export type ContextState<TContext extends Context> = Record<PropertyKey, ContextAttribute<TContext, StateValue<any>>>

export type ContextResolver<T> = (context: Context) => StateValue<T>

export type StateValue<T> = T

export enum DependencyType {
    VALUE = 'VALUE',
    FACTORY = 'FACTORY',
    CLASS = 'CLASS',
}

export type FactoryFn<T, A extends any[]> = (...args: A) => T
export type ValueLoader<C extends Context, T> = (context: C) => T
export type FilterKeysByType<TScope, TValue> = {
    [Key in keyof TScope]: TScope[Key] extends TValue ? Key : never
}[keyof TScope]
export type FilterKeysByAsyncType<TScope, TValue> = {
    [Key in keyof TScope]: TScope[Key] extends PromiseOrValue<TValue> ? Key : never
}[keyof TScope]
export type FilterArgsByType<TScope, TArgs extends any[]> = {
    [Key in keyof TArgs]: FilterKeysByType<TScope, TArgs[Key]>
}
export type FilterAsyncArgsByType<TScope, TArgs extends any[]> = {
    [Key in keyof TArgs]: FilterKeysByAsyncType<TScope, TArgs[Key]>
}

export type ContextAttribute<TContext extends Context<any>, TValue> = {
    key: PropertyKey
    value?: ValueLoader<TContext, TValue>
    type: DependencyType
    resolveOptions: ResolveOptions
    cachedValue?: TValue
}

export type ScopeKey<S extends object> = keyof S

export type ContextListener = (context: Context, ...args: any[]) => any

export type ResolveOptions = {
    strict?: boolean
    eager?: boolean
    singleton?: boolean
}

export function defaultResolveOptions(): ResolveOptions {
    return {
        strict: false,
        eager: false,
        singleton: false,
    }
}

export type ContextOptions = {
    defaultResolveOptions?: ResolveOptions
}

export class Context<Scope extends object = any> {
    private readonly state: ContextState<this> = {}
    private readonly emitter = new EventManager()

    public readonly scope: Scope = {} as Scope

    protected readonly defaultResolveOptions: ResolveOptions

    constructor(options?: ContextOptions) {
        this.defaultResolveOptions = {
            ...defaultResolveOptions(),
            ...options?.defaultResolveOptions,
        }
    }

    /**
     * Set a value in context, to be injected later.
     *
     * @param key
     * @param payload
     * @deprecated Use `provideValue` instead, or you can register the same dependency as a factory with `provideFactory` or class with `provideClass`.
     */
    provide<K extends ScopeKey<Scope>>(key: K, payload: Scope[K]) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: () => payload,
            key,
            type: DependencyType.VALUE,
            resolveOptions: {
                eager: false,
                singleton: true,
                strict: false,
            },
        }

        this.state[key] = attribute
    }

    /**
     * Manually register a dependency. This should normally be used by utils or integrations that need to register dependencies in creative ways. For normal use cases, using `provideValue`, `provideFactory`, or `provideClass` is sufficient.
     *
     * @param key The key to register the dependency under
     * @param dep The dependency record
     */
    register<K extends ScopeKey<Scope>>(key: K, dep: ContextAttribute<this, Scope[K]>) {
        this.state[key] = dep

        Object.defineProperty(this.scope, key, {
            get: () => this.resolve(key),
            enumerable: true,
            configurable: true,
        })

        if (dep?.resolveOptions?.eager) {
            this.on('declaro:init', async () => {
                await this.resolve(key)
            })
        }
    }

    /**
     * Register a value in context scope.
     *
     * @param key The key to register the dependency under
     * @param value The value to register
     */
    registerValue<K extends ScopeKey<Scope>>(key: K, value: Scope[K], defaultResolveOptions?: ResolveOptions) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: () => value,
            key,
            type: DependencyType.VALUE,
            resolveOptions: defaultResolveOptions,
        }

        this.register(key, attribute)

        return this
    }

    /**
     * Register a dependency as a factory in context scope.
     *
     * @param key The key to register the dependency under
     * @param factory A factory function that will be called to generate the value when it is requested.
     * @param inject An array of keys to use when injecting factory args.
     * @returns A chainable instance of context
     */
    registerFactory<K extends ScopeKey<Scope>, A extends any[]>(
        key: K,
        factory: FactoryFn<Scope[K], A>,
        inject?: FilterArgsByType<Scope, A>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (context) => {
                const args = inject?.map((key) => context.resolve(key)) as A

                return factory(...args)
            },
            key,
            type: DependencyType.FACTORY,
            resolveOptions: defaultResolveOptions,
        }

        this.register(key, attribute)

        return this
    }

    registerAsyncFactory<K extends FilterKeysByType<Scope, Promise<any>>, A extends any[]>(
        key: K,
        factory: FactoryFn<Scope[K], A>,
        inject?: FilterAsyncArgsByType<Scope, A>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (async (context) => {
                const args = (await Promise.all((inject?.map((key) => context.resolve(key)) as A) ?? [])) as A

                return await factory(...args)
            }) as ValueLoader<this, Scope[K]>,
            key,
            type: DependencyType.FACTORY,
            resolveOptions: defaultResolveOptions,
        }

        this.register(key, attribute)

        return this
    }

    registerClass<K extends FilterKeysByType<Scope, InstanceType<T>>, T extends Class<Scope[K]>>(
        key: K,
        Class: T,
        inject?: FilterArgsByType<Scope, ConstructorParameters<T>>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (context) => {
                const args = inject?.map((key) => context.resolve(key)) ?? []

                return new (Class as any)(...(args as any))
            },
            key,
            type: DependencyType.CLASS,
            resolveOptions: defaultResolveOptions,
        }

        this.register(key, attribute)

        return this
    }

    registerAsyncClass<K extends FilterKeysByType<Scope, InstanceType<any>>, T extends Class<UnwrapPromise<Scope[K]>>>(
        key: K,
        Class: T,
        inject?: FilterAsyncArgsByType<Scope, ConstructorParameters<T>>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (async (context) => {
                const args = (await Promise.all(
                    (inject?.map((key) => context.resolve(key)) ?? []) as ConstructorParameters<T>,
                )) as ConstructorParameters<T>

                return new (Class as any)(...(args as any))
            }) as ValueLoader<this, Scope[K]>,
            key,
            type: DependencyType.CLASS,
            resolveOptions: defaultResolveOptions,
        }

        this.register(key, attribute)

        return this
    }

    protected _resolveValue<K extends ScopeKey<Scope>>(key: K, resolveOptions?: ResolveOptions): Scope[K] {
        const attribute = this.state[key]

        const attributeResolveOptions = {
            ...this.defaultResolveOptions,
            ...attribute?.resolveOptions,
            ...resolveOptions,
        }

        if (!attribute && attributeResolveOptions.strict) {
            throw new Error(`Dependency ${key?.toString()} not found.`)
        }

        let value: Scope[K]

        const shouldCache = attributeResolveOptions.singleton || attributeResolveOptions.eager

        if (shouldCache && attribute?.cachedValue) {
            value = attribute.cachedValue
        } else {
            value = attribute?.value(this)
        }

        if (shouldCache) {
            attribute.cachedValue = value
        }

        if (attributeResolveOptions.strict && (value === undefined || value === null)) {
            throw new Error(`Strict dependency ${key?.toString()} has a ${typeof value} value.`)
        }

        return value
    }

    /**
     * Extract a value from context.
     *
     * @param key
     * @returns
     * @deprecated Use `resolve` instead
     */
    inject<T = any>(key: ScopeKey<Scope>): T | undefined {
        return this._resolveValue(key) as T
    }

    resolve<K extends ScopeKey<Scope>>(key: K): Scope[K] {
        return this._resolveValue(key)
    }

    /**
     * Ensure that only one copy of this instance exists in this context. Provides the instance if it doesn't exist yet, otherwise inject the cached instance.
     *
     * @param key
     * @param instance
     */
    singleton<T = any>(key: ScopeKey<Scope>, instance: T) {
        const existing = this.inject<T>(key)
        if (!existing) {
            this.provide(key, instance as any)
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
