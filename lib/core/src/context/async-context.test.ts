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

    describe('nested async contexts (request → event fork)', () => {
        it('full lifecycle: null → outer → inner → outer → null', async () => {
            const requestContext = new Context()
            const eventContext = new Context()
            const snapshots: (Context | null)[] = []

            // Before any withContext
            snapshots.push(useContext())

            await withContext(requestContext, async () => {
                // Inside request context
                snapshots.push(useContext())

                await withContext(eventContext, async () => {
                    // Inside forked event context
                    await Promise.resolve()
                    snapshots.push(useContext())
                })

                // Back in request context after event completes
                snapshots.push(useContext())
            })

            // After all withContext blocks
            snapshots.push(useContext())

            expect(snapshots).toEqual([null, requestContext, eventContext, requestContext, null])
        })

        it('concurrent async tasks each see their own context independently', async () => {
            const requestContext = new Context()
            const eventContext = new Context()
            const requestSnapshots: (Context | null)[] = []
            const eventSnapshots: (Context | null)[] = []

            // Simulate a request handler and an event handler running concurrently
            await Promise.all([
                withContext(requestContext, async () => {
                    requestSnapshots.push(useContext())
                    await new Promise((resolve) => setTimeout(resolve, 10))
                    requestSnapshots.push(useContext())
                }),
                withContext(eventContext, async () => {
                    eventSnapshots.push(useContext())
                    await new Promise((resolve) => setTimeout(resolve, 5))
                    eventSnapshots.push(useContext())
                }),
            ])

            expect(requestSnapshots).toEqual([requestContext, requestContext])
            expect(eventSnapshots).toEqual([eventContext, eventContext])
        })

        it('inner withContext with forked context does not bleed into outer after completion', async () => {
            const requestContext = new Context()
            const eventContext = new Context()

            await withContext(requestContext, async () => {
                // Fire-and-forget style: event runs in its own context
                const eventDone = withContext(eventContext, async () => {
                    await Promise.resolve()
                    expect(useContext()).toBe(eventContext)
                })

                // The outer context is unaffected while event runs
                expect(useContext()).toBe(requestContext)

                await eventDone

                // Still unaffected after event finishes
                expect(useContext()).toBe(requestContext)
            })

            expect(useContext()).toBeNull()
        })
    })
})
