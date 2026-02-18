import { describe, expect, it } from 'vitest'
import { Context } from './context'
import { useContext, withContext } from './async-context'

describe('withContext / useContext', () => {
    it('returns the fn result synchronously', () => {
        const context = new Context()
        const result = withContext(context, () => 42)
        expect(result).toBe(42)
    })

    it('returns the fn result asynchronously', async () => {
        const context = new Context()
        const result = await withContext(context, async () => 'hello')
        expect(result).toBe('hello')
    })

    it('useContext() returns the active context inside withContext', () => {
        const context = new Context()
        withContext(context, () => {
            expect(useContext()).toBe(context)
        })
    })

    it('useContext() returns the active context inside async withContext', async () => {
        const context = new Context()
        await withContext(context, async () => {
            await Promise.resolve()
            expect(useContext()).toBe(context)
        })
    })

    it('useContext() returns null outside of withContext', () => {
        expect(useContext()).toBeNull()
    })

    it('useContext({ strict: true }) throws outside of withContext', () => {
        expect(() => useContext({ strict: true })).toThrow(
            'useContext() was called outside of an active context'
        )
    })

    it('useContext({ strict: true }) returns context inside withContext', () => {
        const context = new Context()
        withContext(context, () => {
            expect(useContext({ strict: true })).toBe(context)
        })
    })

    it('nested withContext calls use the innermost context', () => {
        const outer = new Context()
        const inner = new Context()

        withContext(outer, () => {
            expect(useContext()).toBe(outer)

            withContext(inner, () => {
                expect(useContext()).toBe(inner)
            })

            expect(useContext()).toBe(outer)
        })
    })

    it('context is not visible after withContext completes', () => {
        const context = new Context()
        withContext(context, () => {})
        expect(useContext()).toBeNull()
    })

    it('context propagates across async boundaries', async () => {
        const context = new Context()
        const results: (Context | null)[] = []

        await withContext(context, async () => {
            results.push(useContext())
            await new Promise((resolve) => setTimeout(resolve, 0))
            results.push(useContext())
        })

        expect(results).toEqual([context, context])
    })
})
