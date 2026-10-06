import {
    Context,
    createRequestContext,
    useContext,
    useDeclaro,
    withContext,
    type DeclaroScope,
    type Request,
} from '@declaro/core'
import { afterEach, describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { rollbackEachTest, rollbackTest, withRollback, type RollbackTestHooks } from './test-rollback'
import { Transaction } from './transaction'
import { transactionModule } from './transaction-module'
import { TransactionStack } from './transaction-stack'

const request = { headers: {} } as unknown as Request

/**
 * An app context set up like a real app: `useDeclaro()` and `transactionModule()` with a mock adapter.
 */
const setup = async () => {
    const adapter = new MockTransactionAdapter()
    const app = new Context<DeclaroScope & ITransactionScope>()
    await app.use(useDeclaro(), transactionModule({ adapter }))
    return { adapter, app }
}

const log = (adapter: MockTransactionAdapter) =>
    adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)

const logById = (adapter: MockTransactionAdapter) =>
    adapter.operations.map(({ operation, transactionId }) => `${operation}#${transactionId}`)

/**
 * Fake `beforeEach` and `afterEach` registrars that capture the hooks, and run one simulated test between them.
 */
const fakeHooks = () => {
    const before: Array<() => Promise<void>> = []
    const after: Array<() => Promise<void>> = []
    const hooks: RollbackTestHooks = {
        beforeEach: (hook) => before.push(hook),
        afterEach: (hook) => after.push(hook),
    }
    const runTest = async (body: () => Promise<void>) => {
        for (const hook of before) await hook()
        try {
            await body()
        } finally {
            for (const hook of after) await hook()
        }
    }
    return { hooks, runTest, registered: () => before.length + after.length }
}

describe('withRollback', () => {
    it('runs the body in the context, rolls back after it resolves, and returns its result', async () => {
        const { adapter, app } = await setup()
        let seen: ITransaction | undefined

        const result = await withRollback(app, async (transaction) => {
            expect(useContext()).toBe(app)
            seen = useTransaction()
            expect(seen).toBe(transaction)
            expect(transaction.depth).toBe(0)
            return 42
        })

        expect(result).toBe(42)
        expect(seen?.status).toBe(TransactionStatus.RolledBack)
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('rolls back and rethrows when the test body throws', async () => {
        const { adapter, app } = await setup()

        await expect(
            withRollback(app, async () => {
                throw new Error('assertion failed')
            }),
        ).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('throws an AggregateError when the body throws and the rollback fails too', async () => {
        const { adapter, app } = await setup()

        const error = await withRollback(app, async () => {
            adapter.failures.rollback = true
            throw new Error('assertion failed')
        }).catch((caught: unknown) => caught)

        expect(error).toBeInstanceOf(AggregateError)
        expect((error as AggregateError).errors.map((inner: Error) => inner.message)).toEqual([
            'assertion failed',
            'Mock rollback failure',
        ])
    })

    it('undoes nested commits in the final top-level rollback', async () => {
        const { adapter, app } = await setup()

        await withRollback(app, async () => {
            await Transaction.run(async () => {
                await Transaction.run(async () => {})
            })
        })

        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'begin@2', 'commit@2', 'commit@1', 'rollback@0'])
    })

    it('cascades the rollback to transactions the body left open', async () => {
        const { adapter, app } = await setup()
        let leftOpen: ITransaction | undefined

        await withRollback(app, async () => {
            leftOpen = await Transaction.begin()
        })

        expect(leftOpen?.status).toBe(TransactionStatus.RolledBack)
        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'rollback@1', 'rollback@0'])
    })

    it('nests a request created from the context in the test transaction', async () => {
        const { adapter, app } = await setup()

        await withRollback(app, async (transaction) => {
            const requestContext = await createRequestContext(app, request)
            await withContext(requestContext, async () => {
                expect(useTransaction()).toBe(transaction)
                await Transaction.begin()
            })
        })

        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'rollback@1', 'rollback@0'])
    })

    it('never runs afterCommit callbacks registered in the test', async () => {
        const { app } = await setup()
        const ran: string[] = []

        await withRollback(app, async (transaction) => {
            transaction.afterCommit(() => ran.push('outer'))
            await Transaction.run(async (nested) => {
                nested.afterCommit(() => ran.push('nested'))
            })
        })

        expect(ran).toEqual([])
    })

    it('lets code that starts its own top-level transaction escape the rollback', async () => {
        const { adapter, app } = await setup()

        await withRollback(app, async () => {
            await Transaction.run(async () => {}, { parent: null })
        })

        expect(logById(adapter)).toEqual(['begin#1', 'begin#2', 'commit#2', 'rollback#1'])
    })

    it('throws if the test body commits its own transaction', async () => {
        const { adapter, app } = await setup()

        await expect(withRollback(app, (transaction) => transaction.commit())).rejects.toThrow(
            'The test committed its own transaction',
        )
        expect(log(adapter)).toEqual(['begin@0', 'commit@0'])
    })

    it('is top-level and restores the previous stack registration afterwards', async () => {
        const { adapter, app } = await setup()
        const stack = new TransactionStack()
        app.registerValue('transactionStack', stack)
        const outer = await Transaction.begin({ context: app })

        await withRollback(app, async (transaction) => {
            expect(transaction.parent).toBeUndefined()
            expect(app.resolve('transactionStack')).not.toBe(stack)
        })

        expect(app.resolve('transactionStack')).toBe(stack)
        expect(withContext(app, () => useTransaction())).toBe(outer)
        await outer.rollback()
        expect(log(adapter)).toEqual(['begin@0', 'begin@0', 'rollback@0', 'rollback@0'])
    })

    it('leaves an empty stack registered when the context had none', async () => {
        const { app } = await setup()
        expect(app.resolve('transactionStack')).toBeUndefined()

        await withRollback(app, async () => {})

        expect(app.resolve('transactionStack')?.current).toBeUndefined()
        expect(app.resolve('transactionStack')?.size).toBe(0)
    })

    it('only accepts a context typed with the transaction scope', () => {
        const untyped = new Context<{ name: string }>()
        // @ts-expect-error The context's scope has no transactionAdapter or transactionStack.
        expect(() => rollbackTest(untyped, async () => {})).not.toThrow()
    })

    it('throws, and keeps the context unchanged, when no adapter is registered', async () => {
        const context = new Context<ITransactionScope>()
        const stack = new TransactionStack()
        context.registerValue('transactionStack', stack)

        await expect(withRollback(context, async () => {})).rejects.toThrow()
        expect(context.resolve('transactionStack')).toBe(stack)
    })
})

