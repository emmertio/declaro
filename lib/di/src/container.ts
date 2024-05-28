import { type Class } from '@declaro/core'

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

export enum DependencyType {
    VALUE = 'VALUE',
    FACTORY = 'FACTORY',
    CLASS = 'CLASS',
}

export type DependencyRecord<
    K extends string | Symbol = string,
    V extends DependencyFactory<any, any> = DependencyFactory<any, any>,
    T extends DependencyType = DependencyType,
> = {
    key: K
    type: T
    value: V
    cachedValue?: UnwrapFactoryValue<V>
    defaultResolveOptions?: ResolveOptions
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

const getDefaultResolveOptions = (): ResolveOptions => {
    return {
        strict: true,
        cache: true,
        singleton: false,
    }
}

export class Container<T extends DependencyMap = DependencyMap<never>> {
    constructor(readonly dependencies: T = {} as T) {}

    provideValue<K extends string, V extends KeyRestrictedValue<T, K>>(
        key: K,
        value: V,
        defaultResolveOptions?: ResolveOptions | undefined,
    ): Container<T & { [key in K]: DependencyRecord<K, DependencyFactory<V, []>, DependencyType.VALUE> }> {
        this.validateValueForKey(key as any, value, { strict: true })
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, DependencyFactory<V, []>, DependencyType.VALUE>>{
                key,
                type: DependencyType.VALUE as const,
                value: () => value,
                defaultResolveOptions,
            },
        })
    }

    provideFactory<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        factory: DependencyFactory<V, A>,
        inject?: ResultTuple<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<T & { [key in K]: DependencyRecord<K, DependencyFactory<V, A>, DependencyType.FACTORY> }> {
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, DependencyFactory<V, A>, DependencyType.FACTORY>>{
                key,
                type: DependencyType.FACTORY as const,
                value: (...args: A) => {
                    const values = this.resolveDependencies(inject as any[], args)
                    return factory(...(values as any))
                },
                defaultResolveOptions,
            },
        })
    }

    provideAsyncFactory<K extends string, A extends any[], V extends UnwrapPromise<KeyRestrictedValue<T, K>>>(
        key: K,
        factory: DependencyFactory<Promise<V>, A>,
        inject?: ResultTupleAsync<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<T & { [key in K]: DependencyRecord<K, DependencyFactory<Promise<V>, A>, DependencyType.FACTORY> }> {
        const injector = (async (...args: A) => {
            const values = await Promise.all([...args])
            return factory(...values)
        }) as any
        return this.provideFactory(key, injector, inject as any, defaultResolveOptions)
    }

    provideClass<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        classDefinition: DependencyClass<V, A>,
        inject?: ResultTuple<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<T & { [key in K]: DependencyRecord<K, DependencyFactory<V, A>, DependencyType.CLASS> }> {
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, DependencyFactory<V, A>, DependencyType.CLASS>>{
                key,
                type: DependencyType.CLASS as const,
                value: (...args: A) => {
                    const values = this.resolveDependencies(inject as any[], args)
                    return new classDefinition(...(values as any))
                },
                defaultResolveOptions,
            },
        })
    }

    provideAsyncClass<K extends string, A extends any[], V extends KeyRestrictedValue<T, K>>(
        key: K,
        classDefinition: DependencyClass<V, A>,
        inject?: ResultTupleAsync<T, A>,
        defaultResolveOptions?: ResolveOptions,
    ): Container<T & { [key in K]: DependencyRecord<K, DependencyFactory<Promise<V>, A>, DependencyType.CLASS> }> {
        return new Container({
            ...this.dependencies,
            [key]: <DependencyRecord<K, DependencyFactory<Promise<V>, A>, DependencyType.CLASS>>{
                key,
                type: DependencyType.CLASS as const,
                value: async (...args: A) => {
                    const values = await Promise.all(this.resolveDependencies(inject as any[], args))
                    return new classDefinition(...(values as A))
                },
                defaultResolveOptions,
            },
        })
    }

    resolve<K extends MapKeys<T>>(key: K, options: ResolveOptions = {}): DependencyValue<T, K> {
        return this._resolveValue(key, options)
    }

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

    introspect<K extends keyof T>(key: K, options: ResolveOptions = {}): T[K] {
        const dep = this.dependencies[key]

        if (options.strict && !dep) {
            throw new Error(`No dependency found for key ${key?.toString()}`)
        }

        return dep
    }

    fork(): Container<T> {
        return new Container({ ...this.dependencies })
    }

    merge<C extends Container<any>>(container: C): Container<T & ExtractDependencyMap<C>> {
        return new Container({ ...this.dependencies, ...container.dependencies })
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

        const value = fn()

        if (settings.cache) {
            dep.cachedValue = value
        }

        return value
    }
}
