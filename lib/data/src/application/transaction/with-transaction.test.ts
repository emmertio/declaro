import { Context, withContext } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus } from '../../domain/transaction/transaction-adapter-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { withTransaction, wrapWithTransaction } from './with-transaction'

describe('withTransaction', () => {
    let context: Context<ITransactionScope>
    let created: MockTransactionAdapter[]

    beforeEach(() => {
        created = []
        context = new Context<ITransactionScope>()
        context.registerValue('createTransaction', () => {
            const transaction = new MockTransactionAdapter()
            created.push(transaction)
            return transaction
        })
    })

    it('throws outside of a context', async () => {
        await expect(withTransaction(async () => {})).rejects.toThrow('outside of an active context')
    })

    it('throws when it needs a new transaction and no factory is registered', async () => {
        await expect(withTransaction(async () => {}, { context: new Context() })).rejects.toThrow(
            'No transaction factory was found',
        )
    })

    it('creates, commits, and binds a top-level transaction', async () => {
        const result = await withContext(context, () =>
            withTransaction(async (transaction) => {
                expect(await useTransaction()).toBe(transaction)
                return 42
            }),
        )

        expect(result).toBe(42)
        expect(created).toHaveLength(1)
        expect(created[0]!.status).toBe(TransactionStatus.Committed)
    })

    it('accepts an explicit context instead of the ambient one', async () => {
        await withTransaction(async () => {}, { context })

        expect(created[0]!.status).toBe(TransactionStatus.Committed)
    })

    it('does not bind the transaction outside the callback', async () => {
        await withContext(context, async () => {
            await withTransaction(async () => {})
            await expect(useTransaction()).rejects.toThrow('No transaction was found')
        })
    })

    it('nests when a transaction is already active', async () => {
        await withContext(context, () =>
            withTransaction(async (outer) => {
                await withTransaction(async (nested) => {
                    expect(nested.parent).toBe(outer)
                    expect(await useTransaction()).toBe(nested)
                })

                expect(await useTransaction()).toBe(outer)
            }),
        )

        expect(created).toHaveLength(1)
        expect(created[0]!.operations.map((op) => `${op.operation}@${op.depth}`)).toEqual([
            'begin@0',
            'begin@1',
            'commit@1',
            'commit@0',
        ])
    })

    it('uses a pending transaction already bound to the context', async () => {
        const pending = new MockTransactionAdapter()
        context.registerValue('transaction', Promise.resolve(pending))

        await withContext(context, () =>
            withTransaction(async (transaction) => {
                expect(transaction).toBe(pending)
            }),
        )

        expect(pending.status).toBe(TransactionStatus.Committed)
        expect(created).toHaveLength(0)
    })

    it('creates a new transaction when the bound one has finished', async () => {
        const finished = new MockTransactionAdapter()
        await finished.run(async () => {})
        context.registerValue('transaction', Promise.resolve(finished))

        await withContext(context, () =>
            withTransaction(async (transaction) => {
                expect(transaction).toBe(created[0]!)
            }),
        )

        expect(created).toHaveLength(1)
    })

    it('keeps concurrent transactions separate', async () => {
        const seen = await withContext(context, () =>
            Promise.all(
                [1, 2].map((n) =>
                    withTransaction(async (transaction) => {
                        await new Promise((resolve) => setTimeout(resolve, 5 * n))
                        return (await useTransaction()) === transaction
                    }),
                ),
            ),
        )

        expect(seen).toEqual([true, true])
        expect(created).toHaveLength(2)
    })
})

describe('wrapWithTransaction', () => {
    it('runs each call in its own transaction and forwards arguments', async () => {
        const created: MockTransactionAdapter[] = []
        const context = new Context<ITransactionScope>()
        context.registerValue('createTransaction', () => {
            const transaction = new MockTransactionAdapter()
            created.push(transaction)
            return transaction
        })

        const add = wrapWithTransaction(async (a: number, b: number) => {
            expect((await useTransaction()).status).toBe(TransactionStatus.Active)
            return a + b
        })

        const results = await withContext(context, async () => [await add(1, 2), await add(3, 4)])

        expect(results).toEqual([3, 7])
        expect(created.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.Committed,
            TransactionStatus.Committed,
        ])
    })
})
