import { Context, withContext } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { Transaction } from '../../../application/transaction/transaction'
import type { ITransaction } from '../../../domain/transaction/transaction-interface'
import { MockTransactionAdapter } from './mock-transaction-adapter'

describe('MockTransactionAdapter', () => {
    const noHandle = 'The mock transaction adapter has no handle for this transaction'

    it('exposes the current transaction’s handle during the transaction', async () => {
        const adapter = new MockTransactionAdapter()

        await Transaction.run(
            async (outer) => {
                expect(adapter.handle()).toEqual({ id: 1, depth: 0 })

                await Transaction.run(async (nested) => {
                    expect(adapter.handle()).toEqual({ id: 2, depth: 1 })
                    expect(adapter.handle(nested)).toEqual({ id: 2, depth: 1 })
                    expect(adapter.handle(outer)).toEqual({ id: 1, depth: 0 })
                })
            },
            { adapter },
        )
    })

    it('throws for a transaction that has finished', async () => {
        const adapter = new MockTransactionAdapter()
        let committed: ITransaction | undefined
        let rolledBack: ITransaction | undefined

        await Transaction.run(async (transaction) => (committed = transaction), { adapter })
        await Transaction.run(
            async (transaction) => {
                rolledBack = transaction
                await transaction.rollback()
            },
            { adapter },
        )

        expect(() => adapter.handle(committed!)).toThrow(noHandle)
        expect(() => adapter.handle(rolledBack!)).toThrow(noHandle)
    })

    it('throws for a transaction that has not begun on it', () => {
        const adapter = new MockTransactionAdapter()
        const context = new Context()
        context.registerValue('transactionAdapter', adapter)

        expect(() => adapter.handle(new Transaction({ adapter }))).toThrow(noHandle)
        expect(() => withContext(context, () => adapter.handle())).toThrow('No transaction is active')
    })

    it('numbers transactions per adapter instance and logs every operation', async () => {
        const first = new MockTransactionAdapter()
        const second = new MockTransactionAdapter()

        await Transaction.run(async () => {}, { adapter: first })
        await Transaction.run(async () => {}, { adapter: second })

        expect(first.operations).toEqual([
            { operation: 'begin', transactionId: 1, depth: 0 },
            { operation: 'commit', transactionId: 1, depth: 0 },
        ])
        expect(second.operations.map(({ transactionId }) => transactionId)).toEqual([1, 1])
    })

    it('fails the configured operations and keeps the handle', async () => {
        const adapter = new MockTransactionAdapter({ failures: { commit: true } })
        let captured: ITransaction | undefined

        await expect(Transaction.run(async (transaction) => (captured = transaction), { adapter })).rejects.toThrow(
            'Mock commit failure',
        )
        expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'rollback'])
        expect(() => adapter.handle(captured!)).toThrow(noHandle)

        adapter.failures = { begin: true }
        await expect(Transaction.run(async () => {}, { adapter })).rejects.toThrow('Mock begin failure')
    })
})
