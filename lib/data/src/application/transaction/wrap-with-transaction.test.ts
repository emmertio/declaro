import { Context, withContext } from '@declaro/core'
import { describe, expect, it } from 'bun:test'
import { TransactionStatus, type ITransaction } from '../../domain/transaction/transaction-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { ITransactionScope } from '../../types/transaction-context'
import { wrapWithTransaction } from './wrap-with-transaction'

describe('wrapWithTransaction', () => {
    const setup = () => {
        const adapter = new MockTransactionAdapter()
        const context = new Context<ITransactionScope>()
        context.registerValue('transactionAdapter', adapter)
        return { adapter, context }
    }

    it('runs each call in its own transaction and forwards arguments', async () => {
        const { adapter, context } = setup()
        const seen: ITransaction[] = []

        const add = wrapWithTransaction(async (a: number, b: number) => {
            const transaction = useTransaction()
            expect(transaction.status).toBe(TransactionStatus.Active)
            seen.push(transaction)
            return a + b
        })

        const results = await withContext(context, async () => [await add(1, 2), await add(3, 4)])

        expect(results).toEqual([3, 7])
        expect(seen[0]).not.toBe(seen[1])
        expect(seen.map((transaction) => transaction.status)).toEqual([
            TransactionStatus.Committed,
            TransactionStatus.Committed,
        ])
        expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'commit', 'begin', 'commit'])
    })

    it('rolls back and rethrows when the wrapped function throws', async () => {
        const { adapter, context } = setup()
        const handler = wrapWithTransaction(async () => {
            throw new Error('handler failed')
        })

        await expect(withContext(context, () => handler())).rejects.toThrow('handler failed')
        expect(adapter.operations.map(({ operation }) => operation)).toEqual(['begin', 'rollback'])
    })
})
