import { Context, createRequestContext, useDeclaro, withContext, type Request } from '@declaro/core'
import { beforeEach, describe, expect, it } from 'bun:test'
import { TransactionStatus } from '../../domain/transaction/transaction-adapter-interface'
import { useTransaction } from '../../shared/utils/transaction/use-transaction'
import { MockTransactionAdapter } from '../../test/mock/transaction/mock-transaction-adapter'
import type { DataScope } from '../../types/data-context'
import { transactionModule } from './transaction-module'
import { withTransaction, wrapWithTransaction } from './with-transaction'

describe('transactionModule', () => {
    let appContext: Context<DataScope>
    let created: MockTransactionAdapter[]

    const request = { headers: {} } as unknown as Request

    beforeEach(async () => {
        created = []
        appContext = new Context<DataScope>()
        await appContext.use(
            useDeclaro(),
            transactionModule({
                createTransaction: () => {
                    const transaction = new MockTransactionAdapter()
                    created.push(transaction)
                    return transaction
                },
            }),
        )
    })

    it('lets app-level code start transactions', async () => {
        await withContext(appContext, () => withTransaction(async () => {}))

        expect(created).toHaveLength(1)
        expect(created[0]!.status).toBe(TransactionStatus.Committed)
    })

    it('gives each request one transaction of its own', async () => {
        const first = await createRequestContext(appContext, request)
        const second = await createRequestContext(appContext, request)

        const [a1, a2] = await withContext(first, async () => [await useTransaction(), await useTransaction()])
        const b = await withContext(second, () => useTransaction())

        expect(a1).toBe(a2)
        expect(a1).not.toBe(b)
        expect(created).toHaveLength(2)
    })

    it('supports manual control of the request transaction', async () => {
        const requestContext = await createRequestContext(appContext, request)

        await withContext(requestContext, async () => {
            const transaction = await useTransaction()
            await transaction.begin()

            await withTransaction(async (nested) => {
                expect(nested.parent).toBe(transaction)
            })

            await transaction.rollback()
            expect((await useTransaction()).status).toBe(TransactionStatus.RolledBack)
        })
    })

    it('wraps a request handler in the request transaction', async () => {
        const requestContext = await createRequestContext(appContext, request)
        const handler = wrapWithTransaction(async () => {
            throw new Error('handler failed')
        })

        await withContext(requestContext, async () => {
            await expect(handler()).rejects.toThrow('handler failed')
            expect((await useTransaction()).status).toBe(TransactionStatus.RolledBack)
        })

        expect(created).toHaveLength(1)
    })
})
