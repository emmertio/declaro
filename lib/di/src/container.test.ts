import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Container, defer, DependencyType } from './container'

describe('Container', () => {
    it('should be able to add and resolve values', () => {
        const container1 = new Container().provideValue('foo', 'bar')

        const value = container1.resolve('foo')

        expect(value).toBe('bar')

        const container2 = container1
            .provideValue('baz', 'qux')
            .provideValue('quux', 'corge')
            .provideValue('grault', 42)

        expect(container2.resolve('foo')).toBe('bar')
        expect(container2.resolve('baz')).toBe('qux')
        expect(container2.resolve('quux')).toBe('corge')
        expect(container2.resolve('grault')).toBe(42)

        expectTypeOf(container2.resolve('foo')).toEqualTypeOf<string>()
        expectTypeOf(container2.resolve('baz')).toEqualTypeOf<string>()
        expectTypeOf(container2.resolve('quux')).toEqualTypeOf<string>()
        expectTypeOf(container2.resolve('grault')).toEqualTypeOf<number>()
    })

    it('should be able to override existing values in a typesafe way', () => {
        class MyClass {
            constructor(public message = 'hello') {}
        }
        const container1 = new Container()
            .provideValue('foo', 'bar')
            .provideValue('baz', 42)
            .provideValue('quux', new Date())
            .provideValue('grault', new MyClass('Hello'))

        const container2 = container1
            .provideValue('foo', 'baz')
            .provideValue('baz', 43)
            .provideValue('quux', new Date(0))
            .provideValue('grault', new MyClass('World'))

        expect(container2.resolve('foo')).toBe('baz')
        expect(container2.resolve('baz')).toBe(43)
        expect(container2.resolve('quux')).toEqual(new Date(0))
        expect(container2.resolve('grault')).toEqual(new MyClass('World'))

        expect(() => {
            // @ts-expect-error
            const container3 = container2.provideValue('foo', 42)
        }).toThrow(`Dependency 'foo' was configured with type 'string' but value of type 'number' was provided`)
    })

    it('should introspect contextual information for a key', () => {
        const container1 = new Container()
            .provideValue('foo', 'bar')
            .provideValue('baz', 42)
            .provideValue('quux', new Date())

        const dep = container1.introspect('foo')

        expect(dep.key).toEqual('foo')
        expect(dep.type).toEqual(DependencyType.VALUE)
        expect(dep.value()).toEqual('bar')
    })

    it('should validate a value for a key', () => {
        const container1 = new Container().provideValue('foo', 'bar')

        expect(() => {
            container1.validateValueForKey('foo', 42)
        }).toThrow(`Dependency 'foo' was configured with type 'string' but value of type 'number' was provided`)
    })

    it('should resolve interface implementations', () => {
        interface IMyThing {
            message: string
        }
        const global: IMyThing = {
            message: 'Hello',
        }

        const container1 = new Container().provideValue('my-thing', global)

        const container2 = container1.provideValue('my-thing', {
            message: 'Hello World',
        })

        const test = container2.resolve('my-thing')

        expect(test.message).toBe('Hello World')
    })

    it('should be able to add and resolve factories', () => {
        const container1 = new Container()
            .provideFactory('foo', () => 'bar')
            .provideValue('v1', 'Hello')
            .provideValue('v2', 42)
            .provideValue('v3', 20)

        const value = container1.resolve('foo')

        expect(value).toBe('bar')

        const container2 = container1
            .provideFactory('baz', () => 'qux')
            .provideFactory('quux', () => 'corge')
            .provideFactory('grault', (a1: string, a2: number) => `${a1} ${a2}`, ['v1', 'v2'])
            .provideFactory('garply', (a1: number, a2: number) => a1 + a2, ['v2', 'v3'])

        expect(container2.resolve('foo')).toBe('bar')
        expect(container2.resolve('baz')).toBe('qux')
        expect(container2.resolve('quux')).toBe('corge')
        expect(container2.resolve('grault')).toBe('Hello 42')
        expect(container2.resolve('garply')).toBe(62)
    })

    it('should be able to resolve factories with promises', async () => {
        const container1 = new Container()
            .provideFactory('greeting', async () => 'Hello')
            .provideFactory('name', () => 'World')
            .provideFactory('message', async (greeting: Promise<string>, name: string) => `${await greeting} ${name}`, [
                'greeting',
                'name',
            ])

        const greeting = await container1.resolve('greeting')
        const message = await container1.resolve('message')

        expect(greeting).toBe('Hello')
        expect(message).toBe('Hello World')
    })

    it('should be able to use async factories with first class typing support', async () => {
        const container1 = new Container()
            .provideFactory('name', () => 'World')
            .provideFactory('greeting', async () => 'Hello')
            .provideAsyncFactory('message', async (greeting: string, name: string) => `${greeting} ${name}`, [
                'greeting',
                'name',
            ])

        const message = await container1.resolve('message')

        expect(message).toBe('Hello World')
    })

    it('should be able to cache factory values', async () => {
        const factory = vi.fn(async (greeting: string, name: string) => `${greeting} ${name}`)
        const container = new Container()
            .provideFactory('name', () => 'World')
            .provideFactory('greeting', async () => 'Hello')
            .provideAsyncFactory('message', factory, ['greeting', 'name'])

        const message1 = await container.resolve('message')
        expect(message1).toBe('Hello World')
        expect(factory.mock.calls.length).toBe(1)

        const message2 = await container.resolve('message')
        expect(message2).toBe('Hello World')
        expect(factory.mock.calls.length).toBe(2)

        const message3 = await container.resolve('message', {
            singleton: true,
        })
        expect(message3).toBe('Hello World')
        expect(factory.mock.calls.length).toBe(2)
    })

    it('should be able to prevent a value from populating the cache', async () => {
        const container = new Container().provideFactory('count', () => {
            const randomNumber = Math.random()

            return randomNumber
        })

        const count1 = container.resolve('count', {
            cache: false,
        })

        const count2 = container.resolve('count')
        expect(count1).not.toBe(count2)

        const count3 = container.resolve('count', {
            singleton: true,
        })
        expect(count2).toBe(count3)
    })

    it('should be able to set default resolve options', () => {
        const container1 = new Container().provideFactory('random', () => Math.random(), [], {
            singleton: true,
        })

        const random1 = container1.resolve('random')

        const random2 = container1.resolve('random')

        expect(random1).toBe(random2)

        const container2 = container1.provideFactory('random', () => Math.random())

        const random3 = container2.resolve('random')

        const random4 = container2.resolve('random')

        expect(random3).not.toBe(random4)
    })

    it('should be able to provide classes', () => {
        let instances = 0
        class MyClass {
            constructor(public message = 'Hello') {
                instances = instances + 1
            }
        }

        const container = new Container().provideClass('my-class', MyClass)

        expect(instances).toBe(0)

        const myClass = container.resolve('my-class')

        expect(myClass).toBeInstanceOf(MyClass)
        expect(myClass.message).toBe('Hello')

        const container2 = container
            .provideValue('message', 'Hello DI')
            .provideClass('my-class', MyClass, ['message'])
            .provideClass('singleton', MyClass, ['message'], {
                singleton: true,
            })

        const myClass2 = container2.resolve('my-class')

        expect(myClass2).toBeInstanceOf(MyClass)
        expect(myClass2.message).toBe('Hello DI')
        expect(instances).toBe(2)

        const myClass3 = container2.resolve('my-class', {
            singleton: true,
        })
        expect(myClass3).toBe(myClass2)
        expect(instances).toBe(2)

        const singleton = container2.resolve('singleton')
        expect(singleton).toBeInstanceOf(MyClass)
        expect(singleton.message).toBe('Hello DI')
        expect(instances).toBe(3)

        const singleton2 = container2.resolve('singleton')
        expect(singleton2).toBe(singleton)
        expect(instances).toBe(3)

        const singleton3 = container2.resolve('singleton', {
            singleton: false,
        })
        expect(singleton3).not.toBe(singleton)
        expect(instances).toBe(4)
    })

    it('should be able to provide classes with async dependencies', async () => {
        class MyClass {
            constructor(public message = 'Hello') {}
        }

        const container = new Container()
            .provideValue('name', 'World')
            .provideAsyncFactory('greeting', async (name: string) => `Hello ${name}`, ['name'])
            .provideAsyncClass('my-class', MyClass, ['greeting'])

        const myClassPromise = container.resolve('my-class')
        expect(myClassPromise).toBeInstanceOf(Promise)

        const myClass = await myClassPromise

        expect(myClass).toBeInstanceOf(MyClass)
        expect(myClass.message).toBe('Hello World')
    })

    it('should be able to override factory values', () => {
        const container = new Container().provideFactory('random', () => 0.2).provideValue('random', 0.5)

        const random = container.resolve('random')

        expect(random).toBe(0.5)
    })

    it('should be able to override class values', () => {
        class MyClass {
            constructor(public message = 'Hello') {}
        }

        class MyOtherClass {
            constructor(public message = 'Goodbye') {}
        }

        const container = new Container().provideClass('my-class', MyClass).provideClass('my-class', MyOtherClass)

        const myClass = container.resolve('my-class')

        expect(myClass).toBeInstanceOf(MyOtherClass)
        expect(myClass.message).toBe('Goodbye')
    })

    it('should be able to require dependencies to be provided at a later time', () => {
        const container = new Container()
            .requireDependency('Foo', defer<string>())
            .requireDependency('Bar', defer<number>())

        const fooSchema = container.introspect('Foo')
        const barSchema = container.introspect('Bar')

        expect(fooSchema.deferred).toBe(true)
        expect(barSchema.deferred).toBe(true)

        const container2 = container.fork().provideValue('Foo', 'Hello').provideValue('Bar', 42)

        const foo = container2.resolve('Foo')
        const bar = container2.resolve('Bar')

        expect(foo).toBe('Hello')
        expect(bar).toBe(42)
    })

    it('Should error when resolving a deferred dependency without providing it', () => {
        const container = new Container().requireDependency('Foo', defer<string>())

        expect(() => {
            container.resolve('Foo')
        }).toThrow(`Dependency "Foo" was required but not provided`)
    })

    it('Should return undefined when resolving a deferred dependency in non-strict mode', () => {
        const container = new Container().requireDependency('Foo', defer<string>())

        const foo = container.resolve('Foo', { strict: false })

        expect(foo).toBeUndefined()
    })

    it('Should be able to merge containers with deferred dependencies', () => {
        const module1 = new Container()
            .requireDependency('Name', defer<string>())
            .provideFactory('Greeting', (name: string) => `Hello ${name}`, ['Name'])

        const container = new Container().merge(module1).provideValue('Name', 'World')

        const greeting = container.resolve('Greeting')

        expect(greeting).toBe('Hello World')
    })

    it('should be able to fork a container', () => {
        const container = new Container().provideValue('foo', 'bar')

        const forked = container.fork()

        expect(forked.resolve('foo')).toBe('bar')

        const forked2 = forked.provideValue('foo', 'baz')

        expect(forked2.resolve('foo')).toBe('baz')
        expect(forked.resolve('foo')).toBe('bar')
    })

    it('should be able to merge containers', () => {
        const container1 = new Container().provideValue('foo', 'bar')
        const container2 = new Container().provideValue('baz', 'qux')

        const merged = container1.merge(container2)

        expect(merged.resolve('foo')).toBe('bar')
        expect(merged.resolve('baz')).toBe('qux')
    })

    it('should be able to configure middleware to run on resolve', async () => {
        const container = new Container()
            .provideValue('foo', 'bar')
            .provideAsyncFactory('bex', async () => 42)
            .middleware('foo', (value) => {
                value = 'baz'
                return value
            })
            .middleware('bex', async (value) => {
                return value * 2
            })

        expect(container.resolve('foo')).toBe('baz')
        expect(await container.resolve('bex')).toBe(84)
    })
})
