import { Context, withContext } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { rollbackEachTest, rollbackTest, withRollback, type RollbackTestHooks } from './test-rollback'
import { Transaction } from './transaction'

const setup = () => {
    const adapter = new MockTransactionAdapter()
    const app = new Context<ITransactionScope>()
    app.registerValue('transactionAdapter', adapter)
    return { adapter, app }
}

const log = (adapter: MockTransactionAdapter) =>
    adapter.operations.map(({ operation, depth }) => `${operation}@${depth}`)

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
    return { hooks, runTest }
}

describe('withRollback', () => {
    it('rolls back after the test body resolves, and returns its result', async () => {
        const { adapter, app } = setup()
        let seen: ITransaction | undefined

        const result = await withRollback(
            async (transaction) => {
                seen = useTransaction()
                expect(seen).toBe(transaction)
                expect(transaction.depth).toBe(0)
                return 42
            },
            { context: app },
        )

        expect(result).toBe(42)
        expect(seen?.status).toBe(TransactionStatus.RolledBack)
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('rolls back and rethrows when the test body throws', async () => {
        const { adapter } = setup()

        await expect(
            withRollback(
                async () => {
                    throw new Error('assertion failed')
                },
                { adapter },
            ),
        ).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('is top-level by default, even inside another transaction', async () => {
        const { adapter, app } = setup()

        await withContext(app, () =>
            Transaction.run(async () => {
                await withRollback(async (transaction) => {
                    expect(transaction.parent).toBeUndefined()
                })
            }),
        )

        expect(log(adapter)).toEqual(['begin@0', 'begin@0', 'rollback@0', 'commit@0'])
    })

    it('undoes nested commits in the final top-level rollback', async () => {
        const { adapter, app } = setup()

        await withRollback(
            async () => {
                await Transaction.run(async () => {
                    await Transaction.run(async () => {})
                })
            },
            { context: app },
        )

        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'begin@2', 'commit@2', 'commit@1', 'rollback@0'])
    })

    it('never runs afterCommit callbacks registered in the test', async () => {
        const { app } = setup()
        const ran: string[] = []

        await withRollback(
            async (transaction) => {
                transaction.afterCommit(() => ran.push('outer'))
                await Transaction.run(async (nested) => {
                    nested.afterCommit(() => ran.push('nested'))
                })
            },
            { context: app },
        )

        expect(ran).toEqual([])
    })

    it('lets code that starts its own top-level transaction escape the rollback', async () => {
        const { adapter, app } = setup()

        await withRollback(
            async () => {
                await Transaction.run(async () => {}, { parent: null })
            },
            { context: app },
        )

        expect(log(adapter)).toEqual(['begin@0', 'begin@0', 'commit@0', 'rollback@0'])
        expect(adapter.operations.map(({ operation, transactionId }) => `${operation}#${transactionId}`)).toEqual([
            'begin#1',
            'begin#2',
            'commit#2',
            'rollback#1',
        ])
    })

    it('throws if the test body commits its own transaction', async () => {
        const { adapter } = setup()

        await expect(withRollback((transaction) => transaction.commit(), { adapter })).rejects.toThrow(
            'The test committed its own transaction',
        )
        expect(log(adapter)).toEqual(['begin@0', 'commit@0'])
    })
})

describe('rollbackTest', () => {
    it('returns an argument-less test function that runs the body through withRollback', async () => {
        const { adapter } = setup()
        const test = rollbackTest(async () => 'done', { adapter })

        expect(test.length).toBe(0)
        expect(adapter.operations).toEqual([])
        expect(await test()).toBe('done')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('rolls back and rethrows when the test body throws', async () => {
        const { adapter } = setup()
        const test = rollbackTest(
            async () => {
                throw new Error('assertion failed')
            },
            { adapter },
        )

        await expect(test()).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })
})

describe('rollbackEachTest', () => {
    it('registers hooks that begin a transaction before each test and roll it back after', async () => {
        const { adapter, app } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { context: app })
        const seen: ITransaction[] = []

        for (let i = 0; i < 2; i++) {
            await runTest(() =>
                withContext(suite.context, async () => {
                    expect(useTransaction()).toBe(suite.transaction)
                    seen.push(suite.transaction)
                    await Transaction.run(async () => {})
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
        const { adapter } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { adapter })

        await expect(
            runTest(() =>
                withContext(suite.context, async () => {
                    throw new Error('assertion failed')
                }),
            ),
        ).rejects.toThrow('assertion failed')
        expect(log(adapter)).toEqual(['begin@0', 'rollback@0'])
    })

    it('cascades the rollback to transactions the test left open', async () => {
        const { adapter, app } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { context: app })
        let leftOpen: ITransaction | undefined

        await runTest(() =>
            withContext(suite.context, async () => {
                leftOpen = await Transaction.begin()
                await Transaction.begin()
            }),
        )

        expect(leftOpen?.status).toBe(TransactionStatus.RolledBack)
        expect(suite.context.resolve('transactionStack')?.size).toBe(0)
        expect(log(adapter)).toEqual(['begin@0', 'begin@1', 'begin@2', 'rollback@2', 'rollback@1', 'rollback@0'])
    })

    it('never runs afterCommit callbacks registered in the test', async () => {
        const { app } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { context: app })
        const ran: string[] = []

        await runTest(() =>
            withContext(suite.context, async () => {
                useTransaction().afterCommit(() => ran.push('outer'))
                await Transaction.run(async (nested) => {
                    nested.afterCommit(() => ran.push('nested'))
                })
            }),
        )

        expect(ran).toEqual([])
    })

    it('lets code that starts its own top-level transaction escape the rollback', async () => {
        const { adapter, app } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { context: app })

        await runTest(async () => {
            await withContext(suite.context, () => Transaction.run(async () => {}, { parent: null }))
            // Outside the test context, the test's transaction isn't current either.
            await Transaction.run(async () => {}, { adapter })
        })

        expect(adapter.operations.map(({ operation, transactionId }) => `${operation}#${transactionId}`)).toEqual([
            'begin#1',
            'begin#2',
            'commit#2',
            'begin#3',
            'commit#3',
            'rollback#1',
        ])
    })

    it('keeps the app context untouched', async () => {
        const { app } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { context: app })

        await runTest(async () => {
            expect(suite.context.resolve('transactionStack')?.current).toBe(suite.transaction)
            expect(app.resolve('transactionStack')).toBeUndefined()
        })
    })

    it('throws from afterEach if the test committed its own transaction', async () => {
        const { adapter } = setup()
        const { hooks, runTest } = fakeHooks()
        const suite = rollbackEachTest(hooks, { adapter })

        await expect(runTest(() => suite.transaction.commit())).rejects.toThrow(
            'The test committed its own transaction',
        )
    })
})
