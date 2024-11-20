import _ from 'lodash'

export type Class<T extends {} = {}, A extends any[] = any[]> = {
    new (...args: A): T
}

/**
 * Merge two object types without using an intersection type. Intersection types preserve the original types of the objects causing confusion, while this type will merge the types of the objects.
 */
export type Merge<A, B> = {
    [key in keyof A | keyof B]: key extends keyof B ? B[key] : key extends keyof A ? A[key] : never
}

export type FilterKeys<T, U> = {
    [K in keyof T]: T[K] extends U ? K : never
}[keyof T]

export type MatchedKeys<T, U extends any[]> = {
    [K in keyof U]: FilterKeys<T, DependencyRecord<any, DependencyFactory<U[K], any>, any>>
}

export type MatchedAsyncKeys<T, U extends any[]> = {
    [K in keyof U]: FilterKeys<T, DependencyRecord<any, DependencyFactory<U[K] | Promise<U[K]>, any>, any>>
}

export type ResultTuple<T, U extends any[]> = {
    [K in keyof U]?: MatchedKeys<T, U>[K]
}

export type ResultTupleAsync<T, U extends any[]> = {
    [K in keyof U]?: MatchedAsyncKeys<T, U>[K]
}

export type PromisifyTuple<U extends any[]> = {
    [K in keyof U]: Promise<U[K]>
}

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
export type UnwrapPromiseTuple<T extends any[]> = { [K in keyof T]: UnwrapPromise<T[K]> }

export type DependencyClass<T extends {}, A extends any[]> = Class<T, A>
export type DependencyFactory<T, A extends any[]> = (...args: A) => T
export type UnwrapFactoryValue<F extends DependencyFactory<any, any>> = F extends DependencyFactory<infer T, infer A>
    ? T
    : never
export type UnwrapFactoryArgs<F extends DependencyFactory<any, any>> = F extends DependencyFactory<infer T, infer A>
    ? A
    : never

export type ValueLoader<T, A extends any[]> = (container: Container<any>, ...args: A) => T
export type UnwrapValueLoader<V extends ValueLoader<any, any>> = V extends ValueLoader<infer T, any> ? T : never

export enum DependencyType {
    VALUE = 'VALUE',
    FACTORY = 'FACTORY',
    CLASS = 'CLASS',
}

export type DependencyMiddleware<V> = (value: UnwrapPromise<V>) => V

export type DependencyRecord<
    K extends string | Symbol = string,
    V extends ValueLoader<any, any> = ValueLoader<any, any>,
    T extends DependencyType = DependencyType,
> = {
    key: K
    type: T
    value: V
    cachedValue?: UnwrapValueLoader<V>
    defaultResolveOptions?: ResolveOptions
    deferred?: boolean
    middleware: DependencyMiddleware<UnwrapValueLoader<V>>[]
}
export type DependencyMap<K extends string = string> = Record<K, DependencyRecord>
export type DependencyKey<T extends DependencyMap, K extends MapKeys<T>> = K
export type DependencyValue<T extends DependencyMap, K extends MapKeys<T>> = ReturnType<T[K]['value']>
export type KeyRestrictedValue<T extends DependencyMap, K extends string> = K extends MapKeys<T>
    ? DependencyValue<T, K>
    : any
export type MapKeys<T extends DependencyMap> = Extract<keyof T, string>

export type ContainerKeys<C extends Container<any>> = keyof C['dependencies']
export type KeyMatchingValue<T extends DependencyMap, V> = {
    [K in MapKeys<T>]-?: DependencyValue<T, K> extends V ? K : never
}[MapKeys<T>]
export type ResolveOptions = {
    strict?: boolean
    cache?: boolean
    singleton?: boolean
}
export type ExtractDependencyMap<C extends Container<any>> = C extends Container<infer T> ? T : never

export type ContainerExtensionFn<T extends DependencyMap> = (container: Container) => Container<T>
export type ContainerExtension<T extends DependencyMap> = (container: Container<any>) => Container<T>

