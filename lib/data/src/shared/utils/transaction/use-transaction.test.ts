import { Context, withContext } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { Transaction } from '../../../application/transaction/transaction'
import { TransactionStack } from '../../../application/transaction/transaction-stack'
import { MockTransactionAdapter } from '../../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../../types/transaction-context'
import { useTransaction } from './use-transaction'

describe('useTransaction', () => {
    const noTransaction =
        'No transaction is active in the current context. Run your code inside Transaction.run(), or begin one with Transaction.begin().'
    let context: Context<ITransactionScope>

    beforeEach(() => {
        context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', new MockTransactionAdapter())
    })

    it('returns the transaction the current run executes in', async () => {
        await withContext(context, () =>
            Transaction.run(async (transaction) => {
                expect(useTransaction()).toBe(transaction)
            }),
        )
    })

    it('returns the nested transaction inside a nested run, and the outer one again after', async () => {
        await withContext(context, () =>
            Transaction.run(async (outer) => {
                expect(useTransaction()).toBe(outer)

                await Transaction.run(async (nested) => {
                    expect(useTransaction()).toBe(nested)
                })

                expect(useTransaction()).toBe(outer)
            }),
        )
    })

    it('returns the top of a manually registered stack', async () => {
        context.registerValue('transactionStack', new TransactionStack())

        await withContext(context, async () => {
            const transaction = await Transaction.begin()
            expect(useTransaction()).toBe(transaction)
            await transaction.commit()
            expect(() => useTransaction()).toThrow(noTransaction)
        })
    })

    it('throws outside of a context', () => {
        expect(() => useTransaction()).toThrow('useTransaction() was called outside of an active context')
    })

    it('throws when there is no stack', () => {
        expect(() => withContext(context, () => useTransaction())).toThrow(noTransaction)
    })

    it('throws when the stack is empty', () => {
        context.registerValue('transactionStack', new TransactionStack())

        expect(() => withContext(context, () => useTransaction())).toThrow(noTransaction)
    })

    it('throws in work a run started but did not await, once the run has finished', async () => {
        let late: Promise<unknown> | undefined

        await withContext(context, () =>
            Transaction.run(async () => {
                // Not awaited, so it runs after the transaction has committed, still inside the run's context.
                late = new Promise((resolve) => setTimeout(resolve, 5)).then(() => useTransaction())
            }),
        )

        await expect(late!).rejects.toThrow(noTransaction)
    })

    it('throws once the callback rolled back the run’s transaction itself', async () => {
        await withContext(context, () =>
            Transaction.run(async (transaction) => {
                await transaction.rollback()
                expect(() => useTransaction()).toThrow(noTransaction)
            }),
        )
    })
})
