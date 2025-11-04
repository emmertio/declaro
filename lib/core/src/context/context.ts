import { type IncomingHttpHeaders } from 'http'
import { EventManager, type IEvent } from '../events/event-manager'
import type { Request } from '../http/request'
import type { AllNodeMiddleware } from '../http/request-context'
import type { Class, PromiseOrValue, UnwrapPromise } from '../typescript'
import { validate, validateAny, type Validator } from '../validation'
import { ContextConsumer } from './context-consumer'

/**
 * Global interface for declaring dependencies available across all contexts.
 * Extend this interface using declaration merging to add type-safe dependencies.
 */
export interface DeclaroDependencies {}

/**
 * Base scope interface for contexts with request and node middleware.
 */
export interface DeclaroScope {
    /** Middleware that runs on request contexts */
    requestMiddleware: ContextMiddleware<Context>[]
    /** Node.js-compatible middleware */
    nodeMiddleware: AllNodeMiddleware[]
}

/**
 * Scope interface for request-specific contexts, extending the base scope with request data.
 */
export interface DeclaroRequestScope extends DeclaroScope {
    /** The HTTP request object */
    request: Request
    /** Incoming HTTP headers */
    headers: IncomingHttpHeaders
    /** Helper function to retrieve a specific header value */
    header: <K extends keyof IncomingHttpHeaders>(header: K) => IncomingHttpHeaders[K] | undefined
}

/**
 * Extracts the scope type from a Context type.
 */
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

/**
 * Middleware function that can modify or extend a context.
 */
export type ContextMiddleware<C extends Context = Context> = (context: Context<ExtractScope<C>>) => any | Promise<any>

/**
 * Represents the state storage for a context, mapping keys to their attributes.
 */
export type ContextState<TContext extends Context> = Record<PropertyKey, ContextAttribute<TContext, StateValue<any>>>

/**
 * Function that resolves a value from a context.
 */
export type ContextResolver<T> = (context: Context) => StateValue<T>

/**
 * Wrapper type for state values.
 */
export type StateValue<T> = T

/**
 * Types of dependencies that can be registered in a context.
 */
export enum DependencyType {
    /** A literal value dependency */
    VALUE = 'VALUE',
    /** A factory function that creates the dependency */
    FACTORY = 'FACTORY',
    /** A class constructor that instantiates the dependency */
    CLASS = 'CLASS',
}

/**
 * Factory function type that takes arguments and returns a value.
 */
export type FactoryFn<T, A extends any[]> = (...args: A) => T

/**
 * Function that loads a value from a context with optional resolution options.
 */
export type ValueLoader<C extends Context, T> = (context: C, resolutionOptions?: ResolveOptions) => T

/**
 * Filters object keys to only those whose values match a specific type.
 */
export type FilterKeysByType<TScope, TValue> = {
    [Key in keyof TScope]: TScope[Key] extends TValue ? Key : never
}[keyof TScope]

/**
 * Filters object keys to only those whose values match a specific type or Promise of that type.
 */
export type FilterKeysByAsyncType<TScope, TValue> = {
    [Key in keyof TScope]: TScope[Key] extends PromiseOrValue<TValue> ? Key : never
}[keyof TScope]

/**
 * Maps an array of argument types to their corresponding scope keys.
 */
export type FilterArgsByType<TScope, TArgs extends any[]> = {
    [Key in keyof TArgs]: FilterKeysByType<TScope, TArgs[Key]>
}

/**
 * Maps an array of argument types to their corresponding scope keys for async values.
 */
export type FilterAsyncArgsByType<TScope, TArgs extends any[]> = {
    [Key in keyof TArgs]: FilterKeysByAsyncType<TScope, TArgs[Key]>
}

/**
 * Metadata describing how a dependency is registered and resolved in a context.
 */
export type ContextAttribute<TContext extends Context<any>, TValue> = {
    /** The key under which this dependency is registered */
    key: PropertyKey
    /** Function that loads the value from the context */
    value?: ValueLoader<TContext, TValue>
    /** The type of dependency (value, factory, or class) */
    type: DependencyType
    /** Options controlling how this dependency is resolved */
    resolveOptions?: ResolveOptions
    /** Cached value for singleton or eager dependencies */
    cachedValue?: TValue
    /** Keys of other dependencies that this dependency requires */
    inject: PropertyKey[]
}

