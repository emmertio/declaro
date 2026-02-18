import { AsyncLocalStorage as NativeALS } from 'node:async_hooks'
import { describe, expect, it } from 'vitest'
import { AsyncLocalStorage as ShimALS } from '../shims/async-local-storage'
import {
    type AsyncContextStorage,
    createContextAPI,
    useContext,
    withContext,
} from './async-context'
import { Context } from './context'

// ---------------------------------------------------------------------------
// Shared test suite — sync behavior that works for every storage implementation.
// ---------------------------------------------------------------------------
function sharedContextTests(storage: AsyncContextStorage<Context> | undefined) {
    const { withContext, useContext } = createContextAPI<Context>(storage)

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
}

// ---------------------------------------------------------------------------
// Async propagation suite — only for storage types with true async support
// (native AsyncLocalStorage). The synchronous browser shim cannot propagate
// context across await boundaries.
// ---------------------------------------------------------------------------
function asyncPropagationTests(storage: AsyncContextStorage<Context> | undefined) {
    const { withContext, useContext } = createContextAPI<Context>(storage)

    it('useContext() returns the active context inside async withContext', async () => {
        const context = new Context()
        await withContext(context, async () => {
            await Promise.resolve()
            expect(useContext()).toBe(context)
        })
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

            snapshots.push(useContext())

            await withContext(requestContext, async () => {
                snapshots.push(useContext())

                await withContext(eventContext, async () => {
                    snapshots.push(useContext())
                })

                snapshots.push(useContext())
            })

            snapshots.push(useContext())

            expect(snapshots).toEqual([null, requestContext, eventContext, requestContext, null])
        })

        it('concurrent async tasks each see their own context independently', async () => {
            const requestContext = new Context()
            const eventContext = new Context()
            const requestSnapshots: (Context | null)[] = []
            const eventSnapshots: (Context | null)[] = []

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
                const eventDone = withContext(eventContext, async () => {
                    await Promise.resolve()
                    expect(useContext()).toBe(eventContext)
                })

                expect(useContext()).toBe(requestContext)

                await eventDone

                expect(useContext()).toBe(requestContext)
            })

            expect(useContext()).toBeNull()
        })
    })
}

// ---------------------------------------------------------------------------
// Native AsyncLocalStorage — full async propagation
// ---------------------------------------------------------------------------
describe('withContext / useContext (native AsyncLocalStorage)', () => {
    sharedContextTests(new NativeALS<Context>())
    asyncPropagationTests(new NativeALS<Context>())

    // These tests exercise Context.emit() which calls the module-level
    // withContext (always native). They verify the framework integration and
    // are only meaningful with true async propagation.
    describe('typed scopes with event listeners', () => {
        interface AppScope {
            foo: string
            bar: number
        }

        interface RequestScope extends AppScope {
            baz: boolean
        }

        it("event listener receives the emitter's context, not the registration context", async () => {
            const appContext = new Context<AppScope>()

            let capturedViaALS: Context | null = null
            let capturedViaArg: Context | null = null

            appContext.on('testEvent', async (listenerContext) => {
                capturedViaArg = listenerContext
                capturedViaALS = useContext()
            })

            const requestContext = new Context<RequestScope>().extend(appContext)

            await withContext(appContext, async () => {
                await withContext(requestContext, async () => {
                    await requestContext.emit('testEvent')
                })
            })

            expect(capturedViaArg).toBe(requestContext)
            expect(capturedViaALS).toBe(requestContext)
        })

        it('useContext() returns the correct typed context across nested scopes', async () => {
            const appContext = new Context<AppScope>()
            appContext.registerValue('foo', 'hello')
            appContext.registerValue('bar', 42)

            const snapshots: (Context | null)[] = []

            appContext.on('testEvent', async () => {
                snapshots.push(useContext())
            })

            const requestContext = new Context<RequestScope>().extend(appContext)
            requestContext.registerValue('baz', true)

            await withContext(appContext, async () => {
                snapshots.push(useContext())

                await withContext(requestContext, async () => {
                    snapshots.push(useContext())
                    await requestContext.emit('testEvent')
                })

                snapshots.push(useContext())
            })

            expect(snapshots).toEqual([appContext, requestContext, requestContext, appContext])
        })

        it('useContext<RequestScope>() narrows the type inside the request scope', async () => {
            const appContext = new Context<AppScope>()

            let resolvedBaz: boolean | undefined

            appContext.on('testEvent', async () => {
                const ctx = useContext<Context<RequestScope>>()
                resolvedBaz = ctx?.resolve('baz')
            })

            const requestContext = new Context<RequestScope>().extend(appContext)
            requestContext.registerValue('baz', true)

            await withContext(requestContext, async () => {
                await requestContext.emit('testEvent')
            })

            expect(resolvedBaz).toBe(true)
        })

        it('strict useContext() succeeds inside a listener because emit sets the context', async () => {
            const appContext = new Context<AppScope>()
            let capturedContext: Context | null = null

            appContext.on('testEvent', async () => {
                capturedContext = useContext({ strict: true })
            })

            await appContext.emit('testEvent')

            expect(capturedContext).toBe(appContext)
        })
    })
})

// ---------------------------------------------------------------------------
// Browser shim — synchronous propagation only.
// Context is available within the synchronous call stack of withContext, but
// is not propagated across await boundaries. This is expected and correct for
// browser environments where native async hooks are unavailable.
// ---------------------------------------------------------------------------
describe('withContext / useContext (browser shim AsyncLocalStorage)', () => {
    sharedContextTests(new ShimALS<Context>())

    const { withContext, useContext } = createContextAPI<Context>(new ShimALS<Context>())

    describe('async behavior (sync-only shim)', () => {
        it('context is available at the start of an async fn before any await', async () => {
            const context = new Context()
            let captured: Context | null = null

            await withContext(context, async () => {
                captured = useContext()
            })

            expect(captured).toBe(context)
        })

        it('context is not available after an await boundary (expected shim behavior)', async () => {
            const context = new Context()
            let captured: Context | null | 'sentinel' = 'sentinel'

            await withContext(context, async () => {
                await Promise.resolve()
                captured = useContext()
            })

            expect(captured).toBeNull()
        })

        it('full lifecycle: null → outer → inner → null → null (sync-only)', async () => {
            const requestContext = new Context()
            const eventContext = new Context()
            const snapshots: (Context | null)[] = []

            snapshots.push(useContext())

            await withContext(requestContext, async () => {
                snapshots.push(useContext())

                await withContext(eventContext, async () => {
                    snapshots.push(useContext())
                })

                snapshots.push(useContext())
            })

            snapshots.push(useContext())

            // The shim restores context synchronously when run() exits.
            // After awaiting the inner withContext, the outer context is gone.
            expect(snapshots).toEqual([null, requestContext, eventContext, null, null])
        })
    })
})

// ---------------------------------------------------------------------------
// Default storage — no storage argument; createContextAPI creates its own
// AsyncLocalStorage internally. In browser builds this resolves to the shim.
// In Node/Bun (where tests run) it resolves to native AsyncLocalStorage.
// ---------------------------------------------------------------------------
describe('withContext / useContext (default storage)', () => {
    sharedContextTests(undefined)
    asyncPropagationTests(undefined)
})
