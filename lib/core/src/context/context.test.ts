import { Context } from '.'
import { sleep } from '../timing'
import { ContextConsumer } from './context-consumer'
import { describe, it, vi } from 'vitest'

describe('Context', () => {
    it('Should allow simple value dependency injection', async ({ expect }) => {
        const context = new Context()

        context.provide('test', 'Hello World')

        const message = context.inject('test')

        expect(message).toBe('Hello World')

        const TEST_KEY = Symbol()
        context.provide(TEST_KEY, 42)

        const number = context.inject(TEST_KEY)
        expect(number).toBe(42)
    })

    it('Should allow subscription to arbitrary events', async ({ expect }) => {
        const customEventCall = vi.fn()

        const context = new Context()
        context.provide('test', 'Hello World')
        expect(customEventCall.mock.calls.length).toBe(0)

        context.on('customEvent', async (ctx, arg1, arg2, arg3) => {
            customEventCall()
            const message = await ctx.inject('test')
            expect(message).toBe('Hello World')
            expect(arg1).toBe(1)
            expect(arg2).toBe(2)
            expect(arg3).toBe(3)
        })

        await context.emit('customEvent', 1, 2, 3)

        expect(customEventCall.mock.calls.length).toBe(1)
    })

    it('Should extend other contexts', async ({ expect }) => {
        const context1 = new Context()
        const context2 = new Context()
        const context3 = new Context()

        const SYMBOL_KEY = Symbol()

        context1.provide('a', 1)
        context1.provide('c', 1)
        context2.provide('b', 2)
        context2.provide('c', 2)
        context2.provide(SYMBOL_KEY, 42)
        context3.provide('c', 3)

        context1.extend(context2, context3)

        const a = context1.inject('a')
        const b = context1.inject('b')
        const c = context1.inject('c')
        const symbolValue = context1.inject(SYMBOL_KEY)

        expect(a).toBe(1)
        expect(b).toBe(2)
        expect(c).toBe(3)
        expect(symbolValue).toBe(42)
    })

    it('Should nest contexts', async ({ expect }) => {
        const context1 = new Context()
        const context2 = new Context()

        context1.provide('a', 1)
        context2.provide('a', 2)

        context1.provide('nested', context2)

        const a1 = context1.inject('a')
        const a2 = context1.inject<Context>('nested')?.inject('a')

        expect(a1).toBe(1)
        expect(a2).toBe(2)
    })

    it('Should allow async middleware', async ({ expect }) => {
        const context = new Context()

        await context.use(async (context) => {
            context.provide('TEST1', 'Hello World')
            await sleep(1)
            context.provide('TEST2', 'Hello Test')
        })

        const test1 = context.inject('TEST1')
        const test2 = context.inject('TEST2')
        expect(test1).toBe('Hello World')
        expect(test2).toBe('Hello Test')
    })

    it('Should allow singletons', ({ expect }) => {
        const context = new Context()

        const KEY = Symbol()
        let instance = context.singleton(KEY, 1)
        instance = context.singleton(KEY, 2)
        instance = context.singleton(KEY, 3)

        expect(instance).toBe(1)
    })

    it('Should allow hydration', ({ expect }) => {
        const context = new Context()

        class Test extends ContextConsumer {
            constructor(public context: Context) {
                super(context)
            }

            test() {
                return 'Yes'
            }
        }

        expect(context.hydrate(Test).test()).toBe('Yes')
    })

    it('Should allow hydration with args', ({ expect }) => {
        const context = new Context()

        class Test extends ContextConsumer {
            constructor(public context: Context, foo: string, bar: number) {
                super(context)
            }

            test() {
                return 'Yes'
            }
        }

        expect(context.hydrate(Test, 'hello', 42).test()).toBe('Yes')
    })
})