/**
 * Type-safe scope key extraction.
 */
export type ScopeKey<S extends object> = keyof S

/**
 * Listener function that responds to events in a context.
 */
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

/**
 * Type guard to check if a value is a circular dependency proxy.
 *
 * @param value - The value to check
 * @returns True if the value is a ResolveProxy
 */
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

/**
 * Extracts nested resolution options, preserving resolution state across calls.
 *
 * @param options - The resolve options to extract from
 * @returns Internal resolution options with resolution stack and context
 */
export function getNestedResolveOptions(options?: ResolveOptions | InternalResolveOptions): InternalResolveOptions {
    return {
        resolutionStack: (options as InternalResolveOptions)?.resolutionStack,
        resolutionContext: options?.resolutionContext,
    }
}

/**
 * Internal interface extending ResolveOptions with resolution tracking.
 */
export interface InternalResolveOptions extends ResolveOptions {
    /** Stack tracking the current resolution chain to detect circular dependencies */
    resolutionStack: Set<PropertyKey>
}

/**
 * Returns the default resolution options for dependencies.
 *
 * @returns Default resolve options with strict, eager, and singleton all set to false
 */
export function defaultResolveOptions(): ResolveOptions {
    return {
        strict: false,
        eager: false,
        singleton: false,
    }
}

/**
 * Helper function to define type-safe context middleware.
 *
 * @param middleware - The middleware function to define
 * @returns The same middleware function with proper typing
 */
export function defineContextMiddleware<C extends Context>(middleware: ContextMiddleware<C>): ContextMiddleware<C> {
    return middleware
}

/**
 * Configuration options for creating a context.
 */
export type ContextOptions = {
    /** Default options to use when resolving dependencies */
    defaultResolveOptions?: ResolveOptions
}

/**
 * Core dependency injection container that manages application dependencies and their lifecycle.
 * Supports values, factories, and classes with automatic dependency resolution and circular dependency handling.
 */
export class Context<Scope extends object = any> {
    private readonly state: ContextState<this> = {}
    private readonly emitter = new EventManager()

    /** The scope object providing typed access to all registered dependencies */
    public readonly scope: Scope = {} as Scope

    /** Default options used when resolving dependencies if not overridden */
    protected readonly defaultResolveOptions: ResolveOptions

    /**
     * Creates a new context instance.
     *
     * @param options - Configuration options for the context
     */
    constructor(options?: ContextOptions) {
        this.defaultResolveOptions = {
            ...defaultResolveOptions(),
            ...options?.defaultResolveOptions,
        }
    }

    /**
     * Gets the event manager for this context.
     *
     * @returns The event manager instance
     */
    get events() {
        return this.emitter
    }

    /**
     * Initializes all dependencies marked as eager.
     * Should be called after all dependencies are registered to trigger eager initialization.
     */
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
     * @param key - The scope key to register the value under
     * @param payload - The value to register
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
     *
     * @param key - The scope key to register under
     * @param dep - The dependency attribute to add
     * @returns The registered dependency attribute
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
     * @param key - The key to register the dependency under
     * @param value - The value to register
     * @param defaultResolveOptions - Optional resolution options
     * @returns The context instance for chaining
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
     * @param key - The key to register the dependency under
     * @param factory - A factory function that will be called to generate the value when it is requested
     * @param inject - An array of keys to use when injecting factory args
     * @param defaultResolveOptions - Optional resolution options
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

    /**
     * Register an async factory in context scope.
     * The factory function and its dependencies can be asynchronous.
     *
     * @param key - The key to register the dependency under
     * @param factory - An async factory function that will be called to generate the value
     * @param inject - An array of keys to use when injecting factory args
     * @param defaultResolveOptions - Optional resolution options
     * @returns A chainable instance of context
     */
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

    /**
     * Register a class constructor in context scope.
     * The class will be instantiated with the specified dependencies.
     *
     * @param key - The key to register the dependency under
     * @param Class - The class constructor
     * @param inject - An array of keys to use when injecting constructor arguments
     * @param defaultResolveOptions - Optional resolution options
     * @returns A chainable instance of context
     */
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

