import { type IncomingHttpHeaders } from 'http'
import { EventManager, type IEvent } from '../events/event-manager'
import type { Request } from '../http/request'
import type { AllNodeMiddleware } from '../http/request-context'
import type { Class, PromiseOrValue, UnwrapPromise } from '../typescript'
import { validate, validateAny, type Validator } from '../validation'
import { ContextConsumer } from './context-consumer'

export interface DeclaroDependencies {}

export interface DeclaroScope {
    requestMiddleware: ContextMiddleware<Context>[]
    nodeMiddleware: AllNodeMiddleware[]
}
export interface DeclaroRequestScope extends DeclaroScope {
    request: Request
    headers: IncomingHttpHeaders
    header: <K extends keyof IncomingHttpHeaders>(header: K) => IncomingHttpHeaders[K] | undefined
}

export type ExtractScope<T extends Context<any>> = T extends Context<infer S> ? S : never

/**
 * Creates a context type that narrows the scope to a subset.
 * This allows using a context with more dependencies where fewer are expected.
 */
export type NarrowContext<TContext extends Context<any>, TNarrowScope extends object> = TContext extends Context<
    infer TFullScope
>
    ? TNarrowScope extends Partial<TFullScope>
        ? Context<TNarrowScope>
        : never
    : never

export type ContextMiddleware<C extends Context = Context> = (context: Context<ExtractScope<C>>) => any | Promise<any>
export type ContextState<TContext extends Context> = Record<PropertyKey, ContextAttribute<TContext, StateValue<any>>>

export type ContextResolver<T> = (context: Context) => StateValue<T>

export type StateValue<T> = T

export enum DependencyType {
    VALUE = 'VALUE',
    FACTORY = 'FACTORY',
    CLASS = 'CLASS',
}

export type FactoryFn<T, A extends any[]> = (...args: A) => T
export type ValueLoader<C extends Context, T> = (context: C, resolutionOptions?: ResolveOptions) => T
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
    resolveOptions?: ResolveOptions
    cachedValue?: TValue
    inject: PropertyKey[]
}

export type ScopeKey<S extends object> = keyof S

export type ContextListener<C extends Context, E extends IEvent> = (context: C, event: E) => any

/**
 * Interface for circular dependency proxies that defer to a real target once resolved.
 * These proxies are created during circular dependency resolution to allow references
 * to objects that haven't been fully constructed yet.
 */
export interface ResolveProxy<T = any> {
    /**
     * Identifies this object as a circular proxy.
     * @internal
     */
    readonly __isProxy: true

    /**
     * Sets the real target object that this proxy should delegate to.
     * Called internally once the circular dependency is resolved.
     * @internal
     */
    readonly __resolve: (target: T) => void

    /** Indicates whether the proxy has been resolved to a real target. */
    readonly __isResolved: boolean

    /**
     * Returns the real target object if resolved, otherwise returns the proxy itself.
     * This allows using the proxy transparently before and after resolution.
     */
    readonly valueOf: () => T
}

export function isProxy(value: any): value is ResolveProxy {
    return value && typeof value === 'object' && value.__isProxy === true
}

export interface ResolveOptions {
    /**
     * If true, an error will be thrown if the dependency is not found. If false, undefined will be returned if the dependency is not found.
     * @default false
     */
    strict?: boolean

    /**
     * If true, the dependency will be resolved immediately when the context is initialized. This is useful for dependencies that need to perform setup work.
     * @default false
     */
    eager?: boolean

    /**
     * If true, the dependency will be a singleton, and the same instance will be returned for every request. If false, a new instance will be created each time the dependency is resolved.
     * @default false
     */
    singleton?: boolean

    /**
     * An optional resolution context that can be used to track resolution state across multiple `resolve` calls. This is primarily used internally to track circular dependencies, but can be useful for advanced use cases.
     */
    resolutionContext?: Map<PropertyKey, any>
}

export function getNestedResolveOptions(options?: ResolveOptions | InternalResolveOptions): InternalResolveOptions {
    return {
        resolutionStack: (options as InternalResolveOptions)?.resolutionStack,
        resolutionContext: options?.resolutionContext,
    }
}

export interface InternalResolveOptions extends ResolveOptions {
    resolutionStack: Set<PropertyKey>
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

