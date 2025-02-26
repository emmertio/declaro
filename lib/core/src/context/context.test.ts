import { describe, expect, it } from 'vitest'
import { Context } from './context'

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

        await context.emit('declaro:init')

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
        }
        const context = new Context<ScopeA>()

        context.registerValue('bar', 42)
        context.registerValue('name', 'Person')

        type ScopeB = ScopeA & {
            foo: string
        }

        const context2 = new Context<ScopeB>()
        context2.extend(context)

        let factoryInstances = 0

        context2.registerFactory(
            'foo',
            (name: string, bar: number) => {
                factoryInstances = factoryInstances + 1
                return `Hello ${name}, the answer is ${bar}`
            },
            ['name', 'bar'],
        )

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
})