    /**
     * Register an async class constructor in context scope.
     * The class constructor can have async dependencies.
     *
     * @param key - The key to register the dependency under
     * @param Class - The class constructor
     * @param inject - An array of keys to use when injecting constructor arguments
     * @param defaultResolveOptions - Optional resolution options
     * @returns A chainable instance of context
     */
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

    /**
     * Gets all dependencies required by a specific dependency.
     *
     * @param key - The key of the dependency to inspect
     * @returns Array of all direct and transitive dependencies
     */
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

    /**
     * Gets all dependencies that depend on a specific dependency.
     * Useful for cache invalidation when a dependency changes.
     *
     * @param key - The key of the dependency to inspect
     * @param visited - Internal tracking set to prevent infinite recursion
     * @returns Array of all direct and transitive dependents
     */
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

    /**
     * Introspects a dependency to get its metadata.
     *
     * @param key - The key of the dependency to inspect
     * @returns The context attribute for the dependency, or undefined if not found
     */
    introspect<K extends ScopeKey<Scope>>(key: K) {
        const attribute = this.state[key]

        return attribute
    }

    /**
     * Checks if a cached value is still valid for a dependency.
     * A cache is invalid if the dependency or any of its transitive dependencies have been invalidated.
     *
     * @param key - The key of the dependency to check
     * @param visited - Internal tracking set to prevent infinite recursion in circular dependencies
     * @returns True if the cache is valid, false otherwise
     */
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

    /**
     * Creates a proxy object for handling circular dependencies.
     * The proxy initially acts as a placeholder and is later resolved to the real target.
     *
     * @returns A proxy that can be resolved later
     */
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

    /**
     * Internal method to resolve a dependency value with circular dependency handling.
     * This is the core resolution logic that handles caching, proxies, and dependency injection.
     *
     * @param key - The key of the dependency to resolve
     * @param resolveOptions - Options controlling the resolution behavior
     * @returns The resolved dependency value
     */
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
     * @param key - The scope key to resolve
     * @returns The resolved value or undefined if not found
     * @deprecated Use `resolve` instead
     */
    inject<T = any>(key: ScopeKey<Scope>): T | undefined {
        return this._resolveValue(key) as T
    }

    /**
     * Resolves a dependency from the context.
     * This is the primary method for retrieving registered dependencies.
     *
     * @param key - The scope key to resolve
     * @param resolveOptions - Options controlling resolution behavior
     * @returns The resolved dependency value
     */
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
     * @param key - The scope key to register under
     * @param instance - The instance to register as a singleton
     * @returns The singleton instance (either the provided one or the existing one)
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
     * Instantiate a ContextConsumer class.
     * ContextConsumer classes have automatic access to the context instance.
     *
     * @param Consumer - The ContextConsumer class to instantiate
     * @param args - Additional arguments to pass to the constructor
     * @returns A new instance of the ContextConsumer
     */
    hydrate<T extends ContextConsumer<this, any[]>, A extends any[]>(
        Consumer: new (context: this, ...args: A) => T,
        ...args: A
    ): T {
        return new Consumer(this, ...args)
    }

    /**
     * Create a new context from other instance(s) of Context.
     * Dependencies and event listeners from the provided contexts will be merged into this context.
     *
     * @param contexts - One or more contexts to extend from
     * @returns The current context instance for chaining
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
     * Modify context with middleware.
     * Middleware can register dependencies, modify configuration, or perform other setup tasks.
     *
     * @param middleware - One or more middleware functions to apply
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
     * @param validators - One or more validator functions to run
     * @returns The validation result
     */
    validate(...validators: Validator<Context>[]) {
        return validate(this, ...validators)
    }

    /**
     * Validate context ensuring at least one validator is valid.
     *
     * @param validators - One or more validator functions to run
     * @returns The validation result
     */
    validateAny(...validators: Validator<Context>[]) {
        return validateAny(this, ...validators)
    }

    /**
     * Add a callback to listen for an event in this context.
     *
     * @param type - The event type to listen for
     * @param listener - The callback function to invoke when the event is emitted
     * @returns A function to unregister the listener
     */
    on<E extends IEvent = IEvent>(type: IEvent['type'], listener: ContextListener<this, E>) {
        return this.emitter.on(type, (event) => {
            return listener(this, event as E)
        })
    }

    /**
     * Emit an event in this context.
     *
     * @param event - The event type string or event object to emit
     * @returns A promise that resolves when all event listeners have completed
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
