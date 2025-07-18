import { describe, expect, it, vi } from 'vitest'
import { Context, type AppScope } from './context'
import type { IEvent } from '../events'

describe('Context', () => {
    it('Should allow value dependency injection', async () => {
        type Scope = {
            foo: string
            bar: number
        }
        const context = new Context<Scope>()

        context.registerValue('foo', 'Hello')
        context.registerValue('bar', 42)

        const foo = context.resolve('foo')
        const bar = context.resolve('bar')

        expect(foo).toBe('Hello')
        expect(bar).toBe(42)
    })

    it('Should allow factory dependency injection', async () => {
        type Scope = {
            foo: string
            bar: number
            name: string
        }
        const context = new Context<Scope>()

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')

        context.registerFactory('foo', (name: string, bar: number) => `Hello ${name}, the answer is ${bar}`, [
            'name',
            'bar',
        ])

        const foo = context.resolve('foo')

        expect(foo).toBe('Hello Person, the answer is 42')
    })

    it('Should allow async factory dependency injection', async () => {
        type Scope = {
            foo: Promise<string>
            bar: number
            name: Promise<string>
            baz: string
        }
        const context = new Context<Scope>()

        context.registerValue('bar', 42)
        context.registerAsyncFactory('name', async () => 'Person')

        context.registerAsyncFactory(
            'foo',
            async (name: string, bar: number) => `Hello ${name}, the answer is ${bar}`,
            ['name', 'bar'],
        )

        const foo = await context.resolve('foo')

        expect(foo).toBe('Hello Person, the answer is 42')
    })

    it('should allow class dependency injection', async () => {
        class Thing1 {
            constructor(public name: string) {}

            testThing1() {
                return `Hello, ${this.name}, this is Thing 1`
            }
        }

        class Thing2 {
            constructor(public thing1: Thing1, public bar: number) {}

            testThing2() {
                return this.thing1.testThing1() + ' and Thing 2. The answer is ' + this.bar.toString()
            }
        }

        type Scope = {
            foo: string
            bar: number
            name: string
            thing1: Thing1
            thing2: Thing2
        }
        const context = new Context<Scope>()

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')

        context.registerClass('thing1', Thing1, ['name'])
        context.registerClass('thing2', Thing2, ['thing1', 'bar'])

        const thing1 = context.resolve('thing1')
        const thing2 = context.resolve('thing2')

        expect(thing1.testThing1()).toBe('Hello, Person, this is Thing 1')
        expect(thing2.testThing2()).toBe('Hello, Person, this is Thing 1 and Thing 2. The answer is 42')
    })

    it('should allow class dependency injection with async dependencies', async () => {
        class Greeting {
            constructor(public name: string) {}

            greet() {
                return `Hello, ${this.name}.`
            }
        }

        class AgeCalculator {
            constructor(public name: string, public age: number) {}

            printAge() {
                return `${this.name} is ${this.age} years old.`
            }
        }

        type Scope = {
            name: Promise<string>
            age: number
            greeting: Promise<Greeting>
            ageCalculator: Promise<AgeCalculator>
        }

        const context = new Context<Scope>()

        context.registerValue('age', 42)
        context.registerAsyncFactory('name', async () => 'Person')
        context.registerAsyncClass('greeting', Greeting, ['name'])
        context.registerAsyncClass('ageCalculator', AgeCalculator, ['name', 'age'])

        const greeting = await context.resolve('greeting')
        const ageCalculator = await context.resolve('ageCalculator')

        expect(greeting.greet()).toBe('Hello, Person.')
        expect(ageCalculator.printAge()).toBe('Person is 42 years old.')
    })

    it('should support singletons', async () => {
        let factoryInstances = 0
        let asyncFactoryInstances = 0
        let classInstances = 0

        class Singleton {
            constructor(public value: string) {
                classInstances = classInstances + 1
            }

            test() {
                return 'From a class: ' + this.value
            }
        }

        type Scope = {
            singletonValue: number
            singletonFactory: string
            singletonAsyncFactory: Promise<string>
            singletonClass: Singleton
            singletonAsyncClass: Promise<Singleton>
        }

        const context = new Context<Scope>()

        context.registerValue('singletonValue', 42) // Note: Values are inherently singletons
        context.registerFactory(
            'singletonFactory',
            (value: number) => {
                factoryInstances = factoryInstances + 1
                return `The answer is ${value}`
            },
            ['singletonValue'],
            {
                singleton: true,
            },
        )
        context.registerAsyncFactory(
            'singletonAsyncFactory',
            async (answer: string) => {
                asyncFactoryInstances = asyncFactoryInstances + 1
                return `Since you've waited a long time, ${answer}`
            },
            ['singletonFactory'],
            {
                singleton: true,
            },
        )
        context.registerClass('singletonClass', Singleton, ['singletonFactory'], {
            singleton: true,
        })
        context.registerAsyncClass('singletonAsyncClass', Singleton, ['singletonAsyncFactory'], {
            singleton: true,
        })

        const singletonValue = context.resolve('singletonValue')
        const singletonFactory = context.resolve('singletonFactory')
        const singletonAsyncFactory = await context.resolve('singletonAsyncFactory')
        const singletonClass = context.resolve('singletonClass')
        const singletonAsyncClass = await context.resolve('singletonAsyncClass')

        expect(singletonValue).toBe(42)
        expect(singletonFactory).toBe('The answer is 42')
        expect(singletonAsyncFactory).toBe("Since you've waited a long time, The answer is 42")
        expect(singletonClass.test()).toBe('From a class: The answer is 42')
        expect(singletonAsyncClass.test()).toBe("From a class: Since you've waited a long time, The answer is 42")

        expect(factoryInstances).toBe(1)
        expect(classInstances).toBe(2)
    })

    it('should support eager dependencies', async () => {
        type Scope = {
            foo: string
            bar: number
            name: string
        }
        const context = new Context<Scope>()

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')

        let factoryInstances = 0

        context.registerFactory(
            'foo',
            (name: string, bar: number) => {
                factoryInstances = factoryInstances + 1
                return `Hello ${name}, the answer is ${bar}`
            },
            ['name', 'bar'],
            {
                eager: true,
            },
        )

        expect(factoryInstances).toBe(0)

        await context.initializeEagerDependencies()

        expect(factoryInstances).toBe(1)

        const foo = context.resolve('foo')

        expect(factoryInstances).toBe(1)

        expect(foo).toBe('Hello Person, the answer is 42')
    })

    it('should support scope resolution', async () => {
        type Scope = {
            foo: string
            bar: number
            name: string
        }
        const context = new Context<Scope>()

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')

        let factoryInstances = 0

        context.registerFactory(
            'foo',
            (name: string, bar: number) => {
                factoryInstances = factoryInstances + 1
                return `Hello ${name}, the answer is ${bar}`
            },
            ['name', 'bar'],
        )

        expect(factoryInstances).toBe(0)

        const foo = context.scope.foo

        expect(factoryInstances).toBe(1)
        expect(foo).toBe('Hello Person, the answer is 42')

        const foo2 = context.scope.foo

        expect(factoryInstances).toBe(2)
        expect(foo2).toBe('Hello Person, the answer is 42')

        expect(context.scope.bar).toBe(42)
        expect(context.scope.name).toBe('Person')
    })

    it('should support merging scopes', async () => {
        type ScopeA = {
            bar: number
            name: string
            foo: string
        }
        const context = new Context<ScopeA>()

        let factoryInstances = 0

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')
        context.registerFactory('foo', () => {
            factoryInstances = factoryInstances + 1
            return 'This should never run'
        })

        type ScopeB = ScopeA & {
            foo: string
            baz: number
        }

        const context2 = new Context<ScopeB>()
        context2.extend(context)

        context2.registerFactory(
            'foo',
            (name: string, bar: number) => {
                factoryInstances = factoryInstances + 1
                return `Hello ${name}, the answer is ${bar}`
            },
            ['name', 'bar'],
        )
        context2.registerValue('baz', 100)

        // Ensure that merging doesn't actually run any factories
        expect(factoryInstances).toBe(0)

        const foo = context2.scope.foo

        expect(factoryInstances).toBe(1)
        expect(foo).toBe('Hello Person, the answer is 42')

        const foo2 = context2.scope.foo

        expect(factoryInstances).toBe(2)
        expect(foo2).toBe('Hello Person, the answer is 42')

        expect(context2.scope.bar).toBe(42)
        expect(context2.scope.name).toBe('Person')
    })

    it(`Should allow factories without args`, () => {
        type Scope = {
            foo: string
        }
        const context = new Context<Scope>()

        context.registerFactory('foo', () => 'Hello')

        const foo = context.resolve('foo')

        expect(foo).toBe('Hello')
    })

    it('should get nested dependencies', async () => {
        type Scope = {
            foo: string
        }

        type ScopeA = Scope & {
            bar: string
        }

        type ScopeB = ScopeA & {
            baz: string
        }

        type ScopeC = ScopeB & {
            qux: string
        }

        const context = new Context<Scope>()
        context.registerFactory('foo', () => 'A partridge in a pear tree')

        const contextA = new Context<ScopeA>()
        contextA.extend(context)
        contextA.registerFactory('bar', (foo: string) => `${foo}, two turtle doves`, ['foo'])

        const contextB = new Context<ScopeB>()
        contextB.extend(contextA)
        contextB.registerFactory('baz', (bar: string) => `${bar}, three French hens`, ['bar'])

        const contextC = new Context<ScopeC>()
        contextC.extend(contextB)
        contextC.registerFactory('qux', (baz: string) => `${baz}, four calling birds`, ['baz'])

        const qux = contextC.resolve('qux')

        const allDependencies = contextC.getAllDependencies('qux')

        expect(allDependencies[0].key).toBe('baz')
        expect(allDependencies[1].key).toBe('bar')
        expect(allDependencies[2].key).toBe('foo')

        expect(allDependencies[0].inject).toEqual(['bar'])
        expect(allDependencies[1].inject).toEqual(['foo'])
        expect(allDependencies[2].inject).toEqual([])

        expect(qux).toBe('A partridge in a pear tree, two turtle doves, three French hens, four calling birds')
    })

    it('should get nested dependent values', async () => {
        type Scope = {
            foo: string
        }

        type ScopeA = Scope & {
            bar: string
        }

        type ScopeB = ScopeA & {
            baz: string
        }

        type ScopeC = ScopeB & {
            qux: string
        }

        const context = new Context<Scope>()
        context.registerFactory('foo', () => 'A partridge in a pear tree')

        const contextA = new Context<ScopeA>()
        contextA.extend(context)
        contextA.registerFactory('bar', (foo: string) => `${foo}, two turtle doves`, ['foo'])

        const contextB = new Context<ScopeB>()
        contextB.extend(contextA)
        contextB.registerFactory('baz', (bar: string) => `${bar}, three French hens`, ['bar'])

        const contextC = new Context<ScopeC>()
        contextC.extend(contextB)
        contextC.registerFactory('qux', (baz: string) => `${baz}, four calling birds`, ['baz'])

        const dependents = contextC.getAllDependents('foo')

        expect(dependents[0].key).toBe('bar')
        expect(dependents[1].key).toBe('baz')
        expect(dependents[2].key).toBe('qux')

        expect(dependents[0].inject).toEqual(['foo'])
        expect(dependents[1].inject).toEqual(['bar'])
        expect(dependents[2].inject).toEqual(['baz'])
    })

    it('should protect against scope leakage', async () => {
        type BaseScope = {
            foo: string
            bar: string
            base: string
            validSingleton: string
            validCachedSingleton: string
        }

        type ScopeA = BaseScope & {
            baz: string
        }

        type ScopeB = BaseScope & {
            qux: string
        }

        const baseContext = new Context<BaseScope>()

        baseContext.registerFactory('foo', () => 'Hello', [], {
            singleton: true,
        })
        baseContext.registerFactory('bar', () => 'World', [])
        baseContext.registerFactory('base', (foo: string, bar: string) => `Base: ${foo} ${bar}`, ['foo', 'bar'], {
            singleton: true,
        })
        let validSingletonInstances = 0
        baseContext.registerFactory(
            'validSingleton',
            () => {
                validSingletonInstances = validSingletonInstances + 1
                return 'Singleton'
            },
            [],
            {
                singleton: true,
            },
        )
        let validCachedSingletonInstances = 0
        baseContext.registerFactory(
            'validCachedSingleton',
            () => {
                validCachedSingletonInstances = validCachedSingletonInstances + 1
                return 'Cached Singleton'
            },
            [],
            {
                singleton: true,
            },
        )

        // Resolve this before forking context to ensure that the cached value gets passed on.
        const base = baseContext.resolve('base')
        const validCachedSingleton = baseContext.resolve('validCachedSingleton')

        const contextA = new Context<ScopeA>()
        contextA.extend(baseContext)
        // Override a value that the singleton is going to depend on, but is not a singleton
        contextA.registerFactory('bar', () => 'Robby', [])
        // Add another property that dependes on the overridden value
        contextA.registerFactory('baz', (foo: string, bar: string) => `${foo} ${bar}`, ['foo', 'bar'], {
            singleton: true,
        })

        const contextB = new Context<ScopeB>()
        contextB.extend(baseContext)
        // Override a value that the singleton is going to depend on, and is also a singleton
        contextB.registerFactory('foo', () => 'Goodbye', [], {
            singleton: true,
        })
        // Add another property that dependes on the overridden value
        contextB.registerFactory('qux', (foo: string, bar: string) => `${foo} ${bar}`, ['foo', 'bar'], {
            singleton: true,
        })

        const baseA = contextA.resolve('base')
        const baseB = contextB.resolve('base')

        const baz = contextA.resolve('baz')
        const qux = contextB.resolve('qux')
        const foo = baseContext.resolve('foo')
        const bar = baseContext.resolve('bar')

        const validSingleton = baseContext.resolve('validSingleton')
        const validSingletonA = contextA.resolve('validSingleton')
        const validSingletonB = contextB.resolve('validSingleton')

        const validCachedSingletonA = contextA.resolve('validCachedSingleton')
        const validCachedSingletonB = contextB.resolve('validCachedSingleton')

        // resolve them all again
        baseContext.resolve('validSingleton')
        contextA.resolve('validSingleton')
        contextB.resolve('validSingleton')
        baseContext.resolve('validCachedSingleton')
        contextA.resolve('validCachedSingleton')
        contextB.resolve('validCachedSingleton')

        expect(baz).toBe('Hello Robby')
        expect(qux).toBe('Goodbye World')
        expect(foo).toBe('Hello')
        expect(bar).toBe('World')

        expect(baseA).toBe('Base: Hello Robby')
        expect(baseB).toBe('Base: Goodbye World')
        expect(base).toBe('Base: Hello World')

        expect(validSingleton).toBe('Singleton')
        expect(validSingletonA).toBe('Singleton')
        expect(validSingletonB).toBe('Singleton')

        expect(validCachedSingleton).toBe('Cached Singleton')
        expect(validCachedSingletonA).toBe('Cached Singleton')
        expect(validCachedSingletonB).toBe('Cached Singleton')

        expect(validSingletonInstances).toBe(3)
        expect(validCachedSingletonInstances).toBe(1)
    })

    it('should invalid nested dependency caches when overriding a value', async () => {
        type Scope = {
            foo: string
        }

        type ScopeA = Scope & {
            bar: string
        }

        type ScopeB = ScopeA & {
            baz: string
        }

        type ScopeC = ScopeB & {
            qux: string
        }

        const context = new Context<Scope>()
        context.registerFactory('foo', () => 'A partridge in a pear tree', [], {
            singleton: true,
        })
        context.resolve('foo')

        const contextA = new Context<ScopeA>()
        contextA.extend(context)
        contextA.registerFactory('bar', (foo: string) => `two turtle doves, ${foo}`, ['foo'], {
            singleton: true,
        })
        contextA.resolve('bar')

        const contextB = new Context<ScopeB>()
        contextB.extend(contextA)
        contextB.registerFactory('baz', (bar: string) => `three French hens, ${bar}`, ['bar'], {
            singleton: true,
        })
        contextB.resolve('baz')

        const contextC = new Context<ScopeC>()
        contextC.extend(contextB)
        contextC.registerFactory('qux', (baz: string) => `four calling birds, ${baz}`, ['baz'], {
            singleton: true,
        })
        contextC.resolve('qux')
        contextC.registerFactory('foo', () => 'and a partridge in a pear tree', [], {
            singleton: true,
        })

        const fooCache = contextC.introspect('foo').cachedValue
        const barCache = contextC.introspect('bar').cachedValue
        const bazCache = contextC.introspect('baz').cachedValue
        const quxCache = contextC.introspect('qux').cachedValue

        expect(fooCache).toBeUndefined()
        expect(barCache).toBeUndefined()
        expect(bazCache).toBeUndefined()
        expect(quxCache).toBeUndefined()

        contextC.resolve('qux')

        const fooCache2 = contextC.introspect('foo').cachedValue
        const barCache2 = contextC.introspect('bar').cachedValue
        const bazCache2 = contextC.introspect('baz').cachedValue
        const quxCache2 = contextC.introspect('qux').cachedValue

        expect(fooCache2).toBe('and a partridge in a pear tree')
        expect(barCache2).toBe('two turtle doves, and a partridge in a pear tree')
        expect(bazCache2).toBe('three French hens, two turtle doves, and a partridge in a pear tree')
        expect(quxCache2).toBe(
            'four calling birds, three French hens, two turtle doves, and a partridge in a pear tree',
        )
    })

    it('should override an async factory with a new value', async () => {
        type ScopeA = {
            foo: Promise<string>
            bar: Promise<number>
        }

        const contextA = new Context<ScopeA>()

        contextA.registerAsyncFactory('foo', async () => 'Hello', [], {
            singleton: true,
        })
        contextA.registerAsyncFactory('bar', async () => 42, [], {
            singleton: true,
        })

        const contextB = new Context<ScopeA>()

        contextB.extend(contextA)
        contextB.registerAsyncFactory('foo', async () => 'Goodbye', [], {
            singleton: true,
        })
        contextB.registerAsyncFactory('bar', async () => 100, [], {
            singleton: true,
        })

        const foo = await contextB.resolve('foo')
        const bar = await contextB.resolve('bar')

        expect(foo).toBe('Goodbye')
        expect(bar).toBe(100)
    })

    it('should inherit emitter listeners, passing in the new context, when extending', async () => {
        const contextACallback = vi.fn()
        const contextBCallback = vi.fn()

        type ScopeA = {
            foo: string
            bar: number
        }

        type ScopeB = ScopeA & {
            baz: string
        }

        type TestEvent = IEvent & {
            message: string
        }

        const contextA = new Context<ScopeA>()
        contextA.registerValue('foo', 'Hello')
        contextA.registerValue('bar', 42)
        contextA.on<TestEvent>('test', contextACallback)

        const contextB = new Context<ScopeB>()
        contextB.extend(contextA)
        contextB.registerValue('baz', 'World')
        contextB.on<TestEvent>('test', contextBCallback)

        const eventA: TestEvent = {
            type: 'test',
            message: 'Hello World',
        }

        await contextB.emit('test')

        expect(contextACallback).toHaveBeenCalledTimes(1)
        expect(contextBCallback).toHaveBeenCalledTimes(1)
    })

    it('should cancel eager initialization when a depedency is overridden', async () => {
        type Scope = {
            foo: string
            bar: Promise<number>
        }

        const context = new Context<Scope>()

        const context1Factory = vi.fn(() => 'Hello')
        const context2Factory = vi.fn(() => 'Goodbye')
        const context1AsyncFactory = vi.fn(async () => 42)
        const context2AsyncFactory = vi.fn(async () => 100)

        context.registerFactory('foo', context1Factory, [], {
            eager: true,
        })
        context.registerAsyncFactory('bar', context1AsyncFactory, [], {
            eager: true,
        })

        const context2 = new Context<Scope>()
        context2.extend(context)
        context2.registerFactory('foo', context2Factory, [], {
            eager: true,
        })
        context2.registerAsyncFactory('bar', context2AsyncFactory, [], {
            eager: true,
        })

        context.registerValue('foo', 'Goodbye')

        await context2.initializeEagerDependencies()

        expect(context1Factory).toHaveBeenCalledTimes(0)
        expect(context2Factory).toHaveBeenCalledTimes(1)
        expect(context1AsyncFactory).toHaveBeenCalledTimes(0)
        expect(context2AsyncFactory).toHaveBeenCalledTimes(1)
    })

    it('should dispatch event objects and event strings', async () => {
        interface CustomEvent extends IEvent {
            type: 'test'
            message: string
        }
        const event: CustomEvent = {
            type: 'test',
            message: 'Hello World',
        }

        const contextACallback = vi.fn()

        const contextA = new Context<AppScope>()

        contextA.on<CustomEvent>('test', contextACallback)

        await contextA.emit(event)

        expect(contextACallback).toHaveBeenCalledTimes(1)
        expect(contextACallback.mock.calls[0][1]).toEqual(event)
        expect(contextACallback.mock.calls[0][0]).toBe(contextA)
    })

    it('should be able to emit events directly through the emitter', async () => {
        interface CustomEvent extends IEvent {
            type: 'test'
            message: string
        }
        const event: CustomEvent = {
            type: 'test',
            message: 'Hello World',
        }

        const contextACallback = vi.fn()

        const contextA = new Context<AppScope>()

        contextA.events.on('test', contextACallback)

        await contextA.events.emitAsync(event)

        expect(contextACallback).toHaveBeenCalledTimes(1)
        expect(contextACallback.mock.calls[0][0]).toEqual(event)
    })

    it('should not squash errors in event handlers', async () => {
        const context = new Context<AppScope>()
        const callback = vi.fn()

        context.on('test', () => {
            callback()
            throw new Error('Test error')
        })

        expect(callback).not.toHaveBeenCalled()
        await expect(context.emit('test')).rejects.toThrow('Test error')
    })
})