export function defineExtension<T extends DependencyMap>(extension: ContainerExtensionFn<T>): ContainerExtension<T> {
    return extension
}

const getDefaultResolveOptions = (): ResolveOptions => {
    return {
        strict: true,
        cache: true,
        singleton: false,
    }
}

export type Deferred<T> = {
    __deferred: true
    value: T
}

export function defer<T>(typeTemplate?: T): Deferred<T> {
    return { __deferred: true, value: typeTemplate as T }
}

export class Container<T extends DependencyMap = DependencyMap<never>> {
    constructor(readonly dependencies: T = {} as T) {}

    /**
     * Add a static dependency
     *
     * @param key a key to identify the value
     * @param value a static value to provide into the container
     * @param defaultResolveOptions the intendend options for resolving the value in the default scenario
     * @returns a chainable new container instance with the provided value
     */
    provideValue<K extends string, V extends KeyRestrictedValue<T, K>>(
        key: K,
        value: V,
        defaultResolveOptions?: ResolveOptions | undefined,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE> }>> {
        const existingDep = this.introspect(key, { strict: false })
        this.validateValueForKey(key as any, value, { strict: true })
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE>>{
                key,
                type: DependencyType.VALUE as const,
                value: () => value,
                defaultResolveOptions,
                deferred: false,
                middleware: [...(existingDep?.middleware ?? [])],
            },
        } as Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE> }>)
    }

    /**
     * Add a factory dependency
     *
     * @param key a key to identify the value
     * @param factory a factory function to create the value
     * @param inject a list of dependencies to inject into the factory
     * @param defaultResolveOptions the intendend options for resolving the value in the default scenario
     * @returns a chainable new container instance with the provided factory
     */
    provideFactory<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        factory: DependencyFactory<V, A>,
        inject?: ResultTuple<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, A>, DependencyType.FACTORY> }>> {
        const existingDep = this.introspect(key, { strict: false })
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, ValueLoader<V, A>, DependencyType.FACTORY>>{
                key,
                type: DependencyType.FACTORY as const,
                value: (container, ...args: A) => {
                    const values = container.resolveDependencies(inject as string[], args)
                    return factory(...(values as any))
                },
                defaultResolveOptions,
                deferred: false,
                middleware: [...(existingDep?.middleware ?? [])],
            },
        } as Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, A>, DependencyType.FACTORY> }>)
    }

    /**
     * Add an async factory dependency
     *
     * @param key a key to identify the value
     * @param factory an async factory function to create the value
     * @param inject a list of dependencies to inject into the factory
     * @param defaultResolveOptions the intendend options for resolving the value in the default scenario
     * @returns a chainable new container instance with the provided async factory
     */
    provideAsyncFactory<K extends string, A extends any[], V extends UnwrapPromise<KeyRestrictedValue<T, K>>>(
        key: K,
        factory: DependencyFactory<Promise<V>, A>,
        inject?: ResultTupleAsync<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<Promise<V>, A>, DependencyType.FACTORY> }>> {
        const injector = (async (...args: A) => {
            const values = await Promise.all([...args])
            return factory(...values)
        }) as any
        return this.provideFactory(key, injector, inject as any, defaultResolveOptions) as any
    }

    /**
     * Add a class dependency
     *
     * @param key a key to identify the value
     * @param classDefinition a class definition
     * @param inject a list of dependencies to inject into the class constructor
     * @param defaultResolveOptions the intendend options for resolving the class in the default scenario
     * @returns a chainable new container instance with the provided class
     */
    provideClass<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        classDefinition: DependencyClass<V, A>,
        inject?: ResultTuple<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, A>, DependencyType.CLASS> }>> {
        const existingDep = this.introspect(key, { strict: false })
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, ValueLoader<V, A>, DependencyType.CLASS>>{
                key,
                type: DependencyType.CLASS as const,
                value: (container, ...args: A) => {
                    const values = container.resolveDependencies(inject as any[], args)
                    return new classDefinition(...(values as any))
                },
                defaultResolveOptions,
                deferred: false,
                middleware: [...(existingDep?.middleware ?? [])],
            },
        } as Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, A>, DependencyType.CLASS> }>)
    }

    /**
     * Add an async class dependency
     *
     * @param key a key to identify the value
     * @param classDefinition a class definition
     * @param inject a list of dependencies to inject into the class constructor
     * @param defaultResolveOptions the intendend options for resolving the class in the default scenario
     * @returns a chainable new container instance with the provided async class
     */
    provideAsyncClass<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        classDefinition: DependencyClass<V, A>,
        inject?: ResultTupleAsync<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<Promise<V>, A>, DependencyType.CLASS> }>> {
        const existingDep = this.introspect(key, { strict: false })
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, ValueLoader<Promise<V>, A>, DependencyType.CLASS>>{
                key,
                type: DependencyType.CLASS as const,
                value: async (container, ...args: A) => {
                    const values = await Promise.all(container.resolveDependencies(inject as any[], args))
                    return new classDefinition(...(values as A))
                },
                defaultResolveOptions,
                deferred: false,
                middleware: [...(existingDep?.middleware ?? [])],
            },
        } as Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<Promise<V>, A>, DependencyType.CLASS> }>)
    }

    /**
     * Mark a dependency as required. This allows modules to be loaded without providing all dependencies. Dependencies can be deferred to implementation. For example, an ORM module can require a database connection to be provided by the application, and add an entity manager instance that will work with whichever connection is provided.
     *
     * @param key A key to identify the value
     * @param value A value that is deferred to be provided later
     * @param defaultResolveOptions the resolve options
     * @returns
     */
    requireDependency<K extends string, V extends KeyRestrictedValue<T, K>>(
        key: K,
        value: Deferred<V>,
        defaultResolveOptions?: ResolveOptions | undefined,
    ): Container<Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE> }>> {
        const existingDep = this.introspect(key, { strict: false })

        if (existingDep) {
            return this as any
        }

        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE>>{
                key,
                type: DependencyType.VALUE as const,
                value: () => {
                    return undefined
                },
                defaultResolveOptions,
                deferred: true,
                middleware: [...(existingDep?.middleware ?? [])],
            },
        } as Merge<T, { [key in K]: DependencyRecord<K, ValueLoader<V, []>, DependencyType.VALUE> }>)
    }

    /**
     * Resolve a dependency by key
     *
     * @param key a key to identify the value
     * @param options the resolve options
     * @returns the resolved value
     */
    resolve<K extends MapKeys<T>>(key: K, options: ResolveOptions = {}): DependencyValue<T, K> {
        return this._resolveValue(key, options)
    }

    middleware<K extends MapKeys<T>>(
        key: K,
        middleware: DependencyMiddleware<DependencyValue<T, K>>,
        options: ResolveOptions = {},
    ): Container<T> {
        const dep = this.introspect(key, options)

        dep?.middleware?.push(middleware)

        return this
    }

    /**
     * Determine whether or not a dependency exists
     *
     * @param key a key to check for matching dependencies
     * @param value a value to compare potential existing dependencies against
     * @param options the resolve options
     * @returns the resolved value
     */
    validateValueForKey<K extends MapKeys<T>, V extends any>(key: K, value: V, options: ResolveOptions = {}): boolean {
        const existingValue = this.resolve(key, { strict: false })

        const isValid = typeof existingValue === 'undefined' || typeof existingValue === typeof value

        if (!isValid && options.strict !== false) {
            throw new Error(
                `Dependency '${key}' was configured with type '${typeof existingValue}' but value of type '${typeof value}' was provided`,
            )
        }

        return isValid
    }

    /**
     * Introspect a dependency by key
     *
     * @param key a key to identify the value
     * @param options the resolve options
     * @returns dependency metadata for the key you provided
     */
    introspect<K extends keyof T>(key: K, options: ResolveOptions = {}): T[K] {
        const dep = this.dependencies[key]

        if (options.strict && !dep) {
            throw new Error(`No dependency found for key ${key?.toString()}`)
        }

        return dep
    }

    /**
     * Fork the container
     *
     * @returns a new container instance with the same dependencies
     */
    fork(): Container<T> {
        return new Container({ ...this.dependencies })
    }

    /**
     * Merge the container with another container
     *
     * @param container the container to merge with
     * @returns a new container instance with the merged dependencies
     */
    merge<C extends Container<any>>(
        container: C,
    ): Container<{
        [K in keyof T | keyof ExtractDependencyMap<C>]: ExtractDependencyMap<C>[K] extends DependencyRecord
            ? ExtractDependencyMap<C>[K]
            : K extends keyof T
            ? T[K]
            : never
    }> {
        const existingDeferredKeys = Object.keys(this.dependencies).filter(
            (key) => container?.dependencies?.[key]?.deferred && !this.dependencies?.[key]?.deferred,
        )
        const mergedDeps: any = {
            ...this.dependencies,
            ...container.dependencies,
        }

        Object.keys(mergedDeps).forEach((key) => {
            const existingDep = this.introspect(key, { strict: false })
            const selectedDep = container.introspect(key, { strict: false })

            // If the new dependency is not deferred, use that. Otherwise, if the existing dependency is not deferred, use that. If both are deferred, use the new dependency.
            let mergeDep = selectedDep
            if (!selectedDep && existingDep) {
                mergeDep = existingDep
            } else if (selectedDep?.deferred && existingDep && !existingDep?.deferred) {
                mergeDep = existingDep
            }

            const newDep = {
                ...mergeDep,
                middleware: [...(existingDep?.middleware ?? []), ...(selectedDep?.middleware ?? [])],
            }

            mergedDeps[key] = newDep
        })
        return new Container({ ...mergedDeps })
    }

    /**
     * Extend the container
     *
     * @param extension an extension function that returns a new container
     * @returns a new container instance with the extended dependencies
     */
    extend<TExt extends DependencyMap>(extension: ContainerExtension<TExt>): Container<Merge<T, TExt>> {
        return extension(this.fork() as any) as any
    }

    protected resolveDependencies(inject: MapKeys<T>[], args: any[] = []) {
        return (
            inject?.map((key, i) => {
                const arg = args[i]
                if (arg) {
                    return arg
                }

                if (!!key) {
                    return this.resolve(key as any, { strict: false })
                } else {
                    return undefined
                }
            }) ?? []
        )
    }

    protected _resolveValue<K extends KeyMatchingValue<T, any>>(
        key: K,
        options: ResolveOptions = {},
    ): DependencyValue<T, K> {
        const dep = this.introspect(key, options)
        if (!dep) {
            return undefined as any
        }

        const settings = { ...getDefaultResolveOptions(), ...dep.defaultResolveOptions, ...options }

        const cachedValue = dep.cachedValue
        if (settings.singleton && cachedValue) {
            return cachedValue
        }

        const fn = dep.value

        if (!key) {
            throw new Error(`No key provided`)
        }

        if (typeof fn !== 'function') {
            throw new Error(`Dependency ${key?.toString()} is not injectable`)
        }

        if (dep.deferred && settings.strict !== false) {
            throw new Error(`Dependency "${key?.toString()}" was required but not provided`)
        }

        let value = fn(this)

        if (dep.middleware) {
            value = dep.middleware.reduce((acc, middleware) => {
                if (typeof (acc as any)?.then === 'function') {
                    return (acc as any).then((val: any) => middleware(val))
                } else {
                    return middleware(acc)
                }
            }, value)
        }

        if (settings.cache) {
            dep.cachedValue = value
        }

        return value
    }
}
