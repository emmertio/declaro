import { describe, expect, it } from 'vitest'
import { AsyncLocalStorage } from './async-local-storage'

describe('AsyncLocalStorage shim', () => {
    describe('run()', () => {
        it('returns the fn result synchronously', () => {
            const als = new AsyncLocalStorage<number>()
            const result = als.run(1, () => 42)
            expect(result).toBe(42)
        })

        it('returns a Promise when fn is async', async () => {
            const als = new AsyncLocalStorage<string>()
            const result = await als.run('ctx', async () => 'hello')
            expect(result).toBe('hello')
        })

        it('forwards extra args to fn', () => {
            const als = new AsyncLocalStorage<string>()
            const result = als.run('ctx', (a: number, b: number) => a + b, 3, 4)
            expect(result).toBe(7)
        })

        it('getStore() returns the active store inside run()', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('hello', () => {
                expect(als.getStore()).toBe('hello')
            })
        })

        it('getStore() returns undefined outside of run()', () => {
            const als = new AsyncLocalStorage<string>()
            expect(als.getStore()).toBeUndefined()
        })

        it('store is not visible after run() completes', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('hello', () => {})
            expect(als.getStore()).toBeUndefined()
        })

        it('nested run() calls use the innermost store', () => {
            const als = new AsyncLocalStorage<string>()

            als.run('outer', () => {
                expect(als.getStore()).toBe('outer')

                als.run('inner', () => {
                    expect(als.getStore()).toBe('inner')
                })

                expect(als.getStore()).toBe('outer')
            })
        })

        it('restores prior store after nested run() completes', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('outer', () => {
                als.run('inner', () => {})
                expect(als.getStore()).toBe('outer')
            })
            expect(als.getStore()).toBeUndefined()
        })

        it('full lifecycle: undefined → outer → inner → outer → undefined', () => {
            const als = new AsyncLocalStorage<string>()
            const snapshots: (string | undefined)[] = []

            snapshots.push(als.getStore())
            als.run('outer', () => {
                snapshots.push(als.getStore())
                als.run('inner', () => {
                    snapshots.push(als.getStore())
                })
                snapshots.push(als.getStore())
            })
            snapshots.push(als.getStore())

            expect(snapshots).toEqual([undefined, 'outer', 'inner', 'outer', undefined])
        })

        it('restores store even when fn throws', () => {
            const als = new AsyncLocalStorage<string>()
            expect(() =>
                als.run('ctx', () => {
                    throw new Error('boom')
                }),
            ).toThrow('boom')
            expect(als.getStore()).toBeUndefined()
        })

        it('multiple ALS instances are isolated from each other', () => {
            const als1 = new AsyncLocalStorage<string>()
            const als2 = new AsyncLocalStorage<number>()

            als1.run('hello', () => {
                als2.run(42, () => {
                    expect(als1.getStore()).toBe('hello')
                    expect(als2.getStore()).toBe(42)
                })
                expect(als1.getStore()).toBe('hello')
                expect(als2.getStore()).toBeUndefined()
            })
        })
    })

    describe('async usage', () => {
        it('store is accessible at the start of an async fn (before any await)', async () => {
            const als = new AsyncLocalStorage<string>()
            let captured: string | undefined

            await als.run('ctx', async () => {
                // No await yet — still in the synchronous call stack of run()
                captured = als.getStore()
            })

            expect(captured).toBe('ctx')
        })

        it('resolves the returned Promise correctly', async () => {
            const als = new AsyncLocalStorage<string>()
            const result = await als.run('ctx', async () => 'resolved')
            expect(result).toBe('resolved')
        })

        it('propagates rejections correctly', async () => {
            const als = new AsyncLocalStorage<string>()
            await expect(
                als.run('ctx', async () => {
                    throw new Error('async boom')
                }),
            ).rejects.toThrow('async boom')
        })

        it('restores store after an async fn resolves', async () => {
            const als = new AsyncLocalStorage<string>()
            await als.run('ctx', async () => {})
            expect(als.getStore()).toBeUndefined()
        })

        // The shim uses synchronous save/restore. The finally block in run()
        // fires as soon as the async fn returns its Promise — before any
        // awaited microtasks resume. Context is therefore not visible after an
        // await boundary. Native AsyncLocalStorage (Node/Bun) does not have
        // this limitation.
        it('does NOT propagate store across await boundaries (synchronous shim limitation)', async () => {
            const als = new AsyncLocalStorage<string>()
            let captured: string | undefined = 'sentinel'

            await als.run('ctx', async () => {
                await Promise.resolve()
                captured = als.getStore()
            })

            expect(captured).toBeUndefined()
        })

        it('does NOT isolate concurrent async tasks (synchronous shim limitation)', async () => {
            const als = new AsyncLocalStorage<string>()
            const results: (string | undefined)[] = []

            await Promise.all([
                als.run('task-a', async () => {
                    await new Promise<void>((r) => setTimeout(r, 10))
                    results.push(als.getStore())
                }),
                als.run('task-b', async () => {
                    await new Promise<void>((r) => setTimeout(r, 5))
                    results.push(als.getStore())
                }),
            ])

            expect(results).toEqual([undefined, undefined])
        })
    })

    describe('exit()', () => {
        it('clears the store for the duration of fn', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('ctx', () => {
                als.exit(() => {
                    expect(als.getStore()).toBeUndefined()
                })
            })
        })

        it('restores the store after exit() completes', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('ctx', () => {
                als.exit(() => {})
                expect(als.getStore()).toBe('ctx')
            })
        })

        it('restores store even when fn throws', () => {
            const als = new AsyncLocalStorage<string>()
            als.run('ctx', () => {
                expect(() =>
                    als.exit(() => {
                        throw new Error('boom')
                    }),
                ).toThrow('boom')
                expect(als.getStore()).toBe('ctx')
            })
        })
    })

    describe('enterWith()', () => {
        it('sets the store imperatively', () => {
            const als = new AsyncLocalStorage<string>()
            als.enterWith('hello')
            expect(als.getStore()).toBe('hello')
        })

        it('can be overwritten by another enterWith()', () => {
            const als = new AsyncLocalStorage<string>()
            als.enterWith('first')
            als.enterWith('second')
            expect(als.getStore()).toBe('second')
        })
    })

    describe('disable()', () => {
        it('clears the store', () => {
            const als = new AsyncLocalStorage<string>()
            als.enterWith('hello')
            als.disable()
            expect(als.getStore()).toBeUndefined()
        })

        it('has no effect when store is already empty', () => {
            const als = new AsyncLocalStorage<string>()
            als.disable()
            expect(als.getStore()).toBeUndefined()
        })
    })

    describe('AsyncLocalStorage.bind()', () => {
        it('returns the function unchanged', () => {
            const fn = () => 42
            expect(AsyncLocalStorage.bind(fn)).toBe(fn)
        })
    })

    describe('AsyncLocalStorage.snapshot()', () => {
        it('returns a function that calls fn with provided args', () => {
            const run = AsyncLocalStorage.snapshot()
            const result = run((a: number, b: number) => a + b, 3, 4)
            expect(result).toBe(7)
        })

        it('each call to snapshot() returns an independent executor', () => {
            const run1 = AsyncLocalStorage.snapshot()
            const run2 = AsyncLocalStorage.snapshot()
            expect(run1).not.toBe(run2)
        })
    })
})