describe('rollbackTest', () => {
    it('returns an argument-less test function that runs the body through withRollback', async () => {
        const { adapter, app } = await setup()
        const test = rollbackTest(app, async () => {
            expect(useContext()).toBe(app)
            return 'done'
        })

        expect(test.length).toBe(0)
        expect(adapter.operations).toEqual([])
        expect(await test()).toBe('done')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('rolls back and rethrows when the test body throws', async () => {
        const { adapter, app } = await setup()
        const test = rollbackTest(app, async () => {
            throw new Error('assertion failed')
        })

        await expect(test()).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })
})

describe('rollbackEachTest', () => {
    describe('hooks', () => {
        const globals = globalThis as { beforeEach?: unknown; afterEach?: unknown }
        const original = { beforeEach: globals.beforeEach, afterEach: globals.afterEach }
        const hasOriginal = { beforeEach: 'beforeEach' in globals, afterEach: 'afterEach' in globals }

        afterEach(() => {
            for (const key of ['beforeEach', 'afterEach'] as const) {
                if (hasOriginal[key]) {
                    globals[key] = original[key]
                } else {
                    delete globals[key]
                }
            }
        })

        it('registers through the global beforeEach and afterEach by default', async () => {
            const { adapter, app } = await setup()
            const { hooks, runTest } = fakeHooks()
            globals.beforeEach = hooks.beforeEach
            globals.afterEach = hooks.afterEach

            const suite = rollbackEachTest(app)
            await runTest(async () => {
                expect(suite.transaction.status).toBe(TransactionStatus.Active)
            })

            expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
        })

        it('registers through the hooks option instead of the globals when passed', async () => {
            const { adapter, app } = await setup()
            const global = fakeHooks()
            const explicit = fakeHooks()
            globals.beforeEach = global.hooks.beforeEach
            globals.afterEach = global.hooks.afterEach

            rollbackEachTest(app, { hooks: explicit.hooks })
            await explicit.runTest(async () => {})

            expect(global.registered()).toBe(0)
            expect(explicit.registered()).toBe(2)
            expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
        })

        it('throws a clear error when there are neither global hooks nor a hooks option', async () => {
            const { app } = await setup()
            delete globals.beforeEach
            delete globals.afterEach

            expect(() => rollbackEachTest(app)).toThrow(
                'rollbackEachTest() found no global beforeEach and afterEach. Pass them with rollbackEachTest(context, { hooks: { beforeEach, afterEach } })',
            )
            expect(() => rollbackEachTest(app)).toThrow('Vitest: globals: true')
        })
    })

    it('begins a transaction on the context before each test and rolls it back after', async () => {
        const { adapter, app } = await setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(app, { hooks })
        const seen: ITransaction[] = []

        for (let i = 0; i < 2; i++) {
            await runTest(() =>
                withContext(app, async () => {
                    expect(useTransaction()).toBe(suite.transaction)
                    seen.push(suite.transaction)
                    await Transaction.run(async (nested) => {
                        expect(nested.parent).toBe(suite.transaction)
                    })
                }),
            )
        }

        expect(seen[0]).not.toBe(seen[1])
        expect(seen.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.RolledBack,
            TransactionStatus.RolledBack,
        ])
        expect(log(adapter)).toEqual([
            'begin@0',
            'begin@1',
            'commit@1',
            'rollback@0',
            'begin@0',
            'begin@1',
            'commit@1',
            'rollback@0',
        ])
        expect(() => suite.transaction).toThrow('No test transaction is active')
    })

    it('rolls back when the test body throws', async () => {
        const { adapter, app } = await setup()
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })

        await expect(
            runTest(() =>
                withContext(app, async () => {
                    await Transaction.begin()
                    throw new Error('assertion failed')
                }),
            ),
        ).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'rollback@1', 'rollback@0'])
    })

    it('cascades the rollback to transactions the test left open', async () => {
        const { adapter, app } = await setup()
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })
        let leftOpen: ITransaction | undefined

        await runTest(() =>
            withContext(app, async () => {
                leftOpen = await Transaction.begin()
                await Transaction.begin()
            }),
        )

        expect(leftOpen?.status).toBe(TransactionStatus.RolledBack)
        expect(app.resolve('transactionStack')?.size).toBe(0)
        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'begin@2', 'rollback@2', 'rollback@1', 'rollback@0'])
    })

    it('nests a request created from the context in the test transaction, and rolls it back with it', async () => {
        const { adapter, app } = await setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(app, { hooks })
        const begun: ITransaction[] = []

        await runTest(async () => {
            const requestContext = await createRequestContext(app, request)

            await withContext(requestContext, async () => {
                expect(useTransaction()).toBe(suite.transaction)

                // A transaction the request commits only saves into the test transaction.
                await Transaction.run(async (transaction) => {
                    begun.push(transaction)
                    expect(transaction.parent).toBe(suite.transaction)
                })

                // A transaction the request leaves open is rolled back with the test transaction.
                const leftOpen = await Transaction.begin()
                begun.push(leftOpen)
                expect(leftOpen.parent).toBe(suite.transaction)
                begun.push(await Transaction.begin())
            })
        })

        expect(begun.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.Committed,
            TransactionStatus.RolledBack,
            TransactionStatus.RolledBack,
        ])
        expect(log(adapter)).toEqual([
            'begin@0',
            'begin@1',
            'commit@1',
            'begin@1',
            'begin@2',
            'rollback@2',
            'rollback@1',
            'rollback@0',
        ])
    })

    it('never runs afterCommit callbacks registered in the test', async () => {
        const { app } = await setup()
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })
        const ran: string[] = []

        await runTest(() =>
            withContext(app, async () => {
                useTransaction().afterCommit(() => ran.push('outer'))
                await Transaction.run(async (nested) => {
                    nested.afterCommit(() => ran.push('nested'))
                })
            }),
        )

        expect(ran).toEqual([])
    })

    it('lets code that starts its own top-level transaction escape the rollback', async () => {
        const { adapter, app } = await setup()
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })

        await runTest(async () => {
            await withContext(app, () => Transaction.run(async () => {}, { parent: null }))
            // In a context unrelated to the app context, the test's transaction isn't current either.
            await Transaction.run(async () => {}, { adapter })
        })

        expect(logById(adapter)).toEqual(['begin#1', 'begin#2', 'commit#2', 'begin#3', 'commit#3', 'rollback#1'])
    })

    it('throws from afterEach if the test committed its own transaction', async () => {
        const { app } = await setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(app, { hooks })

        await expect(runTest(() => suite.transaction.commit())).rejects.toThrow(
            'The test committed its own transaction',
        )
    })

    it('throws from beforeEach when the context has no adapter', async () => {
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(new Context<ITransactionScope>(), { hooks })

        await expect(runTest(async () => {})).rejects.toThrow()
    })

    it('leaves an empty stack on the context after a test when it had none', async () => {
        const { app } = await setup()
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })

        await runTest(async () => {
            await withContext(app, () => Transaction.begin())
        })

        expect(app.resolve('transactionStack')?.size).toBe(0)
        expect(() => withContext(app, () => useTransaction())).toThrow('No transaction is active')
    })

    it('restores the previous stack registration after each test', async () => {
        const { app } = await setup()
        const stack = new TransactionStack()
        app.registerValue('transactionStack', stack)
        const { hooks, runTest } = fakeHooks()
        rollbackEachTest(app, { hooks })

        await runTest(async () => {
            expect(app.resolve('transactionStack')).not.toBe(stack)
        })

        expect(app.resolve('transactionStack')).toBe(stack)
    })
})