    get events() {
        return this.emitter
    }

    async initializeEagerDependencies() {
        await Promise.all(
            Object.entries(this.state)
                .filter(([, attribute]) => attribute?.resolveOptions?.eager)
                .map(async ([key, attribute]) => {
                    await this.resolve(key as any)
                }),
        )
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
            inject: [],
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
        const existingDep = this.state[key]
        this.addDep(key, dep)

        // kill any cached values that were made by a previous instance of this attribute
        if (existingDep) {
            const dependents = this.getAllDependents(key)

            dependents.forEach((dependent) => {
                dependent.cachedValue = undefined
            })
        }
    }

    /**
     * Add a dependency to the context.
     */
    protected addDep<K extends ScopeKey<Scope>>(key: K, dep: ContextAttribute<this, Scope[K]>) {
        this.state[key] = dep

        Object.defineProperty(this.scope, key, {
            get: () => this.resolve(key),
            enumerable: true,
            configurable: true,
        })

        return dep
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
            inject: [],
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
            value: (context, resolveOptions) => {
                const args = (inject?.map((key) =>
                    context._resolveValue(key, getNestedResolveOptions(resolveOptions)),
                ) ?? []) as A

                return factory(...args)
            },
            key,
            type: DependencyType.FACTORY,
            resolveOptions: defaultResolveOptions,
            inject: inject ?? [],
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
            value: (async (context, resolveOptions) => {
                const args = (await Promise.all(
                    (inject?.map((key) => context.resolve(key, getNestedResolveOptions(resolveOptions))) as A) ?? [],
                )) as A

                return await factory(...args)
            }) as ValueLoader<this, Scope[K]>,
            key,
            type: DependencyType.FACTORY,
            resolveOptions: defaultResolveOptions,
            inject: inject ?? [],
        }

        this.register(key, attribute)

        return this
    }

    registerClass<
        K extends FilterKeysByType<Scope, InstanceType<T>>,
        T extends Class<Scope[K] extends {} ? Scope[K] : never>,
    >(
        key: K,
        Class: T,
        inject?: FilterArgsByType<Scope, ConstructorParameters<T>>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (context, resolveOptions) => {
                const args = inject?.map((key) => context.resolve(key, getNestedResolveOptions(resolveOptions))) ?? []

                return new (Class as any)(...(args as any))
            },
            key,
            type: DependencyType.CLASS,
            resolveOptions: defaultResolveOptions,
            inject: inject ?? [],
        }

        this.register(key, attribute)

        return this
    }

    registerAsyncClass<
        K extends FilterKeysByType<Scope, InstanceType<any>>,
        T extends Class<UnwrapPromise<Scope[K]> extends {} ? UnwrapPromise<Scope[K]> : never>,
    >(
        key: K,
        Class: T,
        inject?: FilterAsyncArgsByType<Scope, ConstructorParameters<T>>,
        defaultResolveOptions?: ResolveOptions,
    ) {
        const attribute: ContextAttribute<this, Scope[K]> = {
            value: (async (context, resolveOptions) => {
                const args = (await Promise.all(
                    (inject?.map((key) => context.resolve(key, getNestedResolveOptions(resolveOptions))) ??
                        []) as ConstructorParameters<T>,
                )) as ConstructorParameters<T>

                return new (Class as any)(...(args as any))
            }) as ValueLoader<this, Scope[K]>,
            key,
            type: DependencyType.CLASS,
            resolveOptions: defaultResolveOptions,
            inject: inject ?? [],
        }

        this.register(key, attribute)

        return this
    }

    getAllDependencies<K extends ScopeKey<Scope>>(key: K): ContextAttribute<this, any>[] {
        const attribute = this.state[key]

        if (!attribute) {
            return []
        }
        const dependencies =
            attribute.inject?.map((key) => this.state[key] ?? ({ key } as ContextAttribute<typeof this, any>)) ?? []

        attribute.inject?.forEach((key) => {
            const nestedDependencies = this.getAllDependencies(key as any)
            dependencies.push(...nestedDependencies)
        })

        return dependencies
    }

    getAllDependents<K extends ScopeKey<Scope>>(key: K, visited = new Set<any>()): ContextAttribute<this, any>[] {
        if (visited.has(key)) {
            return []
        }

        visited.add(key)

        const dependents = Object.entries(this.state)
            .filter(([_, attribute]) => attribute.inject?.includes(key))
            .map(([key, attribute]) => attribute)

        dependents.forEach((dependent) => {
            const nestedDependents = this.getAllDependents(dependent.key as any, visited)
            dependents.push(...nestedDependents)
        })

        return dependents
    }

    introspect<K extends ScopeKey<Scope>>(key: K) {
        const attribute = this.state[key]

        return attribute
    }

    protected _cacheIsValid<K extends ScopeKey<Scope>>(key: K, visited = new Set<PropertyKey>()): boolean {
        // Prevent infinite recursion in circular dependencies
        if (visited.has(key)) {
            return true
        }

        const attribute = this.state[key]

        const needsCache = attribute?.resolveOptions?.singleton || attribute?.resolveOptions?.eager

        if (!needsCache) {
            return true
        }

        const hasCachedValue = attribute?.cachedValue !== undefined && attribute?.cachedValue !== null

        if (!hasCachedValue) {
            return false
        }

        visited.add(key)
        const result = hasCachedValue && attribute.inject?.every((depKey) => this._cacheIsValid(depKey as any, visited))
        visited.delete(key)

        return result
    }

    protected createProxy<T>(): ResolveProxy<T> {
        let realTarget: any = null
        let isResolved = false

        const proxy = new Proxy({} as any, {
            get: (target, prop, receiver) => {
                if (prop === '__isProxy') {
                    return true
                }
                if (prop === '__resolve') {
                    return (newTarget: any) => {
                        realTarget = newTarget
                        isResolved = true
                        // Copy any properties that were set on the proxy to the real target
                        Object.keys(target).forEach((key) => {
                            if (!(key in newTarget)) {
                                newTarget[key] = target[key]
                            }
                        })
                    }
                }

                if (prop === '__isResolved') {
                    return isResolved
                }

                if (prop === 'valueOf') {
                    return () => realTarget ?? proxy
                }

                if (isResolved && realTarget) {
                    return Reflect.get(realTarget, prop, realTarget)
                }

                return Reflect.get(target, prop, receiver)
            },

            set: (target, prop, value, receiver) => {
                if (isResolved && realTarget) {
                    return Reflect.set(realTarget, prop, value, realTarget)
                }
                return Reflect.set(target, prop, value, receiver)
            },

            has: (target, prop) => {
                if (isResolved && realTarget) {
                    return Reflect.has(realTarget, prop)
                }
                return Reflect.has(target, prop)
            },

            ownKeys: (target) => {
                if (isResolved && realTarget) {
                    return Reflect.ownKeys(realTarget)
                }
                return Reflect.ownKeys(target)
            },

            getOwnPropertyDescriptor: (target, prop) => {
                if (isResolved && realTarget) {
                    return Reflect.getOwnPropertyDescriptor(realTarget, prop)
                }
                return Reflect.getOwnPropertyDescriptor(target, prop)
            },

            getPrototypeOf: (target) => {
                if (isResolved && realTarget) {
                    return Reflect.getPrototypeOf(realTarget)
                }
                return Reflect.getPrototypeOf(target)
            },
        })

        return proxy as ResolveProxy<T>
    }

    protected _resolveValue<K extends ScopeKey<Scope>>(key: K, resolveOptions?: InternalResolveOptions): Scope[K] {
        const attributeResolveOptions: InternalResolveOptions = {
            ...this.defaultResolveOptions,
            ...this.state[key]?.resolveOptions,
            ...resolveOptions,
            resolutionStack: resolveOptions?.resolutionStack ?? new Set<PropertyKey>(),
        }
        const isRoot = attributeResolveOptions.resolutionStack.size === 0
        attributeResolveOptions.resolutionStack.add(key)
        let resolutionContext: Map<PropertyKey, any> = new Map<PropertyKey, any>()
        if (attributeResolveOptions.resolutionContext) {
            // Import existing resolution context if provided, but define a new object to avoid mutating the original
            resolutionContext = new Map(attributeResolveOptions.resolutionContext)
        }

        // Update the resolve options to use the local copy of the resolution context
        // so that recursive calls don't mutate the original
        attributeResolveOptions.resolutionContext = resolutionContext

        const attribute = this.state[key]

        if (!attribute && attributeResolveOptions.strict) {
            throw new Error(`Dependency ${key?.toString()} not found.`)
        }

        let value: Scope[K]

        const serveFromCache = attributeResolveOptions.singleton || attributeResolveOptions.eager
        const dependenciesValid = attribute?.inject?.every((key) => this._cacheIsValid(key as any))

        // Check instance cache for resolution context (including non-singletons)
        const resolutionContextValue = resolutionContext.get(key)
        if (!isRoot && resolutionContextValue) {
            value = resolutionContextValue
        } else if (serveFromCache && attribute?.cachedValue && dependenciesValid) {
            value = attribute.cachedValue
        } else {
            const contextValue = resolutionContext.get(key)
            let proxy: ResolveProxy
            // If the context already has a proxy for this key, use it
            if (isProxy(contextValue)) {
                proxy = contextValue as ResolveProxy
            } else {
                // Create a proxy to use as a placeholder during resolution for circular dependencies
                proxy = this.createProxy()
            }

            resolutionContext.set(key, proxy)

            if (contextValue && !isProxy(contextValue)) {
                // If the context has a non-proxy value for this key, use it directly
                value = contextValue
            } else if (proxy.__isResolved) {
                // If the proxy has already been resolved, use its real target
                value = proxy.valueOf() as Scope[K]
            } else {
                // Otherwise, resolve the value normally
                value =
                    typeof attribute?.value === 'function' ? attribute.value(this, attributeResolveOptions) : undefined
            }

            if (value instanceof Promise) {
                const valueAsPromise = value as Scope[K] & Promise<unknown>
                value = valueAsPromise.then((resolvedValue) => {
                    proxy.__resolve(resolvedValue)
                    resolutionContext.set(key, resolvedValue)
                    return isProxy(resolvedValue) ? resolvedValue.valueOf() : resolvedValue
                }) as Scope[K]
            } else {
                proxy.__resolve(value)
                resolutionContext.set(key, value)
            }
        }

        if (serveFromCache) {
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

    resolve<K extends ScopeKey<Scope>>(key: K, resolveOptions?: ResolveOptions): Scope[K] {
        // Create a default resolution context for top-level calls if none provided
        const options: InternalResolveOptions = {
            resolutionContext: new Map<PropertyKey, any>(),
            resolutionStack: new Set<PropertyKey>(),
            ...resolveOptions,
        }
        return this._resolveValue(key, options)
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
    extend(...contexts: Context[]): this {
        contexts.forEach((context) => {
            Reflect.ownKeys(context.state).forEach((key) => {
                // const dep = cloneDeep(context.state[key])
                const dep = { ...context.state[key] }
                this.addDep(key as any, dep)
            })

            this.emitter.extend(context.emitter)
        })

        return this
    }

    /**
     * Modify context with middleware
     *
     * @param middleware
     * @returns
     */
    async use<TNarrowScope extends Partial<Scope>>(
        ...middleware: ContextMiddleware<Context<TNarrowScope>>[]
    ): Promise<void>
    async use(...middleware: ContextMiddleware[]): Promise<void>
    async use(...middleware: ContextMiddleware[]) {
        return middleware.reduce(async (promise, middleware) => {
            await promise
            await middleware(this)

            return undefined
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
    on<E extends IEvent = IEvent>(type: IEvent['type'], listener: ContextListener<this, E>) {
        return this.emitter.on(type, (event) => {
            return listener(this, event as E)
        })
    }

    /**
     * Emit an event in this context
     *
     * @param event
     * @param args
     * @returns
     */
    async emit(event: string | IEvent) {
        const eventObject = typeof event === 'string' ? { type: event } : event

        return await this.emitter.emitAsync(eventObject)
    }

    /**
     * Narrow the context to a subset of its scope type.
     * This is a type-only operation - it returns the same instance with a narrower type.
     *
     * @returns A context with a narrower scope type that shares the same underlying state
     */
    narrow<TNarrowScope extends Partial<Scope>>(): NarrowContext<this, TNarrowScope> {
        return this as unknown as NarrowContext<this, TNarrowScope>
    }
}
